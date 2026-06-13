"""Slice E1 — retroactive content-oversight READ surface (AC-CD26, read half).

Zero-network (AC-CD15): pure DB reads over the AC-CD15 ``CatalogueFakeSession``
seeded with ``PublishRecord`` (AC-D31) / ``GenerationProvenance`` (AC-D29) /
``Pill`` / ``Subject`` / ``ProcessingTask`` rows — no AI call. Covers the five
read facets: recent publishes (newest-first, paginated, filtered + confidence/
verdicts embedded), per-item provenance chain (+ the empty-chain refiner case),
the source-authority breakdown, and the deterministic, low-confidence-weighted
spot-check sampler.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

from app.domain.generation import GENERATION_TASK_NAME
from app.domain.oversight import (
    item_provenance,
    recent_publishes,
    sample_for_spotcheck,
    source_authority_breakdown,
)
from app.models import (
    SEED_TENANT_ID,
    GenerationProvenance,
    Pill,
    ProcessingTask,
    ProcessingTaskStatus,
    PublishRecord,
    Subject,
)
from app.permissions import now_utc
from tests.integration.conftest import CatalogueFakeSession


def _subject(session: CatalogueFakeSession, *, name: str = "Welding") -> Subject:
    subj = Subject(tenant_id=SEED_TENANT_ID, name=name)
    session.add(subj)
    return subj


def _pill(
    session: CatalogueFakeSession,
    *,
    subject: Subject,
    name: str = "Pill",
    retired: bool = False,
) -> Pill:
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=subject.id,
        name=name,
        available_difficulty_min=1,
        available_difficulty_max=10,
    )
    if retired:
        pill.retired_at = now_utc()
    session.add(pill)
    return pill


def _publish(
    session: CatalogueFakeSession,
    *,
    pill: Pill,
    confidence: float = 0.9,
    low_confidence: bool = False,
    batch_id: str | None = None,
    created_offset_s: int = 0,
) -> PublishRecord:
    rec = PublishRecord(
        tenant_id=SEED_TENANT_ID,
        pill_id=pill.id,
        batch_id=batch_id,
        confidence=confidence,
        low_confidence=low_confidence,
        grounding_verdict="pass",
        safety_verdict="pass",
        provenance_verdict="pass",
        safety_relevant=False,
        single_provider_verified=False,
    )
    rec.created_at = now_utc() + timedelta(seconds=created_offset_s)
    session.add(rec)
    return rec


async def test_recent_publishes_newest_first_and_paginated() -> None:
    session = CatalogueFakeSession()
    subj = _subject(session)
    pills = [_pill(session, subject=subj, name=f"P{i}") for i in range(3)]
    # Published at t+0, t+10, t+20 → newest is pills[2].
    for i, pill in enumerate(pills):
        _publish(session, pill=pill, created_offset_s=i * 10)

    page = await recent_publishes(session, limit=2, offset=0)
    assert page["has_more"] is True  # a third row exists beyond the page of 2
    assert [r["pill_name"] for r in page["publishes"]] == ["P2", "P1"]

    page2 = await recent_publishes(session, limit=2, offset=2)
    assert page2["has_more"] is False
    assert [r["pill_name"] for r in page2["publishes"]] == ["P0"]


async def test_recent_publishes_embeds_confidence_verdicts_and_subject() -> None:
    session = CatalogueFakeSession()
    subj = _subject(session, name="Rigging")
    pill = _pill(session, subject=subj, name="Slings", retired=True)
    _publish(session, pill=pill, confidence=0.42, low_confidence=True)

    row = (await recent_publishes(session))["publishes"][0]
    assert row["confidence"] == 0.42
    assert row["low_confidence"] is True
    assert row["grounding_verdict"] == "pass"
    assert row["safety_verdict"] == "pass"
    assert row["provenance_verdict"] == "pass"
    assert row["subject_name"] == "Rigging"
    assert row["retired"] is True  # retired_at set ⇒ rolled back / retired


async def test_recent_publishes_low_confidence_filter() -> None:
    session = CatalogueFakeSession()
    subj = _subject(session)
    confident = _pill(session, subject=subj, name="Confident")
    shaky = _pill(session, subject=subj, name="Shaky")
    _publish(session, pill=confident, low_confidence=False, created_offset_s=0)
    _publish(session, pill=shaky, low_confidence=True, created_offset_s=10)

    only_low = await recent_publishes(session, low_confidence=True)
    assert [r["pill_name"] for r in only_low["publishes"]] == ["Shaky"]
    assert only_low["has_more"] is False


async def test_recent_publishes_subject_filter() -> None:
    session = CatalogueFakeSession()
    welding = _subject(session, name="Welding")
    rigging = _subject(session, name="Rigging")
    pw = _pill(session, subject=welding, name="Arc")
    pr = _pill(session, subject=rigging, name="Hitch")
    _publish(session, pill=pw)
    _publish(session, pill=pr)

    only_rigging = await recent_publishes(session, subject_id=rigging.id)
    assert [r["pill_name"] for r in only_rigging["publishes"]] == ["Hitch"]


async def test_recent_publishes_since_accepts_naive_datetime() -> None:
    # ``created_at`` is tz-aware; a naive ``?since=`` must not raise
    # "can't compare offset-naive and offset-aware datetimes" — it is coerced
    # to UTC-aware and filters correctly.
    session = CatalogueFakeSession()
    subj = _subject(session)
    old = _pill(session, subject=subj, name="Old")
    new = _pill(session, subject=subj, name="New")
    _publish(session, pill=old, created_offset_s=0)
    _publish(session, pill=new, created_offset_s=100)

    since_naive = (now_utc() + timedelta(seconds=50)).replace(tzinfo=None)
    assert since_naive.tzinfo is None
    page = await recent_publishes(session, since=since_naive)
    assert [r["pill_name"] for r in page["publishes"]] == ["New"]


async def test_item_provenance_returns_claim_source_tier_chain() -> None:
    session = CatalogueFakeSession()
    subj = _subject(session)
    pill = _pill(session, subject=subj, name="Grounded")
    draft_ref = str(uuid.uuid4())
    # The generation task carries the draft_ref↔created_pill_id link.
    session.add(
        ProcessingTask(
            tenant_id=SEED_TENANT_ID,
            task_name=GENERATION_TASK_NAME,
            status=ProcessingTaskStatus.done,
            payload={
                "draft": {"draft_ref": draft_ref},
                "created_pill_id": str(pill.id),
            },
        )
    )
    for i, (host, tier, score) in enumerate(
        [("osha.gov", 1, 0.95), ("wikipedia.org", 3, 0.40)]
    ):
        session.add(
            GenerationProvenance(
                tenant_id=SEED_TENANT_ID,
                draft_ref=draft_ref,
                claim_ref=f"{draft_ref}:{i}",
                corpus_chunk_id=uuid.uuid4(),
                source_host=host,
                authority_tier=tier,
                authority_score=score,
            )
        )

    result = await item_provenance(session, pill_id=pill.id)
    assert result["draft_ref"] == draft_ref
    assert len(result["claims"]) == 2
    hosts = {c["source_host"]: c for c in result["claims"]}
    assert hosts["osha.gov"]["authority_tier"] == 1
    assert hosts["wikipedia.org"]["authority_score"] == 0.40


async def test_item_provenance_empty_for_ungrounded_publish() -> None:
    # A refiner-polished proposal (G7a) has no generation task / draft_ref →
    # an empty claims chain, not an error.
    session = CatalogueFakeSession()
    subj = _subject(session)
    pill = _pill(session, subject=subj, name="GeneralKnowledge")
    _publish(session, pill=pill)

    result = await item_provenance(session, pill_id=pill.id)
    assert result["draft_ref"] is None
    assert result["claims"] == []


async def test_source_authority_breakdown_aggregates_by_tier_and_host() -> None:
    session = CatalogueFakeSession()
    seeds = [
        ("osha.gov", 1),
        ("osha.gov", 1),
        ("osha.gov", 1),
        ("wikipedia.org", 3),
    ]
    for i, (host, tier) in enumerate(seeds):
        session.add(
            GenerationProvenance(
                tenant_id=SEED_TENANT_ID,
                draft_ref=f"d{i}",
                claim_ref=f"c{i}",
                corpus_chunk_id=uuid.uuid4(),
                source_host=host,
                authority_tier=tier,
                authority_score=0.5,
            )
        )

    breakdown = await source_authority_breakdown(session)
    assert breakdown["total_claims"] == 4
    by_tier = {row["authority_tier"]: row["claims"] for row in breakdown["by_tier"]}
    assert by_tier == {1: 3, 3: 1}
    # by_source ordered by claim count desc → osha first.
    assert breakdown["by_source"][0]["source_host"] == "osha.gov"
    assert breakdown["by_source"][0]["claims"] == 3


async def test_spotcheck_is_deterministic_under_seed() -> None:
    session = CatalogueFakeSession()
    subj = _subject(session)
    for i in range(6):
        pill = _pill(session, subject=subj, name=f"P{i}")
        _publish(session, pill=pill, created_offset_s=i)

    a = await sample_for_spotcheck(session, n=3, seed=42)
    b = await sample_for_spotcheck(session, n=3, seed=42)
    assert [r["pill_id"] for r in a] == [r["pill_id"] for r in b]
    assert len(a) == 3


async def test_spotcheck_oversamples_low_confidence_under_bias() -> None:
    session = CatalogueFakeSession()
    subj = _subject(session)
    confident = _pill(session, subject=subj, name="Confident")
    shaky = _pill(session, subject=subj, name="Shaky")
    _publish(session, pill=confident, low_confidence=False, created_offset_s=0)
    _publish(session, pill=shaky, low_confidence=True, created_offset_s=10)

    # Over many seeds, n=1 picks the low-confidence publish more often than the
    # confident one (weight 4 vs 1 → ~80%). Deterministic per seed, statistical
    # in aggregate; a wide margin keeps it robust.
    low_hits = 0
    for seed in range(200):
        sample = await sample_for_spotcheck(
            session, n=1, bias="low_confidence", seed=seed
        )
        if sample[0]["pill_name"] == "Shaky":
            low_hits += 1
    assert low_hits > 130  # well above the uniform 100; below the ~160 ideal


async def test_spotcheck_empty_or_nonpositive_n_returns_empty() -> None:
    session = CatalogueFakeSession()
    assert await sample_for_spotcheck(session, n=5) == []  # empty store
    subj = _subject(session)
    _publish(session, pill=_pill(session, subject=subj), created_offset_s=0)
    assert await sample_for_spotcheck(session, n=0) == []  # non-positive n
