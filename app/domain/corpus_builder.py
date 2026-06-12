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
`corroboration_count` — the number of distinct allowlisted sources whose
chunk embeddings are within `_CORROBORATION_COSINE_THRESHOLD` (0.90) cosine
similarity of the chunk, reusing the already-computed embeddings (AC-CD25,
CA-A2-1 ratified Option-2, this conversation 2026-06-12 — semantic match,
not byte-identical text). Feeds the Stage-C confidence score + the B2
provenance chain (stronger grounding for safety content).

Scope fence: this is **acquisition only**. The corpus retrieval helper +
the refresh cron are A3; generation grounding + the per-draft provenance
chain are B2; the NS-1 Drive-code retirement is a separate step (A2 reuses
`drive_rag`'s pure fns beside the legacy path, it does not remove them).
"""

from __future__ import annotations

import io
import logging
import math
from dataclasses import dataclass

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.cost import record_provenance
from app.ai.provider import EmbedResult, Operation, resolve_provider
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
# DS2-b corroboration: cosine-similarity threshold for "same claim/fact"
# (AC-CD25, ratified 2026-06-12). Set conservatively; tuned from telemetry
# (the NS-6 confidence-threshold pattern).
_CORROBORATION_COSINE_THRESHOLD = 0.90


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

    existing = await _existing_keys(db, candidates)
    provider = resolve_provider(Operation.embed)

    # Embed each genuinely-new chunk once (skip in-run duplicates + keys
    # already stored — idempotency: a re-run over an unchanged source adds
    # nothing and spends nothing).
    seen_this_run: set[tuple[str, str]] = set()
    new_chunks: list[tuple[_Candidate, EmbedResult]] = []
    for cand in candidates:
        key = (cand.source_host, cand.chunk_hash)
        if key in seen_this_run or key in existing:
            continue
        seen_this_run.add(key)
        embed_result = await provider.embed(Operation.embed, cand.chunk_text)
        new_chunks.append((cand, embed_result))

    # DS2-b (ii): cross-source corroboration for safety-relevant topics
    # (AC-CD25, ratified Option-2 — embedding cosine similarity, this
    # conversation 2026-06-12). corroboration_count = the number of distinct
    # source_hosts among the run's new chunks whose embedding is within
    # _CORROBORATION_COSINE_THRESHOLD of the chunk (incl. its own source).
    # Reuses the already-computed embeddings — essentially free.
    corroboration = _corroboration_counts(new_chunks) if safety_relevant else {}

    added = 0
    for idx, (cand, embed_result) in enumerate(new_chunks):
        row = CorpusChunk(
            tenant_id=SEED_TENANT_ID,
            source_doc_ref=cand.source_doc_ref,
            source_host=cand.source_host,
            authority_tier=int(cand.tier),
            authority_score=authority_score(cand.tier),
            corroboration_count=corroboration.get(idx, 1),
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


def _corroboration_counts(
    new_chunks: list[tuple[_Candidate, EmbedResult]],
) -> dict[int, int]:
    """For each new chunk (by index), the number of **distinct source_hosts**
    among the run's new chunks whose embedding is within
    ``_CORROBORATION_COSINE_THRESHOLD`` cosine similarity of it — its own
    source always counted (AC-CD25 DS2-b option (ii), ratified 2026-06-12).

    Embeddings are pre-normalised once so each pairwise check is a dot
    product; O(N²·D) over the (bounded) per-run chunk set, safety topics
    only. A zero-norm embedding (degenerate) corroborates with nothing.
    """
    normalised: list[list[float] | None] = []
    for _cand, result in new_chunks:
        norm = math.sqrt(sum(x * x for x in result.embedding))
        normalised.append([x / norm for x in result.embedding] if norm else None)

    counts: dict[int, int] = {}
    for i, (cand_i, _result_i) in enumerate(new_chunks):
        hosts = {cand_i.source_host}
        vec_i = normalised[i]
        if vec_i is not None:
            for j, (cand_j, _result_j) in enumerate(new_chunks):
                if i == j or cand_j.source_host in hosts:
                    continue
                vec_j = normalised[j]
                if vec_j is None:
                    continue
                dot = sum(a * b for a, b in zip(vec_i, vec_j, strict=True))
                if dot >= _CORROBORATION_COSINE_THRESHOLD:
                    hosts.add(cand_j.source_host)
        counts[i] = len(hosts)
    return counts


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
