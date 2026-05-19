"""P4 deterministic shuffle (AC-D24) — seed determinism, group-block
integrity, option permutation, resume stability.

Pure functions; zero-DB / zero-network (AC-CD15)."""

from __future__ import annotations

import uuid

from app.domain.attempts import option_permutation, presented_questions, seed_for


def _q(idx: int, gid: str | None = None, qtype: str = "multiple_choice") -> dict:
    return {
        "question_id": str(uuid.UUID(int=idx)),
        "type": qtype,
        "config": {
            "prompt": f"Q{idx}",
            "options": ["a", "b", "c", "d"],
            "correct": 0,
        },
        "assigned_difficulty": 3,
        "question_group_id": gid,
    }


def test_seed_is_deterministic_and_64bit() -> None:
    aid = uuid.uuid4()
    assert seed_for(aid) == seed_for(aid)
    assert 0 <= seed_for(aid) < 2**64


def test_option_permutation_is_deterministic() -> None:
    qid = uuid.uuid4()
    assert option_permutation(qid, 12345, 4) == option_permutation(qid, 12345, 4)
    assert sorted(option_permutation(qid, 12345, 4)) == [0, 1, 2, 3]


def test_presentation_is_stable_across_calls() -> None:
    snap = [_q(i) for i in range(6)]
    seed = 987654321
    first = presented_questions(
        snap, seed, randomise_question_order=True, randomise_option_order=True
    )
    second = presented_questions(
        snap, seed, randomise_question_order=True, randomise_option_order=True
    )
    assert first == second
    assert [x["id"] for x in first] == [x["id"] for x in second]


def test_question_group_block_shuffles_as_unit_internal_order_kept() -> None:
    gid = str(uuid.uuid4())
    # three grouped (case-study) + three standalone
    snap = [
        _q(0, gid),
        _q(1, gid),
        _q(2, gid),
        _q(10),
        _q(11),
        _q(12),
    ]
    out = presented_questions(
        snap, 42, randomise_question_order=True, randomise_option_order=False
    )
    ids = [x["id"] for x in out]
    grouped = [str(uuid.UUID(int=i)) for i in (0, 1, 2)]
    positions = [ids.index(g) for g in grouped]
    # the block stays contiguous and in its original internal order
    assert positions == sorted(positions)
    assert positions[2] - positions[0] == 2
    assert ids[positions[0] : positions[0] + 3] == grouped


def test_no_shuffle_preserves_order() -> None:
    snap = [_q(i) for i in range(4)]
    out = presented_questions(
        snap, 1, randomise_question_order=False, randomise_option_order=False
    )
    assert [x["id"] for x in out] == [str(uuid.UUID(int=i)) for i in range(4)]
    assert out[0]["config"]["options"] == ["a", "b", "c", "d"]


def test_answer_keys_are_stripped_from_presentation() -> None:
    out = presented_questions(
        [_q(0)], 5, randomise_question_order=False, randomise_option_order=True
    )
    assert "correct" not in out[0]["config"]
    assert set(out[0]["config"]) == {"prompt", "options"}
