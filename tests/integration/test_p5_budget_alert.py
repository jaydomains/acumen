"""P5 Slice 3 — monthly budget alerts at 50/80/100 % thresholds
(AC-D18 v1.1).

Asserts:
* Below 50 % → no alert fires.
* Crossing 50 % → one alert email; no re-send on subsequent calls
  within the same month at the same threshold.
* Leaping from 0 % to 85 % between calls → BOTH 50 % and 80 % fire
  on the same call.
* No hard enforcement — the AI call sites continue regardless.
* The alert dedup key is ``(threshold, year_month)``; same threshold
  in a different calendar month would re-fire (not directly tested
  here without time travel — covered by the audit-log assertion that
  ``detail.year_month`` is included).
* Missing or zero budget → no alert fires (silently skipped).
* No active admin → alert is not sent (logged), no audit row written.

Uses the P2 SMTPClient seam's ``captured_emails`` for fail-soft
verification (no network).
"""

from __future__ import annotations

import uuid
from datetime import datetime

import pytest

from app import permissions as p
from app.ai.cost import maybe_fire_budget_alert
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    AuditLog,
    Grade,
    GradeSource,
    GradeVerdict,
    Response,
    SystemSettings,
    UserStatus,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    cat_make_user,
    seed_system_settings,
)


@pytest.fixture(autouse=True)
def _reset_captured_emails() -> None:
    """SMTPClient's captured_emails is a module-level list; clear it
    before each test so cross-test bleed doesn't pollute assertions."""
    p.clear_captured_emails()


def _admin(session: CatalogueFakeSession) -> AppUser:
    return cat_make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)


def _seed_settings(
    session: CatalogueFakeSession, *, monthly_budget: float
) -> SystemSettings:
    """Replace the default system_settings row with one carrying a
    monthly_budget for the alert tests."""
    # Replace any default row so the test uses the configured budget.
    session.store[SystemSettings] = []
    row = SystemSettings(
        tenant_id=SEED_TENANT_ID,
        monthly_ai_budget=monthly_budget,
        budget_alert_thresholds=[50, 80, 100],
    )
    session.add(row)
    return row


def _add_grade(session: CatalogueFakeSession, cost_usd: float) -> None:
    """Seed a Grade row with the given AI cost — the smallest provenance-
    bearing entity. Setting ``created_at`` to the current time so the
    rolling-month aggregator picks it up."""
    response = Response(
        tenant_id=SEED_TENANT_ID,
        attempt_id=uuid.uuid4(),
        question_id=uuid.uuid4(),
        answer_payload={"text": "x"},
        response_score=0.0,
    )
    session.add(response)
    grade = Grade(
        tenant_id=SEED_TENANT_ID,
        response_id=response.id,
        score=0.0,
        verdict=GradeVerdict.none,
        source=GradeSource.ai,
        ai_provider="anthropic",
        ai_model="claude-sonnet-4-6",
        ai_prompt_version="1.0.0",
        ai_prompt_tokens=100,
        ai_completion_tokens=50,
        ai_cost_usd=cost_usd,
    )
    session.add(grade)


async def test_below_50_percent_no_alert(
    cat_session: CatalogueFakeSession,
) -> None:
    _seed_settings(cat_session, monthly_budget=100.0)
    _admin(cat_session)
    _add_grade(cat_session, 10.0)  # 10% of budget

    crossed = await maybe_fire_budget_alert(cat_session, tenant_id=SEED_TENANT_ID)
    assert crossed == []
    assert p.captured_emails() == []
    assert cat_session.store.get(AuditLog, []) == []


async def test_crossing_50_percent_fires_one_alert(
    cat_session: CatalogueFakeSession,
) -> None:
    _seed_settings(cat_session, monthly_budget=100.0)
    _admin(cat_session)
    _add_grade(cat_session, 55.0)  # 55%

    crossed = await maybe_fire_budget_alert(cat_session, tenant_id=SEED_TENANT_ID)
    assert crossed == [50]
    emails = p.captured_emails()
    assert len(emails) == 1
    assert emails[0].to == "admin@kbc.com"
    assert "50%" in emails[0].subject
    # Audit row records the threshold + year_month for dedup.
    audit_rows = [
        r for r in cat_session.store.get(AuditLog, []) if r.action == "budget_alert.fired"
    ]
    assert len(audit_rows) == 1
    assert audit_rows[0].detail["threshold"] == 50
    assert audit_rows[0].detail["year_month"] == datetime.utcnow().strftime("%Y-%m")


async def test_same_threshold_not_re_sent_in_same_month(
    cat_session: CatalogueFakeSession,
) -> None:
    """A second call within the same calendar month at the same
    threshold MUST be a no-op — the audit-log dedup is the durable
    flag (no separate alerts table)."""
    _seed_settings(cat_session, monthly_budget=100.0)
    _admin(cat_session)
    _add_grade(cat_session, 55.0)

    await maybe_fire_budget_alert(cat_session, tenant_id=SEED_TENANT_ID)
    assert len(p.captured_emails()) == 1

    # Add more spend that still leaves us at 55-60 % (below 80 %).
    _add_grade(cat_session, 1.0)
    crossed_again = await maybe_fire_budget_alert(cat_session, tenant_id=SEED_TENANT_ID)
    assert crossed_again == []
    assert len(p.captured_emails()) == 1  # no second email


