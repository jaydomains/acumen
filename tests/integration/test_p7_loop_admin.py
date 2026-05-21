"""P7 Slice 3 — admin-reviewed loop queue endpoints (AC-D6).

When ``Assignment.loop_mode == admin_reviewed`` a failed attempt's
WeaknessReport is written with ``routed_to_admin = True`` but no
follow-up is created inline. The three endpoints under
``/v1/admin/loop/queue/*`` let an admin walk the queue and decide:

  * GET    /v1/admin/loop/queue                         — list pending
  * POST   /v1/admin/loop/queue/{id}/approve            — create follow-up
  * POST   /v1/admin/loop/queue/{id}/reject             — clear without follow-up

These tests cover the happy paths and the 404 / 409 / 403 error cases.
The autonomous-mode submit path that writes ``routed_to_admin = True``
in the first place is exercised by ``test_p7_loop.py`` —
``test_admin_reviewed_mode_routes_to_queue_without_followup``.
"""

from __future__ import annotations

import uuid
from typing import Any

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
    LearningMaterial,
    LoopMode,
    Pill,
    QuestionType,
    Subject,
    Test,
    TestMode,
    TestStatus,
    TestVisibility,
    TimeoutBehaviour,
    WeaknessReport,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    RecordingProvider,
    bearer,
    cat_make_user,
    seed_system_settings,
)

# --- Fixtures ---------------------------------------------------------


def _subject(session: CatalogueFakeSession) -> Subject:
    s = Subject(tenant_id=SEED_TENANT_ID, name="Operations", description="")
    session.add(s)
    return s


def _pill(
    session: CatalogueFakeSession,
    *,
    subject: Subject,
    name: str = "Lifting Operations",
    safety_relevant: bool = False,
) -> Pill:
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=subject.id,
        name=name,
        description="",
        available_difficulty_min=1,
        available_difficulty_max=10,
        discoverable=True,
        safety_relevant=safety_relevant,
    )
    session.add(pill)
    return pill


def _admin(session: CatalogueFakeSession) -> AppUser:
    return cat_make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)


def _testee(session: CatalogueFakeSession) -> AppUser:
    return cat_make_user(session, email="t@kbc.com", role=p.ROLE_TESTEE)


def _frozen_test(session: CatalogueFakeSession) -> Test:
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
        pass_threshold=0.5,
    )
    session.add(test)
    return test


def _mcq_q(session: CatalogueFakeSession, test_id: uuid.UUID) -> Any:
    from app.models import Question

    q = Question(
        tenant_id=SEED_TENANT_ID,
        test_id=test_id,
        type=QuestionType.multiple_choice,
        config={"prompt": "p", "options": ["a", "b"], "correct": 0},
        assigned_difficulty=5,
        question_group_id=None,
        realism_flag_count=0,
    )
    session.add(q)
    return q


