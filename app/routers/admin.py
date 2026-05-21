"""admin router — engagement sweep, pending-engagement widget,
grade_review reconcile trigger, flagged-grade_review queue + resolve
(AC-D26 / AC-D19 v1.6 / AC-D19 v1.7 / AC-D2).

P4 ships the engagement surfaces. P6 Slice 3 added the grade_review
reconcile trigger so admins can run a sweep on demand without waiting
for the §8.9 cron (P11 wires the schedule). P6 Slice 4 adds the
admin flag queue and the per-row resolution endpoint
(keep_ai / accept_reviewer / substitute) per AC-D19 v1.6 / AC-D2.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import engagement as engagement_domain
from app.domain.grade_review import (
    list_flagged_reviews,
    reconcile_pending_grade_reviews,
    resolve_flagged_review,
)
from app.domain.loop import (
    approve_admin_queue,
    list_admin_queue,
    reject_admin_queue,
)
from app.models import AppUser, get_db
from app.permissions import ROLE_ADMINISTRATOR, require_role
from app.schemas import (
    EngagementWidgetItem,
    EngagementWidgetResponse,
    FlaggedGradeReviewItem,
    FlaggedGradeReviewListResponse,
    GradeReviewReconcileResult,
    GradeReviewResolveRequest,
    GradeReviewResolveResult,
    LoopApproveResult,
    LoopQueueItem,
    LoopQueueListResponse,
    LoopRejectResult,
    SweepResult,
)

router = APIRouter(prefix="/v1/admin", tags=["admin"])

_require_admin = require_role(ROLE_ADMINISTRATOR)


@router.post("/engagement/sweep")
async def engagement_sweep(
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> SweepResult:
    summary = await engagement_domain.run_engagement_sweep(db)
    await db.commit()
    return SweepResult(**summary)


@router.get("/engagement/pending")
async def engagement_pending(
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> EngagementWidgetResponse:
    rows = await engagement_domain.list_pending_assignments(db)
    return EngagementWidgetResponse(data=[EngagementWidgetItem(**row) for row in rows])


@router.post("/grade-reviews/reconcile")
async def grade_reviews_reconcile(
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> GradeReviewReconcileResult:
    """Run one pass of the §8.9 grade-review reconcile sweep
    synchronously and return the counts. Identical to the body the
    P11 Celery beat will invoke on a 5-minute schedule (AC-D19 v1.6 /
    AC-CD11 v1.7); the admin trigger gives operators a manual lever
    when a known provider outage has cleared and they want pending
    rows resolved immediately rather than waiting for the next cron
    pass."""
    counts = await reconcile_pending_grade_reviews(db)
    await db.commit()
    return GradeReviewReconcileResult(**counts)


@router.get("/grade-reviews/flagged")
async def grade_reviews_flagged(
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> FlaggedGradeReviewListResponse:
    """List flagged grade_review rows pending admin resolution
    (AC-D19 v1.6 admin queue). Oldest-first; rows whose underlying
    Grade has already been resolved (Grade.overridden_at IS NOT NULL)
    drop off the queue."""
    rows = await list_flagged_reviews(db)
    return FlaggedGradeReviewListResponse(
        data=[FlaggedGradeReviewItem(**row) for row in rows]
    )


@router.post("/grade-reviews/{grade_review_id}/resolve")
async def grade_review_resolve(
    grade_review_id: uuid.UUID,
    body: GradeReviewResolveRequest,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> GradeReviewResolveResult:
    """Resolve one flagged grade_review (AC-D19 v1.6 / AC-D2 override
    mechanism). Writes the override columns on the underlying Grade,
    recomputes ``overall_score`` for the attempt, and writes an
    audit-log entry."""
    result = await resolve_flagged_review(
        db,
        grade_review_id,
        admin,
        action=body.action,
        score=body.score,
        verdict=body.verdict,
        reasoning=body.reasoning,
    )
    await db.commit()
    return GradeReviewResolveResult(**result)


# --- P7 adaptive loop admin queue (AC-D6 admin_reviewed mode) ---------


@router.get("/loop/queue")
async def loop_queue(
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> LoopQueueListResponse:
    """List WeaknessReport rows in the admin-reviewed loop queue
    (AC-D6 ``loop_mode = admin_reviewed``). Oldest-first; rows whose
    ``routed_to_admin`` flag has been cleared by a prior approve/reject
    drop off the queue."""
    rows = await list_admin_queue(db)
    return LoopQueueListResponse(data=[LoopQueueItem(**row) for row in rows])


@router.post("/loop/queue/{weakness_report_id}/approve", status_code=201)
async def loop_queue_approve(
    weakness_report_id: uuid.UUID,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> LoopApproveResult:
    """Approve a queued WeaknessReport: clears ``routed_to_admin`` AND
    creates the follow-up (material per non-safety weak pill +
    per_testee Test + Assignment + Assignee + loop_driven Attempt) —
    same flow the autonomous mode runs inline at submit. 201 Created
    matches the AC-CD16 admin-write convention used by
    grade_review_resolve."""
    result = await approve_admin_queue(db, weakness_report_id, admin.id)
    await db.commit()
    return LoopApproveResult(**result)


@router.post("/loop/queue/{weakness_report_id}/reject", status_code=201)
async def loop_queue_reject(
    weakness_report_id: uuid.UUID,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> LoopRejectResult:
    """Reject a queued WeaknessReport: clears ``routed_to_admin``
    without creating a follow-up. The Testee never sees a remediation
    pass for this attempt. Audit-logged at ``loop.queue.reject``."""
    result = await reject_admin_queue(db, weakness_report_id, admin.id)
    await db.commit()
    return LoopRejectResult(**result)
