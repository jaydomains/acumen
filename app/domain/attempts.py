"""Attempt lifecycle — start / resume / autosave / pause / submit
(AC-D3 / AC-D4 / AC-D11 / AC-D17 / AC-D24 / AC-D26).

The deterministic half of P4: a Testee's run at a frozen/hand-authored
test is snapshotted at start (AC-D17), presented in a per-attempt shuffle
seeded off the attempt id so the order is **stable across resume**
(AC-D24), and paused by blanking question content while preserving the
already-autosaved input (amended AC-D11). The attempt is attributed to
its originating assignment via ``Attempt.assignment_id`` (AC-D26 v1.4)
for assignment-/loop-driven origin. Generation (per-Testee / benchmark,
P5/P10) and grading + ``engagement_status`` derivation (P4 Slice 3) are
out of scope here.

Routers stay thin (CODE_SPEC §2/§3): queries stay at id/tenant equality
with Python-side ordering, so the zero-DB/zero-network seam holds
(AC-CD15). This module is a P4 structural addition folded into the
phase handover per SESSION_START (see ``app.domain.tests``).
"""

from __future__ import annotations

import random
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.catalogue import record_audit
from app.models import (
    SEED_TENANT_ID,
    Attempt,
    AttemptOrigin,
    AttemptPauseEvent,
    Question,
    QuestionType,
    Response,
    Test,
    TestMode,
    TestStatus,
)
from app.permissions import APIError, now_utc

__all__ = [
    "presentation_order",
    "start_attempt",
    "get_attempt",
    "attempt_view",
    "autosave_response",
    "pause_attempt",
    "resume_attempt",
    "submit_attempt",
]

# Snapshot is taken against the test entity for these modes only
# (AC-D17); per-Testee / benchmark generate against the attempt later.
_SNAPSHOT_MODES = (TestMode.frozen, TestMode.hand_authored)

# Seed must fit a 4-byte signed Integer column; the attempt id is the
# stable source so resume re-derives the identical order (AC-D24).
_SEED_MOD = 2**31 - 1


def _seed_from_id(attempt_id: uuid.UUID) -> int:
    return int(attempt_id.hex[:8], 16) % _SEED_MOD


def _present(q: dict[str, Any], *, seed: int, randomise_options: bool) -> dict[str, Any]:
    """Strip answer keys and (optionally) shuffle option/pair sides for
    the Testee-facing view. The per-question RNG is seeded off the
    attempt seed XOR the question id, so it too is stable across resume
    and independent per question."""
    cfg = q["config"]
    qtype = q["type"]
    rng = random.Random(seed ^ (int(uuid.UUID(q["id"]).hex[:8], 16)))
    view: dict[str, Any] = {"prompt": cfg.get("prompt")}
    if qtype == QuestionType.multiple_choice.value:
        options = list(cfg.get("options", []))
        if randomise_options:
            rng.shuffle(options)
        view["options"] = options
    elif qtype == QuestionType.matching.value:
        pairs = cfg.get("pairs", [])
        view["left"] = [p["left"] for p in pairs]
        rights = [p["right"] for p in pairs]
        if randomise_options:
            rng.shuffle(rights)
        view["right"] = rights
    return {
        "id": q["id"],
        "type": qtype,
        "assigned_difficulty": q["assigned_difficulty"],
        "question_group_id": q.get("question_group_id"),
        "config": view,
    }


def presentation_order(
    questions: list[dict[str, Any]],
    *,
    seed: int,
    randomise_questions: bool,
    randomise_options: bool,
) -> list[dict[str, Any]]:
    """Deterministic per-attempt presentation (AC-D24).

    Questions sharing a ``question_group_id`` shuffle as one block with
    internal order preserved (the case-study pattern); ungrouped
    questions are singleton blocks. With both toggles off this is the
    canonical snapshot order. Pure and seed-driven, so a resume that
    re-derives from the persisted ``shuffle_seed`` yields the identical
    order — the AC-D24 resume-stability guarantee."""
    blocks: list[list[dict[str, Any]]] = []
    index: dict[Any, int] = {}
    for q in questions:
        gid = q.get("question_group_id")
        key = ("g", gid) if gid is not None else ("s", q["id"])
        if key not in index:
            index[key] = len(blocks)
            blocks.append([])
        blocks[index[key]].append(q)
    order = list(range(len(blocks)))
    if randomise_questions:
        random.Random(seed).shuffle(order)
    out: list[dict[str, Any]] = []
    for bi in order:
        for q in blocks[bi]:
            out.append(_present(q, seed=seed, randomise_options=randomise_options))
    return out


