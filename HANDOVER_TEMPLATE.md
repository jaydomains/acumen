# Handover — <PR identifier>

> Copy this template to `handovers/<PR-id>-<slug>.md` at PR close and fill
> every section. Handovers are **immutable** once written, except where
> business confidentiality, privacy, or legal requirements compel an update.
> If an update is compelled, note what changed, why, and under which
> requirement.

## PR identifier and link

- PR: <number / title>
- Link: <url>
- Author / session: <who or which Claude Code session>
- Date closed: <YYYY-MM-DD>

## Phase reference

- ROADMAP phase closed by this PR: <phase id and name>
- Does this PR fully close the phase? <yes / partial — explain>

## What was built

- Files added: <paths>
- Files changed: <paths>
- Files removed: <paths>
- Summary of the change in 2–4 sentences.

## What was decided in this PR

- Decisions made, each with its anchor reference in `DECISIONS.md`
  (`AC-D-###` for product/design decisions, `AC-CD-###` for code/technical
  decisions).
- New anchors introduced by this PR: <list, or "none">
- Existing anchors this PR depends on: <list>

## Drift flags raised and how they were resolved

- Drift between spec and implementation that surfaced during this PR.
- For each: what drifted, why, and the resolution (spec corrected,
  implementation corrected, or deferred with a tracked open question).

## Open questions deferred to a later phase

- Questions intentionally not answered in this PR, with the phase or
  condition under which they should be revisited.

## Build state vs spec

- Complete: <what is fully implemented and matches spec>
- Partial: <what is started but incomplete, and what remains>
- Stubbed: <what exists only as a placeholder / interface / mock>

## Test coverage and CI results

- Tests added / changed: <paths and scope>
- Coverage delta or current coverage: <summary>
- CI result at merge: <pass / fail-with-known-reason>
- Manual verification performed: <what was checked by hand, if any>

## Post-merge validation considerations

- Does this PR touch code that runs inside a container without a source
  bind mount? If yes, post-merge local validation requires `docker
  compose build --no-cache <service>` before re-running.
- What's the specific local command sequence that re-verifies this PR's
  fix end-to-end? Document it here so a future debug session doesn't
  waste cycles on stale-image masks.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading beyond `SESSION_START.md`, if any.
- Environment / setup notes.
- Known traps, gotchas, or in-progress work that is easy to misread.
- Recommended next action.
