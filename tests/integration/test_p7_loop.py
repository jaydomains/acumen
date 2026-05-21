"""P7 Slice 2 — adaptive learning loop wired into submit_attempt.

Tests cover the end-to-end loop driver per AC-D6 / AC-D9 / AC-D21 /
AC-D33 + the n-gram trigram overlap pass per AC-D4 #5 / AC-CD14.

Scope: only single-pill assignment-backed attempts trigger competence
updates + autonomous follow-ups (locked at planning). Self-initiated,
learning-path, and assignment-driven attempts with no pill_id skip
silently — covered by the out-of-scope test cases.

Fixtures: ``recording_provider`` substitutes both the Anthropic and
OpenAI module-level singletons. The default canned response for
``Operation.weakness`` is ``{"weak_pills": []}`` — every test that
exercises follow-up creation must override it via
``recording_provider.set_response`` so the loop sees at least one weak
pill.

Subtests use deterministic-only parent Tests (MCQ + true_false) for
speed; the overlap-trigger test alone uses short_answer so the AI
grade pass writes a Grade row the overlap check can flag.
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
    AppUser,
    Assignment,
    AssignmentAssignee,
    Attempt,
    AttemptOrigin,
    CompetencyProfile,
    Grade,
    LearningMaterial,
    LearningMaterialSource,
    LoopMode,
    Pill,
    Question,
    QuestionType,
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
    RecordingProvider,
    bearer,
    cat_make_user,
    seed_system_settings,
)

# --- Fixtures ----------------------------------------------------------


def _subject(session: CatalogueFakeSession, name: str = "Operations") -> Subject:
    sub = Subject(tenant_id=SEED_TENANT_ID, name=name, description="")
    session.add(sub)
    return sub


def _pill(
    session: CatalogueFakeSession,
    *,
    subject: Subject,
    name: str = "Lifting Operations",
    safety_relevant: bool = False,
    min_diff: int = 1,
    max_diff: int = 10,
) -> Pill:
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=subject.id,
        name=name,
        description="",
        available_difficulty_min=min_diff,
        available_difficulty_max=max_diff,
        discoverable=True,
        safety_relevant=safety_relevant,
    )
    session.add(pill)
    return pill


def _admin(session: CatalogueFakeSession, email: str = "admin@kbc.com") -> AppUser:
    return cat_make_user(session, email=email, role=p.ROLE_ADMINISTRATOR)


def _testee(session: CatalogueFakeSession, email: str = "t@kbc.com") -> AppUser:
    return cat_make_user(session, email=email, role=p.ROLE_TESTEE)


def _frozen_mcq_test(
    session: CatalogueFakeSession, *, pass_threshold: float = 0.5
) -> Test:
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="Lifting Diagnostic",
        mode=TestMode.frozen,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=False,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        target_difficulty=5,
        randomise_question_order=False,
        randomise_option_order=False,
        pass_threshold=pass_threshold,
    )
    session.add(test)
    return test


def _mcq(session: CatalogueFakeSession, test_id: uuid.UUID, correct: int = 0) -> Question:
    q = Question(
        tenant_id=SEED_TENANT_ID,
        test_id=test_id,
        type=QuestionType.multiple_choice,
        config={
            "prompt": "Pick the safe one",
            "options": ["a", "b", "c"],
            "correct": correct,
        },
        assigned_difficulty=5,
        question_group_id=None,
        realism_flag_count=0,
    )
    session.add(q)
    return q


def _short_answer(
    session: CatalogueFakeSession, test_id: uuid.UUID, prompt: str = "Explain it."
) -> Question:
    q = Question(
        tenant_id=SEED_TENANT_ID,
        test_id=test_id,
        type=QuestionType.short_answer,
        config={"prompt": prompt, "rubric": "Be specific.", "model_answer": "X"},
        assigned_difficulty=5,
        question_group_id=None,
        realism_flag_count=0,
    )
    session.add(q)
    return q


def _assignment(
    session: CatalogueFakeSession,
    *,
    pill: Pill | None,
    learning_path_id: uuid.UUID | None,
    assigner: AppUser,
    loop_mode: LoopMode = LoopMode.autonomous,
    difficulty: int = 5,
) -> Assignment:
    a = Assignment(
        tenant_id=SEED_TENANT_ID,
        assigner_id=assigner.id,
        pill_id=(pill.id if pill else None),
        learning_path_id=learning_path_id,
        difficulty=difficulty,
        deadline=None,
        is_mandatory=False,
        loop_mode=loop_mode,
    )
    session.add(a)
    return a


def _assignee(
    session: CatalogueFakeSession, *, assignment: Assignment, testee: AppUser
) -> AssignmentAssignee:
    row = AssignmentAssignee(
        tenant_id=SEED_TENANT_ID,
        assignment_id=assignment.id,
        user_id=testee.id,
        via_group_id=None,
    )
    session.add(row)
    return row


def _start(
    client: TestClient,
    t: AppUser,
    *,
    test_id: uuid.UUID,
    origin: AttemptOrigin = AttemptOrigin.self_initiated,
    assignment_id: uuid.UUID | None = None,
) -> dict:
    body: dict[str, Any] = {"test_id": str(test_id), "origin": origin.value}
    if assignment_id is not None:
        body["assignment_id"] = str(assignment_id)
    r = client.post("/v1/attempts", headers=bearer(t), json=body)
    assert r.status_code == 201, r.text
    return r.json()


def _autosave(
    client: TestClient, t: AppUser, attempt_id: str, question_id: str, payload: dict
) -> None:
    r = client.post(
        f"/v1/attempts/{attempt_id}/autosave",
        headers=bearer(t),
        json={"question_id": question_id, "answer_payload": payload, "time_ms": 1000},
    )
    assert r.status_code == 200, r.text


def _submit(client: TestClient, t: AppUser, attempt_id: str) -> Any:
    return client.post(f"/v1/attempts/{attempt_id}/submit", headers=bearer(t))


def _set_weakness(
    recording_provider: RecordingProvider, *, pill_id: uuid.UUID, severity: float = 0.8
) -> None:
    """Override the canned weakness response so identify_weakness sees a
    weak pill matching our parent assignment. Otherwise the default
    {"weak_pills": []} produces zero follow-ups and the happy-path
    asserts fail."""
    recording_provider.set_response(
        Operation.weakness,
        {"weak_pills": [{"pill_id": str(pill_id), "severity": severity}]},
    )


# --- Happy path: autonomous follow-up + LearningMaterial --------------


def test_failed_assignment_attempt_triggers_autonomous_loop(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Failed single-pill assignment-driven attempt with autonomous
    loop_mode → WeaknessReport persisted, LearningMaterial generated
    against the weak pill, per_testee follow-up Test/Assignment/
    AssignmentAssignee/Attempt created. The follow-up Attempt has
    origin=loop_driven and parent_attempt_id pointing at the failed
    attempt.
    """
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject)
    test = _frozen_mcq_test(cat_session)
    q1 = _mcq(cat_session, test.id, correct=0)
    q2 = _mcq(cat_session, test.id, correct=0)
    assignment = _assignment(
        cat_session,
        pill=pill,
        learning_path_id=None,
        assigner=admin,
        loop_mode=LoopMode.autonomous,
    )
    _assignee(cat_session, assignment=assignment, testee=testee)

    _set_weakness(recording_provider, pill_id=pill.id)

    started = _start(
        cat_client,
        testee,
        test_id=test.id,
        origin=AttemptOrigin.assignment_driven,
        assignment_id=assignment.id,
    )
    # Both answers wrong → overall_score = 0.0 < pass_threshold (0.5).
    _autosave(cat_client, testee, started["id"], str(q1.id), {"choice": 2})
    _autosave(cat_client, testee, started["id"], str(q2.id), {"choice": 2})

    r = _submit(cat_client, testee, started["id"])
    assert r.status_code == 200, r.text

    # WeaknessReport persisted with full provenance + a WeaknessReportPill
    # row for our pill.
    reports = cat_session.store.get(WeaknessReport, [])
    assert len(reports) == 1
    report = reports[0]
    assert report.attempt_id == uuid.UUID(started["id"])
    assert report.routed_to_admin is False  # autonomous mode skips admin
    pill_rows = cat_session.store.get(WeaknessReportPill, [])
    assert {row.pill_id for row in pill_rows} == {pill.id}

    # LearningMaterial generated for the weak (non-safety) pill with
    # served_at + served_text populated for the next attempt's AC-D4 #5
    # overlap lookup.
    materials = cat_session.store.get(LearningMaterial, [])
    assert len(materials) == 1
    material = materials[0]
    assert material.pill_id == pill.id
    assert material.testee_id == testee.id
    assert material.source == LearningMaterialSource.ai_generated
    assert material.served_at is not None
    assert material.served_text  # non-empty

    # Autonomous follow-up: a per_testee Test, an Assignment, an
    # AssignmentAssignee snapshot, and a started Attempt with
    # origin=loop_driven all created.
    all_tests = cat_session.store.get(Test, [])
    follow_up_tests = [t for t in all_tests if t.mode == TestMode.per_testee]
    assert len(follow_up_tests) == 1
    follow_up_test = follow_up_tests[0]
    assert follow_up_test.visibility == TestVisibility.private  # not in library
    assert pill.name in follow_up_test.name  # "Follow-up: <pill>"

    all_assignments = cat_session.store.get(Assignment, [])
    follow_up_assignments = [a for a in all_assignments if a.id != assignment.id]
    assert len(follow_up_assignments) == 1
    follow_up_assignment = follow_up_assignments[0]
    assert follow_up_assignment.pill_id == pill.id
    assert follow_up_assignment.loop_mode == LoopMode.autonomous
    assert follow_up_assignment.assigner_id == admin.id  # reused parent's

    # The AssignmentAssignee snapshot row was created for the follow-up.
    all_assignees = cat_session.store.get(AssignmentAssignee, [])
    follow_up_assignees = [
        x for x in all_assignees if x.assignment_id == follow_up_assignment.id
    ]
    assert len(follow_up_assignees) == 1
    assert follow_up_assignees[0].user_id == testee.id

    # A loop_driven Attempt was started against the follow-up.
    all_attempts = cat_session.store.get(Attempt, [])
    follow_up_attempts = [
        a for a in all_attempts if a.origin == AttemptOrigin.loop_driven
    ]
    assert len(follow_up_attempts) == 1
    follow_up_attempt = follow_up_attempts[0]
    assert follow_up_attempt.test_id == follow_up_test.id
    assert follow_up_attempt.assignment_id == follow_up_assignment.id
    assert follow_up_attempt.testee_id == testee.id