async def _by_id(db: AsyncSession, model: Any, obj_id: uuid.UUID) -> Any | None:
    result = await db.execute(
        select(model).where(model.id == obj_id, model.tenant_id == SEED_TENANT_ID)
    )
    return result.scalar_one_or_none()


async def _attempt_rows(db: AsyncSession, **eq: Any) -> list[Any]:
    result = await db.execute(
        select(Attempt).where(
            Attempt.tenant_id == SEED_TENANT_ID,
            *[getattr(Attempt, k) == v for k, v in eq.items()],
        )
    )
    return list(result.scalars().all())


async def _responses(db: AsyncSession, attempt_id: uuid.UUID) -> list[Response]:
    result = await db.execute(
        select(Response).where(
            Response.attempt_id == attempt_id,
            Response.tenant_id == SEED_TENANT_ID,
        )
    )
    return list(result.scalars().all())


async def _open_pause(
    db: AsyncSession, attempt_id: uuid.UUID
) -> AttemptPauseEvent | None:
    result = await db.execute(
        select(AttemptPauseEvent).where(
            AttemptPauseEvent.attempt_id == attempt_id,
            AttemptPauseEvent.tenant_id == SEED_TENANT_ID,
        )
    )
    for ev in result.scalars().all():
        if ev.ended_at is None:
            return ev
    return None


def _snapshot(questions: list[Question]) -> dict[str, Any]:
    return {
        "questions": [
            {
                "id": str(q.id),
                "type": q.type.value,
                "config": q.config,
                "assigned_difficulty": q.assigned_difficulty,
                "question_group_id": (
                    str(q.question_group_id) if q.question_group_id is not None else None
                ),
            }
            for q in questions
        ]
    }


async def start_attempt(
    db: AsyncSession,
    *,
    testee_id: uuid.UUID,
    test: Test,
    origin: AttemptOrigin,
    assignment_id: uuid.UUID | None = None,
) -> Attempt:
    """Open an attempt. Only published tests are attemptable (AC-D3).
    Frozen/hand-authored question sets are snapshotted now so later
    edits never rewrite this attempt (AC-D17). ``shuffle_seed`` derives
    from the attempt id (AC-D24). ``assignment_id`` is set for
    assignment-/loop-driven origin and left null for self-initiated
    (AC-D26 v1.4)."""
    if test.status != TestStatus.published:
        raise APIError(
            409, "test_not_published", "Only published tests can be attempted."
        )
    if origin is AttemptOrigin.self_initiated:
        assignment_id = None
    elif assignment_id is None:
        raise APIError(
            422,
            "assignment_required",
            "Assignment-driven and loop-driven attempts need an assignment.",
        )
    prior = await _attempt_rows(db, test_id=test.id, testee_id=testee_id)
    attempt = Attempt(
        tenant_id=SEED_TENANT_ID,
        test_id=test.id,
        testee_id=testee_id,
        origin=origin,
        sequence_number=len(prior) + 1,
        assignment_id=assignment_id,
        started_at=now_utc(),
        pauses_used=0,
        total_pause_duration_seconds=0,
    )
    db.add(attempt)
    await db.flush()
    await db.refresh(attempt)
    attempt.shuffle_seed = _seed_from_id(attempt.id)
    if test.mode in _SNAPSHOT_MODES:
        result = await db.execute(
            select(Question).where(
                Question.test_id == test.id,
                Question.tenant_id == SEED_TENANT_ID,
            )
        )
        questions = sorted(
            result.scalars().all(), key=lambda q: (q.created_at, str(q.id))
        )
        attempt.question_snapshot = _snapshot(questions)
    await db.flush()
    await record_audit(
        db,
        actor_id=testee_id,
        action="attempt.start",
        target_entity="attempt",
        target_id=attempt.id,
        detail={"origin": origin.value, "test_id": str(test.id)},
    )
    return attempt


async def get_attempt(db: AsyncSession, attempt_id: uuid.UUID) -> Attempt | None:
    return await _by_id(db, Attempt, attempt_id)


async def attempt_view(db: AsyncSession, attempt: Attempt, test: Test) -> dict[str, Any]:
    """The Testee view. While paused, question content is blanked
    (amended AC-D11) — the autosaved responses are kept server-side and
    restored on resume. Otherwise questions render in the stable
    per-attempt order (AC-D24)."""
    paused = await _open_pause(db, attempt.id) is not None
    submitted = attempt.submitted_at is not None
    status = "submitted" if submitted else ("paused" if paused else "in_progress")
    snapshot = (attempt.question_snapshot or {}).get("questions", [])
    questions = (
        []
        if paused or submitted
        else presentation_order(
            snapshot,
            seed=attempt.shuffle_seed or 0,
            randomise_questions=test.randomise_question_order,
            randomise_options=test.randomise_option_order,
        )
    )
    responses = {
        str(r.question_id): r.answer_payload for r in await _responses(db, attempt.id)
    }
    return {
        "id": attempt.id,
        "test_id": attempt.test_id,
        "assignment_id": attempt.assignment_id,
        "origin": attempt.origin,
        "status": status,
        "paused": paused,
        "sequence_number": attempt.sequence_number,
        "started_at": attempt.started_at,
        "submitted_at": attempt.submitted_at,
        "pauses_used": attempt.pauses_used,
        "pause_allowance": test.pause_allowance,
        "total_pause_duration_seconds": attempt.total_pause_duration_seconds,
        "questions": questions,
        "responses": responses,
    }


