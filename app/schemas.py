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
from typing import Annotated, Generic, TypeVar

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

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


# --- Catalogue (P3): Subjects / Pills / Paths / Groups ----------------
# CODE_SPEC §5: collections return {"data": [...], "meta": {...}} with
# cursor pagination; the error envelope is the APIError handler.

MIN_DIFFICULTY = 1
MAX_DIFFICULTY = 10

Name = Annotated[str, Field(min_length=1, max_length=255)]
ItemT = TypeVar("ItemT")


class PageMeta(_Base):
    next_cursor: str | None = None


class Page(_Base, Generic[ItemT]):
    data: list[ItemT]
    meta: PageMeta


class SubjectCreate(_Base):
    name: Name
    description: Annotated[str, Field(max_length=2048)] | None = None


class SubjectUpdate(_Base):
    name: Name | None = None
    description: Annotated[str, Field(max_length=2048)] | None = None


class SubjectResponse(_Base):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class _DifficultyRange(_Base):
    @model_validator(mode="after")
    def _check_range(self) -> _DifficultyRange:
        lo = getattr(self, "available_difficulty_min", None)
        hi = getattr(self, "available_difficulty_max", None)
        if lo is not None and hi is not None and lo > hi:
            raise ValueError(
                "available_difficulty_min must be <= available_difficulty_max"
            )
        return self


Difficulty = Annotated[int, Field(ge=MIN_DIFFICULTY, le=MAX_DIFFICULTY)]


class PillCreate(_DifficultyRange):
    subject_id: uuid.UUID
    name: Name
    description: Annotated[str, Field(max_length=4096)] | None = None
    available_difficulty_min: Difficulty
    available_difficulty_max: Difficulty
    discoverable: bool = True
    estimated_minutes: Annotated[int, Field(ge=1, le=100000)] | None = None


class PillUpdate(_DifficultyRange):
    name: Name | None = None
    description: Annotated[str, Field(max_length=4096)] | None = None
    available_difficulty_min: Difficulty | None = None
    available_difficulty_max: Difficulty | None = None
    discoverable: bool | None = None
    estimated_minutes: Annotated[int, Field(ge=1, le=100000)] | None = None


class PillSafetyOverride(_Base):
    safety_relevant: bool


class PillResponse(_Base):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    subject_id: uuid.UUID
    name: str
    description: str | None
    available_difficulty_min: int
    available_difficulty_max: int
    discoverable: bool
    safety_relevant: bool
    safety_relevant_overridden_at: datetime | None
    estimated_minutes: int | None
    retired_at: datetime | None
    created_at: datetime
    updated_at: datetime


class LearningPathCreate(_Base):
    name: Name
    description: Annotated[str, Field(max_length=2048)] | None = None
    pill_ids: list[uuid.UUID] = Field(default_factory=list)


class LearningPathUpdate(_Base):
    name: Name | None = None
    description: Annotated[str, Field(max_length=2048)] | None = None
    pill_ids: list[uuid.UUID] | None = None


class LearningPathResponse(_Base):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    name: str
    description: str | None
    is_private: bool
    owner_user_id: uuid.UUID | None
    pill_ids: list[uuid.UUID]
    created_at: datetime
    updated_at: datetime


class GroupCreate(_Base):
    name: Name
    description: Annotated[str, Field(max_length=1024)] | None = None


class GroupUpdate(_Base):
    name: Name | None = None
    description: Annotated[str, Field(max_length=1024)] | None = None


class GroupMemberRequest(_Base):
    user_id: uuid.UUID


class GroupResponse(_Base):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    name: str
    description: str | None
    is_system: bool
    member_ids: list[uuid.UUID]
    created_at: datetime
    updated_at: datetime


class PillProposalResponse(_Base):
    id: uuid.UUID
    status: str
    payload: dict | None
    created_at: datetime
