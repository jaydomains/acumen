"""Slice C — admin row-enrichment + GET /v1/admin/realism/status.

Verifies the FE-9-admin-ops.md §H(a) item 1 + item 8 contracts end-to-
end via the HTTP layer. Zero-DB / zero-network (AC-CD15) — every row
is seeded directly into the ``CatalogueFakeSession`` so we exercise
the domain enrichment without touching the (real) provider seams.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import (
    SEED_TENANT_ID,
    AnchorQuestion,
    AppUser,
    Assignment,
    AssignmentAssignee,
    AssignmentReminder,
    AssignmentReminderKind,
    Attempt,
    AttemptOrigin,
    AuditLog,
    Grade,
    GradeReview,
    GradeSource,
    GradeVerdict,
    LearningMaterial,
    LearningMaterialSource,
    LoopMode,
    Pill,
    Question,
    QuestionType,
    RealismFlag,
    Response,
    ReviewStatus,
    Subject,
    Test,
    TestMode,
    TestStatus,
    TestVisibility,
    TimeoutBehaviour,
    WeaknessReport,
    WeaknessReportPill,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
    seed_system_settings,
)


def _admin(session: CatalogueFakeSession, email: str = "admin@kbc.com") -> AppUser:
    return cat_make_user(session, email=email, role=p.ROLE_ADMINISTRATOR)


def _testee(session: CatalogueFakeSession, email: str = "t@kbc.com") -> AppUser:
    return cat_make_user(session, email=email, role=p.ROLE_TESTEE)


def _subject(session: CatalogueFakeSession) -> Subject:
    s = Subject(tenant_id=SEED_TENANT_ID, name="Maintenance", description="")
    session.add(s)
    return s


def _pill(
    session: CatalogueFakeSession,
    *,
    subject: Subject,
    name: str = "Antifouling",
) -> Pill:
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=subject.id,
        name=name,
        description="",
        available_difficulty_min=1,
        available_difficulty_max=10,
        discoverable=True,
        safety_relevant=False,
    )
    session.add(pill)
    return pill


def _stale_assignment(
    session: CatalogueFakeSession,
    *,
    admin: AppUser,
    testee: AppUser,
    pill: Pill,
    age_days: int = 10,
    escalated_at=None,
) -> Assignment:
    a = Assignment(
        tenant_id=SEED_TENANT_ID,
        assigner_id=admin.id,
        pill_id=pill.id,
        learning_path_id=None,
        difficulty=4,
        deadline=None,
        is_mandatory=True,
        loop_mode=LoopMode.autonomous,
    )
    session.add(a)
    a.created_at = p.now_utc() - timedelta(days=age_days)
    if escalated_at is not None:
        a.escalation_sent_at = escalated_at
    session.add(
        AssignmentAssignee(
            tenant_id=SEED_TENANT_ID,
            assignment_id=a.id,
            user_id=testee.id,
            via_group_id=None,
        )
    )
    return a


# --- GET /v1/admin/engagement/pending --------------------------------


def test_engagement_widget_returns_enriched_rows(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject, name="Lifting Operations")
    assignment = _stale_assignment(
        cat_session,
        admin=admin,
        testee=testee,
        pill=pill,
        age_days=12,
        escalated_at=p.now_utc(),
    )
    cat_session.add(
        AssignmentReminder(
            tenant_id=SEED_TENANT_ID,
            assignment_id=assignment.id,
            kind=AssignmentReminderKind.reminder,
            sent_at=p.now_utc(),
        )
    )

    r = cat_client.get("/v1/admin/engagement/pending", headers=bearer(admin))
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert len(data) == 1
    row = data[0]
    assert row["testee_id"] == str(testee.id)
    assert row["testee_name"] == "t"
    assert row["pill_or_test_name"] == "Lifting Operations"
    assert row["assigner_name"] == "admin"
    assert row["days_stale"] >= 12
    assert row["reminders_sent"] == 1
    assert row["escalated"] is True


# --- POST /v1/admin/engagement/sweep ---------------------------------


def test_engagement_sweep_returns_enriched_telemetry(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject)
    _stale_assignment(cat_session, admin=admin, testee=testee, pill=pill, age_days=14)

    r = cat_client.post("/v1/admin/engagement/sweep", headers=bearer(admin))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["reminders_sent"] == 1
    assert body["first_reminders_sent"] == 1
    assert body["second_reminders_sent"] == 0
    assert body["assignments_processed"] == 1
    assert body["duration_ms"] >= 0
    assert body["last_swept_at"] is not None


# --- GET /v1/admin/grade-reviews/flagged -----------------------------


def _seed_grade_review(
    session: CatalogueFakeSession,
    *,
    admin: AppUser,
    testee: AppUser,
    pill: Pill,
    status: ReviewStatus = ReviewStatus.flagged,
    question_prompt: str = "What is the function of the keel?",
    rubric: str = "Look for hydrodynamic + stability roles.",
    answer_text: str = "It keeps the boat upright.",
) -> tuple[GradeReview, Grade, Response, Question, Test, Attempt, Assignment]:
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="Hull Basics",
        mode=TestMode.frozen,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=False,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        target_difficulty=5,
        randomise_question_order=True,
        randomise_option_order=True,
        pass_threshold=0.5,
    )
    session.add(test)
    question = Question(
        tenant_id=SEED_TENANT_ID,
        test_id=test.id,
        type=QuestionType.short_answer,
        config={"prompt": question_prompt, "rubric": rubric, "model_answer": "x"},
        assigned_difficulty=6,
        question_group_id=None,
        realism_flag_count=0,
    )
    session.add(question)
    assignment = Assignment(
        tenant_id=SEED_TENANT_ID,
        assigner_id=admin.id,
        pill_id=pill.id,
        learning_path_id=None,
        difficulty=5,
        deadline=None,
        is_mandatory=True,
        loop_mode=LoopMode.autonomous,
    )
    session.add(assignment)
    attempt = Attempt(
        tenant_id=SEED_TENANT_ID,
        test_id=test.id,
        testee_id=testee.id,
        origin=AttemptOrigin.assignment_driven,
        assignment_id=assignment.id,
        sequence_number=1,
        started_at=p.now_utc(),
        submitted_at=p.now_utc(),
        pauses_used=0,
        total_pause_duration_seconds=0,
    )
    session.add(attempt)
    response = Response(
        tenant_id=SEED_TENANT_ID,
        attempt_id=attempt.id,
        question_id=question.id,
        answer_payload={"text": answer_text},
        response_score=0.4,
        time_ms=4200,
    )
    session.add(response)
    grade = Grade(
        tenant_id=SEED_TENANT_ID,
        response_id=response.id,
        score=0.4,
        verdict=GradeVerdict.partial,
        source=GradeSource.ai,
        ai_reasoning="Missing detail on stability",
    )
    session.add(grade)
    gr = GradeReview(
        tenant_id=SEED_TENANT_ID,
        grade_id=grade.id,
        status=status,
        review_reasoning="Reviewer says it's on-topic",
    )
    session.add(gr)
    return gr, grade, response, question, test, attempt, assignment


def test_grade_reviews_flagged_returns_enriched_rows(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session, email="tess@kbc.com")
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject, name="Hull Design")
    _seed_grade_review(
        cat_session,
        admin=admin,
        testee=testee,
        pill=pill,
    )

    r = cat_client.get("/v1/admin/grade-reviews/flagged", headers=bearer(admin))
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert len(data) == 1
    item = data[0]
    assert item["testee_name"] == "tess"
    assert item["pill_name"] == "Hull Design"
    assert item["question_prompt"] == "What is the function of the keel?"
    assert "hydrodynamic" in item["rubric_extract"]
    assert item["testee_response"] == "It keeps the boat upright."
    assert item["band"] == 6


def test_grade_reviews_flagged_truncates_long_text(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """Question prompt longer than 240 chars must be truncated with
    a trailing ellipsis. Mirrors the truncation cap locked at
    ``app/domain/grade_review.py:_QUESTION_PROMPT_MAX``."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session, email="t@kbc.com")
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject)
    long_prompt = "A" * 300
    long_response = "B" * 700
    _seed_grade_review(
        cat_session,
        admin=admin,
        testee=testee,
        pill=pill,
        question_prompt=long_prompt,
        answer_text=long_response,
    )

    r = cat_client.get("/v1/admin/grade-reviews/flagged", headers=bearer(admin))
    item = r.json()["data"][0]
    assert item["question_prompt"].endswith("…")
    assert len(item["question_prompt"]) == 241  # 240 chars + ellipsis
    assert item["testee_response"].endswith("…")
    assert len(item["testee_response"]) == 601


