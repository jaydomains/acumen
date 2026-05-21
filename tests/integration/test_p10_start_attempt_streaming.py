"""P10 Slice 3 / AC-D25 v1.8 / AC-CD10 v1.8 — per-Testee start_attempt
streaming wiring. Q1 generates synchronously (~3-s budget per ROADMAP
P10 done-when), persists with ``attempt_position=1`` + 1:1
``record_provenance``. Anchor draw runs BEFORE Q1 so the snapshot is
immutable across the streaming lifetime; the snapshot holds anchors
only and per-Testee Question rows live in the DB. ``view_attempt``
fetches per-Testee rows ordered by ``attempt_position`` (Python-side
sort) and merges with snapshot anchors before presentation shuffle.
``POST /v1/attempts`` surfaces Q1 as a top-level ``q1`` field so the
FE renders immediately while opening the SSE stream for Q2..N (Slice
4). Q1-failure raises ``APIError(503, "q1_generation_failed")`` after
one orchestration-layer retry; the transaction rolls back so no
Attempt persists.

Zero-DB / zero-network (AC-CD15). FakeSession ``rollback`` is a noop
so production-only "Attempt-not-persisted-on-Q1-failure" semantics
are documented in-line but not asserted at the test level (deferred
to real-Postgres E2E at P11).
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.ai.provider import Operation
from app.domain import attempts as attempt_domain
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
from app.permissions import APIError
from tests.integration.conftest import (
    CatalogueFakeSession,
    RecordingProvider,
    bearer,
    cat_make_user,
    seed_system_settings,
)

# --- helpers ----------------------------------------------------------


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
        description="Crane ops",
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
        name="JIT Streaming Diagnostic",
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


def _seed_anchor(s: CatalogueFakeSession, *, pill: Pill, band: int = 5) -> AnchorQuestion:
    anchor = AnchorQuestion(
        tenant_id=SEED_TENANT_ID,
        pill_id=pill.id,
        band=band,
        type=QuestionType.multiple_choice,
        config={"prompt": "anchor q", "options": ["a", "b"], "correct": 0},
        assigned_difficulty=band,
    )
    s.add(anchor)
    # The anchor draw expects a Question row sharing the anchor's PK
    # (P8 contract). Seed the matching Question.
    s.add(
        Question(
            id=anchor.id,
            tenant_id=SEED_TENANT_ID,
            pill_id=pill.id,
            type=QuestionType.multiple_choice,
            config=anchor.config,
            assigned_difficulty=band,
            realism_flag_count=0,
        )
    )
    return anchor


def _start(
    client: TestClient,
    testee: AppUser,
    *,
    test: Test,
    assignment: Assignment | None = None,
) -> Any:
    body: dict[str, Any] = {"test_id": str(test.id)}
    if assignment is not None:
        body["origin"] = AttemptOrigin.assignment_driven.value
        body["assignment_id"] = str(assignment.id)
    return client.post("/v1/attempts", headers=bearer(testee), json=body)


# --- tests ------------------------------------------------------------


def test_per_testee_start_persists_q1_only(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Q1 lands at ``attempt_position=1`` with full 1:1 provenance.
    Exactly one Question row persists (Q1); Q2..N stream via the SSE
    endpoint in Slice 4 — not from this POST response."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    test = _per_testee_test(cat_session)
    response = _start(cat_client, testee, test=test)
    assert response.status_code == 201, response.text

    attempt_id = uuid.UUID(response.json()["id"])
    per_testee = [
        q for q in cat_session.store.get(Question, []) if q.attempt_id == attempt_id
    ]
    assert len(per_testee) == 1
    q1 = per_testee[0]
    assert q1.attempt_position == 1
    # 1:1 provenance — full per-call cost (vs the pre-P10 1:N share).
    assert q1.ai_cost_usd == pytest.approx(0.001)


def test_per_testee_start_uses_question_count_1_per_spec_61_v18(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """SPEC §6.1 v1.8 — per-question call pattern. The generation
    payload carries ``question_count=1`` (vs the pre-P10
    ``question_count=N`` batched shape)."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    test = _per_testee_test(cat_session)
    _start(cat_client, testee, test=test)

    gen_calls = recording_provider.calls_for(Operation.generation)
    assert len(gen_calls) == 1
    _, _, payload = gen_calls[0]
    assert payload["question_count"] == 1


