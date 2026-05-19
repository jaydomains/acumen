"""Attempt lifecycle — start, snapshot, deterministic shuffle, pause/
resume, autosave, submit (AC-D3 / AC-D5 / AC-D11 / AC-D13 / AC-D17 /
AC-D18 / AC-D24).

P4 is the deterministic spine; grading lands in Slice 3 and real
per-Testee AI generation in P5 (JIT streaming in P10). In P4 the
per-Testee set is stub-generated synchronously at start and stored
against the attempt — forward-compatible with P10 swapping in streamed
generation. Frozen/hand-authored attempts snapshot the test's question
set at start (AC-D17). Benchmark runs sequentially via ``next_question``
capped at ``P4_BENCHMARK_STEP_CAP`` (full adaptive depth is P5/P10).

Shuffle is a pure function of the attempt id (AC-D24): the seed never
re-randomises, so resume yields an identical presentation. Pause blanks
content (AC-D11); "pause expired" is **derived state computed on the
next interaction**, never a stored flag or a scheduled job — a
long-paused attempt stays paused in the DB until a Testee/admin touches
it, at which point the elapsed window auto-resumes.

Routers stay thin (CODE_SPEC §2/§3). Queries are id/tenant equality with
Python-side work so the AC-CD15 zero-DB harness holds.
"""

from __future__ import annotations

import random
import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.catalogue import record_audit
from app.models import (
    SEED_TENANT_ID,
    Attempt,
    AttemptOrigin,
    AttemptPauseEvent,
    Question,
    QuestionType,
    Response,
    SystemSettings,
    Test,
    TestMode,
    TestStatus,
    TestVisibility,
    TimeoutBehaviour,
)
from app.permissions import APIError, now_utc

__all__ = [
    "P4_BENCHMARK_STEP_CAP",
    "seed_for",
    "presented_questions",
    "option_permutation",
    "get_attempt",
    "start_attempt",
    "view_attempt",
    "autosave",
    "pause_attempt",
    "resume_attempt",
    "submit_attempt",
    "next_question",
]

# P4 caps the benchmark sequential stub at a fixed, named step count so
# the path is exercised and tests are repeatable. P5/P10 lift/extend
# this when real adaptive convergence (midpoint ±step until stable) and
# the verified-sequential path land (AC-D13).
P4_BENCHMARK_STEP_CAP = 5

# SystemSettings server_defaults are not applied by the zero-DB harness;
# fall back to the AC-D18 spec defaults when the column reads None.
_DEFAULT_RATE_PER_HOUR = 5
_DEFAULT_RATE_PER_DAY = 20
_DEFAULT_MAX_PAUSE_MINUTES = 30

# Rate limit counts self-initiated only; assignment- and loop-driven are
# exempt (AC-D18). loop_driven is not produced until P7 but is in the
# exempt set now so P7 plugs in with no rate-limit change.
_RATE_EXEMPT_ORIGINS = frozenset(
    {AttemptOrigin.assignment_driven, AttemptOrigin.loop_driven}
)


async def _by_id(db: AsyncSession, model: Any, obj_id: uuid.UUID) -> Any | None:
    result = await db.execute(
        select(model).where(model.id == obj_id, model.tenant_id == SEED_TENANT_ID)
    )
    return result.scalar_one_or_none()


async def get_attempt(db: AsyncSession, attempt_id: uuid.UUID) -> Attempt | None:
    return await _by_id(db, Attempt, attempt_id)


async def _system_settings(db: AsyncSession) -> SystemSettings | None:
    result = await db.execute(
        select(SystemSettings).where(SystemSettings.tenant_id == SEED_TENANT_ID)
    )
    return result.scalar_one_or_none()


async def _attempts_for(
    db: AsyncSession, test_id: uuid.UUID, testee_id: uuid.UUID
) -> list[Attempt]:
    result = await db.execute(
        select(Attempt).where(
            Attempt.test_id == test_id,
            Attempt.testee_id == testee_id,
            Attempt.tenant_id == SEED_TENANT_ID,
        )
    )
    return list(result.scalars().all())


async def _self_initiated_recent(db: AsyncSession, testee_id: uuid.UUID) -> list[Attempt]:
    result = await db.execute(
        select(Attempt).where(
            Attempt.testee_id == testee_id,
            Attempt.tenant_id == SEED_TENANT_ID,
        )
    )
    return [a for a in result.scalars().all() if a.origin == AttemptOrigin.self_initiated]


