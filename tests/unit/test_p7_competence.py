"""P7 competence math — pure-function tests for ``app.domain.competence``
(AC-D9 v1.2 / AC-CD13).

CODE_SPEC §17 names competence + calibration as the highest-risk hot
spot in the codebase — silently wrong, not cheaply caught in production.
AC-CD15 calls for "near-full unit+branch coverage of competence.py with
worked fixtures derived from DECISIONS formulas". The worked numbers
below are derived directly from AC-D9 v1.2's numeric examples
(DECISIONS.md AC-D9 amended) and from CODE_SPEC §13.

No DB, no network — pure functions only.
"""

from __future__ import annotations

import math

import pytest

from app.domain.competence import (
    attempt_competence,
    compute_competence_estimate,
    loop_target_difficulty,
    response_competence,
)

# --- response_competence ----------------------------------------------


class TestResponseCompetence:
    """``response_competence = effective_difficulty
                              + sensitivity * (response_score - 0.5)``

    AC-D9 v1.2: a score of 0.5 means the Testee performed exactly at the
    question's difficulty level — their competence equals the difficulty.
    Scoring above 0.5 lifts competence above the difficulty; below 0.5
    drops it. The sensitivity factor sets how much.
    """

    def test_at_difficulty_score_half_equals_difficulty(self) -> None:
        # AC-D9 v1.2: score = 0.5 → competence = difficulty exactly.
        assert response_competence(7.0, 0.5, 2.0) == 7.0

    def test_full_score_lifts_by_sensitivity_half(self) -> None:
        # score = 1.0 with sensitivity 2.0: lift = 2.0 * 0.5 = 1.0 ABOVE
        # difficulty. The Testee aced a difficulty-7 question → competent
        # at 8.0.
        assert response_competence(7.0, 1.0, 2.0) == 8.0

    def test_zero_score_drops_by_sensitivity_half(self) -> None:
        # score = 0.0 with sensitivity 2.0: drop = 2.0 * 0.5 = 1.0 BELOW.
        assert response_competence(7.0, 0.0, 2.0) == 6.0

    def test_partial_score_quarter_above(self) -> None:
        # score = 0.75 at diff 5, sens 2.0 → 5.0 + 2.0 * 0.25 = 5.5.
        assert response_competence(5.0, 0.75, 2.0) == 5.5

    def test_higher_sensitivity_amplifies_lift(self) -> None:
        # Acing a difficulty-5 question with sensitivity 4.0 puts
        # competence at 5 + 4*0.5 = 7. AC-D9 v1.2: "all knobs configurable
        # so behaviour can be tuned from pilot data."
        assert response_competence(5.0, 1.0, 4.0) == 7.0

    def test_higher_sensitivity_amplifies_drop(self) -> None:
        assert response_competence(5.0, 0.0, 4.0) == 3.0

    def test_zero_sensitivity_collapses_to_difficulty(self) -> None:
        # Edge case — sensitivity 0 means "ignore the score signal";
        # competence = difficulty regardless. Not what AC-D9 recommends
        # but the formula must behave under operator-set knobs.
        assert response_competence(7.0, 0.0, 0.0) == 7.0
        assert response_competence(7.0, 1.0, 0.0) == 7.0

    def test_float_difficulty_input_supported(self) -> None:
        # effective_difficulty is a FLOAT per AC-D27 — anchor calibration
        # produces a Bayesian-shrunk estimate, not an integer band. The
        # formula must accept the float side cleanly.
        assert response_competence(6.8, 0.5, 2.0) == 6.8


# --- attempt_competence -----------------------------------------------


class TestAttemptCompetence:
    """``attempt_competence = mean(response_competence)`` across the
    attempt's responses on the relevant pill (AC-D9 v1.2)."""

    def test_empty_returns_none(self) -> None:
        # AC-D9 null-handling: zero attempts → null competence. An
        # attempt with no scored responses on this pill produces no
        # competence signal and must not contribute to the aggregate.
        assert attempt_competence([]) is None

    def test_single_response(self) -> None:
        assert attempt_competence([7.0]) == 7.0

    def test_simple_mean(self) -> None:
        # Two responses 6.0 and 8.0 → mean 7.0.
        assert attempt_competence([6.0, 8.0]) == 7.0

    def test_three_responses_mean(self) -> None:
        assert attempt_competence([6.0, 7.0, 8.0]) == 7.0

    def test_mixed_competences(self) -> None:
        # 5.5, 6.5, 7.5 → 6.5
        assert attempt_competence([5.5, 6.5, 7.5]) == 6.5


# --- compute_competence_estimate --------------------------------------


