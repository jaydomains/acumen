"""Source-authority allowlist + tiered scoring registry (AC-D28, Slice A1).

A pure, offline, dependency-light registry that answers two questions
about any URL or host:

* *Is it on the tiered allowlist?* (:func:`is_allowlisted`)
* *What is its authority tier and numeric score?*
  (:func:`authority_tier` / :func:`authority_score`)

plus :func:`filter_to_allowlist`, the primitive ruling 3 / AC-D28 needs
to restrict an arbitrary web-search result list to allowlisted hosts.

This is the **foundation** the reference-corpus builder (A2, AC-CD25)
and the downstream confidence / authority surfaces (Stage C, Stage E)
depend on. It deliberately stops at the primitive: no fetch / extract /
embed (A2), no corpus-doc storage or ``authority_score`` column (A2),
no ``web_search`` wiring (A2), no refresh cron (A3).

**No DB table at A1** (AC-D28 implications): this follows the locked
code-VCS-registry pattern (`app/ai/prompts/`, the
``_ANTHROPIC_DEFAULT_OPS`` frozensets). The seed allowlist lives in
version control; the operator widens it per tier through environment
configuration (the AC-CD18 env-default pattern). The DB-level
per-source override / demotion layer (``demoted_sources``) is the E2
half of AC-D28 (DS13-a) and lands with the AC-CD26 oversight rollback
contract — it is **not** part of A1.

**Allowlist application scope (AC-D28, DS1-c — ruled corpus-acquisition
only).** This registry governs corpus acquisition. The existing AC-D21
safety-link curation search (`app/domain/safety_links.py`) retains its
current behaviour and is untouched by A1.
"""

from __future__ import annotations

import enum
from collections.abc import Iterable

from app.config import Settings, get_settings
from app.domain.web_search import WebSearchResult, _host_of


class Tier(enum.IntEnum):
    """Authority tier (AC-D28). ``IntEnum`` so tier ordering
    (``T1 > T2 > T3``) and the raw ordinal (3 / 2 / 1, for callers that
    want rank not weight) are intrinsic. The normalised authority
    *score* is a separate map (:func:`authority_score`, AC-D28 DS1-a) so
    the ordinal and the score can diverge later without an enum change.
    """

    T1 = 3  # regulators and standards bodies
    T2 = 2  # recognised industry and professional bodies
    T3 = 1  # reputable industry and educational sources


# Normalised authority score by tier (AC-D28 DS1-a, ratified
# T1=1.0 / T2=0.6 / T3=0.3). This is the single authority signal the
# corpus builder (AC-CD25) stamps on each chunk and that Stage-C
# confidence scoring + the Stage-E authority breakdown read; a change to
# these values is a coordinated confidence-contract change (couples NS-6,
# AC-D31). Kept as a thin map so the value is one edit from the anchor.
_SCORE_BY_TIER: dict[Tier, float] = {
    Tier.T1: 1.0,
    Tier.T2: 0.6,
    Tier.T3: 0.3,
}


# Seed allowlist: host pattern -> tier (AC-D28, ruling 3). T1 is
# enumerated verbatim from the ruling; T2 is the ratified small seed of
# recognised industry/professional bodies; T3 is **seeded minimally**
# (none at seed) and widened by the operator through env configuration.
# ``*.<suffix>`` is a suffix-wildcard (matches the apex and any
# subdomain — see :func:`authority_tier`).
_SEED_ALLOWLIST: dict[str, Tier] = {
    # T1 — regulators and standards bodies (score 1.0)
    "iso.org": Tier.T1,
    "nrcs.org.za": Tier.T1,
    "sabs.co.za": Tier.T1,
    "*.gov.za": Tier.T1,
    # T2 — recognised industry and professional bodies (score 0.6)
    "nace.org": Tier.T2,
    "osha.gov": Tier.T2,
    "iec.ch": Tier.T2,
    "astm.org": Tier.T2,
    # T3 — seeded minimally (none); operator-extensible via env (AC-D28)
}


def _split_csv(raw: str) -> list[str]:
    """Split a comma-separated env value into non-empty trimmed tokens."""
    return [tok.strip() for tok in raw.split(",") if tok.strip()]