def test_grade_reviews_flagged_verdict_filter(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """``?verdict=confirmed`` flips the queue to confirmed-only;
    ``?verdict=all`` returns both. The default (no param) is flagged-
    only, matching the v1 list contract before Slice C."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session, email="t@kbc.com")
    other = _testee(cat_session, email="other@kbc.com")
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject)
    _seed_grade_review(
        cat_session, admin=admin, testee=testee, pill=pill, status=ReviewStatus.flagged
    )
    _seed_grade_review(
        cat_session, admin=admin, testee=other, pill=pill, status=ReviewStatus.confirmed
    )

    r_default = cat_client.get("/v1/admin/grade-reviews/flagged", headers=bearer(admin))
    assert len(r_default.json()["data"]) == 1

    r_confirmed = cat_client.get(
        "/v1/admin/grade-reviews/flagged?verdict=confirmed", headers=bearer(admin)
    )
    assert len(r_confirmed.json()["data"]) == 1

    r_all = cat_client.get(
        "/v1/admin/grade-reviews/flagged?verdict=all", headers=bearer(admin)
    )
    assert len(r_all.json()["data"]) == 2


def test_grade_reviews_flagged_verdict_param_validates_enum(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """Unknown ``verdict`` values are rejected with 422 by the
    FastAPI Literal-typed query param (so the FE can't silently send
    a typo and get an unexpected empty payload)."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    r = cat_client.get(
        "/v1/admin/grade-reviews/flagged?verdict=bogus", headers=bearer(admin)
    )
    assert r.status_code == 422


