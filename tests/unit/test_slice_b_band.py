"""Slice B — band_string threshold boundaries (B.4 + B.5 share the helper).

Thresholds mirror frontend/design-reference/prototype/data.jsx:51.
"""

from __future__ import annotations

import pytest

from app.domain.competence import band_string


@pytest.mark.parametrize(
    ("estimate", "expected"),
    [
        (None, "novice"),
        (0.0, "novice"),
        (2.99, "novice"),
        (3.0, "junior"),
        (4.99, "junior"),
        (5.0, "working"),
        (6.99, "working"),
        (7.0, "advanced"),
        (8.49, "advanced"),
        (8.5, "expert"),
        (10.0, "expert"),
    ],
)
def test_band_string_thresholds(estimate: float | None, expected: str) -> None:
    assert band_string(estimate) == expected
