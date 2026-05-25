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
    Pill,
    SystemSettings,
    Test,
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


def _status_from_attempts(
    attempts: list[Attempt],
    assignment: Assignment,
    now: datetime,
) -> str:
    """Pure derivation over a pre-fetched attempts list. The sweep
    and the widget pre-fetch their attempts in a single query and
    call this directly; the public ``derive_engagement_status`` keeps
    its one-shot signature for callers that don't need batch reads."""
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
    return _status_from_attempts(attempts, assignment, now)


# --- pre-fetched indices (Gitar PR-#15 N+1) --------------------------
# The sweep and the widget run over the whole tenant on a cron, so the
# naive "load assignment → load assignees → query attempts per assignee"
# pattern is O(assignments × assignees) DB calls. These helpers each
# issue ONE tenant-scoped query and Python-index the result; the
# downstream loops do all their lookups in memory.


async def _assignees_by_assignment(
    db: AsyncSession,
) -> dict[uuid.UUID, list[AssignmentAssignee]]:
    result = await db.execute(
        select(AssignmentAssignee).where(AssignmentAssignee.tenant_id == SEED_TENANT_ID)
    )
    index: dict[uuid.UUID, list[AssignmentAssignee]] = {}
    for row in result.scalars().all():
        index.setdefault(row.assignment_id, []).append(row)
    return index


async def _attempts_by_assignment_testee(
    db: AsyncSession,
) -> dict[tuple[uuid.UUID, uuid.UUID], list[Attempt]]:
    """Pre-fetch every Attempt in the tenant and index by
    ``(assignment_id, testee_id)``. The shipped harness parses
    ``where`` clauses as equality only — pulling all tenant attempts
    in one query and filtering nulls in Python keeps the test seam
    intact while collapsing the N+1."""
    result = await db.execute(select(Attempt).where(Attempt.tenant_id == SEED_TENANT_ID))
    index: dict[tuple[uuid.UUID, uuid.UUID], list[Attempt]] = {}
    for attempt in result.scalars().all():
        if attempt.assignment_id is None:
            continue
        index.setdefault((attempt.assignment_id, attempt.testee_id), []).append(attempt)
    return index


async def _users_by_id(db: AsyncSession) -> dict[uuid.UUID, AppUser]:
    result = await db.execute(select(AppUser).where(AppUser.tenant_id == SEED_TENANT_ID))
    return {u.id: u for u in result.scalars().all()}


async def _pills_by_id(db: AsyncSession) -> dict[uuid.UUID, Pill]:
    result = await db.execute(select(Pill).where(Pill.tenant_id == SEED_TENANT_ID))
    return {p.id: p for p in result.scalars().all()}


async def _tests_by_id(db: AsyncSession) -> dict[uuid.UUID, Test]:
    """Tenant-wide :class:`Test` index for assignment-name resolution.

    Slice C row-enrichment: an Assignment with ``pill_id is None`` may
    still target a Test (FE-1 ``GET /v1/tests/{id}/resolver`` shows the
    Test→Assignment linkage). We look the Test up via the per-assignee
    Attempt's ``test_id`` as a fallback when neither pill nor an
    explicit test_id column is present on the Assignment row."""
    result = await db.execute(select(Test).where(Test.tenant_id == SEED_TENANT_ID))
    return {t.id: t for t in result.scalars().all()}


# --- pending widget --------------------------------------------------


