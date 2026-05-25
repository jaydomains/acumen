# FE-9 — Admin operations: queue-driven adjudication (detail spec)

> **Status:** plan-mode authored, ready for build session (subject to §H (a) blockers — the row-enrichment backend sweep PR + the `?verdict=` filter wiring on `GET /v1/admin/grade-reviews/flagged` must resolve before the FE-9 build session opens). FE-1..FE-8 builds must also land first per FE_ROADMAP dependency order.
> **Owns:** the four queue-driven admin adjudication surfaces — ops landing (`/admin/ops`), grade-review queue (`/admin/grade-reviews`), loop queue (`/admin/loops`), engagement (`/admin/engagement`). Also owns the canonical `adminKeys` extension set for these four domains (§C.1) consumed by reference from `fe-specs/FE-9-admin-systems.md`. Also owns the canonical `SweepButton` state-machine primitive (§C.4) consumed by all four "run-on-demand" cron triggers in the sibling file.
> **PR target:** `PR-NNN-fe9-admin-operations` (one squash PR closes the FE-9 phase; ships two sibling docs — this file + `fe-specs/FE-9-admin-systems.md`).
> **Anchors:** AC-D6 (adaptive loop — autonomous vs admin-reviewed modes, approve/reject pending steps), AC-D19 (cross-family review — flagged → admin attention queue, three resolve actions), AC-D26 (mandatory-assignment engagement + auto-escalation, sweep), AC-D18 (cost summary teaser on ops landing), AC-CD11 (admin-only surfaces; cross-family-review batched-per-attempt locked at v1.7), AC-CD19 (FE stack lock), AC-CD20 (`(admin)` route group + role guard → `/403`), AC-CD21 (centralised query keys + form helper + error envelope).
>
> This is the **ninth per-page FE detail spec**, first of two siblings (ops / systems) for the FE-9 admin operations phase. Template inheritance: per-page §B from `fe-specs/FE-1-auth.md:50–60` verbatim; FE-2's `(admin)` route group + admin shell consumed unchanged; FE-1's `applyApiErrorToForm` precedent consumed by every mutation form at path `frontend/src/lib/api/form-errors.ts` per `CODE_SPEC.md:1024` + FE-3/FE-4/FE-8 consensus; FE-3 cursor pagination + filter-bar + URL-state-sync patterns reused (`fe-specs/FE-3-content.md:527–644`); FE-8 `adminKeys` library (`fe-specs/FE-8-admin-catalogue.md:1072–1149`) consumed and EXTENDED with FE-9-specific key roots. Two-file split selected per `fe-specs/FE-1-auth.md:747` escape clause; user-locked at plan time. **This is the LAST FE-N detail spec** — no further template propagation downstream.

---

## 0. Context

FE-0 (PR-032) shipped the Next.js 15 / App Router scaffold + typed `openapi-fetch` client. PR-033 locked AC-CD20..24. FE-1..FE-8 **spec-merged** auth, shell, content, runner, streaming, results, profile, admin authoring — none built yet; FE-9 presumes their builds land in roadmap order before this build session opens (§H (a) item 1).

FE-9 is the admin operations phase — the seven distinct admin surfaces FE-8 explicitly excluded (`fe-specs/FE-8-admin-catalogue.md` §F.4 lists them). Per FE-1 §G escape clause (multi-file split when a single file exceeds ~2500 lines), FE-9 ships as **two sibling spec files**:

- `fe-specs/FE-9-admin-ops.md` (this file) — ops landing + grade-review queue + loop queue + engagement (the four queue-driven adjudication surfaces).
- `fe-specs/FE-9-admin-systems.md` — cost dashboard + anchor calibration + system page (the three system-state / cron-trigger surfaces).

The two files share a single PR. The split aligns with the prototype's natural division: `admin.jsx` mocks the queue surfaces; `admin-ops.jsx` mocks the system-operation surfaces. Domain-boundary rationale: queue-driven surfaces share the row-enrichment backend dependency in §H (a); system-state surfaces share the sweep-button primitive defined here in §C.4 and reused by the sibling.

**FE-N spec preconditions FE-9 extends, not replaces** (the contracts FE-9 builds against — quote and cite, do not re-decide):

- **FE-1 `applyApiErrorToForm` helper** at `frontend/src/lib/api/form-errors.ts` per `CODE_SPEC.md:1024` + `fe-specs/FE-3-content.md:16` + `fe-specs/FE-4-runner.md:16` + `fe-specs/FE-8-admin-catalogue.md` §H (b) item 1. Every FE-9 modal form uses this helper. Signature locked at `fe-specs/FE-1-auth.md:558–562`.
- **FE-1 error patterns A/B/C** at `fe-specs/FE-1-auth.md:567–658`: Pattern A (inline + root via `setError`), Pattern B (sonner toast with severity-coded auto-dismiss 3s/5s/7s), Pattern C (full-page boundary card). FE-9 uses A for the override drawer + reject-reason modal forms, B for sweep / approve / reject success and error toasts, C for `(admin)` route-group `error.tsx` boundaries.
- **FE-1 five-posture route-guard matrix** at `fe-specs/FE-1-auth.md:603–611`. Posture 4 (testee role → `/admin/*`) redirects to `/403`. FE-9's `(admin)` route group consumes the matrix unchanged.
- **FE-2 `(admin)` route group + admin shell** at `fe-specs/FE-2-shell.md` (B.14). FE-9 mounts pages under `frontend/src/app/(admin)/` without adding new guard plumbing. Admin nav rail from `shell.jsx:15` declares `ops`, `review`, `engagement`, `catalogue-admin`, `users`, `cost`, `loop` — FE-9 maps to all of these except `catalogue-admin` + `users`. **§H (b) item 1: the rail does NOT declare separate `loops` vs `loop`** — verify whether `loop` is the canonical id (loop queue page is the only consumer) or if rail also needs `calibration` + `system` ids added (covered by the sibling file).
- **FE-2 primitives** consumed unchanged: `Pill` (status / verdict / mode badges), `Stat` (overview stat cards on ops landing), `BandTag` (per-pill band in grade-review detail), `PageHeader` (eyebrow + serif-italic title), `Icon` (lucide-react). shadcn install set from FE-2 + FE-8's addition of `Sheet` (used here for the grade-review override drawer per design `admin.jsx:208–306`).
- **FE-3 cursor pagination pattern** at `fe-specs/FE-3-content.md:634–636` — `useInfiniteQuery` with `getNextPageParam: (last) => last.meta.next_cursor` + `IntersectionObserver` sentinel. **NOT used in FE-9.** The four FE-9 ops endpoints return `data: [...]` flat lists (not `Page_T_` envelopes — verified at `app/routers/admin.py:84–86 / 116–118 / 156–158`); cursor pagination is unnecessary at v1 queue depth. If a queue grows past ~200 rows the build session adds pagination as a v1.x follow-up. Surfaced as §H (c) approved resolution.
- **FE-3 URL-state ↔ filter-state sync** at `fe-specs/FE-3-content.md:642–644` — `useRouter().replace()` (not `push`) so back-button doesn't accumulate filter noise. Grade-review queue's `?verdict=` + `?selected={id}` URL state inherits this pattern.
- **FE-8 `adminKeys` library** at `fe-specs/FE-8-admin-catalogue.md:1072–1149` rooted at `['admin']`, mirroring `meQueryKeys`. FE-9 adds new key roots `ops` / `gradeReviews` / `loops` / `engagement` (this file's §C.1) and `cost` / `calibration` / `system` (sibling file's §C.1). No edit to FE-8's declarations.
- **FE-6 cross-family verdict surface** at `fe-specs/FE-6-results.md` §B.4 — testee sees the `AiReviewChip` (confirmed / flagged / pending) on per-Q card. **FE-9 is the admin-side of FE-6's flagged state**: rows with `review_verdict='flagged'` route here for adjudication. Quoted contract: `grade_review.review_verdict ∈ {pending, confirmed, flagged}` per AC-D19 v1.7; `flagged` rows surface in `GET /v1/admin/grade-reviews/flagged` per `app/routers/admin.py:106–118`.
- **FE-3 cross-walk**: FE-3 §B.1 references `/v1/admin/engagement/pending` as a surface FE-9 owns (FE-3 ships no testee-side consumer; FE-9 is the exclusive consumer). FE-9 §B.4 picks up that ownership.

