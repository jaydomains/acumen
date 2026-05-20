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
import json
import logging
import time
import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.cost import record_provenance_share
from app.ai.provider import Operation, resolve_provider
from app.domain._scoring import outcome_for
from app.domain.catalogue import record_audit
from app.models import (
    SEED_TENANT_ID,
    AppUser,
    Attempt,
    Grade,
    GradeReview,
    GradeSource,
    GradeVerdict,
    Question,
    QuestionType,
    Response,
    ReviewStatus,
    SystemSettings,
    Test,
)
from app.permissions import APIError, now_utc

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

# Off-submit-path internal timeout the reconcile sweep wraps around
# each batched ``provider.review()`` call. More generous than the 60-s
# submit ceiling because the Testee is not waiting — the reconcile
# runs out-of-band — but bounded so a single stuck call cannot hang
# the sweep indefinitely.
GRADE_REVIEW_RECONCILE_INTERNAL_TIMEOUT_SECONDS: float = 90.0

# Reason string stamped on auto-flagged rows past the SLA. Matches
# the operator-visible string from AC-D19 v1.6 / PR-017 verbatim so
# the admin queue display + audit-log search stay searchable.
_AUTO_FLAG_REASON = "auto_flagged_stuck_pending"

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


async def _pending_reviews(db: AsyncSession) -> list[GradeReview]:
    """All GradeReviews with status=pending across the tenant. The
    reconcile sweep iterates this list in :func:`reconcile_pending_grade_reviews`.
    """
    result = await db.execute(
        select(GradeReview).where(
            GradeReview.status == ReviewStatus.pending,
            GradeReview.tenant_id == SEED_TENANT_ID,
        )
    )
    return list(result.scalars().all())


async def _grade_by_id(db: AsyncSession, grade_id: uuid.UUID) -> Grade | None:
    result = await db.execute(
        select(Grade).where(Grade.id == grade_id, Grade.tenant_id == SEED_TENANT_ID)
    )
    return result.scalar_one_or_none()


async def _response_by_id(db: AsyncSession, response_id: uuid.UUID) -> Response | None:
    result = await db.execute(
        select(Response).where(
            Response.id == response_id, Response.tenant_id == SEED_TENANT_ID
        )
    )
    return result.scalar_one_or_none()


async def _question_by_id(db: AsyncSession, question_id: uuid.UUID) -> Question | None:
    result = await db.execute(
        select(Question).where(
            Question.id == question_id, Question.tenant_id == SEED_TENANT_ID
        )
    )
    return result.scalar_one_or_none()


async def _attempt_by_id(db: AsyncSession, attempt_id: uuid.UUID) -> Attempt | None:
    result = await db.execute(
        select(Attempt).where(
            Attempt.id == attempt_id, Attempt.tenant_id == SEED_TENANT_ID
        )
    )
    return result.scalar_one_or_none()


async def _test_by_id(db: AsyncSession, test_id: uuid.UUID) -> Test | None:
    result = await db.execute(
        select(Test).where(Test.id == test_id, Test.tenant_id == SEED_TENANT_ID)
    )
    return result.scalar_one_or_none()


def _response_text(response: Response) -> str:
    """Pull the candidate-response text from an AI-graded Response. The
    canonical encoding is ``answer_payload.text`` (a string)."""
    if isinstance(response.answer_payload, dict):
        return str(response.answer_payload.get("text", ""))
    return ""


def _payload_item(grade: Grade, question: Question, response: Response) -> dict[str, Any]:
    """Build one item of the batched review payload. Same shape as the
    submit-path :func:`_review_ai_grades` builds — keeping them in sync
    means the prompt sees identical structure regardless of which path
    drove the call."""
    config = question.config or {}
    return {
        "grade_id": str(grade.id),
        "question": str(config.get("prompt", "")),
        "rubric": str(config.get("rubric", "")),
        "response": _response_text(response),
        "ai_grade": float(grade.score),
        "ai_verdict": grade.verdict.value,
        "ai_reasoning": str(grade.ai_reasoning or ""),
    }


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
    attempt.outcome = outcome_for(overall, test)


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


# --- Reconcile sweep (Slice 3 — §8.9 cron callable) -------------------


