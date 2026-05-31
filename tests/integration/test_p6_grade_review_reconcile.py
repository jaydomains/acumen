"""P6 Slice 3 — reconcile sweep for stuck-pending grade_reviews
(AC-D19 v1.6 / v1.7).

The reconcile callable is invoked directly (async) since the Celery
wrapper is a thin asyncio.run() around it; the unit-of-work being
tested is the domain function, not the task wrapper. The wrapper has
its own one-line "it returns counts" smoke test below.

Wall-clock SLA: a pending row whose ``created_at`` is older than
``MAX_RETRY × INTERVAL`` minutes (default 50) auto-flags with reason
``auto_flagged_stuck_pending`` and skips the provider call entirely.
The threshold is wall-clock against ``created_at``, NOT a retry counter
on grade_review — matches the v1.6/v1.7 spec verbatim and avoids a
schema migration.
"""

from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.ai.provider import Operation
from app.domain.grade_review import (
    GRADE_REVIEW_MAX_RETRY_ATTEMPTS,
    GRADE_REVIEW_RECONCILE_INTERVAL_MINUTES,
    reconcile_pending_grade_reviews,
)
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    Attempt,
    Grade,
    GradeReview,
    GradeSource,
    Question,
    QuestionType,
    ReviewStatus,
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

# --- Helpers ----------------------------------------------------------


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


def _submit_leaving_rows_pending(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    *,
    testee_email: str = "t@kbc.com",
) -> tuple[str, AppUser]:
    """Submit a mixed attempt with the default recording_provider review
    response (no ``items`` key) so the GradeReview rows are left in
    ``pending`` — the starting state every reconcile test wants."""
    seed_system_settings(cat_session)
    t = _testee(cat_session, email=testee_email)
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
        {"prompt": "explain", "rubric": "r", "model_answer": "m"},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(mcq.id), {"choice": 0})
    _autosave(cat_client, t, started["id"], str(sa.id), {"text": "answer"})
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))
    return started["id"], t


# --- Reconcile callable: per-state behaviour --------------------------


async def test_reconcile_returns_zero_counts_when_no_pending(
    cat_session: CatalogueFakeSession,
) -> None:
    """No pending rows — sweep returns all-zero counts without invoking
    the provider."""
    counts = await reconcile_pending_grade_reviews(cat_session)
    assert counts == {
        "attempts_processed": 0,
        "rows_confirmed": 0,
        "rows_flagged": 0,
        "rows_auto_flagged": 0,
        "rows_still_pending": 0,
    }


