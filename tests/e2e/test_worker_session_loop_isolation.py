"""Worker DB session loop-isolation regression (CODE_SPEC §8 / AC-CD7).

A 24h beat soak surfaced 6/7 scheduled Celery tasks repeatedly failing
with::

    asyncpg.InterfaceError: cannot perform operation: another
    operation is in progress

Root cause: each task wraps its domain coroutine in
``asyncio.run(_run())``. The pre-fix shape opened the session from
the API-side module-level pooled engine. ``asyncio.run`` tears down
its event loop on exit; the asyncpg connection survives in the pool
with protocol state bound to the torn-down loop; the next task's
``asyncio.run`` hands that connection to a fresh loop and asyncpg's
protocol-state check at transaction-start fires the error before any
SQL goes on the wire.

:func:`app.models.worker_session` builds a fresh ``NullPool`` engine
per call and disposes it on exit, so connection lifetime equals
session lifetime equals event-loop lifetime.

These tests run against the real Postgres service the
``migration-chain`` CI job spins up. The whole ``tests/e2e/`` subtree
is excluded from the default ``pytest -q`` run (the ``checks`` CI
job passes ``--ignore=tests/e2e``) so the AC-CD15 zero-network
contract for unit + integration tests is unaffected.
"""

from __future__ import annotations

import asyncio

import asyncpg
import pytest
from sqlalchemy import text


def test_worker_session_survives_back_to_back_asyncio_run() -> None:
    """Two successive ``asyncio.run`` invocations of ``worker_session``
    each complete cleanly. This is the production cron pattern: every
    beat tick is a fresh ``asyncio.run`` against the same Celery
    process. The pre-fix shape would have raised
    ``InterfaceError: cannot perform operation: another operation is
    in progress`` on the second call (see
    ``test_pooled_session_factory_reproduces_loop_binding_bug``).
    """
    from app.models import worker_session

    async def _round_trip() -> int:
        async with worker_session() as session:
            result = await session.execute(text("SELECT 1"))
            return int(result.scalar_one())

    assert asyncio.run(_round_trip()) == 1
    # If the engine + connection survived the first loop's teardown
    # this second call would re-trigger the live soak failure.
    assert asyncio.run(_round_trip()) == 1


def test_pooled_session_factory_reproduces_loop_binding_bug() -> None:
    """The abandoned ``_session_factory()()`` pattern raises on the
    second ``asyncio.run`` — pins the failure mode so any future
    regression that re-routes worker tasks through the pooled API-side
    factory trips immediately.

    The exact exception class depends on which asyncpg internal sees
    the loop mismatch first: the live 24h soak surfaced
    ``asyncpg.InterfaceError: cannot perform operation: another
    operation is in progress`` (asyncpg's protocol-state check at
    transaction-start), while a controlled back-to-back
    ``asyncio.run`` reproduction can surface ``RuntimeError`` from
    asyncio attaching a Future to the wrong loop. Both are symptoms
    of the same root cause (connection bound to a torn-down loop);
    accept either so the test pins the failure mode without
    over-specifying the visible manifestation.

    Clears the ``lru_cache`` first so a prior test in this module
    cannot have warmed an unrelated engine.
    """
    from app.models import _engine, _session_factory

    _session_factory.cache_clear()
    _engine.cache_clear()

    async def _round_trip() -> int:
        async with _session_factory()() as session:
            result = await session.execute(text("SELECT 1"))
            return int(result.scalar_one())

    assert asyncio.run(_round_trip()) == 1
    with pytest.raises((RuntimeError, asyncpg.InterfaceError)):
        asyncio.run(_round_trip())

    # Best-effort teardown so a following test cannot inherit a
    # half-broken pooled connection. The dispose itself runs on yet
    # another fresh loop and may raise on the same loop-binding
    # condition; the lru_cache clear after is what guarantees the
    # next caller gets a fresh engine regardless.
    async def _dispose() -> None:
        await _engine().dispose()

    try:
        asyncio.run(_dispose())
    except Exception:
        pass
    _session_factory.cache_clear()
    _engine.cache_clear()
