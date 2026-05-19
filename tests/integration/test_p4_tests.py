"""P4 test CRUD — four modes, mode-field matrix, AC-D11 timing/pause
rules, AC-D24 campaign lock, frozen question authoring, publish gate.

Zero-DB / zero-network (AC-CD15)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app import permissions as p
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
)


def _admin(session: CatalogueFakeSession) -> dict[str, str]:
    return bearer(
        cat_make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)
    )


_MCQ = {
    "prompt": "2+2?",
    "options": ["3", "4", "5"],
    "correct": 1,
}


def test_admin_gate(cat_client: TestClient, cat_session: CatalogueFakeSession) -> None:
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    r = cat_client.post(
        "/v1/tests", headers=bearer(testee), json={"name": "X", "mode": "frozen"}
    )
    assert r.status_code == 403
    assert (
        cat_client.post("/v1/tests", json={"name": "X", "mode": "frozen"}).status_code
        == 401
    )


def test_create_per_testee_draft(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    r = cat_client.post(
        "/v1/tests",
        headers=h,
        json={"name": "Spec", "mode": "per_testee", "target_difficulty": 5},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "draft"
    assert body["mode"] == "per_testee"


def test_per_testee_rejects_shuffle_fields(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    r = cat_client.post(
        "/v1/tests",
        headers=h,
        json={"name": "S", "mode": "per_testee", "randomise_question_order": True},
    )
    assert r.status_code == 422


def test_benchmark_requires_scope(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    assert (
        cat_client.post(
            "/v1/tests", headers=h, json={"name": "B", "mode": "benchmark"}
        ).status_code
        == 422
    )
    r = cat_client.post(
        "/v1/tests",
        headers=h,
        json={"name": "B", "mode": "benchmark", "benchmark_scope": "pill"},
    )
    assert r.status_code == 201
    assert r.json()["benchmark_scope"] == "pill"


def test_timing_pause_rules(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    # <=60min permits no pauses
    short = cat_client.post(
        "/v1/tests",
        headers=h,
        json={
            "name": "Short",
            "mode": "frozen",
            "timed": True,
            "duration_minutes": 45,
            "pause_allowance": 1,
        },
    )
    assert short.status_code == 422
    short_ok = cat_client.post(
        "/v1/tests",
        headers=h,
        json={"name": "Short", "mode": "frozen", "timed": True, "duration_minutes": 45},
    )
    assert short_ok.status_code == 201
    assert short_ok.json()["pause_allowance"] == 0
    # >60min defaults to 2 pauses
    long = cat_client.post(
        "/v1/tests",
        headers=h,
        json={"name": "Long", "mode": "frozen", "timed": True, "duration_minutes": 90},
    )
    assert long.json()["pause_allowance"] == 2
    # untimed cannot carry duration
    assert (
        cat_client.post(
            "/v1/tests",
            headers=h,
            json={"name": "U", "mode": "frozen", "duration_minutes": 30},
        ).status_code
        == 422
    )


def test_frozen_question_authoring_and_publish_gate(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = cat_client.post(
        "/v1/tests", headers=h, json={"name": "F", "mode": "frozen"}
    ).json()["id"]
    # publish with no questions -> 422 empty_test
    pub = cat_client.post(f"/v1/tests/{tid}/publish", headers=h)
    assert pub.status_code == 422
    assert pub.json()["error"]["code"] == "empty_test"
    # invalid config rejected
    bad = cat_client.post(
        f"/v1/tests/{tid}/questions",
        headers=h,
        json={
            "type": "multiple_choice",
            "config": {"prompt": "x"},
            "assigned_difficulty": 3,
        },
    )
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "invalid_question_config"
    # valid question
    q = cat_client.post(
        f"/v1/tests/{tid}/questions",
        headers=h,
        json={"type": "multiple_choice", "config": _MCQ, "assigned_difficulty": 3},
    )
    assert q.status_code == 201
    assert cat_client.get(f"/v1/tests/{tid}/questions", headers=h).json()["data"]
    # now publish succeeds
    assert (
        cat_client.post(f"/v1/tests/{tid}/publish", headers=h).json()["status"]
        == "published"
    )


def test_per_testee_rejects_question_authoring(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = cat_client.post(
        "/v1/tests", headers=h, json={"name": "P", "mode": "per_testee"}
    ).json()["id"]
    r = cat_client.post(
        f"/v1/tests/{tid}/questions",
        headers=h,
        json={
            "type": "true_false",
            "config": {"prompt": "p", "correct": True},
            "assigned_difficulty": 2,
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "questions_unsupported"


def test_campaign_lock_blocks_edit_and_delete(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = cat_client.post(
        "/v1/tests", headers=h, json={"name": "C", "mode": "frozen"}
    ).json()["id"]
    cat_client.post(
        f"/v1/tests/{tid}/questions",
        headers=h,
        json={"type": "multiple_choice", "config": _MCQ, "assigned_difficulty": 1},
    )
    lock = cat_client.post(
        f"/v1/tests/{tid}/lock",
        headers=h,
        json={"campaign_id": "00000000-0000-0000-0000-0000000000aa"},
    )
    assert lock.status_code == 200
    assert lock.json()["lock_mode"] == "campaign_locked"
    edit = cat_client.patch(f"/v1/tests/{tid}", headers=h, json={"name": "C2"})
    assert edit.status_code == 409
    assert edit.json()["error"]["code"] == "test_campaign_locked"
    assert cat_client.delete(f"/v1/tests/{tid}", headers=h).status_code == 409
    # unlock re-enables editing
    assert cat_client.post(f"/v1/tests/{tid}/unlock", headers=h).status_code == 200
    assert (
        cat_client.patch(f"/v1/tests/{tid}", headers=h, json={"name": "C2"}).status_code
        == 200
    )


def test_lock_unsupported_for_per_testee(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = cat_client.post(
        "/v1/tests", headers=h, json={"name": "P", "mode": "per_testee"}
    ).json()["id"]
    r = cat_client.post(
        f"/v1/tests/{tid}/lock",
        headers=h,
        json={"campaign_id": "00000000-0000-0000-0000-0000000000bb"},
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "lock_unsupported"


def test_get_and_404(cat_client: TestClient, cat_session: CatalogueFakeSession) -> None:
    h = _admin(cat_session)
    assert (
        cat_client.get(
            "/v1/tests/00000000-0000-0000-0000-0000000000cc", headers=h
        ).status_code
        == 404
    )