async def _responses(db: AsyncSession, attempt_id: uuid.UUID) -> list[Response]:
    result = await db.execute(
        select(Response).where(
            Response.attempt_id == attempt_id,
            Response.tenant_id == SEED_TENANT_ID,
        )
    )
    return list(result.scalars().all())


async def _attempt_questions(db: AsyncSession, attempt_id: uuid.UUID) -> list[Question]:
    result = await db.execute(
        select(Question).where(
            Question.attempt_id == attempt_id,
            Question.tenant_id == SEED_TENANT_ID,
        )
    )
    rows = list(result.scalars().all())
    rows.sort(key=lambda q: (q.created_at, str(q.id)))
    return rows


async def _pause_events(
    db: AsyncSession, attempt_id: uuid.UUID
) -> list[AttemptPauseEvent]:
    result = await db.execute(
        select(AttemptPauseEvent).where(
            AttemptPauseEvent.attempt_id == attempt_id,
            AttemptPauseEvent.tenant_id == SEED_TENANT_ID,
        )
    )
    return list(result.scalars().all())


def _open_pause(events: list[AttemptPauseEvent]) -> AttemptPauseEvent | None:
    open_events = [e for e in events if e.ended_at is None]
    if not open_events:
        return None
    return max(open_events, key=lambda e: e.started_at)


# --- deterministic shuffle (AC-D24; pure, unit-tested) ----------------


def seed_for(attempt_id: uuid.UUID) -> int:
    """64-bit seed from the low 8 bytes of the attempt UUID. Pure
    function of the id — never re-randomised, so resume is stable."""
    return int.from_bytes(attempt_id.bytes[-8:], "big")


def option_permutation(question_id: uuid.UUID, seed: int, n: int) -> list[int]:
    """Per-question option permutation. Stable for a given attempt seed
    + question, so grading (Slice 3) re-derives the same mapping."""
    rng = random.Random(seed ^ int.from_bytes(question_id.bytes[-8:], "big"))
    perm = list(range(n))
    rng.shuffle(perm)
    return perm


def presented_questions(
    snapshot: list[dict[str, Any]],
    seed: int,
    *,
    randomise_question_order: bool,
    randomise_option_order: bool,
) -> list[dict[str, Any]]:
    """Resolve the presentation order + answer-stripped configs.

    Questions sharing a ``question_group_id`` shuffle as a single block
    with internal order preserved (case-study pattern, AC-D24). Block
    order is shuffled by ``random.Random(seed)``; same seed + snapshot
    always yields the same presentation (resume-stable, including the
    internal order of a group block)."""
    blocks: dict[str, list[dict[str, Any]]] = {}
    order: list[str] = []
    for index, q in enumerate(snapshot):
        gid = q.get("question_group_id")
        key = f"g:{gid}" if gid else f"q:{index}"
        if key not in blocks:
            blocks[key] = []
            order.append(key)
        blocks[key].append(q)
    if randomise_question_order:
        random.Random(seed).shuffle(order)
    presented: list[dict[str, Any]] = []
    for key in order:
        for q in blocks[key]:
            presented.append(_present_one(q, seed, randomise_option_order))
    return presented


def _present_one(
    q: dict[str, Any], seed: int, randomise_option_order: bool
) -> dict[str, Any]:
    qid = uuid.UUID(str(q["question_id"]))
    qtype = q["type"]
    config = q["config"]
    out: dict[str, Any] = {"prompt": config.get("prompt")}
    if qtype == QuestionType.multiple_choice.value:
        options = list(config.get("options", []))
        if randomise_option_order and options:
            perm = option_permutation(qid, seed, len(options))
            options = [options[i] for i in perm]
        out["options"] = options
    elif qtype == QuestionType.matching.value:
        pairs = list(config.get("pairs", []))
        lefts = [p["left"] for p in pairs]
        rights = [p["right"] for p in pairs]
        if randomise_option_order and rights:
            perm = option_permutation(qid, seed, len(rights))
            rights = [rights[i] for i in perm]
        out["left"] = lefts
        out["right"] = rights
    # true_false / short_answer / scenario expose only the prompt.
    return {
        "id": str(qid),
        "type": qtype,
        "question_group_id": q.get("question_group_id"),
        "config": out,
    }


