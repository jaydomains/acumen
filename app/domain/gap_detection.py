"""Autonomous gap-detection sweep + catalogue-health check (§6.5 / NS-4, D3).

The autonomous trigger that **closes the loop**: a **gap-detection sweep**
clusters the captured ``GapSignal``s (D1-D2) into candidate topics, and a
proactive **catalogue-health check** (NS-4) finds coverage gaps in the catalogue
itself — both invoking the B3 generation fan-out (``enqueue_generated_drafts``)
**directly** (a domain-fn trigger, no HTTP gate), which feeds the C auto-publish
gate. This is the **third arm** of the three-arm dedup (signal-layer at D1-D2,
persistence-layer at B3, **gap-detection-layer here**): a topic already covered
by a live ``Pill`` (or already pending a B3 batch — B3's own
``(topic, gap_signal)`` guard) does not open a new generation batch.

Scope (D3): the trigger logic only. NOT here: the crons that schedule these
(D4); the generation internals (Stage B); the auto-publish gate (Stage C);
signal capture (D1-D2 — D3 *consumes* ``GapSignal``, setting ``consumed_at``);
the reference-corpus refresh (A3 — a **distinct** catalogue-derived sweep: A3
refreshes *corpus*, D3 generates *pills*); the oversight dashboard (E).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.generation import enqueue_generated_drafts
from app.domain.signals import _normalize
from app.models import (
    SEED_TENANT_ID,
    AnchorQuestion,
    GapSignal,
    Pill,
    Subject,
)
from app.permissions import now_utc

# DS10-a: a gap cluster's summed ``occurrence_count`` must reach this weight to
# open a generation batch (filters one-off misses from real coverage demand).
# A module constant — promote to a per-tenant ``SystemSettings`` knob only if
# tuning is wanted (kept off the schema to keep D3 migration-free).
GAP_WEIGHT_THRESHOLD = 3
# NS-4 thin-band floor: a discoverable pill whose anchor pool covers fewer than
# this many distinct difficulty bands (AC-D20) is under-covered → generate.
MIN_BAND_COVERAGE = 3


@dataclass(frozen=True)
class GenerationTrigger:
    """A topic the sweep opened a generation batch for (returned for the D4
    cron's telemetry + the test surface)."""

    topic: str
    reason: str  # "gap_signal" | "uncovered_subject" | "thin_band"
    batch_id: str


async def _live_pill_topics(db: AsyncSession) -> set[str]:
    """Normalized names of live (discoverable, non-retired) pills — the catalogue
    coverage D3's third dedup arm checks before opening a generation batch."""
    result = await db.execute(select(Pill).where(Pill.tenant_id == SEED_TENANT_ID))
    return {
        _normalize(p.name)
        for p in result.scalars().all()
        if p.discoverable and p.retired_at is None
    }


async def gap_detection_sweep(db: AsyncSession) -> list[GenerationTrigger]:
    """Cluster the unconsumed ``GapSignal``s into candidate topics and trigger
    generation for the under-covered ones (§6.5 signal-driven arm). The caller
    commits.

    Clusters by ``dedup_key`` (summing ``occurrence_count`` into a topic weight);
    a cluster at/above ``GAP_WEIGHT_THRESHOLD`` is a candidate. The **third dedup
    arm** then skips a topic a live ``Pill`` already covers (B3's own guard skips
    a still-pending batch). For a real gap, opens a fresh ``batch_id`` via
    ``enqueue_generated_drafts``. Every clustered signal is marked ``consumed_at``
    (covered or generated) so the next sweep does not re-cluster it — idempotent.
    """
    result = await db.execute(
        select(GapSignal).where(GapSignal.tenant_id == SEED_TENANT_ID)
    )
    clusters: dict[str, list[GapSignal]] = {}
    for signal in result.scalars().all():
        if signal.consumed_at is None:
            clusters.setdefault(signal.dedup_key, []).append(signal)

    covered = await _live_pill_topics(db)
    now = now_utc()
    triggers: list[GenerationTrigger] = []
    for dedup_key, cluster in clusters.items():
        weight = sum(s.occurrence_count for s in cluster)
        if weight < GAP_WEIGHT_THRESHOLD:
            continue  # below threshold — leave unconsumed to accrue more weight
        if dedup_key not in covered:
            batch_id = str(uuid.uuid4())
            await enqueue_generated_drafts(
                db, topic=dedup_key, batch_id=batch_id, gap_signal=dedup_key
            )
            triggers.append(
                GenerationTrigger(topic=dedup_key, reason="gap_signal", batch_id=batch_id)
            )
        # Mark the cluster consumed either way (generated, or already covered).
        for signal in cluster:
            signal.consumed_at = now
    return triggers


async def catalogue_health_check(db: AsyncSession) -> list[GenerationTrigger]:
    """Proactive coverage sweep (NS-4) independent of Testee signals: **uncovered
    subjects** (no discoverable pills) and **thin-band pills** (anchor pool
    covering too few difficulty bands) → generation, via the **same**
    ``enqueue_generated_drafts`` path + the same third dedup arm. The caller
    commits.

    Distinct from A3's weekly corpus-refresh backstop (DS3-a): both read the
    catalogue, but A3 refreshes the **corpus** while this generates **pills** —
    this never calls the corpus-refresh path (auditor A-18 coherence).
    """
    subjects = (
        (await db.execute(select(Subject).where(Subject.tenant_id == SEED_TENANT_ID)))
        .scalars()
        .all()
    )
    pills = [
        p
        for p in (await db.execute(select(Pill).where(Pill.tenant_id == SEED_TENANT_ID)))
        .scalars()
        .all()
        if p.discoverable and p.retired_at is None
    ]
    anchors = (
        (
            await db.execute(
                select(AnchorQuestion).where(AnchorQuestion.tenant_id == SEED_TENANT_ID)
            )
        )
        .scalars()
        .all()
    )

    covered = {_normalize(p.name) for p in pills}
    subjects_with_pills = {p.subject_id for p in pills}
    bands_by_pill: dict[uuid.UUID, set[int]] = {}
    for anchor in anchors:
        bands_by_pill.setdefault(anchor.pill_id, set()).add(anchor.band)

    triggers: list[GenerationTrigger] = []

    # Uncovered subjects: a subject with no discoverable pills (skip if a live
    # pill already matches the subject name — the third dedup arm).
    for subject in subjects:
        if subject.id in subjects_with_pills or _normalize(subject.name) in covered:
            continue
        batch_id = str(uuid.uuid4())
        await enqueue_generated_drafts(
            db,
            topic=subject.name,
            batch_id=batch_id,
            gap_signal=f"uncovered_subject:{subject.id}",
        )
        triggers.append(
            GenerationTrigger(
                topic=subject.name, reason="uncovered_subject", batch_id=batch_id
            )
        )

    # Thin-band pills: a live pill whose anchor pool covers < MIN_BAND_COVERAGE
    # distinct bands. The pill exists by definition, so the live-pill skip does
    # NOT apply here (B3's pending-batch guard prevents re-triggering).
    for pill in pills:
        if len(bands_by_pill.get(pill.id, set())) < MIN_BAND_COVERAGE:
            batch_id = str(uuid.uuid4())
            await enqueue_generated_drafts(
                db,
                topic=pill.name,
                batch_id=batch_id,
                gap_signal=f"thin_band:{pill.id}",
            )
            triggers.append(
                GenerationTrigger(topic=pill.name, reason="thin_band", batch_id=batch_id)
            )
    return triggers
