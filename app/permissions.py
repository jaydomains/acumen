"""Auth primitives + role/deactivation/privacy gates — Auth Hub seam.

This file is the non-router half of the AC-CD5 port seam (the other
half is ``app/routers/auth.py``). It holds every auth primitive
(argon2id password hashing, JWT issue/verify, setup/reset token
mint/verify), the single role-check dependency, the deactivation
gate, the privacy-acknowledgement gate, the uniform error envelope,
and the fail-soft auth ``SMTPClient``. At SiteMesh port this whole
file plus ``routers/auth.py`` is replaced by the Auth Hub
integration (SPEC §9.2) — kept here so the swap is mechanical.
CODE_SPEC §6, AC-D2 / AC-D10 / AC-D16 / AC-CD5.

Notes for future sessions:
- ``SMTPClient`` is co-located here because account setup/reset email
  is auth-comms the Auth Hub replaces. P11 decides whether to
  relocate it when non-auth SMTP lands (AC-D26 reminders, AC-D18
  budget alerts, AC-D21 attention).
- ``SETUP_TOKEN_TTL`` / ``RESET_TOKEN_TTL`` are v1 code constants.
  Promoting them to the ``system_settings`` table is a sanctioned
  future evolution path, deliberately out of P2 scope.
- Schemas use a light ``@``-presence + lowercase + trim email rule
  (``normalise_email``) rather than ``EmailStr`` so no unpinned
  ``email-validator`` dependency is added (AC-CD1).
"""

from __future__ import annotations

import hashlib
import logging
import secrets
import smtplib
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import (
    InvalidHashError,
    VerificationError,
    VerifyMismatchError,
)
from fastapi import Depends, FastAPI, Header, Request
from fastapi.responses import ORJSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import SEED_TENANT_ID, AppUser, UserStatus, get_db

logger = logging.getLogger(__name__)

# --- Constants ---------------------------------------------------------

ROLE_ADMINISTRATOR = "administrator"
ROLE_TESTEE = "testee"
VALID_ROLES = frozenset({ROLE_ADMINISTRATOR, ROLE_TESTEE})

# AC-D16: deactivated login is rejected with a clear message.
DEACTIVATED_MESSAGE = "This account has been deactivated. Contact your administrator."

# v1 code constants (sanctioned future move to system_settings).
SETUP_TOKEN_TTL = timedelta(hours=72)
RESET_TOKEN_TTL = timedelta(hours=1)

# Placeholder hash for an admin-created user who has not completed the
# setup-link flow yet. Never starts with ``$argon2`` so it can never
# verify — login is impossible until a real password is set.
UNUSABLE_PASSWORD_HASH = "!"


def now_utc() -> datetime:
    return datetime.now(tz=UTC)


def token_expiry(ttl: timedelta) -> datetime:
    return now_utc() + ttl


# --- Password hashing (argon2id) --------------------------------------

_ph = PasswordHasher()  # argon2-cffi defaults to the argon2id variant


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(stored_hash: str, password: str) -> bool:
    if not stored_hash.startswith("$argon2"):
        return False
    try:
        return _ph.verify(stored_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


# --- Setup / reset tokens ---------------------------------------------
# The raw token is high-entropy (256-bit URL-safe). It is stored only
# as a deterministic SHA-256 so the unique ``token_hash`` column can be
# equality-looked-up; a slow hash is unnecessary and would break lookup.


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def mint_token() -> tuple[str, str]:
    """Return ``(raw_token, token_hash)``. Email the raw, store the hash."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_token(raw)


# --- JWT (stateless access + refresh; AC-CD5 smallest-correct) --------


class TokenError(Exception):
    """Raised when a JWT is missing, malformed, expired, or wrong type."""


def _issue(sub: str, role: str, token_type: str, ttl_seconds: int) -> str:
    settings = get_settings()
    issued = now_utc()
    payload = {
        "sub": sub,
        "role": role,
        "type": token_type,
        "iat": int(issued.timestamp()),
        "exp": int((issued + timedelta(seconds=ttl_seconds)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def issue_access_token(sub: str, role: str) -> str:
    return _issue(sub, role, "access", get_settings().jwt_access_ttl_seconds)


def issue_refresh_token(sub: str, role: str) -> str:
    return _issue(sub, role, "refresh", get_settings().jwt_refresh_ttl_seconds)


def decode_token(token: str, expected_type: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        claims: dict[str, Any] = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc
    if claims.get("type") != expected_type:
        raise TokenError(f"expected a {expected_type} token")
    return claims


# --- Uniform error envelope (CODE_SPEC §5) ----------------------------


class APIError(Exception):
    """Raised by routes; rendered as the uniform error envelope."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        detail: Any | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.detail = detail


def register_exception_handlers(app: FastAPI) -> None:
    """Wire the error envelope. Called from setup-only ``main.py``."""

    @app.exception_handler(APIError)
    async def _api_error_handler(_request: Request, exc: APIError) -> ORJSONResponse:
        return ORJSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "detail": exc.detail,
                }
            },
        )


