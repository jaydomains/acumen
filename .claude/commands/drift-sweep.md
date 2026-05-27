---
description: Pre-build drift sweep for the named phase
argument-hint: <phase-id e.g. FE-5 or P12>
---

Spawn the `drift-sweep` subagent via the Agent tool with `subagent_type: "drift-sweep"`. Pass the phase identifier `$ARGUMENTS` as the only input in the spawning prompt — do not enumerate items to check, the agent's system prompt deliberately disallows pre-loaded checklists (reviewer-mode rule). After the agent returns, surface the findings list to me unmodified — do not filter or summarise. The findings feed the plan-mode AskUserQuestion that locks resolutions before code lands.
