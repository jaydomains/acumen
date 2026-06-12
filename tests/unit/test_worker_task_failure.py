"""Celery task-failure surfacing (audit-4 S3-H / WS4 pre-deploy, Decision D6).

The §8.9 cron wrappers carry no ``autoretry`` and write no audit row,
so a task failing every run is otherwise invisible — only downstream symptoms
show. ``app/worker.py`` registers ``task_failure`` / ``task_retry`` signal
handlers that emit a loud structured log on any failure / retry. These tests
assert the handlers are connected (the send only logs if a receiver is wired)
and emit the expected structured record. Decision D6: structured-log only —
no audit-row write.

Zero-network (AC-CD15).
"""

from __future__ import annotations

import logging

import pytest
from celery.signals import task_failure, task_retry

from app import worker


def test_task_failure_handler_logs_structured(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.ERROR, logger="acumen.worker"):
        task_failure.send(
            sender=worker.reconcile_grade_reviews_task,
            task_id="abc-123",
            exception=ValueError("boom"),
        )
    failures = [r for r in caplog.records if "celery task failed" in r.getMessage()]
    assert len(failures) >= 1
    record = failures[-1]
    msg = record.getMessage()
    assert "grade_review.reconcile" in msg  # task name surfaced
    assert "abc-123" in msg  # task id surfaced
    assert "boom" in msg  # exception surfaced
    assert record.levelno == logging.ERROR


def test_task_retry_handler_logs_warning(caplog: pytest.LogCaptureFixture) -> None:
    class _Request:
        id = "retry-9"

    with caplog.at_level(logging.WARNING, logger="acumen.worker"):
        task_retry.send(
            sender=worker.engagement_sweep_task,
            request=_Request(),
            reason="transient broker error",
        )
    retries = [r for r in caplog.records if "celery task retrying" in r.getMessage()]
    assert len(retries) >= 1
    msg = retries[-1].getMessage()
    assert "engagement.sweep" in msg  # task name surfaced
    assert "retry-9" in msg  # task id surfaced
    assert retries[-1].levelno == logging.WARNING