# --- GET /v1/admin/loop/queue ----------------------------------------


def _seed_admin_reviewed_report(
    session: CatalogueFakeSession,
    *,
    admin: AppUser,
    testee: AppUser,
    pill: Pill,
    overall_score: float = 0.2,
    submitted: bool = True,
) -> tuple[WeaknessReport, Attempt, Assignment]:
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="Lifting Diag",
        mode=TestMode.frozen,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=False,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        target_difficulty=5,
        randomise_question_order=False,
        randomise_option_order=False,
        pass_threshold=0.5,
    )
    session.add(test)
    assignment = Assignment(
        tenant_id=SEED_TENANT_ID,
        assigner_id=admin.id,
        pill_id=pill.id,
        learning_path_id=None,
        difficulty=5,
        deadline=None,
        is_mandatory=False,
        loop_mode=LoopMode.admin_reviewed,
    )
    session.add(assignment)
    attempt = Attempt(
        tenant_id=SEED_TENANT_ID,
        test_id=test.id,
        testee_id=testee.id,
        origin=AttemptOrigin.assignment_driven,
        assignment_id=assignment.id,
        sequence_number=1,
        started_at=p.now_utc(),
        submitted_at=p.now_utc() if submitted else None,
        overall_score=overall_score,
        pauses_used=0,
        total_pause_duration_seconds=0,
    )
    session.add(attempt)
    report = WeaknessReport(
        tenant_id=SEED_TENANT_ID,
        attempt_id=attempt.id,
        routed_to_admin=True,
    )
    session.add(report)
    session.add(
        WeaknessReportPill(
            tenant_id=SEED_TENANT_ID,
            weakness_report_id=report.id,
            pill_id=pill.id,
            severity=0.7,
        )
    )
    return report, attempt, assignment


def test_loop_queue_returns_enriched_rows(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session, email="lou@kbc.com")
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject, name="Confined Space")
    _seed_admin_reviewed_report(
        cat_session, admin=admin, testee=testee, pill=pill, overall_score=0.3
    )

    r = cat_client.get("/v1/admin/loop/queue", headers=bearer(admin))
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert len(data) == 1
    row = data[0]
    assert row["testee_name"] == "lou"
    assert row["pill_name"] == "Confined Space"
    assert row["loop_mode"] == "admin_reviewed"
    assert row["iteration"] == "1 of ∞"
    assert row["status"] == "review"
    assert row["last_attempt_at"] is not None


