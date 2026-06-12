"""AIProvider protocol + per-operation resolution (AC-D12 / AC-CD8).

Defines the four protocol methods (``generate``/``grade``/``review``/
``embed``), the ``Operation`` enum that drives per-operation model +
prompt_version resolution and provenance persistence (the canonical
operation count is nine, v1.9 — plus the internal ``embed``; the count
completed once ``pill_generation`` (B1) and ``content_self_review`` (C1)
wired in), the ``AIResult`` / ``EmbedResult`` structs the methods return,
and the Test-override → ``provider_by_operation`` →
``review_provider`` → coded-default resolution order (AC-CD8 v1.6).

The single swap point is :func:`resolve_provider`. Domain code never
imports a concrete provider class directly; it goes through this resolver
so the per-operation override knobs (`Test.provider_overrides`,
`system_settings.provider_by_operation`, `system_settings.review_provider`)
work uniformly. Slice 1 of P5 lands the resolver against the real
Anthropic provider; OpenAI's body is a skeleton until P6 (review) and
P9 (embed). When ``ANTHROPIC_API_KEY`` / ``OPENAI_API_KEY`` is unset the
resolver returns :class:`StubAIProvider` — this is the dev/local
fail-safe; tests substitute their own ``RecordingProvider`` via
monkeypatch on the module-level ``_ANTHROPIC`` / ``_OPENAI`` singletons.
"""

from __future__ import annotations

import enum
from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable

# Built-in safety cues the stub self-classifies a proposed pill against.
# Deliberately tiny and code-local: the authoritative, tenant-tunable
# keyword list lives in ``system_settings.safety_keyword_list`` and is
# applied by ``app.domain.safety_links`` — this is only the stubbed
# "proposing AI's self-classification" signal of AC-D21, not the keyword
# detector.
_STUB_SAFETY_CUES = ("safety", "hazard", "ppe", "electrical", "confined")


def _stub_pill_proposal_content(payload: dict[str, Any]) -> dict[str, Any]:
    """Build the stubbed AI pill-proposal payload — safety-classified
    against the small local cue list. Kept module-level so the stub
    body stays small and the logic is testable in isolation."""
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
            "until a real provider key is configured."
        ),
    }


def _stub_generation_content(payload: dict[str, Any]) -> dict[str, Any]:
    """Deterministic two-question stub set — keeps per_testee
    ``start_attempt`` working when no Anthropic key is configured
    (dev/local fail-safe).

    Seeded by ``payload["attempt_id"]`` so the same attempt always
    generates the same set on re-fetch / resume — preserves the
    determinism contract carried over from P4's ``_stub_generate``.
    """
    import random as _random
    import uuid as _uuid

    raw_attempt_id = payload.get("attempt_id") or "0"
    try:
        seed_uuid = _uuid.UUID(str(raw_attempt_id))
        seed = int.from_bytes(seed_uuid.bytes[-8:], "big", signed=False)
    except (ValueError, AttributeError):
        seed = abs(hash(str(raw_attempt_id))) & 0xFFFFFFFFFFFFFFFF
    rng = _random.Random(seed)
    difficulty = int(payload.get("target_difficulty") or 5)
    a = rng.randint(1, 9)
    b = rng.randint(1, 9)
    return {
        "questions": [
            {
                "type": "multiple_choice",
                "assigned_difficulty": difficulty,
                "config": {
                    "prompt": f"What is {a} + {b}?",
                    "options": [str(a + b - 1), str(a + b), str(a + b + 1)],
                    "correct": 1,
                },
            },
            {
                "type": "true_false",
                "assigned_difficulty": difficulty,
                "config": {
                    "prompt": f"{a} is greater than {b}.",
                    "correct": a > b,
                },
            },
        ]
    }


