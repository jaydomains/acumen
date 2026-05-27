# FE-7 — Testee competence profile + history (detail spec)

> **Status:** build phase (PR-NNN). §H (a) blockers resolved on `main` ahead of build open — `GET /v1/me/competence` and `GET /v1/attempts` both live with the locked contracts amended in-PR (see §H (c) for the LOCK-1 / LOCK-2 / LOCK-3 / LOCK-4 / Finding-10 resolutions surfaced by the FE-7 drift sweep). FE-1..FE-6 builds shipped in roadmap order.
> **Owns:** the testee competency profile surface (`(testee)/profile/page.tsx`) — constellation SVG with selected-pill detail card, matrix-view toggle, client-side sparkline, legend, view-toggle, "how to read this" sidebar — and the testee attempt history table (`(testee)/history/page.tsx`).
> **PR target:** `PR-NNN-fe7-profile` (one squash PR closes the build phase per FE_ROADMAP discipline). **This doc PR is its own slice** (current session).
> **Anchors:** AC-D3 (sequence_number scope per Testee per Test — backs the matrix-view toggle's per-pill × per-difficulty grid + history table ordering), AC-D6 (adaptive learning loop — history table surfaces `loop-driven` origin lineage), AC-D9 (`competence_estimate` float 1.0–10.0 with named band display per pill; `null` = "no data yet"), AC-D20 (anchor-based calibration `preliminary→confident` qualifier — surfaced at every scale point: constellation pip ring length, matrix cell density, detail-card stat, history-row band), AC-D27 (server-side Bayesian anchor calibration mathematics — referenced as the source of the `confidence` enum and the `competence_estimate` float; FE-7 surfaces the outputs, never recomputes them), AC-CD19 (FE stack lock — Next.js 15 / TanStack Query v5 / `openapi-fetch` + `unwrap()` + typed client), AC-CD20 (routing + role guards — both profile and history are `(testee)`-only; no admin variant in FE-7 scope), AC-CD21 (centralised query keys — consumes `meQueryKeys.competence()` and `meQueryKeys.attempts()` declared in FE-3 unchanged), AC-CD23 (token discipline — band colours, confidence-ring opacity, hard corners), AC-CD24 (image-field typed stubs — history table renders no figure thumbnails in v1).
>
> This is the **seventh per-page FE detail spec.** Template inheritance: per-page §B from `fe-specs/FE-1-auth.md` (verbatim — eight-point template per page); FE-3's `meQueryKeys` library is consumed unchanged per AC-CD21; FE-2's `BandTag` is the first-class consumer of its locked `confidence` + `estimate` prop pair (`fe-specs/FE-2-shell.md:644–651`). Per-page §B with composition selected for FE-7 — two B-entries (`/profile` + `/history`) with the visualisation components composed inside `§B.1 §2 (Components)` rather than broken out as separate B-entries; declared and justified in §G as an intentional deviation from FE-6 §G's "expect 6–8 B-entries" anticipation, on the grounds that the visualisation components are profile-page-specific in v1 with no cross-PR reuse rationale (the FE-2 primitive-heavy per-capability §B pattern does not apply). Deviating from the template in FE-8+ is itself spec drift.

---

## 0. Context

FE-0 (PR-032) shipped the Next.js 15 / App Router scaffold, the typed `openapi-fetch` client with `unwrap()`, the auth context (memory access + localStorage refresh + 401 dedup-retry), and the OpenAPI codegen pipeline. PR-033 locked AC-CD20..24. FE-1..FE-6 **spec-merged** the auth surface, the shell + design tokens, the testee catalogue/dashboard, the non-streaming attempt runner, the per-Testee streaming runner, and the results + adaptive-loop + grade-review surface. None of FE-1..FE-6 are *built* yet; FE-7 presumes their builds land in roadmap order before the FE-7 build session opens (§H (a) item 1).

**FE-N spec preconditions FE-7 extends, not replaces** (the contracts FE-7 builds against — quote and cite, do not re-decide):

- **FE-2 `BandTag` prop signature** at `fe-specs/FE-2-shell.md:644–651`:
  ```ts
  type BandTagProps = {
    band: Band;
    withLabel?: boolean;
    withPips?: boolean;
    estimate?: number;            // AC-D9 competence_estimate float (e.g., 6.7)
    confidence?: "preliminary" | "confident";  // AC-D20 calibration qualifier
  };
  ```
  FE-7 is the first-class consumer of `estimate` + `confidence` (FE-6's by-pill weakness card surfaced `confidence` narrowly on weak-pill rows only; FE-7 surfaces it at every scale point — constellation pip ring length, matrix cell density, detail-card stat, history-row band).
- **FE-2 `BandPips` primitive** at `fe-specs/FE-2-shell.md:730–733` — 5-circle component rendering 1..5 filled pips per `BAND_PIP_LEVEL[band]`. Consumed by the selected-pill detail card as a compact band indicator.
- **FE-2 `Stat` primitive** at `fe-specs/FE-2-shell.md:586–593` — `{value, label, hint?, tone?}`. Consumed by the detail card's two-stat row (competence float + observation count). FE-2 already documents the future use at `fe-specs/FE-2-shell.md:615` (`<Stat value="6.7" label="Working" tone="accent" />`).
- **FE-3 `meQueryKeys` library** at `fe-specs/FE-3-content.md:527–535`:
  ```ts
  export const meQueryKeys = {
    all: ['me'] as const,
    competence: () => [...meQueryKeys.all, 'competence'] as const,
    assignments: () => [...meQueryKeys.all, 'assignments'] as const,
    attempts: () => [...meQueryKeys.all, 'attempts'] as const,
  };
  ```
  FE-3 reserved `competence()` and `attempts()` as forward placeholders. FE-7 is the first-class consumer of both; no new key roots are added to the library.
- **FE-3 subject-colour helper** at `frontend/src/lib/catalogue/subjects.ts` (FE-3 §C.4) — `SUBJECT_COLOURS: Record<string, { name, colour, shortLabel }>`. FE-7's `ConstellationSVG` consumes it for the cluster-halo `<circle fill={s.color} opacity={0.045}/>` per `constellation.jsx:72`; `MatrixTable` consumes it for the left-edge subject tick per `constellation.jsx:300`. No edit to FE-3's file; pure read.
- **FE-3 drift-placeholder pattern** at `fe-specs/FE-3-content.md` (dashboard hero stats `GET /v1/me/competence` → v1.x-pending copy when absent). FE-7's profile-page hero stats inherit the identical pattern for the same endpoint (§E item 1); FE-7's history table inherits it for `GET /v1/attempts` (§E item 3).
- **FE-3 cursor pagination pattern** at `fe-specs/FE-3-content.md:634–636` — `useInfiniteQuery` with `getNextPageParam: (last) => last.meta.next_cursor` + `IntersectionObserver` sentinel. FE-7's history table reuses the pattern unchanged.
- **FE-3 URL-state ↔ filter-state sync** at `fe-specs/FE-3-content.md:642–644` — `useRouter().replace()` (not `push`) so back-button doesn't accumulate filter noise. FE-7's `?pill={pillId}` selected-pill deep link reuses the pattern unchanged.
- **FE-3 pill-detail destination routes** (`/pills/[pillId]`, `/pills/[pillId]?practice=true` per FE-3 §C.9 / FE-4 §H (a) inherited blocker — LD3 pill→test resolver lands when FE-3 build session opens). FE-7's selected-pill detail-card CTAs (B.1 §5 `step_practice_now` / `step_open_explainer`) target these routes; the wiring resolves at FE-7 build time per §H (a) item 1.
- **FE-6 attempt-result destination route** (`/attempts/[attemptId]/result`). FE-7's history table row click targets this route; FE-6 ships the destination (replaces the FE-4 placeholder per `fe-specs/FE-6-results.md:1109`).
- **FE-6's narrow-confidence surface** at `fe-specs/FE-6-results.md:333–334` — `confidence` qualifier surfaced only on the by-pill weakness card. FE-7 explicitly extends the surface (constellation ring length + matrix cell density + detail-card stat + history-row band-tag suffix all consume the same `confidence` enum). Per the brief: "FE-6's narrow surface is per-weak-pill; FE-7 surfaces it at every scale point." Documented in §C.5.

**Done-when (verbatim from `FE_ROADMAP.md:144–148`):** Testee can view their constellation with selected-pill detail card, toggle to matrix view, browse paginated history. Sparkline derived client-side from attempt list.

**Scope boundary — what FE-7 explicitly does NOT ship:**

- **Admin-facing constellation / matrix / history.** FE-9 territory. The admin's roll-up across all testees, the cost-dashboard charts, and the loop-monitor admin queues live in FE-9. Admin role hitting `/profile` or `/history` gets the AC-CD20 `(testee)` layout-guard redirect to `/403` (FE-1 §C.4 five-posture matrix locked).
- **Per-pill detail page.** FE-3 owns `/pills/[pillId]`. FE-7's selected-pill detail card is an *in-page* card on `/profile`, not a separate route; deep-linking targets the pill via `?pill={pillId}` query state, not via a route segment change.
- **Server-side `competence_estimate` math.** AC-D27's Bayesian effective-difficulty estimator, fresh-question delta scoring, and cold-start confidence logic all live server-side per `DECISIONS.md:672+`. FE-7 surfaces the float and the `confidence` enum the backend returns; FE never recomputes either. Surfaced as a §F.7 note (not a §H blocker — verified during planning).
- **Sparkline server-side persistence.** Per the done-when verbatim — "Sparkline derived client-side from attempt list." Helper at `frontend/src/lib/profile/derive-sparkline.ts` (§C.4) filters the attempt list by selected `pill_id` and projects the latest 6 `competence_estimate` values. No `sparkline` field on the competence response.
- **Constellation layout caching.** v1 recomputes the layout on every render via `useMemo([pills, subjects])`. Layout determinism is provided by the math itself (per `constellation.jsx:27` — `(sid.charCodeAt(0) * 0.13)` phase seed). No server-persisted layout; no per-Testee layout customisation. Performance risk acknowledged in `FE_ROADMAP.md:154` ("SVG layout performance with 100+ pills if catalogue grows") and surfaced as §H (b) item 7.
- **History row → result page deep-link with anchor scroll.** Row click does `router.push('/attempts/{id}/result')`; no anchor target (`#question-N`) is preserved between history list and result page. FE-6 owns the result-page anchor pattern (B.6 + B.8 → B.4 per `fe-specs/FE-6-results.md:915–917`).
- **History filtering / search.** v1 ships paginated chronological-only ordering. No pill filter, no origin filter, no date range, no search. Cursor pagination only. Deferred to v1.x; surfaced as §E item 5.
- **Today's Reading widget on profile.** Today's Reading is a *dashboard* widget per FE-3 §C.1 (`testee.jsx:21–68`); the constellation page's hero is a different composition (eyebrow + serif-italic title + muted body explainer — `constellation.jsx:158–164`). No carryover; surfaced as §F.7 design-reference note.

**Additions to `(testee)/layout.tsx`:** none. The shared `(testee)` shell from FE-2 hosts both pages unchanged. The nav rail's `profile` and `history` ids already exist in the shell prototype (`shell.jsx:11–12`).

---

## A. Page/feature inventory

| # | Capability | Route / file | Design source | Screenshot |
|---|---|---|---|---|
| 1 | Profile page composition (route shell, view-toggle, `?pill=` deep-link, role guard) | `(testee)/profile/page.tsx` | `constellation.jsx:143–264` (`TesteeProfile`) | `v6-fe7-XX-constellation.png` (absent — §F.7) |
| 2 | History page composition (route shell, paginated table, role guard) | `(testee)/history/page.tsx` | `testee.jsx:496–531` (`TesteeHistory`) | `v6-fe7-XX-history.png` (absent — §F.7) |
| 3 | `ConstellationSVG` — stars (pill × subject cluster × band × confidence ring × edges × safety mark × selected ring × labels) | `frontend/src/components/profile/constellation-svg.tsx` | `constellation.jsx:10–138` (`layoutConstellation` + `Constellation`) | inherits #1 |
| 4 | `MatrixTable` — pill × difficulty grid alternative view (AC-D3) | `frontend/src/components/profile/matrix-table.tsx` | `constellation.jsx:287–326` (`MatrixView`) | inherits #1 |
| 5 | `SelectedPillDetailCard` — band, n, confidence, sparkline, related, CTAs | `frontend/src/components/profile/selected-pill-detail-card.tsx` | `constellation.jsx:200–245` (right-column card) | inherits #1 |
| 6 | `Sparkline` — client-side trend chart from attempt list | `frontend/src/components/profile/sparkline.tsx` | `constellation.jsx:266–285` | inherits #1 |
| 7 | `ViewToggle` + `Legend` + "How to read this" sidebar | `frontend/src/components/profile/view-toggle.tsx` + `legend.tsx` + `how-to-read.tsx` | `constellation.jsx:166–188` (toggle + legend) + `247–256` (sidebar) | inherits #1 |
| 8 | `HistoryTable` — When / Pill / Origin / Score / Band / Δcomp paginated rows | `frontend/src/components/profile/history-table.tsx` | `testee.jsx:511–530` | inherits #2 |

Eight rows. Capabilities #1 and #2 are route shells; #3–#7 are component capabilities composed under capability #1 (the `/profile` page); #8 is the component capability composed under capability #2 (the `/history` page). Mirrors FE-6's pattern (`fe-specs/FE-6-results.md:53`) where the page shell is the route-level entry and the visualisation components compose under it — but FE-7 keeps the per-page §B at two entries rather than breaking each component into its own B-entry (per §G deviation note, justified by visualisation components being profile-page-specific in v1 with no cross-PR reuse rationale).

The selected-pill deep link via `?pill={pillId}` query state is declared on row #1; `?cursor={cursor}` for history pagination is declared on row #2.

---

## B. Per-page detail specs

> **Template** (used identically for every page; propagates to FE-8..FE-9 verbatim):
> 1. Route segment + URL state
> 2. Components (scaffold reused / new in this PR / shadcn primitive / design primitive)
> 3. API endpoints consumed
> 4. Form fields + zod rules + react-hook-form integration shape (or "n/a — read-only page" with TanStack Query notes)
> 5. States (every variant from the design state-strip + any extras the wire surfaces)
> 6. Acceptance criteria (Gherkin — each trio maps to one Vitest test)
> 7. Edge cases / gotchas
> 8. Visual reference

### B.1 Profile page — `/profile`

**1. Route segment + URL state**

- File: `frontend/src/app/(testee)/profile/page.tsx`. The `(testee)` route group exists per FE-2; the `profile/` segment + its `error.tsx` boundary file are FE-7-introduced.
- URL state: `?pill={pillId}` deep-links the selected pill. Default selection on mount: `searchParams.get('pill') ?? <first pill with n > 0 in competence response>`; if no pills have any observations, fall back to the alphabetically-first pill. Selection changes call `router.replace()` (not `push`) so the browser back button doesn't pollute the history per FE-3 §C.7 precedent. View toggle (`constellation` ↔ `matrix`) is local React state, NOT URL state — the view choice is ephemeral, doesn't survive page reload (matches `constellation.jsx:146` default `'constellation'`).
- Server-side: no `generateMetadata` dynamic-title in v1 (deferred to the v1.x SEO/accessibility pass). Static `<title>Competency · Acumen</title>` from `layout.tsx`.
- Nav-rail anchor: `shell.jsx:11` declares the nav id as `profile` with label "Competency"; the rail-highlight state uses this id (`shell.jsx:11`). FE-7's route segment must match the id verbatim for the rail to highlight.

**2. Components**

- **Scaffold reused:** `useAuth()` (FE-1) for role-guard at page mount; `client` + `unwrap()` (FE-0) for typed fetches; `PageHeader` (FE-2 primitive — used for the eyebrow + serif-italic title per `constellation.jsx:158–164`); `Card`, `Skeleton`, `Tooltip` (shadcn primitives from FE-2's installed set); `useRouter`, `useSearchParams` from `next/navigation` (Next 15 App Router hooks; no new lib).
- **New in this PR (composed under §B.1):**
  - **`ProfileHero`** — eyebrow ("Your competency · {pillCount} pills · calibrated") + `<h1 class="h-display">` with `<span class="serif-it">A map of</span> what you know.` + muted body explainer copy per `constellation.jsx:158–164`. No state; presentational only.
  - **`ViewToggle`** — segmented two-button toggle (`Constellation` / `Matrix`) per `constellation.jsx:166–169`. Uses `.seg` design class; controlled component with `value` + `onChange`. State lives in `ProfilePage`, not in `ViewToggle`.
  - **`Legend`** — horizontal row of band-colour pips + confidence-ring icon + safety-mark icon per `constellation.jsx:172–188`. Renders 5 band rows + a confidence-ring legend + a safety-tagged legend. Pure presentational; reads `BANDS` + `BAND_LABEL` constants from FE-2's band lib (`frontend/src/components/primitives/bands.ts` — see `fe-specs/FE-2-shell.md:706`). Per-band counts (e.g. "{N} novice pills") are computed in the page from the competence response (`byBand[b] = pills.filter(p => p.band === b).length`).
  - **`ConstellationSVG`** — the full constellation per `constellation.jsx:35–138`. Self-contained `<svg viewBox="...">`. Props: `{ pills, subjects, selectedId, onSelect, width=880, height=620 }`. Composed of:
    - `layoutConstellation(pills, subjects)` pure helper at `frontend/src/lib/profile/layout-constellation.ts` (§C.4) — returns `{ subjCentres, positions }` per `constellation.jsx:10–33`. Deterministic per pill_id ordering (uses `sid.charCodeAt(0) * 0.13` for the cluster phase seed); same input → same output positions.
    - Edges derived from `pill.related_pill_ids[]` (§H (a) item 2 contract). Edges render only when both endpoints exist in `positions` and `p.id < rid` (de-dupes pairs per `constellation.jsx:42`).
    - `<defs>`: `radialGradient#haze` + `filter#soft-glow` per `constellation.jsx:59–64`.
    - Subject halos: `<circle r={110} fill={s.color} opacity={0.045}/>` + subject-name label `<text>` per `constellation.jsx:67–80`. Consumes FE-3's `SUBJECT_COLOURS` map.
    - Connecting edges: `<line stroke="var(--ink-2)" opacity="0.18"/>` per `constellation.jsx:82–89`.
    - Star body per pill: glow circle + confidence ring + star body + core + safety mark (if `safety_relevant`) + selected ring (if `id === selectedId`) + label (if `isSel || competence_estimate > 7.5`) per `constellation.jsx:92–135`. Star radius = `4 + (competence_estimate / 10) * 14` per `constellation.jsx:96`; confidence ring length = `Math.min(1, n / 30) * 100` per `constellation.jsx:97, 108` (visual "n=30 full ring" rule is design-locked; AC-D20 threshold for the *label* enum is `n=20`, surfaced separately via the `confidence` field — §C.5 documents the two thresholds).
    - Click handler: `onSelect(pill.id)` bubbles up to `ProfilePage` which calls `router.replace`.
  - **`SelectedPillDetailCard`** — right-column card per `constellation.jsx:200–245`. Props: `{ pill, subject, sparklineValues, onPracticeNow, onOpenExplainer }`. Renders subject label (`.t-meta` coloured `subject.color`) + pill name (`.h-2`) + safety pill (if `safety_relevant`) + 2-Stat grid (`competence_estimate.toFixed(1)` with `--band-{band}` tint + `n` count with confidence suffix) + `BandPips` + `BandTag` row + sparkline + related-pills chip row + CTA row ("Practice at D{round(estimate)}" + "Step up to D{min(10, round(estimate)+1)}"). Empty subsections collapse (e.g. zero related pills → "No related pills yet." muted helper per `constellation.jsx:229`).
  - **`Sparkline`** — pure visualisation component per `constellation.jsx:266–285`. Props: `{ values: number[], band: Band }`. Renders SVG path + filled area + per-point dots. Values + colour derived in `ProfilePage` (sparkline values from `derive-sparkline.ts`; colour = `var(--band-{band})`). Width 240, height 50, padding 6 — locked at the design.
  - **`MatrixTable`** — alternative view per `constellation.jsx:287–326`. Props: `{ pills, subjects, selectedId, onSelect }`. Renders a CSS grid: header row (`PILL · DIFFICULTY →` + 10 difficulty headers `D1..D10`) + per-subject pill rows. Each pill row has: left-edge subject tick (`background={subject.color}`) + pill name + 10 difficulty cells. Each cell is filled with `var(--band-{p.band})` if `diff ≤ Math.round(p.competence_estimate)`, with the current-difficulty cell at full opacity and others at 0.55. The current-difficulty cell renders the float value (`p.competence_estimate.toFixed(1)`) in mono. Row background flips to `var(--accent-soft)` when `pill.id === selectedId`. Click anywhere on the row calls `onSelect(p.id)`.
  - **`HowToReadCard`** — sunk-variant card with 5-bullet explainer per `constellation.jsx:247–256`. Pure presentational; copy is locked (size = competence, colour = band, ring length = calibration confidence, lines = related pills, red dot = safety-tagged).
- **shadcn primitives installed in this PR:** none beyond FE-2's installed set. `Card`, `Skeleton`, `Tooltip` all ship in FE-2.
- **Design primitives reused:** `Stat` (FE-2 — `fe-specs/FE-2-shell.md:586–593`) inside the detail card's 2-stat grid; `BandTag` (FE-2 — `fe-specs/FE-2-shell.md:644–651`) with `estimate` + `confidence` props (first-class consumer); `BandPips` (FE-2 — `fe-specs/FE-2-shell.md:730–733`); `Pill` (FE-2) for the safety badge + chip-style related-pill buttons; `PageHeader` (FE-2). `.seg`, `.card`, `.card.sunk`, `.chip`, `.btn.btn-primary.btn-sm`, `.btn.btn-sm`, `.divider`, `.muted`, `.mono`, `.eyebrow`, `.serif-it`, `.h-display`, `.h-2`, `.t-meta`, `.dim`, `.col`, `.row`, `.gap-*`, `.mb-*`, `.mt-*`, `.matrix-grid` design classes from FE-2's `globals.css` per AC-CD23.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/me/competence` | Primary fetch. Returns the per-pill competence array for the authenticated testee. Consumed by ConstellationSVG (stars + edges), MatrixTable (cells), SelectedPillDetailCard (band, n, confidence, related), Legend (per-band counts), ProfileHero (pill-count eyebrow). Single fetch on page mount; no polling. `staleTime: 30_000` per AC-CD21 default. | **ABSENT — §H (a) item 2 blocker.** Endpoint does not exist in `frontend/openapi/schema.json`. Spec body locks the response shape; user authors the spec-clarification PR against the locked contract. Until merged, the page renders the `endpoint_absent` placeholder state per E.1 (FE-3 dashboard hero precedent). |
| `GET /v1/attempts` | Secondary fetch for sparkline derivation (filters attempts by selected `pill_id` and projects the latest 6 `competence_estimate` values). Consumed by `derive-sparkline.ts` helper feeding `SelectedPillDetailCard`. Same endpoint as §B.2 history page; shared cache key `meQueryKeys.attempts()` per AC-CD21 means one fetch serves both pages. `staleTime: 30_000` default. **NOTE:** the profile page reads from the cache; if the user navigates `/profile → /history`, the history page reuses the same data without a second fetch. | **ABSENT — §H (a) item 3 blocker.** Endpoint does not exist; only `POST /v1/attempts` exists in `frontend/openapi/schema.json:4873`. Sparkline renders empty state until endpoint lands per E.3. |

No third endpoint. The constellation does NOT call a separate "related pills" endpoint — `related_pill_ids[]` is inlined on the competence response per §H (a) item 2 contract. The sparkline does NOT call a separate time-series endpoint — derived client-side per the done-when verbatim.

**Locked contract for `GET /v1/me/competence`** (build-time confirmed against the live wire; §H (c) records the LOCK-2 + LOCK-3 + Finding-10 backend amendments shipped in-PR):

```ts
GET /v1/me/competence → {
  pills: Array<{
    pill_id: string,
    pill_name: string,
    subject_id: string,
    competence_estimate: number,                // AC-D9 float 1.0–10.0; non-nullable — null rows are filtered server-side per LOCK-2
    band: "novice" | "junior" | "working" | "advanced" | "expert",
    n: number,                                   // submitted-attempt count per pill (LOCK-3 — derived from Attempt table)
    confidence: "preliminary" | "confident",     // AC-D20 server-computed from n vs threshold
    last_activity_at: string | null,             // ISO datetime; null when no profile activity stamp yet
    related_pill_ids: string[],                  // for constellation edges; empty array if none
    safety_relevant: boolean                     // AC-D21; threads to safety-mark + safety pill
  }>
}
```

`overall_competence` aggregate is NOT in the v1 contract; ProfileHero's eyebrow renders the pill-count only (e.g. "20 pills · calibrated"). FE-3's dashboard hero stats consume the same endpoint for an aggregate; if the v1 contract grows to include aggregates, FE-3's hero is the first consumer per `fe-specs/FE-3-content.md` drift item. FE-7 does NOT block on aggregate fields.

**4. Form fields + zod + rhf**

n/a — read-only page. **TanStack Query notes:**

```ts
const competence = useQuery({
  queryKey: meQueryKeys.competence(),
  queryFn: () => unwrap(client.GET("/v1/me/competence")),
  // staleTime: 30_000 inherited from QueryClient default per AC-CD21
});

const attempts = useQuery({
  queryKey: [...meQueryKeys.attempts(), { limit: 200 }],
  queryFn: () => unwrap(client.GET("/v1/attempts", { params: { query: { limit: 200 } } })),
  // 200-row cap for sparkline derivation (covers ~6 months of typical activity); pagination not exercised on /profile.
  // History page (B.2) uses useInfiniteQuery against the same key root with a {cursor,limit:50} sub-key, so the two
  // page-shapes don't collide in cache.
});

const sparklineValues = useMemo(
  // LOCK-1 — GET /v1/attempts ships under the canonical Page<T> envelope per CODE_SPEC §5;
  // the rows live at `.data`, not `.attempts`.
  () => deriveSparkline(attempts.data?.data ?? [], selectedId),
  [attempts.data, selectedId]
);
```

Selected-pill state lives in `ProfilePage` via `useState(searchParams.get('pill') ?? <first pill with n > 0>)` + `useEffect([selectedId], () => router.replace(`?pill=${selectedId}`, { scroll: false }))`. View-toggle state lives in `useState<'constellation' | 'matrix'>('constellation')` — not URL-synced (intentional; see B.1 §1).

Sparkline values are derived from the cached attempts list, not from a separate fetch. No mutation on this page.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `loading` | Initial `competence` query in-flight | Skeleton placeholders: ProfileHero eyebrow + title skeletons; Legend skeleton (5 grey rows); ConstellationSVG placeholder (`<div class="card" style={{background: 'var(--bg-sunk)', minHeight: 620}}>` with a centred spinner); SelectedPillDetailCard skeleton (2-stat grid + sparkline rect + chip row). MatrixTable not mounted (default view = constellation). |
| `endpoint_absent` | `GET /v1/me/competence` returns 404 / 405 (endpoint not yet implemented) | Per FE-3 drift-placeholder pattern: ProfileHero renders with eyebrow copy "Your competency · Coming in v1.x"; main grid renders a single sunk-card placeholder with copy "Your competence profile arrives once we light up the `/v1/me/competence` endpoint. No data yet." Legend hidden; ViewToggle disabled; SelectedPillDetailCard hidden. Recorded as §E item 1 placeholder. |
| `empty` | Response is `{ pills: [] }` (new testee with no attempts) | ProfileHero eyebrow renders "Your competency · 0 pills · no attempts yet"; ConstellationSVG renders the empty-state copy "Your constellation will appear after a few attempts." per `constellation.jsx`-extended pattern (the prototype doesn't draw this state explicitly; §F.7 design-reference note). SelectedPillDetailCard hidden (no pill to select). Recorded as §E item 2 (genuine empty state — ships as-is). |
| `happy_constellation` | Response has `pills.length > 0`; view = `constellation` | All components mount and render. ProfileHero shows pill count; Legend shows per-band counts; ConstellationSVG renders stars + edges + selected ring on `selectedId`; SelectedPillDetailCard mounts with the selected pill's data; HowToReadCard mounts below the detail card. |
| `happy_matrix` | Response has `pills.length > 0`; view = `matrix` | ConstellationSVG unmounts; MatrixTable mounts in its place (`col-span-12` per the layout, not the `col-span-8 / col-span-4` constellation-view grid). SelectedPillDetailCard moves to a separate row below the matrix (or stays in the side column — locked per `constellation.jsx:259–261` which renders the matrix full-width with no side column; SelectedPillDetailCard is hidden in matrix view per the design). HowToReadCard hidden in matrix view per the design (`constellation.jsx:259–261`). |
| `deep_link_mount` | `?pill={pillId}` in URL on initial mount | `selectedId` initialises from `searchParams.get('pill')` rather than from "first pill with n > 0". If the param doesn't match any pill in the response, falls back to the default (and `router.replace`s the URL to clear the stale param). |
| `selection_via_star` | User clicks a star in `ConstellationSVG` | `selectedId` updates → `router.replace(?pill={newId})` → SelectedPillDetailCard re-renders with new pill data → sparkline re-derives client-side from `attempts.data` → constellation selected ring shifts. |
| `selection_via_chip` | User clicks a related-pill chip in `SelectedPillDetailCard` | Same as `selection_via_star` (chip handler calls `onSelect(rid)` which bubbles to the same state setter per `constellation.jsx:233`). |
| `selection_via_matrix_row` | User clicks a pill row or cell in `MatrixTable` | Same as `selection_via_star`. |
| `cta_practice_now` | User clicks "Practice at D{n}" CTA | `router.push('/pills/{selectedId}?d={Math.round(competence_estimate)}')` — FE-3 territory. |
| `cta_step_up` | User clicks "Step up to D{n+1}" CTA | `router.push('/pills/{selectedId}?d={Math.min(10, Math.round(competence_estimate)+1)}')` — FE-3 territory. |
| `cta_open_explainer` | (Optional v1; only renders if pill has admin-uploaded reference material) | Routes to `/pills/{selectedId}` (FE-3 pill detail page; learning-material viewer is FE-3 §B.4). Prototype does not draw this CTA explicitly; spec confines it to a hidden v1 surface unless the design adds it. Surfaced as §F.7 deviation. |
| `view_toggle_to_matrix` | User clicks "Matrix" segment in `ViewToggle` | Local state `view = 'matrix'`; ConstellationSVG unmounts; MatrixTable mounts; SelectedPillDetailCard + HowToReadCard hide. Selection persists; if user toggles back to constellation, selected ring + detail card re-mount with the prior selection. |
| `view_toggle_to_constellation` | User clicks "Constellation" segment | Reverse of above. |
| `safety_pill_selected` | Selected pill has `safety_relevant === true` | SelectedPillDetailCard renders `<Pill tone="danger" mono>Safety · external links only</Pill>` per `constellation.jsx:204`; constellation safety mark (red dot) renders per `constellation.jsx:115–119`. The "Practice at D{n}" CTA still routes to FE-3 pill detail; FE-3 owns the safety-pill branching (external links instead of AI explainer per AC-D21). |
| `confidence_preliminary_visualised` | A star or matrix cell whose pill `confidence === "preliminary"` | Star's confidence ring length renders shorter (per `constellation.jsx:97` — `Math.min(1, n / 30)` with n < 20 falling between 0 and 0.67 ring fraction); matrix cell still renders filled but the BandTag in the detail card carries the `confidence="preliminary"` suffix per FE-2 §B.6. Tooltip on the star (hover) reads "Calibration pending — n={n}." See §C.5 for the dual-threshold note. |
| `confidence_confident_visualised` | A star whose pill `confidence === "confident"` | Star's confidence ring length renders at ≥0.67 (n ≥ 20 → AC-D20 threshold); BandTag suffix reads "confident". |
| `selected_pill_not_in_response` | URL `?pill=X` but X is not in `competence.pills[]` | Fall back to default selection (first pill with n > 0). `router.replace` clears the stale `?pill=` param to the new selection. No error banner; silent recovery. |
| `error` | `competence` query throws (network 5xx, non-404 error) | Pattern C boundary card mounts via `(testee)/profile/error.tsx`. Copy: "Couldn't load your competency." + "Try again" (resets boundary) + "Go to dashboard". |
| `role_mismatch` | Admin role hits `/profile` | AC-CD20 `(testee)` layout guard redirects to `/403` before page mount (FE-1 §C.4 five-posture matrix locked). FE-7 ships no admin variant. |
| `privacy_unacked` | Authed user with `privacy_ack_at === null` | AC-CD20 `(authed)` parent guard redirects to `/privacy` before the `(testee)` layout runs (FE-1 §C.4). |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Happy-path testee lands on constellation view with default selection
  Given the testee has 20 pills with varying competence
  And the testee opens /profile with no ?pill query
  When the competence query resolves
  Then ConstellationSVG renders 20 stars
  And the first pill with n > 0 is selected (URL replaces to ?pill={id})
  And SelectedPillDetailCard renders that pill's data
  And HowToReadCard renders below the detail card
```

```gherkin
Scenario: Deep link selects the right pill on mount
  Given the testee opens /profile?pill=antifouling
  And the competence response includes a pill with id "antifouling"
  When the page mounts
  Then selectedId initialises to "antifouling"
  And the constellation selected ring centres on that star
  And SelectedPillDetailCard shows that pill's data
  And no router.replace fires (URL already matches)
```

```gherkin
Scenario: Selecting a related-pill chip updates the URL and the card
  Given the detail card is showing pill A with related_pill_ids including pill B
  When the testee clicks the chip for pill B
  Then selectedId updates to "B"
  And router.replace fires with ?pill=B
  And the detail card re-renders with pill B's data
  And the constellation selected ring moves to B's star
```

```gherkin
Scenario: View-toggle switches to matrix view
  Given the page is in state happy_constellation with pill A selected
  When the testee clicks the "Matrix" segment of ViewToggle
  Then ConstellationSVG unmounts
  And MatrixTable mounts
  And SelectedPillDetailCard hides
  And HowToReadCard hides
  And clicking pill B's row in the matrix updates selectedId to "B"
  And toggling back to "Constellation" re-mounts SelectedPillDetailCard with pill B
```

```gherkin
Scenario: Endpoint absent — drift-placeholder mode
  Given GET /v1/me/competence returns 404 or 405
  When the page mounts
  Then ProfileHero renders "Your competency · Coming in v1.x"
  And the main grid shows the sunk-card placeholder copy
  And Legend, ViewToggle, ConstellationSVG, and SelectedPillDetailCard are not mounted
  And no router.replace fires (no ?pill param to set)
```

```gherkin
Scenario: Empty competence (new testee, no attempts)
  Given GET /v1/me/competence returns { pills: [] }
  When the page mounts
  Then ProfileHero renders "0 pills · no attempts yet"
  And ConstellationSVG renders the empty-state copy
  And SelectedPillDetailCard is not mounted
```

```gherkin
Scenario: Confidence ring length reflects observation count
  Given a pill with n === 10 and confidence "preliminary"
  Then its constellation star renders a confidence ring at strokeDasharray approximately "33 100" (n/30 = 0.33)
  And a pill with n === 30 renders a ring at "100 100" (full)
  And the BandTag in the detail card for the n=10 pill carries the "preliminary" suffix
  And the BandTag for the n=30 pill carries the "confident" suffix
```

```gherkin
Scenario: Practice CTA routes to FE-3 pill detail with difficulty query
  Given pill A is selected with competence_estimate === 6.7
  When the testee clicks "Practice at D7"
  Then router.push fires with /pills/A?d=7
  And the page unmounts via the (testee) shell
```

```gherkin
Scenario: Admin hits testee profile URL — 403
  Given an admin user opens /profile
  When the (testee) layout-guard evaluates the role
  Then the user is redirected to /403
  And the profile page never mounts
```

```gherkin
Scenario: Initial fetch failure — Pattern C boundary
  Given the testee opens the profile page
  When GET /v1/me/competence throws (non-404 error — 5xx, network)
  Then profile/error.tsx renders with "Couldn't load your competency."
  And "Try again" resets the boundary and refetches
```

(Ten total scenarios mapped to §D.2 page-integration tests.)

**7. Edge cases / gotchas**

- **Two distinct confidence thresholds.** The design (`constellation.jsx:97`) uses `n=30` as the "full confidence ring" visual threshold; AC-D20 uses `n=20` as the `preliminary→confident` label threshold. These are intentionally different: the ring length is a smooth gradient (good visual signal — a pill at n=15 shows a half-ring, a pill at n=25 shows a 5/6 ring), while the label is a binary qualifier per AC-D20's "minimum sample size" rule. Spec body documents both; §C.5 records the dual-threshold; §H (b) item 4 verifies the AC-D20 threshold against `DECISIONS.md` at build time (placeholder n=20 may differ if System Settings exposes a different value).
- **Deterministic constellation layout.** `layoutConstellation` math at `constellation.jsx:10–33` is pure (no `Math.random`); same pills × subjects input → same positions output. This is a contract — the constellation must not jitter between renders. v1 caches via `useMemo([pills, subjects])`. Surfaced in §C.4 deriving spec; D.1 unit test asserts referential stability.
- **`competence_estimate === null` is impossible.** Per AC-D9 amended at v1.2 (`DECISIONS.md:227–286`), the float is computed from population performance; null only surfaces when `n === 0` (no attempts yet). Spec contract for the response shape (§H (a) item 2) declares `competence_estimate: number` not `number | null` — pills with no attempts simply don't appear in the response (filtered server-side). If §H (b) item 5 finds the backend returns null for n=0 pills, spec body adjusts to filter client-side.
- **Constellation edge de-duplication.** Edges array per `constellation.jsx:39–44` filters via `if (positions[rid] && p.id < rid)` — only renders one edge per related pair. Spec preserves this; D.1 unit test asserts edge count for a known fixture.
- **Selected ring visibility on very small stars.** Per `constellation.jsx:121–124`, the selected ring has fixed `r=radius+10` offset. For low-competence pills (small star), the selected ring is still visible (radius is bounded below at 4 + 0 = 4 → selected ring at r=14). No spec change needed.
- **Safety mark colour collision with `--danger`.** Per `constellation.jsx:117`, the safety mark renders `fill="var(--danger)"`. If a pill happens to be both safety-tagged AND has the selected ring, both render — selected ring (dashed `--ink`) and safety mark (`--danger` filled circle) are visually distinguishable. No spec change.
- **Sparkline with fewer than 2 points.** If the selected pill has 0 attempts (impossible per the null-impossible rule above) or 1 attempt, `derive-sparkline.ts` returns an empty array; `Sparkline` renders a placeholder dash (`<text>—</text>`). Spec contract: minimum 2 points required for a path; D.1 unit test covers.
- **`useMemo` invalidation on `[pills, subjects]`.** `pills` reference changes on every refetch; `useMemo` re-runs `layoutConstellation` even if data is identical. v1 acceptable; if SVG perf becomes a concern (§H (b) item 7), add deep-equality check or move layout to a Web Worker (deferred).
- **History page navigation from profile.** No in-page link from `/profile` to `/history`; user navigates via the FE-2 shell rail (rail nav id `history` per `shell.jsx:12`).
- **`competence_estimate.toFixed(1)` precision.** Spec assumes server returns ≤1 dp precision; if more, client truncates via `toFixed(1)`. §H (b) item 6 verifies.
- **AC-D27 calibration math is server-only.** FE-7 surfaces `confidence` enum + `competence_estimate` float — both server-computed per AC-D27 (`DECISIONS.md:672+`). FE never recomputes either; FE never accesses the underlying Bayesian shrinkage state. Recorded in §F.7.
- **`?pill=` URL state with `router.replace` not `push`.** Per FE-3 §C.7 precedent. Back button returns to whatever route preceded `/profile`, not to each prior pill selection.
- **`overall_competence` aggregate is NOT in the v1 contract.** ProfileHero shows the pill count only. If FE-3's dashboard hero ships with an aggregate stat call to the same endpoint, FE-7 inherits whatever shape lands. No FE-7 blocker.
- **`view` is local state, not URL state.** Toggle to matrix doesn't survive page reload. Intentional; matches `constellation.jsx:146`. Future v1.x may URL-sync via `?view=matrix`.

**8. Visual reference**

- `frontend/design-reference/prototype/constellation.jsx:143–264` — `TesteeProfile` (the full /profile page composition).
- `frontend/design-reference/prototype/constellation.jsx:10–138` — `layoutConstellation` helper + `Constellation` component.
- `frontend/design-reference/prototype/constellation.jsx:266–285` — `Sparkline`.
- `frontend/design-reference/prototype/constellation.jsx:287–326` — `MatrixView`.
- `frontend/design-reference/prototype/shell.jsx:11` — `profile` nav id ("Competency" label) + rail-highlight wiring.
- `frontend/design-reference/prototype/shell.jsx:127–138` — `BandTag` reference (note: prototype lacks the `confidence` prop locked by FE-2 spec; spec-leads-prototype per §F.7).
- `frontend/design-reference/prototype/shell.jsx:141–147` — `BandPips` reference.
- `frontend/design-reference/prototype/shell.jsx:117–124` — `Stat` reference.
- Screenshot: `v6-fe7-XX-constellation.png` — **ABSENT**, see §F.7 (FE-3 design-ref completeness precedent: prototype-first, screenshots-absent is a documented note, not a §H (a) blocker).

---

### B.2 History page — `/history`

**1. Route segment + URL state**

- File: `frontend/src/app/(testee)/history/page.tsx`. The `(testee)/history/` segment + its `error.tsx` boundary file are FE-7-introduced.
- URL state: `?cursor={cursor}` for pagination state. Cursor is opaque (server-issued, base64 or similar). Cursor changes on "Load more" sentinel intersection call `router.replace()` per FE-3 §C.7 pattern.
- Static `<title>History · Acumen</title>` from `layout.tsx`.
- Nav-rail anchor: `shell.jsx:12` declares the nav id as `history` with label "History"; rail-highlight wiring identical to `/profile`.

**2. Components**

- **Scaffold reused:** `useAuth()` (FE-1) for role-guard; `client` + `unwrap()` (FE-0); `PageHeader` (FE-2 — used for the eyebrow + serif-italic title per `testee.jsx:508`); `Card`, `Skeleton` (shadcn from FE-2's installed set); `useInfiniteQuery` from `@tanstack/react-query` per AC-CD21 + FE-3 §C.5 pattern; `IntersectionObserver` (browser API).
- **New in this PR:**
  - **`HistoryTable`** — the full table composition per `testee.jsx:509–528`. Props: `{ pages: Array<{ attempts, next_cursor }>, onLoadMore, isFetchingNextPage, hasNextPage }`. Renders shadcn `<Table>` (or the design's `.tbl` class — locked at the design) with header row (`When | Pill | Origin | Score | Band | Δ comp`) + per-attempt rows + a "Load more" sentinel at the end.
  - **`HistoryRow`** — one per attempt per `testee.jsx:513–524`. Renders: timestamp (`.t-meta` formatted as "5m ago" / "2w ago" via `format-relative`), pill name, origin pill (`<Pill tone="soft" mono>{origin}</Pill>`), score (`.right.num` percentage), `BandTag` for the band, delta (`.right.num` with `--ok` tint if positive, `--danger` if negative). Click handler routes to `/attempts/{attempt_id}/result` (FE-6 destination).
- **shadcn primitives installed in this PR:** none beyond FE-2's set.
- **Design primitives reused:** `BandTag` (FE-2); `Pill` (FE-2) for the origin chip. `.tbl`, `.right`, `.num`, `.t-meta` design classes from FE-2's globals.css.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/attempts` | Primary fetch. Cursor-paginated list of the testee's own attempts. Consumed by `HistoryTable` via `useInfiniteQuery`. Shared cache with `/profile`'s sparkline derivation; if user navigates `/profile → /history`, the first page is already cached. | **ABSENT — §H (a) item 3 blocker.** Endpoint does not exist; only `POST /v1/attempts` exists in `frontend/openapi/schema.json:4873`. Page renders the `endpoint_absent` state per E.3 until the spec-clarification PR merges. |

**Locked contract for `GET /v1/attempts`** (own-scope; admin-scope variant lives in FE-9 territory). LOCK-1 — ships under the canonical `Page<T>` envelope per CODE_SPEC §5; LOCK-4 — `origin` carries the live wire enum values:

```ts
GET /v1/attempts?cursor=<opaque>&limit=50 → {
  data: Array<{
    attempt_id: string,
    pill_id: string,
    pill_name: string,
    submitted_at: string,                              // ISO datetime
    score_percent: number,                              // 0..100
    band: "novice" | "junior" | "working" | "advanced" | "expert",
    origin: "self_initiated" | "assignment_driven" | "loop_driven",  // AC-D6 + AC-D26 long-form enum (LOCK-4)
    competence_delta: number | null                     // null on first attempt for the pill
  }>,
  meta: { next_cursor: string | null }                  // null when no more pages
}
```

Backend default `limit: 50` matches FE-3's catalogue precedent (`fe-specs/FE-3-content.md:636`). The endpoint is testee-scoped — the authed user receives only their own attempts. Admin-scope (`/v1/attempts?testee_id=...&...`) is FE-9 territory and not part of FE-7's scope.

**4. Form fields + zod + rhf**

n/a — read-only page. **TanStack Query notes:**

```ts
const attempts = useInfiniteQuery({
  queryKey: [...meQueryKeys.attempts(), { limit: 50 }],
  queryFn: ({ pageParam }) => unwrap(client.GET("/v1/attempts", {
    params: { query: { cursor: pageParam, limit: 50 } }
  })),
  initialPageParam: undefined as string | undefined,
  // LOCK-1 — canonical Page<T> envelope, cursor at meta.next_cursor; `?? undefined` so TanStack
  // treats null-cursor as "no more pages" rather than retrying with literal null.
  getNextPageParam: (last) => last.meta.next_cursor ?? undefined,
});

const flatRows = useMemo(
  () => attempts.data?.pages.flatMap(p => p.data) ?? [],
  [attempts.data]
);
```

Sentinel pattern per FE-3 §C.5: `IntersectionObserver` on a div at the end of the table calls `attempts.fetchNextPage()` when intersecting and `hasNextPage`. No infinite scroll without sentinel; no page numbers; no "back to top" button in v1.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `loading` | Initial query in-flight | Skeleton table (header row + 10 grey row skeletons). |
| `endpoint_absent` | `GET /v1/attempts` returns 404 / 405 | Per FE-3 drift pattern: PageHeader renders "Your attempt history · Coming in v1.x"; card body shows placeholder copy "Your attempt history arrives once we light up the `/v1/attempts` endpoint." Recorded as §E item 3 placeholder. |
| `empty` | Response is `{ attempts: [], next_cursor: null }` (new testee) | PageHeader renders "Your attempt history · 0 records"; card body shows "No attempts yet" empty-state copy. |
| `happy_first_page` | First page returns attempts + `next_cursor !== null` | Table renders with N rows + "Load more" sentinel visible at the end. |
| `happy_paginated` | User scrolls to sentinel → `fetchNextPage` fires → second page loads | Additional rows append below the first page; sentinel re-appears at the new end (or hides if `next_cursor === null`). |
| `happy_no_more_pages` | Response has `next_cursor === null` | Table renders; sentinel hidden; no "Load more" affordance. |
| `loading_more` | `isFetchingNextPage === true` | Sentinel renders a small "Loading…" spinner; existing rows unchanged. |
| `row_origin_self_initiated` | Per row: `origin === "self_initiated"` | Origin chip renders "self_initiated" mono (LOCK-4 — live wire enum). |
| `row_origin_assignment_driven` | Per row: `origin === "assignment_driven"` | Origin chip renders "assignment_driven" mono. |
| `row_origin_loop_driven` | Per row: `origin === "loop_driven"` | Origin chip renders "loop_driven" mono. |
| `row_delta_positive` | Per row: `competence_delta > 0` | Δcomp renders "+0.4" in `var(--ok)`. |
| `row_delta_negative` | Per row: `competence_delta < 0` | Δcomp renders "-0.5" in `var(--danger)`. |
| `row_delta_first_attempt` | Per row: `competence_delta === null` | Δcomp renders "—" in `var(--ink-dim)` (first attempt for the pill — no prior baseline per AC-D9 `null = no data yet` rule). |
| `row_click` | User clicks a row | `router.push('/attempts/{attempt_id}/result')` — FE-6 destination. |
| `error` | Query throws (non-404) | Pattern C boundary card mounts via `(testee)/history/error.tsx`. Copy: "Couldn't load your history." + "Try again" + "Go to dashboard". |
| `role_mismatch` | Admin role hits `/history` | AC-CD20 `(testee)` layout guard redirects to `/403`. |
| `privacy_unacked` | `(authed)` parent guard redirects to `/privacy`. | — |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Happy-path testee lands on history with first page
  Given the testee has 75 attempts
  When the testee opens /history
  And the first page query resolves with 50 attempts + next_cursor
  Then HistoryTable renders 50 rows
  And the "Load more" sentinel renders at the end
```

```gherkin
Scenario: Sentinel intersection loads next page
  Given the table is in state happy_first_page
  When the user scrolls the sentinel into view
  Then fetchNextPage fires
  And the second page resolves with 25 rows + next_cursor null
  And HistoryTable renders 75 total rows
  And the sentinel is no longer mounted
```

```gherkin
Scenario: Endpoint absent — drift-placeholder mode
  Given GET /v1/attempts returns 404 or 405
  When the page mounts
  Then PageHeader renders "Coming in v1.x"
  And the card body shows the placeholder copy
  And no table rows mount
```

```gherkin
Scenario: Empty history (new testee)
  Given GET /v1/attempts returns { attempts: [], next_cursor: null }
  When the page mounts
  Then PageHeader renders "0 records"
  And the card body shows "No attempts yet" empty-state copy
```

```gherkin
Scenario: First-attempt delta renders as em dash
  Given a row with competence_delta === null
  Then the Δcomp column renders "—" in --ink-dim tone
```

```gherkin
Scenario: Row click navigates to result page
  Given any row in the table
  When the user clicks the row
  Then router.push fires with /attempts/{attempt_id}/result
  And the history page unmounts via the (testee) shell
```

```gherkin
Scenario: Admin hits testee history URL — 403
  Given an admin user opens /history
  Then the (testee) layout guard redirects to /403
```

(Seven total scenarios mapped to §D.2 page-integration tests.)

**7. Edge cases / gotchas**

- **Cursor opacity.** Cursor strings are opaque server-issued tokens; FE never inspects or constructs them. URL-encoded for `?cursor=` query param transport.
- **Page jumping via direct URL access.** `/history?cursor=abc` on a fresh page load fetches starting from the cursor — the testee sees the second-page-and-onward rows, not the first 50. This is the cursor-pagination trade-off (no "skip to page N" without server support). v1 accepts; surfaced as §E item 5 (no UI affordance for cursor manipulation).
- **Relative-age formatting reuse.** `format-relative.ts` from FE-6 §C.3 (`frontend/src/lib/result/format-relative.ts`) is reused unchanged; the helper lives in `result/` namespace but is shared. If FE-6 build hasn't shipped at FE-7 build time, FE-7 implements the helper at `frontend/src/lib/profile/format-relative.ts` and the two consolidate in a post-FE-7 cleanup PR. Surfaced in §C.4 + §H (b) item 9.
- **Long pill names truncate.** `.ellipsis` class on the pill-name column per the design (or `text-overflow: ellipsis` if not in the design's CSS). Spec assumes truncation in v1; no tooltip in v1 (deferred).
- **Δcomp precision.** Server returns ≤1 dp; client formats via `.toFixed(1)`. Sign prefix: `+` for positive, native `-` for negative, "—" for null.
- **`origin` enum is the live long-form** (`self_initiated | assignment_driven | loop_driven`) per LOCK-4 — the spec body's earlier short-form (`self | assignment | loop`) was authoring-time placeholder; AC-D26 + AC-D6 + `app/models.py:119-122` are the source of truth.
- **Per-row `band` is per-attempt-derived, not pill-level** (F8). `app/domain/attempts.py:2086-2097` derives the history-row band from `score_percent / 10` projected onto the 0..10 competence axis — `Attempt` lacks a per-attempt band snapshot column. A row showing "junior" for a 47% score does not mean the testee was junior in that pill at attempt time; it means that attempt's score-axis projection lands in the junior band. The §C.5 BandTag treatment for history rows (band-only, no estimate/confidence) is consistent with this carve-out: per-row enrichment with the live float is a v1.x consideration once the per-attempt snapshot column lands.
- **Loading-more sentinel race.** If the user scrolls fast past the sentinel before `IntersectionObserver` fires, no rows load until the next intersection. v1 accepts; mirror FE-3 catalogue precedent.
- **Shared cache with /profile.** Both pages key off `meQueryKeys.attempts()` root, with `{limit: 200}` (profile) and `{limit: 50, cursor}` (history infinite) sub-keys derived from query params hash. Different cache entries by design — the profile page only needs the latest 200 for sparkline derivation; the history page paginates from page 1. If perf becomes a concern (rare network), v1.x can consolidate.
- **`list_own_submitted_attempts` loads then Python-paginates** (F11, AC-CD15). The handler at `app/domain/attempts.py:2046-2102` loads every submitted attempt for the testee, sorts in Python, and slices for the cursor page. AC-CD15 FakeSession harness allows equality-only WHERE; the canonical `app.domain.catalogue.paginate` orders ASC by `(created_at, id)` whereas the history page needs `submitted_at DESC`, so inline pagination is justified. At v1 scale (~tens of attempts per testee) acceptable; revisit at v1.x if attempt volumes climb.

**8. Visual reference**

- `frontend/design-reference/prototype/testee.jsx:496–531` — `TesteeHistory` (the full /history page composition).
- `frontend/design-reference/prototype/shell.jsx:12` — `history` nav id ("History" label) + rail-highlight wiring.
- Screenshot: `v6-fe7-XX-history.png` — **ABSENT**, see §F.7.

---

## C. Cross-page concerns

### C.1 Shared components introduced this PR

Seven new files under `frontend/src/components/profile/`:

```
frontend/src/components/profile/
├── constellation-svg.tsx              # B.1 §2
├── matrix-table.tsx                   # B.1 §2
├── selected-pill-detail-card.tsx      # B.1 §2
├── sparkline.tsx                      # B.1 §2
├── view-toggle.tsx                    # B.1 §2
├── legend.tsx                         # B.1 §2
├── how-to-read.tsx                    # B.1 §2 (sunk-variant explainer)
└── history-table.tsx                  # B.2 §2
```

Plus `ProfileHero` is co-located inline in `(testee)/profile/page.tsx` (presentational, no reuse rationale to extract).

Total 8 new component files. AC-CD-level structural addition under `SESSION_START.md:86–96` carve-out (cluster under one new domain folder; well-rationalised against AC-CD19 + AC-CD20 routing model). Folds into the FE-7 build PR's handover.

### C.2 `meQueryKeys` library — consumed unchanged

`frontend/src/lib/queries/me.ts` (FE-3 §B.5) already defines `meQueryKeys.competence()` and `meQueryKeys.attempts()` as forward placeholders at `fe-specs/FE-3-content.md:527–535`. FE-7 is the first-class consumer of both; no new key roots, no edit to the key library, no inline key construction in page files (per FE-3 §B.5 §7 — "Reviewers reject PRs that introduce inline keys").

The page-level call-site adds the param shape (`limit: 200` for the profile sparkline; `cursor + limit: 50` for the history infinite query) per AC-CD21 — TanStack Query options are co-located with the caller, not abstracted into per-key option blocks.

### C.3 Subject colour helper — consumed unchanged from FE-3

`frontend/src/lib/catalogue/subjects.ts` (FE-3 §C.4) exports `SUBJECT_COLOURS: Record<string, { name; colour; shortLabel }>`. FE-7's `ConstellationSVG` consumes it for cluster-halo fills (`<circle fill={s.color}/>` per `constellation.jsx:72`); `MatrixTable` consumes it for the left-edge subject tick (`<span style={{background: s.color}}/>` per `constellation.jsx:300`). No new helper. No FE-3 file edit.

### C.4 Helper libraries introduced

New files under `frontend/src/lib/profile/`:

```
frontend/src/lib/profile/
├── derive-sparkline.ts                # B.1 §2 — filters attempts by pill_id, sorts asc by submitted_at, projects competence_estimate, truncates to 6
├── layout-constellation.ts            # B.1 §2 — pure layout math per constellation.jsx:10–33
└── confidence-qualifier.ts            # §C.5 — n >= 20 → "confident"; n < 20 → "preliminary" (caller uses when the backend hasn't computed the enum)
```

Each carries a D.1 unit test.

`format-relative.ts` (B.2 history-row timestamp) is reused unchanged from FE-6 §C.3 (`frontend/src/lib/result/format-relative.ts`); FE-6 build shipped (PR-059), so the §H (b) item 9 conditional-fallback branch (FE-7 ships its own copy) is dead and dropped (F12).

### C.5 BandTag `confidence` + `estimate` — first-class consumer at scale

FE-7 is the first spec to *exercise* the `estimate` + `confidence` prop pair that FE-2 spec locked at `fe-specs/FE-2-shell.md:644–651`. The pair is consumed at every scale point:

- **`SelectedPillDetailCard`** title row: `<BandTag band={pill.band} estimate={pill.competence_estimate} confidence={pill.confidence}/>`. Caller composes the `n` suffix per FE-2 §B.6 (FE-2 itself has no access to sample-size data; FE-7 wires it).
- **`MatrixTable`** cell: the current-difficulty cell shows the float; the BandTag in the detail card surfaces the confidence label. Matrix cells themselves render the float (not the full BandTag) — keeps the grid scannable.
- **`ConstellationSVG`** confidence ring length: derived directly from `n` (not from the `confidence` enum) — visual gradient per `constellation.jsx:97`. The `confidence` enum is for the *label* surface (the BandTag suffix) — these are two distinct surfaces backed by two distinct thresholds. **Dual-threshold note:** the design uses `n=30` for the ring "full" visual; AC-D20 uses `n=20` for the `preliminary→confident` enum boundary. Documented at B.1 §7 edge case.
- **`HistoryTable`** row: per `testee.jsx:521`, the band column renders `<BandTag band={row.band}/>` without `estimate` or `confidence` (history rows are scannable per-row snapshots; the float + qualifier surface only on the profile detail card). Per-row enrichment is a v1.x consideration.

FE-6's narrow confidence surface (by-pill weakness card only, per `fe-specs/FE-6-results.md:333–334`) is explicitly extended by FE-7 to every scale point. The brief's instruction — "FE-7 visualizations must surface calibration confidence at every scale point — not just on the by-pill weakness card (FE-6's narrow surface)" — is delivered via the BandTag `confidence` prop at the detail-card surface plus the visual ring-length gradient at the constellation surface.

### C.6 Pattern A / B / C in profile + history context

- **Pattern A — inline error:** not used (no inline forms; both pages are read-only).
- **Pattern B — toast:** not used (no mutations on either page in v1; "Defer" CTA on FE-6 result page is the only v1 testee-facing mutation surface).
- **Pattern C — boundary:** `(testee)/profile/error.tsx` + `(testee)/history/error.tsx` for fetch failures. Copy: "Couldn't load your competency." / "Couldn't load your history." + "Try again" (resets boundary) + "Go to dashboard". Mirrors FE-3 §C.6 / FE-6 §C.4 pattern.

### C.7 Route guard posture (AC-CD20)

Testee role only. Admin role → `/403` per the AC-CD20 five-posture matrix locked in FE-1 §C.4. Privacy-unacked user → `/privacy`. The `(testee)` route group's `layout.tsx` (FE-2 / FE-3) handles both. FE-7 ships no admin variant of either route (FE-9 admin operations + roll-up is its own surface).

### C.8 Inter-page dependencies

- **FE-7 → FE-3.** `SelectedPillDetailCard` CTAs route to FE-3 pill detail (`/pills/{pill_id}` for "Open explainer"; `/pills/{pill_id}?d={n}` for "Practice at D{n}" + "Step up to D{n+1}"). FE-3 owns the destination; the LD3 pill→test resolver (FE-3 §H (b) item 3 / FE-4 §H (a) item 2) is the inherited blocker for the practice CTAs to actually launch an attempt. FE-7's CTAs only need the route to exist; the resolver is FE-3 territory.
- **FE-7 → FE-6.** `HistoryTable` row click routes to `/attempts/{attempt_id}/result` — FE-6 destination. FE-6 ships the result page (replaces the FE-4 placeholder per `fe-specs/FE-6-results.md:1109`); FE-7's row click only needs the route to exist.
- **FE-3 → FE-7 (reverse hand-off).** FE-3's `RecentAttemptsCard` (`fe-specs/FE-3-content.md:592`) is feature-flagged off (`flags.recentAttemptsWidget: false` per FE-3 §C.8) pending `GET /v1/attempts` landing. When FE-7's spec-clarification PR merges the endpoint on `main`, FE-3 flips the flag to `true` (post-FE-7 cleanup PR or in the FE-7 build PR's scope — TBD per the user's authoring sequence; documented but not blocking).
- **FE-7 → FE-9 (forward hand-off).** No direct hand-off. FE-9's admin team-rollup view (`fe-specs/FE_ROADMAP.md:176+`) is a separate surface; FE-7 owns only the per-Testee view.

### C.9 URL-state policy for the selected-pill deep link

`?pill={pillId}` query state on `/profile`. Behaviour:
- On mount: `selectedId = searchParams.get('pill') ?? <first pill with n > 0>`.
- On selection change (star click, chip click, matrix row click): `router.replace(?pill={newId}, { scroll: false })`.
- `router.replace` not `push` per FE-3 §C.7 — back button doesn't accumulate pill-selection noise.
- If the URL param doesn't match any pill in the response (stale link, deleted pill), silent fallback to default + URL replace clears the stale param.

History page uses `?cursor={cursor}` for pagination state per B.2 §1 — same `router.replace` discipline.

---

## D. Test cases (Vitest)

Four-tier test plan per FE-1 / FE-5 / FE-6 precedent. **Doc-only PR — these tests are documented Gherkin + planned filenames; no test-runner runs in this PR. Vitest + RTL + MSW execute when the FE-7 build PR opens.**

### D.1 Unit tests (lib + helpers)

- `derive-sparkline.test.ts` — filters attempts by selected pill_id; sorts ascending by submitted_at; projects `competence_estimate`; truncates to 6 latest; empty list → empty array; one attempt → single point (Sparkline component handles the placeholder display).
- `layout-constellation.test.ts` — pure layout math; deterministic per `[pills, subjects]` input (referential stability); cluster centres lie on the `r=0.32` ring per `constellation.jsx:16`; pills cluster around their subject centre with `0.06–0.118` radius range per `constellation.jsx:28`.
- `confidence-qualifier.test.ts` — `n === 19` → `"preliminary"`; `n === 20` → `"confident"` (threshold from AC-D20 default per `DECISIONS.md`).
- `format-relative.test.ts` (conditional — if FE-6 helper hasn't shipped) — relative-age formatting against fixed `Date.now()` mock; "5 minutes ago" / "an hour ago" / "2 weeks ago" pattern.

### D.2 Page integration tests (Vitest + RTL + MSW)

One scenario per state in B.1 + B.2 tables:

**Profile page (`/profile`)**:
- `profile-page-loading.test.tsx` — MSW returns pending response on slow timer; skeleton renders.
- `profile-page-endpoint-absent.test.tsx` — MSW returns 404; assert placeholder copy + ViewToggle/ConstellationSVG/SelectedPillDetailCard not mounted.
- `profile-page-empty.test.tsx` — MSW returns `{ pills: [] }`; assert empty-state copy.
- `profile-page-happy-constellation.test.tsx` — MSW returns 20 pills; assert 20 stars + default selection + detail card + HowToReadCard.
- `profile-page-deep-link-mount.test.tsx` — Mount with `?pill=antifouling`; assert selection initialises correctly without router.replace firing.
- `profile-page-deep-link-stale.test.tsx` — Mount with `?pill=unknown-id`; assert fallback to default + router.replace clears stale param.
- `profile-page-select-via-chip.test.tsx` — Click related-pill chip; assert selection update + URL replace + card re-render.
- `profile-page-view-toggle.test.tsx` — Click "Matrix"; assert ConstellationSVG unmounts + MatrixTable mounts + SelectedPillDetailCard/HowToReadCard hide.
- `profile-page-cta-practice.test.tsx` — Click "Practice at D7"; assert `router.push('/pills/antifouling?d=7')`.
- `profile-page-cta-step-up.test.tsx` — Click "Step up to D8"; assert `router.push('/pills/antifouling?d=8')`.
- `profile-page-confidence-ring.test.tsx` — Fixture: pills with n=10, n=20, n=30; assert constellation ring `strokeDasharray` values + BandTag preliminary/confident suffix.
- `profile-page-safety-mark.test.tsx` — Fixture: pill with `safety_relevant: true`; assert red-dot safety mark + safety pill in detail card.
- `profile-page-error.test.tsx` — MSW returns 5xx; assert Pattern C boundary card mounts with "Try again" reset.
- `profile-page-role-mismatch.test.tsx` — Auth context returns admin role; assert redirect to `/403`.

**History page (`/history`)**:
- `history-page-loading.test.tsx` — Skeleton table renders.
- `history-page-endpoint-absent.test.tsx` — MSW returns 404; assert placeholder copy.
- `history-page-empty.test.tsx` — MSW returns `{ attempts: [], next_cursor: null }`; assert empty-state copy.
- `history-page-happy.test.tsx` — MSW returns 50 attempts + next_cursor; assert 50 rows + sentinel visible.
- `history-page-pagination.test.tsx` — Trigger sentinel intersection; second page resolves; assert 75 total rows + sentinel hidden.
- `history-page-row-click.test.tsx` — Click a row; assert `router.push('/attempts/{id}/result')`.
- `history-page-first-attempt-delta.test.tsx` — Row with `competence_delta === null`; assert "—" in `--ink-dim`.
- `history-page-error.test.tsx` — 5xx → Pattern C boundary.
- `history-page-role-mismatch.test.tsx` — Admin → /403.

### D.3 Round-trip integration test (cross-spec)

`profile-roundtrip.test.tsx` — Mount `/profile?pill=antifouling` → assert star selected + detail card + sparkline derived from MSW-served attempts → toggle to matrix → assert pill row highlighted → click "Practice at D7" → assert router push to `/pills/antifouling?d=7`. Single test spans the profile page + the FE-3 destination route assertion.

`history-roundtrip.test.tsx` — Mount `/history` → first page resolves → click a row → assert router push to `/attempts/{id}/result` → mount the FE-6 result page (mocked) → assert page mount succeeds. Single test spans history + FE-6 destination.

### D.4 Playwright E2E

None new for FE-7 in v1. The testee golden-path E2E from FE-6 (`results-end-to-end.spec.ts` per `fe-specs/FE-6-results.md:960`) doesn't extend into the profile/history pages. v1.x may add a profile-E2E once the backend endpoints land and the sparkline data flows end-to-end.

### D.5 Existing tests preserved

All FE-1..FE-6 tests must continue passing. FE-3's dashboard test of `RecentAttemptsCard` flag-off remains green until FE-3 flips the flag (post-FE-7 cleanup PR or in-PR).

### D.6 Coverage gate (FE_CHECKLIST.md FE-7 rows tick on)

| FE-7 row (`FE_CHECKLIST.md:100–106`) | Satisfied by |
|---|---|
| Competency constellation SVG | `profile-page-happy-constellation.test.tsx` + `profile-page-confidence-ring.test.tsx` + `profile-page-safety-mark.test.tsx` + `layout-constellation.test.ts` |
| Selected-pill detail card (band, n, confidence, trend, related, CTAs) | `profile-page-happy-constellation.test.tsx` + `profile-page-select-via-chip.test.tsx` + `profile-page-cta-practice.test.tsx` + `profile-page-cta-step-up.test.tsx` + `profile-roundtrip.test.tsx` |
| Sparkline derived client-side from attempts list | `derive-sparkline.test.ts` + `profile-page-happy-constellation.test.tsx` + `profile-roundtrip.test.tsx` |
| Matrix-view toggle | `profile-page-view-toggle.test.tsx` + `profile-roundtrip.test.tsx` |
| Attempt history table | `history-page-happy.test.tsx` + `history-page-pagination.test.tsx` + `history-page-first-attempt-delta.test.tsx` + `history-page-row-click.test.tsx` + `history-roundtrip.test.tsx` |
| Backend dep: `GET /v1/attempts` (own scope) | Satisfied by the user-authored spec-clarification PR landing on `main` (`§H (a) item 3`); FE-7 build session opens only after merge |
| Backend dep: `GET /v1/me/competence` | Satisfied by the user-authored spec-clarification PR landing on `main` (`§H (a) item 2`); FE-7 build session opens only after merge |

---

## E. Known placeholders (DO NOT SHIP AS-IS)

| # | Placeholder | Location | Action before production |
|---|---|---|---|
| E.1 | Profile page renders `endpoint_absent` placeholder copy ("Your competency · Coming in v1.x") when `GET /v1/me/competence` returns 404/405 | `(testee)/profile/page.tsx` top-level branch | Wire to real data once the endpoint lands per §H (a) item 2 — same drift-placeholder pattern as FE-3 dashboard hero |
| E.2 | Constellation empty-state copy "Your constellation will appear after a few attempts." | `constellation-svg.tsx` empty branch | **Genuine empty state — ships as-is.** Not a drift placeholder. Applies whenever the response is `{ pills: [] }` (new testee). |
| E.3 | History page renders `endpoint_absent` placeholder copy when `GET /v1/attempts` returns 404/405 | `(testee)/history/page.tsx` top-level branch | Wire to real data once the endpoint lands per §H (a) item 3 — same drift-placeholder pattern as E.1 |
| E.4 | Confidence threshold `n >= 20` hardcoded in `confidence-qualifier.ts`; mirrors AC-D20 default | `confidence-qualifier.ts` | Build session opens with a read of `DECISIONS.md` AC-D20 to confirm the threshold value. If System Settings exposes `calibration_confidence_threshold` via the `/v1/me/competence` response, consume that instead of the hardcoded constant. The spec assumes the backend returns the resolved `confidence` enum (per the locked contract in §H (a) item 2) — `confidence-qualifier.ts` is only a fallback for cases where the backend hasn't computed it (which should never happen post-merge). |
| E.5 | History page has no filter / search / date-range UI in v1 — pagination only | `history-table.tsx` | v1.x adds filter UI. v1 ships with cursor pagination only per the done-when verbatim. Surfaced as a documented v1 scope limit; no copy treatment, no "filters coming soon" UI. |
| E.6 | "Open explainer" CTA on SelectedPillDetailCard is conditional in v1 (only renders if a pill has admin-uploaded reference material) — but the prototype does not draw this CTA explicitly | `selected-pill-detail-card.tsx` | Locked decision: ship without "Open explainer" in v1; the "Practice at D{n}" + "Step up to D{n+1}" CTAs are the v1 surface per `constellation.jsx:240–243`. v1.x may add "Open explainer" once Learning Center surface lands per FE-1 §F.1 deferral. Surfaced in §F.7. |

---

## F. Scope additions beyond `fe-specs/FE-7-profile.md`

### F.1 New `frontend/src/components/profile/*` cluster

8 new files per §C.1. AC-CD-level structural addition under `SESSION_START.md:86–96` (cluster under one new domain folder; well-rationalised against AC-CD19 + AC-CD20 routing model). Folds into the FE-7 build PR's handover.

### F.2 New `frontend/src/lib/profile/*` helper cluster

3 new helper files per §C.4 (`derive-sparkline.ts`, `layout-constellation.ts`, `confidence-qualifier.ts`). AC-CD-level structural addition; folds into handover.

If `format-relative.ts` is not yet shipped by FE-6 build at FE-7 build time, FE-7 ships a fourth helper here and a post-FE-7 cleanup PR consolidates with FE-6's (`fe-specs/FE-6-results.md:880` — `format-relative.ts` in `result/`). §H (b) item 9 verifies at build-session start.

### F.3 `(testee)/profile/page.tsx` + `(testee)/history/page.tsx` + 2 `error.tsx` boundaries

4 new files in the `(testee)` route group:
- `frontend/src/app/(testee)/profile/page.tsx`
- `frontend/src/app/(testee)/profile/error.tsx` (Pattern C per §C.6)
- `frontend/src/app/(testee)/history/page.tsx`
- `frontend/src/app/(testee)/history/error.tsx` (Pattern C per §C.6)

No `(testee)/layout.tsx` edit. The shared `(testee)` shell from FE-2 hosts both pages unchanged. Folds into handover.

### F.4 No new query-key roots

§C.2 — `meQueryKeys` library consumed unchanged. FE-7 consumes `meQueryKeys.competence()` + `meQueryKeys.attempts()` (declared in FE-3 §B.5) as the first-class consumer. No edit to `frontend/src/lib/queries/me.ts` beyond confirming the keys exist at FE-7 build-session start.

### F.5 No FE-2-owned file edit

The BandTag `estimate` + `confidence` props were locked in FE-2 spec at `fe-specs/FE-2-shell.md:644–651` ahead of FE-7's consumption. No FE-2 file edit needed — FE-7 only wires the data binding via composition. **Note:** the FE-2 *prototype* (`shell.jsx:127–138`) does not yet have the `confidence` prop in its inline JSX; the FE-2 *spec* locks it. This is spec-leads-prototype, intentional. §F.7 records the deviation; no action required.

### F.6 No `FE_ROADMAP.md` / `FE_CHECKLIST.md` edit

FE-7 scope rows in `FE_CHECKLIST.md:96–107` are reflected in this spec verbatim. No new non-goals to declare; no scope expansion beyond the roadmap. The two backend-dep rows (`FE_CHECKLIST.md:105–106`) are surfaced as §H (a) blockers with locked contracts.

### F.7 Design-reference completeness check

Per SESSION_START.md and the FE-3 / FE-6 precedent: walk the design-reference and surface gaps.

1. **`constellation.jsx` is the canonical design reference for `/profile`.** The Phase 1 brief was inaccurate on this point — `constellation.jsx` (full file 1–328) exists with `TesteeProfile`, `Constellation`, `Sparkline`, `MatrixView` all present. The page composition, the SVG visualisation logic, the matrix grid, the sparkline math, and the right-column detail card chrome are all canonical in the prototype. No design gap for the profile page composition itself.

2. **`testee.jsx:496–531` is the canonical design reference for `/history`.** The `TesteeHistory` component is complete with table chrome, row map, and per-column rendering. No design gap for the history page.

3. **`v6-fe7-*` screenshots are ABSENT.** No files matching `v6-fe7-*` exist under `frontend/design-reference/screenshots/`. The screenshot inventory has FE-1, FE-2, FE-3, FE-4, FE-5, FE-6, FE-8, FE-9 coverage; FE-7 has zero. Treat per FE-3 precedent (`fe-specs/FE-3-content.md` design-ref completeness note) — accept the JSX prototype as canonical, document the screenshot absence here, do **not** escalate to §H (a) blocker. v1.x screenshot pass may close.

4. **`shell.jsx` `BandTag` lacks `confidence` prop in its inline JSX** (`shell.jsx:127–138` renders `{ band, withLabel, withPips }` only). The FE-2 *spec* (`fe-specs/FE-2-shell.md:644–651`) locks the prop; FE-7's first-class consumption is the first place the prop is wired with real data. Spec-leads-prototype is intentional per the FE-2 spec discipline; documented here, not escalated.

5. **`shell.jsx` nav id `profile` + label "Competency"** (`shell.jsx:11`). The route segment matches the nav id verbatim. Rail-highlight wiring consumes the same id. No design gap.

6. **`constellation.jsx:240–243` draws "Practice at D{n}" + "Step up to D{n+1}" CTAs only.** The brief mentions "Open explainer" as a CTA; the prototype does not draw it. v1 ships only the two practice CTAs per the prototype; "Open explainer" is conditional (only renders if pill has admin-uploaded reference material) and is deferred to v1.x once Learning Center surface lands (FE-1 §F.1 precedent). Recorded as §E item 6 placeholder.

7. **AC-D27 anchor calibration math is server-only.** AC-D27 (`DECISIONS.md:672+`) specifies Bayesian effective-difficulty estimation and cold-start confidence math — all server-side. FE-7 surfaces only the outputs (`competence_estimate` float + `confidence` enum) per the locked competence response contract. The brief listed AC-D27 as an FE-7 anchor; verification during planning confirmed there is no new client display contract beyond AC-D9 + AC-D20 (already covered). Recorded here as a design-reference note, NOT escalated to §H (a) blocker.

8. **`constellation.jsx:213` reads `selected.n >= 20 ? 'confident' : 'preliminary'` client-side.** The prototype computes the qualifier locally; the spec body locks the `confidence` enum as server-computed per AC-D20 / §H (a) item 2 contract. `confidence-qualifier.ts` (§C.4) exists as a fallback helper but should never run against a well-formed response. Spec-led divergence from prototype; surfaced in §C.5 + §E.4.

9. **`constellation.jsx:97` uses `n=30` for the "full" confidence ring; AC-D20 uses `n=20` for the qualifier enum threshold.** Two distinct thresholds for two distinct surfaces (visual gradient vs binary label). Documented at B.1 §7 + §C.5; intentional. Surfaced here as a design-spec coexistence, not a drift.

10. **`constellation.jsx:159` reads `Your competency · 20 pills · calibrated`** — the count "20" is hardcoded in the prototype; FE-7 derives the count from `competence.pills.length`. No drift; spec-faithful interpolation.

Ten gaps catalogued. None escalate to §H (a) blocker. Items 1–2 + 5 are no-op confirmations; items 3, 6, 7 are FE-3/FE-1 precedent-compliant deferrals; items 4, 8, 9 are intentional spec-leads-prototype carve-outs; item 10 is a spec-faithful interpolation.

---

## G. Session 8 onwards — template propagation to FE-8..FE-9

The structure (§0 Context → §A inventory → §B per-page 8-section template → §C cross-page → §D tests → §E placeholders → §F scope-bleed → §G template propagation → §H drift roll-up) is the **template for every subsequent FE-N detail spec** — inherited from FE-1..FE-6 verbatim, unchanged at FE-7.

**FE-7's §B variance — intentional deviation from FE-6 §G's anticipation:** FE-6 §G at `fe-specs/FE-6-results.md:1036` anticipated "constellation SVG → larger §F structural-additions block; selected-pill detail card and matrix-view toggle add B-entries; expect 6–8 B-entries" for FE-7. FE-7 ships **2 B-entries** (`/profile` + `/history`) with the visualisation components composed inside §B.1 §2 (Components) rather than broken out as separate B-entries. Justification: the visualisation components (`ConstellationSVG`, `MatrixTable`, `SelectedPillDetailCard`, `Sparkline`, `ViewToggle`, `Legend`, `HowToReadCard`) are profile-page-specific in v1 with **no cross-PR reuse rationale**. The FE-2 primitive-heavy per-capability §B pattern applies when components are cross-PR primitives (BandTag, Stat, Pill — used across FE-3, FE-6, FE-7, FE-9). It does NOT apply when components are page-specific. FE-7's components live exclusively under `frontend/src/components/profile/*` and surface only on `/profile`; per-page §B with composition is the honest choice.

Per-phase variances expected and ALLOWED for FE-8 / FE-9:

- **FE-8 (admin authoring suite)** — large surface; may split into multiple files if exceeding ~2500 lines per FE-1 §G precedent. Single editor with mode-conditional sections (lock-in from PR-033 §D2) means one B-entry covers the four test modes, not four separate B-entries. Per-page §B is the default; per-capability §B reserved for cross-PR primitives if FE-8 introduces any (test-authoring editor sub-components are likely page-specific and stay composed under the editor's B-entry).
- **FE-9 (admin operations suite)** — multiple distinct surfaces (ops dashboard, grade-review queue, loop monitor, engagement, cost, anchor calibration, system page). Each is its own B-entry — likely 7–9 B-entries. Visualisation-heavy surfaces (cost-dashboard charts, calibration anchor distribution charts) follow FE-7's per-page-with-composition pattern; the chart components are page-specific (cost-page charts don't reuse outside cost; calibration charts don't reuse outside calibration). FE-9 inherits FE-7's decision rule: per-page when page-specific, per-capability when cross-PR.

Per-phase variances NOT allowed without spec-drift surface:

- Skipping Gherkin acceptance criteria.
- Skipping drift roll-up / verification / blocker callouts.
- Folding test list into per-page sections.
- Inlining query keys in page files (the `meQueryKeys` / `attemptQueryKeys` / `pillQueryKeys` library pattern is locked at AC-CD21).
- Introducing a new error pattern beyond A/B/C.
- Adding admin variants to testee routes (admin gets its own route group; never branches on role inside a testee page).
- Hardcoding band-colour tokens or `--band-*` hex values in component code (per AC-CD23 token discipline; reviewers reject PRs that introduce them).

---

## H. Spec-drift roll-up (post-review classification)

The cross-walk surfaced 23 candidate items. After review, classified into three groups.

### (a) BLOCKERS for the FE-7 build session — must land before the build session opens

1. **FE-1..FE-6 builds must land first.** FE-7 inherits:
   - FE-1 route guards + Pattern C boundary file pattern;
   - FE-2 `BandTag` (with locked `estimate` + `confidence` props), `BandPips`, `Stat`, `Pill`, `Card`, `PageHeader`, `Skeleton`, design tokens (`--band-*`, `--ink*`, `--bg*`, `--accent*`, `--ok`, `--danger`, etc.), `.seg` / `.card` / `.matrix-grid` / `.h-display` / `.serif-it` classes;
   - FE-3 `meQueryKeys.competence()` + `meQueryKeys.attempts()` reservation, `SUBJECT_COLOURS` map, drift-placeholder pattern, cursor-pagination pattern, URL-state `router.replace` discipline, pill-detail destination routes (`/pills/{id}`, `/pills/{id}?d={n}`);
   - FE-4 attempt schema reference (history rows surface `pill_name`, `score_percent`, `band`, `origin`, `submitted_at` from the same domain);
   - FE-5 no direct dep (FE-7 doesn't consume streaming surfaces);
   - FE-6 result-page destination route (`/attempts/{id}/result`), `format-relative.ts` helper at `frontend/src/lib/result/format-relative.ts` (or FE-7 ships a duplicate per §H (b) item 9), Pattern C boundary precedent.
   - Sequence: FE-1 build → FE-2 build → FE-3 build → FE-4 build → FE-5 build → FE-6 build → FE-7 build. Inherited blocker pattern from FE-6 §H (a) item 1.

2. **`GET /v1/me/competence` spec-clarification PR must merge on `main`.** Endpoint absent from `frontend/openapi/schema.json` (verified — no `/v1/me/*` paths at all in the OpenAPI snapshot). User authors a spec-clarification PR adding the endpoint with the **locked response contract** below (the spec body source-of-truth; the PR satisfies this contract verbatim):
   ```ts
   GET /v1/me/competence → {
     pills: Array<{
       pill_id: string,
       pill_name: string,
       subject_id: string,
       competence_estimate: number,                // AC-D9 float 1.0–10.0
       band: "novice"|"junior"|"working"|"advanced"|"expert",
       n: number,                                   // AC-D20 threshold input
       confidence: "preliminary"|"confident",        // AC-D20 server-computed enum
       last_activity_at: string | null,             // ISO datetime
       related_pill_ids: string[],                  // constellation edges
       safety_relevant: boolean                     // AC-D21
     }>
   }
   ```
   The FE-7 build session cannot open against an unlocked spec. FE-3's drift item for the same endpoint (`fe-specs/FE-3-content.md` dashboard hero) references the same shape; FE-7's spec-clarification PR locks the contract that FE-3 also consumes. **Until merged, FE-7 build pauses.**

3. **`GET /v1/attempts` (own-scope) spec-clarification PR must merge on `main`.** Endpoint absent (only `POST /v1/attempts` exists at OpenAPI schema line 4873). User authors spec-clarification PR. **Locked response contract:**
   ```ts
   GET /v1/attempts?cursor=<opaque>&limit=50 → {
     attempts: Array<{
       attempt_id: string,
       pill_id: string,
       pill_name: string,
       submitted_at: string,                          // ISO datetime
       score_percent: number,                          // 0..100
       band: "novice"|"junior"|"working"|"advanced"|"expert",
       origin: "self" | "assignment" | "loop",        // AC-D6 + AC-D26
       competence_delta: number | null                 // null = first attempt
     }>,
     next_cursor: string | null
   }
   ```
   FE-3 §H references this same endpoint (`fe-specs/FE-3-content.md` recent-attempts widget); FE-7 locks the contract for both consumers. Admin-scope variant (`?testee_id=...`) is FE-9 territory and out of FE-7's spec-clarification PR scope. **Until merged, FE-7 history build pauses; profile build proceeds without sparkline data (Sparkline empty-state ships).**

(AC-D27 anchor verification, the brief's fourth candidate blocker, was resolved during planning — server-side calibration math only; no new client surface beyond AC-D20 qualifier and `competence_estimate` float, both already covered. Not a blocker; recategorised to §F.7 item 7.)

### (b) BUILD-SESSION VERIFICATION TASKS — front-loaded at the start of the FE-7 build session

The build session opens with a verification step before any code lands: read `app/api/routers/competency.py` (per FE-3 reference — the router exists but is unmounted/empty in v1), `app/api/routers/attempts.py`, `app/schemas.py`, `app/domain/competence.py`, `app/domain/calibration.py`, and the regenerated `frontend/openapi/schema.json` (post-PR merges). Confirm the assumed contracts.

4. **`MeCompetenceResponse` payload shape.** Per §H (a) item 2 contract. Verify `confidence` enum values are exactly `"preliminary" | "confident"` (not booleans, not other string values). Verify `competence_estimate` is `number` (not nullable — per AC-D9 the float is computed once `n >= 1`; pills with `n === 0` are filtered server-side). If `confidence` is null/missing for low-n pills, align spec body (treat null as preliminary).

5. **`AttemptListResponse` payload shape.** Per §H (a) item 3 contract. Verify cursor-based pagination (not offset-based). Verify `competence_delta` is server-computed (not client-derived from successive attempts) — if client-derive is required, add a helper `derive-deltas.ts` in §C.4 and update §H (c).

6. **`competence_estimate` precision.** Spec assumes server returns ≤1 dp. If more precision, client truncates via `.toFixed(1)`. Verify against `app/domain/competence.py` rounding.

7. **`related_pill_ids` populated on competence response.** Constellation edges (`constellation.jsx:39–44`) require this. If absent or empty for all pills, edges-feature renders silently as no-edges — acceptable v1 fallback (the constellation still works without edges). Document the no-edges fallback in B.1 §7 edge case at build time.

8. **SVG layout performance with N=20 pills (v1 cap).** Performance risk per `FE_ROADMAP.md:154` ("SVG layout performance with 100+ pills if catalogue grows"). v1 verifies render perf at N=20 (the expected v1 catalogue size); >50 may need optimisation. If perf is a concern at v1 cap, add `requestAnimationFrame` throttling on selection updates or move layout to a Web Worker (deferred).

9. **`format-relative.ts` consolidation.** If FE-6 build has shipped `frontend/src/lib/result/format-relative.ts` (per `fe-specs/FE-6-results.md:880`), FE-7 reuses it directly. If not (FE-7 build opens before FE-6 build closes), FE-7 ships a duplicate at `frontend/src/lib/profile/format-relative.ts`; a post-FE-7 cleanup PR consolidates. Verify FE-6 build status at FE-7 build-session start.

10. **OpenAPI snapshot freshness post-spec-drift PRs.** Once the two spec-clarification PRs (§H (a) items 2 + 3) land, regen `frontend/openapi/schema.json`. Verify before build per `fe-specs/FE-6-results.md:1087` precedent. If a backend endpoint change ships between the two PR merges and FE-7 build open, fold the regen into the FE-7 PR.

11. **`origin` enum verification.** Spec assumes `"self" | "assignment" | "loop"`. AC-D26 + AC-D6 lock the underlying semantics. If backend exposes `"self_initiated" | "assignment_driven" | "loop_driven"` (longer-form), align spec body + HistoryTable origin chip copy.

12. **`AC-D20` threshold value.** Spec uses `n=20` per AC-D20 default. Verify against `DECISIONS.md` AC-D20 amended sections (`DECISIONS.md:513–523`) at build-session start. If different (e.g. System Settings override), update §E item 4 and `confidence-qualifier.ts`.

13. **`(testee)/profile/error.tsx` + `(testee)/history/error.tsx` Pattern C boundaries.** New files; mirror FE-6 / FE-5 / FE-4 boundary precedent. Verify shadcn `Card` is available from FE-2's installed set.

14. **`?pill=` URL replace doesn't cause page re-fetch.** Verify `router.replace` with `{ scroll: false }` doesn't re-trigger the page-level `useQuery` (TanStack key-based caching should be stable across same-key calls; query-string changes that don't change the cache key shouldn't refetch). If perf regression surfaces, add `useTransition` or move selected-pill state out of the query-trigger path.

### (c) APPROVED RESOLUTIONS — folded into the FE-7 build PR scope, captured in the build PR's handover

These are not blockers. The spec body above locks the resolution; the build session implements; the build PR's handover records them under the `SESSION_START.md` AC-CD-level structural-additions carve-out.

15. **`?pill={pillId}` URL state via `router.replace`** per §C.9. `useSearchParams` only, no new helper.

16. **`?cursor={cursor}` URL state on history page** per B.2 §1. `useInfiniteQuery` with `getNextPageParam: (last) => last.next_cursor` per FE-3 §C.5 precedent.

17. **8 new component files under `frontend/src/components/profile/*`** per §C.1 / §F.1.

18. **3 new helper files under `frontend/src/lib/profile/*`** per §C.4 / §F.2.

19. **4 new files in `(testee)` route group** (2 page.tsx + 2 error.tsx) per §F.3. No `(testee)/layout.tsx` edit.

20. **Admin role hitting `/profile` or `/history` → /403** via AC-CD20 `(testee)` layout-guard (FE-1 §C.4 five-posture matrix). No admin variant of either page ships in FE-7 (FE-9 admin team-rollup is a separate surface).

21. **BandTag with `confidence` + `estimate` props — first-class consumer.** Per FE-2 §B.6 locked contract; FE-7 wires the real `n` and `confidence` values from the locked `GET /v1/me/competence` response. Documented as the first-consumer milestone for the FE-2 prop pair. Folds into handover under design-spec consumption note.

22. **Sparkline as profile-page-specific component.** Lives at `frontend/src/components/profile/sparkline.tsx`. Not added to FE-2's primitives (no cross-PR reuse rationale in v1). If a future FE-8 / FE-9 surface introduces a sparkline-equivalent (cost-dashboard mini-chart?), the cross-PR primitive consolidation lands then, not retroactively in FE-7.

23. **Subject colour map consumed from FE-3 `subjects.ts`** unchanged. No file edit to FE-3.

24. **`meQueryKeys.competence()` and `meQueryKeys.attempts()` consumed unchanged** from FE-3's library. No file edit to FE-3.

25. **`constellation.jsx` accepted as canonical for `/profile`; `testee.jsx:496–531` canonical for `/history`** per §F.7 items 1–2. Spec-leads-prototype for the `BandTag` `confidence` prop per §F.7 item 4. Absence of `v6-fe7-*` screenshots documented in §F.7 item 3, NOT escalated to §H (a) blocker (FE-3 precedent).

26. **History pagination cursor-based with "Load more" sentinel** per B.2 §1 + §H (a) item 3 contract. Mirrors FE-3 catalogue pagination (`fe-specs/FE-3-content.md:636`). No page numbers; no infinite-scroll-without-sentinel; no "back to top".

27. **Dual-threshold note: visual ring length (`n=30` for full ring per `constellation.jsx:97`) vs label qualifier enum (`n=20` per AC-D20).** Both surfaces ship; documented at B.1 §7 + §C.5 + §F.7 item 9. Intentional design-spec coexistence.

28. **Sparkline values derived client-side from cached attempt list** per the done-when verbatim. No server-side sparkline endpoint. Helper at `derive-sparkline.ts` with D.1 unit test.

29. **Deterministic constellation layout** per `constellation.jsx:10–33` math (no `Math.random`; `sid.charCodeAt(0) * 0.13` phase seed). Spec contract: same input → same output positions. `useMemo([pills, subjects])` cache. D.1 unit test asserts referential stability.

30. **"Open explainer" CTA omitted from v1 detail card** per §F.7 item 6. Only "Practice at D{n}" + "Step up to D{n+1}" ship per `constellation.jsx:240–243`. v1.x may add "Open explainer" once Learning Center surface lands (FE-1 §F.1 precedent).

31. **History row click destination: `/attempts/{id}/result`** (FE-6 destination). No FE-6 file edit; only consumption of the route.

32. **`confidence-qualifier.ts` helper is a fallback** — backend computes the `confidence` enum per AC-D20; helper only runs when the response is malformed (which should never happen post-merge). Spec ships the helper for defensive reasons + D.1 unit test coverage.

33. **`view` toggle state is local React state, NOT URL state.** View choice ephemeral; doesn't survive page reload. Matches `constellation.jsx:146` default. v1.x may URL-sync.

34. **LOCK-1 — `GET /v1/attempts` ships under canonical `Page<T>` envelope** (`{data: AttemptListItem[], meta: {next_cursor}}` per CODE_SPEC §5). Spec body §B.1 §4 / §B.2 §3 / §B.2 §4 / §H (a) item 3 all amended in-PR; FE consumes `.data` + `.meta.next_cursor`. Earlier flat-shape (`{attempts, next_cursor}`) was authoring-time text only — never landed on the wire; the live handler at `app/routers/attempts.py:111-129` always shipped the envelope.

35. **LOCK-2 — `competence_estimate` non-nullable on the wire.** Backend `list_me_competence` filters `competence_estimate IS NULL` rows server-side (`app/domain/competence.py`); schema field tightened from `float | None` → `float` (`app/schemas.py:757`). FE-7 renders every BandTag / Stat / legend pill-count without null-guards. The defensive `band_string(None) → "novice"` mapping stays in the domain module for callers outside `list_me_competence`.

36. **LOCK-3 expanded — `n` derived from submitted Attempt rows, not `retake_count`.** Drift-sweep verification proved `CompetencyProfile.retake_count` is structurally dead in v1 (no production code path increments it; verified across `apply_competence_update`, crons, services at FE-7 build time). Shipping against it would have rendered every confidence ring at 0% length in production. Resolution: `list_me_competence` derives `n` from `count(Attempt) WHERE testee_id AND submitted_at IS NOT NULL` joined to `Test.pill_id`, mirroring `app/domain/attempts.py:2046-2097`. AC-CD15-safe (equality-only WHERE + Python walk). The dead `retake_count` column stays in the schema for a future migration; this PR doesn't drop it (separates the deletion from the live-path fix per AC-CD2 conservatism).

37. **LOCK-4 — `origin` enum is `self_initiated | assignment_driven | loop_driven`** (long-form). Spec body §B.2 §3 contract, §H (a) item 3 contract, §B.2 §5 row-origin state names, §C.5 BandTag history-row note all amended in-PR. FE consumes the live enum directly; no client-side mapper. AC-D26 + AC-D6 + `app/models.py:119-122` are the source of truth.

38. **Finding 10 — `list_me_competence` filters `CompetencyProfile.tenant_id == SEED_TENANT_ID`** alongside the adjacent `Pill` / `PillRelated` queries. v1 is single-tenant per AC-CD3 so the omission was safe, but the asymmetry was a port-time RLS trap; closing it now is a one-line fix with a one-test backstop and no production risk.

39. **Finding 13 punted — `flags.recentAttemptsWidget` flip stays off in FE-7.** FE-3's `RecentAttemptsCard` (`fe-specs/FE-3-content.md:592`) remains feature-flagged off in this PR. `GET /v1/attempts` is now live with the LOCK-1 envelope; flipping the flag is one line plus the FE-3 RecentAttemptsCard's data-extraction wiring, which would couple FE-7's PR fate to FE-3 component correctness. Deferred to a separate follow-up PR.

40. **Spec-leads-impl carve-outs absorbed.** F6 (route group `(authed)/(testee)/` not `(testee)/` — doc-drift only, FE-6 PR-059 precedent), F7 (`format: "uuid"` wire-typed fields emit as `string`), F8 (history-row band derivation from `score_percent/10`), F11 (`list_own_submitted_attempts` load-then-paginate), F12 (`format-relative.ts` consumed unchanged from FE-6) all carry-forward without further action; handover notes them.
