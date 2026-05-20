"""Shared scoring helpers used by both ``attempts`` and ``grade_review``.

Extracted to break the otherwise-circular dependency: ``attempts``
imports ``_review_ai_grades`` from ``grade_review`` to wire the submit
path, and ``grade_review`` needs the same outcome-from-score function
``attempts`` uses to set ``Attempt.outcome``. Either side importing the
function from the other creates a cycle; this neutral module owns the
function and both sides import from it.

The arithmetic is exactly the one P4 shipped in
:func:`app.domain.attempts._outcome_for` so the per-attempt pass/fail
decision stays consistent across the submit path, the §8.9 reconcile
sweep, and admin-resolution recomputes (AC-D5 / AC-D19 v1.7).
"""

from __future__ import annotations

from app.models import Test


def outcome_for(score: float, test: Test) -> str:
    """Map an overall score to ``"pass"`` / ``"fail"`` against the
    test's pass threshold. A test with no threshold passes
    unconditionally (P4 default — "everything is a pass" until an
    admin configures a threshold)."""
    if test.pass_threshold is None:
        return "pass"
    return "pass" if score >= test.pass_threshold else "fail"
