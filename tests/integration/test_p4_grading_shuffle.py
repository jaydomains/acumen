"""P4 — grading inverts the presentation shuffle (A2-H1 / X2-#1).

AC-D24 ``randomise_option_order`` shuffles the presented order of MCQ
options and matching right-sides per attempt; the Testee submits an index
into the PRESENTED order. Grading must invert the same per-question
permutation to recover the original-order index before scoring. Before the
fix, grading compared the presented index against the original answer key,
so any non-identity shuffle silently mis-scored MCQ and matching.

Two layers of coverage:
- Deterministic unit tests on the pure grading functions with an explicit
  non-identity permutation — the tight regression guard.
- Full present→submit→grade API round-trips that read the shuffled order
  from the attempt view (exactly like the client) under a *guaranteed*
  non-identity shuffle — proves grading re-derives the same permutation the
  presentation applied (the seed/qid/element-count lockstep).

Zero-DB / zero-network (AC-CD15).
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app import permissions as p
from app.domain.attempts import (
    _grade_matching,
    _grade_mcq,
    _grade_permutation,
    option_permutation,
)
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    Grade,
    Question,
    QuestionType,
    SystemSettings,
    Test,
    TestMode,
    TestStatus,
    TestVisibility,
    TimeoutBehaviour,
)
from tests.integration.conftest import CatalogueFakeSession, bearer, cat_make_user

# --- deterministic unit tests on the inversion math ------------------


def test_grade_mcq_inverts_presentation_permutation() -> None:
    config = {"options": ["a", "b", "c", "d"], "correct": 2}
    # presented index j shows original option perm[j]; the original correct
    # option (2) is presented at index ``perm.index(2)``.
    perm = [2, 0, 3, 1]
    presented_correct = perm.index(2)  # 0
    assert _grade_mcq({"choice": presented_correct}, config, perm) == 1.0
    # Submitting the ORIGINAL correct index as if it were the presented index
    # mis-scores (perm[2] == 3) — proving the inversion is load-bearing.
    assert _grade_mcq({"choice": 2}, config, perm) == 0.0
    # No shuffle → the submitted index already is the original index.
    assert _grade_mcq({"choice": 2}, config, None) == 1.0
    # Out-of-range / malformed → 0.0 (didn't answer).
    assert _grade_mcq({"choice": 9}, config, perm) == 0.0
    assert _grade_mcq({"choice": "x"}, config, perm) == 0.0


def test_grade_matching_inverts_right_permutation() -> None:
    config = {
        "pairs": [
            {"left": "L0", "right": "R0"},
            {"left": "L1", "right": "R1"},
            {"left": "L2", "right": "R2"},
            {"left": "L3", "right": "R3"},
        ]
    }
    perm = [2, 0, 3, 1]  # presented right j shows original right perm[j]
    # For each left i, the correct presented right index is ``perm.index(i)``.
    correct = [perm.index(i) for i in range(4)]  # [1, 3, 0, 2]
    assert _grade_matching({"matches": correct}, config, perm) == 1.0
    # Identity submission under a non-identity perm scores 0 (no perm[i] == i).
    assert _grade_matching({"matches": [0, 1, 2, 3]}, config, perm) == 0.0
    # No shuffle → identity mapping is the correct mapping.
    assert _grade_matching({"matches": [0, 1, 2, 3]}, config, None) == 1.0


def test_grade_permutation_is_lockstep_with_option_permutation() -> None:
    qid = uuid.uuid4()
    seed = 123_456_789
    mc = QuestionType.multiple_choice
    tf = QuestionType.true_false
    mcq_cfg = {"options": ["a", "b", "c"], "correct": 0}
    assert _grade_permutation(qid, seed, mc, mcq_cfg, True) == option_permutation(
        qid, seed, 3
    )
    match_cfg = {"pairs": [{"left": "L", "right": "R"}, {"left": "L2", "right": "R2"}]}
    assert _grade_permutation(
        qid, seed, QuestionType.matching, match_cfg, True
    ) == option_permutation(qid, seed, 2)
    # No inversion when disabled / non-shuffled type / empty.
    assert _grade_permutation(qid, seed, mc, mcq_cfg, False) is None
    assert _grade_permutation(qid, seed, tf, {"correct": True}, True) is None
    assert _grade_permutation(qid, seed, mc, {"options": []}, True) is None


# --- API round-trip fixtures ------------------------------------------


def _settings(session: CatalogueFakeSession) -> None:
    # Lift the self-initiated rate limit so the round-trips can start a
    # handful of attempts looking for a non-identity shuffle.
    session.add(
        SystemSettings(
            tenant_id=SEED_TENANT_ID,
            safety_keyword_list=[],
            self_initiated_rate_limit_per_hour=100_000,
            self_initiated_rate_limit_per_day=100_000,
        )
    )


def _testee(session: CatalogueFakeSession, email: str = "shuffle@kbc.com") -> AppUser:
    return cat_make_user(session, email=email, role=p.ROLE_TESTEE)


def _shuffled_test(session: CatalogueFakeSession) -> Test:
    test = Test(
        tenant_id=SEED_TENANT_ID,
        name="Shuffled",
        mode=TestMode.frozen,
        status=TestStatus.published,
        visibility=TestVisibility.library,
        timed=False,
        timeout_behaviour=TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=30,
        pass_threshold=0.5,
        target_difficulty=5,
        randomise_question_order=False,
        randomise_option_order=True,  # the shuffle under test
    )
    session.add(test)
    return test


def _q(
    session: CatalogueFakeSession,
    test_id: uuid.UUID,
    qtype: QuestionType,
    config: dict,
) -> Question:
    q = Question(
        tenant_id=SEED_TENANT_ID,
        test_id=test_id,
        type=qtype,
        config=config,
        assigned_difficulty=4,
        question_group_id=None,
        realism_flag_count=0,
    )
    session.add(q)
    return q


def _start(client: TestClient, t: AppUser, test_id: uuid.UUID) -> dict:
    r = client.post("/v1/attempts", headers=bearer(t), json={"test_id": str(test_id)})
    assert r.status_code == 201, r.text
    return r.json()


def _view(client: TestClient, t: AppUser, attempt_id: str) -> dict:
    r = client.get(f"/v1/attempts/{attempt_id}", headers=bearer(t))
    assert r.status_code == 200, r.text
    return r.json()


def _autosave(
    client: TestClient, t: AppUser, attempt_id: str, question_id: str, payload: dict
) -> None:
    r = client.post(
        f"/v1/attempts/{attempt_id}/autosave",
        headers=bearer(t),
        json={"question_id": question_id, "answer_payload": payload, "time_ms": 1000},
    )
    assert r.status_code == 200, r.text


def _submit(client: TestClient, t: AppUser, attempt_id: str) -> None:
    r = client.post(f"/v1/attempts/{attempt_id}/submit", headers=bearer(t))
    assert r.status_code == 200, r.text


def _q_view(view: dict, qid: str) -> dict:
    for q in view.get("questions") or []:
        if str(q.get("id")) == qid:
            return q
    raise AssertionError(f"question {qid} not present in attempt view")


# --- API round-trips under a guaranteed non-identity shuffle ----------


def test_mcq_shuffled_roundtrip_scores_full(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    _settings(cat_session)
    t = _testee(cat_session)
    test = _shuffled_test(cat_session)
    options = ["alpha", "bravo", "charlie", "delta"]
    correct_idx = 2
    q = _q(
        cat_session,
        test.id,
        QuestionType.multiple_choice,
        {"prompt": "p", "options": options, "correct": correct_idx},
    )

    # Start attempts until the CORRECT option lands at a different presented
    # index than its original — so submitting the presented index would
    # mis-score under the old (un-inverted) grader.
    attempt_id = ""
    presented: list[str] = []
    for _ in range(40):
        started = _start(cat_client, t, test.id)
        view = _view(cat_client, t, started["id"])
        presented = [o["text"] for o in _q_view(view, str(q.id))["config"]["options"]]
        if presented.index("charlie") != correct_idx:
            attempt_id = started["id"]
            break
    assert attempt_id, "correct option never moved under the shuffle"

    presented_correct = presented.index("charlie")
    assert presented_correct != correct_idx  # the inversion is load-bearing here
    _autosave(cat_client, t, attempt_id, str(q.id), {"choice": presented_correct})
    _submit(cat_client, t, attempt_id)

    grades = cat_session.store.get(Grade, [])
    assert len(grades) == 1
    assert grades[0].score == 1.0


def test_mcq_shuffled_roundtrip_wrong_choice_scores_zero(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    _settings(cat_session)
    t = _testee(cat_session)
    test = _shuffled_test(cat_session)
    options = ["alpha", "bravo", "charlie", "delta"]
    q = _q(
        cat_session,
        test.id,
        QuestionType.multiple_choice,
        {"prompt": "p", "options": options, "correct": 2},
    )
    started = _start(cat_client, t, test.id)
    view = _view(cat_client, t, started["id"])
    presented = [o["text"] for o in _q_view(view, str(q.id))["config"]["options"]]
    # Submit a presented index whose option is NOT the correct one.
    wrong = presented.index("alpha")
    _autosave(cat_client, t, started["id"], str(q.id), {"choice": wrong})
    _submit(cat_client, t, started["id"])
    grades = cat_session.store.get(Grade, [])
    assert len(grades) == 1
    assert grades[0].score == 0.0


def test_matching_shuffled_roundtrip_scores_full(
    cat_client: TestClient, cat_session: CatalogueFakeSession
) -> None:
    _settings(cat_session)
    t = _testee(cat_session)
    test = _shuffled_test(cat_session)
    pairs = [{"left": f"L{i}", "right": f"R{i}"} for i in range(4)]
    original_rights = [pair["right"] for pair in pairs]
    q = _q(cat_session, test.id, QuestionType.matching, {"prompt": "p", "pairs": pairs})

    # Start attempts until the right column is actually shuffled.
    attempt_id = ""
    presented_rights: list[str] = []
    for _ in range(40):
        started = _start(cat_client, t, test.id)
        view = _view(cat_client, t, started["id"])
        presented_rights = _q_view(view, str(q.id))["config"]["right"]
        if presented_rights != original_rights:
            attempt_id = started["id"]
            break
    assert attempt_id, "right column never shuffled"

    # Content-correct matches: for left i, pick the presented right index
    # showing the original right "Ri".
    matches = [presented_rights.index(f"R{i}") for i in range(4)]
    assert matches != [0, 1, 2, 3]  # non-identity → would mis-score un-inverted
    _autosave(cat_client, t, attempt_id, str(q.id), {"matches": matches})
    _submit(cat_client, t, attempt_id)

    grades = cat_session.store.get(Grade, [])
    assert len(grades) == 1
    assert grades[0].score == 1.0
