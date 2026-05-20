"""Cross-family grade review at submit (AC-D19 v1.7 / AC-CD11 v1.7).

After P5's ``_ai_grade_responses`` writes Grade rows for short_answer /
scenario responses, P6 fires a single batched OpenAI ``review()`` call
covering the attempt's AI grades. Each AI Grade gets a paired
``GradeReview`` row inserted with ``status=pending`` before the call;
the call's structured response updates each row in place to
``confirmed`` / ``flagged`` (AC-D19 v1.7 — "updated in place, no
history rows"). The call is wrapped in ``asyncio.wait_for`` with a
60-second hard ceiling (AC-CD11 v1.7).

**Fail-soft.** On timeout, provider error, malformed JSON, missing
``items`` key, unknown grade_id, or unknown verdict, the affected rows
stay pending and the §8.9 grade-review reconcile cron picks them up on
its next pass. The submit path MUST NOT fail because review failed —
the audit-log entry for ``attempt.submit`` always lands.

**Provenance.** One OpenAI call produces N GradeReview rows; cost +
tokens are divided evenly via :func:`record_provenance_share` (share by
the number of items the call was *sent*, not the number successfully
parsed — one call costs the same regardless of parse success).

**overall_score recompute.** ``_recompute_overall_score`` folds the
confirmed-AI grades into the deterministic mean per AC-D19 v1.7. AI
grades whose review went ``flagged`` and not yet admin-resolved are
excluded — preserving the "only confirmed grades display synchronously"
guarantee. Admin-resolved (overridden) grades are included with
whatever score the admin's action wrote.

**Telemetry.** Every ``review()`` call emits a structured log record
with ``latency_ms``, ``success``, ``batched_payload_size``,
``ceiling_breached``, ``attempt_id``, ``tenant_id`` — the empirical
baseline for the 60-s ceiling tuning per the P6 deliverable in
``ROADMAP.md``.

**Reconcile constants.** ``GRADE_REVIEW_RECONCILE_INTERVAL_MINUTES``
and ``GRADE_REVIEW_MAX_RETRY_ATTEMPTS`` live here as code constants per
PR-017 v1.6 / v1.7. They are NOT ``system_settings`` columns at v1.7;
the operator-visible ≈50-minute "stuck pending → auto-flag" SLA is the
product of the two (5 min × 10 = 50 min wall-clock). The reconcile
sweep itself (Slice 3) reads these constants directly.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.cost import record_provenance_share
from app.ai.provider import Operation, resolve_provider
from app.models import (
    SEED_TENANT_ID,
    Attempt,
    Grade,
    GradeReview,
    GradeSource,
    QuestionType,
    Response,
    ReviewStatus,
    SystemSettings,
    Test,
)

_log = logging.getLogger(__name__)

# AC-CD11 v1.7 — hard latency ceiling at the submit path. On breach
# the fail-soft branch fires (rows stay pending, reconcile cron picks
# them up). Code constant, NOT a ``system_settings`` column at v1.7 per
# PR-017 — operational tuning will promote this in v1.x when the
# telemetry has enough real data.
GRADE_REVIEW_SUBMIT_CEILING_SECONDS: float = 60.0

# AC-D19 v1.6 / AC-CD11 v1.7 — reconcile sweep cadence. Code constants
# for the same reason. The product (5 min × 10) defines the operator-
# visible ≈50-minute "stuck pending → auto-flag" SLA.
GRADE_REVIEW_RECONCILE_INTERVAL_MINUTES: int = 5
GRADE_REVIEW_MAX_RETRY_ATTEMPTS: int = 10

# Question types the primary grader handles via AI (Anthropic per
# AC-D12) and therefore the only types that produce a ``grade_review``
# row. Deterministic types (MCQ / TF / matching) skip review entirely
# (AC-D19 v1.6: "deterministic responses have no review row").
_AI_GRADED_TYPES = frozenset({QuestionType.short_answer, QuestionType.scenario})


async def _system_settings(db: AsyncSession) -> SystemSettings | None:
    result = await db.execute(
        select(SystemSettings).where(SystemSettings.tenant_id == SEED_TENANT_ID)
    )
    return result.scalar_one_or_none()


async def _responses_for(db: AsyncSession, attempt_id: uuid.UUID) -> list[Response]:
    result = await db.execute(
        select(Response).where(
            Response.attempt_id == attempt_id,
            Response.tenant_id == SEED_TENANT_ID,
        )
    )
    return list(result.scalars().all())


async def _grade_for_response(db: AsyncSession, response_id: uuid.UUID) -> Grade | None:
    result = await db.execute(
        select(Grade).where(
            Grade.response_id == response_id,
            Grade.tenant_id == SEED_TENANT_ID,
        )
    )
    return result.scalar_one_or_none()


async def _review_for_grade(db: AsyncSession, grade_id: uuid.UUID) -> GradeReview | None:
    result = await db.execute(
        select(GradeReview).where(
            GradeReview.grade_id == grade_id,
            GradeReview.tenant_id == SEED_TENANT_ID,
        )
    )
    return result.scalar_one_or_none()


async def _review_ai_grades(
    db: AsyncSession,
    attempt: Attempt,
    test: Test,
    *,
    specs: list[dict[str, Any]],
) -> None:
    """Run the batched cross-family review for ``attempt``'s AI grades
    and recompute ``overall_score`` if any review row went non-pending.

    Called from :func:`app.domain.attempts.submit_attempt` after the
    P5 AI grading pass. The ``specs`` argument is the same
    ``_gradable_question_specs`` output the submit path already
    computed; passing it through avoids re-loading the snapshot and
    keeps the rubric / model_answer lookups Python-side.
    """
    # Build a {question_id -> response} map so we can join Grade ↔
    # Response ↔ spec.config without a SQL join (the in-memory test
    # session is equality-WHERE only; AC-CD15).
    responses = {r.question_id: r for r in await _responses_for(db, attempt.id)}

    # Find each AI Grade, insert a paired pending GradeReview, and
    # build the batched payload. We iterate the snapshot's AI-graded
    # question ids in stable order so the payload ordering is
    # deterministic across runs (helps test assertions and review
    # debuggability).
    pending_pairs: list[tuple[Grade, GradeReview, dict[str, Any]]] = []
    for spec in specs:
        try:
            qtype = QuestionType(spec["type"])
        except ValueError:
            continue
        if qtype not in _AI_GRADED_TYPES:
            continue
        qid = uuid.UUID(str(spec["question_id"]))
        response = responses.get(qid)
        if response is None:
            # P5 grading creates a Response row even for unanswered AI
            # questions; this branch only fires if the snapshot drifted
            # from the response set (defensive — would otherwise crash
            # the submit path).
            continue
        grade = await _grade_for_response(db, response.id)
        if grade is None or grade.source != GradeSource.ai:
            continue
        gr = GradeReview(
            tenant_id=SEED_TENANT_ID,
            grade_id=grade.id,
            status=ReviewStatus.pending,
        )
        db.add(gr)
        await db.flush()
        candidate_text = ""
        if isinstance(response.answer_payload, dict):
            candidate_text = str(response.answer_payload.get("text", ""))
        config = spec.get("config") or {}
        pending_pairs.append(
            (
                grade,
                gr,
                {
                    "grade_id": str(grade.id),
                    "question": str(config.get("prompt", "")),
                    "rubric": str(config.get("rubric", "")),
                    "response": candidate_text,
                    "ai_grade": float(grade.score),
                    "ai_verdict": grade.verdict.value,
                    "ai_reasoning": str(grade.ai_reasoning or ""),
                },
            )
        )

    if not pending_pairs:
        # No AI-graded responses on this attempt — the F14 gate falls
        # through to the deterministic-only branch; no review needed.
        return

    # One OpenAI call covers every AI-graded response in the attempt
    # (AC-CD11 v1.7 batched mode). Resolve the provider via the
    # ``review_provider`` system setting / coded default. The payload
    # carries ``items`` as the raw list (test seams + reconcile path
    # read it directly) and ``items_json`` as the JSON-serialised form
    # the prompt template substitutes into ``{items_json}``.
    settings = await _system_settings(db)
    provider = resolve_provider(Operation.grade_review, system_settings=settings)
    items_payload = [item for _, _, item in pending_pairs]
    import json

    payload = {
        "items": items_payload,
        "items_json": json.dumps(items_payload),
    }
    batched_size = len(items_payload)

    started = time.perf_counter()
    success = False
    ceiling_breached = False
    try:
        ai_result = await asyncio.wait_for(
            provider.review(Operation.grade_review, payload),
            timeout=GRADE_REVIEW_SUBMIT_CEILING_SECONDS,
        )
        success = True
    except TimeoutError:
        ceiling_breached = True
        _emit_telemetry(
            attempt=attempt,
            latency_ms=(time.perf_counter() - started) * 1000.0,
            success=False,
            batched_payload_size=batched_size,
            ceiling_breached=True,
        )
        _log.warning(
            "grade_review.batch_timeout",
            extra={"attempt_id": str(attempt.id), "batched_payload_size": batched_size},
        )
        return
    except Exception:
        _emit_telemetry(
            attempt=attempt,
            latency_ms=(time.perf_counter() - started) * 1000.0,
            success=False,
            batched_payload_size=batched_size,
            ceiling_breached=False,
        )
        _log.warning(
            "grade_review.batch_failed",
            extra={"attempt_id": str(attempt.id), "batched_payload_size": batched_size},
            exc_info=True,
        )
        return

    _emit_telemetry(
        attempt=attempt,
        latency_ms=(time.perf_counter() - started) * 1000.0,
        success=success,
        batched_payload_size=batched_size,
        ceiling_breached=ceiling_breached,
    )

    # Parse the structured response: ``{"items": [{"grade_id", "verdict",
    # "reasoning"?}, ...]}``. Anything off-contract leaves the affected
    # row pending — the reconcile cron is the second chance.
    content = ai_result.content if isinstance(ai_result.content, dict) else None
    items = content.get("items") if content is not None else None
    if not isinstance(items, list):
        _log.warning(
            "grade_review.malformed_response_no_items",
            extra={
                "attempt_id": str(attempt.id),
                "content_keys": sorted(content.keys()) if content is not None else [],
            },
        )
        return

    # Index the pending pairs by grade_id (str) for O(1) lookup.
    pairs_by_grade_id: dict[str, tuple[Grade, GradeReview]] = {
        str(g.id): (g, gr) for g, gr, _ in pending_pairs
    }
    for entry in items:
        if not isinstance(entry, dict):
            continue
        gid_raw = entry.get("grade_id")
        gid = str(gid_raw) if gid_raw is not None else None
        if gid is None or gid not in pairs_by_grade_id:
            _log.warning(
                "grade_review.unknown_grade_id",
                extra={"attempt_id": str(attempt.id), "grade_id": gid},
            )
            continue
        verdict_raw = entry.get("verdict")
        try:
            verdict = ReviewStatus(str(verdict_raw))
        except ValueError:
            _log.warning(
                "grade_review.unknown_verdict",
                extra={"attempt_id": str(attempt.id), "verdict": verdict_raw},
            )
            continue
        if verdict not in (ReviewStatus.confirmed, ReviewStatus.flagged):
            # ``pending`` from the model is not a meaningful response —
            # the row is already pending; leave it that way so the
            # reconcile path picks it up.
            continue
        _grade, gr_row = pairs_by_grade_id[gid]
        gr_row.status = verdict
        reasoning = entry.get("reasoning")
        if isinstance(reasoning, str):
            gr_row.review_reasoning = reasoning
        # One call → N rows. Cost / tokens split evenly across the N
        # items the call was *sent* (parse success doesn't change the
        # cost). The full per-call values for provider / model /
        # prompt_version are replicated on every row.
        record_provenance_share(gr_row, ai_result, share_count=batched_size)

    await _recompute_overall_score(db, attempt, test)


async def _recompute_overall_score(
    db: AsyncSession, attempt: Attempt, test: Test
) -> None:
    """Fold confirmed-AI grades into ``attempt.overall_score`` /
    ``attempt.outcome``. Skipped when the attempt's outcome is
    ``"expired"`` (timeout-driven outcomes are immutable per P5).

    Inclusion rule (AC-D19 v1.7):
      * Deterministic grades (source ∈ {auto, admin_override}) →
        always include.
      * AI grade with ``GradeReview.status == confirmed`` → include.
      * AI grade with ``GradeReview.status == flagged`` AND
        ``Grade.overridden_at IS NULL`` → exclude (admin hasn't
        resolved yet; "only confirmed grades display synchronously").
      * AI grade with ``GradeReview.status == flagged`` AND
        ``Grade.overridden_at IS NOT NULL`` → include (admin resolved;
        score is whatever the admin's action wrote).
      * AI grade with ``GradeReview.status == pending`` → exclude
        (gate would never let this be displayed, but be defensive).
      * AI grade with no GradeReview row → exclude (defensive; this
        should never happen post-Slice-2).
    """
    if attempt.outcome == "expired":
        return
    responses = await _responses_for(db, attempt.id)
    eligible_scores: list[float] = []
    for response in responses:
        grade = await _grade_for_response(db, response.id)
        if grade is None:
            continue
        if grade.source != GradeSource.ai:
            eligible_scores.append(grade.score)
            continue
        if grade.overridden_at is not None:
            eligible_scores.append(grade.score)
            continue
        gr = await _review_for_grade(db, grade.id)
        if gr is None:
            continue
        if gr.status == ReviewStatus.confirmed:
            eligible_scores.append(grade.score)
    if not eligible_scores:
        return
    overall = sum(eligible_scores) / len(eligible_scores)
    attempt.overall_score = overall
    attempt.outcome = _outcome_for(overall, test)


def _outcome_for(score: float, test: Test) -> str:
    """Mirrors :func:`app.domain.attempts._outcome_for` exactly. Kept
    local so this module doesn't import back into ``attempts`` (the
    other direction of the dependency edge would risk a cycle when
    Slice 3 / Slice 4 also import recompute logic from here)."""
    if test.pass_threshold is None:
        return "pass"
    return "pass" if score >= test.pass_threshold else "fail"


def _emit_telemetry(
    *,
    attempt: Attempt,
    latency_ms: float,
    success: bool,
    batched_payload_size: int,
    ceiling_breached: bool,
) -> None:
    """Structured-log the per-call review telemetry. The four required
    fields (latency_ms, success, batched_payload_size, ceiling_breached)
    are the empirical baseline for tuning the 60-s ceiling per the P6
    deliverable in ``ROADMAP.md``. ``attempt_id`` / ``tenant_id`` make
    each record traceable to the originating attempt."""
    _log.info(
        "grade_review.batch_completed",
        extra={
            "latency_ms": latency_ms,
            "success": success,
            "batched_payload_size": batched_payload_size,
            "ceiling_breached": ceiling_breached,
            "attempt_id": str(attempt.id),
            "tenant_id": str(attempt.tenant_id),
        },
    )
