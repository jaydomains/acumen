"""P2: auth primitives — argon2id, JWT, tokens, email rule (AC-CD5).

Pure functions, no DB, no network (honours the AC-CD15 socket guard).
"""

from __future__ import annotations

import uuid

import pytest

from app import permissions as p


def test_password_hash_roundtrip() -> None:
    h = p.hash_password("correct horse battery staple")
    assert h.startswith("$argon2")
    assert p.verify_password(h, "correct horse battery staple") is True
    assert p.verify_password(h, "wrong") is False


def test_unusable_hash_never_verifies() -> None:
    assert p.UNUSABLE_PASSWORD_HASH == "!"
    assert p.verify_password(p.UNUSABLE_PASSWORD_HASH, "anything") is False
    # Constant-time path still returns a plain bool (no exception leak).
    assert p.verify_password("", "anything") is False


def test_jwt_roundtrip_and_type_separation() -> None:
    uid = str(uuid.uuid4())
    access = p.issue_access_token(uid, p.ROLE_ADMINISTRATOR)
    refresh = p.issue_refresh_token(uid, p.ROLE_TESTEE)

    a = p.decode_token(access, expected_type="access")
    assert a["sub"] == uid
    assert a["role"] == p.ROLE_ADMINISTRATOR
    assert a["type"] == "access"

    r = p.decode_token(refresh, expected_type="refresh")
    assert r["type"] == "refresh"

    # An access token must not pass as a refresh token and vice versa.
    with pytest.raises(p.TokenError):
        p.decode_token(access, expected_type="refresh")
    with pytest.raises(p.TokenError):
        p.decode_token(refresh, expected_type="access")


def test_jwt_tampered_and_expired() -> None:
    token = p.issue_access_token(str(uuid.uuid4()), p.ROLE_TESTEE)
    with pytest.raises(p.TokenError):
        p.decode_token(token + "x", expected_type="access")

    expired = jwt_with_past_exp()
    with pytest.raises(p.TokenError):
        p.decode_token(expired, expected_type="access")


def jwt_with_past_exp() -> str:
    import jwt

    from app.config import get_settings

    s = get_settings()
    return jwt.encode(
        {"sub": "x", "role": "testee", "type": "access", "exp": 1},
        s.jwt_secret,
        algorithm=s.jwt_algorithm,
    )


def test_token_mint_is_unique_and_hash_is_deterministic() -> None:
    raw1, h1 = p.mint_token()
    raw2, h2 = p.mint_token()
    assert raw1 != raw2
    assert h1 != h2
    assert p.hash_token(raw1) == h1
    assert len(h1) == 64  # sha256 hex


def test_token_usability_window() -> None:
    future = p.token_expiry(p.SETUP_TOKEN_TTL)
    past = p.now_utc().replace(year=2000)
    assert p._token_is_usable(None, future) is True
    assert p._token_is_usable(p.now_utc(), future) is False  # used
    assert p._token_is_usable(None, past) is False  # expired


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("  Admin@KBC.com ", "admin@kbc.com"),
        ("Testee@Example.COM", "testee@example.com"),
    ],
)
def test_normalise_email_ok(raw: str, expected: str) -> None:
    assert p.normalise_email(raw) == expected


@pytest.mark.parametrize("bad", ["no-at", "a@@b", "a b@c.com", "@x.com", "x@"])
def test_normalise_email_rejects(bad: str) -> None:
    with pytest.raises(ValueError):
        p.normalise_email(bad)


def test_roles_constants() -> None:
    assert p.VALID_ROLES == {p.ROLE_ADMINISTRATOR, p.ROLE_TESTEE}
    assert "deactivated" in p.DEACTIVATED_MESSAGE.lower()
