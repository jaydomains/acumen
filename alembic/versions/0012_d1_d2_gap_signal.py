"""D1-D2 gap_signal — the three §6.5 coverage-gap signal store

Revision ID: 0012_d1_d2_gap_signal
Revises: 0011_c2_publish_record
Create Date: 2026-06-12

Slice D1-D2 (autonomous-content-generation workstream, SPEC §5 GapSignal /
§6.5) — the **single polymorphic** signal spine the D3 gap-detection sweep
consumes. ``signal_type`` discriminates the three §6.5 inputs (discovery_miss /
question_tag / scope_clarification); deduped by ``(signal_type, dedup_key)``
(the signal-layer arm of the three-arm dedup + the sweep clustering key);
``consumed_at`` is authored here nullable (set by D3 — no second migration).
Reversible (AC-CD3): downgrade drops the trigger + table then the enum type.
"""

from __future__ import annotations

from alembic import op
from app.models import Base

revision = "0012_d1_d2_gap_signal"
down_revision = "0011_c2_publish_record"
branch_labels = None
depends_on = None

SCHEMA = Base.metadata.schema


def upgrade() -> None:
    op.execute(
        f"CREATE TYPE {SCHEMA}.gap_signal_type AS ENUM "
        "('discovery_miss', 'question_tag', 'scope_clarification')"
    )
    op.execute(
        f"CREATE TABLE {SCHEMA}.gap_signal ("
        "id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "
        f"tenant_id UUID NOT NULL REFERENCES {SCHEMA}.tenant(id) ON DELETE RESTRICT, "
        f"signal_type {SCHEMA}.gap_signal_type NOT NULL, "
        "dedup_key VARCHAR(255) NOT NULL, "
        "detail JSONB, "
        "source_ref UUID, "
        "occurrence_count INTEGER NOT NULL DEFAULT 1, "
        "occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(), "
        "consumed_at TIMESTAMPTZ, "
        "created_at TIMESTAMPTZ NOT NULL DEFAULT now(), "
        "updated_at TIMESTAMPTZ NOT NULL DEFAULT now()"
        ")"
    )
    op.execute(f"CREATE INDEX ix_gap_signal_tenant_id ON {SCHEMA}.gap_signal (tenant_id)")
    op.execute(
        "CREATE INDEX ix_gap_signal_type_dedup_key "
        f"ON {SCHEMA}.gap_signal (signal_type, dedup_key)"
    )
    op.execute(
        f"CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON "
        f"{SCHEMA}.gap_signal FOR EACH ROW "
        f"EXECUTE FUNCTION {SCHEMA}.set_updated_at()"
    )


def downgrade() -> None:
    op.execute(f"DROP TRIGGER IF EXISTS trg_set_updated_at ON {SCHEMA}.gap_signal")
    op.execute(f"DROP TABLE {SCHEMA}.gap_signal")
    op.execute(f"DROP TYPE IF EXISTS {SCHEMA}.gap_signal_type")
