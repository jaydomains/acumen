"""P11 Slice 4 — :func:`generate_anchor_pool_for_pill` ``top_up=True``
mode (AC-D23 idempotent anchor pool).

The default ``top_up=False`` keeps the existing P8 admin-endpoint
contract (409 ``anchors_exist`` when any rows exist). The new
``top_up=True`` mode computes per-band live-anchor counts (excluding
``excluded=True`` rows) and generates only the deficit to reach
``anchor_pool_size_per_band``. A pill already at quota is a
counter-zero no-op — the AC-CD7 idempotency contract the bootstrap
orchestrator relies on.

Zero-DB / zero-network (AC-CD15).
"""

from __future__ import annotations

import json
import uuid
from typing import Any

import pytest

from app.ai.provider import Operation
from app.domain.calibration import generate_anchor_pool_for_pill
from app.models import (
    SEED_TENANT_ID,
    AnchorQuestion,
    Pill,
    Question,
    QuestionType,
    Subject,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    RecordingProvider,
)


def _subject(session: CatalogueFakeSession) -> Subject:
    subject = Subject(tenant_id=SEED_TENANT_ID, name="ops", description=None)
    session.add(subject)
    return subject


def _pill(
    session: CatalogueFakeSession,
    *,
    subject_id: uuid.UUID,
    band_min: int = 5,
    band_max: int = 5,
) -> Pill:
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=subject_id,
        name="P",
        description=None,
        available_difficulty_min=band_min,
        available_difficulty_max=band_max,
        discoverable=True,
        safety_relevant=False,
    )
    session.add(pill)
    return pill


def _existing_anchor(
    session: CatalogueFakeSession,
    *,
    pill_id: uuid.UUID,
    band: int,
    excluded: bool = False,
) -> AnchorQuestion:
    """Seed a live (or excluded) anchor row at ``band`` for the pill.
    Mirrors the shape ``_stamp_anchor_pair`` writes — a paired
    Question row at the shared PK + an AnchorQuestion row."""
    anchor_id = uuid.uuid4()
    question = Question(
        id=anchor_id,
        tenant_id=SEED_TENANT_ID,
        pill_id=pill_id,
        type=QuestionType.true_false,
        config={"prompt": "p", "correct": True},
        assigned_difficulty=band,
        realism_flag_count=0,
        ai_provider="anthropic",
        ai_model="claude-sonnet-4-6",
        ai_prompt_tokens=10,
        ai_completion_tokens=5,
        ai_cost_usd=0.001,
        ai_prompt_version="1.0",
    )
    session.add(question)
    anchor = AnchorQuestion(
        id=anchor_id,
        tenant_id=SEED_TENANT_ID,
        pill_id=pill_id,
        band=band,
        type=QuestionType.true_false,
        config={"prompt": "p", "correct": True},
        assigned_difficulty=band,
        effective_difficulty=float(band),
        excluded=excluded,
        needs_admin_attention=excluded,
        ai_provider="anthropic",
        ai_model="claude-sonnet-4-6",
        ai_prompt_tokens=10,
        ai_completion_tokens=5,
        ai_cost_usd=0.001,
        ai_prompt_version="1.0",
    )
    session.add(anchor)
    return anchor


def _ok_review(operation: Any, payload: dict[str, Any]) -> Any:
    """Canned reviewer that confirms every anchor (verdict=ok). The
    self-review payload echoes the anchor id per the AC-D23 prompt
    contract."""
    return None  # set via set_response_fn below


def _seed_settings_with_small_pool(
    session: CatalogueFakeSession, pool_size: int = 3
) -> None:
    """Seed system_settings with a small anchor_pool_size_per_band so
    tests can exhaustively cover the deficit math without waiting for
    20 generations per band."""
    from app.models import SystemSettings

    session.add(
        SystemSettings(
            tenant_id=SEED_TENANT_ID,
            anchor_pool_size_per_band=pool_size,
        )
    )


def _wire_recording_provider(
    monkeypatch: pytest.MonkeyPatch, recording: RecordingProvider
) -> None:
    """Substitute the module-level Anthropic + OpenAI singletons with
    the recording provider for the duration of one test, so the
    anchor generator's ``resolve_provider`` calls land on the fake."""
    monkeypatch.setattr("app.ai.provider._ANTHROPIC", recording)
    monkeypatch.setattr("app.ai.provider._OPENAI", recording)

    # generation returns one question spec; review returns verdict=ok
    # mirroring the AC-D23 self-review prompt contract.
    def _gen_fn(payload: dict[str, Any]) -> dict[str, Any]:
        # Echo the requested band into ``assigned_difficulty`` so
        # ``_stamp_anchor_pair`` writes the row at the expected
        # difficulty (the per-band deficit math reads this field).
        band = int(payload.get("target_difficulty", 5))
        return {
            "questions": [
                {
                    "type": "true_false",
                    "assigned_difficulty": band,
                    "config": {"prompt": "Sample.", "correct": True},
                }
            ]
        }

    recording.set_response_fn(Operation.generation, _gen_fn)

    def _review_fn(payload: dict[str, Any]) -> dict[str, Any]:
        # The anchor self-review payload carries ``items_json`` (a JSON
        # string) per the AC-D23 prompt template, NOT a parsed list.
        items_raw = payload.get("items_json") or "[]"
        items = json.loads(items_raw) if isinstance(items_raw, str) else items_raw
        return {
            "items": [
                {"anchor_question_id": item["anchor_question_id"], "verdict": "ok"}
                for item in items
            ]
        }

    recording.set_response_fn(Operation.anchor_self_review, _review_fn)


