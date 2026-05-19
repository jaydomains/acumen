"""P4 assignment CRUD — AC-D15 Testee/Group targeting with frozen
assignee snapshot, system-group rule resolution, scope/target
validation, Testee-own visibility, withdraw.

Zero-DB / zero-network (AC-CD15)."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import (
    SEED_GROUP_ALL_TESTEES_ID,
    AssignmentAssignee,
    Group,
    GroupMember,
    Pill,
    Subject,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
)


def _admin(session: CatalogueFakeSession) -> dict[str, str]:
    return bearer(
        cat_make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)
    )


def _pill(session: CatalogueFakeSession) -> uuid.UUID:
    subject = Subject(tenant_id=p.SEED_TENANT_ID, name="S", description=None)
    session.add(subject)
    pill = Pill(
        tenant_id=p.SEED_TENANT_ID,
        subject_id=subject.id,
        name="Pill",
        description=None,
        available_difficulty_min=1,
        available_difficulty_max=10,
        discoverable=True,
        safety_relevant=False,
        estimated_minutes=None,
    )
    session.add(pill)
    return pill.id


def test_target_individuals_snapshots_assignees(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    pid = _pill(cat_session)
    t1 = cat_make_user(cat_session, email="a@kbc.com", role=p.ROLE_TESTEE)
    t2 = cat_make_user(cat_session, email="b@kbc.com", role=p.ROLE_TESTEE)
    r = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={
            "pill_id": str(pid),
            "difficulty": 4,
            "is_mandatory": True,
            "testee_ids": [str(t1.id), str(t2.id)],
        },
    )
    assert r.status_code == 201, r.text
    assert set(r.json()["assignee_ids"]) == {str(t1.id), str(t2.id)}


def test_exactly_one_target_kind(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    t1 = cat_make_user(cat_session, email="a@kbc.com", role=p.ROLE_TESTEE)
    # neither pill nor path -> schema 422
    assert (
        cat_client.post(
            "/v1/assignments",
            headers=h,
            json={"difficulty": 2, "testee_ids": [str(t1.id)]},
        ).status_code
        == 422
    )


def test_invalid_pill_is_422(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    t1 = cat_make_user(cat_session, email="a@kbc.com", role=p.ROLE_TESTEE)
    r = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={
            "pill_id": "00000000-0000-0000-0000-0000000000ff",
            "difficulty": 2,
            "testee_ids": [str(t1.id)],
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_pill"


def test_ad_hoc_group_resolution_is_snapshotted(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    pid = _pill(cat_session)
    t1 = cat_make_user(cat_session, email="a@kbc.com", role=p.ROLE_TESTEE)
    t2 = cat_make_user(cat_session, email="b@kbc.com", role=p.ROLE_TESTEE)
    grp = Group(
        tenant_id=p.SEED_TENANT_ID,
        name="Crew",
        description=None,
        is_system=False,
        created_by=t1.id,
    )
    cat_session.add(grp)
    cat_session.add(
        GroupMember(tenant_id=p.SEED_TENANT_ID, group_id=grp.id, user_id=t1.id)
    )
    r = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={"pill_id": str(pid), "difficulty": 3, "group_ids": [str(grp.id)]},
    )
    aid = r.json()["id"]
    assert r.json()["assignee_ids"] == [str(t1.id)]
    # membership change AFTER creation must not rewrite history (AC-D15)
    cat_session.add(
        GroupMember(tenant_id=p.SEED_TENANT_ID, group_id=grp.id, user_id=t2.id)
    )
    again = cat_client.get(f"/v1/assignments/{aid}", headers=h)
    assert again.json()["assignee_ids"] == [str(t1.id)]


def test_individual_target_wins_over_group(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """A user targeted both individually and via a group in the same
    create call is snapshotted once with ``via_group_id`` null — the
    individual target wins (AC-D15 dedupe rule)."""
    h = _admin(cat_session)
    pid = _pill(cat_session)
    alice = cat_make_user(cat_session, email="alice@kbc.com", role=p.ROLE_TESTEE)
    bob = cat_make_user(cat_session, email="bob@kbc.com", role=p.ROLE_TESTEE)
    grp = Group(
        tenant_id=p.SEED_TENANT_ID,
        name="Crew",
        description=None,
        is_system=False,
        created_by=alice.id,
    )
    cat_session.add(grp)
    cat_session.add(
        GroupMember(tenant_id=p.SEED_TENANT_ID, group_id=grp.id, user_id=alice.id)
    )
    cat_session.add(
        GroupMember(tenant_id=p.SEED_TENANT_ID, group_id=grp.id, user_id=bob.id)
    )
    r = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={
            "pill_id": str(pid),
            "difficulty": 3,
            "testee_ids": [str(alice.id)],
            "group_ids": [str(grp.id)],
        },
    )
    aid = uuid.UUID(r.json()["id"])
    assert set(r.json()["assignee_ids"]) == {str(alice.id), str(bob.id)}
    rows = [
        a for a in cat_session.store.get(AssignmentAssignee, []) if a.assignment_id == aid
    ]
    # one row per user (the unique constraint shape), individual wins
    assert len(rows) == 2
    by_user = {a.user_id: a for a in rows}
    assert by_user[alice.id].via_group_id is None  # individual wins
    assert by_user[bob.id].via_group_id == grp.id  # group-only


def test_system_group_resolved_by_rule(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    pid = _pill(cat_session)
    t1 = cat_make_user(cat_session, email="a@kbc.com", role=p.ROLE_TESTEE)
    cat_make_user(cat_session, email="adm2@kbc.com", role=p.ROLE_ADMINISTRATOR)
    sys_group = Group(
        id=SEED_GROUP_ALL_TESTEES_ID,
        tenant_id=p.SEED_TENANT_ID,
        name="All Testees",
        description=None,
        is_system=True,
        created_by=t1.id,
    )
    cat_session.add(sys_group)
    r = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={
            "pill_id": str(pid),
            "difficulty": 2,
            "group_ids": [str(SEED_GROUP_ALL_TESTEES_ID)],
        },
    )
    assert r.status_code == 201
    assert r.json()["assignee_ids"] == [str(t1.id)]


def test_empty_group_yields_no_assignees(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    pid = _pill(cat_session)
    creator = cat_make_user(cat_session, email="c@kbc.com", role=p.ROLE_TESTEE)
    grp = Group(
        tenant_id=p.SEED_TENANT_ID,
        name="Empty",
        description=None,
        is_system=False,
        created_by=creator.id,
    )
    cat_session.add(grp)
    r = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={"pill_id": str(pid), "difficulty": 1, "group_ids": [str(grp.id)]},
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "no_assignees"


def test_testee_sees_only_own_assignments(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    pid = _pill(cat_session)
    mine = cat_make_user(cat_session, email="mine@kbc.com", role=p.ROLE_TESTEE)
    other = cat_make_user(cat_session, email="other@kbc.com", role=p.ROLE_TESTEE)
    r = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={"pill_id": str(pid), "difficulty": 2, "testee_ids": [str(mine.id)]},
    )
    aid = r.json()["id"]
    mine_list = cat_client.get("/v1/assignments", headers=bearer(mine))
    assert [a["id"] for a in mine_list.json()["data"]] == [aid]
    other_list = cat_client.get("/v1/assignments", headers=bearer(other))
    assert other_list.json()["data"] == []
    assert (
        cat_client.get(f"/v1/assignments/{aid}", headers=bearer(other)).status_code == 404
    )


def test_withdraw_is_admin_only(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    pid = _pill(cat_session)
    t1 = cat_make_user(cat_session, email="a@kbc.com", role=p.ROLE_TESTEE)
    aid = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={"pill_id": str(pid), "difficulty": 2, "testee_ids": [str(t1.id)]},
    ).json()["id"]
    assert (
        cat_client.delete(f"/v1/assignments/{aid}", headers=bearer(t1)).status_code == 403
    )
    assert cat_client.delete(f"/v1/assignments/{aid}", headers=h).status_code == 204
    assert cat_client.get(f"/v1/assignments/{aid}", headers=h).status_code == 404
