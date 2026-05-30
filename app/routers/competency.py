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

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import assignments as assignment_domain
from app.domain import competence as competence_domain
from app.models import AppUser, Assignment, get_db
from app.permissions import get_privacy_acked_user
from app.schemas import (
    AssignmentResponse,
    MeCompetencePill,
    MeCompetenceResponse,
    Page,
    PageMeta,
)

router = APIRouter(prefix="/v1/me", tags=["me"])

_DEFAULT_LIMIT = assignment_domain.DEFAULT_PAGE_LIMIT
_MAX_LIMIT = assignment_domain.MAX_PAGE_LIMIT


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


def _assignment_response(
    assignment: Assignment, assignee_ids: list[uuid.UUID]
) -> AssignmentResponse:
    return AssignmentResponse(
        id=assignment.id,
        assigner_id=assignment.assigner_id,
        pill_id=assignment.pill_id,
        learning_path_id=assignment.learning_path_id,
        difficulty=assignment.difficulty,
        deadline=assignment.deadline,
        is_mandatory=assignment.is_mandatory,
        loop_mode=assignment.loop_mode,
        assignee_ids=assignee_ids,
        created_at=assignment.created_at,
        updated_at=assignment.updated_at,
    )


@router.get("/assignments")
async def list_my_assignments(
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
) -> Page[AssignmentResponse]:
    """The current Testee's own assignments — every assignment they are a
    snapshotted assignee of, whether targeted directly or resolved through
    a group at creation (``assignment_assignee`` deduplicates the two; see
    ``app.domain.assignments.create_assignment``). Any authed,
    privacy-acked user reads only their own assignments; this is the
    canonical ``/v1/me/*`` surface mirroring the testee branch of
    ``GET /v1/assignments`` (AC-D15)."""
    rows, next_cursor, count = await assignment_domain.list_assignments(
        db, cursor=cursor, limit=limit, assignee_id=user.id
    )
    return Page[AssignmentResponse](
        data=[_assignment_response(a, ids) for a, ids in rows],
        meta=PageMeta(next_cursor=next_cursor, count=count),
    )
