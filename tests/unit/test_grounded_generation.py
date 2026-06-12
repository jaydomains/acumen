"""Slice B2 — corpus-grounded generation + per-assertion provenance (AC-D29 / §6.8).

Zero-network (AC-CD15): a fake session returns seeded ``CorpusChunk`` hits +
collects the written rows; the embed + generate providers are offline stubs.
Covers grounded generation, the per-assertion ``GenerationProvenance`` chain
(queryable by ``source_host``/``draft_ref``, authority-stamped), the v1.1.0
prompt bump, the empty-corpus general-knowledge fallback, and determinism.
"""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

import app.domain.corpus_builder as cb
import app.domain.generation as gen
from app.ai.prompts import get_prompt
from app.ai.provider import EmbedResult, Operation, StubAIProvider
from app.domain.source_authority import Tier, authority_score
from app.models import GenerationProvenance


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


class _GenSession:
    """Returns the seeded CorpusChunk hits for the retrieve query; collects
    the written audit + provenance rows."""

    def __init__(self, chunks: list[SimpleNamespace]) -> None:
        self._chunks = chunks
        self.added: list[object] = []

    def add(self, row: object) -> None:
        self.added.append(row)

    async def execute(self, stmt: object) -> SimpleNamespace:
        return SimpleNamespace(
            scalars=lambda: SimpleNamespace(all=lambda: list(self._chunks))
        )


def _install(monkeypatch: pytest.MonkeyPatch) -> None:
    # retrieve_corpus_for_topic (in corpus_builder) embeds the topic;
    # generate_grounded_drafts (in generation) calls pill_generation.
    monkeypatch.setattr(cb, "resolve_provider", lambda op: _Embed())
    monkeypatch.setattr(gen, "resolve_provider", lambda op: StubAIProvider())


def _provenance(session: _GenSession) -> list[GenerationProvenance]:
    return [r for r in session.added if isinstance(r, GenerationProvenance)]


@pytest.mark.asyncio
async def test_grounded_generation_writes_per_assertion_provenance(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Drafts ground in the retrieved corpus; each grounded assertion writes a
    GenerationProvenance row per grounding-chunk, queryable by source_host +
    draft_ref, authority-stamped (AC-D29 per-assertion)."""
    c1 = _chunk([1.0, 0.0, 0.0], Tier.T1, "iso.org", "https://iso.org/a")
    c2 = _chunk([0.9, 0.1, 0.0], Tier.T2, "nace.org", "https://nace.org/b")
    session = _GenSession([c1, c2])
    _install(monkeypatch)

    result = await gen.generate_grounded_drafts(session, topic="welding", target_count=2)

    assert len(result.drafts) == 2
    for d in result.drafts:
        assert d["draft_ref"]  # minted per draft
        assert d["grounding_refs"]  # non-empty — corpus present
    prov = _provenance(session)
    assert prov  # rows written
    # Per-assertion identity + the E2 rollback query keys present.
    assert all(p.draft_ref and p.claim_ref for p in prov)
    assert {p.source_host for p in prov} <= {"iso.org", "nace.org"}
    # Queryable by source_host (E2) and by draft_ref.
    iso_rows = [p for p in prov if p.source_host == "iso.org"]
    assert iso_rows and all(p.authority_tier == int(Tier.T1) for p in iso_rows)
    draft_refs = {d["draft_ref"] for d in result.drafts}
    assert {p.draft_ref for p in prov} <= draft_refs
    # Authority recorded from the grounding chunk (AC-D28).
    assert all(p.authority_score in (1.0, 0.6, 0.3) for p in prov)


@pytest.mark.asyncio
async def test_grounded_generation_empty_corpus_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Empty corpus → general-knowledge fallback: drafts emit empty
    grounding_refs and no provenance rows are written."""
    session = _GenSession([])
    _install(monkeypatch)
    result = await gen.generate_grounded_drafts(session, topic="welding", target_count=1)
    assert all(d["grounding_refs"] == [] for d in result.drafts)
    assert _provenance(session) == []


@pytest.mark.asyncio
async def test_grounded_generation_deterministic(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Same topic + corpus → byte-identical draft content on re-call (the
    minted draft_ref is excluded — it is a fresh per-row id)."""
    c1 = _chunk([1.0, 0.0, 0.0], Tier.T1, "iso.org", "https://iso.org/a")
    _install(monkeypatch)
    r1 = await gen.generate_grounded_drafts(_GenSession([c1]), topic="x", target_count=2)
    r2 = await gen.generate_grounded_drafts(_GenSession([c1]), topic="x", target_count=2)

    def _strip(drafts: list[dict]) -> list[dict]:
        return [{k: v for k, v in d.items() if k != "draft_ref"} for d in drafts]

    assert _strip(r1.drafts) == _strip(r2.drafts)


def test_pill_generation_prompt_bumped_to_v1_1_0() -> None:
    """G7b: the corpus-grounding contract bump lands at B2."""
    _template, version = get_prompt(Operation.pill_generation)
    assert version == "1.1.0"
    assert "corpus_context" in _template
    assert "grounding_refs" in _template