async def reconcile_pending_grade_reviews(db: AsyncSession) -> dict[str, int]:
    """Sweep pending ``grade_review`` rows once. For each pending row:

    * If the underlying Grade has been admin-overridden
      (``Grade.overridden_at IS NOT NULL``) — skip; admin has resolved
      it via the AC-D2 override mechanism.
    * If the row's ``created_at`` is older than
      ``MAX_RETRY × INTERVAL`` minutes — auto-flag in place with reason
      ``auto_flagged_stuck_pending`` and surface in the admin queue
      (AC-D19 v1.6 — at the v1.7 defaults this is ≈50-minute
      wall-clock).
    * Otherwise — group with the attempt's other still-active pending
      rows and re-run the batched ``provider.review()`` call against
      that subset.

    Returns a counts dict for the admin trigger endpoint and the
    Celery task wrapper.

    Off the submit path. Fail-soft on every off-contract branch (timeout,
    provider error, malformed response, unknown grade_id, unknown
    verdict) — affected rows stay pending so the next sweep retries.
    Skipped GradeReviews whose Grade is overridden count toward
    ``rows_still_pending`` semantically (they're not transitioning); the
    caller can subtract overridden-skips if it cares to distinguish.

    The retry-counter approach is wall-clock against ``created_at``,
    NOT a per-row counter column on ``grade_review``. This matches the
    operator-visible ≈50-minute SLA from PR-017 / AC-CD11 v1.7 verbatim
    and avoids a v1.6→v1.7 schema migration.
    """
    counts = {
        "attempts_processed": 0,
        "rows_confirmed": 0,
        "rows_flagged": 0,
        "rows_auto_flagged": 0,
        "rows_still_pending": 0,
    }
    pending = await _pending_reviews(db)
    if not pending:
        return counts

    now = now_utc()
    sla = timedelta(
        minutes=GRADE_REVIEW_MAX_RETRY_ATTEMPTS * GRADE_REVIEW_RECONCILE_INTERVAL_MINUTES
    )

    # Phase 1: group reviewable rows by attempt; auto-flag past-SLA
    # rows in place. We collect 4-tuples (grade, gr_row, response,
    # question) so the per-attempt batch can build the payload without
    # re-querying.
    attempts_pending: dict[
        uuid.UUID, list[tuple[Grade, GradeReview, Response, Question]]
    ] = {}
    attempts_with_changes: set[uuid.UUID] = set()
    for gr_row in pending:
        grade = await _grade_by_id(db, gr_row.grade_id)
        if grade is None or grade.overridden_at is not None:
            counts["rows_still_pending"] += 1
            continue
        response = await _response_by_id(db, grade.response_id)
        if response is None:
            counts["rows_still_pending"] += 1
            continue
        age = now - gr_row.created_at
        if age > sla:
            gr_row.status = ReviewStatus.flagged
            gr_row.review_reasoning = _AUTO_FLAG_REASON
            counts["rows_auto_flagged"] += 1
            attempts_with_changes.add(response.attempt_id)
            _log.info(
                "grade_review.auto_flagged_stuck_pending",
                extra={
                    "grade_review_id": str(gr_row.id),
                    "attempt_id": str(response.attempt_id),
                    "age_minutes": age.total_seconds() / 60.0,
                },
            )
            continue
        question = await _question_by_id(db, response.question_id)
        if question is None:
            counts["rows_still_pending"] += 1
            continue
        attempts_pending.setdefault(response.attempt_id, []).append(
            (grade, gr_row, response, question)
        )

    # Phase 2: per-attempt batched review against the pending subset.
    if attempts_pending:
        settings = await _system_settings(db)
        provider = resolve_provider(Operation.grade_review, system_settings=settings)
        for attempt_id, quads in attempts_pending.items():
            attempt = await _attempt_by_id(db, attempt_id)
            test = await _test_by_id(db, attempt.test_id) if attempt is not None else None
            if attempt is None or test is None:
                # Orphaned pending — attempt or test row was deleted.
                # Leave the rows pending so an operator can investigate.
                counts["rows_still_pending"] += len(quads)
                continue
            counts["attempts_processed"] += 1
            items_payload = [_payload_item(g, q, r) for g, _, r, q in quads]
            payload = {
                "items": items_payload,
                "items_json": json.dumps(items_payload),
            }
            batched_size = len(items_payload)
            started = time.perf_counter()
            ai_result = None
            ceiling_breached = False
            try:
                ai_result = await asyncio.wait_for(
                    provider.review(Operation.grade_review, payload),
                    timeout=GRADE_REVIEW_RECONCILE_INTERNAL_TIMEOUT_SECONDS,
                )
            except TimeoutError:
                ceiling_breached = True
                _log.warning(
                    "grade_review.reconcile_batch_timeout",
                    extra={
                        "attempt_id": str(attempt_id),
                        "batched_payload_size": batched_size,
                    },
                )
            except Exception:
                _log.warning(
                    "grade_review.reconcile_batch_failed",
                    extra={
                        "attempt_id": str(attempt_id),
                        "batched_payload_size": batched_size,
                    },
                    exc_info=True,
                )
            _emit_telemetry(
                attempt=attempt,
                latency_ms=(time.perf_counter() - started) * 1000.0,
                success=ai_result is not None,
                batched_payload_size=batched_size,
                ceiling_breached=ceiling_breached,
            )
            if ai_result is None:
                counts["rows_still_pending"] += len(quads)
                continue

            content = ai_result.content if isinstance(ai_result.content, dict) else None
            items_out = content.get("items") if content is not None else None
            if not isinstance(items_out, list):
                counts["rows_still_pending"] += len(quads)
                continue

            pairs_by_grade_id: dict[str, tuple[Grade, GradeReview]] = {
                str(g.id): (g, gr) for g, gr, _, _ in quads
            }
            attempt_changed = False
            for entry in items_out:
                if not isinstance(entry, dict):
                    continue
                gid_raw = entry.get("grade_id")
                gid = str(gid_raw) if gid_raw is not None else None
                if gid is None or gid not in pairs_by_grade_id:
                    continue
                verdict_raw = entry.get("verdict")
                try:
                    verdict = ReviewStatus(str(verdict_raw))
                except ValueError:
                    continue
                if verdict not in (ReviewStatus.confirmed, ReviewStatus.flagged):
                    continue
                _grade, gr_row = pairs_by_grade_id.pop(gid)
                gr_row.status = verdict
                reasoning = entry.get("reasoning")
                if isinstance(reasoning, str):
                    gr_row.review_reasoning = reasoning
                record_provenance_share(gr_row, ai_result, share_count=batched_size)
                if verdict == ReviewStatus.confirmed:
                    counts["rows_confirmed"] += 1
                else:
                    counts["rows_flagged"] += 1
                attempt_changed = True

            # Anything left in pairs_by_grade_id was not addressed by the
            # response (missing entry / off-contract) — stays pending.
            counts["rows_still_pending"] += len(pairs_by_grade_id)
            if attempt_changed:
                attempts_with_changes.add(attempt_id)

    # Phase 3: recompute overall_score for attempts whose grade_review
    # set changed (auto-flag OR successful confirm/flag from provider).
    for attempt_id in attempts_with_changes:
        attempt = await _attempt_by_id(db, attempt_id)
        if attempt is None:
            continue
        test = await _test_by_id(db, attempt.test_id)
        if test is None:
            continue
        await _recompute_overall_score(db, attempt, test)

    return counts


