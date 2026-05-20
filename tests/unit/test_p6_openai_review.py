"""P6 OpenAIProvider.review() — cross-family grade review wiring
(AC-D19 / AC-CD11 v1.7 / AC-CD8 v1.6).

The SDK is never reached: ``_invoke`` is monkeypatched to return a
crafted :class:`openai.types.chat.ChatCompletion` (or to raise the
documented error classes) so the parse / cost / provenance / retry
paths are exercised without a network call (AC-CD15). Routing tests
(method ↔ operation mapping) and the contextual-error paths
(missing payload key, malformed JSON) sit alongside, mirroring the
:mod:`tests.unit.test_p5_anthropic` shape.
"""

from __future__ import annotations

import openai
import pytest
from openai.types.chat import ChatCompletion
from openai.types.chat.chat_completion import Choice
from openai.types.chat.chat_completion_message import ChatCompletionMessage
from openai.types.completion_usage import CompletionUsage

from app.ai import openai as openai_module
from app.ai.cost import compute_cost
from app.ai.openai import OpenAIProvider
from app.ai.prompts import get_prompt, registered_operations
from app.ai.provider import Operation

# --- Helpers ----------------------------------------------------------


def _stub_chat_completion(
    text: str, *, prompt_tokens: int = 120, completion_tokens: int = 60
) -> ChatCompletion:
    """Build a :class:`ChatCompletion` with a single message carrying
    ``text``. ``id`` / ``created`` / ``model`` / ``object`` are required
    by the constructor but the values are arbitrary for these tests —
    only ``choices[0].message.content`` and ``usage`` are consulted by
    ``_parse_json_content`` / ``_call``."""
    return ChatCompletion(
        id="chatcmpl-test",
        object="chat.completion",
        created=0,
        model="gpt-4o",
        choices=[
            Choice(
                index=0,
                finish_reason="stop",
                message=ChatCompletionMessage(role="assistant", content=text),
            )
        ],
        usage=CompletionUsage(
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
        ),
    )


_REVIEW_PAYLOAD = {
    "items_json": (
        '[{"grade_id":"abc","question":"q","rubric":"r","response":"r",'
        '"ai_grade":0.8,"ai_verdict":"partial","ai_reasoning":"why"}]'
    )
}


# --- Happy path -------------------------------------------------------


