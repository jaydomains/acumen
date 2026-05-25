"""Slice B B.2 — GET /v1/catalogue/pills/{pill_id} testee detail.

Mirrors the discovery list filter — non-discoverable, retired, and
missing pills all 404 (same opacity as ``GET /v1/catalogue/pills`` hides
them from the list)."""

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
    return bearer(cat_make_user(session, email="testee@kbc.com", role=p.ROLE_TESTEE))


def _seed_pill(
    client: TestClient,
    admin_h: dict[str, str],
    *,
    name: str = "Antifouling",
    discoverable: bool = True,
) -> str:
    sid = client.post("/v1/subjects", headers=admin_h, json={"name": "Subj"}).json()["id"]
    return client.post(
        "/v1/pills",
        headers=admin_h,
        json={
            "subject_id": sid,
            "name": name,
            "available_difficulty_min": 1,
            "available_difficulty_max": 10,
            "discoverable": discoverable,
        },
    ).json()["id"]


def test_happy_path_returns_pill_response(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin_h = _admin_headers(cat_session)
    testee_h = _testee_headers(cat_session)
    pid = _seed_pill(cat_client, admin_h)

    r = cat_client.get(f"/v1/catalogue/pills/{pid}", headers=testee_h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == pid
    assert body["name"] == "Antifouling"
    assert body["discoverable"] is True


def test_non_discoverable_pill_404(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin_h = _admin_headers(cat_session)
    testee_h = _testee_headers(cat_session)
    pid = _seed_pill(cat_client, admin_h, name="Hidden", discoverable=False)

    r = cat_client.get(f"/v1/catalogue/pills/{pid}", headers=testee_h)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_retired_pill_404(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin_h = _admin_headers(cat_session)
    testee_h = _testee_headers(cat_session)
    pid = _seed_pill(cat_client, admin_h, name="Retire me")
    cat_client.post(f"/v1/pills/{pid}/retire", headers=admin_h)

    r = cat_client.get(f"/v1/catalogue/pills/{pid}", headers=testee_h)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_unknown_pill_id_404(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    testee_h = _testee_headers(cat_session)
    r = cat_client.get(f"/v1/catalogue/pills/{uuid.uuid4()}", headers=testee_h)
    assert r.status_code == 404


def test_unauthenticated_401(cat_client: TestClient) -> None:
    r = cat_client.get(f"/v1/catalogue/pills/{uuid.uuid4()}")
    assert r.status_code == 401
