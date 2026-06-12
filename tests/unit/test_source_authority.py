"""Slice A1 — :mod:`app.domain.source_authority` unit tests (AC-D28).

The source-authority registry is a pure, static, offline primitive: a
tiered allowlist (T1/T2/T3) + tier-scoring + an allowlist-filter. These
tests pin tier resolution (exact + suffix-wildcard), score-by-tier
monotonicity, the filter, the env-extension merge + conflict rule, and
the zero-network purity bar (AC-CD15 — no provider, no I/O).
"""

from __future__ import annotations

from app.config import Settings
from app.domain.source_authority import (
    Tier,
    authority_score,
    authority_tier,
    filter_to_allowlist,
    is_allowlisted,
)
from app.domain.web_search import WebSearchResult

# --- 1. Tier resolution — exact + suffix-wildcard ---------------------


def test_exact_t1_host_resolves() -> None:
    """A seed T1 host (from a full URL) resolves to ``Tier.T1``."""
    assert authority_tier("https://iso.org/standard/x") is Tier.T1


def test_suffix_wildcard_matches_subdomain_and_apex() -> None:
    """``*.gov.za`` matches a subdomain and the apex."""
    assert authority_tier("dol.gov.za") is Tier.T1
    assert authority_tier("gov.za") is Tier.T1
    assert authority_tier("https://www.labour.gov.za/notices") is Tier.T1


def test_seed_t2_host_resolves() -> None:
    assert authority_tier("nace.org") is Tier.T2
    assert authority_tier("astm.org") is Tier.T2


def test_unknown_host_resolves_to_none() -> None:
    """A host not on the allowlist resolves to no tier (not an eligible
    corpus source, AC-D28)."""
    assert authority_tier("example.com") is None
    assert authority_tier("https://evil.example/page") is None


def test_www_prefix_stripped_and_case_insensitive() -> None:
    assert authority_tier("www.ISO.org") is Tier.T1
    assert authority_tier("ISO.ORG") is Tier.T1


def test_is_allowlisted_mirrors_tier_presence() -> None:
    assert is_allowlisted("iso.org") is True
    assert is_allowlisted("example.com") is False


def test_exact_entry_wins_over_wildcard() -> None:
    """An exact-host entry takes precedence over a wildcard that would
    also match (exact wins on tie, AC-D28). ``osha.gov`` is an explicit
    T2 entry and resolves to T2 despite being a ``.gov`` host (there is
    no ``*.gov`` seed, but the precedence rule is asserted directly via
    an env wildcard below)."""
    s = Settings(source_authority_t3_extra="*.gov")
    # Exact T2 seed beats the env T3 wildcard for osha.gov.
    assert authority_tier("osha.gov", settings=s) is Tier.T2
    # A non-seed .gov host falls to the wildcard tier.
    assert authority_tier("nasa.gov", settings=s) is Tier.T3


# --- 2. Score-by-tier monotonicity (AC-D28 DS1-a) ---------------------


def test_score_by_tier_monotonic_and_exact() -> None:
    """Scores are strictly monotone and pinned to the ratified values so
    a change is a deliberate, test-visible edit (AC-D28 DS1-a)."""
    assert authority_score(Tier.T1) == 1.0
    assert authority_score(Tier.T2) == 0.6
    assert authority_score(Tier.T3) == 0.3
    assert authority_score(Tier.T1) > authority_score(Tier.T2) > authority_score(Tier.T3)


def test_tier_ordinal_ordering() -> None:
    """The raw ``IntEnum`` ordinal carries rank (T1 > T2 > T3) for
    callers that want rank not weight."""
    assert Tier.T1 > Tier.T2 > Tier.T3


# --- 3. Allowlist filter (AC-D28, ruling 3) ---------------------------


def _row(host: str) -> WebSearchResult:
    return WebSearchResult(url=f"https://{host}/p", title="t", snippet="s", source=host)


