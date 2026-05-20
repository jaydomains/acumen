"""P5 Slice 3 — explicit verification of AC-D18 v1.1 rate-limit
carve-out: self-initiated attempts count against per-hour /
per-day limits; assignment-driven + loop-driven origins are exempt.

P4 already implements ``_RATE_EXEMPT_ORIGINS`` at
``app/domain/attempts.py:128`` and gates ``_enforce_rate_limit`` only
for non-exempt origins. P5 Slice 3 adds explicit integration coverage
of the carve-out — the per-origin contract is one of P5's done-when
deliverables (AC-D18 v1.1 amendment) and must not silently regress
when later phases add new origins or rewire the start path.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    Assignment,
    AssignmentAssignee,
    Attempt,
    AttemptOrigin,
    LoopMode,
    SystemSettings,
    Test,
    TestMode,
    TestStatus,
    TestVisibility,
    TimeoutBehaviour,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
)


def _testee(session: CatalogueFakeSession) -> AppUser:
    return cat_make_user(session, email="t@kbc.com", role=p.ROLE_TESTEE)


def _admin(session: CatalogueFakeSession) -> AppUser:
    return cat_make_user(session, email="a@kbc.com", role=p.ROLE_ADMINISTRATOR)


def _published_test(session: CatalogueFakeSession) -> Test:
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="T",
        mode=TestMode.frozen,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=False,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        target_difficulty=5,
        randomise_question_order=True,
        randomise_option_order=True,
    )
    session.add(test)
    return test


def _assignment(
    session: CatalogueFakeSession,
    *,
    assigner_id: uuid.UUID,
    testee_id: uuid.UUID,
) -> Assignment:
    """An assignment is keyed to a pill or learning_path, NOT a test
    (per the AC-D6 / AC-D15 shape — see Assignment model). The
    rate-limit check only consults ``origin`` + ``assignment_id``,
    so the linked pill is arbitrary for this test."""
    assignment = Assignment(
        tenant_id=SEED_TENANT_ID,
        assigner_id=assigner_id,
        pill_id=uuid.uuid4(),
        learning_path_id=None,
        difficulty=5,
        is_mandatory=True,
        loop_mode=LoopMode.autonomous,
    )
    session.add(assignment)
    session.add(
        AssignmentAssignee(
            tenant_id=SEED_TENANT_ID,
            assignment_id=assignment.id,
            user_id=testee_id,
            via_group_id=None,
        )
    )
    return assignment


def _set_low_rate_limits(session: CatalogueFakeSession) -> None:
    """Override the default 5/hour 20/day to 1/hour 1/day so the limit
    is easy to hit in a few requests."""
    session.store[SystemSettings] = []
    session.add(
        SystemSettings(
            tenant_id=SEED_TENANT_ID,
            self_initiated_rate_limit_per_hour=1,
            self_initiated_rate_limit_per_day=1,
        )
    )


def test_self_initiated_hits_rate_limit(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """Two consecutive self-initiated starts against a 1/hour limit:
    the first succeeds, the second returns 429."""
    _set_low_rate_limits(cat_session)
    t = _testee(cat_session)
    test = _published_test(cat_session)

    r1 = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    )
    assert r1.status_code == 201
    r2 = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    )
    assert r2.status_code == 429


def test_assignment_driven_exempt_from_rate_limit(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """An assignment-driven start MUST NOT be blocked by the rate
    limit even after the testee has exhausted their self-initiated
    quota (AC-D18 v1.1 carve-out)."""
    _set_low_rate_limits(cat_session)
    admin = _admin(cat_session)
    t = _testee(cat_session)
    test = _published_test(cat_session)
    assignment = _assignment(cat_session, assigner_id=admin.id, testee_id=t.id)

    # Use up the self-initiated quota.
    r1 = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    )
    assert r1.status_code == 201

    # Assignment-driven start MUST succeed despite the quota being full.
    r2 = cat_client.post(
        "/v1/attempts",
        headers=bearer(t),
        json={
            "test_id": str(test.id),
            "origin": AttemptOrigin.assignment_driven.value,
            "assignment_id": str(assignment.id),
        },
    )
    assert r2.status_code == 201, r2.text


def test_loop_driven_exempt_from_rate_limit(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """Loop-driven follow-ups (P7) are also exempt — they need to
    fire even when the testee has hit the daily limit so the
    adaptive loop never stalls (AC-D18 v1.1 amendment rationale).
    P5 ships the rate-limit contract; P7 produces the loop-driven
    origin against it."""
    _set_low_rate_limits(cat_session)
    admin = _admin(cat_session)
    t = _testee(cat_session)
    test = _published_test(cat_session)
    assignment = _assignment(cat_session, assigner_id=admin.id, testee_id=t.id)

    # Use up the self-initiated quota.
    cat_client.post("/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)})

    # Loop-driven start succeeds despite the quota being full.
    r = cat_client.post(
        "/v1/attempts",
        headers=bearer(t),
        json={
            "test_id": str(test.id),
            "origin": AttemptOrigin.loop_driven.value,
            "assignment_id": str(assignment.id),
        },
    )
    assert r.status_code == 201, r.text


def test_explicit_zero_rate_limit_blocks_immediately(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """An admin-configured ``0`` per_hour rate limit is honoured as
    "deny all self-initiated starts", NOT silently coerced to the
    default. Belt-and-braces re-assertion of the Gitar PR-#15 finding
    (the ``or _DEFAULT_RATE_PER_HOUR`` → ``is None`` defensive
    fix) — covering this in the P5 carve-out suite makes the
    contract explicit at the AC-D18 v1.1 boundary."""
    cat_session.store[SystemSettings] = []
    cat_session.add(
        SystemSettings(
            tenant_id=SEED_TENANT_ID,
            self_initiated_rate_limit_per_hour=0,
            self_initiated_rate_limit_per_day=0,
        )
    )
    t = _testee(cat_session)
    test = _published_test(cat_session)
    r = cat_client.post("/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)})
    assert r.status_code == 429


def test_default_limits_when_settings_unset(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """No SystemSettings row → fall back to the AC-D18 defaults of
    5/hour 20/day. The first few self-initiated starts succeed."""
    # Note: deliberately do NOT seed system_settings.
    t = _testee(cat_session)
    test = _published_test(cat_session)
    for i in range(5):
        r = cat_client.post(
            "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
        )
        assert r.status_code == 201, f"start #{i + 1} should succeed under default 5/hour"
    # 6th start hits the per-hour ceiling.
    r6 = cat_client.post(
        "/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)}
    )
    assert r6.status_code == 429


def test_only_self_initiated_attempts_count_against_quota(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """Pre-existing assignment-driven or loop-driven attempts must
    NOT count toward the self-initiated quota — only same-origin
    attempts roll into the limit. Defensive cross-check on the
    ``_self_initiated_recent`` filter in attempts.py."""
    _set_low_rate_limits(cat_session)  # 1/hour 1/day
    admin = _admin(cat_session)
    t = _testee(cat_session)
    test = _published_test(cat_session)
    assignment = _assignment(cat_session, assigner_id=admin.id, testee_id=t.id)

    # Pre-seed a completed assignment-driven attempt so the recent
    # list contains a non-self-initiated row.
    cat_session.add(
        Attempt(
            tenant_id=SEED_TENANT_ID,
            test_id=test.id,
            testee_id=t.id,
            origin=AttemptOrigin.assignment_driven,
            assignment_id=assignment.id,
            sequence_number=1,
            started_at=p.now_utc(),
            submitted_at=p.now_utc(),
        )
    )

    # A self-initiated start now should still succeed (the
    # assignment-driven row doesn't consume the self-initiated quota).
    r = cat_client.post("/v1/attempts", headers=bearer(t), json={"test_id": str(test.id)})
    assert r.status_code == 201
