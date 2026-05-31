"""P6 Slice 4 — admin grade_review flag queue + per-row resolution
(AC-D19 v1.6 / AC-D2 override mechanism).

Surfaces:
* ``GET /v1/admin/grade-reviews/flagged`` — oldest-first list of
  flagged grade_review rows whose underlying Grade has not been
  admin-overridden.
* ``POST /v1/admin/grade-reviews/{id}/resolve`` — admin chooses
  ``keep_ai`` / ``accept_reviewer`` / ``substitute``; writes the
  AC-D2 override columns + recomputes overall_score + audit-logs.

Resolution semantics (user-confirmed in the P6 plan):

* **keep_ai** — Grade.score / verdict / ai_reasoning unchanged;
  override columns set.
* **accept_reviewer** — Grade.score → 0.0, verdict → none,
  ai_reasoning → review_reasoning (reviewer's pushback preserved
  on the Grade row).
* **substitute** — admin supplies score (required, 0..1) and verdict
  (required, full/partial/none); reasoning optional.

Resolved-from-flagged grades are INCLUDED in overall_score per the
inclusion rule documented in :func:`_recompute_overall_score` —
overridden_at is set so the AI grade counts as admin-decided.
"""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    Attempt,
    AuditLog,
    Grade,
    GradeSource,
    GradeVerdict,
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

# --- Fixture helpers --------------------------------------------------


def _testee(session: CatalogueFakeSession, email: str = "t@kbc.com") -> AppUser:
    return cat_make_user(session, email=email, role=p.ROLE_TESTEE)


def _admin(session: CatalogueFakeSession, email: str = "a@kbc.com") -> AppUser:
    return cat_make_user(session, email=email, role=p.ROLE_ADMINISTRATOR)


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


def _flagging_review(recording_provider: RecordingProvider, reasoning: str = "off-topic"):
    async def _r(operation: Any, payload: dict[str, Any]) -> Any:
        recording_provider.calls.append(("review", operation, dict(payload)))
        items = payload.get("items") or []
        return recording_provider._result(
            {
                "items": [
                    {
                        "grade_id": item["grade_id"],
                        "verdict": "flagged",
                        "reasoning": reasoning,
                    }
                    for item in items
                ]
            }
        )

    return _r


def _submit_with_flagged_review(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
    *,
    testee_email: str = "t@kbc.com",
    reasoning: str = "off-topic",
) -> tuple[str, AppUser]:
    """Submit a mixed attempt where the review pass flags the AI grade.
    Yields the resulting (attempt_id, testee) so the test can drive
    admin actions against the flagged row."""
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
    r = cat_client.post("/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)})
    started = r.json()
    cat_client.post(
        f"/v1/attempts/{started['id']}/autosave",
        headers=bearer(t),
        json={
            "question_id": str(mcq.id),
            "answer_payload": {"choice": 0},
            "time_ms": 1000,
        },
    )
    cat_client.post(
        f"/v1/attempts/{started['id']}/autosave",
        headers=bearer(t),
        json={
            "question_id": str(sa.id),
            "answer_payload": {"text": "answer"},
            "time_ms": 1000,
        },
    )
    monkeypatch.setattr(
        recording_provider, "review", _flagging_review(recording_provider, reasoning)
    )
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))
    return started["id"], t


# --- GET /v1/admin/grade-reviews/flagged -----------------------------


