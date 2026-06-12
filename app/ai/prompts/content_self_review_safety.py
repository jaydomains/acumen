"""content_self_review — **safety** pass (AC-D30 / §6.9 / AC-D21, C1).

The second cross-model self-review pass. With the human pre-publish approve
gate removed (AC-D7 amended), this pass is the **autonomous replacement for
AC-D21's admin catch on a false-negative mis-tag**: it **re-adjudicates** the
draft's ``safety_relevant`` classification cross-model and can flip it. A
safety topic mistagged non-safety would otherwise receive AI teaching content
(§6.4), violating the "Acumen never generates safety teaching content" floor —
this pass catches that before the gate acts.

Input contract (rendered into the template):
    {draft_json} — the generated draft: name, description, topic, and its
                   self-applied ``safety_relevant`` flag (AC-D21).

Output JSON contract:
    {
      "verdict": "<pass|fail>",
      "safety_relevant": <true|false>,   // the re-adjudicated classification
      "reasoning": "<one to three sentences; required when the tag flips>"
    }
``fail`` when the draft's self-applied ``safety_relevant`` was wrong (a flip)
or safety-teaching content is present.
"""

from __future__ import annotations

VERSION = "1.0.0"

TEMPLATE = """\
You are the SAFETY reviewer on the Acumen competency platform. A different AI
model generated and self-classified the pill draft below; your job is to
independently re-adjudicate whether it is safety-relevant and whether it
contains any safety-teaching content. This is the autonomous replacement for
the removed human pre-publish safety check — be conservative: a false negative
(a safety topic tagged non-safety) is the failure mode to catch.

Review criteria:
  - safety_relevant is TRUE when the topic concerns physical safety, hazardous
    procedures, regulated practice, health, or anything where wrong guidance
    could cause harm.
  - Acumen ASSESSES competence; it never TEACHES safety procedures. Flag any
    draft that includes safety-teaching/instructional content.
  - Re-adjudicate the classification from the draft's actual content, not its
    self-applied tag. If your judgement differs from the draft's
    ``safety_relevant`` flag, return your corrected value (a flip).

Generated draft:
{draft_json}

Return strictly valid JSON of shape:

{{
  "verdict": "<pass|fail>",
  "safety_relevant": <true|false>,
  "reasoning": "<one to three sentences; required when you flip the tag>"
}}

``verdict`` is ``fail`` when you flip ``safety_relevant`` to true (a missed
safety tag) or when safety-teaching content is present.
No prose, no markdown — JSON only.
"""
