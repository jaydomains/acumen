"""Test configuration — no test may make a real network call (AC-CD15).

P0 installs the outbound-connect guard only. Full provider stubs
(Anthropic / OpenAI / Drive) land with the provider layer in P5.
In-process ASGI (Starlette TestClient) does not open sockets, so the
guard blocks ``socket.connect`` rather than socket creation.
"""

from __future__ import annotations

import socket

import pytest


@pytest.fixture(autouse=True)
def _no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def _blocked(*args: object, **kwargs: object) -> None:
        raise RuntimeError("network access is disabled in tests (AC-CD15)")

    monkeypatch.setattr(socket.socket, "connect", _blocked)
