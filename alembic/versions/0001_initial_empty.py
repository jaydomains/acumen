"""initial empty

Revision ID: 0001_initial_empty
Revises:
Create Date: 2026-05-18

P0 baseline. This revision intentionally creates nothing so the
migration chain has a clean, reversible root. The real schema (every
SPEC §5 entity + supporting tables) lands in the P1 migration. AC-CD3.
"""

from __future__ import annotations

revision = "0001_initial_empty"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
