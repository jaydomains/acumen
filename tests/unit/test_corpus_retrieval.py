"""Slice A3 — corpus retrieval helper + hybrid refresh (AC-CD25 / AC-CD7).

Zero-network / zero-DB (AC-CD15): a fake session returns seeded
``CorpusChunk`` rows + collects audit rows; the embed provider is a
recording stub. Covers `retrieve_corpus_for_topic` ranking + authority
tagging + `min_tier` + fail-soft + the query-embed cost audit, and the
hybrid refresh fns (`refresh_corpus_for_topic` / `refresh_corpus_all`).
"""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

import app.domain.corpus_builder as cb
from app.ai.provider import EmbedResult, Operation
from app.domain.source_authority import Tier, authority_score

# --- Fakes ------------------------------------------------------------


def _chunk(
    embedding: list[float], tier: Tier, *, host: str = "iso.org", text: str = "t"
) -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        embedding=embedding,
        source_doc_ref=f"https://{host}/doc",
        source_host=host,
        chunk_text=text,
        authority_tier=int(tier),
        authority_score=authority_score(tier),
    )


class _RetrieveSession:
    """Returns seeded CorpusChunk rows; applies the `min_tier` SQL filter by
    reading the compiled `authority_tier_1` bind. Collects audit `add`s."""

    def __init__(self, chunks: list[SimpleNamespace]) -> None:
        self._chunks = chunks
        self.added: list[object] = []

    def add(self, row: object) -> None:
        self.added.append(row)

    async def execute(self, stmt: object) -> SimpleNamespace:
        threshold = stmt.compile().params.get("authority_tier_1")  # type: ignore[attr-defined]
        chunks = self._chunks
        if threshold is not None:
            chunks = [c for c in chunks if c.authority_tier >= threshold]
        return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: list(chunks)))


class _Embed:
    def __init__(self, vec: list[float]) -> None:
        self.vec = vec
        self.calls = 0
        self.raises = False

    async def embed(self, operation: Operation, text: str) -> EmbedResult:
        self.calls += 1
        if self.raises:
            raise RuntimeError("embed boom")
        return EmbedResult(
            embedding=self.vec,
            provider="stub",
            model="stub-embed-1",
            prompt_tokens=0,
            cost_usd=0.0,
        )


def _install_embed(monkeypatch: pytest.MonkeyPatch, vec: list[float]) -> _Embed:
    embed = _Embed(vec)
    monkeypatch.setattr(cb, "resolve_provider", lambda op: embed)
    return embed


# --- retrieve_corpus_for_topic ----------------------------------------


@pytest.mark.asyncio
async def test_retrieve_ranks_and_tags_authority(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Ranks CorpusChunk by cosine to the query, returns each hit with its
    source_host + authority tier/score (AC-CD25 / ruling 3)."""
    embed = _install_embed(monkeypatch, [1.0, 0.0, 0.0])
    near = _chunk([1.0, 0.0, 0.0], Tier.T1, host="iso.org", text="near")
    far = _chunk([0.0, 1.0, 0.0], Tier.T3, host="x.test", text="far")
    session = _RetrieveSession([far, near])  # unordered input
    hits = await cb.retrieve_corpus_for_topic(session, topic="welding", k=1)
    assert len(hits) == 1
    assert hits[0]["chunk_text"] == "near"  # closest by cosine
    assert hits[0]["source_host"] == "iso.org"
    assert hits[0]["authority_tier"] == int(Tier.T1)
    assert hits[0]["authority_score"] == 1.0
    assert embed.calls == 1
    # query-embed cost audited (corpus.retrieve), for AC-CD8 spend fold.
    assert len(session.added) == 1
    assert session.added[0].action == "corpus.retrieve"


@pytest.mark.asyncio
async def test_retrieve_min_tier_filters(monkeypatch: pytest.MonkeyPatch) -> None:
    """`min_tier` restricts the candidate set to chunks at/above the tier."""
    _install_embed(monkeypatch, [1.0, 0.0, 0.0])
    t1 = _chunk([1.0, 0.0, 0.0], Tier.T1, host="iso.org")
    t3 = _chunk([1.0, 0.0, 0.0], Tier.T3, host="x.test")
    session = _RetrieveSession([t1, t3])
    hits = await cb.retrieve_corpus_for_topic(
        session, topic="welding", k=5, min_tier=Tier.T1
    )
    assert [h["source_host"] for h in hits] == ["iso.org"]  # T3 filtered out


@pytest.mark.asyncio
async def test_retrieve_blank_topic_no_embed(monkeypatch: pytest.MonkeyPatch) -> None:
    embed = _install_embed(monkeypatch, [1.0, 0.0, 0.0])
    hits = await cb.retrieve_corpus_for_topic(_RetrieveSession([]), topic="   ")
    assert hits == []
    assert embed.calls == 0  # blank topic short-circuits before embed


@pytest.mark.asyncio
async def test_retrieve_embed_raises_fail_soft(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    embed = _install_embed(monkeypatch, [1.0, 0.0, 0.0])
    embed.raises = True
    session = _RetrieveSession([_chunk([1.0, 0.0, 0.0], Tier.T1)])
    hits = await cb.retrieve_corpus_for_topic(session, topic="welding")
    assert hits == []
    assert session.added == []  # no audit when the embed itself failed


@pytest.mark.asyncio
async def test_retrieve_empty_corpus_audits_embed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Empty corpus → [] but the embed fired once and its cost is audited
    (the spend trace, mirroring the Drive retrieve)."""
    embed = _install_embed(monkeypatch, [1.0, 0.0, 0.0])
    session = _RetrieveSession([])
    hits = await cb.retrieve_corpus_for_topic(session, topic="welding")
    assert hits == []
    assert embed.calls == 1
    assert len(session.added) == 1 and session.added[0].action == "corpus.retrieve"


# --- hybrid refresh ----------------------------------------------------


@pytest.mark.asyncio
async def test_refresh_corpus_for_topic_wraps_acquire(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Per-topic refresh is a thin pass-through over the idempotent
    `acquire_for_topic` (ruling 6)."""
    seen: dict[str, object] = {}

    async def _fake_acquire(db, *, topic, http_client=None):  # type: ignore[no-untyped-def]
        seen["topic"] = topic
        return 5

    monkeypatch.setattr(cb, "acquire_for_topic", _fake_acquire)
    added = await cb.refresh_corpus_for_topic(object(), topic="welding")
    assert added == 5
    assert seen["topic"] == "welding"


class _PillSession:
    def __init__(self, pills: list[SimpleNamespace]) -> None:
        self._pills = pills

    async def execute(self, stmt: object) -> SimpleNamespace:
        return SimpleNamespace(
            scalars=lambda: SimpleNamespace(all=lambda: list(self._pills))
        )


@pytest.mark.asyncio
async def test_refresh_corpus_all_iterates_active_pills(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The weekly backstop re-acquires each active catalogue pill (DS3-a)."""
    pills = [SimpleNamespace(name="welding"), SimpleNamespace(name="rigging")]
    calls: list[str] = []

    async def _fake_acquire(db, *, topic, http_client=None):  # type: ignore[no-untyped-def]
        calls.append(topic)
        return 3

    monkeypatch.setattr(cb, "acquire_for_topic", _fake_acquire)
    result = await cb.refresh_corpus_all(_PillSession(pills))
    assert calls == ["welding", "rigging"]
    assert result == {"welding": 3, "rigging": 3}
