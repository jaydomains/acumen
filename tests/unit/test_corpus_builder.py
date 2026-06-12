"""Slice A2 — :mod:`app.domain.corpus_builder` unit tests (AC-CD25).

Zero-network (AC-CD15): the web search is a fake `WebSearchSource`, the
fetch runs through an injected `httpx.MockTransport`, and the embed
provider is a recording stub — no socket is opened. Covers the ruling-3
allowlist restriction, fetch→extract→chunk→embed→persist, `(source_host,
content_hash)` dedup idempotency, fail-soft, HTML/PDF extraction, and the
DS2-b cross-source corroboration for safety-relevant topics.
"""

from __future__ import annotations

import hashlib
import io
import random

import httpx
import pytest

import app.domain.corpus_builder as cb
from app.ai.provider import EmbedResult, Operation
from app.domain.source_authority import Tier
from app.domain.web_search import WebSearchResult

# --- Fakes ------------------------------------------------------------


def _text_vec(text: str) -> list[float]:
    """Deterministic text→embedding: identical text → identical vector
    (cosine 1.0); independent text → near-orthogonal (cosine ≈ 0). Lets the
    cosine-similarity corroboration (≥0.90) be exercised offline."""
    seed = int.from_bytes(hashlib.sha256(text.encode()).digest()[:8], "big")
    rng = random.Random(seed)
    return [rng.gauss(0.0, 1.0) for _ in range(1536)]


class _FakeSearch:
    def __init__(self, results: list[WebSearchResult]) -> None:
        self._results = results

    async def search(self, query: str, *, max_results: int = 5) -> list[WebSearchResult]:
        return list(self._results)


class _RecordingEmbed:
    """Deterministic offline embed provider (AC-CD15) — 1536-dim zero vec,
    zero cost, ``stub`` provenance."""

    def __init__(self) -> None:
        self.calls = 0

    async def embed(self, operation: Operation, text: str) -> EmbedResult:
        self.calls += 1
        return EmbedResult(
            embedding=_text_vec(text),
            provider="stub",
            model="stub-embed-1",
            prompt_tokens=0,
            cost_usd=0.0,
        )


class _FakeResult:
    def __init__(self, rows: list[tuple[str, str]]) -> None:
        self._rows = rows

    def all(self) -> list[tuple[str, str]]:
        return list(self._rows)


class _FakeSession:
    """Minimal AsyncSession stand-in for the batch corpus dedup query +
    add(). ``execute`` returns the stored ``(source_host, content_hash)``
    tuples whose values both appear in the statement's bind params (robust
    to the ``in_()`` clause and param naming)."""

    def __init__(self) -> None:
        self.added: list[object] = []

    def add(self, row: object) -> None:
        self.added.append(row)

    async def execute(self, stmt: object) -> _FakeResult:
        vals: set[object] = set()
        for v in stmt.compile().params.values():  # type: ignore[attr-defined]
            # ``in_()`` renders an expanding list param — flatten it.
            if isinstance(v, list | tuple | set):
                vals.update(v)
            else:
                vals.add(v)
        rows = [
            (r.source_host, r.content_hash)
            for r in self.added
            if getattr(r, "source_host", None) in vals
            and getattr(r, "content_hash", None) in vals
        ]
        return _FakeResult(rows)


def _row(host: str, *, url: str | None = None) -> WebSearchResult:
    return WebSearchResult(
        url=url or f"https://{host}/doc",
        title="t",
        snippet="s",
        source=host,
    )


def _html(*paragraphs: str) -> bytes:
    body = "".join(f"<p>{p}</p>" for p in paragraphs)
    return f"<html><body><h1>Doc</h1>{body}<script>x()</script></body></html>".encode()