async def test_leap_across_thresholds_fires_each_once(
    cat_session: CatalogueFakeSession,
) -> None:
    """Spend leaping from 0 % straight to 85 % between calls fires
    BOTH 50 % and 80 % on the next call — each at most once each."""
    _seed_settings(cat_session, monthly_budget=100.0)
    _admin(cat_session)
    _add_grade(cat_session, 85.0)

    crossed = await maybe_fire_budget_alert(cat_session, tenant_id=SEED_TENANT_ID)
    assert crossed == [50, 80]
    emails = p.captured_emails()
    assert len(emails) == 2
    subjects = sorted(e.subject for e in emails)
    assert "50%" in subjects[0]
    assert "80%" in subjects[1]


async def test_100_percent_alert_fires_without_blocking(
    cat_session: CatalogueFakeSession,
) -> None:
    """Crossing 100 % fires the 100 % alert (in addition to 50 + 80 if
    not previously fired this month) but operations continue — the
    helper never raises, never refuses (AC-D18 v1.1 "no hard
    enforcement")."""
    _seed_settings(cat_session, monthly_budget=100.0)
    _admin(cat_session)
    _add_grade(cat_session, 120.0)  # 120% — over budget

    crossed = await maybe_fire_budget_alert(cat_session, tenant_id=SEED_TENANT_ID)
    assert crossed == [50, 80, 100]
    assert len(p.captured_emails()) == 3


async def test_no_budget_configured_no_alert(
    cat_session: CatalogueFakeSession,
) -> None:
    """``monthly_ai_budget`` of ``None`` → no alert regardless of
    spend. The dashboard surface still works (returns null percent)."""
    seed_system_settings(cat_session)  # default has monthly_ai_budget=None
    _admin(cat_session)
    _add_grade(cat_session, 1000.0)

    crossed = await maybe_fire_budget_alert(cat_session, tenant_id=SEED_TENANT_ID)
    assert crossed == []
    assert p.captured_emails() == []


async def test_no_active_admin_logs_warning_no_alert(
    cat_session: CatalogueFakeSession,
) -> None:
    """If no active admin recipient is found, the alert is skipped
    (logged but not sent) and NO audit row is written — re-running
    once an admin is added must still fire the alert."""
    _seed_settings(cat_session, monthly_budget=100.0)
    # No admin user is seeded.
    _add_grade(cat_session, 55.0)

    crossed = await maybe_fire_budget_alert(cat_session, tenant_id=SEED_TENANT_ID)
    assert crossed == []
    assert p.captured_emails() == []
    # No audit row → the alert can still fire later once an admin
    # exists (graceful recovery).
    assert cat_session.store.get(AuditLog, []) == []


async def test_never_raises_on_poisoned_dependency(
    cat_session: CatalogueFakeSession,
) -> None:
    """The "never raises" contract is a real invariant, not a
    docstring promise — a DB / SMTP / audit-write failure inside the
    inner body MUST be caught and logged, returning ``[]``, so the
    primary AI call path never fails due to a monitoring side-effect
    (Gitar PR-#16 Slice 3 finding #1).

    Poisons ``db.execute`` to raise on every call. Without the
    top-level wrapper this would propagate out of every call site
    (start_attempt, submit_attempt, enqueue_pill_proposal) and break
    the testee experience.
    """
    _seed_settings(cat_session, monthly_budget=100.0)
    _admin(cat_session)
    _add_grade(cat_session, 55.0)

    async def _boom(*args: object, **kwargs: object) -> object:
        raise RuntimeError("simulated DB outage during budget poll")

    cat_session.execute = _boom  # type: ignore[method-assign]

    # MUST NOT raise.
    crossed = await maybe_fire_budget_alert(cat_session, tenant_id=SEED_TENANT_ID)
    assert crossed == []
    # No email side-effect either — the call short-circuits cleanly.
    assert p.captured_emails() == []


async def test_current_month_spend_has_docstring(
    cat_session: CatalogueFakeSession,
) -> None:
    """``current_month_spend.__doc__`` is a real string, not ``None``
    — guards against the parenthesised-concatenation regression Gitar
    flagged on Slice 3 (PR-#16 finding #2). Cheap CI-time guard
    against the easy mistake of wrapping a docstring expression in
    parens for line-length and silently losing ``__doc__``."""
    from app.ai.cost import current_month_spend

    doc = current_month_spend.__doc__
    assert doc is not None, (
        "current_month_spend.__doc__ is None — likely a parenthesised "
        "string-concat expression silently turned the docstring into "
        "a discarded expression."
    )
    assert "rolling monthly AI spend" in doc
    # The entity-table list moved into the docstring text itself; assert
    # the AC-CD8 v1.6 final clause's pill_proposal hint is present.
    assert "pill_proposal" in doc


async def test_deactivated_admin_does_not_receive_alert(
    cat_session: CatalogueFakeSession,
) -> None:
    """A deactivated admin is skipped as a recipient — only active
    admins receive budget alerts. Matches the AC-D16 deactivation
    gate posture (deactivated users get no system contact)."""
    _seed_settings(cat_session, monthly_budget=100.0)
    deactivated = cat_make_user(
        cat_session, email="old@kbc.com", role=p.ROLE_ADMINISTRATOR
    )
    deactivated.status = UserStatus.deactivated
    _add_grade(cat_session, 55.0)

    crossed = await maybe_fire_budget_alert(cat_session, tenant_id=SEED_TENANT_ID)
    # No active admin → no alert; no audit row.
    assert crossed == []
    assert p.captured_emails() == []
