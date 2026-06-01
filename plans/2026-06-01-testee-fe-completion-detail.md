# Testee FE completion — granular detail-plan (Slices 1–5)

**Date:** 2026-06-01
**Branch:** `claude/testee-fe-completion-plan-51fvj` (this detail-plan PR).
**Authoritative source:** the merged workstream plan
`plans/2026-06-01-testee-fe-completion.md` (PR #84, squashed at `682fbd0`),
Decisions D1–D7 **ruled** by the spec author:

- **D1 = Tier A** (honest surface; zero new backend). Slices 1–5 only.
- **D2 = remove** Today's Reading.
- **D3 = remove In-Progress, redirect Latest Result** (nav model approved).
- **D4 = remove** dashboard `AdaptiveLoopCard`.
- **D5 = standalone FE-3 spec-amendment PR** (gates Slice 1 execution).
- **D6 = zero new backend** for Tier A.
- **D7 = handover note, not a heavyweight anchor** (nav-model anchor optional).

> **What this document is.** A slice-iterative detail-plan. The workstream
> plan converged the *structure* (slice identities, scope, dependency graph)
> and ruled the decisions; this document spends the token budget **now** so
> the executing session implements each slice without re-discovering files,
> edge cases, or gotchas. Every "current behavior" claim is read from `main`
> at authoring time; citations are `file:line`. Tier B (Slices 6–7) is
> out of scope and not detailed.

> **Workflow.** This is a **slice-iterative** plan: each slice's detail
> section is reviewed and approved (planner + auditor) before the next slice
> is pushed. All five slices land in this one PR, appended commit-by-commit
> to this file. Per-slice `Status: final` lines accumulate as each converges;
> the global `Status: final — approved by planner (all slices)` line lands at
> the bottom only after Slice 5 is sealed.

**Slices in scope (detail-planned here):**

1. Wire `HeroStats` to live competence + derived day streak — **spec-gated on D5**.
2. Today's Reading disposition — remove path.
3. Dead-nav resolution — remove In-Progress, redirect Latest Result — **spec-gated on D3 FE-2-shell amendment**.
4. Dashboard `AdaptiveLoopCard` disposition — remove path.
5. Drift-comment + dead-code hygiene.

**Execution sequencing (from the workstream plan §4, restated):**

- D5 FE-3 amendment must land on `main` before Slice 1 **execution** starts.
- D3 FE-2-shell amendment must land before Slice 3 **execution** starts.
- `page.tsx` slices serialize: **S1 → S2 → S4** (all three mutate the
  dashboard `page.tsx`; S2 + S4 both touch the right grid column). S3 is
  the only genuinely independent slice (depth-2 parallel OK). S5 edits
  `profile/page.tsx` + `history/page.tsx`, independent of the dashboard chain
  but trails S1 to reuse the stale-comment sweep context.
- **`dashboard.test.tsx` is mutated by S1, S2, and S4** — coordinate edits in
  rebase order; see each slice's Tests subsection and the cross-slice note at
  the end of Slice 4.

---

## Slice 1 — Wire HeroStats to live competence + derived day streak

**Spec-gate (execution):** BLOCKED until the **D5 FE-3 spec-amendment PR**
(doc-only, authored by the spec author) lands on `main`. This detail-plan is
written against the *amendment direction*, which is **forced by current code**
(competence is live and consumed; the FE-3 prop contract was never
implemented). The detail-planning itself is not gated; only execution waits.

**Implements:** dashboard hero stats render real data from the already-live
`GET /v1/me/competence` + `GET /v1/attempts`, replacing the stale `"—"` /
`"v1.x · pending"` placeholders (closes smoke-test issue #1).

### Grounding (verified against `main`)

- `HeroStats.tsx:17-20` — current props are `{ displayName: string; dateLabel:
  string }` only. No data props, no hooks.
- `HeroStats.tsx:4-9` — stale module comment: *"In v1 ALL stat values render
  as '—' … because the backend competence router is **unmounted**; we DO NOT
  construct the query."* **False against `main`.**
- `HeroStats.tsx:40-46` — three hardcoded `<Stat value="—" … hint="v1.x ·
  pending …" />`.
- `HeroStats.tsx:33-37` — a hardcoded subtitle `<p>`: *"Per-Testee competence,
  assignments, and recent attempts arrive once the backend `/v1/me/*`
  endpoints land …"* — **false** (the endpoints are live).
- `useMeCompetence()` at `me.ts:43-48` — live; returns
  `MeCompetenceResponse = { pills: MeCompetencePill[] }`. Per LOCK-2 the wire
  **excludes** `competence_estimate IS NULL` rows (`me.ts:38-41`,
  `competence.py:610`), so `pill.competence_estimate` is always a `number`.
- `useMeAttemptsCapped(limit=200)` at `me.ts:96-106` — live; returns
  `AttemptsPage = { data: AttemptListItem[]; meta }`.
- Wire shapes (`src/types/api.d.ts`):
  - `MeCompetencePill` (`:2665`): `pill_id`, `pill_name`, `subject_id`,
    `competence_estimate: number` (1.0–10.0 axis), `band:
    "novice"|"junior"|"working"|"advanced"|"expert"`, `n`, `confidence`,
    `last_activity_at`, `related_pill_ids`, `safety_relevant`.
  - `AttemptListItem` (`:1828`): `attempt_id`, `pill_id`, `pill_name`,
    `submitted_at: string` (date-time), `score_percent`, `band`, `origin`,
    `competence_delta?: number | null`.
- Band axis (`competence.py:550-565`): novice `[1,3)`, junior `[3,5)`,
  working `[5,7)`, advanced `[7,8.5)`, expert `[8.5,10]`. **"Working+"
  therefore = `competence_estimate ≥ 5`** = band ∈ {working, advanced, expert}.
- Band union + ordering lives at `components/primitives/bands.ts`
  (`BAND_PIP_LEVEL`: novice 1 … expert 5). Reuse it for the working+ test.
- Design reference (`design-reference/prototype/testee.jsx:77-101`): the
  prototype hero computes `competenceAvg = (Σcompetence/N).toFixed(1)` (1 dp,
  1–10 axis), `passedCount = PILLS.filter(p => p.competence >= 5).length`, and
  renders `Stat value={competenceAvg} label="OVERALL COMPETENCE" hint="across
  {N} pills"`, `Stat value="{passedCount}/{totalCount}" label="PILLS AT
  WORKING+"`, `Stat value="14" label="DAY STREAK" tone="accent"`. This confirms
  the display formats below.
- FE-3 spec prop contract (`FE-3-content.md:92`): `{ greeting, dateLabel,
  summary?, overallCompetence: number | null, pillCount: number | null,
  workingPlusCount: number | null, streakDays: number | null }` — **never
  implemented**; this is the contract D5 reconciles (see decisions below).
- FE-3 spec states (`:127-128`): "Hero loaded → overall competence (1 dp),
  pills-at-working+ count, day streak; 'across N pills' hint resolved." Day
  streak "derivable from `GET /v1/attempts` history" (`:111`).
- MSW: `meCompetenceHandler` (`handlers.ts:1044`) + `meAttemptsListHandler`
  (`handlers.ts:1147`) are **already registered** (FE-7). Default competence =
  `FE7_DEFAULT_PILLS` (6 pills, `handlers.ts:953-1026`); default attempts =
  `FE7_DEFAULT_ATTEMPTS` (5 rows, dates in 2026-05, `handlers.ts:1083-1129`).
  Setters: `setMockMeCompetence`, `setMockMeCompetenceStatus`,
  `resetMockMeCompetence`; `setMockMeAttempts`, `resetMockMeAttempts`.

### Decisions to surface to the spec author (do not silently resolve)

> These emerged from detailed code reading. The first three are **load-bearing
> for Slice 1 implementation** and several are D5-adjacent (the spec author
> should fold the resolution into the D5 amendment or rule by PR comment).
> Recommended option first.

- **DEC-S1-A — HeroStats container vs presentational (load-bearing).** The
  workstream plan's Slice-1 file list says HeroStats should *both* "adopt the
  spec prop contract (`:92`)" (which lists `overallCompetence`/`pillCount`/…
  as **data props**) *and* "call `useMeCompetence()` + `useMeAttemptsCapped()`"
  (which makes it a **container**). These are mutually exclusive; the spec
  prop contract and the workstream plan's own test direction ("the competence
  request **does** fire" from `HeroStats.test.tsx`) conflict.
  **Recommendation: HeroStats owns the hooks (container).** Rationale: the two
  sibling dashboard cards already own their hooks —
  `AssignmentsCard.tsx:117` calls `useMeAssignments()`,
  `RecentAttemptsCard` calls `useMeAttemptsCapped(5)` (FE-3 §B.1 §2). A
  container HeroStats is consistent with that established pattern and is what
  the test-pairing implies. **The D5 amendment should reconcile `:92` to drop
  the four data props** (`overallCompetence`/`pillCount`/`workingPlusCount`/
  `streakDays`) and keep only `{ displayName, dateLabel }` (+ the `summary?`
  ruling, DEC-S1-D). *If the spec author instead wants HeroStats presentational
  (props passed from `page.tsx`), that is a different `page.tsx` diff and a
  different test shape — flag before execution.*
- **DEC-S1-B — Day-streak semantics (load-bearing).** "Day streak" is
  undefined in the spec beyond "derivable from `/v1/attempts`" (`:111`); the
  prototype hardcodes `14`. The correctness traps (R3) are timezone,
  today-inclusivity, and gap handling. **Recommended definition (precise,
  testable):** *the streak is the count of consecutive UTC days, walking
  backward from an anchor day, on each of which the testee submitted ≥1
  attempt. The anchor is **today** (UTC) if today is in the set; else
  **yesterday** (UTC) if yesterday is in the set (one-day grace so a streak is
  not shown as broken before the testee has acted today); else the streak is
  **0**.* This matches common habit-streak UX and is fully pinned by the
  edge-case tests below. Surface for ruling; the helper + tests adopt whatever
  is ruled.
- **DEC-S1-C — "PILLS AT WORKING+" display format (minor).** The prototype
  renders `{passedCount}/{totalCount}` (e.g. `5/6`). The spec prop contract
  lists `workingPlusCount` and `pillCount` as *separate* values, which
  reconciles exactly to this `X/Y` rendering (workingPlus over assessed pills).
  **Recommendation: render `{workingPlusCount}/{pillCount}`** (design-faithful).
  Alternative: bare `workingPlusCount`. Flag lightly; defaulting to the
  prototype-faithful form.
- **DEC-S1-D — `summary?` disposition (D5 pin b).** Spec `:92` defines an
  optional `summary?`; the prototype subtitle is *"Your overall competence is
  up +0.3 this week"* (a week-over-week delta). **That delta is not derivable
  on the v1 wire** — `AttemptListItem.competence_delta` ships `null` (workstream
  plan §7 out-of-plan finding). **Recommendation: drop `summary?` for v1** and
  **delete** the stale `HeroStats.tsx:33-37` subtitle paragraph entirely (do
  not replace it with a fabricated "up +0.3" line). D5 amendment removes
  `summary?` from `:92` or marks it deferred.
- **DEC-S1-E — `greeting`/`displayName` reconcile (D5 pin a).** The component
  renders `Welcome back, {displayName}.` and the `page.tsx:44` call site +
  `dashboard.test.tsx` greeting assertions key off `displayName`.
  **Recommendation: keep the prop named `displayName`** (the name string); D5
  reconciles the spec's `greeting` token to `displayName` semantics. This keeps
  the `page.tsx` call site and the two greeting tests untouched (zero churn on
  the working greeting path).
- **DEC-S1-F — Empty/new-testee state (R2; D5-adjacent).** The *old* spec
  (`:128` "Hero placeholder (drift)", §E item 1) says null → render `"—"` +
  "Coming in v1.x". D5 removes "v1.x-pending" as the default. For a genuinely
  empty competence set (`pills: []`, new account — `competency.py:43-45`
  returns `{pills: []}`), **render an honest empty state, not "pending"**:
  overall `"—"` with hint `"No attempts yet"`, working+ `"0/0"`, and the day
  streak still derived independently from `/v1/attempts` (which may be
  non-zero for a self-initiated attempt even when no competence profile
  exists). Recommended copy pinned in Changes below; surface for confirmation.

### Files touched (verified)

1. **`frontend/src/components/dashboard/HeroStats.tsx`** — rewrite to a
   container (DEC-S1-A):
   - **Delete** the stale `:4-9` "unmounted / DO NOT construct the query"
     comment; replace with an honest header describing the live wiring.
   - Keep props `{ displayName: string; dateLabel: string }` (DEC-S1-E);
     **delete** the stale subtitle `<p>` at `:33-37` (DEC-S1-D).
   - Call `useMeCompetence()` and `useMeAttemptsCapped()` (default cap; the
     200-row cap is fine — streak only needs `submitted_at`). Reuse the
     existing query keys via the hooks (no inline key construction —
     AC-CD21 / FE-3 §B.5 §7).
   - Derive, from `competence.data?.pills ?? []`:
     - `pillCount = pills.length` (assessed pills, per D5 pin c — LOCK-2
       null-exclusion means this counts **assessed**, not total-assigned,
       pills; state this in the component comment).
     - `workingPlusCount = pills.filter(p => WORKING_PLUS.has(p.band)).length`
       where `WORKING_PLUS = new Set<Band>(["working","advanced","expert"])`.
     - `overallCompetence = pills.length ? mean(pills.map(p =>
       p.competence_estimate)) : null`, rendered `.toFixed(1)` when non-null.
   - Derive `streakDays` from `attempts.data?.data ?? []` via the new helper
     (file 2), passing `submitted_at` values.
   - **Render states:**
     - **Loading** (`competence.isPending`): render the three `Stat`s with a
       skeleton value (e.g. a `<Skeleton>` node or `"…"`); do **not** render
       `"v1.x · pending"`. (Streak/competence share the hero; gate the
       competence-derived two stats on `competence.isPending`, the streak stat
       on `attempts.isPending`.)
     - **Empty** (`pills.length === 0`): overall `"—"` + hint `"No attempts
       yet"`; working+ `"0/0"`; streak from attempts (DEC-S1-F).
     - **Populated:** overall `"{overallCompetence.toFixed(1)}"` + hint
       `across {pillCount} pill{s}`; working+ `"{workingPlusCount}/{pillCount}"`;
       streak `"{streakDays}"`, tone `accent` (DEC-S1-C).
   - **Error handling:** mirror the `AssignmentsCard` posture — competence is a
     non-fatal per-card concern; on `competence.isError` render the empty/`"—"`
     hero rather than throwing (the dashboard has no error boundary wrapping
     the hero, and a hard throw would blank the whole dashboard). Keep this
     deliberately simple: treat error like empty. *(Note: this differs from the
     `profile/page.tsx` 404-as-drift branch — the hero is a summary widget, not
     the primary surface; do not import the `ApiError` 404/405 drift dance
     here. Slice 5 covers the profile/history drift copy separately.)*
   - No `"v1.x · pending"` string remains anywhere in the file.

2. **`frontend/src/lib/competence/derive-streak.ts`** (new) — pure helper:
   - `export function deriveDayStreak(submittedAtIsoList: ReadonlyArray<string |
     null | undefined>, now: Date = new Date()): number`.
   - Reuse the UTC-day primitive pattern from `data/readings.ts:64-69`
     (`Math.floor(t / 86_400_000)`); build a `Set<number>` of distinct UTC
     day-numbers from valid `submitted_at` values (skip `null`/unparseable —
     `Number.isNaN(Date.parse(x))`).
     - **Implementation note:** the existing `daysSinceUtcEpoch` lives in
       `data/readings.tsx`, which Slice 2 **deletes**. Do **not** import it
       from there — inline the one-line `Math.floor(ms / 86_400_000)` in the
       new helper so Slice 1 carries no dependency on a file Slice 2 removes
       (cross-slice gotcha — see Gotchas).
   - Implement DEC-S1-B: `today = floorUtcDay(now)`; `anchor = set.has(today) ?
     today : set.has(today-1) ? today-1 : null`; if `anchor === null` return
     `0`; else walk `d = anchor; while (set.has(d)) { count++; d-- }` and
     return `count`.
   - Pure, deterministic, no I/O — testable with an injected `now`.

3. **`frontend/src/app/(authed)/(testee)/page.tsx`** — **remove the stale
   page-header drift comment at `:9-12`** (which falsely calls **both**
   `/v1/me/competence` AND `/v1/me/assignments` "unmounted/absent in v1" — the
   assignments half is already live via `AssignmentsCard`; auditor F2). Replace
   with an honest one-liner. The `<HeroStats displayName={displayName}
   dateLabel={dateLabel} />` call site (`:44`) is **unchanged** under DEC-S1-A +
   DEC-S1-E (HeroStats now sources its own data; props stay name+date).
   - **No other `page.tsx` change in Slice 1** (the `<TodaysReading/>` and
     `<AdaptiveLoopCard/>` mounts are S2/S4's removals, not S1's).

### Tests (paired in the same commit)

1. **`frontend/tests/components/dashboard/HeroStats.test.tsx`** — **rewrite**
   (G7). Must mount through a `QueryClientProvider` (HeroStats is now a
   container) and MSW; mirror the `mountTree` helper from `dashboard.test.tsx`
   (or a local minimal `QueryClient` + `AuthProvider` if `displayName` is
   passed directly — `displayName` is a prop so no auth needed). Set mocks via
   `setMockMeCompetence` / `setMockMeAttempts`; reset in `afterEach`.
   - `test: renders the greeting + dateLabel` — unchanged intent; assert
     heading `/welcome back, jay\./i` and the date label render (props still
     drive these).
   - `test: renders real overall competence to 1 dp` — set
     `setMockMeCompetence([{…competence_estimate:4.0…}, {…6.0…}])` (two pills),
     assert OVERALL COMPETENCE stat value is `"5.0"` (mean 5.0, deterministic —
     avoids the float ambiguity of the default-6 mean) and hint `across 2
     pills`.
   - `test: counts pills at working+` — payload with a known band mix (e.g.
     bands `["junior","working","advanced","expert"]`), assert PILLS AT
     WORKING+ value is `"3/4"`.
   - `test: derives the day streak from attempts` — set `setMockMeAttempts`
     with three consecutive-UTC-day `submitted_at` values **anchored relative
     to `new Date()`** (compute today/yesterday/2-days-ago at test time, not
     hardcoded calendar dates, so the test is stable across run dates), assert
     DAY STREAK renders `"3"`.
   - `test: empty competence renders an honest empty state (not v1.x-pending)`
     — `setMockMeCompetence([])`, assert OVERALL is `"—"` with hint `No
     attempts yet`, WORKING+ is `"0/0"`, and **no `"v1.x"` / `"pending"`
     substring** appears (`expect(screen.queryByText(/v1\.x|pending/i)).toBe
     Null()`).
   - `test: loading renders skeletons, not pending copy` — hold the competence
     handler (or assert during `isPending`); assert no `"pending"` copy. (If
     holding the handler is awkward in MSW, assert the populated/empty path and
     drop this as a lower-value case — note for executing session.)
   - `test: the competence request fires` — assert via a request spy on the
     handler (increment a counter inside a one-off `server.use(...)` override)
     **or** by asserting real derived values render (which is only possible if
     the request fired). Primary: assert real values; this supersedes the old
     "no request fires" invariant.

2. **`frontend/tests/pages/dashboard.test.tsx`** — **rewrite the hero
   assertions** + **correct the stale invariant comment**:
   - **`:1-12` header comment** — currently asserts *"NO request to
     `/v1/me/competence` or `/v1/me/assignments` fires from this page in
     v1."* Rewrite: both endpoints are live; the dashboard fires
     `/v1/me/competence` (hero) and `/v1/me/assignments` (AssignmentsCard) and
     `/v1/attempts` (RecentAttemptsCard + hero streak); MSW resolves all three.
   - Replace the `hero placeholders render '—'` test (`:99-107`) with a
     **live-path** test: with default mocks the hero renders non-placeholder
     values — assert `OVERALL COMPETENCE` is not `"—"` (it derives from the
     6-pill default), `PILLS AT WORKING+` renders `"5/6"` (deterministic: of the
     6 default pills, bands working/working/junior/advanced/working/expert →
     5 at working+), and **no `stat-value` reads `"v1.x · pending"`**.
     - *Deterministic check:* default working+ = 5, pillCount = 6 → `"5/6"`.
       Do **not** assert the exact overall mean (default mean 6.45 has
       toFixed float ambiguity); assert `not "—"` + the `/^\d\.\d$/` shape.
   - Add `afterEach` resets for `resetMockMeCompetence()` +
     `resetMockMeAttempts()` (the test currently only resets auth — once the
     hero fires these requests, cross-test mock leakage becomes possible).
   - The `greets the signed-in user by name` (`:79`) and `falls back to
     email-local-part` (`:119`) tests are **unchanged** (DEC-S1-E keeps
     `displayName`).
   - **Do not touch** the `TodaysReading`/`AdaptiveLoopCard` assertions
     (`:86-91`, `:109-117`) in Slice 1 — those are S2's and S4's removals.
     (Cross-slice: this file is edited again by S2 and S4; see Slice 4 note.)

3. **`frontend/tests/lib/competence/derive-streak.test.ts`** (new) — pure
   unit tests with an injected `now` (no MSW, no React):
   - `no attempts → 0`.
   - `single attempt today → 1`.
   - `attempt yesterday only, none today → 1` (grace anchor).
   - `attempt 2 days ago, none today/yesterday → 0` (grace expired).
   - `today + yesterday + 2-days-ago consecutive → 3`.
   - `gap breaks the streak` (today + yesterday present, 3-days-ago present but
     2-days-ago missing → 2).
   - `multiple attempts same UTC day collapse to one` (two timestamps on today
     → 1).
   - `timezone: a 23:00Z and a 01:00Z next-day timestamp count as two distinct
     UTC days`.
   - `null / unparseable submitted_at entries are skipped` (defensive).

### Edge cases & corner cases

- **Empty competence but non-empty attempts** — a self-initiated attempt
  produces no `CompetencyProfile` row (`competence.py:443-469` scopes updates
  to assignment/loop origins), so `pills: []` while `/v1/attempts` returns
  rows. Hero must show overall `"—"` / working+ `"0/0"` **and** a real streak.
  DEC-S1-F + the empty-state test cover this.
- **`overallCompetence` axis** — 1.0–10.0, **not a percentage**. Render `5.4`,
  never `54%`. (Confirmed against `band_string` thresholds + prototype.)
- **`toFixed(1)` float rounding** — the default-6 mean (6.45) is float-fragile;
  tests assert on controlled payloads (unit) or integer-stable values like
  `"5/6"` (integration), never the default mean's exact decimal.
- **`pillCount` semantics** — counts assessed pills only (LOCK-2). A testee
  assigned 10 pills but assessed on 3 shows "across 3 pills". This is the D5
  pin (c) meaning; the component comment states it so a future reader does not
  "fix" it to total-assigned.
- **Streak anchor at midnight UTC boundary** — the helper takes `now` and uses
  UTC day-floor; render-time `new Date()` is fine (no clock subscription
  needed — like `TodaysReading`'s once-per-render pick).
- **`useMeAttemptsCapped()` cache sharing** — `/profile` already calls
  `useMeAttemptsCapped()` with the default 200 cap (`profile/page.tsx:81`);
  HeroStats calling it with the same default cap **shares the cache key**
  (`[...attempts(), "capped", {limit:200}]`) — a feature, not a collision (one
  fetch serves both). Do not pass a different limit (e.g. 5) or it creates a
  second cache entry; the default cap is correct.

### Gotchas

- **Do not import `daysSinceUtcEpoch` from `data/readings.tsx`** — Slice 2
  deletes that file. Inline the UTC-day floor in `derive-streak.ts`. (If the
  executing session runs S1 before S2 and imports it, S2's deletion breaks
  S1's helper.)
- **MSW handlers already exist** — no new handler is needed for Slice 1; the
  FE-7 `meCompetenceHandler` + `meAttemptsListHandler` are registered in the
  default handler array (`handlers.ts:~3698-3701`). The work is in the test
  *setup* (set/reset mocks), not in adding handlers.
- **`onUnhandledRequest: "error"` (tests/setup.ts)** — after wiring, the hero
  *intentionally* fires `/v1/me/competence`; this is handled, so no error. The
  old dashboard test passed *because* the request never fired; that guarantee
  is now inverted (the request must fire and resolve). The header-comment
  rewrite documents the inversion.
- **HeroStats is now a container** — any other renderer of `<HeroStats>` must
  sit under a `QueryClientProvider`. Grep confirms the only call site is the
  dashboard `page.tsx` (already under the app providers) and its tests. No
  other importer.

### Acceptance assertions (executing session verifies)

- Dashboard hero shows real overall competence (1 dp), pills-at-working+ count
  (`X/Y`), and a day streak derived from `/v1/attempts`.
- New-testee empty state is honest (`"—"` + "No attempts yet", `"0/0"`), never
  "pending".
- No `"v1.x · pending"` (or any "pending"/"unmounted") copy remains in
  `HeroStats.tsx`; the stale `:4-9` comment and `:33-37` subtitle are gone.
- `page.tsx` no longer carries the false "both endpoints unmounted/absent"
  header comment (`:9-12`).
- `pnpm test` (vitest) green; `pnpm typecheck` green; Playwright unaffected.
- Coverage: the new `derive-streak.ts` is unit-covered; the rewritten
  `HeroStats.test.tsx` asserts the live path (additive coverage, not a
  weakened stub — R4).

### Dependencies

- **External (execution-gating):** D5 FE-3 spec-amendment PR on `main`.
- **Intra-PR:** none upstream. **Downstream:** S2 deletes `readings.tsx`
  (hence the inline-UTC-day gotcha); S2 + S4 further edit `dashboard.test.tsx`
  and `page.tsx` (serialize S1 → S2 → S4); S5 trails S1's stale-comment sweep.

### Complexity estimate

Medium. ~1 component rewrite (~90 lines), 1 new helper (~30 lines), 1
`page.tsx` comment edit (~5 lines), 2 test rewrites + 1 new test file
(~180 lines of tests). Total well under 400 lines; one commit.

---
