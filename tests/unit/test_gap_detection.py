"""Slice D3 — gap-detection sweep + catalogue-health check (§6.5 / NS-4).

Zero-network (AC-CD15): a routing fake session serves seeded GapSignal / Pill /
Subject / AnchorQuestion rows (duck-typed); ``enqueue_generated_drafts`` (B3) is
monkeypatched to record the trigger calls. Covers cluster→generate above the
weight threshold (and skip below), the third dedup arm (a live pill covers the
topic → no generation + signals consumed), the catalogue-health uncovered-subject
+ thin-band triggers (and the well-covered no-op), and A3/D3 coherence
(catalogue-health triggers generation, never the corpus-refresh path).
"""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

import app.domain.gap_detection as gd
from app.domain.gap_detection import (
    GAP_WEIGHT_THRESHOLD,
    MIN_BAND_COVERAGE,
    catalogue_health_check,
    gap_detection_sweep,
)
from app.models import AnchorQuestion, GapSignal, Pill, Subject
from app.permissions import now_utc


class _SweepSession:
    """Routes ``execute`` by the selected entity to the seeded duck-typed rows."""

    def __init__(
        self,
        *,
        signals: list = (),
        pills: list = (),
        subjects: list = (),
        anchors: list = (),
    ) -> None:
        self._by_entity = {
            GapSignal: list(signals),
            Pill: list(pills),
            Subject: list(subjects),
            AnchorQuestion: list(anchors),
        }

    async def execute(self, stmt: object) -> SimpleNamespace:
        entity = stmt.column_descriptions[0]["entity"]  # type: ignore[attr-defined]
        rows = self._by_entity.get(entity, [])
        return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: list(rows)))


def _install(monkeypatch: pytest.MonkeyPatch) -> list[dict]:
    calls: list[dict] = []

    async def _fake_enqueue(db, *, topic, batch_id=None, gap_signal=None, target_count=3):
        calls.append({"topic": topic, "gap_signal": gap_signal})
        return []

    monkeypatch.setattr(gd, "enqueue_generated_drafts", _fake_enqueue)
    return calls


def _gap(dedup_key: str, *, count: int = 1, consumed: bool = False) -> SimpleNamespace:
    return SimpleNamespace(
        dedup_key=dedup_key,
        occurrence_count=count,
        consumed_at=now_utc() if consumed else None,
    )


def _pill(
    name: str, *, discoverable: bool = True, retired: bool = False, subject_id=None
) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        name=name,
        discoverable=discoverable,
        retired_at=now_utc() if retired else None,
        subject_id=subject_id or uuid.uuid4(),
    )


def _subject(name: str) -> SimpleNamespace:
    return SimpleNamespace(id=uuid.uuid4(), name=name)


def _anchor(pill_id, band: int) -> SimpleNamespace:
    return SimpleNamespace(pill_id=pill_id, band=band)


@pytest.mark.asyncio
async def test_cluster_above_threshold_generates(monkeypatch: pytest.MonkeyPatch) -> None:
    """A cluster whose summed occurrence_count reaches the threshold triggers a
    generation batch for the topic; the cluster's signals are consumed."""
    calls = _install(monkeypatch)
    sigs = [_gap("welding", count=2), _gap("welding", count=1)]  # weight 3 == threshold
    assert GAP_WEIGHT_THRESHOLD == 3
    triggers = await gap_detection_sweep(_SweepSession(signals=sigs))
    assert [c["topic"] for c in calls] == ["welding"]
    assert triggers[0].reason == "gap_signal"
    assert all(s.consumed_at is not None for s in sigs)  # consumed → next sweep skips


@pytest.mark.asyncio
async def test_below_threshold_no_generate(monkeypatch: pytest.MonkeyPatch) -> None:
    """A cluster below the weight threshold does not trigger and is left
    unconsumed to accrue more weight on later sweeps."""
    calls = _install(monkeypatch)
    sigs = [_gap("rigging", count=1)]  # weight 1 < 3
    await gap_detection_sweep(_SweepSession(signals=sigs))
    assert calls == []
    assert sigs[0].consumed_at is None


@pytest.mark.asyncio
async def test_third_arm_dedup_live_pill_covers(monkeypatch: pytest.MonkeyPatch) -> None:
    """A topic already covered by a live pill → no new generation, but the
    cluster is consumed (the demand is already met)."""
    calls = _install(monkeypatch)
    sigs = [_gap("welding", count=5)]
    session = _SweepSession(signals=sigs, pills=[_pill("Welding")])  # live pill covers
    triggers = await gap_detection_sweep(session)
    assert calls == [] and triggers == []
    assert sigs[0].consumed_at is not None  # consumed without generating


@pytest.mark.asyncio
async def test_catalogue_health_uncovered_subject(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A subject with no discoverable pills triggers generation for it."""
    calls = _install(monkeypatch)
    subj = _subject("Welding Safety")
    triggers = await catalogue_health_check(_SweepSession(subjects=[subj], pills=[]))
    assert [c["topic"] for c in calls] == ["Welding Safety"]
    assert triggers[0].reason == "uncovered_subject"
    assert calls[0]["gap_signal"] == f"uncovered_subject:{subj.id}"


@pytest.mark.asyncio
async def test_catalogue_health_thin_band(monkeypatch: pytest.MonkeyPatch) -> None:
    """A discoverable pill whose anchor pool covers too few bands is thin → a
    generation trigger; a pill covering enough bands is not."""
    _install(monkeypatch)
    subj = _subject("S")
    thin = _pill("Thin pill", subject_id=subj.id)
    thick = _pill("Thick pill", subject_id=subj.id)
    anchors = [_anchor(thin.id, 2)]  # 1 band < MIN_BAND_COVERAGE
    anchors += [_anchor(thick.id, b) for b in range(1, MIN_BAND_COVERAGE + 1)]
    triggers = await catalogue_health_check(
        _SweepSession(subjects=[subj], pills=[thin, thick], anchors=anchors)
    )
    thin_triggers = [t for t in triggers if t.reason == "thin_band"]
    assert [t.topic for t in thin_triggers] == ["Thin pill"]


@pytest.mark.asyncio
async def test_well_covered_catalogue_no_trigger(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A subject with a pill that covers enough bands triggers nothing."""
    calls = _install(monkeypatch)
    subj = _subject("S")
    pill = _pill("Covered", subject_id=subj.id)
    anchors = [_anchor(pill.id, b) for b in range(1, MIN_BAND_COVERAGE + 1)]
    triggers = await catalogue_health_check(
        _SweepSession(subjects=[subj], pills=[pill], anchors=anchors)
    )
    assert calls == [] and triggers == []


@pytest.mark.asyncio
async def test_a3_d3_coherence_generates_not_refresh(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The catalogue-health check triggers GENERATION (enqueue_generated_drafts),
    never the A3 corpus-refresh path — the two catalogue-derived sweeps stay
    distinct (auditor A-18)."""
    calls = _install(monkeypatch)
    # Guard: if gap_detection ever imported a corpus-refresh fn, this would catch
    # an accidental call — there is no such import, so generation is the only path.
    assert not hasattr(gd, "refresh_corpus_for_topic")
    assert not hasattr(gd, "acquire_for_topic")
    await catalogue_health_check(_SweepSession(subjects=[_subject("Uncovered")]))
    assert all(
        c["gap_signal"].startswith(("uncovered_subject", "thin_band")) for c in calls
    )
