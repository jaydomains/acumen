"""AC-D8 self-directed learning material — Testee-facing endpoint.

Implements the previously-unbuilt half of AC-D8: Testees can now POST
``/v1/pills/{pill_id}/learning-material`` and receive an AI-generated
overview (non-safety pills) or the pill's curated external links
(safety pills, AC-D21). 30-day cohort cache keyed on pill, cache
self-healing across an admin safety toggle, ``?regenerate=true`` forces
a fresh generation. The audit log records every serve event with a
``learning_material.self_*`` action.

The weakness-driven path (P5 / P7 loop) is exercised by
``test_p5_material.py``; this file covers only the new
``generate_self_initiated`` callable and the router endpoint that
fronts it.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest

from app import permissions as p
from app.ai.provider import Operation
from app.models import (
    SEED_TENANT_ID,
    AuditLog,
    LearningMaterial,
    LearningMaterialSource,
    Pill,
    PillSafetyLink,
    Subject,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    RecordingProvider,
    bearer,
    cat_make_user,
    seed_system_settings,
)

_ENDPOINT = "/v1/pills/{pill_id}/learning-material"


def _seed_pill(
    session: CatalogueFakeSession,
    *,
    name: str = "Parapet Detailing",
    description: str = "Roof-edge upstand detailing for waterproofing.",
    safety_relevant: bool = False,
    discoverable: bool = True,
    retired: bool = False,
) -> Pill:
    subject = Subject(tenant_id=SEED_TENANT_ID, name="Roofing")
    session.add(subject)
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=subject.id,
        name=name,
        description=description,
        available_difficulty_min=1,
        available_difficulty_max=10,
        discoverable=discoverable,
        safety_relevant=safety_relevant,
    )
    if retired:
        pill.retired_at = p.now_utc()
    session.add(pill)
    return pill


def _seed_safety_link(
    session: CatalogueFakeSession, *, pill_id: uuid.UUID, url: str
) -> PillSafetyLink:
    link = PillSafetyLink(
        tenant_id=SEED_TENANT_ID,
        pill_id=pill_id,
        url=url,
        title="OSHA reference",
        source="osha.gov",
        last_verified_at=p.now_utc(),
        content_hash="deadbeef" * 8,
    )
    session.add(link)
    return link


def _audit_actions(session: CatalogueFakeSession) -> list[str]:
    return [row.action for row in session.store.get(AuditLog, [])]


def _learning_material_rows(session: CatalogueFakeSession) -> list[LearningMaterial]:
    return list(session.store.get(LearningMaterial, []))


# --- 1. happy path ---------------------------------------------------


def test_self_initiated_happy_path_writes_ai_material_with_provenance(
    cat_session: CatalogueFakeSession,
    cat_client,
    recording_provider: RecordingProvider,
) -> None:
    seed_system_settings(cat_session)
    pill = _seed_pill(cat_session)
    user = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    recording_provider.set_response(
        Operation.learning_material,
        {"explainer": "Self-initiated overview of parapet detailing."},
    )

    response = cat_client.post(_ENDPOINT.format(pill_id=pill.id), headers=bearer(user))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["pill_id"] == str(pill.id)
    assert body["source"] == "ai_generated"
    assert body["content"] == "Self-initiated overview of parapet detailing."
    assert body["safety_links"] is None
    assert body["cached"] is False
    assert body["served_at"] is not None

    # Exactly one AI call, on the learning_material op, with the
    # self_initiated prompt variant signalled.
    calls = recording_provider.calls_for(Operation.learning_material)
    assert len(calls) == 1
    _, _, payload = calls[0]
    assert payload.get("_prompt_variant") == "self_initiated"
    assert payload["pill_name"] == "Parapet Detailing"
    # No severity / wrong_questions in the self-initiated payload
    # (the prompt is reframed as an overview).
    assert "severity" not in payload
    assert "wrong_questions" not in payload

    # Row persisted with full provenance + F18 snapshots.
    rows = _learning_material_rows(cat_session)
    assert len(rows) == 1
    row = rows[0]
    assert row.source == LearningMaterialSource.ai_generated
    assert row.weakness_report_id is None
    assert row.testee_id == user.id
    assert row.ai_provider == "anthropic"
    assert row.ai_model == "claude-sonnet-4-6"
    assert row.ai_prompt_version == "1.0.0-recording"
    assert row.ai_cost_usd == pytest.approx(0.001)
    assert row.served_text == row.content

    actions = _audit_actions(cat_session)
    assert "learning_material.self_request" in actions
    audit_row = next(
        r
        for r in cat_session.store[AuditLog]
        if r.action == "learning_material.self_request"
    )
    assert audit_row.actor_id == user.id
    assert audit_row.target_entity == "learning_material"
    assert audit_row.detail["cached"] is False
    assert audit_row.detail["source"] == "ai_generated"


def test_self_initiated_empty_explainer_response_returns_502(
    cat_session: CatalogueFakeSession,
    cat_client,
    recording_provider: RecordingProvider,
) -> None:
    """The AI provider returns valid JSON without an ``explainer`` key
    (or with an empty one). Fail fast with 502 ``ai_generation_failed``
    — persisting an empty row would pollute the 30-day cohort cache and
    surface a blank UI to the next reader. No row written, no audit
    written; the request is retryable (Gitar PR-#31 finding)."""
    seed_system_settings(cat_session)
    pill = _seed_pill(cat_session)
    user = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    recording_provider.set_response(Operation.learning_material, {"explainer": "   "})

    response = cat_client.post(_ENDPOINT.format(pill_id=pill.id), headers=bearer(user))

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "ai_generation_failed"
    # AI call happened but no LearningMaterial row was written, and no
    # audit row recorded the (failed) serve.
    assert len(recording_provider.calls_for(Operation.learning_material)) == 1
    assert _learning_material_rows(cat_session) == []
    assert "learning_material.self_request" not in _audit_actions(cat_session)


# --- 2. cached cohort path ------------------------------------------


def test_self_initiated_within_window_returns_cached_row_no_ai_call(
    cat_session: CatalogueFakeSession,
    cat_client,
    recording_provider: RecordingProvider,
) -> None:
    """30-day cohort cache — second Testee asking for the same pill
    within the window gets the row another Testee triggered. Provider
    is NOT called; audit row carries cached=True."""
    seed_system_settings(cat_session)
    pill = _seed_pill(cat_session)
    first_user = cat_make_user(cat_session, email="a@kbc.com", role=p.ROLE_TESTEE)
    second_user = cat_make_user(cat_session, email="b@kbc.com", role=p.ROLE_TESTEE)

    # Pre-seed a 5-day-old ai_generated row triggered by the first user.
    seeded = LearningMaterial(
        tenant_id=SEED_TENANT_ID,
        pill_id=pill.id,
        testee_id=first_user.id,
        weakness_report_id=None,
        source=LearningMaterialSource.ai_generated,
        content="Pre-seeded explainer.",
        served_at=p.now_utc() - timedelta(days=5),
        served_text="Pre-seeded explainer.",
    )
    cat_session.add(seeded)
    seeded.created_at = p.now_utc() - timedelta(days=5)

    response = cat_client.post(
        _ENDPOINT.format(pill_id=pill.id), headers=bearer(second_user)
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["cached"] is True
    assert body["id"] == str(seeded.id)
    assert body["content"] == "Pre-seeded explainer."

    # Provider NOT called — the whole cost win of the cache.
    assert recording_provider.calls_for(Operation.learning_material) == []

    # No new row written — still one row.
    assert len(_learning_material_rows(cat_session)) == 1

    # Audit row records the cached serve.
    audit_rows = [
        r
        for r in cat_session.store[AuditLog]
        if r.action == "learning_material.self_request"
    ]
    assert len(audit_rows) == 1
    assert audit_rows[0].actor_id == second_user.id
    assert audit_rows[0].detail["cached"] is True


# --- 3. stale cache --------------------------------------------------


def test_self_initiated_outside_window_regenerates(
    cat_session: CatalogueFakeSession,
    cat_client,
    recording_provider: RecordingProvider,
) -> None:
    """A row older than the 30-day window is treated as a cache miss
    — provider IS called and a fresh row is written."""
    seed_system_settings(cat_session)
    pill = _seed_pill(cat_session)
    user = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)

    stale = LearningMaterial(
        tenant_id=SEED_TENANT_ID,
        pill_id=pill.id,
        testee_id=user.id,
        weakness_report_id=None,
        source=LearningMaterialSource.ai_generated,
        content="Stale explainer.",
        served_at=p.now_utc() - timedelta(days=31),
        served_text="Stale explainer.",
    )
    cat_session.add(stale)
    stale.created_at = p.now_utc() - timedelta(days=31)

    response = cat_client.post(_ENDPOINT.format(pill_id=pill.id), headers=bearer(user))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["cached"] is False
    assert len(recording_provider.calls_for(Operation.learning_material)) == 1
    # Two rows now — stale + fresh.
    assert len(_learning_material_rows(cat_session)) == 2


# --- 4. regenerate ---------------------------------------------------


def test_self_initiated_regenerate_query_forces_fresh_generation(
    cat_session: CatalogueFakeSession,
    cat_client,
    recording_provider: RecordingProvider,
) -> None:
    """?regenerate=true skips the cache lookup and forces a fresh AI
    call — audit row records the explicit user gesture as
    learning_material.self_regenerate."""
    seed_system_settings(cat_session)
    pill = _seed_pill(cat_session)
    user = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)

    fresh = LearningMaterial(
        tenant_id=SEED_TENANT_ID,
        pill_id=pill.id,
        testee_id=user.id,
        weakness_report_id=None,
        source=LearningMaterialSource.ai_generated,
        content="Fresh-cached explainer.",
        served_at=p.now_utc() - timedelta(days=5),
        served_text="Fresh-cached explainer.",
    )
    cat_session.add(fresh)
    fresh.created_at = p.now_utc() - timedelta(days=5)

    response = cat_client.post(
        _ENDPOINT.format(pill_id=pill.id) + "?regenerate=true",
        headers=bearer(user),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["cached"] is False
    assert len(recording_provider.calls_for(Operation.learning_material)) == 1
    # Two rows — cached + new fresh.
    assert len(_learning_material_rows(cat_session)) == 2

    actions = _audit_actions(cat_session)
    assert "learning_material.self_regenerate" in actions
    audit = next(
        r
        for r in cat_session.store[AuditLog]
        if r.action == "learning_material.self_regenerate"
    )
    assert audit.detail["regenerate"] is True
    assert audit.detail["cached"] is False


# --- 5. permission gates --------------------------------------------


def test_self_initiated_unauthenticated_returns_401(
    cat_session: CatalogueFakeSession, cat_client
) -> None:
    seed_system_settings(cat_session)
    pill = _seed_pill(cat_session)
    response = cat_client.post(_ENDPOINT.format(pill_id=pill.id))
    assert response.status_code == 401


def test_self_initiated_unacked_privacy_returns_403(
    cat_session: CatalogueFakeSession, cat_client
) -> None:
    from app.models import AppUser, UserStatus

    seed_system_settings(cat_session)
    pill = _seed_pill(cat_session)
    user = AppUser(
        tenant_id=SEED_TENANT_ID,
        email="np@kbc.com",
        name="np",
        role=p.ROLE_TESTEE,
        password_hash=p.UNUSABLE_PASSWORD_HASH,
        status=UserStatus.active,
    )
    # Deliberately leave privacy_ack_at unset.
    cat_session.add(user)

    response = cat_client.post(_ENDPOINT.format(pill_id=pill.id), headers=bearer(user))
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "privacy_not_acknowledged"


def test_self_initiated_deactivated_returns_403(
    cat_session: CatalogueFakeSession, cat_client
) -> None:
    from app.models import AppUser, UserStatus

    seed_system_settings(cat_session)
    pill = _seed_pill(cat_session)
    user = AppUser(
        tenant_id=SEED_TENANT_ID,
        email="d@kbc.com",
        name="d",
        role=p.ROLE_TESTEE,
        password_hash=p.UNUSABLE_PASSWORD_HASH,
        status=UserStatus.deactivated,
    )
    user.privacy_ack_at = p.now_utc()
    cat_session.add(user)

    response = cat_client.post(_ENDPOINT.format(pill_id=pill.id), headers=bearer(user))
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "account_deactivated"


# --- 6. lifecycle / shape -------------------------------------------


def test_self_initiated_unknown_pill_returns_404(
    cat_session: CatalogueFakeSession, cat_client
) -> None:
    seed_system_settings(cat_session)
    user = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    response = cat_client.post(
        _ENDPOINT.format(pill_id=uuid.uuid4()), headers=bearer(user)
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_self_initiated_retired_pill_returns_404(
    cat_session: CatalogueFakeSession, cat_client
) -> None:
    """Retired pills are indistinguishable from missing on the Testee
    surface per the AC-D14 / list_discoverable_pills convention."""
    seed_system_settings(cat_session)
    pill = _seed_pill(cat_session, retired=True)
    user = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    response = cat_client.post(_ENDPOINT.format(pill_id=pill.id), headers=bearer(user))
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_self_initiated_safety_pill_returns_curated_links_no_ai_call(
    cat_session: CatalogueFakeSession,
    cat_client,
    recording_provider: RecordingProvider,
) -> None:
    """AC-D21 mirror of P7 loop: safety pills receive curated external
    links, never AI explainers. The LearningMaterial row carries
    source=curated_safety_links and the AI provenance columns stay
    None (no spend)."""
    seed_system_settings(cat_session)
    pill = _seed_pill(cat_session, name="Working at Height", safety_relevant=True)
    _seed_safety_link(cat_session, pill_id=pill.id, url="https://example.org/fall-1")
    _seed_safety_link(cat_session, pill_id=pill.id, url="https://example.org/fall-2")
    user = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)

    response = cat_client.post(_ENDPOINT.format(pill_id=pill.id), headers=bearer(user))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["source"] == "curated_safety_links"
    assert body["content"] is None
    assert body["cached"] is False
    assert isinstance(body["safety_links"], list)
    assert len(body["safety_links"]) == 2
    assert {link["url"] for link in body["safety_links"]} == {
        "https://example.org/fall-1",
        "https://example.org/fall-2",
    }

    # No AI call.
    assert recording_provider.calls_for(Operation.learning_material) == []

    # LearningMaterial row written with provenance fields untouched.
    rows = _learning_material_rows(cat_session)
    assert len(rows) == 1
    row = rows[0]
    assert row.source == LearningMaterialSource.curated_safety_links
    assert row.ai_provider is None
    assert row.ai_cost_usd is None
    assert row.content is None

    audit_rows = [
        r
        for r in cat_session.store[AuditLog]
        if r.action == "learning_material.self_request"
    ]
    assert len(audit_rows) == 1
    assert audit_rows[0].detail["source"] == "curated_safety_links"


def test_self_initiated_safety_pill_with_no_curated_links_returns_422(
    cat_session: CatalogueFakeSession,
    cat_client,
    recording_provider: RecordingProvider,
) -> None:
    seed_system_settings(cat_session)
    pill = _seed_pill(cat_session, name="Asbestos Handling", safety_relevant=True)
    user = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)

    response = cat_client.post(_ENDPOINT.format(pill_id=pill.id), headers=bearer(user))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "curation_pending"

    # No row written, no AI call, no audit row.
    assert _learning_material_rows(cat_session) == []
    assert recording_provider.calls_for(Operation.learning_material) == []
    assert "learning_material.self_request" not in _audit_actions(cat_session)


