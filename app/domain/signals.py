"""Coverage-gap signal capture (SPEC §5 GapSignal / §6.5, D1-D2) — the spine.

Persists the three §6.5 coverage-gap signals into the single polymorphic
``GapSignal`` store the D3 gap-detection sweep consumes. This is the
**signal-layer arm** of the three-arm dedup (persistence-layer is B3's
``(topic, gap_signal)`` guard; gap-detection-layer is D3's sweep): repeat
signals on the same ``(signal_type, dedup_key)`` collapse onto one row with an
incremented ``occurrence_count`` so the sweep can weight a topic by its
accumulated misses.

Scope (D1-D2): capture + dedup of the two signals whose source flows already
exist — **discovery-miss** (a Testee search returning no good match) and
**question-tag** (under-covered tags from generated questions). The
``scope_clarification`` *type* exists (forward-ready) but its capture waits on
the admin assignment-clarification feature (signal-3, deferred). NOT here: the
gap-detection sweep / clustering / generation trigger (D3); the crons (D4).
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SEED_TENANT_ID, GapSignal, GapSignalType


def _normalize(text: str) -> str:
    """Normalized dedup key — lowercased, whitespace-collapsed — so ``"Welding "``
    and ``"welding"`` collapse onto one signal-layer row + cluster uniformly."""
    return " ".join(text.lower().split())


async def _upsert_signal(
    db: AsyncSession,
    *,
    signal_type: GapSignalType,
    dedup_key: str,
    detail: dict | None,
    source_ref: uuid.UUID | None = None,
) -> GapSignal:
    """Signal-layer dedup (first arm): an unconsumed signal on the same
    ``(signal_type, dedup_key)`` increments ``occurrence_count`` rather than
    inserting a duplicate; otherwise a fresh row is created. (A *consumed*
    signal — already clustered by a D3 sweep — does not absorb new occurrences;
    a later miss starts a fresh signal.) Iterates in Python to match the
    zero-DB test-session harness."""
    result = await db.execute(
        select(GapSignal).where(GapSignal.tenant_id == SEED_TENANT_ID)
    )
    for row in result.scalars().all():
        if (
            row.signal_type == signal_type
            and row.dedup_key == dedup_key
            and row.consumed_at is None
        ):
            row.occurrence_count += 1
            if detail is not None:
                row.detail = detail
            return row
    signal = GapSignal(
        tenant_id=SEED_TENANT_ID,
        signal_type=signal_type,
        dedup_key=dedup_key,
        detail=detail,
        source_ref=source_ref,
        occurrence_count=1,
    )
    db.add(signal)
    return signal


async def capture_discovery_miss(
    db: AsyncSession,
    *,
    search: str,
    result_count: int,
    testee_ref: uuid.UUID | None = None,
) -> GapSignal:
    """Record a Testee discovery search that returned no good match (§6.5
    ``discovery_miss``) — deduped on the normalized search term."""
    return await _upsert_signal(
        db,
        signal_type=GapSignalType.discovery_miss,
        dedup_key=_normalize(search),
        detail={"search": search, "result_count": result_count},
        source_ref=testee_ref,
    )


async def capture_question_tag(
    db: AsyncSession,
    *,
    tag: str,
    source_ref: uuid.UUID | None = None,
) -> GapSignal:
    """Record an under-covered / frequently-tagged topic from recent generated
    questions (§6.5 ``question_tag``) — deduped on the normalized tag."""
    return await _upsert_signal(
        db,
        signal_type=GapSignalType.question_tag,
        dedup_key=_normalize(tag),
        detail={"tag": tag},
        source_ref=source_ref,
    )
