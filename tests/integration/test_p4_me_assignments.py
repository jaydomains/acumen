"""N4 — ``GET /v1/me/assignments`` (testee-scoped assignment list).

The canonical ``/v1/me/*`` surface for a Testee's own assignments. It
returns every assignment the current user is a snapshotted assignee of,
whether they were targeted directly or resolved through a group at
creation — ``assignment_assignee`` deduplicates the two (AC-D15), so a
user targeted both ways still sees the assignment exactly once.

Auth is ``get_privacy_acked_user``: any authed, privacy-acked user reads
only their own assignments. Mirrors the testee branch of
``GET /v1/assignments`` on the ``/v1/me`` router.

Zero-DB / zero-network via ``CatalogueFakeSession`` (AC-CD15).
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import (
    SEED_GROUP_ALL_TESTEES_ID,
    SEED_TENANT_ID,
    Group,
    GroupMember,
    Pill,
    Subject,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
    seed_system_settings,
)


def _admin(session: CatalogueFakeSession) -> dict[str, str]:
    admin = cat_make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)
    return bearer(admin)


def _seed_system_groups(session: CatalogueFakeSession) -> None:
    """Mirror the rows seeded by migration 0002 (only the All-Testees seed
    group is exercised here)."""
    g = Group(
        tenant_id=SEED_TENANT_ID,
        name="All Testees",
        description=None,
        is_system=True,
    )
    g.id = SEED_GROUP_ALL_TESTEES_ID
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


def _create_assignment(
    client: TestClient, admin_headers: dict[str, str], **body: object
) -> str:
    r = client.post("/v1/assignments", headers=admin_headers, json=body)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _list_ids(client: TestClient, headers: dict[str, str]) -> set[str]:
    r = client.get("/v1/me/assignments", headers=headers)
    assert r.status_code == 200, r.text
    return {row["id"] for row in r.json()["data"]}


# --- direct assignee -------------------------------------------------


def test_direct_assignee_sees_own_assignment(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin(cat_session)
    pill_id = _seed_pill(cat_session)
    t1 = cat_make_user(cat_session, email="t1@kbc.com", role=p.ROLE_TESTEE)

    aid = _create_assignment(
        cat_client, h, pill_id=str(pill_id), difficulty=4, testee_ids=[str(t1.id)]
    )

    assert _list_ids(cat_client, bearer(t1)) == {aid}


# --- group membership ------------------------------------------------


def test_system_group_member_sees_assignment(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    _seed_system_groups(cat_session)
    h = _admin(cat_session)
    pill_id = _seed_pill(cat_session)
    t1 = cat_make_user(cat_session, email="t1@kbc.com", role=p.ROLE_TESTEE)

    aid = _create_assignment(
        cat_client,
        h,
        pill_id=str(pill_id),
        difficulty=5,
        group_ids=[str(SEED_GROUP_ALL_TESTEES_ID)],
    )

    # t1 is an active Testee, so the All-Testees rule resolves them in.
    assert _list_ids(cat_client, bearer(t1)) == {aid}


def test_adhoc_group_member_sees_assignment(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin(cat_session)
    pill_id = _seed_pill(cat_session)
    t1 = cat_make_user(cat_session, email="t1@kbc.com", role=p.ROLE_TESTEE)
    t2 = cat_make_user(cat_session, email="t2@kbc.com", role=p.ROLE_TESTEE)
    g = Group(tenant_id=SEED_TENANT_ID, name="Site A", description=None, is_system=False)
    cat_session.add(g)
    cat_session.add(GroupMember(tenant_id=SEED_TENANT_ID, group_id=g.id, user_id=t1.id))

    aid = _create_assignment(
        cat_client, h, pill_id=str(pill_id), difficulty=4, group_ids=[str(g.id)]
    )

    # t1 is in the ad-hoc group; t2 is not.
    assert _list_ids(cat_client, bearer(t1)) == {aid}
    assert _list_ids(cat_client, bearer(t2)) == set()


# --- dedup -----------------------------------------------------------


def test_direct_plus_group_target_appears_once(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    _seed_system_groups(cat_session)
    h = _admin(cat_session)
    pill_id = _seed_pill(cat_session)
    t1 = cat_make_user(cat_session, email="t1@kbc.com", role=p.ROLE_TESTEE)

    aid = _create_assignment(
        cat_client,
        h,
        pill_id=str(pill_id),
        difficulty=4,
        testee_ids=[str(t1.id)],
        group_ids=[str(SEED_GROUP_ALL_TESTEES_ID)],
    )

    r = cat_client.get("/v1/me/assignments", headers=bearer(t1))
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    # Targeted both directly and via the group — the assignment still
    # surfaces exactly once (assignment_assignee dedupe, AC-D15).
    assert [row["id"] for row in data] == [aid]
    # The single assignee row for t1 means t1 is listed once in the
    # snapshotted assignee_ids on that assignment.
    assert data[0]["assignee_ids"].count(str(t1.id)) == 1


# --- scope isolation -------------------------------------------------


def test_testee_does_not_see_other_testees_assignment(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin(cat_session)
    pill_id = _seed_pill(cat_session)
    t1 = cat_make_user(cat_session, email="t1@kbc.com", role=p.ROLE_TESTEE)
    t2 = cat_make_user(cat_session, email="t2@kbc.com", role=p.ROLE_TESTEE)

    a1 = _create_assignment(
        cat_client, h, pill_id=str(pill_id), difficulty=4, testee_ids=[str(t1.id)]
    )
    a2 = _create_assignment(
        cat_client, h, pill_id=str(pill_id), difficulty=4, testee_ids=[str(t2.id)]
    )

    assert _list_ids(cat_client, bearer(t1)) == {a1}
    assert _list_ids(cat_client, bearer(t2)) == {a2}


# --- empty + auth ----------------------------------------------------


def test_fresh_testee_sees_empty_list(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    _admin(cat_session)
    t1 = cat_make_user(cat_session, email="t1@kbc.com", role=p.ROLE_TESTEE)

    r = cat_client.get("/v1/me/assignments", headers=bearer(t1))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["data"] == []
    assert body["meta"]["next_cursor"] is None


def test_unauthenticated_request_rejected(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    r = cat_client.get("/v1/me/assignments")
    assert r.status_code == 401
