"""Real-DB persistence guard for the §6.5 discovery-miss signal (D1-D2).

The integration suite's ``CatalogueFakeSession.commit`` is a no-op that never
rolls back pending rows, so it cannot prove the GET discovery path actually
**commits** the captured ``GapSignal`` (the no-commit regression that shipped in
D1-D2 round-1). This e2e test runs against the real Postgres the
``migration-chain`` CI job provisions: it captures + commits in one
``worker_session`` and reads the row back in a FRESH session — a missing/removed
commit would lose the row and fail the assertion. Excluded from the default
``pytest -q`` run (``--ignore=tests/e2e``) so the AC-CD15 zero-network contract
for unit + integration is unaffected.
"""

from __future__ import annotations

import asyncio
import uuid

from sqlalchemy import delete, select


def test_discovery_miss_persists_across_sessions() -> None:
    """capture_discovery_miss + commit in one session is readable in a fresh
    session — the genuine persistence guard the fake-session test cannot give."""
    from app.domain.signals import capture_discovery_miss
    from app.models import GapSignal, worker_session

    marker = f"e2e-persist-{uuid.uuid4()}"

    async def _capture() -> None:
        async with worker_session() as session:
            await capture_discovery_miss(session, search=marker, result_count=0)
            await session.commit()

    async def _count() -> int:
        async with worker_session() as session:
            result = await session.execute(
                select(GapSignal).where(GapSignal.dedup_key == marker)
            )
            return len(list(result.scalars().all()))

    async def _cleanup() -> None:
        async with worker_session() as session:
            await session.execute(delete(GapSignal).where(GapSignal.dedup_key == marker))
            await session.commit()

    asyncio.run(_capture())
    try:
        # A fresh session sees the committed row — proves the GET-path commit.
        assert asyncio.run(_count()) == 1
    finally:
        asyncio.run(_cleanup())