async def list_pending_assignments(
    db: AsyncSession, *, now: datetime | None = None
) -> list[dict[str, Any]]:
    """AC-D26 admin "pending engagement" widget: surface every
    mandatory assignment that has at least one assignee stuck in
    ``pending`` past ``pending_assignment_age_threshold_days``
    (default 7). Returns one entry per stuck (assignment, Testee)
    pair so the admin sees who needs nudging.

    Uses the pre-fetched indices so the whole widget costs four
    bounded queries (settings + assignments + assignees + attempts),
    not O(assignments × assignees) per call.
    """
    now = now or now_utc()
    settings = await _settings(db)
    threshold_days = _DEFAULT_THRESHOLD_DAYS
    if (
        settings is not None
        and settings.pending_assignment_age_threshold_days is not None
    ):
        threshold_days = settings.pending_assignment_age_threshold_days
    cutoff = now - timedelta(days=threshold_days)
    assignees_index = await _assignees_by_assignment(db)
    attempts_index = await _attempts_by_assignment_testee(db)
    reminders_index = await _reminders_by_assignment(db)
    users_index = await _users_by_id(db)
    pills_index = await _pills_by_id(db)
    tests_index = await _tests_by_id(db)
    rows: list[dict[str, Any]] = []
    result = await db.execute(
        select(Assignment).where(Assignment.tenant_id == SEED_TENANT_ID)
    )
    for assignment in result.scalars().all():
        if not assignment.is_mandatory:
            continue
        if assignment.created_at > cutoff:
            continue
        assigner = users_index.get(assignment.assigner_id)
        assigner_name = assigner.name if assigner is not None else ""
        pill_or_test_name = _resolve_assignment_label(
            assignment, pills_index, tests_index, attempts_index
        )
        reminders_sent = sum(
            1
            for r in reminders_index.get(assignment.id, [])
            if r.kind == AssignmentReminderKind.reminder
        )
        escalated = assignment.escalation_sent_at is not None
        days_stale = max(0, (now - assignment.created_at).days)
        for assignee in assignees_index.get(assignment.id, []):
            attempts = attempts_index.get((assignment.id, assignee.user_id), [])
            status = _status_from_attempts(attempts, assignment, now)
            if status != EngagementStatus.pending:
                continue
            testee = users_index.get(assignee.user_id)
            rows.append(
                {
                    "assignment_id": assignment.id,
                    "testee_id": assignee.user_id,
                    "testee_name": testee.name if testee is not None else "",
                    "pill_or_test_name": pill_or_test_name,
                    "assigner_name": assigner_name,
                    "created_at": assignment.created_at,
                    "deadline": assignment.deadline,
                    "is_mandatory": assignment.is_mandatory,
                    "days_stale": days_stale,
                    "reminders_sent": reminders_sent,
                    "escalated": escalated,
                }
            )
    return rows


def _resolve_assignment_label(
    assignment: Assignment,
    pills_index: dict[uuid.UUID, Pill],
    tests_index: dict[uuid.UUID, Test],
    attempts_index: dict[tuple[uuid.UUID, uuid.UUID], list[Attempt]],
) -> str:
    """The display label for the assignment's target. A pill-backed
    assignment uses :attr:`Pill.name`; an Assignment without a pill_id
    falls back to the Test name reached through any Attempt the
    assignees have started against it (post-Slice-B Test.pill_id is
    optional, so a Test-only assignment is a legal v1 shape)."""
    if assignment.pill_id is not None:
        pill = pills_index.get(assignment.pill_id)
        if pill is not None:
            return pill.name
    for (assignment_id, _testee_id), attempts in attempts_index.items():
        if assignment_id != assignment.id:
            continue
        for attempt in attempts:
            test = tests_index.get(attempt.test_id)
            if test is not None:
                return test.name
    return ""


# --- reminder + escalation sweep -------------------------------------


async def _reminders_by_assignment(
    db: AsyncSession,
) -> dict[uuid.UUID, list[AssignmentReminder]]:
    """Tenant-wide reminder history, indexed by assignment_id and
    sorted by ``sent_at`` per bucket so the sweep can read step
    coverage in O(1)."""
    result = await db.execute(
        select(AssignmentReminder).where(AssignmentReminder.tenant_id == SEED_TENANT_ID)
    )
    index: dict[uuid.UUID, list[AssignmentReminder]] = {}
    for row in result.scalars().all():
        index.setdefault(row.assignment_id, []).append(row)
    for bucket in index.values():
        bucket.sort(key=lambda r: r.sent_at)
    return index


