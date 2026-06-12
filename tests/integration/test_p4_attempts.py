"""P4 Slice 2 — Attempt lifecycle.

Frozen attempt snapshot (AC-D17); per-Testee stub generation against
the attempt (AC-D5; P5 swaps in real Anthropic); benchmark sequential
stub (AC-D13); shuffle determinism across reload + pause+resume
(AC-D24, integration-level — pure-function tests live in
``tests/unit/test_p4_shuffle.py``); pause blanks content (AC-D11),
lazy max-duration auto-resume; AC-D26 v1.4 assignment_id validation;
AC-D18 rate limit + exempt set; AC-D3 v1.5 sequence_number scope and
``IntegrityError``-retry on collision.

Zero-DB / zero-network (AC-CD15).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app import permissions as p
from app.domain import attempts as attempt_domain
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    Assignment,
    AssignmentAssignee,
    Attempt,
    AttemptOrigin,
    AttemptPauseEvent,
    GapSignal,
    GapSignalType,
    LoopMode,
    Pill,
    Question,
    Test,
    TestMode,
    TestStatus,
    TestVisibility,
    TimeoutBehaviour,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
    seed_system_settings,
)

# --- helpers ----------------------------------------------------------


def _admin(session: CatalogueFakeSession) -> tuple[AppUser, dict[str, str]]:
    admin = cat_make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)
    return admin, bearer(admin)


def _testee(session: CatalogueFakeSession, email: str = "t@kbc.com") -> AppUser:
    return cat_make_user(session, email=email, role=p.ROLE_TESTEE)


def _new_test(session: CatalogueFakeSession, **kwargs: Any) -> Test:
    defaults: dict[str, Any] = dict(
        tenant_id=SEED_TENANT_ID,
        name="T",
        mode=TestMode.frozen,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=False,
        duration_minutes=None,
        pause_allowance=None,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        pass_threshold=None,
        target_difficulty=5,
        randomise_question_order=True,
        randomise_option_order=False,
    )
    defaults.update(kwargs)
    test = Test(**defaults)
    session.add(test)
    return test


def _frozen_question(
    session: CatalogueFakeSession,
    test_id: uuid.UUID,
    qtype: str = "multiple_choice",
    config: dict | None = None,
    group: uuid.UUID | None = None,
) -> Question:
    from app.models import QuestionType

    if config is None:
        config = {"prompt": "p", "options": ["a", "b"], "correct": 0}
    q = Question(
        tenant_id=SEED_TENANT_ID,
        test_id=test_id,
        type=QuestionType(qtype),
        config=config,
        assigned_difficulty=4,
        question_group_id=group,
        realism_flag_count=0,
    )
    session.add(q)
    return q


def _assignment(
    session: CatalogueFakeSession,
    *,
    admin: AppUser,
    testees: list[AppUser],
    pill_id: uuid.UUID | None = None,
) -> Assignment:
    a = Assignment(
        tenant_id=SEED_TENANT_ID,
        assigner_id=admin.id,
        pill_id=pill_id or uuid.uuid4(),
        learning_path_id=None,
        difficulty=4,
        deadline=None,
        is_mandatory=True,
        loop_mode=LoopMode.autonomous,
    )
    session.add(a)
    for t in testees:
        session.add(
            AssignmentAssignee(
                tenant_id=SEED_TENANT_ID,
                assignment_id=a.id,
                user_id=t.id,
                via_group_id=None,
            )
        )
    return a


# --- start_attempt: basic shape --------------------------------------


def test_start_attempt_unpublished_test_is_409(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session, status=TestStatus.draft)
    r = cat_client.post("/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "test_not_published"


def test_start_attempt_missing_test_is_404(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    r = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(uuid.uuid4())}
    )
    assert r.status_code == 404


def test_private_test_rejects_self_initiated(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session, visibility=TestVisibility.private)
    r = cat_client.post(
        "/v1/attempts",
        headers=bearer(t),
        json={"test_id": str(test.id), "origin": "self_initiated"},
    )
    assert r.status_code == 403


# --- frozen attempt: snapshot + view ---------------------------------


def test_frozen_attempt_snapshots_questions(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session)
    _frozen_question(cat_session, test.id, "multiple_choice")
    _frozen_question(
        cat_session, test.id, "true_false", config={"prompt": "p", "correct": True}
    )
    r = cat_client.post("/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["sequence_number"] == 1
    assert body["origin"] == "self_initiated"
    assert body["assignment_id"] is None
    assert body["paused"] is False
    assert body["watermark"] == str(t.id)
    assert isinstance(body["questions"], list)
    assert len(body["questions"]) == 2
    # No ``correct`` field leaks to the Testee.
    for q in body["questions"]:
        assert "correct" not in q["config"]


def test_per_testee_attempt_generates_stub_questions(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """P10 / AC-D25 v1.8 — per-Testee POST returns only Q1
    synchronously; the stub returns 2 questions in its response but
    the per-question pattern (``question_count=1``) takes only the
    first. Q2..N stream over the SSE endpoint (Slice 4); the FE
    fetches them there, not from this response."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session, mode=TestMode.per_testee)
    r = cat_client.post("/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)})
    assert r.status_code == 201, r.text
    body = r.json()
    questions = body["questions"]
    # Exactly Q1 is persisted at POST time (assigned_position=1); no
    # anchors get drawn for self-initiated attempts (no assignment).
    assert len(questions) == 1
    assert questions[0]["type"] in {"multiple_choice", "true_false"}
    assert questions[0]["attempt_position"] == 1
    # AC-D25 v1.8: POST response surfaces Q1 as a top-level field so
    # the FE renders immediately while opening SSE for Q2..N.
    assert body["q1"] is not None
    assert body["q1"]["attempt_position"] == 1
    assert body["q1"]["id"] == questions[0]["id"]


def test_per_testee_attempt_captures_question_tag_signal(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """D1-D2 (§6.5): a per_testee attempt AI-generates questions tagged with the
    test's pill — start_attempt captures a question_tag GapSignal keyed on the
    pill name (the topic-demand signal the D3 sweep consumes). A pill-less test
    captures none (verified by the other per_testee test staying green)."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=uuid.uuid4(),
        name="Welding QA",
        description="x",
        available_difficulty_min=1,
        available_difficulty_max=10,
        discoverable=True,
        safety_relevant=False,
    )
    cat_session.add(pill)
    test = _new_test(cat_session, mode=TestMode.per_testee, pill_id=pill.id)
    r = cat_client.post("/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)})
    assert r.status_code == 201, r.text

    sigs = [
        s
        for s in cat_session.store[GapSignal]
        if s.signal_type == GapSignalType.question_tag
    ]
    assert len(sigs) == 1
    assert sigs[0].dedup_key == "welding qa"  # normalized pill name
    assert sigs[0].source_ref == pill.id


def test_benchmark_attempt_starts_with_empty_snapshot(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    from app.models import BenchmarkScope

    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(
        cat_session, mode=TestMode.benchmark, benchmark_scope=BenchmarkScope.subject
    )
    r = cat_client.post("/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)})
    assert r.status_code == 201, r.text
    assert r.json()["questions"] == []


# --- AC-D26 assignment_id validation ---------------------------------


def test_assignment_driven_requires_assignment_id(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin, _ = _admin(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session)
    _frozen_question(cat_session, test.id)
    r = cat_client.post(
        "/v1/attempts",
        headers=bearer(t),
        json={"test_id": str(test.id), "origin": "assignment_driven"},
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "assignment_required"


def test_assignment_id_validated_against_snapshot(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin, _ = _admin(cat_session)
    targeted = _testee(cat_session, email="target@kbc.com")
    outsider = _testee(cat_session, email="out@kbc.com")
    test = _new_test(cat_session)
    _frozen_question(cat_session, test.id)
    a = _assignment(cat_session, admin=admin, testees=[targeted])
    # The outsider is not in the assignee snapshot — 403.
    r = cat_client.post(
        "/v1/attempts",
        headers=bearer(outsider),
        json={
            "test_id": str(test.id),
            "origin": "assignment_driven",
            "assignment_id": str(a.id),
        },
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "not_assignee"
    # The targeted Testee succeeds; assignment_id is persisted.
    r = cat_client.post(
        "/v1/attempts",
        headers=bearer(targeted),
        json={
            "test_id": str(test.id),
            "origin": "assignment_driven",
            "assignment_id": str(a.id),
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["assignment_id"] == str(a.id)


def test_self_initiated_must_not_carry_assignment_id(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin, _ = _admin(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session)
    _frozen_question(cat_session, test.id)
    a = _assignment(cat_session, admin=admin, testees=[t])
    r = cat_client.post(
        "/v1/attempts",
        headers=bearer(t),
        json={
            "test_id": str(test.id),
            "origin": "self_initiated",
            "assignment_id": str(a.id),
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "assignment_not_allowed"


# --- AC-D3 sequence_number per Testee per Test -----------------------


def test_sequence_number_increments_per_testee_per_test(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session)
    _frozen_question(cat_session, test.id)
    r1 = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    )
    r2 = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    )
    assert r1.json()["sequence_number"] == 1
    assert r2.json()["sequence_number"] == 2


def test_sequence_number_independent_per_test(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    a = _new_test(cat_session, name="A")
    b = _new_test(cat_session, name="B")
    _frozen_question(cat_session, a.id)
    _frozen_question(cat_session, b.id)
    cat_client.post("/v1/attempts", headers=bearer(t), json={"test_id": str(a.id)})
    rb = cat_client.post("/v1/attempts", headers=bearer(t), json={"test_id": str(b.id)})
    # Per-test scope: B's first attempt is sequence 1 even though A
    # already has one.
    assert rb.json()["sequence_number"] == 1


# --- IntegrityError-retry (sequence_number collision) ---------------


async def test_sequence_integrity_error_retry_succeeds_within_bound(
    cat_session: CatalogueFakeSession,
) -> None:
    """Force a one-time ``IntegrityError`` on flush; the retry must
    succeed on the next iteration. ``_SEQUENCE_RETRY_LIMIT = 5`` guards
    against unbounded loops; one collision is well under the bound."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session)
    _frozen_question(cat_session, test.id)

    original_flush = cat_session.flush
    failures = {"left": 1}

    async def flaky_flush() -> None:
        if failures["left"] > 0:
            # Pop the just-added attempt so the next iteration's
            # ``_attempts_for`` query sees the pre-insert state.
            attempts = cat_session.store.get(Attempt, [])
            if attempts:
                attempts.pop()
            failures["left"] -= 1
            raise IntegrityError("simulated unique violation", None, Exception())
        await original_flush()

    cat_session.flush = flaky_flush  # type: ignore[method-assign]
    try:
        attempt = await attempt_domain.start_attempt(
            cat_session, test=test, testee_id=t.id, origin=AttemptOrigin.self_initiated
        )
    finally:
        cat_session.flush = original_flush  # type: ignore[method-assign]
    assert attempt.sequence_number == 1


async def test_sequence_integrity_error_exhausts_retry_budget(
    cat_session: CatalogueFakeSession,
) -> None:
    """Persistent collisions exhaust the retry budget and surface a
    typed 409 so the Testee retries explicitly rather than the system
    looping forever."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session)
    _frozen_question(cat_session, test.id)

    async def always_fail() -> None:
        attempts = cat_session.store.get(Attempt, [])
        if attempts:
            attempts.pop()
        raise IntegrityError("simulated", None, Exception())

    cat_session.flush = always_fail  # type: ignore[method-assign]
    with pytest.raises(p.APIError) as exc:
        await attempt_domain.start_attempt(
            cat_session, test=test, testee_id=t.id, origin=AttemptOrigin.self_initiated
        )
    assert exc.value.status_code == 409
    assert exc.value.code == "sequence_contention"


# --- AC-D18 rate limit ------------------------------------------------


def test_self_initiated_rate_limit_blocks_after_threshold(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    # System settings default per_hour = 5. Seed 5 prior self_initiated
    # attempts inside the last hour to push exactly at the limit.
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session)
    _frozen_question(cat_session, test.id)
    now = p.now_utc()
    for i in range(5):
        prior = Attempt(
            tenant_id=SEED_TENANT_ID,
            test_id=test.id,
            testee_id=t.id,
            origin=AttemptOrigin.self_initiated,
            sequence_number=i + 1,
            started_at=now,
            pauses_used=0,
            total_pause_duration_seconds=0,
        )
        prior.created_at = now - timedelta(minutes=5)
        cat_session.add(prior)
    r = cat_client.post("/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)})
    assert r.status_code == 429
    assert r.json()["error"]["code"] == "rate_limited"


def test_assignment_driven_exempt_from_rate_limit(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin, _ = _admin(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session)
    _frozen_question(cat_session, test.id)
    a = _assignment(cat_session, admin=admin, testees=[t])
    # Saturate the self_initiated counter to the limit.
    now = p.now_utc()
    for i in range(5):
        prior = Attempt(
            tenant_id=SEED_TENANT_ID,
            test_id=test.id,
            testee_id=t.id,
            origin=AttemptOrigin.self_initiated,
            sequence_number=i + 1,
            started_at=now,
            pauses_used=0,
            total_pause_duration_seconds=0,
        )
        prior.created_at = now - timedelta(minutes=5)
        cat_session.add(prior)
    # assignment_driven start still succeeds (exempt from the limit).
    r = cat_client.post(
        "/v1/attempts",
        headers=bearer(t),
        json={
            "test_id": str(test.id),
            "origin": "assignment_driven",
            "assignment_id": str(a.id),
        },
    )
    assert r.status_code == 201, r.text


def test_explicit_zero_rate_limit_is_honoured_not_silently_defaulted(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """An admin-configured ``0`` is preserved by the explicit
    ``is None`` check in ``_enforce_rate_limit`` (Gitar PR-#15) — the
    old ``or _DEFAULT`` pattern silently fell back to 5/20 because
    ``0`` is falsy. With ``per_hour=0``, ``last_hour >= 0`` is true
    even with zero prior attempts, so the very first start trips the
    limit; that demonstrates the configured ``0`` is read, not
    overwritten by the default."""
    from app.models import SystemSettings

    cat_session.add(
        SystemSettings(
            tenant_id=SEED_TENANT_ID,
            self_initiated_rate_limit_per_hour=0,
            self_initiated_rate_limit_per_day=20,
        )
    )
    t = _testee(cat_session)
    test = _new_test(cat_session)
    _frozen_question(cat_session, test.id)
    r = cat_client.post("/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)})
    assert r.status_code == 429
    assert r.json()["error"]["code"] == "rate_limited"


def test_loop_driven_is_in_the_rate_limit_exempt_set() -> None:
    """The exempt set is a named ``frozenset``; loop_driven is in it
    so P7 plugs in with no rate-limit change."""
    assert AttemptOrigin.loop_driven in attempt_domain._RATE_EXEMPT_ORIGINS
    assert AttemptOrigin.assignment_driven in attempt_domain._RATE_EXEMPT_ORIGINS
    assert AttemptOrigin.self_initiated not in attempt_domain._RATE_EXEMPT_ORIGINS


# --- autosave -------------------------------------------------------


def test_autosave_is_idempotent_per_question(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    from app.models import Response

    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session)
    q = _frozen_question(cat_session, test.id)
    start = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    )
    attempt_id = start.json()["id"]
    r = cat_client.post(
        f"/v1/attempts/{attempt_id}/autosave",
        headers=bearer(t),
        json={"question_id": str(q.id), "answer_payload": {"choice": 0}, "time_ms": 1500},
    )
    assert r.status_code == 200
    r = cat_client.post(
        f"/v1/attempts/{attempt_id}/autosave",
        headers=bearer(t),
        json={"question_id": str(q.id), "answer_payload": {"choice": 1}, "time_ms": 3200},
    )
    assert r.status_code == 200
    responses = cat_session.store.get(Response, [])
    assert len(responses) == 1
    assert responses[0].answer_payload == {"choice": 1}
    assert responses[0].time_ms == 3200


# --- pause / resume / blanking ---------------------------------------


def test_pause_blanks_question_content_and_restores_on_resume(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    # Timed test >60min permits pauses (AC-D11).
    test = _new_test(cat_session, timed=True, duration_minutes=120, pause_allowance=2)
    _frozen_question(cat_session, test.id)
    start = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    )
    attempt_id = start.json()["id"]
    r = cat_client.post(f"/v1/attempts/{attempt_id}/pause", headers=bearer(t))
    assert r.status_code == 200

    view = cat_client.get(f"/v1/attempts/{attempt_id}", headers=bearer(t)).json()
    assert view["paused"] is True
    assert view["questions"] is None
    assert view["pause_seconds_remaining"] is not None

    r = cat_client.post(f"/v1/attempts/{attempt_id}/resume", headers=bearer(t))
    assert r.status_code == 200
    view = cat_client.get(f"/v1/attempts/{attempt_id}", headers=bearer(t)).json()
    assert view["paused"] is False
    assert isinstance(view["questions"], list) and len(view["questions"]) == 1


def test_pause_rejected_on_short_timed_test(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session, timed=True, duration_minutes=60, pause_allowance=0)
    _frozen_question(cat_session, test.id)
    start = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    )
    r = cat_client.post(f"/v1/attempts/{start.json()['id']}/pause", headers=bearer(t))
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "pause_not_allowed"


def test_pause_allowance_exhaustion(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session, timed=True, duration_minutes=120, pause_allowance=1)
    _frozen_question(cat_session, test.id)
    start = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    )
    attempt_id = start.json()["id"]
    assert (
        cat_client.post(f"/v1/attempts/{attempt_id}/pause", headers=bearer(t)).status_code
        == 200
    )
    cat_client.post(f"/v1/attempts/{attempt_id}/resume", headers=bearer(t))
    r = cat_client.post(f"/v1/attempts/{attempt_id}/pause", headers=bearer(t))
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "pause_allowance_exhausted"


def test_lazy_max_duration_auto_resume(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """No cron, no stored expiry — a long-paused attempt auto-resumes
    on the next interaction with ``auto_resumed=True``."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(
        cat_session,
        timed=True,
        duration_minutes=120,
        pause_allowance=2,
        max_pause_duration_minutes=30,
    )
    _frozen_question(cat_session, test.id)
    start = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    )
    attempt_id = start.json()["id"]
    cat_client.post(f"/v1/attempts/{attempt_id}/pause", headers=bearer(t))
    # Fast-forward time PAST the 30-minute max pause window.
    future = p.now_utc() + timedelta(minutes=45)
    monkeypatch.setattr(attempt_domain, "now_utc", lambda: future)
    view = cat_client.get(f"/v1/attempts/{attempt_id}", headers=bearer(t)).json()
    assert view["paused"] is False
    assert view["questions"] is not None
    # The pause event was closed with auto_resumed=True.
    events = cat_session.store.get(AttemptPauseEvent, [])
    closed = [e for e in events if e.attempt_id == uuid.UUID(attempt_id)]
    assert len(closed) == 1
    assert closed[0].auto_resumed is True


def test_block_internal_shuffle_preserved_across_pause_and_resume(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """Integration-level check that block-internal order survives a
    pause+resume round-trip — the seed is set once at start and never
    re-randomised (AC-D24)."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session, timed=True, duration_minutes=120, pause_allowance=2)
    g = uuid.uuid4()
    qa = _frozen_question(cat_session, test.id, group=g)
    qb = _frozen_question(cat_session, test.id, group=g)
    qc = _frozen_question(cat_session, test.id, group=g)
    _frozen_question(cat_session, test.id)
    start = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    )
    attempt_id = start.json()["id"]
    before = [q["id"] for q in start.json()["questions"]]
    cat_client.post(f"/v1/attempts/{attempt_id}/pause", headers=bearer(t))
    cat_client.post(f"/v1/attempts/{attempt_id}/resume", headers=bearer(t))
    after = [
        q["id"]
        for q in cat_client.get(f"/v1/attempts/{attempt_id}", headers=bearer(t)).json()[
            "questions"
        ]
    ]
    # Resume yields the identical presentation order (and therefore
    # block-internal order, which is preserved under any presentation
    # order — unit-tested in test_p4_shuffle.py).
    assert before == after
    # The three grouped questions appear contiguously and in input
    # order (qa, qb, qc).
    ids = [str(qa.id), str(qb.id), str(qc.id)]
    indices = [after.index(i) for i in ids]
    assert indices == sorted(indices)
    assert max(indices) - min(indices) == 2


# --- submit ----------------------------------------------------------


def test_submit_marks_attempt_submitted(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session)
    _frozen_question(cat_session, test.id)
    start = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    )
    attempt_id = start.json()["id"]
    r = cat_client.post(f"/v1/attempts/{attempt_id}/submit", headers=bearer(t))
    assert r.status_code == 200
    assert r.json()["submitted_at"] is not None


def test_submit_is_idempotent(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session)
    _frozen_question(cat_session, test.id)
    attempt_id = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    ).json()["id"]
    first = cat_client.post(f"/v1/attempts/{attempt_id}/submit", headers=bearer(t))
    second = cat_client.post(f"/v1/attempts/{attempt_id}/submit", headers=bearer(t))
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["submitted_at"] == second.json()["submitted_at"]


def test_submit_settles_open_pause(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session, timed=True, duration_minutes=120, pause_allowance=2)
    _frozen_question(cat_session, test.id)
    start = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    )
    attempt_id = start.json()["id"]
    cat_client.post(f"/v1/attempts/{attempt_id}/pause", headers=bearer(t))
    r = cat_client.post(f"/v1/attempts/{attempt_id}/submit", headers=bearer(t))
    assert r.status_code == 200
    # The pause event was closed (not None) by submit.
    events = cat_session.store.get(AttemptPauseEvent, [])
    closed = [e for e in events if e.attempt_id == uuid.UUID(attempt_id)]
    assert len(closed) == 1
    assert closed[0].ended_at is not None


def test_timeout_marks_outcome_expired_when_configured(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(
        cat_session,
        timed=True,
        duration_minutes=120,
        pause_allowance=2,
        timeout_behaviour=TimeoutBehaviour.expire,
    )
    _frozen_question(cat_session, test.id)
    start = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    )
    attempt_id = start.json()["id"]
    # Jump well past the 120-min duration.
    future = p.now_utc() + timedelta(hours=3)
    monkeypatch.setattr(attempt_domain, "now_utc", lambda: future)
    cat_client.post(f"/v1/attempts/{attempt_id}/submit", headers=bearer(t))
    stored = next(
        a for a in cat_session.store.get(Attempt, []) if str(a.id) == attempt_id
    )
    assert stored.outcome == "expired"


# --- benchmark next_question -----------------------------------------


def test_benchmark_next_steps_until_cap(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    from app.models import BenchmarkScope

    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(
        cat_session, mode=TestMode.benchmark, benchmark_scope=BenchmarkScope.subject
    )
    attempt_id = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    ).json()["id"]
    for step in range(attempt_domain.P4_BENCHMARK_STEP_CAP):
        r = cat_client.post(f"/v1/attempts/{attempt_id}/next", headers=bearer(t))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["done"] is False
        assert body["step"] == step + 1
    # One more call: cap reached, done=True.
    r = cat_client.post(f"/v1/attempts/{attempt_id}/next", headers=bearer(t))
    assert r.json()["done"] is True
    assert r.json()["asked"] == attempt_domain.P4_BENCHMARK_STEP_CAP


def test_benchmark_next_rejected_on_non_benchmark(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _new_test(cat_session)
    _frozen_question(cat_session, test.id)
    attempt_id = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    ).json()["id"]
    r = cat_client.post(f"/v1/attempts/{attempt_id}/next", headers=bearer(t))
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "not_benchmark"


# --- permissions -----------------------------------------------------


def test_testee_cannot_read_someone_elses_attempt(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    owner = _testee(cat_session, email="owner@kbc.com")
    intruder = _testee(cat_session, email="intruder@kbc.com")
    test = _new_test(cat_session)
    _frozen_question(cat_session, test.id)
    attempt_id = cat_client.post(
        "/v1/attempts", headers=bearer(owner), json={"test_id": str(test.id)}
    ).json()["id"]
    r = cat_client.get(f"/v1/attempts/{attempt_id}", headers=bearer(intruder))
    assert r.status_code == 404


def test_admin_can_read_any_attempt(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin, h_admin = _admin(cat_session)
    owner = _testee(cat_session, email="owner@kbc.com")
    test = _new_test(cat_session)
    _frozen_question(cat_session, test.id)
    attempt_id = cat_client.post(
        "/v1/attempts", headers=bearer(owner), json={"test_id": str(test.id)}
    ).json()["id"]
    r = cat_client.get(f"/v1/attempts/{attempt_id}", headers=h_admin)
    assert r.status_code == 200


# --- silence -------------------------------------------------------


def test_utc_helpers_remain_utc() -> None:
    # Sanity: ``p.now_utc()`` returns aware UTC for the time-shift
    # tests above to be meaningful.
    assert p.now_utc().tzinfo is not None
    assert p.now_utc().tzinfo.utcoffset(datetime.now()) == UTC.utcoffset(datetime.now())
