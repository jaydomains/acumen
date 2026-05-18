"""auth router — login, refresh, logout, account-setup + password-reset
token flows, privacy acknowledgement.

Auth Hub port seam (SPEC §9.2): this router plus ``app/permissions.py``
is the whole of standalone auth and is swapped for the Hub at port
time. CODE_SPEC §6, AC-D2 / AC-D10 / AC-D16 / AC-CD5.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import AppUser, UserStatus, get_db
from app.permissions import (
    DEACTIVATED_MESSAGE,
    APIError,
    SMTPClient,
    TokenError,
    acknowledge_privacy,
    consume_password_reset_token,
    consume_setup_token,
    decode_token,
    get_active_user,
    issue_access_token,
    issue_password_reset_token,
    issue_refresh_token,
    load_user_by_email,
    load_user_by_id,
    verify_password,
)
from app.schemas import (
    AccessToken,
    LoginRequest,
    LogoutResponse,
    MessageResponse,
    PasswordResetConsumeRequest,
    PasswordResetRequest,
    PrivacyAckResponse,
    RefreshRequest,
    SetupConsumeRequest,
    TokenPair,
)

router = APIRouter(prefix="/v1/auth", tags=["auth"])

_smtp = SMTPClient()


def _claim_uuid(value: object) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except ValueError as exc:
        raise APIError(401, "invalid_token", "Bad subject claim.") from exc


def _setup_email(raw_token: str) -> tuple[str, str]:
    link = f"{get_settings().app_public_url}/setup?token={raw_token}"
    return (
        "Set up your Acumen account",
        f"Welcome to Acumen. Set your password to activate your "
        f"account:\n\n{link}\n\nThis link expires in 72 hours.",
    )


def _reset_email(raw_token: str) -> tuple[str, str]:
    link = f"{get_settings().app_public_url}/reset?token={raw_token}"
    return (
        "Reset your Acumen password",
        f"A password reset was requested for your Acumen account:\n\n"
        f"{link}\n\nThis link expires in 1 hour. If you did not request "
        f"this, you can ignore this email.",
    )


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenPair:
    user = await load_user_by_email(db, body.email)
    if user is None or not verify_password(user.password_hash, body.password):
        raise APIError(401, "invalid_credentials", "Invalid email or password.")
    if user.status == UserStatus.deactivated:
        raise APIError(403, "account_deactivated", DEACTIVATED_MESSAGE)
    sub = str(user.id)
    return TokenPair(
        access_token=issue_access_token(sub, user.role),
        refresh_token=issue_refresh_token(sub, user.role),
    )


@router.post("/refresh")
async def refresh(
    body: RefreshRequest, db: AsyncSession = Depends(get_db)
) -> AccessToken:
    try:
        claims = decode_token(body.refresh_token, expected_type="refresh")
    except TokenError as exc:
        raise APIError(401, "invalid_token", str(exc)) from exc
    user = await load_user_by_id(db, _claim_uuid(claims.get("sub")))
    if user is None:
        raise APIError(401, "invalid_token", "User not found.")
    if user.status == UserStatus.deactivated:
        raise APIError(403, "account_deactivated", DEACTIVATED_MESSAGE)
    return AccessToken(access_token=issue_access_token(str(user.id), user.role))


@router.post("/logout")
async def logout() -> LogoutResponse:
    # Stateless JWT: nothing to revoke server-side. The contract is
    # explicit so API consumers know to discard their tokens.
    return LogoutResponse()


@router.post("/setup/consume")
async def setup_consume(
    body: SetupConsumeRequest, db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    user = await consume_setup_token(db, body.token, body.new_password)
    if user is None:
        raise APIError(400, "invalid_token", "Setup link is invalid or has expired.")
    await db.commit()
    return MessageResponse()


@router.post("/password-reset/request")
async def password_reset_request(
    body: PasswordResetRequest, db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    # Always 200 — never disclose whether the email exists.
    user = await load_user_by_email(db, body.email)
    if user is not None and user.status == UserStatus.active:
        raw = await issue_password_reset_token(db, user)
        await db.commit()
        subject, text = _reset_email(raw)
        _smtp.send(user.email, subject, text)
    return MessageResponse()


@router.post("/password-reset/consume")
async def password_reset_consume(
    body: PasswordResetConsumeRequest, db: AsyncSession = Depends(get_db)
) -> MessageResponse:
    user = await consume_password_reset_token(db, body.token, body.new_password)
    if user is None:
        raise APIError(400, "invalid_token", "Reset link is invalid or has expired.")
    await db.commit()
    return MessageResponse()


@router.post("/privacy/acknowledge")
async def privacy_acknowledge(
    user: AppUser = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
) -> PrivacyAckResponse:
    acked_at = await acknowledge_privacy(db, user)
    await db.commit()
    return PrivacyAckResponse(privacy_ack_at=acked_at)
