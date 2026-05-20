"""P4 Slice 3 — engagement_status derivation + reminder/escalation
sweep + admin pending widget (AC-D26 v1.6).

Status is per (assignment, Testee). The sweep records assignment-
scoped reminder history (no ``user_id`` on the shipped
``assignment_reminder``); the per-Testee cease rule is a derivation
from the Testee's attempts. Email send routes through the P2
``SMTPClient`` seam — captured in tests, no network.

Zero-DB / zero-network (AC-CD15).
"""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest

from app import permissions as p
from app.domain import engagement as engagement_domain
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    Assignment,
    AssignmentAssignee,
    AssignmentReminder,
    AssignmentReminderKind,
    Attempt,
    AttemptOrigin,
    LoopMode,
    SystemSettings,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    cat_make_user,
)


def _admin(session: CatalogueFakeSession) -> AppUser:
    return cat_make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)


def _testee(session: CatalogueFakeSession, email: str) -> AppUser:
    return cat_make_user(session, email=email, role=p.ROLE_TESTEE)


def _assignment(
    session: CatalogueFakeSession,
    *,
    assigner: AppUser,
    testees: list[AppUser],
    deadline=None,
    is_mandatory: bool = True,
    age_days: int = 0,
) -> Assignment:
    a = Assignment(
        tenant_id=SEED_TENANT_ID,
        assigner_id=assigner.id,
        pill_id=uuid.uuid4(),
        learning_path_id=None,
        difficulty=4,
        deadline=deadline,
        is_mandatory=is_mandatory,
        loop_mode=LoopMode.autonomous,
    )
    session.add(a)
    if age_days:
        a.created_at = p.now_utc() - timedelta(days=age_days)
    for t in testees:
        session.add(
            AssignmentAssignee(
                tenant_id=SEED_TENANT_ID,
                assignment_id=a.id,
                user_id=t.id,
                via_group_id=None,
            )
        )
    return a


def _attempt(
    session: CatalogueFakeSession,
    *,
    assignment_id: uuid.UUID | None,
    testee: AppUser,
    submitted: bool = False,
) -> Attempt:
    a = Attempt(
        tenant_id=SEED_TENANT_ID,
        test_id=uuid.uuid4(),
        testee_id=testee.id,
        origin=(
            AttemptOrigin.assignment_driven
            if assignment_id
            else AttemptOrigin.self_initiated
        ),
        assignment_id=assignment_id,
        sequence_number=1,
        started_at=p.now_utc(),
        submitted_at=p.now_utc() if submitted else None,
        pauses_used=0,
        total_pause_duration_seconds=0,
    )
    session.add(a)
    return a


# --- derive_engagement_status ----------------------------------------


async def test_status_is_pending_when_no_attempts(
    cat_session: CatalogueFakeSession,
) -> None:
    admin = _admin(cat_session)
    t = _testee(cat_session, "t@kbc.com")
    a = _assignment(cat_session, assigner=admin, testees=[t])
    status = await engagement_domain.derive_engagement_status(
        cat_session, assignment=a, testee_id=t.id
    )
    assert status == "pending"


async def test_status_is_in_progress_after_open_attempt(
    cat_session: CatalogueFakeSession,
) -> None:
    admin = _admin(cat_session)
    t = _testee(cat_session, "t@kbc.com")
    a = _assignment(cat_session, assigner=admin, testees=[t])
    _attempt(cat_session, assignment_id=a.id, testee=t, submitted=False)
    status = await engagement_domain.derive_engagement_status(
        cat_session, assignment=a, testee_id=t.id
    )
    assert status == "in_progress"


async def test_status_is_complete_when_any_attempt_submitted(
    cat_session: CatalogueFakeSession,
) -> None:
    admin = _admin(cat_session)
    t = _testee(cat_session, "t@kbc.com")
    a = _assignment(cat_session, assigner=admin, testees=[t])
    _attempt(cat_session, assignment_id=a.id, testee=t, submitted=True)
    status = await engagement_domain.derive_engagement_status(
        cat_session, assignment=a, testee_id=t.id
    )
    assert status == "complete"


