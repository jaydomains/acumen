"""OpenAI provider — skeleton for cross-family review (P6, AC-D19) and
embeddings (P9, AC-D22). CODE_SPEC §7.

Slice 1 of P5 ships the class shell so :func:`app.ai.provider.resolve_provider`
can dispatch to it (the resolution-order tests cover this). All four
method bodies raise :class:`NotImplementedError` with a clear pointer to
the implementing phase. P6 wires :meth:`OpenAIProvider.review`; P9 wires
:meth:`OpenAIProvider.embed`. :meth:`generate` / :meth:`grade` stay
unimplemented because the 5 Anthropic ops never route to OpenAI by
default — Anthropic is the configured provider for those (AC-D12 v1.6).
"""

from __future__ import annotations

from typing import Any

from app.ai.provider import AIResult, EmbedResult, Operation


class OpenAIProvider:
    """Async OpenAI client (Chat Completions + Embeddings). Bodies land
    in P6 (review) and P9 (embed); :meth:`generate` and :meth:`grade`
    stay unimplemented because the 5 Anthropic ops do not route here
    under any supported configuration."""

    name = "openai"

    def __init__(self) -> None:
        # The SDK client is built lazily by P6 / P9 — keep import-time
        # cost zero so this module is safe to import without an API key.
        pass

    async def generate(self, operation: Operation, payload: dict[str, Any]) -> AIResult:
        raise NotImplementedError(
            "OpenAI does not handle generate operations under the default "
            "AC-D12 v1.6 routing — Anthropic is the primary for "
            "generation / weakness / learning_material / pill_proposal. "
            "Set system_settings.provider_by_operation if you really need "
            "OpenAI generation and wire the method first."
        )

    async def grade(self, operation: Operation, payload: dict[str, Any]) -> AIResult:
        raise NotImplementedError(
            "OpenAI does not handle grading under the default AC-D12 v1.6 "
            "routing — Anthropic is the primary grader. Wire this method "
            "before configuring system_settings.provider_by_operation."
        )

    async def review(self, operation: Operation, payload: dict[str, Any]) -> AIResult:
        raise NotImplementedError(
            "OpenAI cross-family review wiring lands in P6 — the AC-CD11 "
            "latency-rule gate must close first."
        )

    async def embed(self, operation: Operation, text: str) -> EmbedResult:
        raise NotImplementedError(
            "OpenAI embedding wiring lands in P9 (Drive RAG / AC-D22)."
        )
