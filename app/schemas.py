"""Pydantic v2 request/response models (CODE_SPEC §5 API contract).

P2 covers the auth + user-management surface. Email fields use the
light ``normalise_email`` rule from ``app.permissions`` rather than
``EmailStr`` so no unpinned ``email-validator`` dependency is added
(AC-CD1). A minimum password length is enforced here as a sane
default — the spec sets no password policy (AC-D10), so this is an
implementation choice, not spec drift.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated, Generic, Literal, TypeVar

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, model_validator

from app.models import (
    AttemptOrigin,
    BenchmarkScope,
    LoopMode,
    QuestionType,
    TestMode,
    TestStatus,
    TestVisibility,
    TimeoutBehaviour,
    UserStatus,
)
from app.permissions import VALID_ROLES, normalise_email

MIN_PASSWORD_LENGTH = 8

Email = Annotated[str, AfterValidator(normalise_email)]
Password = Annotated[str, Field(min_length=MIN_PASSWORD_LENGTH, max_length=1024)]


def _validate_role(value: str) -> str:
    if value not in VALID_ROLES:
        raise ValueError(f"role must be one of {sorted(VALID_ROLES)}")
    return value


Role = Annotated[str, AfterValidator(_validate_role)]


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --- Auth -------------------------------------------------------------


class LoginRequest(_Base):
    email: Email
    password: str


class TokenPair(_Base):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(_Base):
    refresh_token: str


class AccessToken(_Base):
    access_token: str
    token_type: str = "bearer"


class LogoutResponse(_Base):
    status: str = "ok"
    action: str = "discard_tokens"


class SetupConsumeRequest(_Base):
    token: str
    new_password: Password


class PasswordResetRequest(_Base):
    email: Email


class PasswordResetConsumeRequest(_Base):
    token: str
    new_password: Password


class MessageResponse(_Base):
    status: str = "ok"


class PrivacyAckResponse(_Base):
    status: str = "ok"
    privacy_ack_at: datetime


# --- Users ------------------------------------------------------------


class AdminCreateUserRequest(_Base):
    email: Email
    name: Annotated[str, Field(min_length=1, max_length=255)]
    role: Role


class UserResponse(_Base):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    email: str
    name: str
    role: str
    status: UserStatus
    privacy_ack_at: datetime | None
    created_at: datetime


# --- Catalogue (P3): Subjects / Pills / Paths / Groups ----------------
# CODE_SPEC §5: collections return {"data": [...], "meta": {...}} with
# cursor pagination; the error envelope is the APIError handler.

MIN_DIFFICULTY = 1
MAX_DIFFICULTY = 10

Name = Annotated[str, Field(min_length=1, max_length=255)]
ItemT = TypeVar("ItemT")


class PageMeta(_Base):
    next_cursor: str | None = None


class Page(_Base, Generic[ItemT]):
    data: list[ItemT]
    meta: PageMeta


class SubjectCreate(_Base):
    name: Name
    description: Annotated[str, Field(max_length=2048)] | None = None


class SubjectUpdate(_Base):
    name: Name | None = None
    description: Annotated[str, Field(max_length=2048)] | None = None


class SubjectResponse(_Base):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class _DifficultyRange(_Base):
    @model_validator(mode="after")
    def _check_range(self) -> _DifficultyRange:
        lo = getattr(self, "available_difficulty_min", None)
        hi = getattr(self, "available_difficulty_max", None)
        if lo is not None and hi is not None and lo > hi:
            raise ValueError(
                "available_difficulty_min must be <= available_difficulty_max"
            )
        return self


Difficulty = Annotated[int, Field(ge=MIN_DIFFICULTY, le=MAX_DIFFICULTY)]


class PillCreate(_DifficultyRange):
    subject_id: uuid.UUID
    name: Name
    description: Annotated[str, Field(max_length=4096)] | None = None
    available_difficulty_min: Difficulty
    available_difficulty_max: Difficulty
    discoverable: bool = True
    estimated_minutes: Annotated[int, Field(ge=1, le=100000)] | None = None


class PillUpdate(_DifficultyRange):
    name: Name | None = None
    description: Annotated[str, Field(max_length=4096)] | None = None
    available_difficulty_min: Difficulty | None = None
    available_difficulty_max: Difficulty | None = None
    discoverable: bool | None = None
    estimated_minutes: Annotated[int, Field(ge=1, le=100000)] | None = None


class PillSafetyOverride(_Base):
    safety_relevant: bool


class PillResponse(_Base):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    subject_id: uuid.UUID
    name: str
    description: str | None
    available_difficulty_min: int
    available_difficulty_max: int
    discoverable: bool
    safety_relevant: bool
    safety_relevant_overridden_at: datetime | None
    estimated_minutes: int | None
    retired_at: datetime | None
    created_at: datetime
    updated_at: datetime


class LearningPathCreate(_Base):
    name: Name
    description: Annotated[str, Field(max_length=2048)] | None = None
    pill_ids: list[uuid.UUID] = Field(default_factory=list)


class LearningPathUpdate(_Base):
    name: Name | None = None
    description: Annotated[str, Field(max_length=2048)] | None = None
    pill_ids: list[uuid.UUID] | None = None


class LearningPathResponse(_Base):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    name: str
    description: str | None
    is_private: bool
    owner_user_id: uuid.UUID | None
    pill_ids: list[uuid.UUID]
    created_at: datetime
    updated_at: datetime


class GroupCreate(_Base):
    name: Name
    description: Annotated[str, Field(max_length=1024)] | None = None


class GroupUpdate(_Base):
    name: Name | None = None
    description: Annotated[str, Field(max_length=1024)] | None = None


class GroupMemberRequest(_Base):
    user_id: uuid.UUID


class GroupResponse(_Base):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    name: str
    description: str | None
    is_system: bool
    member_ids: list[uuid.UUID]
    created_at: datetime
    updated_at: datetime


class PillProposalResponse(_Base):
    id: uuid.UUID
    status: str
    payload: dict | None
    created_at: datetime


# --- Tests / Questions (P4 Slice 1) -----------------------------------
# AC-D5 four test modes; AC-D11 timing/pause matrix; AC-D13 benchmark
# scope; AC-D17 forward-only edit; AC-D24 lock + shuffle toggles. The
# mode-field matrix is enforced here; lifecycle rules (lock guard,
# publish gate, question-config shape) live in ``app.domain.tests``.

_PAUSE_FREE_MAX_MINUTES = 60  # AC-D11: tests <=60min permit no pauses.
_DEFAULT_PAUSE_ALLOWANCE = 2  # AC-D11: tests >60min default to 2 pauses.


class TestCreate(_Base):
    name: Name
    mode: TestMode
    visibility: TestVisibility = TestVisibility.library
    timed: bool = False
    duration_minutes: Annotated[int, Field(ge=1, le=100000)] | None = None
    pause_allowance: Annotated[int, Field(ge=0, le=100)] | None = None
    timeout_behaviour: TimeoutBehaviour = TimeoutBehaviour.auto_submit
    max_pause_duration_minutes: Annotated[int, Field(ge=1, le=100000)] = 30
    pass_threshold: Annotated[float, Field(ge=0.0, le=1.0)] | None = None
    target_difficulty: Difficulty | None = None
    # ``lock_mode`` / ``campaign_id`` are not set at create — use the
    # explicit lock/unlock endpoints (AC-D24).
    randomise_question_order: bool | None = None
    randomise_option_order: bool | None = None
    benchmark_scope: BenchmarkScope | None = None
    benchmark_target_testee_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _check_matrix(self) -> TestCreate:
        shared = self.mode in (TestMode.frozen, TestMode.hand_authored)
        if self.mode == TestMode.benchmark:
            if self.benchmark_scope is None:
                raise ValueError("benchmark mode requires benchmark_scope")
        elif self.benchmark_scope is not None or self.benchmark_target_testee_id:
            raise ValueError("benchmark_scope is only valid for benchmark mode")
        if not shared and (
            self.randomise_question_order is not None
            or self.randomise_option_order is not None
        ):
            raise ValueError("randomise_* is only valid for frozen/hand_authored modes")
        if shared:
            if self.randomise_question_order is None:
                self.randomise_question_order = True
            if self.randomise_option_order is None:
                self.randomise_option_order = True
        else:
            self.randomise_question_order = True
            self.randomise_option_order = True
        if self.timed:
            if self.duration_minutes is None:
                raise ValueError("timed tests require duration_minutes")
            if self.duration_minutes <= _PAUSE_FREE_MAX_MINUTES:
                if self.pause_allowance not in (None, 0):
                    raise ValueError(
                        "tests of 60 minutes or less permit no pauses (AC-D11)"
                    )
                self.pause_allowance = 0
            elif self.pause_allowance is None:
                self.pause_allowance = _DEFAULT_PAUSE_ALLOWANCE
        else:
            if self.duration_minutes is not None or self.pause_allowance is not None:
                raise ValueError("untimed tests have no duration or pause allowance")
        return self


class TestUpdate(_Base):
    name: Name | None = None
    visibility: TestVisibility | None = None
    timed: bool | None = None
    duration_minutes: Annotated[int, Field(ge=1, le=100000)] | None = None
    pause_allowance: Annotated[int, Field(ge=0, le=100)] | None = None
    timeout_behaviour: TimeoutBehaviour | None = None
    max_pause_duration_minutes: Annotated[int, Field(ge=1, le=100000)] | None = None
    pass_threshold: Annotated[float, Field(ge=0.0, le=1.0)] | None = None
    target_difficulty: Difficulty | None = None
    randomise_question_order: bool | None = None
    randomise_option_order: bool | None = None


class TestResponse(_Base):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    name: str
    mode: TestMode
    status: TestStatus
    visibility: TestVisibility
    timed: bool
    duration_minutes: int | None
    pause_allowance: int | None
    timeout_behaviour: TimeoutBehaviour
    max_pause_duration_minutes: int
    pass_threshold: float | None
    target_difficulty: int | None
    lock_mode: str
    campaign_id: uuid.UUID | None
    randomise_question_order: bool
    randomise_option_order: bool
    benchmark_scope: BenchmarkScope | None
    benchmark_target_testee_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class CampaignLockRequest(_Base):
    campaign_id: uuid.UUID


class QuestionCreate(_Base):
    type: QuestionType
    config: dict
    assigned_difficulty: Difficulty
    question_group_id: uuid.UUID | None = None


class QuestionUpdate(_Base):
    config: dict | None = None
    assigned_difficulty: Difficulty | None = None
    question_group_id: uuid.UUID | None = None


class QuestionResponse(_Base):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: uuid.UUID
    test_id: uuid.UUID | None
    type: QuestionType
    config: dict
    assigned_difficulty: int
    question_group_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


# --- Assignments (P4 Slice 1) -----------------------------------------
# AC-D6 loop mode, AC-D15 individual + group targeting with assignee
# snapshot, AC-D26 mandatory/deadline. ``engagement_status`` is derived
# at read time (P4 Slice 3) so it does not appear on the response.


class AssignmentCreate(_Base):
    pill_id: uuid.UUID | None = None
    learning_path_id: uuid.UUID | None = None
    difficulty: Difficulty
    deadline: datetime | None = None
    is_mandatory: bool = False
    loop_mode: LoopMode = LoopMode.autonomous
    testee_ids: list[uuid.UUID] = Field(default_factory=list)
    group_ids: list[uuid.UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def _check_target(self) -> AssignmentCreate:
        if (self.pill_id is None) == (self.learning_path_id is None):
            raise ValueError("exactly one of pill_id or learning_path_id is required")
        if not self.testee_ids and not self.group_ids:
            raise ValueError("at least one of testee_ids or group_ids is required")
        return self


class AssignmentResponse(_Base):
    id: uuid.UUID
    assigner_id: uuid.UUID
    pill_id: uuid.UUID | None
    learning_path_id: uuid.UUID | None
    difficulty: int
    deadline: datetime | None
    is_mandatory: bool
    loop_mode: LoopMode
    assignee_ids: list[uuid.UUID]
    created_at: datetime
    updated_at: datetime


# --- Attempts (P4 Slice 2) --------------------------------------------
# Start / view / autosave / pause / resume / next (benchmark) / submit.
# AC-D26 v1.4: assignment-driven and loop-driven origin requires
# ``assignment_id``; self-initiated must not carry one.


class AttemptStartRequest(_Base):
    test_id: uuid.UUID
    origin: AttemptOrigin = AttemptOrigin.self_initiated
    assignment_id: uuid.UUID | None = None


class AutosaveRequest(_Base):
    question_id: uuid.UUID
    answer_payload: dict | None = None
    time_ms: Annotated[int, Field(ge=0, le=100_000_000)] | None = None


class AttemptView(_Base):
    id: uuid.UUID
    test_id: uuid.UUID
    testee_id: uuid.UUID
    assignment_id: uuid.UUID | None
    origin: AttemptOrigin
    sequence_number: int
    started_at: datetime | None
    submitted_at: datetime | None
    paused: bool
    pauses_used: int
    pause_allowance: int
    pause_seconds_remaining: int | None
    watermark: str | None
    questions: list[dict] | None


class BenchmarkNextResponse(_Base):
    done: bool
    step: int | None = None
    asked: int | None = None
    question: dict | None = None


# --- P4 Slice 3 results + engagement ----------------------------------
# F14 mixed-test display gate: a deterministic result page surfaces
# scores immediately; an attempt containing any AI-graded question
# returns ``status = "review_pending"`` until P6 review completes.


class AttemptResultResponse(_Base):
    attempt_id: uuid.UUID
    submitted_at: datetime
    status: str  # "ready" | "review_pending"
    overall_score: float | None = None
    outcome: str | None = None
    questions: list[dict] | None = None


class EngagementWidgetItem(_Base):
    assignment_id: uuid.UUID
    testee_id: uuid.UUID
    created_at: datetime
    deadline: datetime | None
    is_mandatory: bool


class EngagementWidgetResponse(_Base):
    data: list[EngagementWidgetItem]


class SweepResult(_Base):
    reminders_sent: int
    escalations_sent: int


class AnchorBandSummary(_Base):
    """One row of :class:`AnchorBootstrapResult.per_band_summary` —
    counts produced for one (pill, band) slot of the AC-D23 bootstrap."""

    band: int
    generated: int
    excluded: int


class AnchorBootstrapResult(_Base):
    """Telemetry returned by one anchor-pool bootstrap action (AC-D23
    bootstrap #1). Surfaced by ``POST /v1/admin/pills/{pill_id}/anchors/generate``;
    the body matches what the P11 bootstrap script will emit on every
    cross-pill orchestration pass so dashboards stay aligned.

    Cost-amplification note: per-pill totals scale as
    ``slots * 2`` (best case) to ``slots * 6`` (worst case) where
    ``slots = anchor_pool_size_per_band * len(supported_bands)``."""

    anchors_generated: int
    anchors_excluded: int
    total_generation_calls: int
    total_self_review_calls: int
    per_band_summary: list[AnchorBandSummary]


class GradeReviewReconcileResult(_Base):
    """Counts returned by one pass of the §8.9 grade-review reconcile
    sweep (AC-D19 v1.6 / AC-CD11 v1.7). Exposed via the admin trigger
    endpoint and the Celery task wrapper."""

    attempts_processed: int
    rows_confirmed: int
    rows_flagged: int
    rows_auto_flagged: int
    rows_still_pending: int


class FlaggedGradeReviewItem(_Base):
    """One flagged grade_review row waiting for admin resolution
    (AC-D19 v1.6: flagged grades surface in the admin queue). The
    admin sees the AI grade alongside the reviewer's pushback so the
    keep/accept/substitute decision is informed."""

    grade_review_id: uuid.UUID
    grade_id: uuid.UUID
    attempt_id: uuid.UUID
    question_id: uuid.UUID
    ai_score: float
    ai_verdict: str
    ai_reasoning: str | None
    review_reasoning: str | None
    created_at: datetime


class FlaggedGradeReviewListResponse(_Base):
    data: list[FlaggedGradeReviewItem]


class GradeReviewResolveRequest(_Base):
    """Admin resolution of a flagged grade_review (AC-D19 v1.6
    "admin chooses to keep the AI grade, accept the reviewer's
    verdict, or substitute their own"; AC-D2 override mechanism).

    * ``keep_ai`` — Grade.score / verdict / ai_reasoning unchanged;
      override columns set so the row is marked admin-resolved.
    * ``accept_reviewer`` — Grade.score → 0.0, verdict → none,
      ai_reasoning → ``grade_review.review_reasoning`` (so the
      reviewer's pushback is preserved on the Grade row).
    * ``substitute`` — admin supplies ``score`` (required, 0..1) and
      ``verdict`` (required, "full"|"partial"|"none"); ``reasoning``
      is optional but recommended.
    """

    action: Literal["keep_ai", "accept_reviewer", "substitute"]
    score: float | None = Field(default=None, ge=0.0, le=1.0)
    verdict: Literal["full", "partial", "none"] | None = None
    reasoning: str | None = None

    @model_validator(mode="after")
    def _check_substitute_required_fields(self) -> GradeReviewResolveRequest:
        if self.action == "substitute":
            if self.score is None or self.verdict is None:
                raise ValueError(
                    "action='substitute' requires both 'score' and 'verdict'"
                )
        return self


class GradeReviewResolveResult(_Base):
    """Response shape after a successful admin resolution. Returns the
    canonical post-resolution state of the underlying Grade so the
    admin UI can render the new score / outcome without a second
    round-trip."""

    grade_review_id: uuid.UUID
    grade_id: uuid.UUID
    attempt_id: uuid.UUID
    action: str
    grade_score: float
    grade_verdict: str
    attempt_overall_score: float | None
    attempt_outcome: str | None


# --- P7 adaptive loop admin queue (AC-D6 admin_reviewed mode) ----------


class LoopQueueItem(_Base):
    """A single WeaknessReport awaiting admin review (AC-D6
    admin_reviewed loop_mode). The admin sees the parent attempt + pill
    + AI-identified weak pills + overall score, then approves (creates
    the follow-up) or rejects (clears the routed_to_admin flag without
    further action)."""

    weakness_report_id: uuid.UUID
    attempt_id: uuid.UUID
    testee_id: uuid.UUID
    pill_id: uuid.UUID
    pill_name: str
    overall_score: float | None
    weak_pill_ids: list[uuid.UUID]
    created_at: datetime


class LoopQueueListResponse(_Base):
    data: list[LoopQueueItem]


class LoopApproveResult(_Base):
    """Response shape after a successful admin approval. Returns the
    number of follow-up Attempts created — one per weak pill in the
    report — so the admin UI can render a summary without a second
    round-trip."""

    weakness_report_id: uuid.UUID
    follow_up_count: int


class LoopRejectResult(_Base):
    """Response shape after a successful admin rejection. Compact
    payload — the flag is cleared and no follow-up created. Audit-
    logged at ``loop.queue.reject`` for operator traceability."""

    weakness_report_id: uuid.UUID
