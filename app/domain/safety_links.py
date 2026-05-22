"""Safety auto-tag + (P11) external link curation + monthly check
(AC-D21).

P3 owns the **auto-tag** half: a pill is ``safety_relevant`` when
either signal fires —

  (a) keyword detection on the pill name/description against the
      tenant-configured ``system_settings.safety_keyword_list`` (loaded
      from the row, never hard-coded — ROADMAP P3 risk note), or
  (b) the proposing AI's self-classification when the pill came from the
      AC-D7/AC-D8 proposal queue (passed in by the caller).

P11 Slice 3 fills the **link-curation + monthly link-check** half:

* :func:`curate_links_for_pill` — fetches 3-5 authoritative external
  references for a safety pill via the :mod:`app.domain.web_search`
  seam, HTTP-fetches the body, computes a SHA-256 ``content_hash``,
  writes :class:`~app.models.PillSafetyLink` rows. Idempotent: a
  re-run on a pill already at quota is a counter-zero no-op.

* :func:`check_safety_links` — the AC-D21 monthly sweep. For each
  cached link: HEAD the URL; on 4xx/5xx replace via fresh web search;
  on SHA-256 content_hash mismatch write an audit row
  ``safety_links.drift_flagged`` (no AI drift call — AC-CD8 v1.6's
  operation enum routes only ``grade_review`` and
  ``anchor_self_review`` through ``provider.review()``; adding a
  drift operation would be a v1.x spec change, out of P11 scope).
  Admins review flagged links manually.

CODE_SPEC §3 / §8 (AC-CD7) / AC-D21.
"""

from __future__ import annotations

import hashlib
import logging
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SEED_TENANT_ID, Pill, PillSafetyLink, SystemSettings
from app.permissions import now_utc

# ``record_audit`` lives in ``app.domain.catalogue`` which already
# imports ``auto_tag_safety`` from this module (P3 wiring) — a top-
# level import here would cycle. Resolved with deferred import inside
# the callers that need it (curate_links_for_pill / check_safety_links).

logger = logging.getLogger(__name__)


# Min / max desired link count per safety pill (AC-D21: "3-5
# authoritative external links"). Both are constants here because the
# spec wording fixes the range; promoting to system_settings is a
# v1.x candidate alongside the other P-implementation-defined knobs.
_TARGET_LINKS_PER_PILL = 3
_MAX_LINKS_PER_PILL = 5

# httpx fetch budget for safety-link content. The body is hashed and
# discarded; we don't need long-tail bytes. 256 KiB covers any
# reasonable reference article without leaving the cron at the mercy
# of a multi-megabyte PDF download.
_HTTP_FETCH_TIMEOUT_SECONDS = 10
_HTTP_FETCH_MAX_BYTES = 256 * 1024


async def _safety_keywords(db: AsyncSession) -> list[str]:
    """Tenant safety keyword list from ``system_settings`` (AC-D21).

    Seeded with v1.3 defaults by migration 0002; configurable per
    tenant. Falls back to an empty list only if no settings row exists
    (so the AI-signal path still works in isolation)."""
    result = await db.execute(
        select(SystemSettings).where(SystemSettings.tenant_id == SEED_TENANT_ID)
    )
    settings = result.scalar_one_or_none()
    if settings is None:
        return []
    return [str(k).lower() for k in (settings.safety_keyword_list or [])]


async def auto_tag_safety(
    name: str,
    description: str | None,
    db: AsyncSession,
    *,
    ai_safety_classification: bool | None = None,
) -> bool:
    """Return whether a pill is safety-relevant (AC-D21).

    Keyword signal OR the proposing AI's self-classification. Substring,
    case-insensitive match on name + description so multi-word cues
    ("confined space", "high voltage") and embedded mentions are caught.
    """
    if ai_safety_classification:
        return True
    haystack = f"{name} {description or ''}".lower()
    return any(keyword in haystack for keyword in await _safety_keywords(db))


# --- P11 Slice 3 — curation + monthly check ---------------------------


def _sha256_of(body: bytes) -> str:
    """SHA-256 hex digest of the response body. The hash is the drift
    detector — a single byte change flips it. AC-D21 binary contract:
    no similarity threshold, no AI call, pure cryptographic
    fingerprint."""
    return hashlib.sha256(body).hexdigest()


