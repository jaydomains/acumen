"""internal router — RESERVED, unmounted in v1 (CODE_SPEC §5, AC-CD6).

Port seam (SPEC §9): the SiteMesh internal/MeshCore surface mounts at
``/v1/internal`` behind ``!PathPrefix(/v1/internal)`` at the Traefik
edge. Intentionally empty in v1 standalone — not included by app.main.
"""

from __future__ import annotations
