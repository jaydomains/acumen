"""SQLAlchemy 2.0 models — single ``acumen`` schema (AC-CD3 / AC-CD4).

Slice 1 of P1: the core SPEC §5 entity tables + their PG enums. Join and
supporting tables (group_member, pill_safety_link, attempt_anchor,
processing_tasks, auth tokens, …) land in Slice 2; the Alembic migration
in Slice 3. Conventions: UUID PKs ``gen_random_uuid()``;
``created_at``/``updated_at`` timestamptz ``now()`` (``updated_at`` via
``onupdate``); ``tenant_id`` on every tenant-scoped table (v1
single-tenant — RLS is a documented SiteMesh port seam, not built);
SQLAlchemy 2.0 ``Mapped[]`` style.
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy import (
    ForeignKey,
    Index,
    MetaData,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.config import get_settings

_SCHEMA = get_settings().db_schema

# --- Stable seed identifiers (refinement #1) ---------------------------
# Literal constants shared by the migration seed and the schema tests, so
# they survive Alembic down/up cycles unchanged. Never runtime-generated.
SEED_TENANT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
SEED_GROUP_ALL_USERS_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
SEED_GROUP_ALL_TESTEES_ID = uuid.UUID("00000000-0000-0000-0000-000000000011")
SEED_GROUP_ALL_ADMINS_ID = uuid.UUID("00000000-0000-0000-0000-000000000012")


class Base(DeclarativeBase):
    metadata = MetaData(schema=_SCHEMA)


# --- PG enums (AC-CD4). user.role is a String, not an enum, per AC-D2 --


class UserStatus(str, enum.Enum):
    active = "active"
    deactivated = "deactivated"


class LoopMode(str, enum.Enum):
    autonomous = "autonomous"
    admin_reviewed = "admin_reviewed"


class TestMode(str, enum.Enum):
    per_testee = "per_testee"
    frozen = "frozen"
    hand_authored = "hand_authored"
    benchmark = "benchmark"


class TestStatus(str, enum.Enum):
    draft = "draft"
    published = "published"


class TestVisibility(str, enum.Enum):
    library = "library"
    private = "private"


class TimeoutBehaviour(str, enum.Enum):
    auto_submit = "auto_submit"
    expire = "expire"


class LockMode(str, enum.Enum):
    open = "open"
    campaign_locked = "campaign_locked"


class BenchmarkScope(str, enum.Enum):
    subject = "subject"
    pill = "pill"
    path = "path"


class QuestionType(str, enum.Enum):
    multiple_choice = "multiple_choice"
    true_false = "true_false"
    matching = "matching"
    short_answer = "short_answer"
    scenario = "scenario"


class AttemptOrigin(str, enum.Enum):
    self_initiated = "self_initiated"
    assignment_driven = "assignment_driven"
    loop_driven = "loop_driven"


class GradeVerdict(str, enum.Enum):
    full = "full"
    partial = "partial"
    none = "none"


class GradeSource(str, enum.Enum):
    auto = "auto"
    ai = "ai"
    admin_override = "admin_override"


class ReviewStatus(str, enum.Enum):
    # Three-state per amended AC-D19 (v1.3): pending is the fail-soft
    # state when the review provider is unreachable at submit time;
    # confirmed and flagged are terminal.
    pending = "pending"
    confirmed = "confirmed"
    flagged = "flagged"


class LearningMaterialSource(str, enum.Enum):
    ai_generated = "ai_generated"
    admin_reference = "admin_reference"
    curated_safety_links = "curated_safety_links"


def _enum(py_enum: type[enum.Enum], name: str) -> SAEnum:
    return SAEnum(py_enum, name=name, schema=_SCHEMA, native_enum=True)


# --- Reusable column helpers ------------------------------------------


def _pk() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )


def _tenant_fk() -> Mapped[uuid.UUID]:
    # tenant_id on every scoped table, indexed (AC-CD3/AC-CD4). v1 is
    # single-tenant; RLS is a SiteMesh port seam, not built in v1.
    return mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{_SCHEMA}.tenant.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        server_default=text("now()"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=text("now()"), onupdate=text("now()"), nullable=False
    )


class AIProvenanceMixin:
    """Per-row AI provenance + cost capture (AC-D18 / AC-CD8).

    P1 ships the columns only — the per-call capture wiring is P5. The
    prompt version is persisted on the row (never global) per AC-CD8.
    Embedding/review spend is tracked to the owning provider per
    amended AC-D18 (e.g. ``grade_review`` rows carry the OpenAI side).
    """

    ai_provider: Mapped[str | None] = mapped_column(String(32))
    ai_model: Mapped[str | None] = mapped_column(String(128))
    ai_prompt_version: Mapped[str | None] = mapped_column(String(64))
    ai_prompt_tokens: Mapped[int | None]
    ai_completion_tokens: Mapped[int | None]
    ai_cost_usd: Mapped[float | None]


# --- Core SPEC §5 entities --------------------------------------------


class Tenant(Base, TimestampMixin):
    """Deploying organisation. v1 ships single-tenant (one seed row)."""

    __tablename__ = "tenant"

    id: Mapped[uuid.UUID] = _pk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)


class AppUser(Base, TimestampMixin):
    """User (AC-D2/D10/D16/CD5). ``role`` is an open String, not an enum,
    per AC-D2 so future roles need no schema change."""

    __tablename__ = "app_user"
    __table_args__ = (UniqueConstraint("email", name="uq_app_user_email"),)

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[UserStatus] = mapped_column(
        _enum(UserStatus, "user_status"),
        nullable=False,
        server_default=UserStatus.active.value,
    )
    status_changed_at: Mapped[datetime | None]
    privacy_ack_at: Mapped[datetime | None]


class Group(Base, TimestampMixin):
    """Group for bulk assignment/reporting (AC-D15). Three system-defined
    groups (``is_system=true``) are immutable and seeded."""

    __tablename__ = "group"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1024))
    is_system: Mapped[bool] = mapped_column(nullable=False, server_default=text("false"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{_SCHEMA}.app_user.id")
    )


class Subject(Base, TimestampMixin):
    """Top-level catalogue category (AC-D7)."""

    __tablename__ = "subject"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2048))


class Pill(Base, TimestampMixin):
    """Content unit (AC-D7). ``safety_relevant`` auto-tagged (AC-D21);
    ``discoverable`` per AC-D8; ``retired_at`` per AC-D14. ``safety_links``
    and related-pill references are join tables (Slice 2)."""

    __tablename__ = "pill"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{_SCHEMA}.subject.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(4096))
    available_difficulty_min: Mapped[int] = mapped_column(nullable=False)
    available_difficulty_max: Mapped[int] = mapped_column(nullable=False)
    discoverable: Mapped[bool] = mapped_column(
        nullable=False, server_default=text("true")
    )
    safety_relevant: Mapped[bool] = mapped_column(
        nullable=False, server_default=text("false")
    )
    estimated_minutes: Mapped[int | None]
    retired_at: Mapped[datetime | None]


class LearningPath(Base, TimestampMixin):
    """Named pill bundle (AC-D7). Personal Testee paths set ``is_private``
    + ``owner_user_id`` (AC-D8). Ordered pills are a join table (Slice 2)."""

    __tablename__ = "learning_path"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2048))
    is_private: Mapped[bool] = mapped_column(nullable=False, server_default=text("false"))
    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{_SCHEMA}.app_user.id")
    )


class Assignment(Base, TimestampMixin):
    """Admin instruction to engage a pill/path (AC-D6/D15/D26).

    NOTE: ``engagement_status`` is intentionally **not** a column — it is
    derived at read time from attempt history per AC-D26. Reminder send
    history and assignee snapshot are join tables (Slice 2);
    ``escalation_sent_at`` caps escalation to one notification (AC-D26).
    """

    __tablename__ = "assignment"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    assigner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{_SCHEMA}.app_user.id"),
        nullable=False,
        index=True,
    )
    pill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{_SCHEMA}.pill.id"), index=True
    )
    learning_path_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{_SCHEMA}.learning_path.id"), index=True
    )
    difficulty: Mapped[int] = mapped_column(nullable=False)
    deadline: Mapped[datetime | None]
    is_mandatory: Mapped[bool] = mapped_column(
        nullable=False, server_default=text("false")
    )
    loop_mode: Mapped[LoopMode] = mapped_column(
        _enum(LoopMode, "loop_mode"),
        nullable=False,
        server_default=LoopMode.autonomous.value,
    )
    escalation_sent_at: Mapped[datetime | None]


class Test(Base, TimestampMixin):
    """Generation spec / frozen / hand-authored / benchmark
    (AC-D3/D5/D11/D13/D24)."""

    __tablename__ = "test"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    mode: Mapped[TestMode] = mapped_column(_enum(TestMode, "test_mode"), nullable=False)
    status: Mapped[TestStatus] = mapped_column(
        _enum(TestStatus, "test_status"),
        nullable=False,
        server_default=TestStatus.draft.value,
    )
    visibility: Mapped[TestVisibility] = mapped_column(
        _enum(TestVisibility, "test_visibility"),
        nullable=False,
        server_default=TestVisibility.library.value,
    )
    timed: Mapped[bool] = mapped_column(nullable=False, server_default=text("false"))
    duration_minutes: Mapped[int | None]
    pause_allowance: Mapped[int | None]
    timeout_behaviour: Mapped[TimeoutBehaviour] = mapped_column(
        _enum(TimeoutBehaviour, "timeout_behaviour"),
        nullable=False,
        server_default=TimeoutBehaviour.auto_submit.value,
    )
    max_pause_duration_minutes: Mapped[int] = mapped_column(
        nullable=False, server_default=text("30")
    )
    pass_threshold: Mapped[float | None]
    target_difficulty: Mapped[int | None]
    # AC-D24 shared-test integrity (frozen / hand-authored).
    lock_mode: Mapped[LockMode] = mapped_column(
        _enum(LockMode, "lock_mode"),
        nullable=False,
        server_default=LockMode.open.value,
    )
    campaign_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    randomise_question_order: Mapped[bool] = mapped_column(
        nullable=False, server_default=text("true")
    )
    randomise_option_order: Mapped[bool] = mapped_column(
        nullable=False, server_default=text("true")
    )
    # AC-D13 benchmark scope/target.
    benchmark_scope: Mapped[BenchmarkScope | None] = mapped_column(
        _enum(BenchmarkScope, "benchmark_scope")
    )
    benchmark_target_testee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{_SCHEMA}.app_user.id")
    )


class Question(Base, TimestampMixin, AIProvenanceMixin):
    """A single test item (AC-D5/D17/D20/D22/D24).

    Three-way nullable FK ownership (``test_id`` XOR ``attempt_id`` XOR
    ``pill_id``) is intentional and not a normalisation defect: a
    question's owner depends on its origin —
      * ``test_id``    — frozen / hand-authored test (AC-D5)
      * ``attempt_id`` — per-Testee snapshot, lives against the attempt
                         (AC-D5 generation / AC-D17 snapshot)
      * ``pill_id``    — anchor-pool question, frozen against the pill
                         (AC-D20)
    Exactly one is set per row; modelling them as one table keeps grading
    and shuffle logic uniform across all three origins.
    """

    __tablename__ = "question"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    test_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{_SCHEMA}.test.id"), index=True
    )
    attempt_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{_SCHEMA}.attempt.id"), index=True
    )
    pill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{_SCHEMA}.pill.id"), index=True
    )
    type: Mapped[QuestionType] = mapped_column(
        _enum(QuestionType, "question_type"), nullable=False
    )
    config: Mapped[dict] = mapped_column(JSONB, nullable=False)
    assigned_difficulty: Mapped[int] = mapped_column(nullable=False)
    question_group_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), index=True
    )
    realism_flag_count: Mapped[int] = mapped_column(
        nullable=False, server_default=text("0")
    )


class AnchorQuestion(Base, TimestampMixin, AIProvenanceMixin):
    """Per ``(pill_id, band)`` frozen anchor pool (AC-D20/D23/D27).

    ``effective_difficulty`` is Bayesian-shrinkage, recomputed by the
    daily calibration cron (AC-D27), not at read time. AC-D23 bootstrap
    self-review fields: ``regeneration_attempts`` (≤3),
    ``excluded``/``excluded_reason``/``needs_admin_attention``.
    """

    __tablename__ = "anchor_question"
    __table_args__ = (
        # Calibration hot path is per pill+band (AC-CD4).
        Index("ix_anchor_question_pill_band", "pill_id", "band"),
    )

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    pill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{_SCHEMA}.pill.id", ondelete="CASCADE"),
        nullable=False,
    )
    band: Mapped[int] = mapped_column(nullable=False)
    type: Mapped[QuestionType] = mapped_column(
        _enum(QuestionType, "question_type"), nullable=False
    )
    config: Mapped[dict] = mapped_column(JSONB, nullable=False)
    assigned_difficulty: Mapped[int] = mapped_column(nullable=False)
    effective_difficulty: Mapped[float | None]
    total_attempts: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))
    pass_rate: Mapped[float | None]
    partial_credit_distribution: Mapped[dict | None] = mapped_column(JSONB)
    regeneration_attempts: Mapped[int] = mapped_column(
        nullable=False, server_default=text("0")
    )
    excluded: Mapped[bool] = mapped_column(nullable=False, server_default=text("false"))
    excluded_reason: Mapped[str | None] = mapped_column(String(1024))
    needs_admin_attention: Mapped[bool] = mapped_column(
        nullable=False, server_default=text("false")
    )


class Attempt(Base, TimestampMixin):
    """A Testee's run at a test (AC-D3/D4/D11/D17/D18/D20/D24).

    ``question_snapshot`` is populated for frozen/hand-authored attempts
    only (AC-D17). ``shuffle_seed`` derives from the attempt id at start
    (AC-D24). Pause/focus events and anchor draws are join tables
    (Slice 2)."""

    __tablename__ = "attempt"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{_SCHEMA}.test.id"),
        nullable=False,
        index=True,
    )
    testee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{_SCHEMA}.app_user.id"),
        nullable=False,
        index=True,
    )
    origin: Mapped[AttemptOrigin] = mapped_column(
        _enum(AttemptOrigin, "attempt_origin"), nullable=False
    )
    sequence_number: Mapped[int] = mapped_column(nullable=False, server_default=text("1"))
    parent_attempt_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{_SCHEMA}.attempt.id"), index=True
    )
    started_at: Mapped[datetime | None]
    submitted_at: Mapped[datetime | None]
    time_remaining_seconds: Mapped[int | None]
    overall_score: Mapped[float | None]
    outcome: Mapped[str | None] = mapped_column(String(32))
    shuffle_seed: Mapped[int | None]
    question_snapshot: Mapped[dict | None] = mapped_column(JSONB)
    pauses_used: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))
    total_pause_duration_seconds: Mapped[int] = mapped_column(
        nullable=False, server_default=text("0")
    )


class Response(Base, TimestampMixin):
    """A Testee's answer to a question within an attempt (AC-D17)."""

    __tablename__ = "response"
    __table_args__ = (
        # Autosave is idempotent on (attempt, question) per AC-CD6.
        UniqueConstraint(
            "attempt_id", "question_id", name="uq_response_attempt_question"
        ),
    )

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{_SCHEMA}.attempt.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{_SCHEMA}.question.id"),
        nullable=False,
        index=True,
    )
    answer_payload: Mapped[dict | None] = mapped_column(JSONB)
    response_score: Mapped[float | None]
    time_ms: Mapped[int | None]


