"""competency router — testee /v1/me/* surface (FE-7 profile).

Slice B B.4 lights this file up: ``GET /v1/me/competence`` returns the
per-pill competency snapshot the FE-7 constellation + matrix consume.
The handler stays thin (CODE_SPEC §2/§3); the join+derivation logic
lives in :func:`app.domain.competence.list_me_competence`.

Pre-slice-B this file was an unmounted placeholder ("port seam: future
Testee-facing competence dashboard"). Slice B is that dashboard's first
endpoint; the file is now mounted via ``app.main``.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import competence as competence_domain
from app.models import AppUser, get_db
from app.permissions import get_privacy_acked_user
from app.schemas import MeCompetencePill, MeCompetenceResponse

router = APIRouter(prefix="/v1/me", tags=["me"])


@router.get("/competence")
async def get_my_competence(
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> MeCompetenceResponse:
    """Testee's own per-pill competency profile. Empty
    ``{ "pills": [] }`` for a testee with no CompetencyProfile rows
    (new account)."""
    rows = await competence_domain.list_me_competence(db, user.id)
    return MeCompetenceResponse(
        pills=[MeCompetencePill(**row) for row in rows],
    )
