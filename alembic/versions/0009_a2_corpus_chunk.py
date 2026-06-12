"""A2 corpus_chunk — reference corpus store

Revision ID: 0009_a2_corpus_chunk
Revises: 0008_slice_b_test_pill_id
Create Date: 2026-06-12

Slice A2 (autonomous-content-generation workstream, AC-CD25) — the
reference-corpus builder's store. ``corpus_chunk`` is the sibling of
``drive_chunk`` for the AI-built corpus: the same pgvector +
``AIProvenanceMixin`` shape (IVFFlat index ``ix_corpus_chunk_embedding``
mirroring ``ix_drive_chunk_embedding``) plus the source-authority
columns (``source_host`` / ``authority_tier`` / ``authority_score``,
AC-D28) and the DS2-b ``corroboration_count`` signal. The workstream's
first migration; the new table doesn't touch any P1 table. Idempotent
by ``(source_host, content_hash)`` (unique constraint). Reversible
(AC-CD3): downgrade drops the trigger then the table (its indices +
constraint drop with it).
"""

from __future__ import annotations

from alembic import op
from app.models import Base

revision = "0009_a2_corpus_chunk"
down_revision = "0008_slice_b_test_pill_id"
branch_labels = None
depends_on = None

SCHEMA = Base.metadata.schema


def upgrade() -> None:
    op.execute(
        f"CREATE TABLE {SCHEMA}.corpus_chunk ("
        "id UUID PRIMARY KEY DEFAULT gen_random_uuid(), "
        f"tenant_id UUID NOT NULL REFERENCES {SCHEMA}.tenant(id) ON DELETE RESTRICT, "
        "source_doc_ref VARCHAR(1024) NOT NULL, "
        "source_host VARCHAR(255) NOT NULL, "
        "authority_tier INTEGER NOT NULL, "
        "authority_score DOUBLE PRECISION NOT NULL, "
        "corroboration_count INTEGER NOT NULL DEFAULT 1, "
        "chunk_index INTEGER NOT NULL, "
        "chunk_text TEXT NOT NULL, "
        "content_hash VARCHAR(64) NOT NULL, "
        "embedding vector(1536), "
        "indexed_at TIMESTAMPTZ NOT NULL DEFAULT now(), "
        "ai_provider VARCHAR(32), "
        "ai_model VARCHAR(128), "
        "ai_prompt_version VARCHAR(64), "
        "ai_prompt_tokens INTEGER, "
        "ai_completion_tokens INTEGER, "
        "ai_cost_usd DOUBLE PRECISION, "
        "created_at TIMESTAMPTZ NOT NULL DEFAULT now(), "
        "updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), "
        "CONSTRAINT uq_corpus_chunk_source_hash UNIQUE (source_host, content_hash)"
        ")"
    )
    op.execute(
        f"CREATE INDEX ix_corpus_chunk_tenant_id ON {SCHEMA}.corpus_chunk (tenant_id)"
    )
    op.execute(
        f"CREATE INDEX ix_corpus_chunk_source_host "
        f"ON {SCHEMA}.corpus_chunk (source_host)"
    )
    op.execute(
        f"CREATE INDEX ix_corpus_chunk_content_hash "
        f"ON {SCHEMA}.corpus_chunk (content_hash)"
    )
    # IVFFlat on the 1536-dim embedding, mirroring ix_drive_chunk_embedding
    # (cosine ops — text-embedding-3-small vectors are normalised; lists=100
    # over-provisioned for the v1 small corpus, a tuneable past ~50k chunks).
    op.execute(
        f"CREATE INDEX ix_corpus_chunk_embedding ON {SCHEMA}.corpus_chunk "
        "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )
    # updated_at backstop trigger (every table carries TimestampMixin;
    # set_updated_at() is created in 0002).
    op.execute(
        f"CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON "
        f"{SCHEMA}.corpus_chunk FOR EACH ROW "
        f"EXECUTE FUNCTION {SCHEMA}.set_updated_at()"
    )


def downgrade() -> None:
    op.execute(f"DROP TRIGGER IF EXISTS trg_set_updated_at ON {SCHEMA}.corpus_chunk")
    op.execute(f"DROP TABLE {SCHEMA}.corpus_chunk")