**Done-when (subset of `FE_ROADMAP.md:189–190`, this file's slice):** Admin can: see ops landing → click flagged grade → adjudicate with override + reason → click engagement → run sweep → click loops → approve / reject a pending follow-up. The cost / calibration / system slice of done-when lives in `fe-specs/FE-9-admin-systems.md`.

**Scope boundary — what this file explicitly does NOT ship:**

- **Cost dashboard, anchor calibration, system page.** Owned by `fe-specs/FE-9-admin-systems.md`. The ops landing (§B.1) renders a cost-summary teaser card by composing `GET /v1/admin/cost/summary` directly (no UI duplication); for the full cost dashboard the user navigates to `/admin/cost` (sibling file).
- **Per-row engagement nudge / reassign.** v5 design (`admin.jsx:356–357`) has Nudge / Reassign row buttons; `FE_ROADMAP.md:188` + `admin-ops.jsx:277–284` explicitly remove them for v1. The engagement page (§B.4) ships sweep-only — one administrative action processes all stale assignments. Per-row reassignment deferred to v1.x. Surfaced in §F.1.
- **Cost dashboard daily bars + per-operation breakdown.** Sibling-file scope (descoped to v1.x per user lock-in). Ops landing still renders the month-to-date cost summary teaser via `GET /v1/admin/cost/summary`.
- **Pill catalogue / users / groups / assignments / test authoring.** FE-8 territory (`fe-specs/FE-8-admin-catalogue.md` + `fe-specs/FE-8-admin-identity.md` + `fe-specs/FE-8-admin-tests.md`).
- **Edit-then-approve on flagged grade-review.** AC-D19 v1.6 surfaces three resolve actions only (`keep_ai` / `accept_reviewer` / `substitute`) per `GradeReviewResolveRequest` at `app/schemas.py:726–744`. The override drawer (§B.2) ships these three; no inline edit of the AI reasoning. Surfaced in §F.2.
- **`GET /v1/admin/ops/overview` server-side aggregate endpoint.** Does not exist; ops landing composes client-side from 5 parallel TanStack queries per user lock-in. Surfaced in §H (c) item 13.

**Additions to `(admin)/layout.tsx`:** none beyond what FE-2 mounts. The shared `(admin)` shell from FE-2 hosts all FE-9 pages unchanged.

---

## A. Page/feature inventory

| # | Capability | Route / file | Design source | Screenshot |
|---|---|---|---|---|
| 1 | Ops dashboard — landing aggregate composing flagged-review preview / engagement preview / cost summary / bootstrap status / pill-proposals teaser; client-side composition of 5 parallel queries (no aggregate endpoint) | `(admin)/ops/page.tsx` + `_components/review-row-compact.tsx` + `_components/daily-bars.tsx` (inline) | `admin.jsx:8–129` (`AdminOps`) + `admin.jsx:131–145` (`ReviewRowCompact`) + `admin.jsx:148–163` (`DailyBars` shared with cost) | **absent** — §E.1 design-reference gap |
| 2 | Grade-review queue — split-detail (left rail list + right pane detail) + override drawer (`Sheet`) with 4 verdict tiles + reason; filter `?verdict={flagged,confirmed,all}` (server may not support `confirmed`/`all` — §H (a) item 2); deep-linkable `?selected={id}` for cross-page nav from ops landing | `(admin)/grade-reviews/page.tsx` + `_components/queue-list.tsx` + `_components/detail-pane.tsx` + `_components/override-drawer.tsx` | `admin.jsx:169–308` (`AdminReview`) | **absent** — §E.1 design-reference gap |
| 3 | Loop queue — full-list table with mode column (`autonomous`/`admin-reviewed`), iteration cell, status cell, contextual approve/reject row actions on actionable rows; approve modal (zero-field confirm); reject modal (required reason textarea) | `(admin)/loops/page.tsx` + `_components/loop-row.tsx` + `_components/approve-modal.tsx` + `_components/reject-modal.tsx` | `admin.jsx:668–714` (`AdminLoops` v5 base) + `admin-ops.jsx:50–203` (`LoopActionsMock` with `LoopRow:99–126`, `ApproveModal:128–155`, `RejectModal:157–203`) | `v6-fe9-23-loop-actions.png` |
| 4 | Engagement — `SweepButton` (idle/running/done state machine) + pending mandatory-assignment list (read-only rows, NO per-row nudge/reassign per `FE_ROADMAP.md:188`); success toast with sweep summary | `(admin)/engagement/page.tsx` + `_components/pending-list.tsx` | `admin.jsx:313–366` (`AdminEngagement` v5 reference — Nudge/Reassign deprecated) + `admin-ops.jsx:208–338` (`EngagementSweepMock` with `SweepButton:317–338`) | `v6-fe9-24-engagement-sweep.png` |

Four capabilities. Each is its own §B entry. The ops landing (#1) is the canonical entry surface; the other three are nav-rail destinations (`review` / `loop` / `engagement` from `shell.jsx:15`).

URL state declared per surface:
- §B.1 — none (read-only aggregate page).
- §B.2 — `?verdict={flagged|confirmed|all}` (default `flagged`); `?selected={grade_review_id}` (deep-linkable drawer-open state, supports navigation from ops landing).
- §B.3 — `?status={review|queued|step-down|material-served|closed|all}` (default `review` — actionable rows only).
- §B.4 — none (sweep is a button; pending list is unfiltered).

---

## B. Per-page detail specs

> **Template** (used identically for every page; from `fe-specs/FE-1-auth.md:50–60`):
> 1. Route segment + URL state
> 2. Components (scaffold reused / new in this PR / shadcn primitive / design primitive)
> 3. API endpoints consumed
> 4. Form fields + zod rules + react-hook-form integration shape (or "n/a — read-only page" with TanStack Query notes)
> 5. States (every variant from the design state-strip + any extras the wire surfaces)
> 6. Acceptance criteria (Gherkin — each trio maps to one Vitest test)
> 7. Edge cases / gotchas
> 8. Visual reference

### B.1 Ops dashboard — `/admin/ops`

**1. Route segment + URL state**

- File: `frontend/src/app/(admin)/ops/page.tsx`. The `(admin)` route group exists per FE-2; the `ops/` segment + its `error.tsx` boundary file are FE-9-introduced.
- URL state: none. Landing is a pure read-only aggregate. Click-through to `/admin/grade-reviews?selected={id}` (deep-linked drawer open per §B.2) and `/admin/loops?status=review` (deep-linked filter per §B.3).
- Static `<title>Operations · Acumen</title>` from `layout.tsx`. No `generateMetadata` dynamic title in v1.
- Nav-rail anchor: `shell.jsx:15` declares the admin nav id as `ops` with label "Operations"; rail-highlight wiring per FE-2.

**2. Components**

- **Scaffold reused:** `useAuth()` (FE-1); `client` + `unwrap` (FE-0); `PageHeader` + `Stat` + `Pill` (FE-2); `useQuery` (TanStack Query v5).
- **New in this PR:**
  - `OpsLandingPage` — top-level page composing the five summary cards. Fires 5 parallel `useQuery` calls on mount via `Promise.allSettled` semantics (each card renders its own loading/error skeleton independently).
  - `OpsHeroBanner` — top sentence pattern per `admin.jsx:13–35`: serif-italic title "Acumen, at a glance." + subtitle composed dynamically from the 5 query results ("N grade reviews need your attention. M mandatory assignments have escalated past 2nd reminder. AI spend is on pace within budget.").
  - `FlaggedReviewCard` — card mirroring `admin.jsx:38–60`. Header "Cross-family grade review · flagged", count badge, top-3 `ReviewRowCompact` preview rows (oldest-first), "View all flagged →" CTA → `/admin/grade-reviews?verdict=flagged`.
  - `ReviewRowCompact` — compact one-row preview per `admin.jsx:131–145`: testee name + pill name + reason + age relative-time + verdict pill. Click → `/admin/grade-reviews?selected={id}`. **Depends on row enrichment** — see §H (a).
  - `EngagementPreviewCard` — card mirroring `admin.jsx:62–84`. Header "Pending mandatory assignments", count, top-4 escalated-only rows (testee + assignment + days-stale + escalated badge), "Run sweep / View all →" dual CTAs.
  - `CostSummaryCard` — card mirroring `admin.jsx:86–112`. Header "AI spend · this month", `Stat` row (total / budget% / alerts-fired pills), inline `DailyBars` SVG (28 bars derived from `cost/summary` if `daily_history` is present, else placeholder — sibling file's §B.1 descopes the daily-bars contract to v1.x). "View cost dashboard →" CTA.
  - `BootstrapStatusCard` — card mirroring `admin.jsx:114–123`. Header "Bootstrap status", three stats (pills count from `/v1/pills?limit=1` count meta, anchors count derived from `bootstrap.run` last telemetry if cached, drive docs count from `/v1/admin/drive/index`). "Open system page →" CTA → `/admin/system`.
  - `PillProposalsTeaserCard` — card mirroring `admin.jsx:125–129`. Header "Pill proposals · N awaiting review", thumbnail of the 3 newest pending. "Review proposals →" → `/admin/catalogue?tab=proposals`.
  - `DailyBars` — inline SVG sparkline (28 bars) per `admin.jsx:148–163`. Last bar highlighted as "today". Reused by sibling file's cost dashboard (§B.1). Defined here so the ops landing teaser uses the same primitive; sibling-file consumption documented in `fe-specs/FE-9-admin-systems.md` §C.
- **shadcn primitives installed in this PR:** none beyond FE-2 + FE-8's installed set.
- **Design primitives reused:** `Pill` (FE-2) for verdict + status badges. `Stat` (FE-2) for headline metrics. `.card`, `.card-hd`, `.eyebrow`, `.h-display`, `.serif-it`, `.muted`, `.right` design classes per FE-2 / AC-CD23.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/admin/grade-reviews/flagged` | Top-3 flagged grade-review preview rows. `FlaggedReviewCard` reads first 3 items + count. Same endpoint as §B.2; cache-shared via `adminKeys.gradeReviews.flagged()`. | **Exists** at `app/routers/admin.py:106–118`. Returns `FlaggedGradeReviewListResponse` per `app/schemas.py:722–723`. **Sparse row payload — §H (a) item 1 row-enrichment PR adds testee_name / pill_name / question_prompt / rubric_extract / testee_response.** |
| `GET /v1/admin/engagement/pending` | Top-4 escalated mandatory assignments. `EngagementPreviewCard` reads first 4 + count. Same endpoint as §B.4; cache-shared via `adminKeys.engagement.pending()`. | **Exists** at `app/routers/admin.py:80–86`. Returns `EngagementWidgetResponse` per `app/schemas.py:589–590`. **Sparse row payload — §H (a) item 1 adds testee_name / pill_or_test_name / assigner_name / days_stale / reminders_sent / escalated.** |
| `GET /v1/admin/cost/summary` | Cost summary stats. `CostSummaryCard` reads `total_usd` / `monthly_budget` / `percent_of_budget` / `alerts_fired_this_month`. Same endpoint as sibling file's §B.1; cache-shared via `adminKeys.cost.summary()` (declared in sibling §C.1, referenced here). | **Exists** at `app/routers/cost.py:34–99`. Returns inline `dict[str, Any]` (no named schema — typed manually). |
| `GET /v1/admin/drive/index` | Drive-index docs count for the BootstrapStatusCard. Cache-shared with sibling file's system page (§B.3 drive card) via `adminKeys.system.driveIndex()`. | **Exists** at `app/routers/rag.py:199–209`. Returns `DriveIndexStatus`. |
| `GET /v1/pill-proposals?status=pending&limit=3` | Top-3 pending pill proposals for the teaser card. Cache-shared with FE-8's proposals tab via `adminKeys.proposals.list({status: 'pending'})`. | **Exists** (FE-8 §B.4). Returns `Page_PillProposalResponse_`. |

**Locked composition contract** (spec body — no `/v1/admin/ops/overview` endpoint; 5 parallel queries fired in parallel via TanStack Query's default in-flight scheduling):

```ts
// All 5 queries fire on mount; cards render their own loading state independently.
useQuery({ queryKey: adminKeys.gradeReviews.flagged(), staleTime: 30_000 });
useQuery({ queryKey: adminKeys.engagement.pending(), staleTime: 30_000 });
useQuery({ queryKey: adminKeys.cost.summary(), staleTime: 60_000 });          // declared in sibling §C.1
useQuery({ queryKey: adminKeys.system.driveIndex(), staleTime: 60_000 });     // declared in sibling §C.1
useQuery({ queryKey: adminKeys.proposals.list({status: 'pending'}), staleTime: 30_000 }); // declared in FE-8 §C.1
```

**4. Form fields + zod + rhf**

n/a — read-only landing. No forms. TanStack Query notes per §3 above.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `loading_initial` | All 5 queries in-flight on mount | Five card skeletons render in parallel; `OpsHeroBanner` renders the title + a skeleton subtitle. |
| `partial_loaded` | Some queries resolved, others in-flight | Resolved cards render their content; unresolved cards remain in skeleton state. `OpsHeroBanner` subtitle composes from resolved data, omits counts from unresolved cards. |
| `all_loaded` | All 5 queries resolved | Full layout renders. Subtitle composes complete sentence. |
| `flagged_empty` | `gradeReviews.flagged` returns `data: []` | `FlaggedReviewCard` renders empty state copy "No flagged grades waiting" + check icon; teaser CTA hidden. |
| `engagement_empty` | `engagement.pending` returns `data: []` | `EngagementPreviewCard` renders empty state copy "All caught up — no stale assignments". |
| `proposals_empty` | `pill-proposals` returns `data: []` | `PillProposalsTeaserCard` renders empty state "No proposals waiting". |
| `cost_no_budget` | `cost.summary.monthly_budget === null` | `CostSummaryCard` shows total spend without budget %; alerts pills hidden. |
| `cost_alerts_fired` | `cost.summary.alerts_fired_this_month` non-empty | `Pill` badges render for each fired threshold (50/80/100% per AC-D18). |
| `card_error` | Any single query throws | Card renders its own error state ("Couldn't load" + small retry button); other cards stay rendered. Boundary stays mounted. |
| `boundary_error` | An unexpected runtime error during render (not a query error) | Pattern C boundary card mounts via `(admin)/ops/error.tsx`. Copy: "Couldn't load operations." + "Try again" + "Go to admin dashboard". |
| `role_mismatch` | Testee role hits `/admin/ops` | AC-CD20 `(admin)` layout guard redirects to `/403` before page mount. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Admin lands on /admin/ops with all data ready
  Given an admin user opens /admin/ops
  And all 5 backend queries return non-empty data
  When the page mounts
  Then five summary cards render: flagged-review preview, engagement preview, cost summary, bootstrap status, pill-proposals teaser
  And the hero subtitle reads "N grade reviews need your attention. M mandatory assignments have escalated past 2nd reminder. AI spend is on pace within budget." with N and M populated
```

```gherkin
Scenario: Click through to grade-review detail from landing
  Given the FlaggedReviewCard shows 3 preview rows
  When the admin clicks a preview row
  Then router.push fires with /admin/grade-reviews?selected={grade_review_id}
  And the grade-review queue mounts with the override drawer pre-opened
```

```gherkin
Scenario: Click through to engagement
  Given the EngagementPreviewCard shows escalated rows
  When the admin clicks "View all →"
  Then router.push fires with /admin/engagement
```

```gherkin
Scenario: One query fails — card-level error
  Given the page mounts
  When GET /v1/admin/cost/summary throws 500
  And the other 4 queries resolve normally
  Then the CostSummaryCard renders its own "Couldn't load" state with a retry button
  And the other 4 cards render their content normally
  And the boundary does NOT mount
```

```gherkin
Scenario: Empty flagged queue
  Given GET /v1/admin/grade-reviews/flagged returns {data: []}
  When the FlaggedReviewCard renders
  Then the card shows "No flagged grades waiting"
  And the "View all flagged →" CTA is hidden
  And the hero subtitle omits the grade-review clause
```

```gherkin
Scenario: Cost alerts fired this month
  Given GET /v1/admin/cost/summary returns alerts_fired_this_month: [50, 80]
  When the CostSummaryCard renders
  Then two Pill badges render: "50% alert" and "80% alert"
  And the 100% threshold pill is absent
```

```gherkin
Scenario: Testee hits /admin/ops — 403
  Given a testee user opens /admin/ops
  When the (admin) layout-guard evaluates the role
  Then the user is redirected to /403
  And the ops landing never mounts
```

(Seven scenarios mapped to §D.2 ops-landing integration tests.)

**7. Edge cases / gotchas**

- **Card-level error isolation.** Pattern C boundary should NOT mount for individual query failures — cards render their own error states. The boundary catches render-time exceptions only. TanStack's per-query `isError` flag drives the card-level state.
- **`OpsHeroBanner` composition is defensive.** If any of the 5 queries hasn't resolved, the subtitle omits that clause (e.g. cost summary unresolved → drop "AI spend is on pace" sentence half). Avoids ugly skeletons in the subtitle.
- **`adminKeys.ops.overview()` does NOT correspond to a real endpoint.** It's a synthetic invalidation key — mutations on grade-review / engagement / cost should also invalidate `adminKeys.ops.overview()` to force the landing to refresh on next visit. Build session decides whether this is worth the indirection or whether each mutation invalidates the underlying source key only (and the landing refetches via shared cache); spec body locks the synthetic key for explicit invalidation discipline.
- **Cross-page nav via `?selected={id}` requires the grade-review queue to read the param on mount** (§B.2 §1). If the queue isn't fetched yet, the drawer opens skeleton-first and populates when data lands.
- **`DailyBars` here renders WITHOUT data if `daily_history` field is missing.** Sibling file's §B.1 descopes daily bars to v1.x — until backend ships the field, ops landing's `CostSummaryCard` renders a placeholder grey band where the sparkline would be, sized to match the design's footprint so the card doesn't shift when daily-bars arrive in v1.x.
- **No real-time updates.** Landing is fetched on mount; no WebSocket / SSE / polling in v1. Counts may be stale if a coworker admin acts simultaneously. Refresh button (browser reload) is the v1 remedy.

**8. Visual reference**

- `frontend/design-reference/prototype/admin.jsx:8–129` — `AdminOps` (full landing layout).
- `frontend/design-reference/prototype/admin.jsx:131–145` — `ReviewRowCompact` (preview-row primitive).
- `frontend/design-reference/prototype/admin.jsx:148–163` — `DailyBars` (sparkline; reused by cost dashboard).
- Screenshot: **absent** — design-reference completeness gap (§E.1).

---

### B.2 Grade-review queue — `/admin/grade-reviews`

**1. Route segment + URL state**

- File: `frontend/src/app/(admin)/grade-reviews/page.tsx`. Segment + `error.tsx` boundary file are FE-9-introduced.
- URL state: `?verdict={flagged|confirmed|all}` (default `flagged` on mount); `?selected={grade_review_id}` (drawer-open state, deep-linkable from ops landing per §B.1). Both state changes call `router.replace()` per FE-3 §C.7.
- Static `<title>Grade review · Acumen</title>`.
- Nav-rail anchor: `shell.jsx:15` declares the admin nav id as `review` with label "Grade Review" + badge showing flagged count.

**2. Components**

- **Scaffold reused:** `client` + `unwrap` + `ApiError` (FE-0); `useQuery` + `useMutation` + `useQueryClient` (FE-3 §C.5); `useForm` + `zodResolver` (FE-1 §B.4); `applyApiErrorToForm` (FE-1 / path per §0); `PageHeader` (FE-2); `useRouter` + `useSearchParams` (Next 15).
- **New in this PR:**
  - `GradeReviewQueuePage` — top-level page. Two-column layout per `admin.jsx:178–220`. Left rail (col-span-4): segmented `?verdict=` filter + `QueueList` (rows). Right pane (col-span-8): `DetailPane` showing the selected row's full grade comparison + Override CTA → opens `OverrideDrawer`. URL state syncs both columns.
  - `QueueList` — vertical list of rows (NOT a table; design uses card-style rows for the rail per `admin.jsx:180–202`). Each row shows testee + pill + age + verdict pill. Selected row gets highlight + arrow indicator.
  - `DetailPane` — selected-row detail per `admin.jsx:223–298`. Sections: header (testee + pill + band + attempt id), question + rubric extract collapsible block, side-by-side primary vs reviewer comparison, current outcome strip, "Apply override" CTA opening the drawer. Renders empty placeholder ("Select a flagged grade") when no `?selected=`.
  - `OverrideDrawer` — shadcn `Sheet` (right-side, ~520px width). Header "Apply override" + sub-line of grade context. Body: 4 verdict tiles per `admin.jsx:255–277` ("Full · 1.0" / "Partial · 0.6" / "Partial · 0.4" / "None · 0.0") rendered as `<button role="radio">` group with one selected. Optional reason textarea ("Reason visible to testee — optional"). Footer: Cancel + "Apply override" submit button.
  - `VerdictTile` — single tile primitive (~120px square, label + numeric score subtitle + check icon when selected) per `admin.jsx:265–272`. Reused by sibling file's calibration verdict-choice in `FE-9-admin-systems.md` §B.2 — extracted to `frontend/src/components/admin/verdict-tile.tsx`.
- **shadcn primitives installed:** none beyond FE-2 + FE-8's installed set (`Sheet` from FE-8 §B.4 reused).
- **Design primitives reused:** `Pill` (verdict / status badges), `BandTag` (per-pill band in detail header), `PageHeader` (FE-2 — eyebrow "Cross-family review · AC-D19 · batched per attempt · 60s ceiling" + serif-italic title "Adjudicate AI grades."). `.card`, `.btn`, `.btn.btn-primary`, `.tbl`, `.eyebrow`, `.h-display`, `.muted`, `.mono` classes per FE-2 / AC-CD23.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/admin/grade-reviews/flagged` | List flagged grade_review rows oldest-first. Consumed by `QueueList`. `staleTime: 30_000`. | **Exists** at `app/routers/admin.py:106–118`. Returns `FlaggedGradeReviewListResponse` per `app/schemas.py:705–723`. **Two payload concerns: (a) row sparseness — §H (a) item 1; (b) the endpoint as-shipped returns flagged rows ONLY — there's no `?verdict=` query param. Confirmed-state filter requires either a separate endpoint or a query-param addition. Spec body locks `?verdict=` as needed; §H (a) item 2 covers the wiring.** |
| `POST /v1/admin/grade-reviews/{grade_review_id}/resolve` | Resolve one flagged review with override action. Body per `GradeReviewResolveRequest` at `app/schemas.py:726–753`: `{action: 'keep_ai' \| 'accept_reviewer' \| 'substitute', score?: 0..1, verdict?: 'full' \| 'partial' \| 'none', reasoning?: string}`. The `substitute` action requires `score` + `verdict` (Pydantic `model_validator` enforces). Returns `GradeReviewResolveResult` per `app/schemas.py:756–769` (the post-resolution Grade state + attempt overall score). | **Exists** at `app/routers/admin.py:121–142`. |
| `POST /v1/admin/grade-reviews/reconcile` | Manual trigger of the §8.9 grade-review reconcile cron. **Not consumed by this page directly** — sibling file's system page §B.3 exposes the trigger button. Listed here as cache-invalidation target: a successful reconcile run from the system page invalidates `adminKeys.gradeReviews.flagged()`. | **Exists** at `app/routers/admin.py:89–103`. Returns `GradeReviewReconcileResult`. |

**Locked verdict-tile mapping** (spec body — the four tiles' `(score, verdict)` payloads):

| Tile label | `score` | `verdict` | Action |
|---|---|---|---|
| "Full · 1.0" | 1.0 | `full` | `substitute` |
| "Partial · 0.6" | 0.6 | `partial` | `substitute` |
| "Partial · 0.4" | 0.4 | `partial` | `substitute` |
| "None · 0.0" | 0.0 | `none` | `substitute` |
| (additional CTAs above tiles) | — | — | `keep_ai` (button "Keep AI grade") + `accept_reviewer` (button "Accept reviewer's verdict") — see §5 |

**4. Form fields + zod + rhf**

The override drawer's form uses react-hook-form for the verdict-tile selection + reason textarea:

```ts
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const substituteSchema = z.object({
  score: z.number().min(0).max(1),
  verdict: z.enum(["full", "partial", "none"]),
  reasoning: z.string().max(2000).optional().default(""),
});
type SubstituteInput = z.infer<typeof substituteSchema>;

const form = useForm<SubstituteInput>({
  resolver: zodResolver(substituteSchema),
  mode: "onSubmit",
});
```

For the `keep_ai` and `accept_reviewer` actions, no form fields — bare mutation. Pattern:

```ts
const resolveMutation = useMutation({
  mutationFn: (input: { reviewId: string; body: GradeReviewResolveRequest }) =>
    unwrap(client.POST("/v1/admin/grade-reviews/{grade_review_id}/resolve", {
      params: { path: { grade_review_id: input.reviewId } },
      body: input.body,
    })),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: adminKeys.gradeReviews.flagged() });
    queryClient.invalidateQueries({ queryKey: adminKeys.ops.overview() });  // refresh landing counters
    toast.info("Override applied");
    // close drawer + clear ?selected from URL
  },
  onError: (err) => applyApiErrorToForm(err, form),
});
```

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `list_loading` | Initial `useQuery` for flagged rows in-flight | `QueueList` renders 6 row skeletons; `DetailPane` empty placeholder. |
| `list_empty_flagged` | Response `data: []` with `?verdict=flagged` | `QueueList` empty state "No flagged grades waiting" + check icon; `DetailPane` shows celebratory empty state. |
| `list_empty_confirmed` | Response `data: []` with `?verdict=confirmed` | `QueueList` empty state "No confirmed reviews on the current sweep window". |
| `list_happy` | Response has rows | Rows render oldest-first; first row auto-selected if no `?selected=` in URL. |
| `filter_verdict_changed` | Admin clicks segmented `?verdict=` button | URL replaces; query refetches with new param; first row of new result auto-selected. **§H (a) item 2 — backend filter wiring required for confirmed/all variants.** |
| `row_selected` | Admin clicks a row OR mounts with `?selected={id}` in URL | URL replaces with `?selected={id}` (no double history entry); `DetailPane` renders the row's full detail; if row data isn't in cache, fetch the row via `queryClient.fetchQuery(adminKeys.gradeReviews.detail(id))` or fall back to the existing list payload (which carries the enriched fields per §H (a) item 1). |
| `drawer_opening` | Admin clicks "Apply override" CTA in `DetailPane` | `OverrideDrawer` mounts; form pristine; no tile selected. |
| `keep_ai_clicked` | Admin clicks "Keep AI grade" button in drawer | Confirmation pulse-dot + immediate POST with `{action: 'keep_ai'}`; success closes drawer + invalidates queries + toast. |
| `accept_reviewer_clicked` | Admin clicks "Accept reviewer's verdict" button | POST with `{action: 'accept_reviewer'}`; success path same as keep_ai. |
| `substitute_tile_selected` | Admin clicks one of the 4 verdict tiles | Tile gets highlight + check icon; `Apply override` button enables; form fields populated with locked (score, verdict) pair from the tile. |
| `substitute_submitting` | Admin clicks Apply override in substitute mode | Submit button pulse-dot + "Applying…"; tile group + reason field + cancel disabled. |
| `substitute_success` | 2xx on substitute | Toast.info("Override applied · attempt score recomputed to {value}") with the new `attempt_overall_score` from the response; drawer closes; queries invalidate. |
| `validation_errors` | zod fails OR backend 422 | `applyApiErrorToForm(err, form)` projects errors onto field paths. Tile-group field surfaces as a root error (since tiles are a single radio group). |
| `business_error` | 4xx with a business code (e.g. `REVIEW_ALREADY_RESOLVED`) | Pattern B toast surfaces the backend message; drawer stays open; admin can cancel or retry. |
| `error_boundary` | List query throws (non-404 5xx / network) | Pattern C boundary card mounts via `(admin)/grade-reviews/error.tsx`. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Admin lands on /admin/grade-reviews with no params
  Given an admin opens /admin/grade-reviews
  And no ?verdict query param is present
  When the page mounts
  Then the URL replaces to /admin/grade-reviews?verdict=flagged
  And GET /v1/admin/grade-reviews/flagged fires
  And the first row in the response is auto-selected
  And the URL replaces to /admin/grade-reviews?verdict=flagged&selected={first_id}
```

