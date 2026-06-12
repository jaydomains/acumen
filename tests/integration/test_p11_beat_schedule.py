"""P11 Slice 2 — Celery beat schedule populated with the §8.9
crons (CODE_SPEC §8 / AC-CD7).

The beat-schedule module ships an explicit dict so tests can assert
its shape without booting Celery's scheduler. The grade-review
reconcile wrapper has shipped since P6; the other six wrappers land
in :mod:`app.worker` in this slice. Each entry pairs a task name
with a ``celery.schedules.crontab`` cadence.

Zero-DB / zero-network (AC-CD15): the assertions read the module-
level dict + the Celery app's registered task names; nothing
touches the broker, backend, or any domain callable.
"""

from __future__ import annotations

from celery.schedules import crontab

from app.beat_schedule import beat_schedule
from app.worker import celery_app

_EXPECTED_ENTRIES: dict[str, str] = {
    # entry name → task name (typically equal in v1, but the schedule
    # dict's key is what the operator sees via `celery -A ... inspect
    # scheduled`; the value's `task` is what the worker dispatches).
    "grade_review.reconcile": "grade_review.reconcile",
    "realism.aggregate": "realism.aggregate",
    "drive_rag.ingest": "drive_rag.ingest",
    "calibration.run": "calibration.run",
    "safety_links.check": "safety_links.check",
    "cost.budget_sweep": "cost.budget_sweep",
    "engagement.sweep": "engagement.sweep",
    "corpus.refresh": "corpus.refresh",
}


def test_beat_schedule_has_exactly_eight_entries() -> None:
    """Built-state cron-count gate. A3 adds ``corpus.refresh`` → eight
    registered (8 of the canonical nine, AC-CD7/§8.9 v1.9: the legacy
    ``drive_rag.ingest`` it replaces is removed by the NS-1 slice, and the
    two D4 crons land at D4). The named-entry count is the gate."""
    assert len(beat_schedule) == 8
    assert set(beat_schedule.keys()) == set(_EXPECTED_ENTRIES.keys())


def test_beat_schedule_each_entry_has_task_and_schedule() -> None:
    """Every entry needs a ``task`` (a registered Celery task name)
    and a ``schedule`` (a crontab/timedelta instance). Missing either
    would silently drop the cron at scheduler boot."""
    for entry_name, conf in beat_schedule.items():
        assert "task" in conf, entry_name
        assert "schedule" in conf, entry_name
        assert isinstance(conf["task"], str)
        assert isinstance(conf["schedule"], crontab)


def test_beat_schedule_task_names_match_expectations() -> None:
    """The `task` value of each entry matches the registered Celery
    task name. A typo here is silently ignored at scheduler boot."""
    for entry_name, expected_task in _EXPECTED_ENTRIES.items():
        assert beat_schedule[entry_name]["task"] == expected_task


def test_beat_schedule_celery_app_carries_schedule() -> None:
    """``make_celery`` wires the schedule into the Celery app's
    ``conf.beat_schedule`` so a real ``celery beat`` process picks it
    up. Tests against ``celery_app.conf`` confirm the integration."""
    schedule = celery_app.conf.beat_schedule
    assert isinstance(schedule, dict)
    assert set(schedule.keys()) == set(_EXPECTED_ENTRIES.keys())


def test_beat_schedule_grade_review_runs_every_five_minutes() -> None:
    """AC-D19 v1.6 / AC-CD11 v1.7 default: 5-minute reconcile cadence
    (the ``GRADE_REVIEW_RECONCILE_INTERVAL_MINUTES = 5`` code constant
    in ``app/domain/grade_review.py``)."""
    schedule = beat_schedule["grade_review.reconcile"]["schedule"]
    assert isinstance(schedule, crontab)
    # `minute` in crontab is stored as a set of integers — for
    # `minute="*/5"` the set is {0, 5, 10, ..., 55}.
    assert schedule.minute == {0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55}


def test_beat_schedule_daily_crons_have_distinct_hours() -> None:
    """The five daily crons (realism, drive, calibration, cost,
    engagement) run at 02:00, 03:00, 04:00, 06:00, 07:00 UTC
    respectively — sequential offsets so the daily DB-load spikes
    don't stack. Safety-link check is monthly; reconcile is every-5-
    min; neither participates in the daily-hour offset."""
    daily_hours: list[int] = []
    daily_entries = [
        "realism.aggregate",
        "drive_rag.ingest",
        "calibration.run",
        "cost.budget_sweep",
        "engagement.sweep",
    ]
    for name in daily_entries:
        sched = beat_schedule[name]["schedule"]
        assert isinstance(sched, crontab)
        # Each hour set contains exactly one entry for a daily cron.
        assert len(sched.hour) == 1
        daily_hours.append(next(iter(sched.hour)))
    # No two daily crons share an hour.
    assert len(set(daily_hours)) == len(daily_hours)


def test_beat_schedule_safety_links_check_is_monthly_day_1() -> None:
    """AC-D21: ``Monthly safety-pill link verification`` — day 1 of
    the month is the operational anchor."""
    schedule = beat_schedule["safety_links.check"]["schedule"]
    assert isinstance(schedule, crontab)
    assert schedule.day_of_month == {1}
    assert schedule.hour == {5}
    assert schedule.minute == {0}


def test_celery_app_registered_tasks_include_all_eight() -> None:
    """The Celery app's task registry must contain a real callable
    for every entry's ``task`` field — otherwise a beat tick produces
    ``KeyError`` at dispatch."""
    registered = set(celery_app.tasks.keys())
    for task_name in _EXPECTED_ENTRIES.values():
        assert task_name in registered, f"task not registered: {task_name}"


def test_beat_schedule_corpus_refresh_is_weekly_monday() -> None:
    """Ruling 6 weekly backstop (AC-CD25 / AC-CD7, A3): ``corpus.refresh``
    runs weekly on Monday (``day_of_week=1``) at 08:00 UTC — extending the
    sequential daily-offset convention past the 07:00 engagement sweep."""
    schedule = beat_schedule["corpus.refresh"]["schedule"]
    assert isinstance(schedule, crontab)
    assert schedule.day_of_week == {1}
    assert schedule.hour == {8}
    assert schedule.minute == {0}
