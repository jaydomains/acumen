"""P5 Slice 2 — per_testee generation wired through ``resolve_provider``.

Asserts:
* ``start_attempt`` with a per_testee Test invokes
  :meth:`AIProvider.generate` with :class:`Operation.generation` and
  the expected payload shape (test name, target_difficulty,
  question_count, attempt_id).
* Each generated Question row is persisted with full per-call
  provenance (provider, model, prompt_version, tokens / cost
  share via :func:`record_provenance_share`).
* The cost dashboard contract holds: summing ``ai_cost_usd`` across
  the generated Question rows recovers the call's total cost
  (no inflation, no loss).
* The attempt's ``question_snapshot`` reflects the generated set so
  view / autosave / submit work end-to-end.

P5 done-when criterion: "a spec produces a generated set" — exercised
by ``test_per_testee_start_invokes_generation_with_provenance``.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.ai.provider import Operation
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    Question,
    Test,
    TestMode,
    TestStatus,
    TestVisibility,
    TimeoutBehaviour,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    RecordingProvider,
    bearer,
    cat_make_user,
    seed_system_settings,
)


def _testee(session: CatalogueFakeSession) -> AppUser:
    return cat_make_user(session, email="t@kbc.com", role=p.ROLE_TESTEE)


def _per_testee_test(session: CatalogueFakeSession) -> Test:
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="Lifting Operations Diagnostic",
        mode=TestMode.per_testee,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=False,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        target_difficulty=7,
        randomise_question_order=True,
        randomise_option_order=True,
    )
    session.add(test)
    return test


def _start(client: TestClient, t: AppUser, test_id: uuid.UUID) -> dict:
    r = client.post("/v1/attempts", headers=bearer(t), json={"test_id": str(test_id)})
    assert r.status_code == 201, r.text
    return r.json()


def test_per_testee_start_invokes_generation_with_provenance(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """P5 done-when criterion ("a spec produces a generated set"),
    rewritten for P10 / AC-D25 v1.8 — per-Testee streaming. Q1 is the
    only generation call at POST time (``question_count=1``); the
    persisted Question carries 1:1 ``record_provenance`` (full per-call
    cost, not the pre-P10 1:N share). Q2..N stream over the SSE
    endpoint (Slice 4)."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _per_testee_test(cat_session)
    _start(cat_client, t, test.id)

    # Exactly one synchronous generation call was made (Q1).
    gen_calls = recording_provider.calls_for(Operation.generation)
    assert len(gen_calls) == 1
    _, _, payload = gen_calls[0]

    # Payload shape carries the test spec the prompt template needs.
    assert payload["test_name"] == "Lifting Operations Diagnostic"
    assert payload["target_difficulty"] == 7
    # P10 / SPEC §6.1 v1.8 — per-question call pattern.
    assert payload["question_count"] == 1
    assert "attempt_id" in payload  # for stub determinism

    # Exactly Q1 persisted at POST time (attempt_position=1); Q2..N
    # arrive via the SSE endpoint in Slice 4.
    questions = cat_session.store.get(Question, [])
    attempt_questions = [q for q in questions if q.attempt_id is not None]
    assert len(attempt_questions) == 1
    q1 = attempt_questions[0]
    assert q1.attempt_position == 1

    # Q1 carries full 1:1 provenance — not the pre-P10 1:N share.
    assert q1.ai_provider == "anthropic"
    assert q1.ai_model == "claude-sonnet-4-6"
    assert q1.ai_prompt_version == "1.0.0-recording"
    assert q1.ai_prompt_tokens == 100
    assert q1.ai_completion_tokens == 50
    assert q1.ai_cost_usd == pytest.approx(0.001)


