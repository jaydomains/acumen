"""oversight domain — Stage-E retroactive oversight READ surface (AC-CD26, E1).

Pure read/aggregation over the autonomous-content spine — ``PublishRecord``
(AC-D31), ``GenerationProvenance`` (AC-D29), the AC-D28 authority tiers, and the
AC-D30 self-review verdicts. **No new persistence:** E1 is read-only; the
rollback matrix + the ``demoted_sources`` source-override layer are E2. Admin-
role-gated at the router (AC-CD5); zero-network (AC-CD15 — pure DB reads, no AI
call).

The autonomy model has **no human pre-publish gate** (AC-D31 auto-publish);
admin governance is therefore **retroactive** (SPEC §4.11 / §6.5) — *observe*
(this module) and *rein in* (E2). The five read facets mirror the AC-CD26 read
half: recent publishes, per-item provenance, confidence (per-publish score +
per-pass verdicts, embedded in each publish row), source-authority breakdown,
and low-confidence-weighted spot-check sampling.

Layering (AC-CD2): the router is thin (authz + envelope); all the read +
aggregation logic lives here. Following the established admin-dashboard read
idiom (``app.routers.cost``), each fn bounds its scan to the tenant in SQL, then
filters / sorts / paginates / aggregates in Python (the in-memory store the
zero-network suite uses ignores ``ORDER BY`` / ``LIMIT`` / range predicates, so
keeping that logic in Python makes the read deterministic under both the fake
and real Postgres).
"""

from __future__ import annotations

import random
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.catalogue import override_pill_safety, record_audit
from app.domain.generation import GENERATION_TASK_NAME
from app.domain.source_authority import _normalise
from app.models import (
    SEED_TENANT_ID,
    AnchorQuestion,
    DemotedSource,
    GenerationProvenance,
    Pill,
    ProcessingTask,
    PublishRecord,
    Subject,
)
from app.permissions import APIError, now_utc

# Spot-check over-sampling weight: a low-confidence publish is this many times
# more likely to surface in a ``bias="low_confidence"`` sample than a confident
# one (the rein-in radar wants the shaky publishes in front of the reviewer).
_LOW_CONFIDENCE_SAMPLE_WEIGHT = 4.0


def _publish_row(
    record: PublishRecord,
    *,
    pill: Pill | None,
    subject_name: str | None,
) -> dict[str, Any]:
    """Shape one ``PublishRecord`` (+ its joined pill/subject) into a JSON-ready
    oversight row. Embeds the **confidence** facet (score + the three AC-D30
    per-pass verdicts) so the publishes list doubles as the confidence surface."""
    return {
        "pill_id": str(record.pill_id),
        "pill_name": pill.name if pill is not None else None,
        "subject_id": str(pill.subject_id) if pill is not None else None,
        "subject_name": subject_name,
        "batch_id": record.batch_id,
        "confidence": record.confidence,
        "low_confidence": record.low_confidence,
        "grounding_verdict": record.grounding_verdict,
        "safety_verdict": record.safety_verdict,
        "provenance_verdict": record.provenance_verdict,
        "safety_relevant": record.safety_relevant,
        "single_provider_verified": record.single_provider_verified,
        # ``retired_at`` set ⇒ the publish was rolled back (E2) / retired (AC-D14).
        "retired": pill.retired_at is not None if pill is not None else None,
        "published_at": record.created_at.isoformat(),
    }


async def _publish_records(db: AsyncSession) -> list[PublishRecord]:
    """All autonomous publishes for the tenant (the scan the read facets share)."""
    result = await db.execute(
        select(PublishRecord).where(PublishRecord.tenant_id == SEED_TENANT_ID)
    )
    return list(result.scalars().all())


async def _pill_index(db: AsyncSession) -> dict[UUID, Pill]:
    """``{pill_id: Pill}`` for stitching publish rows (no SQL join — the fake is
    single-entity; the row count is the catalogue, bounded)."""
    result = await db.execute(select(Pill).where(Pill.tenant_id == SEED_TENANT_ID))
    return {p.id: p for p in result.scalars().all()}


async def _subject_names(db: AsyncSession) -> dict[UUID, str]:
    result = await db.execute(select(Subject).where(Subject.tenant_id == SEED_TENANT_ID))
    return {s.id: s.name for s in result.scalars().all()}


