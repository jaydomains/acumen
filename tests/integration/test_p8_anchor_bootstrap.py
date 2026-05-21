"""P8 Slice 2 — anchor pool bootstrap (AC-D23 bootstrap action #1).

End-to-end coverage of ``POST /v1/admin/pills/{pill_id}/anchors/generate``:
the happy path, the flag-then-pass regeneration loop, the 3-strikes
excluded-row outcome, the re-bootstrap 409 guard, and the admin role
gate. AI calls run against the :class:`RecordingProvider` seam from
``tests/integration/conftest.py`` — no network, AC-CD15 honoured.

The bootstrap loop emits **2 AI calls per slot minimum** (1 gen + 1
review) and **6 maximum** (3 + 3). Tests use small pool sizes and
narrow band ranges so each scenario runs in well under a second
without losing the asserted invariants.
"""

from __future__ import annotations

import json
import uuid
from typing import Any

from fastapi.testclient import TestClient

from app import permissions as p
from app.ai.provider import Operation
from app.models import (
    SEED_TENANT_ID,
    AnchorQuestion,
    AppUser,
    AuditLog,
    Pill,
    Question,
    Subject,
    SystemSettings,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    RecordingProvider,
    bearer,
    cat_make_user,
    seed_system_settings,
)

# --- Fixtures ---------------------------------------------------------


def _admin(session: CatalogueFakeSession, email: str = "a@kbc.com") -> AppUser:
    return cat_make_user(session, email=email, role=p.ROLE_ADMINISTRATOR)


def _testee(session: CatalogueFakeSession, email: str = "t@kbc.com") -> AppUser:
    return cat_make_user(session, email=email, role=p.ROLE_TESTEE)


def _pill(
    session: CatalogueFakeSession,
    *,
    name: str = "Lifting Operations",
    band_min: int = 5,
    band_max: int = 5,
) -> Pill:
    """Seed a Pill row + the parent Subject. Defaults to a one-band
    pill (band 5) so the smallest happy-path scenario stays small —
    individual tests widen ``band_min``/``band_max`` when they need
    multi-band coverage."""
    subject = Subject(
        tenant_id=SEED_TENANT_ID,
        name=f"subject-for-{name}",
        description=None,
    )
    session.add(subject)
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=subject.id,
        name=name,
        description="seeded by p8 slice 2 test",
        available_difficulty_min=band_min,
        available_difficulty_max=band_max,
        discoverable=True,
        safety_relevant=False,
        estimated_minutes=15,
    )
    session.add(pill)
    return pill


def _seed_settings(
    session: CatalogueFakeSession, *, pool_size: int = 2
) -> SystemSettings:
    """Seed system_settings with a small ``anchor_pool_size_per_band``
    so tests stay fast. The zero-DB harness does not apply server
    defaults, so the field is explicit here (defaults to 2 — enough
    to assert "all slots written" against "exactly N rows" without
    paying the production default's 20-slot cost)."""
    seed_system_settings(session)
    settings = session.store[SystemSettings][-1]
    settings.anchor_pool_size_per_band = pool_size
    return settings


def _seed_pill_and_admin(
    session: CatalogueFakeSession,
    *,
    pool_size: int = 2,
    band_min: int = 5,
    band_max: int = 5,
) -> tuple[AppUser, Pill]:
    _seed_settings(session, pool_size=pool_size)
    admin = _admin(session)
    pill = _pill(session, band_min=band_min, band_max=band_max)
    return admin, pill


# --- Recording-provider response shapers ------------------------------
#
# The default generation response in
# ``_default_recording_responses`` returns a TWO-question list; the
# bootstrap loop takes only ``questions[0]``. That's fine — every slot
# gets the same canned multiple_choice spec, which lets the test
# focus on the loop semantics (counters, excluded rows) without
# fixture noise.


def _ok_review_fn(payload: dict[str, Any]) -> dict[str, Any]:
    """Reviewer returns ``ok`` for every item, echoing the matching
    ``anchor_question_id`` per the AC-D23 prompt contract. The
    bootstrap loop's strict ID matching depends on this echo."""
    items = json.loads(payload["items_json"])
    return {
        "items": [
            {"anchor_question_id": item["anchor_question_id"], "verdict": "ok"}
            for item in items
        ]
    }


