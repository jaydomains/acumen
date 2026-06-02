# FE-3 — Testee content surface (detail spec)

> **Status:** plan-mode authored, ready for build session.
> **Owns:** testee dashboard, catalogue browse, pill detail (standard + safety branches), on-page learning-material consumer, query-key + invalidation library.
> **PR target:** `PR-NNN-fe3-content` (one squash PR closes the build phase per FE_ROADMAP discipline). This doc PR is its own slice.
> **Anchors:** AC-D3 (test access model), AC-D6 (adaptive loop — safety-pill carve-out), AC-D7 (catalogue: subjects + pills), AC-D8 (self-directed pill discovery), AC-D9 (band stamp + `competence_estimate` — referenced in stats and difficulty selection), AC-D20 (calibration confidence qualifier — surfaced via the FE-2 `BandTag` `confidence` prop), AC-D21 (safety pills + curated external links), AC-D26 (assignment engagement tracking), AC-CD6 (error envelope), AC-CD19 (FE stack), AC-CD20 (routing/guards), AC-CD21 (query+form+errors), AC-CD23 (token discipline), AC-CD24 (figure stubs — type-only, not exercised by FE-3).
>
> This is the **third per-page FE detail spec.** Template inheritance: per-page §B from `fe-specs/FE-1-auth.md` (verbatim — FE-3 is content-page-heavy like FE-1, not primitive-heavy like FE-2). Deviating from the template in FE-4+ is itself spec drift.
>
> **Amendment (2026-06-02 — testee-FE-completion workstream).** This doc is
> amended in place to reflect the rulings and detail-plan decisions made during
> the testee-FE-completion planning loop (PR #84 plan, PR #85 detail-plan, both
> merged). Authoritative sources: the **D1–D7 ruling** (PR #85 comment
> [`4596569727`](https://github.com/jaydomains/acumen/pull/85#issuecomment-4596569727)),
> the **HeroStats-container clarification** (PR #85 comment
> [`4596639182`](https://github.com/jaydomains/acumen/pull/85#issuecomment-4596639182),
> which supersedes that ruling's ":92 prop contract" line), and the detail-plan
> decisions **DEC-S2-A** / **DEC-S4-A**. Four changes: (a) `GET /v1/me/competence`
> and `GET /v1/me/assignments` are **live and mounted** (`app/routers/competency.py`
> `/v1/me` prefix, `app/main.py:154`) — the "unmounted" / "v1.x-pending" default
> state is dropped (D5); (b) **HeroStats is a container** that owns its data hooks
> and derives its stats internally, props stay `{ displayName, dateLabel }` (F3);
> (c) the **Today's Reading** widget is **removed for v1** (D2 / DEC-S2-A —
> GREETINGS retained); (d) the **dashboard AdaptiveLoopCard** is **removed for
> v1** (D4 / DEC-S4-A — AC-D6 and the result-page adaptive-loop card retained).
> Out of scope, surfaced for separate triage: the catalogue per-card competence
> overlay (§B.2 / §E item 7) — the endpoint is live but that overlay feature is
> not wired, and that section was not re-grounded in the detail-plan audit.

---

## 0. Context

FE-0 (PR-032) shipped the Next.js 15 / App Router scaffold, the typed `openapi-fetch` client with `unwrap()`, the auth context (memory access + localStorage refresh + 401 dedup-retry), an empty `components/ui/.gitkeep`, and a minimal `globals.css` placeholder. FE-1 (PR #38) and FE-2 (PR #39) **locked specs but did not ship builds** — the FE-3 build presumes both prior builds land first per FE_ROADMAP dependency order. This doc PR is the third sibling spec; FE-3 build cannot open until FE-1 build and FE-2 build are merged on main (see §H (a) item 1).

**FE-1 spec preconditions for the FE-3 build session:** auth surfaces (`/login`, `/forgot`, `/reset/[token]`, `/setup/[token]`, `/privacy`); AuthContext extended with `refresh()` and `setUserPrivacyAck()`; `applyApiErrorToForm` helper at `frontend/src/lib/api/form-errors.ts`; error-display patterns A/B/C; route guards (`requireAuthed`, `requireRole`, `requirePrivacyAck`) at `frontend/src/lib/auth/guards.ts`; `QueryClientProvider` + `<Toaster />` mounts in `app/layout.tsx`.

**FE-2 spec preconditions for the FE-3 build session:** full shell composition (`Rail`, `TopBar`, `PageHeader`, `AvatarMenu`, `ThemeToggle`); design-token discipline per AC-CD23 (full `globals.css` token system, hard corners `--r: 0`, paper theme as v1 default with FOUC bootstrap script); primitives at `frontend/src/components/primitives/` — `Stat`, `BandTag` (props `{ band, withLabel?, withPips?, estimate?, confidence?: "preliminary" | "confident" }` — `confidence` is the AC-D20 surface), `BandPips`, `Pill`, `Icon`, `Figure`/`InlineFigure`/`ChoiceFigure` (typed stubs); shadcn install (Button, Card, Input, Select, Dialog, DropdownMenu, Tabs, Toast, **Skeleton** — confirmed in FE-2 spec, no further install needed in FE-3); `(testee)/layout.tsx` mounting the testee shell with role guard; `(testee)/page.tsx` empty dashboard shell that FE-3 replaces (route ambiguity recorded in §H (b) item 1).

**What FE-3 builds:**

1. **Testee dashboard** (route per §H (b) item 1) — hero (greeting + 3 stats), Assigned-to-you card, Your-last-attempts card. Today's Reading and the Adaptive-loop accent card are **removed for v1** (D2 / D4 — see the amendment banner). Recommended-for-you is **dropped from FE-3** per the user-locked decision (no AC anchor, no backend endpoint); deferred via FE_ROADMAP non-goal — see §F.
2. **Catalogue browse** (`/catalogue`) — search + subject filter + pill cards. Server-side filter by `subject_id` / `difficulty` / `search`; cursor-based pagination per the locked AC-CD21 conventions extended in §C.
3. **Pill detail** (`/pills/[pillId]`) — left meta card + right learning-material consumer + sticky difficulty bar. Branches on `safety_relevant`: AI explainer for standard, curated external links for safety (AC-D21).
4. **Query-key + invalidation library** at `frontend/src/lib/queries/*` — central source of truth for FE-3+ query keys per AC-CD21.

**Done-when (verbatim from FE_ROADMAP):** *Testee can browse the catalogue, open a pill, view learning material, and reach the "start attempt" entry point. Recent attempts widget either ships behind a feature flag or waits on the `GET /v1/attempts` spec-drift PR.* FE-3 ships the feature-flag path.

**Scope boundary — what FE-3 explicitly does NOT ship:**

- **Dedicated Learning Center** (FE_ROADMAP non-goal, set in PR #38): *Dedicated Learning Center (progress tracking, lesson sequences, recommended-next-pill, bookmarks) — deferred to v1.x. v1 training surface is the pill detail page (FE-3) consuming POST /v1/pills/{id}/learning-material (PR-031) on page load.*
- **Dedicated Testee-facing pill recommendations** (FE_ROADMAP non-goal added by this PR, see §F.1).
- **Attempt runner UI.** `POST /v1/attempts` is reached as an entry-point CTA only; the runner itself is FE-4. The "Practice at D{n}" CTA destination is pending §H (b) item 3.
- **Per-Testee competence breakdown UI.** AC-D9 `competence_estimate` per-pill visualisations are FE-7 (constellation + matrix view), not FE-3. Dashboard hero stats reference aggregate values; PillCards optionally show a per-pill band+estimate when `GET /v1/me/competence` lands.
- **Related-pill edges on pill detail.** Deferred to v1.x per PR-033 D3.
- **Image rendering inside `<Figure>` / `<InlineFigure>` / `<ChoiceFigure>`.** FE-3 does not exercise the non-null branch per AC-CD24; the primitives stay typed stubs.

**Additions to `(testee)/layout.tsx`:** none anticipated. If the build session discovers a need for a layout-level provider (e.g., a feature-flag context above the page tree), surface as scope addition per §F.

---

## A. Page/feature inventory

| # | Capability | Route | Design source | Screenshot |
|---|---|---|---|---|
| 1 | Testee dashboard | per §H (b) item 1 | `testee.jsx:73–197` (TesteeDashboard) + `testee.jsx:7–68` (GREETINGS — greeting copy; TodaysReading/READINGS removed per D2) + `testee.jsx:199–222` (AssignmentRow) | `testee.jsx` accepted as canonical · screenshot absent (user-locked at plan exit; recorded in §F.2) |
| 2 | Catalogue browse | `/catalogue` (TESTEE_NAV id `catalogue`, label "Discover") | `testee.jsx:243–275` (TesteeCatalogue) + `testee.jsx:277–302` (PillCard) | `testee.jsx` accepted as canonical · screenshot absent (user-locked at plan exit; recorded in §F.2) |
| 3 | Pill detail (standard) | `/pills/[pillId]` | `pill-detail.jsx:13–68` (PillDetailMock) + `pill-detail.jsx:73–122` (PillMetaCard, Meta) + `pill-detail.jsx:148–292` (MaterialLoading, MaterialReady, CodeishExample) + `pill-detail.jsx:420–459` (StickyDifficultyBar) | `v6-fe3-09-pill-detail.png` |
| 4 | Pill detail (safety branch) | same route, `safety_relevant: true` | `pill-detail.jsx:124–143` (SafetyPosterCard) + `pill-detail.jsx:297–415` (SAFETY_LINKS array, SafetyLinks, SafetyLink, SafetyEmpty) | `01-v6-fe3-10-safety-pill.png` |
| 5 | Query keys + invalidation library | `frontend/src/lib/queries/*` (new) | n/a (convention library) | n/a |

> **Note on design-reference completeness (per SESSION_START.md §F.2 of FE-1).** No `v6-fe3-*-dashboard.png` or `v6-fe3-*-catalogue.png` is in `frontend/design-reference/screenshots/`. Per the completeness rule this would normally be a §H (a) blocker; the user locked at plan exit to accept `testee.jsx` as the canonical design source for dashboard and catalogue. Absence recorded in §F.2 so future visual-content sweeps can backfill without re-litigation.

---

## B. Per-page detail specs

> **Template** (used identically for every page; propagates to FE-4..FE-9 verbatim):
> 1. Route segment + URL state
> 2. Components (scaffold reused / new in this PR / shadcn primitive / design primitive)
> 3. API endpoints consumed
> 4. Form fields + zod rules + react-hook-form integration shape (or "n/a — read-only page" with TanStack Query data-fetching notes)
> 5. States (every variant from the design state-strip + any extras the wire surfaces)
> 6. Acceptance criteria (Gherkin — each trio maps to one Vitest test)
> 7. Edge cases / gotchas
> 8. Visual reference

### B.1 Testee dashboard — route per §H (b) item 1

**1. Route segment + URL state**

- File path: per the §H (b) item 1 resolution at build-session open. FE_CHECKLIST FE-3 row names `frontend/src/app/(testee)/dashboard/page.tsx`; FE-2 spec mounts `(testee)/page.tsx` as the empty dashboard. The build session reads FE-2 spec verbatim, picks the canonical location, and updates the other reference to match. TESTEE_NAV id is `dashboard` per `shell.jsx:6–12`.
- Route group: `(testee)` (composed with `(authed)` via layout per AC-CD20).
- URL params: none.
- Query state: none in v1.
- Post-action routing:
  - "Browse all" on Recommended-section header (deprecated — see §2; the dashboard ships with the section dropped) — n/a.
  - "Start" / "Resume" on `AssignmentRow` → `/pills/[pillId]` (or directly into attempt runner per §H (b) item 3 resolution).
- Client component (TanStack Query, useState for AssignmentsCard segmented control).

**2. Components**

*Scaffold reused (from FE-2 — preconditions per §0):*
- `Stat` — `{ value, label, hint?, tone? }`. Three instances in the hero.
- `BandTag` — `{ band, withLabel?, withPips?, estimate?, confidence? }`. Not directly used on dashboard hero, but on `AssignmentRow` if assignment payload carries band data.
- `Pill` — `{ tone?, mono?, children }`. Tones: `warn` (Mandatory), `accent` (Follow-up).
- `Icon` — name-based stroke-SVG (`compass`, `attempt`, `graph`, etc.).
- shadcn `Card`, `Button`, `Skeleton`, `Tabs` (the segmented control).

*New in this PR:*
- `HeroStats` (`frontend/src/components/dashboard/HeroStats.tsx`) — **container** that composes the greeting/eyebrow row plus three `Stat`s. Props stay `{ displayName, dateLabel }` (no data props). HeroStats **owns** `useMeCompetence()` + `useMeAttemptsCapped()` and derives `overallCompetence` / `pillCount` / `workingPlusCount` / `streakDays` **internally** from the hook results; loading / empty / error / populated state management lives inside the component. (Per the F3 clarification — comment `4596639182` — this supersedes the earlier presentational data-props contract: the container pattern matches the sibling `AssignmentsCard` / `RecentAttemptsCard`, co-locates fetching with the consumer, and removes the `page.tsx`↔HeroStats coordination point. There is no v1.x-pending default state; null competence renders an honest empty state per §5.)
- `AssignmentsCard` (`frontend/src/components/dashboard/assignments-card.tsx`) — segmented control (All / Mandatory / Follow-ups) + list of `AssignmentRow`. Props: `{ assignments: AssignmentRowVM[] }`. Local state: `tab: "all" | "mandatory" | "follow-ups"`.
- `AssignmentRow` (co-located in `assignments-card.tsx`) — single line matching `testee.jsx:199–222`: subject colour bar + pill name + tags (Mandatory / Follow-up) + metadata + Start/Resume button.
- `RecentAttemptsCard` (`frontend/src/components/dashboard/RecentAttemptsCard.tsx`) — list of recent attempt rows matching `testee.jsx:149–175`. Consumes `GET /v1/attempts` via `useMeAttemptsCapped(5)`; live in v1 since the FE-7 flag-flip (`GET /v1/attempts` landed under LOCK-1). Rows click-through to `/attempts/{attempt_id}/result`.

*Removed from FE-3 for v1 (D2 / D4):* `TodaysReading` (fabricated-editorial widget — D2 / DEC-S2-A) and the dashboard `AdaptiveLoopCard` (hardcoded-narrative widget with no-op CTAs — D4 / DEC-S4-A; the **real** per-attempt adaptive-loop card on the result page is retained). *Dropped from FE-3 per user lock:* `RecommendedCard`, `RecommendPillCard` — see §F.1.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/me/competence` | Hero stats (overall competence, pills at working+, derived from per-pill `competence_estimate` per AC-D9 and band tags per AC-D20) | **LIVE** — mounted at `app/routers/competency.py` (`/v1/me` prefix), included in `app/main.py:154`. HeroStats consumes via `useMeCompetence()`; null/empty competence renders an honest empty state (not v1.x-pending) per §5. |
| `GET /v1/me/assignments` | Assigned-to-you card. Surfaces AC-D26 `engagement_status` per assignment | **LIVE** — `GET /v1/me/assignments` mounted at `app/routers/competency.py` (`/v1/me` prefix); `AssignmentsCard` consumes via `useMeAssignments()`. |
| `GET /v1/attempts` | Recent attempts card (capped to 5) | **LIVE** — LOCK-1 `Page<AttemptListItem>` envelope landed in FE-7; flag-flip wired the card via `useMeAttemptsCapped(5)`. |

Day streak: **client-derived from `GET /v1/attempts` history (no backend needed)** — HeroStats derives it internally via a pure helper over the attempts' `submitted_at` values; it is part of the container's owned data, not a deferred placeholder.

**4. Form fields + zod rules + react-hook-form integration shape**

n/a — dashboard is read-only. Data fetching via TanStack Query per AC-CD21:

- Query keys: `['me', 'competence']`, `['me', 'assignments']`, `['me', 'attempts']`. Centralised in `frontend/src/lib/queries/me.ts` per §B.5 / §C.2. The capped recent-attempts entry is namespaced `[...attempts(), 'capped', {limit:5}]`, distinct from the profile-page cap of 200 (FE-7).
- Default `staleTime: 30_000` per AC-CD21.
- No mutations on this page.
- All three hero/assignments/attempts queries **fire** against their live `/v1/me/*` and `/v1/attempts` endpoints; there is no "endpoint absent" guard. Per-card failures surface honestly per §5 (empty ≠ error), never as fabricated or "pending" copy.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| Initial load | First render | Hero with skeleton `Stat`s; AssignmentsCard skeleton |
| Hero loaded | `GET /v1/me/competence` resolves | Hero stats populated with overall competence (1 dp), pills-at-working+ count, day streak; "across N pills" hint resolved |
| Hero empty (new testee) | competence resolves with `pills: []` | overall "—" + hint "No attempts yet"; pills-at-working+ "0/0"; day streak still derived from `/v1/attempts` (may be non-zero for a self-initiated attempt) — never "pending" copy |
| Hero error | `GET /v1/me/competence` (or `/v1/attempts`) query throws | the affected stats render "—" with a neutral "Unavailable" hint (distinct from the empty "No attempts yet"); a fetch failure never masquerades as an honest empty/zero state |
| Assignments loaded | Array resolved | `AssignmentRow` list; segmented control filters in-memory |
| Assignments empty | Empty array | "No outstanding items" copy in card body |
| Recent attempts loading | Capped query in flight | Card rendered with "Loading…" copy |
| Recent attempts loaded | Query resolves with rows | List of up to 5 attempts: pill name + when · origin · score (mono) · delta (green/red, or "—" while `competence_delta` ships null on the wire) |
| Recent attempts empty | Query resolves with `[]` | Card body reads "No attempts yet — your last results will appear here." |
| Recent attempts error | Query throws | Card body reads "Couldn’t load recent attempts." |
| Error (any per-card query) | Query throws ApiError | Per-card inline error with Retry button (Pattern A per AC-CD21) |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Dashboard hero renders the Testee's greeting and name
  Given an authenticated Testee with name "Joana"
  When the Testee navigates to the dashboard
  Then the hero renders a greeting and the title "Welcome back, Joana."

Scenario: Hero renders real competence stats from the live endpoint
  Given GET /v1/me/competence resolves with the Testee's per-pill profile
  When the Testee navigates to the dashboard
  Then a GET /v1/me/competence request fires
  And the OVERALL COMPETENCE stat renders the mean estimate to one decimal place
  And the PILLS AT WORKING+ stat renders "{workingPlusCount}/{pillCount}"
  And the DAY STREAK stat renders a value derived from GET /v1/attempts history

Scenario: Hero renders an honest empty state for a new Testee
  Given GET /v1/me/competence resolves with an empty pill set
  When the Testee navigates to the dashboard
  Then the OVERALL COMPETENCE stat renders "—" with the hint "No attempts yet"
  And the PILLS AT WORKING+ stat renders "0/0"
  And no "v1.x" or "pending" copy is shown

Scenario: AssignmentsCard segmented control filters mandatory assignments
  Given the Testee has 2 mandatory and 1 optional assignment loaded
  When the Testee clicks the "Mandatory" tab
  Then exactly 2 AssignmentRows are visible

Scenario: Recent attempts card renders the Testee's last 5 attempts
  Given the Testee has at least 5 submitted attempts
  When the Testee navigates to the dashboard
  Then the "Your last attempts" card renders
  And exactly 5 attempt rows are visible
  And a GET /v1/attempts?limit=5 request fires
  And each row click routes to /attempts/{attempt_id}/result
```

**7. Edge cases / gotchas**

- **Auth posture flicker.** `(testee)/layout.tsx` (FE-2) gates render on auth resolution; the dashboard must not flash content to an unauthenticated user. The layout guard already handles this; verify in the build session.
- **Empty ≠ error.** The hero evaluates the empty branch (`pills: []`) and the error branch (query throws) **independently per query** — competence may error while attempts succeed, or vice-versa. The error copy ("Unavailable" / "—") must never reuse the empty copy ("No attempts yet" / "0/0"), which would misrepresent a returning Testee's real state.
- **AssignmentRow CTA semantics.** "Start" vs "Resume" depends on the assignment having `progress > 0` (or equivalent). If the payload shape lacks a progress field, default to "Start" and surface as a build-session finding.
- **Skeleton heights must match real-content heights** to avoid layout shift on hero / AssignmentsCard resolve.

**8. Visual reference**

- `testee.jsx:73–197` (TesteeDashboard) · `testee.jsx` accepted as canonical (screenshot absent per §F.2)
- `testee.jsx:21–68` (GREETINGS — greeting copy; TodaysReading/READINGS removed per D2) · same
- `testee.jsx:199–222` (AssignmentRow) · same
- `testee.jsx:149–175` (recent-attempts card) · same

### B.2 Catalogue browse — `/catalogue`

**1. Route segment + URL state**

- File path: `frontend/src/app/(testee)/catalogue/page.tsx`.
- Route group: `(testee)`.
- URL params: none.
- Query state (URL-synced): `?search={text}&subject={uuid}&difficulty={n}&cursor={cursor}`. URL is source of truth; filter inputs hydrate from URL on first render. Filter changes call `useRouter().replace()` (Next.js App Router).
- Post-action routing: `PillCard` click → `/pills/[pillId]`. The "Open links" CTA on safety pills routes to the same `/pills/[pillId]` (the safety-branch rendering happens server/client-side on the detail page).
- Client component.

**2. Components**

*Scaffold reused (from FE-2):*
- `PageHeader` — eyebrow ("Catalogue · N pills · M subjects"), title with `serif-it` span ("Find what you need to learn."), subtitle paragraph (verbatim from `testee.jsx:255–257`, paragraph that mentions safety-tagged pills linking out to curated industry sources — AC-D21 framing pre-stated at the page header level).
- `BandTag`, `Pill`, `Icon`, `Stat`.
- shadcn `Input` (search), `Card` (pill card frame), `Button`, `Skeleton`.

*New in this PR:*
- `FilterBar` (`frontend/src/components/catalogue/filter-bar.tsx`) — debounced text search (300ms) + subject `.seg`-style button group. Props: `{ subjects: Subject[], value: FilterState, onChange: (next: FilterState) => void }`.
- `PillCard` (`frontend/src/components/catalogue/pill-card.tsx`) — single catalogue card matching `testee.jsx:277–302`. Props: `{ pill: PillResponse, subject: Subject, perTesteeData?: { band, estimate, attemptCount, lastDays } | null }`. Behaviour:
  - Renders subject (uppercase, colour bar) + safety badge (if `pill.safety_relevant`) + pill name.
  - If `perTesteeData` is non-null: renders `<BandTag band={...} estimate={...} confidence={...} />`, attempt-count badge, progress bar, "Last activity Nd ago" footer.
  - If `perTesteeData` is null (drift): omits the per-Testee row entirely; renders only subject + name + safety badge + Practice/"Open links" CTA. See §E item 7.
  - CTA text: `pill.safety_relevant ? 'Open links' : 'Practice'`.
- `CatalogueGrid` (co-located on page) — responsive grid wrapping `PillCard`s; uses `useInfiniteQuery` pagination per §C.5.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/catalogue/pills` | List + filter + paginate. Per AC-D7 / AC-D8, only pills with `discoverable: true` should appear in the testee catalogue; the response shape includes `discoverable: boolean` per pill. See §H (b) item 4. | **Implemented.** Query params: `cursor`, `limit` (default 50, max 200), `subject_id?`, `difficulty?` (1–10), `search?` (max 255). Response: `{ data: PillResponse[], meta: { next_cursor: string \| null } }`. `PillResponse` carries `id`, `subject_id`, `name`, `description`, `available_difficulty_min`, `available_difficulty_max`, `discoverable`, `safety_relevant`, `estimated_minutes`, `retired_at`, `created_at`, `updated_at`. |
| `GET /v1/catalogue/subjects` | Subject list for filter row | **VERIFY** — §H (b) item 5. Fallback if absent: derive subjects from the pages already loaded (UX trade: filter bar only fills as pages stream). |
| `GET /v1/me/competence` | Per-card band/estimate/last-activity overlay | **DRIFT** — see §H (a) item 5. v1 fallback: PillCards omit per-Testee data (§E item 7). |

**4. Form fields + zod rules + react-hook-form integration shape**

n/a — catalogue is read-only with URL-synced filter state, not a form. Data fetching:

- Filter state shape: `{ search?: string, subject_id?: string, difficulty?: number }`. URL → state on first render; state → URL on change.
- Query: `useInfiniteQuery({ queryKey: ['catalogue', 'pills', filterState], queryFn, getNextPageParam: last => last.meta.next_cursor })`.
- `staleTime: 30_000` per AC-CD21.
- Search debounce: 300ms idle before URL write + query fire.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| Initial load | First render | PageHeader rendered, FilterBar rendered, grid renders 6 skeleton cards |
| Loaded with results | Pills query resolves with data | Grid of `PillCard`s |
| Loaded empty (no filters) | Backend returns zero pills, no filter applied | "No pills in catalogue yet" empty state |
| Loaded empty (filtered) | Filters applied, zero matches | "No pills match your filters" + Clear filters action |
| Loading next page | User scrolls to grid sentinel | Sentinel + 3 skeleton cards appended |
| Error | Query throws ApiError | Boundary card per AC-CD21 Pattern C |
| Search debouncing | User typing in search input | Input echoes immediately; query fires after 300ms idle |
| Per-Testee overlay missing | `GET /v1/me/competence` absent (v1 default) | `PillCard`s render without band / estimate / last-activity row (see §E item 7) |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Initial catalogue loads with the default page size
  Given GET /v1/catalogue/pills returns 50 pills with safety_relevant=false for all
  When the Testee navigates to /catalogue
  Then 50 PillCards render in the grid
  And no card shows the "Safety" badge

Scenario: Subject filter narrows the list and updates the URL
  Given GET /v1/catalogue/pills?subject_id=X returns 12 pills
  When the Testee clicks the subject X button in the FilterBar
  Then the URL updates to /catalogue?subject=X
  And the grid renders 12 PillCards

Scenario: Search input debounces
  Given the Testee is on /catalogue
  When the Testee types "anti" in the search input
  Then no GET /v1/catalogue/pills request fires within 100ms
  And exactly one GET /v1/catalogue/pills?search=anti request fires by 350ms

Scenario: Filtered empty state surfaces a Clear filters action
  Given the current filter yields zero pills
  When the page renders
  Then the empty state shows a "Clear filters" button
  And clicking it removes all filter query-params from the URL

Scenario: Pagination loads the next page on sentinel intersection
  Given the first page returns next_cursor=abc
  When the Testee scrolls to the grid sentinel
  Then GET /v1/catalogue/pills?cursor=abc fires once

Scenario: PillCard click routes to pill detail
  Given a PillCard for pillId=P is rendered
  When the Testee clicks the card
  Then the Testee navigates to /pills/P

Scenario: Safety-pill PillCard CTA reads "Open links" not "Practice"
  Given GET /v1/catalogue/pills returns a pill with safety_relevant=true
  When the page renders
  Then that card's CTA text is "Open links"

Scenario: Direct deep-link with filter query-params hydrates the FilterBar
  Given the Testee navigates directly to /catalogue?subject=X&search=anti
  When the page renders
  Then the FilterBar reflects subject=X selected and search input value="anti"
  And GET /v1/catalogue/pills?subject_id=X&search=anti fires
```

**7. Edge cases / gotchas**

- **URL ↔ filter state round-trip.** Direct deep-link must hydrate the FilterBar; filter changes must update the URL via `replace` (not `push`) to avoid polluting browser history with every keystroke.
- **Subjects endpoint absence.** If `GET /v1/catalogue/subjects` doesn't exist (§H (b) item 5), the FilterBar derives subjects from already-loaded pages — which means "All" is fine but per-subject buttons fill in lazily. Block on at least one page resolving before rendering the per-subject buttons to avoid an empty filter row on first paint.
- **Per-Testee data on PillCards.** If `GET /v1/me/competence` is absent, render PillCards without band/estimate/last-activity (drop those rows). Do not fake the data.
- **Search debounce + URL writes.** URL writes and query fires are coupled to the same 300ms debounce; do not write the URL on each keystroke or the browser back-button becomes useless.
- **Safety-pill visual differentiation.** PillCard reads `pill.safety_relevant` (the backend field — the prototype's `pill.safety` shorthand maps to this). Renders a `<Pill tone="danger" mono>Safety</Pill>` badge in the card header.
- **`discoverable` flag handling.** Per AC-D7 / AC-D8, Testees only see pills with `discoverable: true`. The build session verifies whether `GET /v1/catalogue/pills` filters server-side; if not, client filters in the query selector. See §H (b) item 4.
- **Cursor pagination must round-trip with filter changes.** Changing a filter resets the cursor to undefined; verify TanStack Query's `useInfiniteQuery` invalidates the prior pages when the queryKey changes.

**8. Visual reference**

- `testee.jsx:243–275` (TesteeCatalogue) · `testee.jsx` accepted as canonical (screenshot absent per §F.2)
- `testee.jsx:277–302` (PillCard) · same

### B.3 Pill detail (standard) — `/pills/[pillId]`

**1. Route segment + URL state**

- File path: `frontend/src/app/(testee)/pills/[pillId]/page.tsx`.
- Route group: `(testee)`.
- URL params: `pillId` (path segment).
- Query state: none in v1 (difficulty selection is local React state — not URL-synced because the URL is meant to be shareable as "this pill", not "this pill at D7").
- Post-action routing: "Practice at D{n}" → resolved per §H (b) item 3 (pill+difficulty → test resolution endpoint, or alternative attempt-creation surface, or stop at the entry-point landing).
- Client component.

**2. Components**

*Scaffold reused (from FE-2):*
- `BandTag`, `Pill`, `Icon`.
- shadcn `Card`, `Button`, `Skeleton`.

*New in this PR:*
- `PillMetaCard` (`frontend/src/components/pill-detail/pill-meta-card.tsx`) — left column matching `pill-detail.jsx:73–122` (PillMetaCard + Meta). Composition: eyebrow ("About this pill"), `Meta` rows (Subject coloured-dot row, Difficulty range "D1 – D{N}" mono, Your current band → `<BandTag>`, Competence value `pill.competence.toFixed(1)` + attempt count, Last activity `Nd ago`), divider, Description block (uses pill's `description` field).
- `SafetyPosterCard` (`frontend/src/components/pill-detail/safety-poster-card.tsx`) — left column safety-only card matching `pill-detail.jsx:124–143`. Renders only when `pill.safety_relevant === true`. Icon (`shield`), danger-soft background, transparent border, explainer text.
- `MaterialLoading` (`frontend/src/components/pill-detail/material-loading.tsx`) — right column skeleton matching `pill-detail.jsx:148–181`. Includes the "Generating · claude-sonnet-4-5" status indicator with pulse-dot and the "Usually ready in 4–8 seconds..." footer.
- `MaterialReady` (`frontend/src/components/pill-detail/material-ready.tsx`) — right column rendered prose matching `pill-detail.jsx:183–258`. Props: `{ content: string, prompt_version?: string, model_id?: string, served_at?: string, cached: boolean, onRegenerate: () => void, regenerating: boolean }`. Renders content as paragraph-split plain-text by default; if §H (b) item 9 finds the backend emits Markdown, install `react-markdown` per §F.4.
- `SafetyEmpty` (`frontend/src/components/pill-detail/safety-empty.tsx`) — right column empty state matching `pill-detail.jsx:390–415`. Footer copy verbatim: "Per AC-D21 · Acumen never generates safety teaching content".
- `StickyDifficultyBar` (`frontend/src/components/pill-detail/sticky-difficulty-bar.tsx`) — sticky-bottom CTA matching `pill-detail.jsx:420–459`. Props: `{ pill: PillResponse, currentBand: Band | null, recommendedDifficulty: number | null, onStart: (d: number) => void }`. Local state: `selectedDifficulty` (init from `recommendedDifficulty` or middle of `[available_difficulty_min, available_difficulty_max]`). Renders 10 difficulty buttons (D1–D10), only those within `[available_difficulty_min, available_difficulty_max]` are enabled; the others render disabled.
- `SafetyLinks` (`frontend/src/components/pill-detail/safety-links.tsx`) — covered in §B.4 below (safety branch).

*Markdown vs plain-text rendering:* v1 default is paragraph-split plain-text. If §H (b) item 9 finds Markdown, install `react-markdown` (folded into §F.4 as a structural addition).

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/catalogue/pills/{pillId}` | Pill detail (testee-facing) | **DRIFT — BLOCKER** per §H (a) item 2. Backend has admin-only `GET /v1/pills/{id}` but no testee-facing variant. Build PR cannot ship pill-detail deep-linking until the backend PR lands. v1 fallback: render a drift boundary (§E item 5) when the pill cannot be hydrated from prefetched catalogue cache. |
| `POST /v1/pills/{pillId}/learning-material` | Learning material (standard branch via `source: 'ai_generated'`; safety branch via `source: 'curated_safety_links'`). Per AC-D6 / AC-D21, safety-tagged pills serve curated external link sets instead of AI explainers. | **Implemented.** Query param: `regenerate?: boolean` (default false). Response: `{ id, pill_id, source: 'ai_generated' \| 'curated_safety_links', content: string \| null, safety_links: SafetyLinkRef[] \| null, served_at, created_at, cached }`. Polymorphic discriminator on `source`. |
| `POST /v1/attempts` | "Practice at D{n}" CTA | **Implemented but contract mismatch** — wants `test_id`, not pill+difficulty. See §H (b) item 3. Build session resolves whether a pill+difficulty → test resolver exists, whether a testee flow uses a different surface, or whether FE-3 stops at the entry-point landing per the literal FE_ROADMAP done-when. |

**4. Form fields + zod rules + react-hook-form integration shape**

n/a — no form on this page. Difficulty selection is local React state. Data-fetching shape:

- Pill query: `useQuery({ queryKey: pillQueryKeys.detail(pillId), queryFn: () => unwrap(client.GET('/v1/catalogue/pills/{pill_id}', { params: { path: { pill_id: pillId } } })) })`. Pending §H (a) item 2 endpoint landing; v1 builds against the assumption that the endpoint matches the existing `PillResponse` shape.
- Learning-material query: `useQuery({ queryKey: pillQueryKeys.learningMaterial(pillId), queryFn: () => unwrap(client.POST('/v1/pills/{pill_id}/learning-material', { params: { path: { pill_id: pillId } } })) })`. **POST-as-page-load-fetch** — backend caches and discriminates via the `cached` flag; documented exception in the query library per §C.6.
- Regenerate mutation: `useMutation({ mutationFn: () => unwrap(client.POST('/v1/pills/{pill_id}/learning-material', { params: { path: { pill_id: pillId }, query: { regenerate: true } } })), onSuccess: () => queryClient.invalidateQueries({ queryKey: pillQueryKeys.learningMaterial(pillId) }) })`.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| Pill loading | First render, pill query pending | `PillMetaCard` skeleton + right-column skeleton |
| Pill loaded (standard) | Pill query resolves with `safety_relevant: false` | `PillMetaCard` populated; right column shows `MaterialLoading` |
| Pill loaded (safety) | Pill query resolves with `safety_relevant: true` | `PillMetaCard` + `SafetyPosterCard`; right column shows `SafetyLinks` or `SafetyEmpty` per §B.4 |
| Material loading | Learning-material query in flight | `MaterialLoading` with pulse-dot + generation status |
| Material ready (standard) | Learning-material query resolves with `source: 'ai_generated'`, `content` populated | `MaterialReady` with prose + metadata footer + Regenerate button enabled |
| Material regenerating | Regenerate mutation in flight | `MaterialReady` with regenerating badge top-right per `pill-detail.jsx:186–195`; Regenerate button disabled to prevent double-fire |
| Pill error | Pill query throws | Page boundary per AC-CD21 Pattern C |
| Pill drift boundary | `GET /v1/catalogue/pills/{pillId}` returns 404 / 405 (endpoint not yet implemented) | Explicit drift boundary card explaining the missing endpoint per §E item 5 |
| Material error | Learning-material query throws | Inline error in right column with Retry button (Pattern A) |
| Difficulty selected | User clicks D{n} button in sticky bar | Selected D{n} highlighted (ink bg + bg-raised text); Band display updates to band-at-D{n} |
| Start attempt CTA | User clicks "Practice at D{n}" | Per §H (b) item 3 resolution |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Pill detail renders the pill name and subject crumb
  Given GET /v1/catalogue/pills/P returns name="Antifouling Systems" with subject "Vessels"
  When the Testee navigates to /pills/P
  Then the page renders the subject crumb "VESSELS"
  And the title "Antifouling Systems"

Scenario: Learning material is POST-fetched on page mount for a standard pill
  Given the pill has safety_relevant=false
  When the Testee navigates to /pills/P
  Then POST /v1/pills/P/learning-material fires exactly once
  And MaterialLoading renders while the request is in flight

Scenario: Learning material renders on resolution
  Given POST /v1/pills/P/learning-material resolves with source=ai_generated and non-null content
  When the response resolves
  Then MaterialReady renders the content
  And the Regenerate button is enabled

Scenario: Regenerate button passes regenerate=true and disables itself
  Given MaterialReady is rendered with the Regenerate button enabled
  When the Testee clicks "Regenerate"
  Then POST /v1/pills/P/learning-material?regenerate=true fires
  And the Regenerate button is disabled until the mutation resolves
  And the regenerating badge is visible top-right of MaterialReady

Scenario: Difficulty selector updates the band display
  Given the pill has available_difficulty_min=1 and available_difficulty_max=10
  And the Testee's current band on this pill is "working"
  When the Testee clicks D8 in the sticky bar
  Then the band display reads "ADVANCED"
  And the CTA reads "Practice at D8"

Scenario: Default difficulty seeds from recommended value when present
  Given the pill detail response carries recommended_difficulty=7
  When the page renders
  Then D7 is preselected in the sticky bar

Scenario: Default difficulty falls back to mid-range when recommended is absent
  Given the pill has available_difficulty_min=2, available_difficulty_max=8
  And no recommended_difficulty is present
  When the page renders
  Then D5 is preselected in the sticky bar

Scenario: Disabled difficulties outside available_difficulty_range
  Given the pill has available_difficulty_min=3, available_difficulty_max=7
  When the page renders
  Then D1, D2, D8, D9, D10 are rendered disabled
  And D3, D4, D5, D6, D7 are enabled
```

**7. Edge cases / gotchas**

- **POST-as-page-load-fetch is intentional.** `POST /v1/pills/{id}/learning-material` is fetched on mount via `useQuery` with a POST `queryFn` to get TanStack dedupe + caching + retry. This is an intentional deviation from "GET = useQuery, POST = useMutation" — backend treats the POST as cache-by-default with a `cached` flag, and `regenerate=true` is the explicit invalidation. Document in the query library's docstring.
- **`source` discriminated union typing.** Verify `openapi-typescript` generates a usable discriminated union (§H (b) item 6). If it widens to a union of nullable fields, add a narrowing helper in the query library: `function narrowMaterial(m): { source: 'ai_generated'; content: string } | { source: 'curated_safety_links'; safety_links: SafetyLinkRef[] }`.
- **`safety_relevant` flag source.** Branch decision reads `pill.safety_relevant` (from the pill query, not the learning-material query). If the two paths disagree (drift), trust the pill query and log a console warning. §H (b) item 7.
- **Cached vs fresh.** The learning-material response has a `cached: boolean`. UI does not differentiate the two in v1 — both render identical `MaterialReady`. The metadata footer shows `served_at` for transparency.
- **`available_difficulty_range` outside [1, 10].** Clamp defensively in `StickyDifficultyBar` (treat out-of-bounds values as if equal to the bound).
- **No current band when `GET /v1/me/competence` is unimplemented.** Sticky bar Band display shows "—" with no band styling; "Practice at D{n}" still works because difficulty is local state.
- **Sticky bar overlap with content.** Main content needs bottom-padding equal to sticky bar height (plus safe area) to prevent the last paragraph being obscured.
- **Regenerate during in-flight regenerate.** Disable the button while the mutation is pending; do not queue.

**8. Visual reference**

- `pill-detail.jsx:13–68` (PillDetailMock root) · `v6-fe3-09-pill-detail.png`
- `pill-detail.jsx:73–122` (PillMetaCard + Meta) · `v6-fe3-09-pill-detail.png`
- `pill-detail.jsx:148–181` (MaterialLoading) · `v6-fe3-09-pill-detail.png` (loading variant)
- `pill-detail.jsx:183–292` (MaterialReady + CodeishExample + prose constants) · `v6-fe3-09-pill-detail.png`
- `pill-detail.jsx:420–459` (StickyDifficultyBar) · `v6-fe3-09-pill-detail.png`

### B.4 Pill detail (safety branch) — `/pills/[pillId]` with `safety_relevant: true`

Same route as §B.3. Branch keyed on `pill.safety_relevant === true`. Shares all components in §B.3 §2 plus:

- `SafetyPosterCard` (already listed in §B.3 §2) — renders in left column below `PillMetaCard`.
- `SafetyLinks` (`frontend/src/components/pill-detail/safety-links.tsx`) — right column matching `pill-detail.jsx:332–388` (SafetyLinks + SafetyLink). Props: `{ links: SafetyLinkRef[], curatedAt?: string, curatedBy?: string }`. Renders header row ("Curated industry sources · AC-D21" + "last curated Nd ago · by {name}") + description paragraph + flex column of `SafetyLink` items. Each `SafetyLink` renders: serif index (00, 01, …) + metadata row (kind label REGULATOR / STANDARD / CASE STUDIES · source short · ~{minutes} min) + title with external-link icon + body + source name.
- `SafetyEmpty` (already listed in §B.3 §2) — renders in right column when `safety_links` is null or empty.

**3. API endpoints consumed** — same as §B.3 §3. The polymorphic response is the entire reason this is one page with two branches.

**5. States** (delta from §B.3 §5):

| State | Trigger | Visual |
|---|---|---|
| Safety links populated | Learning-material resolves with `source: 'curated_safety_links'`, `safety_links` non-empty | `SafetyLinks` list rendered with N items |
| Safety empty | Learning-material resolves with `source: 'curated_safety_links'`, `safety_links` empty or null | `SafetyEmpty` card with AC-D21 footer copy |

**6. Acceptance criteria (Gherkin)** — additions to §B.3 §6:

```gherkin
Scenario: Safety branch renders SafetyLinks when curated links are available
  Given the pill has safety_relevant=true
  And POST /v1/pills/P/learning-material returns source=curated_safety_links with 3 safety_links items
  When the page renders
  Then SafetyLinks renders 3 SafetyLink children
  And MaterialReady is not rendered

Scenario: Safety branch renders SafetyEmpty when no links are curated
  Given the pill has safety_relevant=true
  And POST /v1/pills/P/learning-material returns source=curated_safety_links with safety_links=[]
  When the page renders
  Then SafetyEmpty renders
  And the SafetyEmpty footer reads "Per AC-D21 · Acumen never generates safety teaching content"

Scenario: SafetyPosterCard renders below PillMetaCard for safety pills
  Given the pill has safety_relevant=true
  When the page renders
  Then SafetyPosterCard is visible in the left column
  And SafetyPosterCard is rendered below PillMetaCard
```

**7. Edge cases / gotchas** (delta from §B.3 §7):

- **Pill query says `safety_relevant: false` but learning-material says `source: 'curated_safety_links'`.** Drift. Trust the pill query for layout (no `SafetyPosterCard`); but render `SafetyLinks` because the material payload is authoritative for its own shape. Log a console warning. §H (b) item 7.
- **External link safety.** All `SafetyLink` anchors render with `target="_blank" rel="noopener noreferrer"`.
- **Link text overflow.** Long titles or sources truncate with ellipsis; the full title is in the `title` HTML attribute.

**8. Visual reference**

- `pill-detail.jsx:124–143` (SafetyPosterCard) · `01-v6-fe3-10-safety-pill.png`
- `pill-detail.jsx:297–330` (SAFETY_LINKS array shape) · same
- `pill-detail.jsx:332–388` (SafetyLinks + SafetyLink) · same
- `pill-detail.jsx:390–415` (SafetyEmpty) · same (empty variant if surfaced in screenshot)

### B.5 Query keys + invalidation library — `frontend/src/lib/queries/*`

**1. File path + scope**

- Files: `frontend/src/lib/queries/catalogue.ts`, `pills.ts`, `me.ts`, `index.ts` (re-exports).
- Scope: per AC-CD21, centralise FE-3 domain query keys + invalidation helpers so future FE-4+ pages adopt the same pattern. The library file at `frontend/src/lib/queries/` is anchored at AC-CD21 and a structural addition per §F.3.

**2. Components / exports / deps**

- `catalogueQueryKeys`:
  ```ts
  export const catalogueQueryKeys = {
    all: ['catalogue'] as const,
    pills: (params?: { search?: string; subject_id?: string; difficulty?: number }) =>
      [...catalogueQueryKeys.all, 'pills', params] as const,
    subjects: () => [...catalogueQueryKeys.all, 'subjects'] as const,
  };
  ```
- `pillQueryKeys`:
  ```ts
  export const pillQueryKeys = {
    all: ['pills'] as const,
    detail: (id: string) => [...pillQueryKeys.all, id] as const,
    learningMaterial: (id: string) => [...pillQueryKeys.all, id, 'learning-material'] as const,
  };
  ```
- `meQueryKeys`:
  ```ts
  export const meQueryKeys = {
    all: ['me'] as const,
    competence: () => [...meQueryKeys.all, 'competence'] as const,
    assignments: () => [...meQueryKeys.all, 'assignments'] as const,
    attempts: () => [...meQueryKeys.all, 'attempts'] as const,
  };
  ```
- Invalidation helpers: small functions wrapping `queryClient.invalidateQueries({ queryKey: ... })` with typed inputs. Example: `invalidateCatalogue(queryClient)`, `invalidatePill(queryClient, pillId)`.

No new deps. Library is pure TS.

**3. API endpoints consumed**

n/a — convention library.

**4. Props / token contract / styling contract**

n/a.

**5. States / variants**

n/a.

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Catalogue invalidation clears all catalogue queries
  Given queryClient has cached entries for catalogueQueryKeys.pills({search:'a'}), catalogueQueryKeys.pills({search:'b'}), catalogueQueryKeys.subjects()
  When invalidateCatalogue(queryClient) is called
  Then all three cache entries are marked stale

Scenario: Pill invalidation clears pill detail and its learning material
  Given queryClient has cached entries for pillQueryKeys.detail('X') and pillQueryKeys.learningMaterial('X')
  When invalidatePill(queryClient, 'X') is called
  Then both entries are marked stale
  And pillQueryKeys.detail('Y') (a sibling pill's cache) is NOT marked stale

Scenario: Query keys are referentially stable across renders given equal params
  Given two consecutive calls to catalogueQueryKeys.pills({subject_id:'A'}) within the same render tree
  Then the returned arrays have structural equality
```

**7. Edge cases / gotchas**

- Keep all key shapes `as const` so TanStack Query's type inference resolves correctly.
- Avoid stringifying objects as part of the key; rely on TanStack Query's structural equality.
- Never inline a key shape in a page file — always reference the library export. Reviewers reject PRs that introduce inline keys.

**8. Visual reference**

n/a — convention library.

---

## C. Cross-page concerns

### C.1 Shared components (introduced this PR)

| Component | Purpose | Source-of-truth design lines |
|---|---|---|
| `HeroStats` | Dashboard hero container — owns `useMeCompetence()` + `useMeAttemptsCapped()`, derives the 3 Stats + greeting eyebrow row | `testee.jsx:88–103` |
| `AssignmentsCard` + `AssignmentRow` | Dashboard assignments list with segmented filter | `testee.jsx:110–127, 199–222` |
| `RecentAttemptsCard` | Dashboard recent activity (live; consumes `GET /v1/attempts`) | `testee.jsx:149–175` |
| `FilterBar` | Catalogue search + subject filter row | `testee.jsx:260–268` |
| `PillCard` | Catalogue card with per-Testee overlay | `testee.jsx:277–302` |
| `PillMetaCard` + `Meta` | Pill detail left column | `pill-detail.jsx:73–122` |
| `SafetyPosterCard` | Pill detail left column (safety branch) | `pill-detail.jsx:124–143` |
| `MaterialLoading` | Pill detail right column skeleton | `pill-detail.jsx:148–181` |
| `MaterialReady` | Pill detail right column standard branch | `pill-detail.jsx:183–292` |
| `SafetyLinks` + `SafetyLink` | Pill detail right column safety branch | `pill-detail.jsx:332–388` |
| `SafetyEmpty` | Pill detail right column safety empty state | `pill-detail.jsx:390–415` |
| `StickyDifficultyBar` | Pill detail bottom sticky CTA | `pill-detail.jsx:420–459` |

All components co-located by feature folder (`dashboard/`, `catalogue/`, `pill-detail/`). No cross-feature primitives introduced; all design tokens come from FE-2 per AC-CD23.

### C.2 Query-key + invalidation library

Centralised in `frontend/src/lib/queries/*` per §B.5. All FE-3 pages reference these constants; no inline key construction in page files. Per AC-CD21:

- `queryClient.invalidateQueries({ queryKey: catalogueQueryKeys.all })` clears the catalogue domain.
- `queryClient.invalidateQueries({ queryKey: pillQueryKeys.detail(pillId) })` clears one pill (covers both `detail` and `learningMaterial` because the latter is a sub-key).
- Default `staleTime: 30_000` per AC-CD21.

Propagates to FE-4+ per §G — new domains add new key roots in their own files, not in any existing one.

### C.3 Error display patterns (per AC-CD6 + AC-CD21)

FE-1 established patterns A/B/C for forms; FE-3 inherits and applies to non-form surfaces:

- **Pattern A — inline error.** Per-card / per-section failures (e.g., dashboard `AssignmentsCard` query fails → inline error in the card body with Retry button).
- **Pattern B — toast.** Mutation failures. FE-3 has one mutation (regenerate learning material); on error, surface via sonner toast directly with `error.code` mapped to user-facing copy.
- **Pattern C — boundary card.** Full-page failures (pill query throws → render `(testee)/pills/[pillId]/error.tsx` boundary).

### C.4 Subject colour helper — `frontend/src/lib/catalogue/subjects.ts`

Static map keyed by `subject_id`:
```ts
export const SUBJECT_COLOURS: Record<string, { name: string; colour: string; shortLabel: string }> = {
  /* seeded from window.SUBJECTS in the prototype */
};
```
v1 seeds from the prototype's `window.SUBJECTS`. If `GET /v1/catalogue/subjects` lands (§H (b) item 5), the map becomes a fallback for colour rendering only; subject names + ids come from the API.

### C.5 Pagination — cursor pattern

`useInfiniteQuery` with `getNextPageParam: (last) => last.meta.next_cursor`. Triggered by an `IntersectionObserver` on the grid sentinel. Default `pageSize: 50` matches the backend default. Locked pattern for FE-3; propagates to future list pages per §G.

### C.6 POST-as-page-load-fetch — documented exception

`POST /v1/pills/{id}/learning-material` is fetched on mount via `useQuery` with a POST `queryFn`. This deviates from the default convention ("GET = useQuery, POST = useMutation"). Rationale: backend treats this POST as cache-by-default + `cached` flag, with `regenerate=true` as the explicit invalidation. The exception is documented in `frontend/src/lib/queries/pills.ts` docstring. No other FE-3 endpoint uses this pattern; FE-4+ should default back to GET-only `useQuery`.

### C.7 URL-state ↔ filter-state sync

Catalogue filter inputs sync to URL via `useRouter().replace()` (Next.js App Router). URL is source of truth; filter inputs hydrate from URL on first render via a small `parseFilterQuery(searchParams)` helper at `frontend/src/lib/catalogue/url-state.ts`. Filter changes call `replace`, not `push`, so the browser back button doesn't pollute. Locked pattern; propagates per §G.

### C.8 Feature flags — `frontend/src/lib/flags.ts`

Empty flag map as of the FE-3 flag-flip follow-up (post-FE-7). The original `recentAttemptsWidget` gate was flipped and removed once `GET /v1/attempts` landed; the module persists as the canonical home for any future in-process flags. See §F.4.

### C.9 Inter-page dependencies

- **FE-1 deps:** `AuthContext` (user shape, role guard) consumed in `(testee)/layout.tsx` (FE-2); `applyApiErrorToForm` not used directly by FE-3 (no forms) but its surface (sonner toast for non-field errors) is reused for the regenerate-material mutation.
- **FE-2 deps:** shell composition (Rail, TopBar, PageHeader), all primitives (Stat, BandTag, BandPips, Pill, Icon, Figure stubs), token discipline.
- **FE-3 → FE-4 contracts:** `StickyDifficultyBar.onStart(d)` is the entry-point handoff to FE-4's attempt runner. FE-3 surfaces the entry point per the done-when language; FE-4 owns the runner UI. The wiring resolves per §H (b) item 3.

### C.10 Image / figure stub contracts (per AC-CD24)

FE-3 does not exercise Figure / InlineFigure / ChoiceFigure. The pill description and learning material may surface image fields per PR-030, but v1 backend always emits null per AC-CD24, so the figure primitives render `null`. The contract type-checks; no test changes needed beyond FE-2's primitives coverage.

---

## D. Test cases (Vitest)

### D.1 Unit tests (lib + helpers)

- Query-key constants — round-trip + invalidation behaviour against an in-memory `QueryClient`; sibling-key isolation.
- Subject colour helper — known ids resolve, unknown ids return a fallback shape.
- `StickyDifficultyBar` local state — initial seed from `recommendedDifficulty`, fallback to mid-range, clamp behaviour outside `available_difficulty_range`, button enabled/disabled per range.
- `RecentAttemptsCard` rendering — capped query fires with `limit=5`, rows render, empty/error/loading branches surface; click + Enter navigate to `/attempts/{attempt_id}/result`; null `competence_delta` renders `—` in `--ink-3`.
- `parseFilterQuery` — URL searchParams → filter state object round-trip.

### D.2 Page integration tests

- **Dashboard page** — happy path (live `/v1/me/*` + `/v1/attempts` mocks resolve; hero renders real derived stats); hero empty-state (`pills: []` → honest "—" / "No attempts yet" / "0/0", never "pending"); hero error-state (query throws → "—" / "Unavailable", distinct from empty); `AssignmentsCard` segmented filter (All / Mandatory / Follow-ups); `RecentAttemptsCard` renders 5 rows from `GET /v1/attempts`.
- **Catalogue page** — initial load (50 cards); subject filter (URL update + query fire); search debounce (300ms idle); pagination (sentinel intersection); empty filtered state with Clear-filters action; error boundary; per-Testee overlay omitted when `GET /v1/me/competence` absent.
- **Pill detail page (standard)** — POST-on-mount fires once; `MaterialLoading` → `MaterialReady` transition; regenerate flow disables the button + invalidates the cache.
- **Pill detail page (safety)** — branch on `safety_relevant: true`; `SafetyLinks` with N items; `SafetyEmpty` when links array empty; `SafetyPosterCard` rendered in left column.
- **Pill detail page (drift)** — when `GET /v1/catalogue/pills/{id}` returns 404 / 405 (endpoint not yet implemented), the page renders the explicit drift boundary (§E item 5) instead of a broken empty UI.
- **StickyDifficultyBar** — difficulty selection updates band display + CTA text.

### D.3 Round-trip integration test

- Catalogue → Pill detail navigation: clicking a `PillCard` navigates and the pill data prefetched in the catalogue cache is reused on the detail page (no second fetch of the pill); the learning-material POST fires fresh.
- Pill detail → "Practice at D{n}": resolves per §H (b) item 3.

### D.4 Existing tests preserved

FE-1 and FE-2 test suites (auth flows, primitives unit tests, shell composition) must remain green. FE-3 introduces no regressions to those surfaces.

### D.5 Coverage gate (FE_CHECKLIST.md FE-3 rows tick on)

Vitest coverage covers the new files under `frontend/src/components/dashboard/`, `catalogue/`, `pill-detail/`, `lib/queries/`, `lib/catalogue/`, `lib/flags.ts`. Page-level files (`app/(testee)/.../page.tsx`) are smoke-tested via D.2 page integration tests rather than unit-tested. Per FE-1 / FE-2 precedent: meaningful coverage on the new files, not a global percentage.

---

## E. Known placeholders (DO NOT SHIP AS-IS)

| # | Placeholder | Location | Action before production |
|---|---|---|---|
| ~~1~~ | *Resolved — removed.* Dashboard hero stats are now wired to the live `GET /v1/me/competence` + `GET /v1/attempts` (no v1.x-pending placeholder); null competence renders an honest empty state. | — | — |
| ~~2~~ | *Resolved — removed.* Assigned-to-you card consumes the live `GET /v1/me/assignments` via `useMeAssignments()`. | — | — |
| ~~4~~ | *Removed for v1 (D4 / DEC-S4-A).* The dashboard `AdaptiveLoopCard` is dropped; the real per-attempt adaptive-loop card lives on the result page. | — | — |
| 5 | Pill detail deep-link relies on catalogue prefetch; bare deep-link surfaces an explicit drift boundary | `frontend/src/app/(testee)/pills/[pillId]/page.tsx` and `error.tsx` | Replace boundary with real fetch when `GET /v1/catalogue/pills/{pill_id}` lands per §H (a) item 2 |
| 6 | "Practice at D{n}" CTA destination pending §H (b) item 3 resolution | `frontend/src/components/pill-detail/sticky-difficulty-bar.tsx` | Wire to real attempt-creation flow per build-session resolution |
| 7 | `PillCard` renders without per-Testee overlay (band, estimate, attempt count, last activity) when `GET /v1/me/competence` is absent | `frontend/src/components/catalogue/pill-card.tsx` | Render full per-Testee overlay once endpoint lands per §H (a) item 5 |
| 8 | `StickyDifficultyBar` default seeded from middle of `available_difficulty_range` not from per-Testee recommended difficulty | `frontend/src/components/pill-detail/sticky-difficulty-bar.tsx` | Replace mid-range fallback with `recommended_difficulty` from pill detail response when `GET /v1/me/competence` per-pill lands |

---

## F. Scope additions beyond `fe-specs/FE-3-content.md`

### F.1 `FE_ROADMAP.md` — Recommendations v1.x non-goal

This PR amends `FE_ROADMAP.md` Non-goals with a new entry (user-locked at plan exit):

> - Dedicated Testee-facing pill recommendations (Recommended-for-you dashboard card and any recommendations endpoint) — deferred to v1.x. v1 has no AC anchor for recommendations and no backend endpoint; the FE-3 dashboard ships without the card. Revisit once a recommendations anchor lands.

The amendment sits alongside the Learning Center non-goal added in PR #38.

### F.2 Design-reference completeness — dashboard + catalogue screenshots accepted as canonical `testee.jsx`

No `v6-fe3-*-dashboard.png` or `v6-fe3-*-catalogue.png` is in `frontend/design-reference/screenshots/`. Per the SESSION_START.md "Design reference completeness check" rule (added in PR #38), this would normally be a §H (a) blocker. User-locked at plan exit: accept `testee.jsx:73–197` and `testee.jsx:243–275` as the canonical design source for v1. The absence is recorded here so future visual-content sweeps can backfill screenshots without re-litigating the decision.

### F.3 `frontend/src/lib/queries/*` — new query-key library

Anchored at AC-CD21; the library file itself is a structural addition per the AC-CD-level structural carve-out (SESSION_START.md). Three files (`catalogue.ts`, `pills.ts`, `me.ts`) + `index.ts` re-exports. No new deps; pure TS. Propagates to FE-4+ as the source-of-truth pattern.

### F.4 `frontend/src/lib/flags.ts` — feature-flag module

Tiny in-process feature-flag object. Not anchored elsewhere; structural addition. Shipped at FE-3 build with `recentAttemptsWidget: false`; the flag was flipped and removed in the FE-3 flag-flip follow-up once `GET /v1/attempts` landed in FE-7. The module is now an empty-map skeleton — kept as the canonical home so future flags add new keys here.

### F.5 `frontend/src/lib/catalogue/subjects.ts` — subject colour helper

Static colour map seeded from prototype `window.SUBJECTS`. Not anchored; structural addition.

### F.6 `react-markdown` — conditional install per §H (b) item 9

If the build session finds that `POST /v1/pills/{id}/learning-material` returns Markdown rather than plain-text, install `react-markdown` for `MaterialReady` rendering. Pinned exact per AC-CD19; dev dep on `@types/react-markdown` if not bundled. If plain-text, no install needed.

---

## G. Session 4 onwards — template propagation to FE-4..FE-9

FE-4 (attempt runner) and FE-5 (streaming / JIT queue) use the same 8-section per-page template established in FE-1 and continued here. **Per-page §B applies** to page-heavy phases (FE-3, FE-4, FE-5, FE-6, FE-8, FE-9); per-capability §B applies to primitive-heavy phases (FE-2). Pick by content shape.

Allowed deviations:

- §4 carries a real form schema when the page has a form (FE-4 answer submission, FE-8 authoring forms) — use FE-1's zod + rhf + `applyApiErrorToForm` pattern.
- The query-key library at `frontend/src/lib/queries/*` is the source of truth; FE-4+ adds new key roots in new files (`attempts.ts`, etc.), not in any existing file.
- The feature-flag module at `frontend/src/lib/flags.ts` is the source of truth; FE-4+ adds new flags there.
- The cursor-pagination pattern from §C.5 is the source of truth for list pages; FE-4+ matches it.
- The URL-state ↔ filter-state pattern from §C.7 is the source of truth for filter UIs; FE-8 catalogue admin matches.

Disallowed deviations:

- Do not introduce a second component library beyond shadcn/ui per AC-CD19.
- Do not bypass AC-CD23 token discipline (no literal hex, no arbitrary-value Tailwind brackets in component code).
- Do not introduce a fourth error-display pattern beyond A/B/C per AC-CD6 + AC-CD21.
- Do not introduce a second pagination pattern beyond cursor-based `useInfiniteQuery`.
- Do not inline query keys in page files; always reference the library.
- Do not use POST-on-mount outside the documented `learning-material` exception in §C.6 without surfacing as a spec-clarification.

---

## H. Spec-drift roll-up (post-review classification)

### (a) BLOCKERS for the FE-3 build session — must land before the build session opens

1. **FE-1 build and FE-2 build must land first.** FE-3 build presumes auth surfaces, route guards, `applyApiErrorToForm`, `AuthContext` extensions, shell composition (Rail, TopBar, PageHeader), all primitives, token system, shadcn install, and `(testee)/layout.tsx` with role guard. These are spec-locked but not yet built. **Action:** sequence FE-1 build → FE-2 build → FE-3 build per FE_ROADMAP dependency order. The FE-3 spec doc lands now (this PR); the FE-3 build PR opens once FE-1 and FE-2 builds are merged on main.

2. **Testee-facing pill detail endpoint missing.** `GET /v1/pills/{id}` exists but is admin-only; the pill detail page `/pills/[pillId]` must be deep-linkable. Without a testee-facing endpoint, the page works only after a catalogue list prefetches the pill — bare deep-links fail. **Action:** user-authored spec-clarification PR adding `GET /v1/catalogue/pills/{pill_id}` (or equivalent). User-locked at plan exit. FE-3 build cannot ship pill-detail deep-linking until that PR is on main. Until landed, the pill detail page surfaces an explicit drift boundary (§E item 5).

3. **Two formerly-candidate blockers resolved at plan-exit lock and folded into §F:**
   - Dashboard + catalogue screenshots missing → user-locked to accept `testee.jsx` as canonical; absence recorded in §F.2.
   - Recommendations endpoint absent and unanchored → user-locked to drop the Recommended-for-you card from FE-3; FE_ROADMAP non-goal added in §F.1.

### (b) BUILD-SESSION VERIFICATION TASKS — front-loaded at the start of the FE-3 build session

1. **Dashboard route file path.** FE_CHECKLIST FE-3 row names `frontend/src/app/(testee)/dashboard/page.tsx`; FE-2 spec mounts `(testee)/page.tsx` as the empty dashboard. **Verify** FE-2 spec verbatim and pick the canonical route — either `/` (move dashboard content into the route-group root file) or `/dashboard` (keep FE-2's `(testee)/page.tsx` as a redirect, or remove it entirely). Update TESTEE_NAV link consistency if needed. Build PR's handover records the choice.

2. **Subjects endpoint.** Verify whether `GET /v1/catalogue/subjects` exists for the catalogue `FilterBar`. If not, derive subjects from the pills response and document the trade-off (filter row fills lazily as pages stream).

3. **`POST /v1/attempts` ↔ pill detail wiring.** The "Practice at D{n}" button needs a `test_id`; the prototype implies pill+difficulty input. Verify: (i) a pill+difficulty → test resolution endpoint exists, (ii) the testee flow uses a different attempt-creation surface, or (iii) FE-3 stops at the entry-point landing per the literal FE_ROADMAP done-when ("reach the start-attempt entry point"). Lock the choice in the build PR's handover.

4. **`discoverable` flag filtering.** Per AC-D7 / AC-D8, Testees see pills with `discoverable: true` only. Verify whether `GET /v1/catalogue/pills` filters server-side or whether the client filters; document the contract.

5. **Subjects endpoint** — covered in item 2 above; left here as a duplicate-check marker for the build-session opening checklist.

6. **Polymorphic learning-material response.** Verify `openapi-typescript` generates a usable discriminated union for `source: 'ai_generated' | 'curated_safety_links'`. If types widen, add a narrowing helper in the query library.

7. **`safety_relevant` flag source.** Confirm the safety flag arrives on the pill detail page from the pill response (and reconcile if the learning-material response also surfaces a source-of-truth-for-its-own-shape). Both paths should agree; if they disagree, treat the pill query as authoritative for layout and the material query as authoritative for content.

8. **Default difficulty fallback.** With `GET /v1/me/competence` per-pill unimplemented, verify the `StickyDifficultyBar` mid-range fallback renders correctly and does not silently introduce a placeholder API call.

9. **Markdown vs plain-text rendering.** Verify whether the backend's `content` field is plain-text or Markdown. If Markdown, install `react-markdown` (folded into §F.6 as a structural addition); if plain-text, paragraph-split is sufficient.

10. **POST-on-mount caching.** Verify the `useQuery` + POST `queryFn` pattern works as expected (dedupe, cache, retry behaviour). If it doesn't, fall back to `useMutation` + manual cache management and surface as a build-time finding.

11. **Query-key conventions against AC-CD21.** Verify the library's key shapes against AC-CD21 in the codebase (not just the doc) and confirm `queryClient.invalidateQueries({ queryKey: catalogueQueryKeys.all })` clears correctly across nested keys.

12. **shadcn primitives availability.** Verify which shadcn primitives FE-2 actually installed (Button, Card, Input, Select, Dialog, DropdownMenu, Tabs, Toast, Skeleton are spec'd). If any are missing at FE-3 build time, install via `pnpm dlx shadcn@latest add <component>` and surface in handover.

### (c) APPROVED RESOLUTIONS — folded into the FE-3 build PR scope, captured in the build PR's handover

1. ~~**Today's Reading: frontend-only, deterministic by UTC day.**~~ *Removed for v1 (D2 / DEC-S2-A)* — the widget asserted fabricated competence claims as live data; a real curated-content surface revisits in v1.x if engagement signals justify it.

2. **Feature flag for recent attempts widget.** New `frontend/src/lib/flags.ts` shipped at FE-3 build with `recentAttemptsWidget: false`; flipped and removed in the FE-3 flag-flip follow-up once `GET /v1/attempts` landed in FE-7. See §F.4.

3. **Dashboard data is live, not drift-placeholdered.** The `/v1/me/competence`, `/v1/me/assignments`, and `/v1/attempts` endpoints are all mounted and consumed; the hero, assignments, and recent-attempts cards render real data. Failures surface honestly (empty ≠ error); no "v1.x-pending" or fabricated copy ships on the dashboard.

4. **Subject colour helper.** Static map at `frontend/src/lib/catalogue/subjects.ts` seeded from prototype `window.SUBJECTS`. See §F.5.

5. **Query-key + invalidation library.** New files in `frontend/src/lib/queries/*` per §B.5 + §C.2. Anchored at AC-CD21. See §F.3.

6. **URL-synced filter state on catalogue.** `useRouter().replace()` for filter changes; URL is source of truth. Helper at `frontend/src/lib/catalogue/url-state.ts`. Locked pattern; propagates per §G.

7. **Cursor-based pagination via `useInfiniteQuery`.** Locked pattern; propagates per §G.

8. **Pill detail deep-link drift boundary.** Until §H (a) item 2 lands, deep-linking to `/pills/[pillId]` renders an explicit drift boundary explaining the missing endpoint, not a broken empty page. Pattern C boundary at `(testee)/pills/[pillId]/error.tsx` carries the drift-specific copy.

9. **POST-as-page-load-fetch pattern for learning material.** Documented exception per §C.6; intentional deviation from "GET = useQuery, POST = useMutation" default. Docstring in `frontend/src/lib/queries/pills.ts`.

10. **FE_ROADMAP Recommendations non-goal.** Folded into this doc PR per §F.1 (user-locked at plan exit).

11. **Dashboard + catalogue screenshots accepted as `testee.jsx`-canonical.** Folded into §F.2 (user-locked at plan exit).

---

*End of FE-3-content.md.*
