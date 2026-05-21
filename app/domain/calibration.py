"""Anchor calibration — Bayesian-shrinkage effective_difficulty + delta.

AC-D20 / AC-D27 / AC-CD12; CODE_SPEC §12. Near-full unit/branch coverage
required by AC-CD15 because this file is one of the three statistical-
core hot spots (CODE_SPEC §17) — a subtle error here is silently wrong
in production and not cheaply caught.

Slice 1 ships the **pure-function math** AC-D27 + CODE_SPEC §12 specify.
The DB-writing wrappers (anchor pool generation, calibration sweep,
admin queue) land in Slices 2 and 4; the per-attempt anchor draw +
fresh-question delta lift lands in Slice 3.

The canonical formulas, quoted verbatim from CODE_SPEC §12 / AC-D27 so a
future reader can verify against the spec without re-reading the anchor
(defensive citation pattern from PR-018 / PR-019)::

    observed_difficulty_i = assigned_difficulty
                          + competence_sensitivity * (0.5 - score_i)

    effective_difficulty  = (assigned_difficulty * k + sum(observed_i))
                          / (k + n)              # clamped 1.0-10.0

    k = system_settings.anchor_calibration_prior_weight   (default 20)
    competence_sensitivity                                (default 2.0)

Stable from ``n = 0`` by construction: with no observed scores the
estimator returns ``assigned_difficulty`` (the prior) clamped to the
1.0-10.0 axis. There is **no minimum-response gate on the math** —
the ``anchor_calibration_confidence_threshold`` setting (default 20)
gates only the preliminary -> confident *display label* (see
:func:`is_confident`), not the recompute.

For fresh (non-anchor) questions in an attempt that drew anchors, the
per-anchor signal triangulates back to fresh items via::

    fresh_effective_difficulty = assigned_difficulty + testee_anchor_delta
    testee_anchor_delta        = mean(anchor_effective_difficulty_j
                                 - assigned_difficulty_j)

across the anchors *j* drawn into the attempt. With zero anchors drawn
``testee_anchor_delta = 0.0`` (no shift), so the formula degrades
gracefully to the assigned difficulty.
"""

from __future__ import annotations

import json
import logging
import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.cost import maybe_fire_budget_alert, record_provenance
from app.ai.provider import Operation, resolve_provider
from app.models import (
    SEED_TENANT_ID,
    AnchorQuestion,
    Pill,
    Question,
    QuestionType,
    SystemSettings,
)
from app.permissions import APIError

_log = logging.getLogger(__name__)

# Difficulty axis bounds per SPEC §5 (the 1-10 scale used end to end).
# Clamping happens once at the boundary of the recompute so a wild
# observed_difficulty (which the spec formula can produce on a 0.0 or
# 1.0 score with sensitivity 2.0) does not propagate downstream into
# the loop_target_difficulty rounding.
_DIFFICULTY_MIN = 1.0
_DIFFICULTY_MAX = 10.0


def _clamp_difficulty(value: float) -> float:
    """Clamp ``value`` to the 1.0-10.0 difficulty axis. Per AC-D27:
    "result clamped 1.0-10.0"."""
    if value < _DIFFICULTY_MIN:
        return _DIFFICULTY_MIN
    if value > _DIFFICULTY_MAX:
        return _DIFFICULTY_MAX
    return value


