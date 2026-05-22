"""P8 Slice 3 — anchor score denormalisation + fresh-question delta at
submit (AC-D20 / AC-D27 / CODE_SPEC §12).

Two intertwined behaviours land on the submit path:

* ``submit_attempt`` denormalises each :class:`AttemptAnchor.score`
  from the matching :class:`Response.response_score`. The
  calibration sweep reads scores from the AttemptAnchor column
  directly so per-anchor recompute walks one table, not a join.
* ``_effective_difficulty`` switches branches for per_testee
  questions in anchor-bearing attempts: instead of falling through
  to bare ``assigned_difficulty``, it computes
  ``mean(anchor.effective - assigned)`` across the same-attempt
  anchors and adds it to the question's own difficulty (the
  AC-D27 / CODE_SPEC §12 "fresh-question delta"). The competence
  estimate produced at submit-time therefore reflects each
  Testee's anchor-derived difficulty signal.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.models import (
    SEED_TENANT_ID,
    AnchorQuestion,
    AppUser,
    Assignment,
    AssignmentAssignee,
    Attempt,
    AttemptAnchor,
    AttemptOrigin,
    CompetencyProfile,
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
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    RecordingProvider,
    bearer,
    cat_make_user,
    seed_system_settings,
)

# --- Fixtures (lightweight copies of the draw test's helpers; kept
# local to this module so each test file reads on its own without
# cross-file fixture inheritance) ---


def _admin(s: CatalogueFakeSession) -> AppUser:
    return cat_make_user(s, email="a@kbc.com", role=p.ROLE_ADMINISTRATOR)


def _testee(s: CatalogueFakeSession) -> AppUser:
    return cat_make_user(s, email="t@kbc.com", role=p.ROLE_TESTEE)


def _pill(s: CatalogueFakeSession) -> Pill:
    sub = Subject(tenant_id=SEED_TENANT_ID, name="ops", description="")
    s.add(sub)
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=sub.id,
        name="Lifting",
        description="",
        available_difficulty_min=1,
        available_difficulty_max=10,
        discoverable=True,
        safety_relevant=False,
    )
    s.add(pill)
    return pill


def _per_testee_test(s: CatalogueFakeSession) -> Test:
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="Lifting Diagnostic",
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
    s.add(test)
    return test


def _seed_anchor_pair(
    s: CatalogueFakeSession,
    *,
    pill: Pill,
    band: int = 5,
    assigned_difficulty: int = 5,
    effective_difficulty: float | None = None,
    anchor_id: uuid.UUID | None = None,
) -> tuple[Question, AnchorQuestion]:
    aid = anchor_id if anchor_id is not None else uuid.uuid4()
    question = Question(
        id=aid,
        tenant_id=SEED_TENANT_ID,
        pill_id=pill.id,
        type=QuestionType.multiple_choice,
        config={"prompt": f"q{aid}", "options": ["a", "b", "c"], "correct": 1},
        assigned_difficulty=assigned_difficulty,
        realism_flag_count=0,
    )
    s.add(question)
    anchor = AnchorQuestion(
        id=aid,
        tenant_id=SEED_TENANT_ID,
        pill_id=pill.id,
        band=band,
        type=QuestionType.multiple_choice,
        config=question.config,
        assigned_difficulty=assigned_difficulty,
        effective_difficulty=effective_difficulty,
        total_attempts=0,
        regeneration_attempts=0,
        excluded=False,
    )
    s.add(anchor)
    return question, anchor


def _assignment(s: CatalogueFakeSession, *, pill: Pill, assigner: AppUser) -> Assignment:
    a = Assignment(
        tenant_id=SEED_TENANT_ID,
        assigner_id=assigner.id,
        pill_id=pill.id,
        learning_path_id=None,
        difficulty=5,
        deadline=None,
        is_mandatory=False,
        loop_mode=LoopMode.autonomous,
    )
    s.add(a)
    return a


def _assignee(
    s: CatalogueFakeSession, *, assignment: Assignment, testee: AppUser
) -> AssignmentAssignee:
    row = AssignmentAssignee(
        tenant_id=SEED_TENANT_ID,
        assignment_id=assignment.id,
        user_id=testee.id,
        via_group_id=None,
    )
    s.add(row)
    return row


def _make_per_testee_generation(
    recording_provider: RecordingProvider,
) -> None:
    """Override the default 2-question canned generation with a
    deterministic single multiple_choice anchored at difficulty 5
    + ``correct = 0``. Lets the test pick the matching choice and
    score 1.0 deterministically on the per_testee questions, isolating
    the anchor-driven dynamics from per_testee scoring noise."""
    recording_provider.set_response(
        # Operation.generation per recording provider's response map.
        list(recording_provider.responses.keys())[0],
        {
            "questions": [
                {
                    "type": "multiple_choice",
                    "assigned_difficulty": 5,
                    "config": {
                        "prompt": "fresh q",
                        "options": ["a", "b", "c"],
                        "correct": 0,
                    },
                }
            ]
        },
    )


def _start(client: TestClient, t: AppUser, *, test: Test, assignment: Assignment) -> dict:
    r = client.post(
        "/v1/attempts",
        headers=bearer(t),
        json={
            "test_id": str(test.id),
            "origin": AttemptOrigin.assignment_driven.value,
            "assignment_id": str(assignment.id),
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def _autosave(
    client: TestClient,
    t: AppUser,
    attempt_id: str,
    question_id: str,
    payload: dict[str, Any],
) -> None:
    r = client.post(
        f"/v1/attempts/{attempt_id}/autosave",
        headers=bearer(t),
        json={"question_id": question_id, "answer_payload": payload, "time_ms": 1000},
    )
    assert r.status_code == 200, r.text


def _submit(client: TestClient, t: AppUser, attempt_id: str) -> Any:
    return client.post(f"/v1/attempts/{attempt_id}/submit", headers=bearer(t))


# --- Score denormalisation --------------------------------------------


def test_submit_denormalises_anchor_score_from_response(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """A Testee who answers each drawn anchor correctly gets
    :attr:`AttemptAnchor.score` populated from
    :attr:`Response.response_score` at submit. Refinement #3:
    the denormalised column must always equal the source response
    score so the calibration sweep can read one column instead of
    walking the Response table per anchor."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    # Pool of exactly 2 anchors so both are drawn (the draw caps at 2).
    _seed_anchor_pair(cat_session, pill=pill)
    _seed_anchor_pair(cat_session, pill=pill)
    test = _per_testee_test(cat_session)
    _make_per_testee_generation(recording_provider)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    started = _start(cat_client, testee, test=test, assignment=assignment)
    attempt_id = started["id"]

    # Answer each anchor + the fresh per_testee question correctly.
    snapshot = next(
        a for a in cat_session.store.get(Attempt, []) if str(a.id) == attempt_id
    ).question_snapshot["questions"]
    for entry in snapshot:
        choice = entry["config"]["correct"]
        _autosave(
            cat_client,
            testee,
            attempt_id,
            entry["question_id"],
            {"choice": choice},
        )
    assert _submit(cat_client, testee, attempt_id).status_code == 200

    anchors_written = [
        row
        for row in cat_session.store.get(AttemptAnchor, [])
        if str(row.attempt_id) == attempt_id
    ]
    assert len(anchors_written) == 2
    # Every anchor scored exactly 1.0 — denormalised from the correct
    # answer's deterministic auto-grade.
    assert all(row.score == 1.0 for row in anchors_written)


