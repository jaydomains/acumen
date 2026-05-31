"""P6 Slice 2 — batched cross-family review at submit + provenance +
fail-soft + telemetry (AC-D19 v1.7 / AC-CD11 v1.7).

The recording_provider fixture has a default review response missing
the ``items`` key, which drives the fail-soft "rows stay pending" path
(intentional — the P5 regression suite asserts this). Tests that
exercise the happy / flagged / partial-batch paths replace
``recording_provider.review`` with a dynamic implementation via
monkeypatch.

Telemetry is captured via :func:`caplog` — the structured logger in
:mod:`app.domain.grade_review` emits the four mandated fields
(``latency_ms``, ``success``, ``batched_payload_size``,
``ceiling_breached``) on every review call.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.ai.provider import Operation
from app.domain import grade_review as grade_review_module
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


def _install_dynamic_review(
    monkeypatch: pytest.MonkeyPatch,
    recording_provider: RecordingProvider,
    *,
    verdicts: dict[int, str] | None = None,
    reasonings: dict[int, str] | None = None,
) -> None:
    """Replace ``recording_provider.review`` with an async implementation
    that dynamically maps the payload's ``items`` to confirmed/flagged
    verdicts. ``verdicts``/``reasonings`` are keyed by item index; any
    unmapped item defaults to ``confirmed`` with no reasoning.

    The replacement preserves the call-recording behaviour so
    ``recording_provider.calls_for(Operation.grade_review)`` still works.
    """
    verdicts = verdicts or {}
    reasonings = reasonings or {}
    original = recording_provider._result

    async def _dynamic_review(operation: Any, payload: dict[str, Any]) -> Any:
        recording_provider.calls.append(("review", operation, dict(payload)))
        items_in = payload.get("items") or []
        items_out: list[dict[str, Any]] = []
        for idx, item in enumerate(items_in):
            entry: dict[str, Any] = {
                "grade_id": item["grade_id"],
                "verdict": verdicts.get(idx, "confirmed"),
            }
            if idx in reasonings:
                entry["reasoning"] = reasonings[idx]
            items_out.append(entry)
        return original({"items": items_out})

    monkeypatch.setattr(recording_provider, "review", _dynamic_review)


# --- Happy path: confirmed review writes provenance + recomputes ------


def test_submit_writes_grade_review_rows_for_each_ai_grade(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The happy path: two AI-graded responses, dynamic review confirms
    both. Both GradeReview rows are confirmed with full OpenAI
    provenance (cost / tokens divided evenly between rows per AC-D18 —
    one call, N rows)."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_mixed_test(cat_session)
    sa1 = _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "q1", "rubric": "r1", "model_answer": "m1"},
    )
    sa2 = _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "q2", "rubric": "r2", "model_answer": "m2"},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(sa1.id), {"text": "answer 1"})
    _autosave(cat_client, t, started["id"], str(sa2.id), {"text": "answer 2"})

    _install_dynamic_review(
        monkeypatch, recording_provider, reasonings={0: "ok", 1: "ok"}
    )
    r = cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))
    assert r.status_code == 200

    # Exactly one review call covers both AI grades (AC-CD11 v1.7
    # batched-per-attempt).
    review_calls = recording_provider.calls_for(Operation.grade_review)
    assert len(review_calls) == 1
    _, _, payload = review_calls[0]
    assert len(payload["items"]) == 2
    grade_ids_in_payload = {item["grade_id"] for item in payload["items"]}
    grades = [g for g in cat_session.store.get(Grade, []) if g.source == GradeSource.ai]
    assert {str(g.id) for g in grades} == grade_ids_in_payload

    # Each AI Grade has a paired GradeReview with status=confirmed.
    reviews = cat_session.store.get(GradeReview, [])
    assert len(reviews) == 2
    for gr in reviews:
        assert gr.status == ReviewStatus.confirmed
        assert gr.review_reasoning == "ok"
        # OpenAI provenance is stamped on each row; cost + tokens are
        # divided by share_count=2 per record_provenance_share.
        assert gr.ai_provider == "anthropic"  # recording_provider label
        assert gr.ai_model == "claude-sonnet-4-6"
        assert gr.ai_prompt_version == "1.0.0-recording"
        # share_count=2 → tokens floor-divided, cost divided exactly.
        assert gr.ai_prompt_tokens == 100 // 2
        assert gr.ai_completion_tokens == 50 // 2
        assert gr.ai_cost_usd == pytest.approx(0.001 / 2)


def test_submit_recomputes_overall_score_with_confirmed_ai_grades(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """After confirmed review, ``overall_score`` averages deterministic
    grades (MCQ correct → 1.0) + confirmed AI grades (recording default
    score → 0.8). 1 MCQ + 1 SA → (1.0 + 0.8) / 2 = 0.9."""
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

    submitted = [
        a for a in cat_session.store.get(Attempt, []) if a.submitted_at is not None
    ]
    assert len(submitted) == 1
    assert submitted[0].overall_score == pytest.approx(0.9)
    assert submitted[0].outcome == "pass"


def test_submit_overall_score_excludes_flagged(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When the review verdict is ``flagged``, the AI grade is NOT folded
    into overall_score (AC-D19 v1.6 / v1.7: 'only confirmed grades
    display synchronously'). 2 MCQ correct + 1 AI flagged →
    overall_score = mean(1.0, 1.0) = 1.0."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_mixed_test(cat_session)
    mcq1 = _q(
        cat_session,
        test.id,
        QuestionType.multiple_choice,
        {"prompt": "p", "options": ["a", "b"], "correct": 0},
    )
    mcq2 = _q(
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
    _autosave(cat_client, t, started["id"], str(mcq1.id), {"choice": 0})
    _autosave(cat_client, t, started["id"], str(mcq2.id), {"choice": 0})
    _autosave(cat_client, t, started["id"], str(sa.id), {"text": "answer"})

    _install_dynamic_review(monkeypatch, recording_provider, verdicts={0: "flagged"})
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))

    submitted = [
        a for a in cat_session.store.get(Attempt, []) if a.submitted_at is not None
    ]
    assert submitted[0].overall_score == pytest.approx(1.0)


# --- Fail-soft branches: rows stay pending ---------------------------


def test_submit_review_timeout_leaves_rows_pending(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When the 60-s ceiling is breached, every grade_review row for the
    attempt stays pending; submit returns 200 (AC-CD11 v1.7 fail-soft).
    We shorten the ceiling and make the provider await beyond it."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_mixed_test(cat_session)
    sa = _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "p", "rubric": "r", "model_answer": "m"},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(sa.id), {"text": "answer"})

    monkeypatch.setattr(grade_review_module, "GRADE_REVIEW_SUBMIT_CEILING_SECONDS", 0.05)

    async def _sleepy_review(operation: Any, payload: dict[str, Any]) -> Any:
        await asyncio.sleep(0.5)  # well past the 0.05s ceiling
        raise AssertionError("review() should have been cancelled by wait_for")

    monkeypatch.setattr(recording_provider, "review", _sleepy_review)

    r = cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))
    assert r.status_code == 200

    reviews = cat_session.store.get(GradeReview, [])
    assert len(reviews) == 1
    assert reviews[0].status == ReviewStatus.pending


def test_submit_review_provider_error_leaves_rows_pending(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Any exception from provider.review() (provider 500, malformed
    JSON re-raised as ValueError, etc.) is caught fail-soft: row stays
    pending, submit returns 200."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_mixed_test(cat_session)
    sa = _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "p", "rubric": "r", "model_answer": "m"},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(sa.id), {"text": "answer"})

    async def _raising_review(operation: Any, payload: dict[str, Any]) -> Any:
        raise ValueError("openai 500")

    monkeypatch.setattr(recording_provider, "review", _raising_review)

    r = cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))
    assert r.status_code == 200

    reviews = cat_session.store.get(GradeReview, [])
    assert len(reviews) == 1
    assert reviews[0].status == ReviewStatus.pending


def test_submit_review_malformed_response_leaves_rows_pending(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """A response with no ``items`` key (or with a non-list value)
    triggers the malformed-response fail-soft branch: rows stay
    pending. This is the default recording_provider behaviour — its
    canned default lacks ``items`` — which is why the P5 regression
    tests for the F14 gate keep passing without modification."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_mixed_test(cat_session)
    sa = _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "p", "rubric": "r", "model_answer": "m"},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(sa.id), {"text": "answer"})

    # The default recording_provider review default is
    # {"verdict": "confirmed", ...} — no ``items`` key. Don't override.
    r = cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))
    assert r.status_code == 200

    reviews = cat_session.store.get(GradeReview, [])
    assert len(reviews) == 1
    assert reviews[0].status == ReviewStatus.pending


