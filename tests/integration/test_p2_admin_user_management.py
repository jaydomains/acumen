"""Admin user-management surface: list / read / update / deactivate /
reactivate (AC-D2 / AC-D16). Closes the pre-frontend API-surface gap
beyond ``POST /v1/users``.

Zero-DB / zero-network via the fake session + dependency override in
``conftest.py`` (AC-CD15). Plays alongside ``test_p2_auth_flows.py`` —
that file owns the original done-when coverage, this file owns the
admin user-management additions.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.models import AuditLog, UserStatus
from tests.integration.conftest import FakeSession, bearer, make_user


def _admin(session: FakeSession) -> object:
    return make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)


def _audit_actions(session: FakeSession) -> list[str]:
    return [row.action for row in session.store.get(AuditLog, [])]


# --- list -------------------------------------------------------------


def test_list_users_filters_by_role_and_status(
    client: TestClient, session: FakeSession
) -> None:
    admin = _admin(session)
    make_user(session, email="t1@kbc.com", role=p.ROLE_TESTEE)
    make_user(session, email="t2@kbc.com", role=p.ROLE_TESTEE)
    make_user(session, email="t3@kbc.com", role=p.ROLE_TESTEE)
    make_user(session, email="gone@kbc.com", role=p.ROLE_TESTEE, deactivated=True)

    # Default: all 5 (1 admin + 4 testees, one deactivated).
    r = client.get("/v1/users", headers=bearer(admin))
    assert r.status_code == 200, r.text
    body = r.json()
    assert {row["email"] for row in body["data"]} == {
        "admin@kbc.com",
        "t1@kbc.com",
        "t2@kbc.com",
        "t3@kbc.com",
        "gone@kbc.com",
    }
    assert body["meta"]["next_cursor"] is None

    # Filter by role.
    r = client.get("/v1/users?role=testee", headers=bearer(admin))
    assert r.status_code == 200
    assert {row["email"] for row in r.json()["data"]} == {
        "t1@kbc.com",
        "t2@kbc.com",
        "t3@kbc.com",
        "gone@kbc.com",
    }

    # Filter by status.
    r = client.get("/v1/users?status=deactivated", headers=bearer(admin))
    assert r.status_code == 200
    assert [row["email"] for row in r.json()["data"]] == ["gone@kbc.com"]

    # Combined filters.
    r = client.get("/v1/users?role=administrator&status=active", headers=bearer(admin))
    assert r.status_code == 200
    assert [row["email"] for row in r.json()["data"]] == ["admin@kbc.com"]


def test_list_users_paginates_with_cursor(
    client: TestClient, session: FakeSession
) -> None:
    admin = _admin(session)
    for i in range(4):
        make_user(session, email=f"t{i}@kbc.com", role=p.ROLE_TESTEE)

    r = client.get("/v1/users?limit=2", headers=bearer(admin))
    assert r.status_code == 200
    first = r.json()
    assert len(first["data"]) == 2
    assert first["meta"]["next_cursor"] is not None

    r = client.get(
        f"/v1/users?limit=2&cursor={first['meta']['next_cursor']}",
        headers=bearer(admin),
    )
    assert r.status_code == 200
    second = r.json()
    assert len(second["data"]) == 2
    seen_ids = {row["id"] for row in first["data"]} | {
        row["id"] for row in second["data"]
    }
    assert len(seen_ids) == 4  # five users total, two pages of two...
    # ...plus admin lands on a third page; the 4 paginated rows are all
    # distinct from each other.


def test_list_users_rejects_unknown_role(
    client: TestClient, session: FakeSession
) -> None:
    admin = _admin(session)
    r = client.get("/v1/users?role=owner", headers=bearer(admin))
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_role"


# --- read -------------------------------------------------------------


def test_get_user_by_id(client: TestClient, session: FakeSession) -> None:
    admin = _admin(session)
    target = make_user(session, email="who@kbc.com", role=p.ROLE_TESTEE)

    r = client.get(f"/v1/users/{target.id}", headers=bearer(admin))
    assert r.status_code == 200, r.text
    assert r.json()["email"] == "who@kbc.com"


def test_get_user_404_when_missing(client: TestClient, session: FakeSession) -> None:
    admin = _admin(session)
    r = client.get(f"/v1/users/{uuid.uuid4()}", headers=bearer(admin))
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "user_not_found"


# --- update -----------------------------------------------------------


def test_update_user_changes_name_and_role(
    client: TestClient, session: FakeSession
) -> None:
    admin = _admin(session)
    target = make_user(session, email="who@kbc.com", role=p.ROLE_TESTEE)

    # Name only.
    r = client.patch(
        f"/v1/users/{target.id}",
        headers=bearer(admin),
        json={"name": "New Name"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "New Name"
    assert body["role"] == "testee"

    # Role only.
    r = client.patch(
        f"/v1/users/{target.id}",
        headers=bearer(admin),
        json={"role": "administrator"},
    )
    assert r.status_code == 200
    assert r.json()["role"] == "administrator"

    # Both.
    r = client.patch(
        f"/v1/users/{target.id}",
        headers=bearer(admin),
        json={"name": "Final", "role": "testee"},
    )
    assert r.status_code == 200
    final = r.json()
    assert final["name"] == "Final"
    assert final["role"] == "testee"

    actions = _audit_actions(session)
    assert actions.count("user.update") == 3


def test_update_user_no_op_does_not_audit(
    client: TestClient, session: FakeSession
) -> None:
    admin = _admin(session)
    target = make_user(session, email="who@kbc.com", role=p.ROLE_TESTEE)
    target.name = "Same"

    r = client.patch(
        f"/v1/users/{target.id}",
        headers=bearer(admin),
        json={"name": "Same"},
    )
    assert r.status_code == 200
    assert _audit_actions(session) == []


def test_update_user_forbids_email_change(
    client: TestClient, session: FakeSession
) -> None:
    admin = _admin(session)
    target = make_user(session, email="who@kbc.com", role=p.ROLE_TESTEE)

    r = client.patch(
        f"/v1/users/{target.id}",
        headers=bearer(admin),
        json={"email": "other@kbc.com"},
    )
    # Pydantic ``extra='forbid'`` on UserUpdate -> 422.
    assert r.status_code == 422


def test_update_user_rejects_unknown_role(
    client: TestClient, session: FakeSession
) -> None:
    admin = _admin(session)
    target = make_user(session, email="who@kbc.com", role=p.ROLE_TESTEE)

    r = client.patch(
        f"/v1/users/{target.id}",
        headers=bearer(admin),
        json={"role": "owner"},
    )
    assert r.status_code == 422


def test_update_user_404_when_missing(client: TestClient, session: FakeSession) -> None:
    admin = _admin(session)
    r = client.patch(
        f"/v1/users/{uuid.uuid4()}",
        headers=bearer(admin),
        json={"name": "X"},
    )
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "user_not_found"


# --- self-role-change guard ------------------------------------------


def test_self_role_change_to_non_admin_blocked(
    client: TestClient, session: FakeSession
) -> None:
    admin = _admin(session)

    r = client.patch(
        f"/v1/users/{admin.id}",
        headers=bearer(admin),
        json={"role": "testee"},
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "self_role_change_blocked"
    # No state change; no audit row.
    assert admin.role == p.ROLE_ADMINISTRATOR
    assert _audit_actions(session) == []


def test_admin_can_patch_own_name(client: TestClient, session: FakeSession) -> None:
    admin = _admin(session)

    r = client.patch(
        f"/v1/users/{admin.id}",
        headers=bearer(admin),
        json={"name": "Renamed Admin"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Renamed Admin"


def test_admin_can_re_set_own_role_to_admin(
    client: TestClient, session: FakeSession
) -> None:
    # Idempotent self-PATCH with role=administrator passes the guard
    # (role != ROLE_ADMINISTRATOR is the trigger). Confirms the guard
    # is scoped to demotion, not any self-PATCH of role.
    admin = _admin(session)

    r = client.patch(
        f"/v1/users/{admin.id}",
        headers=bearer(admin),
        json={"role": "administrator"},
    )
    assert r.status_code == 200


# --- deactivate / reactivate -----------------------------------------


def test_deactivate_sets_status(client: TestClient, session: FakeSession) -> None:
    admin = _admin(session)
    target = make_user(
        session, email="leaving@kbc.com", role=p.ROLE_TESTEE, password="Pass12345"
    )

    r = client.post(f"/v1/users/{target.id}/deactivate", headers=bearer(admin))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "deactivated"
    assert target.status == UserStatus.deactivated
    assert target.status_changed_at is not None
    assert _audit_actions(session).count("user.deactivate") == 1


def test_deactivate_blocks_login_regression(
    client: TestClient, session: FakeSession
) -> None:
    # P2 regression: ``test_deactivated_user_login_rejected`` covers the
    # gate against a pre-deactivated fixture. This verifies the new
    # deactivate endpoint also produces that state.
    admin = _admin(session)
    target = make_user(
        session, email="leaving@kbc.com", role=p.ROLE_TESTEE, password="Pass12345"
    )

    assert (
        client.post(
            f"/v1/users/{target.id}/deactivate", headers=bearer(admin)
        ).status_code
        == 200
    )

    r = client.post(
        "/v1/auth/login",
        json={"email": "leaving@kbc.com", "password": "Pass12345"},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "account_deactivated"


def test_deactivate_is_idempotent(client: TestClient, session: FakeSession) -> None:
    admin = _admin(session)
    target = make_user(
        session, email="gone@kbc.com", role=p.ROLE_TESTEE, deactivated=True
    )

    r = client.post(f"/v1/users/{target.id}/deactivate", headers=bearer(admin))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "deactivated"
    # No audit row written on the idempotent no-op transition.
    assert _audit_actions(session) == []


def test_self_deactivation_blocked(client: TestClient, session: FakeSession) -> None:
    admin = _admin(session)

    r = client.post(f"/v1/users/{admin.id}/deactivate", headers=bearer(admin))
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "self_deactivation_blocked"
    assert admin.status == UserStatus.active


def test_deactivate_404_when_missing(client: TestClient, session: FakeSession) -> None:
    admin = _admin(session)
    r = client.post(f"/v1/users/{uuid.uuid4()}/deactivate", headers=bearer(admin))
    assert r.status_code == 404


def test_reactivate_restores_login(client: TestClient, session: FakeSession) -> None:
    admin = _admin(session)
    target = make_user(
        session,
        email="back@kbc.com",
        role=p.ROLE_TESTEE,
        password="Pass12345",
        deactivated=True,
    )

    # Reactivate -> login works.
    r = client.post(f"/v1/users/{target.id}/reactivate", headers=bearer(admin))
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "active"
    assert target.status_changed_at is not None
    assert _audit_actions(session).count("user.reactivate") == 1

    r = client.post(
        "/v1/auth/login",
        json={"email": "back@kbc.com", "password": "Pass12345"},
    )
    assert r.status_code == 200


def test_reactivate_is_idempotent(client: TestClient, session: FakeSession) -> None:
    admin = _admin(session)
    target = make_user(session, email="here@kbc.com", role=p.ROLE_TESTEE)

    r = client.post(f"/v1/users/{target.id}/reactivate", headers=bearer(admin))
    assert r.status_code == 200
    assert _audit_actions(session) == []


# --- admin-only enforcement -------------------------------------------


@pytest.mark.parametrize(
    ("method", "path_tmpl"),
    [
        ("get", "/v1/users"),
        ("get", "/v1/users/{uid}"),
        ("patch", "/v1/users/{uid}"),
        ("post", "/v1/users/{uid}/deactivate"),
        ("post", "/v1/users/{uid}/reactivate"),
    ],
)
def test_testee_blocked_by_role_gate(
    client: TestClient,
    session: FakeSession,
    method: str,
    path_tmpl: str,
) -> None:
    testee = make_user(session, email="t@kbc.com", role=p.ROLE_TESTEE)
    target = make_user(session, email="x@kbc.com", role=p.ROLE_TESTEE)
    path = path_tmpl.format(uid=target.id)

    call = getattr(client, method)
    kwargs: dict[str, object] = {"headers": bearer(testee)}
    if method == "patch":
        kwargs["json"] = {"name": "Y"}
    r = call(path, **kwargs)
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "forbidden"


@pytest.mark.parametrize(
    ("method", "path_tmpl"),
    [
        ("get", "/v1/users"),
        ("get", "/v1/users/{uid}"),
        ("patch", "/v1/users/{uid}"),
        ("post", "/v1/users/{uid}/deactivate"),
        ("post", "/v1/users/{uid}/reactivate"),
    ],
)
def test_unauthenticated_blocked(client: TestClient, method: str, path_tmpl: str) -> None:
    path = path_tmpl.format(uid=uuid.uuid4())
    call = getattr(client, method)
    kwargs: dict[str, object] = {}
    if method == "patch":
        kwargs["json"] = {"name": "Y"}
    r = call(path, **kwargs)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "not_authenticated"
