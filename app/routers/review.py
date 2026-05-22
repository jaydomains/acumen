"""review router — RESERVED, unmounted in v1 (CODE_SPEC §3, AC-CD2).

Port seam: future Testee-facing review-status surface ("show me the
review verdict on my graded responses"). v1 cross-family review runs
synchronously in ``app/domain/grade_review.py`` (AC-D19 / AC-CD11);
admin flag queue, per-row override, and reconcile trigger endpoints
are consolidated into ``app/routers/admin.py``. Intentionally empty in
v1 standalone — not included by app.main.
"""

from __future__ import annotations