# --- Partial-batch parsing defenses ----------------------------------


def test_submit_review_unknown_grade_id_in_response_skipped(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An ``items[]`` entry whose ``grade_id`` does not match any of the
    attempt's AI Grade ids is skipped; the other valid entries proceed
    normally. Row for the unmatched id stays pending; row for the
    matched id transitions to confirmed."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_mixed_test(cat_session)
    sa = _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "p", "rubric": "r", "model_answer": "m"},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(sa.id), {"text": "answer"})

    async def _phantom_review(operation: Any, payload: dict[str, Any]) -> Any:
        recording_provider.calls.append(("review", operation, dict(payload)))
        # Return an ``items[]`` whose only entry has a grade_id that is
        # not in the payload — the matching valid grade gets no entry.
        return recording_provider._result(
            {
                "items": [
                    {"grade_id": str(uuid.uuid4()), "verdict": "confirmed"},
                ]
            }
        )

    monkeypatch.setattr(recording_provider, "review", _phantom_review)
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))

    reviews = cat_session.store.get(GradeReview, [])
    assert len(reviews) == 1
    assert reviews[0].status == ReviewStatus.pending


def test_submit_review_unknown_verdict_leaves_row_pending(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An ``items[]`` entry with a verdict that is not in
    ``{confirmed, flagged}`` is skipped; row stays pending."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_mixed_test(cat_session)
    sa = _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "p", "rubric": "r", "model_answer": "m"},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(sa.id), {"text": "answer"})

    async def _bad_verdict_review(operation: Any, payload: dict[str, Any]) -> Any:
        recording_provider.calls.append(("review", operation, dict(payload)))
        items = payload.get("items") or []
        return recording_provider._result(
            {
                "items": [
                    {"grade_id": item["grade_id"], "verdict": "maybe"} for item in items
                ]
            }
        )

    monkeypatch.setattr(recording_provider, "review", _bad_verdict_review)
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))

    reviews = cat_session.store.get(GradeReview, [])
    assert len(reviews) == 1
    assert reviews[0].status == ReviewStatus.pending


