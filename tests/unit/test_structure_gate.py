"""P0: structure gate passes against the real tree (AC-CD17)."""

from __future__ import annotations

from scripts.structure_gate import check_main_setup_only, check_paths


def test_required_paths_present() -> None:
    assert check_paths() == []


def test_main_is_setup_only() -> None:
    assert check_main_setup_only() == []
