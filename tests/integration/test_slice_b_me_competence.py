"""Slice B B.4 — GET /v1/me/competence (testee constellation feed).

One row per ``CompetencyProfile`` for the caller, with band derived from
``competence_estimate`` and ``confidence`` from
``system_settings.anchor_calibration_confidence_threshold`` (default 20)
against ``CompetencyProfile.retake_count``.
"""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import CompetencyProfile, Pill, PillRelated, Subject
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
    pill2, _ = _seed_subject_and_pill(cat_session, pill_name="Adhesion")

    now = datetime.now(UTC)
    profile = CompetencyProfile(
        tenant_id=p.SEED_TENANT_ID,
        testee_id=testee.id,
        pill_id=pill.id,
        competence_estimate=6.4,
        retake_count=25,  # >= 20 default threshold → confident
        last_activity_at=now,
    )
    cat_session.add(profile)
    # Preliminary entry (n=5 < threshold) with null estimate
    cat_session.add(
        CompetencyProfile(
            tenant_id=p.SEED_TENANT_ID,
            testee_id=testee.id,
            pill_id=pill2.id,
            competence_estimate=None,
            retake_count=5,
            last_activity_at=None,
        )
    )

    r = cat_client.get("/v1/me/competence", headers=bearer(testee))
    assert r.status_code == 200
    pills = r.json()["pills"]
    # Sorted by pill_name (case-insensitive) → Adhesion before Antifouling.
    assert [p_["pill_name"] for p_ in pills] == ["Adhesion", "Antifouling"]
    adh, anti = pills[0], pills[1]
    assert anti["competence_estimate"] == 6.4
    assert anti["band"] == "working"
    assert anti["n"] == 25
    assert anti["confidence"] == "confident"
    assert anti["safety_relevant"] is False
    assert anti["last_activity_at"] is not None
    assert adh["competence_estimate"] is None
    assert adh["band"] == "novice"
    assert adh["confidence"] == "preliminary"
    assert adh["last_activity_at"] is None


def test_related_pill_ids_populated(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    pill_a, _ = _seed_subject_and_pill(cat_session, pill_name="A")
    pill_b, _ = _seed_subject_and_pill(cat_session, pill_name="B")
    cat_session.add(
        PillRelated(
            tenant_id=p.SEED_TENANT_ID,
            pill_id=pill_a.id,
            related_pill_id=pill_b.id,
        )
    )
    cat_session.add(
        CompetencyProfile(
            tenant_id=p.SEED_TENANT_ID,
            testee_id=testee.id,
            pill_id=pill_a.id,
            competence_estimate=7.2,
            retake_count=30,
            last_activity_at=datetime.now(UTC),
        )
    )

    r = cat_client.get("/v1/me/competence", headers=bearer(testee))
    assert r.status_code == 200
    pills = r.json()["pills"]
    assert len(pills) == 1
    assert pills[0]["related_pill_ids"] == [str(pill_b.id)]
    assert pills[0]["band"] == "advanced"


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
            retake_count=40,
            last_activity_at=datetime.now(UTC),
        )
    )

    r = cat_client.get("/v1/me/competence", headers=bearer(me))
    assert r.status_code == 200
    assert r.json() == {"pills": []}


def test_unauthenticated_401(cat_client: TestClient) -> None:
    assert cat_client.get("/v1/me/competence").status_code == 401