def compute_effective_difficulty(
    assigned_difficulty: float,
    observed_scores: Sequence[float],
    *,
    prior_weight: int,
    sensitivity: float,
) -> float:
    """Bayesian-shrinkage estimator of an anchor's effective difficulty
    (AC-D27 / CODE_SPEC §12).

    ``assigned_difficulty`` is the AI-stamped difficulty the anchor was
    generated at — the prior. ``observed_scores`` is the sequence of
    per-response ``response_score`` values recorded against this anchor
    across every attempt that drew it (sourced from
    ``AttemptAnchor.score``). ``prior_weight`` (``k``) is the strength
    of the prior — default 20, lifted from
    ``system_settings.anchor_calibration_prior_weight``. ``sensitivity``
    is the AC-D9 competence-sensitivity constant (default 2.0) that
    converts a score offset from 0.5 into a difficulty offset.

    Each observation is first mapped to its implied difficulty per the
    AC-D27 / AC-D9 formula::

        observed_difficulty_i = assigned_difficulty
                              + sensitivity * (0.5 - score_i)

    The shrinkage estimator then averages the prior (with weight ``k``)
    against the sum of observed difficulties::

        effective = (assigned * k + sum(observed_i)) / (k + n)

    Result is clamped to the 1.0-10.0 axis.

    At ``n = 0`` the formula reduces to ``assigned * k / k = assigned`` —
    the prior is preserved exactly. As ``n -> infinity`` the prior's
    weight diminishes and the estimate converges on the mean of
    observed difficulties. ``prior_weight`` must be positive (a
    non-positive prior degenerates the shrinkage); we raise rather than
    silently divide by a meaningless denominator at ``n = 0``.
    """
    if prior_weight <= 0:
        raise ValueError(
            f"prior_weight must be positive, got {prior_weight!r}; "
            "fix system_settings.anchor_calibration_prior_weight"
        )
    n = len(observed_scores)
    if n == 0:
        return _clamp_difficulty(assigned_difficulty)
    observed_sum = 0.0
    for score in observed_scores:
        observed_sum += assigned_difficulty + sensitivity * (0.5 - score)
    estimate = (assigned_difficulty * prior_weight + observed_sum) / (prior_weight + n)
    return _clamp_difficulty(estimate)


def compute_fresh_question_delta(
    anchor_records: Sequence[tuple[float, float]],
) -> float:
    """Mean per-anchor ``(effective_difficulty - assigned_difficulty)``
    across the anchors drawn into one attempt (AC-D27 / CODE_SPEC §12).

    ``anchor_records`` is a sequence of ``(effective_difficulty,
    assigned_difficulty)`` tuples — one per anchor drawn into the
    attempt. The mean delta is added to each fresh (non-anchor) question's
    ``assigned_difficulty`` to produce its effective difficulty for the
    competence formula::

        fresh_effective_difficulty = assigned_difficulty + delta

    Empty input returns ``0.0`` — an attempt that drew no anchors has
    no triangulation signal and falls through to the bare assigned
    difficulty. Spec wording: "0 when no anchors were drawn"
    (CODE_SPEC §12).

    The function is pure — no clamp here because the downstream caller
    clamps the summed ``assigned + delta`` value against the 1.0-10.0
    axis.
    """
    if not anchor_records:
        return 0.0
    delta_sum = 0.0
    for effective, assigned in anchor_records:
        delta_sum += effective - assigned
    return delta_sum / len(anchor_records)


def is_confident(n: int, *, confidence_threshold: int) -> bool:
    """preliminary -> confident gate per AC-D27 #3 / AC-D20.

    Returns ``True`` when the aggregate observation count ``n`` on a
    pill+band's anchor pool meets ``confidence_threshold`` (default 20,
    sourced from ``system_settings.anchor_calibration_confidence_threshold``).
    The threshold gates only the *display label* the band stamp carries
    in the admin competency view — the shrinkage math itself is stable
    from ``n = 0`` and runs every cron pass regardless.

    Boundary is inclusive: ``n == threshold`` returns ``True``. AC-D27 #3
    wording: "Until ``n >= anchor_calibration_confidence_threshold``
    (default 20) for a pill+band, the band stamp displays with the
    'preliminary' qualifier" — i.e. confidence is reached at ``>=``,
    not ``>``.
    """
    return n >= confidence_threshold


# --- Slice 2 — Anchor pool bootstrap (AC-D23) -------------------------
#
# Cost-amplification note for operators reading this for budget planning
# (AC-D18 v1.1):
#
#   - default ``anchor_pool_size_per_band = 20``;
#   - a representative ``len(supported_bands) = 3`` (most pills span a
#     3-band slice of the 1-10 axis at v1).
#
# Per pill that means ``20 * 3 = 60`` anchor slots. Each slot costs:
#
#   - **2 AI calls minimum** (1 generation + 1 self-review when the
#     first generation passes review);
#   - **6 AI calls maximum** (3 generations + 3 reviews when every
#     review flags before the third attempt — the AC-D23 hard ceiling).
#
# So per-pill totals are **120 calls best case, 360 worst case**.
# Bootstrap stays within the AC-D18 ~$50-60 pilot envelope per AC-D23
# (and is the reason AC-D23 batches the call into an explicit admin
# action rather than running it on every pill edit).
#
# **Re-bootstrap semantics** are intentionally 409-on-existing rather
# than the AC-D23 "idempotent" wording. Operator must drain the flagged
# queue (Slice 4's resolve actions) before re-running. Full idempotent
# top-up semantics (skip slots that already have live anchors, fill
# only the missing ones) belong at the P11 bootstrap script — the
# orchestrator AC-D23 names. The narrow 409 here prevents an accidental
# double-bill from a fat-fingered re-run, which is the realistic
# failure mode at the admin-endpoint surface.

