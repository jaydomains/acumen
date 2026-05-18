"""AIProvider protocol + per-operation resolution (AC-D12 / AC-CD8).

Defines ``generate()``, ``grade()``, ``review()``, ``embed()`` and the
Test-override -> system-override -> coded-default resolution order.
CODE_SPEC §7. (pending P5)
"""

from __future__ import annotations
