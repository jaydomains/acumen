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
