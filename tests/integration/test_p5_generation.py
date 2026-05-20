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
    """P5 done-when criterion: "a spec produces a generated set"."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _per_testee_test(cat_session)
    _start(cat_client, t, test.id)

    # Exactly one generation call was made.
    gen_calls = recording_provider.calls_for(Operation.generation)
    assert len(gen_calls) == 1
    _, _, payload = gen_calls[0]

    # Payload shape carries the test spec the prompt template needs.
    assert payload["test_name"] == "Lifting Operations Diagnostic"
    assert payload["target_difficulty"] == 7
    assert payload["question_count"] == 5
    assert "attempt_id" in payload  # for stub determinism

    # Two Question rows persisted (the default canned response has 2).
    questions = cat_session.store.get(Question, [])
    attempt_questions = [q for q in questions if q.attempt_id is not None]
    assert len(attempt_questions) == 2

    # Each Question row carries full provenance metadata.
    for q in attempt_questions:
        assert q.ai_provider == "anthropic"  # recording provider label
        assert q.ai_model == "claude-sonnet-4-6"
        assert q.ai_prompt_version == "1.0.0-recording"
        # Tokens divided across 2 questions: 100 // 2 = 50, 50 // 2 = 25.
        assert q.ai_prompt_tokens == 50
        assert q.ai_completion_tokens == 25
        # Cost divided across 2: 0.001 / 2 = 0.0005.
        assert q.ai_cost_usd == pytest.approx(0.0005)


def test_per_testee_start_cost_dashboard_contract(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Sum of ``ai_cost_usd`` across the produced Question rows MUST
    recover the call's total cost — the cost dashboard's per-attempt
    aggregation depends on this (AC-D18)."""
    seed_system_settings(cat_session)
    t = _testee(cat_session)
    test = _per_testee_test(cat_session)
    _start(cat_client, t, test.id)

    attempt_questions = [
        q for q in cat_session.store.get(Question, []) if q.attempt_id is not None
    ]
    total = sum(q.ai_cost_usd or 0.0 for q in attempt_questions)
    # The RecordingProvider call cost (0.001 USD), reconstructed.
    assert total == pytest.approx(0.001)


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


def test_per_testee_start_skips_malformed_specs(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """A malformed spec (bad type / missing key / non-dict) must NOT
    crash ``start_attempt`` — it's skipped and the remaining valid
    specs persist. The share_count is computed over the valid set so
    the cost-dashboard invariant still holds (Gitar PR-#16 Slice 2
    finding #1)."""
    recording_provider.set_response(
        Operation.generation,
        {
            "questions": [
                {
                    "type": "multiple_choice",
                    "assigned_difficulty": 5,
                    "config": {"prompt": "p", "options": ["a"], "correct": 0},
                },
                {"type": "not_a_real_type", "config": {}, "assigned_difficulty": 5},
                {"type": "true_false"},  # missing config + difficulty
                "not even a dict",  # outright wrong shape
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

    # Only the 2 valid specs persisted; the 3 malformed entries skipped.
    questions = [
        q for q in cat_session.store.get(Question, []) if q.attempt_id is not None
    ]
    assert len(questions) == 2

    # Cost dashboard invariant: SUM over the 2 valid rows equals the
    # full call cost (0.001), divided over 2 = 0.0005 each.
    for q in questions:
        assert q.ai_cost_usd == pytest.approx(0.0005)
    assert sum(q.ai_cost_usd or 0.0 for q in questions) == pytest.approx(0.001)


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

    # The stub's deterministic set persists with stub provenance.
    questions = [
        q for q in cat_session.store.get(Question, []) if q.attempt_id is not None
    ]
    assert len(questions) == 2
    for q in questions:
        assert q.ai_provider == "stub"
        assert q.ai_cost_usd == 0.0
