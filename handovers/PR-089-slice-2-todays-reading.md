# Handover — PR-089 Slice 2: remove Today's Reading widget

> Testee FE completion workstream, PR 2 of 5 (Slice 2). Authored after the
> merge of #89 on the following slice's branch (trailing-handover model).
> Merge SHA `112ab76`.

## PR identifier and link

- PR: #89 — `Slice 2 — remove Today's Reading widget`
- Link: https://github.com/jaydomains/acumen/pull/89
- Author / session: Claude Code (`claude/testee-fe-s2-todays-reading`)
- Date closed: 2026-06-02 (squash-merged on verified three-layer-green;
  intermediate slice — no user authorization required)

## Phase reference

- ROADMAP phase: **none** — post-roadmap testee-FE completion (Tier A), Slice 2
  of 5. Closes smoke-test issue #2 (fabricated-editorial dashboard widget).
- Fully closes Slice 2; does not close the workstream.

## What was built

- Files added: none.
- Files changed: `frontend/src/app/(authed)/(testee)/page.tsx` (removed import +
  mount), `frontend/tests/pages/dashboard.test.tsx` (card-presence test).
- Files removed: `frontend/src/components/dashboard/TodaysReading.tsx`,
  `frontend/src/data/readings.tsx`, `frontend/tests/data/readings.test.ts`.
- Summary: removed the `Today's Reading` widget — a 3-entry hardcoded
  horoscope-style array that asserted *false* competence facts ("slipped half a
  band", "expert band, 71 attempts") as live data on the primary surface. Clean
  removal per ruling D2 (option a); the only reusable logic (the UTC-day-math
  primitive) is now covered by Slice 1's `derive-streak.test.ts`.

## What was decided in this PR

- **D2 = remove** (on-record ruling `4596569727`): relabeling (option b) still
  ships fabricated competence on the primary surface, so a clean removal was
  taken, not a reframe.
- **Vertical rhythm preserved by construction:** the hero's `mb-8` (32px) already
  supplies the hero→grid gap (> the removed card's `my-6` 24px), so the deletion
  needed no spacing addition / re-layout.
- **Test ordering (S2-1):** the negative `queryByTestId("todays-reading")` follows
  an awaited `findByTestId("assignments-card")` barrier so it can't pass vacuously
  pre-paint.
- New anchors: none. The widget was **Not anchored** (FE-3 §E), so no DECISIONS AC
  retires. The D5 FE-3 amendment (#86) had already struck the Today's-Reading spec
  references (cumulative scope).

## Drift flags raised and how they were resolved

- None new. The FE-3 spec text describing the widget was already removed by the
  D5 amendment PR (#86) before this slice executed.

## Open questions deferred to a later phase

- None specific to this slice. (Stale e2e mock-setup comment in
  `e2e/shell-responsive.spec.ts:37` — "only `/v1/attempts` is live" — is now
  inaccurate but is a Playwright mock comment outside this workstream's
  detail-planned drift-sweep scope; noted, not touched.)

## Build state vs spec

- Complete: the dashboard renders no `todays-reading` widget and no fabricated
  competence copy; the three source/test files are gone; repo-wide grep for
  `TodaysReading` / `pickReading` / `READINGS` / `@/data/readings` /
  `daysSinceUtcEpoch` returns only `design-reference/` hits.
- Partial / Stubbed: none.

## Test coverage and CI results

- Tests changed: `dashboard.test.tsx` card-presence test renamed + negative
  assertion added; `tests/data/readings.test.ts` deleted (subject removed).
- Coverage: no live behavior loses coverage (UTC-day-math primitive covered by
  `derive-streak.test.ts`).
- CI at merge: all 11 checks **success** + Gitar code review **approved**;
  `mergeable_state: clean`. No fix-rounds.
- Manual verification: local `typecheck` / `lint` / `format:check` / `test --run`
  (131 files / 953 tests) green; full suite re-verified after rebase onto S1.

## Post-merge validation considerations

- FE-only deletion; no dependency/config change. Re-verify locally: `cd frontend
  && pnpm install && pnpm test --run tests/pages/dashboard.test.tsx` and a grep
  that the deleted modules have no importers.

## Anything a fresh Claude Code session needs to pick up cleanly

- **Pre-push gate includes `pnpm format:check`** (Prettier `--check`, separate
  from ESLint) — established in Slice 1.
- The S1→S2→S4 `page.tsx` / `dashboard.test.tsx` serialization held: S2's edits
  were line-disjoint from S1's, so the rebase onto S1-merged main auto-resolved.
- Recommended next action: Slice 4 (remove dashboard `AdaptiveLoopCard` — the last
  of the page.tsx chain) and Slice 3 (dead-nav, independent) are both unblocked;
  Slice 5 (hygiene) trails S1.
