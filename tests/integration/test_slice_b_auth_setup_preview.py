"""Slice B B.1 — GET /v1/auth/setup/{token}/preview integration tests.

Happy path returns the invitee's email; missing / expired / used
tokens all map to ``400 invalid_token`` (same opacity as POST
/setup/consume — the email leaks nothing the holder of a valid token
didn't already have)."""

from __future__ import annotations

import re
from datetime import timedelta

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import AccountSetupToken
from tests.integration.conftest import FakeSession, bearer, make_user

# AC-CD5 link contract (Slice 1 / audit C1): the token is the final PATH
# segment (``/<flow>/{token}``), not a query string.
_TOKEN_RE = re.compile(r"/(?:setup|reset)/([^\s/]+)")


def _token_from_last_email() -> str:
    emails = p.captured_emails()
    assert emails, "expected a fail-soft captured email"
    m = _TOKEN_RE.search(emails[-1].body)
    assert m, "no token in email body"
    return m.group(1)


def test_preview_returns_email_for_valid_token(
    client: TestClient, session: FakeSession
) -> None:
    admin = make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)
    r = client.post(
        "/v1/users",
        headers=bearer(admin),
        json={"email": "tess@kbc.com", "name": "Tess", "role": "testee"},
    )
    assert r.status_code == 201
    token = _token_from_last_email()

    r = client.get(f"/v1/auth/setup/{token}/preview")
    assert r.status_code == 200, r.text
    assert r.json() == {"email": "tess@kbc.com"}


def test_preview_400_for_unknown_token(client: TestClient) -> None:
    r = client.get("/v1/auth/setup/not-a-real-token/preview")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "invalid_token"


def test_preview_400_for_consumed_token(client: TestClient, session: FakeSession) -> None:
    admin = make_user(session, email="admin2@kbc.com", role=p.ROLE_ADMINISTRATOR)
    client.post(
        "/v1/users",
        headers=bearer(admin),
        json={"email": "u@kbc.com", "name": "U", "role": "testee"},
    )
    token = _token_from_last_email()

    consume = client.post(
        "/v1/auth/setup/consume",
        json={"token": token, "new_password": "Password123"},
    )
    assert consume.status_code == 200

    r = client.get(f"/v1/auth/setup/{token}/preview")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "invalid_token"


def test_preview_400_for_expired_token(client: TestClient, session: FakeSession) -> None:
    user = make_user(session, email="exp@kbc.com", role=p.ROLE_TESTEE)
    # Seed an expired token directly (avoid the admin-create email path).
    raw = "expired-raw-token"
    session.add(
        AccountSetupToken(
            tenant_id=p.SEED_TENANT_ID,
            user_id=user.id,
            token_hash=p.hash_token(raw),
            expires_at=p.now_utc() - timedelta(minutes=1),
        )
    )

    r = client.get(f"/v1/auth/setup/{raw}/preview")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "invalid_token"
