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

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.catalogue import record_audit
from app.domain.drive_rag import ingest_drive_folder
from app.models import SEED_TENANT_ID, AppUser, SystemSettings, get_db
from app.permissions import ROLE_ADMINISTRATOR, require_role
from app.schemas import DriveIngestResult

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
