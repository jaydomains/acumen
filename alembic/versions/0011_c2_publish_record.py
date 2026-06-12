"""C2 publish_record + system_settings.pill_publish_confidence_threshold

Revision ID: 0011_c2_publish_record
Revises: 0010_b2_generation_provenance
Create Date: 2026-06-12

Slice C2 (autonomous-content-generation workstream, AC-D31 / §6.5) — the
autonomous auto-publish gate's persistence: a `publish_record` row per publish
(pill_id, batch_id, confidence, the three AC-D30 pass verdicts, low_confidence,
per-type telemetry) as the Stage-E read + per-batch-rollback surface (DS8-a),
indexed on `pill_id`/`batch_id`/`safety_relevant`; plus the single global
`system_settings.pill_publish_confidence_threshold` (default 0.70, NS-6 — the
existing seeded row picks up the server default). Reversible (AC-CD3):
downgrade drops the trigger + table then the column.
"""

from __future__ import annotations

from alembic import op
from app.models import Base

revision = "0011_c2_publish_record"
down_revision = "0010_b2_generation_provenance"
branch_labels = None
depends_on = None

SCHEMA = Base.metadata.schema


def upgrade() -> None:
    op.execute(
        f"CREATE TABLE {SCHEMA}.publish_record ("
        "id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "
        f"tenant_id UUID NOT NULL REFERENCES {SCHEMA}.tenant(id) ON DELETE RESTRICT, "
        f"pill_id UUID NOT NULL REFERENCES {SCHEMA}.pill(id) ON DELETE CASCADE, "
        "batch_id VARCHAR(255), "
        "confidence DOUBLE PRECISION NOT NULL, "
        "low_confidence BOOLEAN NOT NULL, "
        "grounding_verdict VARCHAR(16) NOT NULL, "
        "safety_verdict VARCHAR(16) NOT NULL, "
        "provenance_verdict VARCHAR(16) NOT NULL, "
        "safety_relevant BOOLEAN NOT NULL, "
        "single_provider_verified BOOLEAN NOT NULL, "
        "created_at TIMESTAMPTZ NOT NULL DEFAULT now(), "
        "updated_at TIMESTAMPTZ NOT NULL DEFAULT now()"
        ")"
    )
    for col in ("tenant_id", "pill_id", "batch_id", "safety_relevant"):
        op.execute(
            f"CREATE INDEX ix_publish_record_{col} " f"ON {SCHEMA}.publish_record ({col})"
        )
    op.execute(
        f"CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON "
        f"{SCHEMA}.publish_record FOR EACH ROW "
        f"EXECUTE FUNCTION {SCHEMA}.set_updated_at()"
    )
    op.execute(
        f"ALTER TABLE {SCHEMA}.system_settings "
        "ADD COLUMN pill_publish_confidence_threshold DOUBLE PRECISION "
        "NOT NULL DEFAULT 0.70"
    )


def downgrade() -> None:
    op.execute(
        f"ALTER TABLE {SCHEMA}.system_settings "
        "DROP COLUMN pill_publish_confidence_threshold"
    )
    op.execute(f"DROP TRIGGER IF EXISTS trg_set_updated_at ON {SCHEMA}.publish_record")
    op.execute(f"DROP TABLE {SCHEMA}.publish_record")