class Grade(Base, TimestampMixin, AIProvenanceMixin):
    """Assessment of a response (AC-D2/D4#5/D18/D19)."""

    __tablename__ = "grade"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    response_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{_SCHEMA}.response.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    score: Mapped[float] = mapped_column(nullable=False)
    verdict: Mapped[GradeVerdict] = mapped_column(
        _enum(GradeVerdict, "grade_verdict"), nullable=False
    )
    source: Mapped[GradeSource] = mapped_column(
        _enum(GradeSource, "grade_source"), nullable=False
    )
    ai_reasoning: Mapped[str | None]
    overlap_flagged: Mapped[bool] = mapped_column(
        nullable=False, server_default=text("false")
    )
    overlap_pct: Mapped[float | None]
    overridden_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{_SCHEMA}.app_user.id")
    )
    overridden_at: Mapped[datetime | None]


class GradeReview(Base, TimestampMixin, AIProvenanceMixin):
    """Cross-family review of a grade (AC-D19 v1.3).

    ``status`` is the three-state enum (pending/confirmed/flagged);
    pending is the fail-soft state on review-provider outage. AI
    provenance columns here carry the OpenAI review-pass cost, tracked
    separately from the Anthropic primary grade per amended AC-D18.
    """

    __tablename__ = "grade_review"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    grade_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{_SCHEMA}.grade.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    status: Mapped[ReviewStatus] = mapped_column(
        _enum(ReviewStatus, "review_status"),
        nullable=False,
        server_default=ReviewStatus.pending.value,
    )
    review_reasoning: Mapped[str | None]


