"""Celery application factory and task registry (CODE_SPEC §8, AC-CD7).

P0 ships the factory + broker/backend wiring only. P6 Slice 3 adds the
``grade_review.reconcile`` task wrapper around
:func:`app.domain.grade_review.reconcile_pending_grade_reviews`. P11
Slice 2 fills out the remaining §8.9 cron task wrappers and populates
:mod:`app.beat_schedule`. Later execution slices add their crons (e.g.
``corpus.refresh`` at A3); the canonical count is nine (AC-CD7 v1.9).

Every wrapper follows the same shape:

1. Construct an :class:`~sqlalchemy.ext.asyncio.AsyncSession` via the
   :func:`~app.models.worker_session` async context manager (Celery
   runs outside any FastAPI request, so the ``get_db`` dependency is
   not available; ``worker_session`` builds a fresh ``NullPool``
   engine per task so the asyncpg connection's protocol state never
   outlives the event loop that ``asyncio.run`` tears down — see the
   helper's docstring for the failure mode it prevents).
2. ``await`` the domain callable (which mutates rows + writes audit
   entries as needed; the domain layer is the source of truth for
   what the sweep does).
3. ``await session.commit()`` so the in-place updates land.
4. Return the domain callable's counts dict unchanged — the
   operator-visible signal of what one sweep accomplished, the same
   shape the admin trigger endpoint surfaces over HTTP.

The wrappers are intentionally thin: every fail-soft and retry
decision lives in the domain layer (see e.g. the auth-soft branches
in :func:`~app.domain.grade_review.reconcile_pending_grade_reviews`).
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from celery import Celery
from celery.signals import task_failure, task_retry

from app.config import get_settings

# Structured failure surfacing for the §8.9 crons (audit-4 S3-H /
# WS4 pre-deploy subset). The cron wrappers carry no autoretry and write no
# audit row, so a task that fails every run is otherwise invisible — only
# its downstream symptoms show. These signal handlers emit a loud,
# structured log on every task failure / retry so a failing sweep is
# diagnosable from logs alone. Decision D6: **structured-log only** — no
# audit-row write (that overlaps WS2's transactional CRUD+audit service and
# defers to post-deploy).
_task_log = logging.getLogger("acumen.worker")


@task_failure.connect
def _on_task_failure(
    sender: Any = None,
    task_id: Any = None,
    exception: Any = None,
    args: Any = None,
    kwargs: Any = None,
    traceback: Any = None,
    einfo: Any = None,
    **_: Any,
) -> None:
    """Emit a structured ``logs.error`` for any failed Celery task."""
    task_name = getattr(sender, "name", None) or "unknown"
    exc_info = getattr(einfo, "exc_info", None)
    _task_log.error(
        "celery task failed: task=%s id=%s exc=%r",
        task_name,
        task_id,
        exception,
        exc_info=exc_info,
    )


@task_retry.connect
def _on_task_retry(
    sender: Any = None,
    request: Any = None,
    reason: Any = None,
    einfo: Any = None,
    **_: Any,
) -> None:
    """Emit a structured warning when a Celery task is retried."""
    task_name = getattr(sender, "name", None) or "unknown"
    task_id = getattr(request, "id", None)
    _task_log.warning(
        "celery task retrying: task=%s id=%s reason=%r",
        task_name,
        task_id,
        reason,
    )


def make_celery() -> Celery:
    settings = get_settings()
    celery_app = Celery(
        "acumen",
        broker=settings.celery_broker_url,
        backend=settings.celery_result_backend,
    )
    celery_app.conf.update(
        task_track_started=True,
        task_acks_late=True,
        worker_hijack_root_logger=False,
    )
    # P11 Slice 2: beat schedule lives in a dedicated module so it can
    # be inspected without importing the Celery app (tests assert
    # against the dict directly). Import-time circular safety: the
    # beat_schedule module only depends on celery.schedules.crontab,
    # not on the task functions, so the registry below can be late-
    # bound by name.
    from app.beat_schedule import beat_schedule

    celery_app.conf.beat_schedule = beat_schedule
    return celery_app


celery_app = make_celery()


@celery_app.task(name="grade_review.reconcile")
def reconcile_grade_reviews_task() -> dict[str, int]:
    """Celery wrapper around the async reconcile sweep.

    Constructs its own ``AsyncSession`` via
    :func:`app.models.worker_session` (Celery runs outside any
    FastAPI request, so the ``get_db`` dependency is not available).
    Commits at the end so the in-place row updates (auto-flag,
    confirmed/flagged transitions, overall_score recomputes) persist.

    Returns the same counts dict the admin trigger endpoint returns —
    the operator-visible signal of what one sweep accomplished.
    """
    # Imported lazily so importing ``app.worker`` does not pull the
    # full domain/model layer at Celery startup (matches the AC-CD2
    # structure-gate convention).
    from app.domain.grade_review import reconcile_pending_grade_reviews
    from app.models import worker_session

    async def _run() -> dict[str, int]:
        async with worker_session() as session:
            counts = await reconcile_pending_grade_reviews(session)
            await session.commit()
        return counts

    return asyncio.run(_run())


@celery_app.task(name="engagement.sweep")
def engagement_sweep_task() -> dict[str, int]:
    """Celery wrapper for the AC-D26 engagement reminder + escalation
    sweep (one of the §8.9 crons). Calls
    :func:`~app.domain.engagement.run_engagement_sweep` and commits."""
    from app.domain.engagement import run_engagement_sweep
    from app.models import worker_session

    async def _run() -> dict[str, int]:
        async with worker_session() as session:
            counts = await run_engagement_sweep(session)
            await session.commit()
        return counts

    return asyncio.run(_run())


@celery_app.task(name="calibration.run")
def calibration_run_task() -> dict[str, object]:
    """Celery wrapper for the §12 / AC-D27 anchor calibration sweep
    (one of the §8.9 crons). Calls
    :func:`~app.domain.calibration.run_calibration_sweep` and
    commits."""
    from app.domain.calibration import run_calibration_sweep
    from app.models import worker_session

    async def _run() -> dict[str, object]:
        async with worker_session() as session:
            counts = await run_calibration_sweep(session)
            await session.commit()
        return counts

    return asyncio.run(_run())


@celery_app.task(name="drive_rag.ingest")
def drive_rag_ingest_task() -> dict[str, object]:
    """Celery wrapper for the AC-D22 daily Drive RAG ingest (one of
    the §8.9 crons). Calls
    :func:`~app.domain.drive_rag.ingest_drive_folder` and commits."""
    from app.domain.drive_rag import ingest_drive_folder
    from app.models import worker_session

    async def _run() -> dict[str, object]:
        async with worker_session() as session:
            counts = await ingest_drive_folder(session)
            await session.commit()
        return counts

    return asyncio.run(_run())


@celery_app.task(name="corpus.refresh")
def corpus_refresh_task() -> dict[str, object]:
    """Celery wrapper for the weekly reference-corpus refresh backstop
    (AC-CD25 / AC-CD7, A3 — one of the canonical nine §8.9 crons; replaces
    the retired ``drive_rag.ingest`` per NS-1). Calls
    :func:`~app.domain.corpus_builder.refresh_corpus_all` and commits."""
    from app.domain.corpus_builder import refresh_corpus_all
    from app.models import worker_session

    async def _run() -> dict[str, object]:
        async with worker_session() as session:
            added = await refresh_corpus_all(session)
            await session.commit()
        return {
            "topics_refreshed": len(added),
            "chunks_added": sum(added.values()),
        }

    return asyncio.run(_run())


@celery_app.task(name="realism.aggregate")
def realism_aggregate_task() -> dict[str, object]:
    """Celery wrapper for the AC-D22 nightly Testee-feedback
    aggregation (one of the §8.9 crons). Calls
    :func:`~app.domain.drive_rag.aggregate_realism_flags` and
    commits."""
    from app.domain.drive_rag import aggregate_realism_flags
    from app.models import worker_session

    async def _run() -> dict[str, object]:
        async with worker_session() as session:
            counts = await aggregate_realism_flags(session)
            await session.commit()
        return counts

    return asyncio.run(_run())


@celery_app.task(name="safety_links.check")
def safety_links_check_task() -> dict[str, int]:
    """Celery wrapper for the AC-D21 monthly safety-link verification
    (one of the §8.9 crons). Calls
    :func:`~app.domain.safety_links.check_safety_links` and commits.
    The Slice 2 stub returns zeros; Slice 3 fills the body (web
    search + httpx + SHA-256 drift audit)."""
    from app.domain.safety_links import check_safety_links
    from app.models import worker_session

    async def _run() -> dict[str, int]:
        async with worker_session() as session:
            counts = await check_safety_links(session)
            await session.commit()
        return counts

    return asyncio.run(_run())


@celery_app.task(name="cost.budget_sweep")
def cost_budget_sweep_task() -> dict[str, object]:
    """Celery wrapper for the AC-D18 v1.1 daily cost/budget poll (one
    of the §8.9 crons). Calls
    :func:`~app.ai.cost.maybe_fire_budget_alert` (which is fail-soft
    by contract and never raises) and commits any audit-log rows the
    threshold crossings produced.

    Returns ``{"thresholds_fired": [50, 80, ...]}`` — the list of
    threshold percentages the sweep emitted. Most calls return an
    empty list (the inline post-AI-call path usually fires first); the
    cron exists for the "no AI calls happened since the last
    threshold crossing" gap.
    """
    from app.ai.cost import maybe_fire_budget_alert
    from app.models import SEED_TENANT_ID, worker_session

    async def _run() -> dict[str, object]:
        async with worker_session() as session:
            # v1 is single-tenant per AC-CD3 ("one acumen Postgres
            # schema; tenant_id is on every scoped table from day one
            # but v1 is single-tenant; RLS is a port seam, not built
            # in v1"). Every other wrapper's domain callable also
            # scopes to SEED_TENANT_ID; the SiteMesh port adds the
            # tenant-iteration loop here when RLS / multi-tenancy
            # lands (Gitar PR-#24 Slice 2 informational finding).
            fired = await maybe_fire_budget_alert(session, tenant_id=SEED_TENANT_ID)
            await session.commit()
        return {"thresholds_fired": list(fired)}

    return asyncio.run(_run())
