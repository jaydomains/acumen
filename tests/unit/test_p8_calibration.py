"""P8 anchor calibration — pure-function math coverage (AC-D27 /
CODE_SPEC §12).

Worked fixtures: every expected value is computed from the spec formula
by hand and recorded in the test, so a regression that drifts the
formula surfaces against a number the spec lets a reader recompute
without re-reading the test.

Formula recap (quoted from CODE_SPEC §12 / AC-D27)::

    observed_difficulty_i = assigned_difficulty
                          + sensitivity * (0.5 - score_i)
    effective_difficulty  = (assigned_difficulty * k + sum(observed_i))
                          / (k + n)               # clamped 1.0-10.0
"""

from __future__ import annotations

import math

import pytest

from app.domain.calibration import (
    compute_effective_difficulty,
    compute_fresh_question_delta,
    is_confident,
)

# --- compute_effective_difficulty: cold start / n = 0 -----------------


def test_effective_difficulty_n_zero_returns_assigned() -> None:
    """At n=0 the estimator returns the prior (assigned_difficulty)
    exactly: ``(assigned * k + 0) / (k + 0) = assigned``.
    AC-D27 #3: "the shrinkage estimate is defined and stable from n=0"."""
    result = compute_effective_difficulty(5.0, [], prior_weight=20, sensitivity=2.0)
    assert result == 5.0


def test_effective_difficulty_n_zero_clamps_ceiling() -> None:
    """An out-of-axis prior (a programming error upstream) is still
    clamped at n=0 so downstream consumers always see a 1.0-10.0
    value."""
    result = compute_effective_difficulty(15.0, [], prior_weight=20, sensitivity=2.0)
    assert result == 10.0


def test_effective_difficulty_n_zero_clamps_floor() -> None:
    """Floor of the 1.0-10.0 axis."""
    result = compute_effective_difficulty(-3.0, [], prior_weight=20, sensitivity=2.0)
    assert result == 1.0


# --- compute_effective_difficulty: n = 1 single observation -----------


def test_effective_difficulty_at_difficulty_score_no_shift() -> None:
    """A single Testee scoring exactly at-difficulty (0.5) implies an
    observed_difficulty equal to the assigned_difficulty — the
    shrinkage estimator therefore returns the assigned_difficulty
    unchanged. ``observed_i = 5.0 + 2.0 * (0.5 - 0.5) = 5.0;
    effective = (5*20 + 5) / 21 = 105/21 = 5.0``."""
    result = compute_effective_difficulty(5.0, [0.5], prior_weight=20, sensitivity=2.0)
    assert math.isclose(result, 5.0)


def test_effective_difficulty_low_score_lifts_difficulty() -> None:
    """A Testee scoring below 0.5 implies the anchor was harder than
    assigned. ``observed_i = 5.0 + 2.0 * (0.5 - 0.0) = 6.0;
    effective = (5*20 + 6) / 21 = 106/21 ~ 5.0476``."""
    result = compute_effective_difficulty(5.0, [0.0], prior_weight=20, sensitivity=2.0)
    assert math.isclose(result, 106.0 / 21.0)


def test_effective_difficulty_high_score_lowers_difficulty() -> None:
    """A Testee scoring above 0.5 implies the anchor was easier than
    assigned. ``observed_i = 5.0 + 2.0 * (0.5 - 1.0) = 4.0;
    effective = (5*20 + 4) / 21 = 104/21 ~ 4.9524``."""
    result = compute_effective_difficulty(5.0, [1.0], prior_weight=20, sensitivity=2.0)
    assert math.isclose(result, 104.0 / 21.0)


# --- compute_effective_difficulty: n at the prior weight --------------


def test_effective_difficulty_at_n_equals_k_is_halfway() -> None:
    """When ``n == k`` the prior and observations carry equal weight,
    so the estimate sits exactly halfway between the prior and the
    mean of observed difficulties.

    20 Testees all scoring 0.0: observed_i = 6.0 each; sum = 120;
    effective = (5*20 + 120) / 40 = 220/40 = 5.5 (halfway between
    prior 5.0 and observed-mean 6.0).
    """
    result = compute_effective_difficulty(
        5.0, [0.0] * 20, prior_weight=20, sensitivity=2.0
    )
    assert math.isclose(result, 5.5)


# --- compute_effective_difficulty: high-n limit -----------------------


def test_effective_difficulty_high_n_approaches_observed_mean() -> None:
    """As ``n -> infinity`` the prior's weight vanishes and the
    estimator converges on the mean of observed difficulties. With
    1000 Testees all scoring 0.0 (observed_i = 6.0): effective =
    (5*20 + 6000) / 1020 = 6100/1020 ~ 5.9804, very close to 6.0."""
    result = compute_effective_difficulty(
        5.0, [0.0] * 1000, prior_weight=20, sensitivity=2.0
    )
    assert math.isclose(result, 6100.0 / 1020.0)
    # Sanity: a long way past the halfway point of test above.
    assert result > 5.95


# --- compute_effective_difficulty: clamping at extremes ---------------


def test_effective_difficulty_clamps_ceiling_when_all_fail() -> None:
    """An assigned-10 anchor that every Testee fails would shrink past
    10.0 without clamping. observed_i = 10.0 + 2.0*0.5 = 11.0; with
    n=20: (10*20 + 220) / 40 = 420/40 = 10.5 → clamps to 10.0."""
    result = compute_effective_difficulty(
        10.0, [0.0] * 20, prior_weight=20, sensitivity=2.0
    )
    assert result == 10.0