def test_loop_queue_status_param_filters_rows(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """``?status=closed`` matches no routed-to-admin rows (those are
    by definition not closed yet); ``?status=review`` matches the
    fresh row. Confirms the server-side filter wires through."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session, email="lou@kbc.com")
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject)
    _seed_admin_reviewed_report(cat_session, admin=admin, testee=testee, pill=pill)

    r_review = cat_client.get("/v1/admin/loop/queue?status=review", headers=bearer(admin))
    assert len(r_review.json()["data"]) == 1

    r_closed = cat_client.get("/v1/admin/loop/queue?status=closed", headers=bearer(admin))
    assert r_closed.json()["data"] == []


def test_loop_queue_status_derives_material_served(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """A LearningMaterial row with ``served_at`` set against the same
    weakness_report flips the derived status to ``material-served``
    (before any follow-up Attempt is opened)."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session, email="lou@kbc.com")
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject)
    report, _attempt, _assignment = _seed_admin_reviewed_report(
        cat_session, admin=admin, testee=testee, pill=pill
    )
    cat_session.add(
        LearningMaterial(
            tenant_id=SEED_TENANT_ID,
            pill_id=pill.id,
            testee_id=testee.id,
            weakness_report_id=report.id,
            source=LearningMaterialSource.ai_generated,
            content="Read this primer",
            served_at=p.now_utc(),
            served_text="Read this primer",
        )
    )
    r = cat_client.get("/v1/admin/loop/queue", headers=bearer(admin))
    assert r.json()["data"][0]["status"] == "material-served"


# --- POST /v1/admin/loop/queue/{id}/reject ---------------------------


def test_loop_reject_persists_reason_to_audit_log(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """Posting ``{reason}`` to the reject endpoint writes the reason
    into the ``audit_log.detail`` payload (operator traceability per
    FE-9-admin-ops.md §H(a) item 1 sub-item)."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session, email="lou@kbc.com")
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject)
    report, _attempt, _assignment = _seed_admin_reviewed_report(
        cat_session, admin=admin, testee=testee, pill=pill
    )
    r = cat_client.post(
        f"/v1/admin/loop/queue/{report.id}/reject",
        headers=bearer(admin),
        json={"reason": "off-topic weakness — covered elsewhere"},
    )
    assert r.status_code == 201, r.text
    audit_rows = [
        row
        for row in cat_session.store.get(AuditLog, [])
        if row.action == "loop.queue.reject"
    ]
    assert len(audit_rows) == 1
    assert audit_rows[0].detail["reason"] == "off-topic weakness — covered elsewhere"


def test_loop_reject_empty_body_still_accepted(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """The body is optional — POST with no JSON body succeeds and the
    audit detail omits the ``reason`` key."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session, email="lou@kbc.com")
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject)
    report, _attempt, _assignment = _seed_admin_reviewed_report(
        cat_session, admin=admin, testee=testee, pill=pill
    )
    r = cat_client.post(f"/v1/admin/loop/queue/{report.id}/reject", headers=bearer(admin))
    assert r.status_code == 201, r.text
    audit_rows = [
        row
        for row in cat_session.store.get(AuditLog, [])
        if row.action == "loop.queue.reject"
    ]
    assert "reason" not in (audit_rows[0].detail or {})


# --- GET /v1/admin/anchors/flagged -----------------------------------


def test_anchors_flagged_returns_pill_name(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject, name="High Voltage Switching")
    anchor = AnchorQuestion(
        tenant_id=SEED_TENANT_ID,
        pill_id=pill.id,
        band=5,
        type=QuestionType.short_answer,
        config={"prompt": "describe the safety isolation steps"},
        assigned_difficulty=5,
        effective_difficulty=5.0,
        regeneration_attempts=3,
        excluded=True,
        excluded_reason="self_review_3_fails: drift",
        needs_admin_attention=True,
    )
    cat_session.add(anchor)
    r = cat_client.get("/v1/admin/anchors/flagged", headers=bearer(admin))
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert len(data) == 1
    assert data[0]["pill_name"] == "High Voltage Switching"


