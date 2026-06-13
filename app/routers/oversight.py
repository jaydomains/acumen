"""oversight router — admin retroactive-oversight dashboard READ API (AC-CD26, E1).

Thin (AC-CD2): authz + query validation + envelope only; every read +
aggregation lives in :mod:`app.domain.oversight`. Admin-role-gated (AC-CD5) — the
autonomous pipeline has no human pre-publish gate (AC-D31), so this is the
*retroactive* governance surface (SPEC §4.11 / §6.5): observe recent publishes,
each item's provenance chain, the source-authority breakdown, and a low-
confidence-weighted spot-check sample. The rollback matrix (the *rein-in* writes)
+ the ``demoted_sources`` source-override layer are E2; this half is read-only.

Zero-network (AC-CD15 — pure DB reads, no AI call).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import oversight
from app.models import AppUser, get_db
from app.permissions import ROLE_ADMINISTRATOR, require_role

router = APIRouter(prefix="/v1/admin/oversight", tags=["admin"])

_require_admin = require_role(ROLE_ADMINISTRATOR)


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