def _install(
    monkeypatch: pytest.MonkeyPatch,
    *,
    results: list[WebSearchResult],
    safety: bool = False,
    embed: _RecordingEmbed | None = None,
) -> _RecordingEmbed:
    embed = embed or _RecordingEmbed()
    monkeypatch.setattr(cb, "get_web_search_source", lambda: _FakeSearch(results))
    monkeypatch.setattr(cb, "resolve_provider", lambda op: embed)

    async def _fake_safety(name, description, db, **kw):  # type: ignore[no-untyped-def]
        return safety

    monkeypatch.setattr(cb, "auto_tag_safety", _fake_safety)
    return embed


def _transport(
    bodies: dict[str, bytes],
    *,
    fetched: list[str],
    redirects: dict[str, str] | None = None,
) -> httpx.MockTransport:
    """A MockTransport serving ``bodies`` keyed by host; records fetched
    hosts. A host mapped to ``b""`` returns 500 (dead source). ``redirects``
    maps a host → a target URL it 307-redirects to (for the SSRF test)."""
    redirects = redirects or {}

    def handler(request: httpx.Request) -> httpx.Response:
        host = request.url.host
        fetched.append(host)
        if host in redirects:
            return httpx.Response(307, headers={"location": redirects[host]})
        body = bodies.get(host)
        if not body:
            return httpx.Response(500)
        ctype = "application/pdf" if request.url.path.endswith(".pdf") else "text/html"
        return httpx.Response(200, content=body, headers={"content-type": ctype})

    return httpx.MockTransport(handler)


# --- Tests ------------------------------------------------------------


@pytest.mark.asyncio
async def test_allowlist_restricted_discovery(monkeypatch: pytest.MonkeyPatch) -> None:
    """Only allowlisted hosts are fetched (ruling 3 / AC-D28), end-to-end
    offline. `example.com` (not allowlisted) is dropped before fetch."""
    results = [_row("iso.org"), _row("example.com"), _row("nace.org")]
    _install(monkeypatch, results=results)
    fetched: list[str] = []
    bodies = {"iso.org": _html("Alpha body text."), "nace.org": _html("Beta body.")}
    async with httpx.AsyncClient(transport=_transport(bodies, fetched=fetched)) as client:
        added = await cb.acquire_for_topic(
            _FakeSession(), topic="welding", http_client=client
        )
    assert set(fetched) == {"iso.org", "nace.org"}  # example.com never fetched
    assert added == 2


