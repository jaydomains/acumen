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
    assert len(EXPECTED_TABLES) == 34


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


def test_key_columns_present() -> None:
    # AC-D22: embedding is a 1536-dim vector.
    emb = _table("drive_chunk").c["embedding"].type
    assert isinstance(emb, Vector)
    assert emb.dim == 1536

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
    assert up.stdout.count("CREATE TABLE") >= 34
    assert "USING ivfflat" in up.stdout
    assert up.stdout.count("CREATE TRIGGER trg_set_updated_at") == 34
    assert "TIMESTAMP WITH TIME ZONE" in up.stdout
    assert "INSERT INTO acumen.system_settings" in up.stdout

    down = _alembic("downgrade", "head:base", "--sql")
    assert down.returncode == 0, down.stderr
    assert down.stdout.count("DROP TABLE") >= 34
    assert down.stdout.count("DROP TYPE") == 17
