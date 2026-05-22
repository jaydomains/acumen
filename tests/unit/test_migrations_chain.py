"""Migration chain regression guard (AC-CD3).

The Alembic chain stalled the first time it ran against a real
Postgres because migration 0002 used to compile tables from
``app.models.Base.metadata.sorted_tables`` at run time, so it always
emitted whatever the live ORM carried — silently including every
column / constraint introduced by 0003-0007. Offline ``--sql``
round-trip tests missed it (offline mode tracks no DB state).

This module guards the inverse invariant: every (table, name) pair
introduced by a post-0002 ``ADD COLUMN`` / ``ADD CONSTRAINT`` / new
``CREATE INDEX`` must NOT already exist on the corresponding table in
0002's frozen P1 metadata. If a future regeneration of 0002 ever
re-introduces one of those elements, the chain re-breaks at the
migration that owns it — this test fails fast at PR review time, no
DB required.

The complementary real-Postgres chain check lives in CI as a separate
step (``.github/workflows/ci.yml``).
"""

from __future__ import annotations

import importlib.util
import re
from collections.abc import Iterator
from pathlib import Path

_VERSIONS = Path(__file__).resolve().parents[2] / "alembic" / "versions"
_P1_PATH = _VERSIONS / "0002_p1_data_model.py"

# The post-0002 migrations construct ALTER TABLE / CREATE INDEX SQL
# via f-strings of the form ``f"ALTER TABLE {SCHEMA}.<table> ..."``.
# We parse the raw source rather than the compiled SQL because the
# guard runs at test-collection time (zero DB, AC-CD15).

_ALTER_TABLE_RE = re.compile(
    r"ALTER\s+TABLE\s+\{SCHEMA\}\.(?P<table>\w+)\s+"
    r"(?P<body>.*?)(?=ALTER\s+TABLE\s+\{SCHEMA\}\.|\Z)",
    re.IGNORECASE | re.DOTALL,
)
_ADD_COLUMN_RE = re.compile(r"\bADD\s+COLUMN\s+(?P<name>\w+)\b", re.IGNORECASE)
_ADD_CONSTRAINT_RE = re.compile(r"\bADD\s+CONSTRAINT\s+(?P<name>\w+)\b", re.IGNORECASE)
_CREATE_INDEX_RE = re.compile(
    r"CREATE\s+INDEX\s+(?P<name>\w+)\s+ON\s+\{SCHEMA\}\.(?P<table>\w+)",
    re.IGNORECASE,
)


def _parse_additions(path: Path) -> Iterator[tuple[str, str, str]]:
    """Yield ``(kind, table, name)`` for every ADD COLUMN / ADD
    CONSTRAINT / CREATE INDEX in *path*'s ``upgrade()`` SQL strings.
    Strips Python ``#`` comments first so commentary cannot fake a
    leak.
    """
    src = path.read_text()
    # Strip Python ``#`` line-tail comments — they sometimes describe
    # the SQL ("# 0003: ...") and should not parse as DDL.
    src_no_comments = "\n".join(line.split("#", 1)[0] for line in src.splitlines())
    # Collapse adjacent string-literal concatenations so a SQL string
    # split across ``"abc " f"def"`` continuation reads as one. The
    # alembic migrations use this pattern (e.g. 0004's CREATE INDEX).
    src_no_comments = re.sub(r'"\s*f?"', "", src_no_comments)
    for m in _ALTER_TABLE_RE.finditer(src_no_comments):
        table = m.group("table")
        body = m.group("body")
        for c in _ADD_COLUMN_RE.finditer(body):
            yield ("column", table, c.group("name"))
        for c in _ADD_CONSTRAINT_RE.finditer(body):
            yield ("constraint", table, c.group("name"))
    for m in _CREATE_INDEX_RE.finditer(src_no_comments):
        yield ("index", m.group("table"), m.group("name"))


def _load_p1_metadata():
    spec = importlib.util.spec_from_file_location("_p1_migration", _P1_PATH)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.metadata


def _p1_has(meta, kind: str, table: str, name: str) -> bool:
    qualified = f"acumen.{table}"
    if qualified not in meta.tables:
        return False
    t = meta.tables[qualified]
    if kind == "column":
        return name in t.c
    if kind == "constraint":
        return any(c.name == name for c in t.constraints)
    if kind == "index":
        return any(i.name == name for i in t.indexes)
    raise ValueError(kind)


def test_post_0002_additions_not_present_in_0002() -> None:
    meta = _load_p1_metadata()
    post_p1 = sorted(p for p in _VERSIONS.glob("000[3-9]*.py") if p.is_file())
    assert post_p1, "no post-0002 migrations found"
    failures: list[str] = []
    for path in post_p1:
        for kind, table, name in _parse_additions(path):
            if _p1_has(meta, kind, table, name):
                failures.append(f"{path.name}: {kind} {table}.{name} already in 0002")
    assert not failures, (
        "post-0002 ADD COLUMN / ADD CONSTRAINT / CREATE INDEX additions "
        "must not pre-exist on the same table in 0002's P1 metadata:\n  "
        + "\n  ".join(failures)
    )


def test_parser_finds_expected_post_p1_names() -> None:
    # Sanity check: the parser actually extracts the names we expect
    # from 0003-0007. If a future refactor changes the SQL phrasing
    # (e.g. ``op.add_column`` over ``op.execute``) and the parser
    # silently stops seeing additions, the guard above degrades to a
    # green no-op — fail loudly here instead.
    seen: set[tuple[str, str, str]] = set()
    for path in sorted(_VERSIONS.glob("000[3-9]*.py")):
        seen.update(_parse_additions(path))
    expected = {
        # 0003: pill safety-override marker
        ("column", "pill", "safety_relevant_overridden_at"),
        # 0004: attempt.assignment_id + its index
        ("column", "attempt", "assignment_id"),
        ("index", "attempt", "ix_attempt_assignment_id"),
        # 0005: attempt retake-counter unique constraint
        ("constraint", "attempt", "uq_attempt_test_testee_sequence"),
        # 0006: drive_chunk AIProvenance columns
        ("column", "drive_chunk", "ai_provider"),
        ("column", "drive_chunk", "ai_model"),
        ("column", "drive_chunk", "ai_prompt_version"),
        ("column", "drive_chunk", "ai_prompt_tokens"),
        ("column", "drive_chunk", "ai_completion_tokens"),
        ("column", "drive_chunk", "ai_cost_usd"),
        # 0007: question.attempt_position + uq + attempt_pause_event.reason
        ("column", "question", "attempt_position"),
        ("constraint", "question", "uq_question_attempt_position"),
        ("column", "attempt_pause_event", "reason"),
    }
    missing = expected - seen
    assert not missing, f"parser missed expected (kind, table, name): {missing}"
