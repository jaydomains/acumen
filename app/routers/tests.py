"""tests router — four test modes; lock/shuffle config; frozen/
hand-authored question authoring (AC-D5 / AC-D11 / AC-D13 / AC-D17 /
AC-D24).

Admin-only. The router owns HTTP status + the CODE_SPEC §5 envelopes;
the mode-field matrix + AC-D11 timing rules are enforced in the schema
layer; persistence + lifecycle rules live in ``app.domain.tests``.
Routers stay thin (CODE_SPEC §2/§3). (pending P4 -> built P4)
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import tests as test_domain
from app.models import AppUser, Question, Test, get_db
from app.permissions import ROLE_ADMINISTRATOR, APIError, require_role
from app.schemas import (
    CampaignLockRequest,
    Page,
    PageMeta,
    QuestionCreate,
    QuestionResponse,
    QuestionUpdate,
    TestCreate,
    TestResponse,
    TestUpdate,
)

router = APIRouter(prefix="/v1/tests", tags=["tests"])

_require_admin = require_role(ROLE_ADMINISTRATOR)
_DEFAULT_LIMIT = test_domain.DEFAULT_PAGE_LIMIT
_MAX_LIMIT = test_domain.MAX_PAGE_LIMIT


async def _load(db: AsyncSession, test_id: uuid.UUID) -> Test:
    test = await test_domain.get_test(db, test_id)
    if test is None:
        raise APIError(404, "not_found", "Test not found.")
    return test


async def _load_question(
    db: AsyncSession, test_id: uuid.UUID, question_id: uuid.UUID
) -> Question:
    question = await test_domain.get_question(db, test_id, question_id)
    if question is None:
        raise APIError(404, "not_found", "Question not found.")
    return question


@router.post("", status_code=201)
async def create_test(
    body: TestCreate,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> TestResponse:
    test = await test_domain.create_test(
        db,
        actor_id=admin.id,
        name=body.name,
        mode=body.mode,
        visibility=body.visibility,
        timed=body.timed,
        duration_minutes=body.duration_minutes,
        pause_allowance=body.pause_allowance,
        timeout_behaviour=body.timeout_behaviour,
        max_pause_duration_minutes=body.max_pause_duration_minutes,
        pass_threshold=body.pass_threshold,
        target_difficulty=body.target_difficulty,
        randomise_question_order=bool(body.randomise_question_order),
        randomise_option_order=bool(body.randomise_option_order),
        benchmark_scope=body.benchmark_scope,
        benchmark_target_testee_id=body.benchmark_target_testee_id,
    )
    await db.commit()
    return TestResponse.model_validate(test)


@router.get("")
async def list_tests(
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
) -> Page[TestResponse]:
    rows, next_cursor = await test_domain.list_tests(db, cursor=cursor, limit=limit)
    return Page[TestResponse](
        data=[TestResponse.model_validate(r) for r in rows],
        meta=PageMeta(next_cursor=next_cursor),
    )


@router.get("/{test_id}")
async def get_test(
    test_id: uuid.UUID,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> TestResponse:
    return TestResponse.model_validate(await _load(db, test_id))


@router.patch("/{test_id}")
async def update_test(
    test_id: uuid.UUID,
    body: TestUpdate,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> TestResponse:
    test = await _load(db, test_id)
    test = await test_domain.update_test(
        db, test, body.model_dump(exclude_unset=True), actor_id=admin.id
    )
    await db.commit()
    return TestResponse.model_validate(test)


@router.delete("/{test_id}", status_code=204, response_class=Response)
async def delete_test(
    test_id: uuid.UUID,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    test = await _load(db, test_id)
    await test_domain.delete_test(db, test, actor_id=admin.id)
    await db.commit()
    return Response(status_code=204)


@router.post("/{test_id}/publish")
async def publish_test(
    test_id: uuid.UUID,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> TestResponse:
    test = await _load(db, test_id)
    test = await test_domain.publish_test(db, test, actor_id=admin.id)
    await db.commit()
    return TestResponse.model_validate(test)


@router.post("/{test_id}/lock")
async def lock_campaign(
    test_id: uuid.UUID,
    body: CampaignLockRequest,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> TestResponse:
    test = await _load(db, test_id)
    test = await test_domain.lock_campaign(
        db, test, actor_id=admin.id, campaign_id=body.campaign_id
    )
    await db.commit()
    return TestResponse.model_validate(test)


@router.post("/{test_id}/unlock")
async def unlock_campaign(
    test_id: uuid.UUID,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> TestResponse:
    test = await _load(db, test_id)
    test = await test_domain.unlock_campaign(db, test, actor_id=admin.id)
    await db.commit()
    return TestResponse.model_validate(test)


@router.post("/{test_id}/questions", status_code=201)
async def add_question(
    test_id: uuid.UUID,
    body: QuestionCreate,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> QuestionResponse:
    test = await _load(db, test_id)
    question = await test_domain.add_question(
        db,
        test=test,
        qtype=body.type,
        config=body.config,
        assigned_difficulty=body.assigned_difficulty,
        question_group_id=body.question_group_id,
    )
    await db.commit()
    return QuestionResponse.model_validate(question)


@router.get("/{test_id}/questions")
async def list_questions(
    test_id: uuid.UUID,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> Page[QuestionResponse]:
    await _load(db, test_id)
    rows = await test_domain.list_test_questions(db, test_id)
    return Page[QuestionResponse](
        data=[QuestionResponse.model_validate(q) for q in rows],
        meta=PageMeta(next_cursor=None),
    )


@router.patch("/{test_id}/questions/{question_id}")
async def update_question(
    test_id: uuid.UUID,
    question_id: uuid.UUID,
    body: QuestionUpdate,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> QuestionResponse:
    test = await _load(db, test_id)
    question = await _load_question(db, test_id, question_id)
    question = await test_domain.update_question(
        db, test, question, body.model_dump(exclude_unset=True)
    )
    await db.commit()
    return QuestionResponse.model_validate(question)


@router.delete(
    "/{test_id}/questions/{question_id}",
    status_code=204,
    response_class=Response,
)
async def delete_question(
    test_id: uuid.UUID,
    question_id: uuid.UUID,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    test = await _load(db, test_id)
    question = await _load_question(db, test_id, question_id)
    await test_domain.delete_question(db, test, question)
    await db.commit()
    return Response(status_code=204)
