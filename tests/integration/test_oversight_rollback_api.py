"""E2 — admin oversight rollback API (AC-CD26 rollback half).

Thin router (AC-CD2) over ``app.domain.oversight`` rollback fns: every write is
admin-role-gated (AC-CD5) and commits explicitly. Asserts Testee→403 on all five
write endpoints + happy-path for pill rollback + safety override.

Zero-network (AC-CD15).
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    Pill,
    Subject,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
)


def _admin(session: CatalogueFakeSession) -> AppUser:
    return cat_make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)


def _testee(session: CatalogueFakeSession) -> AppUser:
    return cat_make_user(session, email="t@kbc.com", role=p.ROLE_TESTEE)


def _pill(session: CatalogueFakeSession) -> Pill:
    subj = Subject(tenant_id=SEED_TENANT_ID, name="Welding")
    session.add(subj)
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=subj.id,
        name="Arc",
        available_difficulty_min=1,
        available_difficulty_max=10,
    )
    session.add(pill)
    return pill


def test_all_rollback_writes_require_admin(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    testee = _testee(cat_session)
    h = bearer(testee)
    pid = str(uuid.uuid4())
    qid = str(uuid.uuid4())
    cases = [
        ("post", f"/v1/admin/oversight/publishes/{pid}/rollback", {}),
        ("post", f"/v1/admin/oversight/questions/{qid}/rollback", {}),
        ("post", "/v1/admin/oversight/batches/batch-1/rollback", {}),
        ("post", "/v1/admin/oversight/sources/rollback", {"source_host": "osha.gov"}),
        ("post", f"/v1/admin/oversight/publishes/{pid}/safety-override", {"value": True}),
    ]
    for _method, path, body in cases:
        r = cat_client.post(path, headers=h, json=body)
        assert r.status_code == 403, path


def test_rollback_pill_happy_path(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    admin = _admin(cat_session)
    pill = _pill(cat_session)

    r = cat_client.post(
        f"/v1/admin/oversight/publishes/{pill.id}/rollback",
        headers=bearer(admin),
        json={"reason": "discredited"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["retired"] is True and body["newly_retired"] is True
    assert pill.retired_at is not None


def test_rollback_pill_404(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    admin = _admin(cat_session)
    r = cat_client.post(
        f"/v1/admin/oversight/publishes/{uuid.uuid4()}/rollback",
        headers=bearer(admin),
        json={},
    )
    assert r.status_code == 404


def test_safety_override_happy_path(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    admin = _admin(cat_session)
    pill = _pill(cat_session)

    r = cat_client.post(
        f"/v1/admin/oversight/publishes/{pill.id}/safety-override",
        headers=bearer(admin),
        json={"value": True},
    )
    assert r.status_code == 200
    assert r.json()["safety_relevant"] is True
    assert pill.safety_relevant is True
    assert pill.safety_relevant_overridden_at is not None
