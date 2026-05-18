"""P3 unit: ``safety_links.auto_tag_safety`` branch coverage (AC-D21).

Keyword hit (single + multi-word), miss, the proposing-AI
self-classification short-circuit, and the no-settings-row fallback.
Zero-DB / zero-network: a tiny in-memory session (AC-CD15)."""

from __future__ import annotations

from app import permissions as p
from app.domain.safety_links import auto_tag_safety
from app.models import SystemSettings
from tests.integration.conftest import CatalogueFakeSession


def _session(keywords: list[str] | None) -> CatalogueFakeSession:
    s = CatalogueFakeSession()
    if keywords is not None:
        s.add(SystemSettings(tenant_id=p.SEED_TENANT_ID, safety_keyword_list=keywords))
    return s


async def test_single_word_keyword_hit() -> None:
    s = _session(["asbestos", "scaffold"])
    assert await auto_tag_safety("Asbestos removal", "site work", s) is True


async def test_multi_word_keyword_hit() -> None:
    s = _session(["confined space"])
    assert (
        await auto_tag_safety("Entry permits", "working in a confined space", s) is True
    )


async def test_keyword_miss() -> None:
    s = _session(["asbestos"])
    assert await auto_tag_safety("Spreadsheets", "pivot tables", s) is False


async def test_ai_classification_short_circuits() -> None:
    s = _session(None)  # no settings row at all
    assert (
        await auto_tag_safety("Benign", "nothing here", s, ai_safety_classification=True)
        is True
    )


async def test_no_settings_row_falls_back_to_no_keywords() -> None:
    s = _session(None)
    assert await auto_tag_safety("Asbestos", "danger", s) is False
