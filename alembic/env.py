"""Alembic environment — SiteMesh per-schema pattern (AC-CD3).

Creates the single ``acumen`` schema before running migrations, keeps
the Alembic version table in that schema, and uses the sync psycopg
driver per CODE_SPEC §2. ``target_metadata`` is ``app.models.Base``'s
metadata (empty in P0; every SPEC §5 entity lands in the P1 migration).
"""

from __future__ import annotations

from logging.config import fileConfig

from sqlalchemy import create_engine, text

from alembic import context
from app.config import get_settings
from app.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
target_metadata = Base.metadata
SCHEMA = settings.db_schema


def _url() -> str:
    return settings.database_migration_url


def run_migrations_offline() -> None:
    context.configure(
        url=_url(),
        target_metadata=target_metadata,
        version_table_schema=SCHEMA,
        include_schemas=True,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(_url(), future=True)
    with engine.connect() as connection:
        connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"'))
        connection.commit()
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table_schema=SCHEMA,
            include_schemas=True,
        )
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
