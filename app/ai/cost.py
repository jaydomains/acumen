"""Per-call AI cost capture (CODE_SPEC §7, AC-CD8 / amended AC-D18).

Slice 1 of P5 lands the pricing table, the cost computation, and the
provenance helper that stamps :class:`app.models.AIProvenanceMixin`
columns on producing entities. The monthly-spend aggregator and the
budget-alert dispatcher (AC-D18 v1.1: alerts at 50/80/100 %, operations
continue — no hard enforcement) land in Slice 3.

Embedding spend is tracked against the OpenAI provider per amended
AC-D18 (Drive RAG / AC-D22 / P9).
"""

from __future__ import annotations

from typing import Any

from app.ai.provider import AIResult, EmbedResult, Operation

# (provider, model) → (input_usd_per_1m_tokens, output_usd_per_1m_tokens).
# Source: provider public price sheets (Anthropic, OpenAI) at v1 build time.
# Bumped manually when a provider changes pricing; bumping is a
# deliberate, audited change.
PRICE_TABLE: dict[tuple[str, str], tuple[float, float]] = {
    # Anthropic Claude Sonnet 4.6 — primary for the 5 Anthropic ops.
    ("anthropic", "claude-sonnet-4-6"): (3.00, 15.00),
    # OpenAI GPT-4o — cross-family review per AC-D19.
    ("openai", "gpt-4o"): (2.50, 10.00),
    # OpenAI text-embedding-3-small — Drive RAG per AC-D22.
    # Output tokens are 0 for embeddings (no completion side).
    ("openai", "text-embedding-3-small"): (0.02, 0.0),
    # The deterministic stub costs nothing.
    ("stub", "stub-1"): (0.0, 0.0),
    ("stub", "stub-embed-1"): (0.0, 0.0),
}


def compute_cost(
    provider: str, model: str, prompt_tokens: int, completion_tokens: int
) -> float:
    """USD cost for a single call. Raises :class:`ValueError` for any
    ``(provider, model)`` pair missing from :data:`PRICE_TABLE` — every
    pair seen in production must be priced so the cost dashboard never
    silently zeroes out a real spend."""
    try:
        in_rate, out_rate = PRICE_TABLE[(provider, model)]
    except KeyError as exc:
        raise ValueError(
            f"No price entry for provider={provider!r} model={model!r}. "
            "Add the (provider, model) pair to PRICE_TABLE before using "
            "this model in production (AC-D18 cost-tracking contract)."
        ) from exc
    return (prompt_tokens / 1_000_000) * in_rate + (
        completion_tokens / 1_000_000
    ) * out_rate


def record_provenance(entity: Any, result: AIResult | EmbedResult) -> None:
    """Stamp :class:`app.models.AIProvenanceMixin` columns on ``entity``
    from a provider result (AC-CD8 v1.6 / F7). Works for both
    :class:`AIResult` (Anthropic / OpenAI message ops) and
    :class:`EmbedResult` (OpenAI embeddings).

    Use when one AI call produces one entity (grading → Grade,
    weakness → WeaknessReport, learning_material → LearningMaterial,
    pill_proposal → ProcessingTask). For 1:N calls (generation → N
    Question rows) use :func:`record_provenance_share`.

    The entity is mutated in place — the caller still has to add it to
    the session and flush. The prompt_version is read from the result
    for message ops; embed results have no prompt_version (no template),
    so :attr:`AIProvenanceMixin.ai_prompt_version` stays ``None`` for
    embeddings.
    """
    entity.ai_provider = result.provider
    entity.ai_model = result.model
    entity.ai_prompt_tokens = result.prompt_tokens
    entity.ai_cost_usd = result.cost_usd
    if isinstance(result, AIResult):
        entity.ai_prompt_version = result.prompt_version
        entity.ai_completion_tokens = result.completion_tokens
    else:
        # EmbedResult — no prompt template, no completion tokens.
        entity.ai_prompt_version = None
        entity.ai_completion_tokens = 0


def record_provenance_share(entity: Any, result: AIResult, *, share_count: int) -> None:
    """Stamp the per-entity SHARE of a multi-entity AI call (the 1:N
    case where one call produces ``share_count`` entities, e.g.
    generation produces N Question rows from a single Messages-API
    response).

    Cost + tokens are divided evenly so summing across the produced
    rows reconstructs the call's total — the cost dashboard's
    per-attempt aggregation stays correct without de-duplicating
    same-call entities. Provider, model, and prompt_version are the
    full per-call values and replicated on every row (they describe
    the call, not the share).

    Token counts use floor division because :class:`AIProvenanceMixin`
    columns are int-typed; the rounding remainder (< ``share_count``
    tokens out of thousands) is operationally insignificant. Cost is
    float and divides exactly.
    """
    if share_count < 1:
        raise ValueError(
            f"record_provenance_share requires share_count >= 1, got " f"{share_count!r}."
        )
    entity.ai_provider = result.provider
    entity.ai_model = result.model
    entity.ai_prompt_version = result.prompt_version
    entity.ai_prompt_tokens = result.prompt_tokens // share_count
    entity.ai_completion_tokens = result.completion_tokens // share_count
    entity.ai_cost_usd = result.cost_usd / share_count


# --- Op routing reminder for callers ----------------------------------
# AC-CD8 v1.6: which protocol method handles which Operation. Domain
# code uses ``OP_TO_METHOD[op]`` to defensively assert routing in tests
# and as inline documentation — the resolver is the runtime path.

OP_TO_METHOD: dict[Operation, str] = {
    Operation.generation: "generate",
    Operation.grading: "grade",
    Operation.weakness: "generate",
    Operation.learning_material: "generate",
    Operation.pill_proposal: "generate",
    Operation.grade_review: "review",
    Operation.anchor_self_review: "review",
    Operation.embed: "embed",
}
