"""Reference corpus builder — acquisition pipeline (AC-CD25 / amended AC-D22 / AC-D28).

The **(A) reference corpus builder** of the autonomous-content pipeline:
for a topic, identify authoritative sources from the **A1 allowlist**,
**fetch → extract → chunk → content-hash dedup → embed → persist** into a
pgvector store (`CorpusChunk`), stamping each chunk's source-authority
tier + score (AC-D28). Fail-soft throughout — one dead source never
fails the run. Idempotent by `(source_host, content_hash)`.

Reuse over reinvention (AC-CD25): the Drive-ingest path already ships the
pure primitives this composes — `chunk_document` / `content_hash` (from
`app.domain.drive_rag`), the embed `Operation` + `record_provenance` cost
stamping, the injectable `httpx.AsyncClient` fetch seam (the AC-CD15 test
double). It adds **no** new `Operation` enum value.

**Safety cross-source corroboration (DS2-b — ruled option (ii)).**
Content-hash dedup is the floor for all topics; for **safety-relevant**
topics (per `auto_tag_safety`, AC-D21) the pipeline additionally stamps a
`corroboration_count` — the number of distinct allowlisted sources that
produced the same chunk text in this run — feeding the Stage-C confidence
score + the B2 provenance chain (stronger grounding for safety content).

Scope fence: this is **acquisition only**. The corpus retrieval helper +
the refresh cron are A3; generation grounding + the per-draft provenance
chain are B2; the NS-1 Drive-code retirement is a separate step (A2 reuses
`drive_rag`'s pure fns beside the legacy path, it does not remove them).
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.cost import record_provenance
from app.ai.provider import Operation, resolve_provider
from app.domain.drive_rag import chunk_document, content_hash
from app.domain.safety_links import auto_tag_safety
from app.domain.source_authority import (
    Tier,
    authority_score,
    authority_tier,
    filter_to_allowlist,
)
from app.domain.web_search import WebSearchResult, get_web_search_source
from app.models import SEED_TENANT_ID, CorpusChunk
from app.permissions import now_utc

logger = logging.getLogger(__name__)

# Fetch budget — mirrors the safety-link fetch ceiling (safety_links.py).
_HTTP_FETCH_TIMEOUT_SECONDS = 10.0
_HTTP_FETCH_MAX_BYTES = 5_000_000  # 5 MB — bound a malicious/huge payload.
_SEARCH_MAX_RESULTS = 8


async def _fetch_body(
    url: str, *, client: httpx.AsyncClient | None = None
) -> tuple[int, bytes | None, str, str]:
    """GET ``url`` and return ``(status_code, body | None, content_type,
    final_host)``.

    ``final_host`` is the host of the **final** response after any
    redirects — the caller re-validates it against the allowlist (an
    allowlisted host can 3xx-escape the allowlist; the persisted authority
    must reflect where the bytes actually came from, AC-D28 / OV-A2-17).

    Fail-soft: a network error or a >=400 status returns ``(_, None, "",
    host)`` so the caller skips the source without failing the run (mirrors
    :func:`app.domain.safety_links._fetch_body_hash`, extended to retain
    the body — the corpus needs the text to extract + chunk). The body is
    **streamed** and hard-capped at ``_HTTP_FETCH_MAX_BYTES`` so a hostile
    or huge endpoint cannot balloon memory (the read stops at the cap, it
    does not buffer the whole body first). ``client`` is the AC-CD15 test
    seam (fake transport in tests, ``None`` → a real client in prod).
    """
    own_client = client is None
    if client is None:
        client = httpx.AsyncClient(
            timeout=_HTTP_FETCH_TIMEOUT_SECONDS, follow_redirects=True
        )
    try:
        async with client.stream("GET", url) as response:
            final_host = response.url.host or ""
            if response.status_code >= 400:
                return response.status_code, None, "", final_host
            content_type = response.headers.get("content-type", "")
            buffer = bytearray()
            async for chunk in response.aiter_bytes():
                buffer.extend(chunk)
                if len(buffer) >= _HTTP_FETCH_MAX_BYTES:
                    del buffer[_HTTP_FETCH_MAX_BYTES:]
                    break
            return response.status_code, bytes(buffer), content_type, final_host
    except (httpx.HTTPError, OSError) as exc:
        logger.warning("corpus fetch failed for %s: %s", url, exc)
        return 0, None, "", ""
    finally:
        if own_client:
            await client.aclose()


def _extract_html(body: bytes) -> str:
    """HTML → plain text (AC-CD1: beautifulsoup4). Drops script/style/nav
    noise; deterministic separator so chunk hashes are stable."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(body, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    return soup.get_text(separator="\n")


def _extract_pdf(body: bytes) -> str:
    """PDF → plain text (AC-CD1: pypdf). T1 regulators/standards
    (`sabs.co.za`/`iso.org`) often publish PDFs, so PDF support is
    load-bearing for the corpus. Fail-soft on a malformed PDF (WARN, "")."""
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError

    try:
        reader = PdfReader(io.BytesIO(body))
        return "\n\n".join((page.extract_text() or "") for page in reader.pages)
    except (PdfReadError, ValueError, OSError) as exc:
        logger.warning("corpus PDF extract failed: %s", exc)
        return ""


def _extract_text(body: bytes, *, content_type: str, url: str) -> str:
    """Dispatch to HTML or PDF extraction by content-type then URL suffix."""
    path = url.lower().split("?", 1)[0]
    if "pdf" in content_type.lower() or path.endswith(".pdf"):
        return _extract_pdf(body)
    return _extract_html(body)


@dataclass(frozen=True)
class _Candidate:
    """One acquired-but-not-yet-persisted chunk."""

    source_host: str
    tier: Tier
    source_doc_ref: str
    chunk_index: int
    chunk_text: str
    chunk_hash: str