```gherkin
Scenario: Deep-link from ops landing
  Given an admin clicks a preview row on /admin/ops with grade_review_id=abc
  When the router pushes /admin/grade-reviews?selected=abc
  Then the QueueList renders with row abc selected
  And the DetailPane renders abc's full detail
  And the drawer is closed
```

```gherkin
Scenario: Admin keeps AI grade
  Given a flagged grade-review row is selected
  And the override drawer is open
  When the admin clicks "Keep AI grade"
  Then POST /v1/admin/grade-reviews/{id}/resolve fires with {action: 'keep_ai'}
  And on 200 the drawer closes
  And toast.info("Override applied") renders
  And adminKeys.gradeReviews.flagged() is invalidated
  And the QueueList refetches without the resolved row
```

```gherkin
Scenario: Admin accepts the reviewer's verdict
  Given a flagged grade-review row is selected
  When the admin clicks "Accept reviewer's verdict"
  Then POST /.../resolve fires with {action: 'accept_reviewer'}
  And on 200 the toast notes "Score updated to 0.0" (the reviewer-accept path zeroes the Grade per AC-D19 v1.6)
```

```gherkin
Scenario: Admin substitutes with verdict tile + reason
  Given the override drawer is open with no tile selected
  When the admin clicks the "Partial · 0.6" tile
  And types "Rubric overlooks the conservative interpretation" in the reason field
  And clicks "Apply override"
  Then POST /.../resolve fires with {action: 'substitute', score: 0.6, verdict: 'partial', reasoning: 'Rubric overlooks the conservative interpretation'}
  And on 200 the toast notes "Override applied · attempt score recomputed to {value}"
```

