"""Test + question persistence (AC-D3 / AC-D5 / AC-D11 / AC-D13 /
AC-D17 / AC-D24).

The data-access seam for the four ``TestMode``s (per-Testee spec,
frozen, hand-authored, benchmark) and the frozen/hand-authored question
set. Mode-specific *field* validation lives in the schema layer
(``app/schemas.py``); structural and lifecycle rules — campaign lock,
publish gate, forward-only edit (AC-D17), question-config shape — live
here. Per-Testee generation and benchmark sequencing run against the
attempt (P4 Slice 2), not the test.

Routers stay thin (CODE_SPEC §2/§3): they own HTTP status + envelopes
and delegate every row read/write here. Queries stay at id/tenant
equality with Python-side ordering/pagination (catalogue precedent), so
the zero-DB/zero-network test seam holds (AC-CD15).
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.catalogue import (
    DEFAULT_PAGE_LIMIT,
    MAX_PAGE_LIMIT,
    paginate,
    record_audit,
)
from app.models import (
    SEED_TENANT_ID,
    LockMode,
    Question,
    QuestionType,
    Test,
    TestMode,
    TestStatus,
    TestVisibility,
    TimeoutBehaviour,
)
from app.permissions import APIError

__all__ = [
    "DEFAULT_PAGE_LIMIT",
    "MAX_PAGE_LIMIT",
    "create_test",
    "get_test",
    "list_tests",
    "update_test",
    "publish_test",
    "delete_test",
    "lock_campaign",
    "unlock_campaign",
    "validate_question_config",
    "add_question",
    "list_test_questions",
    "get_question",
    "update_question",
    "delete_question",
]

# Modes whose question set is authored against the test entity (AC-D5).
_AUTHORED_MODES = (TestMode.frozen, TestMode.hand_authored)


async def _tenant_rows(db: AsyncSession, model: Any) -> list[Any]:
    result = await db.execute(select(model).where(model.tenant_id == SEED_TENANT_ID))
    return list(result.scalars().all())


async def _by_id(db: AsyncSession, model: Any, obj_id: uuid.UUID) -> Any | None:
    result = await db.execute(
        select(model).where(model.id == obj_id, model.tenant_id == SEED_TENANT_ID)
    )
    return result.scalar_one_or_none()


def _guard_unlocked(test: Test) -> None:
    """Campaign-locked frozen/hand-authored tests reject edit/delete/
    question mutation until explicitly unlocked (AC-D24)."""
    if test.lock_mode == LockMode.campaign_locked:
        raise APIError(
            409,
            "test_campaign_locked",
            "This test is campaign-locked; unlock it before editing.",
        )


# --- tests ------------------------------------------------------------


async def create_test(
    db: AsyncSession,
    *,
    actor_id: uuid.UUID,
    name: str,
    mode: TestMode,
    visibility: TestVisibility = TestVisibility.library,
    timed: bool = False,
    duration_minutes: int | None = None,
    pause_allowance: int | None = None,
    timeout_behaviour: TimeoutBehaviour = TimeoutBehaviour.auto_submit,
    max_pause_duration_minutes: int = 30,
    pass_threshold: float | None = None,
    target_difficulty: int | None = None,
    lock_mode: LockMode = LockMode.open,
    campaign_id: uuid.UUID | None = None,
    randomise_question_order: bool = True,
    randomise_option_order: bool = True,
    benchmark_scope: Any | None = None,
    benchmark_target_testee_id: uuid.UUID | None = None,
) -> Test:
    """Create a draft test. The schema layer has already enforced the
    mode-field matrix and the AC-D11 timing/pause rules; this sets
    explicit values for every non-nullable column (the test seam does
    not apply ``server_default``s — P3 trap)."""
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name=name,
        mode=mode,
        status=TestStatus.draft,
        visibility=visibility,
        timed=timed,
        duration_minutes=duration_minutes,
        pause_allowance=pause_allowance,
        timeout_behaviour=timeout_behaviour,
        max_pause_duration_minutes=max_pause_duration_minutes,
        pass_threshold=pass_threshold,
        target_difficulty=target_difficulty,
        lock_mode=lock_mode,
        campaign_id=campaign_id,
        randomise_question_order=randomise_question_order,
        randomise_option_order=randomise_option_order,
        benchmark_scope=benchmark_scope,
        benchmark_target_testee_id=benchmark_target_testee_id,
    )
    db.add(test)
    await db.flush()
    await db.refresh(test)
    await record_audit(
        db,
        actor_id=actor_id,
        action="test.create",
        target_entity="test",
        target_id=test.id,
        detail={"mode": mode.value},
    )
    return test


async def get_test(db: AsyncSession, test_id: uuid.UUID) -> Test | None:
    return await _by_id(db, Test, test_id)


async def list_tests(
    db: AsyncSession, *, cursor: str | None, limit: int
) -> tuple[list[Test], str | None]:
    """Admin listing — includes draft and private tests."""
    return paginate(await _tenant_rows(db, Test), cursor, limit)


async def update_test(
    db: AsyncSession, test: Test, fields: dict[str, Any], *, actor_id: uuid.UUID
) -> Test:
    """Forward-only edit (AC-D17): historical attempts keep their
    snapshot; this never rewrites past attempts. Rejected while
    campaign-locked (AC-D24)."""
    _guard_unlocked(test)
    for key, value in fields.items():
        setattr(test, key, value)
    await db.flush()
    await record_audit(
        db,
        actor_id=actor_id,
        action="test.update",
        target_entity="test",
        target_id=test.id,
        detail={"fields": sorted(fields)},
    )
    return test


async def publish_test(db: AsyncSession, test: Test, *, actor_id: uuid.UUID) -> Test:
    """Draft → published. Frozen/hand-authored tests must carry at
    least one authored question (AC-D5)."""
    if test.mode in _AUTHORED_MODES:
        questions = await list_test_questions(db, test.id)
        if not questions:
            raise APIError(
                422,
                "empty_test",
                "A frozen or hand-authored test needs at least one question "
                "before it can be published.",
            )
    test.status = TestStatus.published
    await db.flush()
    await record_audit(
        db,
        actor_id=actor_id,
        action="test.publish",
        target_entity="test",
        target_id=test.id,
    )
    return test


async def delete_test(db: AsyncSession, test: Test, *, actor_id: uuid.UUID) -> None:
    """Campaign-locked tests cannot be deleted while locked (AC-D24)."""
    _guard_unlocked(test)
    for question in await list_test_questions(db, test.id):
        await db.delete(question)
    await db.delete(test)
    await record_audit(
        db,
        actor_id=actor_id,
        action="test.delete",
        target_entity="test",
        target_id=test.id,
    )


async def lock_campaign(
    db: AsyncSession, test: Test, *, actor_id: uuid.UUID, campaign_id: uuid.UUID
) -> Test:
    """Mark a frozen/hand-authored test campaign-locked (AC-D24)."""
    if test.mode not in _AUTHORED_MODES:
        raise APIError(
            422,
            "lock_unsupported",
            "Only frozen or hand-authored tests support campaign lock.",
        )
    test.lock_mode = LockMode.campaign_locked
    test.campaign_id = campaign_id
    await db.flush()
    await record_audit(
        db,
        actor_id=actor_id,
        action="test.campaign_lock",
        target_entity="test",
        target_id=test.id,
        detail={"campaign_id": str(campaign_id)},
    )
    return test


async def unlock_campaign(db: AsyncSession, test: Test, *, actor_id: uuid.UUID) -> Test:
    """Close the campaign (unlock). Audited admin action (AC-D24)."""
    test.lock_mode = LockMode.open
    await db.flush()
    await record_audit(
        db,
        actor_id=actor_id,
        action="test.campaign_unlock",
        target_entity="test",
        target_id=test.id,
    )
    return test


# --- questions (frozen / hand-authored) -------------------------------


def validate_question_config(qtype: QuestionType, config: Any) -> None:
    """Single source of truth for question-config shape. Deterministic
    types (MCQ / true-false / matching) must be gradeable without AI
    (P4 Slice 3); AI-graded types (short-answer / scenario) carry a
    rubric + model answer for P5/P6. Raises ``APIError(422)``."""
    if not isinstance(config, dict) or not config:
        raise APIError(
            422, "invalid_question_config", "config must be a non-empty object."
        )
    prompt = config.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        raise APIError(422, "invalid_question_config", "config.prompt is required.")
    if qtype == QuestionType.multiple_choice:
        options = config.get("options")
        correct = config.get("correct")
        if (
            not isinstance(options, list)
            or len(options) < 2
            or not all(isinstance(o, str) for o in options)
        ):
            raise APIError(
                422,
                "invalid_question_config",
                "multiple_choice needs >=2 string options.",
            )
        if (
            not isinstance(correct, int)
            or isinstance(correct, bool)
            or not (0 <= correct < len(options))
        ):
            raise APIError(
                422,
                "invalid_question_config",
                "multiple_choice.correct must index options.",
            )
    elif qtype == QuestionType.true_false:
        if not isinstance(config.get("correct"), bool):
            raise APIError(
                422,
                "invalid_question_config",
                "true_false.correct must be a boolean.",
            )
    elif qtype == QuestionType.matching:
        pairs = config.get("pairs")
        if not isinstance(pairs, list) or len(pairs) < 2:
            raise APIError(422, "invalid_question_config", "matching needs >=2 pairs.")
        for pair in pairs:
            if (
                not isinstance(pair, dict)
                or not isinstance(pair.get("left"), str)
                or not isinstance(pair.get("right"), str)
            ):
                raise APIError(
                    422,
                    "invalid_question_config",
                    "each matching pair needs string left/right.",
                )
    elif qtype in (QuestionType.short_answer, QuestionType.scenario):
        if not isinstance(config.get("rubric"), str) or not config["rubric"].strip():
            raise APIError(
                422,
                "invalid_question_config",
                f"{qtype.value} needs a rubric.",
            )
        if not isinstance(config.get("model_answer"), str):
            raise APIError(
                422,
                "invalid_question_config",
                f"{qtype.value} needs a model_answer.",
            )


async def add_question(
    db: AsyncSession,
    *,
    test: Test,
    qtype: QuestionType,
    config: dict[str, Any],
    assigned_difficulty: int,
    question_group_id: uuid.UUID | None = None,
) -> Question:
    """Author a question against a frozen/hand-authored test (AC-D5).
    Rejected for per-Testee/benchmark modes and while campaign-locked."""
    if test.mode not in _AUTHORED_MODES:
        raise APIError(
            422,
            "questions_unsupported",
            "Only frozen or hand-authored tests carry an authored question set.",
        )
    _guard_unlocked(test)
    validate_question_config(qtype, config)
    question = Question(
        tenant_id=SEED_TENANT_ID,
        test_id=test.id,
        type=qtype,
        config=config,
        assigned_difficulty=assigned_difficulty,
        question_group_id=question_group_id,
        realism_flag_count=0,
    )
    db.add(question)
    await db.flush()
    await db.refresh(question)
    return question


async def list_test_questions(db: AsyncSession, test_id: uuid.UUID) -> list[Question]:
    result = await db.execute(
        select(Question).where(
            Question.test_id == test_id,
            Question.tenant_id == SEED_TENANT_ID,
        )
    )
    rows = list(result.scalars().all())
    rows.sort(key=lambda q: (q.created_at, str(q.id)))
    return rows


async def get_question(
    db: AsyncSession, test_id: uuid.UUID, question_id: uuid.UUID
) -> Question | None:
    question = await _by_id(db, Question, question_id)
    if question is None or question.test_id != test_id:
        return None
    return question


async def update_question(
    db: AsyncSession, test: Test, question: Question, fields: dict[str, Any]
) -> Question:
    _guard_unlocked(test)
    new_config = fields.get("config", question.config)
    validate_question_config(question.type, new_config)
    for key, value in fields.items():
        setattr(question, key, value)
    await db.flush()
    return question


async def delete_question(db: AsyncSession, test: Test, question: Question) -> None:
    _guard_unlocked(test)
    await db.delete(question)