# --- GET /v1/admin/realism/status ------------------------------------


def test_realism_status_empty_store(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """A fresh tenant with no aggregate run yet returns all zeros +
    ``last_aggregated_at = None`` — the spec's `card_no_data` state."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    r = cat_client.get("/v1/admin/realism/status", headers=bearer(admin))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["last_aggregated_at"] is None
    assert body["flags_processed_last_run"] == 0
    assert body["below_threshold_count"] == 0
    assert body["auto_suppressed_count"] == 0
    assert body["total_flag_count_active"] == 0


def test_realism_status_populated(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """An aggregate audit row + flagged questions + auto-suppressed
    anchors + active realism flags all show up in the live response."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject)

    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="Test",
        mode=TestMode.frozen,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=False,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        target_difficulty=5,
        randomise_question_order=False,
        randomise_option_order=False,
        pass_threshold=0.5,
    )
    cat_session.add(test)

    # Two questions with flag counts above the low-realism threshold (2).
    for i in range(2):
        q = Question(
            tenant_id=SEED_TENANT_ID,
            test_id=test.id,
            type=QuestionType.short_answer,
            config={"prompt": f"q{i}"},
            assigned_difficulty=5,
            question_group_id=None,
            realism_flag_count=3,
        )
        cat_session.add(q)
    # And one question below threshold — must not be counted.
    q_below = Question(
        tenant_id=SEED_TENANT_ID,
        test_id=test.id,
        type=QuestionType.short_answer,
        config={"prompt": "q_low"},
        assigned_difficulty=5,
        question_group_id=None,
        realism_flag_count=1,
    )
    cat_session.add(q_below)

    # An auto-suppressed anchor: excluded + reason starts with the
    # high_realism_flag_ratio prefix.
    cat_session.add(
        AnchorQuestion(
            tenant_id=SEED_TENANT_ID,
            pill_id=pill.id,
            band=5,
            type=QuestionType.short_answer,
            config={"prompt": "a"},
            assigned_difficulty=5,
            effective_difficulty=5.0,
            regeneration_attempts=0,
            excluded=True,
            excluded_reason="high_realism_flag_ratio: 0.75",
            needs_admin_attention=False,
        )
    )
    # An anchor excluded for a different reason — must not count.
    cat_session.add(
        AnchorQuestion(
            tenant_id=SEED_TENANT_ID,
            pill_id=pill.id,
            band=5,
            type=QuestionType.short_answer,
            config={"prompt": "b"},
            assigned_difficulty=5,
            effective_difficulty=5.0,
            regeneration_attempts=3,
            excluded=True,
            excluded_reason="self_review_3_fails: drift",
            needs_admin_attention=True,
        )
    )

    # Three RealismFlag rows.
    qid = uuid.uuid4()
    for _ in range(3):
        cat_session.add(
            RealismFlag(
                tenant_id=SEED_TENANT_ID,
                question_id=qid,
                testee_id=uuid.uuid4(),
                generation_context=None,
            )
        )

    # A realism.aggregate audit row with telemetry.
    aggregate_at = p.now_utc()
    audit = AuditLog(
        tenant_id=SEED_TENANT_ID,
        actor_id=admin.id,
        action="realism.aggregate",
        target_entity="system_settings",
        target_id=uuid.uuid4(),
        detail={"flags_processed": 3, "questions_updated": 2},
    )
    cat_session.add(audit)
    audit.created_at = aggregate_at

    r = cat_client.get("/v1/admin/realism/status", headers=bearer(admin))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["last_aggregated_at"] is not None
    assert body["flags_processed_last_run"] == 3
    assert body["below_threshold_count"] == 2
    assert body["auto_suppressed_count"] == 1
    assert body["total_flag_count_active"] == 3


def test_realism_status_forbidden_for_non_admin(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """The 5-field telemetry roll-up is admin-only — testees get 403."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    r = cat_client.get("/v1/admin/realism/status", headers=bearer(testee))
    assert r.status_code == 403
