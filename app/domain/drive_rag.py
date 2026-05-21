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
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.cost import maybe_fire_budget_alert, record_provenance
from app.ai.provider import Operation, resolve_provider
from app.domain.drive_source import DriveFile, DriveSource, get_drive_source
from app.models import SEED_TENANT_ID, DriveChunk, SystemSettings
from app.permissions import APIError, now_utc

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
        # ``strict=True`` so a dimension mismatch between the query
        # embedding and a stored chunk (e.g. a 1536-dim query against a
        # 768-dim legacy chunk after a model change) raises loudly
        # rather than silently truncating to the shorter prefix and
        # producing wrong similarity scores. The test harness sees the
        # bug; production uses pgvector's ``<=>`` operator where dim
        # mismatch is a SQL error (Gitar PR-#21 Slice 1 finding #1).
        dot = sum(a * b for a, b in zip(query_vec, vec, strict=True))
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


# --- Slice 2: Drive ingest pipeline (diff-based) ---------------------


@dataclass(frozen=True)
class DiffSets:
    """Result of comparing the current Drive folder snapshot against
    the existing :class:`DriveChunk` index. Per AC-D22 "hash each Drive
    file, re-embed only changed/new files, drop chunks for deleted
    files" — the four sets cover every transition.

    Sets carry the Drive file id (not the chunk row id) because the
    diff operates per-file; the chunk-level operations
    (delete-by-source_doc_ref / re-embed) cascade from the file id."""

    added: list[DriveFile]
    changed: list[DriveFile]
    unchanged: list[DriveFile]
    deleted: list[str]


def diff_files(
    drive: list[tuple[DriveFile, str]],
    existing_hashes_by_source: dict[str, str],
) -> DiffSets:
    """Split the current Drive snapshot into four buckets relative to
    the existing :class:`DriveChunk` index.

    ``drive`` is a list of ``(DriveFile, content_hash)`` tuples — the
    caller fetches each file's text once and hashes it via
    :func:`content_hash` so the diff and the ingest path see the same
    hash (a future bug where the hash drifted between the diff and the
    persist call would otherwise re-embed unchanged files silently).

    ``existing_hashes_by_source`` maps ``source_doc_ref`` (i.e. the
    Drive file id) to its current chunk-level content hash. Computed
    once at the top of :func:`ingest_drive_folder` from the existing
    :class:`DriveChunk` rows (any chunk for the file id carries the
    same file-level hash by construction; the diff uses one
    representative chunk's hash per file).

    Deleted files: ids present in the existing index but not in
    ``drive``. The caller will delete every chunk row with that
    ``source_doc_ref``.
    """
    drive_by_id = {df.id: (df, h) for df, h in drive}
    added: list[DriveFile] = []
    changed: list[DriveFile] = []
    unchanged: list[DriveFile] = []
    for file_id, (df, h) in drive_by_id.items():
        prev = existing_hashes_by_source.get(file_id)
        if prev is None:
            added.append(df)
        elif prev != h:
            changed.append(df)
        else:
            unchanged.append(df)
    deleted = [
        file_id for file_id in existing_hashes_by_source if file_id not in drive_by_id
    ]
    return DiffSets(added=added, changed=changed, unchanged=unchanged, deleted=deleted)


async def _existing_hashes_by_source(db: AsyncSession) -> dict[str, str]:
    """One :class:`DriveChunk` per ``source_doc_ref`` is enough to
    fingerprint the file (every chunk for the same file carries the
    file-level hash by construction in :func:`ingest_drive_folder`).
    Tenant-scoped, equality-only WHERE per AC-CD15."""
    result = await db.execute(
        select(DriveChunk).where(DriveChunk.tenant_id == SEED_TENANT_ID)
    )
    by_source: dict[str, str] = {}
    for chunk in result.scalars().all():
        # First-seen wins — the per-file hash is invariant across the
        # chunks we wrote for that file.
        by_source.setdefault(chunk.source_doc_ref, chunk.content_hash)
    return by_source


async def _delete_chunks_for_source(db: AsyncSession, source_doc_ref: str) -> int:
    """Delete every :class:`DriveChunk` row for ``source_doc_ref``.
    Both equality conditions land in the WHERE so the DB filters
    rather than Python — important because :func:`ingest_drive_folder`
    calls this once per changed / deleted file, and a folder with N
    files would otherwise load all N×chunks_per_file rows on every
    deletion (Gitar PR-#21 Slice 2 finding #2). The
    :class:`CatalogueFakeSession` harness already supports
    multi-condition equality WHEREs — the only fake-harness limit is
    ``Column == True/False`` boolean filters (PR-#20 Slice 4
    finding), which this query avoids."""
    result = await db.execute(
        select(DriveChunk).where(
            DriveChunk.tenant_id == SEED_TENANT_ID,
            DriveChunk.source_doc_ref == source_doc_ref,
        )
    )
    deleted = 0
    for chunk in result.scalars().all():
        await db.delete(chunk)
        deleted += 1
    return deleted


