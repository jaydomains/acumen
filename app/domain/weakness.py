"""Weakness identification — SPEC §6.3, AC-D6 / AC-D9 / AC-CD8 v1.6.

P5 Slice 2 ships ``identify_weakness`` as a pure callable domain
function. It is **not** auto-triggered from
:func:`app.domain.attempts.submit_attempt` — SPEC §6.3 requires the
attempt be "fully graded and reviewed" before weakness runs, and
cross-family review (AC-D19 / AC-CD11) lands in P6. P7 wires the
adaptive loop trigger ("failed pill serves material then queues a
follow-up").

The producing AI call is one per attempt → one :class:`WeaknessReport`
row + N :class:`WeaknessReportPill` join rows. Provenance (provider,
model, prompt_version, tokens, cost) persists on the WeaknessReport
row per AC-CD8 v1.6; the per-pill severity rows carry no provenance
(they are deterministic projections of the AI's output).
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.cost import record_provenance
from app.ai.provider import Operation, resolve_provider
from app.models import (
    SEED_TENANT_ID,
    Attempt,
    Grade,
    Question,
    Response,
    SystemSettings,
    WeaknessReport,
    WeaknessReportPill,
)


async def _system_settings(db: AsyncSession) -> SystemSettings | None:
    result = await db.execute(
        select(SystemSettings).where(SystemSettings.tenant_id == SEED_TENANT_ID)
    )
    return result.scalar_one_or_none()


async def _attempt_responses(db: AsyncSession, attempt_id: uuid.UUID) -> list[Response]:
    result = await db.execute(select(Response).where(Response.attempt_id == attempt_id))
    return list(result.scalars().all())


async def _attempt_questions(db: AsyncSession, attempt_id: uuid.UUID) -> list[Question]:
    result = await db.execute(select(Question).where(Question.attempt_id == attempt_id))
    return list(result.scalars().all())


async def _grades_for_responses(
    db: AsyncSession, response_ids: list[uuid.UUID]
) -> dict[uuid.UUID, Grade]:
    """Equality-only fetch per response_id — the FakeSession harness
    has no IN/JOIN, so iterate. At v1 scale (≤ 30 questions per attempt)
    this is fine; profile in P11 if attempt sizes ever grow."""
    out: dict[uuid.UUID, Grade] = {}
    for rid in response_ids:
        result = await db.execute(select(Grade).where(Grade.response_id == rid))
        grade = result.scalar_one_or_none()
        if grade is not None:
            out[rid] = grade
    return out


def _build_payload(
    questions: list[Question],
    responses: list[Response],
    grades: dict[uuid.UUID, Grade],
) -> dict[str, Any]:
    """Compose the weakness-prompt payload: per-response summary the
    model uses to identify weak pills. Question pill-tag is not yet
    modelled on the Question row (P5 surface; P7+P8 add the link), so
    P5 ships pill_id as ``null`` and the prompt is asked to identify
    severity per topic without pill UUIDs. P7 wires the pill mapping
    when the loop integrates with the catalogue."""
    by_qid = {q.id: q for q in questions}
    summary: list[dict[str, Any]] = []
    for response in responses:
        question = by_qid.get(response.question_id)
        if question is None:
            continue
        grade = grades.get(response.id)
        summary.append(
            {
                "question_prompt": (question.config or {}).get("prompt", ""),
                "candidate_answer": response.answer_payload,
                "score": grade.score if grade else None,
                "verdict": grade.verdict.value if grade else None,
                "reasoning": grade.ai_reasoning if grade else None,
            }
        )
    return {"attempt_summary": summary}


async def identify_weakness(
    db: AsyncSession,
    attempt: Attempt,
    *,
    test_override: str | None = None,
) -> WeaknessReport:
    """Run the weakness-identification AI call against a graded attempt
    and persist a :class:`WeaknessReport` (+ :class:`WeaknessReportPill`
    rows) with full provenance.

    Not auto-triggered from ``submit_attempt`` in P5 — P7 wires the
    adaptive loop. Tests exercise the callable directly with a
    ``RecordingProvider`` substituted at the module-level singleton.
    """
    settings = await _system_settings(db)
    provider = resolve_provider(
        Operation.weakness, system_settings=settings, test_override=test_override
    )

    questions = await _attempt_questions(db, attempt.id)
    responses = await _attempt_responses(db, attempt.id)
    grades = await _grades_for_responses(db, [r.id for r in responses])
    payload = _build_payload(questions, responses, grades)

    result = await provider.generate(Operation.weakness, payload)

    report = WeaknessReport(
        tenant_id=SEED_TENANT_ID,
        attempt_id=attempt.id,
        routed_to_admin=False,
    )
    record_provenance(report, result)
    db.add(report)
    await db.flush()
    await db.refresh(report)

    weak_pills = result.content.get("weak_pills") or []
    for entry in weak_pills:
        try:
            pill_id = uuid.UUID(str(entry["pill_id"]))
        except (KeyError, ValueError, TypeError):
            # Defensive: the prompt asks for UUIDs but a model may emit
            # a stringified id, a name, or skip the field. Skip the
            # malformed row rather than crash the submit path; the
            # report row exists so the audit trail is preserved.
            continue
        severity = float(entry.get("severity") or 0.0)
        db.add(
            WeaknessReportPill(
                tenant_id=SEED_TENANT_ID,
                weakness_report_id=report.id,
                pill_id=pill_id,
                severity=severity,
            )
        )
    await db.flush()
    return report
