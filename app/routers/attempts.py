"""attempts router — attempt lifecycle (start / resume / autosave /
pause / submit).

AC-D3 / AC-D4 / AC-D11 / AC-D17 / AC-D24 / AC-D26. Testee-owned: an
attempt is started and driven by the Testee taking it. The router owns
HTTP status + the CODE_SPEC §5 envelope; snapshot, shuffle, pause and
attribution rules live in ``app.domain.attempts``. Per-Testee/benchmark
generation (P5/P10) and grading + ``engagement_status`` (P4 Slice 3)
are out of scope here. Routers stay thin (CODE_SPEC §2/§3).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import assignments as assignment_domain
from app.domain import attempts as attempt_domain
from app.domain import tests as test_domain
from app.models import AppUser, Attempt, AttemptOrigin, Test, get_db
from app.permissions import ROLE_TESTEE, APIError, require_role
from app.schemas import AttemptStart, AttemptView, ResponseSave

router = APIRouter(prefix="/v1/attempts", tags=["attempts"])

_require_testee = require_role(ROLE_TESTEE)


async def _load_owned(
    db: AsyncSession, attempt_id: uuid.UUID, user: AppUser
) -> tuple[Attempt, Test]:
    attempt = await attempt_domain.get_attempt(db, attempt_id)
    if attempt is None or attempt.testee_id != user.id:
        raise APIError(404, "not_found", "Attempt not found.")
    test = await test_domain.get_test(db, attempt.test_id)
    if test is None:
        raise APIError(404, "not_found", "Attempt not found.")
    return attempt, test


async def _view(db: AsyncSession, attempt: Attempt, test: Test) -> AttemptView:
    return AttemptView.model_validate(
        await attempt_domain.attempt_view(db, attempt, test)
    )


@router.post("", status_code=201)
async def start_attempt(
    body: AttemptStart,
    testee: AppUser = Depends(_require_testee),
    db: AsyncSession = Depends(get_db),
) -> AttemptView:
    test = await test_domain.get_test(db, body.test_id)
    if test is None:
        raise APIError(404, "not_found", "Test not found.")
    origin = AttemptOrigin.self_initiated
    assignment_id: uuid.UUID | None = None
    if body.assignment_id is not None:
        assignment = await assignment_domain.get_assignment(db, body.assignment_id)
        if assignment is None:
            raise APIError(404, "not_found", "Assignment not found.")
        assignees = await assignment_domain.assignee_ids(db, assignment.id)
        if testee.id not in assignees:
            raise APIError(404, "not_found", "Assignment not found.")
        origin = AttemptOrigin.assignment_driven
        assignment_id = assignment.id
    attempt = await attempt_domain.start_attempt(
        db,
        testee_id=testee.id,
        test=test,
        origin=origin,
        assignment_id=assignment_id,
    )
    await db.commit()
    return await _view(db, attempt, test)


@router.get("/{attempt_id}")
async def get_attempt(
    attempt_id: uuid.UUID,
    testee: AppUser = Depends(_require_testee),
    db: AsyncSession = Depends(get_db),
) -> AttemptView:
    attempt, test = await _load_owned(db, attempt_id, testee)
    return await _view(db, attempt, test)


@router.post("/{attempt_id}/responses")
async def save_response(
    attempt_id: uuid.UUID,
    body: ResponseSave,
    testee: AppUser = Depends(_require_testee),
    db: AsyncSession = Depends(get_db),
) -> AttemptView:
    attempt, test = await _load_owned(db, attempt_id, testee)
    await attempt_domain.autosave_response(
        db,
        attempt,
        question_id=body.question_id,
        answer_payload=body.answer_payload,
    )
    await db.commit()
    return await _view(db, attempt, test)


@router.post("/{attempt_id}/pause")
async def pause_attempt(
    attempt_id: uuid.UUID,
    testee: AppUser = Depends(_require_testee),
    db: AsyncSession = Depends(get_db),
) -> AttemptView:
    attempt, test = await _load_owned(db, attempt_id, testee)
    await attempt_domain.pause_attempt(db, attempt, test, actor_id=testee.id)
    await db.commit()
    return await _view(db, attempt, test)


@router.post("/{attempt_id}/resume")
async def resume_attempt(
    attempt_id: uuid.UUID,
    testee: AppUser = Depends(_require_testee),
    db: AsyncSession = Depends(get_db),
) -> AttemptView:
    attempt, test = await _load_owned(db, attempt_id, testee)
    await attempt_domain.resume_attempt(db, attempt, test, actor_id=testee.id)
    await db.commit()
    return await _view(db, attempt, test)


@router.post("/{attempt_id}/submit")
async def submit_attempt(
    attempt_id: uuid.UUID,
    testee: AppUser = Depends(_require_testee),
    db: AsyncSession = Depends(get_db),
) -> AttemptView:
    attempt, test = await _load_owned(db, attempt_id, testee)
    await attempt_domain.submit_attempt(db, attempt, actor_id=testee.id)
    await db.commit()
    return await _view(db, attempt, test)