class TestComputeCompetenceEstimate:
    """``competence_estimate = Σ(c_i * w_i) / Σ(w_i)``
    where ``w_i = 0.5 ** (age_i / halflife_days)``.

    AC-D9 v1.2 worked example: "An attempt today has weight 1.0; an
    attempt 90 days ago has weight 0.5; an attempt 180 days ago has
    weight 0.25." Halflife default 90 days.
    """

    def test_empty_returns_none(self) -> None:
        # AC-D9 null-handling: "zero attempts → competence_estimate is
        # null". Callers must propagate the null, never substitute 0.0.
        assert compute_competence_estimate([], halflife_days=90) is None

    def test_single_attempt_today(self) -> None:
        # Attempt today (age 0) → weight 1.0 → estimate equals the
        # attempt's competence.
        assert compute_competence_estimate([(7.5, 0)], halflife_days=90) == 7.5

    def test_two_attempts_one_at_halflife(self) -> None:
        # AC-D9 v1.2 worked example. Today (w=1.0) at competence 8.0;
        # 90 days ago (w=0.5) at competence 6.0.
        # weighted = (8.0 * 1.0 + 6.0 * 0.5) / (1.0 + 0.5) = 11.0 / 1.5
        result = compute_competence_estimate([(8.0, 0), (6.0, 90)], halflife_days=90)
        assert result is not None
        assert math.isclose(result, 11.0 / 1.5)

    def test_two_attempts_one_at_two_halflives(self) -> None:
        # Today (w=1.0) at 8.0; 180 days ago (w=0.25) at 6.0.
        # weighted = (8.0 + 6.0 * 0.25) / (1.0 + 0.25) = 9.5 / 1.25 = 7.6
        result = compute_competence_estimate([(8.0, 0), (6.0, 180)], halflife_days=90)
        assert result is not None
        assert math.isclose(result, 7.6)

    def test_recency_pulls_estimate_toward_newer_signal(self) -> None:
        # An old strong-skill attempt should not anchor the estimate
        # against fresh weak-skill evidence.
        old_only = compute_competence_estimate([(9.0, 180)], halflife_days=90)
        new_only = compute_competence_estimate([(5.0, 0)], halflife_days=90)
        both = compute_competence_estimate([(9.0, 180), (5.0, 0)], halflife_days=90)
        assert old_only == 9.0
        assert new_only == 5.0
        # ``both`` must be much closer to ``new_only`` (5.0) than to
        # ``old_only`` (9.0) because the new attempt has 4× the weight.
        assert both is not None
        assert abs(both - 5.0) < abs(both - 9.0)

    def test_configurable_halflife_changes_aggregate(self) -> None:
        # Same two attempts, different halflife → different weights →
        # different estimate. With halflife=30, the 60-day-old attempt
        # is at TWO halflives (w=0.25), not less than one.
        attempts = [(8.0, 30), (6.0, 60)]
        # halflife 30: ages 30 → w=0.5; 60 → w=0.25
        # → (8*0.5 + 6*0.25) / (0.5 + 0.25) = 5.5 / 0.75 = 7.333...
        result = compute_competence_estimate(attempts, halflife_days=30)
        assert result is not None
        assert math.isclose(result, 22.0 / 3.0)

    def test_age_zero_is_full_weight(self) -> None:
        # Sanity: 0 ** anything = 0 except 0**0 = 1, but the formula is
        # 0.5 ** (0 / halflife) = 0.5 ** 0 = 1.0 — no ambiguity.
        result = compute_competence_estimate([(7.0, 0), (5.0, 0)], halflife_days=90)
        assert result == 6.0

    def test_non_positive_halflife_raises(self) -> None:
        # halflife <= 0 is a configuration error. Don't divide by zero;
        # don't produce a meaningless negative-decay aggregate.
        with pytest.raises(ValueError, match="halflife_days must be positive"):
            compute_competence_estimate([(7.0, 0)], halflife_days=0)
        with pytest.raises(ValueError, match="halflife_days must be positive"):
            compute_competence_estimate([(7.0, 0)], halflife_days=-1)

    def test_far_past_attempt_contributes_negligibly(self) -> None:
        # An attempt 900 days old (10 halflives) has weight 0.5**10 ≈
        # 0.001 — should be effectively invisible against a fresh one.
        result = compute_competence_estimate([(2.0, 900), (8.0, 0)], halflife_days=90)
        assert result is not None
        # Estimate sits within 0.01 of the fresh 8.0 — old attempt
        # barely registers.
        assert abs(result - 8.0) < 0.01


# --- loop_target_difficulty -------------------------------------------


