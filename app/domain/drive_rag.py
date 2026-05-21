"""Drive RAG — daily diff ingest, chunk + embed, retrieval (AC-D22).

OpenAI ``text-embedding-3-small``, pgvector IVFFlat. CODE_SPEC §9 /
AC-CD9.

Slice 1 ships the **pure functions** the ingest, retrieval, and
realism-feedback paths compose with. The DB-writing wrappers
(``ingest_drive_folder``, ``retrieve_for_generation``,
``record_realism_flag``, ``aggregate_realism_flags``) land in Slices
2-4. Pure-first / wire-up-second mirrors the P8 calibration module's
shape so the math is testable in isolation against worked fixtures
without standing up a session (PR-020 Slice 1 precedent).

Defensive citation from CODE_SPEC §9 verbatim — a future reader can
verify the implementation against the locked spec text without
re-reading the anchor (PR-018 / PR-019 / PR-020 pattern)::

    drive_chunk.embedding is vector(1536) (text-embedding-3-small).
    Default chunk size ~500 tokens (configurable). Daily diff-based
    ingest: hash each Drive file, re-embed only changed/new files,
    drop chunks for deleted files. IVFFlat index (§4). Retrieval
    injects top-k chunks into the generation prompt at test
    generation (SPEC §6.1) and learning-material generation (SPEC
    §6.4). Embedding spend tracked to OpenAI.

Two P9-implementation-defined constants live here, both documented
inline so a future reader knows they are not spec-mandated:

* ``_TARGET_CHUNK_TOKENS = 500`` — the CODE_SPEC §9 default, code
  constant per P8 ``_ANCHORS_PER_ATTEMPT = 2`` precedent; tunable in
  v1.x via a ``system_settings`` column if needed.
* ``_FLAG_RATIO_EXCLUSION_THRESHOLD = 0.6`` — the realism-flag ratio
  at which an anchor question is removed from the pool per AC-D22's
  "high flag count relative to its attempt count" wording. P9-default
  because the spec names no threshold; tunable in v1.x via a
  ``system_settings`` column. Same defensive-deviation pattern as
  PR-018's ``accept_reviewer`` semantic and PR-019's
  ``_WELL_BELOW_DIFFICULTY_THRESHOLD = 0.4``.

The chunker uses a 4-chars-per-token rule-of-thumb approximation
rather than a real tokenizer (e.g. ``tiktoken``). AC-CD1 forbids
unpinned deps and adding a new dep for chunk sizing inflates the
stack for negligible quality gain at v1 corpus scale (~hundreds of
documents). A future v1.x improvement candidate; not a bug.
"""

from __future__ import annotations

import hashlib
import logging
import math
import re
import uuid

logger = logging.getLogger(__name__)


# --- Code constants (P9-default, tunable in v1.x) ---------------------

_TARGET_CHUNK_TOKENS = 500
"""Target chunk size in tokens — CODE_SPEC §9 default. The chunker
splits at paragraph / whitespace boundaries and tries to land near
this size without breaking words; one oversize paragraph degrades to
a single chunk over target (with a log warning) rather than splitting
mid-sentence."""

_FLAG_RATIO_EXCLUSION_THRESHOLD = 0.6
"""Weighted-realism-flag-ratio at which an anchor question is
excluded from the pool per AC-D22's "high flag count relative to its
attempt count" wording. P9-default; tunable in v1.x. Slice 4 reads
this in :func:`aggregate_realism_flags`."""

_CHARS_PER_TOKEN_APPROX = 4
"""Rule-of-thumb: 1 token ≈ 4 characters of English prose. Used by
:func:`chunk_document` to size chunks without a tokenizer dependency
(AC-CD1 minimum-deps). A future v1.x candidate is to add a real
tokenizer."""


# --- Slice 1: pure functions ------------------------------------------


def chunk_document(text: str, *, target_tokens: int = _TARGET_CHUNK_TOKENS) -> list[str]:
    """Split ``text`` into chunks near ``target_tokens`` tokens each
    (≈ ``target_tokens * 4`` characters).

    Splits at paragraph boundaries first (double-newline), then falls
    back to whitespace-greedy packing within each paragraph. A single
    paragraph larger than the target lands as one chunk over budget
    rather than mid-sentence (logged at WARNING for operator
    visibility). Empty / whitespace-only input returns ``[]``.

    Deterministic: same input → same chunks → same content hashes.
    Resume-stable so the diff-ingest in Slice 2 stays idempotent.
    """
    if not text or not text.strip():
        return []
    target_chars = max(1, target_tokens * _CHARS_PER_TOKEN_APPROX)
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    buffer: list[str] = []
    buffer_len = 0
    for paragraph in paragraphs:
        # Normalise internal whitespace inside a paragraph so the chunk
        # hash is stable across trivial whitespace edits (tabs vs
        # spaces, trailing newlines, run-on whitespace from PDF
        # extraction).
        paragraph = re.sub(r"\s+", " ", paragraph)
        paragraph_len = len(paragraph)
        if paragraph_len > target_chars:
            # Flush the pending buffer first so the oversize paragraph
            # lands as its own chunk.
            if buffer:
                chunks.append(" ".join(buffer))
                buffer = []
                buffer_len = 0
            logger.warning(
                "Drive RAG chunker: paragraph length %d chars exceeds "
                "target %d (≈%d tokens). Emitting as a single oversize "
                "chunk rather than splitting mid-sentence.",
                paragraph_len,
                target_chars,
                target_tokens,
            )
            chunks.append(paragraph)
            continue
        # Adding the paragraph would push the buffer over target → flush.
        if buffer and buffer_len + paragraph_len + 1 > target_chars:
            chunks.append(" ".join(buffer))
            buffer = [paragraph]
            buffer_len = paragraph_len
        else:
            if buffer:
                buffer_len += paragraph_len + 1
            else:
                buffer_len = paragraph_len
            buffer.append(paragraph)
    if buffer:
        chunks.append(" ".join(buffer))
    return chunks


