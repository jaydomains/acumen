"""attempts router — start, view, autosave, pause/resume, benchmark
next, submit, SSE stream (AC-D3 / AC-D4 / AC-D11 / AC-D13 / AC-D17 /
AC-D18 / AC-D24 / AC-D25 / AC-D26).

The Testee owns their own attempt (admins can read any). The router
owns HTTP status + the CODE_SPEC §5 envelopes; the lifecycle rules
(rate limit, snapshot, lazy auto-resume, shuffle seed, sequence-number
retry, AC-D26 assignment_id validation) live in
``app.domain.attempts``. Routers stay thin (CODE_SPEC §2/§3).

P10 / AC-D25 v1.8 / AC-CD10 v1.8: the SSE endpoint
``GET /v1/attempts/{id}/stream`` opens a ``text/event-stream`` response
that replays persisted per-Testee Question rows (positions
> ``Last-Event-ID`` / ``?since=N``) then runs the
``app.domain.streaming.stream_attempt_questions`` orchestrator for
unfilled positions under an ``asyncio.Semaphore`` bound by
``Settings.jit_buffer_size``. Each completed slot emits an SSE event
with ``id=attempt_position``; terminal events: ``done`` (success) or
``paused`` (Q-N retry exhausted → AC-D11 system pause via
``pause_attempt_from_streaming``). Built on FastAPI's
``StreamingResponse`` — no ``sse-starlette`` dep (AC-CD1 minimum-deps).
"""

from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager
from typing import Any, cast

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.provider import Operation, resolve_provider
from app.config import get_settings
from app.domain import attempts as attempt_domain
from app.domain import tests as test_domain
from app.domain.pdf import render_attempt_pdf
from app.domain.streaming import (
    GenerationFailedError,
    GenerationSlot,
    stream_attempt_questions,
)
from app.models import (
    AppUser,
    Attempt,
    Question,
    Test,
    TestMode,
    _session_factory,
    get_db,
)
from app.permissions import (
    ROLE_ADMINISTRATOR,
    APIError,
    get_privacy_acked_user,
    load_user_by_id,
)
from app.schemas import (
    AttemptResultResponse,
    AttemptStartRequest,
    AttemptView,
    AutosaveRequest,
    BenchmarkNextResponse,
)

router = APIRouter(prefix="/v1/attempts", tags=["attempts"])


def get_jit_session_factory() -> object:
    """FastAPI dependency yielding the per-task session factory the
    SSE orchestrator uses. Production returns ``_session_factory()``
    (the lazy module-level ``async_sessionmaker`` from
    ``app.models``); tests override via
    ``app.dependency_overrides[get_jit_session_factory]`` to return a
    factory yielding the shared ``CatalogueFakeSession`` so per-task
    persistence runs against the AC-CD15 in-memory harness."""
    return _session_factory()


async def _load(
    db: AsyncSession, user: AppUser, attempt_id: uuid.UUID
) -> tuple[Attempt, Test]:
    attempt = await attempt_domain.get_attempt(db, attempt_id)
    if attempt is None:
        raise APIError(404, "not_found", "Attempt not found.")
    if user.role != ROLE_ADMINISTRATOR and attempt.testee_id != user.id:
        raise APIError(404, "not_found", "Attempt not found.")
    test = await test_domain.get_test(db, attempt.test_id)
    if test is None:
        raise APIError(404, "not_found", "Attempt not found.")
    return attempt, test