# Coded defaults — used when ``system_settings.anchor_pool_size_per_band``
# / ``anchor_calibration_prior_weight`` are unset (the zero-DB harness
# doesn't apply server defaults; same defensive pattern competence.py
# uses for sensitivity / halflife per the PR-#15 Gitar precedent).
_DEFAULT_POOL_SIZE_PER_BAND = 20

# Per AC-D23: up to 3 generations per slot before the slot is excluded.
_MAX_REGENERATION_ATTEMPTS = 3

# Reserve characters for the `'self_review_3_fails: '` prefix on
# ``AnchorQuestion.excluded_reason`` (String(1024) column). Truncating
# only the reviewer-supplied tail leaves the actionable cause prefix
# intact for an admin scanning the flag queue.
_EXCLUDED_REASON_PREFIX = "self_review_3_fails: "
_EXCLUDED_REASON_MAX = 1024


async def _existing_anchors(
    db: AsyncSession, pill_id: uuid.UUID
) -> AnchorQuestion | None:
    """First :class:`AnchorQuestion` row for ``pill_id`` if any exist —
    the re-bootstrap guard. Equality-only walk per AC-CD15."""
    result = await db.execute(
        select(AnchorQuestion).where(AnchorQuestion.pill_id == pill_id)
    )
    return result.scalar_one_or_none()


async def _load_pill(db: AsyncSession, pill_id: uuid.UUID) -> Pill | None:
    """Tenant-scoped pill lookup mirroring
    :func:`app.domain.catalogue._by_id`. Inlined here rather than imported
    to keep ``calibration`` independent of catalogue's audit / pagination
    surface."""
    result = await db.execute(
        select(Pill).where(Pill.id == pill_id, Pill.tenant_id == SEED_TENANT_ID)
    )
    return result.scalar_one_or_none()


async def _load_settings(db: AsyncSession) -> SystemSettings | None:
    result = await db.execute(
        select(SystemSettings).where(SystemSettings.tenant_id == SEED_TENANT_ID)
    )
    return result.scalar_one_or_none()


def _expand_supported_bands(pill: Pill) -> list[int]:
    """``pill.available_difficulty_min .. max`` inclusive, integer steps
    (AC-D7 difficulty axis). The Pill model carries no explicit
    ``supported_bands`` column; the supported set is the range expansion.
    """
    return list(range(pill.available_difficulty_min, pill.available_difficulty_max + 1))


def _truncate_reason(reasoning: str) -> str:
    """Build ``'self_review_3_fails: <reasoning>'`` with the reviewer's
    tail truncated to fit ``AnchorQuestion.excluded_reason`` (1024
    chars). Empty / missing reasoning still gets the prefix so the
    audit trail records the cause."""
    tail = (reasoning or "").strip()
    remaining = _EXCLUDED_REASON_MAX - len(_EXCLUDED_REASON_PREFIX)
    if remaining <= 0:
        return _EXCLUDED_REASON_PREFIX[:_EXCLUDED_REASON_MAX]
    return _EXCLUDED_REASON_PREFIX + tail[:remaining]


def _extract_spec(gen_result: Any) -> dict[str, Any] | None:
    """Pull the first question spec out of an AI generation result.

    Mirrors the defensive parse in :func:`attempts.start_attempt` — a
    malformed result returns ``None`` instead of raising so the
    bootstrap loop can treat it as a failed attempt and retry."""
    content = getattr(gen_result, "content", None) or {}
    questions = content.get("questions") if isinstance(content, dict) else None
    if not questions:
        return None
    first = questions[0]
    if not isinstance(first, dict):
        return None
    try:
        QuestionType(first["type"])
        int(first["assigned_difficulty"])
    except (KeyError, ValueError, TypeError):
        return None
    if not isinstance(first.get("config"), dict):
        return None
    return first


