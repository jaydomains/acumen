"""Adaptive learning loop — wires weakness → material → follow-up
attempt creation at submit time. AC-D6 / AC-D9 / AC-D21 / AC-D26 /
AC-D33; SPEC §6.3/6.4; CODE_SPEC §3.

P5 shipped :func:`app.domain.weakness.identify_weakness` and
:func:`app.domain.learning_material.generate_for_weakness` as pure
callable domain functions. P7 wires both from
:func:`app.domain.attempts.submit_attempt` and adds the autonomous-mode
follow-up creator.

**Scope (locked at planning).** Both ``apply_overlap_check`` and
``run_loop_after_submit`` operate only on single-pill assignment-backed
attempts:

  * ``attempt.origin`` ∈ {assignment_driven, loop_driven}
  * ``assignment.pill_id`` is set (learning-path assignments are excluded)

Self-initiated attempts, learning-path-driven attempts, and the
overlap check on non-pill questions skip silently. Per the user's
plan-approval note: "P7's competence_estimate + autonomous loop fire
only on single-pill assignment-driven attempts. Multi-pill scenarios
(self-initiated, learning-path) produce WeaknessReport +
LearningMaterial but skip both. Broader pill-resolution lands when
self-directed pill selection lands on the data model (post-v1)."

**Failure isolation.** The caller in ``submit_attempt`` wraps every
loop hook in a try/except so a loop failure cannot fail the user's
submit. A reconcile sweep that retries failed loops is out of scope
for P7 — when a loop fails the Testee's submit is intact, the failure
is logged, and the admin queue (Slice 3) can manually reroute.

**Autonomous follow-up cost shape.** One failed attempt with N weak
pills triggers ~(1 + N) inline AI calls at submit time (1 weakness +
N learning_material). Each autonomous follow-up adds 1 inline AI call
(per_testee generation) when the loop invokes ``start_attempt``, plus
1 AI grade call per AI-graded response at the *next* submit. Budget
alerts fire per AC-D18 v1.1 but do not block. This is a known cost
amplifier — future operational dashboards (P11) should surface
``loop_driven`` vs ``self_initiated`` vs ``assignment_driven`` cost
shares for tuning.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.learning_material import generate_for_weakness
from app.domain.ngram import compute_overlap, is_flagged
from app.domain.weakness import identify_weakness
from app.models import (
    SEED_TENANT_ID,
    Assignment,
    AssignmentAssignee,
    Attempt,
    AttemptOrigin,
    Grade,
    GradeSource,
    LearningMaterial,
    LoopMode,
    Pill,
    Question,
    Response,
    Test,
    TestMode,
    TestStatus,
    TestVisibility,
    TimeoutBehaviour,
    WeaknessReport,
    WeaknessReportPill,
)

_LOOP_SCOPED_ORIGINS = frozenset(
    {AttemptOrigin.assignment_driven, AttemptOrigin.loop_driven}
)


# --- overlap check (AC-D4 #5 / AC-CD14) -------------------------------


async def _assignment(db: AsyncSession, assignment_id: uuid.UUID) -> Assignment | None:
    result = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    return result.scalar_one_or_none()


async def _last_learning_material(
    db: AsyncSession, testee_id: uuid.UUID, pill_id: uuid.UUID
) -> LearningMaterial | None:
    """The most recently served :class:`LearningMaterial` for this
    (Testee, pill) that has ``served_text`` populated. AC-D4 #5: "the
    last learning material served to that Testee for that pill" — order
    by ``served_at`` descending. Materials with no ``served_text`` (e.g.
    safety-pill rows in P11's curated-links branch) are skipped since
    they have nothing to compare against."""
    result = await db.execute(
        select(LearningMaterial).where(LearningMaterial.testee_id == testee_id)
    )
    candidates: list[tuple[Any, LearningMaterial]] = []
    for material in result.scalars().all():
        if material.pill_id != pill_id:
            continue
        if not material.served_text:
            continue
        if material.served_at is None:
            continue
        candidates.append((material.served_at, material))
    if not candidates:
        return None
    return max(candidates, key=lambda pair: pair[0])[1]


async def _ai_grades_for_attempt(
    db: AsyncSession, attempt_id: uuid.UUID
) -> list[tuple[Grade, Response]]:
    """Pair each AI Grade row on this attempt with its Response — the
    Response's ``answer_payload`` carries the candidate text the overlap
    check compares against the served material."""
    grades_result = await db.execute(
        select(Grade).where(Grade.tenant_id == SEED_TENANT_ID)
    )
    grades = [g for g in grades_result.scalars().all() if g.source == GradeSource.ai]
    out: list[tuple[Grade, Response]] = []
    for grade in grades:
        resp = await db.execute(select(Response).where(Response.id == grade.response_id))
        response = resp.scalar_one_or_none()
        if response is None or response.attempt_id != attempt_id:
            continue
        out.append((grade, response))
    return out


def _candidate_text(answer_payload: dict[str, Any] | None) -> str:
    """Extract the free-text from an AI-graded response's answer_payload.
    Short-answer and scenario answers ship as ``{"text": "..."}`` per the
    grading-prompt contract; defensive against malformed payloads (return
    empty string, which produces overlap 0.0 and never flags)."""
    if not isinstance(answer_payload, dict):
        return ""
    text = answer_payload.get("text")
    if isinstance(text, str):
        return text
    return ""


async def apply_overlap_check(db: AsyncSession, attempt: Attempt) -> None:
    """N-gram trigram overlap pass over AI-graded Grade rows. Sets
    :attr:`Grade.overlap_pct` and :attr:`Grade.overlap_flagged` against
    the last :class:`LearningMaterial.served_text` for (Testee, pill).

    Scope: single-pill assignment-backed attempts only — broader pill
    resolution is post-v1 (the per-question pill mapping AC-D20 anchors
    is a P8 surface). Out-of-scope attempts skip silently.

    Idempotent — re-invocation produces the same write. Failure-
    isolated by the caller in ``submit_attempt`` so an overlap-check
    fault cannot fail the user's submit.
    """
    if attempt.origin not in _LOOP_SCOPED_ORIGINS:
        return
    if attempt.assignment_id is None:
        return
    assignment = await _assignment(db, attempt.assignment_id)
    if assignment is None or assignment.pill_id is None:
        return

    material = await _last_learning_material(db, attempt.testee_id, assignment.pill_id)
    if material is None or not material.served_text:
        # AC-D4 #5: "Skip silently when nothing was served." First
        # attempt on a pill has no prior material; safety-pill rows in
        # P11's curated-links branch have no served_text.
        return

    for grade, response in await _ai_grades_for_attempt(db, attempt.id):
        candidate = _candidate_text(response.answer_payload)
        ratio = compute_overlap(candidate, material.served_text)
        grade.overlap_pct = ratio
        grade.overlap_flagged = is_flagged(ratio)
    await db.flush()


# --- loop driver (AC-D6) ----------------------------------------------


async def _pill(db: AsyncSession, pill_id: uuid.UUID) -> Pill | None:
    result = await db.execute(select(Pill).where(Pill.id == pill_id))
    return result.scalar_one_or_none()


async def _weakness_report_pills(
    db: AsyncSession, weakness_report_id: uuid.UUID
) -> list[WeaknessReportPill]:
    result = await db.execute(
        select(WeaknessReportPill).where(
            WeaknessReportPill.weakness_report_id == weakness_report_id
        )
    )
    return list(result.scalars().all())


async def _wrong_question_prompts(db: AsyncSession, attempt: Attempt) -> list[str]:
    """Surface the prompt text of the attempt's wrong responses for
    inclusion in the ``generate_for_weakness`` payload. AI material
    benefits from knowing what the Testee specifically got wrong (per
    F18) — "wrong" = Grade.score < 1.0."""
    grades_result = await db.execute(
        select(Grade).where(Grade.tenant_id == SEED_TENANT_ID)
    )
    grades = list(grades_result.scalars().all())
    wrong_response_ids = {g.response_id for g in grades if g.score < 1.0}
    if not wrong_response_ids:
        return []
    resp_result = await db.execute(
        select(Response).where(Response.attempt_id == attempt.id)
    )
    wrong_responses = [
        r for r in resp_result.scalars().all() if r.id in wrong_response_ids
    ]
    prompts: list[str] = []
    for response in wrong_responses:
        q_result = await db.execute(
            select(Question).where(Question.id == response.question_id)
        )
        question = q_result.scalar_one_or_none()
        if question is None:
            continue
        prompt = (question.config or {}).get("prompt")
        if isinstance(prompt, str) and prompt:
            prompts.append(prompt)
    return prompts


def _follow_up_test(parent_test: Test, pill: Pill, target_difficulty: int) -> Test:
    """Build the per_testee Test shell for a loop-driven follow-up. The
    Testee starts the attempt themselves via the existing assignment
    flow; when ``start_attempt`` opens the attempt, the per_testee
    branch in attempts.py runs the AI generation against this Test's
    ``target_difficulty``.

    Settings cloned from the parent test: timed, duration_minutes,
    pause_allowance, timeout_behaviour, max_pause_duration_minutes,
    pass_threshold. Visibility is forced to ``private`` — a loop-driven
    Test is per-Testee and must not surface in the library.
    """
    return Test(
        tenant_id=SEED_TENANT_ID,
        name=f"Follow-up: {pill.name}",
        mode=TestMode.per_testee,
        status=TestStatus.published,
        visibility=TestVisibility.private,
        timed=parent_test.timed,
        duration_minutes=parent_test.duration_minutes,
        pause_allowance=parent_test.pause_allowance,
        timeout_behaviour=parent_test.timeout_behaviour or TimeoutBehaviour.auto_submit,
        max_pause_duration_minutes=parent_test.max_pause_duration_minutes or 30,
        pass_threshold=parent_test.pass_threshold,
        target_difficulty=target_difficulty,
        randomise_question_order=True,
        randomise_option_order=True,
    )


async def _create_followup(
    db: AsyncSession,
    *,
    parent_attempt: Attempt,
    parent_test: Test,
    parent_assignment: Assignment,
    pill: Pill,
) -> Attempt | None:
    """Materialise the autonomous-mode follow-up: per_testee Test +
    Assignment + AssignmentAssignee, then invoke ``start_attempt`` to
    create the Attempt and trigger the existing per_testee generation
    branch (AI call). Returns the created Attempt; returns None if
    invocation failed (the caller's failure isolation absorbs it).

    Target difficulty: AC-D9 v1.2's
    ``loop_target_difficulty(competence_estimate, …)`` clamp +
    step-down rule. When no CompetencyProfile exists yet (first failed
    attempt on the pill), fall back to ``parent_assignment.difficulty``
    rather than substituting 0 — AC-D9 null-handling: "null means
    needs benchmark, not failing".
    """
    from app.domain.attempts import start_attempt as _start_attempt
    from app.domain.competence import loop_target_difficulty
    from app.models import CompetencyProfile

    profile_result = await db.execute(
        select(CompetencyProfile).where(
            CompetencyProfile.testee_id == parent_attempt.testee_id
        )
    )
    profile = next(
        (p for p in profile_result.scalars().all() if p.pill_id == pill.id),
        None,
    )
    if profile is None or profile.competence_estimate is None:
        target_difficulty = parent_assignment.difficulty
    else:
        # Gather recent attempt scores on this pill for the three-
        # consecutive step-down rule. Most-recent-last per
        # ``loop_target_difficulty``'s contract.
        prior_result = await db.execute(
            select(Attempt).where(Attempt.testee_id == parent_attempt.testee_id)
        )
        scoped: list[tuple[Any, float]] = []
        for a in prior_result.scalars().all():
            if (
                a.submitted_at is None
                or a.overall_score is None
                or a.assignment_id is None
            ):
                continue
            a_assignment = await _assignment(db, a.assignment_id)
            if a_assignment is not None and a_assignment.pill_id == pill.id:
                scoped.append((a.submitted_at, a.overall_score))
        scoped.sort(key=lambda pair: pair[0])
        recent_scores = [score for _, score in scoped]
        target_difficulty = loop_target_difficulty(
            profile.competence_estimate,
            available_difficulty_min=pill.available_difficulty_min,
            available_difficulty_max=pill.available_difficulty_max,
            recent_attempt_scores=recent_scores,
        )

    new_test = _follow_up_test(parent_test, pill, target_difficulty)
    db.add(new_test)
    await db.flush()
    await db.refresh(new_test)

    new_assignment = Assignment(
        tenant_id=SEED_TENANT_ID,
        assigner_id=parent_assignment.assigner_id,
        pill_id=pill.id,
        learning_path_id=None,
        difficulty=target_difficulty,
        deadline=parent_assignment.deadline,
        is_mandatory=False,
        loop_mode=LoopMode.autonomous,
    )
    db.add(new_assignment)
    await db.flush()
    await db.refresh(new_assignment)

    db.add(
        AssignmentAssignee(
            tenant_id=SEED_TENANT_ID,
            assignment_id=new_assignment.id,
            user_id=parent_attempt.testee_id,
            via_group_id=None,
        )
    )
    await db.flush()

    # The existing start_attempt path validates assignment-backed origin,
    # creates the Attempt row, and triggers per_testee question
    # generation against ``new_test.target_difficulty``. Rate limit is
    # already exempt for loop_driven origin (AC-D18).
    return await _start_attempt(
        db,
        test=new_test,
        testee_id=parent_attempt.testee_id,
        origin=AttemptOrigin.loop_driven,
        assignment_id=new_assignment.id,
    )


async def _should_run_loop(
    db: AsyncSession, attempt: Attempt, test: Test
) -> Assignment | None:
    """In-scope check + assignment fetch. Returns the parent Assignment
    if the loop should run, else None. Loop runs when:

      * origin is assignment_driven OR loop_driven (loop-of-loops allowed
        — a failed follow-up triggers another follow-up at the new
        target_difficulty until the Testee passes or the admin overrides)
      * assignment.pill_id IS NOT NULL (single-pill scope)
      * overall_score < pass_threshold (failed; passing attempts produce
        a competence update but no follow-up)
    """
    if attempt.origin not in _LOOP_SCOPED_ORIGINS:
        return None
    if attempt.assignment_id is None:
        return None
    if test.pass_threshold is None:
        # No threshold set on the test → can't classify pass/fail → no
        # loop. The catalogue admin owns this configuration; missing
        # threshold means "auto-grade disabled, manual review only".
        return None
    if attempt.overall_score is None:
        return None
    if attempt.overall_score >= test.pass_threshold:
        return None
    assignment = await _assignment(db, attempt.assignment_id)
    if assignment is None or assignment.pill_id is None:
        return None
    return assignment


async def run_loop_after_submit(
    db: AsyncSession, attempt: Attempt, test: Test
) -> WeaknessReport | None:
    """Drive the adaptive loop after a failed assignment-backed attempt.

    Flow (per AC-D6 / AC-D21):
      1. Identify weakness — :func:`identify_weakness` runs the
         weakness AI call, persisting a :class:`WeaknessReport` + N
         :class:`WeaknessReportPill` rows.
      2. For each weak pill (catalogue-filtered to defend against AI
         hallucinated pill_ids):
           - Non-safety: :func:`generate_for_weakness` writes a
             :class:`LearningMaterial` with served_at + served_text for
             the next attempt's AC-D4 #5 overlap check.
           - Safety: skip material generation (the P11 curated-links
             half is deferred; the loop still creates a follow-up,
             just without an AI explainer).
      3. Branch by ``parent_assignment.loop_mode``:
           - Autonomous: create the per_testee Test + Assignment +
             AssignmentAssignee + Attempt (origin=loop_driven) inline.
           - Admin-reviewed: mark ``WeaknessReport.routed_to_admin =
             True``. Slice 3's admin endpoints unblock from there.

    Returns the created :class:`WeaknessReport` (or None if the loop
    was out of scope). Failure isolation is the caller's responsibility
    — ``submit_attempt`` wraps this in try/except so a loop fault
    cannot fail the user's submit.
    """
    parent_assignment = await _should_run_loop(db, attempt, test)
    if parent_assignment is None:
        return None

    report = await identify_weakness(db, attempt)

    weak_pill_rows = await _weakness_report_pills(db, report.id)
    wrong_prompts = await _wrong_question_prompts(db, attempt)

    admin_reviewed = parent_assignment.loop_mode == LoopMode.admin_reviewed

    if admin_reviewed:
        # Admin queue lights up at the WeaknessReport row; Slice 3
        # endpoints (GET queue / POST approve / POST reject) walk
        # ``routed_to_admin = True`` rows. Don't create follow-up
        # Test/Assignment/Attempt — the admin gates that on approval.
        report.routed_to_admin = True
        await db.flush()
        return report

    # Autonomous mode — produce material + follow-up per weak pill.
    for weak in weak_pill_rows:
        pill = await _pill(db, weak.pill_id)
        if pill is None:
            # Defensive: the AI may emit a pill_id that doesn't exist
            # in the catalogue (hallucinated UUID, retired pill). Skip
            # rather than crash — the WeaknessReportPill row is
            # preserved for audit.
            continue
        if not pill.safety_relevant:
            await generate_for_weakness(
                db,
                weakness_report=report,
                pill_id=pill.id,
                testee_id=attempt.testee_id,
                wrong_questions=wrong_prompts,
            )
        # else: safety pill — skip AI material; P11 ships curated
        # external links via the ``curated_safety_links`` source.
        await _create_followup(
            db,
            parent_attempt=attempt,
            parent_test=test,
            parent_assignment=parent_assignment,
            pill=pill,
        )

    return report
