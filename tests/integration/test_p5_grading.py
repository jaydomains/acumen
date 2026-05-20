"""P5 Slice 2 — AI grading on submit for short_answer / scenario types.

Asserts:
* On submit of an attempt containing AI-graded responses, the resolved
  Anthropic provider's :meth:`grade` is invoked once per AI-graded
  response with :class:`Operation.grading` and the rubric-bearing
  payload.
* Each AI Grade row is persisted with ``source=ai``, the AI's verdict
  + score + reasoning, and full per-call provenance (provider, model,
  prompt_version, tokens, cost).
* The F14 result-display gate behaviour is preserved: the result
  endpoint still returns ``status='review_pending'`` for mixed
  attempts even after AI grades exist, because no ``grade_review``
  row exists yet (P6 creates it).
* ``overall_score`` is NOT recomputed to include AI grades in P5 —
  P6 closes the F14 gate and folds AI grades in after review confirms.

P5 done-when criterion: "an AI grade persists with captured cost +
prompt version" — exercised by
``test_short_answer_submit_writes_ai_grade_with_provenance``.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.ai.provider import Operation
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    Grade,
    GradeSource,
    GradeVerdict,
    Question,
    QuestionType,
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


def _testee(session: CatalogueFakeSession) -> AppUser:
    return cat_make_user(session, email="t@kbc.com", role=p.ROLE_TESTEE)


def _frozen_mixed_test(session: CatalogueFakeSession) -> Test:
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="Mixed",
        mode=TestMode.frozen,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=False,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        target_difficulty=5,
        randomise_question_order=True,
        randomise_option_order=True,
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
        assigned_difficulty=5,
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


def test_short_answer_submit_writes_ai_grade_with_provenance(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """P5 done-when criterion: "an AI grade persists with captured
    cost + prompt version"."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_mixed_test(cat_session)
    sa = _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {
            "prompt": "Define lockout-tagout.",
            "rubric": "Mentions energy isolation, individual locks, verification.",
            "model_answer": "A safety procedure...",
        },
    )
    started = _start(cat_client, t, test.id)
    _autosave(
        cat_client,
        t,
        started["id"],
        str(sa.id),
        {"text": "Lockout-tagout is energy isolation with individual locks."},
    )
    r = cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))
    assert r.status_code == 200

    # Exactly one grading AI call was made.
    grade_calls = recording_provider.calls_for(Operation.grading)
    assert len(grade_calls) == 1
    _, _, payload = grade_calls[0]
    assert payload["question"] == "Define lockout-tagout."
    assert "rubric" in payload
    assert "lockout-tagout is energy isolation" in payload["candidate_response"].lower()

    # Exactly one Grade row, source=ai, full provenance.
    grades = cat_session.store.get(Grade, [])
    assert len(grades) == 1
    grade = grades[0]
    assert grade.source == GradeSource.ai
    assert grade.score == pytest.approx(0.8)
    assert grade.verdict == GradeVerdict.partial
    assert grade.ai_reasoning == "Partial credit per the rubric."
    assert grade.ai_provider == "anthropic"
    assert grade.ai_model == "claude-sonnet-4-6"
    assert grade.ai_prompt_version == "1.0.0-recording"
    assert grade.ai_prompt_tokens == 100
    assert grade.ai_completion_tokens == 50
    assert grade.ai_cost_usd == pytest.approx(0.001)


def test_scenario_submit_writes_ai_grade(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Scenario type follows the same AI-grading path as short_answer."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_mixed_test(cat_session)
    sc = _q(
        cat_session,
        test.id,
        QuestionType.scenario,
        {
            "prompt": "A confined-space team arrives without...",
            "rubric": "Identifies missing PPE; recommends stop work.",
            "model_answer": "Stop work; reassign...",
        },
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(sc.id), {"text": "Stop work."})
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))

    assert len(recording_provider.calls_for(Operation.grading)) == 1
    grades = [g for g in cat_session.store.get(Grade, []) if g.source == GradeSource.ai]
    assert len(grades) == 1


def test_unanswered_ai_question_still_grades(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """An AI-graded question with no autosave still produces a Grade
    row — the candidate_response is the empty string and the AI is
    expected to score appropriately. Consistent with the deterministic
    path's null-answer handling."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_mixed_test(cat_session)
    _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "p", "rubric": "r", "model_answer": "m"},
    )
    started = _start(cat_client, t, test.id)
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))

    grade_calls = recording_provider.calls_for(Operation.grading)
    assert len(grade_calls) == 1
    _, _, payload = grade_calls[0]
    assert payload["candidate_response"] == ""

    grades = [g for g in cat_session.store.get(Grade, []) if g.source == GradeSource.ai]
    assert len(grades) == 1


def test_mixed_attempt_result_endpoint_still_review_pending(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """F14 gate behaviour is preserved: even though AI Grade rows now
    exist on submit, the result endpoint still returns
    ``status='review_pending'`` for any mixed attempt because no
    grade_review row exists yet. P6 wires grade_review and widens the
    gate to 'all confirmed'."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_mixed_test(cat_session)
    mcq = _q(
        cat_session,
        test.id,
        QuestionType.multiple_choice,
        {"prompt": "p", "options": ["a", "b"], "correct": 0},
    )
    _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "explain", "rubric": "r", "model_answer": "m"},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(mcq.id), {"choice": 0})
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))

    r = cat_client.get(f"/v1/attempts/{started['id']}/result", headers=bearer(t))
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "review_pending"
    # No scores leak.
    assert "overall_score" not in body or body.get("overall_score") is None


def test_overall_score_excludes_ai_grades_in_p5(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """``overall_score`` averages deterministic grades only in P5 —
    AI grades are written but not folded in until P6's grade_review
    confirms them. Documented design: averaging in pre-review would
    leak a preliminary value into the audit-log detail / admin reads."""
    from app.models import Attempt

    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_mixed_test(cat_session)
    mcq = _q(
        cat_session,
        test.id,
        QuestionType.multiple_choice,
        {"prompt": "p", "options": ["a", "b"], "correct": 0},
    )
    _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "explain", "rubric": "r", "model_answer": "m"},
    )
    started = _start(cat_client, t, test.id)
    # MCQ correct → 1.0.
    _autosave(cat_client, t, started["id"], str(mcq.id), {"choice": 0})
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))

    attempts = cat_session.store.get(Attempt, [])
    submitted = [a for a in attempts if a.submitted_at is not None]
    assert len(submitted) == 1
    # 1.0 (MCQ only) — NOT (1.0 + 0.8) / 2 = 0.9.
    assert submitted[0].overall_score == pytest.approx(1.0)