async def test_reconcile_confirms_pending_when_provider_now_succeeds(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A pending row from a failed submit-time review is picked up by
    the reconcile sweep when the provider now returns a valid batched
    response. Row transitions pending → confirmed; overall_score
    recomputes; counts reflect the transition."""
    attempt_id, _t = _submit_leaving_rows_pending(cat_client, cat_session)
    # Verify starting state.
    rows = cat_session.store.get(GradeReview, [])
    assert len(rows) == 1
    assert rows[0].status == ReviewStatus.pending

    # Install a dynamic review that confirms all items.
    async def _confirming_review(operation: Any, payload: dict[str, Any]) -> Any:
        recording_provider.calls.append(("review", operation, dict(payload)))
        items = payload.get("items") or []
        return recording_provider._result(
            {
                "items": [
                    {"grade_id": item["grade_id"], "verdict": "confirmed"}
                    for item in items
                ]
            }
        )

    monkeypatch.setattr(recording_provider, "review", _confirming_review)

    counts = await reconcile_pending_grade_reviews(cat_session)
    assert counts["rows_confirmed"] == 1
    assert counts["rows_flagged"] == 0
    assert counts["rows_auto_flagged"] == 0
    assert counts["rows_still_pending"] == 0
    assert counts["attempts_processed"] == 1

    rows = cat_session.store.get(GradeReview, [])
    assert rows[0].status == ReviewStatus.confirmed
    # overall_score recomputed: 1 MCQ (1.0) + 1 AI (recording default 0.8) → 0.9
    attempts = [a for a in cat_session.store.get(Attempt, []) if str(a.id) == attempt_id]
    assert attempts[0].overall_score == pytest.approx(0.9)


async def test_reconcile_flags_pending_when_provider_returns_flagged(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A reconcile pass with a flagged verdict transitions the row and
    recomputes overall_score excluding the flagged AI grade."""
    _attempt_id, _t = _submit_leaving_rows_pending(cat_client, cat_session)

    async def _flagging_review(operation: Any, payload: dict[str, Any]) -> Any:
        recording_provider.calls.append(("review", operation, dict(payload)))
        items = payload.get("items") or []
        return recording_provider._result(
            {
                "items": [
                    {
                        "grade_id": item["grade_id"],
                        "verdict": "flagged",
                        "reasoning": "off-topic",
                    }
                    for item in items
                ]
            }
        )

    monkeypatch.setattr(recording_provider, "review", _flagging_review)

    counts = await reconcile_pending_grade_reviews(cat_session)
    assert counts["rows_flagged"] == 1
    assert counts["rows_confirmed"] == 0

    rows = cat_session.store.get(GradeReview, [])
    assert rows[0].status == ReviewStatus.flagged
    assert rows[0].review_reasoning == "off-topic"


async def test_reconcile_auto_flags_rows_older_than_max_retry_window(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A pending row whose ``created_at`` is older than
    ``MAX_RETRY × INTERVAL`` minutes auto-flags with reason
    ``auto_flagged_stuck_pending`` — the operator-visible ≈50-minute
    SLA (defaults 10 × 5 min). The provider is NOT called for an
    attempt whose only pending row aged out."""
    _attempt_id, _t = _submit_leaving_rows_pending(cat_client, cat_session)
    rows = cat_session.store.get(GradeReview, [])
    # Backdate created_at past the SLA window.
    sla_minutes = (
        GRADE_REVIEW_MAX_RETRY_ATTEMPTS * GRADE_REVIEW_RECONCILE_INTERVAL_MINUTES
    )
    rows[0].created_at = p.now_utc() - timedelta(minutes=sla_minutes + 5)

    # Replace review with a sentinel that would fail loud if called.
    async def _should_not_be_called(operation: Any, payload: dict[str, Any]) -> Any:
        raise AssertionError(
            "reconcile should not call provider.review() for aged-out rows"
        )

    monkeypatch.setattr(recording_provider, "review", _should_not_be_called)

    counts = await reconcile_pending_grade_reviews(cat_session)
    assert counts["rows_auto_flagged"] == 1
    assert counts["rows_confirmed"] == 0
    assert counts["rows_flagged"] == 0
    assert counts["attempts_processed"] == 0

    rows = cat_session.store.get(GradeReview, [])
    assert rows[0].status == ReviewStatus.flagged
    assert rows[0].review_reasoning == "auto_flagged_stuck_pending"


async def test_reconcile_recomputes_overall_score_after_auto_flag(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """When auto-flag transitions a row from pending to flagged,
    overall_score recomputes — flagged is excluded, so the post-flag
    score is the deterministic-only mean."""
    attempt_id, _t = _submit_leaving_rows_pending(cat_client, cat_session)
    rows = cat_session.store.get(GradeReview, [])
    sla_minutes = (
        GRADE_REVIEW_MAX_RETRY_ATTEMPTS * GRADE_REVIEW_RECONCILE_INTERVAL_MINUTES
    )
    rows[0].created_at = p.now_utc() - timedelta(minutes=sla_minutes + 5)

    counts = await reconcile_pending_grade_reviews(cat_session)
    assert counts["rows_auto_flagged"] == 1

    attempts = [a for a in cat_session.store.get(Attempt, []) if str(a.id) == attempt_id]
    # 1 MCQ correct (1.0) + 1 AI flagged (excluded) → overall_score = 1.0.
    assert attempts[0].overall_score == pytest.approx(1.0)


async def test_reconcile_leaves_pending_when_provider_still_fails(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When the provider continues to error, rows stay pending and
    counts report ``rows_still_pending``."""
    _attempt_id, _t = _submit_leaving_rows_pending(cat_client, cat_session)

    async def _erroring_review(operation: Any, payload: dict[str, Any]) -> Any:
        raise ValueError("provider still down")

    monkeypatch.setattr(recording_provider, "review", _erroring_review)

    counts = await reconcile_pending_grade_reviews(cat_session)
    assert counts["rows_still_pending"] == 1
    assert counts["rows_confirmed"] == 0
    assert counts["attempts_processed"] == 1

    rows = cat_session.store.get(GradeReview, [])
    assert rows[0].status == ReviewStatus.pending


async def test_reconcile_skips_overridden_grades(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A pending GradeReview whose underlying Grade has been admin-
    overridden (``Grade.overridden_at IS NOT NULL``) is not re-reviewed
    and not auto-flagged — admin has already resolved it via the AC-D2
    override mechanism."""
    _attempt_id, t = _submit_leaving_rows_pending(cat_client, cat_session)
    # Mark the underlying Grade as admin-overridden.
    grades = [g for g in cat_session.store.get(Grade, []) if g.source == GradeSource.ai]
    assert len(grades) == 1
    grades[0].overridden_by = t.id
    grades[0].overridden_at = p.now_utc()

    async def _should_not_be_called(operation: Any, payload: dict[str, Any]) -> Any:
        raise AssertionError(
            "reconcile should not call provider.review() for overridden grades"
        )

    monkeypatch.setattr(recording_provider, "review", _should_not_be_called)

    counts = await reconcile_pending_grade_reviews(cat_session)
    # The skipped overridden row counts toward rows_still_pending
    # semantically (it didn't transition), but no provider work happened.
    assert counts["rows_still_pending"] == 1
    assert counts["rows_auto_flagged"] == 0
    assert counts["attempts_processed"] == 0

    rows = cat_session.store.get(GradeReview, [])
    assert rows[0].status == ReviewStatus.pending


async def test_reconcile_batches_per_attempt_across_multiple_attempts(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Two attempts with pending rows yield exactly two
    ``provider.review()`` calls (one batched call per attempt, per
    AC-CD11 v1.7) — not a single cross-attempt mega-call and not N
    per-row calls."""
    _attempt_id_1, _ = _submit_leaving_rows_pending(
        cat_client, cat_session, testee_email="t1@kbc.com"
    )
    _attempt_id_2, _ = _submit_leaving_rows_pending(
        cat_client, cat_session, testee_email="t2@kbc.com"
    )

    async def _confirming_review(operation: Any, payload: dict[str, Any]) -> Any:
        recording_provider.calls.append(("review", operation, dict(payload)))
        items = payload.get("items") or []
        return recording_provider._result(
            {
                "items": [
                    {"grade_id": item["grade_id"], "verdict": "confirmed"}
                    for item in items
                ]
            }
        )

    monkeypatch.setattr(recording_provider, "review", _confirming_review)

    counts = await reconcile_pending_grade_reviews(cat_session)
    assert counts["attempts_processed"] == 2
    assert counts["rows_confirmed"] == 2

    review_calls = recording_provider.calls_for(Operation.grade_review)
    # The two reconcile-driven calls are the only review calls — the
    # submit-time calls used the default response and were recorded
    # under "review" but with the missing-items default that drove the
    # fail-soft path. ``calls_for`` returns all of them.
    # We assert at least 2 batched calls from this reconcile sweep —
    # each carrying exactly 1 item (the per-attempt batch).
    last_two = review_calls[-2:]
    for _, _, payload in last_two:
        assert len(payload["items"]) == 1
