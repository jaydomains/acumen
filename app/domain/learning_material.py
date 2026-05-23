"""Learning material synthesis — SPEC §6.4, AC-D6 / AC-D8 / AC-D21 /
F18 / AC-CD8 v1.6.

Two entry points:

* :func:`generate_for_weakness` — P5 Slice 2 / P7 adaptive loop. Called
  by ``app.domain.loop`` after a failed assignment attempt: synthesises
  a remediation-shaped explainer targeting the weak pill.

* :func:`generate_self_initiated` — AC-D8 self-directed surface. Called
  by the catalogue router when a Testee proactively requests learning
  material on a pill. Synthesises a self-contained overview rather than
  a remediation explainer, persists a :class:`LearningMaterial` row
  with ``weakness_report_id=None``, and 30-day-caches by pill so the
  cohort shares a single row per pill per window (cost win at KBC
  scale). Safety-tagged pills (AC-D21) are served the pill's curated
  external :class:`~app.models.PillSafetyLink` set instead of an AI
  call — mirroring the P7 loop's safety-pill fallback.

Safety-tagged pills are skipped on the weakness path per AC-D21: the
function returns ``None`` and the caller (P7) is expected to fall back
to curated external links. On the self-initiated path the safety
branch is handled inline (returns a ``curated_safety_links`` row).

Per F18 every AI-generated :class:`LearningMaterial` row carries
``served_at`` (serve-time timestamp) and ``served_text`` (the explainer
snapshot used for the n-gram overlap check at the *next* attempt per
AC-D4 #5). Both columns are shipped by the P1 schema.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.cost import maybe_fire_budget_alert, record_provenance
from app.ai.provider import Operation, resolve_provider
from app.domain.drive_rag import (
    list_low_realism_questions_for_pill,
    render_low_realism_examples,
    render_rag_context,
    retrieve_for_generation,
)
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    LearningMaterial,
    LearningMaterialSource,
    Pill,
    PillSafetyLink,
    SystemSettings,
    WeaknessReport,
    WeaknessReportPill,
)
from app.permissions import APIError, now_utc

# AC-D8 self-initiated cache window. Shared across the cohort so the
# steady-state cost shape stays benign even when every Testee reads
# every pill (KBC-scale: ~200 pills × ~5-7¢/gen / 30 days = ~$10-15/mo
# worst case). Self-healing across an admin safety-toggle: the cache
# lookup filters by ``source`` matching the pill's current
# ``safety_relevant`` state, so a stale ``ai_generated`` row on a
# now-safety pill is treated as a miss and the curated-links path runs.
CACHE_WINDOW_DAYS = 30


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
    # P9 Slice 3 — Drive RAG context per AC-D22 / SPEC §6.4 ("retrieved
    # Drive RAG chunks per AC-D22"). The severity rounds to an int band
    # for the retrieval query — severity is a 0-1 float; multiplying by
    # the AC-D9 ten-band scale puts it in the same range the chunks
    # were indexed against. Empty Drive index → empty hits → "(none)"
    # via render_rag_context — the prompt template stays well-formed.
    target_difficulty = max(1, min(10, int(round((severity or 0.0) * 10))))
    rag_hits = await retrieve_for_generation(
        db, pill=pill, target_difficulty=target_difficulty
    )
    # P9 Slice 4 — low-realism negative examples for the pill.
    low_realism = await list_low_realism_questions_for_pill(db, pill_id=pill_id)
    payload = {
        "pill_name": pill.name,
        "pill_description": pill.description or "",
        "severity": severity,
        "wrong_questions": wrong_questions or [],
        "rag_context": render_rag_context(rag_hits),
        "low_realism_negative_examples": render_low_realism_examples(low_realism),
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


# --- AC-D8 self-initiated path ---------------------------------------


def _expected_source_for(pill: Pill) -> LearningMaterialSource:
    """The :class:`LearningMaterialSource` the cache lookup must match
    given the pill's current safety state. Used as the cache self-heal
    filter: a stale ``ai_generated`` row on a now-safety pill (or vice
    versa) is treated as a miss and the correct branch generates."""
    if pill.safety_relevant:
        return LearningMaterialSource.curated_safety_links
    return LearningMaterialSource.ai_generated


async def _recent_self_initiated_material(
    db: AsyncSession,
    *,
    pill_id: uuid.UUID,
    expected_source: LearningMaterialSource,
    window_days: int,
) -> LearningMaterial | None:
    """Most recent self-initiated :class:`LearningMaterial` row for
    ``pill_id`` whose ``source`` matches the pill's current safety state
    and which is still inside the cache window.

    The fake harness used by tests supports only equality ``where`` so
    the SQL is a pill-only filter; the null / source / age predicates
    are applied in Python (the same pattern :func:`_severity_for`
    uses)."""
    result = await db.execute(
        select(LearningMaterial).where(LearningMaterial.pill_id == pill_id)
    )
    rows = list(result.scalars().all())
    cutoff = now_utc() - timedelta(days=window_days)
    candidates = [
        r
        for r in rows
        if r.weakness_report_id is None
        and r.source == expected_source
        and r.created_at is not None
        and r.created_at >= cutoff
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda r: r.created_at)


async def _safety_links_for_pill(
    db: AsyncSession, pill_id: uuid.UUID
) -> list[PillSafetyLink]:
    """Cached :class:`PillSafetyLink` rows for ``pill_id`` (tenant-
    scoped). Mirrors ``app.domain.safety_links._existing_links_for``;
    inlined here so the self-initiated path doesn't pull the curation
    module's HTTP client transitive at import time."""
    result = await db.execute(
        select(PillSafetyLink).where(PillSafetyLink.pill_id == pill_id)
    )
    return [r for r in result.scalars().all() if r.tenant_id == SEED_TENANT_ID]