```gherkin
Scenario: Substitute without tile selection is blocked
  Given the override drawer is open
  When the admin clicks "Apply override" with no tile selected
  Then zod surfaces a root error "Pick a verdict to substitute"
  And no network call is fired
```

```gherkin
Scenario: Backend rejects substitute with 422
  Given the admin has selected a tile and typed a reason
  When POST /.../resolve returns 422 with detail [{loc: ['body', 'score'], msg: 'must be 0..1', ...}]
  Then applyApiErrorToForm projects the error onto the tile group
  And the drawer stays open
```

```gherkin
Scenario: Verdict filter switches between flagged and confirmed
  Given the queue shows flagged rows
  When the admin clicks the "Confirmed" segment
  Then URL replaces to /admin/grade-reviews?verdict=confirmed
  And GET /.../flagged refetches with verdict=confirmed query param (after §H (a) item 2 backend wiring lands)
  And the QueueList renders confirmed rows
```

```gherkin
Scenario: Empty flagged state
  Given GET /.../flagged returns {data: []}
  When the page mounts
  Then the QueueList renders "No flagged grades waiting"
  And the DetailPane renders a celebratory empty state
```

```gherkin
Scenario: Reconcile cron run from system page invalidates queue
  Given the admin is viewing /admin/grade-reviews
  When a coworker admin (or this admin in another tab) triggers POST /.../reconcile from /admin/system
  And the cron resolves 3 pending rows to confirmed + 1 to flagged
  Then the queue's cache is invalidated on next focus
  And the queue refetches with 1 new flagged row added
```

(Ten scenarios mapped to §D.2 grade-review integration tests.)

**7. Edge cases / gotchas**

