"""competency router — RESERVED, unmounted in v1 (CODE_SPEC §3, AC-CD2).

Port seam: future Testee-facing competence dashboard ("show me my
per-pill competence_estimate and history"). v1 competence_estimate
math + DB writes live in ``app/domain/competence.py`` (AC-D9 v1.2).
No Testee-facing surface in v1. Intentionally empty in v1 standalone
— not included by app.main.
"""

from __future__ import annotations
