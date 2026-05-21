"""competence_estimate — IRT-style per-response value + recency decay.

AC-D9 (v1.2) — full formula; AC-CD13 anchors the implementation; CODE_SPEC
§13. Near-full unit+branch coverage is required by AC-CD15 because this
file is one of the three statistical-core hot spots (CODE_SPEC §17) — a
subtle error here is silently wrong in production and not cheaply caught.

Slice 1 ships the **pure-function math** that AC-D9 v1.2 specifies:

  response_competence = effective_difficulty
                      + competence_sensitivity * (response_score - 0.5)
  attempt_competence  = mean(response_competence)
  weight_i            = 0.5 ** (age_days_i / competence_decay_halflife_days)
  competence_estimate = Σ(c_i * w_i) / Σ(w_i)

…plus :func:`loop_target_difficulty` which combines AC-D9's
``round(estimate + 0.5)`` rule, the per-pill ``available_difficulty_range``
clamp (AC-D9 v1.6), and the AC-D6 "three-consecutive well-below-difficulty"
step-down.

The DB-writing wrapper that resolves ``effective_difficulty`` per response
(anchor pool vs ``question.assigned_difficulty``), loads attempt history,
and writes :class:`CompetencyProfile` lives in Slice 2 (`apply_competence_
update`). Slice 1 stays free of SQLAlchemy / DB session imports so the
unit tests run as pure-Python without the FakeSession harness.
"""

from __future__ import annotations

from collections.abc import Sequence

# Threshold for the AC-D6 "three consecutive well-below-difficulty"
# step-down. AC-D9 v1.2 names the rule but does not name the threshold —
# the exact wording is "Three consecutive attempts where the Testee's
# score is well below the difficulty trigger a step-down of one integer
# regardless of formula" (DECISIONS.md AC-D9 v1.2). AC-D9 also defines
# response_score = 0.5 as "performed exactly at the question's
# difficulty"; "well below the difficulty" therefore means materially
# under 0.5. The 0.4 cut-off is a P7 implementation choice (0.1 below
# the at-difficulty midpoint) — small enough to not fire on a normal
# 50/50 attempt but loose enough to catch a clear pattern of under-
# performance. Could become a ``system_settings`` column in v1.x if
# operational tuning needs it; for now a code constant per the user's
# direction.
_WELL_BELOW_DIFFICULTY_THRESHOLD = 0.4
_STEP_DOWN_CONSECUTIVE_COUNT = 3


def response_competence(
    effective_difficulty: float,
    response_score: float,
    sensitivity: float,
) -> float:
    """Per-response competence value (AC-D9 v1.2 IRT-style formula).

    ``response_competence = effective_difficulty
                          + sensitivity * (response_score - 0.5)``

    Interpretation: ``response_score = 0.5`` puts the Testee exactly at
    the question's difficulty. Scoring above 0.5 lifts competence above
    the difficulty; below 0.5 drops it. ``sensitivity`` sets how much.
    Default sensitivity is 2.0 (``system_settings.competence_sensitivity``).

    The function does not validate input ranges — AC-D9 says scores are
    0.0–1.0 and difficulty is 1.0–10.0 but the formula is well-defined
    over any reals, and the upstream gradebook is the boundary that
    enforces ranges. Garbage-in produces a number, not an exception.
    """
    return effective_difficulty + sensitivity * (response_score - 0.5)


def attempt_competence(response_competences: Sequence[float]) -> float | None:
    """Mean of ``response_competence`` across an attempt's responses
    (AC-D9 v1.2). Returns ``None`` on empty input — an attempt with no
    scored responses on the relevant pill has no competence signal and
    must not contribute to the aggregate.

    Callers are responsible for restricting the input to responses on
    a single pill — the aggregate is per ``(testee, pill)``.
    """
    if not response_competences:
        return None
    return sum(response_competences) / len(response_competences)


