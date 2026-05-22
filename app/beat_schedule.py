"""Celery beat schedule — the seven SPEC §8.9 crons (CODE_SPEC §8 /
AC-CD7).

The seven crons cover every scheduled background process in v1:

==================== ====================== ==============================
Task name             Cadence (UTC)          Domain callable
==================== ====================== ==============================
grade_review.reconcile every 5 minutes        reconcile_pending_grade_reviews
realism.aggregate     nightly 02:00          aggregate_realism_flags
drive_rag.ingest      daily 03:00            ingest_drive_folder
calibration.run       daily 04:00            run_calibration_sweep
safety_links.check    monthly (day 1 05:00)  check_safety_links
cost.budget_sweep     daily 06:00            maybe_fire_budget_alert
engagement.sweep      daily 07:00            run_engagement_sweep
==================== ====================== ==============================

The daily-hour offsets (02:00 → 07:00 UTC) keep the daily set
sequential to avoid concurrent DB-load spikes; these are operational
defaults, not spec-locked. ``grade_review.reconcile`` cadence is
``GRADE_REVIEW_RECONCILE_INTERVAL_MINUTES = 5`` per AC-D19 v1.6 /
AC-CD11 v1.7 (a P6 behavioural default, not yet a system_settings
column).

The AC-D23 idempotent bootstrap job (anchor self-review + safety-link
curation + Drive ingest cross-pill orchestrator) is **not** in this
schedule — it is admin-triggered per AC-CD7 ("idempotent enqueued
job; re-runnable; skips already-populated anchors/links/index"). The
admin endpoint + the Celery task wrapper land in Slice 4.
"""

from __future__ import annotations

from typing import Any

from celery.schedules import crontab

beat_schedule: dict[str, dict[str, Any]] = {
    "grade_review.reconcile": {
        "task": "grade_review.reconcile",
        # Every 5 minutes — AC-D19 v1.6 / AC-CD11 v1.7
        # (``GRADE_REVIEW_RECONCILE_INTERVAL_MINUTES = 5``).
        "schedule": crontab(minute="*/5"),
    },
    "realism.aggregate": {
        "task": "realism.aggregate",
        # Nightly at 02:00 UTC — AC-D22 ("Feedback aggregation runs
        # nightly").
        "schedule": crontab(minute=0, hour=2),
    },
    "drive_rag.ingest": {
        "task": "drive_rag.ingest",
        # Daily at 03:00 UTC — AC-D22 ("Daily diff-based ingest").
        "schedule": crontab(minute=0, hour=3),
    },
    "calibration.run": {
        "task": "calibration.run",
        # Daily at 04:00 UTC — AC-D27 ("Continuous anchor calibration
        # recomputation").
        "schedule": crontab(minute=0, hour=4),
    },
    "safety_links.check": {
        "task": "safety_links.check",
        # Monthly on day 1 at 05:00 UTC — AC-D21 ("Monthly safety-pill
        # link verification").
        "schedule": crontab(minute=0, hour=5, day_of_month=1),
    },
    "cost.budget_sweep": {
        "task": "cost.budget_sweep",
        # Daily at 06:00 UTC — AC-D18 v1.1 cost/budget poll.
        "schedule": crontab(minute=0, hour=6),
    },
    "engagement.sweep": {
        "task": "engagement.sweep",
        # Daily at 07:00 UTC — AC-D26 ("Continuous engagement reminder
        # dispatch").
        "schedule": crontab(minute=0, hour=7),
    },
}
