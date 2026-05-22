"""p1 data model

Revision ID: 0002_p1_data_model
Revises: 0001_initial_empty
Create Date: 2026-05-18

P1 schema (AC-CD3/AC-CD4): every SPEC §5 entity + supporting/join
tables (34 tables in the single ``acumen`` schema). Adds: the
``vector`` extension assert (AC-D22), 17 native PG enums, an IVFFlat
index on ``drive_chunk.embedding``, a ``BEFORE UPDATE`` trigger
backstopping ``updated_at`` on every table (Gitar PR-#6 finding), and
the single-tenant seed rows (tenant, ``system_settings`` v1.3
defaults, three immutable system groups). Reversible downgrade.

**Snapshot, not a live mirror.** This migration declares each table
as an explicit ``Table(...)`` against a migration-local ``MetaData``,
representing the P1-frozen column / constraint / index set —
decoupled from ``app.models``. Earlier the migration compiled
``Base.metadata.sorted_tables`` at run time, which silently included
every additive column / constraint introduced by 0003-0007 (P3
``pill.safety_relevant_overridden_at``, P4 ``attempt.assignment_id``
+ ``uq_attempt_test_testee_sequence``, P9 six provenance columns on
``drive_chunk``, P10 ``question.attempt_position`` +
``uq_question_attempt_position`` + ``attempt_pause_event.reason``).
``--sql`` offline-mode tests never noticed because they emit text
without applying it; the bug surfaced the first time the chain ran
against a real Postgres at 0003 with ``DuplicateColumn``. A frozen
snapshot makes 0002 a fixed checkpoint and lets 0003-0007 land
their ALTER TABLEs cleanly. AC-CD3.
"""

from __future__ import annotations

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    UniqueConstraint,
    text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.schema import CreateIndex, CreateTable

from alembic import op

revision = "0002_p1_data_model"
down_revision = "0001_initial_empty"
branch_labels = None
depends_on = None

SCHEMA = "acumen"

# Stable seed UUIDs, inlined so the migration has no ``app.models``
# runtime dependency. The same literals are exported as constants from
# ``app.models`` for the schema test's own assertions; they survive
# Alembic down/up cycles unchanged.
_SEED_TENANT_ID = "00000000-0000-0000-0000-000000000001"
_SEED_GROUP_ALL_USERS_ID = "00000000-0000-0000-0000-000000000010"
_SEED_GROUP_ALL_TESTEES_ID = "00000000-0000-0000-0000-000000000011"
_SEED_GROUP_ALL_ADMINS_ID = "00000000-0000-0000-0000-000000000012"

# Native PG enums (name -> ordered values), created before the tables
# that reference them and dropped after. user.role is intentionally a
# String, not an enum, per AC-D2.
ENUMS: dict[str, tuple[str, ...]] = {
    "user_status": ("active", "deactivated"),
    "loop_mode": ("autonomous", "admin_reviewed"),
    "test_mode": ("per_testee", "frozen", "hand_authored", "benchmark"),
    "test_status": ("draft", "published"),
    "test_visibility": ("library", "private"),
    "timeout_behaviour": ("auto_submit", "expire"),
    "lock_mode": ("open", "campaign_locked"),
    "benchmark_scope": ("subject", "pill", "path"),
    "question_type": (
        "multiple_choice",
        "true_false",
        "matching",
        "short_answer",
        "scenario",
    ),
    "attempt_origin": (
        "self_initiated",
        "assignment_driven",
        "loop_driven",
    ),
    "grade_verdict": ("full", "partial", "none"),
    "grade_source": ("auto", "ai", "admin_override"),
    "review_status": ("pending", "confirmed", "flagged"),
    "learning_material_source": (
        "ai_generated",
        "admin_reference",
        "curated_safety_links",
    ),
    "processing_task_status": ("pending", "running", "done", "failed"),
    "assignment_reminder_kind": ("reminder", "escalation"),
    "focus_event_kind": ("blur", "focus"),
}