- **The `accept_reviewer` action zeroes the Grade score per AC-D19 v1.6** (`app/schemas.py:733–735`). UX: the toast must communicate this explicitly ("Score updated to 0.0 / verdict 'none'") so the admin isn't surprised when the attempt overall score drops.
- **The `substitute` Pydantic validator is server-side authoritative** — even if the frontend zod allows a missing score, the backend will 422 if `action === 'substitute'` without `score` + `verdict`. Frontend zod mirrors the constraint for clean UX but isn't load-bearing.
- **Race: two admins resolve the same row simultaneously.** Second resolver gets 409 / business error. Spec body: surface as Pattern B toast "This review was already resolved — refreshing list"; invalidate cache; drawer closes.
- **Row sparseness fallback** — until the row-enrichment PR lands (§H (a) item 1), the `DetailPane` cannot show the question prompt, rubric extract, or testee response. v1 placeholder: render "—" with a `// TODO(FE-9-build): pending §H (a) row-enrichment` tag; the build session can lift the placeholder once the PR is on `main`.
- **URL state with `router.replace()` not `push`** — verdict filter changes + selected-id changes shouldn't accumulate history. Back button returns to whatever route preceded `/admin/grade-reviews`, not to each prior selection.
- **`?selected=` is independent of `?verdict=`.** A row may be selected from `flagged` view but if the verdict filter changes to `confirmed` and the selected row is no longer in the visible list, the `DetailPane` still renders the row (loaded via a separate `useQuery(adminKeys.gradeReviews.detail(id))` fallback if needed) — admin can navigate freely across filter states without losing focus.
- **Detail-pane data source.** The list endpoint already returns enriched rows (post §H (a) item 1); the `DetailPane` reads from the list payload's matching item. If the row isn't in the list (e.g. user deep-linked from ops with a row that's now confirmed), the pane fires a separate detail query. **§H (b) item 3: verify whether `GET /v1/admin/grade-reviews/{id}` exists as a single-row endpoint, or if the list endpoint with a filter is the only access path.**

**8. Visual reference**

- `frontend/design-reference/prototype/admin.jsx:169–308` — `AdminReview` (full split-detail + drawer layout).
- `frontend/design-reference/prototype/admin.jsx:255–277` — `VerdictTile` group (the 4 verdict tiles).
- Screenshot: **absent** — design-reference completeness gap (§E.1).

---

### B.3 Loop queue — `/admin/loops`

**1. Route segment + URL state**

- File: `frontend/src/app/(admin)/loops/page.tsx`. Segment + `error.tsx` boundary file are FE-9-introduced.
- URL state: `?status={review|queued|step-down|material-served|closed|all}` (default `review` — only actionable rows by default). Status change calls `router.replace()` per FE-3 §C.7.
- Modal state: ephemeral `useState`, not URL.
- Static `<title>Loops · Acumen</title>`.
- Nav-rail anchor: `shell.jsx:15` declares the admin nav id as `loop` with label "Loops". (Note: singular `loop`, not `loops` — verify `shell.jsx:15` declares this exact id; if the design uses plural elsewhere, surface in §H (b).)

**2. Components**

- **Scaffold reused:** same as §B.2 §2.
- **New in this PR:**
  - `LoopQueuePage` — top-level page. Renders `PageHeader` (eyebrow "AC-D6 · adaptive learning loops · 2 modes per test" + serif-italic title "Active loops.") + segmented `?status=` filter + `LoopTable` + (conditional) `ApproveModal` / `RejectModal`.
  - `LoopTable` — table per `admin-ops.jsx:71–97`. Columns: Testee, Pill, Mode (`autonomous` / `admin-reviewed` `Pill` badge), Iteration (`"1 of 1"`, `"2 of ∞"`), Last attempt (relative), Status (`review` / `queued` / `step-down` / `material-served` / `closed` `Pill` badges), Actions (Approve + Reject buttons rendered ONLY when status is `review` and mode is `admin-reviewed`).
  - `LoopRow` — single row per `admin-ops.jsx:99–126`. Renders columns + contextual action buttons. **All fields depend on row enrichment** — see §H (a).
  - `ApproveModal` — modal per `admin-ops.jsx:128–155`. Header: "Approve the {pill_band} follow-up for {testee_name}?". Body: 1-line summary of the proposed follow-up + optional notes textarea (NOT REQUIRED for v1 — spec note: notes deferred since the backend's `LoopApproveResult` doesn't accept notes; verify in §H (b)). Footer: Cancel + "Approve" button. **Simplification from design:** v1 omits the optional notes field because backend `POST /v1/admin/loop/queue/{id}/approve` has empty body per `app/routers/admin.py:161–175`. If notes are needed, surface as §H (a) item.
  - `RejectModal` — modal per `admin-ops.jsx:157–203`. Header: "Reject the {pill_band} follow-up for {testee_name}?". Body: required reason textarea ("This explains the rejection for audit purposes" — v1 stores the reason in the audit log via the backend's `loop.queue.reject` audit row per `app/routers/admin.py:237–238`). **§H (b) item 4: verify backend reject endpoint accepts a `{reason: string}` body — currently `LoopRejectResult` has empty input.** If absent, surface as §H (a) sub-item or descope reason to frontend-only state.
  - Reuses `Modal` + `ModalActions` primitive from FE-8 §C.5 (`frontend/src/components/admin/modal.tsx`).
- **shadcn primitives installed:** none beyond FE-2 + FE-8.
- **Design primitives reused:** `Pill` (mode + status badges), `PageHeader`, `.tbl`, `.btn`, `.btn.btn-primary`, `.btn.btn-ghost`, `.eyebrow`, `.h-display`, `.mono`, `.right`, `.muted` per FE-2 / AC-CD23.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/admin/loop/queue` | List WeaknessReport rows awaiting admin review (loop_mode=admin_reviewed). Oldest-first. Consumed by `LoopTable`. `staleTime: 30_000`. | **Exists** at `app/routers/admin.py:148–158`. Returns `LoopQueueListResponse` per `app/schemas.py:775–793`. **Sparse row payload — §H (a) item 1 adds testee_name / loop_mode (mode column for autonomous vs admin-reviewed) / iteration / last_attempt_at / status enum.** **Today only returns admin-reviewed rows** — the `autonomous` rows are progressing automatically and not in the queue. **§H (b) item 5: design shows mixed autonomous + admin-reviewed rows (`admin-ops.jsx:71–96`). Either (a) the queue is split between two filter modes (current default `review` shows admin-reviewed only; `all` shows both), OR (b) backend returns a queue with both and FE filters. Spec body assumes (a) and locks two endpoints; if backend can't return autonomous rows without a new endpoint, surface as §H (a).** |
| `POST /v1/admin/loop/queue/{weakness_report_id}/approve` | Approve a queued weakness-report → creates follow-up Tests + Assignments + per_testee Attempt. Returns `LoopApproveResult` with `follow_up_count`. Empty body. | **Exists** at `app/routers/admin.py:161–175`. Returns `LoopApproveResult` per `app/schemas.py:796–803`. |
| `POST /v1/admin/loop/queue/{weakness_report_id}/reject` | Reject a queued report — clears `routed_to_admin` flag without creating a follow-up. Empty body in current backend (audit-logs the admin actor only — no reason captured). Returns `LoopRejectResult`. | **Exists** at `app/routers/admin.py:231–242`. Returns `LoopRejectResult` per `app/schemas.py:806–811`. **§H (b) item 4 — verify whether the endpoint accepts `{reason}` or if reason capture requires a backend amendment.** |

**Locked frontend behaviour** (spec body — pending §H (a) / (b) resolutions):

- v1 ships approve modal with NO notes field; reject modal with reason captured CLIENT-SIDE only (logged via an audit-log call OR included in the reject body if backend supports it post-§H (b) item 4).
- v1 ships the `?status=` filter as CLIENT-SIDE filtering on the response (since the backend doesn't accept the param). If the list grows past ~50 actionable rows the build session adds the backend query param via a small enrichment.

**4. Form fields + zod + rhf**

Approve modal has no form fields — bare mutation:

```ts
const approveMutation = useMutation({
  mutationFn: (reportId: string) =>
    unwrap(client.POST("/v1/admin/loop/queue/{weakness_report_id}/approve", {
      params: { path: { weakness_report_id: reportId } },
    })),
  onSuccess: (result) => {
    queryClient.invalidateQueries({ queryKey: adminKeys.loops.queue() });
    queryClient.invalidateQueries({ queryKey: adminKeys.ops.overview() });
    toast.info(`Follow-up approved · ${result.follow_up_count} attempt${result.follow_up_count !== 1 ? 's' : ''} created`);
  },
  onError: (err) => toast.error(err.message || "Couldn't approve follow-up"),
});
```

Reject modal uses rhf for the reason textarea:

```ts
const rejectSchema = z.object({
  reason: z.string().min(1, "Reason is required for audit.").max(1000),
});

const form = useForm<z.infer<typeof rejectSchema>>({
  resolver: zodResolver(rejectSchema),
  mode: "onSubmit",
});

const rejectMutation = useMutation({
  mutationFn: (input: { reportId: string; reason: string }) =>
    unwrap(client.POST("/v1/admin/loop/queue/{weakness_report_id}/reject", {
      params: { path: { weakness_report_id: input.reportId } },
      // body: { reason: input.reason },  // wire only if §H (b) item 4 confirms body acceptance
    })),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: adminKeys.loops.queue() });
    queryClient.invalidateQueries({ queryKey: adminKeys.ops.overview() });
    toast.info("Follow-up rejected");
  },
  onError: (err) => applyApiErrorToForm(err, form),
});
```

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `table_loading` | Initial query in-flight | Table renders 6 row skeletons. |
| `table_empty_review` | Response `data: []` with `?status=review` (default) | Empty state: "No loops waiting for your review — autonomous loops are self-progressing." |
| `table_empty_other` | Response `data: []` with other filter | Empty state appropriate to status (e.g. "No closed loops on the current window"). |
| `table_happy` | Rows render | Table populated; actionable rows render Approve + Reject buttons in last column. |
| `filter_status_changed` | Admin clicks segmented `?status=` button | URL replaces; client-side filter applies (until backend wiring lands per §H (a) item 5). |
| `approve_modal_open` | Admin clicks Approve on a row | `ApproveModal` mounts. |
| `approve_submitting` | Admin clicks Approve in modal | Button pulse-dot + "Approving…"; cancel disabled. |
| `approve_success` | 2xx | Modal closes; toast confirms; row disappears from `?status=review` view; queue invalidates. |
| `reject_modal_open` | Admin clicks Reject on a row | `RejectModal` mounts; reason field pristine. |
| `reject_validation` | Admin submits with empty reason | zod surfaces "Reason is required for audit." under the field. |
| `reject_submitting` | Admin submits valid reason | Button pulse-dot + "Rejecting…". |
| `reject_success` | 2xx | Modal closes; toast confirms; row disappears; queue invalidates. |
| `mutation_error` | 4xx / 5xx on approve or reject | Pattern B error toast (approve) OR `applyApiErrorToForm` (reject — applies to form for non-field errors → root). |
| `error_boundary` | List query throws | Pattern C boundary via `(admin)/loops/error.tsx`. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Admin lands on /admin/loops with default filter
  Given an admin opens /admin/loops
  And no ?status query param is present
  When the page mounts
  Then the URL replaces to /admin/loops?status=review
  And GET /v1/admin/loop/queue fires
  And only rows with status=review render
```

```gherkin
Scenario: Admin approves a queued follow-up
  Given an actionable row is visible (status=review, mode=admin-reviewed)
  When the admin clicks "Approve"
  Then ApproveModal mounts with "Approve the D4 follow-up for {testee_name}?" header
  When the admin clicks Approve in the modal
  Then POST /v1/admin/loop/queue/{id}/approve fires with empty body
  And on 201 the modal closes
  And toast.info("Follow-up approved · 2 attempts created") renders (with the follow_up_count from the response)
  And the row disappears from the view
  And the queue and ops landing are invalidated
```

```gherkin
Scenario: Admin rejects with reason
  Given an actionable row
  When the admin clicks "Reject"
  Then RejectModal mounts with required reason field
  When the admin types "Pill scoring threshold off for this testee — retest in 2 weeks instead"
  And clicks Reject
  Then POST /v1/admin/loop/queue/{id}/reject fires
  And on 201 toast.info("Follow-up rejected") renders
  And the row disappears
```

```gherkin
Scenario: Reject with empty reason blocked
  Given the reject modal is open
  When the admin clicks Reject without typing a reason
  Then zod surfaces "Reason is required for audit."
  And no network call is fired
```

```gherkin
Scenario: Mode column distinguishes autonomous vs admin-reviewed
  Given the queue has 4 admin-reviewed rows and 2 autonomous rows (post §H (a) item 5)
  When the admin switches filter to ?status=all
  Then all 6 rows render
  And the Mode column shows "Admin · review" Pill for the 4 admin-reviewed rows
  And "Autonomous" Pill for the 2 autonomous rows
  And only the 4 admin-reviewed rows show Approve + Reject buttons
```

