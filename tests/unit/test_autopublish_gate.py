"""Slice C2 — autonomous auto-publish gate (AC-D31 / §6.5).

Zero-network (AC-CD15): a routing fake session returns the SystemSettings row +
the seeded GenerationProvenance rows and collects the published Pill +
PublishRecord + audit; ``self_review_draft`` (C1) is monkeypatched to a
controlled verdict set. Covers above-threshold publish, below-threshold
publish-with-warning (nothing held), the re-adjudicated safety honoured on the
pill, the single global threshold (tenant override), per-type telemetry, and
the NS-7 single-provider degrade.
"""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

import app.domain.publish as pub
from app.domain.publish import auto_publish_draft, compute_confidence
from app.domain.self_review import DegradeMode, PassVerdict, SelfReviewResult
from app.models import (
    SEED_TENANT_ID,
    AuditLog,
    GenerationProvenance,
    Pill,
    ProcessingTask,
    ProcessingTaskStatus,
    PublishRecord,
    SystemSettings,
)


def _review(
    *,
    grounding: str = "pass",
    safety: str = "pass",
    provenance: str = "pass",
    safety_relevant: bool = False,
    single_provider: bool = False,
    degrade: DegradeMode = DegradeMode.degrade,
) -> SelfReviewResult:
    def _pv(name: str, verdict: str) -> PassVerdict:
        return PassVerdict(name, verdict, {}, "openai", "openai-review", 0.001)

    return SelfReviewResult(
        grounding=_pv("grounding", grounding),
        safety=_pv("safety", safety),
        provenance=_pv("provenance", provenance),
        safety_relevant=safety_relevant,
        unsupported_claims=[],
        orphan_claims=[],
        single_provider_verified=single_provider,
        degrade_mode=degrade,
    )


def _prov(score: float, host: str, draft_ref: str) -> SimpleNamespace:
    return SimpleNamespace(
        authority_score=score, source_host=host, claim_ref="c", draft_ref=draft_ref
    )


class _Result:
    def __init__(self, rows: list) -> None:
        self._rows = rows

    def scalars(self) -> _Result:
        return self

    def all(self) -> list:
        return list(self._rows)

    def first(self) -> object | None:
        return self._rows[0] if self._rows else None

    def scalar_one_or_none(self) -> object | None:
        return self._rows[0] if self._rows else None


class _GateSession:
    def __init__(self, *, settings: object, provenance: list) -> None:
        self._settings = settings
        self._provenance = provenance
        self.added: list[object] = []

    def add(self, row: object) -> None:
        if getattr(row, "id", None) is None:
            row.id = uuid.uuid4()  # mimic the server-side gen_random_uuid() PK
        self.added.append(row)

    async def flush(self) -> None:
        return None

    async def refresh(self, row: object) -> None:
        if getattr(row, "id", None) is None:
            row.id = uuid.uuid4()

    async def execute(self, stmt: object) -> _Result:
        entity = stmt.column_descriptions[0]["entity"]  # type: ignore[attr-defined]
        if entity is SystemSettings:
            return _Result([self._settings] if self._settings else [])
        if entity is GenerationProvenance:
            return _Result(list(self._provenance))
        return _Result([])


def _settings(threshold: float = 0.70) -> SimpleNamespace:
    return SimpleNamespace(
        tenant_id=SEED_TENANT_ID,
        pill_publish_confidence_threshold=threshold,
        safety_keyword_list=[],
    )


def _draft(**over: object) -> dict:
    base = {
        "draft_ref": "draft-1",
        "subject_id": str(uuid.uuid4()),
        "name": "Bolt torque",
        "description": "Fastener torque competency.",
        "available_difficulty_min": 2,
        "available_difficulty_max": 6,
    }
    base.update(over)
    return base


def _task(draft: dict, batch_id: str = "batch-1") -> ProcessingTask:
    return ProcessingTask(
        tenant_id=SEED_TENANT_ID,
        task_name="pill_generation",
        status=ProcessingTaskStatus.pending,
        payload={"draft": draft, "batch_id": batch_id},
    )


def _pills(session: _GateSession) -> list[Pill]:
    return [r for r in session.added if isinstance(r, Pill)]


def _records(session: _GateSession) -> list[PublishRecord]:
    return [r for r in session.added if isinstance(r, PublishRecord)]


def _audits(session: _GateSession) -> list[AuditLog]:
    return [r for r in session.added if isinstance(r, AuditLog)]


