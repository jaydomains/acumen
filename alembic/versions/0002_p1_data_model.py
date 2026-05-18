"""p1 data model

Revision ID: 0002_p1_data_model
Revises: 0001_initial_empty
Create Date: 2026-05-18

P1 schema (AC-CD3/AC-CD4): every SPEC §5 entity + supporting/join
tables. The table/column/index set is compiled directly from
``app.models.Base.metadata`` so the migration can never drift from the
models (the Slice 4 test asserts parity). Adds: the ``vector`` extension
assert (AC-D22), native PG enums, an IVFFlat index on
``drive_chunk.embedding``, a ``BEFORE UPDATE`` trigger backstopping
``updated_at`` on every table (Gitar PR-#6 finding), and the
single-tenant seed rows (tenant, ``system_settings`` v1.3 defaults,
three immutable system groups). Reversible downgrade. AC-CD3.
"""

from __future__ import annotations

from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateIndex, CreateTable

from alembic import op
from app.models import (
    SEED_GROUP_ALL_ADMINS_ID,
    SEED_GROUP_ALL_TESTEES_ID,
    SEED_GROUP_ALL_USERS_ID,
    SEED_TENANT_ID,
    Base,
)

revision = "0002_p1_data_model"
down_revision = "0001_initial_empty"
branch_labels = None
depends_on = None

SCHEMA = Base.metadata.schema

# Native PG enums (name -> ordered values), created before the tables
# that reference them and dropped after them. user.role is intentionally
# a String, not an enum, per AC-D2 (open field, no schema churn).
ENUMS: dict[str, tuple[str, ...]] = {
    "user_status": ("active", "deactivated"),
    "loop_mode": ("autonomous", "admin_reviewed"),
    "test_mode": ("per_testee", "frozen", "hand_authored", "benchmark"),
    "test_status": ("draft", "published"),
    "test_visibility": ("library", "private"),
    "timeout_behaviour": ("auto_submit", "expire"),
    "lock_mode": ("open", "campaign_locked"),
    "benchmark_scope": ("subject", "pill", "path"),
    "question_type": (
        "multiple_choice",
        "true_false",
        "matching",
        "short_answer",
        "scenario",
    ),
    "attempt_origin": (
        "self_initiated",
        "assignment_driven",
        "loop_driven",
    ),
    "grade_verdict": ("full", "partial", "none"),
    "grade_source": ("auto", "ai", "admin_override"),
    "review_status": ("pending", "confirmed", "flagged"),
    "learning_material_source": (
        "ai_generated",
        "admin_reference",
        "curated_safety_links",
    ),
    "processing_task_status": ("pending", "running", "done", "failed"),
    "assignment_reminder_kind": ("reminder", "escalation"),
    "focus_event_kind": ("blur", "focus"),
}

_DIALECT = postgresql.dialect()
_PREP = _DIALECT.identifier_preparer


def _qname(table_name: str) -> str:
    # Schema-qualified, identifier-quoted only when required — matches
    # SQLAlchemy's compiled DDL (e.g. the reserved word ``group``).
    return f"{SCHEMA}.{_PREP.quote(table_name)}"


def upgrade() -> None:
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
    # AC-D22: assert pgvector (init.sql owns creation; assert here too).
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    for name, values in ENUMS.items():
        labels = ", ".join(f"'{v}'" for v in values)
        op.execute(f"CREATE TYPE {SCHEMA}.{name} AS ENUM ({labels})")

    tables = Base.metadata.sorted_tables  # parent -> child (FK order)
    for table in tables:
        op.execute(str(CreateTable(table).compile(dialect=_DIALECT)))
        for index in table.indexes:
            op.execute(str(CreateIndex(index).compile(dialect=_DIALECT)))

    # AC-D22: IVFFlat on the 1536-dim embedding. lists=100 is
    # over-provisioned for the v1 small corpus (pgvector guidance ~
    # rows/1000) and is a tuneable to revisit past ~50k chunks; cosine
    # ops because text-embedding-3-small vectors are normalised.
    op.execute(
        f"CREATE INDEX ix_drive_chunk_embedding ON {SCHEMA}.drive_chunk "
        "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )

    # Backstop updated_at regardless of how the UPDATE is issued
    # (Gitar PR-#6 finding). Every table uses TimestampMixin.
    op.execute(
        f"CREATE OR REPLACE FUNCTION {SCHEMA}.set_updated_at() "
        "RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); "
        "RETURN NEW; END; $$ LANGUAGE plpgsql"
    )
    for table in tables:
        op.execute(
            f"CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON "
            f"{_qname(table.name)} FOR EACH ROW "
            f"EXECUTE FUNCTION {SCHEMA}.set_updated_at()"
        )

    # --- Single-tenant seed rows (stable UUIDs, AC-CD3) ---------------
    op.execute(
        f"INSERT INTO {SCHEMA}.tenant (id, name) " f"VALUES ('{SEED_TENANT_ID}', 'KBC')"
    )
    # All knob columns fall back to their v1.3 server_defaults.
    op.execute(
        f"INSERT INTO {SCHEMA}.system_settings (tenant_id) "
        f"VALUES ('{SEED_TENANT_ID}')"
    )
    for gid, gname in (
        (SEED_GROUP_ALL_USERS_ID, "All Users"),
        (SEED_GROUP_ALL_TESTEES_ID, "All Testees"),
        (SEED_GROUP_ALL_ADMINS_ID, "All Administrators"),
    ):
        op.execute(
            f"INSERT INTO {SCHEMA}."
            f'"group" (id, tenant_id, name, is_system) '
            f"VALUES ('{gid}', '{SEED_TENANT_ID}', '{gname}', true)"
        )


def downgrade() -> None:
    tables = list(reversed(Base.metadata.sorted_tables))  # child -> parent
    for table in tables:
        op.execute(f"DROP TRIGGER IF EXISTS trg_set_updated_at ON {_qname(table.name)}")
    op.execute(f"DROP FUNCTION IF EXISTS {SCHEMA}.set_updated_at()")
    for table in tables:
        op.execute(f"DROP TABLE IF EXISTS {_qname(table.name)} CASCADE")
    for name in ENUMS:
        op.execute(f"DROP TYPE IF EXISTS {SCHEMA}.{name}")
    # The `vector` extension is owned by infra/postgres/init.sql; this
    # migration only asserts it, so it is not dropped here.
