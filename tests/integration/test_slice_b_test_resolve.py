"""Slice B B.3 — GET /v1/tests/resolve?pill_id&difficulty.

Find-only single-pill resolver for the FE-3 "Practice at D{n}" CTA.
Newest published match wins; 404 when nothing matches the (pill,
difficulty) tuple. On-demand generation (find-or-generate) is filed as
a follow-up upgrade.
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
        "prompt": "Pick the safety pill",
        "options": ["Reference", "Confined Space"],
        "correct": 1,
    }


def _seed_pill(client: TestClient, admin_h: dict[str, str], name: str) -> str:
    sid = client.post(
        "/v1/subjects", headers=admin_h, json={"name": "S"}
    ).json()["id"]
    return client.post(
        "/v1/pills",
        headers=admin_h,
        json={
            "subject_id": sid,
            "name": name,
            "available_difficulty_min": 1,
            "available_difficulty_max": 10,
        },
    ).json()["id"]


def _publish_test(
    client: TestClient,
    admin_h: dict[str, str],
    *,
    pill_id: str,
    difficulty: int,
    name: str = "Practice T",
) -> str:
    test_id = client.post(
        "/v1/tests",
        headers=admin_h,
        json={
            "name": name,
            "mode": "hand_authored",
            "target_difficulty": difficulty,
            "pill_id": pill_id,
        },
    ).json()["id"]
    client.post(
        f"/v1/tests/{test_id}/questions",
        headers=admin_h,
        json={
            "type": "multiple_choice",
            "config": _mcq_config(),
            "assigned_difficulty": difficulty,
        },
    )
    r = client.post(f"/v1/tests/{test_id}/publish", headers=admin_h)
    assert r.status_code == 200, r.text
    return test_id


def test_happy_path_returns_matching_test(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin_h = _admin_headers(cat_session)
    testee_h = _testee_headers(cat_session)
    pid = _seed_pill(cat_client, admin_h, "Antifouling")
    test_id = _publish_test(cat_client, admin_h, pill_id=pid, difficulty=5)

    r = cat_client.get(
        f"/v1/tests/resolve?pill_id={pid}&difficulty=5", headers=testee_h
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"test_id": test_id}


def test_404_when_no_test_for_pill(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin_h = _admin_headers(cat_session)
    testee_h = _testee_headers(cat_session)
    _seed_pill(cat_client, admin_h, "A")  # exists but no test references it
    other_pid = uuid.uuid4()

    r = cat_client.get(
        f"/v1/tests/resolve?pill_id={other_pid}&difficulty=5", headers=testee_h
    )
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_404_when_difficulty_mismatches(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin_h = _admin_headers(cat_session)
    testee_h = _testee_headers(cat_session)
    pid = _seed_pill(cat_client, admin_h, "Antifouling")
    _publish_test(cat_client, admin_h, pill_id=pid, difficulty=5)

    r = cat_client.get(
        f"/v1/tests/resolve?pill_id={pid}&difficulty=7", headers=testee_h
    )
    assert r.status_code == 404


def test_unpublished_test_does_not_match(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin_h = _admin_headers(cat_session)
    testee_h = _testee_headers(cat_session)
    pid = _seed_pill(cat_client, admin_h, "Antifouling")
    cat_client.post(
        "/v1/tests",
        headers=admin_h,
        json={
            "name": "Draft only",
            "mode": "hand_authored",
            "target_difficulty": 5,
            "pill_id": pid,
        },
    )

    r = cat_client.get(
        f"/v1/tests/resolve?pill_id={pid}&difficulty=5", headers=testee_h
    )
    assert r.status_code == 404


def test_unauthenticated_401(cat_client: TestClient) -> None:
    pid = uuid.uuid4()
    r = cat_client.get(f"/v1/tests/resolve?pill_id={pid}&difficulty=5")
    assert r.status_code == 401


def test_invalid_difficulty_422(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    testee_h = _testee_headers(cat_session)
    pid = uuid.uuid4()
    # difficulty 0 fails the ge=1 query constraint
    r = cat_client.get(
        f"/v1/tests/resolve?pill_id={pid}&difficulty=0", headers=testee_h
    )
    assert r.status_code == 422


def test_missing_query_params_422(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    testee_h = _testee_headers(cat_session)
    r = cat_client.get("/v1/tests/resolve", headers=testee_h)
    assert r.status_code == 422
