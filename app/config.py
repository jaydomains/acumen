"""Acumen configuration — pydantic-settings; all env, all defaults.

Single source of environment-derived configuration (CODE_SPEC §3,
AC-CD16). Model IDs are env-overridable defaults, never hard-coded into
call sites (AC-CD18). DB-stored tunable knobs (``competence_sensitivity``,
``anchor_calibration_*`` and the rest of SPEC §5 System Settings) live in
the ``system_settings`` table from P1 — they are deliberately NOT here.
"""

from __future__ import annotations

import re
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_SQL_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- APP_* ---
    app_env: str = "development"
    app_public_url: str = "http://localhost:8000"
    app_secret_key: str = "change-me"
    app_file_storage_path: str = "/var/lib/acumen/files"

    # --- Database ---
    database_url: str = "postgresql+asyncpg://acumen:acumen@postgres:5432/acumen"
    database_migration_url: str = (
        "postgresql+psycopg://acumen:acumen@postgres:5432/acumen"
    )
    db_schema: str = "acumen"

    # --- Redis / Celery ---
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    # --- JWT ---
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_seconds: int = 900
    jwt_refresh_ttl_seconds: int = 1_209_600

    # --- Anthropic (5 primary ops; env-overridable model IDs, AC-CD18) ---
    anthropic_api_key: str = ""
    anthropic_model_generation: str = "claude-sonnet-4-6"
    anthropic_model_grading: str = "claude-sonnet-4-6"
    anthropic_model_weakness: str = "claude-sonnet-4-6"
    anthropic_model_material: str = "claude-sonnet-4-6"
    anthropic_model_pill_proposal: str = "claude-sonnet-4-6"

    # --- OpenAI (cross-family review + embeddings, AC-D19 / AC-D22) ---
    openai_api_key: str = ""
    openai_model_review: str = "gpt-4o"
    openai_embedding_model: str = "text-embedding-3-small"

    # --- Google Drive RAG (AC-D22) ---
    google_drive_credentials_json: str = ""
    google_drive_folder_id: str = ""

    # --- Web search (safety-link curation, AC-D21) ---
    web_search_api_key: str = ""

    # --- SMTP (AC-D10 / AC-D26) ---
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_sender: str = "acumen@example.com"

    # --- JIT streaming buffer defaults (AC-D25); per-op knobs in DB (P1) ---
    jit_buffer_size: int = 3
    jit_buffer_max: int = 5
    # SSE disconnect grace: after CancelledError, wait this many seconds
    # for shielded per-Q-N persistence to finish before re-raising
    # (P10 / AC-CD10 v1.8). Default ≈ one generation latency.
    jit_persist_grace_seconds: int = 10

    # --- CORS (frontend origin allowlist, AC-CD19) ---
    # Comma-separated list of allowed origins for the browser frontend.
    # Tokens travel in the Authorization header (not cookies), so
    # allow_credentials stays False at the middleware site — see
    # ``app/main.py``. AC-CD19 documents the v1.x upgrade path to
    # httpOnly cookies, which would flip this to credentialed mode.
    cors_allowed_origins: str = "http://localhost:3000"

    @property
    def cors_allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]

    @field_validator("db_schema")
    @classmethod
    def _validate_db_schema(cls, v: str) -> str:
        # db_schema is interpolated into a raw CREATE SCHEMA statement in
        # alembic/env.py — constrain it to a plain SQL identifier so an
        # admin-set DB_SCHEMA cannot break out of identifier quoting.
        if not _SQL_IDENTIFIER.match(v):
            raise ValueError(f"db_schema must be a valid SQL identifier, got: {v!r}")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Environments where boot-critical config may stay at insecure dev defaults
# (default ``change-me`` secrets / wildcard|localhost CORS). The boot check
# fails CLOSED for any ``app_env`` value OUTSIDE this set, so an
# unrecognised env (e.g. "staging", "production") carrying default secrets
# refuses to start rather than fail open. ``"development"`` is the actual
# ``app_env`` default (above) and is included so the stock dev container +
# CI — which set no ``APP_ENV`` — boot clean (Decision D2; pre-deploy
# A4-S3-C / WS4 subset).
DEV_ENVS = frozenset({"development", "dev", "local", "test"})

_DEFAULT_SECRET = "change-me"


def _cors_is_insecure(origins: list[str]) -> bool:
    """True when the CORS allow-list is unsafe for a public deployment —
    empty (no origin set), a literal wildcard, or any localhost/loopback
    origin."""
    if not origins:
        return True
    return any(o == "*" or "localhost" in o or "127.0.0.1" in o for o in origins)


def check_startup_config(settings: Settings) -> tuple[list[str], list[str]]:
    """Validate boot-critical configuration. Returns ``(warnings, errors)``.

    Reads only :class:`Settings` — never imports ``app.ai`` / ``app.domain``
    — so ``app.main`` can call it from its lifespan without tripping the
    structure-gate's setup-only rule (AC-CD2; pre-deploy grounding G3).

    - **Warning** (every env) per missing AI key: an unset
      ``anthropic_api_key`` / ``openai_api_key`` silently falls back to the
      stub provider (``app/ai/provider.py``), so the warning makes the
      "stub served as real" condition loud (A4-S3-C).
    - **Error** (boot must fail closed) when ``app_env`` is NOT in
      :data:`DEV_ENVS` AND any of: ``app_secret_key`` / ``jwt_secret`` is
      the default ``"change-me"``, or the CORS allow-list is wildcard /
      localhost. An env value outside the dev-set therefore RAISEs on these
      rather than failing open (Decision D2).
    """
    warnings: list[str] = []
    errors: list[str] = []

    if not settings.anthropic_api_key:
        warnings.append(
            "ANTHROPIC_API_KEY is unset — Anthropic operations (generation, "
            "grading, weakness, material, pill-proposal) fall back to the stub "
            "provider, not a real model."
        )
    if not settings.openai_api_key:
        warnings.append(
            "OPENAI_API_KEY is unset — OpenAI cross-family review and embeddings "
            "fall back to the stub provider, not a real model."
        )

    if settings.app_env not in DEV_ENVS:
        if settings.app_secret_key == _DEFAULT_SECRET:
            errors.append(
                "APP_SECRET_KEY is the default 'change-me' — set a real secret "
                f"for app_env={settings.app_env!r}."
            )
        if settings.jwt_secret == _DEFAULT_SECRET:
            errors.append(
                "JWT_SECRET is the default 'change-me' — set a real secret for "
                f"app_env={settings.app_env!r}."
            )
        if _cors_is_insecure(settings.cors_allowed_origins_list):
            errors.append(
                "CORS_ALLOWED_ORIGINS is wildcard or localhost — set the real "
                f"production origin(s) for app_env={settings.app_env!r}."
            )

    return warnings, errors
