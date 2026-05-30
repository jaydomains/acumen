"""groups router — Groups for bulk assignment + reporting (AC-D15).

Admin-managed groups + membership. The three seeded system groups
(``is_system=true``: All Users / All Testees / All Administrators) are
immutable — rename, delete, and membership mutation are rejected; their
membership is rule-derived, not stored (resolved when assignment
targeting lands in P4). Persistence lives in ``app.domain.catalogue``.
CODE_SPEC §3. (pending P3 -> built P3)
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import catalogue
from app.domain import users as users_domain
from app.models import AppUser, Group, get_db
from app.permissions import ROLE_ADMINISTRATOR, APIError, require_role
from app.schemas import (
    GroupCreate,
    GroupMemberRequest,
    GroupResponse,
    GroupUpdate,
    Page,
    PageMeta,
    UserResponse,
)

router = APIRouter(prefix="/v1/groups", tags=["groups"])

_require_admin = require_role(ROLE_ADMINISTRATOR)
_DEFAULT_LIMIT = catalogue.DEFAULT_PAGE_LIMIT
_MAX_LIMIT = catalogue.MAX_PAGE_LIMIT


def _response(group: Group, member_ids: list[uuid.UUID]) -> GroupResponse:
    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        is_system=group.is_system,
        member_ids=member_ids,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


def _guard_mutable(group: Group) -> None:
    if group.is_system:
        raise APIError(
            403,
            "system_group_immutable",
            "System-defined groups cannot be modified.",
        )


async def _load(db: AsyncSession, group_id: uuid.UUID) -> tuple[Group, list[uuid.UUID]]:
    found = await catalogue.get_group(db, group_id)
    if found is None:
        raise APIError(404, "not_found", "Group not found.")
    return found


@router.post("", status_code=201)
async def create_group(
    body: GroupCreate,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> GroupResponse:
    group = await catalogue.create_group(
        db, name=body.name, description=body.description, actor_id=admin.id
    )
    await db.commit()
    return _response(group, [])


@router.get("")
async def list_groups(
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
) -> Page[GroupResponse]:
    rows, next_cursor, count = await catalogue.list_groups(db, cursor=cursor, limit=limit)
    return Page[GroupResponse](
        data=[_response(g, ids) for g, ids in rows],
        meta=PageMeta(next_cursor=next_cursor, count=count),
    )


@router.get("/{group_id}")
async def get_group(
    group_id: uuid.UUID,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> GroupResponse:
    group, member_ids = await _load(db, group_id)
    return _response(group, member_ids)


@router.patch("/{group_id}")
async def update_group(
    group_id: uuid.UUID,
    body: GroupUpdate,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> GroupResponse:
    group, _ = await _load(db, group_id)
    _guard_mutable(group)
    group, member_ids = await catalogue.update_group(
        db, group, body.model_dump(exclude_unset=True)
    )
    await db.commit()
    return _response(group, member_ids)


@router.delete("/{group_id}", status_code=204, response_class=Response)
async def delete_group(
    group_id: uuid.UUID,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    group, _ = await _load(db, group_id)
    _guard_mutable(group)
    await catalogue.delete_group(db, group)
    await db.commit()
    return Response(status_code=204)


@router.get("/{group_id}/members")
async def list_group_members(
    group_id: uuid.UUID,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
) -> Page[UserResponse]:
    # Reads resolve membership for any group (system groups included);
    # only mutation is gated by ``_guard_mutable``. ``_load`` 404s on an
    # unknown group and hands us the resolved member ids.
    _group, member_ids = await _load(db, group_id)
    rows, next_cursor, count = await users_domain.list_group_members(
        db, member_ids=member_ids, cursor=cursor, limit=limit
    )
    return Page[UserResponse](
        data=[UserResponse.model_validate(u) for u in rows],
        meta=PageMeta(next_cursor=next_cursor, count=count),
    )


@router.post("/{group_id}/members", status_code=201)
async def add_member(
    group_id: uuid.UUID,
    body: GroupMemberRequest,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> GroupResponse:
    group, _ = await _load(db, group_id)
    _guard_mutable(group)
    member_ids = await catalogue.add_group_member(db, group, body.user_id)
    await db.commit()
    return _response(group, member_ids)


@router.delete("/{group_id}/members/{user_id}")
async def remove_member(
    group_id: uuid.UUID,
    user_id: uuid.UUID,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> GroupResponse:
    group, _ = await _load(db, group_id)
    _guard_mutable(group)
    member_ids = await catalogue.remove_group_member(db, group, user_id)
    await db.commit()
    return _response(group, member_ids)
