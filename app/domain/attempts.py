"""Attempt lifecycle — start, snapshot, deterministic shuffle, pause/
resume, autosave, submit, benchmark next (AC-D3 / AC-D5 / AC-D11 /
AC-D13 / AC-D17 / AC-D18 / AC-D24 / AC-D26).

P4 is the deterministic spine; AI grading is P5 and cross-family review
is P6. In P4 the per-Testee question set is stub-generated synchronously
at start and stored against the attempt — forward-compatible with P10
swapping in JIT-streamed generation. Frozen/hand-authored attempts
snapshot the test's question set at start (AC-D17). Benchmark runs
sequentially via ``next_question`` capped at ``P4_BENCHMARK_STEP_CAP``;
real adaptive convergence is P5/P10.

Shuffle is a pure function of the attempt id (AC-D24): the 64-bit seed
never re-randomises, so resume and reload yield an identical
presentation. Questions sharing a ``question_group_id`` shuffle as a
block with block-internal order preserved (case-study pattern).

Pause blanks question content (AC-D11). "Pause expired" is **derived
state computed on the next interaction** (lazy auto-resume), never a
stored flag or a scheduled job — a long-paused attempt stays paused in
the DB until a Testee/admin touches it, at which point the elapsed
window closes with ``auto_resumed=true`` and the clock restarts.

``assignment_id`` (AC-D26 v1.4) is populated at start for assignment-
driven and loop-driven origins, validated against the
``assignment_assignee`` snapshot for this Testee. Self-initiated origin
stores NULL. ``sequence_number`` (AC-D3 v1.5) is inserted under the
shipped ``uq_attempt_test_testee_sequence`` constraint with a bounded
``IntegrityError``-retry path so concurrent starts can never collide.

Routers stay thin (CODE_SPEC §2/§3). Queries are id/tenant equality
with Python-side work so the AC-CD15 zero-DB harness holds.
"""

from __future__ import annotations

import logging
import random
import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.cost import (
    maybe_fire_budget_alert,
    record_provenance,
    record_provenance_share,
)
from app.ai.provider import Operation, resolve_provider
from app.domain._scoring import outcome_for as _outcome_for
from app.domain.calibration import draw_anchors_for_attempt
from app.domain.catalogue import record_audit
from app.domain.competence import apply_competence_update
from app.domain.drive_rag import (
    list_low_realism_questions_for_pill,
    render_low_realism_examples,
    render_rag_context,
    retrieve_for_generation,
)
from app.domain.grade_review import _review_ai_grades
from app.domain.loop import apply_overlap_check, run_loop_after_submit
from app.models import (
    SEED_TENANT_ID,
    Assignment,
    AssignmentAssignee,
    Attempt,
    AttemptAnchor,
    AttemptOrigin,
    AttemptPauseEvent,
    Grade,
    GradeReview,
    GradeSource,
    GradeVerdict,
    Pill,
    Question,
    QuestionType,
    Response,
    ReviewStatus,
    SystemSettings,
    Test,
    TestMode,
    TestStatus,
    TestVisibility,
    TimeoutBehaviour,
)
from app.permissions import APIError, now_utc

_log = logging.getLogger(__name__)

__all__ = [
    "P4_BENCHMARK_STEP_CAP",
    "DETERMINISTIC_TYPES",
    "AI_GRADED_TYPES",
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
    "result_view",
]

# Deterministic types grade locally in P4 (Slice 3). AI-graded types
# (short_answer / scenario) flow through P5 grading + P6 cross-family
# review; in P4 they produce no grade / grade_review row, and the
# result-display gate (F14) withholds the result page until those
# downstream phases land.
DETERMINISTIC_TYPES = frozenset(
    {QuestionType.multiple_choice, QuestionType.true_false, QuestionType.matching}
)
AI_GRADED_TYPES = frozenset({QuestionType.short_answer, QuestionType.scenario})

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

# Per_testee generation question count — a sensible default until the
# Test model carries an explicit ``question_count`` column. P5 hardcodes
# this so the AI generation call has a target; the stub provider always
# returns its fixed 2-question deterministic set regardless of the
# requested count (dev/local parity with P4 behaviour). Future phases
# add the Test column and read from it instead.
_GENERATION_DEFAULT_QUESTION_COUNT = 5

