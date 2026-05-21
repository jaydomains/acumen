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

from collections.abc import Sequence

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
