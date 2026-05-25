# FE-9 — Admin operations: system-state surfaces (detail spec)

> **Status:** plan-mode authored, ready for build session (subject to §H (a) blockers — the row-enrichment backend sweep PR from `fe-specs/FE-9-admin-ops.md` §H (a) item 1 must resolve before the FE-9 build session opens, AND a new `GET /v1/admin/realism/status` endpoint must be authored). FE-1..FE-8 builds must also land first per FE_ROADMAP dependency order.
> **Owns:** the three system-state / cron-trigger admin surfaces — cost dashboard (`/admin/cost`), anchor calibration (`/admin/calibration`), system page (`/admin/system`). Also owns the canonical `adminKeys.{cost,calibration,system}` extension set (§C.1).
> **PR target:** `PR-NNN-fe9-admin-operations` (single squash PR shared with `fe-specs/FE-9-admin-ops.md`).
> **Anchors:** AC-D18 (cost telemetry, budget alerts at 50/80/100%), AC-D20 + AC-D27 (anchor calibration — `effective_difficulty` Bayesian shrinkage, fresh-question delta, flagged-anchor queue), AC-D21 (safety-pill curation cron — monthly link verification), AC-D22 (Drive RAG ingest cron, realism aggregation cron), AC-D23 (bootstrap orchestrator), AC-CD11 (admin-only surfaces), AC-CD18 (model IDs as env defaults — cost dashboard surfaces what backend returns), AC-CD19 (FE stack lock), AC-CD20 (`(admin)` route group + role guard), AC-CD21 (centralised query keys + form helper + error envelope).
>
> Sibling of `fe-specs/FE-9-admin-ops.md`. Both files ship in one squash PR. Template inheritance: per-page §B from `fe-specs/FE-1-auth.md:50–60` verbatim; same FE-N spec preconditions as `fe-specs/FE-9-admin-ops.md` §0; consumes the `SweepButton` primitive canonically defined in `fe-specs/FE-9-admin-ops.md` §C.4 across four of five system-page op cards plus the calibration run button.

---

## 0. Context

Pair file to `fe-specs/FE-9-admin-ops.md`. See that file's §0 for the FE-N preconditions block — every precondition there applies here unchanged (`applyApiErrorToForm` path, FE-1 patterns A/B/C, FE-1 five-posture matrix, FE-2 admin shell + primitives, FE-8 `adminKeys` library, FE-6 cross-walk). This file inherits all of them. The only additional precondition for this file:

- **`fe-specs/FE-9-admin-ops.md` §C.4** — the `SweepButton` state-machine primitive at `frontend/src/components/admin/sweep-button.tsx`. Used by §B.2 (calibration run) and §B.3 (four of five system-op cards). Spec body cites the primitive but does not redefine.

**Anchor citations for this file's surfaces** (full bodies quoted from `DECISIONS.md` for the build session's §0 review):

- **AC-D18** (`DECISIONS.md` AC-D18) — "v1 ships with three operational controls on AI cost: 1. Cost dashboard … 2. Budget alerts — admin configures a monthly budget; email alerts trigger at 50%, 80%, 100% thresholds; operations continue regardless of threshold crossings (no hard enforcement). 3. Per-Testee rate limits on self-initiated generations …" Cost dashboard renders per-provider + per-model spend; the 3 budget-alert thresholds surface as `Pill` badges per AC-D18.
- **AC-D20 / AC-D27** (`DECISIONS.md` AC-D20 + AC-D27) — Bayesian shrinkage `effective_difficulty = (assigned_difficulty * k + sum(observed_difficulty_i)) / (k + n)` with `k = anchor_calibration_prior_weight` (default 20). Below n-threshold, the estimate is flagged `preliminary`. Calibration page renders the run trigger + flagged-anchor queue (the `anchors/flagged` endpoint is the *bootstrap-quality* flag queue — AC-D23-style, not the AC-D27 *effective-difficulty drift* queue — see scope boundary below).
- **AC-D21** (`DECISIONS.md` AC-D21) — Safety pills carry curated external link sets from the bootstrap cron; **monthly safety-link verification cron** re-validates cached URLs. System page exposes the manual-trigger button for that cron via `POST /v1/admin/safety-links/check`.
- **AC-D22** (`DECISIONS.md` AC-D22) — Realism feedback fires per-question; **nightly realism aggregation cron** (`SPEC.md` §8.9) computes the low-realism question pool. System page exposes the manual trigger via `POST /v1/admin/realism/aggregate` and the read endpoint `GET /v1/admin/realism/status` (the latter is §H (a) item 8 blocker).
- **AC-D23** (`DECISIONS.md` AC-D23) — Idempotent bootstrap orchestrator runs four steps (anchor pool top-up; self-review integrated; safety-link curation; Drive RAG ingest). System page exposes the manual trigger via `POST /v1/admin/bootstrap/run`. Drive ingest separately at `POST /v1/admin/drive/ingest` per AC-D22.

**`SPEC.md` §8.9 cron list** — the 7 autonomous crons. FE-9 system page exposes run-on-demand buttons for the four operationally observable crons (the others run silently as part of competence/engagement recompute):

1. Daily Drive RAG ingest → `POST /v1/admin/drive/ingest` (system-page card 2)
2. Monthly safety-pill link verification → `POST /v1/admin/safety-links/check` (system-page card 5)
3. Nightly Testee feedback aggregation → `POST /v1/admin/realism/aggregate` (system-page card 4)
4. Continuous anchor calibration recompute → `POST /v1/admin/calibration/run` (calibration page §B.2)
5. Continuous competence_estimate recomputation — silent
6. Continuous engagement reminder dispatch → `POST /v1/admin/engagement/sweep` (sibling file §B.4)
7. Continuous grade-review reconcile → `POST /v1/admin/grade-reviews/reconcile` (silent in FE-9 systems — surfaced via sibling file's grade-review queue invalidation, not a system-page button per design which doesn't include it)

Plus AC-D23 bootstrap → `POST /v1/admin/bootstrap/run` (system-page card 1; not a cron but operationally observable).

**Done-when (sibling-file slice of `FE_ROADMAP.md:189–190`):** Admin can: click cost → see month-to-date + alerts → click calibration → run sweep → resolve a flagged anchor with verdict → click system → run any cron-equivalent (drive ingest / safety-links check / realism aggregate / bootstrap).

**Scope boundary — what this file explicitly does NOT ship:**

- **Ops landing, grade-review queue, loop queue, engagement.** Owned by `fe-specs/FE-9-admin-ops.md`.
- **Cost-dashboard 28-day daily-bars chart.** Design (`admin.jsx:148–163` / `admin.jsx:579–600`) renders 28-day daily-bar sparkline. Backend `cost/summary` returns month-to-date aggregate only — no `daily_history` field. **Descoped to v1.x per user lock-in at plan time.** v1 ships a placeholder grey-band card sized to match the design footprint; the locked v1.x contract is documented in §B.1 §7 (under "v1.x deferral"). **NOT a §H (a) blocker** — descoped, not blocked.
- **Cost-dashboard per-operation breakdown (7 ops).** Same user lock-in — descoped to v1.x. The locked contract addition: `by_operation: [{op: string, provider: 'Anthropic'|'OpenAI', calls: int, tokens: int, cost_usd: float, share: float}]`. v1 ships the existing `by_provider` + `by_model` views instead.
- **AC-D27 effective-difficulty drift surface.** Backend exposes `GET /v1/admin/anchors/flagged` (`app/routers/admin.py:263–275`) — this is the **AC-D23 bootstrap-quality flag queue** (anchors that failed 3 generate+review cycles), NOT a calibration-drift queue. Design's "drift chart" / "calibration drift" wording (`admin-ops.jsx:586` headers) is descriptive of the page's purpose but the surface backed in v1 is the bootstrap-quality queue. **AC-D27 calibration-drift queue deferred to v1.x** — would require a separate backend endpoint exposing pills where `n ≥ threshold` AND `|effective_difficulty - assigned_difficulty|` exceeds some delta. Surfaced in §E.4.
- **Cost dashboard time-range selector (7d / month / YTD segments).** Design shows the segments (`admin.jsx:577`) but only "this month" has backend wiring (`cost/summary` returns rolling-month). v1 ships the segments as visible but disabled (with hover hint "Coming in v1.x"); the active selection is "this month" only. Surfaced in §E.5.