def _snapshot_from_questions(questions: list[Question]) -> list[dict[str, Any]]:
    return [
        {
            "question_id": str(q.id),
            "type": q.type.value,
            "config": q.config,
            "assigned_difficulty": q.assigned_difficulty,
            "question_group_id": (
                str(q.question_group_id) if q.question_group_id else None
            ),
        }
        for q in questions
    ]


# --- lifecycle --------------------------------------------------------


async def _settle_pause(
    db: AsyncSession, attempt: Attempt, test: Test
) -> AttemptPauseEvent | None:
    """Lazily auto-resume an over-long pause (AC-D11). "Expired" is
    derived here on the next interaction — there is no cron and no
    stored expiry flag; the attempt simply stays paused until touched.
    Returns the still-open pause event (None if not paused)."""
    events = await _pause_events(db, attempt.id)
    current = _open_pause(events)
    if current is None:
        return None
    max_minutes = test.max_pause_duration_minutes or _DEFAULT_MAX_PAUSE_MINUTES
    elapsed = (now_utc() - current.started_at).total_seconds()
    if elapsed >= max_minutes * 60:
        current.ended_at = now_utc()
        current.duration_seconds = int(elapsed)
        current.auto_resumed = True
        attempt.total_pause_duration_seconds += int(elapsed)
        await db.flush()
        return None
    return current


async def start_attempt(
    db: AsyncSession,
    *,
    test: Test,
    testee_id: uuid.UUID,
    origin: AttemptOrigin,
) -> Attempt:
    if test.status != TestStatus.published:
        raise APIError(409, "test_not_published", "This test is not published.")
    if (
        test.visibility == TestVisibility.private
        and origin == AttemptOrigin.self_initiated
    ):
        raise APIError(
            403,
            "test_private",
            "This test is private and only available via assignment.",
        )
    if origin not in _RATE_EXEMPT_ORIGINS:
        await _enforce_rate_limit(db, testee_id)

    prior = sorted(
        await _attempts_for(db, test.id, testee_id),
        key=lambda a: (a.created_at, str(a.id)),
    )
    attempt = Attempt(
        tenant_id=SEED_TENANT_ID,
        test_id=test.id,
        testee_id=testee_id,
        origin=origin,
        sequence_number=len(prior) + 1,
        parent_attempt_id=prior[-1].id if prior else None,
        started_at=now_utc(),
        time_remaining_seconds=(
            test.duration_minutes * 60 if test.timed and test.duration_minutes else None
        ),
        pauses_used=0,
        total_pause_duration_seconds=0,
    )
    db.add(attempt)
    await db.flush()
    await db.refresh(attempt)
    attempt.shuffle_seed = seed_for(attempt.id)

    if test.mode in (TestMode.frozen, TestMode.hand_authored):
        result = await db.execute(
            select(Question).where(
                Question.test_id == test.id,
                Question.tenant_id == SEED_TENANT_ID,
            )
        )
        src = sorted(result.scalars().all(), key=lambda q: (q.created_at, str(q.id)))
        attempt.question_snapshot = {"questions": _snapshot_from_questions(src)}
    elif test.mode == TestMode.per_testee:
        generated = _stub_generate(test, attempt.id)
        for spec in generated:
            db.add(
                Question(
                    tenant_id=SEED_TENANT_ID,
                    attempt_id=attempt.id,
                    type=spec["type"],
                    config=spec["config"],
                    assigned_difficulty=spec["assigned_difficulty"],
                    realism_flag_count=0,
                )
            )
        await db.flush()
        attempt.question_snapshot = {
            "questions": _snapshot_from_questions(
                await _attempt_questions(db, attempt.id)
            )
        }
    else:  # benchmark — sequential, no upfront set
        attempt.question_snapshot = {"questions": []}

    await db.flush()
    await record_audit(
        db,
        actor_id=testee_id,
        action="attempt.start",
        target_entity="attempt",
        target_id=attempt.id,
        detail={"mode": test.mode.value, "origin": origin.value},
    )
    return attempt


