"""P4 Slice 3 — deterministic grading + F14 result-display gate.

On submit, MCQ / true_false / matching auto-grade from the snapshot
config (AC-D5 / AC-D17 / AC-D19). AI-graded types (short_answer /
scenario) produce no ``grade`` or ``grade_review`` row in P4 — the
F14 gate withholds the result page (``status = "review_pending"``)
until P6 review closes it.

Zero-DB / zero-network (AC-CD15).
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    Attempt,
    Grade,
    GradeSource,
    GradeVerdict,
    Question,
    QuestionType,
    Response,
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


def _testee(session: CatalogueFakeSession, email: str = "t@kbc.com") -> AppUser:
    return cat_make_user(session, email=email, role=p.ROLE_TESTEE)


def _frozen_test(
    session: CatalogueFakeSession, *, pass_threshold: float | None = None
) -> Test:
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="T",
        mode=TestMode.frozen,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=False,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        pass_threshold=pass_threshold,
        target_difficulty=5,
        randomise_question_order=True,
        # These tests autosave ORIGINAL-order indices directly (they bypass
        # the presentation layer), so option-shuffle is disabled here — with
        # it on, grading would (correctly, A2-H1) invert the presented index
        # and these original-index answers would mis-score. The shuffle
        # inversion seam is covered by tests/integration/test_p4_grading_shuffle.py.
        randomise_option_order=False,
    )
    session.add(test)
    return test


def _q(
    session: CatalogueFakeSession,
    test_id: uuid.UUID,
    qtype: QuestionType,
    config: dict,
) -> Question:
    q = Question(
        tenant_id=SEED_TENANT_ID,
        test_id=test_id,
        type=qtype,
        config=config,
        assigned_difficulty=4,
        question_group_id=None,
        realism_flag_count=0,
    )
    session.add(q)
    return q


def _start(client: TestClient, t: AppUser, test_id: uuid.UUID) -> dict:
    r = client.post("/v1/attempts", headers=bearer(t), json={"test_id": str(test_id)})
    assert r.status_code == 201, r.text
    return r.json()


def _autosave(
    client: TestClient,
    t: AppUser,
    attempt_id: str,
    question_id: str,
    payload: dict,
) -> None:
    r = client.post(
        f"/v1/attempts/{attempt_id}/autosave",
        headers=bearer(t),
        json={"question_id": question_id, "answer_payload": payload, "time_ms": 1000},
    )
    assert r.status_code == 200, r.text


# --- deterministic grading on submit ---------------------------------


def test_mcq_correct_answer_scores_full(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_test(cat_session, pass_threshold=0.5)
    q = _q(
        cat_session,
        test.id,
        QuestionType.multiple_choice,
        {"prompt": "p", "options": ["a", "b"], "correct": 1},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(q.id), {"choice": 1})
    r = cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))
    assert r.status_code == 200
    # Grade row exists with full verdict + auto source.
    grades = cat_session.store.get(Grade, [])
    assert len(grades) == 1
    assert grades[0].score == 1.0
    assert grades[0].verdict == GradeVerdict.full
    assert grades[0].source == GradeSource.auto


def test_mcq_wrong_answer_scores_none(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_test(cat_session)
    q = _q(
        cat_session,
        test.id,
        QuestionType.multiple_choice,
        {"prompt": "p", "options": ["a", "b"], "correct": 0},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(q.id), {"choice": 1})
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))
    grades = cat_session.store.get(Grade, [])
    assert grades[0].score == 0.0
    assert grades[0].verdict == GradeVerdict.none


def test_true_false_grading(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_test(cat_session)
    q = _q(
        cat_session,
        test.id,
        QuestionType.true_false,
        {"prompt": "p", "correct": True},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(q.id), {"answer": True})
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))
    grades = cat_session.store.get(Grade, [])
    assert grades[0].score == 1.0


def test_matching_partial_credit(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_test(cat_session)
    q = _q(
        cat_session,
        test.id,
        QuestionType.matching,
        {
            "prompt": "p",
            "pairs": [
                {"left": "L1", "right": "R1"},
                {"left": "L2", "right": "R2"},
                {"left": "L3", "right": "R3"},
            ],
        },
    )
    started = _start(cat_client, t, test.id)
    # Two out of three correct -> 0.6667 partial.
    _autosave(cat_client, t, started["id"], str(q.id), {"matches": [0, 1, 0]})
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))
    grades = cat_session.store.get(Grade, [])
    assert grades[0].verdict == GradeVerdict.partial
    assert 0.6 < grades[0].score < 0.7


def test_missing_response_scores_zero(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """A question never answered still gets a Grade row with score
    0 / verdict none — so overall_score reflects the missing answer
    rather than silently excluding it."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_test(cat_session)
    _q(
        cat_session,
        test.id,
        QuestionType.multiple_choice,
        {"prompt": "p", "options": ["a", "b"], "correct": 0},
    )
    started = _start(cat_client, t, test.id)
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))
    grades = cat_session.store.get(Grade, [])
    assert len(grades) == 1
    assert grades[0].score == 0.0
    assert grades[0].verdict == GradeVerdict.none


