"""Generation prompt — SPEC §6.1, AC-CD8 / AC-CD18.

Generates a question set against a Test spec. Per-Testee mode; benchmark
mode uses the same prompt with a single-question count (SPEC §6.1 — the
benchmark sequential carve-out is a *scheduling* concern, not a prompt
concern). RAG context (AC-D22) and anchor exemplars (AC-D20) are wired
into the payload in P9 / P8 respectively; P5 ships without them.

Payload keys consumed:
    subject_name, target_difficulty, question_count,
    question_type_mix, optional_weakness_profile

Output JSON contract:
    {"questions": [{"type": str, "config": dict,
                    "assigned_difficulty": int}, ...]}
"""

from __future__ import annotations

VERSION = "1.0.0"

TEMPLATE = """\
You are an expert assessment author producing a calibrated question set
for the Acumen competency-assessment platform.

Subject: {subject_name}
Target difficulty band (1-10): {target_difficulty}
Number of questions to produce: {question_count}
Question type mix (counts per type): {question_type_mix}
Optional weakness profile (pills the testee struggled with previously):
{optional_weakness_profile}

Produce questions that are:
- Answerable from the pill's domain (not trivia adjacent to it).
- Calibrated to the difficulty band (cross-reference standards for the
  band; do not drift up or down).
- Free of trick framing, ambiguous wording, or unstated assumptions.
- Varied across runs (different surface form, examples, framings).

For multiple_choice items, supply 3-5 options with exactly one correct
answer; for true_false, supply a single assertion; for matching, supply
left/right item pairs; for short_answer / scenario, supply a rubric and
a model answer the grader can compare against.

Return strictly valid JSON of shape:

{{
  "questions": [
    {{
      "type": "<multiple_choice|true_false|matching|short_answer|scenario>",
      "config": {{ ...type-specific... }},
      "assigned_difficulty": <int 1-10>
    }},
    ...
  ]
}}

No prose, no markdown — JSON only.
"""