def test_submit_denormalises_zero_score_for_unanswered_mcq_anchor(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """The deterministic auto-grader writes a Response with
    ``response_score=0.0`` for an unanswered MCQ anchor — no answer =
    no credit. Denormalisation copies that 0.0 onto
    :attr:`AttemptAnchor.score`. The calibration sweep therefore sees
    a real observation (0.0), not a missing one (NULL); the AC-D27
    estimator treats an MCQ no-answer as a confident "Testee got it
    wrong" signal, matching the deterministic grader's existing
    semantic."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    _seed_anchor_pair(cat_session, pill=pill)
    _seed_anchor_pair(cat_session, pill=pill)
    test = _per_testee_test(cat_session)
    _make_per_testee_generation(recording_provider)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    started = _start(cat_client, testee, test=test, assignment=assignment)
    # Submit with zero autosaves — Testee bailed before answering anything.
    # The auto-grader writes a Response per snapshot item with
    # response_score=0.0; my denormalisation copies that to
    # AttemptAnchor.score.
    assert _submit(cat_client, testee, started["id"]).status_code == 200

    anchors_written = cat_session.store.get(AttemptAnchor, [])
    assert len(anchors_written) == 2
    assert all(row.score == 0.0 for row in anchors_written)


# --- Fresh-question delta in competence ------------------------------


def test_fresh_question_delta_shifts_competence_estimate(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Worked fixture for the AC-D27 / CODE_SPEC §12 fresh-question
    delta path. Setup:

    - 2 anchors with known ``assigned_difficulty=5`` and
      ``effective_difficulty=7`` (each anchor's delta is +2);
    - 1 fresh per_testee question with ``assigned_difficulty=5``;
    - Testee answers all 3 questions correctly (score 1.0 each).

    Expected per-response competences (AC-D9 v1.2):
    ``effective + sensitivity * (score - 0.5)`` with sensitivity 2.0.

    - Anchor 1: effective=7, score=1.0 → 7 + 2*0.5 = 8.0
    - Anchor 2: effective=7, score=1.0 → 7 + 2*0.5 = 8.0
    - Fresh:    effective = 5 + mean_delta(2,2) = 7, score=1.0 → 8.0

    Attempt competence = mean(8.0, 8.0, 8.0) = 8.0.

    Without the fresh-question delta, the fresh question would resolve
    to ``effective = assigned = 5`` and produce a per-response
    competence of 6.0 — pulling the attempt mean down to (8+8+6)/3
    ~ 7.33. The 8.0 result is therefore unambiguous evidence that the
    delta is being applied to per_testee questions.
    """
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    _seed_anchor_pair(cat_session, pill=pill, effective_difficulty=7.0)
    _seed_anchor_pair(cat_session, pill=pill, effective_difficulty=7.0)
    test = _per_testee_test(cat_session)
    _make_per_testee_generation(recording_provider)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    started = _start(cat_client, testee, test=test, assignment=assignment)
    attempt_id = started["id"]
    snapshot = next(
        a for a in cat_session.store.get(Attempt, []) if str(a.id) == attempt_id
    ).question_snapshot["questions"]
    for entry in snapshot:
        _autosave(
            cat_client,
            testee,
            attempt_id,
            entry["question_id"],
            {"choice": entry["config"]["correct"]},
        )
    assert _submit(cat_client, testee, attempt_id).status_code == 200

    profiles = cat_session.store.get(CompetencyProfile, [])
    assert len(profiles) == 1
    assert profiles[0].competence_estimate == pytest.approx(8.0)


def test_fresh_question_delta_with_no_pool_falls_through_to_assigned(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """When the pill has no anchor pool yet, the fresh-question delta
    path computes ``delta = 0.0`` (empty anchor records → mean of
    nothing) and per_testee questions resolve to bare
    ``assigned_difficulty``. The competence estimate matches what
    P7 produced before Slice 3 — Slice 3 is strictly additive for
    attempts without anchors.

    P10 / AC-D25 v1.8 — per-Testee Question rows live in the DB
    keyed by ``attempt_id`` + ``attempt_position``, not in the
    snapshot (anchors-only). We fetch the rows directly to drive
    autosave / submit for the test."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)  # empty pool
    test = _per_testee_test(cat_session)
    _make_per_testee_generation(recording_provider)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    started = _start(cat_client, testee, test=test, assignment=assignment)
    attempt_id = uuid.UUID(started["id"])
    per_testee_rows = [
        q for q in cat_session.store.get(Question, []) if q.attempt_id == attempt_id
    ]
    for q in per_testee_rows:
        _autosave(
            cat_client,
            testee,
            started["id"],
            str(q.id),
            {"choice": q.config["correct"]},
        )
    assert _submit(cat_client, testee, started["id"]).status_code == 200

    profiles = cat_session.store.get(CompetencyProfile, [])
    assert len(profiles) == 1
    # 1 fresh question, score 1.0, effective = assigned = 5.
    # Per-response competence = 5 + 2*0.5 = 6.0; mean over 1 row = 6.0.
    assert profiles[0].competence_estimate == pytest.approx(6.0)


def test_submit_p7_baseline_competence_unchanged_for_non_per_testee(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Sanity check: the Slice 3 changes do not regress the P7
    baseline competence-update for attempts that don't draw anchors
    (test_p7_loop already pins the 6.0 worked-fixture for a frozen-
    mode attempt at score 1.0; that suite still passes in the full
    sweep but a one-liner reassertion here catches future drift
    inside the per_testee branch specifically).

    P10 / AC-D25 v1.8 — per-Testee Question rows live in the DB,
    not in the snapshot (anchors-only). Iterate DB rows directly."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    test = _per_testee_test(cat_session)
    _make_per_testee_generation(recording_provider)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    started = _start(cat_client, testee, test=test, assignment=assignment)
    attempt_id = uuid.UUID(started["id"])
    per_testee_rows = [
        q for q in cat_session.store.get(Question, []) if q.attempt_id == attempt_id
    ]
    for q in per_testee_rows:
        _autosave(
            cat_client,
            testee,
            started["id"],
            str(q.id),
            {"choice": q.config["correct"]},
        )
    assert _submit(cat_client, testee, started["id"]).status_code == 200

    profiles = cat_session.store.get(CompetencyProfile, [])
    # No anchors drawn (empty pool) + 1 fresh question scored 1.0 ⇒ 6.0.
    assert profiles[0].competence_estimate == pytest.approx(6.0)
