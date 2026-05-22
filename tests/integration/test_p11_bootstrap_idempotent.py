"""P11 Slice 4 — AC-D23 bootstrap orchestrator end-to-end (idempotent).

Covers :func:`app.domain.bootstrap.run_bootstrap` and the admin
endpoint ``POST /v1/admin/bootstrap/run``. The orchestrator runs the
four AC-D23 steps in sequence (anchor top-up → safety-link curation
→ Drive ingest) and is idempotent: a re-run on an already-populated
deployment surfaces all-zero counters per the AC-CD7 contract.

Zero-DB / zero-network (AC-CD15): the anchor + link + Drive paths
are all driven by their respective in-memory fakes.
"""

from __future__ import annotations

import json
import uuid
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from app import permissions as p
from app.ai.provider import Operation
from app.domain.bootstrap import run_bootstrap
from app.models import (
    SEED_TENANT_ID,
    AnchorQuestion,
    AuditLog,
    Pill,
    PillSafetyLink,
    Subject,
    SystemSettings,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    RecordingProvider,
    _FakeDrive,
    _FakeWebSearch,
    bearer,
    cat_make_user,
)

# --- helpers ----------------------------------------------------------


def _seed_settings(cat_session: CatalogueFakeSession, *, pool_size: int = 2) -> None:
    """One SystemSettings row with a small pool_size + a drive folder
    configured. The drive folder is set so the bootstrap's step 4
    runs (rather than skipping via the unconfigured branch)."""
    cat_session.add(
        SystemSettings(
            tenant_id=SEED_TENANT_ID,
            anchor_pool_size_per_band=pool_size,
            drive_folder_id="fake-folder",
            safety_keyword_list=["lift", "hazard"],
        )
    )


def _subject(cat_session: CatalogueFakeSession) -> Subject:
    subject = Subject(tenant_id=SEED_TENANT_ID, name="ops", description=None)
    cat_session.add(subject)
    return subject


def _pill(
    cat_session: CatalogueFakeSession,
    *,
    subject_id: uuid.UUID,
    name: str,
    safety_relevant: bool = False,
    band_min: int = 5,
    band_max: int = 5,
) -> Pill:
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=subject_id,
        name=name,
        description=None,
        available_difficulty_min=band_min,
        available_difficulty_max=band_max,
        discoverable=True,
        safety_relevant=safety_relevant,
    )
    cat_session.add(pill)
    return pill


def _wire_recording_provider(
    monkeypatch: pytest.MonkeyPatch, recording: RecordingProvider
) -> None:
    """Override the generation + anchor self-review responses on the
    recording provider so the bootstrap's anchor step writes live
    anchors (vs. all-excluded). Mirrors the AC-D23 prompt contract:
    review reads ``items_json`` from the payload + emits per-anchor
    verdicts in the ``items`` array."""

    def _gen_fn(payload: dict[str, Any]) -> dict[str, Any]:
        band = int(payload.get("target_difficulty", 5))
        return {
            "questions": [
                {
                    "type": "true_false",
                    "assigned_difficulty": band,
                    "config": {"prompt": "Sample.", "correct": True},
                }
            ]
        }

    def _review_fn(payload: dict[str, Any]) -> dict[str, Any]:
        items_raw = payload.get("items_json") or "[]"
        items = json.loads(items_raw) if isinstance(items_raw, str) else items_raw
        return {
            "items": [
                {"anchor_question_id": item["anchor_question_id"], "verdict": "ok"}
                for item in items
            ]
        }

    recording.set_response_fn(Operation.generation, _gen_fn)
    recording.set_response_fn(Operation.anchor_self_review, _review_fn)


def _http_client(responses: dict[str, tuple[int, bytes]]) -> httpx.AsyncClient:
    def _handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url in responses:
            status, body = responses[url]
            return httpx.Response(status_code=status, content=body)
        return httpx.Response(status_code=404, content=b"")

    return httpx.AsyncClient(transport=httpx.MockTransport(_handler))


# --- tests ------------------------------------------------------------


