"""Slice E2 — oversight rollback matrix + AC-D21 override (AC-CD26 rollback half).

Zero-network (AC-CD15): the rollback fns over the AC-CD15 ``CatalogueFakeSession``
seeded with ``Pill`` / ``AnchorQuestion`` / ``PublishRecord`` /
``GenerationProvenance`` / ``ProcessingTask`` / ``DemotedSource`` rows. Covers the
four rollbacks (pill / question / batch / source), retract-not-delete (retire +
exclude), idempotency, per-batch + per-source precision (other entities
untouched), the DS13-a source demotion, and the relocated AC-D21 safety override.
"""

from __future__ import annotations

import uuid

import pytest

from app.domain.generation import GENERATION_TASK_NAME
from app.domain.oversight import (
    override_safety_relevant,
    rollback_batch,
    rollback_pill,
    rollback_question,
    rollback_source,
)
from app.models import (
    SEED_TENANT_ID,
    AnchorQuestion,
    AuditLog,
    DemotedSource,
    GenerationProvenance,
    Pill,
    ProcessingTask,
    ProcessingTaskStatus,
    PublishRecord,
    QuestionType,
    Subject,
)
from app.permissions import APIError
from tests.integration.conftest import CatalogueFakeSession

_ACTOR = uuid.uuid4()


def _pill(session: CatalogueFakeSession, *, name: str = "Pill") -> Pill:
    subj = Subject(tenant_id=SEED_TENANT_ID, name="Welding")
    session.add(subj)
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=subj.id,
        name=name,
        available_difficulty_min=1,
        available_difficulty_max=10,
    )
    session.add(pill)
    return pill


def _audits(session: CatalogueFakeSession, action: str) -> list[AuditLog]:
    return [a for a in session.store.get(AuditLog, []) if a.action == action]


async def test_rollback_pill_retires_and_audits_and_is_idempotent() -> None:
    session = CatalogueFakeSession()
    pill = _pill(session)

    r1 = await rollback_pill(session, pill_id=pill.id, reason="bad", actor_id=_ACTOR)
    assert r1 == {"pill_id": str(pill.id), "retired": True, "newly_retired": True}
    assert pill.retired_at is not None
    first_retired_at = pill.retired_at

    # Idempotent: re-rolling re-audits but doesn't change retired_at.
    r2 = await rollback_pill(session, pill_id=pill.id, reason="again", actor_id=_ACTOR)
    assert r2["newly_retired"] is False
    assert pill.retired_at == first_retired_at
    assert len(_audits(session, "pill_generation.rollback_pill")) == 2


async def test_rollback_pill_404_for_missing() -> None:
    session = CatalogueFakeSession()
    with pytest.raises(APIError) as exc:
        await rollback_pill(session, pill_id=uuid.uuid4(), reason=None, actor_id=_ACTOR)
    assert exc.value.code == "pill_not_found"


async def test_rollback_question_excludes_and_is_idempotent() -> None:
    session = CatalogueFakeSession()
    pill = _pill(session)
    question = AnchorQuestion(
        tenant_id=SEED_TENANT_ID,
        pill_id=pill.id,
        band=3,
        type=QuestionType.multiple_choice,
        config={"prompt": "p", "options": ["a"], "correct": 0},
        assigned_difficulty=5,
        excluded=False,
    )
    session.add(question)

    r1 = await rollback_question(
        session, question_id=question.id, reason="wrong", actor_id=_ACTOR
    )
    assert r1["excluded"] is True and r1["newly_excluded"] is True
    assert question.excluded is True
    assert question.excluded_reason == "wrong"

    r2 = await rollback_question(
        session, question_id=question.id, reason="wrong", actor_id=_ACTOR
    )
    assert r2["newly_excluded"] is False  # already excluded
    assert len(_audits(session, "pill_generation.rollback_question")) == 2


async def test_rollback_batch_retires_all_batch_pills_only() -> None:
    session = CatalogueFakeSession()
    in_batch = [_pill(session, name=f"B{i}") for i in range(2)]
    other = _pill(session, name="Other")
    for pill in in_batch:
        session.add(
            PublishRecord(
                tenant_id=SEED_TENANT_ID,
                pill_id=pill.id,
                batch_id="batch-1",
                confidence=0.9,
                low_confidence=False,
                grounding_verdict="pass",
                safety_verdict="pass",
                provenance_verdict="pass",
                safety_relevant=False,
                single_provider_verified=False,
            )
        )
    session.add(
        PublishRecord(
            tenant_id=SEED_TENANT_ID,
            pill_id=other.id,
            batch_id="batch-2",
            confidence=0.9,
            low_confidence=False,
            grounding_verdict="pass",
            safety_verdict="pass",
            provenance_verdict="pass",
            safety_relevant=False,
            single_provider_verified=False,
        )
    )

    result = await rollback_batch(
        session, batch_id="batch-1", reason="bad batch", actor_id=_ACTOR
    )
    assert result["pills_targeted"] == 2 and result["newly_retired"] == 2
    assert all(p.retired_at is not None for p in in_batch)
    assert other.retired_at is None  # other batch untouched


async def test_rollback_source_retracts_grounded_pills_and_demotes() -> None:
    session = CatalogueFakeSession()
    grounded = _pill(session, name="Grounded")
    clean = _pill(session, name="Clean")
    draft_ref = str(uuid.uuid4())
    # The grounded pill cites osha.gov; link it via the generation task payload.
    session.add(
        ProcessingTask(
            tenant_id=SEED_TENANT_ID,
            task_name=GENERATION_TASK_NAME,
            status=ProcessingTaskStatus.done,
            payload={
                "draft": {"draft_ref": draft_ref},
                "created_pill_id": str(grounded.id),
            },
        )
    )
    session.add(
        GenerationProvenance(
            tenant_id=SEED_TENANT_ID,
            draft_ref=draft_ref,
            claim_ref=f"{draft_ref}:0",
            corpus_chunk_id=uuid.uuid4(),
            source_host="osha.gov",
            authority_tier=2,
            authority_score=0.6,
        )
    )

    result = await rollback_source(
        session, source_host="osha.gov", reason="discredited", actor_id=_ACTOR
    )
    assert result["source_host"] == "osha.gov"
    assert result["pills_targeted"] == 1 and result["newly_retired"] == 1
    assert result["demoted"] is True
    assert grounded.retired_at is not None
    assert clean.retired_at is None  # not grounded on the source

    demotions = session.store.get(DemotedSource, [])
    assert len(demotions) == 1
    assert demotions[0].source_host == "osha.gov" and demotions[0].denied is True


async def test_override_safety_relevant_retoggles_and_stamps() -> None:
    session = CatalogueFakeSession()
    pill = _pill(session)
    assert pill.safety_relevant_overridden_at is None

    result = await override_safety_relevant(
        session, pill_id=pill.id, value=True, actor_id=_ACTOR
    )
    assert result["safety_relevant"] is True
    assert pill.safety_relevant is True
    assert pill.safety_relevant_overridden_at is not None
    assert result["overridden_at"] is not None
