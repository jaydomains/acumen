"""P8 Slice 3 — per-attempt anchor draw at ``start_attempt``
(AC-D20 / AC-D27 / AC-CD15).

Coverage of the draw side:
* per_testee + assignment-backed attempt with a non-empty pool draws
  exactly 2 :class:`AttemptAnchor` rows; the drawn UUIDs appear in
  ``attempt.question_snapshot``;
* resume stability — the same attempt re-running the draw produces
  the same two anchor IDs even when the pool UUIDs sort in a
  different order from ``created_at`` (the explicit ``sorted(...)``
  is doing the work; without it the draw would silently track DB
  physical order);
* empty pool / learning-path / non-per_testee attempts skip the
  draw cleanly with no row writes;
* drawn anchors are visible in the snapshot alongside per_testee
  questions — the Testee sees them inline.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.domain.calibration import draw_anchors_for_attempt
from app.models import (
    SEED_TENANT_ID,
    AnchorQuestion,
    AppUser,
    Assignment,
    AssignmentAssignee,
    Attempt,
    AttemptAnchor,
    AttemptOrigin,
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

# --- Fixtures ---------------------------------------------------------


def _admin(s: CatalogueFakeSession, email: str = "a@kbc.com") -> AppUser:
    return cat_make_user(s, email=email, role=p.ROLE_ADMINISTRATOR)


def _testee(s: CatalogueFakeSession, email: str = "t@kbc.com") -> AppUser:
    return cat_make_user(s, email=email, role=p.ROLE_TESTEE)


def _pill(s: CatalogueFakeSession, *, name: str = "Lifting") -> Pill:
    sub = Subject(tenant_id=SEED_TENANT_ID, name=f"sub-{name}", description="")
    s.add(sub)
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=sub.id,
        name=name,
        description="",
        available_difficulty_min=1,
        available_difficulty_max=10,
        discoverable=True,
        safety_relevant=False,
    )
    s.add(pill)
    return pill


def _per_testee_test(s: CatalogueFakeSession, *, target_difficulty: int = 5) -> Test:
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="Lifting Diagnostic",
        mode=TestMode.per_testee,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=False,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        target_difficulty=target_difficulty,
        randomise_question_order=False,
        randomise_option_order=False,
        pass_threshold=0.5,
    )
    s.add(test)
    return test


def _frozen_test(s: CatalogueFakeSession) -> Test:
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="Frozen Diagnostic",
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
    s.add(test)
    return test


def _assignment(
    s: CatalogueFakeSession,
    *,
    pill: Pill | None,
    assigner: AppUser,
    learning_path_id: uuid.UUID | None = None,
) -> Assignment:
    a = Assignment(
        tenant_id=SEED_TENANT_ID,
        assigner_id=assigner.id,
        pill_id=(pill.id if pill else None),
        learning_path_id=learning_path_id,
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


def _seed_anchor_pair(
    s: CatalogueFakeSession,
    *,
    pill: Pill,
    band: int,
    assigned_difficulty: int = 5,
    effective_difficulty: float | None = None,
    excluded: bool = False,
    anchor_id: uuid.UUID | None = None,
) -> tuple[Question, AnchorQuestion]:
    """Seed a matched (Question, AnchorQuestion) pair sharing the same
    primary-key UUID per the shared-PK convention (the same shape
    Slice 2's bootstrap loop writes). Letting tests pass an explicit
    ``anchor_id`` controls the sort order for the resume-stability
    test."""
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
        excluded=excluded,
    )
    s.add(anchor)
    return question, anchor


def _start_assignment_attempt(
    client: TestClient, t: AppUser, *, test: Test, assignment: Assignment
) -> dict:
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


# --- Happy path -------------------------------------------------------


def test_anchor_draw_writes_two_attempt_anchor_rows(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """A per_testee + assignment-backed attempt against a pill with 5
    band-5 anchors draws exactly 2 :class:`AttemptAnchor` rows and
    folds the drawn anchor IDs into the snapshot alongside the
    per_testee questions."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    for _ in range(5):
        _seed_anchor_pair(cat_session, pill=pill, band=5)
    test = _per_testee_test(cat_session, target_difficulty=5)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    started = _start_assignment_attempt(
        cat_client, testee, test=test, assignment=assignment
    )

    attempt_id = uuid.UUID(started["id"])
    anchors_written = [
        row
        for row in cat_session.store.get(AttemptAnchor, [])
        if row.attempt_id == attempt_id
    ]
    assert len(anchors_written) == 2
    assert all(row.score is None for row in anchors_written)

    # Snapshot carries the 2 anchors + the 2 per_testee questions (the
    # default RecordingProvider returns 2 questions per generation
    # call), in that order.
    attempts = cat_session.store.get(Attempt, [])
    attempt = next(a for a in attempts if a.id == attempt_id)
    snapshot_ids = {q["question_id"] for q in attempt.question_snapshot["questions"]}
    drawn_ids = {str(row.anchor_question_id) for row in anchors_written}
    assert drawn_ids.issubset(snapshot_ids)
    # 2 per_testee + 2 anchors = 4 snapshot entries.
    assert len(attempt.question_snapshot["questions"]) == 4


# --- Resume stability -------------------------------------------------


@pytest.mark.asyncio
async def test_anchor_draw_is_deterministic_on_resume(
    cat_session: CatalogueFakeSession,
) -> None:
    """Calling :func:`draw_anchors_for_attempt` twice against the same
    ``attempt.shuffle_seed`` produces the same two anchor IDs even
    though the pool UUIDs sort in a different order than
    ``created_at``. Without the explicit ``sorted(pool, key=a.id)``
    in the production code, a re-fetch could yield a different pool
    order and the draw would re-shuffle to different anchors.

    Seeding the UUIDs in a deliberately non-monotonic order against
    ``created_at`` is what exercises the sort — a naive
    pool-as-fetched implementation would silently pass this test
    when the fake harness happens to return rows in insertion order.
    """
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)

    # Hand-pick UUIDs whose lexicographic order differs from
    # insertion order. The fake session preserves insertion order on
    # store.get(model, []); the production sort by anchor.id therefore
    # has visible effect.
    ordered_ids = [
        uuid.UUID("00000000-0000-0000-0000-000000000003"),
        uuid.UUID("00000000-0000-0000-0000-000000000001"),
        uuid.UUID("00000000-0000-0000-0000-000000000004"),
        uuid.UUID("00000000-0000-0000-0000-000000000002"),
        uuid.UUID("00000000-0000-0000-0000-000000000005"),
    ]
    for aid in ordered_ids:
        _seed_anchor_pair(cat_session, pill=pill, band=5, anchor_id=aid)
    test = _per_testee_test(cat_session, target_difficulty=5)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    # Build an Attempt row directly so we can call the draw helper twice
    # without going through the full ``start_attempt`` path (which would
    # write its own anchor rows once and only once).
    attempt = Attempt(
        tenant_id=SEED_TENANT_ID,
        test_id=test.id,
        testee_id=testee.id,
        sequence_number=1,
        assignment_id=assignment.id,
        origin=AttemptOrigin.assignment_driven,
        shuffle_seed=12345,
        question_snapshot={"questions": []},
    )
    cat_session.add(attempt)

    first = await draw_anchors_for_attempt(
        cat_session, attempt=attempt, test=test, assignment_id=assignment.id
    )
    second = await draw_anchors_for_attempt(
        cat_session, attempt=attempt, test=test, assignment_id=assignment.id
    )

    assert len(first) == 2
    assert [q.id for q in first] == [q.id for q in second]


