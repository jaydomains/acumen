"""P5 Slice 3 — admin cost-summary endpoint (AC-D18).

Asserts:
* GET ``/v1/admin/cost/summary`` returns rolling current-month spend
  aggregated across every AIProvenanceMixin-bearing entity plus the
  pill-proposal provenance dict in ``processing_tasks.payload``.
* Spend is split by provider AND by model so an admin can evaluate
  the AC-CD18 env-overridable model defaults.
* When ``monthly_ai_budget`` is configured, ``percent_of_budget`` is
  computed; absent budget → null.
* Fired-this-month alerts from the audit log surface back through
  the endpoint so the dashboard renders the pre-emitted state
  without re-sending.
* Non-admin users get 403.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    AuditLog,
    Grade,
    GradeSource,
    GradeVerdict,
    ProcessingTask,
    ProcessingTaskStatus,
    Question,
    QuestionType,
    Response,
    SystemSettings,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
    seed_system_settings,
)


def _admin(session: CatalogueFakeSession) -> AppUser:
    return cat_make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)


def _testee(session: CatalogueFakeSession) -> AppUser:
    return cat_make_user(session, email="t@kbc.com", role=p.ROLE_TESTEE)


def _add_question_cost(
    session: CatalogueFakeSession,
    *,
    cost: float,
    provider: str = "anthropic",
    model: str = "claude-sonnet-4-6",
) -> None:
    """A provenance-bearing Question row (generation entity)."""
    session.add(
        Question(
            tenant_id=SEED_TENANT_ID,
            attempt_id=uuid.uuid4(),
            type=QuestionType.multiple_choice,
            config={"prompt": "p", "options": ["a"], "correct": 0},
            assigned_difficulty=5,
            realism_flag_count=0,
            ai_provider=provider,
            ai_model=model,
            ai_prompt_version="1.0.0",
            ai_prompt_tokens=100,
            ai_completion_tokens=50,
            ai_cost_usd=cost,
        )
    )


def _add_grade_cost(
    session: CatalogueFakeSession,
    *,
    cost: float,
    provider: str = "anthropic",
    model: str = "claude-sonnet-4-6",
) -> None:
    response = Response(
        tenant_id=SEED_TENANT_ID,
        attempt_id=uuid.uuid4(),
        question_id=uuid.uuid4(),
        answer_payload={"text": "x"},
        response_score=0.0,
    )
    session.add(response)
    session.add(
        Grade(
            tenant_id=SEED_TENANT_ID,
            response_id=response.id,
            score=0.0,
            verdict=GradeVerdict.none,
            source=GradeSource.ai,
            ai_provider=provider,
            ai_model=model,
            ai_prompt_version="1.0.0",
            ai_prompt_tokens=100,
            ai_completion_tokens=50,
            ai_cost_usd=cost,
        )
    )


def _add_pill_proposal_cost(
    session: CatalogueFakeSession,
    *,
    cost: float,
    provider: str = "anthropic",
    model: str = "claude-sonnet-4-6",
) -> None:
    """Pill proposals carry provenance in payload, not on a mixin."""
    session.add(
        ProcessingTask(
            tenant_id=SEED_TENANT_ID,
            task_name="pill_proposal",
            status=ProcessingTaskStatus.pending,
            payload={
                "proposal": {"name": "x"},
                "provenance": {
                    "provider": provider,
                    "model": model,
                    "prompt_version": "1.0.0",
                    "prompt_tokens": 50,
                    "completion_tokens": 25,
                    "cost_usd": cost,
                },
            },
        )
    )


def test_cost_summary_aggregates_across_entities(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    _add_question_cost(cat_session, cost=0.05)
    _add_question_cost(cat_session, cost=0.05)
    _add_grade_cost(cat_session, cost=0.01)
    _add_pill_proposal_cost(cat_session, cost=0.02)

    r = cat_client.get("/v1/admin/cost/summary", headers=bearer(admin))
    assert r.status_code == 200
    body = r.json()
    # 0.05 + 0.05 + 0.01 + 0.02 = 0.13
    assert body["total_usd"] == pytest.approx(0.13)


def test_cost_summary_splits_by_provider_and_model(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    _add_question_cost(
        cat_session, cost=0.10, provider="anthropic", model="claude-sonnet-4-6"
    )
    _add_grade_cost(
        cat_session, cost=0.02, provider="anthropic", model="claude-sonnet-4-6"
    )
    _add_grade_cost(cat_session, cost=0.05, provider="openai", model="gpt-4o")
    _add_pill_proposal_cost(cat_session, cost=0.03, provider="openai", model="gpt-4o")

    r = cat_client.get("/v1/admin/cost/summary", headers=bearer(admin))
    body = r.json()
    assert body["by_provider"]["anthropic"] == pytest.approx(0.12)
    assert body["by_provider"]["openai"] == pytest.approx(0.08)
    assert body["by_model"]["claude-sonnet-4-6"] == pytest.approx(0.12)
    assert body["by_model"]["gpt-4o"] == pytest.approx(0.08)


def test_cost_summary_computes_percent_of_budget(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    # Replace the seeded settings with one carrying a budget.
    cat_session.store[SystemSettings] = []
    cat_session.add(
        SystemSettings(
            tenant_id=SEED_TENANT_ID,
            monthly_ai_budget=100.0,
            budget_alert_thresholds=[50, 80, 100],
        )
    )
    admin = _admin(cat_session)
    _add_grade_cost(cat_session, cost=30.0)

    r = cat_client.get("/v1/admin/cost/summary", headers=bearer(admin))
    body = r.json()
    assert body["monthly_budget"] == 100.0
    assert body["percent_of_budget"] == pytest.approx(30.0)


def test_cost_summary_returns_null_percent_when_no_budget(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)  # monthly_ai_budget None
    admin = _admin(cat_session)
    _add_grade_cost(cat_session, cost=100.0)

    r = cat_client.get("/v1/admin/cost/summary", headers=bearer(admin))
    body = r.json()
    assert body["monthly_budget"] is None
    assert body["percent_of_budget"] is None


def test_cost_summary_surfaces_fired_alerts_this_month(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """Audit-log rows from ``maybe_fire_budget_alert`` surface back
    through the endpoint so the dashboard can render the
    pre-emitted state without re-sending."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    # Synthesise an audit row as if the 50% alert had already fired
    # this month — matches the (threshold, year_month) dedup key shape.
    year_month = p.now_utc().strftime("%Y-%m")
    cat_session.add(
        AuditLog(
            tenant_id=SEED_TENANT_ID,
            actor_id=None,
            action="budget_alert.fired",
            target_entity="system_settings",
            target_id=uuid.uuid4(),
            detail={
                "threshold": 50,
                "year_month": year_month,
                "spend_usd": 55.0,
                "budget_usd": 100.0,
                "percent": 55.0,
            },
        )
    )
    cat_session.add(
        AuditLog(
            tenant_id=SEED_TENANT_ID,
            actor_id=None,
            action="budget_alert.fired",
            target_entity="system_settings",
            target_id=uuid.uuid4(),
            detail={
                "threshold": 80,
                "year_month": year_month,
                "spend_usd": 85.0,
                "budget_usd": 100.0,
                "percent": 85.0,
            },
        )
    )

    r = cat_client.get("/v1/admin/cost/summary", headers=bearer(admin))
    body = r.json()
    assert body["alerts_fired_this_month"] == [50, 80]
    assert body["year_month"] == year_month


def test_cost_summary_rejects_non_admin(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    r = cat_client.get("/v1/admin/cost/summary", headers=bearer(testee))
    assert r.status_code == 403


def test_cost_summary_excludes_rows_with_null_cost(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """Rows with ai_cost_usd=NULL (e.g. legacy P4 rows pre-Slice-2)
    are simply not counted — the aggregator skips them. No crash."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    # One null-cost question + one priced question.
    cat_session.add(
        Question(
            tenant_id=SEED_TENANT_ID,
            attempt_id=uuid.uuid4(),
            type=QuestionType.multiple_choice,
            config={"prompt": "p", "options": ["a"], "correct": 0},
            assigned_difficulty=5,
            realism_flag_count=0,
            ai_cost_usd=None,
        )
    )
    _add_grade_cost(cat_session, cost=0.5)

    r = cat_client.get("/v1/admin/cost/summary", headers=bearer(admin))
    body = r.json()
    assert body["total_usd"] == pytest.approx(0.5)
