"""paths router — Learning Paths (admin curation, AC-D7/AC-D8).

Admin-curated ordered pill bundles. Personal Testee paths (``is_private``
+ ``owner_user_id``) reuse the same model and are introduced when the
self-directed flow needs them; P3 builds the admin-curated surface.
Persistence lives in ``app.domain.catalogue``. CODE_SPEC §3.
(pending P3 -> built P3)
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import catalogue
from app.models import AppUser, get_db
from app.permissions import ROLE_ADMINISTRATOR, APIError, require_role
from app.schemas import (
    LearningPathCreate,
    LearningPathResponse,
    LearningPathUpdate,
    Page,
    PageMeta,
)

router = APIRouter(prefix="/v1/learning-paths", tags=["paths"])

_require_admin = require_role(ROLE_ADMINISTRATOR)
_DEFAULT_LIMIT = catalogue.DEFAULT_PAGE_LIMIT
_MAX_LIMIT = catalogue.MAX_PAGE_LIMIT


def _response(path: object, pill_ids: list[uuid.UUID]) -> LearningPathResponse:
    return LearningPathResponse(
        id=path.id,  # type: ignore[attr-defined]
        name=path.name,  # type: ignore[attr-defined]
        description=path.description,  # type: ignore[attr-defined]
        is_private=path.is_private,  # type: ignore[attr-defined]
        owner_user_id=path.owner_user_id,  # type: ignore[attr-defined]
        pill_ids=pill_ids,
        created_at=path.created_at,  # type: ignore[attr-defined]
        updated_at=path.updated_at,  # type: ignore[attr-defined]
    )


async def _validate_pills(db: AsyncSession, pill_ids: list[uuid.UUID]) -> None:
    for pid in pill_ids:
        if await catalogue.get_pill(db, pid) is None:
            raise APIError(
                422, "invalid_pill", f"pill_ids references unknown pill {pid}."
            )


@router.post("", status_code=201)
async def create_path(
    body: LearningPathCreate,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> LearningPathResponse:
    await _validate_pills(db, body.pill_ids)
    path, pill_ids = await catalogue.create_path(
        db,
        name=body.name,
        description=body.description,
        pill_ids=body.pill_ids,
    )
    await db.commit()
    return _response(path, pill_ids)


@router.get("")
async def list_paths(
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
) -> Page[LearningPathResponse]:
    rows, next_cursor = await catalogue.list_paths(db, cursor=cursor, limit=limit)
    return Page[LearningPathResponse](
        data=[_response(p, ids) for p, ids in rows],
        meta=PageMeta(next_cursor=next_cursor),
    )


@router.get("/{path_id}")
async def get_path(
    path_id: uuid.UUID,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> LearningPathResponse:
    found = await catalogue.get_path(db, path_id)
    if found is None:
        raise APIError(404, "not_found", "Learning path not found.")
    return _response(*found)


@router.patch("/{path_id}")
async def update_path(
    path_id: uuid.UUID,
    body: LearningPathUpdate,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> LearningPathResponse:
    found = await catalogue.get_path(db, path_id)
    if found is None:
        raise APIError(404, "not_found", "Learning path not found.")
    if body.pill_ids is not None:
        await _validate_pills(db, body.pill_ids)
    fields = body.model_dump(exclude_unset=True, exclude={"pill_ids"})
    path, pill_ids = await catalogue.update_path(db, found[0], fields, body.pill_ids)
    await db.commit()
    return _response(path, pill_ids)


@router.delete("/{path_id}", status_code=204, response_class=Response)
async def delete_path(
    path_id: uuid.UUID,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    found = await catalogue.get_path(db, path_id)
    if found is None:
        raise APIError(404, "not_found", "Learning path not found.")
    await catalogue.delete_path(db, found[0])
    await db.commit()
    return Response(status_code=204)
