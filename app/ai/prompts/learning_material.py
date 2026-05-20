"""Learning material prompt — SPEC §6.4, AC-D6 / AC-D21 / AC-CD8.

Generates targeted explainer text for a weak pill. Skipped entirely for
safety-tagged pills per AC-D21 — those serve curated external links
instead. The caller (:mod:`app.domain.learning_material`) enforces the
safety carve-out before invoking this prompt.

Output JSON contract:
    {"explainer": str  # 200-400 words, in-app display ready}
"""

from __future__ import annotations

VERSION = "1.0.0"

TEMPLATE = """\
You are producing a targeted learning explainer for an Acumen testee who
struggled with a specific pill (competency atom). The explainer is shown
inline in the app — plain English, suitable for a working construction
tradesperson, not academic prose.

Pill name: {pill_name}
Pill description: {pill_description}
Weakness severity (0.0-1.0): {severity}
Specific questions the testee got wrong (optional, may be empty):
{wrong_questions}

Write 200-400 words. Address the actual gap, not the topic in general.
Include one or two worked examples grounded in the trade context. Avoid
references to "the test" or "this question" — the explainer should read
as a standalone reference.

Return strictly valid JSON of shape:

{{
  "explainer": "<200-400 word explainer text>"
}}

No prose outside the JSON, no markdown — JSON only.
"""