async def _persist_chunks_for_file(
    db: AsyncSession,
    *,
    file_id: str,
    text: str,
    file_hash: str,
) -> int:
    """Chunk ``text``, embed each chunk via the resolved OpenAI provider,
    and write one :class:`DriveChunk` row per chunk with full
    :class:`AIProvenanceMixin` provenance. Returns the count of chunks
    added.

    Every chunk row carries the same file-level ``content_hash`` so
    the diff can read it back from any chunk. The embedding call goes
    through :func:`app.ai.provider.resolve_provider` — production
    routes to OpenAI by coded default per AC-CD8 v1.6; tests via
    ``RecordingProvider`` see the same call shape with a deterministic
    1536-dim zero vector.
    """
    chunks = chunk_document(text)
    if not chunks:
        return 0
    provider = resolve_provider(Operation.embed)
    added = 0
    for idx, chunk_text in enumerate(chunks):
        embed_result = await provider.embed(Operation.embed, chunk_text)
        row = DriveChunk(
            tenant_id=SEED_TENANT_ID,
            source_doc_ref=file_id,
            chunk_index=idx,
            chunk_text=chunk_text,
            content_hash=file_hash,
            embedding=embed_result.embedding,
            indexed_at=now_utc(),
        )
        record_provenance(row, embed_result)
        db.add(row)
        added += 1
    return added


async def ingest_drive_folder(
    db: AsyncSession,
    *,
    drive_source: DriveSource | None = None,
) -> dict[str, Any]:
    """Daily diff ingest (AC-D22). Admin-triggered at P9; beat-scheduled
    at P11.

    Algorithm (CODE_SPEC §9 verbatim):

    1. Pull the current folder snapshot from Drive
       (:meth:`DriveSource.list_files`).
    2. For each file, fetch its text and hash it once
       (``content_hash``). Per-file failures are isolated — one
       unreadable file logs at WARNING and bumps the
       ``files_failed`` counter without aborting the sweep
       (PR-019 Slice 2 isolation pattern).
    3. Compare against the existing index via :func:`diff_files`.
    4. For each ``added`` / ``changed`` file: chunk → embed each chunk
       → persist with provenance. ``changed`` first deletes the
       previous chunk rows so the diff stays consistent.
    5. For each ``deleted`` file: drop every chunk row with that
       ``source_doc_ref``.
    6. Post-sweep: invoke :func:`maybe_fire_budget_alert` — the embed
       spend may have crossed a threshold (AC-D18 v1.1 alerts at
       50/80/100 %).

    Returns telemetry: ``files_seen``, ``files_unchanged``,
    ``files_added``, ``files_changed``, ``files_deleted``,
    ``files_failed``, ``chunks_added``, ``chunks_deleted``,
    ``embed_calls``.

    Raises :class:`APIError` (409 ``drive_folder_unconfigured``) if no
    Drive folder id has been configured in ``system_settings`` — an
    admin operator visibility cue that the deployment hasn't completed
    AC-D23 step 4 (initial folder bootstrap).

    **HTTP timeout warning** mirroring PR-020 Slice 2 finding #2: a
    folder with hundreds of files emits hundreds of sequential
    embed calls. The admin endpoint trigger is for dev / manual
    operator action; production at fleet scale runs through the
    P11 Celery beat task (same callable, wrapped). Workaround
    until P11: trim the folder, or bump the reverse-proxy timeout
    temporarily.
    """
    settings_row = (
        await db.execute(
            select(SystemSettings).where(SystemSettings.tenant_id == SEED_TENANT_ID)
        )
    ).scalar_one_or_none()
    folder_id = settings_row.drive_folder_id if settings_row is not None else None
    if not folder_id:
        raise APIError(
            409,
            "drive_folder_unconfigured",
            "System settings have no `drive_folder_id`; set it before "
            "running Drive ingest (AC-D22 / AC-D23 step 4).",
        )

    source = drive_source if drive_source is not None else get_drive_source()
    files = await source.list_files(folder_id=folder_id)

    # Phase 1: fetch + hash every file once. Per-file failures are
    # isolated so one bad file (revoked permission, Drive transient
    # 404, mid-flight rename) doesn't poison the whole sweep.
    drive_pairs: list[tuple[DriveFile, str]] = []
    files_failed = 0
    file_texts: dict[str, str] = {}
    for df in files:
        try:
            text = await source.fetch_text(file_id=df.id, mime_type=df.mime_type)
        except Exception:  # pragma: no cover - exercised in tests via fake
            logger.exception(
                "Drive ingest: failed to fetch text for file %s (%s); "
                "skipping but continuing the sweep",
                df.id,
                df.name,
            )
            files_failed += 1
            continue
        file_hash = content_hash(text)
        drive_pairs.append((df, file_hash))
        file_texts[df.id] = text

    existing = await _existing_hashes_by_source(db)
    diff = diff_files(drive_pairs, existing)

    # Pre-build the file_id → hash lookup so per-file persistence is
    # O(1) rather than the previous O(n) scan over ``drive_pairs``
    # (Gitar PR-#21 Slice 2 finding #3 — without the dict a folder
    # with N files would do O(N²) work in the persist loop).
    hash_by_file_id = {df.id: h for df, h in drive_pairs}

    chunks_added = 0
    chunks_deleted = 0

    # Phase 2: persist changed files (delete then re-embed) + added
    # files (embed). The order matters: changed files must drop their
    # previous chunks BEFORE the new chunks land so a partial failure
    # doesn't leave a mixed-version chunk set.
    for df in diff.changed:
        chunks_deleted += await _delete_chunks_for_source(db, df.id)
        chunks_added += await _persist_chunks_for_file(
            db,
            file_id=df.id,
            text=file_texts[df.id],
            file_hash=hash_by_file_id[df.id],
        )
    for df in diff.added:
        chunks_added += await _persist_chunks_for_file(
            db,
            file_id=df.id,
            text=file_texts[df.id],
            file_hash=hash_by_file_id[df.id],
        )

    # Phase 3: drop chunks for files that vanished from the folder.
    for file_id in diff.deleted:
        chunks_deleted += await _delete_chunks_for_source(db, file_id)

    await db.flush()

    # AC-D18 v1.1: a large embed spend may have crossed the budget
    # threshold this sweep — post-call alert check, fail-soft.
    await maybe_fire_budget_alert(db, tenant_id=SEED_TENANT_ID)

    return {
        "files_seen": len(files),
        "files_unchanged": len(diff.unchanged),
        "files_added": len(diff.added),
        "files_changed": len(diff.changed),
        "files_deleted": len(diff.deleted),
        "files_failed": files_failed,
        "chunks_added": chunks_added,
        "chunks_deleted": chunks_deleted,
        # One embed call per chunk added; the unchanged path issues
        # zero embed calls (the diff skips them).
        "embed_calls": chunks_added,
    }