# --- Auth email (fail-soft; test capture seam) ------------------------


@dataclass(frozen=True)
class SentEmail:
    to: str
    subject: str
    body: str


_CAPTURED: list[SentEmail] = []


def captured_emails() -> list[SentEmail]:
    """Test seam: emails recorded on the fail-soft (unconfigured) path."""
    return list(_CAPTURED)


def clear_captured_emails() -> None:
    _CAPTURED.clear()


class SMTPClient:
    """Thin SMTP sender. Fail-soft when SMTP env is unconfigured."""

    def send(self, to: str, subject: str, body: str) -> None:
        settings = get_settings()
        if not settings.smtp_host:
            logger.warning(
                "SMTP not configured; email to %s not sent (subject=%r)",
                to,
                subject,
            )
            _CAPTURED.append(SentEmail(to=to, subject=subject, body=body))
            return
        message = EmailMessage()
        message["From"] = settings.smtp_sender
        message["To"] = to
        message["Subject"] = subject
        message.set_content(body)
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
            smtp.starttls()
            if settings.smtp_username:
                smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
        _CAPTURED.append(SentEmail(to=to, subject=subject, body=body))


# --- Identity loading + the single dependency chain (AC-CD5) ----------
# get_current_user -> get_active_user (AC-D16 deactivation gate)
#   -> get_privacy_acked_user (AC-D16/§8.7 privacy gate)
#   -> require_role(...) (AC-D2 role gate).
# Protected business routes depend on require_role(...), so they
# transitively enforce auth + active + privacy + role in one chain.


async def load_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> AppUser | None:
    result = await db.execute(
        select(AppUser).where(
            AppUser.id == user_id,
            AppUser.tenant_id == SEED_TENANT_ID,
        )
    )
    return result.scalar_one_or_none()


async def load_user_by_email(db: AsyncSession, email: str) -> AppUser | None:
    result = await db.execute(
        select(AppUser).where(
            AppUser.email == email,
            AppUser.tenant_id == SEED_TENANT_ID,
        )
    )
    return result.scalar_one_or_none()


async def get_current_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> AppUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise APIError(401, "not_authenticated", "Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        claims = decode_token(token, expected_type="access")
    except TokenError as exc:
        raise APIError(401, "invalid_token", str(exc)) from exc
    try:
        user_id = uuid.UUID(str(claims.get("sub")))
    except ValueError as exc:
        raise APIError(401, "invalid_token", "Bad subject claim") from exc
    user = await load_user_by_id(db, user_id)
    if user is None:
        raise APIError(401, "invalid_token", "User not found")
    return user


async def get_active_user(
    user: AppUser = Depends(get_current_user),
) -> AppUser:
    if user.status == UserStatus.deactivated:
        raise APIError(403, "account_deactivated", DEACTIVATED_MESSAGE)
    return user


async def get_privacy_acked_user(
    user: AppUser = Depends(get_active_user),
) -> AppUser:
    if user.privacy_ack_at is None:
        raise APIError(
            403,
            "privacy_not_acknowledged",
            "The privacy notice must be acknowledged before continuing.",
        )
    return user


def require_role(
    *roles: str,
) -> Callable[[AppUser], Awaitable[AppUser]]:
    """Dependency factory: authenticated + active + privacy-acked + role."""

    async def _dependency(
        user: AppUser = Depends(get_privacy_acked_user),
    ) -> AppUser:
        if user.role not in roles:
            raise APIError(403, "forbidden", "Insufficient role for this action.")
        return user

    return _dependency