def _flagged_review_fn(reasoning: str) -> Any:
    """Build a reviewer fn that flags every item with the given
    reasoning. Used for the 3-strikes scenario."""

    def _fn(payload: dict[str, Any]) -> dict[str, Any]:
        items = json.loads(payload["items_json"])
        return {
            "items": [
                {
                    "anchor_question_id": item["anchor_question_id"],
                    "verdict": "flagged",
                    "reasoning": reasoning,
                }
                for item in items
            ]
        }

    return _fn


def _flag_then_pass_fn() -> Any:
    """Build a stateful reviewer: the FIRST call for any given
    ``anchor_question_id`` is flagged; every subsequent call for the
    same ID is ``ok``. Models the AC-D23 "regenerate-once-and-pass"
    happy retry case so the test can assert
    ``regeneration_attempts=1``."""
    seen: set[str] = set()

    def _fn(payload: dict[str, Any]) -> dict[str, Any]:
        out_items = []
        for item in json.loads(payload["items_json"]):
            aid = item["anchor_question_id"]
            if aid in seen:
                out_items.append({"anchor_question_id": aid, "verdict": "ok"})
            else:
                seen.add(aid)
                out_items.append(
                    {
                        "anchor_question_id": aid,
                        "verdict": "flagged",
                        "reasoning": "first attempt — regenerate",
                    }
                )
        return {"items": out_items}

    return _fn


# --- Happy path -------------------------------------------------------


