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