def _assignment(
    session: CatalogueFakeSession,
    *,
    admin: AppUser,
    pill: Pill | None,
    loop_mode: LoopMode = LoopMode.admin_reviewed,
) -> Assignment:
    a = Assignment(
        tenant_id=SEED_TENANT_ID,
        assigner_id=admin.id,
        pill_id=(pill.id if pill else None),
        learning_path_id=None,
        difficulty=5,
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


def _set_weakness(
    recording_provider: RecordingProvider, *, pill_id: uuid.UUID, severity: float = 0.8
) -> None:
    recording_provider.set_response(
        Operation.weakness,
        {"weak_pills": [{"pill_id": str(pill_id), "severity": severity}]},
    )


def _submit_failed_admin_reviewed(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    *,
    safety_pill: bool = False,
) -> tuple[Pill, AppUser, AppUser, WeaknessReport]:
    """End-to-end: seed catalogue, run a failed admin_reviewed attempt
    that lands a WeaknessReport on the queue, return the fixture set the
    admin endpoints exercise."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject, safety_relevant=safety_pill)
    test = _frozen_test(cat_session)
    q1 = _mcq_q(cat_session, test.id)
    assignment = _assignment(
        cat_session, admin=admin, pill=pill, loop_mode=LoopMode.admin_reviewed
    )
    _assignee(cat_session, assignment=assignment, testee=testee)
    _set_weakness(recording_provider, pill_id=pill.id)

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
    attempt_id = r.json()["id"]
    cat_client.post(
        f"/v1/attempts/{attempt_id}/autosave",
        headers=bearer(testee),
        json={"question_id": str(q1.id), "answer_payload": {"choice": 1}, "time_ms": 100},
    )
    assert (
        cat_client.post(
            f"/v1/attempts/{attempt_id}/submit", headers=bearer(testee)
        ).status_code
        == 200
    )

    reports = [
        rep for rep in cat_session.store.get(WeaknessReport, []) if rep.routed_to_admin
    ]
    assert len(reports) == 1
    return pill, admin, testee, reports[0]


# --- GET /v1/admin/loop/queue ----------------------------------------


def test_get_queue_returns_admin_reviewed_reports_oldest_first(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """The list endpoint surfaces every WeaknessReport with
    ``routed_to_admin = True``, oldest-first (matches P6's flagged-
    grade-review queue convention)."""
    pill, admin, _testee_, report = _submit_failed_admin_reviewed(
        cat_client, cat_session, recording_provider
    )

    r = cat_client.get("/v1/admin/loop/queue", headers=bearer(admin))
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert len(data) == 1
    row = data[0]
    assert row["weakness_report_id"] == str(report.id)
    assert row["pill_id"] == str(pill.id)
    assert row["pill_name"] == pill.name
    assert row["overall_score"] == 0.0  # answered wrongly, only question
    # weak_pill_ids carries the AI's identified weak pills — exactly
    # the one we seeded.
    assert row["weak_pill_ids"] == [str(pill.id)]


def test_get_queue_excludes_autonomous_reports(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Autonomous-mode reports have ``routed_to_admin = False`` and
    must not appear on the admin queue — their follow-ups already ran
    inline at submit. The queue is exclusively for admin_reviewed
    pending rows."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject=subject)
    test = _frozen_test(cat_session)
    q1 = _mcq_q(cat_session, test.id)
    assignment = _assignment(
        cat_session, admin=admin, pill=pill, loop_mode=LoopMode.autonomous
    )
    _assignee(cat_session, assignment=assignment, testee=testee)
    _set_weakness(recording_provider, pill_id=pill.id)

    r = cat_client.post(
        "/v1/attempts",
        headers=bearer(testee),
        json={
            "test_id": str(test.id),
            "origin": AttemptOrigin.assignment_driven.value,
            "assignment_id": str(assignment.id),
        },
    )
    attempt_id = r.json()["id"]
    cat_client.post(
        f"/v1/attempts/{attempt_id}/autosave",
        headers=bearer(testee),
        json={"question_id": str(q1.id), "answer_payload": {"choice": 1}, "time_ms": 100},
    )
    cat_client.post(f"/v1/attempts/{attempt_id}/submit", headers=bearer(testee))

    # Autonomous mode wrote a WeaknessReport (routed_to_admin=False).
    assert len(cat_session.store.get(WeaknessReport, [])) == 1
    # The admin queue is empty.
    q = cat_client.get("/v1/admin/loop/queue", headers=bearer(admin))
    assert q.status_code == 200
    assert q.json()["data"] == []


def test_get_queue_forbids_non_admin(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """Testee users cannot read the queue — 403 per the
    ``require_role(ROLE_ADMINISTRATOR)`` gate on the route."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    r = cat_client.get("/v1/admin/loop/queue", headers=bearer(testee))
    assert r.status_code == 403


# --- POST /v1/admin/loop/queue/{id}/approve --------------------------


def test_approve_creates_followup_and_clears_flag(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Approve runs the same flow autonomous mode would have run at
    submit: writes the LearningMaterial, creates the per_testee Test +
    Assignment + Assignee, starts the loop_driven Attempt. Clears
    ``routed_to_admin`` so the row drops off the queue."""
    pill, admin, testee, report = _submit_failed_admin_reviewed(
        cat_client, cat_session, recording_provider
    )

    r = cat_client.post(
        f"/v1/admin/loop/queue/{report.id}/approve", headers=bearer(admin)
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["weakness_report_id"] == str(report.id)
    assert body["follow_up_count"] == 1

    # Flag cleared.
    refreshed = next(
        rep for rep in cat_session.store.get(WeaknessReport, []) if rep.id == report.id
    )
    assert refreshed.routed_to_admin is False

    # LearningMaterial generated.
    materials = cat_session.store.get(LearningMaterial, [])
    assert len(materials) == 1
    assert materials[0].pill_id == pill.id

    # loop_driven follow-up Attempt started.
    follow_ups = [
        a
        for a in cat_session.store.get(Attempt, [])
        if a.origin == AttemptOrigin.loop_driven
    ]
    assert len(follow_ups) == 1
    assert follow_ups[0].testee_id == testee.id


def test_approve_safety_pill_skips_ai_material(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Same AC-D21 branch as the autonomous path: safety pill skips
    AI material generation (no LearningMaterial row) but still creates
    the follow-up. The admin approval is the gate for safety pills too
    — the curated-links P11 surface lands separately."""
    _pill_, admin, _testee_, report = _submit_failed_admin_reviewed(
        cat_client, cat_session, recording_provider, safety_pill=True
    )

    r = cat_client.post(
        f"/v1/admin/loop/queue/{report.id}/approve", headers=bearer(admin)
    )
    assert r.status_code == 201
    assert cat_session.store.get(LearningMaterial, []) == []
    follow_ups = [
        a
        for a in cat_session.store.get(Attempt, [])
        if a.origin == AttemptOrigin.loop_driven
    ]
    assert len(follow_ups) == 1


def test_approve_missing_report_404(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    bogus = uuid.uuid4()
    r = cat_client.post(f"/v1/admin/loop/queue/{bogus}/approve", headers=bearer(admin))
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_approve_already_resolved_409(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Double-approve must 409 — the queue gate is idempotent. After
    the first approve flips ``routed_to_admin = False``, a second
    approve sees the row is no longer pending and rejects."""
    _pill_, admin, _testee_, report = _submit_failed_admin_reviewed(
        cat_client, cat_session, recording_provider
    )
    first = cat_client.post(
        f"/v1/admin/loop/queue/{report.id}/approve", headers=bearer(admin)
    )
    assert first.status_code == 201
    second = cat_client.post(
        f"/v1/admin/loop/queue/{report.id}/approve", headers=bearer(admin)
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "not_in_queue"


def test_approve_forbids_non_admin(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    _pill_, _admin_, testee, report = _submit_failed_admin_reviewed(
        cat_client, cat_session, recording_provider
    )
    r = cat_client.post(
        f"/v1/admin/loop/queue/{report.id}/approve", headers=bearer(testee)
    )
    assert r.status_code == 403


# --- POST /v1/admin/loop/queue/{id}/reject ---------------------------


def test_reject_clears_flag_without_creating_followup(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Reject is the negative case — flag cleared, no LearningMaterial,
    no follow-up Test/Assignment/Attempt. The Testee never sees a
    remediation pass for this attempt; the WeaknessReport remains as
    an audit-trail record."""
    _pill_, admin, _testee_, report = _submit_failed_admin_reviewed(
        cat_client, cat_session, recording_provider
    )

    r = cat_client.post(f"/v1/admin/loop/queue/{report.id}/reject", headers=bearer(admin))
    assert r.status_code == 201
    assert r.json()["weakness_report_id"] == str(report.id)

    refreshed = next(
        rep for rep in cat_session.store.get(WeaknessReport, []) if rep.id == report.id
    )
    assert refreshed.routed_to_admin is False
    assert cat_session.store.get(LearningMaterial, []) == []
    follow_ups = [
        a
        for a in cat_session.store.get(Attempt, [])
        if a.origin == AttemptOrigin.loop_driven
    ]
    assert follow_ups == []


def test_reject_missing_report_404(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    bogus = uuid.uuid4()
    r = cat_client.post(f"/v1/admin/loop/queue/{bogus}/reject", headers=bearer(admin))
    assert r.status_code == 404


def test_reject_after_approve_409(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Approve then reject must 409 — the queue gate is symmetric.
    After the first approve flips ``routed_to_admin = False``, a
    subsequent reject sees the row is no longer pending."""
    _pill_, admin, _testee_, report = _submit_failed_admin_reviewed(
        cat_client, cat_session, recording_provider
    )
    assert (
        cat_client.post(
            f"/v1/admin/loop/queue/{report.id}/approve", headers=bearer(admin)
        ).status_code
        == 201
    )
    r = cat_client.post(f"/v1/admin/loop/queue/{report.id}/reject", headers=bearer(admin))
    assert r.status_code == 409


def test_reject_forbids_non_admin(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    _pill_, _admin_, testee, report = _submit_failed_admin_reviewed(
        cat_client, cat_session, recording_provider
    )
    r = cat_client.post(
        f"/v1/admin/loop/queue/{report.id}/reject", headers=bearer(testee)
    )
    assert r.status_code == 403
