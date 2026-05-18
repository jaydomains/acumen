"""AIProvider protocol + per-operation resolution (AC-D12 / AC-CD8).

Defines ``generate()``, ``grade()``, ``review()``, ``embed()`` and the
Test-override -> system-override -> coded-default resolution order.
CODE_SPEC §7.

P3 ships the protocol plus a **deterministic stub** only. The single
P3 consumer is the AI pill-proposal queue (AC-D7/AC-D8): a proposal is
built by ``generate("pill_proposal", ...)`` and carries the proposing
model's self-applied safety classification per AC-D21. No network call
is ever made (AC-CD15). The real Anthropic/OpenAI wiring is **P5**
(``app/ai/anthropic.py`` / ``app/ai/openai.py``); the single swap point
is ``resolve_provider`` — when P5 lands it consults
``system_settings.provider_by_operation`` / ``model_by_operation`` and a
per-Test override (the documented Test -> system -> coded-default order)
instead of always returning the stub.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

# Built-in safety cues the stub self-classifies a proposed pill against.
# Deliberately tiny and code-local: the authoritative, tenant-tunable
# keyword list lives in ``system_settings.safety_keyword_list`` and is
# applied by ``app.domain.safety_links`` — this is only the stubbed
# "proposing AI's self-classification" signal of AC-D21, not the keyword
# detector.
_STUB_SAFETY_CUES = ("safety", "hazard", "ppe", "electrical", "confined")


@runtime_checkable
class AIProvider(Protocol):
    """The four AI operations Acumen needs (AC-D12 / AC-CD8)."""

    async def generate(
        self, operation: str, payload: dict[str, Any]
    ) -> dict[str, Any]: ...

    async def grade(self, payload: dict[str, Any]) -> dict[str, Any]: ...

    async def review(self, payload: dict[str, Any]) -> dict[str, Any]: ...

    async def embed(self, text: str) -> list[float]: ...


class StubAIProvider:
    """Deterministic, offline stand-in (AC-CD15). Same input -> same
    output; never touches the network. Real providers are P5."""

    name = "stub"

    async def generate(self, operation: str, payload: dict[str, Any]) -> dict[str, Any]:
        if operation == "pill_proposal":
            name = str(payload.get("name", "")).strip()
            description = str(payload.get("description", "")).strip()
            haystack = f"{name} {description}".lower()
            safety = any(cue in haystack for cue in _STUB_SAFETY_CUES)
            return {
                "name": name,
                "description": description,
                "subject_id": payload.get("subject_id"),
                "available_difficulty_min": payload.get("available_difficulty_min", 1),
                "available_difficulty_max": payload.get("available_difficulty_max", 10),
                "estimated_minutes": payload.get("estimated_minutes"),
                "safety_relevant": safety,
                "rationale": (
                    "Stubbed proposal: surfaces a catalogue gap for admin "
                    "review. Safety self-classification is keyword-cue based "
                    "until the P5 model wiring lands."
                ),
            }
        return {"operation": operation, "stubbed": True}

    async def grade(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {"stubbed": True}

    async def review(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {"stubbed": True}

    async def embed(self, text: str) -> list[float]:
        return [0.0]


_STUB = StubAIProvider()


def resolve_provider(
    operation: str,
    *,
    system_settings: Any | None = None,
    test_override: str | None = None,
) -> AIProvider:
    """Resolve the provider for ``operation``.

    Resolution order is Test override -> system setting -> coded default
    (AC-CD8). P3 has no real providers wired, so every operation resolves
    to the deterministic stub regardless of the inputs; ``system_settings``
    / ``test_override`` are accepted now so the P5 swap is mechanical and
    callers do not change.
    """
    return _STUB
