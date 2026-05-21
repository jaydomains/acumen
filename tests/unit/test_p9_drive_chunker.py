"""P9 Slice 1 — Drive RAG chunker invariants (CODE_SPEC §9 / AC-D22).

Pure-function coverage of :func:`app.domain.drive_rag.chunk_document`
and :func:`app.domain.drive_rag.content_hash`. No DB / no network
(AC-CD15). Worked fixtures derived from the CODE_SPEC §9 default
(~500-token / ~2000-character target).
"""

from __future__ import annotations

from app.domain.drive_rag import (
    _CHARS_PER_TOKEN_APPROX,
    _TARGET_CHUNK_TOKENS,
    chunk_document,
    content_hash,
)

_TARGET_CHARS = _TARGET_CHUNK_TOKENS * _CHARS_PER_TOKEN_APPROX  # 2000 at default


def test_chunk_document_empty_input_returns_empty_list() -> None:
    assert chunk_document("") == []
    assert chunk_document("   ") == []
    assert chunk_document("\n\n\t  \n") == []


def test_chunk_document_single_paragraph_under_target_returns_one_chunk() -> None:
    text = "A short paragraph that fits well under the 2000-character target."
    chunks = chunk_document(text)
    assert chunks == [text]


def test_chunk_document_two_short_paragraphs_pack_into_one_chunk() -> None:
    """Two short paragraphs whose combined length is under the target
    pack into a single chunk; the paragraph boundary becomes a single
    space (the ``" ".join(buffer)`` shape)."""
    text = "First short paragraph.\n\nSecond short paragraph."
    chunks = chunk_document(text)
    assert chunks == ["First short paragraph. Second short paragraph."]


def test_chunk_document_splits_at_paragraph_boundary_when_target_exceeded() -> None:
    """Two paragraphs near the target each — the second triggers a flush
    because adding it would push the buffer over target."""
    # Each paragraph ~1200 chars; together they would be ~2400, over the
    # 2000-char target. The flush splits them into two chunks of one
    # paragraph each.
    p1 = "alpha. " * 200  # ~1400 chars
    p2 = "beta. " * 200  # ~1200 chars
    text = f"{p1.strip()}\n\n{p2.strip()}"
    chunks = chunk_document(text)
    assert len(chunks) == 2
    assert "alpha" in chunks[0]
    assert "beta" in chunks[1]


def test_chunk_document_oversize_paragraph_lands_as_one_chunk() -> None:
    """A single paragraph larger than the target degrades to one chunk
    over budget rather than splitting mid-sentence."""
    paragraph = "x" * (_TARGET_CHARS + 500)
    chunks = chunk_document(paragraph)
    assert len(chunks) == 1
    assert len(chunks[0]) == _TARGET_CHARS + 500


def test_chunk_document_oversize_paragraph_flushes_pending_buffer_first() -> None:
    """When an oversize paragraph follows a short pending paragraph,
    the short one flushes first so the oversize lands on its own."""
    short = "Short opener paragraph."
    oversize = "y" * (_TARGET_CHARS + 100)
    text = f"{short}\n\n{oversize}"
    chunks = chunk_document(text)
    assert len(chunks) == 2
    assert chunks[0] == short
    assert chunks[1] == oversize


def test_chunk_document_normalises_internal_whitespace() -> None:
    """Tabs / multi-space runs inside a paragraph collapse so a
    whitespace-only edit doesn't bump the content hash."""
    raw = "Line one with\ttabs\tand   multiple   spaces."
    normalised = "Line one with tabs and multiple spaces."
    assert chunk_document(raw) == [normalised]


def test_chunk_document_is_deterministic() -> None:
    """Same input → same chunks → same hashes. Underpins Slice 2's
    diff-based ingest: a re-run on unchanged content emits zero embed
    calls."""
    text = "para A.\n\npara B.\n\npara C."
    assert chunk_document(text) == chunk_document(text)


def test_chunk_document_respects_custom_target_tokens() -> None:
    """A caller-supplied ``target_tokens`` overrides the default — used
    by Slice 2 to shrink chunks when an ingest hits the cost-budget
    alert."""
    # 10 tokens = 40 chars. Two ~30-char paragraphs each fit, but their
    # combined size of ~60 (with the join space) blows the 40 limit and
    # triggers a flush.
    p1 = "alpha alpha alpha alpha alpha"
    p2 = "beta beta beta beta beta"
    text = f"{p1}\n\n{p2}"
    chunks = chunk_document(text, target_tokens=10)
    assert len(chunks) == 2


def test_content_hash_is_64_hex_chars() -> None:
    """SHA-256 hex digest fits the ``content_hash VARCHAR(64)`` column
    exactly. Underpins the chunk integrity contract."""
    h = content_hash("any text")
    assert len(h) == 64
    assert all(c in "0123456789abcdef" for c in h)


def test_content_hash_is_deterministic_and_input_sensitive() -> None:
    assert content_hash("x") == content_hash("x")
    assert content_hash("x") != content_hash("y")
    # Whitespace edits change the hash — the chunker normalises whitespace
    # inside a paragraph BEFORE hashing each chunk, so a trivial editor
    # edit (tab vs spaces) won't bump the stored hash through the chunker
    # path. But callers hashing raw file text DO see whitespace
    # sensitivity, which is the right semantic for the file-level diff.
    assert content_hash("x ") != content_hash("x")
