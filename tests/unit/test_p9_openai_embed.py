"""P9 Slice 1 — OpenAIProvider.embed() unit coverage (AC-D22 / AC-CD9).

The SDK is never reached: the embeddings endpoint is monkeypatched at
the ``_invoke_embed`` seam to return a crafted
:class:`openai.types.CreateEmbeddingResponse` (or to raise the
documented error classes) so the cost / routing / retry paths are
exercised without a network call (AC-CD15). Mirrors the
:mod:`tests.unit.test_p6_openai_review` shape so a future reader can
read both files together.
"""

from __future__ import annotations

import openai
import pytest
from openai.types import CreateEmbeddingResponse, Embedding
from openai.types.create_embedding_response import Usage

from app.ai import openai as openai_module
from app.ai.cost import compute_cost
from app.ai.openai import OpenAIProvider
from app.ai.provider import Operation

# --- Helpers ----------------------------------------------------------


def _stub_embedding_response(
    embedding: list[float] | None = None,
    *,
    prompt_tokens: int = 120,
) -> CreateEmbeddingResponse:
    """Build a :class:`CreateEmbeddingResponse` carrying one embedding.
    The OpenAI SDK requires ``object`` / ``model`` / a single
    ``Embedding`` entry / a ``Usage`` block — supply minimum viable
    values; only ``data[0].embedding`` and ``usage.prompt_tokens`` are
    consulted by :meth:`OpenAIProvider.embed`."""
    vec = embedding if embedding is not None else [0.1] * 1536
    return CreateEmbeddingResponse(
        object="list",
        model="text-embedding-3-small",
        data=[
            Embedding(
                index=0,
                object="embedding",
                embedding=vec,
            )
        ],
        usage=Usage(prompt_tokens=prompt_tokens, total_tokens=prompt_tokens),
    )


# --- Happy path -------------------------------------------------------


