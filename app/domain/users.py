"""Admin user-management persistence/query (AC-D2 / AC-D16).

Separate from the auth seam (``app/permissions.py``) so the SiteMesh
Auth Hub port replaces auth only — admin user CRUD is an Acumen
responsibility either side of the port. Mirrors the
``app/domain/catalogue.py`` shape: thin functions, equality-only
``where`` clauses, in-Python filter/paginate via the catalogue
``paginate`` helper so the existing zero-DB ``FakeSession``
(tests/integration/conftest.py) keeps working without growing a
richer query parser. CODE_SPEC §3 (additive domain module, structure-
gate unaffected; matches the ``catalogue.py`` precedent).
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.catalogue import paginate
from app.models import SEED_TENANT_ID, AppUser, UserStatus
from app.permissions import now_utc


async def _tenant_users(db: AsyncSession) -> list[AppUser]:
    result = await db.execute(select(AppUser).where(AppUser.tenant_id == SEED_TENANT_ID))
    return list(result.scalars().all())


async def list_users(
    db: AsyncSession,
    *,
    role: str | None,
    status: UserStatus | None,
    cursor: str | None,
    limit: int,
) -> tuple[list[AppUser], str | None, int]:
    rows = await _tenant_users(db)
    if role is not None:
        rows = [u for u in rows if u.role == role]
    if status is not None:
        rows = [u for u in rows if u.status == status]
    return paginate(rows, cursor, limit)


async def list_group_members(
    db: AsyncSession,
    *,
    member_ids: list[uuid.UUID],
    cursor: str | None,
    limit: int,
) -> tuple[list[AppUser], str | None, int]:
    """Resolve a group's member ids to ``AppUser`` rows, paginated.

    Backs ``GET /v1/groups/{group_id}/members`` (N2): the router supplies
    the membership ids already resolved by ``catalogue.get_group`` so this
    stays a thin user-domain query that reuses the same in-Python
    filter/paginate path as ``list_users``.
    """
    ids = set(member_ids)
    rows = [u for u in await _tenant_users(db) if u.id in ids]
    return paginate(rows, cursor, limit)


async def update_user(
    db: AsyncSession,
    user: AppUser,
    *,
    fields: dict[str, Any],
) -> tuple[AppUser, list[str]]:
    """Apply only the provided fields; return (user, changed_field_names).

    ``changed_field_names`` is the subset of supplied fields whose new
    value differs from the existing one — the router uses this to skip
    an audit row when a PATCH is a no-op (matches the deactivate /
    reactivate audit-on-transition pattern below).
    """
    changed: list[str] = []
    for key, value in fields.items():
        if getattr(user, key) != value:
            setattr(user, key, value)
            changed.append(key)
    if changed:
        await db.flush()
    return user, changed


async def deactivate_user(db: AsyncSession, user: AppUser) -> tuple[AppUser, bool]:
    """Idempotent: already-deactivated returns ``(user, False)``."""
    if user.status == UserStatus.deactivated:
        return user, False
    user.status = UserStatus.deactivated
    user.status_changed_at = now_utc()
    await db.flush()
    return user, True


async def reactivate_user(db: AsyncSession, user: AppUser) -> tuple[AppUser, bool]:
    """Idempotent: already-active returns ``(user, False)``."""
    if user.status == UserStatus.active:
        return user, False
    user.status = UserStatus.active
    user.status_changed_at = now_utc()
    await db.flush()
    return user, True


__all__ = [
    "deactivate_user",
    "list_users",
    "reactivate_user",
    "update_user",
]