**Additions to `(admin)/layout.tsx`:** none beyond what FE-2 mounts.

---

## A. Page/feature inventory

| # | Capability | Route / file | Design source | Screenshot |
|---|---|---|---|---|
| 1 | Cost dashboard — month-to-date `Stat` strip + budget % + alerts-fired Pills (50/80/100) + provider breakdown bars + model breakdown table; 28-day daily bars + by-operation breakdown PLACEHOLDER-CARDED (descoped to v1.x); 7d/month/YTD segments visible but disabled | `(admin)/cost/page.tsx` + `_components/cost-summary-strip.tsx` + `_components/provider-bars.tsx` + `_components/model-breakdown-table.tsx` + `_components/daily-bars-placeholder.tsx` | `admin.jsx:566–663` (`AdminCost`) + `admin.jsx:148–163` (`DailyBars` — placeholder-carded) | **absent** — §E.1 design-reference gap |
| 2 | Anchor calibration — run trigger (`SweepButton`) + summary stat strip (anchors analysed / flagged / % in-band / since last run) + per-pill drift chart with flag counts + flagged-anchors table + resolve modal with 3 verdict tiles (`keep` / `substitute_wording` / `reject`) | `(admin)/calibration/page.tsx` + `_components/calibration-summary-strip.tsx` + `_components/drift-chart.tsx` + `_components/flagged-anchors-table.tsx` + `_components/resolve-anchor-modal.tsx` | `admin-ops.jsx:578–785` (`CalibrationMock` with `CalibrationButton:715–729`, `ResolveAnchorModal:731–785`, `VerdictChoice:787–799`) | `v6-fe9-26-calibration.png` |
| 3 | System page — 5 cards (bootstrap / drive-ingest / drive-index status / realism aggregate / safety-link check); each card has eyebrow + stats + optional Recent Runs sub-list + manual trigger (`SweepButton`); toast on success/failure | `(admin)/system/page.tsx` + `_components/system-op-card.tsx` (5 instances composed in the page) | `admin-ops.jsx:417–530` (`SystemPageMock` with `SystemOpCard:474–530`) | `v6-fe9-25-system-page.png` |

Three capabilities. Each its own §B entry. Nav-rail anchors: `shell.jsx:15` declares `cost` for the cost dashboard. **§H (b) item 9** (continued numbering from sibling) — `calibration` and `system` nav-rail ids likely need adding (verify `shell.jsx:15` — the v6 shell may only declare 7 ids: `ops`, `review`, `engagement`, `catalogue-admin`, `users`, `cost`, `loop`); FE-9 either (a) extends the nav-rail in this build PR as an AC-CD-structural addition, or (b) accesses calibration / system via cross-page links from `/admin/system` aggregate teaser on the ops landing.

URL state declared per surface:
- §B.1 — `?range={7d|month|ytd}` rendered but disabled in v1; effective state always `month`.
- §B.2 — `?pill={pill_id}` (optional — when admin drills into a specific pill in the drift chart).
- §B.3 — none in v1.

---

## B. Per-page detail specs

> **Template** (used identically; from `fe-specs/FE-1-auth.md:50–60`).

### B.1 Cost dashboard — `/admin/cost`

**1. Route segment + URL state**

- File: `frontend/src/app/(admin)/cost/page.tsx`. Segment + `error.tsx` boundary file are FE-9-introduced.
- URL state: `?range={7d|month|ytd}` (default `month`; in v1 the segments render but only `month` is selectable — see §B.1 §5 `range_disabled` state).
- Static `<title>AI cost · Acumen</title>`.
- Nav-rail anchor: `shell.jsx:15` declares the admin nav id as `cost` with label "AI Cost".

**2. Components**

- **Scaffold reused:** `client` + `unwrap` (FE-0); `useQuery` (TanStack); `PageHeader` + `Stat` + `Pill` + `BandTag` (FE-2 — `BandTag` not actually used here but in §B.2); `useRouter` + `useSearchParams` (Next 15).
- **New in this PR:**
  - `CostDashboardPage` — top-level page. Layout: `PageHeader` (eyebrow "AC-D18 · cost visibility · alerts at 50/80/100% · no hard enforcement in v1" + serif-italic title "AI spend.") + range selector (`?range=` segments — v1 disabled) + 2-column main: `CostSummaryStrip` (top, full width) + 2-column body (`ProviderBars` left, `ModelBreakdownTable` right) + `DailyBarsPlaceholder` (full-width card with "Coming in v1.x" copy).
  - `CostSummaryStrip` — 4-stat row per `admin.jsx:583–599`: Total spent (e.g. "$14.32"), Monthly budget (e.g. "$20.00"), Budget % (e.g. "71%"), Alerts fired (count or "—"). Each renders as `Stat` primitive.
  - `BudgetAlertPills` — Pill row showing fired thresholds per `admin.jsx:602–620`. Renders one `Pill` per fired threshold ("50% threshold passed" / "80%" / "100%") sourced from `cost/summary.alerts_fired_this_month`. Hidden if none fired.
  - `ProviderBars` — 2-bar horizontal stacked bar chart per `admin.jsx:622–638`: Anthropic vs OpenAI proportional widths derived from `cost/summary.by_provider`. Each bar labeled with provider name + dollar amount + percentage.
  - `ModelBreakdownTable` — table per `admin.jsx:640–663`: columns are Model ID, Provider, Spend (USD). Rows derived from `cost/summary.by_model` (a `dict[str, float]` of `{model_id: usd}`); enriched at render time by mapping the model_id prefix to a provider name (`claude-*` → Anthropic, `gpt-*` / `text-embedding-*` → OpenAI).
  - `DailyBarsPlaceholder` — placeholder card per §E.1 deferral. Grey-band sized to design's 28-bar footprint + small copy "Daily history coming in v1.x · backend extension required (`daily_history: number[]` field on `cost/summary`)".
  - `RangeSelector` — 3-segment button group ("7d" / "this month" / "YTD"). v1 renders all 3 but only "this month" is enabled; the other two have `disabled` attribute + tooltip "Coming in v1.x".
