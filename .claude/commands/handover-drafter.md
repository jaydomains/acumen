---
description: Draft a 9-section PR handover from git diff + plan + prior handover + Gitar
argument-hint: <pr-number> <slug>
---

Spawn the `handover-drafter` subagent via the Agent tool with `subagent_type: "handover-drafter"`. Pass PR number `$1` and slug `$2` as inputs. If a drift-sweep ran earlier in this session and its output is in conversation, pass the reference along. After the agent returns, surface the draft handover to me unmodified — do not filter or summarise. I will review, edit section 9 traps, and commit the file under `handovers/`.