async def generate_self_initiated(
    db: AsyncSession,
    *,
    pill_id: uuid.UUID,
    testee_user: AppUser,
    regenerate: bool = False,
    test_override: str | None = None,
) -> tuple[LearningMaterial, bool, list[PillSafetyLink]]:
    """Self-directed learning material for a pill (AC-D8 implementation).

    Returns ``(material, cached, safety_links)``:

    * ``material`` — the served :class:`LearningMaterial` row
      (``ai_generated`` for non-safety pills, ``curated_safety_links``
      for safety pills).
    * ``cached`` — True iff the returned row was reused from the cache.
    * ``safety_links`` — the live :class:`PillSafetyLink` set for the
      pill when ``material.source == curated_safety_links``; an empty
      list otherwise (no field padding for the AI-text branch).

    The boolean is the explicit signal the router serialises into the
    response ``cached`` field; audit metadata also carries it.

    Branches:

    * Pill missing OR retired (``retired_at IS NOT NULL``) →
      :class:`APIError` 404 ``not_found``. Retired pills are
      indistinguishable from missing on the Testee surface per AC-D14 /
      ``list_discoverable_pills`` convention.
    * Cache hit (a recent self-initiated row exists whose ``source``
      matches the pill's current safety state) → return the cached
      row, write a ``learning_material.self_request`` audit row with
      ``detail.cached=True``. Skipped when ``regenerate=True``.
    * Safety-tagged pill (AC-D21) → no AI call; pull the pill's curated
      :class:`PillSafetyLink` set, write a
      ``LearningMaterial(source=curated_safety_links, content=None,
      ai_*=None)`` row, audit-log. If the pill has zero cached links
      raise :class:`APIError` 422 ``curation_pending`` so the operator
      sees the deficit (P11 monthly cron should top this up).
    * Non-safety pill → call ``provider.generate(learning_material)``
      with the ``self_initiated`` prompt variant, persist
      ``LearningMaterial(source=ai_generated, content=..., served_text=...,
      ai_*=...)`` with full provenance, audit-log.

    Cache window: :data:`CACHE_WINDOW_DAYS`. Self-healing across an
    admin safety toggle — see :func:`_expected_source_for`.
    """
    pill = await _pill(db, pill_id)
    if pill is None or pill.retired_at is not None:
        raise APIError(404, "not_found", "Pill not found.")

    expected_source = _expected_source_for(pill)

    if not regenerate:
        cached = await _recent_self_initiated_material(
            db,
            pill_id=pill_id,
            expected_source=expected_source,
            window_days=CACHE_WINDOW_DAYS,
        )
        if cached is not None:
            await _record_audit(
                db,
                actor_id=testee_user.id,
                action="learning_material.self_request",
                target_id=cached.id,
                detail={
                    "pill_id": str(pill_id),
                    "cached": True,
                    "source": cached.source.value,
                },
            )
            cached_links: list[PillSafetyLink] = []
            if cached.source == LearningMaterialSource.curated_safety_links:
                cached_links = await _safety_links_for_pill(db, pill_id)
            return cached, True, cached_links

    safety_links: list[PillSafetyLink] = []
    if pill.safety_relevant:
        links = await _safety_links_for_pill(db, pill_id)
        if not links:
            raise APIError(
                422,
                "curation_pending",
                "Safety links for this pill are still being curated. " "Try again later.",
            )
        material = LearningMaterial(
            tenant_id=SEED_TENANT_ID,
            pill_id=pill_id,
            testee_id=testee_user.id,
            weakness_report_id=None,
            source=LearningMaterialSource.curated_safety_links,
            content=None,
            served_at=now_utc(),
            served_text=None,
        )
        db.add(material)
        await db.flush()
        await db.refresh(material)
        safety_links = links
    else:
        settings = await _system_settings(db)
        provider = resolve_provider(
            Operation.learning_material,
            system_settings=settings,
            test_override=test_override,
        )
        # No weakness severity in this branch — the self-initiated
        # prompt is reframed as a self-contained overview. RAG retrieval
        # is band-neutral (target_difficulty=5 sits at the catalogue
        # midpoint and matches the no-prior-attempt assumption).
        rag_hits = await retrieve_for_generation(db, pill=pill, target_difficulty=5)
        low_realism = await list_low_realism_questions_for_pill(db, pill_id=pill_id)
        payload = {
            "pill_name": pill.name,
            "pill_description": pill.description or "",
            "rag_context": render_rag_context(rag_hits),
            "low_realism_negative_examples": render_low_realism_examples(low_realism),
            "_prompt_variant": "self_initiated",
        }
        result = await provider.generate(Operation.learning_material, payload)
        explainer_text = str(result.content.get("explainer", "")).strip()
        now = now_utc()
        material = LearningMaterial(
            tenant_id=SEED_TENANT_ID,
            pill_id=pill_id,
            testee_id=testee_user.id,
            weakness_report_id=None,
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

    action = (
        "learning_material.self_regenerate"
        if regenerate
        else "learning_material.self_request"
    )
    await _record_audit(
        db,
        actor_id=testee_user.id,
        action=action,
        target_id=material.id,
        detail={
            "pill_id": str(pill_id),
            "cached": False,
            "regenerate": regenerate,
            "source": material.source.value,
        },
    )
    return material, False, safety_links


async def _record_audit(
    db: AsyncSession,
    *,
    actor_id: uuid.UUID | None,
    action: str,
    target_id: uuid.UUID,
    detail: dict,
) -> None:
    """Thin wrapper around :func:`app.domain.catalogue.record_audit`
    that fixes ``target_entity="learning_material"``. Deferred import —
    the catalogue → learning_material direction has no cycle today, but
    the deferred form keeps that property robust to later additions."""
    from app.domain.catalogue import record_audit

    await record_audit(
        db,
        actor_id=actor_id,
        action=action,
        target_entity="learning_material",
        target_id=target_id,
        detail=detail,
    )