class WeaknessReport(Base, TimestampMixin, AIProvenanceMixin):
    """Per-attempt weakness report (AC-D6/D21). Weak-pill list with
    severity is a join table (Slice 2)."""

    __tablename__ = "weakness_report"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{_SCHEMA}.attempt.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    routed_to_admin: Mapped[bool] = mapped_column(
        nullable=False, server_default=text("false")
    )


class LearningMaterial(Base, TimestampMixin, AIProvenanceMixin):
    """Explainer / reference / curated safety links (AC-D6/D21).

    AI-generated material is created per weakness instance per Testee, so
    a row is inherently per-serve: ``served_at`` + ``served_text`` (the
    snapshot for n-gram comparison) plus ``testee_id``/``pill_id`` give
    AC-D4 #5 its "last material served to this Testee for this pill"
    lookup without a separate serve-history table (addition #1 / AC-CD14).
    """

    __tablename__ = "learning_material"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    pill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{_SCHEMA}.pill.id"),
        nullable=False,
        index=True,
    )
    testee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{_SCHEMA}.app_user.id"), index=True
    )
    weakness_report_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{_SCHEMA}.weakness_report.id")
    )
    source: Mapped[LearningMaterialSource] = mapped_column(
        _enum(LearningMaterialSource, "learning_material_source"),
        nullable=False,
    )
    content: Mapped[str | None]
    served_at: Mapped[datetime | None]
    served_text: Mapped[str | None]