@router.post("", status_code=201)
async def start_attempt(
    body: AttemptStartRequest,
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptView:
    test = await test_domain.get_test(db, body.test_id)
    if test is None:
        raise APIError(404, "not_found", "Test not found.")
    attempt = await attempt_domain.start_attempt(
        db,
        test=test,
        testee_id=user.id,
        origin=body.origin,
        assignment_id=body.assignment_id,
    )
    await db.commit()
    view = await attempt_domain.view_attempt(db, attempt, test)
    # AC-D25 v1.8 / AC-CD10 v1.8: per-Testee POST surfaces the Q1
    # payload alongside the standard AttemptView so the FE renders Q1
    # immediately (~3-s after click) while opening the SSE stream for
    # Q2..N. Q1 is the only persisted per-Testee question at this
    # point; it lives in ``view["questions"]`` after the presentation
    # shuffle. We extract it via ``attempt_position == 1`` (the
    # snapshot-anchor-only contract guarantees Q1 is the sole row
    # with ``attempt_position`` set at attempt-start time). For
    # non-per-Testee modes ``q1`` stays ``None``.
    q1 = None
    if test.mode == TestMode.per_testee:
        q1 = _find_q1_in_view(view)
    return AttemptView(q1=q1, **view)


def _find_q1_in_view(view: dict[str, object]) -> dict[str, object] | None:
    questions = view.get("questions")
    if not isinstance(questions, list):
        return None
    for q in questions:
        if isinstance(q, dict) and q.get("attempt_position") == 1:
            return q
    return None


@router.get("/{attempt_id}")
async def get_attempt(
    attempt_id: uuid.UUID,
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptView:
    attempt, test = await _load(db, user, attempt_id)
    view = await attempt_domain.view_attempt(db, attempt, test)
    await db.commit()
    return AttemptView(**view)


@router.post("/{attempt_id}/autosave")
async def autosave(
    attempt_id: uuid.UUID,
    body: AutosaveRequest,
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    attempt, test = await _load(db, user, attempt_id)
    await attempt_domain.autosave(
        db,
        attempt,
        test,
        question_id=body.question_id,
        answer_payload=body.answer_payload,
        time_ms=body.time_ms,
    )
    await db.commit()
    return {"status": "ok"}


@router.post("/{attempt_id}/pause")
async def pause_attempt(
    attempt_id: uuid.UUID,
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    attempt, test = await _load(db, user, attempt_id)
    await attempt_domain.pause_attempt(db, attempt, test)
    await db.commit()
    return {"status": "paused"}


@router.post("/{attempt_id}/resume")
async def resume_attempt(
    attempt_id: uuid.UUID,
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    attempt, test = await _load(db, user, attempt_id)
    await attempt_domain.resume_attempt(db, attempt, test)
    await db.commit()
    return {"status": "resumed"}


@router.post("/{attempt_id}/next")
async def next_question(
    attempt_id: uuid.UUID,
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> BenchmarkNextResponse:
    attempt, test = await _load(db, user, attempt_id)
    result = await attempt_domain.next_question(db, attempt, test)
    await db.commit()
    return BenchmarkNextResponse(**result)


@router.post("/{attempt_id}/submit")
async def submit_attempt(
    attempt_id: uuid.UUID,
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptView:
    attempt, test = await _load(db, user, attempt_id)
    attempt = await attempt_domain.submit_attempt(db, attempt, test)
    await db.commit()
    view = await attempt_domain.view_attempt(db, attempt, test)
    return AttemptView(**view)


@router.get("/{attempt_id}/result")
async def attempt_result(
    attempt_id: uuid.UUID,
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptResultResponse:
    """F14 result-display gate. A fully-deterministic attempt returns
    the grades + overall outcome immediately; any AI-graded item flips
    the response to ``status = "review_pending"`` until P6 review
    closes the gate."""
    attempt, test = await _load(db, user, attempt_id)
    result = await attempt_domain.result_view(db, attempt, test)
    return AttemptResultResponse(**result)


@router.get("/{attempt_id}/export.pdf")
async def attempt_export_pdf(
    attempt_id: uuid.UUID,
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """P11 attempt-result PDF export (SPEC §3:136).

    Returns the attempt's graded result as a single-file PDF.
    Owner-testee or admin only (the standard ``_load`` ownership
    gate). Requires the attempt to be submitted (422
    ``attempt_not_submitted`` otherwise); the PDF is a result
    document, not an in-progress snapshot.
    """
    attempt, test = await _load(db, user, attempt_id)
    if attempt.submitted_at is None:
        raise APIError(
            422,
            "attempt_not_submitted",
            "PDF export is only available for submitted attempts.",
        )
    view = await attempt_domain.view_attempt(db, attempt, test)
    result = await attempt_domain.result_view(db, attempt, test)
    testee = await load_user_by_id(db, attempt.testee_id)
    testee_email = testee.email if testee is not None else "—"
    pdf_bytes = render_attempt_pdf(
        view,
        result,
        test_name=test.name,
        testee_email=testee_email,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="acumen-attempt-{attempt_id}.pdf"'
            ),
        },
    )


@router.get("/{attempt_id}/stream")
async def stream_attempt(
    attempt_id: uuid.UUID,
    request: Request,
    since: int = 0,
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
    session_factory: object = Depends(get_jit_session_factory),
) -> StreamingResponse:
    """P10 SSE stream of per-Testee Q1..QN (AC-D25 v1.8 / AC-CD10
    v1.8). Replays persisted Question rows with ``attempt_position >
    cursor`` then runs the orchestrator for unfilled positions.
    Cursor precedence: ``?since=N`` (FE explicit) wins over
    ``Last-Event-ID`` header (browser auto-reconnect default). Defensive
    default if neither: cursor = 0 (replay everything from position 1).

    Benchmark / frozen / hand-authored attempts return 409
    ``not_per_testee`` — they have no streaming generation.
    """
    attempt, test = await _load(db, user, attempt_id)
    if test.mode != TestMode.per_testee:
        raise APIError(
            409,
            "not_per_testee",
            "SSE streaming is per-Testee mode only; other modes use "
            "the snapshot / next-question path.",
        )
    cursor = _resume_cursor(since, last_event_id)
    settings = get_settings()
    # Per-attempt semaphore (not global) — v1.8 spec bounds in-flight
    # tasks per attempt, not across attempts. ``jit_buffer_size``
    # defaults to 3, max 5.
    semaphore = asyncio.Semaphore(settings.jit_buffer_size)
    # Resolve the system_settings row for provider override (reuses
    # the private helper from ``attempt_domain`` so the resolver path
    # is identical to ``start_attempt``'s).
    settings_row = await attempt_domain._system_settings(db)
    provider = resolve_provider(Operation.generation, system_settings=settings_row)

    async def pause_fn(target_attempt_id: uuid.UUID, reason: str) -> None:
        await attempt_domain.pause_attempt_from_streaming(
            session_factory, target_attempt_id, reason
        )

    return StreamingResponse(
        _sse_event_stream(
            request=request,
            attempt=attempt,
            cursor=cursor,
            provider=provider,
            semaphore=semaphore,
            session_factory=session_factory,
            pause_fn=pause_fn,
            grace_seconds=float(settings.jit_persist_grace_seconds),
        ),
        media_type="text/event-stream",
        headers={
            # Disable proxy buffering — SSE must flush per event so the
            # FE renders Q-N as they arrive, not in a batched response
            # after generation completes.
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


def _resume_cursor(since: int, last_event_id: str | None) -> int:
    """Compute the position cursor: ``?since=N`` wins over
    ``Last-Event-ID``. Both treat negative / non-numeric values as 0
    (defensive — a malformed header from an unfriendly client must
    not cause an exception in the streaming path)."""
    if since and since > 0:
        return since
    if last_event_id:
        try:
            parsed = int(last_event_id)
            if parsed > 0:
                return parsed
        except ValueError:
            pass
    return 0


async def _sse_event_stream(
    *,
    request: Request,
    attempt: Attempt,
    cursor: int,
    provider: object,
    semaphore: asyncio.Semaphore,
    session_factory: object,
    pause_fn: object,
    grace_seconds: float,
) -> AsyncIterator[bytes]:
    """Compose the SSE byte stream:
      1. Replay persisted per-Testee Question rows with
         ``attempt_position > cursor`` (sorted in Python; AC-CD15).
      2. Compute the unfilled position set in
         ``[2..total_question_count]``.
      3. Run ``stream_attempt_questions`` over the unfilled set;
         emit each yielded slot as an SSE event.
      4. Terminal event: ``done`` on success, ``paused`` on
         ``GenerationFailedError``.

    Each event is encoded as ``id: <position>\\ndata: <json>\\n\\n``
    per the SSE spec; terminal events use ``event: <name>``.
    """
    snapshot = attempt.question_snapshot or {}
    total_question_count = int(snapshot.get("total_question_count") or 0)
    payload_base = snapshot.get("streaming_payload_base") or {}

    # Step 1 — replay persisted Question rows beyond the cursor.
    factory = cast(Callable[[], AbstractAsyncContextManager[Any]], session_factory)
    replayed_positions: set[int] = set()
    async with factory() as replay_sess:
        rows_result = await replay_sess.execute(
            select(Question).where(Question.attempt_id == attempt.id)
        )
        per_testee_rows = list(rows_result.scalars().all())
    per_testee_rows.sort(
        key=lambda q: (
            q.attempt_position if q.attempt_position is not None else 10**9,
            str(q.id),
        )
    )
    for q in per_testee_rows:
        if q.attempt_position is None or q.attempt_position <= cursor:
            continue
        replayed_positions.add(q.attempt_position)
        yield _format_sse_event(
            event_id=q.attempt_position,
            payload=_question_view(q),
        )

    # Step 2 — compute unfilled positions in [2..N]. Q1 is sync at
    # start_attempt; the SSE never re-orchestrates Q1.
    all_positions = set(range(2, total_question_count + 1))
    filled_positions = {
        q.attempt_position for q in per_testee_rows if q.attempt_position is not None
    }
    unfilled = sorted(all_positions - filled_positions)

    if not unfilled:
        yield _format_sse_terminal(
            event_name="done",
            payload={
                "completed_positions": sorted(filled_positions),
                "replayed_positions": sorted(replayed_positions),
            },
        )
        return

    # Step 3 — run orchestrator; yield each completed slot.
    completed_now: list[int] = []
    try:
        async for slot in stream_attempt_questions(
            attempt_id=attempt.id,
            tenant_id=attempt.tenant_id,
            positions=unfilled,
            payload_base=payload_base,
            provider=provider,  # type: ignore[arg-type]
            semaphore=semaphore,
            session_factory=session_factory,  # type: ignore[arg-type]
            pause_fn=pause_fn,  # type: ignore[arg-type]
            grace_seconds=grace_seconds,
        ):
            completed_now.append(slot.position)
            yield _format_sse_event(
                event_id=slot.position,
                payload=_slot_view(slot, attempt_id=attempt.id),
            )
    except GenerationFailedError as exc:
        yield _format_sse_terminal(
            event_name="paused",
            payload={
                "reason": exc.reason,
                "failed_position": exc.position,
                "completed_positions": exc.completed_positions,
            },
        )
        return

    yield _format_sse_terminal(
        event_name="done",
        payload={
            "completed_positions": sorted(filled_positions | set(completed_now)),
            "replayed_positions": sorted(replayed_positions),
        },
    )


def _format_sse_event(*, event_id: int, payload: dict) -> bytes:
    """Standard SSE event: ``id:`` line + ``data:`` line + blank line."""
    return (f"id: {event_id}\n" f"data: {json.dumps(payload, default=str)}\n\n").encode()


def _format_sse_terminal(*, event_name: str, payload: dict) -> bytes:
    """Terminal SSE event with explicit ``event:`` name so the FE
    branches on ``done`` vs ``paused`` cleanly."""
    return (
        f"event: {event_name}\n" f"data: {json.dumps(payload, default=str)}\n\n"
    ).encode()


def _slot_view(slot: GenerationSlot, *, attempt_id: uuid.UUID) -> dict:
    """SSE event payload for a freshly-resolved per-Testee Question.
    The orchestrator persists the Question row via its own session
    before returning the slot; the SSE handler emits the minimal
    identifying payload (id, position) — the FE follows up with a
    GET /v1/attempts/{id} to fetch the full presented question when
    it reaches that position, which keeps the SSE event small (well
    inside event-source byte-size sanity)."""
    return {
        "id": str(slot.question_id) if slot.question_id is not None else None,
        "attempt_position": slot.position,
        "attempt_id": str(attempt_id),
    }


def _question_view(q: Question) -> dict:
    """SSE event payload for a replayed persisted Question — same
    shape as a freshly-resolved slot for consistency."""
    return {
        "id": str(q.id),
        "attempt_position": q.attempt_position,
        "attempt_id": str(q.attempt_id) if q.attempt_id is not None else None,
    }
