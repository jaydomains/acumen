"""E2 demoted_sources — the DS13-a DB source-override layer (AC-CD26 / AC-D28)

Revision ID: 0013_e2_demoted_sources
Revises: 0012_d1_d2_gap_signal
Create Date: 2026-06-13

Slice E2 (autonomous-content-generation workstream, AC-CD26 rollback half) — the
**source-override layer** that completes AC-D28's [A1+E2] design (DS13-a / DS1-d).
A1's allowlist is a code-VCS seed (the AC-CD18 registry); runtime demotion can't
write code, so this small table records operator/rollback demotions that the
AC-D28 ``is_allowlisted`` / ``authority_tier`` checks consult **on top of** the
seed: ``denied`` removes a host, ``tier_override`` re-ranks it. ``rollback_source``
(per-source rollback) writes a ``denied`` row here so the corpus builder (AC-CD25)
stops re-acquiring the discredited host — making per-source rollback durable.

One row per ``(tenant_id, source_host)`` (the unique key the override join reads).
Reversible (AC-CD3): downgrade drops the trigger then the table.
"""

from __future__ import annotations

from alembic import op
from app.models import Base

revision = "0013_e2_demoted_sources"
down_revision = "0012_d1_d2_gap_signal"
branch_labels = None
depends_on = None

SCHEMA = Base.metadata.schema


def upgrade() -> None:
    op.execute(
        f"CREATE TABLE {SCHEMA}.demoted_sources ("
        "id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "
        f"tenant_id UUID NOT NULL REFERENCES {SCHEMA}.tenant(id) ON DELETE RESTRICT, "
        "source_host VARCHAR(255) NOT NULL, "
        "denied BOOLEAN NOT NULL DEFAULT true, "
        "tier_override INTEGER, "
        "reason VARCHAR(1024), "
        f"actor_id UUID REFERENCES {SCHEMA}.app_user(id), "
        "created_at TIMESTAMPTZ NOT NULL DEFAULT now(), "
        "updated_at TIMESTAMPTZ NOT NULL DEFAULT now()"
        ")"
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_demoted_sources_tenant_host "
        f"ON {SCHEMA}.demoted_sources (tenant_id, source_host)"
    )
    op.execute(
        f"CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON "
        f"{SCHEMA}.demoted_sources FOR EACH ROW "
        f"EXECUTE FUNCTION {SCHEMA}.set_updated_at()"
    )


def downgrade() -> None:
    op.execute(f"DROP TRIGGER IF EXISTS trg_set_updated_at ON {SCHEMA}.demoted_sources")
    op.execute(f"DROP TABLE {SCHEMA}.demoted_sources")
