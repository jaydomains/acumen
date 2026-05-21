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

# Hard cap on consecutive loop-driven follow-ups for a single failure
# chain (PR-019 Gitar review — defense in depth). AC-D6 says the loop
# continues "until the Testee passes or the admin overrides"; admin
# override + budget alerts (AC-D18 v1.1) are the spec's primary
# termination conditions. The cap is a safety bound for the edge case
# where neither fires — a Testee who consistently fails 10 times in a
# row will see the 11th submit produce no further follow-up, and the
# admin queue surfaces the WeaknessReport so manual remediation is
# still possible. Cap is set to 10 — far above any realistic learning
# progression (a Testee genuinely needing 5+ follow-ups likely needs
# direct admin intervention anyway) but tight enough to bound runaway
# AI cost. P7 code constant; could become a ``system_settings`` column
# in v1.x if operational tuning needs it.
MAX_LOOP_DEPTH = 10


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
    check compares against the served material.

    Walks attempt → responses → per-response Grade. The reverse walk
    (load every Grade for the tenant, filter by response.attempt_id in
    Python) avoids the full-table Grade scan that PR-019 Gitar review
    flagged: the Grade table grows with every graded response across
    every Testee, so a tenant-wide ``select`` runs in O(total grades)
    per submit. The forward walk runs in O(responses-on-this-attempt)
    equality lookups, which the harness supports natively and prod PG
    indexes cleanly via the ``grade.response_id`` FK index.
    """
    resp_result = await db.execute(
        select(Response).where(Response.attempt_id == attempt_id)
    )
    out: list[tuple[Grade, Response]] = []
    for response in resp_result.scalars().all():
        g_result = await db.execute(select(Grade).where(Grade.response_id == response.id))
        grade = g_result.scalar_one_or_none()
        if grade is None or grade.source != GradeSource.ai:
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


async def _loop_chain_depth(db: AsyncSession, attempt: Attempt) -> int:
    """Count how many consecutive loop-driven attempts are in the
    parent chain rooted at ``attempt``, INCLUDING ``attempt`` itself
    if its origin is ``loop_driven``. Used by ``run_loop_after_submit``
    to enforce ``MAX_LOOP_DEPTH``.

    Walk semantics: an assignment_driven attempt is the chain root with
    depth 0. Each loop_driven follow-up's
    ``parent_attempt_id`` points back at the failed attempt that
    triggered it (set explicitly by ``_create_followup`` after
    ``start_attempt`` returns — ``start_attempt``'s default semantics
    chain by Test, not by loop, and a freshly-created per_testee Test
    has no Test-internal prior to chain through, so we overwrite).

    Walk terminates on null parent or non-loop_driven parent, OR when
    depth exceeds ``MAX_LOOP_DEPTH + 1`` (defensive — a circular chain
    should never exist but the bound prevents an unbounded walk if
    the data model is ever corrupted).
    """
    depth = 0
    current: Attempt | None = attempt
    while (
        current is not None
        and current.origin == AttemptOrigin.loop_driven
        and depth <= MAX_LOOP_DEPTH + 1
    ):
        depth += 1
        if current.parent_attempt_id is None:
            break
        result = await db.execute(
            select(Attempt).where(Attempt.id == current.parent_attempt_id)
        )
        current = result.scalar_one_or_none()
    return depth


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
    F18) — "wrong" = Grade.score < 1.0.

    Walks attempt → responses → per-response Grade (same forward-walk
    pattern as ``_ai_grades_for_attempt`` — see that docstring for why
    we don't tenant-scan Grade)."""
    resp_result = await db.execute(
        select(Response).where(Response.attempt_id == attempt.id)
    )
    prompts: list[str] = []
    for response in resp_result.scalars().all():
        g_result = await db.execute(select(Grade).where(Grade.response_id == response.id))
        grade = g_result.scalar_one_or_none()
        if grade is None or grade.score >= 1.0:
            continue
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
    new_attempt = await _start_attempt(
        db,
        test=new_test,
        testee_id=parent_attempt.testee_id,
        origin=AttemptOrigin.loop_driven,
        assignment_id=new_assignment.id,
    )
    # start_attempt sets parent_attempt_id from the in-test attempt
    # chain (most-recent prior attempt on the same Test by this Testee).
    # A freshly-created per_testee follow-up Test has no in-test prior,
    # so parent_attempt_id comes back as None. Override here to point
    # at the failed PARENT ATTEMPT — this is what makes the loop chain
    # walkable for ``_loop_chain_depth`` and matches the planned
    # semantics: "Attempt(origin=loop_driven, parent_attempt_id=<failed
    # original>)".
    new_attempt.parent_attempt_id = parent_attempt.id
    await db.flush()
    return new_attempt