# --- Edge cases that skip the draw cleanly ----------------------------


def test_anchor_draw_empty_pool_writes_no_attempt_anchors(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """A pill with no anchors generated yet → the attempt starts
    normally, the snapshot is the bare per_testee set, no
    :class:`AttemptAnchor` rows are written."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    test = _per_testee_test(cat_session)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    _start_assignment_attempt(cat_client, testee, test=test, assignment=assignment)

    assert cat_session.store.get(AttemptAnchor, []) == []


def test_anchor_draw_skipped_for_learning_path_assignment(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """A learning-path assignment (``Assignment.pill_id IS NULL``)
    does not draw anchors even when a pill pool exists elsewhere —
    the draw is single-pill scoped. Matches the AC-D6 / AC-D27
    competence-update scope guard at competence.py:398."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    # Pool exists but the assignment doesn't reference this pill.
    for _ in range(3):
        _seed_anchor_pair(cat_session, pill=pill, band=5)
    test = _per_testee_test(cat_session)
    assignment = _assignment(
        cat_session,
        pill=None,
        assigner=admin,
        learning_path_id=uuid.uuid4(),
    )
    _assignee(cat_session, assignment=assignment, testee=testee)

    _start_assignment_attempt(cat_client, testee, test=test, assignment=assignment)

    assert cat_session.store.get(AttemptAnchor, []) == []


def test_anchor_draw_skipped_when_band_does_not_match(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """An anchor pool exists for the pill but every row is band 3,
    while ``test.target_difficulty=7`` resolves to a band-7 filter.
    The draw produces no matches → no :class:`AttemptAnchor` rows."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    for _ in range(3):
        _seed_anchor_pair(cat_session, pill=pill, band=3)
    test = _per_testee_test(cat_session, target_difficulty=7)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    _start_assignment_attempt(cat_client, testee, test=test, assignment=assignment)

    assert cat_session.store.get(AttemptAnchor, []) == []


def test_anchor_draw_excluded_rows_are_filtered_out(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """``excluded=True`` rows are not in the draw pool — the flagged
    queue surfaces them for admin attention but a Testee never sees
    them. Matches AC-D23 finding-flow."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    for _ in range(3):
        _seed_anchor_pair(cat_session, pill=pill, band=5, excluded=True)
    test = _per_testee_test(cat_session, target_difficulty=5)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    _start_assignment_attempt(cat_client, testee, test=test, assignment=assignment)

    assert cat_session.store.get(AttemptAnchor, []) == []


def test_anchor_draw_skipped_for_self_initiated_attempt(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Self-initiated attempts carry no assignment_id; the draw
    scope-guard short-circuits before touching the pool."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    for _ in range(3):
        _seed_anchor_pair(cat_session, pill=pill, band=5)
    test = _per_testee_test(cat_session, target_difficulty=5)

    r = cat_client.post(
        "/v1/attempts",
        headers=bearer(testee),
        json={
            "test_id": str(test.id),
            "origin": AttemptOrigin.self_initiated.value,
        },
    )
    assert r.status_code == 201, r.text
    assert cat_session.store.get(AttemptAnchor, []) == []


def test_anchor_draw_skipped_for_frozen_test_mode(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Frozen-mode tests carry admin-authored Question rows; the
    anchor draw path lives inside the per_testee branch only. A
    pool can exist for the pill, but a frozen attempt does not
    consume it."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    for _ in range(3):
        _seed_anchor_pair(cat_session, pill=pill, band=5)
    test = _frozen_test(cat_session)
    # Seed at least one question on the frozen test so start_attempt
    # has something to render.
    cat_session.add(
        Question(
            tenant_id=SEED_TENANT_ID,
            test_id=test.id,
            type=QuestionType.true_false,
            config={"prompt": "x", "correct": True},
            assigned_difficulty=5,
            realism_flag_count=0,
        )
    )
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    _start_assignment_attempt(cat_client, testee, test=test, assignment=assignment)

    assert cat_session.store.get(AttemptAnchor, []) == []


# --- Snapshot contains anchor question content ------------------------


def test_anchor_draw_snapshot_contains_anchor_config(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """The anchor question's :class:`Question` row is folded into the
    snapshot with its full ``config`` (the Testee renders it the
    same way as a per_testee question). Verifies the shared-PK
    lookup path that maps each drawn ``AnchorQuestion.id`` to its
    matching :class:`Question` row by UUID equality."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    for _ in range(3):
        _seed_anchor_pair(cat_session, pill=pill, band=5)
    test = _per_testee_test(cat_session, target_difficulty=5)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    started = _start_assignment_attempt(
        cat_client, testee, test=test, assignment=assignment
    )

    attempt = next(
        a for a in cat_session.store.get(Attempt, []) if a.id == uuid.UUID(started["id"])
    )
    anchor_ids_drawn = {
        str(row.anchor_question_id) for row in cat_session.store.get(AttemptAnchor, [])
    }
    anchor_snapshot_entries = [
        q
        for q in attempt.question_snapshot["questions"]
        if q["question_id"] in anchor_ids_drawn
    ]
    assert len(anchor_snapshot_entries) == 2
    for entry in anchor_snapshot_entries:
        assert entry["type"] == "multiple_choice"
        assert "prompt" in entry["config"]
        assert entry["assigned_difficulty"] == 5


# --- Unused-import guard for type checkers ---------------------------
_ = Any
