"""p4 attempt assignment attribution fk

Revision ID: 0004_p4_attempt_assignment_fk
Revises: 0003_p3_pill_safety_override
Create Date: 2026-05-19

P4 (AC-D26 v1.4): the explicit Attempt -> Assignment attribution link.
A nullable ``attempt.assignment_id`` UUID, an ``ON DELETE SET NULL`` FK
to ``acumen.assignment`` (withdrawing an assignment retains the attempt;
engagement then reads "no attributed attempts"), and the
``attempt.assignment_id`` index the CODE_SPEC indexing rule calls for.
One additive column; reversible downgrade (AC-CD3). v1 has no
production data so the backfill for any pre-existing attempt rows is
simply null. The ``set_updated_at`` trigger from 0002 already covers
``attempt``, so nothing else changes here.
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
    op.execute(f"ALTER TABLE {SCHEMA}.attempt ADD COLUMN assignment_id UUID")
    op.execute(
        f"ALTER TABLE {SCHEMA}.attempt "
        "ADD CONSTRAINT fk_attempt_assignment_id "
        f"FOREIGN KEY (assignment_id) REFERENCES {SCHEMA}.assignment (id) "
        "ON DELETE SET NULL"
    )
    op.execute(
        f"CREATE INDEX ix_attempt_assignment_id ON {SCHEMA}.attempt (assignment_id)"
    )


def downgrade() -> None:
    op.execute(f"DROP INDEX IF EXISTS {SCHEMA}.ix_attempt_assignment_id")
    op.execute(
        f"ALTER TABLE {SCHEMA}.attempt DROP CONSTRAINT IF EXISTS fk_attempt_assignment_id"
    )
    op.execute(f"ALTER TABLE {SCHEMA}.attempt DROP COLUMN assignment_id")
