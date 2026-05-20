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


# --- P3 catalogue harness ---------------------------------------------
# The P2 ``FakeSession`` only does ``scalar_one_or_none`` over a single
# equality ``where``. The catalogue domain layer also needs
# ``scalars().all()`` and ``delete()``. ``CatalogueFakeSession`` adds
# exactly that — still equality-only AND ``where`` (the domain layer
# does ordering / filtering / pagination in Python by design), so it
# stays zero-DB / zero-network (AC-CD15). The P2 fake is untouched.


class _CatResult:
    def __init__(self, rows: list[Any]) -> None:
        self._rows = rows

    def scalar_one_or_none(self) -> Any | None:
        return self._rows[0] if self._rows else None

    def scalars(self) -> _CatResult:
        return self

    def all(self) -> list[Any]:
        return list(self._rows)


class CatalogueFakeSession:
    def __init__(self) -> None:
        self.store: dict[type, list[Any]] = {}

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

    async def rollback(self) -> None:
        # The P4 attempt-start path catches ``IntegrityError`` on the
        # ``(test_id, testee_id, sequence_number)`` unique constraint
        # and rolls back before retrying. The fake is a noop because
        # the retry test inserts/removes the failing row explicitly.
        return None

    async def delete(self, obj: Any) -> None:
        bucket = self.store.get(type(obj), [])
        if obj in bucket:
            bucket.remove(obj)

    async def execute(self, stmt: Any) -> _CatResult:
        model = stmt.column_descriptions[0]["entity"]
        clause = stmt.whereclause
        parts = getattr(clause, "clauses", [clause]) if clause is not None else []
        conds = {c.left.key: c.right.value for c in parts}
        rows = [
            r
            for r in self.store.get(model, [])
            if all(getattr(r, k) == v for k, v in conds.items())
        ]
        return _CatResult(rows)


# v1.3 default safety keyword list (mirrors the ``system_settings``
# server_default seeded by migration 0002).
DEFAULT_SAFETY_KEYWORDS = [
    "lift",
    "scaffold",
    "asbestos",
    "isocyanate",
    "cathodic",
    "confined space",
    "fall",
    "PPE",
    "high voltage",
    "hot work",
    "fire",
    "electrical",
    "hazardous",
    "toxic",
]


def seed_system_settings(
    session: CatalogueFakeSession,
    *,
    safety_keywords: list[str] | None = None,
) -> None:
    from app.models import SystemSettings

    session.add(
        SystemSettings(
            tenant_id=p.SEED_TENANT_ID,
            safety_keyword_list=(
                DEFAULT_SAFETY_KEYWORDS if safety_keywords is None else safety_keywords
            ),
        )
    )


def cat_make_user(session: CatalogueFakeSession, *, email: str, role: str) -> AppUser:
    from app.models import UserStatus

    user = AppUser(
        tenant_id=p.SEED_TENANT_ID,
        email=email,
        name=email.split("@")[0],
        role=role,
        password_hash=p.UNUSABLE_PASSWORD_HASH,
        status=UserStatus.active,
    )
    user.privacy_ack_at = p.now_utc()
    session.add(user)
    return user


@pytest.fixture
def cat_session() -> CatalogueFakeSession:
    return CatalogueFakeSession()


@pytest.fixture
def cat_client(cat_session: CatalogueFakeSession) -> Iterator[TestClient]:
    async def _override() -> AsyncIterator[CatalogueFakeSession]:
        yield cat_session

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
