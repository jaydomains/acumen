"""admin router — engagement sweep + pending-engagement widget
(AC-D26). Grade override + flag queue land in P6.

P4 ships the engagement surfaces only: the sweep is callable from
here so admins can trigger reminders/escalations on demand, and the
widget lists assignments stuck in ``pending`` past the configured
threshold. The seventh cron in ``beat_schedule.py`` (P11) calls
``run_engagement_sweep`` on a schedule.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import engagement as engagement_domain
from app.models import AppUser, get_db
from app.permissions import ROLE_ADMINISTRATOR, require_role
from app.schemas import (
    EngagementWidgetItem,
    EngagementWidgetResponse,
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
