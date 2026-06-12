"""Slice B3 — N-draft fan-out + ``processing_tasks`` persistence + cost-share.

Zero-network (AC-CD15): a routing fake session returns seeded ``CorpusChunk``
hits for the retrieve query and the collected ``ProcessingTask`` rows for the
idempotency / cost-aggregation queries; the embed + generate providers are
offline stubs. Covers the fan-out (N pending rows), the shared ``batch_id``
seam (payload **and** provenance, the E2 per-batch rollback key), the exact 1/N
cost-share + the AC-CD8 ``_pill_generation_spend`` aggregation, the
``(topic, gap_signal)`` idempotency, and the G3 min/max-only difficulty lean.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

import app.domain.corpus_builder as cb
import app.domain.generation as gen
from app.ai.cost import current_month_spend
from app.ai.provider import EmbedResult, Operation, StubAIProvider
from app.domain.source_authority import Tier, authority_score
from app.models import (
    SEED_TENANT_ID,
    CorpusChunk,
    GenerationProvenance,
    ProcessingTask,
    ProcessingTaskStatus,
)


def _chunk(vec: list[float], tier: Tier, host: str, ref: str) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        embedding=vec,
        source_doc_ref=ref,
        source_host=host,
        chunk_text=f"corpus text from {host}",
        authority_tier=int(tier),
        authority_score=authority_score(tier),
    )


class _Embed:
    async def embed(self, operation: Operation, text: str) -> EmbedResult:
        return EmbedResult(
            embedding=[1.0, 0.0, 0.0],
            provider="stub",
            model="stub-embed-1",
            prompt_tokens=0,
            cost_usd=0.0,
        )


def _entity(stmt: object) -> object | None:
    try:
        return stmt.column_descriptions[0]["entity"]  # type: ignore[attr-defined]
    except Exception:
        return None


class _FanoutSession:
    """Routes ``execute`` by the selected ORM entity: ``CorpusChunk`` → the
    seeded retrieve hits; ``ProcessingTask`` → the rows added so far (so the
    idempotency probe + the cost aggregator see persisted drafts); anything
    else → empty. Stamps ``created_at`` on persisted tasks (the DB default the
    fake can't run) so the current-month cost fold counts them."""

    def __init__(self, chunks: list[SimpleNamespace]) -> None:
        self._chunks = chunks
        self.added: list[object] = []

    def add(self, row: object) -> None:
        if isinstance(row, ProcessingTask) and getattr(row, "created_at", None) is None:
            row.created_at = datetime.now(UTC)
        self.added.append(row)

    async def flush(self) -> None:
        return None

    async def execute(self, stmt: object) -> SimpleNamespace:
        entity = _entity(stmt)
        if entity is ProcessingTask:
            rows: list[object] = [r for r in self.added if isinstance(r, ProcessingTask)]
        elif entity is CorpusChunk:
            rows = list(self._chunks)
        else:
            rows = []
        return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: rows))


