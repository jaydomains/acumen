"""P6 Slice 3 — admin trigger for the grade_review reconcile sweep
(AC-D19 v1.6 / AC-CD11 v1.7).

The endpoint runs the same callable Slice 3's Celery task wrapper
runs, so functional coverage of the sweep itself lives in
``test_p6_grade_review_reconcile.py``. These tests cover the HTTP
surface only: counts schema shape, admin role gate, and that the
endpoint correctly commits the in-place row updates.
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
    GradeReview,
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
        randomise_option_order=True,
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


def _seed_pending(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    *,
    testee_email: str = "t@kbc.com",
) -> None:
    seed_system_settings(cat_session)
    t = _testee(cat_session, email=testee_email)
    test = _frozen_mixed_test(cat_session)
    sa = _q(
        cat_session,
        test.id,
        QuestionType.short_answer,
        {"prompt": "p", "rubric": "r", "model_answer": "m"},
    )
    r = cat_client.post("/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)})
    started = r.json()
    cat_client.post(
        f"/v1/attempts/{started['id']}/autosave",
        headers=bearer(t),
        json={
            "question_id": str(sa.id),
            "answer_payload": {"text": "answer"},
            "time_ms": 1000,
        },
    )
    cat_client.post(f"/v1/attempts/{started['id']}/submit", headers=bearer(t))


def test_admin_reconcile_endpoint_returns_counts(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Admin POSTs to ``/v1/admin/grade-reviews/reconcile`` and gets a
    200 with the counts schema. The reconcile actually moves rows
    (confirms one pending row via the dynamic review) — the endpoint
    is not a no-op."""
    _seed_pending(cat_client, cat_session)
    admin_user = _admin(cat_session)

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

    r = cat_client.post("/v1/admin/grade-reviews/reconcile", headers=bearer(admin_user))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body == {
        "attempts_processed": 1,
        "rows_confirmed": 1,
        "rows_flagged": 0,
        "rows_auto_flagged": 0,
        "rows_still_pending": 0,
    }
    # Row actually transitioned in the store.
    rows = cat_session.store.get(GradeReview, [])
    assert rows[0].status == ReviewStatus.confirmed


def test_admin_reconcile_endpoint_returns_zero_counts_when_nothing_pending(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Empty sweep returns all-zero counts — the operator-visible signal
    that the queue is clean."""
    seed_system_settings(cat_session)
    admin_user = _admin(cat_session)
    r = cat_client.post("/v1/admin/grade-reviews/reconcile", headers=bearer(admin_user))
    assert r.status_code == 200
    body = r.json()
    assert body == {
        "attempts_processed": 0,
        "rows_confirmed": 0,
        "rows_flagged": 0,
        "rows_auto_flagged": 0,
        "rows_still_pending": 0,
    }


def test_admin_reconcile_endpoint_forbidden_for_non_admin(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """A Testee POSTing to the endpoint gets 403 — the admin role gate
    is enforced via the ``_require_admin`` dependency."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    r = cat_client.post("/v1/admin/grade-reviews/reconcile", headers=bearer(t))
    assert r.status_code == 403
