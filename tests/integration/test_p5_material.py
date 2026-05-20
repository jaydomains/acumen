"""P5 Slice 2 — ``generate_for_weakness`` callable domain function.

Asserts:
* The callable invokes :meth:`AIProvider.generate` with
  :class:`Operation.learning_material` for non-safety pills and
  persists a :class:`LearningMaterial` row with full provenance plus
  F18 ``served_at`` + ``served_text`` snapshots.
* Safety-tagged pills are skipped per AC-D21: the callable returns
  ``None`` and writes no row, and the AI provider is not invoked.
* A missing / retired pill returns ``None`` without crashing the
  caller — defensive guard against a loop call for a deleted pill.
* The persisted ``served_text`` exactly equals ``content`` (no
  divergence between display text and the n-gram-overlap snapshot).
"""

from __future__ import annotations

import uuid

import pytest

from app import permissions as p
from app.ai.provider import Operation
from app.domain.learning_material import generate_for_weakness
from app.models import (
    SEED_TENANT_ID,
    LearningMaterial,
    LearningMaterialSource,
    Pill,
    Subject,
    WeaknessReport,
    WeaknessReportPill,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    RecordingProvider,
    cat_make_user,
    seed_system_settings,
)


def _testee_id(session: CatalogueFakeSession) -> uuid.UUID:
    return cat_make_user(session, email="t@kbc.com", role=p.ROLE_TESTEE).id


def _pill(
    session: CatalogueFakeSession,
    *,
    name: str = "Lockout-Tagout",
    description: str = "Energy isolation procedure.",
    safety_relevant: bool = False,
) -> Pill:
    subject = Subject(tenant_id=SEED_TENANT_ID, name="Safety")
    session.add(subject)
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=subject.id,
        name=name,
        description=description,
        available_difficulty_min=1,
        available_difficulty_max=10,
        discoverable=True,
        safety_relevant=safety_relevant,
    )
    session.add(pill)
    return pill


def _weakness_report(
    session: CatalogueFakeSession, *, pill_id: uuid.UUID, severity: float = 0.7
) -> WeaknessReport:
    attempt_id = uuid.uuid4()  # weakness report references an attempt; the
    # FK isn't enforced by the fake harness
    report = WeaknessReport(
        tenant_id=SEED_TENANT_ID,
        attempt_id=attempt_id,
        routed_to_admin=False,
    )
    session.add(report)
    session.add(
        WeaknessReportPill(
            tenant_id=SEED_TENANT_ID,
            weakness_report_id=report.id,
            pill_id=pill_id,
            severity=severity,
        )
    )
    return report


async def test_generate_for_weakness_writes_material_with_provenance(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    seed_system_settings(cat_session)
    testee_id = _testee_id(cat_session)
    pill = _pill(cat_session)
    report = _weakness_report(cat_session, pill_id=pill.id, severity=0.7)

    material = await generate_for_weakness(
        cat_session,
        weakness_report=report,
        pill_id=pill.id,
        testee_id=testee_id,
    )

    assert material is not None
    # Exactly one AI call.
    calls = recording_provider.calls_for(Operation.learning_material)
    assert len(calls) == 1
    _, _, payload = calls[0]
    assert payload["pill_name"] == "Lockout-Tagout"
    assert payload["severity"] == pytest.approx(0.7)

    # Persisted row carries full provenance + F18 snapshots.
    rows = cat_session.store.get(LearningMaterial, [])
    assert len(rows) == 1
    row = rows[0]
    assert row.source == LearningMaterialSource.ai_generated
    assert row.pill_id == pill.id
    assert row.testee_id == testee_id
    assert row.weakness_report_id == report.id
    assert row.ai_provider == "anthropic"
    assert row.ai_model == "claude-sonnet-4-6"
    assert row.ai_prompt_version == "1.0.0-recording"
    assert row.ai_cost_usd == pytest.approx(0.001)

    # F18: served_at + served_text snapshot at write time.
    assert row.served_at is not None
    assert row.served_text == row.content
    assert "explainer" in (row.content or "").lower() or row.content


async def test_generate_for_weakness_skips_safety_pills(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """AC-D21: safety-tagged pills do NOT get AI-generated material —
    the caller falls back to curated external links. The provider is
    not invoked, so no spend is incurred."""
    seed_system_settings(cat_session)
    testee_id = _testee_id(cat_session)
    pill = _pill(cat_session, name="Confined Space Entry", safety_relevant=True)
    report = _weakness_report(cat_session, pill_id=pill.id)

    material = await generate_for_weakness(
        cat_session,
        weakness_report=report,
        pill_id=pill.id,
        testee_id=testee_id,
    )
    assert material is None
    assert recording_provider.calls_for(Operation.learning_material) == []
    assert cat_session.store.get(LearningMaterial, []) == []


async def test_generate_for_weakness_returns_none_for_missing_pill(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """A weakness report referencing a pill that no longer exists
    returns None — the loop should never crash on a deleted pill."""
    seed_system_settings(cat_session)
    testee_id = _testee_id(cat_session)
    missing_pill_id = uuid.uuid4()
    report = _weakness_report(cat_session, pill_id=missing_pill_id)

    material = await generate_for_weakness(
        cat_session,
        weakness_report=report,
        pill_id=missing_pill_id,
        testee_id=testee_id,
    )
    assert material is None
    assert recording_provider.calls_for(Operation.learning_material) == []


async def test_served_text_matches_content_for_ngram_check(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """F18: served_text snapshot used for the AC-D4 #5 n-gram overlap
    flag MUST exactly equal the content. A divergence would mean the
    overlap check compares against a stale snapshot. Belt-and-braces
    explicit assertion (the constructor sets both to the same value
    but a future edit that splits them would silently break the
    overlap rule)."""
    seed_system_settings(cat_session)
    testee_id = _testee_id(cat_session)
    pill = _pill(cat_session, name="Edge Case")
    report = _weakness_report(cat_session, pill_id=pill.id)
    recording_provider.set_response(
        Operation.learning_material,
        {"explainer": "Specific custom explainer text for this test."},
    )

    material = await generate_for_weakness(
        cat_session,
        weakness_report=report,
        pill_id=pill.id,
        testee_id=testee_id,
    )
    assert material is not None
    assert material.content == "Specific custom explainer text for this test."
    assert material.served_text == material.content
