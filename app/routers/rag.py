"""rag router — Drive RAG admin surface + realism feedback (AC-D22).

CODE_SPEC §9. P9 Slice 2 wires the Drive ingest admin trigger; Slice 4
adds the realism flag endpoints and the dashboard read surface.

The router is mounted at ``/v1`` rather than the ``/v1/rag`` prefix
the file name suggests — the Drive ingest sits under ``/v1/admin/...``
alongside the calibration / engagement / grade-review admin actions
(consistent surface for an operator working through the admin UI),
and the testee realism flag endpoint sits under
``/v1/attempts/.../questions/.../flag-realism`` (Slice 4) so testee
ownership flows through the existing attempt-id path-param check.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.catalogue import record_audit
from app.domain.drive_rag import (
    aggregate_realism_flags,
    drive_index_status,
    ingest_drive_folder,
    realism_status,
    record_realism_flag,
)
from app.models import SEED_TENANT_ID, AppUser, SystemSettings, get_db
from app.permissions import (
    ROLE_ADMINISTRATOR,
    ROLE_TESTEE,
    get_privacy_acked_user,
    require_role,
)
from app.schemas import (
    DriveIndexStatus,
    DriveIngestResult,
    RealismAggregationResult,
    RealismFlagResult,
    RealismStatusResponse,
)

router = APIRouter(prefix="/v1", tags=["rag"])

_require_admin = require_role(ROLE_ADMINISTRATOR)


@router.post("/admin/drive/ingest", status_code=201)
async def drive_ingest(
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> DriveIngestResult:
    """Run one Drive RAG ingest sweep synchronously and return the
    counts (AC-D22 / AC-D23 step 4). Identical body to the P11 Celery
    beat task; the admin trigger gives operators a manual lever for
    on-demand re-index (mirrors the P6 grade-review reconcile + P8
    calibration sweep precedent).

    Returns 409 ``drive_folder_unconfigured`` when
    ``system_settings.drive_folder_id`` is unset — the deployment has
    not completed AC-D23 step 4 (initial folder bootstrap) yet.

    Audit-logged at ``drive.ingest`` so a re-run records the operator
    + timestamp + telemetry counters for the embed-spend trail.

    **HTTP timeout warning** (PR-#21 Slice 2 deliberate deviation,
    mirrors the PR-#20 anchor-bootstrap warning): a folder with
    hundreds of files emits hundreds of sequential embed calls. At
    typical 100–500 ms embed latencies that's tens of seconds —
    inside default ASGI timeouts but the warning belongs here so a
    future deployment with thousands of files routes through the
    P11 Celery wrapper rather than the admin endpoint."""
    telemetry = await ingest_drive_folder(db)
    settings_row = (
        await db.execute(
            select(SystemSettings).where(SystemSettings.tenant_id == SEED_TENANT_ID)
        )
    ).scalar_one_or_none()
    if settings_row is not None:
        await record_audit(
            db,
            actor_id=admin.id,
            action="drive.ingest",
            target_entity="system_settings",
            target_id=settings_row.id,
            detail=telemetry,
        )
    await db.commit()
    return DriveIngestResult(**telemetry)


@router.post(
    "/attempts/{attempt_id}/questions/{question_id}/flag-realism",
    status_code=201,
)
async def flag_realism(
    attempt_id: uuid.UUID,
    question_id: uuid.UUID,
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> RealismFlagResult:
    """Testee-facing realism flag endpoint per AC-D22 ("Each question
    presented to a Testee carries a small 'this question feels
    unrealistic or off' button").

    Path params carry both the attempt and the question id so the
    domain ownership check (the testee owns this attempt AND was
    actually served this question) flows through the same equality
    walks the rest of the codebase uses. The 404 ``question_not_found``
    response covers "wrong attempt", "wrong testee", and "question
    not in this attempt" uniformly so the endpoint never leaks
    ownership information by error code.

    Empty request body: the ``generation_context`` recorded on the
    realism flag is server-derived from the Question's AIProvenanceMixin
    columns per AC-D22 ("records a flag against that specific
    question's content and the generation context that produced it")
    — the testee doesn't know the context and shouldn't be trusted
    to supply it.

    Idempotent per the ``uq_realism_question_testee`` unique
    constraint: the second click on the same question returns the
    existing row's id with ``created=False``. The admin endpoint at
    ``/v1/admin/realism/aggregate`` is what folds these flag rows
    into ``Question.realism_flag_count``.

    Audit-logged at ``realism.flag`` so an admin scanning the audit
    trail can reconstruct who flagged what without joining the
    realism_flag table directly. Admins do not use this endpoint —
    role-restricted to ``ROLE_TESTEE`` so the AC-D22 trust-hierarchy
    invariant ("the testee is the realism authority on what they
    saw") stays clean."""
    if user.role != ROLE_TESTEE:
        from app.permissions import APIError

        raise APIError(
            403,
            "forbidden",
            "Only testees can flag realism on questions they were served.",
        )
    flag, created = await record_realism_flag(
        db,
        question_id=question_id,
        attempt_id=attempt_id,
        testee_id=user.id,
    )
    if created:
        await record_audit(
            db,
            actor_id=user.id,
            action="realism.flag",
            target_entity="question",
            target_id=question_id,
            detail={"attempt_id": str(attempt_id)},
        )
    await db.commit()
    return RealismFlagResult(
        realism_flag_id=flag.id,
        question_id=question_id,
        testee_id=user.id,
        created=created,
    )


@router.post("/admin/realism/aggregate", status_code=201)
async def realism_aggregate(
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> RealismAggregationResult:
    """Run one pass of the realism aggregation sweep synchronously
    (AC-D22 — "Feedback aggregation runs nightly and produces a
    'low-realism' question pool"). Admin-triggered in P9; the P11
    beat task wraps the same callable on a 24-hour schedule (mirrors
    P6 reconcile + P8 calibration sweep precedent).

    Audit-logged at ``realism.aggregate`` with the full telemetry
    dict so the operator can correlate a sweep with the resulting
    realism_flag_count changes on the dashboard."""
    telemetry = await aggregate_realism_flags(db)
    settings_row = (
        await db.execute(
            select(SystemSettings).where(SystemSettings.tenant_id == SEED_TENANT_ID)
        )
    ).scalar_one_or_none()
    if settings_row is not None:
        await record_audit(
            db,
            actor_id=admin.id,
            action="realism.aggregate",
            target_entity="system_settings",
            target_id=settings_row.id,
            detail=telemetry,
        )
    await db.commit()
    return RealismAggregationResult(**telemetry)


@router.get("/admin/realism/status")
async def realism_status_endpoint(
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> RealismStatusResponse:
    """Read-only telemetry roll-up for the FE-9 systems-page realism
    aggregation card (FE-9-admin-systems.md §H(a) item 8).

    Five fields per the locked spec contract: ``last_aggregated_at``,
    ``flags_processed_last_run``, ``below_threshold_count``,
    ``auto_suppressed_count``, ``total_flag_count_active``. No new
    persistence — every value derives from ``audit_log`` (the
    realism.aggregate row written by :func:`realism_aggregate`),
    ``question.realism_flag_count``, the ``anchor_question.excluded``
    + ``excluded_reason`` columns set by
    :func:`app.domain.drive_rag.aggregate_realism_flags`, and the
    ``realism_flag`` table itself."""
    return RealismStatusResponse(**await realism_status(db))


@router.get("/admin/drive/index")
async def drive_index(
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> DriveIndexStatus:
    """Read-only dashboard surface: chunk count + distinct file count
    + ``max(indexed_at)``. Operators inspect this to verify AC-D23
    step 4 actually completed and to spot a stale index (P11 wires
    the daily cron; until then this read confirms the operator's
    manual ``POST /v1/admin/drive/ingest`` did what they expected)."""
    return DriveIndexStatus(**await drive_index_status(db))