def test_filter_keeps_only_allowlisted_rows_with_tier() -> None:
    rows = [
        _row("iso.org"),  # T1
        _row("example.com"),  # dropped
        _row("nace.org"),  # T2
        _row("random.test"),  # dropped
        _row("dol.gov.za"),  # T1 (wildcard)
    ]
    out = filter_to_allowlist(rows)
    assert [(r.source, t) for r, t in out] == [
        ("iso.org", Tier.T1),
        ("nace.org", Tier.T2),
        ("dol.gov.za", Tier.T1),
    ]


def test_filter_all_non_allowlisted_returns_empty() -> None:
    assert filter_to_allowlist([_row("a.test"), _row("b.test")]) == []


def test_filter_falls_back_to_url_when_source_blank() -> None:
    """A row whose ``source`` is blank still resolves via its ``url``."""
    row = WebSearchResult(url="https://iso.org/x", title="t", snippet="s", source="")
    out = filter_to_allowlist([row])
    assert len(out) == 1 and out[0][1] is Tier.T1


# --- 4. Env-extension merge + conflict rule (AC-D28 / AC-CD18) ---------


def test_env_extension_adds_host() -> None:
    s = Settings(source_authority_t2_extra="acme-pro.example")
    assert authority_tier("acme-pro.example", settings=s) is Tier.T2
    # Without the env extension the host is unknown.
    assert authority_tier("acme-pro.example", settings=Settings()) is None


def test_env_extension_csv_and_wildcard() -> None:
    s = Settings(source_authority_t3_extra="foo.example, *.edu.example , bar.example")
    assert authority_tier("foo.example", settings=s) is Tier.T3
    assert authority_tier("bar.example", settings=s) is Tier.T3
    assert authority_tier("dept.edu.example", settings=s) is Tier.T3


def test_env_conflict_resolves_to_stronger_tier() -> None:
    """An env entry duplicating a seed host at a weaker tier still
    resolves to the stronger (seed) tier (deterministic conflict rule,
    AC-D28)."""
    s = Settings(source_authority_t3_extra="iso.org")
    assert authority_tier("iso.org", settings=s) is Tier.T1


def test_env_exact_does_not_downgrade_seed_wildcard() -> None:
    """An env **exact** entry at a weaker tier must not silently downgrade
    a host a seed **wildcard** ranks higher: ``data.gov.za`` is covered by
    the seed ``*.gov.za`` (T1), so a T3 env exact still resolves to T1
    (AC-D28 "resolves to the stronger tier"; OV-A1-4r / Gitar PR #114
    finding 1 regression — the exact branch must not short-circuit past a
    stronger covering wildcard)."""
    s = Settings(source_authority_t3_extra="data.gov.za")
    assert authority_tier("data.gov.za", settings=s) is Tier.T1


def test_strongest_wildcard_wins_among_multiple() -> None:
    """Among multiple overlapping wildcards matching the same host, the
    stronger tier wins (AC-D28; Gitar PR #114 finding 3 coverage gap).
    ``*.foo.example`` (T2) and ``*.example`` (T3) both cover
    ``x.foo.example`` → T2; a host matched only by the weaker wildcard
    stays T3."""
    s = Settings(
        source_authority_t2_extra="*.foo.example",
        source_authority_t3_extra="*.example",
    )
    assert authority_tier("x.foo.example", settings=s) is Tier.T2
    assert authority_tier("y.example", settings=s) is Tier.T3


# --- 5. Zero-network + purity (AC-CD15) -------------------------------


def test_registry_is_pure_offline() -> None:
    """The whole module runs under the ``conftest.py`` no-network guard
    with no provider and no monkeypatched I/O — proving the registry is a
    pure offline primitive (AC-CD15). Reaching this assertion under the
    autouse network guard is the proof."""
    assert authority_tier("iso.org") is Tier.T1
    assert filter_to_allowlist([_row("iso.org")])[0][1] is Tier.T1
