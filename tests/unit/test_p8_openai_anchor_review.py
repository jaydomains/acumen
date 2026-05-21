"""P8 OpenAIProvider.review(anchor_self_review) — cross-family anchor
self-review wiring (AC-D23 / AC-CD8 v1.6).

The SDK is never reached: ``_invoke`` is monkeypatched to return a
crafted :class:`openai.types.chat.ChatCompletion` so the parse / cost /
provenance paths are exercised without a network call (AC-CD15). Mirrors
the :mod:`tests.unit.test_p6_openai_review` shape for ``grade_review``;
this file covers the P8-added ``anchor_self_review`` op.
"""

from __future__ import annotations

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
    text: str, *, prompt_tokens: int = 200, completion_tokens: int = 80
) -> ChatCompletion:
    """Build a minimal :class:`ChatCompletion` for the provider parser."""
    return ChatCompletion(
        id="chatcmpl-test-anchor",
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


# A realistic-shape payload — one anchor per item. Two items here so
# the batched-output assertions exercise multi-item behaviour.
_REVIEW_PAYLOAD = {
    "items_json": (
        '[{"anchor_question_id":"a1","pill_name":"Lifting",'
        '"band":5,"assumed_difficulty":5,"type":"multiple_choice",'
        '"config":{"prompt":"q?","options":["a","b","c"],"correct":1}},'
        '{"anchor_question_id":"a2","pill_name":"Lifting",'
        '"band":5,"assumed_difficulty":5,"type":"true_false",'
        '"config":{"prompt":"t?","correct":true}}]'
    )
}


# --- Happy paths ------------------------------------------------------


async def test_review_anchor_self_review_ok_verdict(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A well-formed batched anchor self-review response yields an
    :class:`AIResult` with parsed ``content``, full provenance, and cost
    computed against the OpenAI price table."""
    provider = OpenAIProvider()
    canned = (
        '{"items": ['
        '{"anchor_question_id": "a1", "verdict": "ok"},'
        '{"anchor_question_id": "a2", "verdict": "ok"}'
        "]}"
    )

    async def _stub_invoke(*args: object, **kwargs: object) -> ChatCompletion:
        return _stub_chat_completion(canned, prompt_tokens=200, completion_tokens=80)

    monkeypatch.setattr(openai_module, "_invoke", _stub_invoke)

    result = await provider.review(Operation.anchor_self_review, _REVIEW_PAYLOAD)
    assert result.content == {
        "items": [
            {"anchor_question_id": "a1", "verdict": "ok"},
            {"anchor_question_id": "a2", "verdict": "ok"},
        ]
    }
    assert result.provider == "openai"
    assert result.model == "gpt-4o"
    assert result.prompt_version == "1.0.0"
    assert result.prompt_tokens == 200
    assert result.completion_tokens == 80
    assert result.cost_usd == compute_cost("openai", "gpt-4o", 200, 80)


async def test_review_anchor_self_review_flagged_with_reasoning(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Flagged verdicts carry a ``reasoning`` field. The provider does
    not interpret the content — it returns the parsed JSON for the
    caller (Slice 2's bootstrap loop) to act on."""
    provider = OpenAIProvider()
    canned = (
        '{"items": [{"anchor_question_id": "a1", "verdict": "flagged",'
        '"reasoning": "Two plausible correct options; pill-fit ok."}]}'
    )

    async def _stub_invoke(*args: object, **kwargs: object) -> ChatCompletion:
        return _stub_chat_completion(canned)

    monkeypatch.setattr(openai_module, "_invoke", _stub_invoke)

    result = await provider.review(Operation.anchor_self_review, _REVIEW_PAYLOAD)
    assert result.content["items"][0]["verdict"] == "flagged"
    assert "plausible" in result.content["items"][0]["reasoning"]


# --- Routing guards ---------------------------------------------------


async def test_review_anchor_self_review_no_longer_raises_not_implemented(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Regression guard against the P6-era NotImplementedError branch
    that pointed at P8. P8 wires the prompt + caller; ``review()``
    must now reach ``_call`` rather than short-circuiting."""
    provider = OpenAIProvider()
    canned = '{"items": [{"anchor_question_id": "a1", "verdict": "ok"}]}'

    async def _stub_invoke(*args: object, **kwargs: object) -> ChatCompletion:
        return _stub_chat_completion(canned)

    monkeypatch.setattr(openai_module, "_invoke", _stub_invoke)

    # No assertion on the call — the absence of NotImplementedError IS
    # the assertion. If P9 / later ever moves anchor_self_review back
    # behind a guard this test surfaces it.
    result = await provider.review(Operation.anchor_self_review, _REVIEW_PAYLOAD)
    assert result.provider == "openai"


# --- Contextual-error paths -------------------------------------------


async def test_review_anchor_self_review_missing_payload_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A payload missing the ``{items_json}`` key surfaces as
    :class:`ValueError` carrying the op name + missing key + available
    keys — same contextual-error shape grade_review has."""
    provider = OpenAIProvider()

    async def _no_op_invoke(*args: object, **kwargs: object) -> ChatCompletion:
        raise AssertionError("_invoke should not be called on render failure")

    monkeypatch.setattr(openai_module, "_invoke", _no_op_invoke)

    with pytest.raises(ValueError) as exc_info:
        await provider.review(Operation.anchor_self_review, {"unrelated_key": "value"})
    msg = str(exc_info.value)
    assert "anchor_self_review" in msg
    assert "items_json" in msg
    assert "unrelated_key" in msg


async def test_review_anchor_self_review_malformed_json_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When the model returns non-JSON the :class:`ValueError` raised
    by ``_call`` carries the operation name + provider + model + a
    truncated snippet — same defensive shape grade_review has."""
    provider = OpenAIProvider()
    raw_text = "Sorry, I cannot answer in JSON today."

    async def _invoke_returning_prose(*args: object, **kwargs: object) -> ChatCompletion:
        return _stub_chat_completion(raw_text)

    monkeypatch.setattr(openai_module, "_invoke", _invoke_returning_prose)

    with pytest.raises(ValueError) as exc_info:
        await provider.review(Operation.anchor_self_review, _REVIEW_PAYLOAD)
    msg = str(exc_info.value)
    assert "anchor_self_review" in msg
    assert "openai" in msg
    assert "gpt-4o" in msg
    assert "Sorry, I cannot answer in JSON today." in msg


async def test_review_anchor_self_review_recoverable_json_in_prose(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The brace-scan fallback is shared with grade_review: a leaky
    one-line prefix around valid JSON still parses cleanly."""
    provider = OpenAIProvider()
    leaky = (
        "Here is the JSON you asked for:\n"
        '{"items": [{"anchor_question_id": "a1", "verdict": "flagged",'
        '"reasoning": "ambiguous"}]}'
    )

    async def _invoke_returning_leaky(*args: object, **kwargs: object) -> ChatCompletion:
        return _stub_chat_completion(leaky)

    monkeypatch.setattr(openai_module, "_invoke", _invoke_returning_leaky)

    result = await provider.review(Operation.anchor_self_review, _REVIEW_PAYLOAD)
    assert result.content["items"][0]["verdict"] == "flagged"


# --- Prompt registry exposure ----------------------------------------


def test_anchor_self_review_prompt_registered() -> None:
    """The ``anchor_self_review`` prompt is now in the registry with a
    non-empty template and a valid version string. Shape-level
    assertions (length, JSON directive, semver) are covered by
    :mod:`tests.unit.test_p5_prompts`; this is the P8-specific guard
    that the entry exists at all."""
    template, version = get_prompt(Operation.anchor_self_review)
    assert template
    assert version == "1.0.0"
    assert Operation.anchor_self_review in registered_operations()
