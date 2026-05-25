"""slice-b test.pill_id

Revision ID: 0008_slice_b_test_pill_id
Revises: 0007_p10_question_position
Create Date: 2026-05-25

Slice B B.3 — testee-facing "Practice at D{n}" resolver. Frozen and
hand-authored tests gain an optional canonical pill linkage
(``test.pill_id``) so a (pill, difficulty) lookup can pick a published
single-pill test deterministically. Pre-slice-B rows stay NULL and
remain unresolvable, matching the find-only contract.

Nullable column + index; no FK CASCADE (retiring a pill keeps the test
row, the discovery filter hides the pill anyway). Reversible (AC-CD3).
"""

from __future__ import annotations

from alembic import op
from app.models import Base

revision = "0008_slice_b_test_pill_id"
down_revision = "0007_p10_question_position"
branch_labels = None
depends_on = None

SCHEMA = Base.metadata.schema


def upgrade() -> None:
    op.execute(
        f"ALTER TABLE {SCHEMA}.test "
        f"ADD COLUMN pill_id UUID REFERENCES {SCHEMA}.pill(id)"
    )
    op.execute(
        f"CREATE INDEX ix_test_pill_id ON {SCHEMA}.test (pill_id)"
    )


def downgrade() -> None:
    op.execute(f"DROP INDEX {SCHEMA}.ix_test_pill_id")
    op.execute(f"ALTER TABLE {SCHEMA}.test DROP COLUMN pill_id")
