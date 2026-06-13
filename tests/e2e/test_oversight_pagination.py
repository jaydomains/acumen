"""Real-DB pagination guard for the oversight read surface (E1 / CA-E1-2a).

``recent_publishes`` bounds the append-heavy publish-log in SQL (``ORDER BY
created_at DESC`` + ``LIMIT`` + the ``low_confidence`` equality filter) and
applies the ``since`` range + ``subject_id`` join Python-side. The integration
suite's ``CatalogueFakeSession`` is WHERE-blind — it ignores ``ORDER``/``LIMIT``
and can't model a range or a join — so it proves only the Python re-check, not
the production SQL semantics. This e2e runs against the real Postgres the
``migration-chain`` CI job provisions and exercises the SQL path the fake can't:
newest-first ordering, the ``LIMIT``-bounded page + ``has_more`` sentinel, the
``since`` range, and the ``subject_id`` join.

Seeded rows are **future-dated** (created_at = now + 1y, with second offsets) so
they sort to the top of the global publish-log deterministically and are
isolatable from any other tenant rows by a ``since`` just below the future base.
Excluded from the default ``pytest -q`` run (``--ignore=tests/e2e``) so the
AC-CD15 zero-network contract for unit + integration is unaffected.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import timedelta

from sqlalchemy import delete


def test_recent_publishes_sql_pagination_against_real_postgres() -> None:
    from app.domain.oversight import recent_publishes
    from app.models import (
        SEED_TENANT_ID,
        Pill,
        PublishRecord,
        Subject,
        worker_session,
    )
    from app.permissions import now_utc

    subject_id = uuid.uuid4()
    # Future base: guarantees these three are the newest rows in the log, and a
    # `since == base` cleanly windows out every present-dated row.
    base = now_utc() + timedelta(days=365)
    pill_ids = [uuid.uuid4() for _ in range(3)]

    async def _seed() -> None:
        async with worker_session() as session:
            # Flush each FK parent before its children — no ORM relationship is
            # declared, so the unit-of-work's insert order isn't guaranteed to
            # put Subject before Pill (CI hit pill_subject_id_fkey otherwise).
            session.add(
                Subject(id=subject_id, tenant_id=SEED_TENANT_ID, name=f"e2e-{subject_id}")
            )
            await session.flush()
            for i, pid in enumerate(pill_ids):
                session.add(
                    Pill(
                        id=pid,
                        tenant_id=SEED_TENANT_ID,
                        subject_id=subject_id,
                        name=f"e2e-P{i}",
                        available_difficulty_min=1,
                        available_difficulty_max=10,
                    )
                )
            await session.flush()
            for i, pid in enumerate(pill_ids):
                rec = PublishRecord(
                    tenant_id=SEED_TENANT_ID,
                    pill_id=pid,
                    batch_id=None,
                    confidence=0.5 if i == 0 else 0.9,
                    low_confidence=(i == 0),
                    grounding_verdict="pass",
                    safety_verdict="pass",
                    provenance_verdict="pass",
                    safety_relevant=False,
                    single_provider_verified=False,
                )
                rec.created_at = base + timedelta(seconds=i * 10)  # P2 newest
                session.add(rec)
            await session.commit()

    async def _assert() -> None:
        async with worker_session() as session:
            # Newest-first + LIMIT bound: my future-dated rows are the top of the
            # log, so the global limit=2 page is [P2, P1] with has_more True.
            page = await recent_publishes(session, limit=2, offset=0)
            assert [r["pill_name"] for r in page["publishes"]] == ["e2e-P2", "e2e-P1"]
            assert page["has_more"] is True

            # OFFSET: the third-newest is my P0.
            page2 = await recent_publishes(session, limit=2, offset=2)
            assert page2["publishes"][0]["pill_name"] == "e2e-P0"

            # subject_id JOIN (Python-side filter, real-DB join for the row set):
            # exactly my three, newest-first.
            scoped = await recent_publishes(session, subject_id=subject_id)
            assert [r["pill_name"] for r in scoped["publishes"]] == [
                "e2e-P2",
                "e2e-P1",
                "e2e-P0",
            ]

            # since RANGE: windowed to my future rows; >= base+5s keeps P1, P2.
            ranged = await recent_publishes(session, since=base + timedelta(seconds=5))
            assert [r["pill_name"] for r in ranged["publishes"]] == ["e2e-P2", "e2e-P1"]

            # low_confidence equality (SQL WHERE), windowed by since to my rows.
            low = await recent_publishes(
                session, low_confidence=True, since=base - timedelta(seconds=5)
            )
            assert [r["pill_name"] for r in low["publishes"]] == ["e2e-P0"]

    async def _cleanup() -> None:
        async with worker_session() as session:
            await session.execute(
                delete(PublishRecord).where(PublishRecord.pill_id.in_(pill_ids))
            )
            await session.execute(delete(Pill).where(Pill.id.in_(pill_ids)))
            await session.execute(delete(Subject).where(Subject.id == subject_id))
            await session.commit()

    asyncio.run(_seed())
    try:
        asyncio.run(_assert())
    finally:
        asyncio.run(_cleanup())
