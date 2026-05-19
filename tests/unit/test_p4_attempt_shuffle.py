"""P4 Slice 2 — deterministic per-attempt presentation shuffle (AC-D24).

Pure-function coverage of ``presentation_order``: stability across
resume (same seed -> identical order), question-group block integrity,
the randomise toggles, and answer-key stripping. Zero-DB / zero-network
(AC-CD15)."""

from __future__ import annotations

import uuid

from app.domain.attempts import _seed_from_id, presentation_order


def _q(qid: str, *, group: str | None = None, qtype: str = "true_false") -> dict:
    cfg: dict = {"prompt": f"p-{qid}"}
    if qtype == "multiple_choice":
        cfg |= {"options": ["a", "b", "c", "d"], "correct": 2}
    elif qtype == "true_false":
        cfg |= {"correct": True}
    elif qtype == "matching":
        cfg |= {"pairs": [{"left": "L1", "right": "R1"}, {"left": "L2", "right": "R2"}]}
    elif qtype == "short_answer":
        cfg |= {"rubric": "secret rubric", "model_answer": "secret answer"}
    return {
        "id": str(uuid.UUID(int=int(qid))),
        "type": qtype,
        "config": cfg,
        "assigned_difficulty": 3,
        "question_group_id": group,
    }


_QS = [_q(str(i)) for i in range(1, 11)]


def test_seed_fits_signed_int_and_is_stable() -> None:
    aid = uuid.uuid4()
    seed = _seed_from_id(aid)
    assert 0 <= seed < 2**31 - 1
    assert _seed_from_id(aid) == seed  # pure


def test_order_is_stable_across_resume() -> None:
    a = presentation_order(
        _QS, seed=12345, randomise_questions=True, randomise_options=True
    )
    b = presentation_order(
        _QS, seed=12345, randomise_questions=True, randomise_options=True
    )
    assert [q["id"] for q in a] == [q["id"] for q in b]
    assert [q["config"] for q in a] == [q["config"] for q in b]


def test_different_seed_generally_differs() -> None:
    a = [
        q["id"]
        for q in presentation_order(
            _QS, seed=1, randomise_questions=True, randomise_options=False
        )
    ]
    b = [
        q["id"]
        for q in presentation_order(
            _QS, seed=999, randomise_questions=True, randomise_options=False
        )
    ]
    assert a != b
    assert sorted(a) == sorted(b)  # same set, only order changes


def test_toggles_off_yield_canonical_order() -> None:
    out = presentation_order(
        _QS, seed=42, randomise_questions=False, randomise_options=False
    )
    assert [q["id"] for q in out] == [q["id"] for q in _QS]


def test_question_group_shuffles_as_one_block() -> None:
    qs = [
        _q("1", group="G"),
        _q("2", group="G"),
        _q("3"),
        _q("4", group="G"),
        _q("5"),
    ]
    gids = [q["id"] for q in qs if q["question_group_id"] == "G"]
    for seed in range(50):
        out = [
            q["id"]
            for q in presentation_order(
                qs, seed=seed, randomise_questions=True, randomise_options=False
            )
        ]
        pos = [out.index(g) for g in gids]
        # contiguous block, internal canonical order preserved
        assert pos == list(range(min(pos), min(pos) + len(gids)))
        assert [out[p] for p in pos] == gids


def test_answer_keys_are_stripped() -> None:
    qs = [
        _q("1", qtype="multiple_choice"),
        _q("2", qtype="true_false"),
        _q("3", qtype="matching"),
        _q("4", qtype="short_answer"),
    ]
    out = {
        q["type"]: q["config"]
        for q in presentation_order(
            qs, seed=7, randomise_questions=False, randomise_options=False
        )
    }
    assert "correct" not in out["multiple_choice"]
    assert set(out["multiple_choice"]) == {"prompt", "options"}
    assert out["true_false"] == {"prompt": "p-2"}
    assert set(out["matching"]) == {"prompt", "left", "right"}
    assert "pairs" not in out["matching"]
    assert out["short_answer"] == {"prompt": "p-4"}


def test_option_shuffle_is_deterministic_and_a_permutation() -> None:
    q = [_q("1", qtype="multiple_choice")]
    a = presentation_order(q, seed=88, randomise_questions=False, randomise_options=True)[
        0
    ]["config"]["options"]
    b = presentation_order(q, seed=88, randomise_questions=False, randomise_options=True)[
        0
    ]["config"]["options"]
    assert a == b
    assert sorted(a) == ["a", "b", "c", "d"]