_DIALECT = postgresql.dialect()
_PREP = _DIALECT.identifier_preparer


def _qname(table_name: str) -> str:
    # Schema-qualified, identifier-quoted only when required — matches
    # SQLAlchemy's compiled DDL (e.g. the reserved word ``group``).
    return f"{SCHEMA}.{_PREP.quote(table_name)}"


def _enum_col(name: str) -> SAEnum:
    # Native PG enum referenced by name; ``create_type=False`` because
    # the migration creates each enum once before the tables (below).
    return SAEnum(
        *ENUMS[name],
        name=name,
        schema=SCHEMA,
        native_enum=True,
        create_type=False,
    )


# --- Column helpers -- match ``app.models`` shape exactly --------------


def _id_col() -> Column:
    return Column(
        "id",
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )


def _tenant_fk_col() -> Column:
    return Column(
        "tenant_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.tenant.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )


def _timestamp_cols() -> tuple[Column, Column]:
    return (
        Column(
            "created_at",
            DateTime(timezone=True),
            server_default=text("now()"),
            nullable=False,
        ),
        Column(
            "updated_at",
            DateTime(timezone=True),
            server_default=text("now()"),
            onupdate=text("now()"),
            nullable=False,
        ),
    )


def _ai_provenance_cols() -> tuple[Column, ...]:
    # AIProvenanceMixin (AC-CD8) — P1 set: Question, AnchorQuestion,
    # Grade, GradeReview, WeaknessReport, LearningMaterial.
    # ``DriveChunk`` joins this mixin via migration 0006 (P9), so its
    # six columns are *not* emitted here.
    return (
        Column("ai_provider", String(32)),
        Column("ai_model", String(128)),
        Column("ai_prompt_version", String(64)),
        Column("ai_prompt_tokens", Integer),
        Column("ai_completion_tokens", Integer),
        Column("ai_cost_usd", Float),
    )


# --- P1 schema (local metadata, decoupled from ``app.models``) --------

metadata = MetaData(schema=SCHEMA)


# Core SPEC §5 entities

Table(
    "tenant",
    metadata,
    _id_col(),
    Column("name", String(255), nullable=False),
    *_timestamp_cols(),
)

Table(
    "app_user",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column("email", String(320), nullable=False, index=True),
    Column("name", String(255), nullable=False),
    Column("password_hash", String(255), nullable=False),
    Column("role", String(32), nullable=False),
    Column(
        "status",
        _enum_col("user_status"),
        nullable=False,
        server_default="active",
    ),
    Column("status_changed_at", DateTime(timezone=True)),
    Column("privacy_ack_at", DateTime(timezone=True)),
    *_timestamp_cols(),
    UniqueConstraint("email", name="uq_app_user_email"),
)

Table(
    "group",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column("name", String(255), nullable=False),
    Column("description", String(1024)),
    Column(
        "is_system",
        postgresql.BOOLEAN(),
        nullable=False,
        server_default=text("false"),
    ),
    Column(
        "created_by",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.app_user.id"),
    ),
    *_timestamp_cols(),
)

Table(
    "subject",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column("name", String(255), nullable=False),
    Column("description", String(2048)),
    *_timestamp_cols(),
)

Table(
    "pill",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "subject_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.subject.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    ),
    Column("name", String(255), nullable=False),
    Column("description", String(4096)),
    Column("available_difficulty_min", Integer, nullable=False),
    Column("available_difficulty_max", Integer, nullable=False),
    Column(
        "discoverable",
        postgresql.BOOLEAN(),
        nullable=False,
        server_default=text("true"),
    ),
    Column(
        "safety_relevant",
        postgresql.BOOLEAN(),
        nullable=False,
        server_default=text("false"),
    ),
    # NOTE: ``safety_relevant_overridden_at`` is added by 0003 (P3).
    Column("estimated_minutes", Integer),
    Column("retired_at", DateTime(timezone=True)),
    *_timestamp_cols(),
)

Table(
    "learning_path",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column("name", String(255), nullable=False),
    Column("description", String(2048)),
    Column(
        "is_private",
        postgresql.BOOLEAN(),
        nullable=False,
        server_default=text("false"),
    ),
    Column(
        "owner_user_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.app_user.id"),
    ),
    *_timestamp_cols(),
)

