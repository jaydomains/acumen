"""Grade-review prompt — SPEC §6.6 / AC-D19 / AC-CD11 v1.7.

Cross-family review of AI grades produced by the primary grader
(Anthropic per AC-D12). The reviewer is framed as *"is this grade
defensible given the rubric?"* — not *"what grade would you give?"* —
so the orthogonal-signal property of cross-family review (AC-D19 v1.1)
is preserved.

The call is **batched per attempt** per AC-CD11 v1.7: one OpenAI call
covers every AI-graded response in the attempt. The payload carries an
``items`` array; the model returns an ``items`` array with one entry
per ``grade_id``.

Input contract (rendered into ``{items_json}``):
    [
      {
        "grade_id": "<uuid str>",
        "question": "<question prompt>",
        "rubric": "<grading rubric>",
        "response": "<candidate response text>",
        "ai_grade": <float 0..1>,
        "ai_verdict": "<full|partial|none>",
        "ai_reasoning": "<grader's reasoning>"
      },
      ...
    ]

Output JSON contract (locked by AC-CD11 v1.7):
    {
      "items": [
        {
          "grade_id": "<uuid str — must match an input grade_id>",
          "verdict": "<confirmed|flagged>",
          "reasoning": "<one to three sentences>"   // optional but
                                                    // strongly preferred
                                                    // on "flagged"
        },
        ...
      ]
    }
"""

from __future__ import annotations

VERSION = "1.0.0"

TEMPLATE = """\
You are reviewing AI-generated grades on the Acumen competency platform.
Each item below is one candidate response that has already been graded
by a different model. Your job is NOT to re-grade — your job is to
decide whether each existing grade is **defensible given the rubric**.

For each item, return a verdict:
  - "confirmed": the grade is a reasonable reading of the rubric on this
    response. Borderline cases that a competent human grader could
    plausibly score the same way are confirmed.
  - "flagged": the grade is not defensible — it ignores the rubric, it
    rewards content the rubric does not credit, it penalises content the
    rubric does credit, or it diverges substantially from any reasonable
    human grader. Reserve "flagged" for clear disagreement, not for
    minor calibration drift.

You will be given a JSON array of items. Each item carries an opaque
``grade_id``; copy it verbatim into your output. Cover every item — one
output entry per input item, same order.

Items:
{items_json}

Return strictly valid JSON of shape:

{{
  "items": [
    {{
      "grade_id": "<the same grade_id from the input item>",
      "verdict": "<confirmed|flagged>",
      "reasoning": "<one to three sentences; required on flagged>"
    }}
  ]
}}

No prose, no markdown — JSON only.
"""