async def _should_run_loop(
    db: AsyncSession, attempt: Attempt, test: Test
) -> Assignment | None:
    """In-scope check + assignment fetch. Returns the parent Assignment
    if the loop should run, else None. Loop runs when:

      * origin is assignment_driven OR loop_driven (loop-of-loops allowed
        — a failed follow-up triggers another follow-up at the new
        target_difficulty until the Testee passes, the admin overrides,
        or the ``MAX_LOOP_DEPTH`` safety bound is reached — see
        ``run_loop_after_submit`` for the cap enforcement; this helper
        only checks scope, not chain depth)
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

    # PR-019 Gitar review — bound the loop-of-loops chain. AC-D6 says
    # "until pass or admin override" but adds a safety bound here in
    # case neither fires (e.g., a Testee fails 10× without anyone
    # noticing). At MAX_LOOP_DEPTH the WeaknessReport is still written
    # (audit trail preserved) and material is still generated (the
    # explainer is useful regardless of follow-up creation), but no
    # further follow-up Attempt is queued — Slice 3's admin queue
    # surfaces the report so manual remediation is still possible.
    depth = await _loop_chain_depth(db, attempt)
    chain_capped = attempt.origin == AttemptOrigin.loop_driven and depth >= MAX_LOOP_DEPTH

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
        if chain_capped:
            # Material still written above (useful regardless), but
            # no further follow-up — admin queue picks it up.
            continue
        await _create_followup(
            db,
            parent_attempt=attempt,
            parent_test=test,
            parent_assignment=parent_assignment,
            pill=pill,
        )

    return report


# --- admin-reviewed mode endpoints (Slice 3 — AC-D6) ------------------
#
# When ``Assignment.loop_mode == admin_reviewed`` a failed attempt's
# WeaknessReport is written with ``routed_to_admin = True`` but the
# autonomous follow-up creation is gated on admin approval. These three
# helpers back the admin queue surface:
#
#   * ``list_admin_queue``     — GET /v1/admin/loop/queue
#   * ``approve_admin_queue``  — POST /v1/admin/loop/queue/{id}/approve
#   * ``reject_admin_queue``   — POST /v1/admin/loop/queue/{id}/reject
#
# Approval flips ``routed_to_admin`` to False AND creates the follow-up
# (material + per_testee Test + Assignment + Assignee + loop_driven
# Attempt) — the same flow the autonomous mode runs inline at submit.
# Rejection flips the flag without creating any follow-up; the Testee
# never sees a remediation pass for this attempt.


async def _attempt_by_id(db: AsyncSession, attempt_id: uuid.UUID) -> Attempt | None:
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    return result.scalar_one_or_none()


async def _test_by_id(db: AsyncSession, test_id: uuid.UUID) -> Test | None:
    result = await db.execute(select(Test).where(Test.id == test_id))
    return result.scalar_one_or_none()


async def _weakness_report_by_id(
    db: AsyncSession, weakness_report_id: uuid.UUID
) -> WeaknessReport | None:
    result = await db.execute(
        select(WeaknessReport).where(WeaknessReport.id == weakness_report_id)
    )
    return result.scalar_one_or_none()


async def list_admin_queue(db: AsyncSession) -> list[dict[str, Any]]:
    """List :class:`WeaknessReport` rows with ``routed_to_admin = True``
    (admin-reviewed loop queue per AC-D6). Oldest-first so the longest-
    waiting row surfaces at the top — matches the P6 grade-review queue
    convention (``list_flagged_reviews``).

    Each row carries enough context for the admin to make an
    approve/reject decision without a follow-up DB round-trip:
    parent attempt id + Testee + pill name + the weak-pill ids the AI
    identified + the parent attempt's overall_score.

    Returns a list of dicts shaped for ``LoopQueueItem``. The caller
    (router) converts to Pydantic.

    Equality-only walk — :func:`WeaknessReport.routed_to_admin` is a
    boolean column and the harness only supports single-column
    equality wheres, so we load and filter in Python (same pattern as
    :func:`app.domain.competence._prior_attempts_on_pill`). At v1 scale
    the admin queue is short — most reports route to autonomous mode —
    so the cost is negligible.
    """
    result = await db.execute(
        select(WeaknessReport).where(WeaknessReport.tenant_id == SEED_TENANT_ID)
    )
    out: list[dict[str, Any]] = []
    for report in result.scalars().all():
        if not report.routed_to_admin:
            continue
        attempt = await _attempt_by_id(db, report.attempt_id)
        if attempt is None or attempt.assignment_id is None:
            continue
        assignment = await _assignment(db, attempt.assignment_id)
        if assignment is None or assignment.pill_id is None:
            continue
        pill = await _pill(db, assignment.pill_id)
        if pill is None:
            continue
        pill_rows = await _weakness_report_pills(db, report.id)
        out.append(
            {
                "weakness_report_id": report.id,
                "attempt_id": attempt.id,
                "testee_id": attempt.testee_id,
                "pill_id": pill.id,
                "pill_name": pill.name,
                "overall_score": attempt.overall_score,
                "weak_pill_ids": [row.pill_id for row in pill_rows],
                "created_at": report.created_at,
            }
        )
    out.sort(key=lambda r: r["created_at"])
    return out


async def _resolve_queue_row(
    db: AsyncSession, weakness_report_id: uuid.UUID
) -> tuple[WeaknessReport, Attempt, Assignment, Test]:
    """Shared validation for approve/reject — load the WeaknessReport
    and its parent attempt / assignment / test, raising APIError per
    the queue contract:

      * 404 — WeaknessReport doesn't exist (already-deleted or wrong id)
      * 409 — WeaknessReport.routed_to_admin is False (already resolved
        or autonomous mode — admin can't re-route)
      * 409 — parent attempt or assignment row is missing (data
        corruption — fail loudly so the admin sees a clear error rather
        than silently approving against missing context)
    """
    # Local import — APIError is the routers' status-code seam and
    # only needed here.
    from app.permissions import APIError

    report = await _weakness_report_by_id(db, weakness_report_id)
    if report is None:
        raise APIError(404, "not_found", "Weakness report not found.")
    if not report.routed_to_admin:
        raise APIError(
            409,
            "not_in_queue",
            "This weakness report is not awaiting admin review.",
        )
    attempt = await _attempt_by_id(db, report.attempt_id)
    if attempt is None or attempt.assignment_id is None:
        raise APIError(
            409,
            "orphan_report",
            "Parent attempt for this report is missing or has no assignment.",
        )
    assignment = await _assignment(db, attempt.assignment_id)
    if assignment is None or assignment.pill_id is None:
        raise APIError(
            409,
            "orphan_report",
            "Parent assignment for this report is missing or has no pill.",
        )
    test = await _test_by_id(db, attempt.test_id)
    if test is None:
        raise APIError(
            409,
            "orphan_report",
            "Parent test for this report is missing.",
        )
    return report, attempt, assignment, test


async def approve_admin_queue(
    db: AsyncSession,
    weakness_report_id: uuid.UUID,
    admin_id: uuid.UUID,
) -> dict[str, Any]:
    """Approve a queued :class:`WeaknessReport`: clear
    ``routed_to_admin`` AND create the follow-up (material + per_testee
    Test + Assignment + Assignee + loop_driven Attempt) — the same flow
    the autonomous mode runs inline at submit.

    Returns a dict shaped for ``LoopApproveResult``. The
    ``follow_up_count`` is the number of follow-up Attempts created
    (one per weak pill in the report), which mirrors the
    ``run_loop_after_submit`` per-pill loop.
    """
    report, attempt, assignment, test = await _resolve_queue_row(db, weakness_report_id)
    pill_rows = await _weakness_report_pills(db, report.id)
    wrong_prompts = await _wrong_question_prompts(db, attempt)

    follow_up_count = 0
    for weak in pill_rows:
        pill = await _pill(db, weak.pill_id)
        if pill is None:
            # Same defensive skip as run_loop_after_submit — the AI may
            # emit a pill_id that doesn't exist in the catalogue.
            continue
        if not pill.safety_relevant:
            await generate_for_weakness(
                db,
                weakness_report=report,
                pill_id=pill.id,
                testee_id=attempt.testee_id,
                wrong_questions=wrong_prompts,
            )
        await _create_followup(
            db,
            parent_attempt=attempt,
            parent_test=test,
            parent_assignment=assignment,
            pill=pill,
        )
        follow_up_count += 1

    report.routed_to_admin = False
    await db.flush()

    # Audit-log import — local to keep loop.py free of the catalogue
    # dependency at module load (avoids a circular import via
    # weakness → loop → catalogue chains).
    from app.domain.catalogue import record_audit

    await record_audit(
        db,
        actor_id=admin_id,
        action="loop.queue.approve",
        target_entity="weakness_report",
        target_id=report.id,
        detail={"follow_up_count": follow_up_count, "attempt_id": str(attempt.id)},
    )
    return {
        "weakness_report_id": report.id,
        "follow_up_count": follow_up_count,
    }


async def reject_admin_queue(
    db: AsyncSession,
    weakness_report_id: uuid.UUID,
    admin_id: uuid.UUID,
) -> dict[str, Any]:
    """Reject a queued :class:`WeaknessReport`: clear ``routed_to_admin``
    without creating any follow-up. The Testee never sees a remediation
    pass for this attempt. Audit-logged so the rejection is traceable
    (operator review of admin action history).

    Idempotency: the queue-resolve guard in ``_resolve_queue_row``
    raises 409 if ``routed_to_admin`` is already False, so a double-
    reject (or reject-after-approve) is rejected at the same gate as
    an approve-after-approve.
    """
    report, attempt, _assignment, _test = await _resolve_queue_row(db, weakness_report_id)
    report.routed_to_admin = False
    await db.flush()

    from app.domain.catalogue import record_audit

    await record_audit(
        db,
        actor_id=admin_id,
        action="loop.queue.reject",
        target_entity="weakness_report",
        target_id=report.id,
        detail={"attempt_id": str(attempt.id)},
    )
    return {"weakness_report_id": report.id}