Table(
    "assignment",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "assigner_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.app_user.id"),
        nullable=False,
        index=True,
    ),
    Column(
        "pill_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.pill.id"),
        index=True,
    ),
    Column(
        "learning_path_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.learning_path.id"),
        index=True,
    ),
    Column("difficulty", Integer, nullable=False),
    Column("deadline", DateTime(timezone=True)),
    Column(
        "is_mandatory",
        postgresql.BOOLEAN(),
        nullable=False,
        server_default=text("false"),
    ),
    Column(
        "loop_mode",
        _enum_col("loop_mode"),
        nullable=False,
        server_default="autonomous",
    ),
    Column("escalation_sent_at", DateTime(timezone=True)),
    *_timestamp_cols(),
)

Table(
    "test",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column("name", String(255), nullable=False),
    Column("mode", _enum_col("test_mode"), nullable=False),
    Column(
        "status",
        _enum_col("test_status"),
        nullable=False,
        server_default="draft",
    ),
    Column(
        "visibility",
        _enum_col("test_visibility"),
        nullable=False,
        server_default="library",
    ),
    Column(
        "timed",
        postgresql.BOOLEAN(),
        nullable=False,
        server_default=text("false"),
    ),
    Column("duration_minutes", Integer),
    Column("pause_allowance", Integer),
    Column(
        "timeout_behaviour",
        _enum_col("timeout_behaviour"),
        nullable=False,
        server_default="auto_submit",
    ),
    Column(
        "max_pause_duration_minutes",
        Integer,
        nullable=False,
        server_default=text("30"),
    ),
    Column("pass_threshold", Float),
    Column("target_difficulty", Integer),
    Column(
        "lock_mode",
        _enum_col("lock_mode"),
        nullable=False,
        server_default="open",
    ),
    Column("campaign_id", PG_UUID(as_uuid=True), index=True),
    Column(
        "randomise_question_order",
        postgresql.BOOLEAN(),
        nullable=False,
        server_default=text("true"),
    ),
    Column(
        "randomise_option_order",
        postgresql.BOOLEAN(),
        nullable=False,
        server_default=text("true"),
    ),
    Column("benchmark_scope", _enum_col("benchmark_scope")),
    Column(
        "benchmark_target_testee_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.app_user.id"),
    ),
    *_timestamp_cols(),
)

Table(
    "question",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "test_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.test.id"),
        index=True,
    ),
    Column(
        "attempt_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.attempt.id"),
        index=True,
    ),
    Column(
        "pill_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.pill.id"),
        index=True,
    ),
    Column("type", _enum_col("question_type"), nullable=False),
    Column("config", JSONB, nullable=False),
    Column("assigned_difficulty", Integer, nullable=False),
    Column("question_group_id", PG_UUID(as_uuid=True), index=True),
    Column(
        "realism_flag_count",
        Integer,
        nullable=False,
        server_default=text("0"),
    ),
    # NOTE: ``attempt_position`` + ``uq_question_attempt_position``
    # added by 0007 (P10).
    *_ai_provenance_cols(),
    *_timestamp_cols(),
)

