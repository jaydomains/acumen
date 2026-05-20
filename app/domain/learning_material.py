"""Learning material synthesis — SPEC §6.4, AC-D6 / AC-D21 / F18 /
AC-CD8 v1.6.

P5 Slice 2 ships ``generate_for_weakness`` as a pure callable domain
function. Not auto-triggered — P7 wires the adaptive loop
("failed pill serves material then queues a follow-up").

Safety-tagged pills are skipped per AC-D21: the function returns
``None`` and the caller (P7) is expected to fall back to curated
external links. The Anthropic call never runs for those pills, so no
explainer text is produced and no spend is incurred.

Per F18 the produced :class:`LearningMaterial` row carries ``served_at``
(serve-time timestamp) and ``served_text`` (the explainer snapshot
used for the n-gram overlap check at the *next* attempt per
AC-D4 #5). Both columns are shipped by the P1 schema.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.cost import maybe_fire_budget_alert, record_provenance
from app.ai.provider import Operation, resolve_provider
from app.models import (
    SEED_TENANT_ID,
    LearningMaterial,
    LearningMaterialSource,
    Pill,
    SystemSettings,
    WeaknessReport,
    WeaknessReportPill,
)
from app.permissions import now_utc


async def _system_settings(db: AsyncSession) -> SystemSettings | None:
    result = await db.execute(
        select(SystemSettings).where(SystemSettings.tenant_id == SEED_TENANT_ID)
    )
    return result.scalar_one_or_none()


async def _pill(db: AsyncSession, pill_id: uuid.UUID) -> Pill | None:
    result = await db.execute(select(Pill).where(Pill.id == pill_id))
    return result.scalar_one_or_none()


async def _severity_for(
    db: AsyncSession, weakness_report_id: uuid.UUID, pill_id: uuid.UUID
) -> float:
    """Fetch the severity the weakness report assigned to ``pill_id``.
    Equality-only — the FakeSession harness has no compound where;
    iterate the report's pill rows."""
    result = await db.execute(
        select(WeaknessReportPill).where(
            WeaknessReportPill.weakness_report_id == weakness_report_id
        )
    )
    for row in result.scalars().all():
        if row.pill_id == pill_id:
            return row.severity
    return 0.0


async def generate_for_weakness(
    db: AsyncSession,
    *,
    weakness_report: WeaknessReport,
    pill_id: uuid.UUID,
    testee_id: uuid.UUID,
    wrong_questions: list[str] | None = None,
    test_override: str | None = None,
) -> LearningMaterial | None:
    """Synthesise targeted explainer text for a weak pill and persist
    a :class:`LearningMaterial` row.

    Returns ``None`` for safety-tagged pills (AC-D21) — the caller
    (P7 loop) falls back to curated external links via
    :mod:`app.domain.safety_links`. Returns ``None`` if the pill is
    missing or has been retired (defensive — the loop should never
    serve material for a missing pill).

    Captures :attr:`LearningMaterial.served_at` and
    :attr:`LearningMaterial.served_text` at write time per F18 so the
    n-gram overlap check at the next attempt has the snapshot it
    needs (AC-D4 #5).
    """
    pill = await _pill(db, pill_id)
    if pill is None:
        return None
    if pill.safety_relevant:
        return None

    settings = await _system_settings(db)
    provider = resolve_provider(
        Operation.learning_material,
        system_settings=settings,
        test_override=test_override,
    )
    severity = await _severity_for(db, weakness_report.id, pill_id)
    payload = {
        "pill_name": pill.name,
        "pill_description": pill.description or "",
        "severity": severity,
        "wrong_questions": wrong_questions or [],
    }
    result = await provider.generate(Operation.learning_material, payload)
    explainer_text = str(result.content.get("explainer", "")).strip()

    now = now_utc()
    material = LearningMaterial(
        tenant_id=SEED_TENANT_ID,
        pill_id=pill_id,
        testee_id=testee_id,
        weakness_report_id=weakness_report.id,
        source=LearningMaterialSource.ai_generated,
        content=explainer_text,
        served_at=now,
        served_text=explainer_text,
    )
    record_provenance(material, result)
    db.add(material)
    await db.flush()
    await db.refresh(material)
    await maybe_fire_budget_alert(db, tenant_id=SEED_TENANT_ID)
    return material
