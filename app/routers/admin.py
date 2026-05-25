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
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import engagement as engagement_domain
from app.domain.bootstrap import run_bootstrap
from app.domain.calibration import (
    generate_anchor_pool_for_pill,
    list_flagged_anchors,
    resolve_flagged_anchor,
    run_calibration_sweep,
)
from app.domain.catalogue import record_audit
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
from app.domain.safety_links import check_safety_links
from app.models import AppUser, get_db
from app.permissions import ROLE_ADMINISTRATOR, require_role
from app.schemas import (
    AnchorBandSummary,
    AnchorBootstrapResult,
    AnchorResolveRequest,
    AnchorResolveResult,
    BootstrapRunResult,
    CalibrationSweepResult,
    EngagementWidgetItem,
    EngagementWidgetResponse,
    FlaggedAnchorItem,
    FlaggedAnchorListResponse,
    FlaggedGradeReviewItem,
    FlaggedGradeReviewListResponse,
    GradeReviewReconcileResult,
    GradeReviewResolveRequest,
    GradeReviewResolveResult,
    LoopApproveResult,
    LoopQueueItem,
    LoopQueueListResponse,
    LoopRejectRequest,
    LoopRejectResult,
    SafetyLinkCheckResult,
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
    verdict: Literal["flagged", "confirmed", "all"] = Query(default="flagged"),
) -> FlaggedGradeReviewListResponse:
    """List grade_review rows pending admin resolution (AC-D19 v1.6
    admin queue). Oldest-first; rows whose underlying Grade has
    already been resolved (Grade.overridden_at IS NOT NULL) drop off
    the queue.

    Slice C row-enrichment adds the ``verdict`` query param so the
    FE-9 queue page can flip between ``flagged`` (default), ``confirmed``,
    or ``all`` without a second endpoint (FE-9-admin-ops.md §H(a)
    item 1)."""
    rows = await list_flagged_reviews(db, verdict=verdict)
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
    status: Literal["review", "queued", "step-down", "material-served", "closed"]
    | None = Query(default=None),
) -> LoopQueueListResponse:
    """List WeaknessReport rows in the admin-reviewed loop queue
    (AC-D6 ``loop_mode = admin_reviewed``). Oldest-first; rows whose
    ``routed_to_admin`` flag has been cleared by a prior approve/reject
    drop off the queue.

    Slice C row-enrichment adds the ``status`` query param so the
    FE-9 queue page can server-side-filter against the derived 5-value
    enum (FE-9-admin-ops.md §H(a) item 1). Omitted = return every
    routed-to-admin row regardless of derived status."""
    rows = await list_admin_queue(db, status=status)
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


# --- P8 anchor calibration (AC-D23 bootstrap) -------------------------


