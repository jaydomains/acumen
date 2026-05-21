"""attempts router — start, view, autosave, pause/resume, benchmark
next, submit (AC-D3 / AC-D4 / AC-D11 / AC-D13 / AC-D17 / AC-D18 /
AC-D24 / AC-D26).

The Testee owns their own attempt (admins can read any). The router
owns HTTP status + the CODE_SPEC §5 envelopes; the lifecycle rules
(rate limit, snapshot, lazy auto-resume, shuffle seed, sequence-number
retry, AC-D26 assignment_id validation) live in
``app.domain.attempts``. Routers stay thin (CODE_SPEC §2/§3).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import attempts as attempt_domain
from app.domain import tests as test_domain
from app.models import AppUser, Attempt, Test, TestMode, get_db
from app.permissions import (
    ROLE_ADMINISTRATOR,
    APIError,
    get_privacy_acked_user,
)
from app.schemas import (
    AttemptResultResponse,
    AttemptStartRequest,
    AttemptView,
    AutosaveRequest,
    BenchmarkNextResponse,
)

router = APIRouter(prefix="/v1/attempts", tags=["attempts"])


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
