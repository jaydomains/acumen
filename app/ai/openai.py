"""OpenAI provider — cross-family grade review (P6, AC-D19 / AC-CD11
v1.7) and embeddings (P9, AC-D22). CODE_SPEC §7.

P6 wires :meth:`OpenAIProvider.review` for the ``grade_review`` op via
the Chat Completions API with ``response_format={"type": "json_object"}``.
The call is **batched per attempt** — one OpenAI call covers every
AI-graded response in the attempt — with a 60-second hard ceiling
enforced by the caller (``app.domain.grade_review``), not here.

P8 widens ``review()`` to handle ``anchor_self_review`` (AC-D23) over
the same call path — same prompt-render + JSON-object response_format +
cost capture as ``grade_review``. The two review operations share
``_call``; only the ``_REVIEW_OPS`` whitelist and the per-op
``_MAX_OUTPUT_TOKENS`` ceiling differ.

``embed`` continues to raise :class:`NotImplementedError` (P9).
``generate`` / ``grade`` continue to raise — the 5 Anthropic ops never
route to OpenAI by default (AC-D12 v1.6).

Calls are wrapped with :mod:`tenacity` exponential backoff for the
documented transient errors (rate limit, connection drops, timeout,
5xx). 4xx errors (auth, content-filter, malformed payload) are *not*
retried — they are deterministic and a retry would loop. The shape of
this module mirrors :mod:`app.ai.anthropic` so the two providers stay
operationally symmetric.
"""

from __future__ import annotations

import json
from typing import Any

import openai
from openai.types.chat import ChatCompletion
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

# OpenAI handles cross-family review on the ``review()`` method per
# AC-CD8 v1.6 routing. Both ``grade_review`` (P6) and
# ``anchor_self_review`` (P8) land here.
_REVIEW_OPS: frozenset[Operation] = frozenset(
    {Operation.grade_review, Operation.anchor_self_review}
)


# Conservative cap on the structured JSON each review pass returns. A
# 5-item batch returning ~3 sentences per item lands well under 1000
# tokens; 2000 covers the worst case (~10-item attempts on busy days
# for grade_review; one pill+band anchor pool of 20 items for
# anchor_self_review) without exposing the bill to a runaway model
# response. The same ceiling fits both ops at the v1 pool size; if a
# future op needs a different cap it gets its own entry.
_MAX_OUTPUT_TOKENS: dict[Operation, int] = {
    Operation.grade_review: 2000,
    Operation.anchor_self_review: 2000,
}


_RETRYABLE_EXC = (
    openai.APIConnectionError,
    openai.APITimeoutError,
    openai.RateLimitError,
    openai.InternalServerError,
)


class OpenAIProvider:
    """Async OpenAI client wired to the
    :class:`~app.ai.provider.AIProvider` protocol. P6 implements
    :meth:`review` for ``grade_review``; :meth:`embed` lands with P9.
    :meth:`generate` / :meth:`grade` stay unimplemented because the 5
    Anthropic ops never route here under any supported configuration."""

    name = "openai"

    def __init__(self) -> None:
        self._client: openai.AsyncOpenAI | None = None

    def _get_client(self) -> openai.AsyncOpenAI:
        # Lazy so app import does not crash when the key is unset (the
        # resolver falls back to ``StubAIProvider`` in that case, but
        # importing this module should remain free).
        if self._client is None:
            self._client = openai.AsyncOpenAI(api_key=get_settings().openai_api_key)
        return self._client

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
        if operation not in _REVIEW_OPS:
            raise ValueError(
                f"OpenAIProvider.review() handles only grade_review (P6) "
                f"and anchor_self_review (P8); got {operation.value!r}. "
                "Per AC-CD8 v1.6 routing, grading→grade(), "
                "generation/weakness/learning_material/pill_proposal→"
                "generate(), embed→embed()."
            )
        return await self._call(operation, payload)

    async def embed(self, operation: Operation, text: str) -> EmbedResult:
        raise NotImplementedError(
            "OpenAI embedding wiring lands in P9 (Drive RAG / AC-D22)."
        )

    # --- private --------------------------------------------------------

    async def _call(self, operation: Operation, payload: dict[str, Any]) -> AIResult:
        template, prompt_version = get_prompt(operation)
        model = resolve_model(operation)
        # ``render_prompt`` wraps str.format() with a clear error
        # carrying the operation + missing key + available keys so a
        # missing payload key surfaces as a debuggable ValueError
        # (matches anthropic.py / Gitar PR-#16 finding #1).
        prompt = render_prompt(template, payload, operation=operation)
        max_tokens = _MAX_OUTPUT_TOKENS[operation]
        response = await _invoke(
            self._get_client(),
            model=model,
            prompt=prompt,
            max_tokens=max_tokens,
        )
        # Same loud-error pattern for the JSON-parse path: re-raise with
        # operation + provider + model + a truncated snippet of the raw
        # response so a model that drifts off the JSON-only contract
        # surfaces with enough context to debug (mirrors anthropic.py).
        try:
            content = _parse_json_content(response)
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"Model returned non-JSON for {operation.value!r} "
                f"(provider={self.name}, model={model}): "
                f"{_raw_text(response)[:200]!r}"
            ) from exc
        usage = response.usage
        prompt_tokens = usage.prompt_tokens if usage is not None else 0
        completion_tokens = usage.completion_tokens if usage is not None else 0
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
    client: openai.AsyncOpenAI,
    *,
    model: str,
    prompt: str,
    max_tokens: int,
) -> ChatCompletion:
    """One Chat-Completions call with bounded exponential backoff on the
    documented transient errors (rate limit, connection, timeout, 5xx).
    Non-retryable errors (auth, 4xx, content-filter) propagate after
    the first attempt.

    ``response_format={"type": "json_object"}`` forces the model to emit
    a top-level JSON object so the parser path stays predictable on a
    cooperating model. The "JSON only" prompt directive remains the
    defence in depth for the rare leak-through (covered by
    :func:`_parse_json_content`'s brace-scan fallback)."""
    return await client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )


def _raw_text(response: ChatCompletion) -> str:
    """Pull the first choice's message content. Used by the JSON parser
    and by the JSON-parse error path so the operator sees the same raw
    string the parser saw. Empty / None content returns ``""`` so the
    error message stays informative rather than blowing up on
    ``str(None)``."""
    if not response.choices:
        return ""
    content = response.choices[0].message.content
    return (content or "").strip()


def _parse_json_content(response: ChatCompletion) -> dict[str, Any]:
    """Pull the JSON object the prompt requested out of the model's
    first choice. The prompt says "JSON only" and the request specifies
    ``response_format=json_object`` — if the model still leaks prose
    around the JSON (rare but documented), fall back to a best-effort
    object scan so a single stray sentence does not crash the call.
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