# --- 7. cache safety-source mismatch (toggle self-heal) -------------


def test_self_initiated_safety_toggle_invalidates_ai_cache(
    cat_session: CatalogueFakeSession,
    cat_client,
    recording_provider: RecordingProvider,
) -> None:
    """Non-safety → safety toggle. A fresh ai_generated row exists for
    a pill that is now safety-tagged; serving that AI content would
    violate AC-D21. Cache lookup filters by current pill safety state,
    so the AI row is treated as a miss and the curated-links branch
    runs."""
    seed_system_settings(cat_session)
    pill = _seed_pill(cat_session, name="Fall Protection")
    user = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)

    # Seed a 5-day-old AI-generated row from when the pill was
    # non-safety.
    stale_ai = LearningMaterial(
        tenant_id=SEED_TENANT_ID,
        pill_id=pill.id,
        testee_id=user.id,
        weakness_report_id=None,
        source=LearningMaterialSource.ai_generated,
        content="Pre-toggle AI overview.",
        served_at=p.now_utc() - timedelta(days=5),
        served_text="Pre-toggle AI overview.",
    )
    cat_session.add(stale_ai)
    stale_ai.created_at = p.now_utc() - timedelta(days=5)

    # Admin toggles safety_relevant=True and curation populates links.
    pill.safety_relevant = True
    _seed_safety_link(cat_session, pill_id=pill.id, url="https://example.org/fall-3")

    response = cat_client.post(_ENDPOINT.format(pill_id=pill.id), headers=bearer(user))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["source"] == "curated_safety_links"
    assert body["content"] is None
    assert body["cached"] is False
    assert body["id"] != str(stale_ai.id)

    # Provider NOT called (safety path).
    assert recording_provider.calls_for(Operation.learning_material) == []

    # Two rows now: the stale AI one (untouched) and the new curated.
    rows = _learning_material_rows(cat_session)
    assert len(rows) == 2
    sources = {r.source for r in rows}
    assert sources == {
        LearningMaterialSource.ai_generated,
        LearningMaterialSource.curated_safety_links,
    }