async def _ordered_publish_rows(db: AsyncSession) -> list[dict[str, Any]]:
    """Every publish as a shaped row, newest-first — the shared, stably-ordered
    base for the publishes list + the spot-check sampler."""
    records = await _publish_records(db)
    pills = await _pill_index(db)
    subjects = await _subject_names(db)
    rows: list[tuple[PublishRecord, dict[str, Any]]] = []
    for rec in records:
        pill = pills.get(rec.pill_id)
        subject_name = subjects.get(pill.subject_id) if pill is not None else None
        rows.append((rec, _publish_row(rec, pill=pill, subject_name=subject_name)))
    # Newest-first; ``pill_id`` is the deterministic tie-break so a seeded
    # spot-check sample is reproducible regardless of fetch order.
    rows.sort(key=lambda rr: (rr[0].created_at, str(rr[0].pill_id)), reverse=True)
    return [row for _, row in rows]


async def recent_publishes(
    db: AsyncSession,
    *,
    limit: int = 50,
    offset: int = 0,
    low_confidence: bool | None = None,
    since: datetime | None = None,
    subject_id: UUID | None = None,
) -> dict[str, Any]:
    """Recent autonomous publishes, **newest-first, paginated** — each row
    carrying the pill/subject, confidence + the three AC-D30 verdicts, the
    per-type telemetry, and the retired (rolled-back) flag.

    Filterable by ``low_confidence`` (ruling 2 publish-with-warning), ``since``
    (published-at lower bound), and ``subject_id``. Returns the page plus a
    ``has_more`` sentinel so the FE can render the pager.

    **B3 / CA-D3-2 dual-pattern (CA-E1-2a):** the append-heavy publish-log is
    bounded in **SQL** for production — ``ORDER BY created_at DESC`` +
    ``LIMIT offset+limit+1`` (the ``+1`` is the ``has_more`` sentinel) — so the
    common (unfiltered) hot read doesn't hydrate the whole log. The Python
    filter/sort/window below **stays** as the authoritative re-check for the
    WHERE-blind AC-CD15 fake (which ignores ``ORDER``/``LIMIT``) and is an
    idempotent no-op over an already-bounded prod result. The three filters stay
    Python-side: ``since`` is a range and ``subject_id`` a ``Pill`` join (the
    fake mis-parses / chokes on both), and ``low_confidence == bool`` renders a
    SQLAlchemy ``True_``/``False_`` literal the fake can't read — so when **any**
    filter is active the SQL ``LIMIT`` is skipped (it would drop a matching older
    row that the Python filter would have kept). Exact ``total`` is intentionally
    not returned — a precise count needs an unbounded scan / a ``COUNT`` query the
    fake can't model, which would defeat the bound; ``has_more`` is the
    bounded-pagination-compatible primitive.
    """
    # ``created_at`` is timestamptz (tz-aware); coerce a naive ``?since=`` to
    # UTC-aware so the comparison can't raise "can't compare offset-naive and
    # offset-aware datetimes" (a 500 on an otherwise valid query).
    if since is not None and since.tzinfo is None:
        since = since.replace(tzinfo=UTC)

    stmt = select(PublishRecord).where(PublishRecord.tenant_id == SEED_TENANT_ID)
    stmt = stmt.order_by(PublishRecord.created_at.desc())
    # Bound the prod fetch only on the unfiltered hot path; an active filter
    # (Python-side) falls back to the full ordered fetch + Python paginate.
    if low_confidence is None and since is None and subject_id is None:
        stmt = stmt.limit(offset + limit + 1)
    records = list((await db.execute(stmt)).scalars().all())

    pills = await _pill_index(db)
    subjects = await _subject_names(db)

    shaped: list[tuple[datetime, str, dict[str, Any]]] = []
    for rec in records:
        if low_confidence is not None and rec.low_confidence != low_confidence:
            continue
        if since is not None and rec.created_at < since:
            continue
        pill = pills.get(rec.pill_id)
        if subject_id is not None and (pill is None or pill.subject_id != subject_id):
            continue
        subject_name = subjects.get(pill.subject_id) if pill is not None else None
        shaped.append(
            (
                rec.created_at,
                str(rec.pill_id),
                _publish_row(rec, pill=pill, subject_name=subject_name),
            )
        )

    shaped.sort(key=lambda t: (t[0], t[1]), reverse=True)
    window = shaped[offset : offset + limit + 1]
    has_more = len(window) > limit
    page = [row for _, _, row in window[:limit]]
    return {
        "has_more": has_more,
        "limit": limit,
        "offset": offset,
        "publishes": page,
    }


