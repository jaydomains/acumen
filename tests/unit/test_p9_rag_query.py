"""P9 Slice 1 — Drive RAG retrieval-query + cosine top-k math.

Pure-function coverage of :func:`app.domain.drive_rag.build_rag_query`
and :func:`app.domain.drive_rag.cosine_top_k`. No DB / no network
(AC-CD15).
"""

from __future__ import annotations

import uuid

from app.domain.drive_rag import build_rag_query, cosine_top_k

# --- build_rag_query --------------------------------------------------


def test_build_rag_query_includes_all_three_lines() -> None:
    """Per the user-locked decision: pill name + description +
    difficulty band, newline-separated."""
    q = build_rag_query(
        pill_name="Asbestos handling",
        pill_description="Surveying, sampling, and disposal procedures.",
        target_difficulty=6,
    )
    assert q == (
        "Asbestos handling\nSurveying, sampling, and disposal procedures."
        "\nDifficulty band 6"
    )


def test_build_rag_query_none_description_renders_empty_line() -> None:
    """A pill with no description renders an empty middle line — the
    layout shape stays predictable for tests and for the embedding
    model."""
    q = build_rag_query(
        pill_name="Plumbing basics",
        pill_description=None,
        target_difficulty=3,
    )
    assert q == "Plumbing basics\n\nDifficulty band 3"


def test_build_rag_query_empty_description_renders_empty_line() -> None:
    """Empty string and None describe the same shape on output."""
    q = build_rag_query(
        pill_name="Welding",
        pill_description="",
        target_difficulty=5,
    )
    assert q == "Welding\n\nDifficulty band 5"


# --- cosine_top_k -----------------------------------------------------


def _id(n: int) -> uuid.UUID:
    """Build a stable UUID for tie-break ordering tests."""
    return uuid.UUID(f"00000000-0000-0000-0000-{n:012x}")


def test_cosine_top_k_returns_empty_for_zero_k() -> None:
    assert cosine_top_k([1.0, 0.0], [(_id(1), [1.0, 0.0])], k=0) == []


def test_cosine_top_k_returns_empty_for_negative_k() -> None:
    assert cosine_top_k([1.0, 0.0], [(_id(1), [1.0, 0.0])], k=-3) == []


def test_cosine_top_k_returns_empty_for_no_candidates() -> None:
    assert cosine_top_k([1.0, 0.0], [], k=5) == []


def test_cosine_top_k_returns_empty_for_zero_norm_query() -> None:
    """A zero query vector would produce NaN scores via 0/0; defensive
    short-circuit returns empty so the retrieval path stays clean."""
    assert cosine_top_k([0.0, 0.0, 0.0], [(_id(1), [1.0, 0.0, 0.0])], k=3) == []


def test_cosine_top_k_skips_zero_norm_candidates_silently() -> None:
    """A degenerate all-zero embedding (somehow produced) is skipped
    rather than crashing the call. The non-degenerate candidate still
    ranks."""
    query = [1.0, 0.0]
    candidates = [(_id(1), [0.0, 0.0]), (_id(2), [1.0, 0.0])]
    result = cosine_top_k(query, candidates, k=5)
    assert result == [_id(2)]


def test_cosine_top_k_ranks_by_cosine_similarity_descending() -> None:
    """Vector closest in direction to the query ranks first."""
    query = [1.0, 0.0]
    candidates = [
        (_id(1), [0.0, 1.0]),  # orthogonal, score 0
        (_id(2), [1.0, 0.0]),  # parallel, score 1
        (_id(3), [0.5, 0.5]),  # 45°, score ~0.707
    ]
    result = cosine_top_k(query, candidates, k=3)
    assert result == [_id(2), _id(3), _id(1)]


def test_cosine_top_k_tie_breaks_by_id_ascending() -> None:
    """Two equally-scored candidates sort by chunk id ascending so the
    output is deterministic for resume-replay (Slice 3)."""
    query = [1.0, 0.0]
    candidates = [
        (_id(5), [1.0, 0.0]),
        (_id(2), [1.0, 0.0]),
        (_id(7), [1.0, 0.0]),
    ]
    result = cosine_top_k(query, candidates, k=3)
    assert result == [_id(2), _id(5), _id(7)]


def test_cosine_top_k_caps_at_k_when_more_candidates_available() -> None:
    """k=2 returns 2 even if 5 candidates exist."""
    query = [1.0, 0.0]
    candidates = [(_id(i), [1.0, 0.0]) for i in range(5)]
    result = cosine_top_k(query, candidates, k=2)
    assert len(result) == 2


def test_cosine_top_k_returns_all_when_k_exceeds_candidates() -> None:
    """k=10 against 2 candidates returns 2."""
    query = [1.0, 0.0]
    candidates = [(_id(1), [1.0, 0.0]), (_id(2), [0.5, 0.5])]
    result = cosine_top_k(query, candidates, k=10)
    assert len(result) == 2
