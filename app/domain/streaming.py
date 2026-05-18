"""JIT streaming + presentation shuffle (AC-D25 / AC-D24).

Per-Testee Q1-sync / Q2..N-parallel buffer state machine; attempt_id
seed shuffle. CODE_SPEC §10. (pending P4 shuffle; P10 streaming)
"""

from __future__ import annotations
