"""Autonomous auto-publish gate (AC-D31 / §6.5, C2) — confidence + publish.

For each B3-produced ``pending`` ``pill_generation`` draft, the gate runs C1's
cross-model self-review (AC-D30), computes a **confidence score**, and
**publishes with no human step** (rulings 1 + 2): **≥ a single global threshold
→ publish live**; **< threshold → publish-with-warning** (live + a
``low_confidence`` flag); **nothing is held pre-publish**, including
safety-relevant content (subject to the AC-D30 **NS-7 degrade** rule). It
**replaces the `approve_pill_proposal` human gate** for generated drafts (the
refiner path is unchanged — detail §8.6 / OV-C2-8).

Scope (C2): the gate — `compute_confidence` + `auto_publish_draft` + the
`PublishRecord`. NOT here: the self-review protocol (C1 owns it; C2 consumes the
verdicts); bootstrap-on-publish (F1 rides the publish event); the dashboard /
rollback (E1/E2 consume the `PublishRecord`); gap-detection (D); FE.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.catalogue import create_pill, record_audit
from app.domain.self_review import DegradeMode, SelfReviewResult, self_review_draft
from app.models import (
    SEED_TENANT_ID,
    GenerationProvenance,
    ProcessingTask,
    ProcessingTaskStatus,
    PublishRecord,
    SystemSettings,
)
from app.permissions import now_utc

# General-knowledge fallback base (no grounding chunks): a moderate score so an
# ungrounded-but-self-review-passing draft lands mid-band, not auto-confident.
_NO_GROUNDING_BASE = 0.5
# Corroboration (DS2-b): a small capped bonus per *additional* distinct grounding
# source beyond the first — multiple independent sources raise confidence.
_CORROBORATION_STEP = 0.05
_CORROBORATION_CAP = 0.15


def compute_confidence(
    self_review: SelfReviewResult,
    *,
    authority_scores: list[float],
    distinct_source_count: int = 0,
) -> float:
    """Confidence score in ``0..1`` (AC-D31 / NS-6).

    A **hard fail** on the grounding or provenance self-review pass floors the
    score to ``0.0`` (the safety pass is handled by the NS-7 publish path, not by
    flooring). Otherwise the score is the **authority-weighted provenance** mean
    (DS1-a tier-scores T1=1.0/T2=0.6/T3=0.3 of the grounding chunks) plus a
    capped **cross-source corroboration** bonus (DS2-b). Empty grounding (the
    general-knowledge fallback) scores a moderate base.
    """
    if (
        self_review.grounding.verdict == "fail"
        or self_review.provenance.verdict == "fail"
    ):
        return 0.0
    base = (
        sum(authority_scores) / len(authority_scores)
        if authority_scores
        else _NO_GROUNDING_BASE
    )
    corroboration = min(
        _CORROBORATION_CAP, _CORROBORATION_STEP * max(0, distinct_source_count - 1)
    )
    return min(1.0, base + corroboration)


async def _publish_threshold(db: AsyncSession) -> float:
    """The single global ``pill_publish_confidence_threshold`` (ruling 1 /
    NS-6, default 0.70). Per-tenant tunable; falls back to the 0.70 default if
    the settings row is absent."""
    result = await db.execute(
        select(SystemSettings).where(SystemSettings.tenant_id == SEED_TENANT_ID)
    )
    settings = result.scalars().first()
    if settings is None:
        return 0.70
    return float(settings.pill_publish_confidence_threshold)


async def auto_publish_draft(db: AsyncSession, task: ProcessingTask) -> PublishRecord:
    """Run the C1 self-review on a ``pending`` ``pill_generation`` draft, score
    it, and **publish** (live or with-warning — never held). The caller commits.

    Honours the AC-D30 **re-adjudicated** ``safety_relevant`` (not the raw draft
    tag) on the published pill; flags ``low_confidence`` when the score is below
    the threshold **or** the NS-7 single-provider safety-relevant degrade applies
    (ruled degrade-not-gate). Writes the audit row + the ``PublishRecord``
    (Stage-E / per-batch-rollback surface) and marks the task ``done``.
    """
    payload = task.payload or {}
    draft: dict[str, Any] = payload.get("draft", {})
    batch_id = payload.get("batch_id")
    draft_ref = draft.get("draft_ref")

    # The AC-D29 provenance chain for this draft (authority tiers feed the
    # score; distinct source_hosts feed the corroboration bonus).
    provenance_rows: list[GenerationProvenance] = []
    if draft_ref is not None:
        result = await db.execute(
            select(GenerationProvenance).where(
                GenerationProvenance.draft_ref == str(draft_ref)
            )
        )
        provenance_rows = list(result.scalars().all())
    authority_scores = [r.authority_score for r in provenance_rows]
    distinct_sources = {r.source_host for r in provenance_rows}
    provenance_view = [
        {"claim_ref": r.claim_ref, "source_host": r.source_host} for r in provenance_rows
    ]

    review = await self_review_draft(db, draft=draft, provenance=provenance_view)
    confidence = compute_confidence(
        review,
        authority_scores=authority_scores,
        distinct_source_count=len(distinct_sources),
    )
    threshold = await _publish_threshold(db)

    # NS-7 (ruled degrade-not-gate): single-provider safety-relevant content
    # publishes-with-warning (always flagged), never held behind a gate.
    ns7_degrade = (
        review.safety_relevant
        and review.single_provider_verified
        and review.degrade_mode == DegradeMode.degrade
    )
    # A FAILED cross-model safety pass always degrades to publish-with-warning,
    # regardless of provider count or score — C1 is the non-negotiable safety
    # floor, so a draft that failed safety review must reach the Stage-E
    # oversight surface flagged, not land live + silent (still published —
    # ruling 2 "nothing held"; the floor flags, it does not hold).
    safety_failed = review.safety.verdict == "fail"
    low_confidence = confidence < threshold or ns7_degrade or safety_failed

    pill = await create_pill(
        db,
        subject_id=uuid.UUID(str(draft["subject_id"])),
        name=str(draft["name"]),
        description=draft.get("description"),
        available_difficulty_min=int(draft.get("available_difficulty_min", 1)),
        available_difficulty_max=int(draft.get("available_difficulty_max", 10)),
        discoverable=True,
        estimated_minutes=draft.get("estimated_minutes"),
        ai_safety_classification=review.safety_relevant,  # honour the re-adjudicated tag
    )

    action = (
        "pill_generation.publish_flagged" if low_confidence else "pill_generation.publish"
    )
    await record_audit(
        db,
        actor_id=None,  # autonomous publish — no human actor
        action=action,
        target_entity="processing_tasks",
        target_id=task.id,
        detail={
            "created_pill_id": str(pill.id),
            "confidence": confidence,
            "low_confidence": low_confidence,
            "batch_id": batch_id,
        },
    )

    task.status = ProcessingTaskStatus.done
    task.finished_at = now_utc()
    task.payload = {
        **payload,
        "decision": "published",
        "created_pill_id": str(pill.id),
        "confidence": confidence,
        "low_confidence": low_confidence,
    }

    record = PublishRecord(
        tenant_id=SEED_TENANT_ID,
        pill_id=pill.id,
        batch_id=batch_id,
        confidence=confidence,
        low_confidence=low_confidence,
        grounding_verdict=review.grounding.verdict,
        safety_verdict=review.safety.verdict,
        provenance_verdict=review.provenance.verdict,
        safety_relevant=review.safety_relevant,
        single_provider_verified=review.single_provider_verified,
    )
    db.add(record)
    await db.flush()
    return record
