"""Celery beat schedule — the SPEC §8.9 crons (CODE_SPEC §8 / AC-CD7).

The canonical cron count is **nine** (AC-CD7 / §8.9 v1.9). A3 performed the
**net-0 beat-entry swap** (removed ``drive_rag.ingest``, added ``corpus.refresh``
— Drive ingest → corpus refresh, NS-1) → seven registered. This slice (D4) adds
the last two crons — ``gap_detection.sweep`` + ``catalogue_health.check`` (the
schedulers that fire D3's autonomous trigger) → the **canonical nine**. The
``drive_rag.ingest`` *task wrapper* + ``drive_rag.py`` module + ``drive_chunk``
table remain **dormant** (registered but unscheduled) until the separate NS-1
code-removal slice (SPEC §7.3) — A3 swaps the *cron entry*, NS-1 removes the
*code*.

The nine registered crons cover every scheduled background process:

==================== ====================== ==============================
Task name             Cadence (UTC)          Domain callable
==================== ====================== ==============================
grade_review.reconcile every 5 minutes        reconcile_pending_grade_reviews
realism.aggregate     nightly 02:00          aggregate_realism_flags
calibration.run       daily 04:00            run_calibration_sweep
safety_links.check    monthly (day 1 05:00)  check_safety_links
cost.budget_sweep     daily 06:00            maybe_fire_budget_alert
engagement.sweep      daily 07:00            run_engagement_sweep
corpus.refresh        weekly (Mon 08:00)     refresh_corpus_all
gap_detection.sweep   daily 09:00            gap_detection_sweep
catalogue_health.check weekly (Sun 10:00)    catalogue_health_check
==================== ====================== ==============================

The daily-hour offsets keep the daily set
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
    "corpus.refresh": {
        "task": "corpus.refresh",
        # Weekly on Monday at 08:00 UTC — ruling 6 weekly backstop
        # (AC-CD25 / AC-CD7, A3); extends the sequential daily-offset
        # convention past the 07:00 engagement sweep.
        "schedule": crontab(minute=0, hour=8, day_of_week=1),
    },
    "gap_detection.sweep": {
        "task": "gap_detection.sweep",
        # Daily at 09:00 UTC — the §6.5 autonomous gap-detection sweep
        # (D4 schedules D3's ``gap_detection_sweep``); extends the
        # sequential daily-offset convention past the corpus refresh.
        # Operational default cadence (not spec-locked).
        "schedule": crontab(minute=0, hour=9),
    },
    "catalogue_health.check": {
        "task": "catalogue_health.check",
        # Weekly on Sunday at 10:00 UTC — the NS-4 proactive
        # catalogue-health check (D4 schedules D3's
        # ``catalogue_health_check``); weekly to avoid over-generating
        # ("rein in if it breaks"). Operational default cadence.
        "schedule": crontab(minute=0, hour=10, day_of_week=0),
    },
}
