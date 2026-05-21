"""P10 / AC-D25 v1.8 / AC-CD10 v1.8 — ``pause_attempt`` system-pause
extension. ``system=True`` bypasses the AC-D11 user-quota guards
(``pause_blocked`` + ``pause_allowance_exhausted``) and does not
increment ``pauses_used`` — system pauses are operational, not user-
quota. ``reason`` persists on the new ``AttemptPauseEvent.reason``
column so the resume UI can render "retry / abandon" vs the plain
resume affordance. The ``already_paused`` guard still fires for both
modes — a system pause coalesces with an existing user pause rather
than double-writing.

Slice 1 locks the contract before Slice 2's orchestrator calls into it.

Zero-DB / zero-network (AC-CD15).
"""

from __future__ import annotations

import pytest

from app import permissions as p
from app.domain import attempts as attempt_domain
from app.models import (
    SEED_TENANT_ID,
    Attempt,
    AttemptOrigin,
    AttemptPauseEvent,
    Test,
    TestMode,
    TestStatus,
    TestVisibility,
    TimeoutBehaviour,
)
from app.permissions import APIError, now_utc
from tests.integration.conftest import CatalogueFakeSession, cat_make_user

# --- helpers ----------------------------------------------------------


def _untimed_test(session: CatalogueFakeSession) -> Test:
    """Untimed test → user pause is blocked (AC-D11). A system pause
    must still succeed."""
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="T",
        mode=TestMode.per_testee,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=False,
        duration_minutes=None,
        pause_allowance=None,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        pass_threshold=None,
        target_difficulty=5,
        randomise_question_order=True,
        randomise_option_order=True,
    )
    session.add(test)
    return test


def _short_timed_test(session: CatalogueFakeSession) -> Test:
    """Timed but ≤60-minute test → user pause is blocked (AC-D11)."""
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="T",
        mode=TestMode.per_testee,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=True,
        duration_minutes=30,
        pause_allowance=0,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        pass_threshold=None,
        target_difficulty=5,
        randomise_question_order=True,
        randomise_option_order=True,
    )
    session.add(test)
    return test


def _attempt(session: CatalogueFakeSession, *, test: Test) -> Attempt:
    testee = cat_make_user(session, email="t@kbc.com", role=p.ROLE_TESTEE)
    attempt = Attempt(
        tenant_id=SEED_TENANT_ID,
        test_id=test.id,
        testee_id=testee.id,
        origin=AttemptOrigin.self_initiated,
        sequence_number=1,
        started_at=now_utc(),
        pauses_used=0,
        total_pause_duration_seconds=0,
        question_snapshot={"questions": []},
    )
    session.add(attempt)
    return attempt


# --- tests ------------------------------------------------------------


@pytest.mark.asyncio
async def test_system_pause_bypasses_pause_blocked_on_untimed_test(
    cat_session: CatalogueFakeSession,
) -> None:
    """An untimed test has no user-pause affordance per AC-D11; the
    system path (P10 / AC-CD10 v1.8) must succeed regardless."""
    test = _untimed_test(cat_session)
    attempt = _attempt(cat_session, test=test)

    await attempt_domain.pause_attempt(
        cat_session,
        attempt,
        test,
        system=True,
        reason=attempt_domain.PAUSE_REASON_GENERATION_FAILED,
    )

    events = [
        e
        for e in cat_session.store.get(AttemptPauseEvent, [])
        if e.attempt_id == attempt.id
    ]
    assert len(events) == 1
    assert events[0].reason == "generation_failed"
    assert events[0].ended_at is None


@pytest.mark.asyncio
async def test_user_pause_still_errors_on_untimed_test(
    cat_session: CatalogueFakeSession,
) -> None:
    """The non-system path retains AC-D11's guard — regression-lock so
    the system carve-out doesn't leak into the Testee-quota path."""
    test = _untimed_test(cat_session)
    attempt = _attempt(cat_session, test=test)

    with pytest.raises(APIError) as exc:
        await attempt_domain.pause_attempt(cat_session, attempt, test)
    assert exc.value.status_code == 409
    assert exc.value.code == "pause_not_allowed"