def test_overall_score_and_outcome_pass(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_test(cat_session, pass_threshold=0.5)
    q1 = _q(
        cat_session,
        test.id,
        QuestionType.multiple_choice,
        {"prompt": "p1", "options": ["a", "b"], "correct": 0},
    )
    q2 = _q(
        cat_session,
        test.id,
        QuestionType.multiple_choice,
        {"prompt": "p2", "options": ["a", "b"], "correct": 1},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(q1.id), {"choice": 0})
    _autosave(cat_client, t, started["id"], str(q2.id), {"choice": 1})
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))
    attempt = next(
        a for a in cat_session.store.get(Attempt, []) if str(a.id) == started["id"]
    )
    assert attempt.overall_score == 1.0
    assert attempt.outcome == "pass"


def test_overall_score_and_outcome_fail(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_test(cat_session, pass_threshold=0.6)
    q1 = _q(
        cat_session,
        test.id,
        QuestionType.multiple_choice,
        {"prompt": "p1", "options": ["a", "b"], "correct": 0},
    )
    q2 = _q(
        cat_session,
        test.id,
        QuestionType.multiple_choice,
        {"prompt": "p2", "options": ["a", "b"], "correct": 1},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(q1.id), {"choice": 1})
    _autosave(cat_client, t, started["id"], str(q2.id), {"choice": 1})
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))
    attempt = next(
        a for a in cat_session.store.get(Attempt, []) if str(a.id) == started["id"]
    )
    assert attempt.overall_score == 0.5
    assert attempt.outcome == "fail"


# --- F14 result-display gate ---------------------------------------


def test_result_endpoint_deterministic_attempt_returns_ready(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_test(cat_session, pass_threshold=0.5)
    q = _q(
        cat_session,
        test.id,
        QuestionType.true_false,
        {"prompt": "p", "correct": True},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(q.id), {"answer": True})
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))
    r = cat_client.get(f"/v1/attempts/{started['id']}/result", headers=bearer(t))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "ready"
    assert body["overall_score"] == 1.0
    assert body["outcome"] == "pass"
    assert len(body["questions"]) == 1
    # FE-6 widened shape: grade lives under ``grade`` sub-object.
    grade = body["questions"][0]["grade"]
    assert grade is not None
    assert grade["points_awarded"] == 1.0
    assert grade["source"] == "auto"


def test_result_endpoint_mixed_test_returns_review_pending(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """Any AI-graded item flips the gate to 'review_pending' — the
    F14 forward-compatible state for P6."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_test(cat_session)
    _q(
        cat_session,
        test.id,
        QuestionType.multiple_choice,
        {"prompt": "p", "options": ["a", "b"], "correct": 0},
    )
    _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "explain", "rubric": "good", "model_answer": "x"},
    )
    started = _start(cat_client, t, test.id)
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))
    r = cat_client.get(f"/v1/attempts/{started['id']}/result", headers=bearer(t))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "review_pending"
    # No scores leak — overall_score and per-question grades are absent.
    assert body.get("overall_score") is None
    assert body.get("questions") is None


def test_stub_grades_ai_types_when_no_anthropic_key_configured(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """P5 Slice 2 inverts the P4 "no Grade row for AI-graded types"
    rule: AI grading now runs on submit and writes a ``Grade`` row per
    AI-graded response with full provenance. This test exercises the
    dev/local fallback path — no Anthropic key is configured, so
    :func:`app.ai.provider.resolve_provider` returns
    :class:`StubAIProvider`, which returns a deterministic "didn't
    grade" stub response. Production with a real key returns real
    verdicts via the recorded-provider tests in ``test_p5_grading``.

    The F14 result-display gate still returns ``review_pending`` for
    any mixed attempt because no ``grade_review`` row exists yet
    (P6 creates it, then widens the gate to "all review confirmed").
    """
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_test(cat_session)
    mcq = _q(
        cat_session,
        test.id,
        QuestionType.multiple_choice,
        {"prompt": "p", "options": ["a", "b"], "correct": 0},
    )
    short_answer = _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "explain", "rubric": "good", "model_answer": "x"},
    )
    scenario = _q(
        cat_session,
        test.id,
        QuestionType.scenario,
        {"prompt": "case study", "rubric": "good", "model_answer": "x"},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(mcq.id), {"choice": 0})
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))

    # One Grade row per question now: deterministic (MCQ) plus AI
    # (short_answer + scenario).
    grades = cat_session.store.get(Grade, [])
    assert len(grades) == 3
    # AI-graded rows carry source=ai and the stub provenance.
    ai_grades = [g for g in grades if g.source == GradeSource.ai]
    assert len(ai_grades) == 2
    for grade in ai_grades:
        assert grade.ai_provider == "stub"
        assert grade.ai_prompt_version == "0.0.0-stub"
        assert grade.ai_cost_usd == 0.0  # stub never charges

    # A Response row is created for AI-graded questions even if the
    # testee never autosaved an answer (consistent with the
    # deterministic path's null-answer handling).
    responses = cat_session.store.get(Response, [])
    response_qids = {r.question_id for r in responses}
    assert mcq.id in response_qids
    assert short_answer.id in response_qids
    assert scenario.id in response_qids


def test_result_endpoint_rejects_unsubmitted_attempt(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_test(cat_session)
    _q(
        cat_session,
        test.id,
        QuestionType.true_false,
        {"prompt": "p", "correct": True},
    )
    started = _start(cat_client, t, test.id)
    r = cat_client.get(f"/v1/attempts/{started['id']}/result", headers=bearer(t))
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "attempt_not_submitted"
