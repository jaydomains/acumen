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
produced the same chunk text (content_hash) in this run — feeding the
Stage-C confidence score + the B2 provenance chain (stronger grounding for
safety content). Exact-text is the **A2 v1 floor**; embedding
cosine-similarity matching is the ratified mechanism (2026-06-12) but lands
via a separate AC-CD25 amendment PR + a re-implementation here, not folded
into this execution slice (the 2026-06-12 procedural ruling).

Scope fence: this is **acquisition only**. The corpus retrieval helper +
the refresh cron are A3; generation grounding + the per-draft provenance
chain are B2; the NS-1 Drive-code retirement is a separate step (A2 reuses
`drive_rag`'s pure fns beside the legacy path, it does not remove them).
"""

from __future__ import annotations

import io
import ipaddress
import logging
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

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
_MAX_REDIRECTS = 5  # bound manual redirect-following (SSRF guard).


def _is_blocked_host(host: str) -> bool:
    """True if ``host`` is an IP literal in a private / loopback / link-local /
    reserved / multicast / unspecified range — the SSRF guard against a
    redirect (or an env-misconfigured allowlist entry) pointing the autonomous
    builder at an internal/metadata address (e.g. ``169.254.169.254``,
    RFC1918, ``127.0.0.1``). Non-IP hostnames pass this check — they are
    bounded separately by the source-authority allowlist (AC-D28)."""
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False  # not an IP literal — allowlist-bounded instead.
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def _host_allowed(host: str) -> bool:
    """A host is fetchable iff it is **not** an internal IP literal **and** it
    is on the source-authority allowlist (AC-D28). Both checks run **before**
    any request is issued (OV-A2-18 / CA-A2-2r — bound the autonomous builder's
    *requests*, not merely what it persists)."""
    return not _is_blocked_host(host) and authority_tier(host) is not None


async def _fetch_body(
    url: str, *, client: httpx.AsyncClient | None = None
) -> tuple[int, bytes | None, str, str]:
    """GET ``url`` and return ``(status_code, body | None, content_type,
    final_host)``.

    **Redirects are followed manually**, re-validating **each hop's host
    against the allowlist + the internal-IP guard *before* issuing that hop's
    request** (OV-A2-18 / CA-A2-2r). Auto-following is disabled so the
    autonomous builder never *fires* a request at an off-allowlist or
    internal/metadata host — closing the blind-SSRF the post-hoc check left
    open. ``final_host`` is the host of the final (allowlisted) response, so
    the caller stamps authority from where the bytes actually came from.

    Fail-soft: a network error, a blocked/off-allowlist hop, a >=400 status,
    or exceeding ``_MAX_REDIRECTS`` returns ``(_, None, "", host)`` so the
    caller skips the source without failing the run. The body is **streamed**
    and hard-capped at ``_HTTP_FETCH_MAX_BYTES`` so a hostile endpoint cannot
    balloon memory. ``client`` is the AC-CD15 test seam; it must **not**
    auto-follow redirects (the production client is built with
    ``follow_redirects=False``; tests inject a transport on a default client).
    """
    own_client = client is None
    if client is None:
        client = httpx.AsyncClient(
            timeout=_HTTP_FETCH_TIMEOUT_SECONDS, follow_redirects=False
        )
    try:
        current = url
        for _hop in range(_MAX_REDIRECTS + 1):
            host = urlparse(current).hostname or ""
            # Guard BEFORE issuing the request — this is what prevents the
            # SSRF request from firing at all.
            if not _host_allowed(host):
                logger.warning(
                    "corpus fetch blocked (off-allowlist/internal host %r): %s",
                    host,
                    current,
                )
                return 0, None, "", host
            async with client.stream("GET", current) as response:
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        return response.status_code, None, "", host
                    current = urljoin(current, location)
                    continue  # re-validate the next hop before following it.
                if response.status_code >= 400:
                    return response.status_code, None, "", host
                content_type = response.headers.get("content-type", "")
                buffer = bytearray()
                async for chunk in response.aiter_bytes():
                    buffer.extend(chunk)
                    if len(buffer) >= _HTTP_FETCH_MAX_BYTES:
                        del buffer[_HTTP_FETCH_MAX_BYTES:]
                        break
                return response.status_code, bytes(buffer), content_type, host
        logger.warning("corpus fetch exceeded %d redirects: %s", _MAX_REDIRECTS, url)
        return 0, None, "", ""
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
    # count the DISTINCT allowlisted sources that produced the same chunk
    # text (content_hash) in this run. **Exact-text is the A2 v1 floor**;
    # embedding cosine-similarity matching is the ratified mechanism but
    # lands via a separate AC-CD25 amendment PR + re-implementation here
    # (the 2026-06-12 procedural ruling — spec amendments are not folded
    # into an execution slice).
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
        # re-run over an unchanged source adds nothing and spends nothing).
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