async def _draft_ref_for_pill(db: AsyncSession, pill_id: UUID) -> str | None:
    """Resolve a published pill back to its generation ``draft_ref`` — the
    per-item provenance key.

    ``PublishRecord`` shares only ``batch_id`` with ``GenerationProvenance`` (a
    batch fans out to N pills), so per-**item** precision (the AC-D29 / NS-3
    per-assertion point) comes from the generation ``ProcessingTask``: its
    payload carries both the minted ``draft.draft_ref`` and (post-publish) the
    ``created_pill_id``. Bounded to ``pill_generation`` tasks in SQL, matched on
    the payload in Python (the link is JSONB, not a column). Returns ``None`` for
    a publish with no corpus grounding (a G7a refiner proposal → no draft_ref →
    an empty provenance chain, correctly).
    """
    result = await db.execute(
        select(ProcessingTask).where(
            ProcessingTask.tenant_id == SEED_TENANT_ID,
            ProcessingTask.task_name == GENERATION_TASK_NAME,
        )
    )
    target = str(pill_id)
    for task in result.scalars().all():
        payload = task.payload or {}
        if str(payload.get("created_pill_id")) != target:
            continue
        draft = payload.get("draft") or {}
        ref = draft.get("draft_ref")
        return str(ref) if ref is not None else None
    return None


async def item_provenance(db: AsyncSession, *, pill_id: UUID) -> dict[str, Any]:
    """The per-item provenance chain for one published pill: each factual claim →
    its grounding corpus source → that source's AC-D28 authority tier/score.

    Resolves the pill to its ``draft_ref`` (per-item precision) and returns the
    ``GenerationProvenance`` claim rows. A publish with no corpus grounding (a
    refiner proposal) returns an empty ``claims`` list — correctly *"general
    knowledge, no provenance"* rather than an error.
    """
    draft_ref = await _draft_ref_for_pill(db, pill_id)
    claims: list[dict[str, Any]] = []
    if draft_ref is not None:
        result = await db.execute(
            select(GenerationProvenance).where(
                GenerationProvenance.tenant_id == SEED_TENANT_ID,
                GenerationProvenance.draft_ref == draft_ref,
            )
        )
        rows = list(result.scalars().all())
        rows.sort(key=lambda r: (r.claim_ref, r.source_host))
        claims = [
            {
                "claim_ref": r.claim_ref,
                "source_host": r.source_host,
                "authority_tier": r.authority_tier,
                "authority_score": r.authority_score,
                "corpus_chunk_id": str(r.corpus_chunk_id),
            }
            for r in rows
        ]
    return {
        "pill_id": str(pill_id),
        "draft_ref": draft_ref,
        "claims": claims,
    }


async def source_authority_breakdown(db: AsyncSession) -> dict[str, Any]:
    """Aggregate the live catalogue's grounding by authority tier + source host —
    the *rein-in radar* (which tiers/sources ground the autonomous content).

    Counts ``GenerationProvenance`` claim rows by ``authority_tier`` and by
    ``source_host`` (with the source's tier). ``by_source`` is ordered by claim
    count desc so the heaviest-relied-upon sources surface first.
    """
    result = await db.execute(
        select(GenerationProvenance).where(
            GenerationProvenance.tenant_id == SEED_TENANT_ID
        )
    )
    rows = list(result.scalars().all())

    by_tier: dict[int, int] = {}
    by_host: dict[str, dict[str, Any]] = {}
    for r in rows:
        by_tier[r.authority_tier] = by_tier.get(r.authority_tier, 0) + 1
        host = by_host.setdefault(
            r.source_host,
            {
                "source_host": r.source_host,
                "authority_tier": r.authority_tier,
                "claims": 0,
            },
        )
        host["claims"] += 1

    by_source = sorted(by_host.values(), key=lambda h: (-h["claims"], h["source_host"]))
    return {
        "total_claims": len(rows),
        "by_tier": [
            {"authority_tier": tier, "claims": by_tier[tier]} for tier in sorted(by_tier)
        ],
        "by_source": by_source,
    }


async def sample_for_spotcheck(
    db: AsyncSession,
    *,
    n: int,
    bias: str = "low_confidence",
    seed: int | None = None,
) -> list[dict[str, Any]]:
    """A retroactive spot-check sample of recent publishes for human review.

    ``bias="low_confidence"`` over-samples publish-with-warning rows (weight
    :data:`_LOW_CONFIDENCE_SAMPLE_WEIGHT`); any other ``bias`` samples uniformly.
    **Deterministic under ``seed``** (Efraimidis–Spirakis weighted reservoir:
    key ``u**(1/weight)``, take the top ``n``) — the same seed over the same
    store always returns the same sample, so a reviewer can cite a reproducible
    spot-check set.
    """
    rows = await _ordered_publish_rows(db)
    if n <= 0 or not rows:
        return []

    rng = random.Random(seed)
    weighted_bias = bias == "low_confidence"
    keyed: list[tuple[float, str, dict[str, Any]]] = []
    for row in rows:
        weight = (
            _LOW_CONFIDENCE_SAMPLE_WEIGHT
            if weighted_bias and row["low_confidence"]
            else 1.0
        )
        key = rng.random() ** (1.0 / weight)
        keyed.append((key, row["pill_id"], row))
    keyed.sort(key=lambda t: (t[0], t[1]), reverse=True)
    return [row for _, _, row in keyed[:n]]


