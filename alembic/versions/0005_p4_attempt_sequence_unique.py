"""p4 attempt sequence_number unique scope

Revision ID: 0005_p4_attempt_sequence_unique
Revises: 0004_p4_attempt_assignment_fk
Create Date: 2026-05-19

P4 / AC-D3 (v1.5): ``Attempt.sequence_number`` is the retake counter
scoped per Testee per Test. The canonical key is enforced at the
database level by a unique constraint on ``(test_id, testee_id,
sequence_number)``; ``start_attempt`` relies on the constraint and the
``IntegrityError``-retry path to assign the next number safely under
concurrent starts. Reversible downgrade (AC-CD3).

Documented in CODE_SPEC §4 since v1.5; v1 has no production data, so no
data-rewrite is required before adding the constraint.
"""

from __future__ import annotations

from alembic import op
from app.models import Base

revision = "0005_p4_attempt_sequence_unique"
down_revision = "0004_p4_attempt_assignment_fk"
branch_labels = None
depends_on = None

SCHEMA = Base.metadata.schema


def upgrade() -> None:
    op.execute(
        f"ALTER TABLE {SCHEMA}.attempt "
        "ADD CONSTRAINT uq_attempt_test_testee_sequence "
        "UNIQUE (test_id, testee_id, sequence_number)"
    )


def downgrade() -> None:
    op.execute(
        f"ALTER TABLE {SCHEMA}.attempt " "DROP CONSTRAINT uq_attempt_test_testee_sequence"
    )
