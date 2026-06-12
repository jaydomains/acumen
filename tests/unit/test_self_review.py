"""Slice C1 — generated-content self-review protocol (AC-D30 / §6.9).

Zero-network (AC-CD15): a fake review provider runs the deterministic stub
per-variant logic and stamps a chosen provider name so the cross-model floor +
the NS-7 single-provider degrade are exercisable offline. Covers the three
cross-model passes, the safety pass re-adjudicating a false-negative mis-tag,
the grounding/provenance verdicts (orphan claim listed), the op-wiring sweep
floors, and the NS-7 degrade switch default.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

import app.domain.self_review as sr
from app.ai.cost import OP_TO_METHOD
from app.ai.prompts import get_prompt, registered_operations
from app.ai.provider import (
    _REVIEW_DEFAULT_OPS,
    AIResult,
    Operation,
    _stub_content_self_review_content,
)
from app.domain.self_review import (
    SELF_REVIEW_DEGRADE_DEFAULT,
    DegradeMode,
    self_review_draft,
)


class _ReviewProvider:
    """Runs the real per-variant stub logic but stamps a chosen provider name
    (so the cross-model / single-provider branch is testable offline)."""

    def __init__(self, name: str) -> None:
        self.name = name

    async def review(self, operation: Operation, payload: dict) -> AIResult:
        content = _stub_content_self_review_content(payload)
        return AIResult(
            content=content,
            provider=self.name,
            model=f"{self.name}-review",
            prompt_version="1.0.0",
            prompt_tokens=10,
            completion_tokens=5,
            cost_usd=0.001,
        )


def _install(
    monkeypatch: pytest.MonkeyPatch,
    *,
    review_name: str = "openai",
    generator_name: str = "anthropic",
) -> None:
    def _resolve(op: Operation) -> object:
        if op == Operation.content_self_review:
            return _ReviewProvider(review_name)
        return SimpleNamespace(name=generator_name)  # the generator (pill_generation)

    monkeypatch.setattr(sr, "resolve_provider", _resolve)


def _draft(**over: object) -> dict:
    base = {
        "name": "Bolt torque basics",
        "description": "Competency on fastener torque values.",
        "topic": "fastening",
        "safety_relevant": False,
        "grounding_refs": [
            {
                "claim": "Torque is measured in Nm",
                "source_doc_refs": ["https://iso.org/a"],
            }
        ],
    }
    base.update(over)
    return base


_PROVENANCE = {
    "https://iso.org/a": {"chunk_text": "Torque is measured in Nm.", "tier": 1}
}


@pytest.mark.asyncio
async def test_three_passes_run_cross_model(monkeypatch: pytest.MonkeyPatch) -> None:
    """All three passes resolve to the review provider (OpenAI-side) while the
    generator was Anthropic → cross-model floor; not single-provider."""
    _install(monkeypatch, review_name="openai", generator_name="anthropic")
    result = await self_review_draft(None, draft=_draft(), provenance=_PROVENANCE)
    for v in (result.grounding, result.safety, result.provenance):
        assert v.provider == "openai"
    assert result.single_provider_verified is False
    assert result.passed  # clean draft passes all three


@pytest.mark.asyncio
async def test_safety_pass_readjudicates_false_negative(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A cue-bearing draft mistagged safety_relevant=False is flipped to True by
    the safety pass (the AC-D21 autonomous catch); the safety verdict fails."""
    _install(monkeypatch)
    mistagged = _draft(topic="electrical isolation", safety_relevant=False)
    result = await self_review_draft(None, draft=mistagged, provenance=_PROVENANCE)
    assert result.safety_relevant is True  # flipped
    assert result.safety.verdict == "fail"
    assert result.passed is False


@pytest.mark.asyncio
async def test_correct_safety_tag_unchanged(monkeypatch: pytest.MonkeyPatch) -> None:
    """A correctly non-safety draft is left untouched by the safety pass."""
    _install(monkeypatch)
    result = await self_review_draft(None, draft=_draft(), provenance=_PROVENANCE)
    assert result.safety_relevant is False
    assert result.safety.verdict == "pass"


@pytest.mark.asyncio
async def test_provenance_pass_lists_orphan_claims(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A claim with no resolving source_doc_ref is an orphan → the provenance
    pass fails and lists it; a fully-grounded draft passes."""
    _install(monkeypatch)
    orphaned = _draft(
        grounding_refs=[
            {"claim": "Grounded claim", "source_doc_refs": ["https://iso.org/a"]},
            {"claim": "Orphan claim", "source_doc_refs": []},
        ]
    )
    result = await self_review_draft(None, draft=orphaned, provenance=_PROVENANCE)
    assert result.provenance.verdict == "fail"
    assert result.orphan_claims == ["Orphan claim"]
    assert result.grounding.verdict == "pass"  # grounding trusts the cited refs


def test_op_wiring_and_sweep_floors() -> None:
    """content_self_review joins the review family + the construction oracles
    hold with the ninth named op (2nd ops-count expansion)."""
    assert Operation.content_self_review in _REVIEW_DEFAULT_OPS
    assert OP_TO_METHOD[Operation.content_self_review] == "review"
    assert set(OP_TO_METHOD) == set(Operation)  # routing completeness floor
    assert Operation.content_self_review in registered_operations()
    # All three variant prompts resolve.
    for variant in ("grounding", "safety", "provenance"):
        template, version = get_prompt(Operation.content_self_review, variant=variant)
        assert "JSON" in template and version == "1.0.0"


@pytest.mark.asyncio
async def test_ns7_degrade_switch_default(monkeypatch: pytest.MonkeyPatch) -> None:
    """NS-7 (ruled degrade-not-gate): the switch the C2 gate reads exists and
    defaults to degrade; a single-provider deployment is flagged."""
    assert SELF_REVIEW_DEGRADE_DEFAULT == DegradeMode.degrade
    # Single-provider: generator and reviewer resolve to the same name.
    _install(monkeypatch, review_name="openai", generator_name="openai")
    result = await self_review_draft(None, draft=_draft(), provenance=_PROVENANCE)
    assert result.degrade_mode == DegradeMode.degrade  # default
    assert result.single_provider_verified is True