def test_compute_confidence_floors_on_hard_fail() -> None:
    """A grounding or provenance fail floors the score to 0.0 (AC-D31)."""
    assert compute_confidence(_review(grounding="fail"), authority_scores=[1.0]) == 0.0
    assert compute_confidence(_review(provenance="fail"), authority_scores=[1.0]) == 0.0
    # Authority-weighted mean + capped corroboration otherwise.
    assert compute_confidence(_review(), authority_scores=[1.0, 1.0]) == 1.0
    assert compute_confidence(
        _review(), authority_scores=[0.3], distinct_source_count=1
    ) == pytest.approx(0.3)


@pytest.mark.asyncio
async def test_above_threshold_publishes_live(monkeypatch: pytest.MonkeyPatch) -> None:
    """High-confidence draft → live pill, PublishRecord low_confidence=False,
    audit pill_generation.publish, task done."""
    monkeypatch.setattr(pub, "self_review_draft", lambda *a, **k: _async(_review()))
    draft = _draft()
    session = _GateSession(
        settings=_settings(),
        provenance=[_prov(1.0, "iso.org", "draft-1"), _prov(1.0, "nace.org", "draft-1")],
    )
    task = _task(draft)
    record = await auto_publish_draft(session, task)

    assert record.low_confidence is False
    assert record.confidence == pytest.approx(1.0)
    assert record.batch_id == "batch-1"
    assert len(_pills(session)) == 1 and _pills(session)[0].discoverable is True
    assert task.status == ProcessingTaskStatus.done
    assert _audits(session)[0].action == "pill_generation.publish"


@pytest.mark.asyncio
async def test_below_threshold_publishes_with_warning(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Low-confidence draft → still LIVE (nothing held) + low_confidence flag +
    audit pill_generation.publish_flagged (ruling 2)."""
    monkeypatch.setattr(pub, "self_review_draft", lambda *a, **k: _async(_review()))
    session = _GateSession(
        settings=_settings(),
        provenance=[_prov(0.3, "blog.example", "draft-1")],  # T3 → 0.30 < 0.70
    )
    record = await auto_publish_draft(session, _task(_draft()))
    assert record.low_confidence is True
    assert record.confidence == pytest.approx(0.3)
    assert len(_pills(session)) == 1  # published anyway — nothing held
    assert _audits(session)[0].action == "pill_generation.publish_flagged"


@pytest.mark.asyncio
async def test_readjudicated_safety_honoured(monkeypatch: pytest.MonkeyPatch) -> None:
    """The published pill's safety_relevant is C1's re-adjudicated value, not the
    raw draft tag; the PublishRecord records it (per-type telemetry)."""
    monkeypatch.setattr(
        pub, "self_review_draft", lambda *a, **k: _async(_review(safety_relevant=True))
    )
    session = _GateSession(
        settings=_settings(), provenance=[_prov(1.0, "iso.org", "draft-1")]
    )
    record = await auto_publish_draft(session, _task(_draft()))
    assert _pills(session)[0].safety_relevant is True  # honoured via create_pill
    assert record.safety_relevant is True


@pytest.mark.asyncio
async def test_single_global_threshold_tenant_override(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The boundary is the single global SystemSettings threshold; a tenant
    override moves it (ruling 1 — no per-type threshold)."""
    monkeypatch.setattr(pub, "self_review_draft", lambda *a, **k: _async(_review()))
    # confidence 0.60 — below default 0.70 (flagged) but above a 0.50 override.
    prov = [_prov(0.6, "x.org", "draft-1")]
    flagged = await auto_publish_draft(
        _GateSession(settings=_settings(0.70), provenance=prov), _task(_draft())
    )
    assert flagged.low_confidence is True
    live = await auto_publish_draft(
        _GateSession(settings=_settings(0.50), provenance=prov), _task(_draft())
    )
    assert live.low_confidence is False


@pytest.mark.asyncio
async def test_ns7_single_provider_safety_degrades(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """NS-7 ruled degrade: a safety-relevant draft reviewed single-provider
    publishes-with-warning (flagged) even at high confidence — never held."""
    monkeypatch.setattr(
        pub,
        "self_review_draft",
        lambda *a, **k: _async(_review(safety_relevant=True, single_provider=True)),
    )
    session = _GateSession(
        settings=_settings(), provenance=[_prov(1.0, "iso.org", "draft-1")]
    )
    record = await auto_publish_draft(session, _task(_draft()))
    assert record.confidence == pytest.approx(1.0)
    assert record.low_confidence is True  # NS-7 degrade flag
    assert record.single_provider_verified is True
    assert len(_pills(session)) == 1  # still live


async def _async(value: object) -> object:
    return value
