"""Celery application factory and task registry (CODE_SPEC §8, AC-CD7).

P0 ships the factory + broker/backend wiring only. P6 Slice 3 adds the
``grade_review.reconcile`` task wrapper around
:func:`app.domain.grade_review.reconcile_pending_grade_reviews`. The
beat-schedule entry that triggers this on a 5-minute interval is P11.
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