async def test_status_is_overdue_past_deadline_with_no_submission(
    cat_session: CatalogueFakeSession,
) -> None:
    admin = _admin(cat_session)
    t = _testee(cat_session, "t@kbc.com")
    a = _assignment(
        cat_session,
        assigner=admin,
        testees=[t],
        deadline=p.now_utc() - timedelta(days=1),
    )
    status = await engagement_domain.derive_engagement_status(
        cat_session, assignment=a, testee_id=t.id
    )
    assert status == "overdue"


async def test_status_is_per_assignment_per_testee(
    cat_session: CatalogueFakeSession,
) -> None:
    """v1.6: an assignment fanning out to many assignees has an
    INDEPENDENT status per assignee. One Testee's attempt does not
    flip the other Testee's status."""
    admin = _admin(cat_session)
    t1 = _testee(cat_session, "t1@kbc.com")
    t2 = _testee(cat_session, "t2@kbc.com")
    a = _assignment(cat_session, assigner=admin, testees=[t1, t2])
    _attempt(cat_session, assignment_id=a.id, testee=t1, submitted=True)
    s1 = await engagement_domain.derive_engagement_status(
        cat_session, assignment=a, testee_id=t1.id
    )
    s2 = await engagement_domain.derive_engagement_status(
        cat_session, assignment=a, testee_id=t2.id
    )
    assert s1 == "complete"
    assert s2 == "pending"


async def test_status_filters_by_assignment_id(
    cat_session: CatalogueFakeSession,
) -> None:
    """An attempt against a DIFFERENT assignment must not flip the
    status of this one — the explicit AC-D26 v1.4 FK kept us out of
    the origin/timing-heuristic trap."""
    admin = _admin(cat_session)
    t = _testee(cat_session, "t@kbc.com")
    a1 = _assignment(cat_session, assigner=admin, testees=[t])
    a2 = _assignment(cat_session, assigner=admin, testees=[t])
    _attempt(cat_session, assignment_id=a2.id, testee=t, submitted=True)
    s1 = await engagement_domain.derive_engagement_status(
        cat_session, assignment=a1, testee_id=t.id
    )
    s2 = await engagement_domain.derive_engagement_status(
        cat_session, assignment=a2, testee_id=t.id
    )
    assert s1 == "pending"
    assert s2 == "complete"


# --- list_pending_assignments (admin widget) -------------------------


async def test_pending_widget_lists_stale_mandatory_pending_only(
    cat_session: CatalogueFakeSession,
) -> None:
    admin = _admin(cat_session)
    t1 = _testee(cat_session, "t1@kbc.com")
    t2 = _testee(cat_session, "t2@kbc.com")
    # Old + mandatory + still pending -> surfaces.
    stale = _assignment(cat_session, assigner=admin, testees=[t1], age_days=10)
    # Old + optional -> excluded.
    _assignment(
        cat_session,
        assigner=admin,
        testees=[t1],
        age_days=10,
        is_mandatory=False,
    )
    # Old + mandatory but assignee submitted -> excluded.
    completed = _assignment(cat_session, assigner=admin, testees=[t2], age_days=10)
    _attempt(cat_session, assignment_id=completed.id, testee=t2, submitted=True)
    # New + mandatory (below the 7-day threshold) -> excluded.
    _assignment(cat_session, assigner=admin, testees=[t1], age_days=2)

    rows = await engagement_domain.list_pending_assignments(cat_session)
    ids = {row["assignment_id"] for row in rows}
    assert ids == {stale.id}
    assert rows[0]["testee_id"] == t1.id


# --- run_engagement_sweep --------------------------------------------


@pytest.fixture(autouse=True)
def _clear_emails() -> None:
    p.clear_captured_emails()


async def test_sweep_sends_reminder_to_pending_assignees(
    cat_session: CatalogueFakeSession,
) -> None:
    admin = _admin(cat_session)
    t = _testee(cat_session, "t@kbc.com")
    # Old enough to clear the first no-deadline reminder step (default
    # is [14, 30] days after creation).
    a = _assignment(cat_session, assigner=admin, testees=[t], age_days=14)
    summary = await engagement_domain.run_engagement_sweep(cat_session)
    assert summary["reminders_sent"] == 1
    sent = p.captured_emails()
    assert len(sent) == 1
    assert sent[0].to == t.email
    # One history row was recorded against the assignment.
    history = cat_session.store.get(AssignmentReminder, [])
    history = [r for r in history if r.assignment_id == a.id]
    assert len(history) == 1
    assert history[0].kind == AssignmentReminderKind.reminder