- **shadcn primitives installed:** none beyond FE-2 + FE-8 + FE-9-ops.
- **Design primitives reused:** `Pill` (budget alert badges + "no budget set" badge if applicable), `Stat`, `PageHeader`, `.card`, `.eyebrow`, `.h-display`, `.mono`, `.muted`, `.right`, `.num` per FE-2.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/admin/cost/summary` | Cost summary — `{total_usd, by_provider, by_model, monthly_budget, percent_of_budget, alerts_fired_this_month, since, year_month}` per `app/routers/cost.py:34–99`. No named response schema (inline `dict[str, Any]`); spec body locks the field shape via a TypeScript type alias `CostSummaryResponse` (manually maintained until backend adds a named schema — surfaced as §H (b) item 10). | **Exists** at `app/routers/cost.py:34–99`. |

**Locked field-shape contract** (spec body — local TS type until backend adds Pydantic response model):

```ts
type CostSummaryResponse = {
  since: string;                                   // ISO timestamp
  year_month: string;                              // e.g. "2026-05"
  total_usd: number;
  by_provider: Record<"anthropic" | "openai" | "stub" | "(unknown)", number>;
  by_model: Record<string, number>;                // model_id → USD
  monthly_budget: number | null;
  percent_of_budget: number | null;
  alerts_fired_this_month: number[];               // subset of [50, 80, 100]
};
```

**4. Form fields + zod + rhf**

n/a — read-only dashboard. No forms, no mutations.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `loading` | Initial query in-flight | `CostSummaryStrip` renders 4 stat skeletons; bars + table render skeletons; placeholder card renders unchanged. |
| `no_budget` | `monthly_budget === null` | Budget Stat shows "Not set"; Budget% Stat shows "—"; `BudgetAlertPills` hidden; copy nudges admin: "Set a budget in system settings to enable alerts." |
| `budget_under_threshold` | `monthly_budget !== null && alerts_fired_this_month === []` | Budget% Stat shows the % value; no alert pills rendered. |
| `budget_alerts_fired` | `alerts_fired_this_month.length > 0` | One `Pill` renders per fired threshold (50% warn-tone / 80% warn-tone / 100% danger-tone); Budget% Stat highlighted in matching tone. |
| `range_disabled` | Default (v1) | `RangeSelector` shows 3 segments; "this month" is active; "7d" + "YTD" are `disabled` with tooltip "Coming in v1.x". |
| `daily_bars_placeholder` | Always (v1) | `DailyBarsPlaceholder` renders grey-band card with deferral copy. |
| `error` | Query throws | Pattern C boundary via `(admin)/cost/error.tsx`. |
| `role_mismatch` | Testee role hits `/admin/cost` | AC-CD20 guard → `/403`. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Admin lands on /admin/cost with budget set
  Given an admin opens /admin/cost
  And GET /v1/admin/cost/summary returns
    {total_usd: 14.32, monthly_budget: 20.00, percent_of_budget: 71.6, by_provider: {anthropic: 12.10, openai: 2.22}, by_model: {"claude-sonnet-4-5": 12.10, "gpt-4o-mini": 1.50, "text-embedding-3-small": 0.72}, alerts_fired_this_month: [50]}
  When the page mounts
  Then the Total stat shows "$14.32"
  And the Budget stat shows "$20.00"
  And the Budget% stat shows "71%" (rounded)
  And one Pill renders "50% threshold passed"
  And the ProviderBars show Anthropic at 84% width + OpenAI at 16% width
  And the ModelBreakdownTable renders 3 rows
```

```gherkin
Scenario: No budget configured
  Given GET /.../summary returns monthly_budget: null
  When the page mounts
  Then the Budget stat shows "Not set"
  And the Budget% stat shows "—"
  And BudgetAlertPills are hidden
  And a copy "Set a budget in system settings to enable alerts." renders
```

```gherkin
Scenario: All three alert thresholds fired
  Given GET /.../summary returns alerts_fired_this_month: [50, 80, 100]
  When the page mounts
  Then three Pills render in sequence: "50%" / "80%" / "100%"
  And the 100% pill uses danger tone
  And the 50% + 80% pills use warn tone
```

```gherkin
Scenario: Range selector — 7d and YTD disabled in v1
  Given the page is mounted
  When the admin tries to click the "7d" segment
  Then the segment does not activate (disabled)
  And a tooltip "Coming in v1.x" appears on hover
```

```gherkin
Scenario: Daily bars placeholder
  Given the page is mounted
  When the DailyBarsPlaceholder renders
  Then a grey-band card shows where the 28-day chart would go
  And the copy "Daily history coming in v1.x" renders inside
```

```gherkin
Scenario: Query fails — Pattern C boundary
  Given an admin opens the cost dashboard
  When GET /.../summary throws 500
  Then (admin)/cost/error.tsx renders with "Couldn't load AI cost dashboard."
  And "Try again" resets the boundary and refetches
```

(Six scenarios mapped to §D.2 cost-dashboard integration tests.)

**7. Edge cases / gotchas**

- **`by_model` keys are raw model IDs.** Provider mapping is client-side: `claude-*` → Anthropic, `gpt-*` + `text-embedding-*` → OpenAI, anything else → "Other". Hardcoded prefix-mapping in `_components/model-breakdown-table.tsx`; surface as a small lookup table in code with a `// TODO(AC-CD18): model-ID list lives in env defaults; mapping may need updating when defaults change`.
- **Percentage rounding.** Design shows whole-number percentages ("71%"). Frontend rounds `percent_of_budget` to the nearest integer for display, full float for the underlying stat.
- **`alerts_fired_this_month` may have duplicates if backend doesn't dedupe** — frontend defensively dedupes via `[...new Set(alerts_fired_this_month)]` before rendering.
- **`since` field** can be displayed as a small "Since {date}" suffix on the page header but design doesn't require it; v1 omits.
- **v1.x deferral contract** locked here for future PR:
  ```ts
  // v1.x additions to CostSummaryResponse:
  daily_history: number[];                         // length 28, USD per day, oldest-first
  by_operation: Array<{
    op: string;                                    // e.g. "grading", "review", "embedding"
    provider: "Anthropic" | "OpenAI";
    calls: number;
    tokens: number;
    cost_usd: number;
    share: number;                                 // 0..1 — proportion of total_usd
  }>;
  ```
  When backend ships these fields the build session removes the `DailyBarsPlaceholder` card + `RangeSelector`'s disabled state + adds a `ByOperationTable` component.
- **No real-time updates** — admin reloads to see new spend after a grading run.

**8. Visual reference**

- `frontend/design-reference/prototype/admin.jsx:566–663` — `AdminCost` (full dashboard layout).
- `frontend/design-reference/prototype/admin.jsx:148–163` — `DailyBars` (placeholder-carded in v1).
- Screenshot: **absent** — design-reference completeness gap (§E.1).

---

### B.2 Anchor calibration — `/admin/calibration`

**1. Route segment + URL state**

