"""Slice B B.4 — GET /v1/me/competence (testee constellation feed).

One row per ``CompetencyProfile`` for the caller, with band derived from
``competence_estimate``. Rows where ``competence_estimate IS NULL`` are
filtered (FE-7 LOCK-2 — spec body §B.1 §7 declares the float
non-nullable; pills with no signal yet are excluded server-side).

``n`` is derived from the testee's submitted-attempt rows joined to
``Test.pill_id`` (FE-7 LOCK-3 expanded — ``CompetencyProfile.retake_count``
is structurally dead in v1 production code). ``confidence`` resolves
against ``system_settings.anchor_calibration_confidence_threshold``
(default 20): n >= threshold → confident, else preliminary.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import (
    Attempt,
    AttemptOrigin,
    CompetencyProfile,
    Pill,
    PillRelated,
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


def _seed_subject_and_pill(
    session: CatalogueFakeSession,
    *,
    pill_name: str,
    safety_relevant: bool = False,
) -> tuple[Pill, Subject]:
    subject = Subject(tenant_id=p.SEED_TENANT_ID, name="Coatings")
    session.add(subject)
    pill = Pill(
        tenant_id=p.SEED_TENANT_ID,
        subject_id=subject.id,
        name=pill_name,
        available_difficulty_min=1,
        available_difficulty_max=10,
        discoverable=True,
        safety_relevant=safety_relevant,
    )
    session.add(pill)
    return pill, subject


def _seed_test_for_pill(
    session: CatalogueFakeSession, *, pill: Pill, name: str | None = None
) -> Test:
    test = Test(
        tenant_id=p.SEED_TENANT_ID,
        name=name or f"{pill.name} D5",
        mode=TestMode.hand_authored,
        status=TestStatus.published,
        pill_id=pill.id,
        target_difficulty=5,
    )
    session.add(test)
    return test


def _seed_attempt(
    session: CatalogueFakeSession,
    *,
    testee_id,
    test_id,
    submitted_at: datetime | None,
    sequence_number: int = 1,
) -> Attempt:
    attempt = Attempt(
        tenant_id=p.SEED_TENANT_ID,
        test_id=test_id,
        testee_id=testee_id,
        origin=AttemptOrigin.assignment_driven,
        sequence_number=sequence_number,
        submitted_at=submitted_at,
        overall_score=0.7,
    )
    session.add(attempt)
    return attempt


def test_empty_for_new_testee(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    r = cat_client.get("/v1/me/competence", headers=bearer(testee))
    assert r.status_code == 200, r.text
    assert r.json() == {"pills": []}


def test_returns_profile_with_derived_band_and_confidence(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    pill, _ = _seed_subject_and_pill(cat_session, pill_name="Antifouling")
    test = _seed_test_for_pill(cat_session, pill=pill)

    now = datetime.now(UTC)
    cat_session.add(
        CompetencyProfile(
            tenant_id=p.SEED_TENANT_ID,
            testee_id=testee.id,
            pill_id=pill.id,
            competence_estimate=6.4,
            last_activity_at=now,
        )
    )
    # 25 submitted attempts → n=25, ≥ default threshold 20 → confident.
    for i in range(25):
        _seed_attempt(
            cat_session,
            testee_id=testee.id,
            test_id=test.id,
            submitted_at=now - timedelta(days=i),
            sequence_number=i + 1,
        )

    r = cat_client.get("/v1/me/competence", headers=bearer(testee))
    assert r.status_code == 200
    pills = r.json()["pills"]
    assert len(pills) == 1
    anti = pills[0]
    assert anti["competence_estimate"] == 6.4
    assert anti["band"] == "working"
    assert anti["n"] == 25
    assert anti["confidence"] == "confident"
    assert anti["safety_relevant"] is False
    assert anti["last_activity_at"] is not None


def test_excludes_null_competence_estimate(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """LOCK-2 — rows with ``competence_estimate IS NULL`` are filtered
    server-side so the FE never has to null-guard the float."""
    seed_system_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    real_pill, _ = _seed_subject_and_pill(cat_session, pill_name="Adhesion")
    null_pill, _ = _seed_subject_and_pill(cat_session, pill_name="Empty")

    now = datetime.now(UTC)
    cat_session.add(
        CompetencyProfile(
            tenant_id=p.SEED_TENANT_ID,
            testee_id=testee.id,
            pill_id=real_pill.id,
            competence_estimate=7.2,
            last_activity_at=now,
        )
    )
    cat_session.add(
        CompetencyProfile(
            tenant_id=p.SEED_TENANT_ID,
            testee_id=testee.id,
            pill_id=null_pill.id,
            competence_estimate=None,
            last_activity_at=None,
        )
    )

    r = cat_client.get("/v1/me/competence", headers=bearer(testee))
    assert r.status_code == 200
    pills = r.json()["pills"]
    assert [p_["pill_name"] for p_ in pills] == ["Adhesion"]


def test_excludes_other_tenant_profile(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """Finding 10 — ``CompetencyProfile.tenant_id`` is filtered alongside
    the adjacent ``Pill`` / ``PillRelated`` queries. v1 is single-tenant
    but the asymmetric WHERE was a port-time trap; closing it now."""
    seed_system_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    pill, _ = _seed_subject_and_pill(cat_session, pill_name="Antifouling")

    foreign_tenant = p.SEED_TENANT_ID.int ^ 0xDEAD
    foreign_tenant_uuid = type(p.SEED_TENANT_ID)(int=foreign_tenant)
    cat_session.add(
        CompetencyProfile(
            tenant_id=foreign_tenant_uuid,
            testee_id=testee.id,
            pill_id=pill.id,
            competence_estimate=8.5,
            last_activity_at=datetime.now(UTC),
        )
    )

    r = cat_client.get("/v1/me/competence", headers=bearer(testee))
    assert r.status_code == 200
    assert r.json() == {"pills": []}


def test_n_derived_from_submitted_attempts(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """LOCK-3 expanded — ``n`` reflects the testee's submitted Attempt
    rows per pill, not the dead ``CompetencyProfile.retake_count``
    column. In-flight attempts (``submitted_at IS NULL``) are excluded;
    other testees' attempts don't pollute the count."""
    seed_system_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    other = cat_make_user(cat_session, email="o@kbc.com", role=p.ROLE_TESTEE)
    pill, _ = _seed_subject_and_pill(cat_session, pill_name="Antifouling")
    test = _seed_test_for_pill(cat_session, pill=pill)

    now = datetime.now(UTC)
    cat_session.add(
        CompetencyProfile(
            tenant_id=p.SEED_TENANT_ID,
            testee_id=testee.id,
            pill_id=pill.id,
            competence_estimate=5.0,
            last_activity_at=now,
        )
    )
    # 3 submitted by our testee.
    for i in range(3):
        _seed_attempt(
            cat_session,
            testee_id=testee.id,
            test_id=test.id,
            submitted_at=now - timedelta(days=i),
            sequence_number=i + 1,
        )
    # 1 in-flight (no submitted_at) — excluded.
    _seed_attempt(
        cat_session,
        testee_id=testee.id,
        test_id=test.id,
        submitted_at=None,
        sequence_number=4,
    )
    # 5 submitted by another testee — excluded.
    for i in range(5):
        _seed_attempt(
            cat_session,
            testee_id=other.id,
            test_id=test.id,
            submitted_at=now - timedelta(hours=i),
            sequence_number=i + 1,
        )

    r = cat_client.get("/v1/me/competence", headers=bearer(testee))
    assert r.status_code == 200
    pills = r.json()["pills"]
    assert len(pills) == 1
    assert pills[0]["n"] == 3
    # n=3 < threshold 20 → preliminary.
    assert pills[0]["confidence"] == "preliminary"


def test_related_pill_ids_populated(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    pill_a, _ = _seed_subject_and_pill(cat_session, pill_name="A")
    pill_b, _ = _seed_subject_and_pill(cat_session, pill_name="B")
    test_a = _seed_test_for_pill(cat_session, pill=pill_a)
    cat_session.add(
        PillRelated(
            tenant_id=p.SEED_TENANT_ID,
            pill_id=pill_a.id,
            related_pill_id=pill_b.id,
        )
    )
    now = datetime.now(UTC)
    cat_session.add(
        CompetencyProfile(
            tenant_id=p.SEED_TENANT_ID,
            testee_id=testee.id,
            pill_id=pill_a.id,
            competence_estimate=7.2,
            last_activity_at=now,
        )
    )
    # 30 submitted attempts → n=30 → confident, full ring per design.
    for i in range(30):
        _seed_attempt(
            cat_session,
            testee_id=testee.id,
            test_id=test_a.id,
            submitted_at=now - timedelta(days=i),
            sequence_number=i + 1,
        )

    r = cat_client.get("/v1/me/competence", headers=bearer(testee))
    assert r.status_code == 200
    pills = r.json()["pills"]
    assert len(pills) == 1
    assert pills[0]["related_pill_ids"] == [str(pill_b.id)]
    assert pills[0]["band"] == "advanced"
    assert pills[0]["n"] == 30


def test_only_callers_profiles_returned(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    me = cat_make_user(cat_session, email="me@kbc.com", role=p.ROLE_TESTEE)
    other = cat_make_user(cat_session, email="o@kbc.com", role=p.ROLE_TESTEE)
    pill, _ = _seed_subject_and_pill(cat_session, pill_name="Shared")

    cat_session.add(
        CompetencyProfile(
            tenant_id=p.SEED_TENANT_ID,
            testee_id=other.id,
            pill_id=pill.id,
            competence_estimate=9.0,
            last_activity_at=datetime.now(UTC),
        )
    )

    r = cat_client.get("/v1/me/competence", headers=bearer(me))
    assert r.status_code == 200
    assert r.json() == {"pills": []}


def test_unauthenticated_401(cat_client: TestClient) -> None:
    assert cat_client.get("/v1/me/competence").status_code == 401