# --- Admin flag queue (Slice 4 — AC-D19 v1.6 / AC-D2) -----------------


async def list_flagged_reviews(db: AsyncSession) -> list[dict[str, Any]]:
    """List flagged ``grade_review`` rows whose underlying Grade has
    NOT been admin-overridden — the admin queue surface (AC-D19 v1.6).

    Once an admin resolves a flag via :func:`resolve_flagged_review`,
    ``Grade.overridden_at`` is set and the row drops off the queue.
    The GradeReview.status stays ``flagged`` (the resolution is
    recorded on the Grade, not on the review row) — that's why the
    filter joins on the override column rather than checking review
    status alone.

    Returns a list of dicts shaped for ``FlaggedGradeReviewItem``. The
    caller (router) converts to Pydantic.
    """
    flagged = await db.execute(
        select(GradeReview).where(
            GradeReview.status == ReviewStatus.flagged,
            GradeReview.tenant_id == SEED_TENANT_ID,
        )
    )
    rows = list(flagged.scalars().all())
    out: list[dict[str, Any]] = []
    for gr in rows:
        grade = await _grade_by_id(db, gr.grade_id)
        if grade is None or grade.overridden_at is not None:
            continue
        response = await _response_by_id(db, grade.response_id)
        if response is None:
            continue
        out.append(
            {
                "grade_review_id": gr.id,
                "grade_id": grade.id,
                "attempt_id": response.attempt_id,
                "question_id": response.question_id,
                "ai_score": float(grade.score),
                "ai_verdict": grade.verdict.value,
                "ai_reasoning": grade.ai_reasoning,
                "review_reasoning": gr.review_reasoning,
                "created_at": gr.created_at,
            }
        )
    # Oldest-first so the admin queue surfaces the longest-waiting
    # row at the top of the list (operator priority hint).
    out.sort(key=lambda r: r["created_at"])
    return out


