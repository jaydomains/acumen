"""Slice E2 — DS13-a DB source-override layer (AC-CD26 / AC-D28).

Zero-network (AC-CD15): the ``effective_*`` resolvers layer ``demoted_sources``
overrides on top of the pure code-seed allowlist. ``osha.gov`` is a seeded
allowlist host (T2); the overrides flip / re-rank / skip it.
"""

from __future__ import annotations

from app.domain.source_authority import (
    Tier,
    authority_tier,
    denied_hosts,
    effective_authority_tier,
    effective_is_allowlisted,
    filter_demoted,
)
from app.domain.web_search import WebSearchResult
from app.models import SEED_TENANT_ID, DemotedSource
from tests.integration.conftest import CatalogueFakeSession


def _demote(
    session: CatalogueFakeSession,
    *,
    host: str,
    denied: bool = True,
    tier_override: int | None = None,
) -> None:
    session.add(
        DemotedSource(
            tenant_id=SEED_TENANT_ID,
            source_host=host,
            denied=denied,
            tier_override=tier_override,
        )
    )


async def test_no_override_returns_code_seed_tier() -> None:
    session = CatalogueFakeSession()
    assert authority_tier("osha.gov") == Tier.T2  # code seed
    assert await effective_authority_tier(session, "osha.gov") == Tier.T2
    assert await effective_is_allowlisted(session, "osha.gov") is True


async def test_denied_override_removes_host() -> None:
    session = CatalogueFakeSession()
    _demote(session, host="osha.gov", denied=True)
    assert await effective_authority_tier(session, "osha.gov") is None
    assert await effective_is_allowlisted(session, "osha.gov") is False


async def test_tier_override_reranks_host() -> None:
    session = CatalogueFakeSession()
    _demote(session, host="osha.gov", denied=False, tier_override=int(Tier.T3))
    assert await effective_authority_tier(session, "osha.gov") == Tier.T3
    assert await effective_is_allowlisted(session, "osha.gov") is True


async def test_invalid_tier_override_falls_back_to_seed() -> None:
    # A free-form ``tier_override`` outside {1,2,3} must not crash — fall back
    # to the code-seed tier (osha.gov = T2).
    session = CatalogueFakeSession()
    _demote(session, host="osha.gov", denied=False, tier_override=99)
    assert await effective_authority_tier(session, "osha.gov") == Tier.T2


async def test_denied_hosts_and_filter_demoted() -> None:
    session = CatalogueFakeSession()
    _demote(session, host="osha.gov", denied=True)
    _demote(session, host="cdc.gov", denied=False, tier_override=int(Tier.T2))

    assert await denied_hosts(session) == {"osha.gov"}

    tagged = [
        (
            WebSearchResult(
                title="a", url="https://osha.gov/x", snippet="", source="osha.gov"
            ),
            Tier.T2,
        ),
        (
            WebSearchResult(
                title="b", url="https://cdc.gov/y", snippet="", source="cdc.gov"
            ),
            Tier.T1,
        ),
    ]
    kept = await filter_demoted(session, tagged)
    assert [host for _, host in [(r, r.source) for r, _ in kept]] == ["cdc.gov"]


async def test_filter_demoted_noop_without_demotions() -> None:
    session = CatalogueFakeSession()
    tagged = [
        (
            WebSearchResult(
                title="a", url="https://osha.gov/x", snippet="", source="osha.gov"
            ),
            Tier.T2,
        ),
    ]
    assert await filter_demoted(session, tagged) == tagged