def _normalise(value: str) -> str:
    """Normalise a URL or bare host to a comparable host string:
    extract the host (``_host_of`` handles both a full URL and a bare
    host — it falls back to the raw input on a parse miss), lowercase,
    and strip a leading ``www.``. A ``*.`` wildcard prefix is preserved
    (so an env-supplied ``*.example.org`` pattern stays a wildcard)."""
    wildcard = value.strip().lower().startswith("*.")
    host = _host_of(value).strip().lower()
    if wildcard and not host.startswith("*."):
        # ``_host_of`` may have parsed away the leading ``*.`` — restore it.
        host = "*." + host.lstrip("*.")
    if host.startswith("www."):
        host = host[4:]
    return host


def _load_allowlist(settings: Settings | None = None) -> dict[str, Tier]:
    """Build the effective allowlist: the coded seed merged with the
    operator's per-tier env extensions (AC-CD18 pattern, AC-D28).

    Conflict rule (AC-D28): an env entry may **add** a host but never
    silently re-tier a seed host — a host appearing at two tiers resolves
    to the **stronger** tier (higher ``Tier`` ordinal) deterministically.
    """
    settings = settings or get_settings()
    merged: dict[str, Tier] = dict(_SEED_ALLOWLIST)
    env_by_tier = (
        (Tier.T1, settings.source_authority_t1_extra),
        (Tier.T2, settings.source_authority_t2_extra),
        (Tier.T3, settings.source_authority_t3_extra),
    )
    for tier, raw in env_by_tier:
        for pattern in _split_csv(raw):
            host = _normalise(pattern)
            existing = merged.get(host)
            if existing is None or tier > existing:
                merged[host] = tier
    return merged


def authority_tier(url_or_host: str, *, settings: Settings | None = None) -> Tier | None:
    """Resolve a URL or host to its authority :class:`Tier`, or ``None``
    if the host is not on the allowlist (AC-D28).

    Matching: **exact host** first (after lowercasing and stripping a
    leading ``www.``), then **suffix-wildcard** for ``*.<suffix>``
    patterns (so ``*.gov.za`` matches ``dol.gov.za`` and the apex
    ``gov.za``). An exact entry wins over a wildcard on tie; among
    multiple matching wildcards the **stronger** tier wins. Pure — no I/O.
    """
    host = _normalise(url_or_host)
    if not host:
        return None
    allowlist = _load_allowlist(settings)

    # Exact host match wins over any wildcard.
    exact = allowlist.get(host)
    if exact is not None:
        return exact

    # Suffix-wildcard match: strongest matching wildcard tier.
    best: Tier | None = None
    for pattern, tier in allowlist.items():
        if not pattern.startswith("*."):
            continue
        suffix = pattern[2:]
        if host == suffix or host.endswith("." + suffix):
            if best is None or tier > best:
                best = tier
    return best


def authority_score(tier: Tier) -> float:
    """Return the normalised authority score for a tier (AC-D28 DS1-a:
    T1=1.0 / T2=0.6 / T3=0.3)."""
    return _SCORE_BY_TIER[tier]


def is_allowlisted(url_or_host: str, *, settings: Settings | None = None) -> bool:
    """``True`` iff the URL/host resolves to an authority tier (AC-D28)."""
    return authority_tier(url_or_host, settings=settings) is not None


def filter_to_allowlist(
    results: Iterable[WebSearchResult], *, settings: Settings | None = None
) -> list[tuple[WebSearchResult, Tier]]:
    """Restrict a web-search result list to allowlisted hosts, pairing
    each surviving row with its resolved :class:`Tier` (AC-D28, ruling 3
    "web search restricted to the allowlist").

    Drops every row whose host is not allowlisted; preserves input order;
    pairs each kept row with its tier so the A2 corpus builder can stamp
    the authority score without re-resolving. The :class:`WebSearchResult`
    ``source`` field carries the host; the ``url`` is the fallback. A1
    provides this primitive — A2 *applies* it around
    ``get_web_search_source().search(...)``. Pure — no I/O.
    """
    tagged: list[tuple[WebSearchResult, Tier]] = []
    for row in results:
        tier = authority_tier(row.source or row.url, settings=settings)
        if tier is not None:
            tagged.append((row, tier))
    return tagged
