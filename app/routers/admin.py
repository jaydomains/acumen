"""admin router — engagement sweep, pending-engagement widget,
grade_review reconcile trigger (AC-D26 / AC-D19 v1.7).

P4 ships the engagement surfaces; P6 Slice 3 adds the grade_review
reconcile trigger so admins can run a sweep on demand without waiting
for the §8.9 cron (P11 wires the schedule). Grade override + flag
queue land in P6 Slice 4.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import engagement as engagement_domain
from app.domain.grade_review import reconcile_pending_grade_reviews
from app.models import AppUser, get_db
from app.permissions import ROLE_ADMINISTRATOR, require_role
from app.schemas import (
    EngagementWidgetItem,
    EngagementWidgetResponse,
    GradeReviewReconcileResult,
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