async def acquire_for_topic(
    db: AsyncSession, *, topic: str, http_client: httpx.AsyncClient | None = None
) -> int:
    """Acquire reference-corpus chunks for ``topic`` (AC-CD25). Returns the
    count of new ``CorpusChunk`` rows persisted (the caller commits).

    Pipeline: allowlist-restricted web search (AC-D28
    ``filter_to_allowlist``) → per-source fetch (fail-soft) → extract
    (HTML/PDF) → ``chunk_document`` → ``content_hash`` dedup → embed
    (`text-embedding-3-small`, cost stamped to OpenAI) → persist. Idempotent
    by ``(source_host, content_hash)``. For safety-relevant topics, stamps
    the DS2-b cross-source ``corroboration_count``.
    """
    source = get_web_search_source()
    results = await source.search(topic, max_results=_SEARCH_MAX_RESULTS)
    allowed = filter_to_allowlist(results)
    if not allowed:
        logger.info("corpus acquire: no allowlisted sources for topic %r", topic)
        return 0

    safety_relevant = await auto_tag_safety(topic, None, db)

    candidates = await _gather_candidates(allowed, http_client=http_client)
    if not candidates:
        return 0

    # DS2-b (ii): cross-source corroboration for safety-relevant topics —
    # count the DISTINCT allowlisted sources that produced each chunk text.
    # v1 floor = **exact chunk text** (content_hash) agreement across sources.
    # LIMITATION (CA-A2-1, surfaced to the spec author): exact-text agreement
    # rarely fires across independent sources, so this is a conservative proxy
    # for AC-CD25's "same claim/fact across >=2 sources"; semantic (embedding-
    # similarity) claim-matching is deferred pending the spec-author ruling on
    # whether exact-text is the intended v1 floor.
    corroboration: dict[str, int] = {}
    if safety_relevant:
        hosts_by_hash: dict[str, set[str]] = {}
        for cand in candidates:
            hosts_by_hash.setdefault(cand.chunk_hash, set()).add(cand.source_host)
        corroboration = {h: len(hosts) for h, hosts in hosts_by_hash.items()}

    existing = await _existing_keys(db, candidates)
    provider = resolve_provider(Operation.embed)
    added = 0
    seen_this_run: set[tuple[str, str]] = set()
    for cand in candidates:
        key = (cand.source_host, cand.chunk_hash)
        # Skip an in-run duplicate, or a key already stored (idempotency: a
        # re-run over an unchanged source adds nothing).
        if key in seen_this_run or key in existing:
            continue
        seen_this_run.add(key)
        embed_result = await provider.embed(Operation.embed, cand.chunk_text)
        row = CorpusChunk(
            tenant_id=SEED_TENANT_ID,
            source_doc_ref=cand.source_doc_ref,
            source_host=cand.source_host,
            authority_tier=int(cand.tier),
            authority_score=authority_score(cand.tier),
            corroboration_count=corroboration.get(cand.chunk_hash, 1),
            chunk_index=cand.chunk_index,
            chunk_text=cand.chunk_text,
            content_hash=cand.chunk_hash,
            embedding=embed_result.embedding,
            indexed_at=now_utc(),
        )
        record_provenance(row, embed_result)
        db.add(row)
        added += 1
    return added


async def _gather_candidates(
    allowed: list[tuple[WebSearchResult, Tier]],
    *,
    http_client: httpx.AsyncClient | None,
) -> list[_Candidate]:
    """Fetch + extract + chunk every allowlisted source, fail-soft per source."""
    candidates: list[_Candidate] = []
    for result, _search_tier in allowed:
        _status, body, content_type, final_host = await _fetch_body(
            result.url, client=http_client
        )
        if not body:
            continue  # dead/blocked source — already WARN-logged on error.
        # SSRF / allowlist-escape guard (OV-A2-17 / AC-D28): re-validate the
        # FINAL host after any redirects and re-resolve the tier from it —
        # never trust the pre-redirect host or stamp the search-time tier on
        # redirected content. An allowlisted host that 3xx-redirects off the
        # allowlist (or to an internal address) is dropped here, not stored.
        tier = authority_tier(final_host)
        if tier is None:
            logger.warning(
                "corpus fetch for %s landed off-allowlist (final host %r) — skipped",
                result.url,
                final_host,
            )
            continue
        text = _extract_text(body, content_type=content_type, url=result.url)
        for idx, chunk_text in enumerate(chunk_document(text)):
            candidates.append(
                _Candidate(
                    source_host=final_host,
                    tier=tier,
                    source_doc_ref=result.url,
                    chunk_index=idx,
                    chunk_text=chunk_text,
                    chunk_hash=content_hash(chunk_text),
                )
            )
    return candidates


async def _existing_keys(
    db: AsyncSession, candidates: list[_Candidate]
) -> set[tuple[str, str]]:
    """The already-stored ``(source_host, content_hash)`` keys among the
    candidate set, in **one** query (avoids an N+1 per-chunk dedup lookup —
    Gitar PR #115 finding 3). Scoped to the candidates' hosts + hashes so the
    scan stays bounded."""
    if not candidates:
        return set()
    hosts = {cand.source_host for cand in candidates}
    hashes = {cand.chunk_hash for cand in candidates}
    result = await db.execute(
        select(CorpusChunk.source_host, CorpusChunk.content_hash).where(
            CorpusChunk.tenant_id == SEED_TENANT_ID,
            CorpusChunk.source_host.in_(hosts),
            CorpusChunk.content_hash.in_(hashes),
        )
    )
    return {(host, chunk_hash) for host, chunk_hash in result.all()}
