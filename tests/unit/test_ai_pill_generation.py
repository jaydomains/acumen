"""Slice B1 — `Operation.pill_generation` mint + provider/stub wiring.

Zero-network (AC-CD15): exercises the offline ``StubAIProvider`` path + the
op-keyed routing maps. The generator (AC-D29 / §6.8) is the AI primitive B2
grounds and B3 fans out; B1 ships the versioned prompt + the enum/provider
wiring + a deterministic stub.
"""

from __future__ import annotations

import pytest

from app.ai.cost import OP_TO_METHOD
from app.ai.prompts import registered_operations
from app.ai.provider import (
    _ANTHROPIC_DEFAULT_OPS,
    Operation,
    StubAIProvider,
    resolve_model,
    resolve_provider,
)


@pytest.mark.asyncio
async def test_stub_pill_generation_schema_and_determinism() -> None:
    """The stub returns ``target_count`` drafts carrying the full v1.0.0 schema;
    the same payload yields byte-identical drafts; a safety-cue topic
    self-classifies as safety-relevant."""
    stub = StubAIProvider()
    payload = {
        "topic": "confined space entry",
        "target_count": 3,
        "available_difficulty_min": 2,
        "available_difficulty_max": 8,
        "subject_id": None,
        "gap_signal": "uncovered_subject",
    }
    r1 = await stub.generate(Operation.pill_generation, payload)
    r2 = await stub.generate(Operation.pill_generation, payload)
    drafts = r1.content["drafts"]
    assert len(drafts) == 3
    required = {
        "name",
        "description",
        "subject_id",
        "available_difficulty_min",
        "available_difficulty_max",
        "estimated_minutes",
        "safety_relevant",
        "rationale",
        "evidence_count",
        "gap_signal",
    }
    for d in drafts:
        assert required <= set(d)
        assert 1 <= d["available_difficulty_min"] <= d["available_difficulty_max"] <= 10
        assert d["gap_signal"] == "uncovered_subject"
        assert "grounding_refs" not in d  # v1.0.0: grounding lands at B2
    assert r1.content == r2.content  # deterministic — byte-identical on re-call
    assert all(d["safety_relevant"] for d in drafts)  # "confined" cue
    # Provenance / zero-spend (AC-CD15).
    assert r1.provider == "stub"
    assert r1.prompt_version == "0.0.0-stub"
    assert r1.prompt_tokens == 0
    assert r1.cost_usd == 0.0


@pytest.mark.asyncio
async def test_stub_pill_generation_target_count_clamped() -> None:
    stub = StubAIProvider()
    big = await stub.generate(
        Operation.pill_generation, {"topic": "x", "target_count": 50}
    )
    assert len(big.content["drafts"]) == 10  # clamped to 10
    one = await stub.generate(
        Operation.pill_generation, {"topic": "y", "target_count": 0}
    )
    assert len(one.content["drafts"]) == 1  # floor of 1


@pytest.mark.asyncio
async def test_stub_pill_generation_non_safety_topic() -> None:
    stub = StubAIProvider()
    r = await stub.generate(
        Operation.pill_generation, {"topic": "basic arithmetic", "target_count": 1}
    )
    assert r.content["drafts"][0]["safety_relevant"] is False


def test_pill_generation_routing_and_map_completeness() -> None:
    """pill_generation routes generate-family + Anthropic-default; the three
    construction-oracle floors hold with the new enum member."""
    assert Operation.pill_generation in _ANTHROPIC_DEFAULT_OPS
    assert OP_TO_METHOD[Operation.pill_generation] == "generate"
    assert set(OP_TO_METHOD) == set(Operation)  # cost-routing floor
    assert Operation.pill_generation in registered_operations()  # prompt registry


def test_resolve_model_pill_generation() -> None:
    """resolve_model maps pill_generation to its anthropic_model_* env-default
    (no KeyError); a per-call override wins."""
    assert resolve_model(Operation.pill_generation) == "claude-sonnet-4-6"
    assert (
        resolve_model(Operation.pill_generation, test_override="claude-x") == "claude-x"
    )


def test_resolve_provider_pill_generation_stub_when_unkeyed() -> None:
    """With no ANTHROPIC_API_KEY (test env), pill_generation resolves to the
    offline stub — the dev/test fail-safe path (AC-CD15)."""
    assert isinstance(resolve_provider(Operation.pill_generation), StubAIProvider)
