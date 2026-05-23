"""Anthropic provider — the 5 primary Anthropic-side AI operations
(AC-D12 / AC-D18 / CODE_SPEC §7).

Wires :class:`~app.ai.provider.AIProvider` against the
:mod:`anthropic` SDK's async Messages API. Handles:

* ``generate`` — generation / weakness / learning_material /
  pill_proposal (routed via the :class:`Operation` enum).
* ``grade`` — grading (short_answer / scenario response grading).
* ``review`` — raises :class:`NotImplementedError`; cross-family review
  is OpenAI per AC-D19 / P6.
* ``embed`` — raises :class:`NotImplementedError`; embeddings are OpenAI
  per AC-D22 / P9.

Calls are wrapped with :mod:`tenacity` exponential backoff for transient
failures (rate limits, connection drops, 5xx). 4xx errors (auth,
content-filter, malformed payload) are *not* retried — they are
deterministic and a retry would loop. Token counts come from
``response.usage``; cost is computed by :func:`app.ai.cost.compute_cost`.
The prompt template + version come from
:func:`app.ai.prompts.get_prompt` and the version is persisted on the
producing entity for reproducibility (AC-CD8).
"""

from __future__ import annotations

import json
from typing import Any

import anthropic
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.ai.cost import compute_cost
from app.ai.prompts import get_prompt, render_prompt
from app.ai.provider import AIResult, EmbedResult, Operation, resolve_model
from app.config import get_settings

# Operations Anthropic handles on each method (the four-method routing
# of AC-CD8 v1.6). Anything else passed to the method raises a clear
# ``ValueError`` so a misuse is caught at call time, not silently.
_GENERATE_OPS: frozenset[Operation] = frozenset(
    {
        Operation.generation,
        Operation.weakness,
        Operation.learning_material,
        Operation.pill_proposal,
    }
)
_GRADE_OPS: frozenset[Operation] = frozenset({Operation.grading})


# Conservative cap on the structured JSON each op returns — generation
# can be large (e.g. 15-question per-Testee mode); grading / weakness /
# material / pill_proposal are small. The cap exists so a runaway model
# response cannot pin output spend.
_MAX_OUTPUT_TOKENS: dict[Operation, int] = {
    Operation.generation: 8000,
    Operation.grading: 1000,
    Operation.weakness: 2000,
    Operation.learning_material: 2000,
    Operation.pill_proposal: 1000,
}


_RETRYABLE_EXC = (
    anthropic.APIConnectionError,
    anthropic.APITimeoutError,
    anthropic.RateLimitError,
    anthropic.InternalServerError,
)


class AnthropicProvider:
    """Async Anthropic Messages API client wired to the
    :class:`~app.ai.provider.AIProvider` protocol."""

    name = "anthropic"

    def __init__(self) -> None:
        self._client: anthropic.AsyncAnthropic | None = None

    def _get_client(self) -> anthropic.AsyncAnthropic:
        # Lazy so app import does not crash when the key is unset (the
        # resolver falls back to ``StubAIProvider`` in that case, but
        # importing this module should remain free).
        if self._client is None:
            self._client = anthropic.AsyncAnthropic(
                api_key=get_settings().anthropic_api_key
            )
        return self._client

    async def generate(self, operation: Operation, payload: dict[str, Any]) -> AIResult:
        if operation not in _GENERATE_OPS:
            raise ValueError(
                f"AnthropicProvider.generate() does not handle "
                f"{operation.value!r} (AC-CD8 v1.6 routing). Use the "
                "method matching the operation: grading→grade(), "
                "grade_review/anchor_self_review→review(), embed→embed()."
            )
        return await self._call(operation, payload)

    async def grade(self, operation: Operation, payload: dict[str, Any]) -> AIResult:
        if operation not in _GRADE_OPS:
            raise ValueError(
                f"AnthropicProvider.grade() handles only grading; got "
                f"{operation.value!r}."
            )
        return await self._call(operation, payload)

    async def review(self, operation: Operation, payload: dict[str, Any]) -> AIResult:
        raise NotImplementedError(
            "Anthropic review is not used — cross-family review runs on "
            "OpenAI by default per AC-D19 (set "
            "system_settings.review_provider=anthropic to override). "
            "OpenAI review wiring lands in P6."
        )

    async def embed(self, operation: Operation, text: str) -> EmbedResult:
        raise NotImplementedError(
            "Anthropic does not provide embeddings; OpenAI "
            "text-embedding-3-small is the configured embedding provider "
            "per AC-D22. Embedding wiring lands in P9."
        )

    # --- private --------------------------------------------------------

    async def _call(self, operation: Operation, payload: dict[str, Any]) -> AIResult:
        # ``_prompt_variant`` is metadata, not a prompt placeholder — pop
        # it before render so it doesn't show up in the rendered prompt
        # or pollute the format() unused-key set. Default ``"default"``
        # keeps every existing caller's prompt selection unchanged.
        variant = payload.pop("_prompt_variant", "default")
        template, prompt_version = get_prompt(operation, variant=variant)
        model = resolve_model(operation)
        # ``render_prompt`` wraps str.format() with a clear error that
        # carries the operation + missing key + available keys — a
        # missing payload key now surfaces as a debuggable ValueError
        # instead of an opaque ``KeyError("subject_name")`` (Gitar
        # PR-#16, Slice 1 finding #1).
        prompt = render_prompt(template, payload, operation=operation)
        max_tokens = _MAX_OUTPUT_TOKENS[operation]
        response = await _invoke(
            self._get_client(),
            model=model,
            prompt=prompt,
            max_tokens=max_tokens,
        )
        # Same loud-error pattern for the JSON-parse path: re-raise with
        # operation + model + a truncated snippet of the raw response so
        # a model that drifts off the JSON-only contract surfaces with
        # enough context to debug (Gitar PR-#16, Slice 1 finding #2).
        try:
            content = _parse_json_content(response)
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"Model returned non-JSON for {operation.value!r} "
                f"(provider={self.name}, model={model}): "
                f"{_raw_text(response)[:200]!r}"
            ) from exc
        prompt_tokens = response.usage.input_tokens
        completion_tokens = response.usage.output_tokens
        cost = compute_cost(self.name, model, prompt_tokens, completion_tokens)
        return AIResult(
            content=content,
            provider=self.name,
            model=model,
            prompt_version=prompt_version,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cost_usd=cost,
        )


@retry(
    reraise=True,
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type(_RETRYABLE_EXC),
)
async def _invoke(
    client: anthropic.AsyncAnthropic,
    *,
    model: str,
    prompt: str,
    max_tokens: int,
) -> anthropic.types.Message:
    """One Messages-API call with bounded exponential backoff on the
    documented transient errors (rate limit, connection, timeout, 5xx).
    Non-retryable errors (auth, 4xx, content-filter) propagate after
    the first attempt."""
    return await client.messages.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )


def _raw_text(response: anthropic.types.Message) -> str:
    """Join the text blocks of a Messages-API response. Used by the
    JSON parser and by the JSON-parse error path so the operator sees
    the same raw string the parser saw."""
    text_blocks = [
        b.text for b in response.content if isinstance(b, anthropic.types.TextBlock)
    ]
    return "".join(text_blocks).strip()


def _parse_json_content(response: anthropic.types.Message) -> dict[str, Any]:
    """Pull the JSON object the prompts request out of the model's
    first text block. The prompts all say "JSON only" — if the model
    leaks prose around it, fall back to a best-effort JSON object scan
    so a single stray sentence does not crash the call.
    """
    raw = _raw_text(response)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(raw[start : end + 1])