def test_submit_review_mixed_batch_some_confirmed_some_skipped(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A batched response where one entry is confirmed and the other is
    off-contract (unknown verdict): the confirmed row transitions; the
    off-contract row stays pending. Result page status stays
    review_pending because at least one is pending."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_mixed_test(cat_session)
    sa1 = _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "p1", "rubric": "r", "model_answer": "m"},
    )
    sa2 = _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "p2", "rubric": "r", "model_answer": "m"},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(sa1.id), {"text": "a1"})
    _autosave(cat_client, t, started["id"], str(sa2.id), {"text": "a2"})

    async def _partial_review(operation: Any, payload: dict[str, Any]) -> Any:
        recording_provider.calls.append(("review", operation, dict(payload)))
        items = payload.get("items") or []
        return recording_provider._result(
            {
                "items": [
                    {"grade_id": items[0]["grade_id"], "verdict": "confirmed"},
                    {"grade_id": items[1]["grade_id"], "verdict": "maybe"},
                ]
            }
        )

    monkeypatch.setattr(recording_provider, "review", _partial_review)
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))

    reviews = cat_session.store.get(GradeReview, [])
    statuses = sorted(r.status.value for r in reviews)
    assert statuses == ["confirmed", "pending"]


# --- Telemetry --------------------------------------------------------


def test_submit_review_telemetry_emitted(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Every review() call emits a structured log record with the four
    mandated fields plus the originating attempt/tenant ids. The P6
    deliverable in ROADMAP.md is the empirical baseline for tuning the
    60-s ceiling — this assertion is the schema gate."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_mixed_test(cat_session)
    sa = _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "p", "rubric": "r", "model_answer": "m"},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(sa.id), {"text": "answer"})

    _install_dynamic_review(monkeypatch, recording_provider)
    with caplog.at_level(logging.INFO, logger="app.domain.grade_review"):
        cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))

    completed = [
        rec for rec in caplog.records if rec.message == "grade_review.batch_completed"
    ]
    assert len(completed) == 1
    rec = completed[0]
    assert isinstance(rec.__dict__.get("latency_ms"), float)
    assert rec.__dict__.get("success") is True
    assert rec.__dict__.get("batched_payload_size") == 1
    assert rec.__dict__.get("ceiling_breached") is False
    assert rec.__dict__.get("attempt_id") == started["id"]
    assert rec.__dict__.get("tenant_id") == str(SEED_TENANT_ID)


def test_submit_review_telemetry_marks_ceiling_breached_on_timeout(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The ceiling-breach branch emits a record with ``ceiling_breached
    == True`` and ``success == False`` — the operator-visible signal
    that the 60-s ceiling fired (drives the v1.x tuning decision)."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _frozen_mixed_test(cat_session)
    sa = _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "p", "rubric": "r", "model_answer": "m"},
    )
    started = _start(cat_client, t, test.id)
    _autosave(cat_client, t, started["id"], str(sa.id), {"text": "answer"})

    monkeypatch.setattr(grade_review_module, "GRADE_REVIEW_SUBMIT_CEILING_SECONDS", 0.05)

    async def _sleepy_review(operation: Any, payload: dict[str, Any]) -> Any:
        await asyncio.sleep(0.5)
        raise AssertionError("unreachable")

    monkeypatch.setattr(recording_provider, "review", _sleepy_review)

    with caplog.at_level(logging.INFO, logger="app.domain.grade_review"):
        cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))

    completed = [
        rec for rec in caplog.records if rec.message == "grade_review.batch_completed"
    ]
    assert len(completed) == 1
    rec = completed[0]
    assert rec.__dict__.get("success") is False
    assert rec.__dict__.get("ceiling_breached") is True
