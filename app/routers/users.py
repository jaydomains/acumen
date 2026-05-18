"""users router — admin-creates-user (AC-D2).

No self-registration: every account is admin-created and assigned a
role at creation; the new user activates via the emailed setup link
(consumed in ``routers/auth.py``). CODE_SPEC §3 / §6, AC-D2 / AC-D10.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AppUser, get_db
from app.permissions import (
    ROLE_ADMINISTRATOR,
    APIError,
    SMTPClient,
    create_user,
    issue_setup_token,
    load_user_by_email,
    require_role,
    setup_email_content,
)
from app.schemas import AdminCreateUserRequest, UserResponse

router = APIRouter(prefix="/v1/users", tags=["users"])

_smtp = SMTPClient()
_require_admin = require_role(ROLE_ADMINISTRATOR)


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
