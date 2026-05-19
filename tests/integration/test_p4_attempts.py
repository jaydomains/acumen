"""P4 Slice 2 — attempt lifecycle: start/resume/autosave/pause/submit,
the AC-D26 v1.4 ``assignment_id`` attribution, AC-D24 resume-stable
shuffle, amended AC-D11 pause-blanks-and-restores, and the delete_test
attempt guard. Zero-DB / zero-network (AC-CD15)."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app import permissions as p
from app.models import Pill, Subject
from tests.integration.conftest import (
    CatalogueFakeSession,
    bearer,
    cat_make_user,
)

_MCQ = {"prompt": "2+2?", "options": ["3", "4", "5"], "correct": 1}
_TF = {"prompt": "sky blue?", "correct": True}


def _admin(session: CatalogueFakeSession) -> dict[str, str]:
    return bearer(
        cat_make_user(session, email="admin@kbc.com", role=p.ROLE_ADMINISTRATOR)
    )


def _pill(session: CatalogueFakeSession) -> uuid.UUID:
    subject = Subject(tenant_id=p.SEED_TENANT_ID, name="S", description=None)
    session.add(subject)
    pill = Pill(
        tenant_id=p.SEED_TENANT_ID,
        subject_id=subject.id,
        name="Pill",
        description=None,
        available_difficulty_min=1,
        available_difficulty_max=10,
        discoverable=True,
        safety_relevant=False,
        estimated_minutes=None,
    )
    session.add(pill)
    return pill.id


def _published_frozen(
    client: TestClient, h: dict[str, str], *, timed: bool = False, minutes: int = 0
) -> str:
    body: dict = {"name": "F", "mode": "frozen"}
    if timed:
        body |= {"timed": True, "duration_minutes": minutes}
    tid = client.post("/v1/tests", headers=h, json=body).json()["id"]
    for cfg, qtype in ((_MCQ, "multiple_choice"), (_TF, "true_false")):
        r = client.post(
            f"/v1/tests/{tid}/questions",
            headers=h,
            json={"type": qtype, "config": cfg, "assigned_difficulty": 3},
        )
        assert r.status_code == 201, r.text
    assert client.post(f"/v1/tests/{tid}/publish", headers=h).status_code == 200
    return tid


def test_start_self_initiated_has_no_assignment(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = _published_frozen(cat_client, h)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    r = cat_client.post("/v1/attempts", headers=bearer(testee), json={"test_id": tid})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["origin"] == "self_initiated"
    assert body["assignment_id"] is None
    assert body["status"] == "in_progress"
    assert len(body["questions"]) == 2
    assert body["responses"] == {}


def test_admin_and_anon_cannot_start(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = _published_frozen(cat_client, h)
    assert (
        cat_client.post("/v1/attempts", headers=h, json={"test_id": tid}).status_code
        == 403
    )
    assert cat_client.post("/v1/attempts", json={"test_id": tid}).status_code == 401


def test_draft_test_not_attemptable(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = cat_client.post(
        "/v1/tests", headers=h, json={"name": "D", "mode": "frozen"}
    ).json()["id"]
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    r = cat_client.post("/v1/attempts", headers=bearer(testee), json={"test_id": tid})
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "test_not_published"


def test_resume_is_stable_across_reads(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = _published_frozen(cat_client, h)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    aid = cat_client.post(
        "/v1/attempts", headers=bearer(testee), json={"test_id": tid}
    ).json()["id"]
    first = cat_client.get(f"/v1/attempts/{aid}", headers=bearer(testee)).json()
    again = cat_client.get(f"/v1/attempts/{aid}", headers=bearer(testee)).json()
    order = [q["id"] for q in first["questions"]]
    assert order == [q["id"] for q in again["questions"]]
    assert first["questions"] == again["questions"]  # incl. option order


def test_assignment_driven_sets_attribution(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = _published_frozen(cat_client, h)
    pid = _pill(cat_session)
    mine = cat_make_user(cat_session, email="m@kbc.com", role=p.ROLE_TESTEE)
    other = cat_make_user(cat_session, email="o@kbc.com", role=p.ROLE_TESTEE)
    aid = cat_client.post(
        "/v1/assignments",
        headers=h,
        json={"pill_id": str(pid), "difficulty": 3, "testee_ids": [str(mine.id)]},
    ).json()["id"]
    ok = cat_client.post(
        "/v1/attempts",
        headers=bearer(mine),
        json={"test_id": tid, "assignment_id": aid},
    )
    assert ok.status_code == 201, ok.text
    assert ok.json()["origin"] == "assignment_driven"
    assert ok.json()["assignment_id"] == aid
    # a non-assignee cannot attribute to that assignment
    bad = cat_client.post(
        "/v1/attempts",
        headers=bearer(other),
        json={"test_id": tid, "assignment_id": aid},
    )
    assert bad.status_code == 404


def test_pause_blanks_and_resume_restores(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = _published_frozen(cat_client, h, timed=True, minutes=90)  # >60 -> 2 pauses
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    th = bearer(testee)
    started = cat_client.post("/v1/attempts", headers=th, json={"test_id": tid}).json()
    aid = started["id"]
    qid = started["questions"][0]["id"]
    # autosave an answer
    cat_client.post(
        f"/v1/attempts/{aid}/responses",
        headers=th,
        json={"question_id": qid, "answer_payload": {"choice": 1}},
    )
    # pause -> content blanked, input preserved server-side
    paused = cat_client.post(f"/v1/attempts/{aid}/pause", headers=th)
    assert paused.status_code == 200
    pb = paused.json()
    assert pb["paused"] is True
    assert pb["status"] == "paused"
    assert pb["questions"] == []
    assert pb["pauses_used"] == 1
    assert pb["responses"][qid] == {"choice": 1}  # preserved
    # cannot autosave behind the overlay
    blocked = cat_client.post(
        f"/v1/attempts/{aid}/responses",
        headers=th,
        json={"question_id": qid, "answer_payload": {"choice": 2}},
    )
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "attempt_paused"
    # resume -> content restored, answer still there
    resumed = cat_client.post(f"/v1/attempts/{aid}/resume", headers=th).json()
    assert resumed["paused"] is False
    assert len(resumed["questions"]) == 2
    assert resumed["responses"][qid] == {"choice": 1}
    # double resume is rejected
    assert cat_client.post(f"/v1/attempts/{aid}/resume", headers=th).status_code == 409


def test_pause_rules_enforced(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    th = bearer(testee)
    # untimed -> no pause mechanism
    untimed = _published_frozen(cat_client, h)
    a1 = cat_client.post("/v1/attempts", headers=th, json={"test_id": untimed}).json()[
        "id"
    ]
    r = cat_client.post(f"/v1/attempts/{a1}/pause", headers=th)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "pause_unsupported"
    # <=60min timed -> zero allowance
    short = _published_frozen(cat_client, h, timed=True, minutes=45)
    a2 = cat_client.post("/v1/attempts", headers=th, json={"test_id": short}).json()["id"]
    r2 = cat_client.post(f"/v1/attempts/{a2}/pause", headers=th)
    assert r2.status_code == 409
    assert r2.json()["error"]["code"] == "pause_not_allowed"


def test_submit_closes_attempt(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = _published_frozen(cat_client, h, timed=True, minutes=90)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    th = bearer(testee)
    aid = cat_client.post("/v1/attempts", headers=th, json={"test_id": tid}).json()["id"]
    done = cat_client.post(f"/v1/attempts/{aid}/submit", headers=th).json()
    assert done["status"] == "submitted"
    assert done["submitted_at"] is not None
    assert done["questions"] == []
    # idempotency / double-submit guard
    assert cat_client.post(f"/v1/attempts/{aid}/submit", headers=th).status_code == 409
    # cannot submit while paused (must resume first)
    aid2 = cat_client.post("/v1/attempts", headers=th, json={"test_id": tid}).json()["id"]
    cat_client.post(f"/v1/attempts/{aid2}/pause", headers=th)
    blocked = cat_client.post(f"/v1/attempts/{aid2}/submit", headers=th)
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "attempt_paused"


def test_autosave_is_idempotent(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = _published_frozen(cat_client, h)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    th = bearer(testee)
    started = cat_client.post("/v1/attempts", headers=th, json={"test_id": tid}).json()
    aid, qid = started["id"], started["questions"][0]["id"]
    cat_client.post(
        f"/v1/attempts/{aid}/responses",
        headers=th,
        json={"question_id": qid, "answer_payload": {"choice": 0}},
    )
    final = cat_client.post(
        f"/v1/attempts/{aid}/responses",
        headers=th,
        json={"question_id": qid, "answer_payload": {"choice": 2}},
    )
    body = final.json()
    assert list(body["responses"]) == [qid]
    assert body["responses"][qid] == {"choice": 2}


def test_other_testee_cannot_read_attempt(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = _published_frozen(cat_client, h)
    mine = cat_make_user(cat_session, email="m@kbc.com", role=p.ROLE_TESTEE)
    other = cat_make_user(cat_session, email="o@kbc.com", role=p.ROLE_TESTEE)
    aid = cat_client.post(
        "/v1/attempts", headers=bearer(mine), json={"test_id": tid}
    ).json()["id"]
    assert cat_client.get(f"/v1/attempts/{aid}", headers=bearer(other)).status_code == 404


def test_delete_test_blocked_when_attempts_exist(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    h = _admin(cat_session)
    tid = _published_frozen(cat_client, h)
    # no attempts yet -> deletable
    spare = _published_frozen(cat_client, h)
    assert cat_client.delete(f"/v1/tests/{spare}", headers=h).status_code == 204
    # an attempt makes the test non-deletable (AC-D14 / AC-D17 retention)
    testee = cat_make_user(cat_session, email="t@kbc.com", role=p.ROLE_TESTEE)
    cat_client.post("/v1/attempts", headers=bearer(testee), json={"test_id": tid})
    r = cat_client.delete(f"/v1/tests/{tid}", headers=h)
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "test_has_attempts"
