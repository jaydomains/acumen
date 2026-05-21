"""P8 Slice 4 — anchor flag queue + per-row resolution (AC-D23).

Covers ``GET /v1/admin/anchors/flagged`` and
``POST /v1/admin/anchors/{anchor_id}/resolve``.

Resolve actions (AC-D23): ``keep`` (accept AI wording),
``substitute_wording`` (admin rewrites ``config`` — does NOT auto-rerun
self-review because admin is the authoritative reviewer of their own
substitution), ``reject`` (acknowledge the excluded slot stays
excluded).
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import (
    SEED_TENANT_ID,
    AnchorQuestion,
    AppUser,
    AuditLog,
    Pill,
    Question,
    QuestionType,
    Subject,
)
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
    seed_system_settings,
)


def _admin(s: CatalogueFakeSession) -> AppUser:
    return cat_make_user(s, email="a@kbc.com", role=p.ROLE_ADMINISTRATOR)


def _testee(s: CatalogueFakeSession) -> AppUser:
    return cat_make_user(s, email="t@kbc.com", role=p.ROLE_TESTEE)


def _pill(s: CatalogueFakeSession) -> Pill:
    sub = Subject(tenant_id=SEED_TENANT_ID, name="ops", description="")
    s.add(sub)
    pill = Pill(
        tenant_id=SEED_TENANT_ID,
        subject_id=sub.id,
        name="Lifting",
        description="",
        available_difficulty_min=1,
        available_difficulty_max=10,
        discoverable=True,
        safety_relevant=False,
    )
    s.add(pill)
    return pill


def _seed_flagged_anchor(
    s: CatalogueFakeSession,
    *,
    pill: Pill,
    excluded: bool = True,
    excluded_reason: str | None = "self_review_3_fails: ambiguous wording",
    regeneration_attempts: int = 3,
) -> AnchorQuestion:
    """Seed a matched (Question, AnchorQuestion) pair with
    ``needs_admin_attention=True`` — the shape the Slice 2 bootstrap
    loop writes when an anchor fails 3 generate→review cycles."""
    aid = uuid.uuid4()
    s.add(
        Question(
            id=aid,
            tenant_id=SEED_TENANT_ID,
            pill_id=pill.id,
            type=QuestionType.multiple_choice,
            config={"prompt": "bad q", "options": ["a", "b"], "correct": 0},
            assigned_difficulty=5,
            realism_flag_count=0,
        )
    )
    anchor = AnchorQuestion(
        id=aid,
        tenant_id=SEED_TENANT_ID,
        pill_id=pill.id,
        band=5,
        type=QuestionType.multiple_choice,
        config={"prompt": "bad q", "options": ["a", "b"], "correct": 0},
        assigned_difficulty=5,
        regeneration_attempts=regeneration_attempts,
        excluded=excluded,
        excluded_reason=excluded_reason,
        needs_admin_attention=True,
    )
    s.add(anchor)
    return anchor


# --- GET flagged list -------------------------------------------------


def test_anchors_flagged_returns_oldest_first(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """The queue is oldest-first by ``created_at`` so the admin works
    through the backlog in arrival order — mirrors P6 grade-review +
    P7 loop admin queue ordering."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    pill = _pill(cat_session)
    _seed_flagged_anchor(cat_session, pill=pill)
    _seed_flagged_anchor(cat_session, pill=pill)

    r = cat_client.get("/v1/admin/anchors/flagged", headers=bearer(admin))
    assert r.status_code == 200, r.text
    body = r.json()
    assert len(body["data"]) == 2
    for item in body["data"]:
        assert item["excluded"] is True
        assert item["excluded_reason"] is not None
        assert item["excluded_reason"].startswith("self_review_3_fails:")
        assert item["regeneration_attempts"] == 3


