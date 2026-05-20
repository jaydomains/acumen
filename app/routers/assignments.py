"""assignments router — assign to Testee/Group (AC-D15); list/get/
withdraw (AC-D6 / AC-D26).

Admin creates and withdraws assignments and lists everything; a Testee
lists and reads only assignments they are a snapshotted assignee of.
The derived ``engagement_status`` surface + reminder/escalation sweep
land in P4 Slice 3. Persistence lives in ``app.domain.assignments``;
routers stay thin (CODE_SPEC §2/§3).
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import assignments as assignment_domain
from app.domain import catalogue
from app.models import AppUser, Assignment, get_db
from app.permissions import (
    ROLE_ADMINISTRATOR,
    APIError,
    get_privacy_acked_user,
    require_role,
)
from app.schemas import AssignmentCreate, AssignmentResponse, Page, PageMeta

router = APIRouter(prefix="/v1/assignments", tags=["assignments"])

_require_admin = require_role(ROLE_ADMINISTRATOR)
_DEFAULT_LIMIT = assignment_domain.DEFAULT_PAGE_LIMIT
_MAX_LIMIT = assignment_domain.MAX_PAGE_LIMIT


def _response(
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


@router.post("", status_code=201)
async def create_assignment(
    body: AssignmentCreate,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> AssignmentResponse:
    if body.pill_id is not None and await catalogue.get_pill(db, body.pill_id) is None:
        raise APIError(422, "invalid_pill", "pill_id does not reference a pill.")
    if (
        body.learning_path_id is not None
        and await catalogue.get_path(db, body.learning_path_id) is None
    ):
        raise APIError(
            422, "invalid_learning_path", "learning_path_id does not reference a path."
        )
    assignment = await assignment_domain.create_assignment(
        db,
        actor_id=admin.id,
        pill_id=body.pill_id,
        learning_path_id=body.learning_path_id,
        difficulty=body.difficulty,
        deadline=body.deadline,
        is_mandatory=body.is_mandatory,
        loop_mode=body.loop_mode,
        testee_ids=body.testee_ids,
        group_ids=body.group_ids,
    )
    await db.commit()
    return _response(assignment, await assignment_domain.assignee_ids(db, assignment.id))


@router.get("")
async def list_assignments(
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
    assigner_id: uuid.UUID | None = Query(default=None),
) -> Page[AssignmentResponse]:
    if user.role == ROLE_ADMINISTRATOR:
        rows, next_cursor = await assignment_domain.list_assignments(
            db, cursor=cursor, limit=limit, assigner_id=assigner_id
        )
    else:
        rows, next_cursor = await assignment_domain.list_assignments(
            db, cursor=cursor, limit=limit, assignee_id=user.id
        )
    return Page[AssignmentResponse](
        data=[_response(a, ids) for a, ids in rows],
        meta=PageMeta(next_cursor=next_cursor),
    )


@router.get("/{assignment_id}")
async def get_assignment(
    assignment_id: uuid.UUID,
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> AssignmentResponse:
    assignment = await assignment_domain.get_assignment(db, assignment_id)
    if assignment is None:
        raise APIError(404, "not_found", "Assignment not found.")
    ids = await assignment_domain.assignee_ids(db, assignment_id)
    if user.role != ROLE_ADMINISTRATOR and user.id not in ids:
        raise APIError(404, "not_found", "Assignment not found.")
    return _response(assignment, ids)


@router.delete("/{assignment_id}", status_code=204, response_class=Response)
async def withdraw_assignment(
    assignment_id: uuid.UUID,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    assignment = await assignment_domain.get_assignment(db, assignment_id)
    if assignment is None:
        raise APIError(404, "not_found", "Assignment not found.")
    await assignment_domain.withdraw_assignment(db, assignment, actor_id=admin.id)
    await db.commit()
    return Response(status_code=204)
