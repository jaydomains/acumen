"""p3 pill safety-override marker

Revision ID: 0003_p3_pill_safety_override
Revises: 0002_p1_data_model
Create Date: 2026-05-18

P3 (AC-D21): a nullable ``pill.safety_relevant_overridden_at``
timestamptz. It records when an admin explicitly overrode the safety
auto-tag so that edit-time re-evaluation never clobbers a deliberate
admin decision (override wins). One additive column; reversible
downgrade (AC-CD3). The ``set_updated_at`` trigger from 0002 already
covers the ``pill`` table, so nothing else changes here.
"""

from __future__ import annotations

from alembic import op
from app.models import Base

revision = "0003_p3_pill_safety_override"
down_revision = "0002_p1_data_model"
branch_labels = None
depends_on = None

SCHEMA = Base.metadata.schema


def upgrade() -> None:
    op.execute(
        f"ALTER TABLE {SCHEMA}.pill "
        "ADD COLUMN safety_relevant_overridden_at TIMESTAMP WITH TIME ZONE"
    )


def downgrade() -> None:
    op.execute(f"ALTER TABLE {SCHEMA}.pill DROP COLUMN safety_relevant_overridden_at")