async def _fetch_body_hash(
    url: str, *, client: httpx.AsyncClient | None = None
) -> tuple[int, str | None]:
    """GET ``url`` and return ``(status_code, content_hash | None)``.

    On network failure (timeout, DNS, connection refused) returns
    ``(0, None)`` so the caller can treat it as a "broken" link and
    replace via fresh web search — the contract matches a 5xx.
    Truncates the body at ``_HTTP_FETCH_MAX_BYTES`` so a malicious or
    accidental multi-MB payload doesn't stall the cron.
    """
    own_client = client is None
    try:
        if client is None:
            client = httpx.AsyncClient(
                timeout=_HTTP_FETCH_TIMEOUT_SECONDS,
                follow_redirects=True,
            )
        try:
            response = await client.get(url)
            if response.status_code >= 400:
                return response.status_code, None
            body = response.content[:_HTTP_FETCH_MAX_BYTES]
            return response.status_code, _sha256_of(body)
        finally:
            if own_client:
                await client.aclose()
    except (httpx.HTTPError, OSError) as exc:
        logger.warning("safety-link fetch failed for %s: %s", url, exc)
        return 0, None


def _curation_query(pill: Pill) -> str:
    """Build the web-search query for a safety pill. Uses the pill
    name + the descriptor ``"safety training reference"`` so the
    search lands on authoritative documents rather than blog posts
    (Tavily's relevance ranking biases toward standards bodies like
    NACE / SANS / OSHA when the query reads as a training query)."""
    return f"{pill.name} safety training reference"


async def _existing_links_for(
    db: AsyncSession, pill_id: uuid.UUID
) -> list[PillSafetyLink]:
    """All currently-cached safety links for ``pill_id`` (tenant-
    scoped). Used by curation to compute both the count (for the
    quota gate) and the URL set (for the dedupe gate)."""
    result = await db.execute(
        select(PillSafetyLink).where(
            PillSafetyLink.pill_id == pill_id,
            PillSafetyLink.tenant_id == SEED_TENANT_ID,
        )
    )
    return list(result.scalars().all())


async def curate_links_for_pill(
    db: AsyncSession,
    pill_id: uuid.UUID,
    *,
    http_client: httpx.AsyncClient | None = None,
) -> dict[str, int]:
    """Populate the safety-link cache for a single pill (AC-D21).

    Idempotent: if the pill is already at ``_TARGET_LINKS_PER_PILL``
    or more, returns ``{"links_added": 0, "links_skipped": <count>}``
    without an external call. Otherwise issues one web search via
    :func:`~app.domain.web_search.get_web_search_source`, takes up to
    ``_MAX_LINKS_PER_PILL`` results, HTTP-fetches each to compute the
    SHA-256 ``content_hash``, writes :class:`PillSafetyLink` rows for
    every URL whose fetch succeeded.

    Skips: non-safety pills (no-op + audit), pills with zero web-
    search results (audit ``safety_links.no_results_found``), URLs
    that fail the body fetch (counted under ``links_skipped`` but not
    persisted — the cron's next pass retries).

    The ``http_client`` parameter is a test seam: tests pass an
    httpx client backed by a fake transport, production passes None
    and a fresh client is opened per call.
    """
    from app.domain.catalogue import record_audit  # deferred (cycle)

    pill = await _load_pill(db, pill_id)
    if pill is None:
        return {"links_added": 0, "links_skipped": 0}
    if not pill.safety_relevant:
        return {"links_added": 0, "links_skipped": 0}

    existing_rows = await _existing_links_for(db, pill_id)
    existing = len(existing_rows)
    deficit = _TARGET_LINKS_PER_PILL - existing
    if deficit <= 0:
        return {"links_added": 0, "links_skipped": existing}

    # URL-level dedupe set (Gitar PR-#24 Slice 3 finding #1): the
    # broken-link path in ``check_safety_links`` keeps the failed row
    # in place and calls back into this function for top-up; if the
    # web search returns the same URL (host temporarily down) we'd
    # otherwise insert a duplicate. The set is computed once here so
    # the dedupe gate is O(1) per candidate URL across the per-search
    # loop below.
    existing_urls = {row.url for row in existing_rows}

    from app.domain.web_search import get_web_search_source

    source = get_web_search_source()
    results = await source.search(_curation_query(pill), max_results=_MAX_LINKS_PER_PILL)
    if not results:
        await record_audit(
            db,
            actor_id=None,
            action="safety_links.no_results_found",
            target_entity="pill",
            target_id=pill_id,
            detail={"query": _curation_query(pill)},
        )
        return {"links_added": 0, "links_skipped": 0}

    added = 0
    skipped = 0
    when = now_utc()
    for result in results:
        if added + existing >= _MAX_LINKS_PER_PILL:
            break
        if result.url in existing_urls:
            # Already cached for this pill — skip silently so a
            # transient-broken-then-recovered link doesn't accumulate
            # duplicate rows on each monthly sweep.
            continue
        status, content_hash = await _fetch_body_hash(result.url, client=http_client)
        if content_hash is None:
            skipped += 1
            continue
        db.add(
            PillSafetyLink(
                tenant_id=SEED_TENANT_ID,
                pill_id=pill_id,
                url=result.url,
                title=result.title or None,
                source=result.source or None,
                last_verified_at=when,
                content_hash=content_hash,
            )
        )
        existing_urls.add(result.url)
        added += 1
    await record_audit(
        db,
        actor_id=None,
        action="safety_links.curate",
        target_entity="pill",
        target_id=pill_id,
        detail={
            "query": _curation_query(pill),
            "links_added": added,
            "links_skipped": skipped,
            "links_existing": existing,
        },
    )
    await db.flush()
    return {"links_added": added, "links_skipped": skipped}


