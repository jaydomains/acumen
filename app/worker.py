"""Celery application factory and task registry (CODE_SPEC §8, AC-CD7).

P0 ships the factory + broker/backend wiring only. Async tasks (the six
SPEC §8.9 crons, the AC-D23 bootstrap job, AC-D25 streaming
generation) register from P5 onward.
"""

from __future__ import annotations

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