async def _enforce_rate_limit(db: AsyncSession, testee_id: uuid.UUID) -> None:
    settings = await _system_settings(db)
    per_hour = (
        getattr(settings, "self_initiated_rate_limit_per_hour", None)
        or _DEFAULT_RATE_PER_HOUR
    )
    per_day = (
        getattr(settings, "self_initiated_rate_limit_per_day", None)
        or _DEFAULT_RATE_PER_DAY
    )
    now = now_utc()
    recent = await _self_initiated_recent(db, testee_id)
    last_hour = sum(1 for a in recent if (now - a.created_at) <= timedelta(hours=1))
    last_day = sum(1 for a in recent if (now - a.created_at) <= timedelta(days=1))
    if last_hour >= per_hour or last_day >= per_day:
        raise APIError(
            429,
            "rate_limited",
            "You've reached the limit on new self-initiated tests. "
            "Active learning loop follow-ups and admin assignments "
            "will continue to be available.",
        )


def _stub_generate(test: Test, attempt_id: uuid.UUID) -> list[dict[str, Any]]:
    """Deterministic P4 placeholder for per-Testee generation. Real
    Anthropic generation is P5 (swap at ``resolve_provider``); JIT
    streaming is P10. Output is a fixed, attempt-seeded deterministic
    set so grading (Slice 3) is exercised end-to-end."""
    difficulty = test.target_difficulty or 5
    rng = random.Random(seed_for(attempt_id))
    a = rng.randint(1, 9)
    b = rng.randint(1, 9)
    return [
        {
            "type": QuestionType.multiple_choice,
            "assigned_difficulty": difficulty,
            "config": {
                "prompt": f"What is {a} + {b}?",
                "options": [str(a + b - 1), str(a + b), str(a + b + 1)],
                "correct": 1,
            },
        },
        {
            "type": QuestionType.true_false,
            "assigned_difficulty": difficulty,
            "config": {"prompt": f"{a} is greater than {b}.", "correct": a > b},
        },
    ]


def _is_timed_out(attempt: Attempt, test: Test) -> bool:
    """Effective test time excludes paused windows — the clock stops
    during a pause (AC-D11). Pause duration is folded into
    ``total_pause_duration_seconds`` on resume/lazy auto-resume, and
    ``submit_attempt`` settles any open pause before calling this, so
    the running total is current here."""
    if not test.timed or not test.duration_minutes or attempt.started_at is None:
        return False
    elapsed = (now_utc() - attempt.started_at).total_seconds()
    effective = elapsed - (attempt.total_pause_duration_seconds or 0)
    return effective >= test.duration_minutes * 60


async def view_attempt(db: AsyncSession, attempt: Attempt, test: Test) -> dict[str, Any]:
    paused = await _settle_pause(db, attempt, test)
    base: dict[str, Any] = {
        "id": attempt.id,
        "test_id": attempt.test_id,
        "testee_id": attempt.testee_id,
        "origin": attempt.origin,
        "sequence_number": attempt.sequence_number,
        "started_at": attempt.started_at,
        "submitted_at": attempt.submitted_at,
        "pauses_used": attempt.pauses_used,
        "pause_allowance": test.pause_allowance or 0,
    }
    if paused is not None:
        max_minutes = test.max_pause_duration_minutes or _DEFAULT_MAX_PAUSE_MINUTES
        remaining = max_minutes * 60 - int(
            (now_utc() - paused.started_at).total_seconds()
        )
        base.update(
            {
                "paused": True,
                "pause_seconds_remaining": max(0, remaining),
                "watermark": str(attempt.testee_id),
                "questions": None,
            }
        )
        return base
    snapshot = (attempt.question_snapshot or {}).get("questions", [])
    base.update(
        {
            "paused": False,
            "pause_seconds_remaining": None,
            "watermark": str(attempt.testee_id),
            "questions": presented_questions(
                snapshot,
                attempt.shuffle_seed or seed_for(attempt.id),
                randomise_question_order=test.randomise_question_order,
                randomise_option_order=test.randomise_option_order,
            ),
        }
    )
    return base


async def autosave(
    db: AsyncSession,
    attempt: Attempt,
    test: Test,
    *,
    question_id: uuid.UUID,
    answer_payload: dict[str, Any] | None,
    time_ms: int | None,
) -> None:
    if attempt.submitted_at is not None:
        raise APIError(409, "attempt_submitted", "This attempt is already submitted.")
    if await _settle_pause(db, attempt, test) is not None:
        raise APIError(409, "attempt_paused", "Resume the attempt before saving.")
    existing = [
        r for r in await _responses(db, attempt.id) if r.question_id == question_id
    ]
    if existing:
        row = existing[0]
        row.answer_payload = answer_payload
        row.time_ms = time_ms
    else:
        db.add(
            Response(
                tenant_id=SEED_TENANT_ID,
                attempt_id=attempt.id,
                question_id=question_id,
                answer_payload=answer_payload,
                time_ms=time_ms,
            )
        )
    await db.flush()


