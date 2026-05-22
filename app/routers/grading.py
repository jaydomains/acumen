"""grading router — RESERVED, unmounted in v1 (CODE_SPEC §3, AC-CD2).

Port seam: future Testee-facing grading-status surface. v1 grading
(deterministic + AI) runs inline in ``app/domain/attempts.py`` at
submit time (AC-D5 / AC-D19); cost capture in ``app/ai/cost.py``. No
Testee-facing grading-status surface in v1. Intentionally empty in v1
standalone — not included by app.main.
"""

from __future__ import annotations
