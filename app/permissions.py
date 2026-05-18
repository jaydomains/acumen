"""Role-check / deactivation / privacy-ack dependency — Auth Hub seam.

The single FastAPI dependency (role check + ``is_active`` gate +
``privacy_ack`` gate) lands in P2. At SiteMesh port this whole file is
replaced by the Auth Hub integration (SPEC §9.2) — kept as one file so
the swap is mechanical. CODE_SPEC §6, AC-CD5. (pending P2)
"""

from __future__ import annotations
