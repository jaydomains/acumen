"""Corpus-grounded autonomous generation + per-assertion provenance.

Slice B2 (AC-D29 / §6.8): the B1 ``pill_generation`` primitive learns to
**ground**. ``generate_grounded_drafts`` retrieves reference-corpus context for
a topic (A3's ``retrieve_corpus_for_topic``), grounds the ``pill_generation``
call (v1.1.0) in it, and writes a **per-assertion provenance chain** — one
``GenerationProvenance`` row per (assertion, grounding-chunk), the relational
store the E2 per-source rollback queries by ``source_host`` (claim-precise
retraction, ruling 5; per-assertion ratified Option-1, this conversation
2026-06-12).

Scope (B2/B3 split): B2 owns the grounded-generation fn + the provenance
model/writer. **B3** owns the N-draft fan-out, the ``ProcessingTask`` N-row
persistence, and cost-share (``record_provenance_share``) — it reuses this fn's
output (the drafts + the ``AIResult``).
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.provider import AIResult, Operation, resolve_provider
from app.domain.corpus_builder import retrieve_corpus_for_topic
from app.models import (
    SEED_TENANT_ID,
    GenerationProvenance,
    ProcessingTask,
    ProcessingTaskStatus,
)

logger = logging.getLogger(__name__)

_DEFAULT_TARGET_COUNT = 3

# AC-CD7 ``ProcessingTask`` carrier for the N generated draft rows — distinct
# from the ``pill_proposal`` refiner's task name (one publication path, two
# origins; B3's fan-out vs the manual refiner). The cost dashboard's
# ``_pill_generation_spend`` aggregator keys on this name.
GENERATION_TASK_NAME = "pill_generation"


def _render_corpus_context(hits: list[dict[str, Any]]) -> str:
    """Render retrieved corpus hits as authority-tagged prompt context (ruling
    3 — the model sees each source's tier/score to weight grounding). Empty →
    ``(none)`` so the template's "may be empty" branch reads cleanly (mirrors
    ``drive_rag.render_rag_context``)."""
    if not hits:
        return "(none)"
    return "\n".join(
        f"- [{hit['source_doc_ref']}] (T{hit['authority_tier']}, "
        f"{float(hit['authority_score']):.2f}): {hit['chunk_text']}"
        for hit in hits
    )


@dataclass(frozen=True)
class GroundedGenerationResult:
    """B2 output: the drafts (each annotated with its minted ``draft_ref`` +
    structured ``grounding_refs``) and the ``AIResult`` (so the B3 fan-out can
    split the generation call's cost across the N drafts)."""

    drafts: list[dict[str, Any]]
    ai_result: AIResult


async def generate_grounded_drafts(
    db: AsyncSession,
    *,
    topic: str,
    target_count: int = _DEFAULT_TARGET_COUNT,
    batch_id: str | None = None,
) -> GroundedGenerationResult:
    """Generate N corpus-grounded pill drafts for ``topic`` and write the
    per-assertion provenance chain (AC-D29 / §6.8). The caller commits.

    Retrieves the reference corpus (A3), grounds the ``pill_generation`` call
    (v1.1.0) in it, and for each draft's structured ``grounding_refs``
    (``{claim, source_doc_refs}``) writes one ``GenerationProvenance`` row per
    (assertion, grounding-chunk), stamped with the chunk's authority tier/score
    (AC-D28). An **empty corpus** → general-knowledge fallback: the prompt
    renders ``(none)``, drafts emit empty ``grounding_refs`` → no provenance
    rows. Returns the drafts (each with a minted ``draft_ref``) + the
    ``AIResult``.

    ``batch_id`` is the **B3→B2 seam** (AC-D29: *"the shared ``batch_id``
    stamped by the B3 fan-out"*): the B3 ``enqueue_generated_drafts`` fan-out
    passes its per-run batch id so every provenance row carries it, and E2's
    per-batch rollback resolves. ``None`` (a direct B2 call) leaves the column
    null. Single-call only here — the N-draft persistence + cost-share is B3.
    """
    hits = await retrieve_corpus_for_topic(db, topic=topic)
    # Map each available source_doc_ref → its retrieved chunk hits (one doc may
    # contribute several chunks → several grounding-chunk rows per assertion).
    hits_by_ref: dict[str, list[dict[str, Any]]] = {}
    for hit in hits:
        hits_by_ref.setdefault(str(hit["source_doc_ref"]), []).append(hit)

    provider = resolve_provider(Operation.pill_generation)
    result = await provider.generate(
        Operation.pill_generation,
        {
            "topic": topic,
            "target_count": target_count,
            "subject_id": None,
            "available_difficulty_min": 1,
            "available_difficulty_max": 10,
            "corpus_context": _render_corpus_context(hits),
            "corpus_refs": list(hits_by_ref.keys()),
        },
    )

    drafts: list[dict[str, Any]] = list(result.content.get("drafts", []))
    for draft in drafts:
        draft_ref = str(uuid.uuid4())
        draft["draft_ref"] = draft_ref
        grounding_refs = draft.get("grounding_refs", [])
        rows_written = 0
        for claim_index, claim in enumerate(grounding_refs):
            claim_ref = f"{draft_ref}:{claim_index}"
            # De-dupe the claim's refs (LLM output is not guaranteed unique;
            # a repeated source_doc_ref must not inflate the per-source
            # rollback row count E2 relies on — Gitar B2-2). One doc still
            # legitimately fans out to its several grounding chunks below.
            for source_doc_ref in dict.fromkeys(claim.get("source_doc_refs", [])):
                for hit in hits_by_ref.get(str(source_doc_ref), []):
                    db.add(
                        GenerationProvenance(
                            tenant_id=SEED_TENANT_ID,
                            draft_ref=draft_ref,
                            claim_ref=claim_ref,
                            corpus_chunk_id=uuid.UUID(str(hit["corpus_chunk_id"])),
                            source_host=str(hit["source_host"]),
                            authority_tier=int(str(hit["authority_tier"])),
                            authority_score=float(str(hit["authority_score"])),
                            batch_id=batch_id,
                        )
                    )
                    rows_written += 1
        # Observability for the silent grounding-mismatch (Gitar B2-1): a draft
        # that claimed to ground (non-empty grounding_refs) but whose refs
        # byte-matched no retrieved hit (trailing slash / fragment / paraphrase)
        # records zero provenance rows — it would look ungrounded to the E2
        # per-source rollback. WARN so the mismatch is observable, not invisible.
        if grounding_refs and rows_written == 0:
            logger.warning(
                "grounded generation: draft %s emitted %d grounding_refs but "
                "produced 0 provenance rows — no ref byte-matched a retrieved "
                "corpus hit (grounding-mismatch)",
                draft_ref,
                len(grounding_refs),
            )
    return GroundedGenerationResult(drafts=drafts, ai_result=result)


async def _pending_batch_for(
    db: AsyncSession, *, topic: str, gap_signal: str | None
) -> list[ProcessingTask]:
    """The B3 persistence-layer half of the 3-arm dedup (§6.2d): the
    already-pending ``pill_generation`` draft rows for this exact
    ``(topic, gap_signal)``. Non-empty → a batch for this gap is already
    awaiting the C auto-publish gate, so a re-trigger must not duplicate it.
    (D-stage gap-detection owns the signal-layer arm.) Iterates in Python to
    match the cost-aggregator harness shape (no JSONB SQL in the fake)."""
    rows = await db.execute(
        select(ProcessingTask).where(ProcessingTask.tenant_id == SEED_TENANT_ID)
    )
    return [
        r
        for r in rows.scalars().all()
        if r.task_name == GENERATION_TASK_NAME
        and r.status == ProcessingTaskStatus.pending
        and (r.payload or {}).get("topic") == topic
        and (r.payload or {}).get("gap_signal") == gap_signal
    ]


async def enqueue_generated_drafts(
    db: AsyncSession,
    *,
    topic: str,
    target_count: int = _DEFAULT_TARGET_COUNT,
    batch_id: str | None = None,
    gap_signal: str | None = None,
) -> list[ProcessingTask]:
    """Fan one grounded-generation call out into **N persisted candidate draft
    rows** (AC-D29 / §6.8 / AC-CD7) — the B3 deliverable. The caller commits.

    Mints (or accepts) a generation ``batch_id``, writes the per-assertion
    provenance chain stamped with it (via B2's ``generate_grounded_drafts``),
    and persists each draft as a ``pending`` ``ProcessingTask``
    (``task_name="pill_generation"``) whose ``payload`` carries the draft, the
    shared ``batch_id``, the ``gap_signal``, and the draft's **1/N cost share**
    of the single generation call (``record_provenance_share`` semantics —
    summing the N shares reconstructs the call cost, AC-CD8). Each row is a
    candidate awaiting the **autonomous** auto-publish gate (C1–C2), not a human
    approve queue. **Idempotent** on ``(topic, gap_signal)`` for pending rows
    (§6.2d). Returns the N (or pre-existing) ``ProcessingTask`` rows.

    Scope (B3): fan-out + persistence + cost-share + ``batch_id``. NOT here:
    self-review / confidence / publish / ``Pill`` creation (C1–C2 consume these
    rows); the gap-detection trigger that calls this (D3); the E2 rollback that
    queries the ``batch_id`` + provenance.
    """
    existing = await _pending_batch_for(db, topic=topic, gap_signal=gap_signal)
    if existing:
        return existing

    batch_id = batch_id or str(uuid.uuid4())
    generated = await generate_grounded_drafts(
        db, topic=topic, target_count=target_count, batch_id=batch_id
    )
    drafts = generated.drafts
    ai = generated.ai_result
    # 1/N cost-share of the single generation call (mirrors
    # ``record_provenance_share``: tokens floor-divide, cost divides evenly,
    # the sub-N remainder dropped). ``share_count`` floors at 1 so an
    # empty-draft return can't divide by zero.
    share_count = max(len(drafts), 1)
    provenance_share = {
        "provider": ai.provider,
        "model": ai.model,
        "prompt_version": ai.prompt_version,
        "prompt_tokens": ai.prompt_tokens // share_count,
        "completion_tokens": ai.completion_tokens // share_count,
        "cost_share": ai.cost_usd / share_count,
    }

    tasks: list[ProcessingTask] = []
    for draft in drafts:
        task = ProcessingTask(
            tenant_id=SEED_TENANT_ID,
            task_name=GENERATION_TASK_NAME,
            status=ProcessingTaskStatus.pending,
            payload={
                "topic": topic,
                "batch_id": batch_id,
                "gap_signal": gap_signal,
                "draft": draft,
                "provenance": provenance_share,
            },
        )
        db.add(task)
        tasks.append(task)
    await db.flush()
    return tasks
