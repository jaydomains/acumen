"""B2 generation_provenance — per-assertion claim→corpus-source chain

Revision ID: 0010_b2_generation_provenance
Revises: 0009_a2_corpus_chunk
Create Date: 2026-06-12

Slice B2 (autonomous-content-generation workstream, AC-D29 / §6.8) — the
per-assertion generation provenance chain. One row per (assertion,
grounding-chunk): for each factual claim in an autonomously generated pill
draft, which `corpus_chunk` grounded it, with the source's authority tier +
score (AC-D28). Relational + indexed on `source_host` / `corpus_chunk_id` so
the E2 per-source rollback retracts claim-precisely. `batch_id` is stamped by
the B3 fan-out (nullable until then). Reversible (AC-CD3): downgrade drops the
trigger then the table.
"""

from __future__ import annotations

from alembic import op
from app.models import Base

revision = "0010_b2_generation_provenance"
down_revision = "0009_a2_corpus_chunk"
branch_labels = None
depends_on = None

SCHEMA = Base.metadata.schema


def upgrade() -> None:
    op.execute(
        f"CREATE TABLE {SCHEMA}.generation_provenance ("
        "id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "
        f"tenant_id UUID NOT NULL REFERENCES {SCHEMA}.tenant(id) ON DELETE RESTRICT, "
        "draft_ref VARCHAR(255) NOT NULL, "
        "claim_ref VARCHAR(255) NOT NULL, "
        "corpus_chunk_id UUID NOT NULL "
        f"REFERENCES {SCHEMA}.corpus_chunk(id) ON DELETE CASCADE, "
        "source_host VARCHAR(255) NOT NULL, "
        "authority_tier INTEGER NOT NULL, "
        "authority_score DOUBLE PRECISION NOT NULL, "
        "batch_id VARCHAR(255), "
        "created_at TIMESTAMPTZ NOT NULL DEFAULT now(), "
        "updated_at TIMESTAMPTZ NOT NULL DEFAULT now()"
        ")"
    )
    for col in ("tenant_id", "draft_ref", "corpus_chunk_id", "source_host", "batch_id"):
        op.execute(
            f"CREATE INDEX ix_generation_provenance_{col} "
            f"ON {SCHEMA}.generation_provenance ({col})"
        )
    op.execute(
        f"CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON "
        f"{SCHEMA}.generation_provenance FOR EACH ROW "
        f"EXECUTE FUNCTION {SCHEMA}.set_updated_at()"
    )


def downgrade() -> None:
    op.execute(
        f"DROP TRIGGER IF EXISTS trg_set_updated_at ON {SCHEMA}.generation_provenance"
    )
    op.execute(f"DROP TABLE {SCHEMA}.generation_provenance")
