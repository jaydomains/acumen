"""catalogue router — Subjects, Pills, safety auto-tag, discovery,
AI pill-proposal queue (AC-D7 / AC-D8 / AC-D14 / AC-D21).

Admin CRUD + lifecycle is role-gated (``require_role`` chain). Testee
discovery is privacy-acked but not admin (AC-D8 self-directed learning;
nothing self-registers). Persistence/queries live in
``app.domain.catalogue``; this router owns HTTP status + the CODE_SPEC
§5 envelopes only. (pending P3 -> built P3)
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import catalogue, learning_material
from app.models import AppUser, LearningMaterialSource, get_db
from app.permissions import (
    ROLE_ADMINISTRATOR,
    APIError,
    get_privacy_acked_user,
    require_role,
)
from app.schemas import (
    LearningMaterialResponse,
    Page,
    PageMeta,
    PillCreate,
    PillProposalResponse,
    PillResponse,
    PillSafetyOverride,
    PillUpdate,
    SafetyLinkResponse,
    SubjectCreate,
    SubjectResponse,
    SubjectUpdate,
)

router = APIRouter(prefix="/v1", tags=["catalogue"])

_require_admin = require_role(ROLE_ADMINISTRATOR)
_DEFAULT_LIMIT = catalogue.DEFAULT_PAGE_LIMIT
_MAX_LIMIT = catalogue.MAX_PAGE_LIMIT


def _not_found(entity: str) -> APIError:
    return APIError(404, "not_found", f"{entity} not found.")


# --- Subjects ---------------------------------------------------------


@router.post("/subjects", status_code=201)
async def create_subject(
    body: SubjectCreate,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> SubjectResponse:
    subject = await catalogue.create_subject(
        db, name=body.name, description=body.description
    )
    await db.commit()
    return SubjectResponse.model_validate(subject)


@router.get("/subjects")
async def list_subjects(
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
) -> Page[SubjectResponse]:
    rows, next_cursor = await catalogue.list_subjects(db, cursor=cursor, limit=limit)
    return Page[SubjectResponse](
        data=[SubjectResponse.model_validate(r) for r in rows],
        meta=PageMeta(next_cursor=next_cursor),
    )


@router.get("/subjects/{subject_id}")
async def get_subject(
    subject_id: uuid.UUID,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> SubjectResponse:
    subject = await catalogue.get_subject(db, subject_id)
    if subject is None:
        raise _not_found("Subject")
    return SubjectResponse.model_validate(subject)


@router.patch("/subjects/{subject_id}")
async def update_subject(
    subject_id: uuid.UUID,
    body: SubjectUpdate,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> SubjectResponse:
    subject = await catalogue.get_subject(db, subject_id)
    if subject is None:
        raise _not_found("Subject")
    subject = await catalogue.update_subject(
        db, subject, body.model_dump(exclude_unset=True)
    )
    await db.commit()
    return SubjectResponse.model_validate(subject)


@router.delete("/subjects/{subject_id}", status_code=204, response_class=Response)
async def delete_subject(
    subject_id: uuid.UUID,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    subject = await catalogue.get_subject(db, subject_id)
    if subject is None:
        raise _not_found("Subject")
    await catalogue.delete_subject(db, subject)
    await db.commit()
    return Response(status_code=204)


# --- Pills (admin CRUD + lifecycle) -----------------------------------


@router.post("/pills", status_code=201)
async def create_pill(
    body: PillCreate,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> PillResponse:
    if await catalogue.get_subject(db, body.subject_id) is None:
        raise APIError(422, "invalid_subject", "subject_id does not reference a subject.")
    pill = await catalogue.create_pill(
        db,
        subject_id=body.subject_id,
        name=body.name,
        description=body.description,
        available_difficulty_min=body.available_difficulty_min,
        available_difficulty_max=body.available_difficulty_max,
        discoverable=body.discoverable,
        estimated_minutes=body.estimated_minutes,
    )
    await db.commit()
    return PillResponse.model_validate(pill)


@router.get("/pills")
async def list_pills(
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
) -> Page[PillResponse]:
    rows, next_cursor = await catalogue.list_pills(db, cursor=cursor, limit=limit)
    return Page[PillResponse](
        data=[PillResponse.model_validate(r) for r in rows],
        meta=PageMeta(next_cursor=next_cursor),
    )


@router.get("/pills/{pill_id}")
async def get_pill(
    pill_id: uuid.UUID,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> PillResponse:
    pill = await catalogue.get_pill(db, pill_id)
    if pill is None:
        raise _not_found("Pill")
    return PillResponse.model_validate(pill)


@router.patch("/pills/{pill_id}")
async def update_pill(
    pill_id: uuid.UUID,
    body: PillUpdate,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> PillResponse:
    pill = await catalogue.get_pill(db, pill_id)
    if pill is None:
        raise _not_found("Pill")
    fields = body.model_dump(exclude_unset=True)
    lo = fields.get("available_difficulty_min", pill.available_difficulty_min)
    hi = fields.get("available_difficulty_max", pill.available_difficulty_max)
    if lo > hi:
        raise APIError(
            422,
            "invalid_difficulty_range",
            "available_difficulty_min must be <= available_difficulty_max",
        )
    pill = await catalogue.update_pill(db, pill, fields)
    await db.commit()
    return PillResponse.model_validate(pill)


@router.delete("/pills/{pill_id}", status_code=204, response_class=Response)
async def delete_pill(
    pill_id: uuid.UUID,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> Response:
    pill = await catalogue.get_pill(db, pill_id)
    if pill is None:
        raise _not_found("Pill")
    await catalogue.delete_pill(db, pill)
    await db.commit()
    return Response(status_code=204)


@router.post("/pills/{pill_id}/retire")
async def retire_pill(
    pill_id: uuid.UUID,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> PillResponse:
    pill = await catalogue.get_pill(db, pill_id)
    if pill is None:
        raise _not_found("Pill")
    pill = await catalogue.retire_pill(db, pill, actor_id=admin.id)
    await db.commit()
    return PillResponse.model_validate(pill)


@router.patch("/pills/{pill_id}/safety")
async def override_pill_safety(
    pill_id: uuid.UUID,
    body: PillSafetyOverride,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> PillResponse:
    pill = await catalogue.get_pill(db, pill_id)
    if pill is None:
        raise _not_found("Pill")
    pill = await catalogue.override_pill_safety(
        db, pill, safety_relevant=body.safety_relevant, actor_id=admin.id
    )
    await db.commit()
    return PillResponse.model_validate(pill)


# --- Testee self-directed learning material (AC-D8) -------------------
# AC-D8 explicitly authorises Testees to "self-select pills to drive
# their own learning" with "AI tests and learning material targeted at
# those pills". The test-generation half has been wired since P5; this
# endpoint closes the learning-material half. Domain layer owns the
# cache window, the safety-pill branch (AC-D21 curated external links),
# and audit-logging; this handler is router-thin.


@router.post("/pills/{pill_id}/learning-material")
async def request_pill_learning_material(
    pill_id: uuid.UUID,
    user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
    regenerate: bool = Query(default=False),
) -> LearningMaterialResponse:
    material, cached, links = await learning_material.generate_self_initiated(
        db,
        pill_id=pill_id,
        testee_user=user,
        regenerate=regenerate,
    )
    safety_links: list[SafetyLinkResponse] | None = None
    if material.source == LearningMaterialSource.curated_safety_links:
        safety_links = [SafetyLinkResponse.model_validate(r) for r in links]
    await db.commit()
    return LearningMaterialResponse(
        id=material.id,
        pill_id=material.pill_id,
        source=material.source.value,
        content=material.content,
        safety_links=safety_links,
        served_at=material.served_at,
        created_at=material.created_at,
        cached=cached,
    )


# --- Testee discovery (AC-D8) -----------------------------------------


@router.get("/catalogue/pills")
async def discover_pills(
    _user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
    subject_id: uuid.UUID | None = Query(default=None),
    difficulty: int | None = Query(default=None, ge=1, le=10),
    search: str | None = Query(default=None, max_length=255),
) -> Page[PillResponse]:
    rows, next_cursor = await catalogue.list_discoverable_pills(
        db,
        cursor=cursor,
        limit=limit,
        subject_id=subject_id,
        difficulty=difficulty,
        search=search,
    )
    return Page[PillResponse](
        data=[PillResponse.model_validate(r) for r in rows],
        meta=PageMeta(next_cursor=next_cursor),
    )


@router.get("/catalogue/pills/{pill_id}")
async def get_discoverable_pill_detail(
    pill_id: uuid.UUID,
    _user: AppUser = Depends(get_privacy_acked_user),
    db: AsyncSession = Depends(get_db),
) -> PillResponse:
    """Testee-facing single-pill detail (AC-D8). Mirrors the discovery
    list filter — non-discoverable and retired pills 404 here just as
    they hide from the list."""
    pill = await catalogue.get_discoverable_pill(db, pill_id)
    if pill is None:
        raise _not_found("Pill")
    return PillResponse.model_validate(pill)


# --- AI pill-proposal queue (AI stubbed) ------------------------------


@router.post("/pill-proposals", status_code=201)
async def create_pill_proposal(
    body: PillCreate,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> PillProposalResponse:
    task = await catalogue.enqueue_pill_proposal(
        db,
        subject_id=body.subject_id,
        name=body.name,
        description=body.description,
        available_difficulty_min=body.available_difficulty_min,
        available_difficulty_max=body.available_difficulty_max,
        estimated_minutes=body.estimated_minutes,
    )
    await db.commit()
    return PillProposalResponse(
        id=task.id,
        status=task.status.value,
        payload=task.payload,
        created_at=task.created_at,
    )


@router.get("/pill-proposals")
async def list_pill_proposals(
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
    cursor: str | None = Query(default=None),
    limit: int = Query(default=_DEFAULT_LIMIT, ge=1, le=_MAX_LIMIT),
) -> Page[PillProposalResponse]:
    rows, next_cursor = await catalogue.list_pill_proposals(
        db, cursor=cursor, limit=limit
    )
    return Page[PillProposalResponse](
        data=[
            PillProposalResponse(
                id=t.id,
                status=t.status.value,
                payload=t.payload,
                created_at=t.created_at,
            )
            for t in rows
        ],
        meta=PageMeta(next_cursor=next_cursor),
    )


@router.post("/pill-proposals/{proposal_id}/approve", status_code=201)
async def approve_pill_proposal(
    proposal_id: uuid.UUID,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> PillResponse:
    task = await catalogue.get_pill_proposal(db, proposal_id)
    if task is None:
        raise _not_found("Pill proposal")
    if task.status.value != "pending":
        raise APIError(409, "proposal_not_pending", "This proposal is already resolved.")
    pill = await catalogue.approve_pill_proposal(db, task, actor_id=admin.id)
    await db.commit()
    return PillResponse.model_validate(pill)


@router.post("/pill-proposals/{proposal_id}/reject")
async def reject_pill_proposal(
    proposal_id: uuid.UUID,
    admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
    reason: str | None = Query(default=None, max_length=1024),
) -> PillProposalResponse:
    task = await catalogue.get_pill_proposal(db, proposal_id)
    if task is None:
        raise _not_found("Pill proposal")
    if task.status.value != "pending":
        raise APIError(409, "proposal_not_pending", "This proposal is already resolved.")
    task = await catalogue.reject_pill_proposal(
        db, task, actor_id=admin.id, reason=reason
    )
    await db.commit()
    return PillProposalResponse(
        id=task.id,
        status=task.status.value,
        payload=task.payload,
        created_at=task.created_at,
    )
