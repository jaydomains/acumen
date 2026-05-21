"""P10 Slice 4 / AC-D25 v1.8 / AC-CD10 v1.8 — SSE endpoint
``GET /v1/attempts/{id}/stream`` exercises:

* cold open after POST: skips Q1 (delivered via POST + ``?since=1``);
  runs orchestrator for [2..N]; emits each as ``id: <position>``
  followed by ``data: <json>``; terminal ``event: done``.
* browser auto-reconnect mid-stream: ``Last-Event-ID`` header sets
  the replay cursor; orchestrator only re-runs positions not yet
  persisted in DB.
* defensive default cursor: no ``?since=``, no ``Last-Event-ID`` →
  replay from position 1 (covers page-refresh paths).
* pause-on-failure: provider fails twice on one position; the
  orchestrator emits terminal ``event: paused`` with the failed
  position + completed positions; AC-D11 system-pause row written.
* resume after pause-on-failure: POST /resume closes the pause;
  re-opening SSE re-orchestrates the still-unfilled position only;
  no Q1 / completed-Q regeneration.
* benchmark stays sequential: non-per-Testee modes return 409
  ``not_per_testee`` (regression guard so streaming refactor doesn't
  bleed into the benchmark path).
* cost-dashboard cross-cut: per-question 1:1 provenance — full
  per-call cost on each persisted Question row; ``current_month_spend``
  aggregates the full set.

Zero-DB / zero-network (AC-CD15). The SSE stream is exercised via
``TestClient`` (sync httpx under the hood); ``response.text`` returns
the full assembled event stream — sufficient for cold-open / pause /
benchmark assertions. Reconnect tests issue distinct GET calls with
the resume cursor, simulating the browser's reconnect protocol.
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
    AttemptOrigin,
    AttemptPauseEvent,
    BenchmarkScope,
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


def _per_testee_test(s: CatalogueFakeSession) -> Test:
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="JIT Streaming Diagnostic",
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


def _benchmark_test(s: CatalogueFakeSession) -> Test:
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="Benchmark",
        mode=TestMode.benchmark,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=False,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        target_difficulty=5,
        randomise_question_order=False,
        randomise_option_order=False,
        pass_threshold=0.5,
        benchmark_scope=BenchmarkScope.subject,
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


def _start(
    client: TestClient,
    testee: AppUser,
    *,
    test: Test,
    assignment: Assignment | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {"test_id": str(test.id)}
    if assignment is not None:
        body["origin"] = AttemptOrigin.assignment_driven.value
        body["assignment_id"] = str(assignment.id)
    r = client.post("/v1/attempts", headers=bearer(testee), json=body)
    assert r.status_code == 201, r.text
    return r.json()


def _parse_sse(body: str) -> list[dict[str, Any]]:
    """Naive SSE parser: splits on blank lines, extracts ``event``,
    ``id``, ``data`` fields per event."""
    events: list[dict[str, Any]] = []
    for raw_event in body.split("\n\n"):
        raw_event = raw_event.strip()
        if not raw_event:
            continue
        event: dict[str, Any] = {}
        for line in raw_event.split("\n"):
            if ":" not in line:
                continue
            key, _, val = line.partition(":")
            event[key.strip()] = val.strip()
        if event:
            events.append(event)
    return events


# --- tests ------------------------------------------------------------


def test_sse_cold_open_after_post_streams_q2_through_qn(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """POST returns AttemptView + q1; FE opens
    ``GET /stream?since=1`` to skip Q1 (already in POST response).
    Orchestrator runs Q2..Q5 (total_question_count=5); SSE emits
    4 events in attempt_position order; terminal ``event: done``."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    test = _per_testee_test(cat_session)
    started = _start(cat_client, testee, test=test)
    attempt_id = started["id"]
    assert started["q1"] is not None

    response = cat_client.get(
        f"/v1/attempts/{attempt_id}/stream?since=1",
        headers=bearer(testee),
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    events = _parse_sse(response.text)

    # 4 slot events (Q2..Q5) + 1 terminal `done`.
    slot_events = [e for e in events if "id" in e and "event" not in e]
    terminal_events = [e for e in events if e.get("event") == "done"]
    assert len(slot_events) == 4
    assert len(terminal_events) == 1

    # Event IDs are attempt_position values 2..5.
    ids = [int(e["id"]) for e in slot_events]
    assert sorted(ids) == [2, 3, 4, 5]

    # 5 per-Testee Question rows persisted (Q1 from POST + Q2..Q5 from SSE).
    per_testee = [
        q
        for q in cat_session.store.get(Question, [])
        if q.attempt_id == uuid.UUID(attempt_id)
    ]
    assert len(per_testee) == 5
    positions = sorted(q.attempt_position for q in per_testee)
    assert positions == [1, 2, 3, 4, 5]


def test_sse_reconnect_with_last_event_id_skips_replayed_positions(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Browser auto-reconnect sets ``Last-Event-ID: <last position>``.
    The handler skips already-delivered positions on replay but
    still re-runs orchestration for any positions not yet persisted.
    With all positions already in DB (full prior stream), reconnect
    only emits the terminal ``done``."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    test = _per_testee_test(cat_session)
    started = _start(cat_client, testee, test=test)
    attempt_id = started["id"]
    # First SSE call — runs Q2..Q5.
    cat_client.get(
        f"/v1/attempts/{attempt_id}/stream?since=1",
        headers=bearer(testee),
    )
    # Now all 5 positions are persisted. Reconnect with
    # Last-Event-ID: 5 → cursor=5; nothing to replay or orchestrate.
    headers = dict(bearer(testee))
    headers["Last-Event-ID"] = "5"
    response = cat_client.get(f"/v1/attempts/{attempt_id}/stream", headers=headers)
    assert response.status_code == 200
    events = _parse_sse(response.text)
    terminal = [e for e in events if e.get("event") == "done"]
    assert len(terminal) == 1
    slot_events = [e for e in events if "id" in e and "event" not in e]
    assert slot_events == []
    # No additional generation calls beyond the original Q1 + Q2..Q5.
    assert len(recording_provider.calls_for(Operation.generation)) == 5


def test_sse_reconnect_default_cursor_replays_persisted_questions(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Defensive default: no ``?since=``, no ``Last-Event-ID`` →
    cursor=0; the handler replays ALL persisted per-Testee Questions
    (including Q1) so a page-refresh path where the FE lost POST
    state still gets the full set."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    test = _per_testee_test(cat_session)
    started = _start(cat_client, testee, test=test)
    attempt_id = started["id"]
    # First call: orchestrator runs Q2..Q5; all 5 positions persisted.
    cat_client.get(
        f"/v1/attempts/{attempt_id}/stream?since=1",
        headers=bearer(testee),
    )
    # Second call: no cursor → replay all 5 persisted positions.
    response = cat_client.get(f"/v1/attempts/{attempt_id}/stream", headers=bearer(testee))
    events = _parse_sse(response.text)
    slot_events = [e for e in events if "id" in e and "event" not in e]
    assert len(slot_events) == 5
    assert sorted(int(e["id"]) for e in slot_events) == [1, 2, 3, 4, 5]


def test_sse_q_n_failure_emits_paused_terminal_and_writes_system_pause(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """A persistent provider failure on Q-N (both attempts of the
    orchestration-layer retry exhausted) emits terminal
    ``event: paused`` with the failed position + completed positions;
    the AC-D11 system pause writes an ``AttemptPauseEvent`` with
    ``reason="generation_failed"`` so the resume UI can render the
    retry / abandon affordance."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    test = _per_testee_test(cat_session)
    started = _start(cat_client, testee, test=test)
    attempt_id = started["id"]
    # Now make the provider fail on every subsequent call (Q2..Q5).
    fail_count = 0

    def always_fail_now(payload: dict[str, Any]) -> dict[str, Any]:
        nonlocal fail_count
        fail_count += 1
        raise RuntimeError(f"provider down (call {fail_count})")

    recording_provider.set_response_fn(Operation.generation, always_fail_now)
    response = cat_client.get(
        f"/v1/attempts/{attempt_id}/stream?since=1",
        headers=bearer(testee),
    )
    assert response.status_code == 200
    events = _parse_sse(response.text)
    paused = [e for e in events if e.get("event") == "paused"]
    assert len(paused) == 1
    # Pause-event row written via AC-D11 system path.
    pause_rows = [
        ev
        for ev in cat_session.store.get(AttemptPauseEvent, [])
        if ev.attempt_id == uuid.UUID(attempt_id)
    ]
    assert len(pause_rows) == 1
    assert pause_rows[0].reason == "generation_failed"
    assert pause_rows[0].ended_at is None


def test_sse_after_pause_then_resume_re_orchestrates_unfilled_only(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """End-to-end retry path: POST → SSE → pause on Q-N failure →
    POST /resume → SSE re-open → orchestrator runs only the still-
    unfilled positions; no Q1 / completed-Q regeneration. Locks the
    "resume replays the snapshot with stable order and no
    regeneration" criterion from ROADMAP P10 done-when."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    test = _per_testee_test(cat_session)
    started = _start(cat_client, testee, test=test)
    attempt_id = started["id"]
    # 1 call so far (Q1). Now fail for the first SSE attempt.
    initial_calls = len(recording_provider.calls_for(Operation.generation))
    assert initial_calls == 1

    def always_fail(payload: dict[str, Any]) -> dict[str, Any]:
        raise RuntimeError("provider down")

    recording_provider.set_response_fn(Operation.generation, always_fail)
    cat_client.get(
        f"/v1/attempts/{attempt_id}/stream?since=1",
        headers=bearer(testee),
    )
    # AttemptPauseEvent written, no persisted Q-N positions beyond Q1.
    persisted_after_fail = {
        q.attempt_position
        for q in cat_session.store.get(Question, [])
        if q.attempt_id == uuid.UUID(attempt_id)
    }
    # Q1 only; failed orchestration may have left 0 successful Q-N rows
    # (depends on which position failed first under semaphore order).
    assert 1 in persisted_after_fail

    # Restore the working response and resume.
    recording_provider.set_response(
        Operation.generation,
        {
            "questions": [
                {
                    "type": "multiple_choice",
                    "assigned_difficulty": 5,
                    "config": {"prompt": "q", "options": ["a", "b"], "correct": 0},
                }
            ]
        },
    )
    resume_response = cat_client.post(
        f"/v1/attempts/{attempt_id}/resume", headers=bearer(testee)
    )
    assert resume_response.status_code == 200
    # Re-open SSE — orchestrator runs only the unfilled positions.
    cat_client.get(
        f"/v1/attempts/{attempt_id}/stream?since=1",
        headers=bearer(testee),
    )
    persisted_final = {
        q.attempt_position
        for q in cat_session.store.get(Question, [])
        if q.attempt_id == uuid.UUID(attempt_id)
    }
    assert persisted_final == {1, 2, 3, 4, 5}


def test_sse_returns_409_for_benchmark_mode(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Benchmark stays sequential per amended AC-D25 — no SSE
    streaming. Regression guard so the P10 refactor never bleeds
    into the benchmark path."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    test = _benchmark_test(cat_session)
    started = _start(cat_client, testee, test=test)
    attempt_id = started["id"]
    response = cat_client.get(
        f"/v1/attempts/{attempt_id}/stream",
        headers=bearer(testee),
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "not_per_testee"


def test_sse_returns_409_for_frozen_mode(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Frozen tests have a pre-existing question set in the snapshot;
    no streaming generation. Same 409 ``not_per_testee`` typed error
    as benchmark."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="Frozen",
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
    # Seed at least one frozen Question.
    cat_session.add(
        Question(
            tenant_id=SEED_TENANT_ID,
            test_id=test.id,
            type=QuestionType.multiple_choice,
            config={"prompt": "p", "options": ["a"], "correct": 0},
            assigned_difficulty=5,
            realism_flag_count=0,
        )
    )
    started = _start(cat_client, testee, test=test)
    attempt_id = started["id"]
    response = cat_client.get(
        f"/v1/attempts/{attempt_id}/stream",
        headers=bearer(testee),
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "not_per_testee"


def test_sse_404_for_other_testee_attempt(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """The SSE endpoint reuses ``_load`` so a non-owner testee gets
    404 not-found (NOT 403 — disclosure-safe, matches the existing
    view_attempt + autosave path)."""
    seed_system_settings(cat_session)
    owner = _testee(cat_session, email="owner@kbc.com")
    other = _testee(cat_session, email="other@kbc.com")
    test = _per_testee_test(cat_session)
    started = _start(cat_client, owner, test=test)
    response = cat_client.get(
        f"/v1/attempts/{started['id']}/stream",
        headers=bearer(other),
    )
    assert response.status_code == 404


def test_sse_cost_dashboard_cross_cut_full_per_call_provenance(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """P10 / AC-D25 v1.8 retires the 1:N ``record_provenance_share``
    pattern for per-Testee streamed generation. After a full cold-
    open SSE cycle, all 5 per-Testee Question rows carry FULL per-
    call cost (one cost per call, one call per row); the per-attempt
    sum equals N × per_call_cost (vs the pre-P10 single call's
    total cost split N ways)."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    test = _per_testee_test(cat_session)
    started = _start(cat_client, testee, test=test)
    cat_client.get(
        f"/v1/attempts/{started['id']}/stream?since=1",
        headers=bearer(testee),
    )
    per_testee = [
        q
        for q in cat_session.store.get(Question, [])
        if q.attempt_id == uuid.UUID(started["id"])
    ]
    assert len(per_testee) == 5
    # Each row carries the RecordingProvider's per-call cost.
    for q in per_testee:
        assert q.ai_cost_usd == pytest.approx(0.001)
    # Per-attempt sum = 5 × 0.001 = 0.005 (vs pre-P10 0.001 batched).
    total = sum((q.ai_cost_usd or 0.0) for q in per_testee)
    assert total == pytest.approx(0.005)


def test_sse_question_count_1_on_every_per_question_call(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """SPEC §6.1 v1.8 — every per-Testee generation call carries
    ``question_count=1``. Across the full POST + SSE cycle, all 5
    calls' payloads share the same shared RAG / low-realism context
    and stamp question_count=1."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    test = _per_testee_test(cat_session)
    started = _start(cat_client, testee, test=test)
    cat_client.get(
        f"/v1/attempts/{started['id']}/stream?since=1",
        headers=bearer(testee),
    )
    gen_calls = recording_provider.calls_for(Operation.generation)
    assert len(gen_calls) == 5
    for _, _, payload in gen_calls:
        assert payload["question_count"] == 1
        # Shared context reuse across the per-question calls.
        assert "rag_context" in payload
        assert "low_realism_negative_examples" in payload
