"""Celery beat schedule — the six SPEC §8.9 crons + bootstrap enqueue.

The six crons (Drive ingest daily, anchor-calibration recompute daily,
realism aggregation nightly, safety-link check monthly, cost/budget
sweep daily, reminder/escalation sweep daily) and the AC-D23 bootstrap
enqueue are registered in P11 (CODE_SPEC §8, AC-CD7). (pending P11)
"""

from __future__ import annotations

beat_schedule: dict[str, dict[str, object]] = {}