async def resolve_flagged_review(
    db: AsyncSession,
    grade_review_id: uuid.UUID,
    admin: AppUser,
    *,
    action: str,
    score: float | None = None,
    verdict: str | None = None,
    reasoning: str | None = None,
) -> dict[str, Any]:
    """Resolve one flagged ``grade_review`` per admin's chosen action
    (AC-D19 v1.6 / AC-D2 override mechanism). Writes the override
    columns on the underlying Grade, recomputes ``overall_score`` for
    the attempt, and writes an audit-log entry.

    Raises :class:`APIError` 404 if the GradeReview is missing, 409 if
    the GradeReview is not currently ``flagged``, or 409 if the Grade
    has already been overridden (idempotency guard — admin can't
    resolve the same row twice).

    Returns a dict shaped for ``GradeReviewResolveResult``.
    """
    gr = await db.execute(
        select(GradeReview).where(
            GradeReview.id == grade_review_id,
            GradeReview.tenant_id == SEED_TENANT_ID,
        )
    )
    gr_row = gr.scalar_one_or_none()
    if gr_row is None:
        raise APIError(404, "grade_review_not_found", "grade_review not found")
    if gr_row.status != ReviewStatus.flagged:
        raise APIError(
            409,
            "grade_review_not_flagged",
            "Only flagged grade_review rows can be resolved.",
        )
    grade = await _grade_by_id(db, gr_row.grade_id)
    if grade is None:
        raise APIError(404, "grade_not_found", "Underlying grade row not found.")
    if grade.overridden_at is not None:
        raise APIError(
            409,
            "grade_already_overridden",
            "The underlying grade has already been resolved by an admin.",
        )

    if action == "keep_ai":
        # Grade.score / verdict / ai_reasoning unchanged; admin
        # explicitly chooses to trust the AI's grade despite the
        # reviewer's pushback.
        pass
    elif action == "accept_reviewer":
        # The reviewer's verdict is binary (flagged); accepting it
        # means revoking the AI's grade. score → 0.0, verdict → none,
        # ai_reasoning → review_reasoning so the reviewer's pushback
        # is preserved on the Grade row.
        grade.score = 0.0
        grade.verdict = GradeVerdict.none
        grade.ai_reasoning = gr_row.review_reasoning
    elif action == "substitute":
        # Pydantic enforces both ``score`` and ``verdict`` are present
        # for substitute; the asserts here are defensive against a
        # direct domain call that bypassed the schema.
        if score is None or verdict is None:
            raise APIError(
                422,
                "substitute_missing_score_or_verdict",
                "action='substitute' requires both 'score' and 'verdict'.",
            )
        grade.score = float(score)
        try:
            grade.verdict = GradeVerdict(verdict)
        except ValueError as exc:
            raise APIError(
                422,
                "invalid_verdict",
                f"verdict={verdict!r} is not one of full / partial / none.",
            ) from exc
        if reasoning is not None:
            grade.ai_reasoning = reasoning
    else:
        raise APIError(
            422,
            "invalid_action",
            f"action={action!r} is not keep_ai / accept_reviewer / substitute.",
        )

    # Common per-action: mark Grade as admin-resolved + update the
    # response_score the result page reads from + recompute attempt.
    now = now_utc()
    grade.overridden_by = admin.id
    grade.overridden_at = now
    response = await _response_by_id(db, grade.response_id)
    if response is not None:
        response.response_score = grade.score
    attempt = (
        await _attempt_by_id(db, response.attempt_id) if response is not None else None
    )
    test = await _test_by_id(db, attempt.test_id) if attempt is not None else None
    if attempt is not None and test is not None:
        await _recompute_overall_score(db, attempt, test)

    await record_audit(
        db,
        actor_id=admin.id,
        action="grade_review.resolve",
        target_entity="grade_review",
        target_id=gr_row.id,
        detail={
            "action": action,
            "score": grade.score,
            "verdict": grade.verdict.value,
            "reasoning": reasoning,
        },
    )

    return {
        "grade_review_id": gr_row.id,
        "grade_id": grade.id,
        "attempt_id": attempt.id if attempt is not None else uuid.UUID(int=0),
        "action": action,
        "grade_score": float(grade.score),
        "grade_verdict": grade.verdict.value,
        "attempt_overall_score": attempt.overall_score if attempt is not None else None,
        "attempt_outcome": attempt.outcome if attempt is not None else None,
    }