def test_list_flagged_returns_unresolved_only(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The queue lists flagged rows whose underlying Grade has NOT been
    overridden. After admin resolves one, it drops off the queue."""
    attempt_id, _t = _submit_with_flagged_review(
        cat_client, cat_session, recording_provider, monkeypatch
    )
    admin_user = _admin(cat_session)

    r = cat_client.get("/v1/admin/grade-reviews/flagged", headers=bearer(admin_user))
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["data"]) == 1
    item = body["data"][0]
    assert item["attempt_id"] == attempt_id
    assert item["ai_verdict"] in ("full", "partial", "none")
    assert item["review_reasoning"] == "off-topic"
    assert "ai_score" in item
    assert "ai_reasoning" in item


def test_list_flagged_excludes_overridden(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A flagged GradeReview whose underlying Grade has been resolved
    (Grade.overridden_at != NULL) drops off the queue."""
    _attempt_id, _t = _submit_with_flagged_review(
        cat_client, cat_session, recording_provider, monkeypatch
    )
    admin_user = _admin(cat_session)
    # Mark the underlying Grade as already admin-overridden.
    grades = [g for g in cat_session.store.get(Grade, []) if g.source == GradeSource.ai]
    grades[0].overridden_by = admin_user.id
    grades[0].overridden_at = p.now_utc()

    r = cat_client.get("/v1/admin/grade-reviews/flagged", headers=bearer(admin_user))
    assert r.status_code == 200
    assert r.json()["data"] == []


def test_list_flagged_oldest_first(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Two flagged rows sort oldest-first — operator priority hint."""
    _a1, _ = _submit_with_flagged_review(
        cat_client,
        cat_session,
        recording_provider,
        monkeypatch,
        testee_email="t1@kbc.com",
    )
    _a2, _ = _submit_with_flagged_review(
        cat_client,
        cat_session,
        recording_provider,
        monkeypatch,
        testee_email="t2@kbc.com",
    )
    admin_user = _admin(cat_session)
    r = cat_client.get("/v1/admin/grade-reviews/flagged", headers=bearer(admin_user))
    body = r.json()
    assert len(body["data"]) == 2
    assert body["data"][0]["created_at"] <= body["data"][1]["created_at"]


def test_list_flagged_forbidden_for_non_admin(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A Testee gets 403 — the admin role gate is enforced."""
    _a, t = _submit_with_flagged_review(
        cat_client, cat_session, recording_provider, monkeypatch
    )
    r = cat_client.get("/v1/admin/grade-reviews/flagged", headers=bearer(t))
    assert r.status_code == 403


# --- POST /v1/admin/grade-reviews/{id}/resolve — keep_ai -------------


def test_resolve_keep_ai_sets_override_columns_only(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """``keep_ai`` leaves Grade.score / verdict / ai_reasoning
    untouched but sets the override columns so the row is marked
    admin-resolved and drops off the queue."""
    _attempt_id, _t = _submit_with_flagged_review(
        cat_client, cat_session, recording_provider, monkeypatch
    )
    admin_user = _admin(cat_session)
    listing = cat_client.get(
        "/v1/admin/grade-reviews/flagged", headers=bearer(admin_user)
    ).json()
    gr_id = listing["data"][0]["grade_review_id"]

    grade_before = [
        g for g in cat_session.store.get(Grade, []) if g.source == GradeSource.ai
    ][0]
    score_before, verdict_before = grade_before.score, grade_before.verdict
    ai_reasoning_before = grade_before.ai_reasoning

    r = cat_client.post(
        f"/v1/admin/grade-reviews/{gr_id}/resolve",
        headers=bearer(admin_user),
        json={"action": "keep_ai"},
    )
    assert r.status_code == 200, r.text

    grade_after = [
        g for g in cat_session.store.get(Grade, []) if g.source == GradeSource.ai
    ][0]
    assert grade_after.score == score_before
    assert grade_after.verdict == verdict_before
    assert grade_after.ai_reasoning == ai_reasoning_before
    assert grade_after.overridden_by == admin_user.id
    assert grade_after.overridden_at is not None


# --- POST /v1/admin/grade-reviews/{id}/resolve — accept_reviewer -----


def test_resolve_accept_reviewer_zeroes_score_and_writes_reviewer_reasoning(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """``accept_reviewer`` revokes the AI's grade — score → 0.0,
    verdict → none, ai_reasoning ← review_reasoning. User-confirmed
    semantic from the P6 plan."""
    _attempt_id, _t = _submit_with_flagged_review(
        cat_client,
        cat_session,
        recording_provider,
        monkeypatch,
        reasoning="rubric not applied",
    )
    admin_user = _admin(cat_session)
    listing = cat_client.get(
        "/v1/admin/grade-reviews/flagged", headers=bearer(admin_user)
    ).json()
    gr_id = listing["data"][0]["grade_review_id"]

    r = cat_client.post(
        f"/v1/admin/grade-reviews/{gr_id}/resolve",
        headers=bearer(admin_user),
        json={"action": "accept_reviewer"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["grade_score"] == 0.0
    assert body["grade_verdict"] == "none"

    grade_after = [
        g for g in cat_session.store.get(Grade, []) if g.source == GradeSource.ai
    ][0]
    assert grade_after.score == 0.0
    assert grade_after.verdict == GradeVerdict.none
    assert grade_after.ai_reasoning == "rubric not applied"
    assert grade_after.overridden_at is not None


# --- POST /v1/admin/grade-reviews/{id}/resolve — substitute ----------


def test_resolve_substitute_overrides_score_verdict_reasoning(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """``substitute`` writes admin-supplied score / verdict / reasoning
    to the Grade row + sets override columns."""
    _attempt_id, _t = _submit_with_flagged_review(
        cat_client, cat_session, recording_provider, monkeypatch
    )
    admin_user = _admin(cat_session)
    listing = cat_client.get(
        "/v1/admin/grade-reviews/flagged", headers=bearer(admin_user)
    ).json()
    gr_id = listing["data"][0]["grade_review_id"]

    r = cat_client.post(
        f"/v1/admin/grade-reviews/{gr_id}/resolve",
        headers=bearer(admin_user),
        json={
            "action": "substitute",
            "score": 0.75,
            "verdict": "partial",
            "reasoning": "admin: partial credit per rubric",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["grade_score"] == 0.75
    assert body["grade_verdict"] == "partial"

    grade_after = [
        g for g in cat_session.store.get(Grade, []) if g.source == GradeSource.ai
    ][0]
    assert grade_after.score == 0.75
    assert grade_after.verdict == GradeVerdict.partial
    assert grade_after.ai_reasoning == "admin: partial credit per rubric"


def test_resolve_substitute_rejects_missing_score_or_verdict(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Pydantic enforces that ``substitute`` carries both ``score`` and
    ``verdict``; missing either is a 422."""
    _attempt_id, _t = _submit_with_flagged_review(
        cat_client, cat_session, recording_provider, monkeypatch
    )
    admin_user = _admin(cat_session)
    listing = cat_client.get(
        "/v1/admin/grade-reviews/flagged", headers=bearer(admin_user)
    ).json()
    gr_id = listing["data"][0]["grade_review_id"]

    r = cat_client.post(
        f"/v1/admin/grade-reviews/{gr_id}/resolve",
        headers=bearer(admin_user),
        json={"action": "substitute", "score": 0.5},  # missing verdict
    )
    assert r.status_code == 422


# --- 4xx error paths -------------------------------------------------


def test_resolve_409_when_already_overridden(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A second resolve call on an already-overridden grade returns 409
    (idempotency guard — admin can't resolve twice)."""
    _attempt_id, _t = _submit_with_flagged_review(
        cat_client, cat_session, recording_provider, monkeypatch
    )
    admin_user = _admin(cat_session)
    listing = cat_client.get(
        "/v1/admin/grade-reviews/flagged", headers=bearer(admin_user)
    ).json()
    gr_id = listing["data"][0]["grade_review_id"]

    r1 = cat_client.post(
        f"/v1/admin/grade-reviews/{gr_id}/resolve",
        headers=bearer(admin_user),
        json={"action": "keep_ai"},
    )
    assert r1.status_code == 200

    r2 = cat_client.post(
        f"/v1/admin/grade-reviews/{gr_id}/resolve",
        headers=bearer(admin_user),
        json={"action": "keep_ai"},
    )
    assert r2.status_code == 409


def test_resolve_409_when_review_status_not_flagged(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Trying to resolve a confirmed (or pending) grade_review returns
    409 — only flagged rows are resolvable."""
    # Submit with a confirmed review.
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    admin_user = _admin(cat_session)
    test = _frozen_mixed_test(cat_session)
    sa = _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "p", "rubric": "r", "model_answer": "m"},
    )
    started = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    ).json()
    cat_client.post(
        f"/v1/attempts/{started['id']}/autosave",
        headers=bearer(t),
        json={
            "question_id": str(sa.id),
            "answer_payload": {"text": "answer"},
            "time_ms": 1000,
        },
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
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))

    # Now try to resolve the confirmed row.
    from app.models import GradeReview

    gr_row = cat_session.store.get(GradeReview, [])[0]
    assert gr_row.status == ReviewStatus.confirmed
    r = cat_client.post(
        f"/v1/admin/grade-reviews/{gr_row.id}/resolve",
        headers=bearer(admin_user),
        json={"action": "keep_ai"},
    )
    assert r.status_code == 409


def test_resolve_404_when_grade_review_not_found(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """A random UUID returns 404."""
    seed_system_settings(cat_session)
    admin_user = _admin(cat_session)
    bogus_id = uuid.uuid4()
    r = cat_client.post(
        f"/v1/admin/grade-reviews/{bogus_id}/resolve",
        headers=bearer(admin_user),
        json={"action": "keep_ai"},
    )
    assert r.status_code == 404


def test_resolve_500_when_grade_chain_is_broken(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If the Grade → Response → Attempt → Test FK chain is missing a
    link, ``resolve_flagged_review`` raises 500 ``broken_grade_chain``
    rather than returning a sentinel UUID (Gitar PR-#18 Slice 4
    finding). The FK constraints make this impossible in production,
    but the test forces the state to verify the guard fires."""
    _attempt_id, _t = _submit_with_flagged_review(
        cat_client, cat_session, recording_provider, monkeypatch
    )
    admin_user = _admin(cat_session)
    listing = cat_client.get(
        "/v1/admin/grade-reviews/flagged", headers=bearer(admin_user)
    ).json()
    gr_id = listing["data"][0]["grade_review_id"]

    # Force the chain to break: clear the Response store so the Grade
    # row points at a non-existent response. The Grade's overridden_by /
    # overridden_at columns get set before the chain check, which is
    # acceptable — the 500 makes the partial state visible to the
    # operator. (Production with real FK constraints would never reach
    # this state.)
    from app.models import Response as ResponseModel

    cat_session.store[ResponseModel] = []

    r = cat_client.post(
        f"/v1/admin/grade-reviews/{gr_id}/resolve",
        headers=bearer(admin_user),
        json={"action": "keep_ai"},
    )
    assert r.status_code == 500
    body = r.json()
    assert (
        body.get("error", {}).get("code") == "broken_grade_chain"
        or body.get("code") == "broken_grade_chain"
    )


def test_resolve_forbidden_for_non_admin(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A Testee POSTing to the resolve endpoint gets 403."""
    _attempt_id, t = _submit_with_flagged_review(
        cat_client, cat_session, recording_provider, monkeypatch
    )
    # Grab any GradeReview id.
    from app.models import GradeReview

    gr_id = cat_session.store.get(GradeReview, [])[0].id
    r = cat_client.post(
        f"/v1/admin/grade-reviews/{gr_id}/resolve",
        headers=bearer(t),
        json={"action": "keep_ai"},
    )
    assert r.status_code == 403


# --- Side effects: overall_score recompute + audit log ----------------


def test_resolve_substitute_recomputes_overall_score_including_admin_score(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """After admin substitutes 0.5 for the flagged AI grade,
    overall_score = mean(1.0 MCQ, 0.5 admin-resolved AI) = 0.75. The
    admin-resolved row IS included per the inclusion rule (overridden_at
    set → counts as admin-decided)."""
    attempt_id, _t = _submit_with_flagged_review(
        cat_client, cat_session, recording_provider, monkeypatch
    )
    admin_user = _admin(cat_session)
    listing = cat_client.get(
        "/v1/admin/grade-reviews/flagged", headers=bearer(admin_user)
    ).json()
    gr_id = listing["data"][0]["grade_review_id"]

    r = cat_client.post(
        f"/v1/admin/grade-reviews/{gr_id}/resolve",
        headers=bearer(admin_user),
        json={"action": "substitute", "score": 0.5, "verdict": "partial"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["attempt_overall_score"] == pytest.approx(0.75)

    attempts = [a for a in cat_session.store.get(Attempt, []) if str(a.id) == attempt_id]
    assert attempts[0].overall_score == pytest.approx(0.75)


def test_resolve_writes_audit_log(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Every resolution writes an audit row with action +
    score/verdict/reasoning in the detail JSONB so the audit trail is
    reconstructable."""
    _attempt_id, _t = _submit_with_flagged_review(
        cat_client, cat_session, recording_provider, monkeypatch
    )
    admin_user = _admin(cat_session)
    listing = cat_client.get(
        "/v1/admin/grade-reviews/flagged", headers=bearer(admin_user)
    ).json()
    gr_id = listing["data"][0]["grade_review_id"]

    cat_client.post(
        f"/v1/admin/grade-reviews/{gr_id}/resolve",
        headers=bearer(admin_user),
        json={
            "action": "substitute",
            "score": 0.6,
            "verdict": "partial",
            "reasoning": "borderline; partial",
        },
    )

    audits = [
        a
        for a in cat_session.store.get(AuditLog, [])
        if a.action == "grade_review.resolve"
    ]
    assert len(audits) == 1
    detail = audits[0].detail or {}
    assert detail.get("action") == "substitute"
    assert detail.get("score") == 0.6
    assert detail.get("verdict") == "partial"
    assert detail.get("reasoning") == "borderline; partial"
    assert audits[0].actor_id == admin_user.id
