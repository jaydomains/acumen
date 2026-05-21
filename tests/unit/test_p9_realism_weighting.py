"""P9 Slice 1 — realism flag Testee-weighting + flag-ratio fold math.

Pure-function coverage of
:func:`app.domain.drive_rag.compute_testee_realism_weight` and
:func:`app.domain.drive_rag.aggregate_flag_ratio`. No DB / no network
(AC-CD15). The hybrid weighting choice (mean of submitted
``overall_score`` when available, neutral 0.5 fallback) reflects the
user-locked design decision; the fold ratio reflects the AC-D22
"high flag count relative to its attempt count" wording.
"""

from __future__ import annotations

import pytest

from app.domain.drive_rag import aggregate_flag_ratio, compute_testee_realism_weight

# --- compute_testee_realism_weight -----------------------------------


def test_realism_weight_no_attempts_returns_neutral_half() -> None:
    """A brand-new Testee with no submitted attempts contributes flags
    at 0.5 — neither suppressed nor over-amplified per user-locked
    hybrid decision."""
    assert compute_testee_realism_weight([]) == 0.5


def test_realism_weight_all_none_scores_returns_neutral_half() -> None:
    """A Testee with submitted attempts that produced no
    ``overall_score`` (e.g. an empty attempt; rare per AC-D26) is
    treated the same as zero-attempt: neutral 0.5."""
    assert compute_testee_realism_weight([None, None, None]) == 0.5


def test_realism_weight_single_attempt_returns_that_score() -> None:
    assert compute_testee_realism_weight([0.8]) == 0.8


def test_realism_weight_multi_attempt_returns_mean() -> None:
    """Mean across the Testee's submitted attempts — the "overall
    attempt accuracy" signal per amended AC-D22."""
    assert compute_testee_realism_weight([0.8, 0.4, 0.6]) == pytest.approx(0.6)


def test_realism_weight_skips_none_among_real_scores() -> None:
    """A mix of real and None scores averages the real ones only —
    matching ``compute_competence_estimate``'s None-skipping
    semantic."""
    assert compute_testee_realism_weight([0.8, None, 0.4]) == pytest.approx(0.6)


def test_realism_weight_clamps_at_upper_bound() -> None:
    """``overall_score`` is bounded [0.0, 1.0] by construction, but
    the clamp survives an upstream change. Mean of 1.2 would clamp to
    1.0."""
    assert compute_testee_realism_weight([1.2, 1.4]) == 1.0


def test_realism_weight_clamps_at_lower_bound() -> None:
    """Symmetric clamp on the lower side."""
    assert compute_testee_realism_weight([-0.2, -0.1]) == 0.0


# --- aggregate_flag_ratio --------------------------------------------


def test_flag_ratio_zero_serves_returns_zero() -> None:
    """A question never served can't have a ratio — defensive
    short-circuit avoids division-by-zero."""
    assert aggregate_flag_ratio(flag_weight_sum=1.5, total_serves=0) == 0.0


def test_flag_ratio_negative_serves_returns_zero() -> None:
    """Defensive against an upstream bug producing a negative count.
    Better to surface 0 (no exclusion) than to invert the ratio."""
    assert aggregate_flag_ratio(flag_weight_sum=1.0, total_serves=-3) == 0.0


def test_flag_ratio_simple_division() -> None:
    """3 unit-weighted flags out of 10 serves = 0.3."""
    assert aggregate_flag_ratio(flag_weight_sum=3.0, total_serves=10) == 0.3


def test_flag_ratio_weighted_division() -> None:
    """Two flags, one at weight 0.9, one at 0.6 → sum 1.5 / 10 = 0.15."""
    assert aggregate_flag_ratio(flag_weight_sum=1.5, total_serves=10) == 0.15


def test_flag_ratio_clamps_above_one() -> None:
    """Total weighted flags > total serves would push the ratio above
    1.0 — saturation cap. Possible if a single question gets multiple
    flags per serve (it shouldn't, but the unique constraint enforces
    per-Testee uniqueness, not per-serve)."""
    assert aggregate_flag_ratio(flag_weight_sum=15.0, total_serves=10) == 1.0


def test_flag_ratio_clamps_below_zero() -> None:
    """Negative weight sum would be a bug, but the clamp prevents it
    poisoning the aggregation pipeline."""
    assert aggregate_flag_ratio(flag_weight_sum=-1.0, total_serves=10) == 0.0