async def test_sweep_per_testee_cease_on_first_attempt(
    cat_session: CatalogueFakeSession,
) -> None:
    """t1 has started an attempt; t2 has not. The reminder send list
    must include only t2 — that's the per-Testee cease rule even
    though the send-history row remains assignment-scoped."""
    admin = _admin(cat_session)
    t1 = _testee(cat_session, "t1@kbc.com")
    t2 = _testee(cat_session, "t2@kbc.com")
    a = _assignment(cat_session, assigner=admin, testees=[t1, t2], age_days=14)
    _attempt(cat_session, assignment_id=a.id, testee=t1, submitted=False)

    await engagement_domain.run_engagement_sweep(cat_session)
    sent = p.captured_emails()
    assert {s.to for s in sent} == {t2.email}


async def test_sweep_is_idempotent_within_a_step(
    cat_session: CatalogueFakeSession,
) -> None:
    """Two sweeps in the same step window do not produce two reminder
    rows — the history count drives the schedule cursor."""
    admin = _admin(cat_session)
    t = _testee(cat_session, "t@kbc.com")
    _assignment(cat_session, assigner=admin, testees=[t], age_days=14)
    await engagement_domain.run_engagement_sweep(cat_session)
    sent_after_first = len(p.captured_emails())
    await engagement_domain.run_engagement_sweep(cat_session)
    sent_after_second = len(p.captured_emails())
    assert sent_after_second == sent_after_first


async def test_sweep_escalates_after_second_reminder(
    cat_session: CatalogueFakeSession,
) -> None:
    """Past both [14, 30]-day milestones with the assignee still
    pending: the second reminder fires, then the escalation fires to
    the assigner exactly once."""
    admin = _admin(cat_session)
    t = _testee(cat_session, "t@kbc.com")
    # Already 31 days old — both reminder steps are due.
    a = _assignment(cat_session, assigner=admin, testees=[t], age_days=31)
    summary = await engagement_domain.run_engagement_sweep(cat_session)
    assert summary["reminders_sent"] == 2
    assert summary["escalations_sent"] == 1
    sent = p.captured_emails()
    # 2 reminders to the testee + 1 escalation to the admin.
    assert sum(1 for s in sent if s.to == t.email) == 2
    assert sum(1 for s in sent if s.to == admin.email) == 1
    # escalation_sent_at is set on the row.
    refreshed = next(x for x in cat_session.store.get(Assignment, []) if x.id == a.id)
    assert refreshed.escalation_sent_at is not None
    # Second sweep is a no-op for escalation (capped at one).
    p.clear_captured_emails()
    second = await engagement_domain.run_engagement_sweep(cat_session)
    assert second["escalations_sent"] == 0


async def test_sweep_escalation_disabled_when_settings_say_so(
    cat_session: CatalogueFakeSession,
) -> None:
    cat_session.add(SystemSettings(tenant_id=SEED_TENANT_ID, escalation_enabled=False))
    admin = _admin(cat_session)
    t = _testee(cat_session, "t@kbc.com")
    _assignment(cat_session, assigner=admin, testees=[t], age_days=31)
    summary = await engagement_domain.run_engagement_sweep(cat_session)
    assert summary["escalations_sent"] == 0


async def test_sweep_skips_optional_assignments(
    cat_session: CatalogueFakeSession,
) -> None:
    admin = _admin(cat_session)
    t = _testee(cat_session, "t@kbc.com")
    _assignment(
        cat_session,
        assigner=admin,
        testees=[t],
        age_days=14,
        is_mandatory=False,
    )
    summary = await engagement_domain.run_engagement_sweep(cat_session)
    assert summary["reminders_sent"] == 0
    assert p.captured_emails() == []


async def test_sweep_with_deadline_schedule(
    cat_session: CatalogueFakeSession,
) -> None:
    """With a deadline, the schedule fires at [7, 1] days before. A
    deadline 6 days out covers the first step (7 days before) but
    not the second (1 day before)."""
    admin = _admin(cat_session)
    t = _testee(cat_session, "t@kbc.com")
    _assignment(
        cat_session,
        assigner=admin,
        testees=[t],
        deadline=p.now_utc() + timedelta(days=6),
    )
    summary = await engagement_domain.run_engagement_sweep(cat_session)
    assert summary["reminders_sent"] == 1
    assert summary["escalations_sent"] == 0