async def test_embed_happy_path_returns_full_provenance(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A well-formed embedding call yields an :class:`EmbedResult` with
    the 1536-dim vector, OpenAI provider/model labels, and cost
    computed against the OpenAI embedding entry in PRICE_TABLE."""
    provider = OpenAIProvider()
    canned = _stub_embedding_response([0.5] * 1536, prompt_tokens=200)

    async def _stub_invoke_embed(
        *args: object, **kwargs: object
    ) -> CreateEmbeddingResponse:
        return canned

    monkeypatch.setattr(openai_module, "_invoke_embed", _stub_invoke_embed)

    result = await provider.embed(Operation.embed, "any text")
    assert result.embedding == [0.5] * 1536
    assert result.provider == "openai"
    assert result.model == "text-embedding-3-small"
    assert result.prompt_tokens == 200
    assert result.cost_usd == compute_cost("openai", "text-embedding-3-small", 200, 0)
    # Sanity check: the cost computation against the embedding entry
    # (0.02 USD/1M input tokens, 0.0 output) is positive even though
    # completion_tokens is 0 — a regression here would silently zero
    # out the cost dashboard for the embed lane.
    assert result.cost_usd > 0.0


# --- Routing guards (AC-CD8 v1.6) -------------------------------------


async def test_embed_rejects_non_embed_operation_with_routing_message() -> None:
    """``embed()`` rejects any non-``embed`` op with a routing message
    that points operators at the correct method — mirrors the
    ``review()`` guard at openai.py."""
    provider = OpenAIProvider()
    for op in (
        Operation.generation,
        Operation.grading,
        Operation.grade_review,
        Operation.anchor_self_review,
    ):
        with pytest.raises(ValueError, match=op.value):
            await provider.embed(op, "any text")


# --- Retry / non-retry classes ----------------------------------------


async def test_embed_retries_on_transient_then_succeeds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A transient :class:`openai.RateLimitError` raised once is retried
    by the :mod:`tenacity` wrapper on ``_invoke_embed``; the second
    call succeeds and the response parses normally. Wait policy is the
    production policy — the test verifies retry behaviour, not its
    exact timing (tenacity wait is set to no-op for test speed)."""

    class _StubEmbeddings:
        def __init__(self) -> None:
            self.calls = 0

        async def create(self, **kwargs: object) -> CreateEmbeddingResponse:
            self.calls += 1
            if self.calls == 1:
                raise openai.RateLimitError(
                    message="rate limited",
                    response=_fake_http_response(429),
                    body=None,
                )
            return _stub_embedding_response()

    class _StubClient:
        def __init__(self) -> None:
            self.embeddings = _StubEmbeddings()

    stub_client = _StubClient()
    provider = OpenAIProvider()
    monkeypatch.setattr(provider, "_get_client", lambda: stub_client)
    import tenacity

    monkeypatch.setattr(openai_module._invoke_embed.retry, "wait", tenacity.wait_none())

    result = await provider.embed(Operation.embed, "any text")
    assert len(result.embedding) == 1536
    assert stub_client.embeddings.calls == 2


async def test_embed_does_not_retry_on_auth_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """:class:`openai.AuthenticationError` (401) is not in the
    retryable set — a stale API key fails immediately rather than
    looping through four retries."""

    class _StubEmbeddings:
        def __init__(self) -> None:
            self.calls = 0

        async def create(self, **kwargs: object) -> CreateEmbeddingResponse:
            self.calls += 1
            raise openai.AuthenticationError(
                message="bad key",
                response=_fake_http_response(401),
                body=None,
            )

    class _StubClient:
        def __init__(self) -> None:
            self.embeddings = _StubEmbeddings()

    stub_client = _StubClient()
    provider = OpenAIProvider()
    monkeypatch.setattr(provider, "_get_client", lambda: stub_client)

    with pytest.raises(openai.AuthenticationError):
        await provider.embed(Operation.embed, "any text")
    assert stub_client.embeddings.calls == 1


# --- Defensive guard against malformed responses ---------------------


async def test_embed_raises_clear_error_on_empty_response_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If the OpenAI API ever returns an empty ``data`` list (contract
    violation, mocked-in-test mistake, or SDK change), :meth:`embed`
    surfaces a contextual :class:`ValueError` carrying the model name
    + provider rather than letting a raw ``IndexError`` lose that
    context (Gitar PR-#21 Slice 1 finding #2)."""
    provider = OpenAIProvider()
    empty_response = CreateEmbeddingResponse(
        object="list",
        model="text-embedding-3-small",
        data=[],  # Defensive guard target.
        usage=Usage(prompt_tokens=0, total_tokens=0),
    )

    async def _stub_invoke_embed(
        *args: object, **kwargs: object
    ) -> CreateEmbeddingResponse:
        return empty_response

    monkeypatch.setattr(openai_module, "_invoke_embed", _stub_invoke_embed)

    with pytest.raises(ValueError) as exc_info:
        await provider.embed(Operation.embed, "any text")
    msg = str(exc_info.value)
    assert "text-embedding-3-small" in msg
    assert "openai" in msg
    assert "empty data" in msg


# --- Cost regression guard -------------------------------------------


def test_embed_price_table_entry_yields_positive_cost() -> None:
    """Regression guard for the (0.02, 0.0) PRICE_TABLE shape: an
    embed call with zero completion_tokens must still produce a
    positive cost. Catches a future refactor that accidentally
    multiplies both rates."""
    cost_small = compute_cost("openai", "text-embedding-3-small", 100, 0)
    cost_large = compute_cost("openai", "text-embedding-3-small", 1_000_000, 0)
    assert cost_small > 0.0
    assert cost_large == 0.02
    assert cost_large > cost_small


# --- Internal helpers for retry tests --------------------------------


def _fake_http_response(status_code: int) -> object:
    """Minimal httpx.Response-shape stub for the openai SDK's error
    constructors. Mirrors the helper in :mod:`tests.unit.test_p6_openai_review`."""
    import httpx

    return httpx.Response(
        status_code=status_code, request=httpx.Request("POST", "https://x")
    )