def _install_stub(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(cb, "resolve_provider", lambda op: _Embed())
    monkeypatch.setattr(gen, "resolve_provider", lambda op: StubAIProvider())


def _install_fixed_cost(
    monkeypatch: pytest.MonkeyPatch, *, drafts: list[dict], cost_usd: float
) -> None:
    """Generator stub with a KNOWN cost + draft set (for exact cost-share)."""

    async def _generate(operation: Operation, payload: dict) -> object:
        return SimpleNamespace(
            content={"drafts": [dict(d) for d in drafts]},
            provider="anthropic",
            model="claude-stub",
            prompt_version="1.1.0",
            prompt_tokens=900,
            completion_tokens=300,
            cost_usd=cost_usd,
        )

    monkeypatch.setattr(cb, "resolve_provider", lambda op: _Embed())
    monkeypatch.setattr(
        gen, "resolve_provider", lambda op: SimpleNamespace(generate=_generate)
    )


def _tasks(session: _FanoutSession) -> list[ProcessingTask]:
    return [r for r in session.added if isinstance(r, ProcessingTask)]


def _provenance(session: _FanoutSession) -> list[GenerationProvenance]:
    return [r for r in session.added if isinstance(r, GenerationProvenance)]


@pytest.mark.asyncio
async def test_fanout_persists_n_pending_rows(monkeypatch: pytest.MonkeyPatch) -> None:
    """One generation call → N ``pending`` ``pill_generation`` ProcessingTask
    rows, each payload carrying the draft + a shared ``batch_id`` + the
    ``gap_signal`` (AC-CD7 / §6.8 candidate rows awaiting the C gate)."""
    c1 = _chunk([1.0, 0.0, 0.0], Tier.T1, "iso.org", "https://iso.org/a")
    session = _FanoutSession([c1])
    _install_stub(monkeypatch)

    tasks = await gen.enqueue_generated_drafts(
        session, topic="welding", target_count=3, gap_signal="gap-42"
    )

    assert len(tasks) == 3
    batch_ids = {t.payload["batch_id"] for t in tasks}
    assert len(batch_ids) == 1  # one shared batch
    for t in tasks:
        assert t.task_name == gen.GENERATION_TASK_NAME == "pill_generation"
        assert t.status == ProcessingTaskStatus.pending
        assert t.tenant_id == SEED_TENANT_ID
        assert t.payload["topic"] == "welding"
        assert t.payload["gap_signal"] == "gap-42"
        assert t.payload["draft"]["name"]  # the generated draft rides payload
        assert "grounding_refs" in t.payload["draft"]


@pytest.mark.asyncio
async def test_provenance_rows_carry_shared_batch_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The per-assertion provenance rows (B2's writer, reused) carry the SAME
    ``batch_id`` as the persisted draft payloads — so E2 resolves both the
    per-source (``source_host``) and per-batch (``batch_id``) rollback."""
    c1 = _chunk([1.0, 0.0, 0.0], Tier.T1, "iso.org", "https://iso.org/a")
    session = _FanoutSession([c1])
    _install_stub(monkeypatch)

    tasks = await gen.enqueue_generated_drafts(session, topic="welding", target_count=2)

    batch_id = tasks[0].payload["batch_id"]
    prov = _provenance(session)
    assert prov  # corpus present → grounded → rows written
    assert all(p.batch_id == batch_id for p in prov)
    assert {p.source_host for p in prov} == {"iso.org"}
    # Same id on both surfaces (the B2→B3 seam).
    assert {t.payload["batch_id"] for t in tasks} == {batch_id}


@pytest.mark.asyncio
async def test_cost_share_exact_and_aggregated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The N draft payloads split the single call cost 1/N (tokens floor-div,
    cost exact); ``_pill_generation_spend`` sums them back to the call total in
    ``current_month_spend`` (AC-CD8 spend invariant)."""
    drafts = [
        {
            "name": f"d{i}",
            "available_difficulty_min": 1,
            "available_difficulty_max": 10,
            "grounding_refs": [],
        }
        for i in range(3)
    ]
    session = _FanoutSession([])
    _install_fixed_cost(monkeypatch, drafts=drafts, cost_usd=0.009)

    tasks = await gen.enqueue_generated_drafts(session, topic="welding", target_count=3)

    shares = [t.payload["provenance"]["cost_share"] for t in tasks]
    assert len(shares) == 3
    assert all(s == pytest.approx(0.009 / 3) for s in shares)
    assert sum(shares) == pytest.approx(0.009)
    # tokens floor-divided per record_provenance_share semantics.
    assert all(t.payload["provenance"]["prompt_tokens"] == 300 for t in tasks)
    assert all(t.payload["provenance"]["completion_tokens"] == 100 for t in tasks)

    spend = await current_month_spend(session, tenant_id=SEED_TENANT_ID)
    assert spend["total_usd"] == pytest.approx(0.009)
    assert spend["by_provider"]["anthropic"] == pytest.approx(0.009)


@pytest.mark.asyncio
async def test_idempotent_on_topic_gap_signal(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A re-trigger for the same ``(topic, gap_signal)`` with a pending batch
    returns the existing rows and writes none (§6.2d — B3's persistence-layer
    arm of the 3-arm dedup)."""
    c1 = _chunk([1.0, 0.0, 0.0], Tier.T1, "iso.org", "https://iso.org/a")
    session = _FanoutSession([c1])
    _install_stub(monkeypatch)

    first = await gen.enqueue_generated_drafts(
        session, topic="welding", target_count=2, gap_signal="gap-7"
    )
    second = await gen.enqueue_generated_drafts(
        session, topic="welding", target_count=2, gap_signal="gap-7"
    )

    assert {t.payload["batch_id"] for t in second} == {first[0].payload["batch_id"]}
    assert len(_tasks(session)) == 2  # no new rows on the re-run
    # A different gap for the same topic is NOT deduped.
    third = await gen.enqueue_generated_drafts(
        session, topic="welding", target_count=2, gap_signal="gap-other"
    )
    assert third[0].payload["batch_id"] != first[0].payload["batch_id"]
    assert len(_tasks(session)) == 4


@pytest.mark.asyncio
async def test_g3_min_max_only_no_per_band_field(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """G3 ratified min/max-only (SPEC §6.8): each draft carries
    ``available_difficulty_min``/``_max`` within 1..10 and no richer per-band
    decomposition field."""
    session = _FanoutSession([])
    _install_stub(monkeypatch)
    tasks = await gen.enqueue_generated_drafts(session, topic="welding", target_count=3)
    for t in tasks:
        draft = t.payload["draft"]
        lo, hi = draft["available_difficulty_min"], draft["available_difficulty_max"]
        assert 1 <= lo <= hi <= 10
        assert "difficulty_bands" not in draft and "band_distribution" not in draft
