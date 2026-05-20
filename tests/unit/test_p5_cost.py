"""P5 cost helper — price table + per-call cost computation + provenance
stamping (AC-D18 / AC-CD8).

Slice 1 covers ``compute_cost`` and ``record_provenance``. The monthly
spend aggregator and the budget-alert dispatcher land in Slice 3 with
their own integration tests.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.ai.cost import (
    OP_TO_METHOD,
    PRICE_TABLE,
    compute_cost,
    record_provenance,
)
from app.ai.provider import AIResult, EmbedResult, Operation

# --- compute_cost ----------------------------------------------------


def test_compute_cost_anthropic_sonnet_known_volume() -> None:
    """A round 1M-token call on Sonnet costs exactly the published
    input + output rate. Catches a typo in :data:`PRICE_TABLE` or a
    sign / unit error in :func:`compute_cost`."""
    in_rate, out_rate = PRICE_TABLE[("anthropic", "claude-sonnet-4-6")]
    cost = compute_cost("anthropic", "claude-sonnet-4-6", 1_000_000, 1_000_000)
    assert cost == pytest.approx(in_rate + out_rate)


def test_compute_cost_openai_review_known_volume() -> None:
    in_rate, out_rate = PRICE_TABLE[("openai", "gpt-4o")]
    cost = compute_cost("openai", "gpt-4o", 1_000_000, 1_000_000)
    assert cost == pytest.approx(in_rate + out_rate)


def test_compute_cost_realistic_per_call_volume() -> None:
    """A realistic ~3000-prompt / ~500-completion call on Sonnet — the
    AC-D18 amendment's "approximately 23¢ per attempt" worked example
    bakes assumptions like this one. Asserts the math, not the spec."""
    cost = compute_cost("anthropic", "claude-sonnet-4-6", 3000, 500)
    # 3000/1M * 3.00 + 500/1M * 15.00 = 0.009 + 0.0075 = 0.0165
    assert cost == pytest.approx(0.0165)


def test_compute_cost_embedding_has_no_output_cost() -> None:
    """Embedding models charge only on input tokens; the output side of
    :data:`PRICE_TABLE` is ``0.0`` for ``text-embedding-3-small``."""
    cost = compute_cost("openai", "text-embedding-3-small", 1_000_000, 0)
    in_rate, _ = PRICE_TABLE[("openai", "text-embedding-3-small")]
    assert cost == pytest.approx(in_rate)


def test_compute_cost_zero_tokens_zero_cost() -> None:
    assert compute_cost("anthropic", "claude-sonnet-4-6", 0, 0) == 0.0


def test_compute_cost_unknown_pair_raises() -> None:
    """A typo or a model added without a price-table entry must surface
    as :class:`ValueError` rather than zero out — otherwise the cost
    dashboard would silently mis-report production spend."""
    with pytest.raises(ValueError, match="No price entry"):
        compute_cost("anthropic", "claude-future-x", 100, 100)


# --- record_provenance ------------------------------------------------


def test_record_provenance_stamps_all_ai_columns_for_airesult() -> None:
    """For an :class:`AIResult` (message ops), all six
    :class:`AIProvenanceMixin` columns are populated."""
    entity = SimpleNamespace(
        ai_provider=None,
        ai_model=None,
        ai_prompt_version=None,
        ai_prompt_tokens=None,
        ai_completion_tokens=None,
        ai_cost_usd=None,
    )
    result = AIResult(
        content={"questions": []},
        provider="anthropic",
        model="claude-sonnet-4-6",
        prompt_version="1.2.3",
        prompt_tokens=2500,
        completion_tokens=400,
        cost_usd=0.0135,
    )
    record_provenance(entity, result)
    assert entity.ai_provider == "anthropic"
    assert entity.ai_model == "claude-sonnet-4-6"
    assert entity.ai_prompt_version == "1.2.3"
    assert entity.ai_prompt_tokens == 2500
    assert entity.ai_completion_tokens == 400
    assert entity.ai_cost_usd == pytest.approx(0.0135)


def test_record_provenance_handles_embed_result() -> None:
    """For an :class:`EmbedResult` the prompt_version stays ``None``
    (no template) and completion_tokens is forced to 0 (no completion
    side on embeddings)."""
    entity = SimpleNamespace(
        ai_provider=None,
        ai_model=None,
        ai_prompt_version=None,
        ai_prompt_tokens=None,
        ai_completion_tokens=None,
        ai_cost_usd=None,
    )
    result = EmbedResult(
        embedding=[0.0] * 1536,
        provider="openai",
        model="text-embedding-3-small",
        prompt_tokens=512,
        cost_usd=0.0000102,
    )
    record_provenance(entity, result)
    assert entity.ai_provider == "openai"
    assert entity.ai_model == "text-embedding-3-small"
    assert entity.ai_prompt_version is None
    assert entity.ai_prompt_tokens == 512
    assert entity.ai_completion_tokens == 0
    assert entity.ai_cost_usd == pytest.approx(0.0000102)


# --- OP_TO_METHOD routing table (the AC-CD8 v1.6 reminder) -----------


def test_op_to_method_covers_every_operation() -> None:
    """Every value in the :class:`Operation` enum is mapped to a
    protocol method in :data:`OP_TO_METHOD` — defensive coverage so
    adding a new op breaks the test, not production."""
    assert set(OP_TO_METHOD) == set(Operation)


def test_op_to_method_routes_per_ac_cd8_v1_6() -> None:
    """Routing per AC-CD8 v1.6: generation / weakness / learning_material
    / pill_proposal → ``generate``; grading → ``grade``; grade_review /
    anchor_self_review → ``review``; embed → ``embed``."""
    assert OP_TO_METHOD[Operation.generation] == "generate"
    assert OP_TO_METHOD[Operation.weakness] == "generate"
    assert OP_TO_METHOD[Operation.learning_material] == "generate"
    assert OP_TO_METHOD[Operation.pill_proposal] == "generate"
    assert OP_TO_METHOD[Operation.grading] == "grade"
    assert OP_TO_METHOD[Operation.grade_review] == "review"
    assert OP_TO_METHOD[Operation.anchor_self_review] == "review"
    assert OP_TO_METHOD[Operation.embed] == "embed"


# --- PRICE_TABLE coverage of every coded-default model (Gitar #3) ----


def test_price_table_covers_every_coded_default_model_id() -> None:
    """Every model ID :mod:`app.config` exposes as an env-overridable
    default must have a :data:`PRICE_TABLE` entry under the right
    provider. Catches the drift Gitar PR-#16 flagged: an admin bumps
    ``ANTHROPIC_MODEL_GENERATION`` to a newer Sonnet, the matching
    PRICE_TABLE row is forgotten, and ``compute_cost`` would raise on
    the first live AI call. CI-time check is preferable to a runtime
    startup hook — the structure gate forbids ``app.ai`` imports from
    ``app/main.py`` so a runtime check would violate the setup-only
    contract anyway (AC-CD2)."""
    from app.config import get_settings

    cfg = get_settings()
    expected_pairs: set[tuple[str, str]] = {
        ("anthropic", cfg.anthropic_model_generation),
        ("anthropic", cfg.anthropic_model_grading),
        ("anthropic", cfg.anthropic_model_weakness),
        ("anthropic", cfg.anthropic_model_material),
        ("anthropic", cfg.anthropic_model_pill_proposal),
        ("openai", cfg.openai_model_review),
        ("openai", cfg.openai_embedding_model),
    }
    missing = expected_pairs - set(PRICE_TABLE)
    assert not missing, (
        f"PRICE_TABLE is missing pricing for the following coded-default "
        f"(provider, model) pairs: {sorted(missing)}. Update "
        f"app/ai/cost.py::PRICE_TABLE whenever a default model ID in "
        f"app/config.py is bumped — otherwise compute_cost will raise on "
        f"the first live call (Gitar PR-#16 Slice 1 finding #3)."
    )