```gherkin
Scenario: Approve fails — error toast
  Given an actionable row
  When POST /.../approve throws 500
  Then a Pattern B error toast renders with the backend message
  And the modal stays open
  And the row remains in queued state
```

```gherkin
Scenario: Race — row resolved by another admin
  Given the admin opens the Approve modal for row X
  When POST /.../approve returns 409 LOOP_ALREADY_RESOLVED
  Then a Pattern B toast surfaces "This loop was already resolved — refreshing list"
  And the modal closes
  And the queue refetches
```

```gherkin
Scenario: Empty queue
  Given GET /v1/admin/loop/queue returns {data: []}
  When the page mounts with ?status=review
  Then the empty state "No loops waiting for your review — autonomous loops are self-progressing." renders
```

(Eight scenarios mapped to §D.2 loop-queue integration tests.)

**7. Edge cases / gotchas**

- **Mode column depends on row enrichment.** Until `LoopQueueItem` gains a `loop_mode` field (§H (a) item 1), the column renders "—" with a placeholder tag.
- **Iteration "1 of 1" / "2 of ∞"** — design uses ∞ to indicate uncapped iterations. Frontend renders ∞ when `loop_iteration_cap` is null on the parent test; finite when set. **§H (b) item 6: verify backend exposes the loop_iteration_cap field on the enriched row.**
- **Status enum mismatch risk.** Design enumerates `review` / `queued` / `step-down` / `material-served` / `closed`. Backend's `WeaknessReport` model has `routed_to_admin: bool` and derived states; the enum mapping is design-side, not necessarily a column. **§H (b) item 7: confirm the status field is derivable from `routed_to_admin` + downstream state, OR add a backend `status` derived field on the enriched row.**
- **Approve creates N follow-up Attempts** — one per weak pill in the report (`LoopApproveResult.follow_up_count` per `app/schemas.py:796–803`). Toast must communicate N to avoid surprise.
- **Reject reason capture is best-effort in v1.** If backend doesn't accept a reason body (§H (b) item 4), the frontend logs the reason locally / via an audit-log POST only — clarify with the build session.
- **Race condition** between two admins approving / rejecting the same row → second mutation gets 409. Pattern B toast + cache invalidate; modal closes.

**8. Visual reference**

- `frontend/design-reference/prototype/admin-ops.jsx:50–203` — `LoopActionsMock` (full v1 layout with row actions).
- `frontend/design-reference/prototype/admin-ops.jsx:99–126` — `LoopRow`.
- `frontend/design-reference/prototype/admin-ops.jsx:128–155` — `ApproveModal`.
- `frontend/design-reference/prototype/admin-ops.jsx:157–203` — `RejectModal`.
- Screenshot: `frontend/design-reference/screenshots/v6-fe9-23-loop-actions.png`.

---

### B.4 Engagement — `/admin/engagement`

**1. Route segment + URL state**

- File: `frontend/src/app/(admin)/engagement/page.tsx`. Segment + `error.tsx` boundary file are FE-9-introduced.
- URL state: none in v1. No filter / search (deferred to v1.x — pending-engagement list is small at v1 scale).
- Static `<title>Engagement · Acumen</title>`.
- Nav-rail anchor: `shell.jsx:15` declares the admin nav id as `engagement` with label "Engagement" + badge with overdue count.

**2. Components**

- **Scaffold reused:** same as §B.2 §2 minus rhf (no forms).
- **New in this PR:**
  - `EngagementPage` — top-level page. Renders `PageHeader` (eyebrow "AC-D26 · derived engagement_status · 7-day default threshold" + serif-italic title "Who's not engaging.") + sweep section + pending list.
  - `SweepSection` — card containing `SweepButton` + last-run timestamp ("Last swept N hours ago" — derived from query result OR a separate metadata field; spec note: backend's `SweepResult` doesn't currently include `last_run_at`, so v1 derives from local state — see §H (b) item 8). Reason for surfacing here: design's sweep affordance is the primary admin action on this page.
  - `SweepButton` — state-machine button. **CANONICAL DEFINITION for FE-9** — extracted to `frontend/src/components/admin/sweep-button.tsx` and reused by sibling file's calibration run + drive ingest + safety-links check + realism aggregate cards. States: `idle` (CTA enabled), `running` (pulse-dot + label flips to "Sweeping…", button disabled), `done` (check icon for 1500ms, then resets to idle). On error → reverts to idle + Pattern B toast. See §C.4 for the full primitive spec.
  - `PendingList` — table per `admin.jsx:325–352`. Columns (post §H (a) item 1): Testee, Assignment (pill or test name), Assigner, Days stale, Reminders sent (`R0` / `R1` / `R2` Pill badges), Escalated (badge if true). NO action column in v1 per `FE_ROADMAP.md:188` + `admin-ops.jsx:277–284` v5-removal callout.
  - `SweepSuccessToast` — Pattern B toast variant: "Swept N stale assignments · M first reminders · K second reminders · L escalated" composing from `SweepResult`. Note: current `SweepResult` is `{reminders_sent, escalations_sent}` only per `app/schemas.py:593–595`; the more granular fields require §H (a) item 1 enrichment. Until then, toast surfaces the two available counts.
- **shadcn primitives installed:** none beyond FE-2 + FE-8.
- **Design primitives reused:** `Pill` (reminder badges + escalated badge), `PageHeader`, `.tbl`, `.btn`, `.btn.btn-primary` per FE-2 / AC-CD23.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/admin/engagement/pending` | List pending mandatory assignments past stale threshold. Consumed by `PendingList`. `staleTime: 30_000`. | **Exists** at `app/routers/admin.py:80–86`. Returns `EngagementWidgetResponse` per `app/schemas.py:589–590`. **Sparse row payload — §H (a) item 1 adds testee_name / pill_or_test_name / assigner_name / days_stale / reminders_sent / escalated.** |
| `POST /v1/admin/engagement/sweep` | Run engagement sweep on-demand. Returns `SweepResult` `{reminders_sent, escalations_sent}` per `app/schemas.py:593–595`. **Sparse result — design wants first_reminders / second_reminders / escalated / duration_ms / tokens_used; §H (a) item 1 also enriches this.** | **Exists** at `app/routers/admin.py:70–77`. |

**4. Form fields + zod + rhf**

n/a — no forms. Sweep is a bare mutation, list is a bare query.

```ts
const sweepMutation = useMutation({
  mutationFn: () => unwrap(client.POST("/v1/admin/engagement/sweep")),
  onSuccess: (result) => {
    queryClient.invalidateQueries({ queryKey: adminKeys.engagement.pending() });
    queryClient.invalidateQueries({ queryKey: adminKeys.ops.overview() });
    toast.info(
      `Swept · ${result.reminders_sent} reminder${result.reminders_sent !== 1 ? 's' : ''} sent · ` +
      `${result.escalations_sent} escalation${result.escalations_sent !== 1 ? 's' : ''} sent`
    );
  },
  onError: (err) => toast.error(err.message || "Couldn't run sweep — try again"),
});
```

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `list_loading` | Initial query in-flight | Table renders 6 row skeletons. |
| `list_empty` | Response `data: []` | Empty state with checkmark icon: "All caught up — no stale mandatory assignments past the 7-day threshold." (threshold value sourced from system settings if exposed, else literal "configured threshold" copy). |
| `list_happy` | Rows render | Table populated; no action column (per v1 scope). |
| `sweep_idle` | Default | `SweepButton` shows "Run sweep now" with primary styling. |
| `sweep_running` | Admin clicks Run sweep | Button: pulse-dot + "Sweeping…"; disabled. List rows may dim or stay stable (design shows stable). |
| `sweep_done` | 2xx on sweep | Button flashes check + "Done" for 1500ms, then resets to idle. `SweepSuccessToast` mounts with the counts. List refetches and may show fewer rows (assignments that completed-during-sweep or escalated). |
| `sweep_error` | 4xx / 5xx | Button reverts to idle; Pattern B error toast surfaces. |
| `error_boundary` | List query throws | Pattern C boundary via `(admin)/engagement/error.tsx`. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Admin lands on /admin/engagement
  Given an admin opens /admin/engagement
  When the page mounts
  Then GET /v1/admin/engagement/pending fires
  And the SweepSection renders with "Run sweep now" enabled
  And the PendingList renders rows (or empty state)
```

```gherkin
Scenario: Admin runs sweep — success
  Given pending rows are visible
  When the admin clicks "Run sweep now"
  Then SweepButton transitions to running state
  And POST /v1/admin/engagement/sweep fires
  And on 200 the button flashes check + "Done"
  And toast.info("Swept · 3 reminders sent · 1 escalation sent") renders (with values from SweepResult)
  And the PendingList refetches
```

```gherkin
Scenario: Admin runs sweep — error
  Given pending rows
  When POST /.../sweep returns 500
  Then SweepButton reverts to idle
  And Pattern B error toast renders
  And the PendingList is NOT invalidated
```

```gherkin
Scenario: No per-row actions in v1
  Given the PendingList has rows
  When the table renders
  Then there is NO action column on any row
  And there is NO Nudge or Reassign button
```

```gherkin
Scenario: Empty queue
  Given GET /.../pending returns {data: []}
  When the page mounts
  Then the empty state "All caught up — no stale mandatory assignments past the 7-day threshold." renders
  And the SweepButton is still enabled (admin can run sweep to verify state)
```

```gherkin
Scenario: Reminder badge per row
  Given a row has reminders_sent=2 and escalated=true (post §H (a) item 1)
  When the row renders
  Then a "R2" badge renders in the reminders column
  And an "Escalated" warn-Pill renders in the escalated column
```

(Six scenarios mapped to §D.2 engagement integration tests.)

**7. Edge cases / gotchas**

- **No per-row actions in v1** — design v5 had Nudge / Reassign; explicitly removed per `FE_ROADMAP.md:188` + design callout `admin-ops.jsx:277–284`. Build session must not re-introduce them. If a future user request asks for them, surface as v1.x spec-clarification PR.
- **Sweep toast counts** — current backend returns only `reminders_sent` + `escalations_sent`. Design wants richer summary (first / second reminders separated, escalation count, tokens used, duration). The row-enrichment PR (§H (a) item 1) folds this into `SweepResult`. Until landed, toast is the minimal two-count version.
- **`Last swept` derived timestamp** — design implies a "last run" indicator on the page. Backend doesn't expose this; v1 falls back to local `useState` ("Last swept by you N minutes ago" / no copy on initial mount). §H (b) item 8 verifies whether `AuditLog` has the timestamp accessible via a simple query.
- **Cron and admin trigger share same code path** — sweep cron fires every N (default per AC-D26 schedule); admin trigger runs the same body. The admin button surfaces the cron's results for the admin's local "I want to know now" need; doesn't disable the cron.
- **Sweep is idempotent at v1 scale** — if admin clicks twice quickly, second call processes only the assignments that escalated since the first call. No frontend debounce in v1 (button disabled during pending state suffices).

