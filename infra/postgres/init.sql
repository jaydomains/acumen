-- Acumen Postgres init (CODE_SPEC §4, AC-CD3 / AC-CD4).
-- Runs once on first container init. The pgvector extension and the
-- single `acumen` schema are created here; the extension is also
-- asserted in the first real Alembic migration (P1).
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS acumen;
