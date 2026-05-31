"""P6 Slice 2 — F14 result-display gate widening (AC-D19 v1.7).

The P5 gate was binary: any AI-graded item ⇒ ``status="review_pending"``.
P6 widens it to be GradeReview-status-aware:

* Any pending GradeReview ⇒ ``status="review_pending"`` (no scores leak)
* All confirmed/flagged ⇒ ``status="ready"``; flagged items render as
  ``status="under_admin_review"`` with no score / verdict leak
* Deterministic-only attempt is unchanged (regression floor for P5).
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.models import (
    SEED_TENANT_ID,
    AppUser,
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
from tests.integration.test_p6_grade_review_submit import (
    _install_dynamic_review,
)


def _testee(session: CatalogueFakeSession, email: str = "t@kbc.com") -> AppUser:
    return cat_make_user(session, email=email, role=p.ROLE_TESTEE)


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
        randomise_option_order=False,
        pass_threshold=0.5,
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
    client: TestClient, t: AppUser, attempt_id: str, question_id: str, payload: dict
) -> None:
    r = client.post(
        f"/v1/attempts/{attempt_id}/autosave",
        headers=bearer(t),
        json={"question_id": question_id, "answer_payload": payload, "time_ms": 1000},
    )
    assert r.status_code == 200, r.text


# --- Gate behaviour --------------------------------------------------


def test_result_view_pending_when_any_grade_review_pending(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Default recording_provider review response lacks ``items`` →
    fail-soft → rows stay pending → ``/result`` returns
    ``status="review_pending"`` with no overall_score leak."""
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
        {"prompt": "p", "rubric": "r", "model_answer": "m"},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(mcq.id), {"choice": 0})
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))

    r = cat_client.get(f"/v1/attempts/{started['id']}/result", headers=bearer(t))
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "review_pending"
    assert "overall_score" not in body or body.get("overall_score") is None


def test_result_view_ready_when_all_confirmed(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """After a confirmed review, ``/result`` returns ``status="ready"``
    with the AI grade visible in the per-question payload and
    ``overall_score`` recomputed including the confirmed AI grade."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_mixed_test(cat_session)
    mcq = _q(
        cat_session,
        test.id,
        QuestionType.multiple_choice,
        {"prompt": "p", "options": ["a", "b"], "correct": 0},
    )
    sa = _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "p", "rubric": "r", "model_answer": "m"},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(mcq.id), {"choice": 0})
    _autosave(cat_client, t, started["id"], str(sa.id), {"text": "answer"})

    _install_dynamic_review(monkeypatch, recording_provider)
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))

    r = cat_client.get(f"/v1/attempts/{started['id']}/result", headers=bearer(t))
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ready"
    assert body["overall_score"] == pytest.approx(0.9)
    assert body["outcome"] == "pass"
    # FE-6 widened shape: each Q carries ``is_ai_graded`` and a nested
    # ``grade`` sub-object (or ``None`` for skipped / under-admin-review).
    ai_entries = [q for q in body["questions"] if q["is_ai_graded"]]
    assert len(ai_entries) == 1
    grade = ai_entries[0]["grade"]
    assert grade is not None
    assert grade["is_correct"] in (True, False, None)
    assert grade["points_awarded"] is not None
    assert grade["source"] == "ai"
    assert grade["review_verdict"] == "confirmed"


def test_result_view_marks_flagged_under_admin_review(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A flagged AI grade renders as ``status="under_admin_review"`` in
    the per-question payload — no AI grade / verdict leaks until an
    admin resolves the flag (AC-D19 v1.6 / v1.7). ``overall_score``
    excludes the flagged grade."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_mixed_test(cat_session)
    mcq = _q(
        cat_session,
        test.id,
        QuestionType.multiple_choice,
        {"prompt": "p", "options": ["a", "b"], "correct": 0},
    )
    sa = _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "p", "rubric": "r", "model_answer": "m"},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(mcq.id), {"choice": 0})
    _autosave(cat_client, t, started["id"], str(sa.id), {"text": "answer"})

    _install_dynamic_review(monkeypatch, recording_provider, verdicts={0: "flagged"})
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))

    r = cat_client.get(f"/v1/attempts/{started['id']}/result", headers=bearer(t))
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ready"
    # overall_score = 1.0 (MCQ only) — flagged AI grade excluded.
    assert body["overall_score"] == pytest.approx(1.0)
    # FE-6: flagged entry surfaces as under_admin_review with grade
    # suppressed entirely (no score / verdict leak per AC-D19 v1.7).
    # ``is_ai_graded`` stays true so the FE can still identify the row.
    ai_entries = [q for q in body["questions"] if q["is_ai_graded"]]
    assert len(ai_entries) == 1
    assert ai_entries[0]["status"] == "under_admin_review"
    assert ai_entries[0]["grade"] is None


def test_result_view_deterministic_only_unchanged(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Fully-deterministic attempt: no AI-graded items, no grade_review
    rows, ``/result`` returns ``status="ready"`` immediately. P5
    regression floor."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_mixed_test(cat_session)
    mcq = _q(
        cat_session,
        test.id,
        QuestionType.multiple_choice,
        {"prompt": "p", "options": ["a", "b"], "correct": 0},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(mcq.id), {"choice": 0})
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))

    r = cat_client.get(f"/v1/attempts/{started['id']}/result", headers=bearer(t))
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ready"
    assert body["overall_score"] == pytest.approx(1.0)
    assert body["outcome"] == "pass"