def _stub_pill_generation_content(payload: dict[str, Any]) -> dict[str, Any]:
    """Deterministic N-draft stub for ``pill_generation`` (AC-CD15).

    Seeded by ``topic`` + ``target_count`` (sha256, stable across runs) so the
    same payload yields byte-identical drafts; ``target_count`` is clamped to
    1-10; each draft carries the full schema and is safety-classified against
    the stub cue list. **v1.1.0 (B2):** each draft emits a structured
    ``grounding_refs`` (per-assertion ``{claim, source_doc_refs}``) echoing the
    ``corpus_refs`` the caller injected from the retrieved corpus; an empty
    corpus → ``grounding_refs: []`` (general-knowledge fallback)."""
    import hashlib as _hashlib
    import random as _random

    topic = str(payload.get("topic", "")).strip()
    target_count = max(1, min(int(payload.get("target_count") or 1), 10))
    dmin = max(1, min(int(payload.get("available_difficulty_min") or 1), 10))
    dmax = max(dmin, min(int(payload.get("available_difficulty_max") or 10), 10))
    subject_id = payload.get("subject_id")
    gap_signal = str(payload.get("gap_signal") or "stub")
    safety = any(cue in topic.lower() for cue in _STUB_SAFETY_CUES)
    corpus_refs = [str(r) for r in (payload.get("corpus_refs") or [])]

    seed = int.from_bytes(
        _hashlib.sha256(f"{topic}|{target_count}".encode()).digest()[:8], "big"
    )
    rng = _random.Random(seed)
    drafts: list[dict[str, Any]] = []
    for i in range(target_count):
        lo = rng.randint(dmin, dmax)
        hi = rng.randint(lo, dmax)
        name = f"{topic or 'Generated pill'} — aspect {i + 1}"
        # v1.1.0 grounding: one assertion per draft, grounded in the
        # injected corpus refs (deterministic); empty corpus → no grounding.
        grounding_refs = (
            [{"claim": f"{name}: key assertion", "source_doc_refs": list(corpus_refs)}]
            if corpus_refs
            else []
        )
        drafts.append(
            {
                "name": name,
                "description": (
                    f"Stub-generated competency draft for "
                    f"{topic or 'the topic'} (aspect {i + 1})."
                ),
                "subject_id": str(subject_id) if subject_id else None,
                "available_difficulty_min": lo,
                "available_difficulty_max": hi,
                "estimated_minutes": None,
                "safety_relevant": safety,
                "rationale": (
                    "Stubbed generation: a real Anthropic provider key is "
                    "required to generate grounded pill drafts."
                ),
                "evidence_count": 0,
                "gap_signal": gap_signal,
                "grounding_refs": grounding_refs,
            }
        )
    return {"drafts": drafts}


def _stub_content_self_review_content(payload: dict[str, Any]) -> dict[str, Any]:
    """Deterministic per-variant verdict for ``content_self_review`` (AC-CD15,
    C1). Reads the ``_prompt_variant`` + the ``draft`` the protocol injected so
    the three passes are exercisable offline without a network call:

    * **grounding** → pass with no unsupported claims (the stub trusts the
      cited grounding);
    * **provenance** → orphan = any draft claim whose ``source_doc_refs`` is
      empty (structural check; ``fail`` when orphans exist);
    * **safety** → re-adjudicates ``safety_relevant`` from the stub cue list —
      a cue-bearing draft mistagged ``False`` deterministically flips to
      ``True`` (the false-negative catch, AC-D21), ``fail`` on the flip.
    """
    variant = str(payload.get("_prompt_variant", "default"))
    draft = payload.get("draft") or {}
    if variant == "safety":
        name = str(draft.get("name", ""))
        description = str(draft.get("description", ""))
        topic = str(draft.get("topic", ""))
        haystack = f"{name} {description} {topic}".lower()
        self_tag = bool(draft.get("safety_relevant", False))
        readjudicated = self_tag or any(c in haystack for c in _STUB_SAFETY_CUES)
        flipped = readjudicated != self_tag
        return {
            "verdict": "fail" if flipped else "pass",
            "safety_relevant": readjudicated,
            "reasoning": (
                "Stub re-adjudicated a safety cue the draft mistagged."
                if flipped
                else "stub"
            ),
        }
    if variant == "provenance":
        orphans = [
            str(claim.get("claim", ""))
            for claim in draft.get("grounding_refs", [])
            if not claim.get("source_doc_refs")
        ]
        return {"verdict": "fail" if orphans else "pass", "orphan_claims": orphans}
    # grounding (and the default lookup) — stub trusts the cited grounding.
    return {"verdict": "pass", "unsupported_claims": []}


