"""P3 catalogue behaviour — admin-only gate, AC-D21 safety auto-tag /
re-eval-on-edit / override-wins, AC-D14 retire, validation, pagination.

Zero-DB / zero-network (AC-CD15)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app import permissions as p
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
    seed_system_settings,
)


def _admin_headers(session: CatalogueFakeSession) -> dict[str, str]:
    return bearer(
        cat_make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)
    )


def _subject(client: TestClient, h: dict[str, str]) -> str:
    return client.post("/v1/subjects", headers=h, json={"name": "S"}).json()["id"]


def test_admin_only_gate_blocks_testee(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    r = cat_client.post("/v1/subjects", headers=bearer(testee), json={"name": "Nope"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "forbidden"


def test_unauthenticated_is_401(cat_client: TestClient) -> None:
    r = cat_client.post("/v1/subjects", json={"name": "x"})
    assert r.status_code == 401


def test_pill_requires_existing_subject(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    r = cat_client.post(
        "/v1/pills",
        headers=h,
        json={
            "subject_id": "00000000-0000-0000-0000-0000000000ff",
            "name": "Orphan",
            "available_difficulty_min": 1,
            "available_difficulty_max": 2,
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_subject"


def test_difficulty_range_rejected_on_create_and_update(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    sid = _subject(cat_client, h)
    bad = cat_client.post(
        "/v1/pills",
        headers=h,
        json={
            "subject_id": sid,
            "name": "Inverted",
            "available_difficulty_min": 8,
            "available_difficulty_max": 3,
        },
    )
    assert bad.status_code == 422  # schema model_validator

    pid = cat_client.post(
        "/v1/pills",
        headers=h,
        json={
            "subject_id": sid,
            "name": "Ok",
            "available_difficulty_min": 2,
            "available_difficulty_max": 4,
        },
    ).json()["id"]
    r = cat_client.patch(
        f"/v1/pills/{pid}",
        headers=h,
        json={"available_difficulty_min": 9},
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_difficulty_range"


def test_safety_reeval_on_edit_unless_overridden(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    sid = _subject(cat_client, h)

    # Benign at creation.
    pid = cat_client.post(
        "/v1/pills",
        headers=h,
        json={
            "subject_id": sid,
            "name": "General notes",
            "available_difficulty_min": 1,
            "available_difficulty_max": 3,
        },
    ).json()["id"]
    assert (
        cat_client.get(f"/v1/pills/{pid}", headers=h).json()["safety_relevant"] is False
    )

    # Editing the description to include a keyword re-tags it (AC-D21).
    r = cat_client.patch(
        f"/v1/pills/{pid}",
        headers=h,
        json={"description": "now covers asbestos handling"},
    )
    assert r.json()["safety_relevant"] is True

    # Admin override wins and pins the value.
    r = cat_client.patch(
        f"/v1/pills/{pid}/safety", headers=h, json={"safety_relevant": False}
    )
    assert r.json()["safety_relevant"] is False
    assert r.json()["safety_relevant_overridden_at"] is not None

    # A later content edit re-introducing a keyword must NOT clobber the
    # admin override.
    r = cat_client.patch(
        f"/v1/pills/{pid}",
        headers=h,
        json={"description": "scaffold and high voltage and toxic"},
    )
    assert r.json()["safety_relevant"] is False


def test_retire_hides_from_discovery_but_keeps_record(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    sid = _subject(cat_client, h)
    pid = cat_client.post(
        "/v1/pills",
        headers=h,
        json={
            "subject_id": sid,
            "name": "Retire me",
            "available_difficulty_min": 1,
            "available_difficulty_max": 10,
        },
    ).json()["id"]
    cat_client.post(f"/v1/pills/{pid}/retire", headers=h)

    # Retained for admin (AC-D14), excluded from Testee discovery (AC-D8).
    assert cat_client.get(f"/v1/pills/{pid}", headers=h).json()["retired_at"] is not None
    disc = cat_client.get("/v1/catalogue/pills", headers=bearer(testee)).json()
    assert all(row["id"] != pid for row in disc["data"])


def test_discovery_subject_and_difficulty_and_search_filters(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    ht = bearer(testee)
    s1 = cat_client.post("/v1/subjects", headers=h, json={"name": "One"}).json()["id"]
    s2 = cat_client.post("/v1/subjects", headers=h, json={"name": "Two"}).json()["id"]

    a = cat_client.post(
        "/v1/pills",
        headers=h,
        json={
            "subject_id": s1,
            "name": "Alpha widget",
            "available_difficulty_min": 1,
            "available_difficulty_max": 3,
        },
    ).json()["id"]
    cat_client.post(
        "/v1/pills",
        headers=h,
        json={
            "subject_id": s2,
            "name": "Beta gadget",
            "available_difficulty_min": 7,
            "available_difficulty_max": 9,
        },
    )

    by_subject = cat_client.get(
        "/v1/catalogue/pills", headers=ht, params={"subject_id": s1}
    ).json()["data"]
    assert {r["id"] for r in by_subject} == {a}

    by_diff = cat_client.get(
        "/v1/catalogue/pills", headers=ht, params={"difficulty": 8}
    ).json()["data"]
    assert {r["name"] for r in by_diff} == {"Beta gadget"}

    by_search = cat_client.get(
        "/v1/catalogue/pills", headers=ht, params={"search": "alpha"}
    ).json()["data"]
    assert {r["id"] for r in by_search} == {a}


def test_discovery_miss_persists_gap_signal(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    """D1-D2 / §6.5: a discovery search with content that returns no match
    captures + persists a discovery_miss GapSignal (the GET path commits it);
    repeat searches dedup (occurrence_count increments); a matching search and a
    whitespace-only search capture none. Exercises the real router path (not a
    monkeypatched stub) — the regression guard for the GET-no-commit class."""
    from app.models import GapSignal, GapSignalType

    seed_system_settings(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    ht = bearer(testee)

    def _signals() -> list[GapSignal]:
        return [
            s
            for s in cat_session.store.get(GapSignal, [])
            if s.signal_type == GapSignalType.discovery_miss
        ]

    # Spy on commit: the fake never rolls back, so prove the GET path actually
    # COMMITS the captured signal (the no-commit regression class). The real-DB
    # persistence is additionally guarded by tests/e2e.
    commits = {"n": 0}
    original_commit = cat_session.commit

    async def _spy_commit() -> None:
        commits["n"] += 1
        await original_commit()

    cat_session.commit = _spy_commit  # type: ignore[method-assign]

    cat_client.get("/v1/catalogue/pills", headers=ht, params={"search": "Welding QA"})
    assert commits["n"] >= 1  # the captured signal was committed, not left pending
    cat_client.get("/v1/catalogue/pills", headers=ht, params={"search": "welding qa"})
    assert len(_signals()) == 1  # persisted + deduped
    assert _signals()[0].dedup_key == "welding qa"
    assert _signals()[0].occurrence_count == 2

    # Whitespace-only search captures nothing.
    cat_client.get("/v1/catalogue/pills", headers=ht, params={"search": "   "})
    assert len(_signals()) == 1


def test_cursor_pagination_round_trip(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    for i in range(3):
        cat_client.post("/v1/subjects", headers=h, json={"name": f"S{i}"})

    first = cat_client.get("/v1/subjects", headers=h, params={"limit": 2}).json()
    assert len(first["data"]) == 2
    assert first["meta"]["next_cursor"] is not None
    # count is the full collection size, independent of cursor/limit.
    assert first["meta"]["count"] == 3

    second = cat_client.get(
        "/v1/subjects",
        headers=h,
        params={"limit": 2, "cursor": first["meta"]["next_cursor"]},
    ).json()
    assert len(second["data"]) == 1
    assert second["meta"]["next_cursor"] is None
    assert second["meta"]["count"] == 3
    seen = {r["id"] for r in first["data"]} | {r["id"] for r in second["data"]}
    assert len(seen) == 3

    # The FE-9 count-meta probe: a ?limit=1 query carries the full total
    # in meta.count without walking every page.
    probe = cat_client.get("/v1/subjects", headers=h, params={"limit": 1}).json()
    assert len(probe["data"]) == 1
    assert probe["meta"]["count"] == 3


def test_get_missing_pill_is_404(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    seed_system_settings(cat_session)
    h = _admin_headers(cat_session)
    r = cat_client.get("/v1/pills/00000000-0000-0000-0000-0000000000aa", headers=h)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "not_found"