# --- Rollback matrix (E2 — AC-CD26 rollback half) ---------------------
# The *rein-in* writes the no-pre-publish-gate posture (AC-D31) depends on.
# All four rollbacks are **retract-not-delete** (retire per AC-D14 / exclude
# per AC-D23 — the entity is retained for audit, never hard-deleted),
# idempotent, and audit-logged (`pill_generation.rollback_*`, §290). Per-source
# rollback additionally writes a durable `demoted_sources` demotion (DS13-a) so
# the corpus builder stops re-acquiring the discredited host. The admin gate
# (AC-CD5) + the authenticated actor live at the router.


async def _pill_by_id(db: AsyncSession, pill_id: UUID) -> Pill | None:
    result = await db.execute(
        select(Pill).where(Pill.tenant_id == SEED_TENANT_ID, Pill.id == pill_id)
    )
    return result.scalar_one_or_none()


async def _retire_pill_row(
    db: AsyncSession,
    pill: Pill,
    *,
    reason: str | None,
    actor_id: UUID,
    action: str,
) -> bool:
    """Retire a pill (AC-D14 — set ``retired_at`` once, idempotent) + audit.
    Returns ``True`` when this call newly retired it."""
    newly = pill.retired_at is None
    if newly:
        pill.retired_at = now_utc()
    await record_audit(
        db,
        actor_id=actor_id,
        action=action,
        target_entity="pill",
        target_id=pill.id,
        detail={"reason": reason, "newly_retired": newly},
    )
    return newly


async def rollback_pill(
    db: AsyncSession, *, pill_id: UUID, reason: str | None, actor_id: UUID
) -> dict[str, Any]:
    """Per-pill rollback (AC-CD26): retire the published pill, retained + audited.
    Idempotent — re-rolling an already-retired pill re-audits but is a no-op."""
    pill = await _pill_by_id(db, pill_id)
    if pill is None:
        raise APIError(404, "pill_not_found", "No such pill.")
    newly = await _retire_pill_row(
        db, pill, reason=reason, actor_id=actor_id, action="pill_generation.rollback_pill"
    )
    await db.flush()
    return {"pill_id": str(pill_id), "retired": True, "newly_retired": newly}


async def rollback_question(
    db: AsyncSession, *, question_id: UUID, reason: str | None, actor_id: UUID
) -> dict[str, Any]:
    """Per-question rollback (AC-CD26): exclude a generated anchor-pool question
    (AC-D23 ``excluded`` — retract-not-delete) + audit. Idempotent."""
    result = await db.execute(
        select(AnchorQuestion).where(
            AnchorQuestion.tenant_id == SEED_TENANT_ID,
            AnchorQuestion.id == question_id,
        )
    )
    question = result.scalar_one_or_none()
    if question is None:
        raise APIError(404, "question_not_found", "No such anchor question.")
    newly = not question.excluded
    question.excluded = True
    if reason is not None:
        question.excluded_reason = reason
    await record_audit(
        db,
        actor_id=actor_id,
        action="pill_generation.rollback_question",
        target_entity="anchor_question",
        target_id=question.id,
        detail={"reason": reason, "newly_excluded": newly},
    )
    await db.flush()
    return {"question_id": str(question_id), "excluded": True, "newly_excluded": newly}


async def rollback_batch(
    db: AsyncSession, *, batch_id: str, reason: str | None, actor_id: UUID
) -> dict[str, Any]:
    """Per-batch rollback (AC-CD26): retire **every** pill of the B3 generation
    batch (joined via ``PublishRecord.batch_id``) + audit. Idempotent."""
    result = await db.execute(
        select(PublishRecord).where(
            PublishRecord.tenant_id == SEED_TENANT_ID,
            PublishRecord.batch_id == batch_id,
        )
    )
    pill_ids = {r.pill_id for r in result.scalars().all()}
    newly_retired = 0
    for pid in pill_ids:
        pill = await _pill_by_id(db, pid)
        if pill is None:
            continue
        if await _retire_pill_row(
            db,
            pill,
            reason=reason,
            actor_id=actor_id,
            action="pill_generation.rollback_batch",
        ):
            newly_retired += 1
    await db.flush()
    return {
        "batch_id": batch_id,
        "pills_targeted": len(pill_ids),
        "newly_retired": newly_retired,
    }