def _stub_result(content: dict[str, Any]) -> AIResult:
    """Build an :class:`AIResult` carrying the stub's fixed metadata.
    Cost is 0.0 and tokens are 0 — the stub never makes a network call
    so no spend is incurred (AC-CD15)."""
    return AIResult(
        content=content,
        provider="stub",
        model="stub-1",
        prompt_version="0.0.0-stub",
        prompt_tokens=0,
        completion_tokens=0,
        cost_usd=0.0,
    )


class Operation(str, enum.Enum):
    """The AI operations of AC-CD8 plus ``embed`` for the reference corpus.

    The canonical AI-operation count is **nine** (AC-CD8 / SPEC §6, v1.9 —
    excludes the internal ``embed``); the generator (``pill_generation``, B1)
    and the cross-model reviewer (``content_self_review``, C1) completed it.
    This enum carries the **nine** named operations + ``embed`` (ten members).

    The enum (not the method) drives per-operation model + prompt_version
    resolution and cost/provenance persistence. Routing to the four
    protocol methods (AC-CD8 v1.6):

    * ``generation`` / ``weakness`` / ``learning_material`` /
      ``pill_proposal`` / ``pill_generation`` → :meth:`AIProvider.generate`
    * ``grading`` → :meth:`AIProvider.grade`
    * ``grade_review`` / ``anchor_self_review`` / ``content_self_review`` →
      :meth:`AIProvider.review`
    * ``embed`` (reference corpus only) → :meth:`AIProvider.embed`
    """

    generation = "generation"
    grading = "grading"
    weakness = "weakness"
    learning_material = "learning_material"
    pill_proposal = "pill_proposal"
    pill_generation = "pill_generation"
    grade_review = "grade_review"
    anchor_self_review = "anchor_self_review"
    content_self_review = "content_self_review"
    embed = "embed"


# Operations that resolve via Anthropic by coded default (the 5 primary
# Anthropic-side ops per AC-D12 v1.6). The remaining ops
# (grade_review / anchor_self_review / embed) default to OpenAI.
_ANTHROPIC_DEFAULT_OPS: frozenset[Operation] = frozenset(
    {
        Operation.generation,
        Operation.grading,
        Operation.weakness,
        Operation.learning_material,
        Operation.pill_proposal,
        Operation.pill_generation,
    }
)

# Operations that fall under ``system_settings.review_provider`` as a
# convenience default per AC-CD8 v1.6 ("``review_provider`` is the
# convenience default for grade_review / anchor_self_review"). C1 (AC-D30)
# adds ``content_self_review`` — the cross-model generated-content review
# floor routes to the review provider (OpenAI, cross-family from the
# Anthropic generator).
_REVIEW_DEFAULT_OPS: frozenset[Operation] = frozenset(
    {
        Operation.grade_review,
        Operation.anchor_self_review,
        Operation.content_self_review,
    }
)


@dataclass(frozen=True)
class AIResult:
    """The contract every provider method returns.

    ``content`` is the operation-specific structured output (the question
    set for ``generation``, the grade payload for ``grading``, etc.).
    The remaining fields are provenance: stamped onto the producing
    entity's :class:`app.models.AIProvenanceMixin` columns via
    :func:`app.ai.cost.record_provenance` — never persisted globally.
    """

    content: dict[str, Any]
    provider: str
    model: str
    prompt_version: str
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float


@dataclass(frozen=True)
class EmbedResult:
    """Return shape for :meth:`AIProvider.embed`.

    Drive RAG / AC-D22 / P9. Separate from :class:`AIResult` because
    embeddings produce a vector, not structured content, and the embedding
    cost is tracked against the OpenAI provider per amended AC-D18.
    """

    embedding: list[float]
    provider: str
    model: str
    prompt_tokens: int
    cost_usd: float


