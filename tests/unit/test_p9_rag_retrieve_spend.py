"""P9 Slice 3 — RAG-retrieve query-side embed spend audit fold.

Unit-level coverage of
:func:`app.ai.cost._rag_retrieve_spend`. Mirrors
:func:`app.ai.cost._pill_proposal_spend`'s pattern (audit-log
``detail`` provenance fold rather than ``AIProvenanceMixin``
columns) because the query-side embed has no persisted owning
entity. AC-CD8 v1.6 per-op provenance contract preserved via the
``rag.retrieve`` audit row.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest

from app.ai.cost import _rag_retrieve_spend, _start_of_current_month
from app.models import SEED_TENANT_ID, AuditLog
from app.permissions import now_utc


class _FakeRagAuditSession:
    """Minimal AsyncSession stand-in: walks an explicit list of
    AuditLog rows and applies the tenant-id equality WHERE. The
    helper iterates the result in Python (the real implementation
    in :func:`_rag_retrieve_spend` is intentionally Python-side at
    v1 scale), so the fake only needs ``scalars().all()``."""

    def __init__(self, rows: list[AuditLog]) -> None:
        self._rows = rows

    class _Result:
        def __init__(self, rows: list[AuditLog]) -> None:
            self._rows = rows

        def scalars(self) -> _FakeRagAuditSession._Result:
            return self

        def all(self) -> list[AuditLog]:
            return list(self._rows)

    async def execute(self, stmt: object) -> _Result:
        # All rows are tenant-scoped under SEED_TENANT_ID in the
        # fixtures; the real WHERE clause is tenant_id == :id.
        return self._Result(self._rows)


def _audit(
    *,
    action: str = "rag.retrieve",
    detail: dict | None = None,
    created_at_offset_seconds: int = 0,
) -> AuditLog:
    """Build an AuditLog row with the given detail dict. Defaults to
    an in-month row (now()); the offset is added/subtracted to test
    the since-cutoff filter."""
    row = AuditLog(
        tenant_id=SEED_TENANT_ID,
        actor_id=None,
        action=action,
        target_entity="drive_chunk",
        target_id=uuid.UUID("00000000-0000-0000-0000-000000000000"),
        detail=detail or {},
    )
    row.created_at = now_utc() + timedelta(seconds=created_at_offset_seconds)
    return row


@pytest.mark.asyncio
async def test_rag_retrieve_spend_empty_returns_zero() -> None:
    """No audit rows → zero spend, empty buckets."""
    db = _FakeRagAuditSession([])
    total, by_provider, by_model = await _rag_retrieve_spend(
        db, tenant_id=SEED_TENANT_ID, since=_start_of_current_month(now_utc())
    )
    assert total == 0.0
    assert by_provider == {}
    assert by_model == {}


@pytest.mark.asyncio
async def test_rag_retrieve_spend_sums_one_row() -> None:
    """One in-month audit row → cost in the total + the right
    provider / model bucket."""
    db = _FakeRagAuditSession(
        [
            _audit(
                detail={
                    "provider": "openai",
                    "model": "text-embedding-3-small",
                    "cost_usd": 0.002,
                }
            )
        ]
    )
    total, by_provider, by_model = await _rag_retrieve_spend(
        db, tenant_id=SEED_TENANT_ID, since=_start_of_current_month(now_utc())
    )
    assert total == 0.002
    assert by_provider == {"openai": 0.002}
    assert by_model == {"text-embedding-3-small": 0.002}


@pytest.mark.asyncio
async def test_rag_retrieve_spend_filters_non_retrieve_actions() -> None:
    """Only rows with ``action="rag.retrieve"`` count — a
    ``budget_alert.fired`` or ``drive.ingest`` row sitting in the
    same audit table contributes zero to the retrieve-spend bucket."""
    db = _FakeRagAuditSession(
        [
            _audit(
                action="drive.ingest",
                detail={"provider": "openai", "cost_usd": 99.99},
            ),
            _audit(
                action="rag.retrieve",
                detail={
                    "provider": "openai",
                    "model": "text-embedding-3-small",
                    "cost_usd": 0.001,
                },
            ),
        ]
    )
    total, _, _ = await _rag_retrieve_spend(
        db, tenant_id=SEED_TENANT_ID, since=_start_of_current_month(now_utc())
    )
    assert total == 0.001


@pytest.mark.asyncio
async def test_rag_retrieve_spend_filters_before_since_cutoff() -> None:
    """A row from a prior calendar month is excluded — the monthly
    aggregation surface in :func:`current_month_spend` slices the
    audit log to the current month only."""
    last_month_offset_seconds = -60 * 60 * 24 * 35  # 35 days ago
    db = _FakeRagAuditSession(
        [
            _audit(
                detail={
                    "provider": "openai",
                    "model": "text-embedding-3-small",
                    "cost_usd": 0.005,
                },
                created_at_offset_seconds=last_month_offset_seconds,
            ),
        ]
    )
    total, _, _ = await _rag_retrieve_spend(
        db, tenant_id=SEED_TENANT_ID, since=_start_of_current_month(now_utc())
    )
    assert total == 0.0


@pytest.mark.asyncio
async def test_rag_retrieve_spend_skips_rows_without_cost() -> None:
    """A retrieve audit row with no ``cost_usd`` (defensive guard
    against a malformed detail dict) is silently skipped rather
    than crashing the aggregation."""
    db = _FakeRagAuditSession(
        [
            _audit(detail={"provider": "openai", "model": "text-embedding-3-small"}),
            _audit(detail={"cost_usd": None}),
            _audit(
                detail={
                    "provider": "openai",
                    "model": "text-embedding-3-small",
                    "cost_usd": 0.003,
                }
            ),
        ]
    )
    total, _, _ = await _rag_retrieve_spend(
        db, tenant_id=SEED_TENANT_ID, since=_start_of_current_month(now_utc())
    )
    assert total == 0.003


@pytest.mark.asyncio
async def test_rag_retrieve_spend_groups_by_provider_and_model() -> None:
    """Multiple rows accumulate correctly into the by_provider /
    by_model buckets — supports the cost dashboard's per-provider
    breakdown for embed spend."""
    db = _FakeRagAuditSession(
        [
            _audit(
                detail={
                    "provider": "openai",
                    "model": "text-embedding-3-small",
                    "cost_usd": 0.001,
                }
            ),
            _audit(
                detail={
                    "provider": "openai",
                    "model": "text-embedding-3-small",
                    "cost_usd": 0.002,
                }
            ),
            _audit(
                detail={
                    "provider": "openai",
                    "model": "text-embedding-3-large",
                    "cost_usd": 0.005,
                }
            ),
        ]
    )
    total, by_provider, by_model = await _rag_retrieve_spend(
        db, tenant_id=SEED_TENANT_ID, since=_start_of_current_month(now_utc())
    )
    assert total == 0.008
    assert by_provider == {"openai": 0.008}
    assert by_model == {
        "text-embedding-3-small": 0.003,
        "text-embedding-3-large": 0.005,
    }