Table(
    "anchor_question",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "pill_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.pill.id", ondelete="CASCADE"),
        nullable=False,
    ),
    Column("band", Integer, nullable=False),
    Column("type", _enum_col("question_type"), nullable=False),
    Column("config", JSONB, nullable=False),
    Column("assigned_difficulty", Integer, nullable=False),
    Column("effective_difficulty", Float),
    Column(
        "total_attempts",
        Integer,
        nullable=False,
        server_default=text("0"),
    ),
    Column("pass_rate", Float),
    Column("partial_credit_distribution", JSONB),
    Column(
        "regeneration_attempts",
        Integer,
        nullable=False,
        server_default=text("0"),
    ),
    Column(
        "excluded",
        postgresql.BOOLEAN(),
        nullable=False,
        server_default=text("false"),
    ),
    Column("excluded_reason", String(1024)),
    Column(
        "needs_admin_attention",
        postgresql.BOOLEAN(),
        nullable=False,
        server_default=text("false"),
    ),
    *_ai_provenance_cols(),
    *_timestamp_cols(),
    Index("ix_anchor_question_pill_band", "pill_id", "band"),
)

Table(
    "attempt",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "test_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.test.id"),
        nullable=False,
        index=True,
    ),
    Column(
        "testee_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.app_user.id"),
        nullable=False,
        index=True,
    ),
    Column("origin", _enum_col("attempt_origin"), nullable=False),
    # NOTE: ``assignment_id`` + ``ix_attempt_assignment_id`` added by
    # 0004 (P4); ``uq_attempt_test_testee_sequence`` added by 0005 (P4).
    Column(
        "sequence_number",
        Integer,
        nullable=False,
        server_default=text("1"),
    ),
    Column(
        "parent_attempt_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.attempt.id"),
        index=True,
    ),
    Column("started_at", DateTime(timezone=True)),
    Column("submitted_at", DateTime(timezone=True)),
    Column("time_remaining_seconds", Integer),
    Column("overall_score", Float),
    Column("outcome", String(32)),
    Column("shuffle_seed", Integer),
    Column("question_snapshot", JSONB),
    Column(
        "pauses_used",
        Integer,
        nullable=False,
        server_default=text("0"),
    ),
    Column(
        "total_pause_duration_seconds",
        Integer,
        nullable=False,
        server_default=text("0"),
    ),
    *_timestamp_cols(),
)

Table(
    "response",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "attempt_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.attempt.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "question_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.question.id"),
        nullable=False,
        index=True,
    ),
    Column("answer_payload", JSONB),
    Column("response_score", Float),
    Column("time_ms", Integer),
    *_timestamp_cols(),
    UniqueConstraint("attempt_id", "question_id", name="uq_response_attempt_question"),
)

Table(
    "grade",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "response_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.response.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    ),
    Column("score", Float, nullable=False),
    Column("verdict", _enum_col("grade_verdict"), nullable=False),
    Column("source", _enum_col("grade_source"), nullable=False),
    Column("ai_reasoning", String),
    Column(
        "overlap_flagged",
        postgresql.BOOLEAN(),
        nullable=False,
        server_default=text("false"),
    ),
    Column("overlap_pct", Float),
    Column(
        "overridden_by",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.app_user.id"),
    ),
    Column("overridden_at", DateTime(timezone=True)),
    *_ai_provenance_cols(),
    *_timestamp_cols(),
)

Table(
    "grade_review",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "grade_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.grade.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    ),
    Column(
        "status",
        _enum_col("review_status"),
        nullable=False,
        server_default="pending",
    ),
    Column("review_reasoning", String),
    *_ai_provenance_cols(),
    *_timestamp_cols(),
)

Table(
    "weakness_report",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "attempt_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.attempt.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "routed_to_admin",
        postgresql.BOOLEAN(),
        nullable=False,
        server_default=text("false"),
    ),
    *_ai_provenance_cols(),
    *_timestamp_cols(),
)

Table(
    "learning_material",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "pill_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.pill.id"),
        nullable=False,
        index=True,
    ),
    Column(
        "testee_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.app_user.id"),
        index=True,
    ),
    Column(
        "weakness_report_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.weakness_report.id"),
    ),
    Column("source", _enum_col("learning_material_source"), nullable=False),
    Column("content", String),
    Column("served_at", DateTime(timezone=True)),
    Column("served_text", String),
    *_ai_provenance_cols(),
    *_timestamp_cols(),
)

