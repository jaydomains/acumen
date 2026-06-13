"""Autonomous bootstrap — idempotent anchor/link/index population (AC-D23).

P11 / AC-D23. One operator command pre-populates calibration scaffolding
and content before the first Testee touches the system. The run
executes in four steps per AC-D23::

  1. For every active pill, top-up the anchor question pool per
     supported band (AC-D20). Existing live anchors are not touched;
     only the deficit is generated. Each new anchor passes through
     AI self-review (AC-D19 cross-family pattern) inline.

  2. Self-review is integrated into step 1 — no separate sweep.

  3. For every safety-tagged pill, ensure the curated external
     link set per AC-D21 is at quota. Calls into
     :func:`~app.domain.safety_links.curate_links_for_pill`.

  4. Embed and index whatever documents are present in the
     designated Drive folder per AC-D22. Calls into
     :func:`~app.domain.drive_rag.ingest_drive_folder`. Skipped
     when ``system_settings.drive_folder_id`` is unset — surfaces
     in the operator's telemetry rather than crashing.

**Idempotency contract (AC-CD7).** Re-running on an already-populated
deployment returns near-zero counters: anchor top-up's quota gate
short-circuits, link curation skips pills at quota + dedupes URLs,
Drive ingest's content_hash diff yields zero changes. A re-run after
adding one pill increments only the affected pill's counters.

The orchestrator is admin-triggered (``POST /v1/admin/bootstrap/run``);
it is NOT in the beat schedule per AC-CD7 ("idempotent enqueued job").
At v1 scale (≤30 pills, ≤30 safety-tagged) the synchronous admin
endpoint is acceptable; the Celery task wrapper (one off-cron task)
is the production path for large datasets.
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.calibration import generate_anchor_pool_for_pill
from app.domain.catalogue import record_audit
from app.domain.drive_rag import ingest_drive_folder
from app.domain.safety_links import curate_links_for_pill
from app.models import SEED_TENANT_ID, Pill, ProcessingTask, ProcessingTaskStatus
from app.permissions import APIError, now_utc

logger = logging.getLogger(__name__)

# F1 (AC-D7/AC-D23, bootstrap-on-publish): the per-pill incremental bootstrap is
# enqueued on auto-publish as a ``ProcessingTask`` of this name (the codebase's
# async pattern — `pill_proposal` / `pill_generation` use the same row-enqueue,
# no ``.delay()``), drained off-cron by the ``pill_generation.bootstrap`` worker
# wrapper. Distinct from the all-pills :func:`run_bootstrap` admin orchestrator.
BOOTSTRAP_TASK_NAME = "pill_bootstrap"


async def _active_pills(db: AsyncSession) -> list[Pill]:
    """Return every active (non-retired) pill in the tenant. AC-D14:
    retired pills are hidden from active flows + retained for audit;
    they don't get bootstrap touch."""
    result = await db.execute(select(Pill).where(Pill.tenant_id == SEED_TENANT_ID))
    return [p for p in result.scalars().all() if p.retired_at is None]


