"""content_self_review — **provenance** pass (AC-D30 / §6.9, C1).

The third cross-model self-review pass. Where the grounding pass asks "are the
cited claims *supported*", this pass asks the structural question: **does every
claim resolve to a corpus source at all** — i.e. are there any **orphan
claims** (assertions with no ``GenerationProvenance`` row / no
``source_doc_ref``)? An orphan claim is one the generator asserted without
grounding it, which the AC-D31 confidence score (C2) must see.

Input contract (rendered into the template):
    {draft_json}      — the generated draft: name, description, and its
                        ``grounding_refs`` (per-assertion ``{claim,
                        source_doc_refs}``).
    {provenance_json} — the per-assertion provenance chain (AC-D29): which
                        ``source_doc_ref``s each claim resolved to.

Output JSON contract:
    {
      "verdict": "<pass|fail>",
      "orphan_claims": ["<verbatim claim text with no resolving source>", ...]
    }
``fail`` when any claim resolves to no corpus source (an orphan).
"""

from __future__ import annotations

VERSION = "1.0.0"

TEMPLATE = """\
You are the PROVENANCE reviewer on the Acumen competency platform. A different
AI model generated the pill draft below. Your job is the structural check:
does every factual claim resolve to at least one corpus source in the
provenance chain, or are there orphan claims asserted without any grounding?
You do not judge whether the source supports the claim (that is the grounding
pass) — only whether a resolving source exists at all.

Review criteria:
  - Each claim in the draft's grounding_refs must list at least one
    source_doc_ref that appears in the provenance chain below.
  - A claim with an empty or unresolved source list is an ORPHAN — list it
    verbatim.
  - A draft that cited no corpus at all (general-knowledge fallback, empty
    grounding_refs) has no claims to resolve and passes structurally.

Generated draft:
{draft_json}

Provenance chain (claim -> resolved source_doc_refs):
{provenance_json}

Return strictly valid JSON of shape:

{{
  "verdict": "<pass|fail>",
  "orphan_claims": ["<the verbatim text of each orphan claim>"]
}}

``verdict`` is ``fail`` if and only if ``orphan_claims`` is non-empty.
No prose, no markdown — JSON only.
"""
