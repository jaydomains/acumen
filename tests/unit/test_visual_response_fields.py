"""Forward-compatibility guard for v1.x visual content on questions.

A future v1.x feature will add reference images to questions and
images to MCQ choices. This PR introduces the API contract for those
fields ahead of the frontend opening so generated TypeScript types
include them from day one — neither AI generation nor admin authoring
populates them yet, but every response surface emits them (always
``null`` today) and the option shape is normalised to ``{text,
image_url}`` so a frontend choice renderer never needs a string-vs-
object branch.

These tests pin the contract at three surfaces:

1. ``QuestionResponse`` Pydantic class (admin Test-management routes).
2. ``ChoiceResponse`` Pydantic class (OpenAPI surface — informational).
3. ``_present_one`` testee-facing dict (attempt POST / GET / SSE-replay).

No DB, no network — pure schema + presentation assertions.
"""

from __future__ import annotations

import uuid

from app.domain.attempts import _present_one
from app.schemas import ChoiceResponse, QuestionResponse


def _seed() -> int:
    return 0


# --- QuestionResponse (admin Pydantic surface) ------------------------


def test_question_response_carries_reference_image_fields() -> None:
    fields = QuestionResponse.model_fields
    assert "reference_image_url" in fields
    assert "reference_image_caption" in fields
    # Both default to None (no DB column today).
    assert fields["reference_image_url"].default is None
    assert fields["reference_image_caption"].default is None


def test_question_response_validates_without_image_fields() -> None:
    """``from_attributes=True`` + None defaults mean the ORM Question
    (which has no column for these) serialises with both fields null."""
    payload = {
        "id": uuid.UUID(int=1),
        "test_id": uuid.UUID(int=2),
        "type": "multiple_choice",
        "config": {"prompt": "p", "options": ["a", "b"], "correct": 0},
        "assigned_difficulty": 5,
        "question_group_id": None,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }
    model = QuestionResponse.model_validate(payload)
    assert model.reference_image_url is None
    assert model.reference_image_caption is None


# --- ChoiceResponse (OpenAPI-typed surface) ---------------------------


def test_choice_response_shape() -> None:
    fields = ChoiceResponse.model_fields
    assert "text" in fields
    assert "image_url" in fields
    # ``text`` required, ``image_url`` defaults to None.
    assert fields["text"].is_required()
    assert fields["image_url"].default is None


def test_choice_response_validates_with_and_without_image() -> None:
    plain = ChoiceResponse.model_validate({"text": "a"})
    assert plain.text == "a"
    assert plain.image_url is None
    with_image = ChoiceResponse.model_validate(
        {"text": "a", "image_url": "https://example.test/a.png"}
    )
    assert with_image.image_url == "https://example.test/a.png"


# --- _present_one (testee-facing dict surface) ------------------------


def _mcq_legacy(options: list[str], correct: int = 0) -> dict:
    return {
        "question_id": str(uuid.UUID(int=42)),
        "type": "multiple_choice",
        "config": {"prompt": "p", "options": options, "correct": correct},
        "assigned_difficulty": 5,
        "question_group_id": None,
    }


def test_present_one_emits_question_image_keys_as_null() -> None:
    out = _present_one(_mcq_legacy(["a", "b"]), _seed(), randomise_option_order=False)
    assert "reference_image_url" in out
    assert "reference_image_caption" in out
    assert out["reference_image_url"] is None
    assert out["reference_image_caption"] is None


def test_present_one_emits_question_image_keys_from_config() -> None:
    """Once future storage populates these inside ``config``,
    ``_present_one`` surfaces them through to the wire with no further
    code change."""
    q = _mcq_legacy(["a", "b"])
    q["config"]["reference_image_url"] = "https://example.test/ref.png"
    q["config"]["reference_image_caption"] = "Reference diagram"
    out = _present_one(q, _seed(), randomise_option_order=False)
    assert out["reference_image_url"] == "https://example.test/ref.png"
    assert out["reference_image_caption"] == "Reference diagram"


def test_present_one_wraps_legacy_string_options() -> None:
    """Today's storage shape (``list[str]``) is normalised to the
    dict shape on the wire so a frontend choice-renderer codes
    against a single contract."""
    out = _present_one(
        _mcq_legacy(["a", "b", "c"]), _seed(), randomise_option_order=False
    )
    options = out["config"]["options"]
    assert options == [
        {"text": "a", "image_url": None},
        {"text": "b", "image_url": None},
        {"text": "c", "image_url": None},
    ]


def test_present_one_preserves_dict_option_image_url() -> None:
    """When future storage emits ``{text, image_url}`` objects
    directly, ``_present_one`` passes ``image_url`` through unchanged."""
    q = _mcq_legacy(
        [  # type: ignore[list-item]
            {"text": "a", "image_url": "https://example.test/a.png"},
            {"text": "b", "image_url": None},
        ]
    )
    out = _present_one(q, _seed(), randomise_option_order=False)
    assert out["config"]["options"] == [
        {"text": "a", "image_url": "https://example.test/a.png"},
        {"text": "b", "image_url": None},
    ]