async def test_review_grade_review_happy_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A well-formed batched response yields an :class:`AIResult` with
    parsed ``content``, full provenance, and cost computed against the
    OpenAI price table."""
    provider = OpenAIProvider()
    canned = (
        '{"items": [{"grade_id": "abc", "verdict": "confirmed", '
        '"reasoning": "defensible"}]}'
    )

    async def _stub_invoke(*args: object, **kwargs: object) -> ChatCompletion:
        return _stub_chat_completion(canned, prompt_tokens=120, completion_tokens=60)

    monkeypatch.setattr(openai_module, "_invoke", _stub_invoke)

    result = await provider.review(Operation.grade_review, _REVIEW_PAYLOAD)
    assert result.content == {
        "items": [{"grade_id": "abc", "verdict": "confirmed", "reasoning": "defensible"}]
    }
    assert result.provider == "openai"
    assert result.model == "gpt-4o"
    assert result.prompt_version == "1.0.0"
    assert result.prompt_tokens == 120
    assert result.completion_tokens == 60
    assert result.cost_usd == compute_cost("openai", "gpt-4o", 120, 60)


# --- Routing guards (AC-CD8 v1.6) -------------------------------------


async def test_review_rejects_non_review_operation() -> None:
    """``review()`` must reject any op routed to a different method
    per AC-CD8 v1.6 — calling it with ``grading`` is a programming
    error, not an SDK call."""
    provider = OpenAIProvider()
    with pytest.raises(ValueError, match="grading"):
        await provider.review(Operation.grading, {})


async def test_review_anchor_self_review_still_raises_with_p8_pointer() -> None:
    """``anchor_self_review`` routes to ``review()`` per AC-CD8 v1.6 but
    its prompt + caller arrive with P8 — the error message must point at
    P8 so a stray P6-era call surfaces with the right phase pointer."""
    provider = OpenAIProvider()
    with pytest.raises(NotImplementedError, match="P8"):
        await provider.review(Operation.anchor_self_review, {})


async def test_generate_always_raises_not_implemented() -> None:
    """OpenAI ``generate()`` is intentionally unimplemented under the
    default AC-D12 v1.6 routing — Anthropic is the primary generator."""
    provider = OpenAIProvider()
    with pytest.raises(NotImplementedError):
        await provider.generate(Operation.generation, {})


async def test_grade_always_raises_not_implemented() -> None:
    provider = OpenAIProvider()
    with pytest.raises(NotImplementedError):
        await provider.grade(Operation.grading, {})


async def test_embed_always_raises_with_p9_pointer() -> None:
    """``embed()`` lands with P9 (Drive RAG / AC-D22)."""
    provider = OpenAIProvider()
    with pytest.raises(NotImplementedError, match="P9"):
        await provider.embed(Operation.embed, "any text")


# --- Contextual-error paths -------------------------------------------


async def test_review_missing_payload_key_raises_with_operation_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A payload missing the prompt template's ``{items_json}`` key
    raises :class:`ValueError` carrying the operation name + missing key
    + available keys — not an opaque ``KeyError`` from inside
    ``str.format()`` (mirrors anthropic Slice 1 finding #1)."""
    provider = OpenAIProvider()

    async def _no_op_invoke(*args: object, **kwargs: object) -> ChatCompletion:
        raise AssertionError("_invoke should not be called on render failure")

    monkeypatch.setattr(openai_module, "_invoke", _no_op_invoke)

    with pytest.raises(ValueError) as exc_info:
        await provider.review(Operation.grade_review, {"unrelated_key": "value"})
    msg = str(exc_info.value)
    assert "grade_review" in msg
    assert "items_json" in msg
    assert "unrelated_key" in msg