- File: `frontend/src/app/(admin)/calibration/page.tsx`. Segment + `error.tsx` boundary file are FE-9-introduced.
- URL state: `?pill={pill_id}` (optional — when admin drills into a specific pill's flagged anchors). State change via `router.replace()`.
- Static `<title>Anchor calibration · Acumen</title>`.
- Nav-rail anchor: **§H (b) item 9** — `shell.jsx:15` likely doesn't declare a `calibration` id; build session either extends the nav rail or accesses via the system-page's "Open calibration →" CTA.

**2. Components**

- **Scaffold reused:** `client` + `unwrap` + `ApiError`; `useQuery` + `useMutation` + `useQueryClient`; `useForm` + `zodResolver`; `applyApiErrorToForm` (FE-1); `PageHeader` + `Stat` + `Pill` (FE-2); `SweepButton` from `fe-specs/FE-9-admin-ops.md` §C.4.
- **New in this PR:**
  - `CalibrationPage` — top-level page. Layout: `PageHeader` (eyebrow "AC-D27 · /admin/calibration · psychometric integrity" + serif-italic title "Anchor calibration.") + run section (with `SweepButton`) + 4-stat summary strip + per-pill drift chart card + flagged-anchors table + (conditional) `ResolveAnchorModal`.
  - `CalibrationSummaryStrip` — 4-stat row per `admin-ops.jsx:599–630`: Anchors analysed, Flagged, % in-band, Since last run. **Source:** the `CalibrationSweepResult` (returned by `POST /v1/admin/calibration/run`) is cached on the last-run side; the stat strip pulls from the cached value. **§H (b) item 11** — verify whether the backend exposes a "current summary" GET endpoint or whether the page must wait for a run to populate stats. Spec body assumes the latter for v1 (empty stat strip with "Run calibration to refresh stats" copy until first run).
  - `DriftChart` — per-pill flagged-anchor counts visualisation per `admin-ops.jsx:634–680`. **v1 ships a SIMPLE table** instead of a chart: columns are Pill name + Flagged count, sorted descending. Each pill name is a link that filters the flagged-anchors table below via `?pill={id}`. **The full chart (per-pill bar plot, mouseover tooltips) is deferred to v1.x** — spec note in §E.2. Source: aggregates `FlaggedAnchorItem[]` from `GET /v1/admin/anchors/flagged` client-side, grouping by `pill_id` + `pill_name` (post §H (a) item 1 enrichment). v1 doesn't need a separate backend endpoint — the in-memory aggregation suffices for v1's expected ~14 flagged anchors / few pills scale.
  - `FlaggedAnchorsTable` — table per `admin-ops.jsx:682–712`. Columns: Pill name, Band, Anchor ID (mono UUID short), Type, Reason / Excluded reason, "Resolve" row action. Filters by `?pill=` URL param when set. Sorted oldest-first (matches `anchors/flagged` endpoint contract).
  - `ResolveAnchorModal` — modal per `admin-ops.jsx:731–785`. Header "Resolve flagged anchor" + anchor context (pill + band + brief reason). Body: 3 `VerdictTile` (from `fe-specs/FE-9-admin-ops.md` §B.2 §2) — "Accept · keep" / "Reject · remove from pool" / "Override · substitute wording". When "Override" tile is selected, an additional JSON config editor appears (controlled textarea with JSON validation via zod) per `app/schemas.py:655–666` `AnchorResolveRequest.new_config`. Footer: Cancel + "Apply resolution".
  - Reuses `Modal` + `ModalActions` primitive from FE-8 §C.5.
  - Reuses `SweepButton` primitive from `fe-specs/FE-9-admin-ops.md` §C.4 for the "Run calibration" trigger.
- **shadcn primitives installed:** none beyond prior FE-N installs.
- **Design primitives reused:** `Pill` (severity badges on flagged-anchor rows: "high" / "medium" per `admin-ops.jsx:557–569`), `Stat`, `BandTag` (band column in the table), `PageHeader`, `.tbl`, `.card`, `.btn`, `.eyebrow`, `.h-display`, `.mono` per FE-2 / AC-CD23.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/admin/anchors/flagged` | List flagged anchors awaiting resolution. Consumed by `FlaggedAnchorsTable` + aggregated client-side into `DriftChart`. Note: this is the **AC-D23 bootstrap-quality flag queue** per `app/routers/admin.py:263–275`, NOT a separate AC-D27 calibration-drift queue (deferred to v1.x — see §E.4). | **Exists**. Returns `FlaggedAnchorListResponse` per `app/schemas.py:651–652`. **Sparse row payload — §H (a) item 1 from sibling file adds `pill_name`.** |
| `POST /v1/admin/calibration/run` | Run one pass of the §8.9 anchor calibration sweep synchronously. Returns `CalibrationSweepResult` `{anchors_processed, anchors_updated, anchors_skipped_no_observations, mean_n, mean_effective_difficulty}` per `app/schemas.py:607–616`. | **Exists** at `app/routers/admin.py:248–260`. |
| `POST /v1/admin/anchors/{anchor_id}/resolve` | Resolve one flagged anchor. Body per `AnchorResolveRequest` at `app/schemas.py:655–666`: `{action: 'keep' \| 'substitute_wording' \| 'reject', new_config?: dict[str, Any]}`. The `substitute_wording` action requires `new_config` (Pydantic enforces — spec body mirrors with zod refinement). Returns `AnchorResolveResult`. | **Exists** at `app/routers/admin.py:278–299`. |

**4. Form fields + zod + rhf**

Resolve modal form:

```ts
const resolveSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("keep"),
  }),
  z.object({
    action: z.literal("reject"),
  }),
  z.object({
    action: z.literal("substitute_wording"),
    new_config_json: z
      .string()
      .min(2, "Provide a JSON object for the replacement config.")
      .refine((s) => {
        try {
          const parsed = JSON.parse(s);
          return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
        } catch {
          return false;
        }
      }, "Must be a valid JSON object."),
  }),
]);
type ResolveInput = z.infer<typeof resolveSchema>;

const form = useForm<ResolveInput>({
  resolver: zodResolver(resolveSchema),
  mode: "onSubmit",
});

const resolveMutation = useMutation({
  mutationFn: (input: { anchorId: string; data: ResolveInput }) =>
    unwrap(client.POST("/v1/admin/anchors/{anchor_id}/resolve", {
      params: { path: { anchor_id: input.anchorId } },
      body: input.data.action === "substitute_wording"
        ? { action: "substitute_wording", new_config: JSON.parse(input.data.new_config_json) }
        : { action: input.data.action },
    })),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: adminKeys.calibration.flaggedAnchors() });
    queryClient.invalidateQueries({ queryKey: adminKeys.ops.overview() });
    toast.info("Anchor resolution applied");
  },
  onError: (err) => applyApiErrorToForm(err, form),
});
```

Run mutation (no form):

```ts
const runMutation = useMutation({
  mutationFn: () => unwrap(client.POST("/v1/admin/calibration/run")),
  onSuccess: (result) => {
    queryClient.invalidateQueries({ queryKey: adminKeys.calibration.flaggedAnchors() });
    // Stash the result in TanStack cache for the summary strip:
    queryClient.setQueryData(adminKeys.calibration.lastRun(), result);
    toast.info(
      `Calibration ran · ${result.anchors_processed} anchors processed · ${result.anchors_updated} updated`
    );
  },
  onError: (err) => toast.error(err.message || "Couldn't run calibration"),
});
```

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `loading_initial` | `useQuery(adminKeys.calibration.flaggedAnchors())` in-flight | Summary strip renders 4 stat skeletons; chart + table skeletons. |
| `no_run_yet` | Page mounts; `adminKeys.calibration.lastRun()` cache is empty | Summary stats show "—"; copy "Run calibration to populate stats." |
| `loaded_with_flags` | Query resolves with `data.length > 0` | Summary stats populate from `lastRun` cache (if any); chart + table render. |
| `loaded_no_flags` | Query resolves with `data: []` | Chart and table render empty state "No flagged anchors — calibration is clean."; summary still shows the last-run stats if available. |
| `run_idle` | Default | `SweepButton` shows "Run calibration" |
| `run_running` | Admin clicks Run calibration | Sweep-button transitions to running per the primitive. Calibration sweep may take longer than other sweeps; design shows the same state. |
| `run_done` | 2xx | Button flashes Done; queries invalidate; toast confirms with anchor counts; table refetches. |
| `run_error` | 4xx / 5xx | Button reverts; Pattern B error toast. |
| `modal_open` | Admin clicks Resolve on a row | `ResolveAnchorModal` mounts; form pristine; default action `null` (no tile selected). |
| `modal_action_picked` | Admin clicks one of 3 verdict tiles | Tile gets highlight; substitute-wording tile reveals JSON config textarea. |
| `modal_substitute_validation` | Admin picks substitute_wording but provides invalid JSON | zod refinement surfaces "Must be a valid JSON object." |
| `modal_submitting` | Admin clicks Apply | Submit pulse-dot + "Applying…". |
| `modal_success` | 2xx | Modal closes; toast confirms; queries invalidate; row disappears from table. |
| `modal_business_error` | 4xx with code (e.g. `ANCHOR_ALREADY_RESOLVED`) | Pattern B toast; modal stays open; admin can cancel. |
| `pill_filter_applied` | Admin clicks a pill name in `DriftChart` | URL replaces to `?pill={pill_id}`; table filters client-side. |
| `pill_filter_cleared` | Admin clicks "Show all pills" | URL replaces back to `/admin/calibration`; table shows all rows. |
| `error_boundary` | Table query throws | Pattern C boundary via `(admin)/calibration/error.tsx`. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Admin lands on /admin/calibration before any run
  Given an admin opens /admin/calibration
  And GET /v1/admin/anchors/flagged returns 5 rows
  And no calibration run has been performed in this session (lastRun cache empty)
  When the page mounts
  Then the summary stats render "—"
  And the copy "Run calibration to populate stats." renders next to the SweepButton
  And the FlaggedAnchorsTable renders 5 rows
  And the DriftChart shows pills grouped with flagged counts
```

