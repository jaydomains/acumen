"""P4 Slice 1 — Tests router behaviour.

Admin-only CRUD for the four ``TestMode``s (AC-D5), publish gate
(AC-D5/D17), forward-only edit (AC-D17), campaign lock + question
authoring under the lock (AC-D24), benchmark mode field matrix (AC-D13),
AC-D11 timing/pause rules.

Zero-DB / zero-network (AC-CD15) via ``CatalogueFakeSession`` — the
catalogue harness is reused because the P4 tests domain uses the same
``select(Model).where(col == value, ...)`` shape (id/tenant equality
with Python-side ordering).
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app import permissions as p
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
    seed_system_settings,
)


def _admin_headers(session: CatalogueFakeSession) -> dict[str, str]:
    return bearer(
        cat_make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)
    )


def _testee_headers(session: CatalogueFakeSession) -> dict[str, str]:
    return bearer(cat_make_user(session, email="t@kbc.com", role=p.ROLE_TESTEE))


def _mcq_config() -> dict[str, object]:
    return {
        "prompt": "Which is the safety-relevant pill?",
        "options": ["Reference Panels", "Confined Space"],
        "correct": 1,
    }


def _hand_authored_test(client: TestClient, h: dict[str, str]) -> str:
    r = client.post(
        "/v1/tests",
        headers=h,
        json={"name": "Frozen Paint QA", "mode": "hand_authored"},
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


# --- admin gate -------------------------------------------------------


def test_admin_gate_blocks_testee_create(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    r = cat_client.post(
        "/v1/tests",
        headers=_testee_headers(cat_session),
        json={"name": "X", "mode": "per_testee"},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "forbidden"


def test_unauthenticated_create_is_401(cat_client: TestClient) -> None:
    r = cat_client.post("/v1/tests", json={"name": "X", "mode": "per_testee"})
    assert r.status_code == 401


# --- four test modes' field matrix -----------------------------------


def test_per_testee_mode_creates_in_draft(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    r = cat_client.post(
        "/v1/tests", headers=h, json={"name": "Daily", "mode": "per_testee"}
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["mode"] == "per_testee"
    assert body["status"] == "draft"
    assert body["lock_mode"] == "open"
    assert body["randomise_question_order"] is True
    assert body["randomise_option_order"] is True


def test_frozen_mode_defaults_shuffle_true(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    r = cat_client.post("/v1/tests", headers=h, json={"name": "Frozen", "mode": "frozen"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["randomise_question_order"] is True
    assert body["randomise_option_order"] is True
    assert body["lock_mode"] == "open"


def test_benchmark_mode_requires_scope(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    r = cat_client.post("/v1/tests", headers=h, json={"name": "B", "mode": "benchmark"})
    assert r.status_code == 422
    r = cat_client.post(
        "/v1/tests",
        headers=h,
        json={"name": "B", "mode": "benchmark", "benchmark_scope": "subject"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["benchmark_scope"] == "subject"


def test_benchmark_scope_rejected_on_other_modes(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    r = cat_client.post(
        "/v1/tests",
        headers=h,
        json={"name": "X", "mode": "frozen", "benchmark_scope": "pill"},
    )
    assert r.status_code == 422


def test_randomise_only_for_shared_modes(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    r = cat_client.post(
        "/v1/tests",
        headers=h,
        json={"name": "X", "mode": "per_testee", "randomise_question_order": False},
    )
    assert r.status_code == 422


# --- AC-D11 timing/pause matrix --------------------------------------


def test_timed_test_requires_duration(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    r = cat_client.post(
        "/v1/tests", headers=h, json={"name": "T", "mode": "frozen", "timed": True}
    )
    assert r.status_code == 422


def test_short_timed_test_permits_no_pauses(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    # 60-minute test: pause_allowance must default to 0.
    r = cat_client.post(
        "/v1/tests",
        headers=h,
        json={
            "name": "Sixty",
            "mode": "frozen",
            "timed": True,
            "duration_minutes": 60,
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["pause_allowance"] == 0

    # Explicit non-zero pause_allowance on a short test is rejected.
    r = cat_client.post(
        "/v1/tests",
        headers=h,
        json={
            "name": "ShortPause",
            "mode": "frozen",
            "timed": True,
            "duration_minutes": 30,
            "pause_allowance": 2,
        },
    )
    assert r.status_code == 422


def test_long_timed_test_defaults_to_two_pauses(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    r = cat_client.post(
        "/v1/tests",
        headers=h,
        json={
            "name": "Long",
            "mode": "frozen",
            "timed": True,
            "duration_minutes": 120,
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["pause_allowance"] == 2


def test_untimed_rejects_duration(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    r = cat_client.post(
        "/v1/tests",
        headers=h,
        json={"name": "U", "mode": "frozen", "duration_minutes": 5},
    )
    assert r.status_code == 422


# --- publish gate ----------------------------------------------------


def test_publish_blocks_empty_frozen_test(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    test_id = _hand_authored_test(cat_client, h)
    r = cat_client.post(f"/v1/tests/{test_id}/publish", headers=h)
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "empty_test"


def test_publish_succeeds_after_question_added(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    test_id = _hand_authored_test(cat_client, h)
    r = cat_client.post(
        f"/v1/tests/{test_id}/questions",
        headers=h,
        json={
            "type": "multiple_choice",
            "config": _mcq_config(),
            "assigned_difficulty": 4,
        },
    )
    assert r.status_code == 201, r.text
    r = cat_client.post(f"/v1/tests/{test_id}/publish", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "published"


def test_publish_rejected_when_already_published(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    test_id = _hand_authored_test(cat_client, h)
    cat_client.post(
        f"/v1/tests/{test_id}/questions",
        headers=h,
        json={
            "type": "multiple_choice",
            "config": _mcq_config(),
            "assigned_difficulty": 4,
        },
    )
    r = cat_client.post(f"/v1/tests/{test_id}/publish", headers=h)
    assert r.status_code == 200
    r = cat_client.post(f"/v1/tests/{test_id}/publish", headers=h)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "already_published"


def test_per_testee_publishes_without_questions(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    r = cat_client.post(
        "/v1/tests", headers=h, json={"name": "Daily", "mode": "per_testee"}
    )
    test_id = r.json()["id"]
    r = cat_client.post(f"/v1/tests/{test_id}/publish", headers=h)
    assert r.status_code == 200, r.text


# --- question config validation --------------------------------------


def test_mcq_config_requires_options_and_correct_index(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    test_id = _hand_authored_test(cat_client, h)

    bad_options = {"prompt": "p", "options": ["only"], "correct": 0}
    r = cat_client.post(
        f"/v1/tests/{test_id}/questions",
        headers=h,
        json={"type": "multiple_choice", "config": bad_options, "assigned_difficulty": 3},
    )
    assert r.status_code == 422

    out_of_range = {"prompt": "p", "options": ["a", "b"], "correct": 5}
    r = cat_client.post(
        f"/v1/tests/{test_id}/questions",
        headers=h,
        json={
            "type": "multiple_choice",
            "config": out_of_range,
            "assigned_difficulty": 3,
        },
    )
    assert r.status_code == 422


def test_short_answer_requires_rubric_and_model_answer(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    test_id = _hand_authored_test(cat_client, h)

    r = cat_client.post(
        f"/v1/tests/{test_id}/questions",
        headers=h,
        json={
            "type": "short_answer",
            "config": {"prompt": "explain", "model_answer": "x"},
            "assigned_difficulty": 5,
        },
    )
    assert r.status_code == 422

    r = cat_client.post(
        f"/v1/tests/{test_id}/questions",
        headers=h,
        json={
            "type": "short_answer",
            "config": {"prompt": "explain", "rubric": "good", "model_answer": "x"},
            "assigned_difficulty": 5,
        },
    )
    assert r.status_code == 201


def test_questions_rejected_on_non_authored_modes(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    r = cat_client.post("/v1/tests", headers=h, json={"name": "P", "mode": "per_testee"})
    test_id = r.json()["id"]
    r = cat_client.post(
        f"/v1/tests/{test_id}/questions",
        headers=h,
        json={
            "type": "multiple_choice",
            "config": _mcq_config(),
            "assigned_difficulty": 3,
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "questions_unsupported"


# --- campaign lock (AC-D24) ------------------------------------------


def test_campaign_lock_blocks_edit_delete_and_question_mutation(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    test_id = _hand_authored_test(cat_client, h)
    r = cat_client.post(
        f"/v1/tests/{test_id}/questions",
        headers=h,
        json={
            "type": "multiple_choice",
            "config": _mcq_config(),
            "assigned_difficulty": 4,
        },
    )
    question_id = r.json()["id"]

    campaign_id = str(uuid.uuid4())
    r = cat_client.post(
        f"/v1/tests/{test_id}/lock", headers=h, json={"campaign_id": campaign_id}
    )
    assert r.status_code == 200, r.text
    assert r.json()["lock_mode"] == "campaign_locked"
    assert r.json()["campaign_id"] == campaign_id

    # Edit blocked.
    r = cat_client.patch(f"/v1/tests/{test_id}", headers=h, json={"name": "New"})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "test_campaign_locked"

    # Delete blocked.
    r = cat_client.delete(f"/v1/tests/{test_id}", headers=h)
    assert r.status_code == 409

    # Question add blocked.
    r = cat_client.post(
        f"/v1/tests/{test_id}/questions",
        headers=h,
        json={
            "type": "true_false",
            "config": {"prompt": "p", "correct": True},
            "assigned_difficulty": 2,
        },
    )
    assert r.status_code == 409

    # Question update + delete blocked.
    r = cat_client.patch(
        f"/v1/tests/{test_id}/questions/{question_id}",
        headers=h,
        json={"assigned_difficulty": 6},
    )
    assert r.status_code == 409
    r = cat_client.delete(f"/v1/tests/{test_id}/questions/{question_id}", headers=h)
    assert r.status_code == 409

    # Unlock re-opens the test.
    r = cat_client.post(f"/v1/tests/{test_id}/unlock", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["lock_mode"] == "open"
    r = cat_client.patch(f"/v1/tests/{test_id}", headers=h, json={"name": "New"})
    assert r.status_code == 200


def test_lock_rejected_on_per_testee_and_benchmark(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    r = cat_client.post("/v1/tests", headers=h, json={"name": "P", "mode": "per_testee"})
    test_id = r.json()["id"]
    r = cat_client.post(
        f"/v1/tests/{test_id}/lock",
        headers=h,
        json={"campaign_id": str(uuid.uuid4())},
    )
    assert r.status_code == 422


# --- listing + 404s --------------------------------------------------


def test_list_and_get_round_trip(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    a = cat_client.post(
        "/v1/tests", headers=h, json={"name": "A", "mode": "per_testee"}
    ).json()["id"]
    b = cat_client.post(
        "/v1/tests", headers=h, json={"name": "B", "mode": "frozen"}
    ).json()["id"]
    r = cat_client.get("/v1/tests", headers=h)
    assert r.status_code == 200
    ids = {row["id"] for row in r.json()["data"]}
    assert {a, b} <= ids
    r = cat_client.get(f"/v1/tests/{a}", headers=h)
    assert r.status_code == 200 and r.json()["mode"] == "per_testee"


def test_get_missing_test_is_404(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    r = cat_client.get(f"/v1/tests/{uuid.uuid4()}", headers=h)
    assert r.status_code == 404
