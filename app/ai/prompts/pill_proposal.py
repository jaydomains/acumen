"""Pill proposal prompt — SPEC §6.5, AC-D7 / AC-D21 / AC-CD8.

Proposes a new pill from a catalogue gap signal: a name + description an
admin (or a discovery search) surfaced. Output is queued on
``processing_tasks`` (AC-CD7) for admin approve / reject; the proposing
AI's self-classification on ``safety_relevant`` per AC-D21 is captured
in the payload.

Output JSON contract:
    {"name": str, "description": str, "subject_id": str-uuid|null,
     "available_difficulty_min": int 1-10,
     "available_difficulty_max": int 1-10,
     "estimated_minutes": int|null,
     "safety_relevant": bool,
     "rationale": str}
"""

from __future__ import annotations

VERSION = "1.0.0"

TEMPLATE = """\
You are evaluating a proposed addition to the Acumen pill catalogue.
Pills are competency atoms — a single skill or knowledge area an admin
or AI can assess and target.

Proposed name: {name}
Proposed description: {description}
Parent subject: {subject_id}
Suggested difficulty range (min - max, 1-10): \
{available_difficulty_min}-{available_difficulty_max}
Estimated time to assess (minutes, optional): {estimated_minutes}

Evaluate fit, clarity, and safety relevance. A pill is safety-relevant
when it covers a hazard, regulated activity, PPE / lockout-tagout /
confined-space / high-voltage / hot-work / electrical / fall protection,
or any topic where a knowledge gap could cause physical harm.

Return strictly valid JSON of shape:

{{
  "name": "<final pill name>",
  "description": "<final pill description, one to two sentences>",
  "subject_id": "<the subject_id passed in or null>",
  "available_difficulty_min": <int 1-10>,
  "available_difficulty_max": <int 1-10>,
  "estimated_minutes": <int or null>,
  "safety_relevant": <true|false>,
  "rationale": "<one to two sentences: why this is a useful pill and \
why the safety classification holds>"
}}

No prose, no markdown — JSON only.
"""