# --- Slice 3: RAG retrieval at generation time -----------------------

_DEFAULT_TOP_K = 5
"""Default top-k for retrieval — small enough to keep prompt size
bounded (5 chunks ≈ 2500 tokens of context), large enough to cover
the realistic-question span for one pill+band. Tunable per call via
the ``k`` parameter; production calls accept the default."""


def render_rag_context(hits: list[dict[str, Any]]) -> str:
    """Render the top-k chunk hits as a prompt-ready string. Empty
    list renders as ``(none)`` so :meth:`str.format` doesn't substitute
    an empty string into the prompt template (which would leave the
    "Relevant KBC reference material" header dangling and confuse the
    model). Each chunk renders as ``- [source_doc_ref]: chunk_text``
    so the model can attribute facts back to a specific source if
    needed."""
    if not hits:
        return "(none)"
    return "\n".join(f"- [{hit['source_doc_ref']}]: {hit['chunk_text']}" for hit in hits)


async def _record_rag_retrieve_audit(
    db: AsyncSession,
    *,
    pill_id: uuid.UUID | None,
    target_difficulty: int,
    embed_result: Any,
    hits_returned: int,
    top_k: int,
) -> None:
    """Stamp one ``rag.retrieve`` audit row carrying the query-side
    embed call's per-call cost + provenance metadata. The query-side
    embed has no persisted entity to own its provenance (the chunks
    are the index, not the query side), so the audit log carries it
    instead. :func:`app.ai.cost.current_month_spend` folds these rows
    in via the :func:`_rag_retrieve_spend` helper so embed spend
    appears in the cost dashboard alongside the ingest-side spend
    (preserves the AC-CD8 v1.6 per-op provenance contract for a
    transient AI call that owns no entity).
    """
    from app.domain.catalogue import record_audit

    detail = {
        "provider": getattr(embed_result, "provider", None),
        "model": getattr(embed_result, "model", None),
        "prompt_tokens": getattr(embed_result, "prompt_tokens", 0),
        "cost_usd": getattr(embed_result, "cost_usd", 0.0),
        "top_k": top_k,
        "hits_returned": hits_returned,
        "pill_id": str(pill_id) if pill_id is not None else None,
        "target_difficulty": target_difficulty,
    }
    # actor_id=None: the retrieve fires inside a generation call,
    # whose authenticated actor is the testee; tying the audit row to
    # them would inflate per-testee event noise. The system-level
    # action belongs to no actor — same as ``budget_alert.fired``.
    await record_audit(
        db,
        actor_id=None,
        action="rag.retrieve",
        target_entity="drive_chunk",
        # No single chunk owns the retrieve — use a stable zero UUID
        # so the column-non-null contract is honoured without
        # implying ownership. (AuditLog.target_id is non-null per
        # P1 schema; the audit log itself is append-only by AC-CD7
        # so a stable sentinel is fine.)
        target_id=uuid.UUID("00000000-0000-0000-0000-000000000000"),
        detail=detail,
    )