def test_effective_difficulty_clamps_floor_when_all_ace() -> None:
    """An assigned-1 anchor every Testee aces would shrink below 1.0
    without clamping. observed_i = 1.0 + 2.0*(-0.5) = 0.0; with
    n=20: (1*20 + 0) / 40 = 0.5 → clamps to 1.0."""
    result = compute_effective_difficulty(
        1.0, [1.0] * 20, prior_weight=20, sensitivity=2.0
    )
    assert result == 1.0


# --- compute_effective_difficulty: mixed observations -----------------


def test_effective_difficulty_mixed_scores_average_correctly() -> None:
    """Two Testees, one at 0.0 (observed=6.0) and one at 1.0
    (observed=4.0). Sum = 10.0; effective = (5*20 + 10) / 22 = 110/22
    = 5.0 — the symmetric pair cancels out and the estimator stays on
    the prior."""
    result = compute_effective_difficulty(
        5.0, [0.0, 1.0], prior_weight=20, sensitivity=2.0
    )
    assert math.isclose(result, 5.0)


# --- compute_effective_difficulty: configuration sanity ---------------


def test_effective_difficulty_zero_prior_weight_raises() -> None:
    """A non-positive prior_weight degenerates the shrinkage (at n=0
    the denominator is zero); surface the misconfiguration loudly
    rather than producing a NaN result."""
    with pytest.raises(ValueError, match="prior_weight"):
        compute_effective_difficulty(5.0, [], prior_weight=0, sensitivity=2.0)


def test_effective_difficulty_negative_prior_weight_raises() -> None:
    with pytest.raises(ValueError, match="prior_weight"):
        compute_effective_difficulty(5.0, [], prior_weight=-5, sensitivity=2.0)


def test_effective_difficulty_uses_configured_sensitivity() -> None:
    """sensitivity scales how aggressively scores shift the observed
    difficulty. Sensitivity 4.0 with score 0.0: observed_i = 5.0 +
    4.0*0.5 = 7.0; with n=1: (5*20 + 7) / 21 = 107/21 ~ 5.0952. The
    same score with sensitivity 2.0 (test above) gave 5.0476 — double
    the shift confirms sensitivity is being read."""
    result = compute_effective_difficulty(5.0, [0.0], prior_weight=20, sensitivity=4.0)
    assert math.isclose(result, 107.0 / 21.0)


# --- compute_fresh_question_delta -------------------------------------


def test_fresh_delta_empty_returns_zero() -> None:
    """An attempt with no anchors drawn has no triangulation signal —
    the delta is 0.0, so the caller's ``assigned + delta`` reduces to
    the assigned difficulty. CODE_SPEC §12: "0 when no anchors were
    drawn"."""
    assert compute_fresh_question_delta([]) == 0.0


def test_fresh_delta_single_positive_anchor() -> None:
    """A single anchor whose effective sits above its assigned implies
    the attempt's Testee found the band harder than the prior — fresh
    questions inherit the same positive shift. delta = 6.0 - 5.0 = 1.0."""
    assert compute_fresh_question_delta([(6.0, 5.0)]) == 1.0


def test_fresh_delta_single_negative_anchor() -> None:
    """A single anchor whose effective sits below its assigned implies
    the attempt's Testee found the band easier than the prior — fresh
    questions inherit the same negative shift. delta = 4.0 - 5.0 = -1.0."""
    assert compute_fresh_question_delta([(4.0, 5.0)]) == -1.0


def test_fresh_delta_two_anchors_cancel() -> None:
    """Symmetric +1 / -1 anchors cancel to a 0.0 delta — fresh questions
    fall through to their bare assigned difficulty. ((6-5)+(4-5))/2 = 0."""
    assert compute_fresh_question_delta([(6.0, 5.0), (4.0, 5.0)]) == 0.0


def test_fresh_delta_two_anchors_average_positive() -> None:
    """Two anchors both shifted positive average their shifts.
    ((7-5)+(8-6))/2 = (2+2)/2 = 2.0."""
    assert compute_fresh_question_delta([(7.0, 5.0), (8.0, 6.0)]) == 2.0


def test_fresh_delta_handles_three_anchors() -> None:
    """Sanity: the mean works for n>2. Deltas 1.0, 2.0, 3.0 → mean 2.0."""
    assert math.isclose(
        compute_fresh_question_delta([(6.0, 5.0), (8.0, 6.0), (10.0, 7.0)]),
        2.0,
    )


# --- is_confident -----------------------------------------------------


def test_is_confident_below_threshold_is_preliminary() -> None:
    assert is_confident(0, confidence_threshold=20) is False
    assert is_confident(1, confidence_threshold=20) is False
    assert is_confident(19, confidence_threshold=20) is False


def test_is_confident_at_threshold_flips_to_confident() -> None:
    """AC-D27 #3 wording: "Until ``n >= anchor_calibration_confidence_threshold``"
    — i.e. confidence is reached at ``>=``, not strictly ``>``. Boundary
    is inclusive."""
    assert is_confident(20, confidence_threshold=20) is True


def test_is_confident_above_threshold_stays_confident() -> None:
    assert is_confident(21, confidence_threshold=20) is True
    assert is_confident(1000, confidence_threshold=20) is True


def test_is_confident_respects_configured_threshold() -> None:
    """The threshold is sourced from system_settings — a different
    tenant's setting yields a different boundary."""
    assert is_confident(5, confidence_threshold=5) is True
    assert is_confident(4, confidence_threshold=5) is False
