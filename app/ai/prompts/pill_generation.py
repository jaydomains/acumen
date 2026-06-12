"""Pill generation prompt — autonomous content generation (AC-D29 / §6.8 / AC-CD8).

The **generator** of the autonomous pipeline (distinct from the
``pill_proposal`` refiner, which polishes a single admin-supplied draft):
given a *topic* and a target count, it proposes **N** new pill drafts to
fill a catalogue gap. The gap-detection sweep (D3) and the generation
fan-out (B2/B3) call it.

**v1.1.0 — corpus-grounded + per-assertion provenance (B2, G7b).** Each
draft grounds its claims in the retrieved reference-corpus context and
emits, per draft, a **structured** ``grounding_refs`` — a list of
``{claim, source_doc_refs}`` pairing each factual assertion with the
corpus ``source_doc_ref``s that ground it (per AC-D29 / NS-3 per-assertion;
ratified Option-1, this conversation 2026-06-12). ``generate_grounded_drafts``
(B2) consumes this to write one ``GenerationProvenance`` row per (assertion,
grounding-chunk) — the relational store the E2 per-source rollback queries
by ``source_host`` (claim-precise retraction). v1.0.0 (B1) shipped the core
topic→N schema without grounding.

Output JSON contract (v1.1.0):
    {"drafts": [
       {"name": str, "description": str, "subject_id": str-uuid|null,
        "available_difficulty_min": int 1-10,
        "available_difficulty_max": int 1-10,
        "estimated_minutes": int|null, "safety_relevant": bool,
        "rationale": str, "evidence_count": int, "gap_signal": str,
        "grounding_refs": [
            {"claim": str, "source_doc_refs": [str]}
        ]}
    ]}
"""

from __future__ import annotations

VERSION = "1.1.0"

TEMPLATE = """\
You are autonomously generating new entries for the Acumen pill catalogue.
Pills are competency atoms — a single skill or knowledge area that can be
assessed and targeted. You are filling a coverage gap for a topic.

Topic: {topic}
Parent subject: {subject_id}
Number of distinct pill drafts to propose: {target_count}
Available difficulty range for the drafts (min - max, 1-10): \
{available_difficulty_min}-{available_difficulty_max}

Reference-corpus context for this topic (authoritative allowlisted
sources, each tagged with its authority tier T1>T2>T3; may be empty):
{corpus_context}

Propose {target_count} DISTINCT, non-overlapping pill drafts that together
give useful coverage of the topic. Each draft is a single competency atom,
not a broad theme. A draft is safety-relevant when it covers a hazard,
regulated activity, PPE / lockout-tagout / confined-space / high-voltage /
hot-work / electrical / fall protection, or any topic where a knowledge gap
could cause physical harm.

GROUND every factual claim in the cited corpus context above — do not
invent facts beyond it; if the context is empty, fall back to general
domain knowledge. For each draft, in ``grounding_refs`` list each distinct
factual ASSERTION the draft makes alongside the corpus ``source_doc_ref``s
that ground that specific assertion (prefer higher-authority tiers).

Return strictly valid JSON of shape:

{{
  "drafts": [
    {{
      "name": "<pill name>",
      "description": "<one to two sentences>",
      "subject_id": "<the subject_id passed in or null>",
      "available_difficulty_min": <int 1-10>,
      "available_difficulty_max": <int 1-10>,
      "estimated_minutes": <int or null>,
      "safety_relevant": <true|false>,
      "rationale": "<why this pill is useful and why the safety \
classification holds>",
      "evidence_count": <int: how many distinct supporting points you used>,
      "gap_signal": "<short tag for the coverage gap this fills>",
      "grounding_refs": [
        {{
          "claim": "<one factual assertion this draft makes>",
          "source_doc_refs": ["<corpus source_doc_ref grounding it>"]
        }}
      ]
    }}
  ]
}}

No prose, no markdown — JSON only.
"""
