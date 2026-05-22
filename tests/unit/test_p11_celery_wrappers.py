"""P11 Slice 2 — Celery task wrappers smoke (CODE_SPEC §8 / AC-CD7).

Each wrapper opens its own ``AsyncSession`` via
:func:`app.models._session_factory` (Celery runs outside any FastAPI
request, so ``get_db`` is unavailable), calls the domain callable,
commits, and returns the domain's counts dict unchanged. These tests
substitute a fake session factory yielding the AC-CD15
``CatalogueFakeSession`` so the wrappers execute against the same
in-memory store the integration suite uses.

Zero-DB / zero-network (AC-CD15).
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

import pytest

from tests.integration.conftest import CatalogueFakeSession


@pytest.fixture
def fake_session_factory(monkeypatch: pytest.MonkeyPatch) -> CatalogueFakeSession:
    """Patch :func:`app.models._session_factory` so wrappers running
    via ``asyncio.run`` open and close the shared
    ``CatalogueFakeSession`` instead of a real async_sessionmaker.

    The patched callable mirrors the production shape:
    ``_session_factory()()`` yields an async-context-manager session.
    """
    cat_session = CatalogueFakeSession()

    @asynccontextmanager
    async def _ctx() -> Any:  # type: ignore[misc]
        yield cat_session

    def _factory() -> Any:
        # ``_session_factory()`` returns the sessionmaker; ``()`` on
        # the sessionmaker returns the async-ctx-manager session. The
        # fake collapses both into a single callable that returns a
        # fresh ctx manager each call.
        return _ctx

    monkeypatch.setattr("app.models._session_factory", _factory)
    return cat_session


def test_engagement_sweep_task_returns_zero_counts_on_empty_store(
    fake_session_factory: CatalogueFakeSession,
) -> None:
    """``engagement.sweep`` against an empty store returns the
    standard counts dict shape (reminders_sent=0, escalations_sent=0)
    — proves the wrapper imports cleanly, opens a session, runs the
    domain callable, and commits without error."""
    from app.worker import engagement_sweep_task

    result = engagement_sweep_task()
    assert result == {"reminders_sent": 0, "escalations_sent": 0}


def test_calibration_run_task_returns_counts_on_empty_store(
    fake_session_factory: CatalogueFakeSession,
) -> None:
    """``calibration.run`` returns the §12 sweep telemetry shape with
    zero observations when no anchors exist."""
    from app.worker import calibration_run_task

    result = calibration_run_task()
    # `run_calibration_sweep` returns a dict; the specific keys are
    # asserted by `test_p8_calibration_sweep.py`. Here we only check
    # the wrapper passes the result through.
    assert isinstance(result, dict)
    assert "anchors_processed" in result


def test_drive_rag_ingest_task_raises_when_folder_unconfigured(
    fake_session_factory: CatalogueFakeSession,
) -> None:
    """``drive_rag.ingest`` against a deployment that hasn't completed
    AC-D23 step 4 (no ``system_settings.drive_folder_id``) raises
    ``APIError(409, 'drive_folder_unconfigured')`` so the operator
    sees the misconfiguration in Celery logs. The wrapper does not
    swallow the error — Celery's ``task_acks_late=True`` retains the
    raised state so the next beat tick can succeed once the operator
    configures the folder. This is the production-visible contract."""
    import pytest as _pytest

    from app.permissions import APIError
    from app.worker import drive_rag_ingest_task

    with _pytest.raises(APIError) as exc:
        drive_rag_ingest_task()
    assert exc.value.code == "drive_folder_unconfigured"


def test_realism_aggregate_task_returns_counts_on_empty_store(
    fake_session_factory: CatalogueFakeSession,
) -> None:
    """``realism.aggregate`` returns the AC-D22 aggregation telemetry
    shape with zero flags when no RealismFlag rows exist."""
    from app.worker import realism_aggregate_task

    result = realism_aggregate_task()
    assert isinstance(result, dict)
    assert "flags_processed" in result


def test_safety_links_check_task_returns_stub_counts_at_slice_2(
    fake_session_factory: CatalogueFakeSession,
) -> None:
    """At Slice 2 the safety-link sweep is a placeholder returning
    zero counters; Slice 3 fills the real web-search + httpx body.
    The wrapper's contract (counts dict pass-through) is fixed now so
    the beat schedule lands complete; Slice 3 only swaps the domain
    body."""
    from app.worker import safety_links_check_task

    result = safety_links_check_task()
    assert result == {
        "links_checked": 0,
        "links_broken_replaced": 0,
        "links_drift_flagged": 0,
        "links_unchanged": 0,
    }


def test_cost_budget_sweep_task_returns_thresholds_fired_shape(
    fake_session_factory: CatalogueFakeSession,
) -> None:
    """``cost.budget_sweep`` against the default no-budget store
    returns ``{"thresholds_fired": []}`` — the AC-D18 v1.1
    fail-soft path is exercised end-to-end through the wrapper.
    ``maybe_fire_budget_alert`` is the never-raises contract; the
    wrapper inherits it."""
    from app.worker import cost_budget_sweep_task

    result = cost_budget_sweep_task()
    assert result == {"thresholds_fired": []}


def test_reconcile_grade_reviews_task_returns_counts_on_empty_store(
    fake_session_factory: CatalogueFakeSession,
) -> None:
    """The pre-existing P6 wrapper still works under the same
    fake-factory monkeypatch — proves the Slice 2 changes don't
    regress the seventh cron's wrapper contract."""
    from app.worker import reconcile_grade_reviews_task

    result = reconcile_grade_reviews_task()
    assert isinstance(result, dict)
    assert "attempts_processed" in result
    assert result["attempts_processed"] == 0
