"""P2 integration harness — zero-DB, zero-network (AC-CD15).

A minimal in-memory stand-in for ``AsyncSession`` supporting exactly
the query/mutation surface the auth seam uses (``select(Model).where(
col == value, ...)``, ``add``/``flush``/``commit``/``refresh``). The
``get_db`` dependency is overridden so no engine is ever built and no
socket is opened. SMTP is unconfigured by default, so the seam's
fail-soft capture (``captured_emails``) is the email test seam.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator, Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.main import app
from app.models import AppUser, get_db


class _Result:
    def __init__(self, rows: list[Any]) -> None:
        self._rows = rows

    def scalar_one_or_none(self) -> Any | None:
        if not self._rows:
            return None
        return self._rows[0]


class FakeSession:
    """In-memory session keyed by model class."""

    def __init__(self) -> None:
        self.store: dict[type, list[Any]] = {}

    # --- write side ---
    def add(self, obj: Any) -> None:
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()
        now = p.now_utc()
        if getattr(obj, "created_at", None) is None:
            obj.created_at = now
        if getattr(obj, "updated_at", None) is None:
            obj.updated_at = now
        self.store.setdefault(type(obj), []).append(obj)

    async def flush(self) -> None:
        return None

    async def commit(self) -> None:
        return None

    async def refresh(self, obj: Any) -> None:
        return None

    # --- read side ---
    async def execute(self, stmt: Any) -> _Result:
        model = stmt.column_descriptions[0]["entity"]
        clause = stmt.whereclause
        parts = getattr(clause, "clauses", [clause]) if clause is not None else []
        conds = {c.left.key: c.right.value for c in parts}
        rows = [
            r
            for r in self.store.get(model, [])
            if all(getattr(r, k) == v for k, v in conds.items())
        ]
        return _Result(rows)


@pytest.fixture
def session() -> FakeSession:
    return FakeSession()


@pytest.fixture
def client(session: FakeSession) -> Iterator[TestClient]:
    async def _override() -> AsyncIterator[FakeSession]:
        yield session

    app.dependency_overrides[get_db] = _override
    p.clear_captured_emails()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    p.clear_captured_emails()


def make_user(
    session: FakeSession,
    *,
    email: str,
    role: str,
    password: str | None = None,
    privacy_acked: bool = True,
    deactivated: bool = False,
) -> AppUser:
    """Seed a persisted user directly in the fake store."""
    from app.models import UserStatus

    user = AppUser(
        tenant_id=p.SEED_TENANT_ID,
        email=email,
        name=email.split("@")[0],
        role=role,
        password_hash=(
            p.hash_password(password)
            if password is not None
            else p.UNUSABLE_PASSWORD_HASH
        ),
        status=UserStatus.deactivated if deactivated else UserStatus.active,
    )
    if privacy_acked:
        user.privacy_ack_at = p.now_utc()
    session.add(user)
    return user


def bearer(user: AppUser) -> dict[str, str]:
    token = p.issue_access_token(str(user.id), user.role)
    return {"Authorization": f"Bearer {token}"}