def test_self_initiated_safety_to_nonsafety_toggle_invalidates_links_cache(
    cat_session: CatalogueFakeSession,
    cat_client,
    recording_provider: RecordingProvider,
) -> None:
    """Symmetric inverse: a fresh curated_safety_links row exists for a
    pill that is now non-safety. The AI path must run (not the
    curated-links serve)."""
    seed_system_settings(cat_session)
    pill = _seed_pill(cat_session, name="Edge of Roof", safety_relevant=True)
    user = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)

    stale_links = LearningMaterial(
        tenant_id=SEED_TENANT_ID,
        pill_id=pill.id,
        testee_id=user.id,
        weakness_report_id=None,
        source=LearningMaterialSource.curated_safety_links,
        content=None,
        served_at=p.now_utc() - timedelta(days=5),
        served_text=None,
    )
    cat_session.add(stale_links)
    stale_links.created_at = p.now_utc() - timedelta(days=5)

    # Admin toggles safety_relevant=False.
    pill.safety_relevant = False

    response = cat_client.post(_ENDPOINT.format(pill_id=pill.id), headers=bearer(user))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["source"] == "ai_generated"
    assert body["content"]  # non-empty explainer
    assert body["cached"] is False

    # Provider IS called.
    assert len(recording_provider.calls_for(Operation.learning_material)) == 1

    rows = _learning_material_rows(cat_session)
    assert len(rows) == 2
    sources = {r.source for r in rows}
    assert sources == {
        LearningMaterialSource.ai_generated,
        LearningMaterialSource.curated_safety_links,
    }
