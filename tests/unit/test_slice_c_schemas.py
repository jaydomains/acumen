"""Slice C — Pydantic schema validation for the row-enrichment sweep
+ realism status endpoint (FE-9-admin-ops.md §H(a) item 1 + 8).

Pure validation tests — required fields, literal enforcement,
optional/null handling. No DB / no FastAPI.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.schemas import (
    EngagementWidgetItem,
    FlaggedAnchorItem,
    FlaggedGradeReviewItem,
    LoopQueueItem,
    LoopRejectRequest,
    RealismStatusResponse,
    SweepResult,
)


def _engagement_row(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "assignment_id": uuid.uuid4(),
        "testee_id": uuid.uuid4(),
        "testee_name": "Tess Testee",
        "pill_or_test_name": "Antifouling",
        "assigner_name": "Ada Admin",
        "created_at": datetime.now(UTC),
        "deadline": None,
        "is_mandatory": True,
        "days_stale": 7,
        "reminders_sent": 0,
        "escalated": False,
    }
    base.update(overrides)
    return base


def test_engagement_widget_item_accepts_enriched_payload() -> None:
    item = EngagementWidgetItem(**_engagement_row())
    assert item.testee_name == "Tess Testee"
    assert item.pill_or_test_name == "Antifouling"
    assert item.assigner_name == "Ada Admin"
    assert item.days_stale == 7
    assert item.reminders_sent == 0
    assert item.escalated is False


def test_engagement_widget_item_requires_all_enrichment_fields() -> None:
    row = _engagement_row()
    row.pop("testee_name")
    with pytest.raises(ValidationError):
        EngagementWidgetItem(**row)


def test_sweep_result_includes_new_counters() -> None:
    swept_at = datetime.now(UTC)
    summary = SweepResult(
        reminders_sent=3,
        escalations_sent=1,
        first_reminders_sent=2,
        second_reminders_sent=1,
        assignments_processed=4,
        duration_ms=125,
        last_swept_at=swept_at,
    )
    assert summary.first_reminders_sent + summary.second_reminders_sent == 3
    assert summary.duration_ms == 125
    assert summary.last_swept_at == swept_at


def test_sweep_result_rejects_missing_duration() -> None:
    with pytest.raises(ValidationError):
        SweepResult(  # type: ignore[call-arg]
            reminders_sent=0,
            escalations_sent=0,
            first_reminders_sent=0,
            second_reminders_sent=0,
            assignments_processed=0,
            last_swept_at=datetime.now(UTC),
        )


def test_flagged_anchor_item_carries_pill_name() -> None:
    item = FlaggedAnchorItem(
        anchor_question_id=uuid.uuid4(),
        pill_id=uuid.uuid4(),
        pill_name="Lifting Operations",
        band=5,
        type="short_answer",
        config={"prompt": "p"},
        assigned_difficulty=5,
        regeneration_attempts=3,
        excluded=True,
        excluded_reason="self_review_3_fails: x",
        created_at=datetime.now(UTC),
    )
    assert item.pill_name == "Lifting Operations"


def test_flagged_anchor_item_requires_pill_name() -> None:
    with pytest.raises(ValidationError):
        FlaggedAnchorItem(  # type: ignore[call-arg]
            anchor_question_id=uuid.uuid4(),
            pill_id=uuid.uuid4(),
            band=5,
            type="short_answer",
            config={"prompt": "p"},
            assigned_difficulty=5,
            regeneration_attempts=3,
            excluded=True,
            excluded_reason=None,
            created_at=datetime.now(UTC),
        )


def _grade_review_row(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "grade_review_id": uuid.uuid4(),
        "grade_id": uuid.uuid4(),
        "attempt_id": uuid.uuid4(),
        "question_id": uuid.uuid4(),
        "testee_name": "Tess Testee",
        "pill_name": "Welding Inspection",
        "question_prompt": "Describe weld root inspection",
        "rubric_extract": "Look for tungsten inclusion",
        "testee_response": "The root was clean.",
        "band": 6,
        "ai_score": 0.4,
        "ai_verdict": "partial",
        "ai_reasoning": "Missing inclusion detail",
        "review_reasoning": "Reviewer disagrees: response is on-topic",
        "created_at": datetime.now(UTC),
    }
    base.update(overrides)
    return base


def test_flagged_grade_review_item_accepts_enriched_payload() -> None:
    item = FlaggedGradeReviewItem(**_grade_review_row())
    assert item.testee_name == "Tess Testee"
    assert item.pill_name == "Welding Inspection"
    assert item.band == 6


def test_flagged_grade_review_item_requires_band() -> None:
    row = _grade_review_row()
    row.pop("band")
    with pytest.raises(ValidationError):
        FlaggedGradeReviewItem(**row)


def test_flagged_grade_review_item_allows_empty_text_fields() -> None:
    row = _grade_review_row(question_prompt="", rubric_extract="", testee_response="")
    item = FlaggedGradeReviewItem(**row)
    assert item.question_prompt == ""
    assert item.rubric_extract == ""
    assert item.testee_response == ""


def _loop_row(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "weakness_report_id": uuid.uuid4(),
        "attempt_id": uuid.uuid4(),
        "testee_id": uuid.uuid4(),
        "testee_name": "Tess Testee",
        "pill_id": uuid.uuid4(),
        "pill_name": "Confined Space",
        "overall_score": 0.45,
        "weak_pill_ids": [],
        "loop_mode": "admin_reviewed",
        "iteration": "1 of ∞",
        "last_attempt_at": datetime.now(UTC),
        "status": "review",
        "created_at": datetime.now(UTC),
    }
    base.update(overrides)
    return base


def test_loop_queue_item_accepts_enriched_payload() -> None:
    item = LoopQueueItem(**_loop_row())
    assert item.loop_mode == "admin_reviewed"
    assert item.iteration == "1 of ∞"
    assert item.status == "review"


def test_loop_queue_item_loop_mode_literal_enforced() -> None:
    with pytest.raises(ValidationError):
        LoopQueueItem(**_loop_row(loop_mode="not-a-mode"))


def test_loop_queue_item_status_literal_enforced() -> None:
    with pytest.raises(ValidationError):
        LoopQueueItem(**_loop_row(status="not-a-status"))


def test_loop_queue_item_accepts_null_last_attempt_at() -> None:
    LoopQueueItem(**_loop_row(last_attempt_at=None))


def test_loop_reject_request_reason_optional() -> None:
    assert LoopRejectRequest().reason is None
    body = LoopRejectRequest(reason="off-topic remediation")
    assert body.reason == "off-topic remediation"


def test_realism_status_response_required_fields() -> None:
    resp = RealismStatusResponse(
        last_aggregated_at=None,
        flags_processed_last_run=0,
        below_threshold_count=0,
        auto_suppressed_count=0,
        total_flag_count_active=0,
    )
    assert resp.last_aggregated_at is None


def test_realism_status_response_accepts_datetime() -> None:
    when = datetime.now(UTC)
    resp = RealismStatusResponse(
        last_aggregated_at=when,
        flags_processed_last_run=12,
        below_threshold_count=3,
        auto_suppressed_count=1,
        total_flag_count_active=27,
    )
    assert resp.last_aggregated_at == when
    assert resp.flags_processed_last_run == 12


def test_realism_status_response_rejects_missing_field() -> None:
    with pytest.raises(ValidationError):
        RealismStatusResponse(  # type: ignore[call-arg]
            last_aggregated_at=None,
            flags_processed_last_run=0,
            below_threshold_count=0,
            auto_suppressed_count=0,
        )