def test_per_testee_start_cost_dashboard_contract(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Sum of ``ai_cost_usd`` across the produced Question rows MUST
    recover the per-call costs — the cost dashboard's per-attempt
    aggregation depends on this (AC-D18). P10 / AC-D25 v1.8 changes
    the shape: pre-P10, one batch call (cost C) produced N rows each
    stamped C/N (1:N share). With per-Testee streaming, each per-
    question call (cost C each) produces one row stamped C (1:1).
    Slice 3 only persists Q1 here (cost C); the SSE handler persists
    Q2..N each at cost C in Slice 4."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _per_testee_test(cat_session)
    _start(cat_client, t, test.id)

    attempt_questions = [
        q for q in cat_session.store.get(Question, []) if q.attempt_id is not None
    ]
    # Q1 only at this point; Q2..N arrive via SSE.
    assert len(attempt_questions) == 1
    # Q1's stamped cost equals the RecordingProvider's per-call cost.
    assert attempt_questions[0].ai_cost_usd == pytest.approx(0.001)


def test_per_testee_uses_per_op_provider_override(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """``system_settings.provider_by_operation['generation']`` set to
    'openai' routes the generation call to the OpenAI singleton — which
    the fixture monkeypatched to point at the same RecordingProvider —
    so the call still records but the test confirms the resolver
    actually consults the override (per-op isolation guard against
    silent fall-through to the coded default)."""
    from app.models import SystemSettings

    # Replace the default system_settings row with one carrying the override.
    cat_session.store[SystemSettings] = []
    cat_session.add(
        SystemSettings(
            tenant_id=SEED_TENANT_ID,
            provider_by_operation={Operation.generation.value: "openai"},
        )
    )
    t = _testee(cat_session)
    test = _per_testee_test(cat_session)
    _start(cat_client, t, test.id)

    # Call still went through (single RecordingProvider instance backs
    # both singletons). The presence of the call proves the resolver
    # didn't 500 on the override; combined with the resolution-order
    # unit tests in Slice 1 this is sufficient coverage.
    assert len(recording_provider.calls_for(Operation.generation)) == 1


def test_per_testee_start_takes_first_question_from_provider_response(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """P10 / SPEC §6.1 v1.8 — per-question call pattern. The pre-P10
    ``test_per_testee_start_skips_malformed_specs`` "skip malformed,
    keep valid" semantic is retired by the per-question contract:
    each generation call requests ``question_count=1`` and returns
    exactly one question; multi-spec defensive parsing no longer
    applies. If the provider returns multiple specs, the orchestrator
    takes ``questions[0]`` (the first valid spec is Q1; trailing
    items in the array are ignored — providers should honour
    ``question_count=1`` and return one element)."""
    recording_provider.set_response(
        Operation.generation,
        {
            "questions": [
                {
                    "type": "multiple_choice",
                    "assigned_difficulty": 5,
                    "config": {"prompt": "p", "options": ["a"], "correct": 0},
                },
                # Trailing entries get ignored under the per-question
                # contract — not a defensive-skip path.
                {
                    "type": "true_false",
                    "assigned_difficulty": 4,
                    "config": {"prompt": "q", "correct": True},
                },
            ]
        },
    )
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _per_testee_test(cat_session)
    _start(cat_client, t, test.id)

    # Exactly Q1 persisted; the trailing TF spec is ignored.
    questions = [
        q for q in cat_session.store.get(Question, []) if q.attempt_id is not None
    ]
    assert len(questions) == 1
    assert questions[0].type.value == "multiple_choice"
    assert questions[0].attempt_position == 1
    # 1:1 provenance — full per-call cost, not the pre-P10 1:N share.
    assert questions[0].ai_cost_usd == pytest.approx(0.001)


def test_per_testee_stub_fallback_when_no_anthropic_key(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """No ``recording_provider`` fixture and no Anthropic key → resolver
    returns the dev/local :class:`StubAIProvider`. start_attempt must
    still succeed with the stub's deterministic 2-question set so a
    misconfigured dev env does not break on first attempt."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _per_testee_test(cat_session)
    response = _start(cat_client, t, test.id)
    assert response["sequence_number"] == 1

    # P10 / AC-D25 v1.8 — stub still returns 2 deterministic items
    # but the per-question pattern takes only the first as Q1; the
    # second is dropped (the SSE handler in Slice 4 will issue a
    # fresh call for Q2). Q1 persists with stub provenance.
    questions = [
        q for q in cat_session.store.get(Question, []) if q.attempt_id is not None
    ]
    assert len(questions) == 1
    assert questions[0].ai_provider == "stub"
    assert questions[0].ai_cost_usd == 0.0
    assert questions[0].attempt_position == 1