@runtime_checkable
class AIProvider(Protocol):
    """The four AI operations Acumen needs (AC-D12 / AC-CD8 v1.6).

    Every call carries an :class:`Operation` enum. The enum drives
    per-operation model + prompt_version resolution and provenance
    persistence — the *method* is a routing guard rail only.
    """

    async def generate(
        self, operation: Operation, payload: dict[str, Any]
    ) -> AIResult: ...

    async def grade(self, operation: Operation, payload: dict[str, Any]) -> AIResult: ...

    async def review(self, operation: Operation, payload: dict[str, Any]) -> AIResult: ...

    async def embed(self, operation: Operation, text: str) -> EmbedResult: ...


class StubAIProvider:
    """Deterministic, offline stand-in (AC-CD15). Same input → same
    output; never touches the network.

    Slice 1 of P5 keeps the stub as the dev/local fail-safe path: when an
    API key is unset, :func:`resolve_provider` returns this stub so a
    misconfigured-key dev env does not crash on attempt-start /
    pill-proposal enqueue. Tests substitute their own
    ``RecordingProvider`` via monkeypatch.
    """

    name = "stub"

    async def generate(self, operation: Operation, payload: dict[str, Any]) -> AIResult:
        if operation == Operation.pill_proposal:
            content = _stub_pill_proposal_content(payload)
        elif operation == Operation.pill_generation:
            content = _stub_pill_generation_content(payload)
        elif operation == Operation.generation:
            content = _stub_generation_content(payload)
        elif operation == Operation.weakness:
            content = {"weak_pills": []}
        elif operation == Operation.learning_material:
            content = {
                "explainer": (
                    "Stubbed explainer: a real Anthropic provider key is "
                    "required to generate targeted learning material."
                )
            }
        else:
            content = {"operation": operation.value, "stubbed": True}
        return _stub_result(content)

    async def grade(self, operation: Operation, payload: dict[str, Any]) -> AIResult:
        # Deterministic "didn't grade" — score 0, verdict none. The
        # explicit "stubbed" string in ``reasoning`` is the signal that
        # no real grader ran; downstream code that wants to skip
        # stub-grade rows can match on ``ai_provider == 'stub'``.
        return _stub_result(
            {
                "score": 0.0,
                "verdict": "none",
                "reasoning": (
                    "Stubbed grade: a real Anthropic provider key is "
                    "required to grade short_answer / scenario responses."
                ),
            }
        )

    async def review(self, operation: Operation, payload: dict[str, Any]) -> AIResult:
        if operation == Operation.content_self_review:
            return _stub_result(_stub_content_self_review_content(payload))
        return _stub_result({"verdict": "confirmed", "reasoning": "stub"})

    async def embed(self, operation: Operation, text: str) -> EmbedResult:
        return EmbedResult(
            embedding=[0.0] * 1536,
            provider="stub",
            model="stub-embed-1",
            prompt_tokens=0,
            cost_usd=0.0,
        )


# --- Module-level provider singletons -------------------------------
# Tests monkeypatch these names directly (not via factory) so a single
# ``RecordingProvider`` instance persists across multiple AI calls in one
# test — the budget-alert tests in Slice 3 depend on this.

_STUB: AIProvider = StubAIProvider()
_ANTHROPIC: AIProvider | None = None
_OPENAI: AIProvider | None = None


def _anthropic_provider() -> AIProvider:
    """Lazy module-level Anthropic singleton (built on first call so an
    unconfigured ``ANTHROPIC_API_KEY`` does not crash app import)."""
    global _ANTHROPIC
    if _ANTHROPIC is None:
        from app.ai.anthropic import AnthropicProvider

        _ANTHROPIC = AnthropicProvider()
    return _ANTHROPIC


def _openai_provider() -> AIProvider:
    """Lazy module-level OpenAI singleton; same shape as
    :func:`_anthropic_provider`. Body is a skeleton until P6 / P9."""
    global _OPENAI
    if _OPENAI is None:
        from app.ai.openai import OpenAIProvider

        _OPENAI = OpenAIProvider()
    return _OPENAI


