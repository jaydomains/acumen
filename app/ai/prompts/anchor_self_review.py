"""Anchor self-review prompt — AC-D23 bootstrap quality filter.

A second AI call (cross-family per AC-D19 — Anthropic generates the
anchor, OpenAI reviews it) evaluates each AI-generated anchor question
against the AC-D23 quality criteria *before* it goes live in the draw
pool. Anchors that fail self-review regenerate up to three attempts per
slot per AC-D23; anchors that fail three times are excluded from the
pool with an admin-attention flag.

The reviewer is framed as *"is this anchor fit to enter a frozen,
shared-across-Testees pool?"* — orthogonal-signal from the generator
(AC-D19 v1.1) is preserved. The reviewer is **not** asked to grade or
re-author the anchor; only to verdict it.

Input contract (rendered into ``{items_json}``):
    [
      {
        "anchor_question_id": "<opaque id; verbatim in output>",
        "pill_name": "<pill the anchor belongs to>",
        "band": <int 1..10>,
        "assumed_difficulty": <int 1..10>,
        "type": "<multiple_choice|true_false|matching|short_answer|scenario>",
        "config": { ... },          // question config per QuestionType
        "rubric": "<grading rubric for short_answer/scenario; may be omitted>"
      },
      ...
    ]

Output JSON contract:
    {
      "items": [
        {
          "anchor_question_id": "<same id as input, verbatim>",
          "verdict": "<ok|flagged>",
          "reasoning": "<one to three sentences; required on flagged>"
        },
        ...
      ]
    }

Quality criteria are AC-D23 verbatim:
    - pill-fit (does the anchor measure the pill the catalogue says it
      measures?)
    - difficulty calibration (does the assumed_difficulty match the
      cognitive load the wording actually demands?)
    - rubric clarity (for short_answer / scenario — is the rubric
      operational, or is it ambiguous?)
    - freedom from ambiguity (is there exactly one defensible answer
      under the rubric?)
    - factual reasonableness (does the anchor contradict basic facts
      about the domain?)
"""

from __future__ import annotations

VERSION = "1.0.0"

TEMPLATE = """\
You are reviewing AI-generated anchor questions on the Acumen
competency platform. Each item is a candidate anchor that will be
frozen into a shared pool — every Testee on this pill at this band will
eventually see this exact wording. Your job is NOT to re-grade or
re-author; your job is to verdict whether the anchor is fit to enter
the pool.

For each item, return a verdict against the AC-D23 quality criteria:

  - "ok": the anchor satisfies every criterion below.
  - "flagged": the anchor fails one or more criteria — the wording is
    not fit to be frozen into a shared anchor pool.

Quality criteria (every "ok" verdict implicitly affirms all five):
  1. **Pill-fit.** The anchor measures the pill the catalogue says it
     measures. If the anchor could plausibly be about a different pill,
     it is flagged.
  2. **Difficulty calibration.** The assumed_difficulty matches the
     cognitive load the wording actually demands on the 1-10 axis. A
     band-3 anchor that requires band-7 reasoning is flagged; same for
     the reverse.
  3. **Rubric clarity** (short_answer / scenario only). The rubric is
     operational — a competent human grader can apply it consistently
     to a range of plausible responses. Ambiguous rubrics are flagged.
  4. **Freedom from ambiguity.** Exactly one defensible answer exists
     under the rubric. Multiple-choice items with two plausible
     correct options, true/false items that depend on unstated
     assumptions, matching items with multiple valid pairings — all
     flagged.
  5. **Factual reasonableness.** The anchor does not contradict basic
     facts about the pill's domain.

You will be given a JSON array of items. Each item carries an opaque
``anchor_question_id``; copy it verbatim into your output. Cover every
item — one output entry per input item, same order.

Items:
{items_json}

Return strictly valid JSON of shape:

{{
  "items": [
    {{
      "anchor_question_id": "<the same anchor_question_id from the input item>",
      "verdict": "<ok|flagged>",
      "reasoning": "<one to three sentences; required on flagged>"
    }}
  ]
}}

No prose, no markdown — JSON only.
"""
