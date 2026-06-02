# Handover — PR-088 Slice 1: wire HeroStats to live competence + derived day streak

> Testee FE completion workstream, PR 1 of 5 (Slice 1). Authored after the
> merge of #88 on the following slice's branch (trailing-handover model — each
> slice PR carries the prior slice's handover; the final PR carries the last
> two + the workstream summary). Merge SHA `016561b`.

## PR identifier and link

- PR: #88 — `Slice 1 — wire HeroStats to live competence + derived day streak`
- Link: https://github.com/jaydomains/acumen/pull/88
- Author / session: Claude Code (`claude/testee-fe-s1-herostats`)
- Date closed: 2026-06-02 (squash-merged on verified three-layer-green; no user
  authorization required for intermediate slices per the workstream opener)

## Phase reference

- ROADMAP phase: **none** — post-roadmap testee-FE completion pass (Tier A).
  Slice 1 of the 5-slice workstream (`plans/2026-06-01-testee-fe-completion.md`
  + the detail plan). Closes smoke-test issue #1 (dashboard hero placeholders).
- Fully closes Slice 1; does not close the workstream.

## What was built

- Files added: `frontend/src/lib/competence/derive-streak.ts`,
  `frontend/tests/lib/competence/derive-streak.test.ts`.
- Files changed: `frontend/src/components/dashboard/HeroStats.tsx`,
  `frontend/src/app/(authed)/(testee)/page.tsx`,
  `frontend/tests/components/dashboard/HeroStats.test.tsx`,
  `frontend/tests/pages/dashboard.test.tsx`.
- Files removed: none.
- Summary: `HeroStats` became a **container** that owns `useMeCompetence()` +
  `useMeAttemptsCapped()` and derives overall competence (mean, 1dp), assessed
  `pillCount`, `workingPlusCount` (band ∈ working/advanced/expert), and a
  client-derived `streakDays` internally, replacing the stale `"—"` /
  `"v1.x · pending"` placeholders. Props stay `{ displayName, dateLabel }` (the
  `page.tsx` call site is unchanged). A new pure helper derives a
  consecutive-UTC-day streak from `/v1/attempts`.

## What was decided in this PR

- **DEC-S1-A — HeroStats is a CONTAINER** (per the spec author's F3 ruling,
  PR #85 comment `4596639182`): owns its hooks, no data props. The D5 FE-3
  amendment (PR #86) had already reconciled the spec to this shape.
- **DEC-S1-B — day-streak semantics:** consecutive UTC days walking back from an
  anchor that is today (UTC) if present, else yesterday (one-day grace), else 0.
- **DEC-S1-C — "PILLS AT WORKING+" renders `{workingPlusCount}/{pillCount}`** (e.g.
  `5/6`), prototype-faithful.
- **DEC-S1-D — dropped the `summary?` line** (week-over-week delta is not derivable
  on the v1 wire); the stale subtitle `<p>` was deleted, not replaced.
- **DEC-S1-E — kept the prop named `displayName`** (zero churn on the greeting path).
- **DEC-S1-F / F2 — empty ≠ error per query:** empty competence → `"—"` /
  "No attempts yet" / `"0/0"`; competence error → `"—"` / "Unavailable" / `"—"`;
  attempts error → streak `"—"` (never `"0"`). A fetch failure never masquerades
  as a true empty/zero state.
- New anchors: none (DECISIONS unchanged). Depends on AC-D9 (competence),
  AC-D20 (bands), AC-CD21 (query-key/hook routing), LOCK-2 (null-exclusion).

## Drift flags raised and how they were resolved

- The D5 FE-3 spec drift (competence described as "unmounted") was already
  corrected by PR #86 before this slice executed — gate cleared, no mid-slice
  drift surfaced. No new drift found between the detail plan and `main`.

## Open questions deferred to a later phase

- **DEC-S3-C (carry-forward):** `meQueryKeys.attempts()` is never invalidated on
  submit, so the hero day-streak (and `/profile`, `/history`) can read a stale
  attempts list for up to `staleTime: 30s` after a submit. Minor, self-healing;
  deferred out-of-scope (touches the runner). Not reopened by this slice.
- **FE-3 `:231` / §E item 7 (carry-forward):** the catalogue `PillCard` per-Testee
  competence overlay is still stale-vs-code (endpoint live, overlay unwired) — a
  different surface; parked for separate triage.

## Build state vs spec

- Complete: dashboard hero renders live overall competence (1dp), pills-at-
  working+ (`X/Y`), and day streak; honest empty + error states; no
  `"v1.x · pending"` copy remains in `HeroStats.tsx`; the false `page.tsx`
  "endpoints unmounted/absent" docstring is gone.
- Partial / Stubbed: none.

## Test coverage and CI results

- Tests added/changed: `HeroStats.test.tsx` rewritten as a container test
  (greeting, live 1dp overall, working+, streak, empty-not-pending,
  error-not-empty, streak-error-not-zero, loading-skeleton, request-fires);
  new `derive-streak.test.ts` (9 edge cases); `dashboard.test.tsx` hero
  assertions rewritten to the live path + stale "no request fires" header
  invariant corrected.
- Coverage: additive (live-path assertions, not weakened stubs); the new helper
  is unit-covered.
- CI at merge: **all 11 checks success** (unit `checks`, `docker-build`,
  `migration-chain`, two `e2e`, Gitar) + Gitar code review **approved**;
  `mergeable_state: clean`. One fix-round: Prettier `format:check` flagged
  line-wrapping (formatting-only), fixed in commit 2.
- Manual verification: local `pnpm typecheck` / `lint` / `format:check` /
  `test --run` (974 tests) all green before push.

## Post-merge validation considerations

- Container-baked without source bind-mount? The `frontend` image bakes source,
  but this PR is FE-only TS/TSX with no dependency or config change, so no
  `--no-cache` rebuild concern beyond a normal frontend image build.
- Re-verify locally: `cd frontend && pnpm install && pnpm typecheck && pnpm test
  --run tests/components/dashboard/HeroStats.test.tsx tests/pages/dashboard.test.tsx
  tests/lib/competence/derive-streak.test.ts`.

## Anything a fresh Claude Code session needs to pick up cleanly

- **Pre-push gate must include `pnpm format:check`** (separate from `pnpm lint` /
  ESLint) — CI runs Prettier `--check` and it caught this slice. `pnpm lint`
  alone is insufficient.
- **`HeroStats` is now a container** — any renderer must sit under a
  `QueryClientProvider` (only call site is the dashboard `page.tsx`, already
  under app providers).
- **`derive-streak.ts` inlines its own UTC-day floor** — it deliberately does NOT
  import `daysSinceUtcEpoch` from `data/readings.tsx`, which Slice 2 deletes.
- Recommended next action: Slice 2 (remove Today's Reading — PR #89) then Slice 3
  (dead-nav), per the S1→S2→S4 page.tsx serialization + S3-independent graph.
