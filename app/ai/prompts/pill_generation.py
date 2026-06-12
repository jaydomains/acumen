"""Pill generation prompt — autonomous content generation (AC-D29 / §6.8 / AC-CD8).

The **generator** of the autonomous pipeline (distinct from the
``pill_proposal`` refiner, which polishes a single admin-supplied draft):
given a *topic* and a target count, it proposes **N** new pill drafts to
fill a catalogue gap. The gap-detection sweep (D3) and the generation
fan-out (B2/B3) call it.

**v1.0.0 — core topic→N schema only.** Corpus grounding + the per-draft
provenance chain (``grounding_refs``) land at Slice B2, which bumps this
registry entry to **v1.1.0** per the G7b version-trajectory ruling (the
persisted ``prompt_version`` then records which output contract produced
each draft). They are intentionally **absent** here — landing fields B1
cannot populate would violate doc-hygiene.

Output JSON contract (v1.0.0):
    {"drafts": [
       {"name": str, "description": str, "subject_id": str-uuid|null,
        "available_difficulty_min": int 1-10,
        "available_difficulty_max": int 1-10,
        "estimated_minutes": int|null, "safety_relevant": bool,
        "rationale": str, "evidence_count": int, "gap_signal": str}
    ]}
"""

from __future__ import annotations

VERSION = "1.0.0"

TEMPLATE = """\
You are autonomously generating new entries for the Acumen pill catalogue.
Pills are competency atoms — a single skill or knowledge area that can be
assessed and targeted. You are filling a coverage gap for a topic.

Topic: {topic}
Parent subject: {subject_id}
Number of distinct pill drafts to propose: {target_count}
Available difficulty range for the drafts (min - max, 1-10): \
{available_difficulty_min}-{available_difficulty_max}

Propose {target_count} DISTINCT, non-overlapping pill drafts that together
give useful coverage of the topic. Each draft is a single competency atom,
not a broad theme. A draft is safety-relevant when it covers a hazard,
regulated activity, PPE / lockout-tagout / confined-space / high-voltage /
hot-work / electrical / fall protection, or any topic where a knowledge gap
could cause physical harm.

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
      "gap_signal": "<short tag for the coverage gap this fills>"
    }}
  ]
}}

No prose, no markdown — JSON only.
"""
