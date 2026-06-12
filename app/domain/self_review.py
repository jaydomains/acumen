"""Generated-content self-review protocol (AC-D30 / §6.9, C1) — the safety floor.

Every autonomously-generated pill draft (AC-D29 / §6.8) passes a **multi-pass,
cross-model self-review** before the AC-D31 auto-publish gate (C2) acts on it —
the non-negotiable safety floor (ruling 4) that replaces the removed human
pre-publish gate. ``self_review_draft`` runs the three ``content_self_review``
passes — **grounding/factual**, **safety**, **provenance** — each on a
**different provider from the generator** (Anthropic generates → OpenAI
reviews, the AC-D19 / AC-D23 cross-family pattern), and returns the three
verdicts + the **re-adjudicated `safety_relevant`** (AC-D21's autonomous
replacement for the removed admin catch on a false-negative mis-tag).

Scope (C1): the **protocol** only — the passes + their verdicts. NOT here: the
confidence score / auto-publish threshold / publish-with-warning (C2 consumes
these verdicts); `Pill` creation / publish (C2); the dashboard / rollback (E);
the gap-detection trigger (D). NS-7 (ruled **degrade-not-gate**): C1 exposes the
degradation switch (default ``degrade``) that the C2 gate reads.
"""

from __future__ import annotations

import enum
import json
from dataclasses import dataclass, replace
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.provider import Operation, resolve_provider

# The three cross-model passes of the one ``content_self_review`` op (NS-2 ruled
# one-op-three-variants); each is a named prompt variant in the registry.
_PASSES: tuple[str, ...] = ("grounding", "safety", "provenance")


class DegradeMode(str, enum.Enum):
    """NS-7 (ruled **degrade-not-gate**): how the C2 gate treats single-provider
    safety-relevant content. ``degrade`` (the ruled default) = publish-with-
    warning, always dashboard-flagged, + a "single-provider verified" flag, with
    **no** second-provider prerequisite gate (honours ruling 2's "nothing
    held")."""

    degrade = "degrade"
    gate = "gate"


# The C1 default the C2 gate reads — the ruled NS-7 behaviour.
SELF_REVIEW_DEGRADE_DEFAULT = DegradeMode.degrade


@dataclass(frozen=True)
class PassVerdict:
    """One self-review pass's outcome + the provenance of the review call (so
    the C2 gate can aggregate the cross-model review spend, AC-CD8)."""

    pass_name: str
    verdict: str  # "pass" | "fail"
    detail: dict[str, Any]
    provider: str
    model: str
    cost_usd: float


@dataclass(frozen=True)
class SelfReviewResult:
    """The protocol output the AC-D31 gate (C2) consumes into the confidence
    score + publish decision."""

    grounding: PassVerdict
    safety: PassVerdict
    provenance: PassVerdict
    safety_relevant: bool  # re-adjudicated by the safety pass (AC-D21 catch)
    unsupported_claims: list[str]
    orphan_claims: list[str]
    single_provider_verified: bool  # NS-7: review ran same-provider as generator
    degrade_mode: DegradeMode  # the switch the C2 gate reads (default degrade)

    @property
    def passed(self) -> bool:
        """All three passes verdict ``pass`` — the gate's hard-floor input."""
        return all(
            v.verdict == "pass" for v in (self.grounding, self.safety, self.provenance)
        )

    @property
    def total_cost_usd(self) -> float:
        """Cross-model review spend across the three passes (C2 persists it)."""
        return self.grounding.cost_usd + self.safety.cost_usd + self.provenance.cost_usd


async def self_review_draft(
    db: AsyncSession,
    *,
    draft: dict[str, Any],
    provenance: Any,
    degrade_mode: DegradeMode = SELF_REVIEW_DEGRADE_DEFAULT,
) -> SelfReviewResult:
    """Run the three cross-model ``content_self_review`` passes on a generated
    ``draft`` against its AC-D29 ``provenance`` chain and return the verdicts +
    the re-adjudicated ``safety_relevant``. The caller (C2) consumes the result;
    ``db`` is accepted for call-convention symmetry (the passes are AI calls,
    not DB reads).

    Cross-model floor (ruling 4): the passes route to a **different provider
    from the generator** (``content_self_review`` ∈ ``_REVIEW_DEFAULT_OPS`` →
    the OpenAI review provider; the generator is Anthropic ``pill_generation``).
    When only one provider is configured both resolve to the same name —
    ``single_provider_verified`` is set and the **NS-7 degrade** rule applies.
    """
    provider = resolve_provider(Operation.content_self_review)
    draft_json = json.dumps(draft, sort_keys=True, default=str)
    provenance_json = json.dumps(provenance, sort_keys=True, default=str)

    verdicts: dict[str, PassVerdict] = {}
    for pass_name in _PASSES:
        result = await provider.review(
            Operation.content_self_review,
            {
                "_prompt_variant": pass_name,
                "draft_json": draft_json,
                "provenance_json": provenance_json,
                "draft": draft,
            },
        )
        verdicts[pass_name] = PassVerdict(
            pass_name=pass_name,
            verdict=str(result.content.get("verdict", "fail")),
            detail=dict(result.content),
            provider=result.provider,
            model=result.model,
            cost_usd=result.cost_usd,
        )

    safety_detail = verdicts["safety"].detail
    self_tag = bool(draft.get("safety_relevant", False))
    readjudicated_safety = bool(safety_detail.get("safety_relevant", self_tag))
    # Fall safe: if the safety pass flagged a problem but returned no
    # re-adjudicated tag, treat the draft as safety-relevant rather than
    # reverting to the generator's (possibly false-negative) self-tag — the
    # exact mis-tag AC-D21's autonomous catch exists to close.
    if verdicts["safety"].verdict == "fail" and "safety_relevant" not in safety_detail:
        readjudicated_safety = True
    unsupported = [
        str(c) for c in verdicts["grounding"].detail.get("unsupported_claims", [])
    ]
    orphans = [str(c) for c in verdicts["provenance"].detail.get("orphan_claims", [])]

    # Fail-CLOSED verdict reconciliation (the safety floor, ruling 4): each
    # pass's effective verdict is derived from the structured signal the
    # ratified contract promises, NOT the model's free-form ``verdict`` string —
    # a model that self-contradicts (``verdict="pass"`` alongside failing data)
    # must not reach C2's hard floor as a pass. We only ever force ``fail`` (a
    # genuine model ``fail`` is preserved); a clean pass is left untouched.
    if unsupported:
        verdicts["grounding"] = replace(verdicts["grounding"], verdict="fail")
    if orphans:
        verdicts["provenance"] = replace(verdicts["provenance"], verdict="fail")
    if readjudicated_safety and not self_tag:
        verdicts["safety"] = replace(verdicts["safety"], verdict="fail")

    # NS-7 cross-model floor: the review ran on a different provider from the
    # generator unless only one is configured (both resolve to the same name).
    generator_provider = resolve_provider(Operation.pill_generation)
    single_provider = (
        getattr(generator_provider, "name", "") == verdicts["safety"].provider
    )

    return SelfReviewResult(
        grounding=verdicts["grounding"],
        safety=verdicts["safety"],
        provenance=verdicts["provenance"],
        safety_relevant=readjudicated_safety,
        unsupported_claims=unsupported,
        orphan_claims=orphans,
        single_provider_verified=single_provider,
        degrade_mode=degrade_mode,
    )
