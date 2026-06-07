# Plan — Install the multi-party plan-review framework into Acumen

**Status: draft — under multi-party review (planner authored)**

Role: this is the **planner's** plan artifact for the recursive self-install of the three-party
plan-review framework (planner · plan-auditor · plan-overseer). It is reviewed by an independent
**plan-auditor** (content correctness) and **plan-overseer** (workflow-governance correctness) per
`.claude/roles/*.md`, and bound to Acumen by `plans/REQUIRED_READING.md`.

## Context / why

`jaydomains/acumen` lacks the plan-review framework that `jaydomains/throughline` runs. This PR
ports it — and installs it **through its own pattern** (recursive validation): the planner authors
the install as a draft PR and hardens it through the auditor/overseer loop the framework defines.
This is the framework's **first proof-run installing itself**.

Design intent: the three role prompts travel **byte-unchanged** between repos; everything
project-specific is read from one addressing layer, `REQUIRED_READING.md`. So: blind-port the role
+ skill files byte-identical (never edited), author the one Acumen binding file, and route every
project divergence into `REQUIRED_READING.md` — never into the role files.

Per role files §8.3, opening this PR is a **class-(iv) ratification event** (durable
project-level precedent — the framework itself); it does **not** auto-merge and requires
**explicit, authenticated spec-author ratification** before the overseer executes.

## What this PR adds

- `.claude/roles/planner.md`, `plan-auditor.md`, `plan-overseer.md` — **byte-identical** ports
  (verified via `diff` + `sha256sum`).
- `.claude/skills/counterpart-change-detector/` — `SKILL.md`, `reference/operating-guide.md`,
  `scripts/watch-counterpart.sh` (`0755`) — **byte-identical** ports.
- `plans/REQUIRED_READING.md` — **authored**: binds the role files' project parameters to Acumen.
- `plans/2026-06-07-install-plan-review-framework.md` — this plan doc.
- `plans/.wake-log-pr<N>-planner.md` — the planner wake-log (baseline + per-revision lines).

Out of scope: the execution-trio and audit-trio role files; any `SESSION_START.md` edit; flipping
draft→ready or merging (the overseer's actions).

## Provenance — byte-identical port (re-verification record) [folds A-7]

The transportable-role-files design rests on the ports being byte-identical to upstream. Recorded
here so any later session can re-verify without trusting prose:

- **Source repo / ref:** `jaydomains/throughline` @ commit `7d0a2521133e7054f3827fbb347cb5fa06511cfa`.
- **Source → destination paths** (identical relative paths under `.claude/`): `roles/planner.md`,
  `roles/plan-auditor.md`, `roles/plan-overseer.md`,
  `skills/counterpart-change-detector/SKILL.md`,
  `skills/counterpart-change-detector/reference/operating-guide.md`,
  `skills/counterpart-change-detector/scripts/watch-counterpart.sh` (mode `0755`).
- **SHA-256 (full) — acumen == throughline @ source ref, all MATCH:**

  | sha256 | file |
  |---|---|
  | `fde7eb337442051a61d59f12632b70a4a30d4cdd4eb256dfb97700059bff11fc` | `.claude/roles/planner.md` |
  | `6a9e1381fa826024a7e684ae8495abb875104176a5d8d3b8dac87fffd9463803` | `.claude/roles/plan-auditor.md` |
  | `c9a3e5bb647a713d8b707ed67f90a500d6b76958dd936e2ab1456e5269ba82f1` | `.claude/roles/plan-overseer.md` |
  | `c74df4f25115f933fe28dddf0e3343d12cae32520fa1f5d7c4f0699469bca9e2` | `.claude/skills/counterpart-change-detector/SKILL.md` |
  | `9a6bb1fcd9ea200fbd314a061f95dcbcefb263fef875883cb5e875b546aecbbe` | `.claude/skills/counterpart-change-detector/reference/operating-guide.md` |
  | `b118a4f95899e584167c6bb1e207e8732b27aa6defa886b8957c84df51790a37` | `.claude/skills/counterpart-change-detector/scripts/watch-counterpart.sh` |

  Re-verify: `sha256sum .claude/roles/*.md .claude/skills/counterpart-change-detector/SKILL.md
  .claude/skills/counterpart-change-detector/reference/operating-guide.md
  .claude/skills/counterpart-change-detector/scripts/watch-counterpart.sh`.

## Acumen audit pass (role files map cleanly; divergences → REQUIRED_READING, not role edits)

| # | Divergence | Routing |
|---|---|---|
| D1 | No separate authoring-discipline doc — folded into `SESSION_START.md`. | Binding §2 + surfaced **SA-1**. |
| D2 | Blessed halt-set vs `SESSION_START.md` build-chain pause rules (5/5 deadlock ≠ 3-round circuit-breaker; user-pause subsumed by spec-author halt). | Binding §5 layering note + surfaced **SA-2**. |
| D3 | Shared `plans/.wake-log-pr<N>-<role>.md` path vs §8 reviewer-markers-off-canonical-branch. | Binding §6: shared filename, role-specific branch. |
| D4 | Real multi-job CI; this PR is `.claude/**`+`plans/**` only — branch must stay green (structure-gate AC-CD2/AC-CD17 etc.). | Verify three-layer green gate post-push; bound in §7. |
| D5 | "green CI" → Acumen **three-layer green gate** (CI + Gitar + mergeable). | Binding §7 verification bar. |
| D6 | Skill files introduced by this PR → absent on `main` this loop. | Binding §8: **inline-replicate** the watcher this loop. |
| D7 | `.claude/` already has `agents/`+`commands/`; port adds `roles/`+`skills/`. | No conflict; clean landing. |

No halt-class condition was triggered: scope maps cleanly and the live tree matches the scope's
assumptions.

## Loop mechanics (role files §4–§8, inline-replicated skill per §8/D6)

- **Watcher (inline this loop):** two-arm `git ls-remote` poll. `SELF_EXCLUDE` = exact
  `claude/blissful-babbage-HatwU`; `WATCH_INCLUDE` = `plan-auditor|plan-overseer`; tight poll
  cadence; manual pre-existing-ref scan at arm time; proactive re-arm ~25 min.
- **Recommended reviewer branches:** `claude/plan-auditor-<token>`, `claude/plan-overseer-<token>`
  (distinct from the planner branch so the self-echo filter separates the parties).
- **On every wake:** `git ls-remote` + fetch + diff reviewer commits **and** read both reviewers'
  PR comments (watcher is comment-blind); verify each finding against the text, then fold or push
  back.
- **Each revision:** set-diff gate → commit → one wake-log line (per-thread `X/5`).
- **Final marker:** content-invariant `Status: final — approved by planner` commit + approval
  comment, bound to the SHA.
- **Convergence:** three markers at one SHA + three-layer green gate → **24h override window**
  (collapses to zero if the spec author is present) → overseer flips draft→ready + squash-merges,
  **after** explicit spec-author ratification (class iv).
- The planner stays subscribed through merge as the standing re-initiator; dormancy bound 2 watcher
  lifetimes (~1h); stand down only on merge (verified via `git ls-remote`).

## Open (surfaced, non-blocking)

- **SA-1** — extract a standalone `AUTHORING_DISCIPLINE.md`, or keep folded into `SESSION_START.md`?
- **SA-2** — reconcile the plan-review halt classes with the build-chain pause rules into one
  taxonomy?