def _guard_open(attempt: Attempt, paused: bool) -> None:
    if attempt.submitted_at is not None:
        raise APIError(409, "attempt_submitted", "This attempt is already submitted.")
    if paused:
        raise APIError(409, "attempt_paused", "Resume the attempt before continuing.")


async def autosave_response(
    db: AsyncSession,
    attempt: Attempt,
    *,
    question_id: uuid.UUID,
    answer_payload: dict[str, Any] | None,
) -> Response:
    """Idempotent on ``(attempt, question)`` (AC-CD6). Rejected while
    paused or submitted — input cannot change behind the pause overlay."""
    _guard_open(attempt, await _open_pause(db, attempt.id) is not None)
    for row in await _responses(db, attempt.id):
        if row.question_id == question_id:
            row.answer_payload = answer_payload
            await db.flush()
            return row
    response = Response(
        tenant_id=SEED_TENANT_ID,
        attempt_id=attempt.id,
        question_id=question_id,
        answer_payload=answer_payload,
    )
    db.add(response)
    await db.flush()
    await db.refresh(response)
    return response


async def pause_attempt(
    db: AsyncSession, attempt: Attempt, test: Test, *, actor_id: uuid.UUID
) -> AttemptPauseEvent:
    """Open a pause window (AC-D11). Untimed tests have no pause
    mechanism; tests of 60 minutes or less permit none (``pause_allowance``
    is 0); the per-test allowance caps the rest."""
    if await _open_pause(db, attempt.id) is not None:
        raise APIError(409, "already_paused", "The attempt is already paused.")
    _guard_open(attempt, False)
    if not test.timed:
        raise APIError(409, "pause_unsupported", "Untimed tests have no pause mechanism.")
    if attempt.pauses_used >= (test.pause_allowance or 0):
        raise APIError(409, "pause_not_allowed", "No pauses remaining for this attempt.")
    event = AttemptPauseEvent(
        tenant_id=SEED_TENANT_ID,
        attempt_id=attempt.id,
        started_at=now_utc(),
        auto_resumed=False,
    )
    db.add(event)
    attempt.pauses_used += 1
    await db.flush()
    await db.refresh(event)
    await record_audit(
        db,
        actor_id=actor_id,
        action="attempt.pause",
        target_entity="attempt",
        target_id=attempt.id,
        detail={"pauses_used": attempt.pauses_used},
    )
    return event


async def resume_attempt(
    db: AsyncSession, attempt: Attempt, test: Test, *, actor_id: uuid.UUID
) -> AttemptPauseEvent:
    """Close the open pause window and restore content. A window past
    ``max_pause_duration_minutes`` is closed as ``auto_resumed`` (the
    AC-D11 max-duration cap; the beat-driven sweep is P11)."""
    event = await _open_pause(db, attempt.id)
    if event is None:
        raise APIError(409, "not_paused", "The attempt is not paused.")
    ended = now_utc()
    duration = max(0, int((ended - event.started_at).total_seconds()))
    event.ended_at = ended
    event.duration_seconds = duration
    event.auto_resumed = duration > test.max_pause_duration_minutes * 60
    attempt.total_pause_duration_seconds += duration
    await db.flush()
    await record_audit(
        db,
        actor_id=actor_id,
        action="attempt.resume",
        target_entity="attempt",
        target_id=attempt.id,
        detail={"auto_resumed": event.auto_resumed, "duration_s": duration},
    )
    return event


async def submit_attempt(
    db: AsyncSession, attempt: Attempt, *, actor_id: uuid.UUID
) -> Attempt:
    """Close the attempt. Deterministic/AI grading + ``engagement_status``
    derivation land in P4 Slice 3; this only finalises the lifecycle
    state so the attempt can be graded."""
    _guard_open(attempt, await _open_pause(db, attempt.id) is not None)
    attempt.submitted_at = now_utc()
    await db.flush()
    await record_audit(
        db,
        actor_id=actor_id,
        action="attempt.submit",
        target_entity="attempt",
        target_id=attempt.id,
    )
    return attempt