# --- Safety pill: no AI material, follow-up still created -------------


def test_safety_pill_skips_ai_material_but_still_creates_followup(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Safety-tagged pill per AC-D21: generate_for_weakness returns None
    (no LearningMaterial row). The autonomous follow-up still proceeds —
    the AC-D6 spec doesn't exclude safety pills from the loop, only
    from AI teaching content. P11 will ship curated_safety_links via the
    same LearningMaterial table with a different source.
    """
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject, safety_relevant=True)
    test = _frozen_mcq_test(cat_session)
    q1 = _mcq(cat_session, test.id, correct=0)
    assignment = _assignment(
        cat_session, pill=pill, learning_path_id=None, assigner=admin
    )
    _assignee(cat_session, assignment=assignment, testee=testee)
    _set_weakness(recording_provider, pill_id=pill.id)

    started = _start(
        cat_client,
        testee,
        test_id=test.id,
        origin=AttemptOrigin.assignment_driven,
        assignment_id=assignment.id,
    )
    _autosave(cat_client, testee, started["id"], str(q1.id), {"choice": 2})
    r = _submit(cat_client, testee, started["id"])
    assert r.status_code == 200, r.text

    # WeaknessReport created (audit trail preserved for safety pills).
    assert len(cat_session.store.get(WeaknessReport, [])) == 1

    # NO LearningMaterial row — generate_for_weakness short-circuits on
    # safety_relevant pills per AC-D21.
    assert cat_session.store.get(LearningMaterial, []) == []

    # Follow-up still created (the loop continues for safety pills).
    follow_ups = [
        a
        for a in cat_session.store.get(Attempt, [])
        if a.origin == AttemptOrigin.loop_driven
    ]
    assert len(follow_ups) == 1


# --- Admin-reviewed mode: WeaknessReport routed to admin, no follow-up ---


def test_admin_reviewed_mode_routes_to_queue_without_followup(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """``Assignment.loop_mode = admin_reviewed`` flips
    ``WeaknessReport.routed_to_admin`` to True and does NOT create a
    follow-up. Slice 3's admin endpoints (GET queue / approve / reject)
    walk these rows and create the follow-up on approval — for Slice 2
    the loop simply marks the report and stops.
    """
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject)
    test = _frozen_mcq_test(cat_session)
    q1 = _mcq(cat_session, test.id, correct=0)
    assignment = _assignment(
        cat_session,
        pill=pill,
        learning_path_id=None,
        assigner=admin,
        loop_mode=LoopMode.admin_reviewed,
    )
    _assignee(cat_session, assignment=assignment, testee=testee)
    _set_weakness(recording_provider, pill_id=pill.id)

    started = _start(
        cat_client,
        testee,
        test_id=test.id,
        origin=AttemptOrigin.assignment_driven,
        assignment_id=assignment.id,
    )
    _autosave(cat_client, testee, started["id"], str(q1.id), {"choice": 2})
    assert _submit(cat_client, testee, started["id"]).status_code == 200

    reports = cat_session.store.get(WeaknessReport, [])
    assert len(reports) == 1
    assert reports[0].routed_to_admin is True

    # No LearningMaterial — admin-reviewed mode gates everything behind
    # the admin's approval (Slice 3 endpoints kick that off).
    assert cat_session.store.get(LearningMaterial, []) == []

    # No follow-up.
    follow_ups = [
        a
        for a in cat_session.store.get(Attempt, [])
        if a.origin == AttemptOrigin.loop_driven
    ]
    assert follow_ups == []


# --- Competence update writes CompetencyProfile ----------------------


def test_failed_attempt_writes_competence_estimate(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """A submitted in-scope attempt — pass or fail — produces a
    :class:`CompetencyProfile` row for (testee, pill). The
    competence_estimate is the recency-weighted aggregate over this and
    any prior attempts on the same pill.
    """
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject)
    test = _frozen_mcq_test(cat_session)
    q1 = _mcq(cat_session, test.id, correct=0)
    assignment = _assignment(
        cat_session, pill=pill, learning_path_id=None, assigner=admin
    )
    _assignee(cat_session, assignment=assignment, testee=testee)
    _set_weakness(recording_provider, pill_id=pill.id)

    started = _start(
        cat_client,
        testee,
        test_id=test.id,
        origin=AttemptOrigin.assignment_driven,
        assignment_id=assignment.id,
    )
    # Fully wrong → score 0.0 → response_competence at difficulty 5,
    # sens 2.0 = 5.0 + 2.0 * (-0.5) = 4.0. Single response, single
    # attempt → competence_estimate = 4.0.
    _autosave(cat_client, testee, started["id"], str(q1.id), {"choice": 2})
    assert _submit(cat_client, testee, started["id"]).status_code == 200

    profiles = cat_session.store.get(CompetencyProfile, [])
    assert len(profiles) == 1
    profile = profiles[0]
    assert profile.testee_id == testee.id
    assert profile.pill_id == pill.id
    assert profile.competence_estimate == pytest.approx(4.0)
    assert profile.last_activity_at is not None


# --- Overlap check sets flag at >= 60% trigram overlap ----------------


def test_overlap_check_flags_near_verbatim_copy(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """A short_answer response that copies the previously served
    ``LearningMaterial.served_text`` near-verbatim must flag
    ``Grade.overlap_flagged`` and set ``Grade.overlap_pct >= 0.60``.

    Setup: seed a LearningMaterial row directly (no first attempt
    required — we're isolating the overlap pass) and submit a single
    short_answer attempt whose answer matches the served_text.
    """
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject)
    test = _frozen_mcq_test(cat_session)
    sa = _short_answer(cat_session, test.id, prompt="Explain CP.")
    assignment = _assignment(
        cat_session, pill=pill, learning_path_id=None, assigner=admin
    )
    _assignee(cat_session, assignment=assignment, testee=testee)
    _set_weakness(recording_provider, pill_id=pill.id)

    # Seed the served LearningMaterial that the overlap check will
    # compare against (mimics the state after a prior failed attempt).
    served = (
        "Cathodic protection prevents corrosion by making the structure "
        "the cathode of an electrochemical cell."
    )
    cat_session.add(
        LearningMaterial(
            tenant_id=SEED_TENANT_ID,
            pill_id=pill.id,
            testee_id=testee.id,
            weakness_report_id=None,
            source=LearningMaterialSource.ai_generated,
            content=served,
            served_at=p.now_utc(),
            served_text=served,
        )
    )

    started = _start(
        cat_client,
        testee,
        test_id=test.id,
        origin=AttemptOrigin.assignment_driven,
        assignment_id=assignment.id,
    )
    # Near-verbatim copy — small wording edit but identical structure.
    copied = (
        "Cathodic protection prevents corrosion by making the structure "
        "the cathode of the cell."
    )
    _autosave(cat_client, testee, started["id"], str(sa.id), {"text": copied})
    assert _submit(cat_client, testee, started["id"]).status_code == 200

    grades = cat_session.store.get(Grade, [])
    ai_grades = [g for g in grades if g.response_id is not None]
    # _ai_grade_responses writes one Grade row per AI-graded response.
    # The overlap pass set both fields on it.
    assert len(ai_grades) == 1
    g = ai_grades[0]
    assert g.overlap_flagged is True
    assert g.overlap_pct is not None
    assert g.overlap_pct >= 0.60


def test_overlap_check_does_not_flag_disjoint_text(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """A response sharing no trigrams with the served material must
    produce overlap_pct ≈ 0.0 and overlap_flagged=False. Locks in the
    "we don't flag everything" invariant — a flag at 0.0 would erode
    admin trust in the signal."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject)
    test = _frozen_mcq_test(cat_session)
    sa = _short_answer(cat_session, test.id, prompt="Explain it.")
    assignment = _assignment(
        cat_session, pill=pill, learning_path_id=None, assigner=admin
    )
    _assignee(cat_session, assignment=assignment, testee=testee)
    _set_weakness(recording_provider, pill_id=pill.id)

    cat_session.add(
        LearningMaterial(
            tenant_id=SEED_TENANT_ID,
            pill_id=pill.id,
            testee_id=testee.id,
            weakness_report_id=None,
            source=LearningMaterialSource.ai_generated,
            content="abcdefg",
            served_at=p.now_utc(),
            served_text="abcdefg",
        )
    )
    started = _start(
        cat_client,
        testee,
        test_id=test.id,
        origin=AttemptOrigin.assignment_driven,
        assignment_id=assignment.id,
    )
    _autosave(cat_client, testee, started["id"], str(sa.id), {"text": "1234567"})
    assert _submit(cat_client, testee, started["id"]).status_code == 200

    grades = cat_session.store.get(Grade, [])
    ai_grades = [g for g in grades if g.response_id is not None]
    assert len(ai_grades) == 1
    assert ai_grades[0].overlap_flagged is False
    assert ai_grades[0].overlap_pct == pytest.approx(0.0)


# --- Out-of-scope skips ---------------------------------------------


def test_self_initiated_attempt_skips_loop_and_competence(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """A self-initiated attempt has no Assignment, so no pill to
    attribute to. Scope guards in apply_overlap_check, apply_competence_
    update, and run_loop_after_submit all skip silently. No
    WeaknessReport, no LearningMaterial, no CompetencyProfile, no
    follow-up.
    """
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    test = _frozen_mcq_test(cat_session)
    q1 = _mcq(cat_session, test.id, correct=0)

    started = _start(
        cat_client, testee, test_id=test.id, origin=AttemptOrigin.self_initiated
    )
    _autosave(cat_client, testee, started["id"], str(q1.id), {"choice": 2})
    assert _submit(cat_client, testee, started["id"]).status_code == 200

    assert cat_session.store.get(WeaknessReport, []) == []
    assert cat_session.store.get(LearningMaterial, []) == []
    assert cat_session.store.get(CompetencyProfile, []) == []


def test_learning_path_assignment_skips_loop_and_competence(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """A learning-path-driven Assignment has ``pill_id IS NULL`` —
    multi-pill scope, no single pill to attribute. All P7 hooks skip
    silently per the locked planning decision. No WeaknessReport, no
    LearningMaterial, no CompetencyProfile, no follow-up.
    """
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    test = _frozen_mcq_test(cat_session)
    q1 = _mcq(cat_session, test.id, correct=0)
    # learning_path_id non-null, pill_id null — multi-pill assignment.
    fake_path_id = uuid.uuid4()
    assignment = _assignment(
        cat_session, pill=None, learning_path_id=fake_path_id, assigner=admin
    )
    _assignee(cat_session, assignment=assignment, testee=testee)

    started = _start(
        cat_client,
        testee,
        test_id=test.id,
        origin=AttemptOrigin.assignment_driven,
        assignment_id=assignment.id,
    )
    _autosave(cat_client, testee, started["id"], str(q1.id), {"choice": 2})
    assert _submit(cat_client, testee, started["id"]).status_code == 200

    assert cat_session.store.get(WeaknessReport, []) == []
    assert cat_session.store.get(LearningMaterial, []) == []
    assert cat_session.store.get(CompetencyProfile, []) == []


def test_followup_chain_capped_at_max_loop_depth(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Defense-in-depth safety bound (PR-019 Gitar review): a Testee
    who keeps failing must not generate an unbounded chain of follow-
    ups. After ``MAX_LOOP_DEPTH`` consecutive loop_driven attempts in
    a single chain, the loop driver writes the WeaknessReport +
    LearningMaterial (audit trail + admin queue intact) but stops
    creating further follow-up Attempts.

    Setup: hand-build a chain of submitted loop_driven attempts at
    depth ``MAX_LOOP_DEPTH`` parented via ``parent_attempt_id``, then
    submit the depth-N attempt as a new failure. The loop must NOT
    create another follow-up. The WeaknessReport MUST still exist.
    """
    from app.domain.loop import MAX_LOOP_DEPTH

    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject)
    _set_weakness(recording_provider, pill_id=pill.id)

    # Hand-build a chain of MAX_LOOP_DEPTH already-submitted loop_driven
    # attempts. We don't need them to be fully realistic — just for
    # _loop_chain_depth to walk via parent_attempt_id and find the
    # right depth.
    chain_parent: Attempt | None = None
    for _i in range(MAX_LOOP_DEPTH):
        new_test = Test(
            tenant_id=SEED_TENANT_ID,
            name=f"chain-{_i}",
            mode=TestMode.per_testee,
            status=TestStatus.published,
            visibility=TestVisibility.private,
            timed=False,
            timeout_behaviour=TimeoutBehaviour.auto_submit,
            max_pause_duration_minutes=30,
            target_difficulty=5,
            randomise_question_order=False,
            randomise_option_order=False,
            pass_threshold=0.5,
        )
        cat_session.add(new_test)
        new_assignment = Assignment(
            tenant_id=SEED_TENANT_ID,
            assigner_id=admin.id,
            pill_id=pill.id,
            learning_path_id=None,
            difficulty=5,
            deadline=None,
            is_mandatory=False,
            loop_mode=LoopMode.autonomous,
        )
        cat_session.add(new_assignment)
        a = Attempt(
            tenant_id=SEED_TENANT_ID,
            test_id=new_test.id,
            testee_id=testee.id,
            origin=AttemptOrigin.loop_driven,
            assignment_id=new_assignment.id,
            parent_attempt_id=(chain_parent.id if chain_parent else None),
            started_at=p.now_utc(),
            submitted_at=p.now_utc(),
            sequence_number=1,
            pauses_used=0,
            total_pause_duration_seconds=0,
            overall_score=0.0,
        )
        cat_session.add(a)
        chain_parent = a

    # The tail of the chain is what we submit next. Now run a fresh
    # submit that the loop driver will walk back from. We can't easily
    # round-trip through the HTTP client because the chain is hand-
    # built; invoke run_loop_after_submit directly. That's the
    # function under test — the wiring into submit_attempt is covered
    # by the happy-path test above.
    import asyncio

    from app.domain.loop import run_loop_after_submit
    from app.models import get_db  # noqa: F401  (proves the import side)

    # Build a tail test/attempt to act as the depth-N submission.
    # The chain_parent is at depth MAX_LOOP_DEPTH; a submit on it
    # should produce no further follow-up because the depth check
    # observes ``depth == MAX_LOOP_DEPTH`` and skips.
    tail_test = next(
        t for t in cat_session.store.get(Test, []) if t.id == chain_parent.test_id
    )
    asyncio.run(run_loop_after_submit(cat_session, chain_parent, tail_test))

    # WeaknessReport written — audit trail preserved per the
    # chain-cap docstring.
    reports = cat_session.store.get(WeaknessReport, [])
    assert len(reports) == 1

    # LearningMaterial generated — the explainer is useful regardless.
    materials = cat_session.store.get(LearningMaterial, [])
    assert len(materials) == 1

    # The key assertion: NO new follow-up Attempt beyond the ones we
    # hand-built. Counting loop_driven attempts: started with
    # MAX_LOOP_DEPTH and must STILL be MAX_LOOP_DEPTH after the depth-
    # capped submit.
    loop_attempts = [
        a
        for a in cat_session.store.get(Attempt, [])
        if a.origin == AttemptOrigin.loop_driven
    ]
    assert len(loop_attempts) == MAX_LOOP_DEPTH


def test_passing_attempt_updates_competence_but_creates_no_followup(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """An in-scope attempt that PASSED still updates CompetencyProfile
    (the loop tracks competence growth, not just failures) but creates
    no follow-up — there's nothing weak to remediate.
    """
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject)
    test = _frozen_mcq_test(cat_session)
    q1 = _mcq(cat_session, test.id, correct=0)
    assignment = _assignment(
        cat_session, pill=pill, learning_path_id=None, assigner=admin
    )
    _assignee(cat_session, assignment=assignment, testee=testee)
    _set_weakness(recording_provider, pill_id=pill.id)

    started = _start(
        cat_client,
        testee,
        test_id=test.id,
        origin=AttemptOrigin.assignment_driven,
        assignment_id=assignment.id,
    )
    # Correct answer → score 1.0 → overall_score 1.0 >= pass_threshold.
    _autosave(cat_client, testee, started["id"], str(q1.id), {"choice": 0})
    assert _submit(cat_client, testee, started["id"]).status_code == 200

    # Competence WAS updated.
    profiles = cat_session.store.get(CompetencyProfile, [])
    assert len(profiles) == 1
    # response_score 1.0 at difficulty 5, sens 2.0 → 5 + 2*0.5 = 6.0.
    assert profiles[0].competence_estimate == pytest.approx(6.0)

    # No WeaknessReport / LearningMaterial / follow-up — loop guarded on
    # overall_score < pass_threshold.
    assert cat_session.store.get(WeaknessReport, []) == []
    assert cat_session.store.get(LearningMaterial, []) == []
    follow_ups = [
        a
        for a in cat_session.store.get(Attempt, [])
        if a.origin == AttemptOrigin.loop_driven
    ]
    assert follow_ups == []