@pytest.mark.asyncio
async def test_top_up_at_quota_is_no_op(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Pill at the per-band quota → top-up generates zero anchors
    and emits zero AI calls. AC-CD7 idempotency contract."""
    # Only one SystemSettings row — `_load_settings` returns the first
    # match so doubling up would mask the configured pool_size.
    _seed_settings_with_small_pool(cat_session, pool_size=3)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject_id=subject.id)
    for _ in range(3):
        _existing_anchor(cat_session, pill_id=pill.id, band=5)

    _wire_recording_provider(monkeypatch, recording_provider)
    result = await generate_anchor_pool_for_pill(cat_session, pill.id, top_up=True)

    assert result["anchors_generated"] == 0
    assert result["total_generation_calls"] == 0
    assert result["total_self_review_calls"] == 0


@pytest.mark.asyncio
async def test_top_up_below_quota_generates_deficit(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Pill with 1 live anchor of 3 → top-up generates exactly 2
    new anchors. Existing rows are not touched (their calibration
    history would otherwise be lost)."""
    # Only one SystemSettings row — `_load_settings` returns the first
    # match so doubling up would mask the configured pool_size.
    _seed_settings_with_small_pool(cat_session, pool_size=3)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject_id=subject.id)
    pre_existing = _existing_anchor(cat_session, pill_id=pill.id, band=5)

    _wire_recording_provider(monkeypatch, recording_provider)
    result = await generate_anchor_pool_for_pill(cat_session, pill.id, top_up=True)

    assert result["anchors_generated"] == 2
    # Pre-existing row still present in the store.
    anchors = [
        a for a in cat_session.store.get(AnchorQuestion, []) if a.pill_id == pill.id
    ]
    assert len(anchors) == 3
    assert pre_existing in anchors


@pytest.mark.asyncio
async def test_top_up_excluded_anchors_do_not_count_toward_quota(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Excluded anchors (``excluded=True``) don't count — they have
    zero weight in the draw, so the top-up math must treat them as
    deficit. A pill with 3 excluded rows + 0 live still triggers a
    full pool_size generation."""
    # Only one SystemSettings row — `_load_settings` returns the first
    # match so doubling up would mask the configured pool_size.
    _seed_settings_with_small_pool(cat_session, pool_size=3)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject_id=subject.id)
    for _ in range(3):
        _existing_anchor(cat_session, pill_id=pill.id, band=5, excluded=True)

    _wire_recording_provider(monkeypatch, recording_provider)
    result = await generate_anchor_pool_for_pill(cat_session, pill.id, top_up=True)

    assert result["anchors_generated"] == 3
    assert result["total_generation_calls"] == 3


@pytest.mark.asyncio
async def test_top_up_false_keeps_409_contract(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Default ``top_up=False`` preserves the existing P8 admin-
    endpoint contract: any existing row raises ``APIError(409,
    'anchors_exist')``. The bootstrap orchestrator's call must
    explicitly opt in via ``top_up=True``."""
    from app.permissions import APIError

    # Only one SystemSettings row — `_load_settings` returns the first
    # match so doubling up would mask the configured pool_size.
    _seed_settings_with_small_pool(cat_session, pool_size=3)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject_id=subject.id)
    _existing_anchor(cat_session, pill_id=pill.id, band=5)

    _wire_recording_provider(monkeypatch, recording_provider)
    with pytest.raises(APIError) as exc:
        await generate_anchor_pool_for_pill(cat_session, pill.id)
    assert exc.value.code == "anchors_exist"


@pytest.mark.asyncio
async def test_top_up_multi_band_deficit_per_band(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A 2-band pill (e.g. bands 4-5) where band 4 is full but band
    5 is short tops up only band 5. The per-band deficit math
    treats each band independently."""
    # Single SystemSettings row only (see comment in the other tests).
    _seed_settings_with_small_pool(cat_session, pool_size=2)
    subject = _subject(cat_session)
    pill = _pill(cat_session, subject_id=subject.id, band_min=4, band_max=5)
    # Band 4 full (2/2), band 5 empty (0/2). Deficit: 0 + 2 = 2.
    _existing_anchor(cat_session, pill_id=pill.id, band=4)
    _existing_anchor(cat_session, pill_id=pill.id, band=4)

    _wire_recording_provider(monkeypatch, recording_provider)
    result = await generate_anchor_pool_for_pill(cat_session, pill.id, top_up=True)

    assert result["anchors_generated"] == 2
    # Per-band summary records 0 generated for band 4, 2 for band 5.
    per_band = {row["band"]: row for row in result["per_band_summary"]}
    assert per_band[4]["generated"] == 0
    assert per_band[5]["generated"] == 2
