"""P4 schema additions (AC-D3 v1.5 / AC-D26 v1.4): the
``attempt.assignment_id`` FK and the
``uq_attempt_test_testee_sequence`` unique constraint are present on
the SQLAlchemy model and the migration chain head is
``0005_p4_attempt_sequence_unique`` (revises 0004 revises 0003).

Mirrors the P1 / P3 schema-assertion style — no DB, no network.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from app.models import Base

_REPO = Path(__file__).resolve().parents[2]


def _table(name: str):
    return Base.metadata.tables[f"acumen.{name}"]


def test_attempt_assignment_fk_present() -> None:
    cols = _table("attempt").c
    assert "assignment_id" in cols
    col = cols["assignment_id"]
    assert col.nullable is True
    # FK targets acumen.assignment(id).
    fks = list(col.foreign_keys)
    assert len(fks) == 1
    assert fks[0].column.table.name == "assignment"


def test_attempt_sequence_unique_constraint_present() -> None:
    constraints = _table("attempt").constraints
    names = {c.name for c in constraints if c.name}
    assert "uq_attempt_test_testee_sequence" in names
    for c in constraints:
        if c.name == "uq_attempt_test_testee_sequence":
            cols = {col.name for col in c.columns}
            assert cols == {"test_id", "testee_id", "sequence_number"}
            return


def _alembic(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=_REPO,
        capture_output=True,
        text=True,
    )


def test_migration_0004_assignment_fk_round_trip() -> None:
    up = _alembic(
        "upgrade",
        "0003_p3_pill_safety_override:0004_p4_attempt_assignment_fk",
        "--sql",
    )
    assert up.returncode == 0, up.stderr
    assert "ADD COLUMN assignment_id" in up.stdout
    assert "ix_attempt_assignment_id" in up.stdout

    down = _alembic(
        "downgrade",
        "0004_p4_attempt_assignment_fk:0003_p3_pill_safety_override",
        "--sql",
    )
    assert down.returncode == 0, down.stderr
    assert "DROP COLUMN assignment_id" in down.stdout
    assert "DROP INDEX" in down.stdout


def test_migration_0005_sequence_unique_round_trip() -> None:
    up = _alembic(
        "upgrade",
        "0004_p4_attempt_assignment_fk:0005_p4_attempt_sequence_unique",
        "--sql",
    )
    assert up.returncode == 0, up.stderr
    assert "uq_attempt_test_testee_sequence" in up.stdout
    assert "UNIQUE (test_id, testee_id, sequence_number)" in up.stdout

    down = _alembic(
        "downgrade",
        "0005_p4_attempt_sequence_unique:0004_p4_attempt_assignment_fk",
        "--sql",
    )
    assert down.returncode == 0, down.stderr
    assert "DROP CONSTRAINT uq_attempt_test_testee_sequence" in down.stdout
