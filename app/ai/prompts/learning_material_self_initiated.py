"""Self-initiated learning material prompt — SPEC §6.4 / AC-D8.

Sibling of :mod:`app.ai.prompts.learning_material` (the weakness-driven
prompt). This variant is used when a Testee proactively requests
learning material on a pill via the AC-D8 self-directed surface — no
weakness report, no specific gap, no wrong-question list. The output is
a self-contained overview suitable for someone who has not yet been
tested on the pill (onboarding, brush-up) rather than a surgical
remediation explainer.

Routed via the ``_prompt_variant`` payload key the domain layer sets to
``"self_initiated"``; the Anthropic provider resolves the template
through :func:`app.ai.prompts.get_prompt` with the variant. Same
:class:`~app.ai.provider.Operation.learning_material` op, same
``provider.generate()`` method, same :class:`~app.models.LearningMaterial`
row shape — only the prompt text and its persisted ``ai_prompt_version``
differ.

Safety-tagged pills never reach this template (AC-D21): the domain
function branches before calling the provider and serves the pill's
curated :class:`~app.models.PillSafetyLink` set instead.

Output JSON contract:
    {"explainer": str  # 250-450 words, in-app display ready}
"""

from __future__ import annotations

VERSION = "1.0.0"

TEMPLATE = """\
You are producing a self-contained overview of a pill (competency atom)
for an Acumen testee who has chosen to study this topic — they have not
been tested on it and there is no specific weakness to address. The
overview is shown inline in the app — plain English, suitable for a
working construction tradesperson, not academic prose.

Pill name: {pill_name}
Pill description: {pill_description}

Relevant KBC reference material from the Drive index (may be empty):
{rag_context}

Examples flagged as unrealistic by Testees — your worded examples
should not echo these patterns (may be empty):
{low_realism_negative_examples}

Write 250-450 words covering: what the topic is, why it matters in
day-to-day practice, the two or three things a practitioner most needs
to get right, and one or two worked examples grounded in the trade
context. Prefer drawing from the KBC reference material above where it
is relevant (do not invent facts beyond it; if it is empty, fall back
to general domain knowledge). Avoid references to "the test" or "this
question" — the overview should read as a standalone reference a reader
can return to.

Return strictly valid JSON of shape:

{{
  "explainer": "<250-450 word overview text>"
}}

No prose outside the JSON, no markdown — JSON only.
"""
