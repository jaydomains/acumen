"""Learning material prompt — SPEC §6.4, AC-D6 / AC-D21 / AC-CD8 / AC-D22.

Generates targeted explainer text for a weak pill. Skipped entirely for
safety-tagged pills per AC-D21 — those serve curated external links
instead. The caller (:mod:`app.domain.learning_material`) enforces the
safety carve-out before invoking this prompt.

**P9 / v1.1.0** (AC-D22): the payload now carries ``rag_context`` — a
pre-rendered string of top-k Drive chunks for the pill. Per SPEC §6.4
"retrieved Drive RAG chunks per AC-D22" the explainer grounds itself
in KBC-specific reference material when available. Empty / missing
``rag_context`` renders as ``(none)`` so the prompt stays well-formed
when the Drive index is empty.

**P9 / v1.2.0** (AC-D22): the payload now also carries
``low_realism_negative_examples`` — flagged-as-unrealistic questions
for the pill, used as a "don't sound like this" signal for the
explainer's worded examples (mirrors the generation prompt's
negative-examples block).

Output JSON contract:
    {"explainer": str  # 200-400 words, in-app display ready}
"""

from __future__ import annotations

VERSION = "1.2.0"

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

Relevant KBC reference material from the Drive index (may be empty):
{rag_context}

Examples flagged as unrealistic by Testees — your worded examples
should not echo these patterns (may be empty):
{low_realism_negative_examples}

Write 200-400 words. Address the actual gap, not the topic in general.
Include one or two worked examples grounded in the trade context, and
prefer drawing from the KBC reference material above where it is
relevant (do not invent facts beyond it; if it is empty, fall back to
general domain knowledge). Avoid references to "the test" or "this
question" — the explainer should read as a standalone reference.

Return strictly valid JSON of shape:

{{
  "explainer": "<200-400 word explainer text>"
}}

No prose outside the JSON, no markdown — JSON only.
"""
