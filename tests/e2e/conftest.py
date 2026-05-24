"""E2E test harness — real-infrastructure subtree (CODE_SPEC §15).

The top-level :mod:`tests.conftest` blocks all socket ``connect`` calls
under AC-CD15 so unit/integration tests cannot reach the network. The
e2e subtree exists to exercise the few paths that require real
infrastructure (today: the worker DB session helper's loop-isolation
guarantee, which can only be proven against a real asyncpg
connection). Pytest fixture-override semantics let a closer
``conftest`` neutralise a parent autouse fixture for its own subtree
without loosening the AC-CD15 guard anywhere else.
"""

from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _no_network() -> None:
    """Override :func:`tests.conftest._no_network` for the e2e subtree.

    Returning ``None`` (instead of monkeypatching ``socket.connect``)
    leaves real network calls available — required for the e2e tests
    that talk to the CI Postgres service. The parent guard remains in
    force for ``tests/unit`` and ``tests/integration``.
    """
    return None
