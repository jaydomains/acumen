"""GET /v1/auth/me — current-user endpoint (AC-D2 / AC-D16).

Reached by any logged-in user including pre-privacy-ack ones, so the
frontend can drive the privacy gate UI from ``privacy_ack_at: null``
in the response. The deactivation gate still rejects deactivated
bearers — once deactivated, a user cannot reach the endpoint.

Zero-DB / zero-network via the fake session + dependency override in
``conftest.py`` (AC-CD15).
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app import permissions as p
from tests.integration.conftest import FakeSession, bearer, make_user


def test_me_returns_current_user(client: TestClient, session: FakeSession) -> None:
    testee = make_user(session, email="t@kbc.com", role=p.ROLE_TESTEE)

    r = client.get("/v1/auth/me", headers=bearer(testee))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["email"] == "t@kbc.com"
    assert body["role"] == "testee"
    assert body["status"] == "active"
    assert body["privacy_ack_at"] is not None


def test_me_works_without_privacy_ack(client: TestClient, session: FakeSession) -> None:
    # The whole point of /v1/auth/me: the frontend uses the returned
    # ``privacy_ack_at: null`` to render the privacy-acknowledgement
    # gate. If the privacy gate were applied here, the frontend would
    # have no way to discover that it needs to render the gate.
    user = make_user(
        session, email="newbie@kbc.com", role=p.ROLE_TESTEE, privacy_acked=False
    )

    r = client.get("/v1/auth/me", headers=bearer(user))
    assert r.status_code == 200, r.text
    assert r.json()["privacy_ack_at"] is None


def test_me_rejects_deactivated(client: TestClient, session: FakeSession) -> None:
    user = make_user(session, email="gone@kbc.com", role=p.ROLE_TESTEE, deactivated=True)

    r = client.get("/v1/auth/me", headers=bearer(user))
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "account_deactivated"


def test_me_rejects_unauthenticated(client: TestClient) -> None:
    r = client.get("/v1/auth/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "not_authenticated"
