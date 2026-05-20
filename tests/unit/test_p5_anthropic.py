"""P5 AnthropicProvider error surface — the contextual-error paths
added in Slice 1 after Gitar review of PR #16.

Two narrow unit tests covering the AnthropicProvider's two contextual
re-raise paths:

* Missing payload key → :class:`ValueError` (op + missing key +
  available keys) — finding #1, via :func:`app.ai.prompts.render_prompt`.
* Malformed JSON response → :class:`ValueError` (op + provider + model +
  truncated raw text) — finding #2.

The SDK is never reached: ``_invoke`` is monkeypatched to return a
crafted ``anthropic.types.Message`` so the JSON-parse path is exercised
without a network call (AC-CD15). Routing tests (method ↔ operation
mapping) sit alongside.
"""

from __future__ import annotations

import pytest
from anthropic.types import Message, TextBlock, Usage

from app.ai import anthropic as anthropic_module
from app.ai.anthropic import AnthropicProvider
from app.ai.provider import Operation


def _stub_message(text: str) -> Message:
    """Build an ``anthropic.types.Message`` with a single TextBlock so
    the JSON parser sees the supplied ``text`` verbatim. ``stop_reason``
    + ``role`` + ``type`` + ``model`` + ``id`` are required by the
    Message constructor but the values are arbitrary for this test —
    only ``content`` and ``usage`` are consulted by ``_parse_json_content``
    / ``_call``."""
    return Message(
        id="msg_test",
        type="message",
        role="assistant",
        model="claude-sonnet-4-6",
        stop_reason="end_turn",
        stop_sequence=None,
        content=[TextBlock(type="text", text=text, citations=None)],
        usage=Usage(input_tokens=100, output_tokens=50),
    )


# --- Finding #1: missing payload key surfaces with full context ------


async def test_missing_payload_key_raises_with_operation_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Calling ``generate`` with a payload missing a template key must
    raise :class:`ValueError` carrying the operation name + the missing
    key + the sorted list of available keys — not an opaque ``KeyError``
    from inside ``str.format()`` (Gitar PR-#16 Slice 1 finding #1)."""
    provider = AnthropicProvider()

    async def _no_op_invoke(*args: object, **kwargs: object) -> Message:
        # Should never be reached — the template-render failure must
        # surface before the SDK call is attempted.
        raise AssertionError("_invoke should not be called on render failure")

    monkeypatch.setattr(anthropic_module, "_invoke", _no_op_invoke)

    with pytest.raises(ValueError) as exc_info:
        # The grading prompt requires {question}, {rubric},
        # {model_answer}, {candidate_response} — the payload here has
        # none of them.
        await provider.grade(Operation.grading, {"unrelated_key": "value"})
    msg = str(exc_info.value)
    assert "grading" in msg, "operation name must appear in the error"
    assert "question" in msg, "missing key must appear in the error"
    assert "unrelated_key" in msg, "available keys must appear in the error"


# --- Finding #2: malformed JSON surfaces with full context ------------


async def test_malformed_json_response_raises_with_model_and_raw_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When the model returns non-JSON despite the "JSON only" prompt
    directive, the :class:`ValueError` raised by ``_call`` must carry
    the operation name + provider + model + a truncated snippet of the
    raw response. Catches the silent-loss-of-context Gitar PR-#16
    Slice 1 finding #2 flagged."""
    provider = AnthropicProvider()
    raw_text = "Sorry, I cannot answer in JSON today."

    async def _invoke_returning_prose(*args: object, **kwargs: object) -> Message:
        return _stub_message(raw_text)

    monkeypatch.setattr(anthropic_module, "_invoke", _invoke_returning_prose)

    # Use a payload that fully satisfies the grading template's keys so
    # the render step succeeds and the JSON-parse path is reached.
    payload = {
        "question": "q",
        "rubric": "r",
        "model_answer": "m",
        "candidate_response": "c",
    }
    with pytest.raises(ValueError) as exc_info:
        await provider.grade(Operation.grading, payload)
    msg = str(exc_info.value)
    assert "grading" in msg
    assert "anthropic" in msg
    assert "claude-sonnet-4-6" in msg or "claude" in msg
    # The truncated raw text must appear (first 200 chars; this snippet
    # is well under that cap).
    assert "Sorry, I cannot answer in JSON today." in msg


async def test_recoverable_json_in_prose_still_parses(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The pre-existing best-effort fallback (substring scan between
    the first ``{`` and the last ``}``) is preserved: a model that
    leaks a one-line prefix around valid JSON still parses cleanly
    rather than tripping the new error path."""
    provider = AnthropicProvider()
    leaky_response = (
        "Here is the JSON you asked for:\n"
        '{"score": 0.8, "verdict": "partial", "reasoning": "ok"}'
    )

    async def _invoke_returning_leaky(*args: object, **kwargs: object) -> Message:
        return _stub_message(leaky_response)

    monkeypatch.setattr(anthropic_module, "_invoke", _invoke_returning_leaky)

    payload = {
        "question": "q",
        "rubric": "r",
        "model_answer": "m",
        "candidate_response": "c",
    }
    result = await provider.grade(Operation.grading, payload)
    assert result.content["score"] == 0.8
    assert result.content["verdict"] == "partial"
    assert result.provider == "anthropic"
    assert result.prompt_version  # populated from the prompts registry


# --- Operation-to-method routing guards (AC-CD8 v1.6) ----------------


async def test_generate_rejects_grading_op() -> None:
    """``generate()`` must reject any op routed to a different method
    per AC-CD8 v1.6 — calling it with ``grading`` is a programming
    error, not an SDK call."""
    provider = AnthropicProvider()
    with pytest.raises(ValueError, match="grading"):
        await provider.generate(Operation.grading, {})


async def test_grade_rejects_generation_op() -> None:
    provider = AnthropicProvider()
    with pytest.raises(ValueError, match="grading"):
        await provider.grade(Operation.generation, {})


async def test_review_always_raises_not_implemented() -> None:
    """Anthropic ``review()`` is intentionally unimplemented — review
    runs on OpenAI by default per AC-D19 / P6. The error message must
    point at P6 so a misroute surfaces with the right phase pointer."""
    provider = AnthropicProvider()
    with pytest.raises(NotImplementedError, match="P6"):
        await provider.review(Operation.grade_review, {})


async def test_embed_always_raises_not_implemented() -> None:
    """Same for ``embed()`` — OpenAI text-embedding-3-small is the
    configured embedding provider per AC-D22 / P9."""
    provider = AnthropicProvider()
    with pytest.raises(NotImplementedError, match="P9"):
        await provider.embed(Operation.embed, "any text")
