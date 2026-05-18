"""Pydantic v2 request/response models (CODE_SPEC §5 API contract).

P2 covers the auth + user-management surface. Email fields use the
light ``normalise_email`` rule from ``app.permissions`` rather than
``EmailStr`` so no unpinned ``email-validator`` dependency is added
(AC-CD1). A minimum password length is enforced here as a sane
default — the spec sets no password policy (AC-D10), so this is an
implementation choice, not spec drift.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.models import UserStatus
from app.permissions import VALID_ROLES, normalise_email

MIN_PASSWORD_LENGTH = 8

Email = Annotated[str, AfterValidator(normalise_email)]
Password = Annotated[str, Field(min_length=MIN_PASSWORD_LENGTH, max_length=1024)]


def _validate_role(value: str) -> str:
    if value not in VALID_ROLES:
        raise ValueError(f"role must be one of {sorted(VALID_ROLES)}")
    return value


Role = Annotated[str, AfterValidator(_validate_role)]


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --- Auth -------------------------------------------------------------


class LoginRequest(_Base):
    email: Email
    password: str


class TokenPair(_Base):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(_Base):
    refresh_token: str


class AccessToken(_Base):
    access_token: str
    token_type: str = "bearer"


class LogoutResponse(_Base):
    status: str = "ok"
    action: str = "discard_tokens"


class SetupConsumeRequest(_Base):
    token: str
    new_password: Password


class PasswordResetRequest(_Base):
    email: Email


class PasswordResetConsumeRequest(_Base):
    token: str
    new_password: Password


class MessageResponse(_Base):
    status: str = "ok"


class PrivacyAckResponse(_Base):
    status: str = "ok"
    privacy_ack_at: datetime


# --- Users ------------------------------------------------------------


class AdminCreateUserRequest(_Base):
    email: Email
    name: Annotated[str, Field(min_length=1, max_length=255)]
    role: Role


class UserResponse(_Base):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    email: str
    name: str
    role: str
    status: UserStatus
    privacy_ack_at: datetime | None
    created_at: datetime
