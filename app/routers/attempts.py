"""attempts router — start, view, autosave, pause/resume, benchmark
next, submit (AC-D3 / AC-D11 / AC-D13 / AC-D17 / AC-D24).

Testee-owned: every route resolves the caller via the privacy-acked
auth seam and an attempt is only visible to its own Testee (admins may
read any). The router owns HTTP status + the CODE_SPEC §5 envelopes;
lifecycle, snapshot, shuffle and pause mechanics live in
``app.domain.attempts``. Grading is wired in P4 Slice 3; per-Testee SSE
streaming is P10. (pending P4 -> built P4)
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import attempts as attempt_domain
from app.domain import tests as test_domain
from app.models import AppUser, Attempt, Test, get_db
from app.permissions import ROLE_ADMINISTRATOR, APIError, get_privacy_acked_user
from app.schemas import (
    AttemptStartRequest,
    AttemptView,
    AutosaveRequest,
    BenchmarkNextResponse,
    MessageResponse,
)

router = APIRouter(prefix="/v1/attempts", tags=["attempts"])


async def _load(
    db: AsyncSession, attempt_id: uuid.UUID, user: AppUser
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
        db, test=test, testee_id=user.id, origin=body.origin
    )
    await db.commit()
    return AttemptView(**await attempt_domain.view_attempt(db, attempt, test))


@router.get("/{attempt_id}")
async def get_attempt(
    attempt_id: uuid.UUID,
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptView:
    attempt, test = await _load(db, attempt_id, user)
    view = await attempt_domain.view_attempt(db, attempt, test)
    await db.commit()
    return AttemptView(**view)


@router.post("/{attempt_id}/autosave")
async def autosave(
    attempt_id: uuid.UUID,
    body: AutosaveRequest,
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    attempt, test = await _load(db, attempt_id, user)
    await attempt_domain.autosave(
        db,
        attempt,
        test,
        question_id=body.question_id,
        answer_payload=body.answer_payload,
        time_ms=body.time_ms,
    )
    await db.commit()
    return MessageResponse()


@router.post("/{attempt_id}/pause")
async def pause_attempt(
    attempt_id: uuid.UUID,
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptView:
    attempt, test = await _load(db, attempt_id, user)
    await attempt_domain.pause_attempt(db, attempt, test)
    await db.commit()
    return AttemptView(**await attempt_domain.view_attempt(db, attempt, test))


@router.post("/{attempt_id}/resume")
async def resume_attempt(
    attempt_id: uuid.UUID,
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptView:
    attempt, test = await _load(db, attempt_id, user)
    await attempt_domain.resume_attempt(db, attempt, test)
    await db.commit()
    return AttemptView(**await attempt_domain.view_attempt(db, attempt, test))


@router.post("/{attempt_id}/next")
async def next_question(
    attempt_id: uuid.UUID,
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> BenchmarkNextResponse:
    attempt, test = await _load(db, attempt_id, user)
    result = await attempt_domain.next_question(db, attempt, test)
    await db.commit()
    return BenchmarkNextResponse(**result)


@router.post("/{attempt_id}/submit")
async def submit_attempt(
    attempt_id: uuid.UUID,
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> AttemptView:
    attempt, test = await _load(db, attempt_id, user)
    await attempt_domain.submit_attempt(db, attempt, test)
    await db.commit()
    return AttemptView(**await attempt_domain.view_attempt(db, attempt, test))