@pytest.mark.asyncio
async def test_system_pause_bypasses_allowance_exhausted(
    cat_session: CatalogueFakeSession,
) -> None:
    """A short-timed test gives pauses_used == 0 == pause_allowance; a
    user pause errors with allowance_exhausted, a system pause succeeds.
    """
    test = _short_timed_test(cat_session)
    attempt = _attempt(cat_session, test=test)

    await attempt_domain.pause_attempt(
        cat_session,
        attempt,
        test,
        system=True,
        reason="generation_failed",
    )
    events = [
        e
        for e in cat_session.store.get(AttemptPauseEvent, [])
        if e.attempt_id == attempt.id
    ]
    assert len(events) == 1
    assert events[0].reason == "generation_failed"


@pytest.mark.asyncio
async def test_system_pause_does_not_increment_pauses_used(
    cat_session: CatalogueFakeSession,
) -> None:
    """System pauses are operational, not user-quota; pauses_used stays
    at the Testee's accumulated user-pause count."""
    test = _untimed_test(cat_session)
    attempt = _attempt(cat_session, test=test)
    attempt.pauses_used = 2

    await attempt_domain.pause_attempt(
        cat_session, attempt, test, system=True, reason="generation_failed"
    )
    assert attempt.pauses_used == 2


@pytest.mark.asyncio
async def test_system_pause_coalesces_with_existing_pause(
    cat_session: CatalogueFakeSession,
) -> None:
    """If the Testee already paused (or a prior system pause is open),
    a second pause — system or not — surfaces ``already_paused`` rather
    than double-writing. Regression-locks the coalesce semantics."""
    test = _untimed_test(cat_session)
    attempt = _attempt(cat_session, test=test)

    await attempt_domain.pause_attempt(
        cat_session, attempt, test, system=True, reason="generation_failed"
    )
    with pytest.raises(APIError) as exc:
        await attempt_domain.pause_attempt(
            cat_session, attempt, test, system=True, reason="generation_failed"
        )
    assert exc.value.status_code == 409
    assert exc.value.code == "already_paused"


@pytest.mark.asyncio
async def test_user_pause_reason_is_none(
    cat_session: CatalogueFakeSession,
) -> None:
    """User-initiated pauses leave ``reason`` null so the resume UI
    renders the plain affordance, not "retry / abandon"."""
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="T",
        mode=TestMode.per_testee,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=True,
        duration_minutes=120,
        pause_allowance=1,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        pass_threshold=None,
        target_difficulty=5,
        randomise_question_order=True,
        randomise_option_order=True,
    )
    cat_session.add(test)
    attempt = _attempt(cat_session, test=test)

    await attempt_domain.pause_attempt(cat_session, attempt, test)

    events = [
        e
        for e in cat_session.store.get(AttemptPauseEvent, [])
        if e.attempt_id == attempt.id
    ]
    assert len(events) == 1
    assert events[0].reason is None
    assert attempt.pauses_used == 1


@pytest.mark.asyncio
async def test_view_attempt_surfaces_pause_reason_when_paused(
    cat_session: CatalogueFakeSession,
) -> None:
    """``view_attempt`` exposes ``pause_reason`` so the SSE handler /
    resume endpoint / Testee FE all read the same source of truth."""
    test = _untimed_test(cat_session)
    attempt = _attempt(cat_session, test=test)
    await attempt_domain.pause_attempt(
        cat_session, attempt, test, system=True, reason="generation_failed"
    )

    view = await attempt_domain.view_attempt(cat_session, attempt, test)
    assert view["paused"] is True
    assert view["pause_reason"] == "generation_failed"


@pytest.mark.asyncio
async def test_view_attempt_pause_reason_null_when_not_paused(
    cat_session: CatalogueFakeSession,
) -> None:
    """Shape consistency: ``pause_reason`` is always present on the
    response, NULL when the attempt is not paused."""
    test = _untimed_test(cat_session)
    attempt = _attempt(cat_session, test=test)

    view = await attempt_domain.view_attempt(cat_session, attempt, test)
    assert view["paused"] is False
    assert view["pause_reason"] is None


@pytest.mark.asyncio
async def test_system_pause_errors_on_submitted_attempt(
    cat_session: CatalogueFakeSession,
) -> None:
    """Submitted attempts cannot be paused — system or user."""
    test = _untimed_test(cat_session)
    attempt = _attempt(cat_session, test=test)
    attempt.submitted_at = now_utc()

    with pytest.raises(APIError) as exc:
        await attempt_domain.pause_attempt(
            cat_session, attempt, test, system=True, reason="generation_failed"
        )
    assert exc.value.status_code == 409
    assert exc.value.code == "attempt_submitted"