Table(
    "competency_profile",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "testee_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.app_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "pill_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.pill.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("competence_estimate", Float),
    Column("latest_band", Integer),
    Column(
        "retake_count",
        Integer,
        nullable=False,
        server_default=text("0"),
    ),
    Column("trend", String(16)),
    Column("last_activity_at", DateTime(timezone=True)),
    *_timestamp_cols(),
    UniqueConstraint("testee_id", "pill_id", name="uq_competency_testee_pill"),
)

Table(
    "drive_chunk",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column("source_doc_ref", String(1024), nullable=False),
    Column("chunk_index", Integer, nullable=False),
    Column("chunk_text", String, nullable=False),
    Column("content_hash", String(64), nullable=False, index=True),
    Column("embedding", Vector(1536)),
    Column(
        "indexed_at",
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    ),
    # NOTE: AIProvenanceMixin (6 columns) joined via 0006 (P9).
    *_timestamp_cols(),
)

Table(
    "realism_flag",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "question_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.question.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "testee_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.app_user.id"),
        nullable=False,
        index=True,
    ),
    Column("generation_context", JSONB),
    *_timestamp_cols(),
    UniqueConstraint("question_id", "testee_id", name="uq_realism_question_testee"),
)

Table(
    "system_settings",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column("monthly_ai_budget", Float),
    Column(
        "budget_alert_thresholds",
        JSONB,
        nullable=False,
        server_default=text("'[50, 80, 100]'::jsonb"),
    ),
    Column(
        "self_initiated_rate_limit_per_hour",
        Integer,
        nullable=False,
        server_default=text("5"),
    ),
    Column(
        "self_initiated_rate_limit_per_day",
        Integer,
        nullable=False,
        server_default=text("20"),
    ),
    Column(
        "model_by_operation",
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    ),
    Column(
        "provider_by_operation",
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    ),
    Column(
        "review_provider",
        String(32),
        nullable=False,
        server_default=text("'openai'"),
    ),
    Column(
        "pending_assignment_age_threshold_days",
        Integer,
        nullable=False,
        server_default=text("7"),
    ),
    Column(
        "reminder_schedule_with_deadline_days_before",
        JSONB,
        nullable=False,
        server_default=text("'[7, 1]'::jsonb"),
    ),
    Column(
        "reminder_schedule_no_deadline_days_after",
        JSONB,
        nullable=False,
        server_default=text("'[14, 30]'::jsonb"),
    ),
    Column(
        "escalation_enabled",
        postgresql.BOOLEAN(),
        nullable=False,
        server_default=text("true"),
    ),
    Column(
        "competence_decay_halflife_days",
        Integer,
        nullable=False,
        server_default=text("90"),
    ),
    Column(
        "competence_sensitivity",
        Float,
        nullable=False,
        server_default=text("2.0"),
    ),
    Column(
        "max_pause_duration_minutes",
        Integer,
        nullable=False,
        server_default=text("30"),
    ),
    Column(
        "safety_keyword_list",
        JSONB,
        nullable=False,
        server_default=text(
            '\'["lift", "scaffold", "asbestos", "isocyanate", '
            '"cathodic", "confined space", "fall", "PPE", "high voltage", '
            '"hot work", "fire", "electrical", "hazardous", "toxic"]\'::jsonb'
        ),
    ),
    Column(
        "anchor_pool_size_per_band",
        Integer,
        nullable=False,
        server_default=text("20"),
    ),
    Column(
        "anchor_calibration_confidence_threshold",
        Integer,
        nullable=False,
        server_default=text("20"),
    ),
    Column(
        "anchor_calibration_prior_weight",
        Integer,
        nullable=False,
        server_default=text("20"),
    ),
    Column("drive_folder_id", String(255)),
    Column(
        "embedding_model",
        String(64),
        nullable=False,
        server_default=text("'text-embedding-3-small'"),
    ),
    *_timestamp_cols(),
    UniqueConstraint("tenant_id", name="uq_system_settings_tenant"),
)