def content_hash(text: str) -> str:
    """SHA-256 hex digest of ``text``. The full SHA-256 hex digest is
    exactly 64 chars, matching the ``drive_chunk.content_hash``
    ``VARCHAR(64)`` column. Used by:

    * the file-level diff (was this Drive file content seen before?),
      via the per-document hash that fingerprints the full text
      pulled from Drive, and
    * the chunk-level integrity row, so an operator running an audit
      can verify a stored chunk wasn't corrupted.
    """
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def build_rag_query(
    *,
    pill_name: str,
    pill_description: str | None,
    target_difficulty: int,
) -> str:
    """Compose the retrieval-query text for top-k pgvector search at
    generation time. Per the user-locked decision: pill name +
    description + the explicit difficulty band so the embedding
    captures both subject scope and calibration depth.

    A ``None`` description renders as an empty middle line so the
    layout stays predictable for tests and for the embedding model's
    line-aware tokenizer."""
    description = pill_description or ""
    return f"{pill_name}\n{description}\nDifficulty band {target_difficulty}"


def cosine_top_k(
    query_vec: list[float],
    candidates: list[tuple[uuid.UUID, list[float]]],
    *,
    k: int,
) -> list[uuid.UUID]:
    """Rank ``candidates`` (``(chunk_id, embedding)`` pairs) by cosine
    similarity to ``query_vec``; return the top ``k`` chunk ids.

    Tie-break by chunk id ascending so a stable result is returned for
    deterministic test fixtures (and so resume-replay scenarios in
    Slice 3 stay stable across calls). Returns ``[]`` for ``k <= 0``,
    empty candidates, or a zero-norm query (which would produce NaN
    scores). Candidates with zero-norm embeddings are skipped silently
    rather than crashing the call — defensive against a degenerate
    chunk that somehow embedded to all-zeros.

    The production retrieval path uses pgvector's ``<=>`` operator at
    the SQL layer (IVFFlat index ``ix_drive_chunk_embedding``). This
    Python fallback exists so the AC-CD15 zero-DB fake-harness can
    exercise the retrieval shape end-to-end in tests without standing
    up a real Postgres instance with pgvector.
    """
    if k <= 0 or not candidates:
        return []
    query_norm = math.sqrt(sum(x * x for x in query_vec))
    if query_norm == 0:
        return []
    scored: list[tuple[float, uuid.UUID]] = []
    for chunk_id, vec in candidates:
        if not vec:
            continue
        cand_norm = math.sqrt(sum(x * x for x in vec))
        if cand_norm == 0:
            continue
        dot = sum(a * b for a, b in zip(query_vec, vec, strict=False))
        score = dot / (query_norm * cand_norm)
        scored.append((score, chunk_id))
    # Sort by score descending, then by id ascending for stable
    # tie-break. ``-pair[0]`` works because the score is a float and
    # the secondary key (UUID) sorts naturally.
    scored.sort(key=lambda pair: (-pair[0], pair[1]))
    return [chunk_id for _, chunk_id in scored[:k]]


def compute_testee_realism_weight(submitted_overall_scores: list[float | None]) -> float:
    """Per-Testee weighting factor for realism flags per amended AC-D22
    ("Feedback weight per Testee is scaled by the Testee's overall
    attempt accuracy").

    Hybrid per user-locked decision: mean of the Testee's submitted
    attempts' ``overall_score`` when at least one is non-None; the
    neutral ``0.5`` when no submitted attempts exist. ``None`` values
    are skipped (attempts that submitted but produced no graded
    response, e.g. an empty attempt; rare but possible per AC-D26
    engagement-status). The output is clamped to ``[0.0, 1.0]`` —
    ``overall_score`` already lives in that range by construction, but
    the clamp survives an upstream change without poisoning the
    aggregation downstream.

    Why neutral 0.5: a brand-new Testee with no attempts has no
    accuracy signal yet. Zeroing their weight would silently suppress
    legitimate "this question is unrealistic" feedback from a newly-
    onboarded Testee; weighting at 1.0 would let any drive-by tester
    game the signal. 0.5 lets new feedback count half until they
    accrue an accuracy track record.
    """
    real_scores = [s for s in submitted_overall_scores if s is not None]
    if not real_scores:
        return 0.5
    mean = sum(real_scores) / len(real_scores)
    return max(0.0, min(1.0, mean))


def aggregate_flag_ratio(flag_weight_sum: float, total_serves: int) -> float:
    """Weighted realism-flag ratio for one question: the sum of
    Testee-weight contributions divided by the question's total serve
    count. Returns ``0.0`` for a question never served (avoids
    division-by-zero) and clamps to ``[0.0, 1.0]`` so an over-weighted
    cluster of flags cannot push the ratio past saturation.

    Used by :func:`aggregate_realism_flags` (Slice 4) to decide
    whether an anchor question crosses
    ``_FLAG_RATIO_EXCLUSION_THRESHOLD`` and should leave the pool.
    """
    if total_serves <= 0:
        return 0.0
    ratio = flag_weight_sum / total_serves
    return max(0.0, min(1.0, ratio))