async def run_bootstrap(
    db: AsyncSession,
    *,
    http_client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """Execute the AC-D23 bootstrap orchestrator once. Idempotent.

    Returns aggregate telemetry across the four steps so the
    operator's admin trigger response (and the Celery task return
    value) carries one envelope. The ``http_client`` parameter is
    plumbed through to :func:`curate_links_for_pill` for AC-CD15
    zero-network testability; production passes ``None`` and the
    callee opens fresh clients per request.

    Returns::

        {
          "pills_processed":      <int>,   # active pills walked
          "anchors_generated":    <int>,   # NEW anchors (top-up)
          "anchors_excluded":     <int>,   # 3-fail anchors flagged
          "safety_pills_curated": <int>,   # pills with link adds
          "safety_links_added":   <int>,   # individual link rows
          "drive_step_ran":       <bool>,  # False = drive_folder_id unset
          "drive_files_seen":     <int>,
          "drive_files_changed":  <int>,
          "drive_files_added":    <int>,
          "drive_files_deleted":  <int>,
          "duration_seconds":     <float>,
        }
    """
    started = time.monotonic()

    # Step 1: anchor top-up across every active pill. Each pill's
    # generator handles the per-band deficit math internally; pills
    # at quota are counter-zero no-ops.
    anchors_generated = 0
    anchors_excluded = 0
    pills_processed = 0
    pills = await _active_pills(db)
    for pill in pills:
        result = await generate_anchor_pool_for_pill(db, pill.id, top_up=True)
        anchors_generated += int(result.get("anchors_generated", 0))
        anchors_excluded += int(result.get("anchors_excluded", 0))
        pills_processed += 1

    # Step 3: safety-link curation for every safety pill below quota.
    # ``curate_links_for_pill`` is itself idempotent + URL-dedupes.
    safety_pills_curated = 0
    safety_links_added = 0
    for pill in pills:
        if not pill.safety_relevant:
            continue
        link_result = await curate_links_for_pill(db, pill.id, http_client=http_client)
        added = int(link_result.get("links_added", 0))
        if added > 0:
            safety_pills_curated += 1
            safety_links_added += added

    # Step 4: Drive RAG ingest (one call, content_hash-diff inside).
    # Skipped when drive_folder_id is unset — the operator gets a
    # ``drive_step_ran: False`` signal instead of a 409 mid-bootstrap.
    drive_step_ran = False
    drive_telemetry: dict[str, int] = {}
    try:
        drive_telemetry = await ingest_drive_folder(db)
        drive_step_ran = True
    except APIError as exc:
        if exc.code != "drive_folder_unconfigured":
            raise
        logger.info(
            "Bootstrap: skipping Drive RAG ingest — system_settings."
            "drive_folder_id is unset. Operator should configure it "
            "to enable AC-D22 / AC-D23 step 4."
        )

    duration = time.monotonic() - started
    return {
        "pills_processed": pills_processed,
        "anchors_generated": anchors_generated,
        "anchors_excluded": anchors_excluded,
        "safety_pills_curated": safety_pills_curated,
        "safety_links_added": safety_links_added,
        "drive_step_ran": drive_step_ran,
        "drive_files_seen": int(drive_telemetry.get("files_seen", 0)),
        "drive_files_changed": int(drive_telemetry.get("files_changed", 0)),
        "drive_files_added": int(drive_telemetry.get("files_added", 0)),
        "drive_files_deleted": int(drive_telemetry.get("files_deleted", 0)),
        "duration_seconds": duration,
    }


# --- F1: bootstrap-on-publish (per-pill incremental, AC-D7/AC-D23) -----
# The autonomous pipeline has no admin approve gate (AC-D7), so the incremental
# bootstrap fires on **auto-publish** (AC-D23 reframe). C2's ``auto_publish_draft``
# enqueues a per-pill task (fast — a row insert, so publish returns immediately);
# the worker drains it and runs the reuse-only primitives. Idempotent: the anchor
# top-up's quota gate + the link curation's self-guard make a re-run a near-no-op.


async def enqueue_pill_bootstrap(
    db: AsyncSession, *, pill_id: uuid.UUID
) -> ProcessingTask:
    """Enqueue the on-publish per-pill bootstrap (F1) — a ``pending``
    ``pill_bootstrap`` task carrying the pill id. The caller commits (the publish
    path); the worker wrapper drains it **async** so publish stays fast."""
    task = ProcessingTask(
        tenant_id=SEED_TENANT_ID,
        task_name=BOOTSTRAP_TASK_NAME,
        status=ProcessingTaskStatus.pending,
        payload={"pill_id": str(pill_id)},
    )
    db.add(task)
    return task


async def bootstrap_pill(
    db: AsyncSession,
    *,
    pill_id: uuid.UUID,
    http_client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """Run the per-pill incremental bootstrap (F1 — AC-D23 steps 1 + 3 for one
    pill): top-up the anchor pool (``top_up=True`` — skip-already-populated) and
    curate safety links (``curate_links_for_pill`` self-guards non-safety pills).
    Reuse-only; audited ``pill_generation.bootstrap``. Idempotent."""
    anchors = await generate_anchor_pool_for_pill(db, pill_id, top_up=True)
    links = await curate_links_for_pill(db, pill_id, http_client=http_client)
    telemetry = {
        "anchors_generated": int(anchors.get("anchors_generated", 0)),
        "anchors_excluded": int(anchors.get("anchors_excluded", 0)),
        "links_added": int(links.get("links_added", 0)),
    }
    await record_audit(
        db,
        actor_id=None,  # autonomous bootstrap — no human actor
        action="pill_generation.bootstrap",
        target_entity="pill",
        target_id=pill_id,
        detail=telemetry,
    )
    return {"pill_id": str(pill_id), **telemetry}


async def process_pending_bootstraps(
    db: AsyncSession, *, http_client: httpx.AsyncClient | None = None
) -> dict[str, int]:
    """Drain the pending on-publish bootstrap tasks (the worker wrapper's body):
    run :func:`bootstrap_pill` for each + mark it ``done``. The caller commits."""
    result = await db.execute(
        select(ProcessingTask).where(
            ProcessingTask.tenant_id == SEED_TENANT_ID,
            ProcessingTask.task_name == BOOTSTRAP_TASK_NAME,
            ProcessingTask.status == ProcessingTaskStatus.pending,
        )
    )
    processed = 0
    failed = 0
    for task in result.scalars().all():
        payload = task.payload or {}
        pid = payload.get("pill_id")
        if pid is None:
            continue
        # Per-task isolation: the bootstrap does real AI/network work, and the
        # op is idempotent (anchor top-up quota gate + link dedupe), so one bad
        # pill must not poison the batch — mark it ``failed`` and continue rather
        # than abort the whole drain (which would roll back the already-``done``
        # tasks via the wrapper's un-run commit + let a persistently-failing pill
        # block every other pill's bootstrap forever).
        try:
            await bootstrap_pill(db, pill_id=uuid.UUID(str(pid)), http_client=http_client)
        except Exception:
            logger.exception("pill_bootstrap failed for pill_id=%s", pid)
            task.status = ProcessingTaskStatus.failed
            task.finished_at = now_utc()
            failed += 1
            continue
        task.status = ProcessingTaskStatus.done
        task.finished_at = now_utc()
        processed += 1
    return {"bootstrapped": processed, "failed": failed}