```gherkin
Scenario: Admin runs calibration
  Given the page is mounted
  When the admin clicks "Run calibration"
  Then SweepButton transitions to running
  And POST /v1/admin/calibration/run fires
  And on 201 with {anchors_processed: 2740, anchors_updated: 142, anchors_skipped_no_observations: 18, mean_n: 12.4, mean_effective_difficulty: 5.6}
  Then toast.info("Calibration ran · 2740 anchors processed · 142 updated") renders
  And the summary stats refresh from the lastRun cache
  And the flagged-anchors table refetches
```

```gherkin
Scenario: Admin resolves an anchor with "Accept" verdict
  Given a flagged anchor row is visible
  When the admin clicks Resolve
  Then ResolveAnchorModal mounts
  When the admin clicks the "Accept" tile and Apply
  Then POST /v1/admin/anchors/{id}/resolve fires with {action: "keep"}
  And on 201 the modal closes
  And toast.info("Anchor resolution applied") renders
  And the row disappears from the table
```

```gherkin
Scenario: Admin resolves with "Override" substitute_wording — valid JSON
  Given the modal is open
  When the admin clicks the "Override" tile
  And types {"prompt": "...", "answer": "..."} in the JSON editor
  And clicks Apply
  Then POST /.../resolve fires with {action: "substitute_wording", new_config: {prompt, answer}}
  And on 201 the modal closes
```

```gherkin
Scenario: Override with invalid JSON blocked
  Given the modal is open and the Override tile is selected
  When the admin types "not json" in the editor
  And clicks Apply
  Then zod surfaces "Must be a valid JSON object."
  And no network call is fired
```

```gherkin
Scenario: Drill into a specific pill from the drift chart
  Given the drift chart shows 8 pills with flagged anchors
  When the admin clicks pill "Cathodic Protection"
  Then the URL replaces to /admin/calibration?pill={pill_id}
  And the FlaggedAnchorsTable filters to that pill's rows only
```

```gherkin
Scenario: Empty queue
  Given GET /v1/admin/anchors/flagged returns {data: []}
  When the page mounts
  Then the FlaggedAnchorsTable shows "No flagged anchors — calibration is clean."
  And the DriftChart shows the same celebratory empty state
```

```gherkin
Scenario: Resolve race — another admin resolves first
  Given a flagged anchor row
  When POST /.../resolve returns 409 ANCHOR_ALREADY_RESOLVED
  Then a Pattern B toast surfaces "Anchor was already resolved — refreshing list"
  And the modal closes
  And the table refetches
```

(Eight scenarios mapped to §D.2 calibration integration tests.)

**7. Edge cases / gotchas**

- **AC-D23 vs AC-D27 queue confusion.** The endpoint `anchors/flagged` is the bootstrap-quality flag queue (failed generate+review cycles); the design language ("drift chart", "calibration drift") evokes AC-D27 effective-difficulty drift. Spec body locks AC-D23 as the v1 surface and defers AC-D27 to v1.x (§E.4). Naming kept as `anchors/flagged` (not renamed to `calibration/flagged`) — §H (c) item 14.
- **Calibration run can take 10+ seconds at v1 scale** (thousands of anchors). `SweepButton`'s `running` state is the only UX; no progress bar. If a v1.x usability gap emerges, add a streaming endpoint with progress events.
- **`new_config` JSON editor.** v1 ships a plain controlled `<textarea>` with monospace styling + zod validation. shadcn doesn't ship a JSON editor primitive; v1.x may swap in a CodeMirror / Monaco editor if admin authoring volume justifies it.
- **`lastRun` is session-local.** The summary stats reset to "—" if the admin reloads the page without running calibration. v1 acceptable; v1.x may persist via a separate GET endpoint or a TanStack persistent cache (`@tanstack/query-sync-storage-persister`).
- **Drift chart in v1 is a TABLE not a chart.** Stretches the design's "chart" word; spec body justifies the simplification at v1 scale (~14 anchors, ~8 pills). v1.x adds a real chart.

**8. Visual reference**

- `frontend/design-reference/prototype/admin-ops.jsx:578–785` — `CalibrationMock` (full layout).
- `frontend/design-reference/prototype/admin-ops.jsx:731–785` — `ResolveAnchorModal`.
- `frontend/design-reference/prototype/admin-ops.jsx:787–799` — `VerdictChoice` (3-tile group).
- `frontend/design-reference/prototype/admin-ops.jsx:715–729` — `CalibrationButton` (sweep-button variant).
- Screenshot: `frontend/design-reference/screenshots/v6-fe9-26-calibration.png`.

---

### B.3 System page — `/admin/system`

**1. Route segment + URL state**

- File: `frontend/src/app/(admin)/system/page.tsx`. Segment + `error.tsx` boundary file are FE-9-introduced.
- URL state: none.
- Static `<title>System operations · Acumen</title>`.
- Nav-rail anchor: **§H (b) item 9** — `system` id likely not in `shell.jsx:15`; same resolution as calibration.

**2. Components**

