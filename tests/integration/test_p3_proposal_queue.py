"""P3 AI pill-proposal queue — reject path, terminal-state guards,
missing-proposal 404. AI stubbed; zero-DB / zero-network (AC-CD15)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app import permissions as p
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
    seed_system_settings,
)


def _admin(cat_session: CatalogueFakeSession) -> dict[str, str]:
    return bearer(
        cat_make_user(cat_session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)
    )


def _propose(client: TestClient, h: dict[str, str], sid: str) -> str:
    return client.post(
        "/v1/pill-proposals",
        headers=h,
        json={
            "subject_id": sid,
            "name": "Adjacent topic",
            "description": "stub",
            "available_difficulty_min": 1,
            "available_difficulty_max": 4,
        },
    ).json()["id"]


def test_reject_marks_resolved_and_blocks_reapproval(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin(cat_session)
    sid = cat_client.post("/v1/subjects", headers=h, json={"name": "S"}).json()["id"]
    pid = _propose(cat_client, h, sid)

    r = cat_client.post(
        f"/v1/pill-proposals/{pid}/reject",
        headers=h,
        params={"reason": "duplicate of existing pill"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "done"
    assert r.json()["payload"]["decision"] == "rejected"
    assert r.json()["payload"]["reason"] == "duplicate of existing pill"

    # Terminal — cannot approve or reject again.
    assert (
        cat_client.post(f"/v1/pill-proposals/{pid}/approve", headers=h).status_code == 409
    )
    assert (
        cat_client.post(f"/v1/pill-proposals/{pid}/reject", headers=h).status_code == 409
    )


def test_missing_proposal_is_404(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin(cat_session)
    r = cat_client.post(
        "/v1/pill-proposals/00000000-0000-0000-0000-0000000000ee/approve",
        headers=h,
    )
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"


def test_proposal_queue_requires_admin(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    r = cat_client.get("/v1/pill-proposals", headers=bearer(testee))
    assert r.status_code == 403