@pytest.mark.asyncio
async def test_bootstrap_run_populates_all_four_steps(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    fake_drive: _FakeDrive,
    fake_web_search: _FakeWebSearch,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """First-run bootstrap on a fresh deployment writes anchors for
    every pill, links for safety pills, and Drive chunks for any
    files in the folder. Telemetry counters are all non-zero."""
    _seed_settings(cat_session)
    subj = _subject(cat_session)
    _pill(cat_session, subject_id=subj.id, name="Regular pill")
    _pill(cat_session, subject_id=subj.id, name="Lift safety", safety_relevant=True)
    fake_drive.set_file("file1", text="Reference document body.")
    fake_web_search.set_default_results(
        [
            fake_web_search.make_result(url="https://osha.gov/lift-a"),
            fake_web_search.make_result(url="https://nace.org/lift-b"),
            fake_web_search.make_result(url="https://sans.org/lift-c"),
        ]
    )
    _wire_recording_provider(monkeypatch, recording_provider)
    bodies = {
        "https://osha.gov/lift-a": (200, b"osha body"),
        "https://nace.org/lift-b": (200, b"nace body"),
        "https://sans.org/lift-c": (200, b"sans body"),
    }

    async with _http_client(bodies) as client:
        result = await run_bootstrap(cat_session, http_client=client)

    assert result["pills_processed"] == 2
    assert result["anchors_generated"] > 0
    assert result["safety_pills_curated"] == 1
    assert result["safety_links_added"] >= 3
    assert result["drive_step_ran"] is True
    assert result["drive_files_added"] == 1
    assert isinstance(result["duration_seconds"], float)


@pytest.mark.asyncio
async def test_bootstrap_re_run_is_counter_zero_no_op(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    fake_drive: _FakeDrive,
    fake_web_search: _FakeWebSearch,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-CD7 idempotency contract: a re-run on an already-populated
    deployment surfaces all-zero counters for anchors + safety links.
    Drive ingest still walks the folder but reports zero diff
    (files_seen > 0 expected; files_added == 0)."""
    _seed_settings(cat_session)
    subj = _subject(cat_session)
    _pill(cat_session, subject_id=subj.id, name="Regular pill")
    _pill(cat_session, subject_id=subj.id, name="Lift safety", safety_relevant=True)
    fake_drive.set_file("file1", text="Reference document body.")
    fake_web_search.set_default_results(
        [
            fake_web_search.make_result(url="https://osha.gov/lift-a"),
            fake_web_search.make_result(url="https://nace.org/lift-b"),
            fake_web_search.make_result(url="https://sans.org/lift-c"),
        ]
    )
    _wire_recording_provider(monkeypatch, recording_provider)
    bodies = {
        "https://osha.gov/lift-a": (200, b"osha body"),
        "https://nace.org/lift-b": (200, b"nace body"),
        "https://sans.org/lift-c": (200, b"sans body"),
    }
    async with _http_client(bodies) as client:
        await run_bootstrap(cat_session, http_client=client)
        # Second run — store is already populated.
        second = await run_bootstrap(cat_session, http_client=client)

    assert second["anchors_generated"] == 0
    assert second["safety_pills_curated"] == 0
    assert second["safety_links_added"] == 0
    # Drive step still runs; files_added is zero because the hash diff
    # produced no changes between the first run's state and this re-run.
    assert second["drive_step_ran"] is True
    assert second["drive_files_added"] == 0
    assert second["drive_files_seen"] == 1


@pytest.mark.asyncio
async def test_bootstrap_adding_new_pill_only_touches_that_pill(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    fake_drive: _FakeDrive,
    fake_web_search: _FakeWebSearch,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """After a clean first run, adding a new pill + re-running
    generates anchors ONLY for that pill — existing pills' counters
    stay zero."""
    _seed_settings(cat_session)
    subj = _subject(cat_session)
    existing = _pill(cat_session, subject_id=subj.id, name="Existing pill")
    fake_web_search.set_default_results([])
    _wire_recording_provider(monkeypatch, recording_provider)

    async with _http_client({}) as client:
        await run_bootstrap(cat_session, http_client=client)
        existing_anchor_count = sum(
            1
            for a in cat_session.store.get(AnchorQuestion, [])
            if a.pill_id == existing.id
        )
        # Add a second pill post-bootstrap.
        new_pill = _pill(cat_session, subject_id=subj.id, name="New pill")
        second = await run_bootstrap(cat_session, http_client=client)

    # Only the new pill's anchors were generated this pass.
    new_anchor_count = sum(
        1 for a in cat_session.store.get(AnchorQuestion, []) if a.pill_id == new_pill.id
    )
    same_existing = sum(
        1 for a in cat_session.store.get(AnchorQuestion, []) if a.pill_id == existing.id
    )
    assert new_anchor_count > 0
    assert same_existing == existing_anchor_count  # unchanged
    assert second["anchors_generated"] == new_anchor_count


@pytest.mark.asyncio
async def test_bootstrap_skips_retired_pills(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    fake_drive: _FakeDrive,
    fake_web_search: _FakeWebSearch,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """AC-D14: retired pills are excluded from active flows. The
    bootstrap walks active pills only — a retired pill gets no
    anchors and no links."""
    _seed_settings(cat_session)
    subj = _subject(cat_session)
    retired = _pill(cat_session, subject_id=subj.id, name="Retired pill")
    retired.retired_at = p.now_utc()
    _wire_recording_provider(monkeypatch, recording_provider)

    async with _http_client({}) as client:
        result = await run_bootstrap(cat_session, http_client=client)

    assert result["pills_processed"] == 0
    assert result["anchors_generated"] == 0
    anchors_for_retired = [
        a for a in cat_session.store.get(AnchorQuestion, []) if a.pill_id == retired.id
    ]
    assert anchors_for_retired == []


@pytest.mark.asyncio
async def test_bootstrap_skips_drive_when_folder_unconfigured(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    fake_drive: _FakeDrive,
    fake_web_search: _FakeWebSearch,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When ``drive_folder_id`` is unset the orchestrator reports
    ``drive_step_ran=False`` rather than crashing the whole run.
    Steps 1-3 still execute. Operator can configure the folder + re-
    run; AC-CD7 idempotency keeps steps 1-3 counter-zero on the
    re-run."""
    cat_session.add(
        SystemSettings(
            tenant_id=SEED_TENANT_ID,
            anchor_pool_size_per_band=2,
            drive_folder_id=None,
            safety_keyword_list=["lift"],
        )
    )
    subj = _subject(cat_session)
    _pill(cat_session, subject_id=subj.id, name="Regular")
    _wire_recording_provider(monkeypatch, recording_provider)

    async with _http_client({}) as client:
        result = await run_bootstrap(cat_session, http_client=client)

    assert result["drive_step_ran"] is False
    assert result["drive_files_seen"] == 0
    # Anchor step still ran.
    assert result["pills_processed"] == 1
    assert result["anchors_generated"] >= 1


# --- admin endpoint ---------------------------------------------------


def test_bootstrap_run_endpoint_returns_telemetry(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    fake_drive: _FakeDrive,
    fake_web_search: _FakeWebSearch,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """``POST /v1/admin/bootstrap/run`` returns the
    ``BootstrapRunResult`` envelope + writes the ``bootstrap.run``
    audit row with the full telemetry."""
    _seed_settings(cat_session)
    subj = _subject(cat_session)
    _pill(cat_session, subject_id=subj.id, name="P")
    admin = cat_make_user(cat_session, email="a@kbc.com", role=p.ROLE_ADMINISTRATOR)
    _wire_recording_provider(monkeypatch, recording_provider)

    r = cat_client.post("/v1/admin/bootstrap/run", headers=bearer(admin))
    assert r.status_code == 201, r.text
    body = r.json()
    # Every field of the BootstrapRunResult envelope is present.
    expected_keys = {
        "pills_processed",
        "anchors_generated",
        "anchors_excluded",
        "safety_pills_curated",
        "safety_links_added",
        "drive_step_ran",
        "drive_files_seen",
        "drive_files_changed",
        "drive_files_added",
        "drive_files_deleted",
        "duration_seconds",
    }
    assert set(body.keys()) == expected_keys
    audits = [
        r for r in cat_session.store.get(AuditLog, []) if r.action == "bootstrap.run"
    ]
    assert len(audits) == 1
    assert audits[0].actor_id == admin.id


def test_bootstrap_run_endpoint_forbidden_for_non_admin(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Testees cannot trigger the bootstrap — the ``_require_admin``
    dependency gate holds."""
    _seed_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    r = cat_client.post("/v1/admin/bootstrap/run", headers=bearer(testee))
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_bootstrap_no_safety_pills_skips_link_curation(
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
    fake_drive: _FakeDrive,
    fake_web_search: _FakeWebSearch,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A deployment with no safety-tagged pills emits no web-search
    calls and no link rows — the orchestrator's step 3 short-
    circuits per pill."""
    _seed_settings(cat_session)
    subj = _subject(cat_session)
    _pill(cat_session, subject_id=subj.id, name="Calculus")
    _wire_recording_provider(monkeypatch, recording_provider)

    async with _http_client({}) as client:
        result = await run_bootstrap(cat_session, http_client=client)

    assert result["safety_pills_curated"] == 0
    assert result["safety_links_added"] == 0
    assert fake_web_search.search_calls == []
    assert cat_session.store.get(PillSafetyLink, []) == []
