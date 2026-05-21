"""calibration router — anchor calibration confidence display (AC-D20).

CODE_SPEC §12 / AC-D27 #3. Surfaces the ``preliminary -> confident``
state per (pill, band) for the admin Competency View. Admin-only;
read-only; no audit log (the underlying calibration sweep + the
resolve actions in :mod:`app.routers.admin` carry the audit trail).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.calibration import band_calibration_state
from app.models import AppUser, get_db
from app.permissions import ROLE_ADMINISTRATOR, require_role
from app.schemas import BandCalibrationState

router = APIRouter(prefix="/v1/calibration", tags=["calibration"])

_require_admin = require_role(ROLE_ADMINISTRATOR)


@router.get("/pills/{pill_id}/bands/{band}")
async def band_state(
    pill_id: uuid.UUID,
    band: int,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> BandCalibrationState:
    """``preliminary -> confident`` display state for one (pill, band)
    (AC-D27 #3 / AC-D20). Returns ``state='preliminary'`` when the
    aggregate observation count is below
    ``system_settings.anchor_calibration_confidence_threshold``
    (default 20), ``state='confident'`` once it crosses (inclusive
    boundary)."""
    return BandCalibrationState(**await band_calibration_state(db, pill_id, band))