- **Scaffold reused:** `useQuery` + `useMutation` per card; `useQueryClient`; `PageHeader` + `Stat` + `Pill`; `SweepButton` from `fe-specs/FE-9-admin-ops.md` §C.4.
- **New in this PR:**
  - `SystemPage` — top-level page. Layout: `PageHeader` (eyebrow "/admin/system · consolidated operational controls" + serif-italic title "System operations.") + 5 `SystemOpCard` instances in a 2-column grid (3 left, 2 right on desktop; single column on mobile per FE-2 responsive defaults).
  - `SystemOpCard` — generic card per `admin-ops.jsx:474–530`. Shape:
    ```ts
    type SystemOpCardProps = {
      id: string;
      eyebrow: string;             // e.g. "AC-D14 · daily at 02:00 UTC"
      title: string;               // e.g. "Drive RAG ingest"
      desc: string;                // 1-2 sentence description
      stats: Array<[string, string]>;  // 4 stat pairs ([label, value])
      recent?: Array<{ when: string; new?: number; upd?: number; ok?: boolean }>;  // optional recent-runs sub-list
      cta?: { label: string; onRun: () => Promise<void> } | null;  // null = read-only (e.g. drive-index status)
    };
    ```
  - 5 instances composed in the page (per the design's 5 cards):
    1. **Bootstrap card**: eyebrow "AC-D2 · runs once per tenant"; title "Bootstrap"; desc "AC-D23 idempotent orchestrator — top up anchors, self-review, safety links, Drive ingest in one pass"; stats `[["Last run", ...], ["Pills", ...], ["Anchors", ...], ["Drive index", ...]]`; cta "Run bootstrap" → `POST /v1/admin/bootstrap/run`.
    2. **Drive ingest card**: eyebrow "AC-D14 · every 6h"; title "Drive ingest"; stats `[["Last ingest", ...], ["New docs", ...], ["Updated", ...], ["Removed", ...]]`; recent runs sub-list; cta "Ingest now" → `POST /v1/admin/drive/ingest`.
    3. **Drive index status card**: eyebrow "derived · 24h cache"; title "Drive index"; desc "Current state of the indexed RAG corpus"; stats `[["Indexed docs", ...], ["Freshness", ...], ["Drift", ...], ["Embeddings", ...]]`; cta `null` (read-only — no manual action).
    4. **Realism aggregate card**: eyebrow "AC-D24 · nightly"; title "Realism aggregation"; stats `[["Last run", ...], ["Flags processed", ...], ["Below threshold", ...], ["Auto-suppressed", ...]]`; cta "Aggregate now" → `POST /v1/admin/realism/aggregate`. **Stats source is the NEW `GET /v1/admin/realism/status` endpoint (§H (a) item 8 blocker).**
    5. **Safety-link check card**: eyebrow "AC-D21 · monthly"; title "Safety links"; stats `[["Last check", ...], ["Links checked", ...], ["Flagged drift", ...], ["Broken", ...]]`; cta "Run check" → `POST /v1/admin/safety-links/check`. **Stats source is `SystemSettings.last_safety_link_check_at` (§H (b) item 12 verifies the column exists) + a count from `GET /v1/pills?safety_relevant=true`.**
  - Each card's CTA uses `SweepButton` from `fe-specs/FE-9-admin-ops.md` §C.4. The `null` CTA cards don't render a button.
- **shadcn primitives installed:** none beyond prior FE-N installs.
- **Design primitives reused:** `Pill` (status badges if any — e.g. "Healthy" / "Degraded"), `Stat`, `PageHeader`, `.card`, `.eyebrow`, `.h-display`, `.muted`, `.mono` per FE-2.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/admin/drive/index` | Drive-index status (chunk count, file count, last_indexed_at). Drives the **drive index status card** + the **drive ingest card** (shares the same status read). | **Exists** at `app/routers/rag.py:199–209`. Returns `DriveIndexStatus`. |
| `POST /v1/admin/drive/ingest` | Trigger Drive RAG ingest. | **Exists** at `app/routers/rag.py:49–90`. Returns `DriveIngestResult`. |
| `POST /v1/admin/realism/aggregate` | Trigger nightly realism aggregation. | **Exists** at `app/routers/rag.py:166–196`. Returns `RealismAggregationResult`. |
| `GET /v1/admin/realism/status` | Read current realism roll-up stats for the card display. **§H (a) item 8 — NEW endpoint to be authored.** Locked contract in §H (a). | **MISSING** — must be added before FE-9 build session opens. |
| `POST /v1/admin/safety-links/check` | Trigger monthly safety-link verification. | **Exists** at `app/routers/admin.py:343–368`. Returns `SafetyLinkCheckResult`. |
| `POST /v1/admin/bootstrap/run` | Run the AC-D23 idempotent bootstrap orchestrator. | **Exists** at `app/routers/admin.py:305–337`. Returns `BootstrapRunResult`. |
| `GET /v1/pills?safety_relevant=true&limit=1` | Count of safety-tagged pills for the safety-link card's "Links checked" stat (proxied — count derived from `meta.total` if backend exposes it; otherwise from page meta). Cache-shared with FE-8's safety-tab via `adminKeys.pills.list({safety_relevant: true})`. | **Exists** (FE-8 §B.5). |
| **(no GET for bootstrap status)** | Bootstrap card "Last run" + "Anchors" stats come from the most recent `bootstrap.run` audit log entry — best-effort via existing read. v1 simplification: surface as "Run bootstrap to populate stats" if no run telemetry is cached locally. **§H (b) item 13** — verify whether `SystemSettings` exposes the most-recent bootstrap timestamp + counters; if not, v1 stat is empty until first run. | (no endpoint — same pattern as calibration's `lastRun`) |

**Locked contract for `GET /v1/admin/realism/status`** (spec body — §H (a) item 8):

```ts
type RealismStatusResponse = {
  last_aggregated_at: string | null;             // ISO timestamp
  flags_processed_last_run: number;
  below_threshold_count: number;                 // questions with realism_flag_count below threshold (low-realism)
  auto_suppressed_count: number;                 // questions auto-suppressed by the cron
  total_flag_count_active: number;               // org-wide active flag count
};
```

**4. Form fields + zod + rhf**

n/a — no forms across any of the 5 cards. Each CTA is a bare mutation.

**5. States**

Per-card state machine (driven by `SweepButton` internal states + the card's status query):

| State | Trigger | Visual |
|---|---|---|
| `card_loading_initial` | Status query in-flight on mount (cards that have one) | Stat fields render skeleton. |
| `card_no_data` | Status query resolves but indicates no run yet (e.g. `last_*_at: null`) | Stats render "—"; copy below CTA "Run to populate stats". |
| `card_loaded` | Stats populate | Each `Stat` shows its `(label, value)` from the response. |
| `card_running` | Admin clicks CTA → mutation in-flight | `SweepButton` transitions to running. |
| `card_done` | Mutation 2xx | Button transitions through done state; toast surfaces composed message ("DRIVE INGEST COMPLETE · 7 new · 3 updated · 0 removed" per `admin-ops.jsx:443–469` toast template); card's status query invalidates; stats refresh. |
| `card_error` | Mutation 4xx / 5xx | `SweepButton` reverts; Pattern B error toast surfaces with composed message ("DRIVE INGEST FAILED · trace {id} · check the integration page" per design). |
| `error_boundary` | Any card's status query throws unexpectedly | Pattern C boundary via `(admin)/system/error.tsx`. Note: per-card status query errors are handled inline (card shows "Couldn't load · retry") to keep other cards rendering. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Admin lands on /admin/system with all data ready
  Given the admin opens /admin/system
  And all card status queries resolve
  When the page mounts
  Then 5 SystemOpCards render in the 2-column grid
  And each card shows its 4 stats populated
```

```gherkin
Scenario: Admin runs Drive ingest — success
  Given the drive-ingest card is visible
  When the admin clicks "Ingest now"
  Then SweepButton transitions to running
  And POST /v1/admin/drive/ingest fires
  And on 201 with {status: "success", new: 7, updated: 3, removed: 0}
  Then toast.info("DRIVE INGEST COMPLETE · 7 new · 3 updated · 0 removed") renders
  And the drive-ingest + drive-index cards refetch their stats
```

```gherkin
Scenario: Admin runs Drive ingest — failure
  Given the drive-ingest card
  When POST /.../drive/ingest returns 409 with code "DRIVE_FOLDER_ID_NOT_SET"
  Then a Pattern B error toast renders with the backend message
  And the button reverts
```

```gherkin
Scenario: Admin runs bootstrap
  Given the bootstrap card
  When the admin clicks "Run bootstrap"
  Then POST /v1/admin/bootstrap/run fires
  And on 201 with the BootstrapRunResult telemetry
  Then toast.info("Bootstrap complete") renders with summary counts
  And the bootstrap card's stats refresh
```

```gherkin
Scenario: Admin runs realism aggregation
  Given the realism card with last_aggregated_at = 14 hours ago
  When the admin clicks "Aggregate now"
  Then POST /v1/admin/realism/aggregate fires
  And on 201 toast.info confirms with counts from RealismAggregationResult
  And GET /v1/admin/realism/status refetches and updates the card stats
```

```gherkin
Scenario: Admin runs safety-link check
  Given the safety-links card
  When the admin clicks "Run check"
  Then POST /v1/admin/safety-links/check fires
  And on 201 toast.info confirms with SafetyLinkCheckResult summary
  And the card stats refresh
```

```gherkin
Scenario: Drive index card is read-only
  Given the drive-index card is visible
  When the page mounts
  Then no CTA button renders on this card
  And the 4 stats render from GET /v1/admin/drive/index
```

```gherkin
Scenario: Card-level error isolation
  Given the page is mounted
  When GET /v1/admin/realism/status throws 500
  And the other queries resolve
  Then the realism card shows "Couldn't load · retry" inline
  And the other 4 cards render their content normally
  And the boundary does NOT mount
```

(Eight scenarios mapped to §D.2 system-page integration tests.)

**7. Edge cases / gotchas**

- **No batch "run everything" button.** v1 design has 5 individual CTAs only. AC-D23 bootstrap card is the closest to "run everything" (it does anchor + safety + Drive in one pass), but each card has its own focused trigger.
- **Toast composition templates** are per-operation; build session implements them inline in each card's mutation `onSuccess` / `onError`. Spec body locks the success-message format from `admin-ops.jsx:443–469` (eyebrow + summary line + trace line). Reusing FE-1's `toast.info` / `toast.error` with rich body content (sonner supports React node as toast body).
- **Race conditions** between admin trigger and the scheduled cron — if a cron fires while an admin is mid-run, the second invocation (whichever it is) sees no-op state at the domain layer (idempotent crons). v1 acceptable; no UX needed.
- **`(no GET for bootstrap status)`** — see §3 + §H (b) item 13. Bootstrap card may show empty stats until first run in v1; the build session may add a `useState`-based session cache mirroring the calibration `lastRun` pattern, or the user authors a small backend addition to expose the most-recent telemetry from `AuditLog`.
- **Drive index stats are shared between cards 2 + 3.** Both read `GET /v1/admin/drive/index`; cache-shared via `adminKeys.system.driveIndex()`. Card 2's "Last ingest" uses `last_indexed_at` from the same response.
- **Recent runs sub-list (drive-ingest card)** — design shows 3-row "recent runs" mini-table. Backend doesn't expose a runs-history endpoint; v1 derives from session-local mutation results only ("Your last 3 runs in this session"). Acceptable for v1; v1.x adds backend persistence + GET endpoint.

**8. Visual reference**

- `frontend/design-reference/prototype/admin-ops.jsx:417–530` — `SystemPageMock` (full layout).
- `frontend/design-reference/prototype/admin-ops.jsx:474–530` — `SystemOpCard`.
- `frontend/design-reference/prototype/admin-ops.jsx:443–469` — toast notification templates.
- `frontend/design-reference/prototype/admin-ops.jsx:343–415` — `SYSTEM_OPS` data array (the 5 cards' content seed).
- Screenshot: `frontend/design-reference/screenshots/v6-fe9-25-system-page.png`.

---

## C. Cross-page concerns

### C.1 `adminKeys` extensions — FE-9 systems key roots

**Extends `fe-specs/FE-8-admin-catalogue.md:1072–1149` + `fe-specs/FE-9-admin-ops.md` §C.1 `adminKeys` library unchanged; adds the FE-9-systems-specific roots inline in the same `frontend/src/lib/queries/admin-keys.ts`:**

```ts
// Appended after the ops keys from fe-specs/FE-9-admin-ops.md §C.1:

  cost: {
    all: () => [...adminKeys.all, 'cost'] as const,
    summary: () => [...adminKeys.cost.all(), 'summary'] as const,
  },

  calibration: {
    all: () => [...adminKeys.all, 'calibration'] as const,
    flaggedAnchors: (filters?: { pill_id?: string }) =>
      [...adminKeys.calibration.all(), 'flaggedAnchors', filters ?? {}] as const,
    lastRun: () => [...adminKeys.calibration.all(), 'lastRun'] as const,
  },

  system: {
    all: () => [...adminKeys.all, 'system'] as const,
    driveIndex: () => [...adminKeys.system.all(), 'driveIndex'] as const,
    realismStatus: () => [...adminKeys.system.all(), 'realismStatus'] as const,    // post §H (a) item 8
    safetyLinkStatus: () => [...adminKeys.system.all(), 'safetyLinkStatus'] as const, // verifies §H (b) item 12 field
  },
```

**Invalidation discipline:**
- Cost mutations (none in this file; cost is read-only) — no invalidation needed.
- Calibration `runMutation` invalidates `adminKeys.calibration.flaggedAnchors()` + `adminKeys.ops.overview()`. Stashes `CalibrationSweepResult` in `adminKeys.calibration.lastRun()` via `queryClient.setQueryData`.
- System-page mutations each invalidate their card's status key (e.g. drive-ingest invalidates `adminKeys.system.driveIndex()`) + `adminKeys.ops.overview()`. Bootstrap also invalidates a wide set: `adminKeys.system.driveIndex()` + `adminKeys.calibration.flaggedAnchors()` + `adminKeys.pills.all()` (FE-8) since it touches all of them.

### C.2 `SweepButton` consumption from sibling file

Imports from `frontend/src/components/admin/sweep-button.tsx` (canonical definition in `fe-specs/FE-9-admin-ops.md` §C.4). Used in:
- §B.2 calibration page "Run calibration" trigger.
- §B.3 system page cards 1, 2, 4, 5 (bootstrap / drive-ingest / realism / safety-links — card 3 drive-index status is read-only).

No re-definition; build session imports and uses unchanged.

### C.3 `VerdictTile` consumption from sibling file

Imports from `frontend/src/components/admin/verdict-tile.tsx` (canonical definition in `fe-specs/FE-9-admin-ops.md` §B.2 §2). Used in:
- §B.2 calibration resolve modal — 3 tile variant (Accept / Reject / Override).

Design and shape inherited unchanged from sibling.

### C.4 Modal + ModalActions primitives

Inherited unchanged from FE-8 §C.5 via sibling §C.3. Used by §B.2 resolve modal.

### C.5 Pattern C boundary

Each FE-9 systems page adds an `error.tsx`: `(admin)/cost/error.tsx`, `(admin)/calibration/error.tsx`, `(admin)/system/error.tsx`. FE-1 Pattern C unchanged.

### C.6 Toasts (Pattern B reuse)

Sonner from FE-1 §C.3, unchanged. FE-9-systems calls:
- `toast.info(...)` — success (calibration ran, anchor resolved, drive ingested, realism aggregated, safety-links checked, bootstrap completed) — 3s.
- `toast.error(...)` — failures — 7s. Failure toasts use the `admin-ops.jsx:443–469` structured template (eyebrow + summary + trace line).

---

## D. Test cases (Vitest)

Vitest config from FE-0 + MSW from FE-1 §D + sibling file's test scaffolding.

### D.1 Unit tests (lib + helpers)

- `frontend/src/lib/queries/admin-keys.test.ts` — extend with snapshot tests for new FE-9-systems key roots (`cost`, `calibration`, `system`).
- `frontend/src/components/admin/system-op-card.test.tsx` — generic card rendering (eyebrow + title + stats + optional recent + cta states); CTA-null path renders no button.

### D.2 Page integration tests

- `frontend/src/app/(admin)/cost/page.test.tsx` — §B.1 trios (6 scenarios).
- `frontend/src/app/(admin)/calibration/page.test.tsx` — §B.2 trios (8 scenarios).
- `frontend/src/app/(admin)/system/page.test.tsx` — §B.3 trios (8 scenarios).

Total: 22 systems-side integration scenarios.

### D.3 Round-trip integration test

`frontend/tests/integration/admin-systems-roundtrip.test.tsx`:
- Done-when in narrative form (systems slice): admin lands at `/admin/cost` → sees this-month spend + a 50% alert pill → navigates to `/admin/calibration` → runs calibration → stats refresh + a flagged-anchor table populates → admin clicks Resolve on a row → picks "Accept" → modal closes + row disappears → admin navigates to `/admin/system` → clicks "Ingest now" on the Drive ingest card → success toast + drive-index card stats refresh.

Single test, exercises every page in this file.

### D.4 Coverage gate (FE_CHECKLIST.md FE-9 systems-side rows tick on)

- All §B Gherkin + D.3 round-trip green via `pnpm test --run`.
- `pnpm typecheck` clean.
- `pnpm lint` clean.
- `pnpm build` succeeds.

---

## E. Known placeholders (DO NOT SHIP AS-IS)

| # | Placeholder | Location | Action before production |
|---|---|---|---|
| 1 | **No screenshot for cost dashboard.** Mock body exists at `admin.jsx:566–663`; v6-fe9-* PNG omitted. | Implicit on §B.1 "Visual reference" entry. | **Design-reference completeness gap surfaced** per SESSION_START.md rule. Build session inherits the JSX mock as authoritative; design-Claude session adds the screenshot post-FE-9. Tag with `// TODO(design-ref): screenshot pending`. |
| 2 | Drift chart is a TABLE not a chart in v1 | `(admin)/calibration/_components/drift-chart.tsx` | v1 simplification justified by low-flag-count v1 scale. v1.x adds a real per-pill bar plot with mouseover tooltips. Tag with `// TODO(v1.x): real chart pending — current table is acceptable at v1 scale`. |
| 3 | Cost-dashboard 28-day daily-bars + by-operation breakdown | `(admin)/cost/_components/daily-bars-placeholder.tsx` | Renders grey-band placeholder sized to design footprint. Backend extension required: `daily_history: number[]` + `by_operation: [...]` fields on `cost/summary` response. Locked v1.x contract in §B.1 §7. **Descoped to v1.x per user lock-in — NOT a §H (a) blocker.** |
| 4 | AC-D27 effective-difficulty drift queue (distinct from AC-D23 bootstrap-quality flag queue) | `(admin)/calibration/_components/flagged-anchors-table.tsx` | v1 ships `anchors/flagged` (AC-D23) only. AC-D27-style effective-difficulty drift surface deferred to v1.x. Would require a new backend endpoint exposing pills where `n ≥ threshold` AND `|effective_difficulty - assigned_difficulty|` exceeds a delta. Tag the page header with `// TODO(v1.x): add AC-D27 effective-difficulty drift queue`. |
| 5 | Cost dashboard 7d / YTD range segments visible but disabled | `(admin)/cost/_components/range-selector.tsx` | v1 renders the 3 segments per design but only `month` is functional. v1.x backend support (rolling-7d aggregation, year-to-date) unlocks the other two. Tag with `// TODO(v1.x): enable 7d + YTD ranges pending backend support`. |
| 6 | Bootstrap card "Last run" + counters before first run | `(admin)/system/_components/bootstrap-card.tsx` | v1 surfaces empty stats with "Run bootstrap to populate stats" copy if no session-local cache. v1.x: small backend addition exposing the most-recent `bootstrap.run` audit-log telemetry via a GET. Folded into §H (b) item 13. |
| 7 | Realism aggregate card stats DEPEND on a NEW backend endpoint | `(admin)/system/_components/realism-card.tsx` | **§H (a) item 8 blocker** — `GET /v1/admin/realism/status` must land before FE-9 build session opens. Card shows empty state with "Run aggregate to populate" otherwise. |
| 8 | Drive-ingest card "Recent runs" mini-list — backend has no runs-history endpoint | `(admin)/system/_components/drive-ingest-card.tsx` | v1 derives from session-local mutation results only. v1.x adds backend persistence + GET endpoint. Tag with `// TODO(v1.x): server-backed recent runs history`. |

---

## F. Scope additions beyond prior FE-N specs

### F.1 `DECISIONS.md` AC-D18 alignment — no hard budget enforcement

AC-D18 explicit: "operations continue regardless of threshold crossings (no hard enforcement)". §B.1 honours by surfacing alert pills without disabling any features. No spec amendment.

### F.2 `DECISIONS.md` AC-D27 deferral — calibration drift queue not in v1

Surfaced in §E.4 + §H (c) item 17. The v1 calibration page consumes the AC-D23 bootstrap-quality queue (`anchors/flagged`) only. An AC-D27 drift queue is a distinct backend surface, deferred to v1.x. No v1 spec amendment.

### F.3 No new `CODE_SPEC.md` AC-CD-structural additions

FE-9 systems side ships with **zero new runtime deps**. All primitives inherited from FE-2 + FE-8 + sibling file's installed sets. The `SystemOpCard` extraction is a local component, not a library install. Confirmed at plan time.

### F.4 Nav-rail extension — folded into build PR's handover

The current `shell.jsx:15` declares 7 admin nav ids: `ops`, `review`, `engagement`, `catalogue-admin`, `users`, `cost`, `loop`. FE-9 systems pages need 2 additional ids: `calibration` + `system`. **§H (b) item 9** verifies; build session extends the nav-rail as an AC-CD-structural addition fold per SESSION_START.md carve-out (small, well-rationalised, doesn't violate AC-CD19).

---

## G. Template propagation — see sibling file

See `fe-specs/FE-9-admin-ops.md` §G. The full propagation discipline lives there; this file inherits unchanged. **FE-9 is the LAST detail spec** — no template propagation downstream.

---

## H. Spec-drift roll-up (post-review classification)

The cross-walk surfaced 14 candidate items across the FE-9 split. After review, classified into three groups. **This file's H block covers items numbered 8–17 (continuous numbering across the FE-9 split for cross-reference clarity); the sibling file's H block covers 1–7.**

### (a) BLOCKERS for the FE-9 build session — must land before the build session opens

8. **New backend endpoint `GET /v1/admin/realism/status`.** Authored by user as a separate spec-clarification PR (or bundled into the row-enrichment PR — user's choice at PR-authoring time). Locks the contract:

   ```ts
   type RealismStatusResponse = {
     last_aggregated_at: string | null;
     flags_processed_last_run: number;
     below_threshold_count: number;
     auto_suppressed_count: number;
     total_flag_count_active: number;
   };
   ```

   **The FE-9 build session cannot open until this PR is on `main`** — the realism card on the system page renders no useful state without it.

9. **(folded into sibling file §H (a) item 1)** `FlaggedAnchorItem.pill_name` enrichment. The sibling file's row-enrichment PR adds this field; the calibration page's table + drift chart depend on it. Cross-referenced from sibling §H (a) item 1.

### (b) BUILD-SESSION VERIFICATION TASKS — front-loaded at the start of the FE-9 build session

10. **`cost/summary` typing.** The endpoint returns inline `dict[str, Any]` — no named Pydantic response model. Spec body locks the field shape via a local TS type alias `CostSummaryResponse`. Verify at build-session open: read `app/routers/cost.py:34–99` + the underlying `current_month_spend` domain function and confirm the field set matches the locked shape. If divergent, update the TS type.
11. **Calibration `lastRun` cache pattern.** Verify whether backend exposes a "current summary" GET. If yes, replace the session-local `lastRun` cache with a proper `useQuery`. If no, lock the session-local pattern with the "Run calibration to populate stats" copy.
12. **`SystemSettings.last_safety_link_check_at` field.** Verify this column exists in `app/models.py` for the safety-link card's "Last check" stat. If absent, the stat falls back to deriving from the most-recent `safety_links.check` audit log row.
13. **Bootstrap card status source.** Verify whether `SystemSettings` exposes the most-recent bootstrap telemetry (last_run_at, pills count, anchors count, drive_docs count) OR whether the values must be derived from separate queries (`AuditLog` + `GET /v1/pills?limit=1` + `GET /v1/admin/drive/index`). Spec body assumes derivation from separate queries.
14. **Nav-rail ids.** Verify whether `shell.jsx:15` declares `calibration` + `system` nav-rail ids. If absent, FE-9 extends the nav-rail in this build PR as an AC-CD-structural addition fold (§F.4).

### (c) APPROVED RESOLUTIONS — folded into FE-9 build PR scope, captured in the build PR's handover

15. **Cost-dashboard daily bars + by-operation breakdown descoped to v1.x** per user lock-in (§B.1 §7, §E.3). Locked v1.x contract documented for future PR; v1 ships placeholder card.
16. **Cost-dashboard 7d / YTD range segments disabled in v1** per user lock-in (§E.5). v1 ships the segments visible-but-disabled with tooltip "Coming in v1.x".
17. **AC-D27 effective-difficulty drift queue deferred to v1.x** (§E.4, §F.2). v1 ships the AC-D23 bootstrap-quality queue (`anchors/flagged`) only; `anchors/flagged` naming kept canonical (not renamed to `calibration/flagged`).
18. **Drift chart simplified to a TABLE in v1** (§E.2). Justified by v1 scale (~14 flagged anchors, ~8 pills). v1.x adds a real chart.
19. **No GET for bootstrap status in v1** (§E.6, §H (b) item 13). v1 ships session-local cache mirroring calibration `lastRun` pattern; build session decides whether to add a small backend exposure (small enough to fold into the row-enrichment PR scope if the user prefers atomicity).
20. **Drive-ingest "Recent runs" sub-list session-local in v1** (§E.7). v1.x adds backend persistence.
21. **Nav-rail extension** (`calibration` + `system` ids if absent) — AC-CD-structural addition fold per §F.4.

---

*End of FE-9-admin-systems.md. Sibling spec: `fe-specs/FE-9-admin-ops.md`. **FE-9 is the LAST detail spec** — no template propagation downstream; the build phase opens against locked detail specs for FE-1..FE-9 once this PR merges.*
