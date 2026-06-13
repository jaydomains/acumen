"""oversight router — admin retroactive-oversight dashboard API (AC-CD26, E1+E2).

Thin (AC-CD2): authz + validation + envelope only; every read/aggregation +
rollback lives in :mod:`app.domain.oversight`. Admin-role-gated (AC-CD5) — the
autonomous pipeline has no human pre-publish gate (AC-D31), so this is the
*retroactive* governance surface (SPEC §4.11 / §6.5): **observe** (E1) recent
publishes, each item's provenance chain, the source-authority breakdown, and a
low-confidence-weighted spot-check sample; and **rein in** (E2) via the rollback
matrix (per pill / question / batch / source — retract-not-delete) + the
relocated AC-D21 safety-tag override. Per-source rollback writes a durable
``demoted_sources`` demotion (DS13-a). Writes commit explicitly (``get_db`` does
not auto-commit).

Zero-network (AC-CD15 — no AI call).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import oversight
from app.models import AppUser, get_db
from app.permissions import ROLE_ADMINISTRATOR, require_role

router = APIRouter(prefix="/v1/admin/oversight", tags=["admin"])

_require_admin = require_role(ROLE_ADMINISTRATOR)


class _RollbackRequest(BaseModel):
    """Optional audited reason for a rollback (AC-D14 / §290)."""

    reason: str | None = None


class _SourceRollbackRequest(BaseModel):
    """Per-source rollback target + optional reason."""

    source_host: str
    reason: str | None = None


class _SafetyOverrideRequest(BaseModel):
    """The relocated AC-D21 retroactive safety-tag retoggle."""

    value: bool


@router.get("/publishes")
async def list_recent_publishes(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    low_confidence: bool | None = Query(None),
    since: datetime | None = Query(None),
    subject_id: UUID | None = Query(None),
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Recent autonomous publishes (AC-CD26 read facet 1 + confidence facet):
    newest-first, paginated, filterable by ``low_confidence`` / ``since`` /
    ``subject_id``. Each row embeds the confidence score + the three AC-D30
    per-pass verdicts + the retired (rolled-back) flag."""
    return await oversight.recent_publishes(
        db,
        limit=limit,
        offset=offset,
        low_confidence=low_confidence,
        since=since,
        subject_id=subject_id,
    )


@router.get("/publishes/{pill_id}/provenance")
async def get_item_provenance(
    pill_id: UUID,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Per-item provenance (AC-CD26 read facet 2): the claim → corpus source →
    AC-D28 authority-tier chain for one published pill. Empty ``claims`` for a
    publish with no corpus grounding (a refiner proposal)."""
    return await oversight.item_provenance(db, pill_id=pill_id)


@router.get("/source-authority")
async def get_source_authority_breakdown(
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Source-authority breakdown (AC-CD26 read facet 3 — the rein-in radar):
    live-catalogue grounding aggregated by authority tier + source host."""
    return await oversight.source_authority_breakdown(db)


@router.get("/spot-check")
async def get_spotcheck_sample(
    n: int = Query(10, ge=1, le=100),
    bias: str = Query("low_confidence"),
    seed: int | None = Query(None),
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Spot-check sample (AC-CD26 read facet 4): a deterministic (seeded),
    low-confidence-weighted sample of recent publishes for retroactive review."""
    sample = await oversight.sample_for_spotcheck(db, n=n, bias=bias, seed=seed)
    return {"sample": sample, "n": n, "bias": bias, "seed": seed}


# --- Rollback matrix + safety override (E2 — AC-CD26 rollback half) ----
# Admin-gated writes; the authenticated admin is the audited actor. Each
# commits explicitly (``get_db`` does not auto-commit) so the retire/exclude +
# audit + (per-source) demotion persist.


@router.post("/publishes/{pill_id}/rollback")
async def post_rollback_pill(
    pill_id: UUID,
    body: _RollbackRequest | None = None,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Per-pill rollback (AC-CD26): retire the published pill (retain + audit)."""
    result = await oversight.rollback_pill(
        db,
        pill_id=pill_id,
        reason=body.reason if body else None,
        actor_id=_admin.id,
    )
    await db.commit()
    return result


@router.post("/questions/{question_id}/rollback")
async def post_rollback_question(
    question_id: UUID,
    body: _RollbackRequest | None = None,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Per-question rollback (AC-CD26): exclude a generated anchor question."""
    result = await oversight.rollback_question(
        db,
        question_id=question_id,
        reason=body.reason if body else None,
        actor_id=_admin.id,
    )
    await db.commit()
    return result


@router.post("/batches/{batch_id}/rollback")
async def post_rollback_batch(
    batch_id: str,
    body: _RollbackRequest | None = None,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Per-batch rollback (AC-CD26): retire every pill of the B3 batch."""
    result = await oversight.rollback_batch(
        db,
        batch_id=batch_id,
        reason=body.reason if body else None,
        actor_id=_admin.id,
    )
    await db.commit()
    return result


@router.post("/sources/rollback")
async def post_rollback_source(
    body: _SourceRollbackRequest,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Per-source rollback (AC-CD26): retract the pills a discredited source
    grounded + write a durable ``denied`` demotion (DS13-a)."""
    result = await oversight.rollback_source(
        db,
        source_host=body.source_host,
        reason=body.reason,
        actor_id=_admin.id,
    )
    await db.commit()
    return result


@router.post("/publishes/{pill_id}/safety-override")
async def post_safety_override(
    pill_id: UUID,
    body: _SafetyOverrideRequest,
    _admin: AppUser = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Relocated AC-D21 retroactive safety-tag override."""
    result = await oversight.override_safety_relevant(
        db,
        pill_id=pill_id,
        value=body.value,
        actor_id=_admin.id,
    )
    await db.commit()
    return result
