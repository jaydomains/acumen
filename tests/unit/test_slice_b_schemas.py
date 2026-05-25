"""Slice B — Pydantic schema validation for the 5 new endpoints.

Pure validation tests — required fields, enum literals, optional null
handling. No DB / no FastAPI.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.models import AttemptOrigin
from app.schemas import (
    AttemptListItem,
    MeCompetencePill,
    MeCompetenceResponse,
    SetupPreviewResponse,
    TestResolveResponse,
)


def test_setup_preview_response_requires_email() -> None:
    SetupPreviewResponse(email="tess@kbc.com")
    with pytest.raises(ValidationError):
        SetupPreviewResponse()  # type: ignore[call-arg]


def test_test_resolve_response_requires_test_id() -> None:
    TestResolveResponse(test_id=uuid.uuid4())
    with pytest.raises(ValidationError):
        TestResolveResponse(test_id="not-a-uuid")  # type: ignore[arg-type]


def test_me_competence_pill_band_literal_enforced() -> None:
    pid = uuid.uuid4()
    sid = uuid.uuid4()
    MeCompetencePill(
        pill_id=pid,
        pill_name="Antifouling",
        subject_id=sid,
        competence_estimate=6.5,
        band="working",
        n=21,
        confidence="confident",
        last_activity_at=datetime.now(UTC),
        related_pill_ids=[],
        safety_relevant=False,
    )
    with pytest.raises(ValidationError):
        MeCompetencePill(
            pill_id=pid,
            pill_name="X",
            subject_id=sid,
            competence_estimate=6.5,
            band="not-a-band",  # type: ignore[arg-type]
            n=21,
            confidence="confident",
            last_activity_at=None,
            related_pill_ids=[],
            safety_relevant=False,
        )


def test_me_competence_pill_allows_null_estimate_and_activity() -> None:
    MeCompetencePill(
        pill_id=uuid.uuid4(),
        pill_name="Fresh Pill",
        subject_id=uuid.uuid4(),
        competence_estimate=None,
        band="novice",
        n=0,
        confidence="preliminary",
        last_activity_at=None,
        related_pill_ids=[],
        safety_relevant=False,
    )


def test_me_competence_response_empty_pills_ok() -> None:
    assert MeCompetenceResponse(pills=[]).pills == []


def test_attempt_list_item_competence_delta_defaults_null() -> None:
    item = AttemptListItem(
        attempt_id=uuid.uuid4(),
        pill_id=uuid.uuid4(),
        pill_name="Adhesion Testing",
        submitted_at=datetime.now(UTC),
        score_percent=72.5,
        band="working",
        origin=AttemptOrigin.self_initiated,
    )
    assert item.competence_delta is None


def test_attempt_list_item_confidence_literal_enforced() -> None:
    with pytest.raises(ValidationError):
        AttemptListItem(
            attempt_id=uuid.uuid4(),
            pill_id=uuid.uuid4(),
            pill_name="X",
            submitted_at=datetime.now(UTC),
            score_percent=50.0,
            band="boss",  # type: ignore[arg-type]
            origin=AttemptOrigin.self_initiated,
        )