def _pause_blocked_reason(test: Test) -> str | None:
    if not test.timed:
        return "Untimed tests have no pause."
    if not test.duration_minutes or test.duration_minutes <= 60:
        return "Tests of 60 minutes or less permit no pauses (AC-D11)."
    return None


async def pause_attempt(db: AsyncSession, attempt: Attempt, test: Test) -> None:
    if attempt.submitted_at is not None:
        raise APIError(409, "attempt_submitted", "This attempt is already submitted.")
    blocked = _pause_blocked_reason(test)
    if blocked is not None:
        raise APIError(409, "pause_not_allowed", blocked)
    if await _settle_pause(db, attempt, test) is not None:
        raise APIError(409, "already_paused", "This attempt is already paused.")
    if attempt.pauses_used >= (test.pause_allowance or 0):
        raise APIError(409, "pause_allowance_exhausted", "No pauses remaining.")
    db.add(
        AttemptPauseEvent(
            tenant_id=SEED_TENANT_ID,
            attempt_id=attempt.id,
            started_at=now_utc(),
            auto_resumed=False,
        )
    )
    attempt.pauses_used += 1
    await db.flush()


async def resume_attempt(db: AsyncSession, attempt: Attempt, test: Test) -> None:
    current = await _settle_pause(db, attempt, test)
    if current is None:
        return  # already resumed (manually or via lazy auto-resume)
    elapsed = int((now_utc() - current.started_at).total_seconds())
    current.ended_at = now_utc()
    current.duration_seconds = elapsed
    current.auto_resumed = False
    attempt.total_pause_duration_seconds += elapsed
    await db.flush()


async def submit_attempt(db: AsyncSession, attempt: Attempt, test: Test) -> Attempt:
    if attempt.submitted_at is not None:
        return attempt
    # A pause open at submit is closed first (resume-then-submit).
    current = await _settle_pause(db, attempt, test)
    if current is not None:
        await resume_attempt(db, attempt, test)
    attempt.submitted_at = now_utc()
    if _is_timed_out(attempt, test) and test.timeout_behaviour == (
        TimeoutBehaviour.expire
    ):
        attempt.outcome = "expired"
    await db.flush()
    await record_audit(
        db,
        actor_id=attempt.testee_id,
        action="attempt.submit",
        target_entity="attempt",
        target_id=attempt.id,
        detail={"outcome": attempt.outcome},
    )
    return attempt


async def next_question(db: AsyncSession, attempt: Attempt, test: Test) -> dict[str, Any]:
    """Benchmark sequential stub (AC-D13). Deterministic difficulty
    ladder capped at ``P4_BENCHMARK_STEP_CAP``; real adaptive-on-grade
    convergence is P5/P10."""
    if test.mode != TestMode.benchmark:
        raise APIError(409, "not_benchmark", "Sequential next is benchmark-mode only.")
    if attempt.submitted_at is not None:
        raise APIError(409, "attempt_submitted", "This attempt is already submitted.")
    asked = await _attempt_questions(db, attempt.id)
    if len(asked) >= P4_BENCHMARK_STEP_CAP:
        return {"done": True, "asked": len(asked)}
    step = len(asked)
    # Midpoint start (5), deterministic ±1 ladder by step index. P5/P10
    # replace this with pass/partial/fail-driven ±2/±1 convergence.
    difficulty = max(1, min(10, 5 + (step % 2) * 2 - (step // 2)))
    a = step + 1
    question = Question(
        tenant_id=SEED_TENANT_ID,
        attempt_id=attempt.id,
        type=QuestionType.true_false,
        config={"prompt": f"Benchmark step {a}: {a} >= 1.", "correct": True},
        assigned_difficulty=difficulty,
        realism_flag_count=0,
    )
    db.add(question)
    await db.flush()
    await db.refresh(question)
    return {
        "done": False,
        "step": step + 1,
        "question": {
            "id": str(question.id),
            "type": question.type.value,
            "config": {"prompt": question.config["prompt"]},
            "assigned_difficulty": difficulty,
        },
    }