class CompetencyProfile(Base, TimestampMixin):
    """Per ``(testee_id, pill_id)`` competency (AC-D9).

    ``competence_estimate`` is nullable — null means "no data yet" (the
    loop treats it as needs-benchmark, not a failing score), never 0.0.
    """

    __tablename__ = "competency_profile"
    __table_args__ = (
        UniqueConstraint("testee_id", "pill_id", name="uq_competency_testee_pill"),
    )

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    testee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{_SCHEMA}.app_user.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pill_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{_SCHEMA}.pill.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    competence_estimate: Mapped[float | None]
    latest_band: Mapped[int | None]
    retake_count: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))
    trend: Mapped[str | None] = mapped_column(String(16))
    last_activity_at: Mapped[datetime | None]


class DriveChunk(Base, TimestampMixin):
    """Drive RAG index chunk (AC-D22). ``embedding`` is
    ``Vector(1536)`` — ``text-embedding-3-small``; IVFFlat index added in
    the migration (Slice 3)."""

    __tablename__ = "drive_chunk"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    source_doc_ref: Mapped[str] = mapped_column(String(1024), nullable=False)
    chunk_index: Mapped[int] = mapped_column(nullable=False)
    chunk_text: Mapped[str] = mapped_column(nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(1536))
    indexed_at: Mapped[datetime] = mapped_column(
        server_default=text("now()"), nullable=False
    )