def test_anchors_generate_happy_path_writes_live_anchors(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """20 anchors → 20 live rows when every review passes on the first
    attempt: 20 generation calls + 20 review calls, all live, none
    excluded. The smallest production-shape scenario."""
    admin, pill = _seed_pill_and_admin(cat_session, pool_size=20)
    recording_provider.set_response_fn(Operation.anchor_self_review, _ok_review_fn)

    r = cat_client.post(
        f"/v1/admin/pills/{pill.id}/anchors/generate",
        headers=bearer(admin),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["anchors_generated"] == 20
    assert body["anchors_excluded"] == 0
    assert body["total_generation_calls"] == 20
    assert body["total_self_review_calls"] == 20
    assert body["per_band_summary"] == [{"band": 5, "generated": 20, "excluded": 0}]

    anchors = cat_session.store.get(AnchorQuestion, [])
    assert len(anchors) == 20
    assert all(a.excluded is False for a in anchors)
    assert all(a.needs_admin_attention is False for a in anchors)
    assert all(a.regeneration_attempts == 0 for a in anchors)
    assert all(a.band == 5 for a in anchors)
    assert all(a.pill_id == pill.id for a in anchors)
    assert all(a.total_attempts == 0 for a in anchors)

    # Shared-PK convention: every AnchorQuestion.id has a matching
    # Question.id with the same UUID (the writer enforces it; the
    # downstream lookup in app/domain/competence.py:282 depends on it).
    questions = cat_session.store.get(Question, [])
    assert len(questions) == 20
    anchor_ids = {a.id for a in anchors}
    question_ids = {q.id for q in questions}
    assert anchor_ids == question_ids
    # Per-side provenance routing keeps the cost dashboard's
    # sum-to-call invariant: gen cost on Question, review cost on
    # AnchorQuestion.
    assert all(q.ai_provider == "anthropic" for q in questions)
    assert all(a.ai_provider == "anthropic" for a in anchors)


# --- Flag-then-pass regeneration --------------------------------------


def test_anchors_generate_flag_then_pass_increments_regeneration_count(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """When the first review of each slot flags but the second passes,
    expect 2 gen + 2 review calls per slot, every row live, and
    ``regeneration_attempts == 1`` on every persisted anchor."""
    admin, pill = _seed_pill_and_admin(cat_session, pool_size=3)
    recording_provider.set_response_fn(Operation.anchor_self_review, _flag_then_pass_fn())

    r = cat_client.post(
        f"/v1/admin/pills/{pill.id}/anchors/generate",
        headers=bearer(admin),
    )
    assert r.status_code == 201
    body = r.json()
    assert body["anchors_generated"] == 3
    assert body["anchors_excluded"] == 0
    assert body["total_generation_calls"] == 6
    assert body["total_self_review_calls"] == 6

    anchors = cat_session.store.get(AnchorQuestion, [])
    assert len(anchors) == 3
    assert all(a.regeneration_attempts == 1 for a in anchors)
    assert all(a.excluded is False for a in anchors)


# --- 3-strikes excluded outcome ---------------------------------------


def test_anchors_generate_three_strikes_writes_excluded_rows(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """When every review flags, expect 3 gen + 3 review calls per slot,
    every row excluded, ``needs_admin_attention=True``,
    ``regeneration_attempts=3``, and ``excluded_reason`` carrying the
    last reviewer reasoning behind the locked
    ``'self_review_3_fails: '`` prefix so the Slice 4 admin queue
    surfaces a parseable cause."""
    admin, pill = _seed_pill_and_admin(cat_session, pool_size=2)
    recording_provider.set_response_fn(
        Operation.anchor_self_review,
        _flagged_review_fn(reasoning="rubric ambiguous"),
    )

    r = cat_client.post(
        f"/v1/admin/pills/{pill.id}/anchors/generate",
        headers=bearer(admin),
    )
    assert r.status_code == 201
    body = r.json()
    assert body["anchors_generated"] == 0
    assert body["anchors_excluded"] == 2
    assert body["total_generation_calls"] == 6
    assert body["total_self_review_calls"] == 6

    anchors = cat_session.store.get(AnchorQuestion, [])
    assert len(anchors) == 2
    for a in anchors:
        assert a.excluded is True
        assert a.needs_admin_attention is True
        assert a.regeneration_attempts == 3
        assert a.excluded_reason is not None
        assert a.excluded_reason.startswith("self_review_3_fails: ")
        assert "rubric ambiguous" in a.excluded_reason


# --- Re-bootstrap guard -----------------------------------------------


def test_anchors_generate_409_when_anchors_already_exist(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """The second invocation against the same pill returns 409 —
    operator must drain the flagged queue before re-bootstrapping.
    Same guard P8 records in the handover as a deliberate spec
    deviation from AC-D23's "idempotent" wording; P11's bootstrap
    script ships true idempotent top-up."""
    admin, pill = _seed_pill_and_admin(cat_session, pool_size=2)
    recording_provider.set_response_fn(Operation.anchor_self_review, _ok_review_fn)

    first = cat_client.post(
        f"/v1/admin/pills/{pill.id}/anchors/generate",
        headers=bearer(admin),
    )
    assert first.status_code == 201

    second = cat_client.post(
        f"/v1/admin/pills/{pill.id}/anchors/generate",
        headers=bearer(admin),
    )
    assert second.status_code == 409
    body = second.json()
    assert body["error"]["code"] == "anchors_exist"
    # No additional rows written; the call short-circuits before any
    # generation or review happens.
    anchors = cat_session.store.get(AnchorQuestion, [])
    assert len(anchors) == 2


def test_anchors_generate_404_when_pill_missing(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Unknown pill id surfaces as 404 ``pill_not_found`` — no AI calls
    are made (the resolver short-circuits before generation starts)."""
    _seed_settings(cat_session, pool_size=2)
    admin = _admin(cat_session)
    recording_provider.set_response_fn(Operation.anchor_self_review, _ok_review_fn)

    r = cat_client.post(
        f"/v1/admin/pills/{uuid.uuid4()}/anchors/generate",
        headers=bearer(admin),
    )
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "pill_not_found"
    assert recording_provider.calls_for(Operation.generation) == []


# --- Admin role gate --------------------------------------------------


def test_anchors_generate_forbidden_for_non_admin(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """A Testee POSTing the bootstrap endpoint gets 403 — the
    ``_require_admin`` dependency blocks before any AI call is made."""
    _seed_settings(cat_session, pool_size=2)
    testee = _testee(cat_session)
    pill = _pill(cat_session)

    r = cat_client.post(
        f"/v1/admin/pills/{pill.id}/anchors/generate",
        headers=bearer(testee),
    )
    assert r.status_code == 403


# --- Audit log --------------------------------------------------------


def test_anchors_generate_writes_audit_log(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """Every bootstrap action records an ``anchors.bootstrap`` audit
    row with the operator + counts so a fat-fingered re-run that hits
    the 409 still has a trail. Detail includes the four counter
    fields."""
    admin, pill = _seed_pill_and_admin(cat_session, pool_size=2)
    recording_provider.set_response_fn(Operation.anchor_self_review, _ok_review_fn)

    cat_client.post(
        f"/v1/admin/pills/{pill.id}/anchors/generate",
        headers=bearer(admin),
    )

    logs = [
        row
        for row in cat_session.store.get(AuditLog, [])
        if row.action == "anchors.bootstrap"
    ]
    assert len(logs) == 1
    log = logs[0]
    assert log.actor_id == admin.id
    assert log.target_entity == "pill"
    assert log.target_id == pill.id
    assert log.detail["anchors_generated"] == 2
    assert log.detail["anchors_excluded"] == 0
    assert log.detail["total_generation_calls"] == 2
    assert log.detail["total_self_review_calls"] == 2


# --- Multi-band coverage ----------------------------------------------


def test_anchors_generate_covers_each_band_independently(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """A pill spanning bands 3-5 with pool_size=2 produces 6 anchors
    (2 per band × 3 bands), each carrying its own band stamp. Per-band
    summary mirrors the same partition."""
    admin, pill = _seed_pill_and_admin(cat_session, pool_size=2, band_min=3, band_max=5)
    recording_provider.set_response_fn(Operation.anchor_self_review, _ok_review_fn)

    r = cat_client.post(
        f"/v1/admin/pills/{pill.id}/anchors/generate",
        headers=bearer(admin),
    )
    assert r.status_code == 201
    body = r.json()
    assert body["anchors_generated"] == 6
    assert body["total_generation_calls"] == 6
    assert body["total_self_review_calls"] == 6
    assert body["per_band_summary"] == [
        {"band": 3, "generated": 2, "excluded": 0},
        {"band": 4, "generated": 2, "excluded": 0},
        {"band": 5, "generated": 2, "excluded": 0},
    ]

    anchors_by_band: dict[int, int] = {}
    for a in cat_session.store.get(AnchorQuestion, []):
        anchors_by_band[a.band] = anchors_by_band.get(a.band, 0) + 1
    assert anchors_by_band == {3: 2, 4: 2, 5: 2}


# --- Generation payload contract --------------------------------------


def test_anchors_generate_passes_band_as_target_difficulty(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
    recording_provider: RecordingProvider,
) -> None:
    """The bootstrap loop reuses the ``Operation.generation`` payload
    shape (per the planning-phase user-locked decision): ``test_name``
    is the pill name, ``target_difficulty`` is the band, and
    ``question_count`` is ``1`` (one anchor per call so per-slot
    regeneration stays local). P9 will layer Drive RAG context onto
    this same payload shape."""
    admin, pill = _seed_pill_and_admin(cat_session, pool_size=1, band_min=4, band_max=4)
    recording_provider.set_response_fn(Operation.anchor_self_review, _ok_review_fn)

    cat_client.post(
        f"/v1/admin/pills/{pill.id}/anchors/generate",
        headers=bearer(admin),
    )

    gen_calls = recording_provider.calls_for(Operation.generation)
    assert len(gen_calls) == 1
    _, _, payload = gen_calls[0]
    assert payload["test_name"] == pill.name
    assert payload["target_difficulty"] == 4
    assert payload["question_count"] == 1
    # attempt_id is the slot's anchor UUID — a fresh value per slot,
    # carrying the deterministic stub-seed contract from P5.
    assert isinstance(payload["attempt_id"], str)
    uuid.UUID(payload["attempt_id"])  # valid UUID string
