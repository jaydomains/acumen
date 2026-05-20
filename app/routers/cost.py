"""cost router — admin AI cost dashboard (AC-D18).

P5 Slice 3 ships the rolling-month summary endpoint that the admin
dashboard consumes. The endpoint is read-only: it aggregates
provenance from every AI-produced entity (Grade, GradeReview,
Question, AnchorQuestion, WeaknessReport, LearningMaterial, and the
``processing_tasks.payload`` for pill proposals) plus the
budget-alert audit log so the dashboard can render the
fired-this-month state.

The beat-schedule cron that sweeps spend on a schedule lands in P11
(SPEC §8.9); P5 fires alerts inline post-call via
:func:`app.ai.cost.maybe_fire_budget_alert`, invoked by the domain
code at each AI call site (P5 done-when does NOT require the cron).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.cost import _year_month_key, current_month_spend
from app.models import SEED_TENANT_ID, AppUser, AuditLog, SystemSettings, get_db
from app.permissions import ROLE_ADMINISTRATOR, now_utc, require_role

router = APIRouter(prefix="/v1/admin/cost", tags=["admin"])

_require_admin = require_role(ROLE_ADMINISTRATOR)


@router.get("/summary")
async def cost_summary(
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Rolling current-month AI spend (AC-D18).

    Returns:

    * ``total_usd`` — monthly total across every provenance-bearing
      entity.
    * ``by_provider`` — split by ``anthropic`` / ``openai`` /
      ``stub`` (and ``(unknown)`` for any legacy rows missing
      provenance).
    * ``by_model`` — split by model ID so the AC-CD18 env-overridable
      model defaults can be evaluated against actual spend.
    * ``monthly_budget`` — the configured ``system_settings.monthly_ai_budget``
      or ``null``.
    * ``percent_of_budget`` — ``total_usd / monthly_budget * 100`` or
      ``null`` if no budget is configured.
    * ``alerts_fired_this_month`` — list of thresholds already
      emitted this calendar month (so the admin UI can render the
      pre-emitted state without re-sending).
    * ``since`` — first instant of the current calendar month
      (the aggregation window).
    """
    when = now_utc()
    spend = await current_month_spend(db, tenant_id=SEED_TENANT_ID, now=when)

    settings_row = (
        await db.execute(
            select(SystemSettings).where(SystemSettings.tenant_id == SEED_TENANT_ID)
        )
    ).scalar_one_or_none()
    monthly_budget = (
        getattr(settings_row, "monthly_ai_budget", None) if settings_row else None
    )
    percent: float | None = None
    if monthly_budget:
        percent = (spend["total_usd"] / monthly_budget) * 100.0

    year_month = _year_month_key(when)
    alerts_fired: list[int] = []
    audit_rows = await db.execute(
        select(AuditLog).where(AuditLog.tenant_id == SEED_TENANT_ID)
    )
    for row in audit_rows.scalars().all():
        if row.action != "budget_alert.fired":
            continue
        detail = row.detail or {}
        if detail.get("year_month") == year_month:
            threshold = detail.get("threshold")
            if isinstance(threshold, int) and threshold not in alerts_fired:
                alerts_fired.append(threshold)
    alerts_fired.sort()

    return {
        "since": spend["since"].isoformat(),
        "year_month": year_month,
        "total_usd": spend["total_usd"],
        "by_provider": spend["by_provider"],
        "by_model": spend["by_model"],
        "monthly_budget": monthly_budget,
        "percent_of_budget": percent,
        "alerts_fired_this_month": alerts_fired,
    }