def compute_competence_estimate(
    attempts: Sequence[tuple[float, int]],
    *,
    halflife_days: int,
) -> float | None:
    """Recency-weighted aggregate (AC-D9 v1.2). ``attempts`` is a sequence
    of ``(attempt_competence, age_in_days)`` tuples — one per submitted
    attempt by the Testee on the pill. ``halflife_days`` is the decay
    constant from ``system_settings.competence_decay_halflife_days``
    (default 90).

    ``weight = 0.5 ** (age_days / halflife_days)``; an attempt today has
    weight 1.0, an attempt at one half-life has weight 0.5, and so on.

    Returns ``None`` on empty input — AC-D9 null-handling: "For pills
    with zero attempts by a Testee, ``competence_estimate`` is null. UI
    displays 'no data yet' rather than a band. Loop logic per AC-D6
    treats null as needing benchmark or first attempt, not as a failing
    score." Callers must propagate the null, never substitute 0.0.

    ``halflife_days`` must be positive; non-positive halflife is a
    configuration error and raises ``ValueError`` rather than producing
    a meaningless aggregate (silent division-by-zero or negative-decay
    weights would amplify older attempts arbitrarily).
    """
    if halflife_days <= 0:
        raise ValueError(
            f"halflife_days must be positive, got {halflife_days!r}; "
            "fix system_settings.competence_decay_halflife_days"
        )
    if not attempts:
        return None
    weighted_sum = 0.0
    weight_total = 0.0
    for comp, age in attempts:
        weight = 0.5 ** (age / halflife_days)
        weighted_sum += comp * weight
        weight_total += weight
    if weight_total == 0.0:
        # Defensive — weight is 0.5^x which is strictly positive for any
        # finite x, so this branch only fires if the input was empty
        # (already returned above) or contained infinities. Don't divide
        # by zero — return null and let the caller skip.
        return None
    return weighted_sum / weight_total


def loop_target_difficulty(
    competence_estimate: float,
    *,
    available_difficulty_min: int,
    available_difficulty_max: int,
    recent_attempt_scores: Sequence[float],
) -> int:
    """Compute the next attempt's target difficulty for the AC-D6 loop.

    Per AC-D9 v1.2:

        Next attempt's target difficulty =
            round(competence_estimate + 0.5)
        clamped to the pill's ``available_difficulty_range``.

    The +0.5 bias means "test slightly above current competence — where
    learning happens, rather than confirming what's known."

    Plus the AC-D6 / AC-D9 v1.2 step-down rule:

        Three consecutive attempts where the Testee's score is well
        below the difficulty trigger a step-down of one integer
        regardless of formula.

    "Well below the difficulty" is interpreted at the 0.4 threshold
    here (AC-D9 v1.2 defines response_score = 0.5 as "performed exactly
    at the difficulty"; 0.4 is materially below that midpoint). The
    threshold is a P7 implementation choice — see the module-level
    ``_WELL_BELOW_DIFFICULTY_THRESHOLD`` constant for the reasoning.

    Null ``competence_estimate`` is the caller's responsibility — AC-D9
    null-handling says "needs benchmark or first attempt, not a failing
    score". The caller routes the null path to ``assignment.difficulty``
    (the difficulty the original attempt was issued at) rather than
    invoking this helper.

    ``recent_attempt_scores`` is the sequence of overall attempt scores
    on this pill in **chronological order, most recent last**. Only the
    final 3 are consulted for step-down — earlier entries are ignored.
    """
    if available_difficulty_min > available_difficulty_max:
        raise ValueError(
            f"invalid pill range: min={available_difficulty_min} > "
            f"max={available_difficulty_max}"
        )
    target = round(competence_estimate + 0.5)
    last_three = list(recent_attempt_scores)[-_STEP_DOWN_CONSECUTIVE_COUNT:]
    if len(last_three) >= _STEP_DOWN_CONSECUTIVE_COUNT and all(
        s < _WELL_BELOW_DIFFICULTY_THRESHOLD for s in last_three
    ):
        target -= 1
    # Clamp last — the step-down must not push below the pill's floor
    # and the +0.5 bias must not push above its ceiling.
    if target < available_difficulty_min:
        return available_difficulty_min
    if target > available_difficulty_max:
        return available_difficulty_max
    return target