**8. Visual reference**

- `frontend/design-reference/prototype/admin.jsx:313–366` — `AdminEngagement` (v5 reference; Nudge/Reassign deprecated for v1).
- `frontend/design-reference/prototype/admin-ops.jsx:208–338` — `EngagementSweepMock` (v1 sweep-only layout).
- `frontend/design-reference/prototype/admin-ops.jsx:317–338` — `SweepButton` (state machine).
- `frontend/design-reference/prototype/admin-ops.jsx:288–312` — Toast notification.
- Screenshot: `frontend/design-reference/screenshots/v6-fe9-24-engagement-sweep.png`.

---

## C. Cross-page concerns

### C.1 `adminKeys` extensions — FE-9 ops key roots

**Extends `fe-specs/FE-8-admin-catalogue.md:1072–1149` `adminKeys` library unchanged; adds the FE-9-specific roots inline in the same `frontend/src/lib/queries/admin-keys.ts` file:**

```ts
// Appended to the adminKeys object declared in FE-8 §C.1:

  // FE-9 ops landing (synthetic key — composes 5 underlying queries)
  ops: {
    all: () => [...adminKeys.all, 'ops'] as const,
    overview: () => [...adminKeys.ops.all(), 'overview'] as const,
  },

  // FE-9 grade-review queue (B.2)
  gradeReviews: {
    all: () => [...adminKeys.all, 'gradeReviews'] as const,
    flagged: (filters?: { verdict?: 'flagged' | 'confirmed' | 'all' }) =>
      [...adminKeys.gradeReviews.all(), 'flagged', filters ?? {}] as const,
    detail: (gradeReviewId: string) =>
      [...adminKeys.gradeReviews.all(), 'detail', gradeReviewId] as const,
  },

  // FE-9 loop queue (B.3)
  loops: {
    all: () => [...adminKeys.all, 'loops'] as const,
    queue: (filters?: { status?: string }) =>
      [...adminKeys.loops.all(), 'queue', filters ?? {}] as const,
  },

  // FE-9 engagement (B.4)
  engagement: {
    all: () => [...adminKeys.all, 'engagement'] as const,
    pending: () => [...adminKeys.engagement.all(), 'pending'] as const,
  },
```

**Sibling-file additions** (declared in `fe-specs/FE-9-admin-systems.md` §C.1, referenced here for cache-sharing on the ops landing):

```ts
  cost: { all, summary }
  calibration: { all, anchors_flagged, sweep_result }
  system: { all, driveIndex, bootstrap_status, safety_links }
```