async def retrieve_for_generation(
    db: AsyncSession,
    *,
    pill: Any | None,
    target_difficulty: int,
    k: int = _DEFAULT_TOP_K,
) -> list[dict[str, Any]]:
    """Return top-k Drive chunks for a generation call. Embeds the
    query (pill name + description + difficulty band per
    :func:`build_rag_query`), runs cosine top-k against the
    :class:`DriveChunk` index, returns
    ``[{source_doc_ref, chunk_text}, ...]`` for the generation
    payload's ``rag_context`` key.

    Fail-soft per SPEC §6.1 ("Drive RAG fetch failures: generation
    continues without RAG context; logged for review") — any
    exception in the embed call or the retrieval path returns an
    empty list rather than raising. The generation call still
    proceeds with the empty context.

    Empty conditions:
    * ``pill is None`` (learning-path assignment with no single-pill
      scope) → ``[]``, no embed call fired
    * Empty :class:`DriveChunk` index → ``[]``, one embed call fired
      (the cost is still stamped via audit log for the cost
      dashboard's per-month spend roll-up; this is the v1
      operational trace of "did the retrieve run at all")
    * Embed call raises → ``[]``, logged at WARNING, no audit row

    The query-side embed cost is captured via an ``AuditLog`` row
    with ``action="rag.retrieve"`` because the embed has no
    persisted entity to own its provenance (unlike ingest, where the
    :class:`DriveChunk` row carries the per-chunk embed cost). The
    cost dashboard's :func:`app.ai.cost._rag_retrieve_spend` helper
    folds these audit rows into the monthly aggregate so the AC-CD8
    v1.6 sum-to-call-total invariant holds for both the ingest side
    and the retrieve side.
    """
    if pill is None:
        return []

    query_text = build_rag_query(
        pill_name=getattr(pill, "name", ""),
        pill_description=getattr(pill, "description", None),
        target_difficulty=target_difficulty,
    )

    provider = resolve_provider(Operation.embed)
    try:
        embed_result = await provider.embed(Operation.embed, query_text)
    except Exception:
        logger.warning(
            "Drive RAG: query-side embed failed for pill=%s band=%d; "
            "generation will proceed with empty rag_context",
            getattr(pill, "id", "<unknown>"),
            target_difficulty,
            exc_info=True,
        )
        return []

    # Load the tenant's chunk index (tenant-scoped equality WHERE per
    # AC-CD15). At v1 corpus size (~hundreds of chunks) the in-Python
    # cosine ranking is fine; the production path may swap to pgvector
    # ``<=>`` at the SQL layer post-v1 if the corpus grows past tens of
    # thousands of chunks.
    chunks_result = await db.execute(
        select(DriveChunk).where(DriveChunk.tenant_id == SEED_TENANT_ID)
    )
    chunks = list(chunks_result.scalars().all())

    pill_id = getattr(pill, "id", None)
    if not chunks:
        # Stamp the audit row for the spend trace even though the
        # retrieve returned zero hits — the embed call DID fire.
        await _record_rag_retrieve_audit(
            db,
            pill_id=pill_id,
            target_difficulty=target_difficulty,
            embed_result=embed_result,
            hits_returned=0,
            top_k=k,
        )
        return []

    candidates = [(c.id, c.embedding) for c in chunks]
    top_ids = cosine_top_k(embed_result.embedding, candidates, k=k)
    chunks_by_id = {c.id: c for c in chunks}
    hits = [
        {
            "source_doc_ref": chunks_by_id[cid].source_doc_ref,
            "chunk_text": chunks_by_id[cid].chunk_text,
        }
        for cid in top_ids
        if cid in chunks_by_id
    ]

    await _record_rag_retrieve_audit(
        db,
        pill_id=pill_id,
        target_difficulty=target_difficulty,
        embed_result=embed_result,
        hits_returned=len(hits),
        top_k=k,
    )
    return hits
