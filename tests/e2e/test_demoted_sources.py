"""Real-DB guard for the DS13-a source-override layer (E2 / AC-CD26 / AC-D28).

The 0013 migration adds ``demoted_sources``; the ``effective_*`` resolvers layer
its overrides on top of the code-seed allowlist. The integration ``CatalogueFake
Session`` can't model the migration, the ``(tenant_id, source_host)`` unique
constraint, or a cross-session read, so this e2e runs against the real Postgres
the ``migration-chain`` CI job provisions: a committed ``denied`` demotion is read
back in a FRESH session and flips ``effective_authority_tier`` for an otherwise
seeded-allowlist host. Excluded from the default ``pytest -q`` run
(``--ignore=tests/e2e``).
"""

from __future__ import annotations

import asyncio
import uuid

from sqlalchemy import delete


def test_demoted_source_overrides_code_seed_across_sessions() -> None:
    from app.domain.source_authority import (
        Tier,
        authority_tier,
        denied_hosts,
        effective_authority_tier,
        effective_is_allowlisted,
    )
    from app.models import SEED_TENANT_ID, DemotedSource, worker_session

    host = f"e2e-{uuid.uuid4().hex}.example.gov"
    # Sanity: the synthetic host isn't on the code seed — use a real seed host
    # (osha.gov, T2) for the override-flip and the synthetic one only for cleanup
    # isolation of the row we insert.
    assert authority_tier("osha.gov") == Tier.T2

    async def _seed() -> None:
        async with worker_session() as session:
            session.add(
                DemotedSource(
                    tenant_id=SEED_TENANT_ID,
                    source_host="osha.gov",
                    denied=True,
                    reason=host,  # tag the row so cleanup targets exactly it
                )
            )
            await session.commit()

    async def _assert() -> None:
        async with worker_session() as session:
            # The committed ``denied`` demotion removes osha.gov from the
            # effective allowlist even though the code seed ranks it T2.
            assert await effective_authority_tier(session, "osha.gov") is None
            assert await effective_is_allowlisted(session, "osha.gov") is False
            assert "osha.gov" in await denied_hosts(session)

    async def _cleanup() -> None:
        async with worker_session() as session:
            await session.execute(
                delete(DemotedSource).where(DemotedSource.reason == host)
            )
            await session.commit()

    asyncio.run(_seed())
    try:
        asyncio.run(_assert())
    finally:
        asyncio.run(_cleanup())
