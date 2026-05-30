"""P3 Learning Paths + Groups — ordered membership, FK validation,
group membership, and AC-D15 system-group immutability.

Zero-DB / zero-network (AC-CD15)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import SEED_GROUP_ALL_TESTEES_ID, Group, GroupMember
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


def _pill(client: TestClient, h: dict[str, str], sid: str, name: str) -> str:
    return client.post(
        "/v1/pills",
        headers=h,
        json={
            "subject_id": sid,
            "name": name,
            "available_difficulty_min": 1,
            "available_difficulty_max": 5,
        },
    ).json()["id"]


def test_path_membership_is_ordered_and_replaceable(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin(cat_session)
    sid = cat_client.post("/v1/subjects", headers=h, json={"name": "S"}).json()["id"]
    a = _pill(cat_client, h, sid, "A")
    b = _pill(cat_client, h, sid, "B")
    c = _pill(cat_client, h, sid, "C")

    path_id = cat_client.post(
        "/v1/learning-paths", headers=h, json={"name": "P", "pill_ids": [a, b]}
    ).json()["id"]
    assert cat_client.get(f"/v1/learning-paths/{path_id}", headers=h).json()[
        "pill_ids"
    ] == [a, b]

    # Replace + reorder.
    r = cat_client.patch(
        f"/v1/learning-paths/{path_id}", headers=h, json={"pill_ids": [c, a]}
    )
    assert r.json()["pill_ids"] == [c, a]


def test_path_rejects_unknown_pill(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin(cat_session)
    r = cat_client.post(
        "/v1/learning-paths",
        headers=h,
        json={
            "name": "Bad",
            "pill_ids": ["00000000-0000-0000-0000-0000000000cc"],
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_pill"


def test_group_membership_add_and_remove(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin(cat_session)
    member = cat_make_user(cat_session, email="m@kbc.com", role=p.ROLE_TESTEE)
    gid = cat_client.post("/v1/groups", headers=h, json={"name": "G"}).json()["id"]

    r = cat_client.post(
        f"/v1/groups/{gid}/members", headers=h, json={"user_id": str(member.id)}
    )
    assert r.status_code == 201
    assert str(member.id) in r.json()["member_ids"]

    # Idempotent add.
    r = cat_client.post(
        f"/v1/groups/{gid}/members", headers=h, json={"user_id": str(member.id)}
    )
    assert r.json()["member_ids"].count(str(member.id)) == 1

    r = cat_client.delete(f"/v1/groups/{gid}/members/{member.id}", headers=h)
    assert r.status_code == 200
    assert str(member.id) not in r.json()["member_ids"]


def test_system_group_is_immutable(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin(cat_session)
    cat_session.add(
        Group(
            id=SEED_GROUP_ALL_TESTEES_ID,
            tenant_id=p.SEED_TENANT_ID,
            name="All Testees",
            is_system=True,
        )
    )
    gid = str(SEED_GROUP_ALL_TESTEES_ID)

    assert (
        cat_client.patch(
            f"/v1/groups/{gid}", headers=h, json={"name": "Renamed"}
        ).status_code
        == 403
    )
    assert cat_client.delete(f"/v1/groups/{gid}", headers=h).status_code == 403
    r = cat_client.post(
        f"/v1/groups/{gid}/members",
        headers=h,
        json={"user_id": "00000000-0000-0000-0000-0000000000ab"},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "system_group_immutable"


def test_group_not_found_is_404(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin(cat_session)
    r = cat_client.get("/v1/groups/00000000-0000-0000-0000-0000000000ba", headers=h)
    assert r.status_code == 404


# --- GET /v1/groups/{group_id}/members (N2) --------------------------


def test_group_members_lists_direct_members_paginated(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin(cat_session)
    gid = cat_client.post("/v1/groups", headers=h, json={"name": "G"}).json()["id"]
    members = [
        cat_make_user(cat_session, email=f"m{i}@kbc.com", role=p.ROLE_TESTEE)
        for i in range(3)
    ]
    for m in members:
        cat_client.post(
            f"/v1/groups/{gid}/members", headers=h, json={"user_id": str(m.id)}
        )

    first = cat_client.get(f"/v1/groups/{gid}/members?limit=2", headers=h)
    assert first.status_code == 200
    body = first.json()
    assert len(body["data"]) == 2
    assert body["meta"]["next_cursor"] is not None
    assert {row["id"] for row in body["data"]} <= {str(m.id) for m in members}

    second = cat_client.get(
        f"/v1/groups/{gid}/members?limit=2&cursor={body['meta']['next_cursor']}",
        headers=h,
    )
    assert second.status_code == 200
    rest = second.json()
    assert len(rest["data"]) == 1
    assert rest["meta"]["next_cursor"] is None

    seen = {row["id"] for row in body["data"]} | {row["id"] for row in rest["data"]}
    assert seen == {str(m.id) for m in members}


def test_group_members_resolves_system_group_membership(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    # System groups reject *mutation* but reads must still resolve their
    # stored membership (200, not 403).
    seed_system_settings(cat_session)
    h = _admin(cat_session)
    cat_session.add(
        Group(
            id=SEED_GROUP_ALL_TESTEES_ID,
            tenant_id=p.SEED_TENANT_ID,
            name="All Testees",
            is_system=True,
        )
    )
    member = cat_make_user(cat_session, email="sys@kbc.com", role=p.ROLE_TESTEE)
    cat_session.add(
        GroupMember(
            tenant_id=p.SEED_TENANT_ID,
            group_id=SEED_GROUP_ALL_TESTEES_ID,
            user_id=member.id,
        )
    )

    r = cat_client.get(f"/v1/groups/{SEED_GROUP_ALL_TESTEES_ID}/members", headers=h)
    assert r.status_code == 200
    assert [row["id"] for row in r.json()["data"]] == [str(member.id)]


def test_group_members_empty_group_returns_empty_page(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin(cat_session)
    gid = cat_client.post("/v1/groups", headers=h, json={"name": "Empty"}).json()["id"]
    r = cat_client.get(f"/v1/groups/{gid}/members", headers=h)
    assert r.status_code == 200
    assert r.json() == {"data": [], "meta": {"next_cursor": None, "count": 0}}


def test_group_members_unknown_group_is_404(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin(cat_session)
    r = cat_client.get(
        "/v1/groups/00000000-0000-0000-0000-0000000000ba/members", headers=h
    )
    assert r.status_code == 404


def test_group_members_requires_admin(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin_h = _admin(cat_session)
    gid = cat_client.post("/v1/groups", headers=admin_h, json={"name": "G"}).json()["id"]
    testee_h = bearer(
        cat_make_user(cat_session, email="testee@kbc.com", role=p.ROLE_TESTEE)
    )
    r = cat_client.get(f"/v1/groups/{gid}/members", headers=testee_h)
    assert r.status_code == 403
