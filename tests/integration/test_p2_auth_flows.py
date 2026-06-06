"""P2 done-when (ROADMAP): admin-creates-user -> setup link -> login
-> role-gated route reached; deactivated rejected; unacknowledged-
privacy blocked; token expiry; password-reset round-trip.

Zero-DB / zero-network via the fake session + dependency override in
``conftest.py`` (AC-CD15). AC-D2 / AC-D10 / AC-D16 / AC-CD5.
"""

from __future__ import annotations

import re

import jwt
import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.config import get_settings
from tests.integration.conftest import FakeSession, bearer, make_user

# AC-CD5 link contract (Slice 1 / audit C1): setup/reset links carry the
# token as the final PATH segment (``/<flow>/{token}``), not a query string.
_TOKEN_RE = re.compile(r"/(?:setup|reset)/([^\s/]+)")


def _token_from_last_email() -> str:
    emails = p.captured_emails()
    assert emails, "expected a captured (fail-soft) email"
    m = _TOKEN_RE.search(emails[-1].body)
    assert m, "no token in email body"
    return m.group(1)


def test_done_when_admin_creates_user_setup_login_role_gate(
    client: TestClient, session: FakeSession
) -> None:
    admin = make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)

    # Admin reaches the role-gated route and creates a Testee (AC-D2).
    r = client.post(
        "/v1/users",
        headers=bearer(admin),
        json={"email": "tess@kbc.com", "name": "Tess", "role": "testee"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["email"] == "tess@kbc.com"
    assert body["role"] == "testee"
    assert body["status"] == "active"
    assert body["privacy_ack_at"] is None

    # Setup link emailed -> consume -> password set (AC-D10).
    token = _token_from_last_email()
    r = client.post(
        "/v1/auth/setup/consume",
        json={"token": token, "new_password": "Sup3rSecret!"},
    )
    assert r.status_code == 200, r.text

    # Login works with the new password.
    r = client.post(
        "/v1/auth/login",
        json={"email": "tess@kbc.com", "password": "Sup3rSecret!"},
    )
    assert r.status_code == 200, r.text
    tokens = r.json()
    assert tokens["token_type"] == "bearer"
    testee_auth = {"Authorization": f"Bearer {tokens['access_token']}"}

    # The privacy gate precedes the role gate: an un-acked Testee is
    # blocked by privacy first (AC-D16).
    r = client.post(
        "/v1/users",
        headers=testee_auth,
        json={"email": "x@kbc.com", "name": "X", "role": "testee"},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "privacy_not_acknowledged"

    # After acknowledging, the role gate is what now blocks the Testee
    # from the admin-only route (AC-D2).
    assert (
        client.post("/v1/auth/privacy/acknowledge", headers=testee_auth).status_code
        == 200
    )
    r = client.post(
        "/v1/users",
        headers=testee_auth,
        json={"email": "x@kbc.com", "name": "X", "role": "testee"},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "forbidden"


def test_setup_token_is_one_time(client: TestClient, session: FakeSession) -> None:
    admin = make_user(session, email="a@kbc.com", role=p.ROLE_ADMINISTRATOR)
    client.post(
        "/v1/users",
        headers=bearer(admin),
        json={"email": "u@kbc.com", "name": "U", "role": "testee"},
    )
    token = _token_from_last_email()
    first = client.post(
        "/v1/auth/setup/consume",
        json={"token": token, "new_password": "Password123"},
    )
    assert first.status_code == 200
    second = client.post(
        "/v1/auth/setup/consume",
        json={"token": token, "new_password": "Password456"},
    )
    assert second.status_code == 400
    assert second.json()["error"]["code"] == "invalid_token"


def test_deactivated_user_login_rejected(
    client: TestClient, session: FakeSession
) -> None:
    make_user(
        session,
        email="gone@kbc.com",
        role=p.ROLE_TESTEE,
        password="StillKnown1",
        deactivated=True,
    )
    r = client.post(
        "/v1/auth/login",
        json={"email": "gone@kbc.com", "password": "StillKnown1"},
    )
    assert r.status_code == 403
    err = r.json()["error"]
    assert err["code"] == "account_deactivated"
    assert err["message"] == p.DEACTIVATED_MESSAGE


def test_privacy_gate_blocks_then_clears(
    client: TestClient, session: FakeSession
) -> None:
    admin = make_user(
        session,
        email="newadmin@kbc.com",
        role=p.ROLE_ADMINISTRATOR,
        privacy_acked=False,
    )

    # Privacy-acknowledgement gate blocks the protected route (AC-D16).
    r = client.post(
        "/v1/users",
        headers=bearer(admin),
        json={"email": "a@kbc.com", "name": "A", "role": "testee"},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "privacy_not_acknowledged"

    # Acknowledging clears the gate (active user, not privacy-gated).
    r = client.post("/v1/auth/privacy/acknowledge", headers=bearer(admin))
    assert r.status_code == 200
    assert r.json()["privacy_ack_at"] is not None

    r = client.post(
        "/v1/users",
        headers=bearer(admin),
        json={"email": "a@kbc.com", "name": "A", "role": "testee"},
    )
    assert r.status_code == 201, r.text


def test_expired_token_rejected(client: TestClient, session: FakeSession) -> None:
    make_user(session, email="adm@kbc.com", role=p.ROLE_ADMINISTRATOR)
    s = get_settings()
    expired = jwt.encode(
        {"sub": "x", "role": p.ROLE_ADMINISTRATOR, "type": "access", "exp": 1},
        s.jwt_secret,
        algorithm=s.jwt_algorithm,
    )
    r = client.post(
        "/v1/users",
        headers={"Authorization": f"Bearer {expired}"},
        json={"email": "a@kbc.com", "name": "A", "role": "testee"},
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "invalid_token"


def test_refresh_round_trip(client: TestClient, session: FakeSession) -> None:
    make_user(
        session,
        email="adm@kbc.com",
        role=p.ROLE_ADMINISTRATOR,
        password="AdminPass1",
    )
    r = client.post(
        "/v1/auth/login",
        json={"email": "adm@kbc.com", "password": "AdminPass1"},
    )
    refresh = r.json()["refresh_token"]

    r = client.post("/v1/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 200
    new_access = r.json()["access_token"]

    # The refreshed access token authorises the role-gated route.
    r = client.post(
        "/v1/users",
        headers={"Authorization": f"Bearer {new_access}"},
        json={"email": "fresh@kbc.com", "name": "Fresh", "role": "testee"},
    )
    assert r.status_code == 201, r.text

    # An access token is not accepted at the refresh endpoint.
    r = client.post("/v1/auth/refresh", json={"refresh_token": new_access})
    assert r.status_code == 401


def test_logout_is_stateless_contract(client: TestClient) -> None:
    r = client.post("/v1/auth/logout")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "action": "discard_tokens"}


def test_password_reset_round_trip(client: TestClient, session: FakeSession) -> None:
    make_user(
        session,
        email="user@kbc.com",
        role=p.ROLE_TESTEE,
        password="OldPass123",
    )

    # Unknown email still returns 200 and emits nothing (no enumeration).
    r = client.post(
        "/v1/auth/password-reset/request",
        json={"email": "nobody@kbc.com"},
    )
    assert r.status_code == 200
    assert p.captured_emails() == []

    r = client.post("/v1/auth/password-reset/request", json={"email": "user@kbc.com"})
    assert r.status_code == 200
    token = _token_from_last_email()

    r = client.post(
        "/v1/auth/password-reset/consume",
        json={"token": token, "new_password": "BrandNew99"},
    )
    assert r.status_code == 200

    # Old password no longer works; new one does.
    assert (
        client.post(
            "/v1/auth/login",
            json={"email": "user@kbc.com", "password": "OldPass123"},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/v1/auth/login",
            json={"email": "user@kbc.com", "password": "BrandNew99"},
        ).status_code
        == 200
    )

    # The reset token is one-time.
    r = client.post(
        "/v1/auth/password-reset/consume",
        json={"token": token, "new_password": "Another111"},
    )
    assert r.status_code == 400


def test_login_invalid_credentials(client: TestClient, session: FakeSession) -> None:
    make_user(session, email="real@kbc.com", role=p.ROLE_TESTEE, password="RealPass1")
    # Wrong password.
    r = client.post(
        "/v1/auth/login",
        json={"email": "real@kbc.com", "password": "nope-nope"},
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "invalid_credentials"
    # Unknown email (constant-time path, same response).
    r = client.post(
        "/v1/auth/login",
        json={"email": "ghost@kbc.com", "password": "whatever1"},
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "invalid_credentials"


def test_admin_create_duplicate_email_conflicts(
    client: TestClient, session: FakeSession
) -> None:
    admin = make_user(session, email="ad@kbc.com", role=p.ROLE_ADMINISTRATOR)
    make_user(session, email="dup@kbc.com", role=p.ROLE_TESTEE)
    r = client.post(
        "/v1/users",
        headers=bearer(admin),
        json={"email": "dup@kbc.com", "name": "Dup", "role": "testee"},
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "email_exists"


def test_unauthenticated_protected_route(client: TestClient) -> None:
    r = client.post(
        "/v1/users",
        json={"email": "a@kbc.com", "name": "A", "role": "testee"},
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "not_authenticated"


@pytest.mark.parametrize("bad_role", ["owner", "ADMIN", "superuser", ""])
def test_admin_create_rejects_unknown_role(
    client: TestClient, session: FakeSession, bad_role: str
) -> None:
    admin = make_user(session, email="ad2@kbc.com", role=p.ROLE_ADMINISTRATOR)
    r = client.post(
        "/v1/users",
        headers=bearer(admin),
        json={"email": "z@kbc.com", "name": "Z", "role": bad_role},
    )
    assert r.status_code == 422  # schema validation rejects the role