async def check_safety_links(
    db: AsyncSession,
    *,
    http_client: httpx.AsyncClient | None = None,
) -> dict[str, int]:
    """Monthly safety-link verification sweep (AC-D21).

    For every cached :class:`PillSafetyLink`:

    * HTTP-GET the URL.
    * On 4xx/5xx (or network error): mark broken; trigger a fresh
      curation pass on the pill (best-effort top-up via the existing
      :func:`curate_links_for_pill`). The broken row stays in place
      so an admin can see the failure history; a future pass may
      flip it back to ``last_verified_at = now`` if the host
      recovers.
    * On a SHA-256 ``content_hash`` mismatch (200 + new hash):
      audit-log ``safety_links.drift_flagged`` for admin attention.
      No AI call (AC-CD8 v1.6's operation enum doesn't carry a drift-
      review op; adding one is a v1.x spec change). Admins review
      the changed content manually.
    * On 200 + matching hash: update ``last_verified_at`` only.

    Returns the v1 telemetry shape consumed by the Celery wrapper
    + admin trigger endpoint.
    """
    from app.domain.catalogue import record_audit  # deferred (cycle)

    own_client = http_client is None
    if http_client is None:
        http_client = httpx.AsyncClient(
            timeout=_HTTP_FETCH_TIMEOUT_SECONDS,
            follow_redirects=True,
        )
    try:
        rows = await _all_safety_links(db)
        when = now_utc()
        broken = 0
        drifted = 0
        unchanged = 0
        broken_pills: set[uuid.UUID] = set()
        for link in rows:
            status, content_hash = await _fetch_body_hash(link.url, client=http_client)
            if content_hash is None:
                broken += 1
                broken_pills.add(link.pill_id)
                await record_audit(
                    db,
                    actor_id=None,
                    action="safety_links.broken_flagged",
                    target_entity="pill_safety_link",
                    target_id=link.id,
                    detail={
                        "url": link.url,
                        "status": status,
                        "pill_id": str(link.pill_id),
                    },
                )
                continue
            if link.content_hash is not None and content_hash != link.content_hash:
                drifted += 1
                await record_audit(
                    db,
                    actor_id=None,
                    action="safety_links.drift_flagged",
                    target_entity="pill_safety_link",
                    target_id=link.id,
                    detail={
                        "url": link.url,
                        "old_content_hash": link.content_hash,
                        "new_content_hash": content_hash,
                        "pill_id": str(link.pill_id),
                    },
                )
                # Update the verified timestamp so the next pass
                # doesn't keep flagging the same drift — admin has
                # the audit row to triage.
                link.last_verified_at = when
                link.content_hash = content_hash
                continue
            unchanged += 1
            link.last_verified_at = when
        # Best-effort top-up for pills with broken links — the
        # curation callable is itself idempotent so this is safe.
        replaced = 0
        for pill_id in broken_pills:
            top_up = await curate_links_for_pill(db, pill_id, http_client=http_client)
            replaced += top_up.get("links_added", 0)
        await db.flush()
        return {
            "links_checked": len(rows),
            "links_broken_replaced": replaced,
            "links_drift_flagged": drifted,
            "links_unchanged": unchanged,
        }
    finally:
        if own_client:
            await http_client.aclose()


# --- internal helpers ------------------------------------------------


async def _load_pill(db: AsyncSession, pill_id: uuid.UUID) -> Pill | None:
    result = await db.execute(
        select(Pill).where(Pill.id == pill_id, Pill.tenant_id == SEED_TENANT_ID)
    )
    return result.scalar_one_or_none()


async def _all_safety_links(db: AsyncSession) -> list[PillSafetyLink]:
    """Every cached safety link for the tenant. AC-CD15 in-memory
    harness has no ORDER BY; the sweep iteration order is whatever
    the store returns, which is fine — no row depends on processing
    order."""
    result = await db.execute(
        select(PillSafetyLink).where(PillSafetyLink.tenant_id == SEED_TENANT_ID)
    )
    return list(result.scalars().all())