@router.post("/pills/{pill_id}/anchors/generate", status_code=201)
async def anchors_generate(
    pill_id: uuid.UUID,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> AnchorBootstrapResult:
    """Bootstrap the anchor pool for one pill (AC-D23 bootstrap #1).

    Generates ``system_settings.anchor_pool_size_per_band`` anchors per
    band in ``pill.available_difficulty_min .. max``. Each anchor passes
    a cross-family self-review (AC-D23) and regenerates up to 3 times
    before being written as ``excluded`` for admin attention. Returns
    409 ``anchors_exist`` on re-run — drain the flagged queue first
    (Slice 4 resolve actions); P11 ships idempotent top-up.

    Audit-logged at ``anchors.bootstrap`` so a fat-fingered re-run
    that hits the 409 still records the operator + timestamp.

    **HTTP timeout warning** (Gitar PR-#20 Slice 2 finding #2): the
    synchronous call can emit up to 360 sequential AI calls per pill
    at default ``anchor_pool_size_per_band = 20`` over a 3-band pill,
    well beyond typical reverse-proxy / ASGI timeouts. For production
    use against real pools, wrap this through the P11 Celery task
    (the same wrapper hosting the AC-D23 cross-pill orchestrator).
    See :func:`app.domain.calibration.generate_anchor_pool_for_pill`
    for the workaround pattern until P11 lands."""
    result = await generate_anchor_pool_for_pill(db, pill_id)
    await record_audit(
        db,
        actor_id=admin.id,
        action="anchors.bootstrap",
        target_entity="pill",
        target_id=pill_id,
        detail={
            "anchors_generated": result["anchors_generated"],
            "anchors_excluded": result["anchors_excluded"],
            "total_generation_calls": result["total_generation_calls"],
            "total_self_review_calls": result["total_self_review_calls"],
        },
    )
    await db.commit()
    return AnchorBootstrapResult(
        anchors_generated=result["anchors_generated"],
        anchors_excluded=result["anchors_excluded"],
        total_generation_calls=result["total_generation_calls"],
        total_self_review_calls=result["total_self_review_calls"],
        per_band_summary=[AnchorBandSummary(**row) for row in result["per_band_summary"]],
    )


@router.post("/loop/queue/{weakness_report_id}/reject", status_code=201)
async def loop_queue_reject(
    weakness_report_id: uuid.UUID,
    body: LoopRejectRequest | None = None,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> LoopRejectResult:
    """Reject a queued WeaknessReport: clears ``routed_to_admin``
    without creating a follow-up. The Testee never sees a remediation
    pass for this attempt. Audit-logged at ``loop.queue.reject``.

    Slice C row-enrichment accepts an optional ``{reason: str}`` body
    captured into the audit_log detail for operator traceability
    (FE-9-admin-ops.md §H(a) item 1 sub-item). Empty POST is still
    accepted — the reason simply defaults to None."""
    reason = body.reason if body is not None else None
    result = await reject_admin_queue(db, weakness_report_id, admin.id, reason=reason)
    await db.commit()
    return LoopRejectResult(**result)


# --- P8 Slice 4 — calibration sweep + anchor flag queue (AC-D23 / AC-D27)


@router.post("/calibration/run", status_code=201)
async def calibration_run(
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> CalibrationSweepResult:
    """Run one pass of the §12 anchor calibration sweep synchronously
    and return the counts (AC-D27). Identical body to the P11 Celery
    beat task; the admin trigger gives operators a manual lever for
    on-demand recompute (mirrors the P6 grade-review reconcile + P4
    engagement sweep precedent)."""
    counts = await run_calibration_sweep(db)
    await db.commit()
    return CalibrationSweepResult(**counts)


@router.get("/anchors/flagged")
async def anchors_flagged(
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> FlaggedAnchorListResponse:
    """List :class:`AnchorQuestion` rows pending admin resolution
    (AC-D23 — anchors that failed 3 generate+review cycles in
    bootstrap, plus any ``keep``-only ack pendings). Oldest-first
    by ``created_at``; rows resolved via ``reject`` keep
    ``excluded=True`` but clear ``needs_admin_attention`` so they
    fall off the queue."""
    rows = await list_flagged_anchors(db)
    return FlaggedAnchorListResponse(data=[FlaggedAnchorItem(**row) for row in rows])


@router.post("/anchors/{anchor_id}/resolve", status_code=201)
async def anchors_resolve(
    anchor_id: uuid.UUID,
    body: AnchorResolveRequest,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> AnchorResolveResult:
    """Resolve one flagged anchor (AC-D23). Three actions:
    ``keep`` (accept AI wording), ``substitute_wording`` (replace
    ``config`` from ``new_config`` — admin is the authoritative
    reviewer of their own substitution, so this does NOT auto-rerun
    self-review), ``reject`` (acknowledge the excluded slot stays
    excluded). Audit-logged at ``anchors.resolve``."""
    result = await resolve_flagged_anchor(
        db,
        anchor_id,
        admin,
        action=body.action,
        new_config=body.new_config,
    )
    await db.commit()
    return AnchorResolveResult(**result)


# --- P11 Slice 4 — AC-D23 bootstrap orchestrator ---------------------


@router.post("/bootstrap/run", status_code=201)
async def bootstrap_run(
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> BootstrapRunResult:
    """Run the AC-D23 idempotent bootstrap orchestrator once and
    return aggregate telemetry (P11 Slice 4).

    Four steps per AC-D23 prose: anchor pool top-up across every
    active pill (step 1; self-review inline so step 2 is integrated);
    safety-link curation for every safety-tagged pill below quota
    (step 3); Drive RAG ingest if a folder is configured (step 4).
    A re-run on an already-populated deployment returns near-zero
    counters (the idempotency contract — AC-CD7).

    Synchronous endpoint at v1 scale (≤30 pills). Production-scale
    runs (hundreds of pills, thousands of anchors) should route
    through the Celery task wrapper to escape the ASGI timeout
    (precedent: PR-#20 anchor-bootstrap timeout warning).

    Audit-logged at ``bootstrap.run`` with the full telemetry so the
    operator's audit trail captures every bootstrap event."""
    telemetry = await run_bootstrap(db)
    await record_audit(
        db,
        actor_id=admin.id,
        action="bootstrap.run",
        target_entity="system_settings",
        target_id=admin.tenant_id,
        detail=telemetry,
    )
    await db.commit()
    return BootstrapRunResult(**telemetry)


# --- P11 Slice 3 — safety-link monthly check (AC-D21) ----------------


@router.post("/safety-links/check", status_code=201)
async def safety_links_check(
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> SafetyLinkCheckResult:
    """Run one pass of the AC-D21 monthly safety-link verification
    sweep synchronously and return the counts. Identical body to the
    P11 ``safety_links.check`` Celery beat task on a monthly schedule;
    the admin trigger gives operators a manual lever for on-demand
    verification after curating new safety pills (mirrors the P6
    grade-review reconcile + P8 calibration sweep precedent).

    Audit-logged at ``safety_links.check`` so a re-run records the
    operator + timestamp + telemetry counters for the operational
    trail."""
    telemetry = await check_safety_links(db)
    await record_audit(
        db,
        actor_id=admin.id,
        action="safety_links.check",
        target_entity="system_settings",
        target_id=admin.tenant_id,
        detail=telemetry,
    )
    await db.commit()
    return SafetyLinkCheckResult(**telemetry)
