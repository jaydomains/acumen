"""P8 Slice 4 — band calibration state endpoint (AC-D20 / AC-D27 #3).

Covers ``GET /v1/calibration/pills/{pill_id}/bands/{band}``: the
preliminary → confident display flip at the inclusive
``system_settings.anchor_calibration_confidence_threshold`` boundary,
plus pool / excluded counts and the admin-only role gate.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import (
    SEED_TENANT_ID,
    AnchorQuestion,
    AppUser,
    Pill,
    Question,
    QuestionType,
    Subject,
    SystemSettings,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
    seed_system_settings,
)


def _admin(s: CatalogueFakeSession) -> AppUser:
    return cat_make_user(s, email="a@kbc.com", role=p.ROLE_ADMINISTRATOR)


def _testee(s: CatalogueFakeSession) -> AppUser:
    return cat_make_user(s, email="t@kbc.com", role=p.ROLE_TESTEE)


def _pill(s: CatalogueFakeSession) -> Pill:
    sub = Subject(tenant_id=SEED_TENANT_ID, name="ops", description="")
    s.add(sub)
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=sub.id,
        name="Lifting",
        description="",
        available_difficulty_min=1,
        available_difficulty_max=10,
        discoverable=True,
        safety_relevant=False,
    )
    s.add(pill)
    return pill


def _set_confidence_threshold(s: CatalogueFakeSession, *, threshold: int) -> None:
    """Override the seeded system_settings's confidence_threshold so
    each test can pin the inclusive boundary explicitly. The
    zero-DB harness doesn't apply server defaults; this also
    documents the boundary semantic in each test."""
    settings = s.store[SystemSettings][-1]
    settings.anchor_calibration_confidence_threshold = threshold


def _seed_anchor(
    s: CatalogueFakeSession,
    *,
    pill: Pill,
    band: int = 5,
    total_attempts: int = 0,
    excluded: bool = False,
) -> AnchorQuestion:
    aid = uuid.uuid4()
    s.add(
        Question(
            id=aid,
            tenant_id=SEED_TENANT_ID,
            pill_id=pill.id,
            type=QuestionType.multiple_choice,
            config={"prompt": "q", "options": ["a", "b"], "correct": 0},
            assigned_difficulty=5,
            realism_flag_count=0,
        )
    )
    anchor = AnchorQuestion(
        id=aid,
        tenant_id=SEED_TENANT_ID,
        pill_id=pill.id,
        band=band,
        type=QuestionType.multiple_choice,
        config={"prompt": "q", "options": ["a", "b"], "correct": 0},
        assigned_difficulty=5,
        total_attempts=total_attempts,
        regeneration_attempts=0,
        excluded=excluded,
    )
    s.add(anchor)
    return anchor


# --- Empty pool -------------------------------------------------------


def test_band_state_empty_pool_is_preliminary_with_zero_n(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """No anchors for the (pill, band) → ``state='preliminary'``,
    ``n=0``, ``anchors_in_pool=0``. Cold-start signal the admin
    Competency View needs for a freshly-bootstrapped pill."""
    seed_system_settings(cat_session)
    _set_confidence_threshold(cat_session, threshold=20)
    admin = _admin(cat_session)
    pill = _pill(cat_session)

    r = cat_client.get(
        f"/v1/calibration/pills/{pill.id}/bands/5",
        headers=bearer(admin),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["state"] == "preliminary"
    assert body["n"] == 0
    assert body["anchors_in_pool"] == 0
    assert body["anchors_excluded"] == 0


# --- Below threshold --------------------------------------------------


def test_band_state_below_threshold_is_preliminary(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """``n=19`` with ``threshold=20`` → still ``preliminary`` (the
    inclusive flip happens at ``n == threshold``, not before)."""
    seed_system_settings(cat_session)
    _set_confidence_threshold(cat_session, threshold=20)
    admin = _admin(cat_session)
    pill = _pill(cat_session)
    # Aggregate n = 19 across 2 live anchors (10 + 9).
    _seed_anchor(cat_session, pill=pill, total_attempts=10)
    _seed_anchor(cat_session, pill=pill, total_attempts=9)

    r = cat_client.get(
        f"/v1/calibration/pills/{pill.id}/bands/5",
        headers=bearer(admin),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["n"] == 19
    assert body["state"] == "preliminary"
    assert body["anchors_in_pool"] == 2


# --- At threshold (inclusive flip) ------------------------------------


def test_band_state_at_threshold_flips_to_confident(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """AC-D27 #3 wording: ``state`` flips to ``confident`` at
    ``n >= threshold`` — boundary inclusive. ``n=20`` with
    ``threshold=20`` → ``confident``."""
    seed_system_settings(cat_session)
    _set_confidence_threshold(cat_session, threshold=20)
    admin = _admin(cat_session)
    pill = _pill(cat_session)
    _seed_anchor(cat_session, pill=pill, total_attempts=10)
    _seed_anchor(cat_session, pill=pill, total_attempts=10)

    r = cat_client.get(
        f"/v1/calibration/pills/{pill.id}/bands/5",
        headers=bearer(admin),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["n"] == 20
    assert body["state"] == "confident"


# --- Excluded anchors counted separately ------------------------------


def test_band_state_separates_excluded_from_pool(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Excluded anchors don't count toward ``anchors_in_pool`` or
    ``n`` — but they do count toward ``anchors_excluded`` so the
    admin sees how many slots are stuck in the flagged queue."""
    seed_system_settings(cat_session)
    _set_confidence_threshold(cat_session, threshold=20)
    admin = _admin(cat_session)
    pill = _pill(cat_session)
    _seed_anchor(cat_session, pill=pill, total_attempts=15)  # live
    _seed_anchor(cat_session, pill=pill, total_attempts=0, excluded=True)
    _seed_anchor(cat_session, pill=pill, total_attempts=0, excluded=True)

    r = cat_client.get(
        f"/v1/calibration/pills/{pill.id}/bands/5",
        headers=bearer(admin),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["n"] == 15
    assert body["anchors_in_pool"] == 1
    assert body["anchors_excluded"] == 2
    assert body["state"] == "preliminary"


# --- Band partitioning ------------------------------------------------


def test_band_state_only_counts_target_band(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """An anchor at band 7 does not contribute to band 5's counts —
    the response is per-band, matching the AC-D27 #3 "per pill+band"
    granularity."""
    seed_system_settings(cat_session)
    _set_confidence_threshold(cat_session, threshold=20)
    admin = _admin(cat_session)
    pill = _pill(cat_session)
    _seed_anchor(cat_session, pill=pill, band=5, total_attempts=10)
    _seed_anchor(cat_session, pill=pill, band=7, total_attempts=15)

    r = cat_client.get(
        f"/v1/calibration/pills/{pill.id}/bands/5",
        headers=bearer(admin),
    )
    body = r.json()
    assert body["n"] == 10
    assert body["anchors_in_pool"] == 1


# --- 403 unauthorised --------------------------------------------------


def test_band_state_forbidden_for_non_admin(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """The endpoint is admin-only — Testees can't see calibration
    state (it's an operational signal, not a learner-facing surface).
    AC-D20 names the Admin Competency View as the consumer."""
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    r = cat_client.get(
        f"/v1/calibration/pills/{pill.id}/bands/5",
        headers=bearer(testee),
    )
    assert r.status_code == 403
