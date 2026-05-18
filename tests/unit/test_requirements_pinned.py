"""P0: every requirements line is pinned/bounded (AC-CD1)."""

from __future__ import annotations

from scripts.check_unpinned_deps import find_unpinned


def test_no_unpinned_dependencies() -> None:
    assert find_unpinned() == []
