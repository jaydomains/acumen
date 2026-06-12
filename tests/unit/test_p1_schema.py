"""P1: assert the data model + migration (AC-CD3 / AC-CD4).

No network / no DB — introspects ``app.models.Base.metadata`` and runs
Alembic in offline ``--sql`` mode in a subprocess (the AC-CD15 socket
guard is process-local; ``--sql`` opens no connection anyway).
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from pgvector.sqlalchemy import Vector
from sqlalchemy import Enum as SAEnum
from sqlalchemy import Float, String

from app.models import Base

_REPO = Path(__file__).resolve().parents[2]

EXPECTED_TABLES = {
    # Core SPEC §5 entities (Slice 1)
    "tenant",
    "app_user",
    "group",
    "subject",
    "pill",
    "learning_path",
    "assignment",
    "test",
    "question",
    "anchor_question",
    "attempt",
    "response",
    "grade",
    "grade_review",
    "weakness_report",
    "learning_material",
    "competency_profile",
    "drive_chunk",
    "corpus_chunk",  # AC-CD25 reference corpus builder (A2)
    "generation_provenance",  # AC-D29 per-assertion provenance chain (B2)
    "publish_record",  # AC-D31 autonomous auto-publish gate (C2)
    "gap_signal",  # SPEC §5 GapSignal — coverage-gap signal spine (D1-D2)
    "realism_flag",
    "system_settings",
    "audit_log",
    # Supporting / join tables (Slice 2)
    "group_member",
    "pill_safety_link",
    "pill_related",
    "learning_path_pill",
    "assignment_assignee",
    "assignment_reminder",
    "attempt_pause_event",
    "attempt_focus_event",
    "attempt_anchor",
    "weakness_report_pill",
    "processing_tasks",
    "account_setup_token",
    "password_reset_token",
}


def _table(name: str):
    return Base.metadata.tables[f"acumen.{name}"]


def _default(table_name: str, col: str) -> str:
    sd = _table(table_name).c[col].server_default
    return str(sd.arg.text).strip().strip("'")  # type: ignore[union-attr]


def test_table_set_is_exactly_p1() -> None:
    actual = {t.name for t in Base.metadata.tables.values()}
    assert actual == EXPECTED_TABLES
    assert len(EXPECTED_TABLES) == 38


def test_system_settings_v13_defaults() -> None:
    assert _default("system_settings", "competence_sensitivity") == "2.0"
    assert _default("system_settings", "anchor_calibration_prior_weight") == "20"
    assert _default("system_settings", "anchor_calibration_confidence_threshold") == "20"
    assert _default("system_settings", "anchor_pool_size_per_band") == "20"
    assert _default("system_settings", "competence_decay_halflife_days") == "90"
    assert _default("system_settings", "max_pause_duration_minutes") == "30"
    assert _default("system_settings", "review_provider") == "openai"
    assert _default("system_settings", "embedding_model") == "text-embedding-3-small"
    assert _default("system_settings", "pending_assignment_age_threshold_days") == "7"
    assert _default("system_settings", "escalation_enabled") == "true"
    assert _default("system_settings", "pill_publish_confidence_threshold") == "0.70"


def test_key_columns_present() -> None:
    # AC-D22: embedding is a 1536-dim vector.
    emb = _table("drive_chunk").c["embedding"].type
    assert isinstance(emb, Vector)
    assert emb.dim == 1536

    # P9 / AC-CD8 v1.6: DriveChunk joined AIProvenanceMixin via
    # migration 0006 so embedding spend surfaces in the cost
    # dashboard. The six provenance columns are nullable (existing rows
    # tolerate null; cost aggregator short-circuits on cost is None).
    drive_chunk = _table("drive_chunk").c
    for c in (
        "ai_provider",
        "ai_model",
        "ai_prompt_version",
        "ai_prompt_tokens",
        "ai_completion_tokens",
        "ai_cost_usd",
    ):
        assert c in drive_chunk
        assert drive_chunk[c].nullable is True

    # AC-D19 v1.3: three-state review_status.
    status = _table("grade_review").c["status"].type
    assert isinstance(status, SAEnum)
    assert set(status.enums) == {"pending", "confirmed", "flagged"}

    # AC-D9: competence_estimate is a nullable float ("no data yet").
    ce = _table("competency_profile").c["competence_estimate"]
    assert isinstance(ce.type, Float)
    assert ce.nullable is True

    # AC-D24 / AC-D17 on attempt.
    attempt = _table("attempt").c
    assert "shuffle_seed" in attempt
    assert "question_snapshot" in attempt

    # AC-D25 v1.8 / AC-CD10 v1.8 (P10): per-Testee Q-N ordering anchor
    # via migration 0007. Nullable for ``test_id``-owned (frozen) and
    # ``pill_id``-owned (anchor-pool) rows per SPEC §5 v1.8.
    question = _table("question").c
    assert "attempt_position" in question
    assert question["attempt_position"].nullable is True

    # AC-D25 v1.8 / AC-CD10 v1.8 (P10): pause-event reason via migration
    # 0007. NULL for user pauses (AC-D11); non-NULL for system pauses
    # (the streaming orchestrator's single-failure path).
    pause = _table("attempt_pause_event").c
    assert "reason" in pause
    assert pause["reason"].nullable is True
    assert isinstance(pause["reason"].type, String)
    assert pause["reason"].type.length == 255

    # AC-D24 / AC-D11 on test.
    test = _table("test").c
    for c in (
        "lock_mode",
        "campaign_id",
        "randomise_question_order",
        "randomise_option_order",
        "max_pause_duration_minutes",
    ):
        assert c in test

    # AC-D20/D27 + AC-D23 on anchor_question.
    anchor = _table("anchor_question").c
    for c in (
        "effective_difficulty",
        "excluded_reason",
        "regeneration_attempts",
    ):
        assert c in anchor

    # AC-D4 #5 served-set tracking (addition #1).
    lm = _table("learning_material").c
    assert "served_at" in lm
    assert "served_text" in lm

    # AC-D2: role is an open String, not a PG enum.
    role = _table("app_user").c["role"].type
    assert isinstance(role, String)
    assert not isinstance(role, SAEnum)

    # AC-CD7 processing_tasks contract.
    pt = _table("processing_tasks").c
    for c in ("task_name", "status", "payload", "error"):
        assert c in pt


def test_engagement_status_is_derived_only() -> None:
    # AC-D26: engagement_status is computed at read time, never stored.
    assert "engagement_status" not in _table("assignment").c


def test_pill_safety_override_marker_present() -> None:
    # AC-D21 (P3): nullable marker so edit-time re-evaluation never
    # clobbers a deliberate admin override (migration 0003).
    col = _table("pill").c["safety_relevant_overridden_at"]
    assert col.nullable is True
    assert col.server_default is None


def _alembic(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=_REPO,
        capture_output=True,
        text=True,
    )


def test_migration_offline_round_trip() -> None:
    up = _alembic("upgrade", "base:head", "--sql")
    assert up.returncode == 0, up.stderr
    # +corpus_chunk (A2) +generation_provenance (B2) +publish_record (C2).
    assert up.stdout.count("CREATE TABLE") >= 38
    assert "USING ivfflat" in up.stdout
    # 34 P1 + corpus_chunk (A2) + generation_provenance (B2) + publish_record
    # (C2) carry the trigger.
    assert up.stdout.count("CREATE TRIGGER trg_set_updated_at") == 38
    assert "TIMESTAMP WITH TIME ZONE" in up.stdout
    assert "INSERT INTO acumen.system_settings" in up.stdout

    down = _alembic("downgrade", "head:base", "--sql")
    assert down.returncode == 0, down.stderr
    assert down.stdout.count("DROP TABLE") >= 34
    assert down.stdout.count("DROP TYPE") == 18


def test_migration_0003_safety_override_round_trip() -> None:
    # P3 additive column migration is reversible (AC-CD3).
    up = _alembic("upgrade", "0002_p1_data_model:0003_p3_pill_safety_override", "--sql")
    assert up.returncode == 0, up.stderr
    assert "ADD COLUMN safety_relevant_overridden_at" in up.stdout

    down = _alembic(
        "downgrade", "0003_p3_pill_safety_override:0002_p1_data_model", "--sql"
    )
    assert down.returncode == 0, down.stderr
    assert "DROP COLUMN safety_relevant_overridden_at" in down.stdout


def test_migration_0006_drive_chunk_provenance_round_trip() -> None:
    # P9 additive AI-provenance columns on drive_chunk; reversible per
    # AC-CD3. Six columns up, six columns down.
    up = _alembic(
        "upgrade",
        "0005_p4_attempt_sequence_unique:0006_p9_drive_chunk_provenance",
        "--sql",
    )
    assert up.returncode == 0, up.stderr
    for column in (
        "ADD COLUMN ai_provider",
        "ADD COLUMN ai_model",
        "ADD COLUMN ai_prompt_version",
        "ADD COLUMN ai_prompt_tokens",
        "ADD COLUMN ai_completion_tokens",
        "ADD COLUMN ai_cost_usd",
    ):
        assert column in up.stdout

    down = _alembic(
        "downgrade",
        "0006_p9_drive_chunk_provenance:0005_p4_attempt_sequence_unique",
        "--sql",
    )
    assert down.returncode == 0, down.stderr
    for column in (
        "DROP COLUMN ai_provider",
        "DROP COLUMN ai_model",
        "DROP COLUMN ai_prompt_version",
        "DROP COLUMN ai_prompt_tokens",
        "DROP COLUMN ai_completion_tokens",
        "DROP COLUMN ai_cost_usd",
    ):
        assert column in down.stdout


def test_migration_0007_question_position_round_trip() -> None:
    # P10 additive: ``question.attempt_position`` + unique constraint on
    # ``(attempt_id, attempt_position)`` + ``attempt_pause_event.reason``.
    # Reversible per AC-CD3.
    up = _alembic(
        "upgrade",
        "0006_p9_drive_chunk_provenance:0007_p10_question_position",
        "--sql",
    )
    assert up.returncode == 0, up.stderr
    assert "ADD COLUMN attempt_position" in up.stdout
    assert "uq_question_attempt_position" in up.stdout
    assert "UNIQUE (attempt_id, attempt_position)" in up.stdout
    assert "ADD COLUMN reason VARCHAR(255)" in up.stdout

    down = _alembic(
        "downgrade",
        "0007_p10_question_position:0006_p9_drive_chunk_provenance",
        "--sql",
    )
    assert down.returncode == 0, down.stderr
    assert "DROP COLUMN attempt_position" in down.stdout
    assert "DROP CONSTRAINT uq_question_attempt_position" in down.stdout
    assert "DROP COLUMN reason" in down.stdout


def test_migration_0012_gap_signal_round_trip() -> None:
    # D1-D2 (SPEC §5 GapSignal): the polymorphic signal store + its enum type.
    # Reversible per AC-CD3.
    up = _alembic(
        "upgrade",
        "0011_c2_publish_record:0012_d1_d2_gap_signal",
        "--sql",
    )
    assert up.returncode == 0, up.stderr
    assert "CREATE TYPE acumen.gap_signal_type" in up.stdout
    assert "CREATE TABLE acumen.gap_signal" in up.stdout
    assert "ix_gap_signal_type_dedup_key" in up.stdout

    down = _alembic(
        "downgrade",
        "0012_d1_d2_gap_signal:0011_c2_publish_record",
        "--sql",
    )
    assert down.returncode == 0, down.stderr
    assert "DROP TABLE acumen.gap_signal" in down.stdout
    assert "DROP TYPE IF EXISTS acumen.gap_signal_type" in down.stdout


def test_migration_0011_publish_record_round_trip() -> None:
    # C2 (AC-D31): publish_record table + system_settings threshold column.
    # Reversible per AC-CD3.
    up = _alembic(
        "upgrade",
        "0010_b2_generation_provenance:0011_c2_publish_record",
        "--sql",
    )
    assert up.returncode == 0, up.stderr
    assert "CREATE TABLE acumen.publish_record" in up.stdout
    assert "ADD COLUMN pill_publish_confidence_threshold" in up.stdout
    assert "CREATE TRIGGER trg_set_updated_at" in up.stdout

    down = _alembic(
        "downgrade",
        "0011_c2_publish_record:0010_b2_generation_provenance",
        "--sql",
    )
    assert down.returncode == 0, down.stderr
    assert "DROP COLUMN pill_publish_confidence_threshold" in down.stdout
    assert "DROP TABLE acumen.publish_record" in down.stdout


def test_migration_0008_test_pill_id_round_trip() -> None:
    # Slice B B.3 additive: ``test.pill_id`` nullable FK to ``pill(id)``
    # + ``ix_test_pill_id``. Reversible per AC-CD3.
    up = _alembic(
        "upgrade",
        "0007_p10_question_position:0008_slice_b_test_pill_id",
        "--sql",
    )
    assert up.returncode == 0, up.stderr
    assert "ADD COLUMN pill_id UUID" in up.stdout
    assert "REFERENCES" in up.stdout
    assert "CREATE INDEX ix_test_pill_id" in up.stdout

    down = _alembic(
        "downgrade",
        "0008_slice_b_test_pill_id:0007_p10_question_position",
        "--sql",
    )
    assert down.returncode == 0, down.stderr
    assert "DROP INDEX" in down.stdout and "ix_test_pill_id" in down.stdout
    assert "DROP COLUMN pill_id" in down.stdout