def _reminder_steps(
    assignment: Assignment, settings: SystemSettings | None
) -> list[datetime]:
    """The absolute moments at which the next-scheduled reminder is
    due. Tests with a deadline use ``[7, 1]`` days before; tests
    without use ``[14, 30]`` days after creation. The settings JSONB
    columns override the defaults when present.

    Result is **sorted chronologically** (Gitar PR-#15): the sweep
    loop breaks on the first future step, so a non-ascending admin
    config (e.g. ``[30, 14]`` instead of ``[14, 30]``) must not make
    us miss a due step. Sort here, once, rather than asserting
    ordering at write time and risking drift between writers.
    """
    if assignment.deadline is not None:
        days = _DEFAULT_WITH_DEADLINE
        if (
            settings is not None
            and settings.reminder_schedule_with_deadline_days_before is not None
        ):
            days = list(settings.reminder_schedule_with_deadline_days_before)
        steps = [assignment.deadline - timedelta(days=d) for d in days]
    else:
        days = _DEFAULT_NO_DEADLINE
        if (
            settings is not None
            and settings.reminder_schedule_no_deadline_days_after is not None
        ):
            days = list(settings.reminder_schedule_no_deadline_days_after)
        steps = [assignment.created_at + timedelta(days=d) for d in days]
    return sorted(steps)


def _smtp() -> SMTPClient:
    return SMTPClient()


async def run_engagement_sweep(
    db: AsyncSession, *, now: datetime | None = None
) -> dict[str, Any]:
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
    the outcome (Slice C row-enrichment adds per-step reminder splits,
    ``assignments_processed``, wall-clock ``duration_ms``, and
    ``last_swept_at`` for the systems-page card). Email send is
    fail-soft via the P2 SMTP seam.
    """
    swept_at = now_utc()
    now = now or swept_at
    settings = await _settings(db)
    escalation_enabled = settings.escalation_enabled if settings is not None else True
    summary: dict[str, Any] = {
        "reminders_sent": 0,
        "escalations_sent": 0,
        "first_reminders_sent": 0,
        "second_reminders_sent": 0,
        "assignments_processed": 0,
        "duration_ms": 0,
        "last_swept_at": swept_at,
    }
    smtp = _smtp()

    # Pre-fetched indices (Gitar PR-#15 N+1): each is one tenant
    # query; all downstream lookups are in-memory.
    assignees_index = await _assignees_by_assignment(db)
    attempts_index = await _attempts_by_assignment_testee(db)
    reminders_index = await _reminders_by_assignment(db)
    users_index = await _users_by_id(db)

    result = await db.execute(
        select(Assignment).where(Assignment.tenant_id == SEED_TENANT_ID)
    )
    for assignment in result.scalars().all():
        if not assignment.is_mandatory:
            continue
        summary["assignments_processed"] += 1
        history = reminders_index.get(assignment.id, [])
        reminder_count = sum(
            1 for r in history if r.kind == AssignmentReminderKind.reminder
        )
        steps = _reminder_steps(assignment, settings)
        assignees = assignees_index.get(assignment.id, [])
        for step_index, step_due_at in enumerate(steps):
            if step_index < reminder_count:
                continue
            if step_due_at > now:
                break
            recipients_pending: list[AppUser] = []
            for assignee in assignees:
                attempts = attempts_index.get((assignment.id, assignee.user_id), [])
                status = _status_from_attempts(attempts, assignment, now)
                if status == EngagementStatus.pending:
                    user = users_index.get(assignee.user_id)
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
            if step_index == 0:
                summary["first_reminders_sent"] += 1
            elif step_index == 1:
                summary["second_reminders_sent"] += 1

        if (
            escalation_enabled
            and reminder_count >= 2
            and assignment.escalation_sent_at is None
        ):
            still_pending = []
            for assignee in assignees:
                attempts = attempts_index.get((assignment.id, assignee.user_id), [])
                status = _status_from_attempts(attempts, assignment, now)
                if status == EngagementStatus.pending:
                    still_pending.append(assignee)
            if still_pending:
                assigner = users_index.get(assignment.assigner_id)
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
    finished_at = now_utc()
    summary["duration_ms"] = max(0, int((finished_at - swept_at).total_seconds() * 1000))
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
