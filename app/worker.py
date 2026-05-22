"""Celery application factory and task registry (CODE_SPEC §8, AC-CD7).

P0 ships the factory + broker/backend wiring only. P6 Slice 3 adds the
``grade_review.reconcile`` task wrapper around
:func:`app.domain.grade_review.reconcile_pending_grade_reviews`. P11
Slice 2 fills out the remaining six §8.9 cron task wrappers and
populates :mod:`app.beat_schedule` with the full seven-entry schedule.

Every wrapper follows the same shape:

1. Construct an :class:`~sqlalchemy.ext.asyncio.AsyncSession` via the
   module-level :func:`~app.models._session_factory` (Celery runs
   outside any FastAPI request, so the ``get_db`` dependency is
   not available).
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

from celery import Celery

from app.config import get_settings


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
    :func:`app.models._session_factory` (Celery runs outside any
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
    from app.models import _session_factory

    async def _run() -> dict[str, int]:
        async with _session_factory()() as session:
            counts = await reconcile_pending_grade_reviews(session)
            await session.commit()
        return counts

    return asyncio.run(_run())


@celery_app.task(name="engagement.sweep")
def engagement_sweep_task() -> dict[str, int]:
    """Celery wrapper for the AC-D26 engagement reminder + escalation
    sweep (one of the seven §8.9 crons). Calls
    :func:`~app.domain.engagement.run_engagement_sweep` and commits."""
    from app.domain.engagement import run_engagement_sweep
    from app.models import _session_factory

    async def _run() -> dict[str, int]:
        async with _session_factory()() as session:
            counts = await run_engagement_sweep(session)
            await session.commit()
        return counts

    return asyncio.run(_run())


@celery_app.task(name="calibration.run")
def calibration_run_task() -> dict[str, object]:
    """Celery wrapper for the §12 / AC-D27 anchor calibration sweep
    (one of the seven §8.9 crons). Calls
    :func:`~app.domain.calibration.run_calibration_sweep` and
    commits."""
    from app.domain.calibration import run_calibration_sweep
    from app.models import _session_factory

    async def _run() -> dict[str, object]:
        async with _session_factory()() as session:
            counts = await run_calibration_sweep(session)
            await session.commit()
        return counts

    return asyncio.run(_run())


@celery_app.task(name="drive_rag.ingest")
def drive_rag_ingest_task() -> dict[str, object]:
    """Celery wrapper for the AC-D22 daily Drive RAG ingest (one of
    the seven §8.9 crons). Calls
    :func:`~app.domain.drive_rag.ingest_drive_folder` and commits."""
    from app.domain.drive_rag import ingest_drive_folder
    from app.models import _session_factory

    async def _run() -> dict[str, object]:
        async with _session_factory()() as session:
            counts = await ingest_drive_folder(session)
            await session.commit()
        return counts

    return asyncio.run(_run())


@celery_app.task(name="realism.aggregate")
def realism_aggregate_task() -> dict[str, object]:
    """Celery wrapper for the AC-D22 nightly Testee-feedback
    aggregation (one of the seven §8.9 crons). Calls
    :func:`~app.domain.drive_rag.aggregate_realism_flags` and
    commits."""
    from app.domain.drive_rag import aggregate_realism_flags
    from app.models import _session_factory

    async def _run() -> dict[str, object]:
        async with _session_factory()() as session:
            counts = await aggregate_realism_flags(session)
            await session.commit()
        return counts

    return asyncio.run(_run())


@celery_app.task(name="safety_links.check")
def safety_links_check_task() -> dict[str, int]:
    """Celery wrapper for the AC-D21 monthly safety-link verification
    (one of the seven §8.9 crons). Calls
    :func:`~app.domain.safety_links.check_safety_links` and commits.
    The Slice 2 stub returns zeros; Slice 3 fills the body (web
    search + httpx + SHA-256 drift audit)."""
    from app.domain.safety_links import check_safety_links
    from app.models import _session_factory

    async def _run() -> dict[str, int]:
        async with _session_factory()() as session:
            counts = await check_safety_links(session)
            await session.commit()
        return counts

    return asyncio.run(_run())


@celery_app.task(name="cost.budget_sweep")
def cost_budget_sweep_task() -> dict[str, object]:
    """Celery wrapper for the AC-D18 v1.1 daily cost/budget poll (one
    of the seven §8.9 crons). Calls
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
    from app.models import SEED_TENANT_ID, _session_factory

    async def _run() -> dict[str, object]:
        async with _session_factory()() as session:
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
