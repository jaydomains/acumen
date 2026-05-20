"""P5 provider + model resolution order (AC-D12 v1.6 / AC-CD8 v1.6).

The P5 done-when calls for "model resolution order unit-tested". This
file exercises :func:`app.ai.provider.resolve_provider` and
:func:`app.ai.provider.resolve_model` against the documented chain:

1. ``test_override`` (caller-passed) wins.
2. ``system_settings.provider_by_operation[op.value]`` (a non-empty,
   non-null JSONB value) wins next; ``model_by_operation`` follows the
   same shape.
3. ``system_settings.review_provider`` is the convenience default for
   ``grade_review`` and ``anchor_self_review`` only.
4. Coded default: ``anthropic`` for the 5 Anthropic ops + ``pill_proposal``;
   ``openai`` for ``grade_review`` / ``anchor_self_review`` / ``embed``.

Plus the dev/local stub-fallback path: when the resolved provider's API
key is unset, :func:`resolve_provider` returns :class:`StubAIProvider`
so a misconfigured key does not crash the dev env (Slice 1 plan-review
addition).

No DB, no network — pure-function tests over the resolver.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from unittest.mock import patch

import pytest

from app.ai.anthropic import AnthropicProvider
from app.ai.openai import OpenAIProvider
from app.ai.provider import (
    Operation,
    StubAIProvider,
    resolve_model,
    resolve_provider,
)


@dataclass
class _FakeSettings:
    """Minimal SystemSettings stand-in — only the columns the resolver
    actually reads. Mirrors the JSONB shape: missing key, empty string,
    and JSON null all mean "unset" and must fall through identically."""

    provider_by_operation: dict[str, Any] = field(default_factory=dict)
    model_by_operation: dict[str, Any] = field(default_factory=dict)
    review_provider: str | None = "openai"


# Every operation in the enum — used to assert per-operation isolation.
_ALL_OPS: list[Operation] = list(Operation)

# The 5 Anthropic ops (AC-D12 v1.6: default Anthropic when nothing
# overrides them) + pill_proposal which is the 5th Anthropic op.
_ANTHROPIC_OPS: list[Operation] = [
    Operation.generation,
    Operation.grading,
    Operation.weakness,
    Operation.learning_material,
    Operation.pill_proposal,
]

# The 2 cross-family + embed: default OpenAI.
_OPENAI_OPS: list[Operation] = [
    Operation.grade_review,
    Operation.anchor_self_review,
    Operation.embed,
]


# --- Fixtures that keep the resolver out of the stub fallback path ---


@pytest.fixture
def both_keys_set(monkeypatch: pytest.MonkeyPatch) -> None:
    """Force both API keys non-empty so the resolver returns the real
    provider class, not the stub fallback. The stub fallback is covered
    by its own dedicated test."""
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "anthropic_api_key", "test-anthropic-key")
    monkeypatch.setattr(settings, "openai_api_key", "test-openai-key")


# --- Provider resolution — coded defaults (AC-D12) -------------------


@pytest.mark.parametrize("op", _ANTHROPIC_OPS)
def test_coded_default_anthropic_for_anthropic_ops(
    op: Operation, both_keys_set: None
) -> None:
    """The 5 Anthropic-side ops resolve to the Anthropic provider class
    when no override is configured (AC-D12 v1.6)."""
    provider = resolve_provider(op)
    assert isinstance(provider, AnthropicProvider)


@pytest.mark.parametrize("op", _OPENAI_OPS)
def test_coded_default_openai_for_review_and_embed_ops(
    op: Operation, both_keys_set: None
) -> None:
    """grade_review, anchor_self_review, and embed all resolve to the
    OpenAI provider class by coded default (AC-D12 / AC-D19 / AC-D22)."""
    provider = resolve_provider(op)
    assert isinstance(provider, OpenAIProvider)


# --- provider_by_operation override -----------------------------------


def test_provider_by_operation_override_wins(both_keys_set: None) -> None:
    """A non-empty string in ``provider_by_operation[op]`` beats the
    coded default (AC-D12 v1.6 / AC-CD8 v1.6)."""
    settings = _FakeSettings(provider_by_operation={Operation.generation.value: "openai"})
    provider = resolve_provider(Operation.generation, system_settings=settings)
    assert isinstance(provider, OpenAIProvider)


def test_per_operation_isolation(both_keys_set: None) -> None:
    """Setting an override on one operation does not bleed into the
    others. Critical because ``provider_by_operation`` is JSONB and a
    single-op override must stay scoped to that op."""
    settings = _FakeSettings(provider_by_operation={Operation.grading.value: "openai"})
    # The configured op flips to OpenAI.
    assert isinstance(
        resolve_provider(Operation.grading, system_settings=settings),
        OpenAIProvider,
    )
    # The other 4 Anthropic ops stay on Anthropic — no leak.
    for op in (
        Operation.generation,
        Operation.weakness,
        Operation.learning_material,
        Operation.pill_proposal,
    ):
        assert isinstance(
            resolve_provider(op, system_settings=settings), AnthropicProvider
        ), f"operation {op.value!r} should be unaffected by grading override"


@pytest.mark.parametrize(
    "falsy_value",
    [
        pytest.param("", id="empty-string-falls-through"),
        pytest.param(None, id="json-null-falls-through"),
    ],
)
def test_falsy_provider_entry_falls_through_to_coded_default(
    falsy_value: Any, both_keys_set: None
) -> None:
    """JSONB ``provider_by_operation`` entries that are an empty string
    OR JSON null must fall through to the coded default — both are valid
    "unset" JSONB shapes and must behave identically (Slice 1 plan-review
    addition #2)."""
    settings = _FakeSettings(
        provider_by_operation={Operation.generation.value: falsy_value}
    )
    provider = resolve_provider(Operation.generation, system_settings=settings)
    assert isinstance(provider, AnthropicProvider)


# --- review_provider convenience default ------------------------------


def test_review_provider_is_default_for_grade_review(both_keys_set: None) -> None:
    """``system_settings.review_provider`` is the convenience default
    for ``grade_review`` per AC-CD8 v1.6 — overriding it flips
    grade_review to the chosen provider without populating
    ``provider_by_operation``."""
    settings = _FakeSettings(review_provider="anthropic")
    provider = resolve_provider(Operation.grade_review, system_settings=settings)
    assert isinstance(provider, AnthropicProvider)


def test_review_provider_is_default_for_anchor_self_review(
    both_keys_set: None,
) -> None:
    """Same convenience default applies to ``anchor_self_review`` per
    AC-CD8 v1.6 (which calls out both ops by name)."""
    settings = _FakeSettings(review_provider="anthropic")
    provider = resolve_provider(Operation.anchor_self_review, system_settings=settings)
    assert isinstance(provider, AnthropicProvider)


def test_review_provider_does_not_leak_to_other_ops(both_keys_set: None) -> None:
    """``review_provider`` flipping to Anthropic must not affect the 5
    Anthropic ops (they were already Anthropic by coded default) nor
    ``embed`` (which is the OpenAI embedding model, not a review op)."""
    settings = _FakeSettings(review_provider="anthropic")
    for op in _ANTHROPIC_OPS:
        assert isinstance(
            resolve_provider(op, system_settings=settings), AnthropicProvider
        )
    assert isinstance(
        resolve_provider(Operation.embed, system_settings=settings),
        OpenAIProvider,
    )


def test_provider_by_operation_beats_review_provider(both_keys_set: None) -> None:
    """When ``provider_by_operation`` and ``review_provider`` both target
    ``grade_review``, the explicit ``provider_by_operation`` entry wins
    — it is the more specific knob."""
    settings = _FakeSettings(
        provider_by_operation={Operation.grade_review.value: "anthropic"},
        review_provider="openai",
    )
    provider = resolve_provider(Operation.grade_review, system_settings=settings)
    assert isinstance(provider, AnthropicProvider)


# --- Test override (per-Test provider override) -----------------------


def test_test_override_beats_system_settings(both_keys_set: None) -> None:
    """The per-Test override (carried into the resolver by the caller as
    ``test_override=``) is the highest-precedence knob — beats both
    ``provider_by_operation`` and the coded default."""
    settings = _FakeSettings(
        provider_by_operation={Operation.generation.value: "anthropic"}
    )
    provider = resolve_provider(
        Operation.generation, system_settings=settings, test_override="openai"
    )
    assert isinstance(provider, OpenAIProvider)


def test_test_override_beats_coded_default(both_keys_set: None) -> None:
    """No system_settings configured at all → coded default would be
    Anthropic; test_override flips it to OpenAI."""
    provider = resolve_provider(Operation.generation, test_override="openai")
    assert isinstance(provider, OpenAIProvider)


def test_unknown_provider_name_raises(both_keys_set: None) -> None:
    """A typo / misconfigured provider name surfaces as a ``ValueError``
    rather than a silent fallback — the dashboard would otherwise show
    bogus aggregates."""
    with pytest.raises(ValueError, match="Unknown provider"):
        resolve_provider(Operation.generation, test_override="cohere")


def test_string_operation_is_coerced_to_enum(both_keys_set: None) -> None:
    """The resolver accepts ``str`` for backwards compatibility with any
    caller that has not yet been migrated — coerced into the enum
    internally so the rest of the chain is type-safe."""
    provider = resolve_provider("generation")
    assert isinstance(provider, AnthropicProvider)


# --- Model resolution (mirrors provider resolution) -------------------


def test_model_coded_defaults_come_from_config(both_keys_set: None) -> None:
    """No system_settings, no override → :func:`resolve_model` returns
    the env-overridable default from :mod:`app.config` (AC-CD18)."""
    from app.config import get_settings

    cfg = get_settings()
    assert resolve_model(Operation.generation) == cfg.anthropic_model_generation
    assert resolve_model(Operation.grading) == cfg.anthropic_model_grading
    assert resolve_model(Operation.weakness) == cfg.anthropic_model_weakness
    assert resolve_model(Operation.learning_material) == cfg.anthropic_model_material
    assert resolve_model(Operation.pill_proposal) == cfg.anthropic_model_pill_proposal
    assert resolve_model(Operation.grade_review) == cfg.openai_model_review
    assert resolve_model(Operation.anchor_self_review) == cfg.openai_model_review
    assert resolve_model(Operation.embed) == cfg.openai_embedding_model


def test_model_by_operation_override_wins() -> None:
    """A non-empty string in ``model_by_operation[op]`` beats the coded
    default — same resolution shape as the provider chain."""
    settings = _FakeSettings(
        model_by_operation={Operation.generation.value: "claude-opus-x"}
    )
    assert (
        resolve_model(Operation.generation, system_settings=settings) == "claude-opus-x"
    )


def test_model_test_override_beats_system() -> None:
    """The per-Test model override is the highest-precedence knob."""
    settings = _FakeSettings(
        model_by_operation={Operation.generation.value: "claude-opus-x"}
    )
    assert (
        resolve_model(
            Operation.generation,
            system_settings=settings,
            test_override="claude-future-y",
        )
        == "claude-future-y"
    )


@pytest.mark.parametrize(
    "falsy_value",
    [
        pytest.param("", id="empty-string-falls-through"),
        pytest.param(None, id="json-null-falls-through"),
    ],
)
def test_model_falsy_entry_falls_through_to_coded_default(
    falsy_value: Any,
) -> None:
    """Same JSONB falsy-fallback rule as :func:`resolve_provider` — an
    empty string or JSON null in ``model_by_operation`` falls through
    to the env default (plan-review addition #2 extended to models)."""
    from app.config import get_settings

    settings = _FakeSettings(model_by_operation={Operation.generation.value: falsy_value})
    assert (
        resolve_model(Operation.generation, system_settings=settings)
        == get_settings().anthropic_model_generation
    )


# --- Stub fallback (plan-review addition #1) -------------------------


def test_stub_fallback_when_anthropic_key_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When ``settings.anthropic_api_key`` is empty, the resolver
    returns :class:`StubAIProvider` instead of constructing the real
    Anthropic provider — the dev/local fail-safe path that prevents a
    misconfigured-key dev env from crashing on first AI call (Slice 1
    plan-review addition #1).

    This test runs independent of any ``RecordingProvider`` monkeypatch
    so the fallback code path itself is exercised, not the test
    substitution path that production never sees.
    """
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "anthropic_api_key", "")
    # Force the lazy singleton un-cached so a previous test that built
    # the real provider doesn't poison this assertion.
    with patch("app.ai.provider._ANTHROPIC", None):
        provider = resolve_provider(Operation.generation)
        assert isinstance(provider, StubAIProvider)


def test_stub_fallback_when_openai_key_empty(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Same fail-safe applies on the OpenAI side: unset key → stub
    fallback for grade_review / anchor_self_review / embed."""
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "openai_api_key", "")
    with patch("app.ai.provider._OPENAI", None):
        for op in _OPENAI_OPS:
            provider = resolve_provider(op)
            assert isinstance(
                provider, StubAIProvider
            ), f"op {op.value!r} should fall back to stub when openai key unset"


def test_stub_fallback_only_when_key_empty(both_keys_set: None) -> None:
    """Sanity check the fixture: with both keys set, resolve_provider
    NEVER returns the stub — it builds the real provider class. Failure
    of this test would indicate the fallback is too eager and would
    silently route prod traffic through the stub."""
    for op in _ALL_OPS:
        provider = resolve_provider(op)
        assert not isinstance(
            provider, StubAIProvider
        ), f"op {op.value!r} should not fall back to stub when keys are set"