def _extract_verdict(review_result: Any, anchor_id: uuid.UUID) -> tuple[str | None, str]:
    """``(verdict, reasoning)`` for the anchor in the review result —
    ``(None, "")`` if the review response is malformed.

    Matches by ``anchor_question_id`` per the AC-D23 prompt contract;
    the single-anchor batch shape lets the caller treat a one-item
    response with no ID as flagged (a model that ignores the contract
    fails review by definition)."""
    content = getattr(review_result, "content", None) or {}
    items = content.get("items") if isinstance(content, dict) else None
    if not items or not isinstance(items, list):
        return None, ""
    target = str(anchor_id)
    for item in items:
        if not isinstance(item, dict):
            continue
        if item.get("anchor_question_id") == target:
            verdict = item.get("verdict")
            if verdict not in ("ok", "flagged"):
                return None, ""
            return verdict, str(item.get("reasoning") or "")
    return None, ""


def _build_review_payload(
    *, anchor_id: uuid.UUID, pill: Pill, band: int, spec: dict[str, Any]
) -> dict[str, Any]:
    """Render the ``items_json`` payload the
    :mod:`app.ai.prompts.anchor_self_review` template expects."""
    return {
        "items_json": json.dumps(
            [
                {
                    "anchor_question_id": str(anchor_id),
                    "pill_name": pill.name,
                    "band": band,
                    "assumed_difficulty": int(spec["assigned_difficulty"]),
                    "type": spec["type"],
                    "config": spec["config"],
                }
            ]
        )
    }


def _stamp_anchor_pair(
    *,
    anchor_id: uuid.UUID,
    pill: Pill,
    band: int,
    spec: dict[str, Any],
    gen_result: Any,
    review_result: Any | None,
    excluded: bool,
    excluded_reason: str | None,
    regeneration_attempts: int,
) -> tuple[Question, AnchorQuestion]:
    """Build the matched (``Question``, ``AnchorQuestion``) pair for
    one anchor slot — both rows share their primary-key UUID per the
    shared-PK convention (see :func:`app.domain.competence._effective_difficulty`
    which looks up ``AnchorQuestion.id == question.id``).

    Provenance routing keeps the cost dashboard's per-call sum-to-total
    invariant intact (AC-D18 v1.1): the **generation** call's
    provenance lands on the :class:`Question` row, the **review**
    call's provenance lands on the :class:`AnchorQuestion` row. Two AI
    calls, two provenance records, no double-counting.
    """
    qtype = QuestionType(spec["type"])
    qconfig = spec["config"]
    qdiff = int(spec["assigned_difficulty"])

    question = Question(
        id=anchor_id,
        tenant_id=pill.tenant_id,
        pill_id=pill.id,
        type=qtype,
        config=qconfig,
        assigned_difficulty=qdiff,
        realism_flag_count=0,
    )
    record_provenance(question, gen_result)

    anchor = AnchorQuestion(
        id=anchor_id,
        tenant_id=pill.tenant_id,
        pill_id=pill.id,
        band=band,
        type=qtype,
        config=qconfig,
        assigned_difficulty=qdiff,
        total_attempts=0,
        regeneration_attempts=regeneration_attempts,
        excluded=excluded,
        excluded_reason=excluded_reason,
        needs_admin_attention=excluded,
    )
    if review_result is not None:
        record_provenance(anchor, review_result)
    return question, anchor


