"""P9 Slice 4 — realism flag endpoint + aggregation + anchor
exclusion + low-realism negative examples (AC-D22).

End-to-end coverage of:

* ``POST /v1/attempts/{a}/questions/{q}/flag-realism`` — testee
  endpoint with idempotency + ownership check + server-derived
  generation_context.
* ``POST /v1/admin/realism/aggregate`` — admin-triggered nightly
  sweep that bumps ``Question.realism_flag_count`` per
  weighted-testee fold and excludes high-ratio anchors from the
  draw pool.
* The end-to-end loop: flag → aggregate → next generation call
  receives the question as a negative example.

AI calls run against :class:`RecordingProvider`; AC-CD15 honoured.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.ai.provider import Operation
from app.models import (
    SEED_TENANT_ID,
    AnchorQuestion,
    AppUser,
    Assignment,
    AssignmentAssignee,
    Attempt,
    AttemptAnchor,
    AttemptOrigin,
    AuditLog,
    LoopMode,
    Pill,
    Question,
    QuestionType,
    RealismFlag,
    Subject,
    SystemSettings,
    Test,
    TestMode,
    TestStatus,
    TestVisibility,
    TimeoutBehaviour,
)
from app.permissions import now_utc
from tests.integration.conftest import (
    CatalogueFakeSession,
    RecordingProvider,
    bearer,
    cat_make_user,
    seed_system_settings,
)

# --- Fixtures ---------------------------------------------------------


def _testee(s: CatalogueFakeSession, email: str = "t@kbc.com") -> AppUser:
    return cat_make_user(s, email=email, role=p.ROLE_TESTEE)


def _admin(s: CatalogueFakeSession, email: str = "a@kbc.com") -> AppUser:
    return cat_make_user(s, email=email, role=p.ROLE_ADMINISTRATOR)


def _pill(s: CatalogueFakeSession) -> Pill:
    sub = Subject(tenant_id=SEED_TENANT_ID, name="ops", description="")
    s.add(sub)
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=sub.id,
        name="Lifting",
        description="Crane work.",
        available_difficulty_min=1,
        available_difficulty_max=10,
        discoverable=True,
        safety_relevant=False,
    )
    s.add(pill)
    return pill


def _attempt_with_question(
    s: CatalogueFakeSession,
    *,
    testee: AppUser,
    test_id: uuid.UUID | None = None,
    submitted_overall_score: float | None = None,
) -> tuple[Attempt, Question]:
    """Build an attempt with a per-testee question in its snapshot.
    The ownership check in :func:`record_realism_flag` traverses the
    snapshot to verify the testee was served the question."""
    qid = uuid.uuid4()
    q = Question(
        id=qid,
        tenant_id=SEED_TENANT_ID,
        attempt_id=None,  # set below
        type=QuestionType.multiple_choice,
        config={"prompt": "q?", "options": ["a", "b"], "correct": 0},
        assigned_difficulty=5,
        realism_flag_count=0,
        ai_provider="anthropic",
        ai_model="claude-sonnet-4-6",
        ai_prompt_version="1.0.0",
        ai_prompt_tokens=10,
        ai_completion_tokens=5,
        ai_cost_usd=0.0001,
    )
    attempt = Attempt(
        tenant_id=SEED_TENANT_ID,
        test_id=test_id if test_id is not None else uuid.uuid4(),
        testee_id=testee.id,
        origin=AttemptOrigin.self_initiated,
        sequence_number=1,
        question_snapshot={"questions": [{"id": str(qid), "type": "multiple_choice"}]},
        overall_score=submitted_overall_score,
        submitted_at=now_utc() if submitted_overall_score is not None else None,
    )
    q.attempt_id = attempt.id  # FakeSession assigns id in add()
    s.add(attempt)
    q.attempt_id = attempt.id  # re-bind after add() set the id
    s.add(q)
    return attempt, q


def _flag(
    client: TestClient,
    testee: AppUser,
    *,
    attempt_id: uuid.UUID,
    question_id: uuid.UUID,
) -> Any:
    return client.post(
        f"/v1/attempts/{attempt_id}/questions/{question_id}/flag-realism",
        headers=bearer(testee),
    )


# --- Testee flag endpoint --------------------------------------------


def test_testee_flag_creates_realism_flag_with_server_context(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Happy path: testee POSTs flag → 201, RealismFlag row created,
    generation_context server-derived from the Question's
    AIProvenanceMixin columns (NOT user-supplied)."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    attempt, q = _attempt_with_question(cat_session, testee=testee)

    r = _flag(cat_client, testee, attempt_id=attempt.id, question_id=q.id)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["created"] is True
    assert body["question_id"] == str(q.id)
    assert body["testee_id"] == str(testee.id)

    flags = cat_session.store.get(RealismFlag, [])
    assert len(flags) == 1
    flag = flags[0]
    assert flag.question_id == q.id
    assert flag.testee_id == testee.id
    # Generation context is server-derived from the Question's
    # provenance columns — NOT user-supplied.
    assert flag.generation_context["ai_provider"] == "anthropic"
    assert flag.generation_context["ai_model"] == "claude-sonnet-4-6"
    assert flag.generation_context["ai_prompt_version"] == "1.0.0"
    assert flag.generation_context["question_type"] == "multiple_choice"
    assert flag.generation_context["assigned_difficulty"] == 5


def test_double_flag_is_idempotent_returns_existing_row(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Second click on the same question returns ``created=False`` and
    does not create a duplicate row — the unique constraint
    ``uq_realism_question_testee`` enforces this at the DB level; the
    domain helper short-circuits BEFORE the constraint fires so the
    endpoint returns 201 cleanly rather than 409."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    attempt, q = _attempt_with_question(cat_session, testee=testee)

    r1 = _flag(cat_client, testee, attempt_id=attempt.id, question_id=q.id)
    r2 = _flag(cat_client, testee, attempt_id=attempt.id, question_id=q.id)
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["created"] is True
    assert r2.json()["created"] is False
    assert r1.json()["realism_flag_id"] == r2.json()["realism_flag_id"]

    flags = cat_session.store.get(RealismFlag, [])
    assert len(flags) == 1


def test_testee_cannot_flag_question_from_anothers_attempt(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Privacy: testee A tries to flag a question testee B was served
    → 404 ``question_not_found``. The endpoint doesn't leak ownership
    info via a distinct 403 — same code covers wrong-attempt + wrong-
    testee."""
    seed_system_settings(cat_session)
    testee_a = _testee(cat_session, email="a@kbc.com")
    testee_b = _testee(cat_session, email="b@kbc.com")
    attempt_b, q = _attempt_with_question(cat_session, testee=testee_b)

    r = _flag(cat_client, testee_a, attempt_id=attempt_b.id, question_id=q.id)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "question_not_found"