def _resolve_provider_name(
    operation: Operation,
    *,
    system_settings: Any | None,
    test_override: str | None,
) -> str:
    """Pure provider-name resolution per AC-D12 v1.6:

    1. ``test_override`` (caller-passed; per-Test row override).
    2. ``system_settings.provider_by_operation[op.value]`` —
       a non-empty string wins.
    3. ``system_settings.review_provider`` — convenience default for
       ``grade_review`` and ``anchor_self_review`` only.
    4. Coded default: ``anthropic`` for the 5 Anthropic ops,
       ``openai`` for review + embed.

    JSONB ``provider_by_operation`` entries that are an empty string OR
    JSON null fall through to the next layer — both are valid "unset"
    JSONB shapes and must behave identically.
    """
    if test_override:
        return test_override
    if system_settings is not None:
        per_op = getattr(system_settings, "provider_by_operation", None) or {}
        configured = per_op.get(operation.value)
        if configured:
            return configured
        if operation in _REVIEW_DEFAULT_OPS:
            review_default = getattr(system_settings, "review_provider", None)
            if review_default:
                return review_default
    if operation in _ANTHROPIC_DEFAULT_OPS:
        return "anthropic"
    return "openai"


def resolve_provider(
    operation: Operation | str,
    *,
    system_settings: Any | None = None,
    test_override: str | None = None,
) -> AIProvider:
    """Return the concrete provider for ``operation`` per AC-D12 v1.6.

    Falls back to :class:`StubAIProvider` when the resolved provider's
    API key is unset — the dev/local fail-safe. Production deployments
    log a startup warning if any key is missing (``app.main`` lifecycle).
    Tests substitute ``RecordingProvider`` by monkeypatching ``_ANTHROPIC``
    / ``_OPENAI`` directly, bypassing the key check.
    """
    if isinstance(operation, str):
        operation = Operation(operation)

    name = _resolve_provider_name(
        operation,
        system_settings=system_settings,
        test_override=test_override,
    )

    from app.config import get_settings

    settings = get_settings()
    if name == "anthropic":
        if not settings.anthropic_api_key:
            return _STUB
        return _anthropic_provider()
    if name == "openai":
        if not settings.openai_api_key:
            return _STUB
        return _openai_provider()
    raise ValueError(
        f"Unknown provider {name!r} for operation {operation.value!r}. "
        "Valid providers are 'anthropic' and 'openai' (AC-D12)."
    )


def resolve_model(
    operation: Operation,
    *,
    system_settings: Any | None = None,
    test_override: str | None = None,
) -> str:
    """Per-operation model-ID resolution mirroring :func:`resolve_provider`:
    Test override → ``system_settings.model_by_operation[op.value]`` →
    coded default from ``app.config``.

    Coded defaults come from the env-overridable model IDs (AC-CD18); the
    config field name matches the op:
    ``anthropic_model_<op>`` for the 5 Anthropic ops, ``openai_model_review``
    for grade_review / anchor_self_review, ``openai_embedding_model`` for
    embed.
    """
    if test_override:
        return test_override
    if system_settings is not None:
        per_op = getattr(system_settings, "model_by_operation", None) or {}
        configured = per_op.get(operation.value)
        if configured:
            return configured

    from app.config import get_settings

    settings = get_settings()
    coded_default_attr = {
        Operation.generation: "anthropic_model_generation",
        Operation.grading: "anthropic_model_grading",
        Operation.weakness: "anthropic_model_weakness",
        Operation.learning_material: "anthropic_model_material",
        Operation.pill_proposal: "anthropic_model_pill_proposal",
        Operation.pill_generation: "anthropic_model_pill_generation",
        Operation.grade_review: "openai_model_review",
        Operation.anchor_self_review: "openai_model_review",
        Operation.content_self_review: "openai_model_review",
        Operation.embed: "openai_embedding_model",
    }[operation]
    return getattr(settings, coded_default_attr)