async def generate_anchor_pool_for_pill(
    db: AsyncSession,
    pill_id: uuid.UUID,
    *,
    supported_bands: Sequence[int] | None = None,
) -> dict[str, Any]:
    """Bootstrap a pill's anchor pool (AC-D23 #1).

    For each band in ``supported_bands`` (default: ``pill.available_difficulty_min
    .. max`` inclusive), generates ``system_settings.anchor_pool_size_per_band``
    anchors. Each anchor passes through up to 3 generate → self-review
    cycles (AC-D23 ceiling). Anchors that pass review go live
    (``excluded=False``); anchors that fail review three times are
    written ``excluded=True``, ``needs_admin_attention=True`` with
    ``excluded_reason='self_review_3_fails: <reviewer reasoning>'`` so
    the admin can resolve via the Slice 4 queue.

    Re-bootstrap is rejected with ``APIError(409, "anchors_exist")`` if
    any rows already exist for the pill (see the cost-amplification
    note above for the P8↔P11 split rationale).

    Returns telemetry:
        {
          "anchors_generated":      <int>,
          "anchors_excluded":       <int>,
          "total_generation_calls": <int>,
          "total_self_review_calls":<int>,
          "per_band_summary": [
              {"band": <int>, "generated": <int>, "excluded": <int>},
              ...
          ]
        }
    """
    pill = await _load_pill(db, pill_id)
    if pill is None:
        raise APIError(404, "pill_not_found", "pill not found")
    if await _existing_anchors(db, pill_id) is not None:
        raise APIError(
            409,
            "anchors_exist",
            "Anchor pool already exists for this pill. Drain the "
            "flagged queue via /v1/admin/anchors/{id}/resolve before "
            "re-bootstrapping (P11 ships idempotent top-up).",
        )

    settings = await _load_settings(db)
    bands = list(supported_bands) if supported_bands else _expand_supported_bands(pill)
    pool_size = _DEFAULT_POOL_SIZE_PER_BAND
    if settings is not None:
        configured = getattr(settings, "anchor_pool_size_per_band", None)
        if configured is not None:
            pool_size = int(configured)

    provider = resolve_provider(Operation.generation, system_settings=settings)
    reviewer = resolve_provider(Operation.anchor_self_review, system_settings=settings)

    anchors_generated = 0
    anchors_excluded = 0
    total_generation_calls = 0
    total_self_review_calls = 0
    per_band: list[dict[str, int]] = []

    for band in bands:
        band_generated = 0
        band_excluded = 0
        for _slot in range(pool_size):
            anchor_id = uuid.uuid4()
            last_gen_result: Any | None = None
            last_spec: dict[str, Any] | None = None
            last_review_result: Any | None = None
            last_reasoning = ""
            verdict: str | None = None

            for attempt_num in range(1, _MAX_REGENERATION_ATTEMPTS + 1):
                gen_payload = {
                    "test_name": pill.name,
                    "target_difficulty": band,
                    "question_count": 1,
                    "attempt_id": str(anchor_id),
                }
                last_gen_result = await provider.generate(
                    Operation.generation, gen_payload
                )
                total_generation_calls += 1

                spec = _extract_spec(last_gen_result)
                if spec is None:
                    verdict = None
                    continue
                last_spec = spec

                review_payload = _build_review_payload(
                    anchor_id=anchor_id, pill=pill, band=band, spec=spec
                )
                last_review_result = await reviewer.review(
                    Operation.anchor_self_review, review_payload
                )
                total_self_review_calls += 1

                verdict, reasoning = _extract_verdict(last_review_result, anchor_id)
                if reasoning:
                    last_reasoning = reasoning

                if verdict == "ok":
                    question, anchor = _stamp_anchor_pair(
                        anchor_id=anchor_id,
                        pill=pill,
                        band=band,
                        spec=spec,
                        gen_result=last_gen_result,
                        review_result=last_review_result,
                        excluded=False,
                        excluded_reason=None,
                        regeneration_attempts=attempt_num - 1,
                    )
                    db.add(question)
                    db.add(anchor)
                    anchors_generated += 1
                    band_generated += 1
                    break
                # verdict in {"flagged", None} → retry up to the ceiling
            else:
                # All 3 generate→review cycles failed. Persist an
                # excluded row so the admin queue surfaces the slot.
                if last_spec is None:
                    # No usable spec at all (every generation was
                    # malformed). Skip the slot entirely — there's
                    # nothing meaningful to render in the admin
                    # queue and no rubric for substitute_wording to
                    # operate on. The bootstrap counters still
                    # reflect the wasted AI calls.
                    _log.warning(
                        "Anchor slot exhausted with no valid spec",
                        extra={
                            "pill_id": str(pill_id),
                            "band": band,
                            "slot_uuid": str(anchor_id),
                        },
                    )
                    continue
                question, anchor = _stamp_anchor_pair(
                    anchor_id=anchor_id,
                    pill=pill,
                    band=band,
                    spec=last_spec,
                    gen_result=last_gen_result,
                    review_result=last_review_result,
                    excluded=True,
                    excluded_reason=_truncate_reason(last_reasoning),
                    regeneration_attempts=_MAX_REGENERATION_ATTEMPTS,
                )
                db.add(question)
                db.add(anchor)
                anchors_excluded += 1
                band_excluded += 1

        per_band.append(
            {
                "band": band,
                "generated": band_generated,
                "excluded": band_excluded,
            }
        )

    await db.flush()
    await maybe_fire_budget_alert(db, tenant_id=pill.tenant_id)

    return {
        "anchors_generated": anchors_generated,
        "anchors_excluded": anchors_excluded,
        "total_generation_calls": total_generation_calls,
        "total_self_review_calls": total_self_review_calls,
        "per_band_summary": per_band,
    }
