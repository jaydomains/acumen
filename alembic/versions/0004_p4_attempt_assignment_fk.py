"""p4 attempt assignment fk

Revision ID: 0004_p4_attempt_assignment_fk
Revises: 0003_p3_pill_safety_override
Create Date: 2026-05-19

P4 / AC-D26 (v1.4): explicit ``attempt.assignment_id`` so
``engagement_status`` derives by assignment match rather than
origin/timing heuristics (resolves the ambiguity that surfaces when a
Testee has multiple assignments on the same pill or path). One additive
nullable FK plus its index. Reversible downgrade (AC-CD3).

Documented in CODE_SPEC §4 since v1.4; the column is set at
``start_attempt`` for assignment-driven and loop-driven origins, NULL
for self-initiated. v1 has no production data; no backfill needed.
"""

from __future__ import annotations

from alembic import op
from app.models import Base

revision = "0004_p4_attempt_assignment_fk"
down_revision = "0003_p3_pill_safety_override"
branch_labels = None
depends_on = None

SCHEMA = Base.metadata.schema


def upgrade() -> None:
    op.execute(
        f"ALTER TABLE {SCHEMA}.attempt "
        f"ADD COLUMN assignment_id UUID REFERENCES {SCHEMA}.assignment(id)"
    )
    op.execute(
        f"CREATE INDEX ix_attempt_assignment_id " f"ON {SCHEMA}.attempt (assignment_id)"
    )


def downgrade() -> None:
    op.execute(f"DROP INDEX IF EXISTS {SCHEMA}.ix_attempt_assignment_id")
    op.execute(f"ALTER TABLE {SCHEMA}.attempt DROP COLUMN assignment_id")
