# Handover — PR-076 Slice 4: MCQ "mark correct" form-wipe (A2-H2)

> Pre-deploy fix workstream, PR 5 of 8 (Slice 4). Authored post-merge per the
> pipelined cadence; rides on the PR-6 (Slice 5) branch.

## PR identifier and link

- PR: #76 — `fix(fe-8): preserve typed MCQ choice text when marking a choice correct (Slice 4 / A2-H2)`
- Link: https://github.com/jaydomains/acumen/pull/76
- Author / session: Claude Code (`claude/pre-deploy-pr5-s4-mcq-form-wipe`)
- Date closed: 2026-05-31 (squash-merged `6f031cb`)

## Phase reference

- ROADMAP phase: **none** — pre-deploy Slice 4 (audit-5 §4 #4, the last of
  the locked-order fix-now items 1–4). Closes A2-H2 + X2-#2.
- Fully closes the fix-now item.

## What was built

- Files changed:
  `frontend/src/app/(authed)/(admin)/admin/tests/[testId]/edit/_components/mcq-choices.tsx`
  (the fix), `…/question-editor-inner.tsx` (threads `form.getValues`),
  `frontend/tests/pages/admin-question-editor.test.tsx` (X2-#2 test).
- Summary: `MCQChoices.setCorrect()` looped `update(i, {...fields[i], correct})`
  over the `useFieldArray` `fields` **snapshot**. The choice text input is
  uncontrolled (`register`ed), so the snapshot carries stale/empty text —
  writing it back clobbered the admin's un-committed choice text on every
  "mark correct" click (A2-H2). The fix reads the **live** values via
  `form.getValues("config.choices")` before writing back, so only the
  `.correct` flag flips and typed text is preserved.

## What was decided in this PR

- **Live-values over snapshot.** Chose `getValues` (the plan's offered
  option) over a `useWatch`/`setValue` rewrite — minimal surface, keeps the
  existing `update`-driven radio re-render. `form.getValues` is a new
  required prop on `MCQChoices`.
- New anchors: none. No spec edits.

## Drift flags raised and how they were resolved

- None. Straight bug fix; no spec drift.

## Open questions deferred to a later phase

- None specific to this slice. (Same `mcq-choices.tsx` area as Slice 5's
  editor work, per audit-5 §4 #4 — Slice 5 touches the compose/unpack layer,
  not this component.)

## Build state vs spec

- Complete: typed text survives the mark-correct click; X2-#2 asserts the
  inputs retain text and the text reaches the composed payload.
- Partial / Stubbed: none.

## Test coverage and CI results

- Tests: extends `admin-question-editor.test.tsx` (+1) — assertion is
  compose-agnostic (`JSON.stringify(config).includes(...)`) so it stays green
  across the Slice 5 `{body,choices}`→`{prompt,options}` change.
- CI at merge: **all green** — verify-poll on head `5c0e935` showed 11/11
  `completed/success` (Gitar approved + check-run, `checks`,
  `migration-chain`, `docker-build`, `e2e`), `mergeable_state: clean`.
- Manual: local `pnpm lint`/`format:check`/`codegen:check`/`typecheck`/
  `test --run` (947)/`build`.

## Post-merge validation considerations

- Container-baked without source bind-mount? **Yes** (`frontend` image).
  Local re-validation requires `docker compose build --no-cache frontend`.
- Re-verify: `cd frontend && pnpm test --run tests/pages/admin-question-editor.test.tsx`.

## Anything a fresh Claude Code session needs to pick up cleanly

- Known trap: any react-hook-form field-array "set one sibling field" helper
  must read **live** values (`getValues`) — never the `fields` snapshot — when
  the array's other inputs are uncontrolled (`register`ed), or it clobbers
  un-committed input. This was the A2-H2 root cause.
- Recommended next action: **PR 6 / Slice 5 (question-config reconciliation)**
  — this branch (already committed). Unblocked by the §H(a) amendment (#72)
  on main.
