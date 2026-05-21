"""p10 question.attempt_position + attempt_pause_event.reason

Revision ID: 0007_p10_question_position
Revises: 0006_p9_drive_chunk_provenance
Create Date: 2026-05-21

P10 / AC-D25 v1.8 / AC-CD10 v1.8: per-Testee streaming gains an
attempt-scoped ordering anchor so concurrent ``asyncio.gather`` task
resolutions cannot perturb stream / replay order. Two additive changes:

1. ``question.attempt_position`` (nullable INT) + unique constraint
   ``uq_question_attempt_position`` on ``(attempt_id, attempt_position)``.
   Q1 lands at position 1 synchronously; Q2..N positions are reserved at
   enqueue time. NULL for ``test_id``-owned (frozen / hand-authored) and
   ``pill_id``-owned (anchor-pool) rows per SPEC §5 v1.8 — Postgres
   treats multiple NULLs as distinct under UNIQUE, so the index excludes
   unfilled slots without a partial-index WHERE clause. Shape mirrors
   0005's ``uq_attempt_test_testee_sequence``.

2. ``attempt_pause_event.reason`` (nullable VARCHAR(255)) carries the
   pause origin so the resume UI can render "retry / abandon" for system
   pauses (``reason="generation_failed"``) vs the plain affordance for
   user pauses (``reason=NULL``). VARCHAR(255) matches the P8
   ``excluded_reason`` precedent (formatted constant prefix + optional
   detail suffix); Python module constants in ``app.domain.attempts``
   carry the vocabulary so future reasons extend without a migration.

Reversible downgrade (AC-CD3). No data rewrite: ``question`` rows pre-
P10 are frozen / hand-authored / anchor-pool and stay at NULL; existing
``attempt_pause_event`` rows tolerate NULL ``reason``.
"""

from __future__ import annotations

from alembic import op
from app.models import Base

revision = "0007_p10_question_position"
down_revision = "0006_p9_drive_chunk_provenance"
branch_labels = None
depends_on = None

SCHEMA = Base.metadata.schema


def upgrade() -> None:
    op.execute(f"ALTER TABLE {SCHEMA}.question ADD COLUMN attempt_position INTEGER")
    op.execute(
        f"ALTER TABLE {SCHEMA}.question "
        "ADD CONSTRAINT uq_question_attempt_position "
        "UNIQUE (attempt_id, attempt_position)"
    )
    op.execute(f"ALTER TABLE {SCHEMA}.attempt_pause_event ADD COLUMN reason VARCHAR(255)")


def downgrade() -> None:
    op.execute(f"ALTER TABLE {SCHEMA}.attempt_pause_event DROP COLUMN reason")
    op.execute(
        f"ALTER TABLE {SCHEMA}.question DROP CONSTRAINT uq_question_attempt_position"
    )
    op.execute(f"ALTER TABLE {SCHEMA}.question DROP COLUMN attempt_position")
