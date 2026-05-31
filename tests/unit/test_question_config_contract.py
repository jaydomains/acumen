"""FE-compose → BE-validate question-config contract (X3-H2 escapee).

The admin question editor authors questions whose `config` is composed by
`frontend/src/lib/tests/compose-question-config.ts` and must satisfy the
backend's `validate_question_config`. The escapee bug (audit-5 capstone) was
that the two spoke different key sets, so every authored question 422'd. This
test asserts the **same golden fixtures** the FE compose test deep-equals
(`frontend/tests/data/question-config/*.json`) pass the backend validator,
and that the validator actually enforces the contract (negative cases).

The fixtures are the single shared source of truth across the two test
suites; if either side drifts, one of the two contract tests goes red.

Zero-network (AC-CD15).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.domain.tests import validate_question_config
from app.models import QuestionType
from app.permissions import APIError

_FIXTURE_DIR = (
    Path(__file__).resolve().parents[2]
    / "frontend"
    / "tests"
    / "data"
    / "question-config"
)

_TYPES = ["multiple_choice", "true_false", "matching", "short_answer", "scenario"]


def _golden(qtype: str) -> dict:
    return json.loads((_FIXTURE_DIR / f"{qtype}.json").read_text())


@pytest.mark.parametrize("qtype", _TYPES)
def test_golden_fixture_passes_validate(qtype: str) -> None:
    # The SAME golden the FE compose test deep-equals must pass the backend
    # validator unchanged — that is the honest FE→BE contract the audit found
    # uncovered. Raises if the shape diverges.
    validate_question_config(QuestionType(qtype), _golden(qtype))


def test_extra_fe_keys_are_tolerated() -> None:
    # pill_id / is_anchor ride along in every golden and must NOT be rejected.
    cfg = _golden("multiple_choice")
    assert "pill_id" in cfg and "is_anchor" in cfg
    validate_question_config(QuestionType.multiple_choice, cfg)


# --- negative cases: the validator enforces the contract --------------


def test_missing_prompt_rejected() -> None:
    cfg = _golden("multiple_choice")
    del cfg["prompt"]
    with pytest.raises(APIError):
        validate_question_config(QuestionType.multiple_choice, cfg)


def test_mcq_correct_must_be_int_index() -> None:
    cfg = _golden("multiple_choice")
    cfg["correct"] = True  # bool, not an int index
    with pytest.raises(APIError):
        validate_question_config(QuestionType.multiple_choice, cfg)


def test_short_answer_missing_model_answer_rejected() -> None:
    # The widened-Slice-5 requirement: SA/scenario need a model_answer.
    cfg = _golden("short_answer")
    del cfg["model_answer"]
    with pytest.raises(APIError):
        validate_question_config(QuestionType.short_answer, cfg)


def test_scenario_missing_model_answer_rejected() -> None:
    cfg = _golden("scenario")
    del cfg["model_answer"]
    with pytest.raises(APIError):
        validate_question_config(QuestionType.scenario, cfg)