**Invalidation discipline** (mirrors FE-8 §C.1):
- Mutations on a single resource invalidate that resource's `all()` key.
- Cross-resource mutations also invalidate `adminKeys.ops.overview()` to refresh the landing on next visit (the synthetic key catches the landing's 5-query composition).
- Optimistic updates not used in v1.

### C.2 Override-drawer URL-state pattern

The grade-review queue's `?selected={grade_review_id}` URL state pattern is locked here as a **deep-linkable drawer-open primitive** reusable across admin surfaces:

- URL state syncs both the row-selection AND the drawer-open state (single source of truth).
- Cross-page nav: `/admin/ops` row click pushes to `/admin/grade-reviews?selected={id}`; the queue mounts with the drawer pre-opened.
- Closing the drawer: `router.replace('/admin/grade-reviews')` (drops the `?selected=` param).
- Implementation in `frontend/src/app/(admin)/grade-reviews/page.tsx` reads `useSearchParams().get('selected')` and conditionally renders the drawer; updates via `router.replace()` per FE-3 §C.7.

Future v1.x may apply the same pattern to other admin queues (loop / engagement) if drawer-style detail views land there.

### C.3 Modal + ModalActions primitives reused

The `Modal` + `ModalActions` primitive from FE-8 §C.5 (`frontend/src/components/admin/modal.tsx`) consumed unchanged by FE-9's Approve / Reject modals (§B.3). No new primitive added.

### C.4 `SweepButton` state-machine primitive — **canonical FE-9 definition**

Extracted to `frontend/src/components/admin/sweep-button.tsx`. **Consumed by sibling file** (`fe-specs/FE-9-admin-systems.md` §B.1 cost-refresh button if present, §B.2 calibration run, §B.3 four of five system-page op cards). Shape:

```ts
type SweepButtonProps = {
  label: string;                     // e.g. "Run sweep now" / "Run calibration" / "Ingest now"
  runningLabel?: string;             // e.g. "Sweeping…" (default: label + "ing…")
  variant?: "primary" | "secondary";
  onRun: () => Promise<void>;        // mutation function; throws on failure
  disabled?: boolean;
};
```

States internal to the component:
- `idle`: button enabled, shows `label`.
- `running`: button disabled, shows pulse-dot + `runningLabel`. Triggered by `onRun` invocation.
- `done`: button shows check icon + "Done" for 1500ms, then resets to `idle`. Triggered by `onRun` resolve.
- `error`: button reverts to `idle` (no error indicator on the button itself — caller surfaces error via toast). Triggered by `onRun` throw.

The component encapsulates its own `useState` for the three transient states; caller passes the mutation function. No external state synchronization needed.

### C.5 Pattern C boundary

Each FE-9 page adds an `error.tsx` boundary file per FE-1 §C.6: `(admin)/ops/error.tsx`, `(admin)/grade-reviews/error.tsx`, `(admin)/loops/error.tsx`, `(admin)/engagement/error.tsx`. Each uses FE-1's `BoundaryFrame` (wave icon + "Couldn't load X" + "Try again" + "Go to admin dashboard") with copy localised per page.

### C.6 Toasts (Pattern B reuse)

Sonner toast helper from FE-1 §C.3 reused unchanged. FE-9 calls:
- `toast.info(...)` — success (override applied, follow-up approved/rejected, sweep complete) — 3s auto-dismiss.
- `toast.error(...)` — non-field error (race conflicts, network failures) — 7s auto-dismiss.

No new toast severity tiers introduced.

---

## D. Test cases (Vitest)

Vitest config from FE-0 + MSW from FE-1 §D. Tests under `frontend/tests/` and `frontend/src/**/*.test.tsx`.

### D.1 Unit tests (lib + helpers)

- `frontend/src/lib/queries/admin-keys.test.ts` — extend FE-8's suite with snapshot tests for new FE-9 key roots (`ops`, `gradeReviews`, `loops`, `engagement`); assert prefix-match invalidation.
- `frontend/src/components/admin/sweep-button.test.tsx` — full state machine: idle → running → done → idle (auto-reset); idle → running → error → idle.
- `frontend/src/components/admin/verdict-tile.test.tsx` — controlled selection; keyboard activation; disabled state.

### D.2 Page integration tests

One test file per §B entry, using MSW handlers:

- `frontend/src/app/(admin)/ops/page.test.tsx` — §B.1 trios (7 scenarios).
- `frontend/src/app/(admin)/grade-reviews/page.test.tsx` — §B.2 trios (10 scenarios).
- `frontend/src/app/(admin)/loops/page.test.tsx` — §B.3 trios (8 scenarios).
- `frontend/src/app/(admin)/engagement/page.test.tsx` — §B.4 trios (6 scenarios).

Total: 31 ops-side integration scenarios.

### D.3 Round-trip integration test

`frontend/tests/integration/admin-ops-roundtrip.test.tsx`:
- Done-when in narrative form (ops slice): admin lands at `/admin/ops` → counters show 3 flagged grades / 4 stale engagements → clicks the top flagged-review preview row → `/admin/grade-reviews?selected={id}` mounts with the override drawer pre-opened → admin picks "Partial · 0.6" tile, types reason, submits → drawer closes + queue invalidates + landing counter decrements on next visit → admin navigates to `/admin/engagement` → runs sweep → success toast + landing counter decrements → admin navigates to `/admin/loops` → approves a queued report → follow-up created (return value carries count) → toast confirms.

Single test, exercises every page in this file.

### D.4 Coverage gate (FE_CHECKLIST.md FE-9 ops-side rows tick on)

- All §B Gherkin + D.3 round-trip green via `pnpm test --run`.
- `pnpm typecheck` clean.
- `pnpm lint` clean.
- `pnpm build` succeeds.

---

## E. Known placeholders (DO NOT SHIP AS-IS)

| # | Placeholder | Location | Action before production |
|---|---|---|---|
| 1 | **No screenshots for ops landing / grade-review queue.** Mock bodies exist at `admin.jsx:8–129` and `:169–308`; v6-fe9-* PNGs omitted from `frontend/design-reference/screenshots/`. | Implicit on §B.1 + §B.2 "Visual reference" entries. | **Design-reference completeness gap surfaced** per SESSION_START.md rule. Build session inherits the JSX mocks as authoritative; design-Claude session adds the 2 missing screenshots post-FE-9 when usability feedback is in. Tag the two surfaces with `// TODO(design-ref): screenshot pending`. |
| 2 | Sparse row data (testee names, pill names, assigner, days stale, reminders, etc.) rendered as "—" until §H (a) row-enrichment PR lands | `_components/queue-list.tsx`, `_components/loop-row.tsx`, `_components/pending-list.tsx`, `review-row-compact.tsx` | Tag each "—" cell with `// TODO(FE-9-build): pending §H (a) row-enrichment`. Once the backend PR is on `main`, build session removes the tags and renders the enriched fields. |
| 3 | Reject reason capture — if §H (b) item 4 reveals backend reject endpoint doesn't accept a body, reason is logged client-side only | `_components/reject-modal.tsx` | Either (a) folded into the row-enrichment backend PR scope (preferred), or (b) frontend logs reason via a separate `POST /v1/audit-logs` if such an endpoint exists, or (c) drop reason capture in v1 and defer to v1.x with a code TODO. Build session decides. |
| 4 | Daily-bars sparkline on the ops landing's CostSummaryCard — design implies it, sibling-file scope descopes the contract to v1.x | `_components/daily-bars.tsx` | Renders a grey-band placeholder sized to the design's footprint until backend ships `cost/summary.daily_history`. Tag with `// TODO(v1.x): daily history pending backend enrichment per FE-9-admin-systems.md §B.1`. |
| 5 | `Last swept` timestamp on engagement page — no backend field; v1 falls back to local state | `_components/sweep-section.tsx` | Either fold backend timestamp into row-enrichment PR scope (preferred), or use local `useState` initialised null and persist only the in-session "your last sweep" timestamp. |

---

## F. Scope additions beyond prior FE-N specs

### F.1 `FE_ROADMAP.md:188` alignment — engagement v1 ships sweep-only

`FE_ROADMAP.md:188` explicit: "engagement (sweep button + pending list, no per-row nudge in v1)". §B.4 honours this verbatim. The v5 design's Nudge / Reassign columns (`admin.jsx:356–357`) are explicitly out. Deferred to v1.x — no v1 spec amendment.

### F.2 `DECISIONS.md` AC-D19 alignment — three resolve actions only

AC-D19 v1.6 + `app/schemas.py:726–753` lock three resolve actions (`keep_ai` / `accept_reviewer` / `substitute`). No edit-then-approve / no free-form override / no AI re-grade trigger in v1. §B.2 honours verbatim; design's 4 verdict tiles map to the `substitute` action with locked (score, verdict) pairs per the table in §B.2 §3.

### F.3 No new `CODE_SPEC.md` AC-CD-structural additions

FE-9 ops side ships with **zero new runtime deps**. All primitives (`Sheet`, `Modal`, etc.) inherited from FE-2 + FE-8's installed sets. The `SweepButton` and `VerdictTile` extractions are local components, not library installs. Confirmed at plan time.

### F.4 Sibling-file scope boundary

`fe-specs/FE-9-admin-systems.md` owns cost dashboard (`/admin/cost`), anchor calibration (`/admin/calibration`), system page (`/admin/system`). This file references those routes for navigation (e.g. ops landing's "View cost dashboard →" CTA → `/admin/cost`) but ships no consumer for them. The sibling file owns the implementation of those pages.

---

## G. Template propagation — FE-9 is the LAST detail spec

The 8-section per-page template (Context → A inventory → B per-page → C cross-page → D tests → E placeholders → F scope-bleed → G propagation → H drift) is the **template established by FE-1 and propagated through FE-2..FE-8 into FE-9**. After FE-9 lands, the FE-N detail-spec arc closes; the build phase opens against locked detail specs for all nine FE-N phases.

No further template propagation downstream — there is no FE-10. Any post-v1 frontend work (v1.x deferred items per `FE_ROADMAP.md` non-goals) opens fresh planning against new requirements.

**FE-9 ops-side variances declared** (from the FE-1 §G + FE-8 §G allowed-variance lists):

1. **Two-file split** (this file + `fe-specs/FE-9-admin-systems.md`) per the FE-1:747 escape clause. Two-file split (vs FE-8's three-file split or FE-1:747's four-file example) chosen on domain boundary — the four queue-driven adjudication surfaces share row-enrichment dependencies and the `adminKeys.ops.overview()` invalidation surface; the three system-state surfaces share the sweep-button primitive and the cron-trigger pattern. User-locked at plan time.
2. **Sibling-file §C reuse pattern.** This file declares `adminKeys.{ops,gradeReviews,loops,engagement}` canonically in §C.1; the sibling adds `adminKeys.{cost,calibration,system}` in its §C.1 against the same library file. Sibling-file consumption phrase: every consumer block in the sibling opens with "consumes from `fe-specs/FE-9-admin-ops.md` §C.1 + this file's §C.1 unchanged" so grep can audit.
3. **`SweepButton` primitive canonical here, consumed by sibling.** Defined in §C.4 of this file; the sibling cites this section by reference and uses the component verbatim across four cron-trigger surfaces.
4. **No cursor pagination** for FE-9 endpoints. The four ops endpoints return flat lists; cursor pagination not needed at v1 scale. Departs from FE-3's pattern (which FE-8 inherits); justification in §0 ("FE-3 cursor pagination — NOT used in FE-9"). Surfaced explicitly in §H (c).

Per-phase variances expected and ALLOWED inherited from FE-1:745 + FE-8 §G:
- Multi-file split (this file is the second concrete instance after FE-8).

Per-phase variances NOT allowed without spec-drift surface:
- Skipping Gherkin acceptance criteria. Every state must have a trio.
- Skipping drift-watch / verification / blocker callouts.
- Folding test list into per-page sections.

---

## H. Spec-drift roll-up (post-review classification)

The cross-walk surfaced 14 candidate items (8 in this file + 6 in the sibling). After review, classified into three groups. **This file's H block covers items numbered 1–7; the sibling file's H block covers 8–14 (continuous numbering across the FE-9 split for cross-reference clarity).**

### (a) BLOCKERS for the FE-9 build session — must land before the build session opens

1. **Backend row-enrichment sweep PR.** A single user-authored backend PR enriching four sparse list-row payloads in one atomic change. Locks the following contracts in the spec body:
   - `EngagementWidgetItem` (`app/schemas.py:581–587`) gains: `testee_name: str`, `pill_or_test_name: str`, `assigner_name: str`, `days_stale: int` (derived), `reminders_sent: int` (count from `Assignment.reminder_history`), `escalated: bool` (true iff `Assignment.escalation_sent_at IS NOT NULL`).
   - `SweepResult` (`app/schemas.py:593–595`) gains: `first_reminders_sent: int`, `second_reminders_sent: int`, `escalations_sent: int` (already present), `assignments_processed: int`, `duration_ms: int`, optionally `last_swept_at: datetime`.
   - `FlaggedGradeReviewItem` (`app/schemas.py:705–719`) gains: `testee_name: str`, `pill_name: str`, `question_prompt: str` (truncated 240 chars), `rubric_extract: str` (truncated 200 chars), `testee_response: str` (truncated 600 chars), `band: int` (for header), already has `attempt_id`. **Also adds `?verdict=flagged|confirmed|all` query param** to `GET /v1/admin/grade-reviews/flagged` so the queue can filter (currently flagged-only).
   - `LoopQueueItem` (`app/schemas.py:775–789`) gains: `testee_name: str`, `loop_mode: 'autonomous' \| 'admin_reviewed'`, `iteration: str` (e.g. `"1 of 1"`, `"2 of ∞"`), `last_attempt_at: datetime`, `status: 'review' \| 'queued' \| 'step-down' \| 'material-served' \| 'closed'` (derived per WeaknessReport state). **Also adds optional `?status={enum}` query param** to `GET /v1/admin/loop/queue` for server-side filtering.
   - `LoopRejectResult` (`app/schemas.py:806–811`) optionally accepts a `{reason: string}` body on the request side so reject reason is captured in the audit log (sub-item folded here; can spin out if backend prefers).
   - `FlaggedAnchorItem` (`app/schemas.py:634–648`) gains: `pill_name: str` (for the per-pill grouping in the sibling file's calibration drift chart).
   - Sibling-file gets: same atomic PR also adds `GET /v1/admin/realism/status` (sibling §H (a) item 8) — separate endpoint though related; user may bundle or split.

   **The FE-9 build session cannot open until this PR is on `main`** — the queue rows can't render without these fields.

2. **(folded into item 1)** The `?verdict=` filter wiring on `GET /v1/admin/grade-reviews/flagged` — spec body assumes this lands in the same row-enrichment PR. If split out, surface as a separate §H (a) item; otherwise the bundle holds.

### (b) BUILD-SESSION VERIFICATION TASKS — front-loaded at the start of the FE-9 build session

The build session opens with a verification step before any code lands: read the FastAPI handlers + schemas cited below, confirm the assumptions match reality. If any diverge, halt and surface for spec-clarification PR.

3. **`GET /v1/admin/grade-reviews/{id}` single-row endpoint.** Spec body assumes the list payload suffices for the `DetailPane`. Verify whether a single-row read endpoint exists; if absent, `DetailPane` derives from list-payload item by `find()`.
4. **`POST /v1/admin/loop/queue/{id}/reject` body acceptance.** Verify whether the endpoint accepts a `{reason}` body (covered by §H (a) item 1 sub-item but worth verifying explicitly). If the body is rejected with 422, reason is captured client-side only via a separate audit-log POST or dropped to v1.x.
5. **Loop queue's autonomous vs admin-reviewed split.** Verify whether `GET /v1/admin/loop/queue` returns both modes' rows or only admin-reviewed. Spec body assumes mixed-mode return post §H (a) item 1; if backend only returns admin-reviewed, the `?status=all` filter is meaningless and the mode column always shows admin-reviewed.
6. **Loop iteration cap field.** Verify whether `LoopQueueItem` (post-enrichment) exposes the iteration cap (e.g. `"2 of ∞"` vs `"2 of 3"`). If not, the iteration cell renders `"{n}"` without the "of X" suffix; spec body locks the design's full-format string as the target.
7. **Status enum mapping for loop rows.** Verify the 5-value status enum (`review` / `queued` / `step-down` / `material-served` / `closed`) is derivable from `WeaknessReport`'s state columns. If the mapping is non-trivial, the row-enrichment PR adds a derived `status` field; otherwise frontend computes it client-side from `routed_to_admin` + downstream state.

### (c) APPROVED RESOLUTIONS — folded into FE-9 build PR scope, captured in the build PR's handover

These are not blockers. The spec body locks the resolution; the build session implements; the build PR's handover records them under the SESSION_START.md AC-CD-structural-additions carve-out.

8. **Two-file split** (ops + systems) — user-locked at plan time per `/root/.claude/plans/fresh-session-fe-9-bubbly-reef.md`.
9. **No cursor pagination in FE-9** — list endpoints return flat `{data: [...]}` not `Page_T_`; design's small queue sizes don't need pagination at v1. Departs from FE-3's pattern; documented in §0 and §G.
10. **`adminKeys.ops.overview()` synthetic invalidation key** — no real endpoint; the key catches the landing's 5-query composition for cross-resource mutation invalidation.
11. **Override-drawer `?selected={id}` URL state pattern** — locked in §C.2 as a deep-linkable drawer-open primitive.
12. **`SweepButton` primitive canonical in this file** (§C.4), consumed by sibling file's four cron-trigger surfaces.
13. **Ops landing composes 5 parallel queries client-side** — no `/v1/admin/ops/overview` endpoint; user-locked at plan time.
14. **AC-D19 three resolve actions only** (`keep_ai` / `accept_reviewer` / `substitute`) — no edit-then-approve; design tiles map to `substitute` per the table in §B.2 §3.

---

*End of FE-9-admin-ops.md. Sibling spec: `fe-specs/FE-9-admin-systems.md`. **FE-9 is the LAST detail spec** — no template propagation downstream; the build phase opens against locked detail specs for FE-1..FE-9 once this PR merges.*
