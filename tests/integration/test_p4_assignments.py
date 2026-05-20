"""P4 Slice 1 — Assignments router behaviour.

Admin-only create/withdraw; Testees see only assignments they were
snapshotted into (AC-D15). The assignee snapshot expands individual
``testee_ids`` and ``group_ids``: rule-derived seed-group membership
(All Users / All Testees / All Admins), ad-hoc group membership,
deactivated-user exclusion (AC-D16), individual+group dedupe with the
direct target keeping the NULL ``via_group_id``.

Zero-DB / zero-network via ``CatalogueFakeSession`` (AC-CD15).
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import (
    SEED_GROUP_ALL_ADMINS_ID,
    SEED_GROUP_ALL_TESTEES_ID,
    SEED_GROUP_ALL_USERS_ID,
    SEED_TENANT_ID,
    AssignmentAssignee,
    Group,
    GroupMember,
    LearningPath,
    Pill,
    Subject,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
    seed_system_settings,
)


def _admin(session: CatalogueFakeSession) -> tuple[uuid.UUID, dict[str, str]]:
    admin = cat_make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)
    return admin.id, bearer(admin)


def _seed_system_groups(session: CatalogueFakeSession) -> None:
    """Mirror the rows seeded by migration 0002."""
    for gid, name in [
        (SEED_GROUP_ALL_USERS_ID, "All Users"),
        (SEED_GROUP_ALL_TESTEES_ID, "All Testees"),
        (SEED_GROUP_ALL_ADMINS_ID, "All Administrators"),
    ]:
        g = Group(
            tenant_id=SEED_TENANT_ID,
            name=name,
            description=None,
            is_system=True,
        )
        g.id = gid
        session.add(g)


def _seed_pill(session: CatalogueFakeSession) -> uuid.UUID:
    subject = Subject(tenant_id=SEED_TENANT_ID, name="Paint QA", description=None)
    session.add(subject)
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=subject.id,
        name="Reference Panels",
        description=None,
        available_difficulty_min=1,
        available_difficulty_max=10,
        discoverable=True,
        safety_relevant=False,
    )
    session.add(pill)
    return pill.id


def _seed_path(session: CatalogueFakeSession, pill_id: uuid.UUID) -> uuid.UUID:
    path = LearningPath(tenant_id=SEED_TENANT_ID, name="Junior QA", description=None)
    session.add(path)
    return path.id


def _assignees(session: CatalogueFakeSession) -> list[AssignmentAssignee]:
    return list(session.store.get(AssignmentAssignee, []))


# --- admin gate ------------------------------------------------------


def test_admin_gate_blocks_testee_create(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    _seed_system_groups(cat_session)
    pill_id = _seed_pill(cat_session)
    h = bearer(cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE))
    r = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={
            "pill_id": str(pill_id),
            "difficulty": 4,
            "testee_ids": [str(uuid.uuid4())],
        },
    )
    assert r.status_code == 403


def test_unauthenticated_is_401(cat_client: TestClient) -> None:
    r = cat_client.post("/v1/assignments", json={})
    assert r.status_code == 401


# --- payload shape ---------------------------------------------------


def test_exactly_one_target_required(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    _, h = _admin(cat_session)
    r = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={"difficulty": 4, "testee_ids": [str(uuid.uuid4())]},
    )
    assert r.status_code == 422


def test_at_least_one_assignee_required(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    _, h = _admin(cat_session)
    pill_id = _seed_pill(cat_session)
    r = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={"pill_id": str(pill_id), "difficulty": 4},
    )
    assert r.status_code == 422


# --- assignee snapshot (AC-D15 v1.6) ---------------------------------


def test_individual_testee_snapshot_via_group_null(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    _, h = _admin(cat_session)
    pill_id = _seed_pill(cat_session)
    t1 = cat_make_user(cat_session, email="t1@kbc.com", role=p.ROLE_TESTEE)
    t2 = cat_make_user(cat_session, email="t2@kbc.com", role=p.ROLE_TESTEE)
    r = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={
            "pill_id": str(pill_id),
            "difficulty": 5,
            "testee_ids": [str(t1.id), str(t2.id)],
        },
    )
    assert r.status_code == 201, r.text
    rows = _assignees(cat_session)
    assert {row.user_id for row in rows} == {t1.id, t2.id}
    assert all(row.via_group_id is None for row in rows)


def test_all_testees_group_expands_to_active_testees(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    _seed_system_groups(cat_session)
    _, h = _admin(cat_session)
    pill_id = _seed_pill(cat_session)

    t1 = cat_make_user(cat_session, email="t1@kbc.com", role=p.ROLE_TESTEE)
    t2 = cat_make_user(cat_session, email="t2@kbc.com", role=p.ROLE_TESTEE)
    # An admin should NOT be drawn into All Testees.
    cat_make_user(cat_session, email="extra@kbc.com", role=p.ROLE_ADMINISTRATOR)

    r = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={
            "pill_id": str(pill_id),
            "difficulty": 5,
            "group_ids": [str(SEED_GROUP_ALL_TESTEES_ID)],
        },
    )
    assert r.status_code == 201, r.text
    rows = _assignees(cat_session)
    assert {row.user_id for row in rows} == {t1.id, t2.id}
    assert all(row.via_group_id == SEED_GROUP_ALL_TESTEES_ID for row in rows)


def test_deactivated_users_excluded_from_targeting(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    _seed_system_groups(cat_session)
    _, h = _admin(cat_session)
    pill_id = _seed_pill(cat_session)

    t1 = cat_make_user(cat_session, email="t1@kbc.com", role=p.ROLE_TESTEE)
    t_off = cat_make_user(cat_session, email="off@kbc.com", role=p.ROLE_TESTEE)
    from app.models import UserStatus

    t_off.status = UserStatus.deactivated

    # Direct target of a deactivated user drops out silently.
    r = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={
            "pill_id": str(pill_id),
            "difficulty": 4,
            "testee_ids": [str(t1.id), str(t_off.id)],
        },
    )
    assert r.status_code == 201, r.text
    rows = _assignees(cat_session)
    assert {row.user_id for row in rows} == {t1.id}

    # An assignment targeting ONLY deactivated users 422s.
    r = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={
            "pill_id": str(pill_id),
            "difficulty": 4,
            "testee_ids": [str(t_off.id)],
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "no_assignees"


def test_individual_plus_group_dedupes_direct_wins(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    _seed_system_groups(cat_session)
    _, h = _admin(cat_session)
    pill_id = _seed_pill(cat_session)
    t1 = cat_make_user(cat_session, email="t1@kbc.com", role=p.ROLE_TESTEE)
    cat_make_user(cat_session, email="t2@kbc.com", role=p.ROLE_TESTEE)

    r = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={
            "pill_id": str(pill_id),
            "difficulty": 4,
            "testee_ids": [str(t1.id)],
            "group_ids": [str(SEED_GROUP_ALL_TESTEES_ID)],
        },
    )
    assert r.status_code == 201, r.text
    rows = _assignees(cat_session)
    rows_for_t1 = [row for row in rows if row.user_id == t1.id]
    # Direct target wins: t1 has exactly one row with via_group_id = None.
    assert len(rows_for_t1) == 1
    assert rows_for_t1[0].via_group_id is None
    # t2 is present via the group.
    assert any(row.via_group_id == SEED_GROUP_ALL_TESTEES_ID for row in rows)


def test_adhoc_group_membership_resolved(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    _seed_system_groups(cat_session)
    _, h = _admin(cat_session)
    pill_id = _seed_pill(cat_session)
    t1 = cat_make_user(cat_session, email="t1@kbc.com", role=p.ROLE_TESTEE)
    t2 = cat_make_user(cat_session, email="t2@kbc.com", role=p.ROLE_TESTEE)
    # Ad-hoc group with only t1.
    g = Group(tenant_id=SEED_TENANT_ID, name="Site A", description=None, is_system=False)
    cat_session.add(g)
    cat_session.add(GroupMember(tenant_id=SEED_TENANT_ID, group_id=g.id, user_id=t1.id))

    r = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={
            "pill_id": str(pill_id),
            "difficulty": 4,
            "group_ids": [str(g.id)],
        },
    )
    assert r.status_code == 201, r.text
    rows = _assignees(cat_session)
    assert {row.user_id for row in rows} == {t1.id}
    assert all(row.via_group_id == g.id for row in rows)
    # t2 was not in the group.
    assert t2.id not in {row.user_id for row in rows}


def test_invalid_pill_or_path_returns_422(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    _, h = _admin(cat_session)
    cat_make_user(cat_session, email="t1@kbc.com", role=p.ROLE_TESTEE)
    r = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={
            "pill_id": str(uuid.uuid4()),
            "difficulty": 4,
            "testee_ids": [str(uuid.uuid4())],
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_pill"


def test_path_assignment_records_path_id(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    _, h = _admin(cat_session)
    pill_id = _seed_pill(cat_session)
    path_id = _seed_path(cat_session, pill_id)
    t1 = cat_make_user(cat_session, email="t1@kbc.com", role=p.ROLE_TESTEE)
    r = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={
            "learning_path_id": str(path_id),
            "difficulty": 4,
            "testee_ids": [str(t1.id)],
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["learning_path_id"] == str(path_id)
    assert body["pill_id"] is None


# --- read scope ------------------------------------------------------


def test_testee_sees_only_their_own_assignments(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    _, h = _admin(cat_session)
    pill_id = _seed_pill(cat_session)
    t1 = cat_make_user(cat_session, email="t1@kbc.com", role=p.ROLE_TESTEE)
    t2 = cat_make_user(cat_session, email="t2@kbc.com", role=p.ROLE_TESTEE)
    a1 = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={
            "pill_id": str(pill_id),
            "difficulty": 4,
            "testee_ids": [str(t1.id)],
        },
    ).json()["id"]
    a2 = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={
            "pill_id": str(pill_id),
            "difficulty": 4,
            "testee_ids": [str(t2.id)],
        },
    ).json()["id"]

    # t1 only sees a1.
    r = cat_client.get("/v1/assignments", headers=bearer(t1))
    assert r.status_code == 200
    ids = {row["id"] for row in r.json()["data"]}
    assert ids == {a1}

    # t1 cannot read a2 directly (returns 404 not 403).
    r = cat_client.get(f"/v1/assignments/{a2}", headers=bearer(t1))
    assert r.status_code == 404


def test_admin_sees_all_assignments(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin_id, h = _admin(cat_session)
    pill_id = _seed_pill(cat_session)
    t1 = cat_make_user(cat_session, email="t1@kbc.com", role=p.ROLE_TESTEE)
    a1 = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={
            "pill_id": str(pill_id),
            "difficulty": 4,
            "testee_ids": [str(t1.id)],
        },
    ).json()["id"]
    r = cat_client.get("/v1/assignments", headers=h)
    assert r.status_code == 200
    assert a1 in {row["id"] for row in r.json()["data"]}
    r = cat_client.get(f"/v1/assignments?assigner_id={admin_id}", headers=h)
    assert r.status_code == 200
    assert a1 in {row["id"] for row in r.json()["data"]}


# --- withdraw --------------------------------------------------------


def test_admin_can_withdraw_assignment(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    _, h = _admin(cat_session)
    pill_id = _seed_pill(cat_session)
    t1 = cat_make_user(cat_session, email="t1@kbc.com", role=p.ROLE_TESTEE)
    a = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={
            "pill_id": str(pill_id),
            "difficulty": 4,
            "testee_ids": [str(t1.id)],
        },
    ).json()["id"]
    r = cat_client.delete(f"/v1/assignments/{a}", headers=h)
    assert r.status_code == 204
    r = cat_client.get(f"/v1/assignments/{a}", headers=h)
    assert r.status_code == 404
    # Assignee join rows are removed too.
    assert _assignees(cat_session) == []


def test_withdraw_missing_is_404(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    _, h = _admin(cat_session)
    r = cat_client.delete(f"/v1/assignments/{uuid.uuid4()}", headers=h)
    assert r.status_code == 404
