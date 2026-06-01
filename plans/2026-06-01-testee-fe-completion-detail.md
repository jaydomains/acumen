# Testee FE completion — granular detail-plan (Slices 1–5)

**Date:** 2026-06-01
**Branch:** `claude/testee-fe-completion-plan-51fvj` (this detail-plan PR).
**Authoritative source:** the merged workstream plan
`plans/2026-06-01-testee-fe-completion.md` (PR #84, squashed at `682fbd0`).

**Decisions D1–D7 — ruled by the spec author** in the on-record ruling
artifact **PR #85 comment
[`4596569727`](https://github.com/jaydomains/acumen/pull/85#issuecomment-4596569727)**
(2026-06-01). That comment is the authoritative ruling; it postdates PR #84
and **explicitly supersedes** the "PENDING spec-author ruling" labels still in
the merged workstream-plan body (`:10-12`, `:638`, `:646`, `:691-692`) and the
two #84 final-approval comments — the merged plan is the historical record, the
comment is the ruling. (Grounding note added to resolve auditor F1, which
correctly flagged that the earlier draft asserted "ruled" with no citable
source while the repo record still read PENDING.) The rulings:

- **D1 = Tier A** (honest surface; zero new backend). Slices 1–5 only; Tier B
  (6–7) + Tier C deferred to the post-deploy backlog.
- **D2 = remove** Today's Reading (option (a)).
- **D3 = remove In-Progress, redirect Latest Result** → v1 `TESTEE_NAV` =
  `Dashboard · Discover · Latest Result · Competency · History`.
- **D4 = remove** dashboard `AdaptiveLoopCard`.
- **D5 = standalone doc-only FE-3 spec-amendment PR** (authored separately by
  the spec author; gates Slice 1 **execution**). Ruling scope: drop the
  "unmounted"/"v1.x-pending" default (`:105`/§H(a) item 5/§E item 1), **amend
  `:92` (+ §H(a) item 5 / §E item 1) to reflect the *container* architecture —
  HeroStats props simplify to `{displayName, dateLabel}` and it derives the
  values internally; the amendment does NOT confirm the presentational
  data-props contract at `:92` literally** (corrected by the spec author's F3
  clarification, comment
  [`4596639182`](https://github.com/jaydomains/acumen/pull/85#issuecomment-4596639182),
  which supersedes the earlier ruling's ":92 prop contract" line), and note
  day-streak is client-derived from `/v1/attempts` (`:111`). *(Container is now
  ruled — see DEC-S1-A.)*
- **D6 = zero new backend** for Tier A (three gaps deferred, surfaced not dropped).
- **D7 = handover note; do NOT mint `AC-D28`.** Nav model captured in the
  Slice 3 handover + workstream plan.
- **D3 spec companion:** a parallel doc-only `fe-specs/FE-2-shell.md` amendment
  (`:323` nav-contract, `:344` test assertion) gates Slice 3 **execution**.

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

- **DEC-S1-A — HeroStats is a CONTAINER (RULED — closes auditor F3).** Earlier
  the workstream plan's Slice-1 file list was internally contradictory (it asked
  HeroStats to *both* adopt the `:92` data-prop contract *and* call the hooks),
  and the spec author's first D5 ruling line (*":92 confirm prop contract as
  build target"*) read as **presentational** — the opposite. **The spec author's
  F3 clarification, comment
  [`4596639182`](https://github.com/jaydomains/acumen/pull/85#issuecomment-4596639182)
  (supersedes the ":92 prop contract" line), RULES the container pattern:**
  - HeroStats **owns** `useMeCompetence()` + `useMeAttemptsCapped()` and derives
    `overallCompetence`/`pillCount`/`workingPlusCount`/`streakDays` **internally**
    from the hook results.
  - HeroStats props simplify to **`{ displayName, dateLabel }`** — the same shape
    as today; **no new data props.** The four `:92` data props are **dropped**.
  - Loading / empty / error / populated state management lives **inside**
    HeroStats.
  - The **D5 FE-3 amendment** amends `:92` (+ §H(a) item 5 / §E item 1) to
    reflect this container architecture — it does **not** confirm the
    presentational data-props contract at `:92` literally.
  - Rationale (per the ruling): container matches the dashboard's established
    pattern (`AssignmentsCard.tsx:117` owns `useMeAssignments()`,
    `RecentAttemptsCard` owns `useMeAttemptsCapped(5)`, `ResumePrompt` owns its
    localStorage read); co-locates fetching with the consuming component;
    eliminates the `page.tsx`↔HeroStats coordination point.
  - **Consequence — locked:** the `<HeroStats displayName={…} dateLabel={…} />`
    call site at `page.tsx:44` is **unchanged**; `HeroStats.test.tsx` is the
    container shape (mount through `QueryClientProvider`, the competence request
    fires); the error/empty distinction (DEC-S1-F / F2) is handled inside the
    component (no status prop needed). The Files/Tests subsections below are now
    the ruled build, not a conditional recommendation.
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
  **Scope: this covers the *empty* case only.** The *error* case (a fetch
  failure, e.g. a 500) is a distinct concern with distinct copy — see
  **DEC-S1-F2** in the Error-handling bullet (added to resolve auditor F2):
  error must never reuse the empty copy ("No attempts yet" / "0/0" / "0"),
  which would misrepresent a returning testee's real state.

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
     - **Empty** (`!isError && pills.length === 0`): overall `"—"` + hint
       `"No attempts yet"`; working+ `"0/0"`; streak from attempts (DEC-S1-F).
     - **Error** (`competence.isError`): overall `"—"` + hint **`"Unavailable"`**
       (neutral, distinct from the empty "No attempts yet"); working+ `"—"`
       (**not** `"0/0"`); see the error-handling bullet (DEC-S1-F2). The streak
       stat takes its own error branch: on `attempts.isError` render `"—"`
       (**not** `"0"`).
     - **Populated:** overall `"{overallCompetence.toFixed(1)}"` + hint
       `across {pillCount} pill{s}`; working+ `"{workingPlusCount}/{pillCount}"`;
       streak `"{streakDays}"`, tone `accent` (DEC-S1-C).
   - **Error handling (DEC-S1-F2 — resolves auditor F2):** competence is a
     non-fatal per-card concern; on `competence.isError` render the hero rather
     than throwing (the dashboard has no error boundary around the hero, and a
     hard throw would blank the whole dashboard). **The error state must be
     copy-distinct from the empty state** — rendering "No attempts yet" / "0/0"
     / "0" on a transient `/v1/me/competence` 500 for a returning testee who
     *does* have pills is actively false and violates workstream acceptance #4
     (no copy claims a state that isn't true). So: error → `"—"` +
     `"Unavailable"` (or "Couldn't load") across the two competence stats;
     streak error (`attempts.isError`) → `"—"`, never `"0"`. The empty vs error
     branches are evaluated **independently per query** (competence may error
     while attempts succeed, or vice-versa). *(This differs from the
     `profile/page.tsx` 404-as-drift branch — the hero is a summary widget, not
     the primary surface; do not import the `ApiError` 404/405 drift dance here.
     Slice 5 covers the profile/history drift copy separately.)*
   - No `"v1.x · pending"` string remains anywhere in the file.

2. **`frontend/src/lib/competence/derive-streak.ts`** (new) — pure helper:
   - `export function deriveDayStreak(submittedAtIsoList: ReadonlyArray<string |
     null | undefined>, now: Date = new Date()): number`.
   - Reuse the UTC-day primitive pattern from `data/readings.tsx:64-69`
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
   - `test: error competence renders a neutral error state (not empty copy)`
     (DEC-S1-F2 / auditor F2) — `setMockMeCompetenceStatus(500)`, assert OVERALL
     is `"—"` with hint `Unavailable` (**not** "No attempts yet"), WORKING+ is
     `"—"` (**not** "0/0"). Separately `setMockMeAttemptsStatus(500)` and assert
     DAY STREAK is `"—"` (**not** "0"). This is the guard that a fetch failure
     never masquerades as an honest empty/zero state.
   - `test: loading renders a skeleton, not pending copy` (**KEEP — resolves
     auditor F4; the self-permitted drop is removed**). `isPending` is
     assertable without MSW timing games: render and assert the skeleton node +
     **absence of any `/pending/i` copy** in the same synchronous tick, *before*
     awaiting resolution / flushing microtasks (the query is `pending` on first
     paint); or register a `server.use(...)` handler that never resolves within
     the test tick. This is the only automated guard that the loading path does
     not regress to `"v1.x · pending"`, so it stays — do not drop it.
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

**Status: final for Slice 1 — approved by planner.** Round-1 auditor findings
F1–F5 all folded: F1 grounded to the on-record D1–D7 ruling artifact
[`4596569727`](https://github.com/jaydomains/acumen/pull/85#issuecomment-4596569727);
F2 error/empty render-states split (DEC-S1-F2); F3 HeroStats architecture RULED
**container** by the spec author's clarification
[`4596639182`](https://github.com/jaydomains/acumen/pull/85#issuecomment-4596639182)
(DEC-S1-A locked); F4 loading test kept; F5 `readings.tsx` citation. Set-diff
round-0→round-1: 5 finding IDs, none dropped. Awaiting the auditor's per-slice
"Slice 1 approved" before Slice 2 is pushed.

**Status: final for Slice 1 — approved by auditor.** All five round-1 findings
(F1–F5) resolved and re-verified at source against `decc7f4`: F1 grounded to the
on-record ruling artifact
[`4596569727`](https://github.com/jaydomains/acumen/pull/85#issuecomment-4596569727);
F2 Error/Empty render-states split (DEC-S1-F2 — error never reuses empty/zero
copy); **F3 (the gating finding)** — HeroStats architecture RULED **container**
by the spec author's clarification
[`4596639182`](https://github.com/jaydomains/acumen/pull/85#issuecomment-4596639182),
DEC-S1-A rewritten conditional→ruled and the preamble D5 bullet reconciled so the
plan is internally consistent (no residual `:92`↔implementation drift); F4 loading
test kept; F5 `readings.tsx` citation. Every load-bearing code citation was
grounded against `main` and verified true (stale comments, `me.ts` hooks, LOCK-2,
band threshold working ≥ 5, the 5/6 default working+ mix + 6.45 mean, `:92`
contract, `/v1/attempts` newest-first DESC). Set-diff round-0→round-1: 5 finding
IDs, none dropped. No workflow-rule violations (PR draft; slices via commits not
force-push; wake-logs alongside actions; Slice 2 correctly held). Slice 1 sealed.

---

## Slice 2 — Remove Today's Reading (fabricated-editorial widget)

**Implements:** removes the `Today's Reading` widget (workstream G2) from the
primary dashboard surface per ruling **D2 = remove (option (a))** — on-record
artifact [`4596569727`](https://github.com/jaydomains/acumen/pull/85#issuecomment-4596569727).
Closes smoke-test issue #2. This is the only dashboard surface that asserts
**fabricated competence claims as live data**; relabeling (D2 option (b)) was
ruled out, so this slice is a clean removal, not a reframe.

### Grounding (verified against `main`)

- **What it is.** `frontend/src/data/readings.tsx:27-62` is a 3-entry hardcoded
  `READINGS` array of horoscope/"fortune" copy that asserts *specific, false*
  facts about the testee's progress — *"Antifouling is dim today — you've
  slipped half a band"*, *"Inspection Instruments … expert band, 71 attempts"*.
  `pickReading()` (`readings.tsx:76-79`) is a pure UTC-day modulo; the file
  header (`readings.tsx:11`) states **"frontend-only — no API call."** This is
  worse than a neutral placeholder: it fabricates competence data on the primary
  surface (workstream acceptance #3/#4).
- **Mount.** `frontend/src/app/(authed)/(testee)/page.tsx:22` (import) + `:45`
  (`<TodaysReading />`) — rendered full-width *between* `<HeroStats/>` and the
  two-column grid `<div>`. The card carries `className="my-6 …"`
  (`TodaysReading.tsx:22`) — see the vertical-rhythm note under Files touched.
- **Component.** `frontend/src/components/dashboard/TodaysReading.tsx` (whole
  file) is the sole non-test consumer of `pickReading` / `@/data/readings`.
- **Deletion surface is fully bounded** (repo-wide `git grep`, excluding
  `design-reference/prototype`): the only `@/data/readings` consumer is
  `TodaysReading.tsx:15`; the only `<TodaysReading/>` consumer is `page.tsx`;
  the only tests are `frontend/tests/data/readings.test.ts` (unit) + one
  assertion in `frontend/tests/pages/dashboard.test.tsx:86-90`. **No feature
  flag** gates it (`frontend/src/lib/flags.ts` has no readings flag — the only
  "Reading" hit is a prose comment at `:4`); **no storybook/story** file.
- **Not anchored — no AC retires.** FE-3 §E
  (`fe-specs/FE-3-content.md:108`): *"Today's Reading … **Not anchored** —
  frontend-only widget per FE_CHECKLIST FE-3 row."* So removal retires **no**
  `DECISIONS.md` AC (contrast D7's nav-anchor question). The *"AC-D8 framing"*
  string in the `readings.tsx` / `TodaysReading.tsx` header comments is loose
  and incorrect — AC-D8 is *self-directed pill discovery* (the catalogue), not
  editorial readings; nothing canonical binds this widget.
- **`daysSinceUtcEpoch` is re-homed by Slice 1 (cross-slice).** `readings.tsx`
  also exports `daysSinceUtcEpoch` (`:67-70`), used today **only** by
  `pickReading` (same file) and `readings.test.ts`. Slice 1's
  `derive-streak.ts` deliberately **inlines** its own
  `Math.floor(ms / 86_400_000)` rather than importing this primitive (Slice 1
  Files-touched note 2, `:292-296`), precisely so that deleting `readings.tsx`
  here strands no import. Verified: after Slice 1 lands, **no** production file
  imports `daysSinceUtcEpoch`.

### Decisions to surface to the spec author (do not silently resolve)

**DEC-S2-A — FE-3 spec-amendment routing for the Today's-Reading removal
(execution-gating; mirrors D5).** Removing the widget makes the FE-3 spec text
describe a v1 surface that no longer exists — drift across **§A source-mapping
table** (`:46` row 1 — *"`testee.jsx:7–68` (TodaysReading / GREETINGS /
READINGS)"*), **§B.1** (`:22` dashboard-widget list), **§C.1** (`:93` component
spec — which *additionally* mis-cites the path as
`components/dashboard/readings.tsx`; the actual file is `data/readings.tsx`),
**§E** (`:108` anchor-table row), **§F Gherkin** (`:147-158`, *two* scenarios:
day-stability + cross-day rotation), **§H(a)** initial-load (`:126`) + **§H
render-states** (`:136`), the **§notes** (`:184`), the **prototype-provenance
line** (`:193` — *"`testee.jsx:21–68` (TodaysReading + GREETINGS + READINGS) ·
same"*), and the test-plan refs (`:594`, `:670`, `:810`). **Mirror-sweep note
(resolves auditor S2-2, same lesson as PR #84 F5):** at `:46` and `:193` the
amendment strikes the **TodaysReading / READINGS** portion only and **retains
GREETINGS** — the greeting copy is not removed (the hero greeting stays), so a
blanket delete of those rows would over-sweep. Per the D5/D3 posture —
spec/drift corrections are authored by the spec author, not the execution
session (`SESSION_START.md:80-85`) — this removal must ride a spec amendment.

- **(a) Fold into the existing D5 FE-3 amendment PR (recommended).** It is the
  *same* file (`fe-specs/FE-3-content.md`) the spec author already opens for the
  HeroStats/competence drift; extend that PR's scope to also strike the
  Today's-Reading references. One FE-3 PR fixes all FE-3 drift, and **Slice 2
  execution then gates on the same PR as Slice 1** — no new external dependency.
- **(b) Separate standalone FE-3 doc-only PR.** Mirrors the D3 FE-2-shell PR
  pattern, but a *second* PR touching `FE-3-content.md` concurrently with the D5
  PR invites merge-order coupling / conflicts on the same file.
- **(c) Handover note only (D7-style).** The widget is "Not anchored" (§E
  `:108`) so nothing in `DECISIONS.md` breaks; but the FE-3 drift here is
  materially larger than the nav case (8+ refs incl. two Gherkin scenarios) — a
  handover note leaves the canonical spec describing a shipped-then-removed
  surface. Not recommended.

**Recommendation: (a).** Note this **expands the D5 ruling's stated amendment
scope** (comment `4596569727` lists only `:105` / `:92` / `:111`); flagged here
for the spec author to confirm the broadened scope. Detail-planning proceeds now
regardless — the removal direction is forced by ruling D2.

### Files touched (verified)

1. **`frontend/src/app/(authed)/(testee)/page.tsx`** — remove the
   `import { TodaysReading } from "@/components/dashboard/TodaysReading";` line
   (`:22`) and the `<TodaysReading />` mount (`:45`). Builds on the **Slice-1
   version** of this file (S1 rewrote the `:9-12` docstring and explicitly left
   the TodaysReading mount to S2 — Slice 1 note `:310-311`). After removal,
   `<HeroStats/>` is followed directly by the two-column grid `<div>`.
   - **Vertical rhythm — gap is preserved, no spacing addition needed
     (grounded, resolves auditor S2-3):** the removed `<Card>` carried `my-6`
     (24px; `TodaysReading.tsx:22`), but the hero→grid gap does **not** depend on
     it — `HeroStats`' own wrapper `<div data-testid="dashboard-hero">` carries
     **`mb-8`** (32px; `HeroStats.tsx:26`, preserved through the Slice-1 rewrite).
     After removing `<TodaysReading/>`, the hero→grid gap is `mb-8` (32px) —
     *more* than the removed `my-6` (24px), so there is **no gap regression** and
     **no spacing addition is expected**. Keep this a clean deletion, not a
     re-layout (the two-column → one-column collapse is S4's concern when
     `AdaptiveLoopCard` goes).
2. **`frontend/src/components/dashboard/TodaysReading.tsx`** — **delete** (whole
   file). Sole `<TodaysReading/>` consumer (`page.tsx`) is updated above.
3. **`frontend/src/data/readings.tsx`** — **delete** (whole file). Sole non-test
   consumer was `TodaysReading.tsx` (deleted above); `daysSinceUtcEpoch` is
   re-homed in Slice 1 (see Grounding), so no import is stranded.

### Tests (paired in the same commit)

1. **`frontend/tests/data/readings.test.ts`** — **delete** (whole file). This is
   **not** a stub-drop to dodge a failure (cf. auditor F4): the module under test
   (`READINGS` / `pickReading` / `daysSinceUtcEpoch`) is removed by ruling D2, so
   the test has no subject to import. Its substantive coverage was the readings
   *rotation* (day-stability + cross-day cycling), which no longer exists; the
   reusable **UTC-day-math primitive** gains fresh, equivalent coverage in Slice
   1's `frontend/src/lib/competence/derive-streak.test.ts` (the streak helper's
   own day-bucketing tests). **Net: no live behavior loses coverage** — only the
   removed feature's tests go.
2. **`frontend/tests/pages/dashboard.test.tsx`** — edit the
   `"renders TodaysReading + AssignmentsCard + AdaptiveLoopCard"` test
   (`:86-90`): drop the `todays-reading` `findByTestId` assertion (`:88`), rename
   the test to `"renders AssignmentsCard + AdaptiveLoopCard"`, and **add a
   negative assertion** —
   `expect(screen.queryByTestId("todays-reading")).not.toBeInTheDocument();` —
   so the removal is asserted, not merely un-asserted.
   - **Ordering — the negative query needs an awaited render barrier or it
     passes vacuously (resolves auditor S2-1).** The dashboard paints behind
     async auth (`mountTree`'s `AuthProvider`) — that is *why* the original test's
     only `await` is the `findByTestId("todays-reading")` barrier (`:88`). Since
     that barrier is the line being removed, **convert a persistent-card
     assertion to an awaited barrier first** — e.g.
     `expect(await screen.findByTestId("assignments-card")).toBeInTheDocument();`
     — *then* assert `queryByTestId("todays-reading")` is absent. Without the
     `findBy` barrier the negative query runs **before paint** and passes even if
     `TodaysReading` were still mounted (and the existing synchronous
     `getByTestId("assignments-card")`/`"adaptive-loop-card"` lines would throw
     pre-auth anyway — at least one must become `findBy`).
   - Builds on the **Slice-1 version** of this file (S1 rewrote the hero-request
     invariant + the "hero placeholders" test; this card-presence test was
     untouched by S1). **Rebase note:** S4 will later drop the `adaptive-loop-card`
     assertion from this *same* test — leave that to S4 (preamble `:75`).

### Edge cases & corner cases

- **Hydration.** TodaysReading was a deterministic-by-day pure render with no
  data dependency; removing it cannot introduce an SSR/CSR mismatch (it removes
  a render, adds none).
- **No async states.** The widget had no loading/empty/error states, so there is
  nothing to migrate (contrast Slice 1's render-state matrix).
- **Unused-import / undefined-component.** Removing the mount without the import
  (or vice-versa) is a hard `tsc`/`eslint` error; both must go in the same edit —
  `pnpm typecheck` + the negative test are the backstops.

### Gotchas

- **Delete order / dangling imports.** Remove `TodaysReading.tsx` *and* its
  `page.tsx` mount in the same commit; only then is `readings.tsx` import-free
  and deletable. An orphaned import of a deleted module is a hard TS error —
  `pnpm typecheck` catches it.
- **Cross-slice ordering (S1 → S2).** Slice 1 lands first and re-homes
  `daysSinceUtcEpoch` (inlined in `derive-streak.ts`, `:292-296`). Even if order
  slipped, S1's helper inlines its own copy (no import of `readings.tsx`), so the
  delete is safe either way; the planned order is S1 → S2 (preamble `:70`).
- **`dashboard.test.tsx` is shared by S1/S2/S4** (preamble `:75`): S2 touches
  *only* the card-presence test's `todays-reading` line — do not disturb S1's
  hero-request invariant or S4's adaptive-loop assertion.
- **Spec gate.** Slice 2 *execution* waits for the FE-3 amendment striking the
  Today's-Reading spec text (DEC-S2-A; recommended = the D5 FE-3 PR with extended
  scope). Detail-planning proceeds now (removal forced by D2).

### Acceptance assertions (executing session verifies)

- The dashboard renders no `todays-reading` widget and no fabricated-competence
  copy; `queryByTestId("todays-reading")` is `null`.
- `TodaysReading.tsx`, `data/readings.tsx`, and `tests/data/readings.test.ts` no
  longer exist; a repo-wide grep for `TodaysReading` / `pickReading` / `READINGS`
  / `@/data/readings` returns only `design-reference/prototype` hits.
- `pnpm test` green (incl. the edited `dashboard.test.tsx`), `pnpm typecheck`
  green, `pnpm lint` clean (no unused imports), Playwright unaffected.
- No live behavior lost coverage: the UTC-day-math primitive is covered by
  `derive-streak.test.ts` (Slice 1).

### Dependencies

- **External (execution-gating):** the FE-3 spec amendment striking the
  Today's-Reading references (DEC-S2-A — recommended: fold into the D5 FE-3 PR).
- **Intra-PR:** **upstream** S1 (re-homes `daysSinceUtcEpoch`; rewrites
  `dashboard.test.tsx` + the `page.tsx` docstring first). **Downstream** S4
  (further edits `page.tsx` — grid collapse — and drops the adaptive-loop
  assertion from `dashboard.test.tsx`). Serialize **S1 → S2 → S4** (preamble
  `:70-77`).

### Complexity estimate

Small. Two source-file deletions + one test-file deletion + a 2-line `page.tsx`
edit + a ~3-line `dashboard.test.tsx` edit. Net mostly deletions (~150 lines
removed, ~3 added); one commit.

**Status: final for Slice 2 — approved by planner.** Round-1 auditor findings
(all 3 worth-knowing, none gating) folded: **S2-1** test-ordering — the negative
`queryByTestId` now requires an awaited `findByTestId("assignments-card")`
barrier first (else vacuous pre-paint); **S2-2** mirror-sweep — DEC-S2-A scope
extended to FE-3 `:46` (§A source-map) + `:193` (provenance), striking
TodaysReading/READINGS while **retaining GREETINGS**; **S2-3** grounding —
vertical-rhythm note corrected: the hero→grid gap is preserved by `HeroStats`'
`mb-8` (`:26`, 32px > the removed `my-6` 24px), so no regression / no spacing
addition. **DEC-S2-A** remains the standing external *execution* gate (spec
author confirms whether the FE-3 strike folds into the D5 PR — robust: the Slice
2 code is identical under (a)/(b)/(c)). Set-diff round-0→round-1: 3 finding IDs,
none dropped. Awaiting the auditor's per-slice "Slice 2 approved" before Slice 3
is pushed.

**Status: final for Slice 2 — approved by auditor.** All 3 round-1 findings
(S2-1/S2-2/S2-3, all worth-knowing — no gating defect) resolved and re-verified
at source against `965ef67`: **S2-1** the negative `queryByTestId("todays-reading")`
now follows an awaited `findByTestId("assignments-card")` barrier (no vacuous
pre-paint pass); **S2-2** DEC-S2-A extended to FE-3 `:46` + `:193`, striking
TodaysReading/READINGS while retaining GREETINGS; **S2-3** vertical-rhythm
re-grounded on `HeroStats` `mb-8` (no gap regression). Grounding verified true
against `main`: the deletion surface is fully bounded (only code consumers are
`TodaysReading.tsx`, `page.tsx`, and the two test files; `daysSinceUtcEpoch` has
no importer outside `readings.tsx`), no flag/stories, widget Not-anchored (FE-3
§E `:108`) so no AC retires, `readings.test.ts` deletion correct-by-construction.
**DEC-S2-A** remains the standing external *execution* gate — needs spec-author
confirmation of the FE-3 scope expansion (fold into the D5 PR), robust: the Slice
2 code is identical under (a)/(b)/(c). Set-diff round-0→round-1: 3 finding IDs,
none dropped. No workflow-rule violations. Slice 2 sealed.

---

## Slice 3 — Dead-nav resolution: remove In-Progress, redirect Latest Result

**Spec-gate (execution):** BLOCKED until the **D3 `fe-specs/FE-2-shell.md`
spec-amendment PR** (doc-only, authored by the spec author — `:323` nav-contract
+ `:344` Gherkin) lands on `main`. This slice is **code-only**; it does **not**
edit `fe-specs/FE-2-shell.md` (resolves auditor F3; preamble `:40-41`).
Detail-planning proceeds now — the nav-model direction is forced by ruling D3.

**Implements:** no testee nav item 404s — remove the dead `In Progress`
(`/attempts`) item, and make `Latest Result` (`/results`) land via a thin
redirect to the most-recent submitted attempt's result page (closes smoke-test
issue #3). Resulting v1 `TESTEE_NAV` = `Dashboard · Discover · Latest Result ·
Competency · History`.

### Grounding (verified against `main`)

- **Current `TESTEE_NAV`** (`Rail.tsx:31-38`), 6 items: `dashboard "/"` ·
  `attempt "In Progress" /attempts count:0` (`:33`) · `catalogue "Discover"
  /catalogue` · `results "Latest Result" /results` (`:35`) · `profile
  "Competency" /profile` · `history "History" /history`.
- **Both dead hrefs 404 — confirmed by the route tree** (`find
  src/app/(authed)/(testee)`): pages exist for `/`, `/catalogue`, `/profile`,
  `/history`, `/attempts/[attemptId]`, `/attempts/[attemptId]/result`,
  `/pills/[pillId]` — **no `/attempts` index, no `/results` page**. So `In
  Progress`→`/attempts` and `Latest Result`→`/results` both 404 (workstream G3).
- **Redirect target exists:**
  `src/app/(authed)/(testee)/attempts/[attemptId]/result/page.tsx` (`"use
  client"`, `useParams<{ attemptId: string }>()` at `:44`). The redirect URL is
  `/attempts/${attemptId}/result`.
- **Latest-attempt source:** `useMeAttemptsCapped(limit = PROFILE_ATTEMPTS_CAP)`
  (`queries/me.ts:96-106`) returns the capped `AttemptsPage = { data:
  AttemptListItem[], meta }`. `/v1/attempts` is **newest-first DESC**
  (`attempts.py:2137`, "Newest submission first, tie-break by id" — verified by
  the auditor during Slice 1), so `attempts.data?.data?.[0]` is the most-recent
  submitted attempt; its `attempt_id` (`api.d.ts:1828`) is the redirect key.
- **Cache-staleness (load-bearing for DEC-S3-A):** the `me/attempts` **list** is
  **never invalidated on submit** — verified against `main`: every attempt-flow
  `invalidateQueries` targets `attemptQueryKeys.detail(attemptId)` only
  (`GradingOverlay.tsx:125`, `FrozenRunner.tsx:201`,
  `StreamingRunner.tsx:238/258/290`, `use-streaming-queue.ts:187/198/215`); there
  is **no** `invalidateQueries` on `meQueryKeys.attempts()` anywhere in `src/`.
  With `staleTime: 30s`, a warm capped-list entry is stale-after-submit — which
  forces the `(1)` + mount-fresh-gate choice in DEC-S3-A (the redirect must read
  the true latest, not a cached `data[0]`).
- **Client-redirect idiom:** `useRouter().replace(...)` from `next/navigation` —
  the established pattern across the app (`profile/page.tsx:120,126`,
  `catalogue/page.tsx:77`, + 8 admin list pages). Use `replace` (not `push`) so
  the bouncing `/results` page leaves no back-button trap.
- **Rail header comment** (`Rail.tsx:6-13`) documents the placeholder-404 model
  ("Several href targets are placeholders that will 404 until later phases land
  them") + "FE-4 wires in-progress" badge counts — stale once `/attempts` goes;
  sweep.
- **MSW:** `meAttemptsListHandler` already registered (FE-7); setters
  `setMockMeAttempts` / `setMockMeAttemptsStatus` / `resetMockMeAttempts`.
- **Rail tests** (`Rail.test.tsx`): the **href-lock** test (`:76-85`) asserts the
  exact testee href array *including* `/attempts`; the **badge-hidden-when-0**
  test (`:41-44`) queries `rail-badge-attempt` (the count-carrying item being
  removed). Both need updates (see Tests).

### Decisions to surface (recommended option first)

- **DEC-S3-A — attempts-fetch cap + freshness for the redirect (RULED — resolves
  auditor S3-1; correctness).** The redirect needs the *genuinely* newest
  `attempt_id`. **Use `useMeAttemptsCapped(1)` (the workstream plan's original) —
  NOT the shared default 200 cap.** *(An earlier draft recommended the default
  cap for warm-cache speed; that was wrong on correctness and is reverted.)* The
  load-bearing reason: the **`me/attempts` list cache is never invalidated on
  submit** — verified exhaustively against `main`, every attempt-flow
  `invalidateQueries` targets `attemptQueryKeys.detail(attemptId)` only
  (`GradingOverlay.tsx:125`, `FrozenRunner.tsx:201`,
  `StreamingRunner.tsx:238/258/290`, `use-streaming-queue.ts:187/198/215`), and
  there is **zero** invalidation of `meQueryKeys.attempts()` anywhere in `src/`.
  Combined with the AC-CD21 `staleTime: 30s`, the shared `{limit:200}` entry
  (warmed by the hero / `/profile` *before* the newest attempt existed) would
  hand the redirect a **stale `data[0]` = the *prior* attempt**, sending "Latest
  Result" to the wrong result for the whole post-submit window. `(1)` mints a
  distinct `{limit:1}` key that the hero/profile never warm, so the typical
  submit→"Latest Result" flow **cold-fetches the true latest**.
  - **Freshness gate (closes the residual re-visit-within-`staleTime` window).**
    `(1)` alone is still cached for 30s, so a second `/results` visit *after a
    further submit* could read a stale `{limit:1}`. So: on `/results` mount,
    **force a revalidation** (`refetch()` in a mount effect, or a dedicated query
    instance with `staleTime: 0` / `refetchOnMount: "always"`) and **gate the
    redirect on the post-mount settled result** (`isSuccess &&
    isFetchedAfterMount`), not the first cached paint — so even a warm-but-stale
    `{limit:1}` re-reads the true latest before redirecting. Stays nav-scoped (no
    runner/submit change).
- **DEC-S3-B — empty-state copy + CTA (no submitted attempts).** A testee who has
  never submitted has `data.data == []`, so there is nothing to redirect to.
  **Recommendation: render an honest empty state** — heading "No results yet",
  body "Finish a test and your latest result lands here.", and a primary link to
  **Discover** (`/catalogue`) to start one — **not** a redirect, not a fabricated
  result. The empty branch is gated `!isPending && !isError` (error ≠ empty, per
  the Slice-1/2 lessons). Surfaced for **product/spec-author confirmation of the
  exact wording** (not gating — the empty state exists and is honest regardless).
- **DEC-S3-C — surfaced cross-cutting (root cause of S3-1; OUT of Slice 3
  scope).** The underlying defect is that **`meQueryKeys.attempts()` is never
  invalidated on submit** (see DEC-S3-A). That same stale-list window also yields
  stale reads on the **hero day-streak** (Slice 1), the **`/profile` sparkline**,
  and **`/history`** during the `staleTime: 30s` after a submit. The systemic fix
  is the auditor's option (b) — invalidate `meQueryKeys.attempts()` in the
  submit/grading flow (`GradingOverlay` / `use-streaming-queue`) — but that
  **touches the runner**, outside Slice 3's nav-only scope. **Surfaced as a
  deferred backlog item** (not silently dropped; mirrors the workstream's
  deferred-gap discipline). Slice 3's own correctness is fully handled by the
  `(1)` + mount-fresh gate in DEC-S3-A without it; the sealed Slice 1 is **not**
  reopened (its streak staleness is minor, self-healing within 30s, and covered
  by this deferred item).

### Files touched (verified)

1. **`frontend/src/components/shell/Rail.tsx`**
   - **Remove** the `attempt` item (`:33`) from `TESTEE_NAV`. Keep the `results`
     item (`:35`) as-is (`Latest Result` → `/results`) — its target becomes a
     real page (file 2).
   - **Sweep the header comment** (`:6-13`): drop the "placeholders that will
     404" framing and the "FE-4 wires in-progress" badge line, now that no testee
     nav item 404s or carries a count. Leave the `ADMIN_NAV` badge note intact
     (admin `review`/`engagement` still carry counts).
   - **No `ADMIN_NAV` change** — out of scope; admin nav is FE-8/FE-9-locked.
2. **`frontend/src/app/(authed)/(testee)/results/page.tsx`** (new) — thin client
   redirect:
   - `"use client"`; `useMeAttemptsCapped(1)` (DEC-S3-A — **not** the shared 200
     key) + `useRouter()`; force a mount revalidation + gate the redirect on the
     settled post-mount result (DEC-S3-A freshness gate).
   - `const latest = attempts.data?.data?.[0] ?? null;`
   - Redirect only once the mount-fresh fetch settles: `useEffect(() => { if
     (attempts.isSuccess && attempts.isFetchedAfterMount && latest)
     router.replace(\`/attempts/${latest.attempt_id}/result\`); }, [...]);` (the
     `isFetchedAfterMount` guard prevents redirecting on a stale cached paint).
   - **Render states (mirror Slice 1's per-query honesty — error ≠ empty):**
     **loading** (`attempts.isPending`) → centered "Loading your latest
     result…" / skeleton; **has-latest** → render the same skeleton while the
     effect navigates (no flash of empty); **empty** (`!isPending && !isError &&
     latest == null`) → the DEC-S3-B empty state; **error** (`attempts.isError`)
     → honest "Couldn't load your results" (not a redirect, not the empty copy).
   - No new hook/endpoint; reuses the live `/v1/attempts`.

### Tests (paired in the same commit)

1. **`frontend/tests/components/shell/Rail.test.tsx`** — update for the new nav:
   - **href-lock test** (`:76-85`): expected testee array becomes `["/",
     "/catalogue", "/results", "/profile", "/history"]` (drop `/attempts`).
   - The `"renders the testee nav for a testee"` test (`:6-13`) iterates
     `TESTEE_NAV` — auto-adjusts (no edit), but it now also confirms "In
     Progress" is gone.
   - **badge-hidden-when-0 test** (`:41-44`): `rail-badge-attempt` no longer
     exists (the only count-carrying testee item is removed). **Repoint** to keep
     the behavior covered: render `role="admin"` and assert `rail-badge-review`
     (admin `review`, `count:0`) is absent — the same "chip hidden when count 0"
     guard against a still-present count item. (R4: the mechanism stays tested,
     not silently dropped.)
2. **`frontend/tests/pages/results-redirect.test.tsx`** (new) — mock
   `next/navigation` `useRouter().replace` (`vi.fn`) + MSW:
   - **latest → redirect:** default `setMockMeAttempts` (newest-first) → after an
     awaited render barrier, assert `replace` called once with
     `/attempts/${data[0].attempt_id}/result`.
   - **empty → empty state, no redirect:** `setMockMeAttempts([])` → assert the
     "No results yet" copy + Discover link render, and `replace` **not** called.
   - **error → honest error, no redirect:** `setMockMeAttemptsStatus(500)` →
     assert the error copy, `replace` not called, and **no** "No results yet"
     copy (error ≠ empty).
   - **freshness → redirects to the *true* latest, not a stale cached entry
     (guards DEC-S3-A / auditor S3-1):** pre-seed the QueryClient with a stale
     attempts entry whose `data[0]` is an *older* attempt, then mount `/results`
     with MSW returning a *newer* `data[0]`; assert `replace` targets the
     **newer** attempt's result (the mount-fresh refetch + `isFetchedAfterMount`
     gate won, not the stale paint). This is the regression guard for the
     redirect-to-prior-result bug.
   - Await a barrier before asserting `replace` (the redirect fires post-fetch in
     an effect) — mirror the Slice-2 S2-1 lesson (don't assert before paint).

### Edge cases & corner cases

- **`replace` vs `push`** — `replace`, so the back button from the result page
  returns to where the testee came from, not the bouncing `/results`
  (idiom-consistent with profile/catalogue).
- **Active-route highlight** — `Rail` matches `activeRoute === href` exactly; on
  `/results` "Latest Result" highlights; after the redirect to
  `/attempts/{id}/result` no nav href matches exactly, so none highlights —
  consistent with every other param route (`/attempts/[attemptId]`,
  `/pills/[pillId]`). No special handling.
- **Direct visit, cold cache** — a testee deep-linking `/results` with no warm
  cache sees the loading state → redirect once attempts resolve. The loading copy
  reads honestly ("Loading your latest result…"), never a fake result.
- **Single vs many attempts** — `data[0]` is correct for both (DESC); no
  off-by-one.
- **Not a server redirect** — `/results` needs the authed testee's attempts
  (bearer-token, client react-query); a server `redirect()` would need
  server-side token fetching, which is not the app's pattern. Client redirect is
  correct; state it in the component header.

### Gotchas

- **Code-only — do NOT touch `fe-specs/FE-2-shell.md`** (`:323`/`:344`). That
  sweep is the **D3 spec-amendment PR**, authored by the spec author, and gates
  Slice 3 *execution* (preamble `:40-41`; resolves auditor F3). The slice's
  acceptance assumes that amendment has landed on `main` (the `:344` Gherkin
  asserting the nav contains "In Progress"/"Latest Result" is corrected there,
  not here).
- **Independent slice** — S3 touches neither `page.tsx` nor `dashboard.test.tsx`;
  it does **not** participate in the S1→S2→S4 `page.tsx` serialization (preamble
  `:71`). No intra-PR upstream dependency; the only external gate is the D3 PR.
- **`useMeAttemptsCapped(1)` — do NOT reuse the shared 200 key** (DEC-S3-A): the
  `me/attempts` list is never invalidated on submit, so the warm `{limit:200}`
  entry is stale-after-submit and would redirect to the *prior* result. Use the
  distinct `{limit:1}` key **and** the mount-fresh redirect gate
  (`isFetchedAfterMount`) so "Latest Result" is always the true latest.
- **`rail-badge-attempt` is gone** — grep confirms it's referenced only at
  `Rail.test.tsx:43` (updated above); no other test/reference breaks.

### Acceptance assertions (executing session verifies)

- Every testee nav item resolves with no 404: `In Progress` removed; `Latest
  Result` (`/results`) redirects to the latest result (or shows the honest empty
  state).
- `TESTEE_NAV` = `["/", "/catalogue", "/results", "/profile", "/history"]`; the
  href-lock test asserts it.
- `/results` with attempts → `router.replace('/attempts/{newest_id}/result')`;
  with none → "No results yet" + Discover link; on error → honest error copy
  (never the empty copy).
- The FE-2-shell `:344` nav Gherkin has been corrected by the **D3 amendment on
  `main`** (external; not edited by this slice).
- `pnpm test` + `pnpm typecheck` green; Playwright unaffected (the smoke nav
  check now passes).

### Dependencies

- **External (execution-gating):** the D3 `fe-specs/FE-2-shell.md` amendment PR
  (`:323`/`:344`) on `main`.
- **Intra-PR:** **none** — S3 is independent of the S1→S2→S4 dashboard chain
  (preamble `:71`); buildable in any order relative to those once its spec gate
  clears.

### Complexity estimate

Small–medium. One nav-array line removed + a header-comment sweep in `Rail.tsx`;
one new ~55-line redirect page; one Rail-test update + one new redirect test
(~110 lines). Well under 250 lines; one commit.

**Status: final for Slice 3 — approved by planner.** Round-1 auditor findings
folded: **S3-1 (REAL GAP — correctness)** — my DEC-S3-A default-200 recommendation
was wrong; the `me/attempts` list is never invalidated on submit (verified: all
attempt-flow `invalidateQueries` hit `attemptQueryKeys.detail` only, zero on
`meQueryKeys.attempts()`), so the warm 200-cap cache is stale-after-submit and
would redirect "Latest Result" to the *prior* result. **Reverted DEC-S3-A to
`useMeAttemptsCapped(1)` + a mount-fresh redirect gate** (`isFetchedAfterMount`),
added a freshness regression test, and added the cache-staleness grounding +
the root-cause carry-forward (**DEC-S3-C**: invalidate `meQueryKeys.attempts()`
on submit — also fixes hero-streak/`/profile`/`/history` staleness — deferred as
out-of-nav-scope, not silently dropped; sealed Slice 1 not reopened).
**S3-2 (worth-knowing)** — DEC-S3-B empty-copy stays surfaced for product
confirmation (not gating). Set-diff round-0→round-1: 2 finding IDs, none dropped.
Awaiting the auditor's per-slice "Slice 3 approved" before Slice 4 is pushed.

**Status: final for Slice 3 — approved by auditor.** Both round-1 findings
resolved and re-verified at source against `301bb63`. **S3-1 (REAL GAP — the
catch of this slice):** DEC-S3-A's default-200 shared cache would have redirected
"Latest Result" to the *prior* result — the `me/attempts` list is never
invalidated on submit (verified exhaustively: every attempt-flow
`invalidateQueries` targets `attemptQueryKeys.detail` only; zero on
`meQueryKeys.attempts()`). Fixed: reverted to `useMeAttemptsCapped(1)` **+** a
mount-fresh redirect gate (`isSuccess && isFetchedAfterMount`) — closing even the
re-visit-within-`staleTime` window — with a freshness regression test. Root cause
carried forward as **DEC-S3-C** (invalidate `meQueryKeys.attempts()` on submit —
also resolves hero-streak/`/profile`/`/history` staleness — deferred out-of-nav-
scope; sealed Slice 1 correctly not reopened). **S3-2:** DEC-S3-B empty-state copy
surfaced for product confirmation (not gating). Grounding verified true against
`main`: nav/route-tree/redirect-idiom, and the **deletion surface fully bounded**
(no e2e/test touches the removed nav item beyond the two cited Rail tests). The
D3 FE-2-shell amendment gate was already ruled (no scope expansion). Set-diff: 2
finding IDs, none dropped. No workflow-rule violations. Slice 3 sealed.

---

## Slice 4 — Remove the dashboard AdaptiveLoopCard (hardcoded-narrative widget)

**Implements:** removes the dashboard `AdaptiveLoopCard` (workstream G4) per ruling
**D4 = remove for v1** — on-record artifact
[`4596569727`](https://github.com/jaydomains/acumen/pull/85#issuecomment-4596569727).
The card renders a hardcoded "Two weak areas surfaced from your last attempt"
narrative with two no-op `toast` CTAs; the **real** adaptive loop already renders
per-attempt on the result page. Removing it leaves no dashboard widget faking
loop state. (D4's "wire" alternative is **not** taken — ruled remove.)

### Grounding (verified against `main`)

- **The dashboard card is hardcoded + no-op.** `AdaptiveLoopCard.tsx:30-36` —
  hardcoded `"Two weak areas surfaced from your last attempt."` + `"queued a
  targeted re-test five days out."`; two CTAs `adaptive-loop-explainer` (`:41`)
  and `adaptive-loop-defer` (`:54`) are **`toast` no-ops** tagged `TODO(v1.x)`
  (`:43`, `:56`). No API call. `data-testid="adaptive-loop-card"` (`:21`); the
  eyebrow even prints `"Adaptive loop · AC-D6"` (`:27`) though it carries no real
  AC-D6 data.
- **It is distinct from the REAL result-page card — do not touch that one.** The
  grep surfaces **two different components** sharing the export name: the
  dashboard one (`src/components/dashboard/AdaptiveLoopCard.tsx`, hardcoded — the
  delete target) vs the **real** `components/result/…` card rendered at
  `attempts/[attemptId]/result/page.tsx:144` as `<AdaptiveLoopCard
  steps={result.adaptive_loop} status={result.status} />` (props-driven, **keep**).
  `src/lib/result/adaptive-loop-format.ts` belongs to the *result* card — **keep**.
  Different module paths, so deleting the dashboard module leaves the result
  import untouched (the key safety check).
- **Deletion surface is fully bounded** (repo-wide grep): the only consumers of
  the dashboard card are `page.tsx:24` (import) + `page.tsx:52` (mount) and the
  `dashboard.test.tsx` blocks below. **No feature flag** (`flags.ts` has no
  AdaptiveLoop entry — unflagged static card), no stories.
- **Mount + grid** (`page.tsx:48-54`): the card is the **sole occupant of the
  right grid column** —
  `<div className="grid … lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">` with a
  left column (`AssignmentsCard` + `RecentAttemptsCard`) and a right column whose
  only child is `<AdaptiveLoopCard />`. Removing it empties the right column →
  the two-column grid must collapse (DEC-S4-B).
- **Not anchored — no AC retires.** FE-3 §E (`fe-specs/FE-3-content.md:109`):
  `(none) | Adaptive-loop card | Static copy in v1` — anchor column `(none)`, like
  Today's Reading. **AC-D6 itself is NOT retired** — it is the *real* adaptive
  loop satisfied by the result page; the dashboard card only borrowed the label.
- **`dashboard.test.tsx` blocks:** the card-presence test (`:86-91`, which Slice 2
  already rewrites to "renders AssignmentsCard + AdaptiveLoopCard" + the negative
  todays-reading assertion) still asserts `adaptive-loop-card` present (`:90`);
  and a dedicated **`"adaptive-loop CTAs toast (placeholder until v1.x wiring)"`**
  test (`:109-117`) clicks both CTAs and asserts `toast` was called. The `sonner`
  mock + `toast` import + `mockClear` (`:38-41`, `:69`) exist **only** to serve
  that CTA test (grep-confirmed: no other `toast` use in the file).

### Decisions to surface (recommended option first)

- **DEC-S4-A — FE-3 spec-amendment scope for the dashboard-card removal
  (execution-gating; mirrors D5 / DEC-S2-A).** Removing the widget drifts FE-3
  across **§B.1** (`:22` dashboard-widget list — "Adaptive-loop accent card"),
  **§B.4** (`:79` "Read the explainer on AdaptiveLoopCard → static placeholder"),
  **§C** (`:97` component spec — which *also* mis-cites the path as
  `components/dashboard/adaptive-loop-card.tsx`; the actual file is
  `AdaptiveLoopCard.tsx`), **§E** (`:109` anchor-table row), **§H(a)** initial-load
  (`:126` "AdaptiveLoopCard rendered (static)"), the **§notes** (`:187` CTA note),
  the **provenance** line (`:196`), the **component table** (`:597`), and the
  **CTA-wire backlog row** (`:707` item 4). **Mirror-sweep guard (same lesson as
  DEC-S2-A / PR #84 F5):** strike only the **dashboard `AdaptiveLoopCard`** refs
  and **retain AC-D6 + every result-page adaptive-loop reference** (the real
  per-attempt loop is not removed). **Recommendation: fold into the existing D5
  FE-3 amendment PR** (same file already opened for the HeroStats + Today's-Reading
  drift); Slice 4 *execution* then gates on that PR. Like DEC-S2-A this **expands
  D5's stated scope** (`4596569727` listed only `:105`/`:92`/`:111`) — flagged for
  the spec author. Not anchored, so no `DECISIONS.md` AC moves.
  - **Cumulative D5 scope (resolves auditor S4-1; track for the global gate).**
    DEC-S4-A is the *second* expansion onto the D5 FE-3 PR, so that one combined
    doc-only PR now carries **three** scopes: the original ruling
    (`:105`/`:92`/`:111`), **DEC-S2-A** (Today's-Reading), and **DEC-S4-A**
    (AdaptiveLoopCard) — materially larger than the spec author's original D5
    description. The spec author should confirm the **cumulative** expansion, and
    **S1 + S2 + S4 execution all wait on that single combined PR**. Tracked
    alongside DEC-S2-A on the global-gate list. The DEC-S4-A enumeration was
    mirror-sweep-verified complete by the auditor (refs `:22/:79/:97/:109/:126/
    :187/:196/:597/:707`; `:6` is the **AC-D6 anchor**, correctly *retained*).
- **DEC-S4-B — dashboard grid collapse (implementation; minor).** With the right
  column's sole occupant gone, **recommendation: collapse to a single column** —
  drop the `grid lg:grid-cols-[…]` wrapper **and both** inner column `<div>`s, and
  render `<AssignmentsCard />` + `<RecentAttemptsCard />` directly in the existing
  `flex flex-col gap-6` stack. Cleanest; no empty column, no dangling grid track.
  Alt: keep a centered max-width container so the cards don't run full-bleed on
  wide viewports — a lighter design call. Surface for confirmation; defaulting to
  the straight single-column collapse.
  - **Wide-viewport appearance (resolves auditor S4-2; surfaced for design,
    not gating).** Below `lg` the dashboard is *already* single-column (the
    `lg:grid-cols-[…]` only splits at `lg`+), so **mobile is unchanged** by the
    collapse and the `@375px` e2e overflow check is unaffected. At `lg`+ the
    straight collapse renders the two cards **full-width** (vs the prior `1fr` +
    `360px`), which can read as stretched — exactly what the max-width Alt
    addresses. **Flag the wide-screen choice (full-width stack vs max-width) for
    product/design confirmation.** Purely visual — no correctness or test impact
    (no test asserts the grid structure).

### Files touched (verified)

1. **`frontend/src/app/(authed)/(testee)/page.tsx`** — remove the `import {
   AdaptiveLoopCard } from "@/components/dashboard/AdaptiveLoopCard";` (`:24`) and
   the `<AdaptiveLoopCard />` mount (`:52`); **collapse the grid** per DEC-S4-B
   (remove the `grid`/`lg:grid-cols-[…]` wrapper + both column `<div>`s; the two
   surviving cards stack in one `flex flex-col gap-6`). Builds on the **S2 version**
   of this file (S1 rewrote the docstring; S2 removed `<TodaysReading/>`); S4 is the
   last of the S1→S2→S4 `page.tsx` chain (preamble `:70-71`).
2. **`frontend/src/components/dashboard/AdaptiveLoopCard.tsx`** — **delete** (whole
   file). Sole consumer (`page.tsx`) updated above. **Do NOT** touch the result-page
   card (`components/result/…`) or `lib/result/adaptive-loop-format.ts`.

### Tests (paired in the same commit)

1. **`frontend/tests/pages/dashboard.test.tsx`** — building on the **S2 version**:
   - **Card-presence test** (the S2-renamed "renders AssignmentsCard +
     AdaptiveLoopCard"): drop the `adaptive-loop-card` assertion, rename to
     `"renders AssignmentsCard + RecentAttemptsCard"`, and **add a negative
     assertion** `expect(screen.queryByTestId("adaptive-loop-card")).not.to
     BeInTheDocument();` — *after* the existing awaited `findByTestId
     ("assignments-card")` barrier (S2-1 lesson; no vacuous pre-paint pass).
   - **Remove** the `"adaptive-loop CTAs toast (placeholder until v1.x wiring)"`
     test (`:109-117`) entirely — its subject (the two CTAs) no longer exists.
     This is correct-by-construction removal (the widget is ruled out), **not** an
     R4 stub-drop; there is no live behavior left to cover (the *real* loop CTAs,
     if any, live on the result page and are out of this file's scope).
   - **Remove the now-dead `sonner` scaffolding** that only served that test: the
     `vi.mock("sonner", …)` block (`:38-40`), the `import { toast }` (`:41`), and
     the `vi.mocked(toast).mockClear()` in `beforeEach` (`:69`) — grep-confirmed no
     other `toast` use in the file (leaving them would be dead mock state; `tsc`/
     lint would flag the unused import).

### Edge cases & corner cases

- **Wrong-card deletion** — the single most important check: delete
  `components/dashboard/AdaptiveLoopCard.tsx`, **never** `components/result/…`.
  `result/page.tsx:144` must still import and render its card with
  `steps`/`status` props after this slice; `pnpm typecheck` + the result-page
  tests are the backstop.
- **Grid reflow** — after collapse, `AssignmentsCard` + `RecentAttemptsCard` stack
  full-width in one column; verify no orphaned `lg:grid-cols` track or empty
  `<div>` remains (DEC-S4-B). Hero `mb-8` still supplies the hero→stack gap (per
  the Slice-2 S2-3 grounding).
- **No async states** — the dashboard card had no data dependency; removal cannot
  introduce a loading/empty/error path (contrast Slice 1).

### Gotchas

- **Two same-named components** — `AdaptiveLoopCard` exists in both
  `components/dashboard/` (delete) and `components/result/` (keep). Import paths
  disambiguate; deleting the dashboard module leaves the result import intact.
- **`adaptive_loop` (wire type) stays** — `api.d.ts:1900` `adaptive_loop:
  LoopStep[]` and the MSW `adaptive_loop: []` defaults (`handlers.ts:748,782`,
  `GradingOverlay.test.tsx`) feed the **result** card — untouched.
- **Spec gate** — Slice 4 *execution* waits for the FE-3 amendment striking the
  dashboard-card refs (DEC-S4-A; recommended fold into the D5 PR). Detail-planning
  proceeds now (removal forced by D4).
- **`page.tsx` / `dashboard.test.tsx` are shared** — see the cross-slice note
  below.

### Cross-slice note — `page.tsx` + `dashboard.test.tsx` across S1 → S2 → S4

These two files are mutated by three slices; execution serializes **S1 → S2 → S4**
(preamble `:70-77`). Rebase-order ownership, so no edit clobbers another:

- **`page.tsx`:** S1 rewrites the `:9-12` docstring (HeroStats container; leaves
  both card mounts). S2 removes the `<TodaysReading/>` import+mount. S4 removes the
  `<AdaptiveLoopCard/>` import+mount **and** collapses the grid (DEC-S4-B). Net
  after S4: `ResumePrompt` · `HeroStats` · single-column `AssignmentsCard` +
  `RecentAttemptsCard`.
- **`dashboard.test.tsx`:** S1 rewrites the header invariant + the hero
  placeholder→live test + adds `resetMockMeCompetence/Attempts`. S2 renames the
  card-presence test and adds the negative `todays-reading` assertion. S4 drops the
  `adaptive-loop-card` assertion (renames again) + adds its negative assertion, and
  removes the CTA-toast test + the `sonner` scaffolding. Each slice touches
  disjoint lines except the one shared card-presence test, which is edited in
  S2-then-S4 order.

### Acceptance assertions (executing session verifies)

- The dashboard renders no `adaptive-loop-card`, no "Two weak areas…" copy, and no
  `toast` CTAs; `queryByTestId("adaptive-loop-card")` is `null`.
- `components/dashboard/AdaptiveLoopCard.tsx` no longer exists; the **result-page**
  `AdaptiveLoopCard` (+ `lib/result/adaptive-loop-format.ts`) is untouched and its
  tests still pass.
- The dashboard grid is single-column (no empty track); `ResumePrompt` · `Hero` ·
  `AssignmentsCard` · `RecentAttemptsCard`.
- `pnpm test` green (incl. the edited `dashboard.test.tsx`, no dead `toast` mock),
  `pnpm typecheck` + `pnpm lint` clean (no unused `sonner` import), Playwright
  unaffected.

### Dependencies

- **External (execution-gating):** the FE-3 amendment striking the dashboard
  AdaptiveLoopCard refs (DEC-S4-A — recommended fold into the D5 PR).
- **Intra-PR:** **upstream** S1 (page.tsx docstring + dashboard.test.tsx hero
  rewrite) and S2 (page.tsx TodaysReading removal + card-presence rename) — S4 is
  the **last** of the S1→S2→S4 chain; build in that order.

### Complexity estimate

Small. One file deletion + a ~6-line `page.tsx` edit (mount/import removal + grid
collapse) + a `dashboard.test.tsx` edit (one assertion flip, one test + mock
removal). Net mostly deletions (~90 lines removed, ~3 added); one commit.

**Status: final for Slice 4 — approved by planner.** Round-1 auditor findings
(both worth-knowing, no gating defect) folded: **S4-1** — DEC-S4-A is the *second*
FE-3 scope expansion onto the D5 PR; added the **cumulative-D5-scope** note (one
combined doc-only PR now carries the original ruling + DEC-S2-A + DEC-S4-A; S1+S2+S4
execution all gate on it; spec author confirms the cumulative expansion; tracked on
the global gate). Auditor mirror-sweep-verified the enumeration complete with AC-D6
correctly retained. **S4-2** — DEC-S4-B wide-viewport appearance surfaced for
product/design confirmation (full-width vs max-width; mobile unchanged, no
correctness/test impact). Set-diff round-0→round-1: 2 finding IDs, none dropped.
Awaiting the auditor's per-slice "Slice 4 approved" before Slice 5 is pushed.

**Status: final for Slice 4 — approved by auditor.** Both round-1 findings (both
worth-knowing, no gating defect) resolved and re-verified at source against
`265b0df`: **S4-1** — DEC-S4-A's cumulative-D5-scope note added (the one combined
FE-3 PR now carries the original ruling + DEC-S2-A + DEC-S4-A; S1+S2+S4 execution
all gate on it; spec author confirms the cumulative expansion); **S4-2** —
DEC-S4-B wide-viewport appearance surfaced for product/design confirmation.
Grounding verified true against `main`: the **two same-named `AdaptiveLoopCard`
components** are distinct (delete `components/dashboard/AdaptiveLoopCard.tsx`
Pascal; keep `@/components/result/adaptive-loop-card` kebab, `result/page.tsx:30/144`)
— the critical wrong-card-deletion check; deletion surface fully bounded;
`sonner`-mock removal safe (no other dashboard component uses `toast`); DEC-S4-A
mirror-sweep complete with AC-D6 correctly retained (not retired); test removals
correct-by-construction. Set-diff: 2 finding IDs, none dropped. No workflow-rule
violations. Slice 4 sealed.

---
