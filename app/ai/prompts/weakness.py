"""Weakness identification prompt — SPEC §6.3, AC-D6 / AC-D9 / AC-CD8.

Run after an attempt is fully graded (and, in P6+, reviewed). Identifies
the pills the testee struggled with and at what severity. Updates feed
into :mod:`app.domain.competence` per amended AC-D9 — P5 ships this
prompt as the engine; P7 wires the loop trigger.

Output JSON contract:
    {"weak_pills": [{"pill_id": str-uuid,
                     "severity": float 0..1,
                     "note": str}, ...]}
"""

from __future__ import annotations

VERSION = "1.0.0"

TEMPLATE = """\
You are analysing an Acumen testee's attempt to identify which pills
(competency atoms) they struggled with, distinguishing topic-level gaps
from carelessness on a specific question.

Attempt summary (per response: question prompt, pill tags, candidate's
answer, grader's verdict / score, grader's reasoning):
{attempt_summary}

For each pill the testee struggled with, assign a severity between 0.0
(not weak — pattern is carelessness or noise) and 1.0 (severe — multiple
clear failures on the same pill at the assigned difficulty band).
Surface the actual pill the testee got wrong, not the parent subject.

Return strictly valid JSON of shape:

{{
  "weak_pills": [
    {{
      "pill_id": "<uuid>",
      "severity": <float between 0.0 and 1.0>,
      "note": "<one sentence: what the gap looks like>"
    }},
    ...
  ]
}}

If no pill is weak, return ``{{"weak_pills": []}}``. No prose, no
markdown — JSON only.
"""
