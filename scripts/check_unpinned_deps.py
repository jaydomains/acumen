"""Fail if any requirements*.txt line lacks a version specifier (AC-CD1).

Blank lines, comments, and ``-r`` / ``-c`` / ``--`` includes are
skipped. A requirement is "pinned" if it carries any specifier
(``== >= <= ~= != === < >``). A bare package name (unconstrained add)
fails the check. CI runs this; CODE_SPEC AC-CD1.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = ("requirements.txt", "requirements-worker.txt", "requirements-dev.txt")
SPECIFIER = re.compile(r"(===|==|>=|<=|~=|!=|<|>)")


def find_unpinned() -> list[str]:
    bad: list[str] = []
    for fname in FILES:
        path = ROOT / fname
        if not path.exists():
            continue
        for raw in path.read_text().splitlines():
            line = raw.split("#", 1)[0].strip()
            if not line or line.startswith(("-r", "-c", "--")):
                continue
            if not SPECIFIER.search(line):
                bad.append(f"{fname}: unpinned dependency: {line}")
    return bad


def main() -> int:
    bad = find_unpinned()
    if bad:
        print("UNPINNED DEPENDENCY CHECK FAILED:")
        for b in bad:
            print(f"  - {b}")
        return 1
    print("unpinned-deps check: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
