"""Slice D1-D2 — the three §6.5 coverage-gap signal stores + dedup (SPEC §5).

Zero-network (AC-CD15): a fake session collects the written GapSignal rows and
serves them back for the signal-layer dedup probe. Covers discovery-miss +
question-tag capture, the ``(signal_type, dedup_key)`` upsert/increment dedup,
and the forward-ready ``scope_clarification`` type (capture deferred, signal-3).
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.domain.signals import (
    capture_discovery_miss,
    capture_question_tag,
)
from app.models import GapSignal, GapSignalType


class _SignalSession:
    """Collects added rows; serves the GapSignal rows back for the dedup probe."""

    def __init__(self) -> None:
        self.added: list[object] = []

    def add(self, row: object) -> None:
        self.added.append(row)

    async def execute(self, stmt: object) -> SimpleNamespace:
        rows = [r for r in self.added if isinstance(r, GapSignal)]
        return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: list(rows)))


def _signals(session: _SignalSession) -> list[GapSignal]:
    return [r for r in session.added if isinstance(r, GapSignal)]


@pytest.mark.asyncio
async def test_discovery_miss_capture() -> None:
    """A discovery search with no good match writes a discovery_miss signal,
    deduped on the normalized search term."""
    session = _SignalSession()
    sig = await capture_discovery_miss(
        session, search="  Confined  Space ", result_count=0
    )
    assert sig.signal_type == GapSignalType.discovery_miss
    assert sig.dedup_key == "confined space"  # normalized
    assert sig.detail == {"search": "  Confined  Space ", "result_count": 0}
    assert sig.occurrence_count == 1


@pytest.mark.asyncio
async def test_question_tag_capture() -> None:
    """An under-covered tag from generated questions writes a question_tag
    signal keyed on the normalized tag."""
    session = _SignalSession()
    sig = await capture_question_tag(session, tag="Welding")
    assert sig.signal_type == GapSignalType.question_tag
    assert sig.dedup_key == "welding"


@pytest.mark.asyncio
async def test_signal_layer_dedup_increments_occurrence() -> None:
    """Repeat signals on the same (signal_type, dedup_key) upsert + increment
    occurrence_count rather than inserting duplicate rows (the first dedup arm);
    a different key is a distinct row, and a different type is distinct too."""
    session = _SignalSession()
    await capture_discovery_miss(session, search="welding", result_count=0)
    await capture_discovery_miss(session, search="Welding", result_count=0)  # dup
    await capture_discovery_miss(session, search="rigging", result_count=0)  # distinct
    await capture_question_tag(session, tag="welding")  # distinct type, same key

    sigs = _signals(session)
    assert len(sigs) == 3  # welding(discovery) + rigging + welding(question_tag)
    welding = next(
        s
        for s in sigs
        if s.signal_type == GapSignalType.discovery_miss and s.dedup_key == "welding"
    )
    assert welding.occurrence_count == 2  # the two welding searches collapsed


@pytest.mark.asyncio
async def test_consumed_signal_not_absorbed() -> None:
    """A signal already consumed by a D3 sweep does not absorb new occurrences —
    a later miss starts a fresh row."""
    from app.permissions import now_utc

    session = _SignalSession()
    first = await capture_discovery_miss(session, search="welding", result_count=0)
    first.consumed_at = now_utc()  # a D3 sweep clustered it
    await capture_discovery_miss(session, search="welding", result_count=0)
    sigs = _signals(session)
    assert len(sigs) == 2  # fresh row, not an increment
    assert first.occurrence_count == 1


def test_scope_clarification_type_defined() -> None:
    """The scope_clarification type exists from day one (forward-ready); its
    capture is deferred to the admin feature (signal-3) — no capture helper."""
    assert GapSignalType.scope_clarification.value == "scope_clarification"
    assert not hasattr(
        __import__("app.domain.signals", fromlist=["x"]), "capture_scope_clarification"
    )


# The discovery-miss WIRING (GET /catalogue/pills → list_discoverable_pills →
# capture + commit) is exercised end-to-end against the real router in
# tests/integration/test_p3_catalogue.py::test_discovery_miss_persists_gap_signal
# — a real-path test (not a monkeypatched stub) that catches the GET-no-commit
# class of bug the unit stub masked.
