"""Attempt-result PDF rendering (P11 / SPEC §3 / AC-D26 surface).

Renders a submitted attempt's graded result as a single-file PDF using
ReportLab's Platypus flowables. Pure-Python; no Dockerfile system deps
(AC-CD1 minimum-deps). Spec §3:136 lists "PDF export of an individual
attempt's graded result" as in-scope for v1 but does NOT name a library
— ReportLab is the P11 implementer choice (rationale in CODE_SPEC §2).

The renderer consumes the dicts already produced by the domain layer:

* :func:`app.domain.attempts.view_attempt` — presented questions
  (post-shuffle), watermark, sequence_number, started/submitted_at.
* :func:`app.domain.attempts.result_view` — overall_score, outcome,
  per-question grade rows (score, verdict, source, under_admin_review).

Both reads happen in the router; this module is pure synchronous Python
(ReportLab is sync-only) and takes the two dicts as arguments. No DB
or AI work happens here; failures bubble as ``RuntimeError`` and surface
as a 500 in the router (PDF rendering is an internal-state failure, not
a user-input failure).
"""

from __future__ import annotations

import io
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import escapeOnce
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def _fmt_datetime(value: Any) -> str:
    """ISO-format a datetime / date / string defensively. Returns "—"
    when the value is missing so the PDF body never carries a literal
    ``None`` token visible to the Testee."""
    if value is None:
        return "—"
    if hasattr(value, "isoformat"):
        return str(value.isoformat())
    return str(value)


def _fmt_score(value: Any) -> str:
    if value is None:
        return "—"
    try:
        return f"{float(value):.2f}"
    except (TypeError, ValueError):
        return str(value)


def _question_prompt(presented_q: dict[str, Any]) -> str:
    """Extract the prompt text from a presented question (post-shuffle).

    Presented questions carry a ``config`` dict with shape that varies
    by question type (MCQ has ``options``, T/F has ``correct``, etc.);
    every type carries ``prompt`` per SPEC §6.1. Falls back to the
    type name if a malformed row slips through.

    The returned string is **XML-escaped via ReportLab's ``escapeOnce``**:
    ``Paragraph`` interprets a subset of XML/HTML markup, so a prompt
    containing ``<``, ``>``, or ``&`` (e.g. ``"x < 5"`` in a maths
    rubric, or HTML-like content in a code question) would either
    crash ``ParaParser`` or, in older ReportLab versions, expose a
    CVE-2023-33733-class code-execution surface. Test authors and AI
    generation are both upstream of this path, so the escape is
    mandatory not defensive (Gitar PR-#24 Slice 1 finding #1).
    """
    config = presented_q.get("config") or {}
    prompt = config.get("prompt")
    if isinstance(prompt, str) and prompt:
        return escapeOnce(prompt)
    return f"(question id {presented_q.get('id', 'unknown')})"


def _grade_row_text(grade_row: dict[str, Any]) -> tuple[str, str]:
    """Return (score_cell, verdict_cell) text for one per-question
    grade row from ``result_view``. Honours the v1.6/v1.7 "no score
    leak" contract: AI grades whose review flagged + admin hasn't
    resolved surface as "Under admin review" with no numeric score.

    Reads the FE-6 widened shape (``grade`` sub-object) — ``grade``
    is ``None`` for skipped questions and for under-admin-review
    flagged AI grades; ``grade.points_awarded`` is the numeric score
    and ``grade.is_correct`` is the tri-state boolean rendered as
    full / partial / none in the verdict cell.
    """
    if grade_row.get("status") == "under_admin_review":
        return ("Under admin review", "—")
    grade = grade_row.get("grade")
    if not isinstance(grade, dict):
        return ("—", "—")
    score = _fmt_score(grade.get("points_awarded"))
    is_correct = grade.get("is_correct")
    if is_correct is True:
        verdict = "full"
    elif is_correct is False:
        verdict = "none"
    elif grade.get("points_awarded") is not None:
        verdict = "partial"
    else:
        verdict = "—"
    return (score, verdict)


