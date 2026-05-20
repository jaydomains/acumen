"""Assignment engagement — derived engagement_status, reminder /
escalation sweep (AC-D26 v1.6).

``engagement_status`` is **derived per (assignment, Testee)** from that
Testee's attempts against the assignment. It is never stored. v1.6
locked the four states — pending / in_progress / complete / overdue —
and the per-Testee scope: an assignment that fans out to a Group has an
independent status per assignee.

Reminder send history is **assignment-scoped** in v1.6: the shipped
``assignment_reminder`` table has no ``user_id``, so the per-Testee
"cease on first attempt" rule is a derivation over the Testee's
attempts, not a per-assignee reminder row. Escalation is a one-shot
notification to the assigning admin, capped via
``assignment.escalation_sent_at``.

P4 ships the sweep as a callable (here) + an admin-only trigger
endpoint (``POST /v1/admin/engagement/sweep``); P11 wires it into the
seventh cron in ``beat_schedule.py``. Emails route through the P2
``SMTPClient`` seam — fail-soft, captured in tests via
``captured_emails``.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.catalogue import record_audit
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    Assignment,
    AssignmentAssignee,
    AssignmentReminder,
    AssignmentReminderKind,
    Attempt,
    SystemSettings,
)
from app.permissions import SMTPClient, now_utc

__all__ = [
    "EngagementStatus",
    "derive_engagement_status",
    "list_pending_assignments",
    "run_engagement_sweep",
]


class EngagementStatus:
    """Bare-string sentinels for the four derived states (AC-D26
    v1.6). Comparisons stay cheap; values surface unchanged in API
    responses."""

    pending = "pending"
    in_progress = "in_progress"
    complete = "complete"
    overdue = "overdue"


# Schedule defaults when ``SystemSettings`` carries None (the test
# seam yields no row by default; production has the v1.3 server
# defaults applied at table create).
_DEFAULT_WITH_DEADLINE = [7, 1]
_DEFAULT_NO_DEADLINE = [14, 30]
_DEFAULT_THRESHOLD_DAYS = 7


async def _settings(db: AsyncSession) -> SystemSettings | None:
    result = await db.execute(
        select(SystemSettings).where(SystemSettings.tenant_id == SEED_TENANT_ID)
    )
    return result.scalar_one_or_none()


async def _attempts_for(
    db: AsyncSession, assignment_id: uuid.UUID, testee_id: uuid.UUID
) -> list[Attempt]:
    """Attempts this Testee has run against this assignment. AC-D26
    v1.4 introduced the explicit FK so engagement derives by assignment
    match rather than heuristic origin/timing — read it directly."""
    result = await db.execute(
        select(Attempt).where(
            Attempt.assignment_id == assignment_id,
            Attempt.testee_id == testee_id,
            Attempt.tenant_id == SEED_TENANT_ID,
        )
    )
    return list(result.scalars().all())


async def derive_engagement_status(
    db: AsyncSession,
    *,
    assignment: Assignment,
    testee_id: uuid.UUID,
    now: datetime | None = None,
) -> str:
    """The per-(assignment, Testee) derivation locked in AC-D26 v1.6.
    Path-level aggregation (per AC-D9 v1.6 "all in-scope pills
    attempted and submitted by the assignee") is a P7 concern — P4
    surfaces the per-Testee status against each assignment row."""
    now = now or now_utc()
    attempts = await _attempts_for(db, assignment.id, testee_id)
    if not attempts:
        status = EngagementStatus.pending
    elif any(a.submitted_at is not None for a in attempts):
        status = EngagementStatus.complete
    else:
        status = EngagementStatus.in_progress
    if (
        status != EngagementStatus.complete
        and assignment.deadline is not None
        and now > assignment.deadline
    ):
        status = EngagementStatus.overdue
    return status


# --- pending widget --------------------------------------------------


async def _assignees(
    db: AsyncSession, assignment_id: uuid.UUID
) -> list[AssignmentAssignee]:
    result = await db.execute(
        select(AssignmentAssignee).where(
            AssignmentAssignee.assignment_id == assignment_id,
            AssignmentAssignee.tenant_id == SEED_TENANT_ID,
        )
    )
    return list(result.scalars().all())


async def list_pending_assignments(
    db: AsyncSession, *, now: datetime | None = None
) -> list[dict[str, Any]]:
    """AC-D26 admin "pending engagement" widget: surface every
    mandatory assignment that has at least one assignee stuck in
    ``pending`` past ``pending_assignment_age_threshold_days``
    (default 7). Returns one entry per stuck (assignment, Testee)
    pair so the admin sees who needs nudging."""
    now = now or now_utc()
    settings = await _settings(db)
    threshold_days = _DEFAULT_THRESHOLD_DAYS
    if (
        settings is not None
        and settings.pending_assignment_age_threshold_days is not None
    ):
        threshold_days = settings.pending_assignment_age_threshold_days
    cutoff = now - timedelta(days=threshold_days)
    rows: list[dict[str, Any]] = []
    result = await db.execute(
        select(Assignment).where(Assignment.tenant_id == SEED_TENANT_ID)
    )
    for assignment in result.scalars().all():
        if not assignment.is_mandatory:
            continue
        if assignment.created_at > cutoff:
            continue
        for assignee in await _assignees(db, assignment.id):
            status = await derive_engagement_status(
                db, assignment=assignment, testee_id=assignee.user_id, now=now
            )
            if status == EngagementStatus.pending:
                rows.append(
                    {
                        "assignment_id": assignment.id,
                        "testee_id": assignee.user_id,
                        "created_at": assignment.created_at,
                        "deadline": assignment.deadline,
                        "is_mandatory": assignment.is_mandatory,
                    }
                )
    return rows


# --- reminder + escalation sweep -------------------------------------


async def _prior_reminders(
    db: AsyncSession, assignment_id: uuid.UUID
) -> list[AssignmentReminder]:
    result = await db.execute(
        select(AssignmentReminder).where(
            AssignmentReminder.assignment_id == assignment_id,
            AssignmentReminder.tenant_id == SEED_TENANT_ID,
        )
    )
    rows = list(result.scalars().all())
    rows.sort(key=lambda r: r.sent_at)
    return rows


def _reminder_steps(
    assignment: Assignment, settings: SystemSettings | None
) -> list[datetime]:
    """The absolute moments at which the next-scheduled reminder is
    due. Tests with a deadline use ``[7, 1]`` days before; tests
    without use ``[14, 30]`` days after creation. The settings JSONB
    columns override the defaults when present."""
    if assignment.deadline is not None:
        days = _DEFAULT_WITH_DEADLINE
        if (
            settings is not None
            and settings.reminder_schedule_with_deadline_days_before is not None
        ):
            days = list(settings.reminder_schedule_with_deadline_days_before)
        return [assignment.deadline - timedelta(days=d) for d in days]
    days = _DEFAULT_NO_DEADLINE
    if (
        settings is not None
        and settings.reminder_schedule_no_deadline_days_after is not None
    ):
        days = list(settings.reminder_schedule_no_deadline_days_after)
    return [assignment.created_at + timedelta(days=d) for d in days]


async def _user(db: AsyncSession, user_id: uuid.UUID) -> AppUser | None:
    result = await db.execute(
        select(AppUser).where(AppUser.id == user_id, AppUser.tenant_id == SEED_TENANT_ID)
    )
    return result.scalar_one_or_none()


def _smtp() -> SMTPClient:
    return SMTPClient()


async def run_engagement_sweep(
    db: AsyncSession, *, now: datetime | None = None
) -> dict[str, int]:
    """Per-tick reminder + escalation pass (AC-D26). Idempotent.

    For each mandatory assignment:

      * Compute due reminder steps from ``_reminder_steps``. Skip the
        steps already covered by ``reminder_count`` (history is
        assignment-scoped: one row per step sent).
      * For each due step, send a reminder to every assignee whose
        current status is still ``pending`` (the per-Testee cease
        rule — "ceases on that Testee's first attempt" — is derived
        from the assignee's attempts). Record exactly one
        ``assignment_reminder`` row per send event.
      * After at least 2 reminders have been emitted, escalate to the
        assigner ONCE (``escalation_sent_at`` caps it; alert-fatigue
        avoidance) if any assignee remains ``pending``.

    Returns a small summary so the admin trigger endpoint can render
    the outcome. Email send is fail-soft via the P2 SMTP seam.
    """
    now = now or now_utc()
    settings = await _settings(db)
    escalation_enabled = settings.escalation_enabled if settings is not None else True
    summary = {"reminders_sent": 0, "escalations_sent": 0}
    smtp = _smtp()

    result = await db.execute(
        select(Assignment).where(Assignment.tenant_id == SEED_TENANT_ID)
    )
    for assignment in result.scalars().all():
        if not assignment.is_mandatory:
            continue
        history = await _prior_reminders(db, assignment.id)
        reminder_count = sum(
            1 for r in history if r.kind == AssignmentReminderKind.reminder
        )
        steps = _reminder_steps(assignment, settings)
        assignees = await _assignees(db, assignment.id)
        for step_index, step_due_at in enumerate(steps):
            if step_index < reminder_count:
                continue
            if step_due_at > now:
                break
            recipients_pending: list[AppUser] = []
            for assignee in assignees:
                status = await derive_engagement_status(
                    db, assignment=assignment, testee_id=assignee.user_id, now=now
                )
                if status == EngagementStatus.pending:
                    user = await _user(db, assignee.user_id)
                    if user is not None:
                        recipients_pending.append(user)
            if not recipients_pending:
                # No-one to remind at this step — record it as covered
                # so the schedule advances and the next step can fire
                # against a later subset.
                db.add(
                    AssignmentReminder(
                        tenant_id=SEED_TENANT_ID,
                        assignment_id=assignment.id,
                        kind=AssignmentReminderKind.reminder,
                        sent_at=now,
                    )
                )
                reminder_count += 1
                continue
            subject, body = _reminder_email_content(assignment, step_index + 1)
            for user in recipients_pending:
                smtp.send(to=user.email, subject=subject, body=body)
            db.add(
                AssignmentReminder(
                    tenant_id=SEED_TENANT_ID,
                    assignment_id=assignment.id,
                    kind=AssignmentReminderKind.reminder,
                    sent_at=now,
                )
            )
            reminder_count += 1
            summary["reminders_sent"] += 1

        if (
            escalation_enabled
            and reminder_count >= 2
            and assignment.escalation_sent_at is None
        ):
            still_pending = []
            for assignee in assignees:
                status = await derive_engagement_status(
                    db, assignment=assignment, testee_id=assignee.user_id, now=now
                )
                if status == EngagementStatus.pending:
                    still_pending.append(assignee)
            if still_pending:
                assigner = await _user(db, assignment.assigner_id)
                if assigner is not None:
                    subj, body = _escalation_email_content(assignment, len(still_pending))
                    smtp.send(to=assigner.email, subject=subj, body=body)
                db.add(
                    AssignmentReminder(
                        tenant_id=SEED_TENANT_ID,
                        assignment_id=assignment.id,
                        kind=AssignmentReminderKind.escalation,
                        sent_at=now,
                    )
                )
                assignment.escalation_sent_at = now
                summary["escalations_sent"] += 1
                await record_audit(
                    db,
                    actor_id=None,
                    action="assignment.escalate",
                    target_entity="assignment",
                    target_id=assignment.id,
                    detail={"pending_count": len(still_pending)},
                )
    await db.flush()
    return summary


def _reminder_email_content(assignment: Assignment, step_number: int) -> tuple[str, str]:
    subject = f"Reminder {step_number}: complete your assigned Acumen test"
    deadline_line = (
        f"Deadline: {assignment.deadline.isoformat()}\n"
        if assignment.deadline is not None
        else "This assignment has no fixed deadline.\n"
    )
    body = (
        "You have a mandatory Acumen assignment that has not yet been "
        f"started.\n\n{deadline_line}\nLog in to start the test."
    )
    return subject, body


def _escalation_email_content(
    assignment: Assignment, pending_count: int
) -> tuple[str, str]:
    subject = f"Acumen: {pending_count} assignee(s) have not started a mandatory test"
    body = (
        "An Acumen assignment has reached the escalation threshold. "
        "At least two reminders have been sent and the listed assignees "
        "have not opened an attempt.\n\n"
        f"Assignment id: {assignment.id}\n"
        f"Pending assignees: {pending_count}\n"
    )
    return subject, body
