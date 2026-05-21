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
import random
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
    Assignment,
    Attempt,
    AttemptAnchor,
    Pill,
    Question,
    QuestionType,
    SystemSettings,
    Test,
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
    the re-bootstrap guard. Equality-only walk per AC-CD15.

    ``.limit(1)`` is load-bearing: a successful bootstrap leaves
    20+ rows per pill, and a bare
    ``select(...).where(pill_id == ...).scalar_one_or_none()``
    would raise :class:`MultipleResultsFound` on the second
    bootstrap call instead of cleanly surfacing the 409 the guard
    is meant to return (Gitar PR-#20 Slice 2 finding #1). The
    integration harness's :class:`CatalogueFakeSession`
    ``scalar_one_or_none`` silently returns the first match, so the
    bug only surfaces under real SQLAlchemy strict-mode; keep the
    ``.limit(1)`` defensively even if a future test pattern would
    otherwise pass without it.

    Tenant-scoped to match the rest of the file's query pattern
    (Gitar PR-#20 Slice 3 finding #1 — consistency guard for any
    future multi-tenant flip).
    """
    result = await db.execute(
        select(AnchorQuestion)
        .where(
            AnchorQuestion.pill_id == pill_id,
            AnchorQuestion.tenant_id == SEED_TENANT_ID,
        )
        .limit(1)
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

    **Operational note — production HTTP timeout risk.** At default
    ``anchor_pool_size_per_band = 20`` × the worst-case 6 calls/slot,
    a 3-band pill emits up to 360 sequential ``await`` AI calls. At
    typical 2–5 s LLM latencies that's 12–30 minutes — beyond default
    reverse-proxy + ASGI timeouts (Gitar PR-#20 Slice 2 finding #2).
    The synchronous admin endpoint is for dev/test and small pools;
    **production at the default pool size MUST run this through the
    P11 Celery task wrapper** (the same wrapper that hosts the
    AC-D23 cross-pill bootstrap orchestrator). Until P11 lands, an
    operator running a real-data bootstrap should either temporarily
    drop ``anchor_pool_size_per_band`` (e.g. to 5) on the
    ``system_settings`` row or narrow ``pill.available_difficulty_min/max``
    before triggering, then restore after the call returns. Either
    workaround is reversible; neither requires code changes.

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


# --- Slice 3 — Per-attempt anchor draw (AC-D20 / AC-D27) --------------
#
# At ``start_attempt`` for a per_testee + assignment-backed attempt with
# a pill assignment, the loop draws up to 2 anchors from the pill's
# live pool (band = ``round(test.target_difficulty or 5)``) and writes
# an :class:`AttemptAnchor` row per drawn anchor. The drawn
# anchors' :class:`Question` rows (sharing the same UUID as the
# ``AnchorQuestion`` rows per the shared-PK convention) are added to
# the attempt's ``question_snapshot`` so the Testee sees them inline
# with the per_testee questions.
#
# Determinism contract: the draw is keyed by
# ``random.Random(attempt.shuffle_seed)`` — same attempt always draws
# the same anchors on resume. The seed is already deterministic per
# AC-D5 ``seed_for(attempt.id)``. The pool list is **sorted by
# ``anchor.id``** before sampling so the DB's physical row order
# can't leak into the draw (without the sort a resume would re-sample
# from a possibly-different ordering even with the same seed).

_ANCHORS_PER_ATTEMPT = 2


async def _load_assignment(
    db: AsyncSession, assignment_id: uuid.UUID
) -> Assignment | None:
    result = await db.execute(
        select(Assignment).where(
            Assignment.id == assignment_id,
            Assignment.tenant_id == SEED_TENANT_ID,
        )
    )
    return result.scalar_one_or_none()


async def _load_anchor_questions_by_ids(
    db: AsyncSession, anchor_ids: Sequence[uuid.UUID]
) -> dict[uuid.UUID, Question]:
    """Load the :class:`Question` rows whose ``id`` matches one of
    ``anchor_ids``. Returned as ``{id: Question}`` so the caller can
    reorder per the draw order (the dict lookup preserves the random
    sample's order — Python 3.7+ insertion-order semantics aren't
    relevant here since the caller indexes by id).

    Equality-only walk per AC-CD15: one query per id, accumulated.
    The pool is small (<= 2 anchors per attempt at v1) so the N+1
    cost is operationally insignificant; if a future v needs larger
    pools this becomes a single ``WHERE id IN (...)`` query.
    """
    found: dict[uuid.UUID, Question] = {}
    for aid in anchor_ids:
        result = await db.execute(
            select(Question).where(
                Question.id == aid, Question.tenant_id == SEED_TENANT_ID
            )
        )
        row = result.scalar_one_or_none()
        if row is not None:
            found[aid] = row
    return found


async def draw_anchors_for_attempt(
    db: AsyncSession,
    *,
    attempt: Attempt,
    test: Test,
    assignment_id: uuid.UUID | None,
) -> list[Question]:
    """Draw up to ``_ANCHORS_PER_ATTEMPT`` anchors for ``attempt`` and
    write the matching :class:`AttemptAnchor` rows. Returns the
    :class:`Question` rows for the drawn anchors so the caller can
    fold them into the attempt's ``question_snapshot``.

    Scope: per_testee mode, assignment-backed, single-pill assignment.
    Returns ``[]`` for learning-path assignments (``pill_id is None``)
    and for any attempt whose pool is empty (no anchors generated yet
    for that pill+band).

    Resume stability: ``random.Random(attempt.shuffle_seed).sample(...)``
    against a list **sorted by anchor.id**. Both inputs are
    deterministic across a resume so the same two anchors come back.
    """
    if assignment_id is None:
        return []
    assignment = await _load_assignment(db, assignment_id)
    if assignment is None or assignment.pill_id is None:
        return []

    target_band = int(round(test.target_difficulty or 5))

    # Tenant-scoped to match every other AnchorQuestion query in this
    # file (Gitar PR-#20 Slice 3 finding #1 — the consistency guard
    # protects against a future multi-tenant flip even though v1 ships
    # single-tenant under SEED_TENANT_ID).
    pool_result = await db.execute(
        select(AnchorQuestion).where(
            AnchorQuestion.pill_id == assignment.pill_id,
            AnchorQuestion.tenant_id == SEED_TENANT_ID,
        )
    )
    pool_all = list(pool_result.scalars().all())
    live = [a for a in pool_all if not a.excluded and a.band == target_band]
    if not live:
        return []

    sorted_pool = sorted(live, key=lambda a: a.id)
    rng = random.Random(attempt.shuffle_seed)
    drawn = rng.sample(sorted_pool, min(_ANCHORS_PER_ATTEMPT, len(sorted_pool)))

    drawn_ids = [a.id for a in drawn]
    questions_by_id = await _load_anchor_questions_by_ids(db, drawn_ids)

    rendered: list[Question] = []
    for anchor in drawn:
        question = questions_by_id.get(anchor.id)
        if question is None:
            # Shared-PK invariant violation — the AnchorQuestion exists
            # but no Question row matches its UUID. Logged so the
            # operator notices; the slot is silently dropped from the
            # draw rather than crashing the attempt.
            _log.warning(
                "Anchor %s has no shared-PK Question row; dropping from draw",
                anchor.id,
                extra={"anchor_id": str(anchor.id), "attempt_id": str(attempt.id)},
            )
            continue
        db.add(
            AttemptAnchor(
                tenant_id=SEED_TENANT_ID,
                attempt_id=attempt.id,
                anchor_question_id=anchor.id,
                score=None,
            )
        )
        rendered.append(question)
    return rendered


# --- Slice 4 — Calibration sweep (AC-D20 / AC-D27 / CODE_SPEC §12) ----
#
# Daily Bayesian-shrinkage recompute of every live anchor's
# ``effective_difficulty`` from the per-Testee scores
# (``AttemptAnchor.score``) accumulated since the last sweep. Admin-
# triggered now (mirrors the P6 grade-review reconcile + P4
# engagement sweep precedent); the P11 Celery beat task will invoke
# the same callable on a 24-hour schedule per AC-D20 / AC-D27.
#
# Per-anchor failure isolation: a single bad anchor (corrupt
# ``assigned_difficulty``, divide-by-zero in the math) cannot poison
# the sweep — the per-row try/except logs the exception and continues
# (same pattern PR-019 Slice 2 added to the submit-path hooks per
# the Gitar observability finding).

_DEFAULT_PRIOR_WEIGHT = 20
_DEFAULT_SENSITIVITY = 2.0
_DEFAULT_CONFIDENCE_THRESHOLD = 20


async def _all_live_anchors(db: AsyncSession) -> list[AnchorQuestion]:
    """Every non-excluded :class:`AnchorQuestion` for the tenant. The
    sweep walks live rows only — excluded rows have already failed
    self-review and are awaiting admin resolution; recomputing their
    effective_difficulty would be misleading once admin decides their
    fate.

    The ``excluded`` filter is applied in Python after the tenant-
    scoped fetch (the same equality-only-walk pattern used by the
    Slice 2 / Slice 3 pool queries — keeps every WHERE single-column
    equality per AC-CD15 so the zero-DB test harness can run the
    code unchanged)."""
    result = await db.execute(
        select(AnchorQuestion).where(AnchorQuestion.tenant_id == SEED_TENANT_ID)
    )
    return [row for row in result.scalars().all() if not row.excluded]


async def _scored_observations_for_anchor(
    db: AsyncSession, anchor_id: uuid.UUID
) -> list[float]:
    """Per-anchor ``AttemptAnchor.score`` values, filtering out NULLs.
    The score column is denormalised by ``submit_attempt`` from
    ``Response.response_score`` (Slice 3); a NULL means no Testee has
    answered this anchor yet, so the AC-D27 estimator should treat it
    as a missing observation rather than a zero."""
    result = await db.execute(
        select(AttemptAnchor).where(
            AttemptAnchor.tenant_id == SEED_TENANT_ID,
            AttemptAnchor.anchor_question_id == anchor_id,
        )
    )
    rows = list(result.scalars().all())
    return [row.score for row in rows if row.score is not None]


def _settings_with_defaults(settings: SystemSettings | None) -> tuple[int, float, int]:
    """Pull the three knobs the sweep needs from settings, falling back
    to the spec defaults when a knob is unset (the zero-DB harness
    doesn't apply server defaults; same defensive pattern competence.py
    uses for sensitivity / halflife per the PR-#15 Gitar precedent).

    Returns ``(prior_weight, sensitivity, confidence_threshold)``.
    """
    prior_weight = _DEFAULT_PRIOR_WEIGHT
    sensitivity = _DEFAULT_SENSITIVITY
    confidence_threshold = _DEFAULT_CONFIDENCE_THRESHOLD
    if settings is not None:
        cfg_prior = getattr(settings, "anchor_calibration_prior_weight", None)
        cfg_sens = getattr(settings, "competence_sensitivity", None)
        cfg_conf = getattr(settings, "anchor_calibration_confidence_threshold", None)
        if cfg_prior is not None:
            prior_weight = int(cfg_prior)
        if cfg_sens is not None:
            sensitivity = float(cfg_sens)
        if cfg_conf is not None:
            confidence_threshold = int(cfg_conf)
    return prior_weight, sensitivity, confidence_threshold


async def run_calibration_sweep(db: AsyncSession) -> dict[str, Any]:
    """Walk every live :class:`AnchorQuestion`, recompute
    ``effective_difficulty`` from accumulated
    :attr:`AttemptAnchor.score` observations, and update
    ``total_attempts`` + ``pass_rate``.

    Returns telemetry the admin endpoint surfaces verbatim::

        {
          "anchors_processed":              <int>,  # live anchors walked
          "anchors_updated":                <int>,  # at least 1 observation
          "anchors_skipped_no_observations":<int>,  # n=0
          "mean_n":                         <float>,  # mean observations
          "mean_effective_difficulty":      <float>,  # mean updated value
        }

    Failure-isolated per anchor — a single bad row logs and continues."""
    settings = await _load_settings(db)
    prior_weight, sensitivity, _confidence_threshold = _settings_with_defaults(settings)

    anchors_processed = 0
    anchors_updated = 0
    anchors_skipped = 0
    sum_n = 0
    sum_effective = 0.0

    for anchor in await _all_live_anchors(db):
        anchors_processed += 1
        try:
            scores = await _scored_observations_for_anchor(db, anchor.id)
            if not scores:
                anchors_skipped += 1
                continue
            new_effective = compute_effective_difficulty(
                float(anchor.assigned_difficulty),
                scores,
                prior_weight=prior_weight,
                sensitivity=sensitivity,
            )
            anchor.effective_difficulty = new_effective
            anchor.total_attempts = len(scores)
            anchor.pass_rate = sum(1 for s in scores if s >= 0.5) / len(scores)
            anchors_updated += 1
            sum_n += len(scores)
            sum_effective += new_effective
        except Exception:
            _log.exception(
                "Calibration sweep failed for anchor %s; continuing", anchor.id
            )

    mean_n = (sum_n / anchors_updated) if anchors_updated else 0.0
    mean_effective = (sum_effective / anchors_updated) if anchors_updated else 0.0
    return {
        "anchors_processed": anchors_processed,
        "anchors_updated": anchors_updated,
        "anchors_skipped_no_observations": anchors_skipped,
        "mean_n": mean_n,
        "mean_effective_difficulty": mean_effective,
    }


# --- Slice 4 — Anchor flag queue + per-row resolution (AC-D23) --------


async def _anchor_by_id(db: AsyncSession, anchor_id: uuid.UUID) -> AnchorQuestion | None:
    result = await db.execute(
        select(AnchorQuestion).where(
            AnchorQuestion.id == anchor_id,
            AnchorQuestion.tenant_id == SEED_TENANT_ID,
        )
    )
    return result.scalar_one_or_none()


async def _question_by_id(db: AsyncSession, question_id: uuid.UUID) -> Question | None:
    """Look up the shared-PK :class:`Question` row for an
    :class:`AnchorQuestion`. ``substitute_wording`` keeps both rows in
    sync (the Question row is what the snapshot + grading paths
    actually render)."""
    result = await db.execute(
        select(Question).where(
            Question.id == question_id, Question.tenant_id == SEED_TENANT_ID
        )
    )
    return result.scalar_one_or_none()


async def list_flagged_anchors(db: AsyncSession) -> list[dict[str, Any]]:
    """Anchors flagged for admin attention — ``needs_admin_attention=True``
    only (rows resolved via ``reject`` keep ``excluded=True`` but
    clear ``needs_admin_attention``, so they fall off the queue).
    Oldest-first by ``created_at`` so the admin works through the
    backlog in arrival order — mirrors
    :func:`app.domain.grade_review.list_flagged_reviews` and
    :func:`app.domain.loop.list_admin_queue`."""
    result = await db.execute(
        select(AnchorQuestion).where(AnchorQuestion.tenant_id == SEED_TENANT_ID)
    )
    # Boolean filter in Python keeps every WHERE single-column equality
    # per AC-CD15 — the fake harness can't compile ``== True`` clauses
    # (SQLAlchemy's ``True_`` element has no ``.value``).
    rows = [row for row in result.scalars().all() if row.needs_admin_attention]
    rows.sort(key=lambda a: a.created_at)
    return [
        {
            "anchor_question_id": row.id,
            "pill_id": row.pill_id,
            "band": row.band,
            "type": row.type.value,
            "config": row.config,
            "assigned_difficulty": row.assigned_difficulty,
            "regeneration_attempts": row.regeneration_attempts,
            "excluded": row.excluded,
            "excluded_reason": row.excluded_reason,
            "created_at": row.created_at,
        }
        for row in rows
    ]


async def resolve_flagged_anchor(
    db: AsyncSession,
    anchor_id: uuid.UUID,
    admin: Any,
    *,
    action: str,
    new_config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Per-row admin resolution of a flagged anchor (AC-D23).

    Three actions:

    - ``keep`` — accept the AI-generated anchor as-is. Clears the
      ``excluded`` + ``needs_admin_attention`` flags so the anchor
      enters the live pool.
    - ``substitute_wording`` — admin replaces ``config`` (and the
      shared-PK :class:`Question` row's config so the snapshot
      renders the substituted text). Clears flags, resets
      ``regeneration_attempts`` to 0. **Does NOT auto-rerun
      self-review** — admin is the authoritative reviewer of their
      own substitution; running an AI cross-check on admin authorship
      would invert the trust hierarchy (decision recorded in
      handover under "What was decided").
    - ``reject`` — acknowledge the excluded slot stays excluded.
      Keeps ``excluded=True``, clears ``needs_admin_attention``.

    Raises 404 if anchor missing, 409 if anchor is not flagged or
    the action+state combo is nonsensical (e.g. ``substitute_wording``
    without ``new_config``)."""
    if action not in ("keep", "substitute_wording", "reject"):
        raise APIError(
            422,
            "invalid_action",
            f"action must be keep / substitute_wording / reject; got {action!r}",
        )
    anchor = await _anchor_by_id(db, anchor_id)
    if anchor is None:
        raise APIError(404, "anchor_not_found", "anchor not found")
    if not anchor.needs_admin_attention:
        raise APIError(
            409,
            "anchor_not_flagged",
            "anchor is not flagged for admin attention; nothing to resolve",
        )

    if action == "keep":
        anchor.excluded = False
        anchor.excluded_reason = None
        anchor.needs_admin_attention = False
    elif action == "substitute_wording":
        if not isinstance(new_config, dict):
            raise APIError(
                409,
                "missing_new_config",
                "substitute_wording requires a new_config dict",
            )
        anchor.config = new_config
        anchor.excluded = False
        anchor.excluded_reason = None
        anchor.needs_admin_attention = False
        anchor.regeneration_attempts = 0
        # Keep the shared-PK Question row in sync so the snapshot +
        # autosave + grade paths render the substituted wording.
        question = await _question_by_id(db, anchor_id)
        if question is not None:
            question.config = new_config
    else:  # action == "reject"
        anchor.needs_admin_attention = False
        # excluded stays True — admin has acknowledged the slot will
        # remain excluded from the live pool.

    from app.domain.catalogue import record_audit

    await record_audit(
        db,
        actor_id=admin.id,
        action="anchors.resolve",
        target_entity="anchor_question",
        target_id=anchor.id,
        detail={
            "action": action,
            "pill_id": str(anchor.pill_id),
            "band": anchor.band,
            "excluded_after": anchor.excluded,
        },
    )
    return {
        "anchor_question_id": anchor.id,
        "action": action,
        "excluded": anchor.excluded,
        "needs_admin_attention": anchor.needs_admin_attention,
        "regeneration_attempts": anchor.regeneration_attempts,
    }


# --- Slice 4 — Band calibration state (preliminary / confident) -------


async def band_calibration_state(
    db: AsyncSession, pill_id: uuid.UUID, band: int
) -> dict[str, Any]:
    """``preliminary -> confident`` display state for one (pill, band)
    (AC-D27 #3 / AC-D20). ``n`` is the aggregate ``total_attempts``
    across every live anchor in the pool; the flip is inclusive
    (``n >= confidence_threshold``) per the AC-D27 wording —
    see :func:`is_confident`.

    Returns::

        {
          "pill_id":           <uuid>,
          "band":              <int>,
          "n":                 <int>,          # aggregate observations
          "state":             "preliminary" | "confident",
          "anchors_in_pool":   <int>,          # live anchors at this band
          "anchors_excluded":  <int>,          # excluded anchors at this band
        }
    """
    result = await db.execute(
        select(AnchorQuestion).where(
            AnchorQuestion.pill_id == pill_id,
            AnchorQuestion.tenant_id == SEED_TENANT_ID,
        )
    )
    rows = [r for r in result.scalars().all() if r.band == band]
    live = [r for r in rows if not r.excluded]
    excluded = [r for r in rows if r.excluded]
    n = sum(int(r.total_attempts or 0) for r in live)

    settings = await _load_settings(db)
    _prior, _sens, threshold = _settings_with_defaults(settings)
    confident = is_confident(n, confidence_threshold=threshold)
    state = "confident" if confident else "preliminary"
    return {
        "pill_id": pill_id,
        "band": band,
        "n": n,
        "state": state,
        "anchors_in_pool": len(live),
        "anchors_excluded": len(excluded),
    }
