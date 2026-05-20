"""P5 Slice 2 — pill proposal persists provenance in payload.

Asserts:
* :func:`app.domain.catalogue.enqueue_pill_proposal` invokes the
  resolved Anthropic provider's :meth:`generate` with
  :class:`Operation.pill_proposal`.
* The persisted ``processing_tasks.payload`` carries BOTH the
  ``proposal`` dict (the original P3 contract — downstream
  ``approve_pill_proposal`` keeps reading this) AND a ``provenance``
  dict with provider, model, prompt_version, tokens, cost per AC-CD8
  v1.6 final clause ("``processing_tasks.payload`` for pill proposals").
* The dev/local stub-fallback path still produces a working payload
  shape — existing P3 tests against the API endpoint stay green.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.ai.provider import Operation
from app.domain.catalogue import enqueue_pill_proposal
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    ProcessingTask,
    Subject,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    RecordingProvider,
    bearer,
    cat_make_user,
    seed_system_settings,
)


def _admin(session: CatalogueFakeSession) -> AppUser:
    return cat_make_user(session, email="a@kbc.com", role=p.ROLE_ADMINISTRATOR)


def _subject(session: CatalogueFakeSession) -> Subject:
    subject = Subject(tenant_id=SEED_TENANT_ID, name="Safety")
    session.add(subject)
    return subject


async def test_enqueue_pill_proposal_persists_provenance_in_payload(
    cat_session: CatalogueFakeSession, recording_provider: RecordingProvider
) -> None:
    """The provenance dict alongside the proposal in
    ``processing_tasks.payload`` carries the full per-call AI
    metadata so the cost dashboard's pill-proposal aggregation
    (Slice 3) can sum across queued tasks without a separate column
    on the table."""
    seed_system_settings(cat_session)
    subject = _subject(cat_session)
    recording_provider.set_response(
        Operation.pill_proposal,
        {
            "name": "Test Pill",
            "description": "Recorded description.",
            "subject_id": str(subject.id),
            "available_difficulty_min": 2,
            "available_difficulty_max": 6,
            "estimated_minutes": 15,
            "safety_relevant": False,
            "rationale": "Recorded rationale.",
        },
    )

    task = await enqueue_pill_proposal(
        cat_session,
        subject_id=subject.id,
        name="Test Pill",
        description="From the recorder.",
    )

    # Exactly one AI call.
    assert len(recording_provider.calls_for(Operation.pill_proposal)) == 1

    # Payload carries both the proposal AND the provenance dict.
    assert task.payload is not None
    assert "proposal" in task.payload
    assert "provenance" in task.payload
    prov = task.payload["provenance"]
    assert prov["provider"] == "anthropic"
    assert prov["model"] == "claude-sonnet-4-6"
    assert prov["prompt_version"] == "1.0.0-recording"
    assert prov["prompt_tokens"] == 100
    assert prov["completion_tokens"] == 50
    assert prov["cost_usd"] == pytest.approx(0.001)


async def test_enqueue_pill_proposal_proposal_shape_unchanged(
    cat_session: CatalogueFakeSession, recording_provider: RecordingProvider
) -> None:
    """The ``proposal`` sub-dict shape is the same as P3 — downstream
    ``approve_pill_proposal`` reads ``task.payload["proposal"]`` and
    must continue to work. Belt-and-braces against an accidental
    schema rename."""
    seed_system_settings(cat_session)
    subject = _subject(cat_session)

    task = await enqueue_pill_proposal(
        cat_session,
        subject_id=subject.id,
        name="Confined Space Entry",
        description="Permit-to-work workflow for confined spaces.",
    )
    proposal = task.payload["proposal"]
    assert "name" in proposal
    assert "description" in proposal
    assert "safety_relevant" in proposal
    assert "rationale" in proposal
    # The proposal shape stays AC-D7-shaped (admin approve reads
    # ``name`` + ``description`` + ``subject_id`` from this dict).
    assert "subject_id" in proposal


def test_p3_endpoint_still_works_via_stub_fallback(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """End-to-end via the HTTP endpoint with no Anthropic key (stub
    fallback). The existing P3 test contract holds: AI safety
    self-classification persists, approve writes the Pill, etc. P5
    Slice 2 additionally writes provenance into the payload."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    h = bearer(admin)
    subject_id = cat_client.post(
        "/v1/subjects", headers=h, json={"name": "Safety"}
    ).json()["id"]

    r = cat_client.post(
        "/v1/pill-proposals",
        headers=h,
        json={
            "subject_id": subject_id,
            "name": "Proposed: confined space entry",
            "description": "Stub fallback test.",
            "available_difficulty_min": 2,
            "available_difficulty_max": 6,
        },
    )
    assert r.status_code == 201, r.text

    # Stub provenance persists in payload even on the fallback path.
    task = cat_session.store.get(ProcessingTask, [])[0]
    prov = task.payload["provenance"]
    assert prov["provider"] == "stub"
    assert prov["cost_usd"] == 0.0
    # Stub keyword-cue self-classification still works.
    assert task.payload["proposal"]["safety_relevant"] is True
