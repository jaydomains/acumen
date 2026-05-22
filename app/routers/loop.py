"""loop router — RESERVED, unmounted in v1 (CODE_SPEC §3, AC-CD2).

Port seam: future Testee-facing loop surface ("list my pending
follow-ups", per PR-019 handover §"Build state vs spec"). v1
adaptive-learning loop runs in ``app/domain/loop.py`` (AC-D6) wired
into ``submit_attempt``; admin-reviewed queue endpoints are in
``app/routers/admin.py``. Intentionally empty in v1 standalone — not
included by app.main.
"""

from __future__ import annotations