Table(
    "audit_log",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "actor_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.app_user.id"),
    ),
    Column("action", String(128), nullable=False),
    Column("target_entity", String(64)),
    Column("target_id", PG_UUID(as_uuid=True)),
    Column("detail", JSONB),
    *_timestamp_cols(),
)


# Supporting / join tables

Table(
    "group_member",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "group_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.group.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "user_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.app_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    *_timestamp_cols(),
    UniqueConstraint("group_id", "user_id", name="uq_group_member"),
)

Table(
    "pill_safety_link",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "pill_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.pill.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("url", String(2048), nullable=False),
    Column("title", String(512)),
    Column("source", String(255)),
    Column("last_verified_at", DateTime(timezone=True)),
    Column("content_hash", String(64)),
    *_timestamp_cols(),
)

Table(
    "pill_related",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "pill_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.pill.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "related_pill_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.pill.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    *_timestamp_cols(),
    UniqueConstraint("pill_id", "related_pill_id", name="uq_pill_related"),
    CheckConstraint("pill_id != related_pill_id", name="ck_pill_related_no_self"),
)

Table(
    "learning_path_pill",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "learning_path_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.learning_path.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "pill_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.pill.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("position", Integer, nullable=False),
    *_timestamp_cols(),
    UniqueConstraint("learning_path_id", "pill_id", name="uq_learning_path_pill"),
)

Table(
    "assignment_assignee",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "assignment_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.assignment.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "user_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.app_user.id"),
        nullable=False,
        index=True,
    ),
    Column(
        "via_group_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.group.id"),
    ),
    *_timestamp_cols(),
    UniqueConstraint("assignment_id", "user_id", name="uq_assignment_assignee"),
)

Table(
    "assignment_reminder",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "assignment_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.assignment.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("kind", _enum_col("assignment_reminder_kind"), nullable=False),
    Column(
        "sent_at",
        DateTime(timezone=True),
        server_default=text("now()"),
        nullable=False,
    ),
    *_timestamp_cols(),
)

Table(
    "attempt_pause_event",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "attempt_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.attempt.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("started_at", DateTime(timezone=True), nullable=False),
    Column("ended_at", DateTime(timezone=True)),
    Column("duration_seconds", Integer),
    Column(
        "auto_resumed",
        postgresql.BOOLEAN(),
        nullable=False,
        server_default=text("false"),
    ),
    # NOTE: ``reason`` added by 0007 (P10).
    *_timestamp_cols(),
)

Table(
    "attempt_focus_event",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "attempt_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.attempt.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("kind", _enum_col("focus_event_kind"), nullable=False),
    Column("occurred_at", DateTime(timezone=True), nullable=False),
    Column("duration_seconds", Integer),
    *_timestamp_cols(),
)

Table(
    "attempt_anchor",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "attempt_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.attempt.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "anchor_question_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.anchor_question.id"),
        nullable=False,
        index=True,
    ),
    Column("score", Float),
    *_timestamp_cols(),
    UniqueConstraint("attempt_id", "anchor_question_id", name="uq_attempt_anchor"),
)

Table(
    "weakness_report_pill",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "weakness_report_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.weakness_report.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column(
        "pill_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.pill.id"),
        nullable=False,
        index=True,
    ),
    Column("severity", Float, nullable=False),
    *_timestamp_cols(),
    UniqueConstraint("weakness_report_id", "pill_id", name="uq_weakness_report_pill"),
)

Table(
    "processing_tasks",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column("task_name", String(255), nullable=False, index=True),
    Column(
        "status",
        _enum_col("processing_task_status"),
        nullable=False,
        server_default="pending",
        index=True,
    ),
    Column("payload", JSONB),
    Column("error", String),
    Column("started_at", DateTime(timezone=True)),
    Column("finished_at", DateTime(timezone=True)),
    *_timestamp_cols(),
)