class RealismFlag(Base, TimestampMixin):
    """Testee 'feels unrealistic' flag per question per Testee (AC-D22)."""

    __tablename__ = "realism_flag"
    __table_args__ = (
        UniqueConstraint("question_id", "testee_id", name="uq_realism_question_testee"),
    )

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{_SCHEMA}.question.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    testee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(f"{_SCHEMA}.app_user.id"),
        nullable=False,
        index=True,
    )
    generation_context: Mapped[dict | None] = mapped_column(JSONB)


class SystemSettings(Base, TimestampMixin):
    """Per-tenant configuration — one row per tenant. Defaults are the
    v1.3 values (AC-D9/D18/D19/D20/D21/D22/D26/D27); seeded in the
    migration (Slice 3)."""

    __tablename__ = "system_settings"
    __table_args__ = (UniqueConstraint("tenant_id", name="uq_system_settings_tenant"),)

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    monthly_ai_budget: Mapped[float | None]
    budget_alert_thresholds: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default=text("'[50, 80, 100]'::jsonb")
    )
    self_initiated_rate_limit_per_hour: Mapped[int] = mapped_column(
        nullable=False, server_default=text("5")
    )
    self_initiated_rate_limit_per_day: Mapped[int] = mapped_column(
        nullable=False, server_default=text("20")
    )
    model_by_operation: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    provider_by_operation: Mapped[dict] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    review_provider: Mapped[str] = mapped_column(
        String(32), nullable=False, server_default=text("'openai'")
    )
    pending_assignment_age_threshold_days: Mapped[int] = mapped_column(
        nullable=False, server_default=text("7")
    )
    reminder_schedule_with_deadline_days_before: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default=text("'[7, 1]'::jsonb")
    )
    reminder_schedule_no_deadline_days_after: Mapped[list] = mapped_column(
        JSONB, nullable=False, server_default=text("'[14, 30]'::jsonb")
    )
    escalation_enabled: Mapped[bool] = mapped_column(
        nullable=False, server_default=text("true")
    )
    competence_decay_halflife_days: Mapped[int] = mapped_column(
        nullable=False, server_default=text("90")
    )
    competence_sensitivity: Mapped[float] = mapped_column(
        nullable=False, server_default=text("2.0")
    )
    max_pause_duration_minutes: Mapped[int] = mapped_column(
        nullable=False, server_default=text("30")
    )
    safety_keyword_list: Mapped[list] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text(
            '\'["lift", "scaffold", "asbestos", "isocyanate", '
            '"cathodic", "confined space", "fall", "PPE", "high voltage", '
            '"hot work", "fire", "electrical", "hazardous", "toxic"]\'::jsonb'
        ),
    )
    anchor_pool_size_per_band: Mapped[int] = mapped_column(
        nullable=False, server_default=text("20")
    )
    anchor_calibration_confidence_threshold: Mapped[int] = mapped_column(
        nullable=False, server_default=text("20")
    )
    anchor_calibration_prior_weight: Mapped[int] = mapped_column(
        nullable=False, server_default=text("20")
    )
    drive_folder_id: Mapped[str | None] = mapped_column(String(255))
    embedding_model: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        server_default=text("'text-embedding-3-small'"),
    )


class AuditLog(Base, TimestampMixin):
    """Append-only record of significant state transitions (SPEC §5)."""

    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant_fk()
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey(f"{_SCHEMA}.app_user.id")
    )
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    target_entity: Mapped[str | None] = mapped_column(String(64))
    target_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    detail: Mapped[dict | None] = mapped_column(JSONB)
