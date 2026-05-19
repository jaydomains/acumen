"""P4 attempt lifecycle — start/snapshot (AC-D17), shuffle stability
across resume (AC-D24), pause blanks + restores + lazy max-duration
auto-resume (AC-D11), idempotent autosave, retake sequencing, rate
limit + origin exemption (AC-D18), benchmark sequential cap (AC-D13).

Zero-DB / zero-network (AC-CD15)."""

from __future__ import annotations

from datetime import timedelta

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import SystemSettings
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
)

_MCQ = {"prompt": "2+2?", "options": ["3", "4", "5"], "correct": 1}
_TF = {"prompt": "Sky is blue.", "correct": True}


def _admin(session: CatalogueFakeSession) -> dict[str, str]:
    return bearer(
        cat_make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)
    )


def _testee(session: CatalogueFakeSession, email: str = "t@kbc.com") -> object:
    return cat_make_user(session, email=email, role=p.ROLE_TESTEE)


def _frozen_published(
    client: TestClient, h: dict[str, str], *, timed_long: bool = False
) -> str:
    body: dict = {"name": "F", "mode": "frozen"}
    if timed_long:
        body |= {"timed": True, "duration_minutes": 90}
    tid = client.post("/v1/tests", headers=h, json=body).json()["id"]
    client.post(
        f"/v1/tests/{tid}/questions",
        headers=h,
        json={"type": "multiple_choice", "config": _MCQ, "assigned_difficulty": 3},
    )
    client.post(
        f"/v1/tests/{tid}/questions",
        headers=h,
        json={"type": "true_false", "config": _TF, "assigned_difficulty": 2},
    )
    assert (
        client.post(f"/v1/tests/{tid}/publish", headers=h).json()["status"] == "published"
    )
    return tid