def test_anchors_flagged_empty_when_no_attention_needed(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Live anchors (``needs_admin_attention=False``) don't show up
    on the queue — the surface is just for slots awaiting admin
    decision."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)

    r = cat_client.get("/v1/admin/anchors/flagged", headers=bearer(admin))
    assert r.status_code == 200
    assert r.json()["data"] == []


def test_anchors_flagged_forbidden_for_non_admin(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    r = cat_client.get("/v1/admin/anchors/flagged", headers=bearer(testee))
    assert r.status_code == 403


# --- POST resolve: keep -----------------------------------------------


def test_resolve_keep_clears_flags_and_enters_pool(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """``keep`` accepts the AI wording as-is: clears ``excluded`` +
    ``needs_admin_attention`` so the anchor enters the live pool. An
    audit row at ``anchors.resolve`` records the operator."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    pill = _pill(cat_session)
    anchor = _seed_flagged_anchor(cat_session, pill=pill)

    r = cat_client.post(
        f"/v1/admin/anchors/{anchor.id}/resolve",
        headers=bearer(admin),
        json={"action": "keep"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["action"] == "keep"
    assert body["excluded"] is False
    assert body["needs_admin_attention"] is False
    # Row state was mutated in place.
    assert anchor.excluded is False
    assert anchor.needs_admin_attention is False
    assert anchor.excluded_reason is None
    # Audit row written with the right action + actor.
    audits = [
        row
        for row in cat_session.store.get(AuditLog, [])
        if row.action == "anchors.resolve"
    ]
    assert len(audits) == 1
    assert audits[0].actor_id == admin.id
    assert audits[0].target_id == anchor.id
    assert audits[0].detail["action"] == "keep"


# --- POST resolve: substitute_wording ---------------------------------


def test_resolve_substitute_wording_updates_config_and_resets_counter(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """``substitute_wording`` requires ``new_config`` and: replaces
    ``config`` on both the AnchorQuestion AND the shared-PK Question
    row (snapshot rendering depends on the Question); clears flags;
    resets ``regeneration_attempts`` to 0. The shared-PK keep-in-sync
    invariant is what lets the snapshot pick up the substituted
    wording without a separate flush."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    pill = _pill(cat_session)
    anchor = _seed_flagged_anchor(cat_session, pill=pill)
    substituted = {
        "prompt": "admin-rewritten q",
        "options": ["a", "b", "c"],
        "correct": 2,
    }

    r = cat_client.post(
        f"/v1/admin/anchors/{anchor.id}/resolve",
        headers=bearer(admin),
        json={"action": "substitute_wording", "new_config": substituted},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["action"] == "substitute_wording"
    assert body["excluded"] is False
    assert body["regeneration_attempts"] == 0
    # AnchorQuestion + the shared-PK Question both carry the new config.
    assert anchor.config == substituted
    questions = [q for q in cat_session.store.get(Question, []) if q.id == anchor.id]
    assert len(questions) == 1
    assert questions[0].config == substituted


def test_resolve_substitute_wording_without_new_config_is_409(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """``substitute_wording`` without ``new_config`` is a 409 —
    nonsensical action+state combo. The error envelope carries the
    ``missing_new_config`` code so the operator can fix the request."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    pill = _pill(cat_session)
    anchor = _seed_flagged_anchor(cat_session, pill=pill)

    r = cat_client.post(
        f"/v1/admin/anchors/{anchor.id}/resolve",
        headers=bearer(admin),
        json={"action": "substitute_wording"},
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "missing_new_config"
    # Row state preserved on rejection.
    assert anchor.excluded is True
    assert anchor.needs_admin_attention is True


# --- POST resolve: reject ---------------------------------------------


def test_resolve_reject_keeps_excluded_clears_attention(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """``reject`` acknowledges the excluded slot stays excluded —
    ``excluded=True`` preserved, ``needs_admin_attention=False`` so
    the row falls off the queue but remains permanently out of the
    live draw pool."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    pill = _pill(cat_session)
    anchor = _seed_flagged_anchor(cat_session, pill=pill)

    r = cat_client.post(
        f"/v1/admin/anchors/{anchor.id}/resolve",
        headers=bearer(admin),
        json={"action": "reject"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["action"] == "reject"
    assert body["excluded"] is True
    assert body["needs_admin_attention"] is False
    # Verify the row is gone from the queue.
    listing = cat_client.get("/v1/admin/anchors/flagged", headers=bearer(admin))
    assert listing.json()["data"] == []


# --- Error paths ------------------------------------------------------


def test_resolve_404_on_missing_anchor(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    r = cat_client.post(
        f"/v1/admin/anchors/{uuid.uuid4()}/resolve",
        headers=bearer(admin),
        json={"action": "keep"},
    )
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "anchor_not_found"


def test_resolve_409_when_anchor_not_flagged(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Re-resolving an already-resolved anchor returns 409 — the
    state machine guards against double-action. Mirrors the P6
    ``grade_review_not_flagged`` 409 guard."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    pill = _pill(cat_session)
    anchor = _seed_flagged_anchor(cat_session, pill=pill)
    # First resolution clears the flag.
    cat_client.post(
        f"/v1/admin/anchors/{anchor.id}/resolve",
        headers=bearer(admin),
        json={"action": "keep"},
    )
    # Second resolution against the same row is rejected.
    r = cat_client.post(
        f"/v1/admin/anchors/{anchor.id}/resolve",
        headers=bearer(admin),
        json={"action": "keep"},
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "anchor_not_flagged"


def test_resolve_422_on_invalid_action(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    """Pydantic catches invalid action enum values before the request
    reaches the domain — 422 from the framework validator."""
    seed_system_settings(cat_session)
    admin = _admin(cat_session)
    pill = _pill(cat_session)
    anchor = _seed_flagged_anchor(cat_session, pill=pill)

    r = cat_client.post(
        f"/v1/admin/anchors/{anchor.id}/resolve",
        headers=bearer(admin),
        json={"action": "delete"},
    )
    assert r.status_code == 422


def test_resolve_forbidden_for_non_admin(
    cat_client: TestClient,
    cat_session: CatalogueFakeSession,
) -> None:
    seed_system_settings(cat_session)
    testee = _testee(cat_session)
    pill = _pill(cat_session)
    anchor = _seed_flagged_anchor(cat_session, pill=pill)
    r = cat_client.post(
        f"/v1/admin/anchors/{anchor.id}/resolve",
        headers=bearer(testee),
        json={"action": "keep"},
    )
    assert r.status_code == 403
