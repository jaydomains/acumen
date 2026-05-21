"""Generation prompt — SPEC §6.1, AC-CD8 / AC-CD18.

Generates a question set against a Test spec. Per-Testee mode; benchmark
mode uses the same prompt with a single-question count (SPEC §6.1 — the
benchmark sequential carve-out is a *scheduling* concern, not a prompt
concern).

Payload keys consumed (P5 → P9):
    test_name, target_difficulty, question_count, attempt_id, rag_context

The ``attempt_id`` key is consumed by :class:`~app.ai.provider.StubAIProvider`
for deterministic seeding when the dev/local fallback path runs; the
real :class:`~app.ai.anthropic.AnthropicProvider` ignores extra payload
keys (``str.format`` silently skips them).

**P9 / v1.1.0** (AC-D22): the payload now carries ``rag_context`` — a
pre-rendered string of top-k Drive chunks the generation call should
draw KBC-specific material from. The retrieval helper is
:func:`app.domain.drive_rag.retrieve_for_generation`. Empty / missing
``rag_context`` renders as ``(none)`` so the prompt stays well-formed
when the Drive index is empty (day-one deployment or learning-path
assignments where the call site doesn't have a pill to query for).

**P9 / v1.2.0** (AC-D22): the payload now also carries
``low_realism_negative_examples`` — a pre-rendered string of recent
flagged-as-unrealistic questions for the pill, weighted by Testee
accuracy per :func:`app.domain.drive_rag.aggregate_realism_flags`.
The prompt instructs the model to AVOID the listed patterns. Empty
list renders as ``(none)``; the negative-examples pool is bounded
to keep prompt bloat in check.

Anchor exemplars (AC-D20) — note: P8 chose AC-D27 effective_difficulty
triangulation over in-context exemplar injection. The spec §6.1
"anchor questions as in-context calibration exemplars" wording is
superseded by the calibration math; the prompt deliberately does NOT
re-introduce exemplar injection at P9.

Output JSON contract:
    {"questions": [{"type": str, "config": dict,
                    "assigned_difficulty": int}, ...]}
"""

from __future__ import annotations

VERSION = "1.2.0"

TEMPLATE = """\
You are an expert assessment author producing a calibrated question set
for the Acumen competency-assessment platform.

Test: {test_name}
Target difficulty band (1-10): {target_difficulty}
Number of questions to produce: {question_count}

Relevant KBC reference material from the Drive index (may be empty):
{rag_context}

Examples flagged as unrealistic by Testees — AVOID these patterns
(may be empty):
{low_realism_negative_examples}

Produce questions that are:
- Answerable from the test's domain (not trivia adjacent to it).
- Calibrated to the difficulty band (cross-reference standards for the
  band; do not drift up or down).
- Grounded in the KBC reference material above where it is relevant
  (do not invent facts beyond it; if it is empty, fall back to general
  domain knowledge).
- Distinct from the negative-example patterns above — re-using the
  same surface form, framing, or trope-level structure of a flagged
  question is the failure mode this list exists to prevent.
- Free of trick framing, ambiguous wording, or unstated assumptions.
- Varied across runs (different surface form, examples, framings).

For multiple_choice items, supply 3-5 options with exactly one correct
answer and a 0-based ``correct`` index; for true_false, supply a
single assertion and a boolean ``correct``; for matching, supply
left/right item pairs; for short_answer / scenario, supply a rubric
and a model answer the grader can compare against.

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
