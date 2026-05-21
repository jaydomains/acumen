"""p9 drive_chunk AI provenance columns

Revision ID: 0006_p9_drive_chunk_provenance
Revises: 0005_p4_attempt_sequence_unique
Create Date: 2026-05-21

P9 (AC-D22 / AC-CD8 v1.6): ``drive_chunk`` joins the AIProvenanceMixin
table set so every chunk row carries the embedding call's provider,
model, prompt_tokens, completion_tokens (always 0 for embeddings),
prompt_version (always NULL — embed has no template), and cost_usd.
The cost dashboard's :func:`app.ai.cost.current_month_spend` walks
``DriveChunk`` alongside the other 6 provenance-bearing tables so
"embedding spend appears against OpenAI in cost" (ROADMAP P9 done-when)
without a parallel cost ledger.

Six additive nullable columns. Existing rows (none at v1 ship —
``drive_chunk`` is empty until Slice 2's ingest callable runs) tolerate
nulls; the cost aggregator short-circuits on ``cost is None`` so legacy
rows do not poison the sum. Reversible downgrade drops the columns
(AC-CD3). The ``set_updated_at`` trigger from 0002 already covers the
``drive_chunk`` table — no trigger change here.
"""

from __future__ import annotations

from alembic import op
from app.models import Base

revision = "0006_p9_drive_chunk_provenance"
down_revision = "0005_p4_attempt_sequence_unique"
branch_labels = None
depends_on = None

SCHEMA = Base.metadata.schema


def upgrade() -> None:
    op.execute(
        f"ALTER TABLE {SCHEMA}.drive_chunk "
        "ADD COLUMN ai_provider VARCHAR(32), "
        "ADD COLUMN ai_model VARCHAR(128), "
        "ADD COLUMN ai_prompt_version VARCHAR(64), "
        "ADD COLUMN ai_prompt_tokens INTEGER, "
        "ADD COLUMN ai_completion_tokens INTEGER, "
        "ADD COLUMN ai_cost_usd DOUBLE PRECISION"
    )


def downgrade() -> None:
    op.execute(
        f"ALTER TABLE {SCHEMA}.drive_chunk "
        "DROP COLUMN ai_provider, "
        "DROP COLUMN ai_model, "
        "DROP COLUMN ai_prompt_version, "
        "DROP COLUMN ai_prompt_tokens, "
        "DROP COLUMN ai_completion_tokens, "
        "DROP COLUMN ai_cost_usd"
    )
