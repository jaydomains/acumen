"""Slice B B.5 — GET /v1/attempts (testee own-scope history).

Submitted-only, own-scope only, newest first. Joins the test's
canonical pill (B.3 ``Test.pill_id`` linkage) to surface pill_name +
pill_id on each row. In-flight attempts are excluded; other testees'
attempts are excluded.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import (
    Attempt,
    AttemptOrigin,
    Pill,
    Subject,
    Test,
    TestMode,
    TestStatus,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
    seed_system_settings,
)


def _seed_test_with_pill(
    session: CatalogueFakeSession, *, name: str = "Antifouling"
) -> tuple[Test, Pill]:
    subject = Subject(tenant_id=p.SEED_TENANT_ID, name="S")
    session.add(subject)
    pill = Pill(
        tenant_id=p.SEED_TENANT_ID,
        subject_id=subject.id,
        name=name,
        available_difficulty_min=1,
        available_difficulty_max=10,
        discoverable=True,
        safety_relevant=False,
    )
    session.add(pill)
    test = Test(
        tenant_id=p.SEED_TENANT_ID,
        name=f"{name} D5",
        mode=TestMode.hand_authored,
        status=TestStatus.published,
        pill_id=pill.id,
        target_difficulty=5,
    )
    session.add(test)
    return test, pill


def _seed_attempt(
    session: CatalogueFakeSession,
    *,
    testee_id,
    test_id,
    submitted_at: datetime | None,
    score: float | None,
    origin: AttemptOrigin = AttemptOrigin.self_initiated,
    sequence_number: int = 1,
) -> Attempt:
    attempt = Attempt(
        tenant_id=p.SEED_TENANT_ID,
        test_id=test_id,
        testee_id=testee_id,
        origin=origin,
        sequence_number=sequence_number,
        submitted_at=submitted_at,
        overall_score=score,
    )
    session.add(attempt)
    return attempt


def test_empty_for_testee_with_no_attempts(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    r = cat_client.get("/v1/attempts", headers=bearer(testee))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["data"] == []
    assert body["meta"]["next_cursor"] is None


def test_returns_submitted_only_newest_first(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    test, pill = _seed_test_with_pill(cat_session)

    now = datetime.now(UTC)
    older = _seed_attempt(
        cat_session,
        testee_id=testee.id,
        test_id=test.id,
        submitted_at=now - timedelta(days=2),
        score=0.6,
        sequence_number=1,
    )
    newer = _seed_attempt(
        cat_session,
        testee_id=testee.id,
        test_id=test.id,
        submitted_at=now - timedelta(hours=1),
        score=0.78,
        sequence_number=2,
    )
    # In-flight attempt (no submitted_at) → excluded
    _seed_attempt(
        cat_session,
        testee_id=testee.id,
        test_id=test.id,
        submitted_at=None,
        score=None,
        sequence_number=3,
    )

    r = cat_client.get("/v1/attempts", headers=bearer(testee))
    assert r.status_code == 200
    data = r.json()["data"]
    assert [item["attempt_id"] for item in data] == [str(newer.id), str(older.id)]
    assert data[0]["pill_id"] == str(pill.id)
    assert data[0]["pill_name"] == pill.name
    assert data[0]["score_percent"] == 78.0
    # 78 % → competence-axis 7.8 → "advanced" band (7.0 <= x < 8.5).
    assert data[0]["band"] == "advanced"
    assert data[0]["origin"] == "self_initiated"
    assert data[0]["competence_delta"] is None


def test_other_testees_attempts_excluded(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    me = cat_make_user(cat_session, email="me@kbc.com", role=p.ROLE_TESTEE)
    other = cat_make_user(cat_session, email="o@kbc.com", role=p.ROLE_TESTEE)
    test, _ = _seed_test_with_pill(cat_session)

    _seed_attempt(
        cat_session,
        testee_id=other.id,
        test_id=test.id,
        submitted_at=datetime.now(UTC),
        score=0.9,
    )

    r = cat_client.get("/v1/attempts", headers=bearer(me))
    assert r.status_code == 200
    assert r.json()["data"] == []


def test_pagination_cursor(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    test, _ = _seed_test_with_pill(cat_session)
    now = datetime.now(UTC)
    for i in range(3):
        _seed_attempt(
            cat_session,
            testee_id=testee.id,
            test_id=test.id,
            submitted_at=now - timedelta(minutes=i),
            score=0.5,
            sequence_number=i + 1,
        )

    first = cat_client.get(
        "/v1/attempts?limit=2", headers=bearer(testee)
    ).json()
    assert len(first["data"]) == 2
    cursor = first["meta"]["next_cursor"]
    assert cursor is not None

    second = cat_client.get(
        f"/v1/attempts?limit=2&cursor={cursor}", headers=bearer(testee)
    ).json()
    assert len(second["data"]) == 1
    assert second["meta"]["next_cursor"] is None


def test_attempt_on_test_without_pill_linkage_excluded(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)

    # Test with no pill linkage (legacy / pre-slice-B test)
    unlinked = Test(
        tenant_id=p.SEED_TENANT_ID,
        name="No pill",
        mode=TestMode.hand_authored,
        status=TestStatus.published,
        pill_id=None,
        target_difficulty=5,
    )
    cat_session.add(unlinked)
    _seed_attempt(
        cat_session,
        testee_id=testee.id,
        test_id=unlinked.id,
        submitted_at=datetime.now(UTC),
        score=0.5,
    )

    r = cat_client.get("/v1/attempts", headers=bearer(testee))
    assert r.status_code == 200
    assert r.json()["data"] == []


def test_unauthenticated_401(cat_client: TestClient) -> None:
    assert cat_client.get("/v1/attempts").status_code == 401


def test_limit_clamped_to_max(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    r = cat_client.get("/v1/attempts?limit=1000", headers=bearer(testee))
    assert r.status_code == 422  # Query ge/le enforced