class TestLoopTargetDifficulty:
    """``target = round(competence_estimate + 0.5)`` clamped to the pill's
    ``available_difficulty_range``. AC-D9 v1.2: "+0.5 bias means the
    next attempt stretches slightly above current competence — testing
    exactly at competence confirms what's known; testing slightly above
    is where learning happens."

    Plus AC-D6 step-down: three consecutive well-below-difficulty
    scores force a one-integer step-down regardless of formula.
    """

    def test_basic_plus_half_then_round(self) -> None:
        # estimate 6.7 → floor(7.7) = 7. AC-D9 v1.2's exact example:
        # "a competence estimate of 6.7 on a pill with current attempts
        # at integer 6 triggers a step-up to integer 7".
        assert (
            loop_target_difficulty(
                6.7,
                available_difficulty_min=1,
                available_difficulty_max=10,
                recent_attempt_scores=[],
            )
            == 7
        )

    def test_integer_estimate_always_stretches(self) -> None:
        # Locks in the PR-019 Gitar fix: AC-D9 v1.2's "+0.5 stretch"
        # intent is "test slightly above current competence — where
        # learning happens". Python's banker's rounding silently
        # killed the stretch on every EVEN-integer estimate
        # (``round(4.0 + 0.5) == 4`` because 4 is even), producing a
        # target equal to the current competence — no stretch at all.
        # The implementation now uses ``math.floor(estimate + 1.0)``
        # so every integer estimate genuinely stretches up by one.
        assert (
            loop_target_difficulty(
                4.0,
                available_difficulty_min=1,
                available_difficulty_max=10,
                recent_attempt_scores=[],
            )
            == 5
        )
        assert (
            loop_target_difficulty(
                5.0,
                available_difficulty_min=1,
                available_difficulty_max=10,
                recent_attempt_scores=[],
            )
            == 6
        )
        assert (
            loop_target_difficulty(
                6.0,
                available_difficulty_min=1,
                available_difficulty_max=10,
                recent_attempt_scores=[],
            )
            == 7
        )

    def test_clamps_to_pill_max(self) -> None:
        # estimate 10.0 → floor(11.0) = 11; clamp to max=8.
        assert (
            loop_target_difficulty(
                10.0,
                available_difficulty_min=1,
                available_difficulty_max=8,
                recent_attempt_scores=[],
            )
            == 8
        )

    def test_clamps_to_pill_min(self) -> None:
        # estimate 0.0 → floor(1.0) = 1; clamp to min=2.
        assert (
            loop_target_difficulty(
                0.0,
                available_difficulty_min=2,
                available_difficulty_max=9,
                recent_attempt_scores=[],
            )
            == 2
        )

    def test_three_consecutive_low_scores_step_down(self) -> None:
        # estimate 5.0 → floor(6.0) = 6, then step-down by 1 → 5.
        assert (
            loop_target_difficulty(
                5.0,
                available_difficulty_min=1,
                available_difficulty_max=10,
                recent_attempt_scores=[0.3, 0.2, 0.1],
            )
            == 5
        )

    def test_step_down_uses_last_three_only(self) -> None:
        # Earlier high scores are ignored; only the last 3 count.
        assert (
            loop_target_difficulty(
                5.0,
                available_difficulty_min=1,
                available_difficulty_max=10,
                recent_attempt_scores=[0.9, 0.9, 0.3, 0.2, 0.1],
            )
            == 5
        )

    def test_step_down_breaks_on_one_decent_score(self) -> None:
        # One score >= 0.4 in the trailing 3 → no step-down.
        # [0.5, 0.2, 0.1]: 0.5 disqualifies the run.
        assert (
            loop_target_difficulty(
                5.0,
                available_difficulty_min=1,
                available_difficulty_max=10,
                recent_attempt_scores=[0.5, 0.2, 0.1],
            )
            == 6
        )

    def test_step_down_at_threshold_boundary(self) -> None:
        # threshold is strict `<` 0.4 — a score of exactly 0.4 does NOT
        # qualify as "well below the difficulty".
        assert (
            loop_target_difficulty(
                5.0,
                available_difficulty_min=1,
                available_difficulty_max=10,
                recent_attempt_scores=[0.4, 0.4, 0.4],
            )
            == 6
        )
        # 0.399999 does qualify.
        assert (
            loop_target_difficulty(
                5.0,
                available_difficulty_min=1,
                available_difficulty_max=10,
                recent_attempt_scores=[0.39, 0.39, 0.39],
            )
            == 5
        )

    def test_only_two_low_scores_no_step_down(self) -> None:
        # Need THREE consecutive — two is not enough.
        assert (
            loop_target_difficulty(
                5.0,
                available_difficulty_min=1,
                available_difficulty_max=10,
                recent_attempt_scores=[0.1, 0.1],
            )
            == 6
        )

    def test_step_down_clamped_at_min(self) -> None:
        # estimate 2.0 → floor(3.0) = 3; step-down → 2; min=2 so the
        # clamp is a no-op. The step-down must not push below the
        # pill's floor (would-be-1, returns 2).
        assert (
            loop_target_difficulty(
                2.0,
                available_difficulty_min=2,
                available_difficulty_max=10,
                recent_attempt_scores=[0.1, 0.1, 0.1],
            )
            == 2
        )

    def test_invalid_range_raises(self) -> None:
        # A pill with min > max is a configuration error — the loop must
        # not silently swallow it.
        with pytest.raises(ValueError, match="invalid pill range"):
            loop_target_difficulty(
                5.0,
                available_difficulty_min=8,
                available_difficulty_max=3,
                recent_attempt_scores=[],
            )

    def test_empty_history_no_step_down(self) -> None:
        # A first attempt has no history → no step-down possible.
        # estimate 4.0 → floor(5.0) = 5; the +1 stretch is preserved.
        assert (
            loop_target_difficulty(
                4.0,
                available_difficulty_min=1,
                available_difficulty_max=10,
                recent_attempt_scores=[],
            )
            == 5
        )
