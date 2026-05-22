"""users router — admin-creates-user + admin user-management
(AC-D2 / AC-D16).

No self-registration: every account is admin-created and assigned a
role at creation; the new user activates via the emailed setup link
(consumed in ``routers/auth.py``). Beyond create, this router carries
the list / read / update / deactivate / reactivate surface the admin
UI needs (SPEC §4.2 explicitly names role change + deactivate; email
change is intentionally out of v1 scope — create-then-deactivate is
the workflow per AC-D2). CODE_SPEC §3 / §6, AC-D2 / AC-D10 / AC-D16.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import users as users_domain
from app.domain.catalogue import (
    DEFAULT_PAGE_LIMIT,
    MAX_PAGE_LIMIT,
    record_audit,
)
from app.models import AppUser, UserStatus, get_db
from app.permissions import (
    ROLE_ADMINISTRATOR,
    VALID_ROLES,
    APIError,
    SMTPClient,
    create_user,
    issue_setup_token,
    load_user_by_email,
    load_user_by_id,
    require_role,
    setup_email_content,
)
from app.schemas import (
    AdminCreateUserRequest,
    Page,
    PageMeta,
    UserResponse,
    UserUpdate,
)

router = APIRouter(prefix="/v1/users", tags=["users"])

_smtp = SMTPClient()
_require_admin = require_role(ROLE_ADMINISTRATOR)


def _user_not_found() -> APIError:
    return APIError(404, "user_not_found", "User not found.")


@router.post("", status_code=201)
async def admin_create_user(
    body: AdminCreateUserRequest,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    if await load_user_by_email(db, body.email) is not None:
        raise APIError(409, "email_exists", "A user with this email already exists.")
    user = await create_user(db, email=body.email, name=body.name, role=body.role)
    raw = await issue_setup_token(db, user)
    await db.commit()
    subject, text = setup_email_content(raw)
    _smtp.send(user.email, subject, text)
    return UserResponse.model_validate(user)


@router.get("")
async def list_users(
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=DEFAULT_PAGE_LIMIT, ge=1, le=MAX_PAGE_LIMIT),
    role: str | None = Query(default=None),
    status: UserStatus | None = Query(default=None),
) -> Page[UserResponse]:
    if role is not None and role not in VALID_ROLES:
        raise APIError(
            422,
            "invalid_role",
            f"role must be one of {sorted(VALID_ROLES)}",
        )
    rows, next_cursor = await users_domain.list_users(
        db, role=role, status=status, cursor=cursor, limit=limit
    )
    return Page[UserResponse](
        data=[UserResponse.model_validate(u) for u in rows],
        meta=PageMeta(next_cursor=next_cursor),
    )


@router.get("/{user_id}")
async def get_user(
    user_id: uuid.UUID,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = await load_user_by_id(db, user_id)
    if user is None:
        raise _user_not_found()
    return UserResponse.model_validate(user)


@router.patch("/{user_id}")
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    # Self-role-change guard mirrors the self-deactivation guard below:
    # self-demotion locks the admin out at next token refresh, so the
    # backend refuses the change. Name-only self-PATCH is allowed.
    if user_id == admin.id and body.role is not None and body.role != ROLE_ADMINISTRATOR:
        raise APIError(
            409,
            "self_role_change_blocked",
            "Administrators cannot change their own role.",
        )
    user = await load_user_by_id(db, user_id)
    if user is None:
        raise _user_not_found()
    fields = body.model_dump(exclude_unset=True)
    user, changed = await users_domain.update_user(db, user, fields=fields)
    if changed:
        await record_audit(
            db,
            actor_id=admin.id,
            action="user.update",
            target_entity="user",
            target_id=user.id,
            detail={"changed_fields": sorted(changed)},
        )
    await db.commit()
    return UserResponse.model_validate(user)


@router.post("/{user_id}/deactivate")
async def deactivate_user(
    user_id: uuid.UUID,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    if user_id == admin.id:
        raise APIError(
            409,
            "self_deactivation_blocked",
            "Administrators cannot deactivate themselves.",
        )
    user = await load_user_by_id(db, user_id)
    if user is None:
        raise _user_not_found()
    user, changed = await users_domain.deactivate_user(db, user)
    if changed:
        await record_audit(
            db,
            actor_id=admin.id,
            action="user.deactivate",
            target_entity="user",
            target_id=user.id,
        )
    await db.commit()
    return UserResponse.model_validate(user)


@router.post("/{user_id}/reactivate")
async def reactivate_user(
    user_id: uuid.UUID,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = await load_user_by_id(db, user_id)
    if user is None:
        raise _user_not_found()
    user, changed = await users_domain.reactivate_user(db, user)
    if changed:
        await record_audit(
            db,
            actor_id=admin.id,
            action="user.reactivate",
            target_entity="user",
            target_id=user.id,
        )
    await db.commit()
    return UserResponse.model_validate(user)
