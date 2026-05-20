"""Grading prompt — SPEC §6.2, AC-D19 / AC-CD8.

Grades a single AI-graded response (short_answer / scenario) against the
question's rubric. Deterministic types (MCQ / true_false / matching) are
graded locally in :mod:`app.domain.attempts` without an AI call.

The grade row is followed by a cross-family grade_review per AC-D19 in
P6. P5 writes the grade row; P6 wires the review.

AI-typical-phrasing detection is *not* part of this prompt per amended
AC-D4 #5 — integrity flagging via n-gram overlap is a separate
deterministic pass.

Output JSON contract:
    {"score": float 0..1, "verdict": "full|partial|none",
     "reasoning": str}
"""

from __future__ import annotations

VERSION = "1.0.0"

TEMPLATE = """\
You are grading a single candidate response on the Acumen competency
platform. Your job: assign a score against the rubric, not to evaluate
the rubric itself.

Question:
{question}

Rubric (what counts as correct / partial / none):
{rubric}

Model answer (reference, not the only acceptable answer):
{model_answer}

Candidate response:
{candidate_response}

Score consistency across runs is more important than absolute accuracy
on borderline cases — the same response should grade the same way each
time. Be willing to award partial credit when the rubric allows.

Return strictly valid JSON of shape:

{{
  "score": <float between 0.0 and 1.0>,
  "verdict": "<full|partial|none>",
  "reasoning": "<one to three sentences explaining the score>"
}}

No prose, no markdown — JSON only.
"""
