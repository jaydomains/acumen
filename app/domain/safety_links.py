"""Safety auto-tag + (P11) external link curation (AC-D21).

P3 owns the **auto-tag** half: a pill is ``safety_relevant`` when
either signal fires —

  (a) keyword detection on the pill name/description against the
      tenant-configured ``system_settings.safety_keyword_list`` (loaded
      from the row, never hard-coded — ROADMAP P3 risk note), or
  (b) the proposing AI's self-classification when the pill came from the
      AC-D7/AC-D8 proposal queue (passed in by the caller).

The link-curation / monthly link-check half (web search, broken-link
and drift detection) is **P11**; no external fetch happens in P3.
CODE_SPEC §3. AC-D21.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import SEED_TENANT_ID, SystemSettings


async def _safety_keywords(db: AsyncSession) -> list[str]:
    """Tenant safety keyword list from ``system_settings`` (AC-D21).

    Seeded with v1.3 defaults by migration 0002; configurable per
    tenant. Falls back to an empty list only if no settings row exists
    (so the AI-signal path still works in isolation)."""
    result = await db.execute(
        select(SystemSettings).where(SystemSettings.tenant_id == SEED_TENANT_ID)
    )
    settings = result.scalar_one_or_none()
    if settings is None:
        return []
    return [str(k).lower() for k in (settings.safety_keyword_list or [])]


async def auto_tag_safety(
    name: str,
    description: str | None,
    db: AsyncSession,
    *,
    ai_safety_classification: bool | None = None,
) -> bool:
    """Return whether a pill is safety-relevant (AC-D21).

    Keyword signal OR the proposing AI's self-classification. Substring,
    case-insensitive match on name + description so multi-word cues
    ("confined space", "high voltage") and embedded mentions are caught.
    """
    if ai_safety_classification:
        return True
    haystack = f"{name} {description or ''}".lower()
    return any(keyword in haystack for keyword in await _safety_keywords(db))
