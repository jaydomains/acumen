"""P3 done-when (ROADMAP P3 — Catalogue).

One test per ROADMAP done-when criterion, named 1:1 so a future
session can trace coverage without spelunking:

  CRUD + safety auto-tag + discovery filter pass tests;
  proposal queue persists with stubbed AI.

Zero-DB / zero-network via the catalogue fake session + ``get_db``
override (P1/P2 precedent, AC-CD15). AC-D7 / AC-D8 / AC-D15 / AC-D21.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app import permissions as p
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
    seed_system_settings,
)


def _admin(session: CatalogueFakeSession):
    return cat_make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)


def test_done_when_crud_subjects_pills_paths_groups(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = bearer(_admin(cat_session))

    # Subject CRUD.
    r = cat_client.post(
        "/v1/subjects", headers=h, json={"name": "Electrical", "description": "x"}
    )
    assert r.status_code == 201, r.text
    sid = r.json()["id"]
    assert cat_client.get(f"/v1/subjects/{sid}", headers=h).status_code == 200
    r = cat_client.patch(
        f"/v1/subjects/{sid}", headers=h, json={"name": "Electrical Safety"}
    )
    assert r.json()["name"] == "Electrical Safety"

    # Pill CRUD.
    r = cat_client.post(
        "/v1/pills",
        headers=h,
        json={
            "subject_id": sid,
            "name": "Ohm's law",
            "description": "basics",
            "available_difficulty_min": 1,
            "available_difficulty_max": 5,
        },
    )
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    assert cat_client.get(f"/v1/pills/{pid}", headers=h).status_code == 200
    assert (
        cat_client.patch(
            f"/v1/pills/{pid}", headers=h, json={"estimated_minutes": 30}
        ).json()["estimated_minutes"]
        == 30
    )

    # Learning path CRUD with ordered membership.
    r = cat_client.post(
        "/v1/learning-paths",
        headers=h,
        json={"name": "Basics path", "pill_ids": [pid]},
    )
    assert r.status_code == 201, r.text
    path_id = r.json()["id"]
    assert r.json()["pill_ids"] == [pid]

    # Group CRUD.
    r = cat_client.post("/v1/groups", headers=h, json={"name": "Sparkies"})
    assert r.status_code == 201, r.text
    gid = r.json()["id"]
    assert r.json()["is_system"] is False

    # Lists return the envelope shape.
    listed = cat_client.get("/v1/pills", headers=h).json()
    assert "data" in listed and "meta" in listed

    # Deletes.
    assert (
        cat_client.delete(f"/v1/learning-paths/{path_id}", headers=h).status_code == 204
    )
    assert cat_client.delete(f"/v1/groups/{gid}", headers=h).status_code == 204
    assert cat_client.delete(f"/v1/pills/{pid}", headers=h).status_code == 204
    assert cat_client.delete(f"/v1/subjects/{sid}", headers=h).status_code == 204
    assert cat_client.get(f"/v1/subjects/{sid}", headers=h).status_code == 404


def test_done_when_safety_auto_tag_at_pill_creation(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = bearer(_admin(cat_session))
    sid = cat_client.post("/v1/subjects", headers=h, json={"name": "Trades"}).json()["id"]

    safety = cat_client.post(
        "/v1/pills",
        headers=h,
        json={
            "subject_id": sid,
            "name": "Working on scaffold",
            "description": "fall protection",
            "available_difficulty_min": 1,
            "available_difficulty_max": 3,
        },
    ).json()
    assert safety["safety_relevant"] is True
    assert safety["safety_relevant_overridden_at"] is None

    benign = cat_client.post(
        "/v1/pills",
        headers=h,
        json={
            "subject_id": sid,
            "name": "Spreadsheet formulas",
            "description": "pivot tables",
            "available_difficulty_min": 1,
            "available_difficulty_max": 3,
        },
    ).json()
    assert benign["safety_relevant"] is False


def test_done_when_discovery_filter_discoverable_non_retired(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    ha = bearer(admin)
    testee = cat_make_user(cat_session, email="tess@kbc.com", role=p.ROLE_TESTEE)
    ht = bearer(testee)
    sid = cat_client.post("/v1/subjects", headers=ha, json={"name": "S"}).json()["id"]

    def _pill(name: str, discoverable: bool) -> str:
        return cat_client.post(
            "/v1/pills",
            headers=ha,
            json={
                "subject_id": sid,
                "name": name,
                "available_difficulty_min": 1,
                "available_difficulty_max": 10,
                "discoverable": discoverable,
            },
        ).json()["id"]

    visible = _pill("Visible", True)
    _pill("Hidden", False)
    retired = _pill("Retired", True)
    cat_client.post(f"/v1/pills/{retired}/retire", headers=ha)

    body = cat_client.get("/v1/catalogue/pills", headers=ht)
    assert body.status_code == 200, body.text
    ids = {row["id"] for row in body.json()["data"]}
    assert ids == {visible}


def test_done_when_pill_proposal_queue_persists_ai_stubbed(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = bearer(_admin(cat_session))
    sid = cat_client.post("/v1/subjects", headers=h, json={"name": "S"}).json()["id"]

    r = cat_client.post(
        "/v1/pill-proposals",
        headers=h,
        json={
            "subject_id": sid,
            "name": "Proposed: confined space entry",
            "description": "stub",
            "available_difficulty_min": 2,
            "available_difficulty_max": 6,
        },
    )
    assert r.status_code == 201, r.text
    proposal_id = r.json()["id"]
    assert r.json()["status"] == "pending"

    listed = cat_client.get("/v1/pill-proposals", headers=h).json()["data"]
    assert any(row["id"] == proposal_id for row in listed)
    # AI self-classification persisted in the queued payload.
    assert listed[0]["payload"]["proposal"]["safety_relevant"] is True

    r = cat_client.post(f"/v1/pill-proposals/{proposal_id}/approve", headers=h)
    assert r.status_code == 201, r.text
    assert r.json()["safety_relevant"] is True

    # Already-resolved proposal cannot be approved twice.
    again = cat_client.post(f"/v1/pill-proposals/{proposal_id}/approve", headers=h)
    assert again.status_code == 409