async def test_review_malformed_json_response_raises_with_full_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When the model returns non-JSON despite the JSON-only directive
    and ``response_format=json_object``, the :class:`ValueError` raised
    by ``_call`` carries the operation name + provider + model + a
    truncated snippet of the raw response (mirrors anthropic Slice 1
    finding #2)."""
    provider = OpenAIProvider()
    raw_text = "Sorry, I cannot answer in JSON today."

    async def _invoke_returning_prose(*args: object, **kwargs: object) -> ChatCompletion:
        return _stub_chat_completion(raw_text)

    monkeypatch.setattr(openai_module, "_invoke", _invoke_returning_prose)

    with pytest.raises(ValueError) as exc_info:
        await provider.review(Operation.grade_review, _REVIEW_PAYLOAD)
    msg = str(exc_info.value)
    assert "grade_review" in msg
    assert "openai" in msg
    assert "gpt-4o" in msg
    assert "Sorry, I cannot answer in JSON today." in msg


async def test_review_recoverable_json_in_prose_still_parses(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The best-effort fallback (substring scan between the first ``{``
    and the last ``}``) is preserved: a model that leaks a one-line
    prefix around valid JSON still parses cleanly rather than tripping
    the error path. ``response_format=json_object`` makes this rare but
    not impossible; the defence in depth stays."""
    provider = OpenAIProvider()
    leaky = (
        "Here is the JSON you asked for:\n"
        '{"items": [{"grade_id": "abc", "verdict": "flagged"}]}'
    )

    async def _invoke_returning_leaky(*args: object, **kwargs: object) -> ChatCompletion:
        return _stub_chat_completion(leaky)

    monkeypatch.setattr(openai_module, "_invoke", _invoke_returning_leaky)

    result = await provider.review(Operation.grade_review, _REVIEW_PAYLOAD)
    assert result.content["items"] == [{"grade_id": "abc", "verdict": "flagged"}]
    assert result.provider == "openai"
    assert result.prompt_version  # populated from the prompts registry


# --- Retry / non-retry classes ----------------------------------------


async def test_review_retries_on_transient_then_succeeds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A transient :class:`openai.RateLimitError` raised once is retried
    by the :mod:`tenacity` wrapper; the second call succeeds and the
    response parses normally. Wait policy is the production policy —
    the test verifies retry behaviour, not its exact timing."""
    # Reach inside the retried ``_invoke`` so the underlying SDK call is
    # the seam we monkeypatch. ``_invoke`` is decorated with tenacity;
    # we don't want to bypass its retry, we want to feed it an inner
    # function that raises-then-succeeds. The cleanest seam is the SDK
    # client call itself — patch ``OpenAIProvider._get_client`` to
    # return a stub whose ``chat.completions.create`` raises once then
    # succeeds.

    class _StubCompletions:
        def __init__(self) -> None:
            self.calls = 0

        async def create(self, **kwargs: object) -> ChatCompletion:
            self.calls += 1
            if self.calls == 1:
                # RateLimitError needs a response + body to construct;
                # use the SDK's documented build path with a mock.
                raise openai.RateLimitError(
                    message="rate limited",
                    response=_fake_http_response(429),
                    body=None,
                )
            return _stub_chat_completion(
                '{"items": [{"grade_id": "abc", "verdict": "confirmed"}]}'
            )

    class _StubChat:
        def __init__(self) -> None:
            self.completions = _StubCompletions()

    class _StubClient:
        def __init__(self) -> None:
            self.chat = _StubChat()

    stub_client = _StubClient()
    provider = OpenAIProvider()
    monkeypatch.setattr(provider, "_get_client", lambda: stub_client)
    # Disable real backoff sleeps in the retry decorator so the test is
    # fast — tenacity reads its wait function lazily each iteration.
    import tenacity

    monkeypatch.setattr(openai_module._invoke.retry, "wait", tenacity.wait_none())

    result = await provider.review(Operation.grade_review, _REVIEW_PAYLOAD)
    assert result.content == {"items": [{"grade_id": "abc", "verdict": "confirmed"}]}
    assert stub_client.chat.completions.calls == 2


async def test_review_does_not_retry_on_auth_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """:class:`openai.AuthenticationError` (401) is not in the retryable
    set — a stale API key fails immediately rather than looping through
    four retries while burning wall-clock against the 60-s ceiling."""

    class _StubCompletions:
        def __init__(self) -> None:
            self.calls = 0

        async def create(self, **kwargs: object) -> ChatCompletion:
            self.calls += 1
            raise openai.AuthenticationError(
                message="bad key",
                response=_fake_http_response(401),
                body=None,
            )

    class _StubChat:
        def __init__(self) -> None:
            self.completions = _StubCompletions()

    class _StubClient:
        def __init__(self) -> None:
            self.chat = _StubChat()

    stub_client = _StubClient()
    provider = OpenAIProvider()
    monkeypatch.setattr(provider, "_get_client", lambda: stub_client)

    with pytest.raises(openai.AuthenticationError):
        await provider.review(Operation.grade_review, _REVIEW_PAYLOAD)
    assert stub_client.chat.completions.calls == 1


# --- Prompt registry exposure ----------------------------------------


def test_grade_review_prompt_registered() -> None:
    """The grade_review prompt is in the registry with a non-empty
    template and a valid version string. The shape-level assertions
    (template length, JSON directive, semver) are covered by
    :mod:`tests.unit.test_p5_prompts`; this is the P6-specific guard
    that the entry exists at all."""
    template, version = get_prompt(Operation.grade_review)
    assert template
    assert version == "1.0.0"
    assert Operation.grade_review in registered_operations()


# --- Internal helpers for retry test ---------------------------------


def _fake_http_response(status_code: int) -> object:
    """Minimal httpx.Response-shape stub for the openai SDK's error
    constructors. They consult ``status_code``, ``request``,
    ``headers``; we only need ``status_code`` to construct the error."""
    import httpx

    return httpx.Response(
        status_code=status_code, request=httpx.Request("POST", "https://x")
    )
