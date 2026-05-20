"""P5 Slice 2 — ``identify_weakness`` callable domain function.

Asserts:
* The callable invokes :meth:`AIProvider.generate` with
  :class:`Operation.weakness` and a payload carrying the per-response
  summary the prompt needs.
* A :class:`WeaknessReport` row persists with full provenance.
* :class:`WeaknessReportPill` join rows persist one per weak pill the
  AI returned, with severity copied across.
* It is NOT invoked from :func:`app.domain.attempts.submit_attempt`
  in P5 — P7 wires the loop trigger; P5 ships the engine.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.ai.provider import Operation
from app.domain.weakness import identify_weakness
from app.models import (
    SEED_TENANT_ID,
    Attempt,
    AttemptOrigin,
    Grade,
    GradeSource,
    GradeVerdict,
    Question,
    QuestionType,
    Response,
    Test,
    TestMode,
    TestStatus,
    TestVisibility,
    TimeoutBehaviour,
    WeaknessReport,
    WeaknessReportPill,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    RecordingProvider,
    bearer,
    cat_make_user,
    seed_system_settings,
)


@pytest.fixture
def graded_attempt(
    cat_session: CatalogueFakeSession,
) -> tuple[Attempt, Question, uuid.UUID]:
    """Seed a submitted attempt with one short_answer question and one
    Grade row so ``identify_weakness`` has something to summarise."""
    seed_system_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="T",
        mode=TestMode.frozen,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=False,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        target_difficulty=5,
        randomise_question_order=True,
        randomise_option_order=True,
    )
    cat_session.add(test)
    attempt = Attempt(
        tenant_id=SEED_TENANT_ID,
        test_id=test.id,
        testee_id=testee.id,
        origin=AttemptOrigin.self_initiated,
        sequence_number=1,
        started_at=p.now_utc(),
        submitted_at=p.now_utc(),
    )
    cat_session.add(attempt)
    question = Question(
        tenant_id=SEED_TENANT_ID,
        attempt_id=attempt.id,
        type=QuestionType.short_answer,
        config={"prompt": "Define lockout-tagout.", "rubric": "r", "model_answer": "m"},
        assigned_difficulty=5,
        realism_flag_count=0,
    )
    cat_session.add(question)
    response = Response(
        tenant_id=SEED_TENANT_ID,
        attempt_id=attempt.id,
        question_id=question.id,
        answer_payload={"text": "I don't know."},
        response_score=0.0,
    )
    cat_session.add(response)
    cat_session.add(
        Grade(
            tenant_id=SEED_TENANT_ID,
            response_id=response.id,
            score=0.0,
            verdict=GradeVerdict.none,
            source=GradeSource.ai,
            ai_reasoning="No mention of energy isolation or locks.",
        )
    )
    return attempt, question, testee.id


async def test_identify_weakness_writes_report_with_provenance(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    graded_attempt: tuple[Attempt, Question, uuid.UUID],
) -> None:
    """A weakness call writes a single WeaknessReport row with full
    provenance + a WeaknessReportPill per AI-returned weak pill."""
    attempt, _, _ = graded_attempt
    pill_a = uuid.uuid4()
    pill_b = uuid.uuid4()
    recording_provider.set_response(
        Operation.weakness,
        {
            "weak_pills": [
                {
                    "pill_id": str(pill_a),
                    "severity": 0.8,
                    "note": "Failed lockout-tagout definition.",
                },
                {
                    "pill_id": str(pill_b),
                    "severity": 0.3,
                    "note": "Marginal on safety procedures.",
                },
            ]
        },
    )

    report = await identify_weakness(cat_session, attempt)

    # The call was issued with the weakness op.
    assert len(recording_provider.calls_for(Operation.weakness)) == 1

    # WeaknessReport row persists with provenance.
    reports = cat_session.store.get(WeaknessReport, [])
    assert len(reports) == 1
    assert report.attempt_id == attempt.id
    assert report.ai_provider == "anthropic"
    assert report.ai_model == "claude-sonnet-4-6"
    assert report.ai_prompt_version == "1.0.0-recording"
    assert report.ai_prompt_tokens == 100
    assert report.ai_completion_tokens == 50
    assert report.ai_cost_usd == pytest.approx(0.001)

    # WeaknessReportPill rows: one per weak pill the model returned.
    pill_rows = cat_session.store.get(WeaknessReportPill, [])
    assert len(pill_rows) == 2
    by_pill = {row.pill_id: row.severity for row in pill_rows}
    assert by_pill[pill_a] == pytest.approx(0.8)
    assert by_pill[pill_b] == pytest.approx(0.3)


async def test_identify_weakness_handles_empty_weak_pills(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    graded_attempt: tuple[Attempt, Question, uuid.UUID],
) -> None:
    """An attempt with no weakness still writes a WeaknessReport row
    (the AI's "no weak pills" verdict is itself a useful audit trail)
    with zero pill join rows."""
    attempt, _, _ = graded_attempt
    recording_provider.set_response(Operation.weakness, {"weak_pills": []})

    report = await identify_weakness(cat_session, attempt)

    assert report.id is not None
    assert cat_session.store.get(WeaknessReportPill, []) == []


async def test_identify_weakness_skips_malformed_pill_entries(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    graded_attempt: tuple[Attempt, Question, uuid.UUID],
) -> None:
    """Defensive: a malformed weak_pills entry (missing pill_id, bad
    UUID, etc.) is skipped rather than crashing the report write —
    the report row exists so the audit trail captures the call."""
    attempt, _, _ = graded_attempt
    valid = uuid.uuid4()
    recording_provider.set_response(
        Operation.weakness,
        {
            "weak_pills": [
                {"pill_id": str(valid), "severity": 0.5, "note": "ok"},
                {"pill_id": "not-a-uuid", "severity": 0.4, "note": "skip"},
                {"severity": 0.3, "note": "no pill_id"},
            ]
        },
    )

    report = await identify_weakness(cat_session, attempt)
    assert report.id is not None
    pill_rows = cat_session.store.get(WeaknessReportPill, [])
    assert len(pill_rows) == 1
    assert pill_rows[0].pill_id == valid


def test_identify_weakness_not_auto_triggered_by_submit(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Submitting an attempt MUST NOT invoke weakness identification in
    P5 — P7 wires the loop trigger after the P6 grade_review step
    confirms each AI grade. This guards against a premature auto-call
    that would leak preliminary weakness reports."""
    seed_system_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="T",
        mode=TestMode.frozen,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=False,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        target_difficulty=5,
        randomise_question_order=True,
        randomise_option_order=True,
    )
    cat_session.add(test)
    question = Question(
        tenant_id=SEED_TENANT_ID,
        test_id=test.id,
        type=QuestionType.short_answer,
        config={"prompt": "p", "rubric": "r", "model_answer": "m"},
        assigned_difficulty=5,
        realism_flag_count=0,
    )
    cat_session.add(question)
    r = cat_client.post(
        "/v1/attempts", headers=bearer(testee), json={"test_id": str(test.id)}
    )
    assert r.status_code == 201
    attempt_id = r.json()["id"]
    cat_client.post(f"/v1/attempts/{attempt_id}/submit", headers=bearer(testee))

    # Grading ran (Slice 2 wired); weakness did NOT (P5 design choice).
    assert len(recording_provider.calls_for(Operation.grading)) == 1
    assert recording_provider.calls_for(Operation.weakness) == []
    assert cat_session.store.get(WeaknessReport, []) == []