def test_start_frozen_snapshots_questions(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = _frozen_published(cat_client, h)
    testee = _testee(cat_session)
    r = cat_client.post("/v1/attempts", headers=bearer(testee), json={"test_id": tid})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["paused"] is False
    assert body["sequence_number"] == 1
    assert len(body["questions"]) == 2
    # answer keys never leak in the presentation
    for q in body["questions"]:
        assert "correct" not in q["config"]


def test_frozen_snapshot_immune_to_later_test_edit(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = _frozen_published(cat_client, h)
    testee = _testee(cat_session)
    aid = cat_client.post(
        "/v1/attempts", headers=bearer(testee), json={"test_id": tid}
    ).json()["id"]
    # add a third question to the test AFTER the attempt started
    cat_client.post(
        f"/v1/tests/{tid}/questions",
        headers=h,
        json={"type": "true_false", "config": _TF, "assigned_difficulty": 1},
    )
    again = cat_client.get(f"/v1/attempts/{aid}", headers=bearer(testee))
    assert len(again.json()["questions"]) == 2  # snapshot unchanged (AC-D17)


def test_shuffle_seed_stable_across_resume(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = _frozen_published(cat_client, h, timed_long=True)
    testee = _testee(cat_session)
    th = bearer(testee)
    aid = cat_client.post("/v1/attempts", headers=th, json={"test_id": tid}).json()["id"]
    before = [
        q["id"]
        for q in cat_client.get(f"/v1/attempts/{aid}", headers=th).json()["questions"]
    ]
    assert (
        cat_client.post(f"/v1/attempts/{aid}/pause", headers=th).json()["paused"] is True
    )
    assert (
        cat_client.post(f"/v1/attempts/{aid}/resume", headers=th).json()["paused"]
        is False
    )
    after = [
        q["id"]
        for q in cat_client.get(f"/v1/attempts/{aid}", headers=th).json()["questions"]
    ]
    assert before == after  # AC-D24 resume-stable order


def test_pause_blanks_content_and_resume_restores(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = _frozen_published(cat_client, h, timed_long=True)
    testee = _testee(cat_session)
    th = bearer(testee)
    aid = cat_client.post("/v1/attempts", headers=th, json={"test_id": tid}).json()["id"]
    paused = cat_client.post(f"/v1/attempts/{aid}/pause", headers=th).json()
    assert paused["paused"] is True
    assert paused["questions"] is None  # content blanked behind overlay
    assert paused["pause_seconds_remaining"] > 0
    assert paused["watermark"]
    # autosave is rejected while paused
    qid = "00000000-0000-0000-0000-0000000000a1"
    blocked = cat_client.post(
        f"/v1/attempts/{aid}/autosave",
        headers=th,
        json={"question_id": qid, "answer_payload": {"x": 1}},
    )
    assert blocked.status_code == 409
    restored = cat_client.post(f"/v1/attempts/{aid}/resume", headers=th).json()
    assert restored["paused"] is False
    assert restored["questions"] is not None


def test_pause_not_allowed_on_short_timed_test(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = cat_client.post(
        "/v1/tests",
        headers=h,
        json={"name": "S", "mode": "frozen", "timed": True, "duration_minutes": 30},
    ).json()["id"]
    cat_client.post(
        f"/v1/tests/{tid}/questions",
        headers=h,
        json={"type": "true_false", "config": _TF, "assigned_difficulty": 1},
    )
    cat_client.post(f"/v1/tests/{tid}/publish", headers=h)
    testee = _testee(cat_session)
    th = bearer(testee)
    aid = cat_client.post("/v1/attempts", headers=th, json={"test_id": tid}).json()["id"]
    r = cat_client.post(f"/v1/attempts/{aid}/pause", headers=th)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "pause_not_allowed"


def test_max_duration_auto_resume_on_next_interaction(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = _frozen_published(cat_client, h, timed_long=True)
    testee = _testee(cat_session)
    th = bearer(testee)
    aid = cat_client.post("/v1/attempts", headers=th, json={"test_id": tid}).json()["id"]
    cat_client.post(f"/v1/attempts/{aid}/pause", headers=th)
    # Force the open pause window to exceed max_pause_duration_minutes
    # (default 30). No cron/scheduler — expiry is derived on the next
    # interaction (tightening 2).
    from app.models import AttemptPauseEvent

    ev = cat_session.store[AttemptPauseEvent][0]
    ev.started_at = ev.started_at - timedelta(minutes=31)
    view = cat_client.get(f"/v1/attempts/{aid}", headers=th).json()
    assert view["paused"] is False  # auto-resumed lazily
    assert view["questions"] is not None
    assert ev.auto_resumed is True


def test_autosave_is_idempotent(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = _frozen_published(cat_client, h)
    testee = _testee(cat_session)
    th = bearer(testee)
    start = cat_client.post("/v1/attempts", headers=th, json={"test_id": tid}).json()
    qid = start["questions"][0]["id"]
    aid = start["id"]
    for payload in ({"choice": 0}, {"choice": 1}, {"choice": 1}):
        r = cat_client.post(
            f"/v1/attempts/{aid}/autosave",
            headers=th,
            json={"question_id": qid, "answer_payload": payload},
        )
        assert r.status_code == 200
    from app.models import Response

    rows = [x for x in cat_session.store.get(Response, []) if str(x.question_id) == qid]
    assert len(rows) == 1  # single row per (attempt, question)
    assert rows[0].answer_payload == {"choice": 1}


def test_retake_increments_sequence_number(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = _frozen_published(cat_client, h)
    testee = _testee(cat_session)
    th = bearer(testee)
    a1 = cat_client.post("/v1/attempts", headers=th, json={"test_id": tid}).json()
    cat_client.post(f"/v1/attempts/{a1['id']}/submit", headers=th)
    a2 = cat_client.post("/v1/attempts", headers=th, json={"test_id": tid}).json()
    assert a1["sequence_number"] == 1
    assert a2["sequence_number"] == 2


def test_self_initiated_rate_limit_and_assignment_exemption(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    cat_session.add(
        SystemSettings(
            tenant_id=p.SEED_TENANT_ID,
            self_initiated_rate_limit_per_hour=1,
            self_initiated_rate_limit_per_day=1,
        )
    )
    h = _admin(cat_session)
    tid = _frozen_published(cat_client, h)
    testee = _testee(cat_session)
    th = bearer(testee)
    assert (
        cat_client.post("/v1/attempts", headers=th, json={"test_id": tid}).status_code
        == 201
    )
    blocked = cat_client.post("/v1/attempts", headers=th, json={"test_id": tid})
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "rate_limited"
    # assignment-driven is exempt from the self-initiated limit (AC-D18)
    exempt = cat_client.post(
        "/v1/attempts",
        headers=th,
        json={"test_id": tid, "origin": "assignment_driven"},
    )
    assert exempt.status_code == 201


def test_private_test_blocks_self_initiated_allows_assignment(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = cat_client.post(
        "/v1/tests",
        headers=h,
        json={"name": "P", "mode": "per_testee", "visibility": "private"},
    ).json()["id"]
    cat_client.post(f"/v1/tests/{tid}/publish", headers=h)
    testee = _testee(cat_session)
    th = bearer(testee)
    blocked = cat_client.post("/v1/attempts", headers=th, json={"test_id": tid})
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "test_private"
    ok = cat_client.post(
        "/v1/attempts",
        headers=th,
        json={"test_id": tid, "origin": "assignment_driven"},
    )
    assert ok.status_code == 201
    # per-Testee set is stub-generated and stored against the attempt
    assert len(ok.json()["questions"]) >= 1


def test_benchmark_sequential_next_is_capped(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = cat_client.post(
        "/v1/tests",
        headers=h,
        json={"name": "B", "mode": "benchmark", "benchmark_scope": "pill"},
    ).json()["id"]
    cat_client.post(f"/v1/tests/{tid}/publish", headers=h)
    testee = _testee(cat_session)
    th = bearer(testee)
    aid = cat_client.post("/v1/attempts", headers=th, json={"test_id": tid}).json()["id"]
    from app.domain.attempts import P4_BENCHMARK_STEP_CAP

    seen = 0
    for _ in range(P4_BENCHMARK_STEP_CAP + 2):
        r = cat_client.post(f"/v1/attempts/{aid}/next", headers=th).json()
        if r["done"]:
            break
        seen += 1
    assert seen == P4_BENCHMARK_STEP_CAP
    assert cat_client.post(f"/v1/attempts/{aid}/next", headers=th).json()["done"] is True


def test_attempt_not_visible_to_other_testee(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = _frozen_published(cat_client, h)
    mine = _testee(cat_session, "mine@kbc.com")
    other = _testee(cat_session, "other@kbc.com")
    aid = cat_client.post(
        "/v1/attempts", headers=bearer(mine), json={"test_id": tid}
    ).json()["id"]
    assert cat_client.get(f"/v1/attempts/{aid}", headers=bearer(other)).status_code == 404