async def _pill_ids_for_source(db: AsyncSession, source_host: str) -> set[UUID]:
    """The pills grounded on ``source_host`` — per-assertion precision (AC-D29 /
    NS-3): provenance rows citing the host → their ``draft_ref``s → the published
    pills (via the generation task's ``created_pill_id`` link)."""
    result = await db.execute(
        select(GenerationProvenance).where(
            GenerationProvenance.tenant_id == SEED_TENANT_ID,
            GenerationProvenance.source_host == source_host,
        )
    )
    draft_refs = {r.draft_ref for r in result.scalars().all()}
    if not draft_refs:
        return set()
    tasks = await db.execute(
        select(ProcessingTask).where(ProcessingTask.task_name == GENERATION_TASK_NAME)
    )
    pill_ids: set[UUID] = set()
    for task in tasks.scalars().all():
        payload = task.payload or {}
        draft = payload.get("draft") or {}
        if draft.get("draft_ref") not in draft_refs:
            continue
        created = payload.get("created_pill_id")
        if created is None:
            continue
        try:
            pill_ids.add(UUID(str(created)))
        except (ValueError, TypeError):
            continue
    return pill_ids


async def rollback_source(
    db: AsyncSession, *, source_host: str, reason: str | None, actor_id: UUID
) -> dict[str, Any]:
    """Per-source rollback (AC-CD26 — the killer feature): retract exactly the
    pills a discredited source grounded **and** write a durable ``denied``
    demotion (DS13-a) so the corpus builder stops re-acquiring it. Idempotent.

    Provenance is matched on the ``source_host`` as stored (the value the E1
    source-authority breakdown surfaces); the demotion is keyed by the
    ``_normalise``-d host so the effective-allowlist join + corpus skip match.
    """
    pill_ids = await _pill_ids_for_source(db, source_host)
    newly_retired = 0
    for pid in pill_ids:
        pill = await _pill_by_id(db, pid)
        if pill is None:
            continue
        if await _retire_pill_row(
            db,
            pill,
            reason=reason,
            actor_id=actor_id,
            action="pill_generation.rollback_source",
        ):
            newly_retired += 1

    norm_host = _normalise(source_host)
    existing = await db.execute(
        select(DemotedSource).where(
            DemotedSource.tenant_id == SEED_TENANT_ID,
            DemotedSource.source_host == norm_host,
        )
    )
    demotion = existing.scalar_one_or_none()
    if demotion is None:
        demotion = DemotedSource(
            tenant_id=SEED_TENANT_ID,
            source_host=norm_host,
            denied=True,
            reason=reason,
            actor_id=actor_id,
        )
        db.add(demotion)
    else:
        demotion.denied = True
        demotion.reason = reason
        demotion.actor_id = actor_id
    await record_audit(
        db,
        actor_id=actor_id,
        action="pill_generation.rollback_source",
        target_entity="demoted_sources",
        target_id=pill_ids and next(iter(pill_ids)) or SEED_TENANT_ID,
        detail={
            "source_host": norm_host,
            "reason": reason,
            "pills_targeted": len(pill_ids),
            "newly_retired": newly_retired,
        },
    )
    await db.flush()
    return {
        "source_host": norm_host,
        "pills_targeted": len(pill_ids),
        "newly_retired": newly_retired,
        "demoted": True,
    }


async def override_safety_relevant(
    db: AsyncSession, *, pill_id: UUID, value: bool, actor_id: UUID
) -> dict[str, Any]:
    """The relocated AC-D21 admin safety-tag override (A2+C1+E2): retroactively
    retoggle ``safety_relevant`` + stamp ``safety_relevant_overridden_at`` +
    audit. Reuses the catalogue override path; lives here now because the
    autonomous pipeline has no pre-publish gate (the override is retroactive)."""
    pill = await _pill_by_id(db, pill_id)
    if pill is None:
        raise APIError(404, "pill_not_found", "No such pill.")
    await override_pill_safety(db, pill, safety_relevant=value, actor_id=actor_id)
    return {
        "pill_id": str(pill_id),
        "safety_relevant": value,
        "overridden_at": pill.safety_relevant_overridden_at.isoformat()
        if pill.safety_relevant_overridden_at
        else None,
    }