@pytest.mark.asyncio
async def test_fetch_extract_chunk_embed_persist(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """One allowlisted source yields CorpusChunk rows carrying source_host,
    the correct A1 authority_tier/score, content_hash, embedding, and
    stamped provenance (stub, zero cost — AC-CD15)."""
    embed = _install(monkeypatch, results=[_row("iso.org")])
    fetched: list[str] = []
    bodies = {"iso.org": _html("A welding safety paragraph about arc flash.")}
    session = _FakeSession()
    async with httpx.AsyncClient(transport=_transport(bodies, fetched=fetched)) as client:
        added = await cb.acquire_for_topic(session, topic="welding", http_client=client)
    assert added == len(session.added) >= 1
    chunk = session.added[0]
    assert chunk.source_host == "iso.org"
    assert chunk.authority_tier == int(Tier.T1)
    assert chunk.authority_score == 1.0
    assert len(chunk.content_hash) == 64
    assert len(chunk.embedding) == 1536
    assert chunk.ai_provider == "stub"
    assert chunk.ai_cost_usd == 0.0
    assert chunk.corroboration_count == 1  # non-safety topic
    assert embed.calls == added


@pytest.mark.asyncio
async def test_dedup_idempotency(monkeypatch: pytest.MonkeyPatch) -> None:
    """Re-running over the same source adds no new rows (content-hash dedup
    by (source_host, content_hash))."""
    _install(monkeypatch, results=[_row("iso.org")])
    fetched: list[str] = []
    bodies = {"iso.org": _html("Stable paragraph one.", "Stable paragraph two.")}
    session = _FakeSession()
    async with httpx.AsyncClient(transport=_transport(bodies, fetched=fetched)) as client:
        first = await cb.acquire_for_topic(session, topic="x", http_client=client)
        second = await cb.acquire_for_topic(session, topic="x", http_client=client)
    assert first >= 1
    assert second == 0  # everything already stored
    assert len(session.added) == first


@pytest.mark.asyncio
async def test_fail_soft_dead_url(monkeypatch: pytest.MonkeyPatch) -> None:
    """A dead source (500) is skipped; the run continues for live sources."""
    _install(monkeypatch, results=[_row("iso.org"), _row("nace.org")])
    fetched: list[str] = []
    bodies = {"iso.org": b"", "nace.org": _html("Live body text.")}  # iso.org dead
    session = _FakeSession()
    async with httpx.AsyncClient(transport=_transport(bodies, fetched=fetched)) as client:
        added = await cb.acquire_for_topic(session, topic="x", http_client=client)
    assert {"iso.org", "nace.org"} == set(fetched)
    assert added >= 1
    assert all(r.source_host == "nace.org" for r in session.added)


@pytest.mark.asyncio
async def test_empty_after_filter_no_fetch(monkeypatch: pytest.MonkeyPatch) -> None:
    """No allowlisted sources → no fetch, returns 0."""
    _install(monkeypatch, results=[_row("example.com"), _row("blog.test")])
    fetched: list[str] = []
    async with httpx.AsyncClient(transport=_transport({}, fetched=fetched)) as client:
        added = await cb.acquire_for_topic(_FakeSession(), topic="x", http_client=client)
    assert added == 0
    assert fetched == []


@pytest.mark.asyncio
async def test_redirect_off_allowlist_is_dropped(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An allowlisted host that 3xx-redirects OFF the allowlist (SSRF /
    allowlist-escape) is dropped — the body is never extracted/embedded/
    persisted and is never mis-stamped with the original host's authority
    (OV-A2-17 / Gitar PR #115 finding 1; AC-D28 allowlist bound)."""
    _install(monkeypatch, results=[_row("iso.org")])
    fetched: list[str] = []
    bodies = {"evil.example": _html("Poisoned content posing as authoritative.")}
    transport = _transport(
        bodies, fetched=fetched, redirects={"iso.org": "https://evil.example/x"}
    )
    session = _FakeSession()
    async with httpx.AsyncClient(transport=transport, follow_redirects=True) as client:
        added = await cb.acquire_for_topic(session, topic="x", http_client=client)
    assert "evil.example" in fetched  # the redirect was followed by httpx
    assert added == 0  # but nothing persisted — final host is off-allowlist
    assert session.added == []


@pytest.mark.asyncio
async def test_redirect_within_allowlist_restamps_final_host(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A redirect to another allowlisted host stamps the FINAL host + its
    re-resolved tier (iso.org T1 → nace.org T2), not the search-time host
    (OV-A2-17 — authority reflects where the bytes came from)."""
    _install(monkeypatch, results=[_row("iso.org")])
    fetched: list[str] = []
    bodies = {"nace.org": _html("Final host body text.")}
    transport = _transport(
        bodies, fetched=fetched, redirects={"iso.org": "https://nace.org/x"}
    )
    session = _FakeSession()
    async with httpx.AsyncClient(transport=transport, follow_redirects=True) as client:
        added = await cb.acquire_for_topic(session, topic="x", http_client=client)
    assert added >= 1
    assert all(r.source_host == "nace.org" for r in session.added)
    assert all(r.authority_tier == int(Tier.T2) for r in session.added)
    assert all(r.authority_score == 0.6 for r in session.added)


def test_html_extraction_strips_markup() -> None:
    text = cb._extract_html(_html("Hello world.", "Second para."))
    assert "Hello world." in text
    assert "Second para." in text
    assert "<p>" not in text and "x()" not in text  # markup + script gone


def test_extract_dispatch_pdf_by_url_and_content_type() -> None:
    """`_extract_text` routes .pdf URLs / pdf content-type to the PDF path."""
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    pdf = canvas.Canvas(buf)
    pdf.drawString(100, 700, "Confined space entry procedure")
    pdf.save()
    pdf_bytes = buf.getvalue()
    text = cb._extract_text(
        pdf_bytes, content_type="application/pdf", url="https://iso.org/x.pdf"
    )
    assert "Confined space" in text


@pytest.mark.asyncio
async def test_safety_corroboration_cross_source(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """For a safety-relevant topic, chunk text whose embeddings are within
    the cosine threshold across two distinct allowlisted sources stamps
    corroboration_count=2 (DS2-b option ii, ratified cosine ≥0.90 — identical
    text embeds identically → cosine 1.0). A non-safety topic leaves it at 1."""
    shared = _html("Always isolate and lock out before servicing equipment.")
    results = [_row("iso.org"), _row("nace.org")]
    bodies = {"iso.org": shared, "nace.org": shared}

    # Safety topic → corroboration_count = 2 on the corroborated chunk(s).
    _install(monkeypatch, results=results, safety=True)
    fetched: list[str] = []
    session = _FakeSession()
    async with httpx.AsyncClient(transport=_transport(bodies, fetched=fetched)) as client:
        added = await cb.acquire_for_topic(session, topic="lockout", http_client=client)
    assert added == 2  # one per source (distinct source_host)
    assert all(r.corroboration_count == 2 for r in session.added)

    # Non-safety topic → corroboration stays 1.
    _install(monkeypatch, results=results, safety=False)
    fetched2: list[str] = []
    session2 = _FakeSession()
    async with httpx.AsyncClient(
        transport=_transport(bodies, fetched=fetched2)
    ) as client:
        await cb.acquire_for_topic(session2, topic="math", http_client=client)
    assert all(r.corroboration_count == 1 for r in session2.added)


@pytest.mark.asyncio
async def test_safety_distinct_text_not_corroborated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Safety topic, two sources with DIFFERENT text → embeddings below the
    cosine threshold → corroboration_count stays 1 (the realistic case the
    exact-text floor would also have left at 1)."""
    _install(monkeypatch, results=[_row("iso.org"), _row("nace.org")], safety=True)
    bodies = {
        "iso.org": _html("Arc-flash boundary calculation for switchgear."),
        "nace.org": _html("Cathodic protection survey intervals for pipelines."),
    }
    fetched: list[str] = []
    session = _FakeSession()
    async with httpx.AsyncClient(transport=_transport(bodies, fetched=fetched)) as client:
        await cb.acquire_for_topic(session, topic="welding", http_client=client)
    assert all(r.corroboration_count == 1 for r in session.added)


def test_corroboration_counts_threshold() -> None:
    """`_corroboration_counts` counts distinct source_hosts within cosine
    ≥0.90 (incl. self): a near-parallel pair from two hosts → 2; an
    orthogonal third host → 1. Pins the 0.90 threshold precisely."""
    from app.domain.corpus_builder import _Candidate, _corroboration_counts

    def _cand(host: str) -> _Candidate:
        return _Candidate(
            source_host=host,
            tier=Tier.T1,
            source_doc_ref="u",
            chunk_index=0,
            chunk_text="t",
            chunk_hash="h",
        )

    def _res(vec: list[float]) -> EmbedResult:
        return EmbedResult(
            embedding=vec, provider="stub", model="m", prompt_tokens=0, cost_usd=0.0
        )

    new_chunks = [
        (_cand("iso.org"), _res([1.0, 0.0, 0.0])),
        (_cand("nace.org"), _res([0.999, 0.001, 0.0])),  # cosine ≈ 1.0 with #0
        (_cand("astm.org"), _res([0.0, 1.0, 0.0])),  # orthogonal (cosine 0)
    ]
    counts = _corroboration_counts(new_chunks)
    assert counts[0] == 2  # iso corroborated by nace (above threshold)
    assert counts[1] == 2  # nace corroborated by iso
    assert counts[2] == 1  # astm — orthogonal to both, only itself