def test_per_testee_start_surfaces_q1_field_on_post_response(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """POST returns ``AttemptView + q1`` per the user lock — the FE
    renders Q1 immediately while opening SSE for Q2..N. The ``q1``
    field carries the same dict that appears in ``questions`` at
    position 1."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    test = _per_testee_test(cat_session)
    response = _start(cat_client, testee, test=test)
    body = response.json()
    assert body["q1"] is not None
    assert body["q1"]["attempt_position"] == 1
    assert body["q1"]["type"] in {"multiple_choice", "true_false"}
    # Q1 also appears in the questions list (anchors + per-Testee
    # questions merged); the FE can use either path.
    assert any(q["attempt_position"] == 1 for q in body["questions"])


def test_per_testee_start_anchor_draw_runs_before_q1(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Anchor draw moves to BEFORE Q1 sync (P10 contract: snapshot is
    anchors-only and immutable; per-Testee Question rows live in the
    DB). With 5 band-5 anchors seeded, draw caps at 2; both are
    present in the snapshot before Q1's generation call returns."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    for _ in range(5):
        _seed_anchor(cat_session, pill=pill, band=5)
    test = _per_testee_test(cat_session, target_difficulty=5)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)

    response = _start(cat_client, testee, test=test, assignment=assignment)
    assert response.status_code == 201

    attempt_id = uuid.UUID(response.json()["id"])
    anchors = [
        a for a in cat_session.store.get(AttemptAnchor, []) if a.attempt_id == attempt_id
    ]
    assert len(anchors) == 2
    attempt = next(a for a in cat_session.store.get(Attempt, []) if a.id == attempt_id)
    snapshot_qids = {q["question_id"] for q in attempt.question_snapshot["questions"]}
    drawn_qids = {str(a.anchor_question_id) for a in anchors}
    assert snapshot_qids == drawn_qids
    # The snapshot does NOT hold per-Testee Q1; Q1 lives in the DB.
    per_testee_qids = {
        str(q.id)
        for q in cat_session.store.get(Question, [])
        if q.attempt_id == attempt_id
    }
    assert snapshot_qids.isdisjoint(per_testee_qids)


def test_per_testee_snapshot_holds_streaming_payload_base(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """The shared per-question payload (test name, target difficulty,
    rag_context, low-realism examples) is persisted on the snapshot
    so the SSE handler (Slice 4) can reconstruct it for Q2..N
    without re-running the RAG retrieve — guarantees context
    consistency across the attempt and avoids cost amplification."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    test = _per_testee_test(cat_session, target_difficulty=7)
    response = _start(cat_client, testee, test=test)
    attempt_id = uuid.UUID(response.json()["id"])
    attempt = next(a for a in cat_session.store.get(Attempt, []) if a.id == attempt_id)
    payload_base = attempt.question_snapshot["streaming_payload_base"]
    assert payload_base["test_name"] == "JIT Streaming Diagnostic"
    assert payload_base["target_difficulty"] == 7
    assert "rag_context" in payload_base
    assert "low_realism_negative_examples" in payload_base
    assert payload_base["attempt_id"] == str(attempt_id)
    # ``question_count`` is NOT in payload_base — the SSE handler
    # stamps it per-call (1) per the per-question pattern.
    assert "question_count" not in payload_base
    assert attempt.question_snapshot["total_question_count"] == 5


@pytest.mark.asyncio
async def test_q1_failure_after_retry_raises_typed_error(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Q1 generation that fails on both the first attempt and the
    orchestration-layer retry raises ``APIError(503,
    "q1_generation_failed")``. In production, the surrounding router
    transaction rolls back so no Attempt persists and the Testee's
    rate-limit budget is not consumed; under the FakeSession harness
    rollback is a noop, so we assert the typed error contract here
    and document the production-only rollback semantics in-line for
    real-Postgres E2E coverage at P11."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    test = _per_testee_test(cat_session)

    def always_fail(payload: dict[str, Any]) -> dict[str, Any]:
        raise RuntimeError("provider down")

    recording_provider.set_response_fn(Operation.generation, always_fail)

    with pytest.raises(APIError) as exc:
        await attempt_domain.start_attempt(
            cat_session,
            test=test,
            testee_id=testee.id,
            origin=AttemptOrigin.self_initiated,
        )
    assert exc.value.status_code == 503
    assert exc.value.code == "q1_generation_failed"
    # Two provider calls: original + one orchestration-layer retry.
    assert len(recording_provider.calls_for(Operation.generation)) == 2


@pytest.mark.asyncio
async def test_q1_retry_once_then_success(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Q1 generation that fails once and succeeds on the orchestration-
    layer retry resolves cleanly — no 503, Q1 persists, attempt
    continues. Locks the "transient HTTP blip survives" contract."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    test = _per_testee_test(cat_session)

    call_count = 0

    def fail_once(payload: dict[str, Any]) -> dict[str, Any]:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise RuntimeError("transient HTTP 500")
        return {
            "questions": [
                {
                    "type": "multiple_choice",
                    "assigned_difficulty": 5,
                    "config": {"prompt": "p", "options": ["a", "b"], "correct": 0},
                }
            ]
        }

    recording_provider.set_response_fn(Operation.generation, fail_once)

    attempt = await attempt_domain.start_attempt(
        cat_session,
        test=test,
        testee_id=testee.id,
        origin=AttemptOrigin.self_initiated,
    )
    assert attempt.id is not None
    assert call_count == 2
    persisted = [
        q for q in cat_session.store.get(Question, []) if q.attempt_id == attempt.id
    ]
    assert len(persisted) == 1
    assert persisted[0].attempt_position == 1


def test_view_attempt_per_testee_merges_anchors_and_db_questions(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """``view_attempt`` for per-Testee mode merges the snapshot
    anchors (immutable) with the per-Testee Question rows fetched
    from the DB ordered by ``attempt_position``. After POST, Q1 is
    the only per-Testee row; view returns anchors (if any) + Q1."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    _seed_anchor(cat_session, pill=pill, band=5)
    _seed_anchor(cat_session, pill=pill, band=5)
    test = _per_testee_test(cat_session, target_difficulty=5)
    assignment = _assignment(cat_session, pill=pill, assigner=admin)
    _assignee(cat_session, assignment=assignment, testee=testee)
    response = _start(cat_client, testee, test=test, assignment=assignment)
    attempt_id = response.json()["id"]

    # GET /v1/attempts/{id} → view_attempt → merged questions list.
    view = cat_client.get(f"/v1/attempts/{attempt_id}", headers=bearer(testee)).json()
    questions = view["questions"]
    # 2 anchors + 1 Q1 = 3 entries.
    assert len(questions) == 3
    positions = {q["attempt_position"] for q in questions}
    # Q1 carries position 1; anchors carry None.
    assert 1 in positions
    assert None in positions


@pytest.mark.asyncio
async def test_view_attempt_per_testee_sorts_db_questions_by_attempt_position(
    cat_session: CatalogueFakeSession,
) -> None:
    """When the SSE handler (Slice 4) persists Q2..QN out of order
    (asyncio task resolution races), ``view_attempt`` must still
    return them in ``attempt_position`` order. FakeSession has no
    ORDER BY (AC-CD15) so the Python-side sort is the test target."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    test = _per_testee_test(cat_session)

    # Seed an attempt with per-Testee Question rows persisted in
    # OUT-OF-ORDER attempt_position values (mirrors a real SSE
    # orchestration where Q4 resolved before Q2).
    attempt = Attempt(
        tenant_id=SEED_TENANT_ID,
        test_id=test.id,
        testee_id=testee.id,
        origin=AttemptOrigin.self_initiated,
        sequence_number=1,
        started_at=attempt_domain.now_utc(),
        question_snapshot={"questions": []},
    )
    cat_session.add(attempt)
    # Insert in position order [3, 1, 4, 2] — view must sort to [1,2,3,4].
    for pos in (3, 1, 4, 2):
        cat_session.add(
            Question(
                tenant_id=SEED_TENANT_ID,
                attempt_id=attempt.id,
                type=QuestionType.multiple_choice,
                config={
                    "prompt": f"q{pos}",
                    "options": ["a", "b"],
                    "correct": 0,
                },
                assigned_difficulty=5,
                realism_flag_count=0,
                attempt_position=pos,
            )
        )

    view = await attempt_domain.view_attempt(cat_session, attempt, test)
    questions = view["questions"]
    positions = [q["attempt_position"] for q in questions]
    assert positions == [1, 2, 3, 4]
