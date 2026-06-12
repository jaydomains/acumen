"""content_self_review — **grounding/factual** pass (AC-D30 / §6.9, C1).

The first of the three cross-model self-review passes the auto-publish gate
(AC-D31, C2) runs on every autonomously-generated pill draft (AC-D29 / §6.8)
before publication. Anthropic generates the draft → OpenAI reviews it (the
AC-D19 / AC-D23 cross-family floor), so the review is orthogonal signal, not
same-family homophily.

This pass asks: **are the draft's factual claims supported by the cited corpus
chunks** (the AC-D29 ``grounding_refs`` / ``GenerationProvenance``)? It does not
re-author the draft — it verdicts it and lists any claim not supported by the
cited context.

Input contract (rendered into the template):
    {draft_json}      — the generated draft: name, description, and its
                        ``grounding_refs`` (per-assertion ``{claim,
                        source_doc_refs}``).
    {provenance_json} — the cited corpus context: per ``source_doc_ref`` the
                        chunk text + authority tier/score (AC-D28).

Output JSON contract:
    {
      "verdict": "<pass|fail>",
      "unsupported_claims": ["<verbatim claim text>", ...]
    }
``fail`` when any claim is not supported by the cited corpus context.
"""

from __future__ import annotations

VERSION = "1.0.0"

TEMPLATE = """\
You are the GROUNDING/FACTUAL reviewer on the Acumen competency platform.
A different AI model generated the pill draft below; your job is to check,
independently, whether each factual assertion it makes is supported by the
reference-corpus context it cited. You do not rewrite or grade the draft —
you verdict it.

Review criteria:
  - Every factual claim in the draft must be supported by the cited corpus
    context (the grounding_refs and their source text below).
  - A claim that goes beyond, contradicts, or is absent from the cited
    context is UNSUPPORTED — list it verbatim.
  - General-knowledge framing is acceptable only when the draft cited no
    corpus (empty grounding_refs); otherwise claims must trace to the cited
    sources.

Generated draft:
{draft_json}

Cited corpus context (per source_doc_ref):
{provenance_json}

Return strictly valid JSON of shape:

{{
  "verdict": "<pass|fail>",
  "unsupported_claims": ["<the verbatim text of each unsupported claim>"]
}}

``verdict`` is ``fail`` if and only if ``unsupported_claims`` is non-empty.
No prose, no markdown — JSON only.
"""