def test_testee_cannot_flag_question_not_in_attempt_snapshot(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """The testee owns the attempt, but the question id isn't in the
    snapshot (or AttemptAnchor) — 404. Prevents a malicious testee
    from flagging arbitrary Question rows."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    attempt, _q = _attempt_with_question(cat_session, testee=testee)

    bogus_qid = uuid.uuid4()
    r = _flag(cat_client, testee, attempt_id=attempt.id, question_id=bogus_qid)
    assert r.status_code == 404


def test_admin_cannot_flag_realism_role_restricted_to_testee(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """The endpoint is restricted to ``ROLE_TESTEE`` per the AC-D22
    trust-hierarchy invariant (the testee is the realism authority on
    what THEY saw; an admin moderates via the audit log + direct DB
    tooling). An admin POSTing the endpoint → 403."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    attempt, q = _attempt_with_question(cat_session, testee=testee)

    r = _flag(cat_client, admin, attempt_id=attempt.id, question_id=q.id)
    assert r.status_code == 403


def test_testee_flag_writes_realism_flag_audit(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Happy path writes a ``realism.flag`` audit row tying the flag
    to the actor + question + attempt for the audit trail."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    attempt, q = _attempt_with_question(cat_session, testee=testee)

    _flag(cat_client, testee, attempt_id=attempt.id, question_id=q.id)

    audits = [
        a for a in cat_session.store.get(AuditLog, []) if a.action == "realism.flag"
    ]
    assert len(audits) == 1
    assert audits[0].actor_id == testee.id
    assert audits[0].target_id == q.id
    assert audits[0].detail["attempt_id"] == str(attempt.id)


# --- Aggregation sweep ----------------------------------------------


def test_admin_aggregate_updates_realism_flag_count_weighted(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """One Testee flags one question. Their overall_score across
    submitted attempts is 0.8 → weight 0.8 → round(0.8) = 1. The
    Question's ``realism_flag_count`` should be 1 after the
    aggregation sweep."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    attempt, q = _attempt_with_question(
        cat_session, testee=testee, submitted_overall_score=0.8
    )

    _flag(cat_client, testee, attempt_id=attempt.id, question_id=q.id)

    r = cat_client.post("/v1/admin/realism/aggregate", headers=bearer(admin))
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["flags_processed"] == 1
    assert body["questions_updated"] == 1
    assert body["anchors_excluded"] == 0

    # Reload the question — count is now the rounded weight.
    questions = cat_session.store.get(Question, [])
    assert len(questions) == 1
    assert questions[0].realism_flag_count == 1


def test_aggregate_uses_neutral_half_weight_for_zero_attempts_testees(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """A brand-new Testee with no submitted attempts contributes
    weight 0.5 per :func:`compute_testee_realism_weight`. Two such
    Testees flagging → 0.5 + 0.5 = 1.0 → realism_flag_count = 1."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee_a = _testee(cat_session, email="a@kbc.com")
    testee_b = _testee(cat_session, email="b@kbc.com")
    # No submitted attempts → neutral 0.5 each.
    attempt, q = _attempt_with_question(cat_session, testee=testee_a)
    # Build a separate attempt for testee_b that includes the same
    # question id in its snapshot so the ownership check passes.
    attempt_b = Attempt(
        tenant_id=SEED_TENANT_ID,
        test_id=uuid.uuid4(),
        testee_id=testee_b.id,
        origin=AttemptOrigin.self_initiated,
        sequence_number=1,
        question_snapshot={"questions": [{"id": str(q.id)}]},
    )
    cat_session.add(attempt_b)

    _flag(cat_client, testee_a, attempt_id=attempt.id, question_id=q.id)
    _flag(cat_client, testee_b, attempt_id=attempt_b.id, question_id=q.id)

    r = cat_client.post("/v1/admin/realism/aggregate", headers=bearer(admin))
    assert r.status_code == 201
    body = r.json()
    assert body["flags_processed"] == 2

    # 0.5 + 0.5 = 1.0 → round → 1
    questions = cat_session.store.get(Question, [])
    assert questions[0].realism_flag_count == 1


def test_aggregate_skips_unflagged_questions(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Questions with no flags are not touched — ``questions_updated``
    only counts rows whose count actually changed."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    _attempt, _q = _attempt_with_question(cat_session, testee=testee)
    # No flags created.

    r = cat_client.post("/v1/admin/realism/aggregate", headers=bearer(admin))
    assert r.status_code == 201
    body = r.json()
    assert body["flags_processed"] == 0
    assert body["questions_updated"] == 0


def test_admin_aggregate_requires_admin(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Testee → 403."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    r = cat_client.post("/v1/admin/realism/aggregate", headers=bearer(testee))
    assert r.status_code == 403


def test_admin_aggregate_writes_realism_aggregate_audit(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Sweep writes a single ``realism.aggregate`` audit row with the
    telemetry dict in ``detail``."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)

    cat_client.post("/v1/admin/realism/aggregate", headers=bearer(admin))

    audits = [
        a for a in cat_session.store.get(AuditLog, []) if a.action == "realism.aggregate"
    ]
    assert len(audits) == 1
    assert audits[0].actor_id == admin.id
    assert "flags_processed" in audits[0].detail
    assert "anchors_excluded" in audits[0].detail


# --- Anchor exclusion -----------------------------------------------


def test_high_flag_ratio_anchor_gets_excluded_from_pool(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """An anchor question with weighted ratio above 0.6 lands in the
    aggregation sweep's ``anchors_excluded`` bucket and is set
    ``excluded=True`` with the ``high_realism_flag_ratio`` reason.
    The subsequent :func:`draw_anchors_for_attempt` filter would
    skip it (the existing P8 filter respects ``excluded``)."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)

    # Anchor question — shared PK between Question and AnchorQuestion.
    anchor_id = uuid.uuid4()
    anchor_question = Question(
        id=anchor_id,
        tenant_id=SEED_TENANT_ID,
        pill_id=pill.id,
        type=QuestionType.multiple_choice,
        config={"prompt": "anchor?", "options": ["a"], "correct": 0},
        assigned_difficulty=5,
        realism_flag_count=0,
        ai_provider="anthropic",
        ai_model="claude-sonnet-4-6",
        ai_prompt_version="1.0.0",
    )
    cat_session.add(anchor_question)
    anchor = AnchorQuestion(
        id=anchor_id,
        tenant_id=SEED_TENANT_ID,
        pill_id=pill.id,
        band=5,
        type=QuestionType.multiple_choice,
        config=anchor_question.config,
        assigned_difficulty=5,
        total_attempts=2,
        regeneration_attempts=0,
        excluded=False,
        needs_admin_attention=False,
    )
    cat_session.add(anchor)

    # The attempt that served the anchor — its snapshot includes
    # the anchor question id so the testee can flag it.
    attempt = Attempt(
        tenant_id=SEED_TENANT_ID,
        test_id=uuid.uuid4(),
        testee_id=testee.id,
        origin=AttemptOrigin.assignment_driven,
        sequence_number=1,
        question_snapshot={"questions": [{"id": str(anchor_id)}]},
        overall_score=0.9,
        submitted_at=now_utc(),
    )
    cat_session.add(attempt)
    # One AttemptAnchor row tracks the serve count (the denominator
    # for the flag ratio). One serve + one weighted flag (0.9) gives
    # ratio = 0.9, well above 0.6 threshold.
    cat_session.add(
        AttemptAnchor(
            tenant_id=SEED_TENANT_ID,
            attempt_id=attempt.id,
            anchor_question_id=anchor_id,
            score=0.5,
        )
    )

    _flag(cat_client, testee, attempt_id=attempt.id, question_id=anchor_id)

    r = cat_client.post("/v1/admin/realism/aggregate", headers=bearer(admin))
    assert r.status_code == 201
    body = r.json()
    assert body["anchors_excluded"] == 1
    assert body["anchor_questions_seen"] == 1

    # The anchor is now excluded with the right reason.
    anchors = cat_session.store.get(AnchorQuestion, [])
    assert len(anchors) == 1
    assert anchors[0].excluded is True
    assert anchors[0].excluded_reason.startswith("high_realism_flag_ratio:")
    assert anchors[0].needs_admin_attention is True


def test_low_flag_ratio_anchor_stays_live(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """An anchor with a flag ratio below 0.6 stays live. One flag /
    five serves at weight 0.9 → ratio 0.18 → no exclusion."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)

    anchor_id = uuid.uuid4()
    cat_session.add(
        Question(
            id=anchor_id,
            tenant_id=SEED_TENANT_ID,
            pill_id=pill.id,
            type=QuestionType.multiple_choice,
            config={"prompt": "q", "options": ["a"], "correct": 0},
            assigned_difficulty=5,
            realism_flag_count=0,
        )
    )
    cat_session.add(
        AnchorQuestion(
            id=anchor_id,
            tenant_id=SEED_TENANT_ID,
            pill_id=pill.id,
            band=5,
            type=QuestionType.multiple_choice,
            config={"prompt": "q", "options": ["a"], "correct": 0},
            assigned_difficulty=5,
            total_attempts=5,
            regeneration_attempts=0,
            excluded=False,
            needs_admin_attention=False,
        )
    )
    attempt = Attempt(
        tenant_id=SEED_TENANT_ID,
        test_id=uuid.uuid4(),
        testee_id=testee.id,
        origin=AttemptOrigin.assignment_driven,
        sequence_number=1,
        question_snapshot={"questions": [{"id": str(anchor_id)}]},
        overall_score=0.9,
        submitted_at=now_utc(),
    )
    cat_session.add(attempt)
    # Five AttemptAnchor rows — five serves total.
    for _i in range(5):
        cat_session.add(
            AttemptAnchor(
                tenant_id=SEED_TENANT_ID,
                attempt_id=attempt.id,
                anchor_question_id=anchor_id,
                score=0.5,
            )
        )

    _flag(cat_client, testee, attempt_id=attempt.id, question_id=anchor_id)

    cat_client.post("/v1/admin/realism/aggregate", headers=bearer(admin))

    anchors = cat_session.store.get(AnchorQuestion, [])
    assert anchors[0].excluded is False
    assert anchors[0].needs_admin_attention is False


# --- Low-realism negative examples in generation -------------------


def test_low_realism_questions_feed_into_generation_payload(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """After aggregation marks a question as low-realism (count >= 2),
    the next per_testee start_attempt for the same pill sees it in
    the ``low_realism_negative_examples`` payload key. End-to-end
    "realism pool weights generation as negative examples"."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)

    # Pre-seed a question against the pill with realism_flag_count=2
    # so list_low_realism_questions_for_pill picks it up directly.
    flagged_qid = uuid.uuid4()
    cat_session.add(
        Question(
            id=flagged_qid,
            tenant_id=SEED_TENANT_ID,
            pill_id=pill.id,
            type=QuestionType.short_answer,
            config={"prompt": "flagged?", "rubric": "any"},
            assigned_difficulty=5,
            realism_flag_count=3,
        )
    )

    # Build a per_testee attempt against an assignment scoped to the
    # pill so the generation call sees the negative examples.
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="Diag",
        mode=TestMode.per_testee,
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
    assignment = Assignment(
        tenant_id=SEED_TENANT_ID,
        assigner_id=admin.id,
        pill_id=pill.id,
        learning_path_id=None,
        difficulty=5,
        deadline=None,
        is_mandatory=False,
        loop_mode=LoopMode.autonomous,
    )
    cat_session.add(assignment)
    cat_session.add(
        AssignmentAssignee(
            tenant_id=SEED_TENANT_ID,
            assignment_id=assignment.id,
            user_id=testee.id,
            via_group_id=None,
        )
    )

    r = cat_client.post(
        "/v1/attempts",
        headers=bearer(testee),
        json={
            "test_id": str(test.id),
            "origin": AttemptOrigin.assignment_driven.value,
            "assignment_id": str(assignment.id),
        },
    )
    assert r.status_code == 201, r.text

    gen_calls = recording_provider.calls_for(Operation.generation)
    assert len(gen_calls) == 1
    _, _, payload = gen_calls[0]
    assert "low_realism_negative_examples" in payload
    # Non-empty because we seeded a question above threshold.
    assert payload["low_realism_negative_examples"] != "(none)"
    assert "short_answer" in payload["low_realism_negative_examples"]
    assert "flags 3" in payload["low_realism_negative_examples"]


# --- GET /v1/admin/drive/index ---------------------------------------


def test_drive_index_status_returns_chunk_and_file_counts(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Smoke for the read-only dashboard surface."""
    from app.models import DriveChunk

    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    cat_session.add(
        DriveChunk(
            tenant_id=SEED_TENANT_ID,
            source_doc_ref="f1",
            chunk_index=0,
            chunk_text="x",
            content_hash="a" * 64,
            embedding=[0.1] * 1536,
            indexed_at=now_utc(),
        )
    )
    cat_session.add(
        DriveChunk(
            tenant_id=SEED_TENANT_ID,
            source_doc_ref="f1",
            chunk_index=1,
            chunk_text="y",
            content_hash="a" * 64,
            embedding=[0.1] * 1536,
            indexed_at=now_utc(),
        )
    )
    cat_session.add(
        DriveChunk(
            tenant_id=SEED_TENANT_ID,
            source_doc_ref="f2",
            chunk_index=0,
            chunk_text="z",
            content_hash="b" * 64,
            embedding=[0.1] * 1536,
            indexed_at=now_utc(),
        )
    )

    r = cat_client.get("/v1/admin/drive/index", headers=bearer(admin))
    assert r.status_code == 200
    body = r.json()
    assert body["chunks"] == 3
    assert body["files"] == 2
    assert body["last_indexed_at"] is not None


def test_drive_index_status_requires_admin(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Testee → 403."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    r = cat_client.get("/v1/admin/drive/index", headers=bearer(testee))
    assert r.status_code == 403


# --- N+1 regression guard (Gitar PR-#21 Slice 4 finding #1) ---------


def test_aggregate_uses_single_query_for_all_anchor_serve_counts(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression guard: ``aggregate_realism_flags`` must batch-load
    AttemptAnchor serve counts in one query, not per-anchor. A future
    refactor that re-introduces the N+1 pattern would call
    ``CatalogueFakeSession.execute`` more times than necessary; we
    count execute() invocations for the AttemptAnchor model and pin
    the expected count to "exactly one for the serve-count fold,
    regardless of how many anchors are flagged."

    The exact invariant: with 3 flagged anchor questions, only ONE
    serve-count query runs against AttemptAnchor (the
    :func:`_serve_counts_by_anchor` batched fetch). The previous
    N+1 implementation would have run 3 such queries (one per
    anchor)."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)

    # Seed 3 anchor questions and flag each.
    flagged_anchor_ids = []
    for i in range(3):
        anchor_id = uuid.uuid4()
        cat_session.add(
            Question(
                id=anchor_id,
                tenant_id=SEED_TENANT_ID,
                pill_id=pill.id,
                type=QuestionType.multiple_choice,
                config={"prompt": f"q{i}", "options": ["a"], "correct": 0},
                assigned_difficulty=5,
                realism_flag_count=0,
            )
        )
        cat_session.add(
            AnchorQuestion(
                id=anchor_id,
                tenant_id=SEED_TENANT_ID,
                pill_id=pill.id,
                band=5,
                type=QuestionType.multiple_choice,
                config={"prompt": f"q{i}", "options": ["a"], "correct": 0},
                assigned_difficulty=5,
                total_attempts=1,
                regeneration_attempts=0,
                excluded=False,
                needs_admin_attention=False,
            )
        )
        # Build an attempt that served this anchor so the ownership
        # check passes and there's at least one serve to count.
        attempt = Attempt(
            tenant_id=SEED_TENANT_ID,
            test_id=uuid.uuid4(),
            testee_id=testee.id,
            origin=AttemptOrigin.assignment_driven,
            sequence_number=i + 1,
            question_snapshot={"questions": [{"id": str(anchor_id)}]},
        )
        cat_session.add(attempt)
        cat_session.add(
            AttemptAnchor(
                tenant_id=SEED_TENANT_ID,
                attempt_id=attempt.id,
                anchor_question_id=anchor_id,
                score=0.5,
            )
        )
        flagged_anchor_ids.append((attempt.id, anchor_id))

    for attempt_id, anchor_id in flagged_anchor_ids:
        _flag(cat_client, testee, attempt_id=attempt_id, question_id=anchor_id)

    # Count execute() calls per model. The pattern under test: the
    # aggregation should fire exactly ONE select against AttemptAnchor
    # (the batched _serve_counts_by_anchor call) even though there
    # are 3 flagged anchors. A re-introduction of the N+1 would
    # produce 3 (one per anchor).
    original_execute = cat_session.execute
    seen_models: list[Any] = []

    async def _counting_execute(stmt: Any) -> Any:
        try:
            model = stmt.column_descriptions[0]["entity"]
        except Exception:
            model = None
        seen_models.append(model)
        return await original_execute(stmt)

    monkeypatch.setattr(cat_session, "execute", _counting_execute)

    r = cat_client.post("/v1/admin/realism/aggregate", headers=bearer(admin))
    assert r.status_code == 201, r.text

    # Exactly one AttemptAnchor select happened across the sweep —
    # the batched _serve_counts_by_anchor call.
    attempt_anchor_selects = [m for m in seen_models if m is AttemptAnchor]
    assert len(attempt_anchor_selects) == 1, (
        f"Expected one batched AttemptAnchor select for the serve-count "
        f"fold; got {len(attempt_anchor_selects)} — re-check that the "
        f"aggregation loop reads from the pre-built serves_by_anchor "
        f"dict rather than firing a per-anchor query."
    )


# silence pyflakes "unused"
_ = pytest
_ = SystemSettings