Table(
    "account_setup_token",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "user_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.app_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("token_hash", String(255), nullable=False, unique=True),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column("used_at", DateTime(timezone=True)),
    *_timestamp_cols(),
)

Table(
    "password_reset_token",
    metadata,
    _id_col(),
    _tenant_fk_col(),
    Column(
        "user_id",
        PG_UUID(as_uuid=True),
        ForeignKey(f"{SCHEMA}.app_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("token_hash", String(255), nullable=False, unique=True),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column("used_at", DateTime(timezone=True)),
    *_timestamp_cols(),
)


def upgrade() -> None:
    op.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
    # AC-D22: assert pgvector (init.sql owns creation; assert here too).
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    for name, values in ENUMS.items():
        labels = ", ".join(f"'{v}'" for v in values)
        op.execute(f"CREATE TYPE {SCHEMA}.{name} AS ENUM ({labels})")

    tables = metadata.sorted_tables  # parent -> child (FK order)
    for table in tables:
        op.execute(str(CreateTable(table).compile(dialect=_DIALECT)))
        for index in table.indexes:
            op.execute(str(CreateIndex(index).compile(dialect=_DIALECT)))

    # AC-D22: IVFFlat on the 1536-dim embedding. lists=100 is
    # over-provisioned for the v1 small corpus (pgvector guidance ~
    # rows/1000) and is a tuneable to revisit past ~50k chunks; cosine
    # ops because text-embedding-3-small vectors are normalised.
    op.execute(
        f"CREATE INDEX ix_drive_chunk_embedding ON {SCHEMA}.drive_chunk "
        "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )

    # Backstop updated_at regardless of how the UPDATE is issued
    # (Gitar PR-#6 finding). Every table uses TimestampMixin.
    op.execute(
        f"CREATE OR REPLACE FUNCTION {SCHEMA}.set_updated_at() "
        "RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); "
        "RETURN NEW; END; $$ LANGUAGE plpgsql"
    )
    for table in tables:
        op.execute(
            f"CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON "
            f"{_qname(table.name)} FOR EACH ROW "
            f"EXECUTE FUNCTION {SCHEMA}.set_updated_at()"
        )

    # --- Single-tenant seed rows (stable UUIDs, AC-CD3) ---------------
    op.execute(
        f"INSERT INTO {SCHEMA}.tenant (id, name) VALUES ('{_SEED_TENANT_ID}', 'KBC')"
    )
    # All knob columns fall back to their v1.3 server_defaults.
    op.execute(
        f"INSERT INTO {SCHEMA}.system_settings (tenant_id) VALUES ('{_SEED_TENANT_ID}')"
    )
    for gid, gname in (
        (_SEED_GROUP_ALL_USERS_ID, "All Users"),
        (_SEED_GROUP_ALL_TESTEES_ID, "All Testees"),
        (_SEED_GROUP_ALL_ADMINS_ID, "All Administrators"),
    ):
        op.execute(
            f"INSERT INTO {SCHEMA}."
            f'"group" (id, tenant_id, name, is_system) '
            f"VALUES ('{gid}', '{_SEED_TENANT_ID}', '{gname}', true)"
        )


def downgrade() -> None:
    tables = list(reversed(metadata.sorted_tables))  # child -> parent
    for table in tables:
        op.execute(f"DROP TRIGGER IF EXISTS trg_set_updated_at ON {_qname(table.name)}")
    op.execute(f"DROP FUNCTION IF EXISTS {SCHEMA}.set_updated_at()")
    for table in tables:
        op.execute(f"DROP TABLE IF EXISTS {_qname(table.name)} CASCADE")
    for name in ENUMS:
        op.execute(f"DROP TYPE IF EXISTS {SCHEMA}.{name}")
    # The `vector` extension is owned by infra/postgres/init.sql; this
    # migration only asserts it, so it is not dropped here.