# Bounded retry on the ``(test_id, testee_id, sequence_number)`` unique
# constraint (AC-D3 v1.5). Protects against pathological concurrent
# start_attempt races; at KBC scale it essentially never fires, but the
# bound prevents an unbounded loop if the DB or model layer ever drifts
# from expected behaviour.
_SEQUENCE_RETRY_LIMIT = 5

# Rate limit counts self-initiated only; assignment- and loop-driven are
# exempt (AC-D18). loop_driven is not produced until P7 but is in the
# exempt set now so P7 plugs in with no rate-limit change.
_RATE_EXEMPT_ORIGINS = frozenset(
    {AttemptOrigin.assignment_driven, AttemptOrigin.loop_driven}
)

# Origins that REQUIRE an ``assignment_id`` (AC-D26 v1.4). Self-initiated
# attempts never carry one.
_ASSIGNMENT_BACKED_ORIGINS = frozenset(
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


async def _attempt_anchors(
    db: AsyncSession, attempt_id: uuid.UUID
) -> list[AttemptAnchor]:
    result = await db.execute(
        select(AttemptAnchor).where(
            AttemptAnchor.attempt_id == attempt_id,
            AttemptAnchor.tenant_id == SEED_TENANT_ID,
        )
    )
    return list(result.scalars().all())


async def _denormalise_attempt_anchor_scores(db: AsyncSession, attempt: Attempt) -> None:
    """Copy each :class:`Response.response_score` for an anchor-drawn
    question into the matching :class:`AttemptAnchor.score` column
    (P8 Slice 3 / refinement #3).

    Shared-PK convention makes the join cheap: an anchor's
    ``Question.id`` and its ``AnchorQuestion.id`` are the same UUID, so
    looking up ``Response.question_id == AttemptAnchor.anchor_question_id``
    walks the existing per-attempt Response index. No new join needed.

    Anchors with no answering Response (Testee skipped the item, or
    submit fired before autosave) leave ``score = None`` — the
    calibration sweep treats those as missing observations rather
    than zeros.
    """
    anchors = await _attempt_anchors(db, attempt.id)
    if not anchors:
        return
    responses_by_qid = {r.question_id: r for r in await _responses(db, attempt.id)}
    for anchor in anchors:
        response = responses_by_qid.get(anchor.anchor_question_id)
        if response is not None and response.response_score is not None:
            anchor.score = response.response_score


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


async def _is_assignee(
    db: AsyncSession, assignment_id: uuid.UUID, testee_id: uuid.UUID
) -> bool:
    """AC-D15 / AC-D26: the assignee snapshot at assignment creation is
    the authority over who may start an attempt against the assignment;
    later group-membership changes do not retroactively grant access."""
    result = await db.execute(
        select(AssignmentAssignee).where(
            AssignmentAssignee.assignment_id == assignment_id,
            AssignmentAssignee.user_id == testee_id,
            AssignmentAssignee.tenant_id == SEED_TENANT_ID,
        )
    )
    return result.scalar_one_or_none() is not None


async def _load_pill_for_assignment(
    db: AsyncSession, assignment_id: uuid.UUID | None
) -> Pill | None:
    """Resolve the :class:`Pill` row scoped by an :class:`Assignment`
    for the Drive RAG retrieval query (P9 Slice 3 / AC-D22).

    Returns ``None`` when:

    * ``assignment_id is None`` — a self-initiated attempt with no
      assignment scope; no pill to query for, no RAG context.
    * The assignment exists but has ``pill_id is None`` — a
      learning-path assignment (multiple pills); per AC-D22 the
      retrieval query is single-pill-scoped, so multi-pill assignments
      get no RAG context.
    * The assignment is missing or the pill is missing — defensive
      fallthrough (the assignee gate at start_attempt rejects
      missing assignments before we get here, but the lookup stays
      tolerant).

    The RAG retrieval helper :func:`retrieve_for_generation` returns
    ``[]`` for a ``None`` pill, so a non-pill assignment proceeds
    with empty RAG context rather than crashing — matches SPEC §6.1
    fail-soft semantics."""
    if assignment_id is None:
        return None
    assignment_result = await db.execute(
        select(Assignment).where(
            Assignment.id == assignment_id,
            Assignment.tenant_id == SEED_TENANT_ID,
        )
    )
    assignment = assignment_result.scalar_one_or_none()
    if assignment is None or assignment.pill_id is None:
        return None
    pill_result = await db.execute(
        select(Pill).where(
            Pill.id == assignment.pill_id, Pill.tenant_id == SEED_TENANT_ID
        )
    )
    return pill_result.scalar_one_or_none()


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
    # Explicit ``is None`` so an admin-configured ``0`` (immediate
    # auto-resume) is honoured, not silently coerced to the default.
    max_minutes = (
        test.max_pause_duration_minutes
        if test.max_pause_duration_minutes is not None
        else _DEFAULT_MAX_PAUSE_MINUTES
    )
    elapsed = (now_utc() - current.started_at).total_seconds()
    if elapsed >= max_minutes * 60:
        current.ended_at = now_utc()
        current.duration_seconds = int(elapsed)
        current.auto_resumed = True
        attempt.total_pause_duration_seconds += int(elapsed)
        await db.flush()
        return None
    return current


async def _insert_with_sequence(
    db: AsyncSession,
    *,
    test_id: uuid.UUID,
    testee_id: uuid.UUID,
    origin: AttemptOrigin,
    assignment_id: uuid.UUID | None,
    parent_attempt_id: uuid.UUID | None,
    started_at: Any,
    time_remaining_seconds: int | None,
) -> Attempt:
    """Insert the attempt with the next ``sequence_number`` for this
    (test, testee). On ``IntegrityError`` (a concurrent start raced this
    one to the same number), recompute and retry up to
    ``_SEQUENCE_RETRY_LIMIT``. At KBC scale this loop essentially never
    fires, but the bound prevents an unbounded retry if the constraint
    or model drifts."""
    last_err: IntegrityError | None = None
    for _ in range(_SEQUENCE_RETRY_LIMIT):
        prior = sorted(
            await _attempts_for(db, test_id, testee_id),
            key=lambda a: (a.created_at, str(a.id)),
        )
        attempt = Attempt(
            tenant_id=SEED_TENANT_ID,
            test_id=test_id,
            testee_id=testee_id,
            origin=origin,
            assignment_id=assignment_id,
            sequence_number=len(prior) + 1,
            parent_attempt_id=parent_attempt_id,
            started_at=started_at,
            time_remaining_seconds=time_remaining_seconds,
            pauses_used=0,
            total_pause_duration_seconds=0,
        )
        db.add(attempt)
        try:
            await db.flush()
            await db.refresh(attempt)
            return attempt
        except IntegrityError as exc:
            last_err = exc
            await db.rollback()
    raise APIError(
        409,
        "sequence_contention",
        "Could not assign a retake number after retries; please try again.",
    ) from last_err


async def start_attempt(
    db: AsyncSession,
    *,
    test: Test,
    testee_id: uuid.UUID,
    origin: AttemptOrigin,
    assignment_id: uuid.UUID | None = None,
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

    # AC-D26 v1.4: assignment-driven and loop-driven origins MUST carry
    # an assignment_id, validated against the assignee snapshot at
    # assignment creation. self_initiated MUST NOT carry one.
    if origin in _ASSIGNMENT_BACKED_ORIGINS:
        if assignment_id is None:
            raise APIError(
                422,
                "assignment_required",
                "Assignment-driven and loop-driven attempts require assignment_id.",
            )
        if not await _is_assignee(db, assignment_id, testee_id):
            raise APIError(
                403,
                "not_assignee",
                "This Testee is not a snapshotted assignee of that assignment.",
            )
    elif assignment_id is not None:
        raise APIError(
            422,
            "assignment_not_allowed",
            "Self-initiated attempts must not carry assignment_id.",
        )

    if origin not in _RATE_EXEMPT_ORIGINS:
        await _enforce_rate_limit(db, testee_id)

    # Settings drive per-operation provider/model overrides at the AI
    # call sites below (per_testee generation). Fetched once per
    # start_attempt; ``_enforce_rate_limit`` does its own fetch for the
    # rate-limit fields (cheap; the harness is in-memory and prod hits
    # an indexed single-row tenant lookup).
    settings = await _system_settings(db)

    prior_attempts = await _attempts_for(db, test.id, testee_id)
    prior_sorted = sorted(prior_attempts, key=lambda a: (a.created_at, str(a.id)))
    parent_id = prior_sorted[-1].id if prior_sorted else None

    attempt = await _insert_with_sequence(
        db,
        test_id=test.id,
        testee_id=testee_id,
        origin=origin,
        assignment_id=assignment_id,
        parent_attempt_id=parent_id,
        started_at=now_utc(),
        time_remaining_seconds=(
            test.duration_minutes * 60 if test.timed and test.duration_minutes else None
        ),
    )
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
        # P5 Slice 2 — replaces P4's ``_stub_generate`` deterministic
        # placeholder with the resolved Anthropic provider call. Per AI
        # call produces N Question rows (one per generated question);
        # ``record_provenance_share`` divides cost + tokens evenly
        # across the N rows so the cost dashboard's per-attempt
        # aggregation sums to the call total (AC-D18). Provider, model,
        # and prompt_version are full per-call values replicated on
        # every row.
        #
        # P9 Slice 3 — folds Drive RAG context into the payload per
        # AC-D22. When the assignment has a single pill scope, the
        # retrieve helper embeds a query (pill name + description +
        # difficulty band) and returns top-k chunks; the prompt's
        # ``rag_context`` placeholder receives the rendered block.
        # Learning-path assignments (no single pill) and self-initiated
        # attempts get an empty rag_context so the prompt template
        # renders cleanly with the "(none)" sentinel.
        target_difficulty = int(round(test.target_difficulty or 5))
        rag_pill = await _load_pill_for_assignment(db, assignment_id)
        rag_hits = await retrieve_for_generation(
            db, pill=rag_pill, target_difficulty=target_difficulty
        )
        # P9 Slice 4 — low-realism negative-examples per AC-D22. The
        # pool is per-pill, so a learning-path assignment (rag_pill is
        # None) sees ``(none)``; same fallthrough as the rag_context
        # block above.
        low_realism = (
            await list_low_realism_questions_for_pill(db, pill_id=rag_pill.id)
            if rag_pill is not None
            else []
        )
        provider = resolve_provider(Operation.generation, system_settings=settings)
        gen_result = await provider.generate(
            Operation.generation,
            {
                "test_name": test.name,
                "target_difficulty": test.target_difficulty or 5,
                "question_count": _GENERATION_DEFAULT_QUESTION_COUNT,
                "attempt_id": str(attempt.id),
                "rag_context": render_rag_context(rag_hits),
                "low_realism_negative_examples": render_low_realism_examples(low_realism),
            },
        )
        generated = gen_result.content.get("questions") or []
        # Defensive: skip malformed specs rather than crash the attempt.
        # Matches the AI-grading path's defensive posture below — a
        # single bad spec must not block a testee from starting.
        # Provenance is shared across VALID questions only so the cost
        # dashboard's sum-to-call-total invariant holds (Gitar PR-#16
        # Slice 2 finding #1).
        valid_questions: list[Question] = []
        for spec in generated:
            try:
                question = Question(
                    tenant_id=SEED_TENANT_ID,
                    attempt_id=attempt.id,
                    type=QuestionType(spec["type"]),
                    config=spec["config"],
                    assigned_difficulty=spec["assigned_difficulty"],
                    realism_flag_count=0,
                )
            except (KeyError, ValueError, TypeError):
                continue
            valid_questions.append(question)
        share_count = max(1, len(valid_questions))
        for question in valid_questions:
            record_provenance_share(question, gen_result, share_count=share_count)
            db.add(question)
        await db.flush()
        # P8 Slice 3 — anchor draw. Adds up to 2 :class:`AttemptAnchor`
        # rows + folds the matching anchor :class:`Question` rows into
        # the snapshot so the Testee sees them inline with the
        # per_testee items (AC-D20 / AC-D27). No-ops for learning-path
        # assignments (assignment.pill_id is None) and for empty pools
        # (pill has no anchors generated yet).
        anchor_questions = await draw_anchors_for_attempt(
            db, attempt=attempt, test=test, assignment_id=assignment_id
        )
        await db.flush()
        per_testee_questions = await _attempt_questions(db, attempt.id)
        attempt.question_snapshot = {
            "questions": _snapshot_from_questions(per_testee_questions + anchor_questions)
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
        detail={
            "mode": test.mode.value,
            "origin": origin.value,
            "assignment_id": str(assignment_id) if assignment_id else None,
        },
    )
    # Per-call budget-alert poll (AC-D18 v1.1). Fail-soft — no hard
    # enforcement; alert emails go through the P2 SMTPClient seam.
    await maybe_fire_budget_alert(db, tenant_id=SEED_TENANT_ID)
    return attempt


async def _enforce_rate_limit(db: AsyncSession, testee_id: uuid.UUID) -> None:
    # Explicit ``is None`` (not ``or``) so an admin's intentional ``0``
    # — "disable the limit" — is preserved instead of silently falling
    # back to the default (Gitar PR-#15 finding). The SystemSettings
    # columns are non-nullable in production but ``None`` is the test
    # seam's no-row signal, so the unset path still defaults cleanly.
    settings = await _system_settings(db)
    per_hour = _DEFAULT_RATE_PER_HOUR
    per_day = _DEFAULT_RATE_PER_DAY
    if settings is not None:
        configured_hour = getattr(settings, "self_initiated_rate_limit_per_hour", None)
        configured_day = getattr(settings, "self_initiated_rate_limit_per_day", None)
        if configured_hour is not None:
            per_hour = configured_hour
        if configured_day is not None:
            per_day = configured_day
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
        "assignment_id": attempt.assignment_id,
        "origin": attempt.origin,
        "sequence_number": attempt.sequence_number,
        "started_at": attempt.started_at,
        "submitted_at": attempt.submitted_at,
        "pauses_used": attempt.pauses_used,
        "pause_allowance": test.pause_allowance or 0,
    }
    if paused is not None:
        # Explicit ``is None`` so an admin-configured ``0`` (immediate
        # auto-resume) is honoured, not silently coerced to the default.
        max_minutes = (
            test.max_pause_duration_minutes
            if test.max_pause_duration_minutes is not None
            else _DEFAULT_MAX_PAUSE_MINUTES
        )
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
    if _is_timed_out(attempt, test) and test.timeout_behaviour == TimeoutBehaviour.expire:
        attempt.outcome = "expired"
    # Deterministic auto-grading runs immediately (AC-D5 / AC-D19).
    # AI grading for short_answer / scenario types runs immediately too
    # (P5 Slice 2) — a Grade row is written per AI response.
    # Cross-family review (P6 Slice 2 — AC-D19 v1.7 / AC-CD11 v1.7):
    # one batched OpenAI call covers every AI-graded response in the
    # attempt under a 60-s ceiling; ``_review_ai_grades`` writes a
    # paired GradeReview per AI Grade (pending → confirmed/flagged) and
    # recomputes ``attempt.overall_score`` over deterministic +
    # confirmed-AI grades. Fail-soft: on timeout / provider error / off-
    # contract response the affected rows stay ``pending``; the §8.9
    # reconcile cron picks them up.
    await _auto_grade_deterministic(db, attempt, test)
    await _ai_grade_responses(db, attempt)
    await db.flush()
    # P8 Slice 3 — denormalise per-anchor scores. Each
    # :class:`AttemptAnchor` row written by ``start_attempt`` carries a
    # nullable ``score`` mirroring the Testee's response_score for that
    # anchor (refinement #3 — keep the column in sync with the source
    # so the calibration sweep can read a single column rather than
    # walking the Response table per anchor). Failure-isolated: a
    # denormalisation fault must not block the submit; the next
    # calibration sweep will re-read scores from Response anyway if
    # we ever need to recover.
    try:
        await _denormalise_attempt_anchor_scores(db, attempt)
    except Exception:
        _log.exception(
            "P8 anchor score denormalisation failed for attempt %s", attempt.id
        )
    # P7 — n-gram trigram overlap pass against the last
    # ``LearningMaterial.served_text`` for (testee, pill). Sets
    # ``Grade.overlap_pct`` + ``Grade.overlap_flagged`` on AI-graded
    # rows. Runs BEFORE review so the review payload can include the
    # overlap signal if the prompt template wants it; today it doesn't,
    # but the ordering preserves the option without a re-flush. Failure-
    # isolated — an overlap fault is logged and the submit continues.
    try:
        await apply_overlap_check(db, attempt)
    except Exception:
        # No reconcile sweep for overlap in P7 — the flag is advisory,
        # not blocking; admin grade review (P6) still surfaces the row.
        # ``logger.exception`` emits at ERROR with the full traceback so
        # production failures are observable (PR-019 Gitar review).
        _log.exception("P7 overlap check failed for attempt %s", attempt.id)
    # The review pass needs the snapshot's per-question rubric + model
    # answer + prompt to build the batched payload — compute it once
    # here and pass it through so neither side re-loads the snapshot.
    specs = await _gradable_question_specs(db, attempt)
    await _review_ai_grades(db, attempt, test, specs=specs)
    await db.flush()
    # P7 — competence_estimate refresh + autonomous loop driver. Both
    # are scope-guarded to single-pill assignment-backed attempts
    # (assignment_driven / loop_driven with pill_id set). Failure-
    # isolated independently so a competence fault doesn't kill the
    # loop and vice versa.
    try:
        await apply_competence_update(db, attempt)
    except Exception:
        _log.exception("P7 competence update failed for attempt %s", attempt.id)
    try:
        await run_loop_after_submit(db, attempt, test)
    except Exception:
        # Note: run_loop_after_submit creates Test/Assignment/Assignee
        # rows before invoking start_attempt for the follow-up Attempt.
        # A mid-flow failure can leave partial rows; the Slice 3 admin
        # queue surfaces the WeaknessReport (which writes first) so an
        # admin can manually reconcile. Future P11 work: a reconcile
        # sweep that detects orphaned Test/Assignment without a started
        # follow-up Attempt and either completes or rolls them back.
        _log.exception("P7 loop driver failed for attempt %s", attempt.id)
    await record_audit(
        db,
        actor_id=attempt.testee_id,
        action="attempt.submit",
        target_entity="attempt",
        target_id=attempt.id,
        detail={"outcome": attempt.outcome, "overall_score": attempt.overall_score},
    )
    return attempt


# --- deterministic grading (AC-D5 / AC-D17 / AC-D19) -----------------


def _grade_mcq(answer: dict[str, Any] | None, config: dict[str, Any]) -> float:
    """1.0 on exact match against ``config.correct``; else 0.0. Missing
    or malformed answers score 0.0 (didn't answer)."""
    if not isinstance(answer, dict):
        return 0.0
    choice = answer.get("choice")
    return 1.0 if choice == config.get("correct") else 0.0


def _grade_true_false(answer: dict[str, Any] | None, config: dict[str, Any]) -> float:
    if not isinstance(answer, dict):
        return 0.0
    return 1.0 if answer.get("answer") == config.get("correct") else 0.0


def _grade_matching(answer: dict[str, Any] | None, config: dict[str, Any]) -> float:
    """Score = fraction of correctly matched pairs. The canonical
    encoding: ``answer.matches`` is a list of right indices, one per
    left position (identity is the correct mapping in the snapshot)."""
    pairs = config.get("pairs") or []
    if not pairs:
        return 0.0
    if not isinstance(answer, dict):
        return 0.0
    matches = answer.get("matches")
    if not isinstance(matches, list):
        return 0.0
    correct = sum(1 for i, m in enumerate(matches) if i < len(pairs) and m == i)
    return correct / len(pairs)


def _verdict_for(score: float) -> GradeVerdict:
    if score >= 1.0:
        return GradeVerdict.full
    if score <= 0.0:
        return GradeVerdict.none
    return GradeVerdict.partial


def _grade_response_score(
    qtype: QuestionType, config: dict, answer: dict | None
) -> float:
    if qtype == QuestionType.multiple_choice:
        return _grade_mcq(answer, config)
    if qtype == QuestionType.true_false:
        return _grade_true_false(answer, config)
    if qtype == QuestionType.matching:
        return _grade_matching(answer, config)
    # AI-graded types fall through; the caller never invokes this for them.
    raise APIError(500, "ungradable_type", f"Type {qtype.value} is not auto-graded.")


async def _gradable_question_specs(
    db: AsyncSession, attempt: Attempt
) -> list[dict[str, Any]]:
    """Return ``{question_id, type, config}`` per question on the
    attempt. The snapshot is the source of truth for frozen / hand-
    authored / per_testee (start_attempt populates it). Benchmark
    attempts have an empty snapshot — questions live on Question rows
    keyed by ``attempt_id`` — so we hydrate from there."""
    snap_qs: list[dict[str, Any]] = list(
        (attempt.question_snapshot or {}).get("questions") or []
    )
    if snap_qs:
        return snap_qs
    rows = await _attempt_questions(db, attempt.id)
    return [
        {"question_id": str(q.id), "type": q.type.value, "config": q.config} for q in rows
    ]


async def _auto_grade_deterministic(
    db: AsyncSession, attempt: Attempt, test: Test
) -> None:
    """Grade MCQ / true_false / matching responses, write a ``Grade``
    row per graded response, fold the average into ``overall_score``,
    and set ``outcome`` against ``test.pass_threshold``. AI-graded
    types are skipped — no grade or grade_review row in P4 (F14)."""
    responses = {r.question_id: r for r in await _responses(db, attempt.id)}
    specs = await _gradable_question_specs(db, attempt)
    graded_scores: list[float] = []
    for spec in specs:
        qid = uuid.UUID(str(spec["question_id"]))
        qtype = QuestionType(spec["type"])
        if qtype in AI_GRADED_TYPES:
            continue
        if qtype not in DETERMINISTIC_TYPES:
            continue
        response = responses.get(qid)
        answer = response.answer_payload if response is not None else None
        score = _grade_response_score(qtype, spec["config"], answer)
        if response is None:
            response = Response(
                tenant_id=SEED_TENANT_ID,
                attempt_id=attempt.id,
                question_id=qid,
                answer_payload=None,
                response_score=score,
            )
            db.add(response)
            await db.flush()
            await db.refresh(response)
        else:
            response.response_score = score
        db.add(
            Grade(
                tenant_id=SEED_TENANT_ID,
                response_id=response.id,
                score=score,
                verdict=_verdict_for(score),
                source=GradeSource.auto,
            )
        )
        graded_scores.append(score)
    # Don't overwrite a timeout-driven outcome ("expired").
    if attempt.outcome is None and graded_scores:
        overall = sum(graded_scores) / len(graded_scores)
        attempt.overall_score = overall
        attempt.outcome = _outcome_for(overall, test)


# --- AI grading (P5 Slice 2 — AC-D19 / AC-CD8 v1.6) -----------------


async def _ai_grade_responses(db: AsyncSession, attempt: Attempt) -> None:
    """Grade short_answer / scenario responses via the resolved
    Anthropic provider, one AI call per response. Writes a ``Grade``
    row with ``source=ai`` carrying the AI's verdict + reasoning +
    full per-call provenance (provider, model, prompt_version, tokens,
    cost) per AC-CD8 v1.6 / F7.

    Does NOT fold AI grades into ``attempt.overall_score`` in P5 — the
    F14 result-display gate withholds the Testee-facing result page
    for any mixed attempt until P6 cross-family review confirms each
    AI grade. Computing the overall_score before review would leak a
    preliminary value into the audit-log detail and into any admin
    read of the row. P6 closes the gate and recomputes overall_score
    over deterministic + confirmed-AI grades.
    """
    settings = await _system_settings(db)
    provider = resolve_provider(Operation.grading, system_settings=settings)
    responses = {r.question_id: r for r in await _responses(db, attempt.id)}
    specs = await _gradable_question_specs(db, attempt)
    for spec in specs:
        qid = uuid.UUID(str(spec["question_id"]))
        qtype = QuestionType(spec["type"])
        if qtype not in AI_GRADED_TYPES:
            continue
        response = responses.get(qid)
        # An unanswered AI-graded question gets a Response row with
        # null answer_payload so grading still produces a row (consistent
        # with the deterministic path's handling of missing answers).
        if response is None:
            response = Response(
                tenant_id=SEED_TENANT_ID,
                attempt_id=attempt.id,
                question_id=qid,
                answer_payload=None,
                response_score=None,
            )
            db.add(response)
            await db.flush()
            await db.refresh(response)
        config = spec["config"]
        candidate_text = ""
        if isinstance(response.answer_payload, dict):
            candidate_text = str(response.answer_payload.get("text", ""))
        grade_result = await provider.grade(
            Operation.grading,
            {
                "question": str(config.get("prompt", "")),
                "rubric": str(config.get("rubric", "")),
                "model_answer": str(config.get("model_answer", "")),
                "candidate_response": candidate_text,
            },
        )
        # Defensive on both score AND verdict — both come from the
        # same untrusted AI output (Gitar PR-#16 Slice 2 finding #2).
        # A non-numeric ``score`` (e.g. "high", "N/A") defaults to 0.0
        # so the grade row exists with a "didn't grade" verdict and
        # the audit trail captures the verbatim reasoning string.
        try:
            score = float(grade_result.content.get("score", 0.0))
        except (ValueError, TypeError):
            score = 0.0
        verdict_raw = str(grade_result.content.get("verdict", "none"))
        try:
            verdict = GradeVerdict(verdict_raw)
        except ValueError:
            verdict = GradeVerdict.none
        grade = Grade(
            tenant_id=SEED_TENANT_ID,
            response_id=response.id,
            score=score,
            verdict=verdict,
            source=GradeSource.ai,
            ai_reasoning=str(grade_result.content.get("reasoning", "")),
        )
        record_provenance(grade, grade_result)
        response.response_score = score
        db.add(grade)
    # Single budget-alert poll after the full grading batch (one call
    # per attempt, not per response) — keeps the post-call hook cheap
    # while still firing at the next threshold cross.
    await maybe_fire_budget_alert(db, tenant_id=SEED_TENANT_ID)


# --- result view (F14 mixed-test display gate) ----------------------


async def result_view(db: AsyncSession, attempt: Attempt, test: Test) -> dict[str, Any]:
    """Return the Testee-facing result for a submitted attempt, gated
    on cross-family review completion (F14 v1.7 / AC-D19 v1.7).

    Gate states:

    * **No AI-graded items** → ``status="ready"`` immediately
      (fully-deterministic path; unchanged from P5).
    * **Any GradeReview still pending** → ``status="review_pending"``
      (no scores leak; the §8.9 reconcile cron is the second chance).
    * **All GradeReviews confirmed / flagged** → ``status="ready"``.
      Confirmed AI grades render normally; flagged AI grades whose
      underlying Grade has not been admin-overridden render as
      ``status="under_admin_review"`` with no score / verdict leak
      ("only confirmed grades display synchronously" — AC-D19 v1.6 /
      v1.7).
    """
    if attempt.submitted_at is None:
        raise APIError(409, "attempt_not_submitted", "Attempt has not been submitted.")
    specs = await _gradable_question_specs(db, attempt)
    has_ai_graded = any(QuestionType(spec["type"]) in AI_GRADED_TYPES for spec in specs)
    base: dict[str, Any] = {
        "attempt_id": attempt.id,
        "submitted_at": attempt.submitted_at,
    }

    # Load grades + paired grade_reviews for the attempt's responses
    # using the in-memory-session-compatible equality WHERE pattern
    # (AC-CD15). Joins would be cleaner but the test fake supports
    # single-model equality only.
    responses = {r.question_id: r for r in await _responses(db, attempt.id)}
    grades_by_response: dict[uuid.UUID, Grade] = {}
    grade_reviews_by_grade: dict[uuid.UUID, GradeReview] = {}
    for resp_id in [r.id for r in responses.values()]:
        result = await db.execute(
            select(Grade).where(
                Grade.response_id == resp_id, Grade.tenant_id == SEED_TENANT_ID
            )
        )
        grade = result.scalar_one_or_none()
        if grade is None:
            continue
        grades_by_response[resp_id] = grade
        if grade.source == GradeSource.ai:
            gr_result = await db.execute(
                select(GradeReview).where(
                    GradeReview.grade_id == grade.id,
                    GradeReview.tenant_id == SEED_TENANT_ID,
                )
            )
            gr = gr_result.scalar_one_or_none()
            if gr is not None:
                grade_reviews_by_grade[grade.id] = gr

    if has_ai_graded:
        # Pending AI grade (no GradeReview row yet, or GradeReview.status
        # == pending) → withhold the result page. The §8.9 reconcile cron
        # is the next pass.
        ai_grades = [g for g in grades_by_response.values() if g.source == GradeSource.ai]
        if any(
            grade_reviews_by_grade.get(g.id) is None
            or grade_reviews_by_grade[g.id].status == ReviewStatus.pending
            for g in ai_grades
        ):
            base["status"] = "review_pending"
            return base

    per_question: list[dict[str, Any]] = []
    for spec in specs:
        qid = uuid.UUID(str(spec["question_id"]))
        response = responses.get(qid)
        grade = grades_by_response.get(response.id) if response is not None else None
        if (
            grade is not None
            and grade.source == GradeSource.ai
            and grade.overridden_at is None
        ):
            gr = grade_reviews_by_grade.get(grade.id)
            if gr is not None and gr.status == ReviewStatus.flagged:
                # AC-D19 v1.6 / v1.7 — flagged + not-yet-admin-resolved
                # surfaces a provisional "under admin review" state with
                # no AI grade leaked.
                per_question.append(
                    {
                        "question_id": str(qid),
                        "type": spec["type"],
                        "status": "under_admin_review",
                        "source": "ai",
                        "score": None,
                        "verdict": None,
                    }
                )
                continue
        per_question.append(
            {
                "question_id": str(qid),
                "type": spec["type"],
                "score": grade.score if grade is not None else None,
                "verdict": grade.verdict.value if grade is not None else None,
                "source": grade.source.value if grade is not None else None,
            }
        )
    base.update(
        {
            "status": "ready",
            "overall_score": attempt.overall_score,
            "outcome": attempt.outcome,
            "questions": per_question,
        }
    )
    return base


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
