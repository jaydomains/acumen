"""P9 Slice 2 — Drive ingest diff math (AC-D22).

Pure-function coverage of :func:`app.domain.drive_rag.diff_files`. No
DB / no network (AC-CD15). The four-set output (added / changed /
unchanged / deleted) is the contract :func:`ingest_drive_folder`
composes against — exercise the boundary conditions exhaustively
before wiring them into the DB-writing path.
"""

from __future__ import annotations

from app.domain.drive_rag import diff_files
from app.domain.drive_source import DriveFile


def _file(file_id: str, *, name: str = "doc.txt") -> DriveFile:
    return DriveFile(
        id=file_id,
        name=name,
        mime_type="text/plain",
        modified_time="2026-05-21T00:00:00Z",
    )


def test_empty_drive_empty_existing_returns_empty_diff() -> None:
    """No files in Drive, no chunks in index → every set is empty."""
    diff = diff_files([], {})
    assert diff.added == []
    assert diff.changed == []
    assert diff.unchanged == []
    assert diff.deleted == []


def test_new_file_lands_in_added() -> None:
    """A file present in Drive but not in the existing index → added."""
    f = _file("f1")
    diff = diff_files([(f, "hash1")], {})
    assert diff.added == [f]
    assert diff.changed == []
    assert diff.unchanged == []
    assert diff.deleted == []


def test_unchanged_hash_lands_in_unchanged() -> None:
    """A Drive file whose hash matches the existing index → unchanged
    (no embed call). Underpins the AC-D22 "re-embed only changed/new
    files" guarantee."""
    f = _file("f1")
    diff = diff_files([(f, "hash1")], {"f1": "hash1"})
    assert diff.added == []
    assert diff.changed == []
    assert diff.unchanged == [f]
    assert diff.deleted == []


def test_hash_mismatch_lands_in_changed() -> None:
    """A Drive file whose hash differs from the existing index →
    changed. The ingest sweep will delete the previous chunks and
    re-embed."""
    f = _file("f1")
    diff = diff_files([(f, "new-hash")], {"f1": "old-hash"})
    assert diff.added == []
    assert diff.changed == [f]
    assert diff.unchanged == []
    assert diff.deleted == []


def test_missing_from_drive_lands_in_deleted() -> None:
    """A file id in the existing index that's no longer in Drive →
    deleted. The ingest sweep will drop every chunk row with that
    ``source_doc_ref``."""
    diff = diff_files([], {"f1": "hash1"})
    assert diff.added == []
    assert diff.changed == []
    assert diff.unchanged == []
    assert diff.deleted == ["f1"]


def test_mixed_diff_partitions_correctly() -> None:
    """A realistic mixed scenario: one new, one unchanged, one
    changed, one deleted. The four sets are mutually exclusive."""
    added_file = _file("new")
    unchanged_file = _file("same")
    changed_file = _file("modified")
    drive = [
        (added_file, "new-hash"),
        (unchanged_file, "same-hash"),
        (changed_file, "new-content"),
    ]
    existing = {
        "same": "same-hash",
        "modified": "old-content",
        "gone": "gone-hash",
    }
    diff = diff_files(drive, existing)
    assert diff.added == [added_file]
    assert diff.changed == [changed_file]
    assert diff.unchanged == [unchanged_file]
    assert diff.deleted == ["gone"]