def render_attempt_pdf(
    view: dict[str, Any],
    result: dict[str, Any],
    *,
    test_name: str,
    testee_email: str,
) -> bytes:
    """Render the attempt's PDF and return the bytes.

    Inputs:
    * ``view`` — output of :func:`app.domain.attempts.view_attempt`
      (carries presented questions, watermark, submitted_at).
    * ``result`` — output of :func:`app.domain.attempts.result_view`
      with ``status="ready"`` (a ``review_pending`` result should be
      rejected at the router; we accept it defensively here and render
      whatever per-question rows are present, plus a banner).
    * ``test_name`` — the Test.name, joined in by the router.
    * ``testee_email`` — the AppUser.email, joined in by the router.

    Output: a complete PDF document as ``bytes`` (caller wraps in a
    :class:`fastapi.Response` with ``media_type="application/pdf"``).

    Layout: A4 portrait. Header (test name, testee email, submitted_at,
    overall_score, outcome). One-row-per-question table (#, prompt,
    score, verdict). Watermarked footer with attempt id so a printout
    is identifiable.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        title=f"Acumen attempt — {test_name}",
    )
    styles = getSampleStyleSheet()
    title_style = styles["Title"]
    body_style = styles["BodyText"]
    small_style = ParagraphStyle(
        "small",
        parent=body_style,
        fontSize=8,
        textColor=colors.grey,
    )

    # ``test_name`` is admin-supplied and flows into a ``Paragraph`` —
    # escape for the same reason ``_question_prompt`` does (Gitar PR-#24
    # Slice 1 finding #1).
    story: list[Any] = []
    story.append(Paragraph(f"Acumen — {escapeOnce(test_name)}", title_style))
    story.append(Spacer(1, 4 * mm))

    header_rows = [
        ["Testee", testee_email],
        ["Attempt", str(view.get("id", "—"))],
        ["Sequence", str(view.get("sequence_number", "—"))],
        ["Started", _fmt_datetime(view.get("started_at"))],
        ["Submitted", _fmt_datetime(result.get("submitted_at"))],
        ["Overall score", _fmt_score(result.get("overall_score"))],
        ["Outcome", str(result.get("outcome") or "—")],
    ]
    header_table = Table(header_rows, colWidths=[40 * mm, 130 * mm])
    header_table.setStyle(
        TableStyle(
            [
                ("FONT", (0, 0), (0, -1), "Helvetica-Bold"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 6 * mm))

    if result.get("status") == "review_pending":
        story.append(
            Paragraph(
                "<b>Result pending review.</b> Cross-family grade review has "
                "not completed for this attempt; the per-question grades "
                "below are partial.",
                body_style,
            )
        )
        story.append(Spacer(1, 4 * mm))

    presented = view.get("questions") or []
    grade_rows = result.get("questions") or []
    # ``result_view`` rows align with the response (same question_id),
    # but ``view_attempt`` shuffles for presentation. Index the grade
    # rows by question_id and look them up per presented question so
    # the printed order matches what the Testee saw.
    grades_by_qid: dict[str, dict[str, Any]] = {
        str(row.get("question_id")): row for row in grade_rows if row.get("question_id")
    }

    table_rows: list[list[Any]] = [["#", "Question", "Score", "Verdict"]]
    for idx, presented_q in enumerate(presented, start=1):
        qid = str(presented_q.get("id", ""))
        grade_row = grades_by_qid.get(qid, {})
        score_cell, verdict_cell = _grade_row_text(grade_row) if grade_row else ("—", "—")
        prompt = _question_prompt(presented_q)
        # Paragraph wraps long prompts inside the table cell; raw strings
        # would overflow A4 width and ReportLab would truncate silently.
        table_rows.append(
            [
                str(idx),
                Paragraph(prompt, body_style),
                score_cell,
                verdict_cell,
            ]
        )
    if len(table_rows) == 1:
        # No questions to render — keep the PDF valid by emitting a
        # placeholder row so the table layout doesn't collapse.
        table_rows.append(["—", "(no questions presented)", "—", "—"])

    body_table = Table(
        table_rows,
        colWidths=[10 * mm, 120 * mm, 20 * mm, 30 * mm],
        repeatRows=1,
    )
    body_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("FONT", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(body_table)
    story.append(Spacer(1, 6 * mm))
    story.append(
        Paragraph(
            f"Watermark: {view.get('watermark', '—')}. " f"Generated by Acumen.",
            small_style,
        )
    )

    doc.build(story)
    return buf.getvalue()
