# FE-6 — Results + adaptive loop + grade-review surface (detail spec)

> **Status:** plan-mode authored, ready for build session (subject to §H (a) blockers — provisional count 1–4 depending on build-session verification outcomes for the per-Q grade-review payload, the per-pill calibration payload, the adaptive-loop payload, and the realism-flag surface on `AttemptView`).
> **Owns:** the testee results page — `(testee)/attempts/[attemptId]/result/page.tsx` — including hero stats + review-status banner, by-pill weakness card, by-question grade card with per-Q AI-review chip, cross-family transparency block, adaptive loop card, realism aggregate card, PDF export multi-state download button + toast. Replaces the FE-4 placeholder created at `fe-specs/FE-4-runner.md:682` (`FE-4 → FE-6 results route`).
> **PR target:** `PR-NNN-fe6-results` (one squash PR closes the build phase per FE_ROADMAP discipline). **This doc PR is its own slice** (current session).
> **Anchors:** AC-D6 (adaptive loop step semantics — weak-pill identification → learning material → follow-up generation), AC-D9 (`competence_estimate` float + band display + null = "no data yet"), AC-D19 (cross-family review verdict — per-Q `confirmed`/`flagged`/`pending` + 60-s ceiling + reconcile-cron fail-soft path locked at v1.7), AC-D20 (calibration confidence `preliminary→confident` at threshold — surfaced in by-pill weakness card), AC-D21 (safety-tagged pills → external link sets instead of AI explainers, threaded through the adaptive loop card CTAs), AC-D22 (per-question realism flag idempotent on `(question, testee)` — aggregate consumed from `AttemptView`), AC-CD6 (uniform error envelope + Blob URL PDF export pattern), AC-CD18 (model IDs are env defaults — the transparency block surfaces what the backend returns, never hardcoded), AC-CD19 (FE stack lock), AC-CD20 (routing + role guards — results page is `(testee)`-only, no admin variant in FE-6 scope), AC-CD21 (TanStack Query + react-hook-form + error envelope — `attemptQueryKeys.result(id)` consumed at the page-level with `refetchInterval` policy), AC-CD24 (image-field typed stubs, render `null` in v1).
>
> This is the **sixth per-page FE detail spec.** Template inheritance: per-page §B from `fe-specs/FE-1-auth.md` (verbatim — eight-point template per page); FE-4's `attemptQueryKeys` library is consumed unchanged; the page-level `useQuery` extends call-site options (`refetchInterval`, `refetchOnWindowFocus`) per AC-CD21. Deviating from the template in FE-7+ is itself spec drift.

---

## 0. Context

FE-0 (PR-032) shipped the Next.js 15 / App Router scaffold, the typed `openapi-fetch` client with `unwrap()`, the auth context (memory access + localStorage refresh + 401 dedup-retry), the OpenAPI codegen pipeline. PR-033 locked AC-CD20..24. FE-1..FE-5 **spec-merged** the auth surface, the shell + design tokens, the testee catalogue/dashboard, the non-streaming attempt runner, and the per-Testee streaming runner. None of FE-1..FE-5 are *built* yet; FE-6 presumes their builds land in roadmap order before the FE-6 build session opens (§H (a) item 1).

**FE-4 spec preconditions FE-6 extends, not replaces** (the foundation FE-6 builds against — quote and cite, do not re-decide):

- `GET /v1/attempts/{attempt_id}/result` returns `{ status: "review_pending" | "complete", overall_score, outcome, questions[].grade }` once complete (FE-4 §B.1 §3 endpoint table at `fe-specs/FE-4-runner.md:143`). FE-6 page is the destination FE-4's `GradingOverlay` polls *into*.
- `attemptQueryKeys.result(id)` polling cache key lives at `frontend/src/lib/queries/attempts.ts` (FE-4 §C.5 at `fe-specs/FE-4-runner.md:651–656`). FE-6 consumes the key unchanged; the polling cadence (`refetchInterval: 5000`, `refetchOnWindowFocus: true` while `status === "review_pending"`) lives at the page-level `useQuery` call-site per AC-CD21, not in the key library.
- `frontend/src/lib/attempts/answer-payloads.ts` discriminated union (FE-4 §F.5; referenced from FE-4 §C — "*Reused by FE-6 results page to render per-question grade rows*" at `fe-specs/FE-4-runner.md:637`). FE-6's `ByQuestionCard` consumes it to format scenario / short-answer / matching display.
- FE-4 `GradingOverlay` (`fe-specs/FE-4-runner.md:119`) dismisses on `result.status === "complete"` and pushes the router to `/attempts/[attemptId]/result`; the file FE-6 builds out exists today as the FE-4-shipped placeholder ("FE-6 pending" copy) per `fe-specs/FE-4-runner.md:682`.
- FE-2 primitives are reused unchanged: `BandTag` (`frontend/design-reference/prototype/shell.jsx:127–138`), `Pill` (`shell.jsx:149–151`), `Stat` (`shell.jsx:117–124`), `PageHeader` (`shell.jsx:103–113`). Pulse-dot animation in the review banner uses the same FE-2 tokens as FE-4's autosave indicator (no new keyframes).
- `applyApiErrorToForm` (FE-1 §C.2) is not used — the results page is read-only. Patterns A / B / C from FE-1 §C apply: Pattern A inline error is unused; Pattern B (Sonner toast) wraps the PDF export success/error messages; Pattern C (boundary card) catches initial fetch failures at `(testee)/attempts/[attemptId]/result/error.tsx`.

**Done-when (verbatim from `FE_ROADMAP.md:128–131`):** submitted attempt → result page renders → AI-graded responses show "under review" until the reconcile cron resolves them → loop card surfaces follow-up CTAs that route to learning material or re-test entry point.

**Scope boundary — what FE-6 explicitly does NOT ship:**

- **Admin results view / admin grade-review queue.** FE-9 territory per `FE_ROADMAP.md:156+`. The AC-D19 reconcile-cron admin-flag adjudication UI (`GET /v1/admin/grade-reviews/flagged` + accept/override actions) lives in the admin surface; FE-6's testee page surfaces only that "admin will check this" hint per the flagged chip in B.4 and the transparency-block sub-line in B.6. Admin role hitting `/attempts/[attemptId]/result` gets the AC-CD20 `/403` layout-guard redirect (FE-1 §C.4 five-posture matrix locked).
- **Constellation visualisation / competency profile.** FE-7 territory (`FE_ROADMAP.md:137–154`). The results page links to weak-pill detail pages (FE-3 territory), not to the constellation overview.
- **In-question image rendering.** AC-CD24 — typed stubs return `null` in v1; per-question expand row threads images through FE-2 primitives but never renders them.
- **Learning material rendering** (the explainer text body itself). Adaptive loop card CTAs **route** to FE-3 pill detail or (when Learning Center v1.x lands) to a dedicated explainer route per AC-D8 / AC-D21; FE-6 owns the CTA list and the queued-step state, not the explainer page body. Learning Center v1.x deferral per FE-1 §F.1 stands.
- **Re-test entry-point execution.** "Re-test in N days" CTA surfaces the queued status and routes to FE-3 pill detail "Practice now"; the actual generation kick-off is FE-3 territory once LD3 (pill→test resolver) lands. Inherited blocker from FE-3 §H (b) / FE-4 §H (a).
- **`POST` to mutate the result page itself.** Result page is strictly read-only. The only mutations are (a) PDF export (B.7) and (b) anchor-link navigation; no form submission, no realism-flagging from this page (that lives in FE-4 during the attempt).

**Additions to `(testee)/layout.tsx`:** none. The shared `(testee)` shell from FE-2 hosts the results page unchanged.

---

## A. Page/feature inventory

| # | Capability | Route / file | Design source | Screenshot |
|---|---|---|---|---|
| 1 | Results page composition (route shell, polling, role guard) | `(testee)/attempts/[attemptId]/result/page.tsx` (replaces FE-4 placeholder) | `testee.jsx:307–462` (TesteeResults) + `results-additions.jsx:35–141` (review-banner additions) | `v6-fe6-14-review-states.png` (composition view) |
| 2 | `ResultHero` — hero stats + review-status banner | `frontend/src/components/result/result-hero.tsx` | `testee.jsx:319–352` (stat row) + `results-additions.jsx:86–122` (ReviewPendingCard + ReviewCompleteCard) | `v6-fe6-14-review-states.png` |
| 3 | `ByPillCard` — weakness breakdown with calibration confidence | `frontend/src/components/result/by-pill-card.tsx` | `testee.jsx:354–386` (by-pill breakdown) | `v6-fe6-14-review-states.png` |
| 4 | `ByQuestionCard` — Q-by-Q grade rows with per-Q AI-review chip | `frontend/src/components/result/by-question-card.tsx` | `testee.jsx:388–432` (Question-by-question card) | `v6-fe6-14-review-states.png` |
| 5 | `AdaptiveLoopCard` — step CTAs (explainer / TDSes / re-test) | `frontend/src/components/result/adaptive-loop-card.tsx` | `testee.jsx:436–449` (loop steps) + `testee.jsx:466–491` (LoopStep helper) | `v6-fe6-14-review-states.png` |
| 6 | `TransparencyBlock` — cross-family model-name + flagged-attention note | `frontend/src/components/result/transparency-block.tsx` | `testee.jsx:451–459` (sunk card) | `v6-fe6-14-review-states.png` |
| 7 | `PdfExportButton` — Blob URL download with four states + toasts | `frontend/src/components/result/pdf-export-button.tsx` + Sonner toast composition | `results-additions.jsx:149–290` (PdfExportSheet + PdfExportButton + PdfToast) | `v6-fe6-15-pdf-export.png` |
| 8 | `RealismAggregateCard` — post-attempt flagged-Q list | `frontend/src/components/result/realism-aggregate-card.tsx` | `results-additions.jsx:302–448` (RealismFeedbackSheet + RealismCardWithFlags + RealismCardEmpty) | `v6-fe6-16-realism.png` |

Eight rows. Capability #1 is the route shell; the other seven are component capabilities composed under it. Mirrors FE-5's pattern (`fe-specs/FE-5-streaming.md:54–60`) where the runner page is #1 and the SSE adapter / queue / overlay / hook compose under it.

---

## B. Per-page detail specs

> **Template** (used identically for every page; propagates to FE-7..FE-9 verbatim):
> 1. Route segment + URL state
> 2. Components (scaffold reused / new in this PR / shadcn primitive / design primitive)
> 3. API endpoints consumed
> 4. Form fields + zod rules + react-hook-form integration shape (or "n/a — read-only page" with TanStack Query notes)
> 5. States (every variant from the design state-strip + any extras the wire surfaces)
> 6. Acceptance criteria (Gherkin — each trio maps to one Vitest test)
> 7. Edge cases / gotchas
> 8. Visual reference

### B.1 Results page composition — `/attempts/[attemptId]/result`

**1. Route segment + URL state**

- File: `frontend/src/app/(testee)/attempts/[attemptId]/result/page.tsx`. **Replaces** the FE-4 placeholder body (FE-4 owns the file path; FE-6's PR edits the file in place — recorded in §H (c) item 18). The `(testee)` route group, `[attemptId]/` segment, and `error.tsx` boundary file are all FE-6-introduced (the result subroute exists today only as the placeholder page).
- Path param: `attemptId` (string UUID). No URL query state. No `?tab=` style state — the page is a single scrollable composition, not a tabbed surface.
- Server-side: no `generateMetadata` dynamic-title in v1 (deferred to the v1.x SEO/accessibility pass). Static `<title>Results · Acumen</title>` from `layout.tsx`.

**2. Components**

- **Scaffold reused:** `useAuth()` (FE-1) for role-guard at page mount; `client` + `unwrap()` (FE-0) for typed fetches; `PageHeader` (FE-2 primitive); `Card`, `Skeleton`, `Tooltip` (shadcn primitives from FE-2's installed set).
- **New in this PR (composed under §B.2..§B.8):** `ResultHero`, `ReviewBanner` (sub-component of hero), `ByPillCard`, `PillWeaknessRow`, `ByQuestionCard`, `QuestionGradeRow`, `AiReviewChip`, `AdaptiveLoopCard`, `LoopStepRow`, `TransparencyBlock`, `RealismAggregateCard`, `RealismFlagRow`, `PdfExportButton`, `ReviewStatusDot` (small shared primitive — pulse dot + colour token). Total: 8 cards + 6 row/sub primitives.
- **shadcn primitives installed in this PR:** none beyond FE-2's installed set. `Tooltip` ships in FE-2.
- **Design primitives reused:** `BandTag` (FE-2 — `shell.jsx:127–138`), `Pill` (FE-2 — `shell.jsx:149–151`), `Stat` (FE-2 — `shell.jsx:117–124`), `PageHeader` (FE-2 — `shell.jsx:103–113`), `.progress`/`.fill` bars (FE-2 globals.css), pulse-dot keyframes (FE-2 globals.css).

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/attempts/{attempt_id}/result` | Primary fetch. Polls every 5s while `status === "review_pending"`, then stops. `refetchOnWindowFocus: true`. | **Implemented** at backend per FE-4 §B.1 §3 (`fe-specs/FE-4-runner.md:143`). Per-Q grade payload shape **verified at build-session start** (§H (b) item 3). |
| `GET /v1/attempts/{attempt_id}` | Secondary fetch for the realism-flag aggregate (B.8) and any per-pill / per-Q fields not surfaced on `/result`. | **Implemented** for resume per FE-4 §C.7. **§H (b) item 7** verifies the `questions[].realism_flagged_by_me` triple is on `AttemptView`. |
| `GET /v1/attempts/{attempt_id}/export.pdf` | Blob URL pattern per AC-CD6. Triggered by the `PdfExportButton` `useMutation`. No poll. | **Implemented** per `FE_ROADMAP.md:125`. Latency 3–10s synchronous; risk note in `FE_ROADMAP.md:133`. |

No third endpoint for adaptive-loop steps — spec assumes `result.adaptive_loop[]` is inlined on the primary fetch (§H (b) item 6; if absent, the spec needs revision before build).

**4. Form fields + zod + react-hook-form**

n/a — read-only page. **TanStack Query notes:**

```ts
const result = useQuery({
  queryKey: attemptQueryKeys.result(attemptId),
  queryFn: () => unwrap(client.GET("/v1/attempts/{attempt_id}/result", { params: { path: { attempt_id: attemptId } } })),
  refetchInterval: (q) => q.state.data?.status === "review_pending" ? 5000 : false,
  refetchOnWindowFocus: true,
  // refetchIntervalInBackground defaults to false in TanStack v5 — backgrounded tab pauses polling (§H (b) item 10 verifies)
});

const attempt = useQuery({
  queryKey: attemptQueryKeys.detail(attemptId),
  queryFn: () => unwrap(client.GET("/v1/attempts/{attempt_id}", { params: { path: { attempt_id: attemptId } } })),
  // No refetchInterval — realism flags are submitted during the attempt; once on results page they don't change.
  enabled: result.data?.status === "complete",  // gate to avoid double-fetch during pending
});
```

Polling cadence is the user-locked decision (Answer 2 at plan close: **5s interval + focus refetch**). `refetchIntervalInBackground: false` (TanStack v5 default) is documented choice — the testee returning to a backgrounded tab triggers `refetchOnWindowFocus` for a fresh check.

PDF export uses `useMutation`, not a query — keeps the button state local (idle / generating / success / error) and lets TanStack handle mutation lifecycle without interfering with the result-page cache.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `loading` | Initial `result` query in-flight | Skeleton placeholders for hero stat row, by-pill card, by-question card, sidebar cards. `PageHeader` renders with attempt-id eyebrow + skeleton title. |
| `review_pending` | `result.status === "review_pending"` | Hero shows pulse-dot REVIEW PENDING banner per `results-additions.jsx:86–105`; ByQuestionCard renders rows with `pending` chip on AI-graded items; AdaptiveLoopCard hidden (loop steps only ready post-review); RealismAggregateCard hidden; PdfExportButton in `gated` state with tooltip; TransparencyBlock hidden. |
| `review_pending_overdue` | `result.status === "review_pending"` AND >60s since submit (derived client-side from `result.submitted_at`) | Same as above plus banner copy shifts to "Checking your AI grades — admin will review within ~5 min" per AC-D19 v1.7 reconcile-cron pattern (`DECISIONS.md` AC-D19 amended at v1.7). Pulse-dot tone shifts amber. |
| `complete` | `result.status === "complete"` | All cards render. Hero shows REVIEW COMPLETE banner per `testee.jsx:342–351`; AdaptiveLoopCard mounts with step list; TransparencyBlock mounts; RealismAggregateCard mounts if `questions[].realism_flagged_by_me === true` for ≥1 Q (else hidden per `results-additions.jsx:441–457` empty-state rule). PdfExportButton in `idle` state. |
| `complete_flagged` | `result.status === "complete"` AND `result.review_summary.flagged_count > 0` | Variant of `complete`: TransparencyBlock surfaces the "One review was flagged" sub-line (B.6); ByQuestionCard surfaces `flagged` chip on the relevant Q row(s). |
| `complete_deterministic_only` | `result.status === "complete"` AND no AI-graded Qs in the attempt | Variant of `complete`: ReviewBanner replaced with "Auto-graded · no AI review needed" hint; TransparencyBlock hidden. |
| `complete_benchmark` | `result.status === "complete"` AND `attempt.test.mode === "benchmark"` | Variant of `complete`: AdaptiveLoopCard hidden per AC-D5 (benchmarks don't drive the loop); ByPillCard's calibration-confidence label hidden (benchmark scoring posture, AC-D13). Hero's competence-delta column hidden. |
| `error` | `result` query throws | Pattern C boundary card mounts via `(testee)/attempts/[attemptId]/result/error.tsx`. Copy: "Couldn't load these results." + "Try again" (resets boundary) + "Go to dashboard". |
| `role_mismatch` | Admin role hits the route | AC-CD20 `(testee)` layout guard redirects to `/403` before page mount (FE-1 §C.4 five-posture matrix). FE-6 ships no admin variant. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Happy-path testee lands on complete results
  Given the testee submitted the attempt and review completed within the 60-s ceiling
  And the testee opens /attempts/{attemptId}/result
  When the result query resolves with status "complete"
  Then ResultHero renders with REVIEW COMPLETE banner
  And ByPillCard renders one row per weak pill
  And ByQuestionCard renders the Q-by-Q list
  And AdaptiveLoopCard renders the step list
  And TransparencyBlock renders the model-name line
  And PdfExportButton is enabled
```

```gherkin
Scenario: Poll flips from pending to complete
  Given the testee opens the result page during the review window (status == "review_pending")
  And the page mounts the 5-s refetchInterval
  When the next poll tick (≤5 s) returns status "complete"
  Then the REVIEW PENDING banner replaces with REVIEW COMPLETE
  And AdaptiveLoopCard, TransparencyBlock, and (if any flags) RealismAggregateCard mount
  And PdfExportButton transitions from gated to idle
  And the refetchInterval stops firing
```

```gherkin
Scenario: Review exceeds 60-s ceiling — overdue banner
  Given the testee opens the result page during the review window
  And the client-side derived elapsed > 60 s
  When the result query still returns status "review_pending"
  Then the REVIEW PENDING banner copy reads "checking your AI grades — admin will review within ~5 min"
  And the pulse-dot tone shifts amber
  And the page continues polling at 5 s indefinitely until the reconcile cron resolves
```

```gherkin
Scenario: Admin hits testee result URL — 403
  Given an admin user opens /attempts/{attemptId}/result
  When the (testee) layout-guard evaluates the role
  Then the user is redirected to /403
  And the result page never mounts
```

```gherkin
Scenario: Initial fetch failure — Pattern C boundary
  Given the testee opens the result page
  When the GET /v1/attempts/{id}/result throws (network error, 5xx)
  Then result/error.tsx renders with "Couldn't load these results."
  And "Try again" resets the boundary and refetches
```

(Six total scenarios mapped to D.2 page-integration tests. Additional state-specific Gherkin lives in the relevant B.N sub-section.)

**7. Edge cases / gotchas**

- **Q1-generation-failed attempts never reach the result page.** Per FE-5 §H (b) item 9 boundary: `POST /v1/attempts` returns 503 `q1_generation_failed` if Q1 can't generate, and the attempt row never exists. FE-6 does not handle this case; the FE-3 pill detail's Practice-now CTA owns the surface.
- **Mid-stream-paused attempts can still submit.** Per AC-D11 / AC-D25 a per_testee attempt that paused on `generation_failed` can still be submitted by the testee (after resume / final pause-out); FE-6 renders its results page identically to a non-paused attempt — pause history is not surfaced in v1.
- **Backgrounded tab pauses polling.** `refetchIntervalInBackground: false` (TanStack v5 default) means a testee who tabs away for 10 min and returns sees the last-fetched state until `refetchOnWindowFocus` fires on tab focus. This is the intended trade per Answer 2 (user-locked) — gracefully handles the long-tail reconcile-cron path.
- **Anchor-link navigation between cards.** Clicking a Q# in the TransparencyBlock flagged-sub-line (B.6) or in the RealismAggregateCard flag row (B.8) scrolls the ByQuestionCard row into view via `scrollIntoView({ behavior: "smooth" })` with the row keyed by `data-question-id={qid}`. Shared anchor pattern between B.6 and B.8.
- **Long-running PDF export does not block the page.** PdfExportButton is local-state-only; the rest of the page stays interactive while the Blob download is in flight.
- **`result` data may arrive partial during the transition tick.** If a poll tick returns `status === "complete"` but `adaptive_loop` field is missing (server is mid-write), the AdaptiveLoopCard renders its `loading` skeleton briefly until the next tick. Edge case; defensive `??` guards in the spec.

**8. Visual reference**

- `frontend/design-reference/prototype/testee.jsx:307–462` — `TesteeResults` (the complete results screen as drawn in the v6 mock).
- `frontend/design-reference/prototype/testee.jsx:466–491` — `LoopStep` helper (the adaptive-loop step row primitive).
- `frontend/design-reference/prototype/results-additions.jsx:35–141` — `ReviewPendingVsComplete` + `ReviewPendingCard` + `ReviewCompleteCard` (the v6 review-banner additions on top of the testee.jsx baseline).
- `frontend/design-reference/prototype/results-additions.jsx:149–290` — `PdfExportSheet` + `PdfExportButton` (4 states) + `PdfToast` (4 toast variants).
- `frontend/design-reference/prototype/results-additions.jsx:302–457` — `RealismFeedbackSheet` + `RealismCardWithFlags` + `RealismCardEmpty` (post-attempt aggregate variants).
- Screenshots: `v6-fe6-14-review-states.png`, `v6-fe6-15-pdf-export.png`, `v6-fe6-16-realism.png`.

---

### B.2 ResultHero — hero stats + review-status banner

**1. Route segment + URL state**

- Child component; no route of its own. Rendered at the top of `result/page.tsx` immediately under `PageHeader`.

**2. Components**

- **Scaffold reused:** `BandTag` (FE-2), `Stat` (FE-2 — used as the four stat cards: score / competence / time / review), shadcn `Card` (paper-card chrome).
- **New in this PR:** `ResultHero` composer; `ReviewBanner` sub-component (the fourth stat-card slot — pulse-dot REVIEW PENDING / REVIEW COMPLETE / REVIEW PENDING (overdue)); `ReviewStatusDot` (small pulse-dot primitive — shared with the per-Q chip in B.4).

**3. API endpoints consumed**

Reads from the page-level `result` query payload:

```ts
result.overall_score: number             // 0..100 percentage
result.outcome: "pass" | "fail" | "n/a"  // benchmark uses "n/a"; verify enum at build (§H (b) item 3)
result.attempt_band: "novice" | "junior" | "working" | "advanced" | "expert"
result.competence_estimate_after?: number   // float per AC-D9; null on first attempt
result.competence_estimate_delta?: number   // signed float; null on first attempt
result.time_on_test_seconds: number
result.median_time_seconds?: number         // for "median for D{n}: X min" hint
result.review_summary?: { flagged_count: number; review_duration_ms?: number; ai_grader_model?: string; reviewer_model?: string }
result.status: "review_pending" | "complete"
result.submitted_at: string                  // ISO datetime
```

§H (b) item 3 verifies the exact field path / nullability against `app/schemas.py`.

**4. Form fields**

n/a.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `pending` | `result.status === "review_pending"` | Three stat cards (score / competence / time) + fourth-slot ReviewBanner (pulse-dot, ink-3 tone, "REVIEW PENDING" + "Checking your AI-graded responses… usually 4–8 seconds" sub-line per `results-additions.jsx:86–105`). |
| `pending_overdue` | Above + elapsed since `submitted_at` > 60 s | ReviewBanner amber tone, "REVIEW PENDING" + "Cross-family review still running — admin will review within ~5 min" sub-line. |
| `complete` | `result.status === "complete"` | Four stat cards. Fourth = ReviewBanner green-tone (ok-soft bg per `testee.jsx:342`), "REVIEW COMPLETE" + "All N AI grades cross-checked by OpenAI in X.Xs" (duration from `review_summary.review_duration_ms`; copy omits duration if field absent — §H (b) item 5). |
| `complete_deterministic_only` | Above + no AI-graded Qs in attempt | Fourth stat-card replaced with hint "Auto-graded · no AI review needed". |
| `complete_first_attempt` | Above + `competence_estimate_delta == null` | Second stat-card renders "—" with hint "first attempt, no prior baseline" per AC-D9 (`SESSION_START.md:347` "null = no data yet, not a failing score"). |
| `complete_benchmark` | `attempt.test.mode === "benchmark"` | Competence stat-card hidden (benchmarks don't drive the loop per AC-D5/AC-D13); replaced with "BENCHMARK" eyebrow + stat-card with "1 of N annual" or similar — verify at build time. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Banner flips on poll tick
  Given the hero is in state pending
  When the next result poll resolves with status "complete"
  Then ReviewBanner transitions to state complete with the duration copy
```

```gherkin
Scenario: Overdue ceiling crossed
  Given the hero is in state pending and 61 s have elapsed since submitted_at
  When the next render runs
  Then ReviewBanner shows the amber pending_overdue copy
```

```gherkin
Scenario: Deterministic-only attempt suppresses banner
  Given a frozen MCQ-only attempt's result returns status "complete" with no AI grades
  Then the hero shows three stat cards plus the "Auto-graded · no AI review needed" hint
```

**7. Edge cases / gotchas**

- **Delta colour mapping:** positive = `var(--ok)`, negative = `var(--danger)`, zero = `var(--ink-dim)`. Null delta → "—" with hint per AC-D9. Helper lives at `frontend/src/lib/result/format-delta.ts` (D.1 unit test exists).
- **Calibration confidence label NOT on hero.** AC-D20 preliminary→confident label lives only on the by-pill card (B.3) per the v6 mock; hero suppresses it. Recorded in §H (c) item 20 as an approved spec resolution.
- **Time formatting:** `time_on_test_seconds` → "Mmin" if <60 min, "Hh Mm" otherwise. Median hint hidden if `median_time_seconds` absent.
- **Animation choreography:** banner state transitions use a 200 ms cross-fade between pulse-dot tones; no FE-2 keyframe change required (uses existing pulse-dot opacity keyframe).

**8. Visual reference**

- `testee.jsx:319–352` — the stat row including the REVIEW COMPLETE fourth-slot card.
- `results-additions.jsx:86–105` — `ReviewPendingCard` (full PENDING variant with elaborate copy).
- `results-additions.jsx:107–122` — `ReviewCompleteCard` (full COMPLETE variant; redundant with testee.jsx — pick one canonical chrome; the spec uses the smaller stat-card chrome from testee.jsx to keep the hero scannable).
- Screenshot: `v6-fe6-14-review-states.png`.

---

### B.3 ByPillCard — weakness breakdown with calibration confidence

**1. Route segment + URL state**

- Child component, mounted in the left column of the result-page grid (`col-span-7` per `testee.jsx:354`).

**2. Components**

- **Scaffold reused:** shadcn `Card`, `Pill` (FE-2 severity chip), `BandTag` (FE-2).
- **New in this PR:** `ByPillCard` composer; `PillWeaknessRow` (one per weak pill — pill name + severity chip + score + bar + calibration confidence subtext).
- **Design primitives reused:** `.progress` / `.fill` from FE-2's globals.css with severity-driven colour (`var(--danger)` for critical, `var(--warn)` for severe, `var(--ok)` for info per `testee.jsx:380`).

**3. API endpoints consumed**

Reads from `result.pills[]` array on the page-level query:

```ts
result.pills[].pill_id: string
result.pills[].pill_name: string
result.pills[].subject_id: string                  // for grouping if multiple subjects (rare)
result.pills[].score_percent: number               // 0..100
result.pills[].missed_count: number                // "missed N of M questions" subtext
result.pills[].total_count: number
result.pills[].band: "novice" | "junior" | "working" | "advanced" | "expert"
result.pills[].competence_estimate?: number        // float; null on first observation
result.pills[].n: number                           // observation count for calibration
result.pills[].confidence: "preliminary" | "confident"   // per AC-D20
result.pills[].severity: "critical" | "severe" | "info"   // for chip + bar colour
result.pills[].is_safety_tagged: boolean           // per AC-D21 — feeds B.5's CTA branching
```

§H (b) item 4 verifies this payload shape and the confidence enum values against `app/schemas.py` / `app/domain/calibration.py`.

**4. Form fields**

n/a.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `row` | One per weak pill in `result.pills[]` | Pill name + severity chip (`critical` / `severe` / `info` tone) + score % + progress bar tinted to severity + subtext "missed N of M questions" per `testee.jsx:372` + calibration suffix "competence_estimate · n=X · preliminary\|confident" |
| `empty` | `result.pills.length === 0` (no weak pills) | Card hides entirely — no "great job" state. Loop card (B.5) also hides; cross-link in §C.5. |
| `calibration_preliminary` | Per row: `confidence === "preliminary"` | Suffix renders "preliminary" in `var(--ink-dim)` tone; tooltip on hover: "Calibration pending — n={n} below the AC-D20 threshold of {THRESHOLD}." |
| `calibration_confident` | Per row: `confidence === "confident"` | Suffix renders "confident" in `var(--ink)` tone; no tooltip. |
| `safety_marked` | Per row: `is_safety_tagged === true` | Small "AC-D21 safety" mono badge to the right of severity chip; tooltip "External-link explainer applies — see loop steps". Visually links to B.5 CTA. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Confidence label flips at threshold
  Given the AC-D20 threshold is 20
  When a pill row renders with n == 19
  Then the confidence suffix reads "preliminary"
  And when n == 20 the suffix reads "confident"
```

```gherkin
Scenario: Safety-tagged pill carries the AC-D21 marker
  Given a pill row's is_safety_tagged is true
  Then a "safety" mono badge renders next to the severity chip
```

```gherkin
Scenario: Empty weak-pill list hides the card
  Given result.pills is empty
  Then the ByPillCard does not mount
  And AdaptiveLoopCard also does not mount
```

**7. Edge cases / gotchas**

- **Threshold N value:** the AC-D20 preliminary→confident threshold lives in `DECISIONS.md`; spec placeholder `n=20` (per AC-D20 prior amendment); §E.3 verification at build time confirms.
- **Severity ordering:** rows sort `critical → severe → info` then alphabetical by pill name. Backend may return any order; FE sorts client-side.
- **Subject grouping:** spec assumes pills can be from different subjects (e.g. attempt spans Antifouling + Cathodic-protection). Rows aren't sub-grouped by subject in v1; if backend returns mixed subjects, all rows render flat. Resurfacing as design-ref drift is out of scope.

**8. Visual reference**

- `testee.jsx:354–386` — `By pill` card with row loop.
- `testee.jsx:277–301` — `PillCard` from the catalogue (drift reference for the calibration-confidence subtext style — same `dim · n={n} · {conf}` pattern).
- Screenshot: `v6-fe6-14-review-states.png`.

---

### B.4 ByQuestionCard — Q-by-Q grade rows with per-Q AI-review chip

**1. Route segment + URL state**

- Child component, mounted below ByPillCard in the left column.

**2. Components**

- **Scaffold reused:** shadcn `Card`, `Pill` (FE-2 type-badge chrome), `Tooltip` (FE-2).
- **New in this PR:** `ByQuestionCard` composer; `QuestionGradeRow` (one per Q); `AiReviewChip` (status-driven chip — `confirmed` / `flagged` / `pending` / `n/a`); inline expand-on-click for AI-graded rows revealing AI reasoning + reviewer rationale. Header carries the `PdfExportButton` (B.7).
- **Design primitives reused:** ✓/✗ `.chip-ok` / `.chip-danger` icons from FE-2's globals.css per `testee.jsx:411–412`; `<Icon name="check" />` and `<Icon name="x" />` (FE-2 icon set). FIG mini-badge (figure-included indicator) per `testee.jsx:417–425` — typed stub per AC-CD24; renders the badge only, no figure body.

**3. API endpoints consumed**

Reads from `result.questions[]` array on the page-level query. **Per-Q payload (assumed; §H (b) item 3 verifies):**

```ts
result.questions[].question_id: string
result.questions[].attempt_position: number          // 1-indexed; ordering source per AC-CD10
result.questions[].prompt_text: string
result.questions[].question_type: "multiple_choice" | "multiple_choice_multi" | "true_false" | "matching" | "short_answer" | "scenario"
result.questions[].response?: { answer_payload: AnswerPayload }   // discriminated union from FE-4 §F.5
result.questions[].grade: {
  is_correct: boolean | null                         // null = partial
  points_awarded: number
  points_possible: number
  ai_grader_model?: string                           // per AC-CD18 — null for deterministic items
  ai_reasoning?: string                              // null for deterministic items
  review_verdict: "confirmed" | "flagged" | "pending" | null   // null for deterministic items; "pending" during review window
  review_reasoning?: string                          // OpenAI reviewer rationale
  reviewer_model?: string                            // per AC-CD18
}
result.questions[].has_figure: boolean               // for FIG badge per testee.jsx:416
```

**§H (b) item 3 is the biggest drift candidate.** OpenAPI snapshot describes `result.questions` as `array<object>` without detail (Phase-1 Explore finding). If `app/schemas.py` does not surface `grade.review_verdict` and `grade.review_reasoning`, §H (a) item 2 escalates: per-Q chip and expand-row depend on these fields. User-locked decision (Answer 1 — "Per-Q + aggregate") commits FE-6 to per-row chip; the backend payload must support it.

**4. Form fields**

n/a (read-only; row expand/collapse is local React state, not URL state).

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `row_deterministic_correct` | `question_type` is deterministic AND `grade.is_correct === true` | ✓ chip + type badge + prompt excerpt + (optional FIG badge) |
| `row_deterministic_incorrect` | Deterministic AND `is_correct === false` | ✗ chip + type badge + prompt excerpt + (optional FIG badge) |
| `row_ai_pending` | `question_type` is AI-graded (`short_answer` / `scenario`) AND `grade.review_verdict === "pending"` | ✓/✗ icon (deterministic grade was assigned by the AI grader pre-review) + type badge + prompt excerpt + `AiReviewChip` in pending state (pulse-dot, "Reviewing…" copy) |
| `row_ai_confirmed` | AI-graded AND `review_verdict === "confirmed"` | Same row + `AiReviewChip` in soft tone, "AI graded" copy per `testee.jsx:426` |
| `row_ai_flagged` | AI-graded AND `review_verdict === "flagged"` | Same row + `AiReviewChip` in `var(--warn)` tone, "Admin reviewing" copy per `testee.jsx:428`. Expand row reveals "OpenAI flagged this grade for admin attention — your score may be adjusted." |
| `row_partial_credit` | `is_correct === null` (matching, partial-credit short_answer) | Half-shaded icon + type badge + prompt excerpt + `Pill tone="warn" mono` "Partial" per `testee.jsx:427` |
| `row_expanded` | User clicks row | Below the row: AI reasoning (if present), reviewer verdict + reasoning (if AI-graded), the testee's own answer payload formatted via FE-4's discriminated-union pretty-printer. Collapse on second click. |
| `row_anchor_target` | Hash navigation from B.6 or B.8 to `#question-{position}` | Row briefly highlights (FE-2 `.flash` keyframe — to be added if absent, §F.2) and scrolls into view. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: AI-graded row chip flips on poll tick
  Given a result row is in row_ai_pending
  When the next result poll returns status "complete" with grade.review_verdict "confirmed"
  Then the row transitions to row_ai_confirmed
  And the AiReviewChip copy reads "AI graded"
```

```gherkin
Scenario: Flagged review surfaces aggregate transparency note
  Given a result with status "complete" and one questions[].grade.review_verdict "flagged"
  Then that row renders row_ai_flagged
  And the TransparencyBlock (B.6) sub-line surfaces the flagged-Q anchor
```

```gherkin
Scenario: Expand AI-graded row reveals reasoning
  Given a row in row_ai_confirmed
  When the user clicks the row
  Then the row expands and renders grade.ai_reasoning and grade.review_reasoning
  And clicking again collapses the row
```

**7. Edge cases / gotchas**

- **Per-Q chip depends on `review_verdict` surfacing on the result endpoint.** If §H (b) item 3 verifies and the field is absent, §H (a) item 2 escalates and FE-6 build pauses for a user-authored spec-clarification PR. Fallback design (degrade to attempt-level only) is described in §H (a) item 2 but is NOT the locked spec — user Answer 1 locked per-Q.
- **Truncation rule:** prompt excerpt is `line-clamp-1` on the collapsed row; AI reasoning is `line-clamp-3` on collapsed expand-content (renders only if user clicks expand again into "full" mode — out of v1 scope; v1 reveals full reasoning on expand).
- **Matching-type answers:** discriminated-union pretty-print from FE-4 §F.5 — pretty-prints `pairs` map as "left → right" pairs in a grid.
- **Image refs in prompt:** typed stubs per AC-CD24; renders the FIG badge per `testee.jsx:416–425` to indicate a figure was present, but renders no image body in v1.
- **Long AI reasoning:** wraps with `whitespace-pre-wrap`; no truncation in expand mode; row height grows.
- **Anchor scroll on first paint:** if the URL has `#question-{n}`, defer scroll until after the result query resolves (skeleton state would scroll the wrong target).

**8. Visual reference**

- `testee.jsx:388–432` — the question-by-question card with row map.
- `testee.jsx:426–428` — the three meta-pill variants (`AI graded`, `Partial`, `Admin reviewing`) — the v6 mock's per-Q chip vocabulary. The "Admin reviewing" pill corresponds to spec's `row_ai_flagged`; "AI graded" with no addendum corresponds to `row_ai_confirmed`; no design exists for `row_ai_pending` — the spec adds it (recorded in §F.4 design-ref completeness note).
- Screenshot: `v6-fe6-14-review-states.png`.

---

### B.5 AdaptiveLoopCard — step CTAs (read explainer / TDSes / re-test)

**1. Route segment + URL state**

- Child component, mounted in the right column (`col-span-5` per `testee.jsx:435`).

**2. Components**

- **Scaffold reused:** shadcn `Card`, `Pill` (FE-2 status badges), `Link` (`next/link`).
- **New in this PR:** `AdaptiveLoopCard` composer; `LoopStepRow` (one per step — number + title + status badge + description + CTA). Follows the `LoopStep` design at `testee.jsx:466–491` (rename to `LoopStepRow` in code to namespace under `result/`).
- **Design primitives reused:** `eyebrow` + serif-italic title pattern from `testee.jsx:437–440` (matches FE-2's `PageHeader` title chrome).

**3. API endpoints consumed**

Reads from `result.adaptive_loop[]` array on the page-level query. **§H (b) item 6 verifies this surfaces on `/result` and not on a separate endpoint.** Assumed shape:

```ts
result.adaptive_loop[].type: "explainer" | "external_link_set" | "retest_queued"
result.adaptive_loop[].target_pill_id?: string         // null for retest_queued (covers multiple pills)
result.adaptive_loop[].target_pill_name?: string       // for display
result.adaptive_loop[].title: string                   // e.g. "Read this explainer"
result.adaptive_loop[].description: string             // body copy
result.adaptive_loop[].cta_label: string               // e.g. "Open", "Open Drive", "Defer"
result.adaptive_loop[].route_href: string              // in-app for explainer / retest_queued; external for external_link_set
result.adaptive_loop[].status: "ready" | "optional" | "queued"
result.adaptive_loop[].queued_for?: string             // ISO datetime, for retest_queued
result.adaptive_loop[].step_down_hint?: boolean        // AC-D6 third-failed-iteration step-down — surfaces "stepped down to D{n-1}" subtitle
```

If the loop payload doesn't surface on `/result` (§H (b) item 6 finds it absent or on a different endpoint), §H (a) escalates and FE-6 build pauses.

**4. Form fields**

n/a.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `step_explainer` | Step `type === "explainer"` | Numbered row, title, description, `Pill tone="ready"` badge, CTA "Open" routing to `/pills/{target_pill_id}` (FE-3 territory) |
| `step_external_link_set` | `type === "external_link_set"` (safety pill per AC-D21) | Numbered row, title "Skim N manufacturer TDSes" (or similar), description, `Pill tone="optional"` badge, CTA "Open Drive" routing to external `route_href` (`target="_blank" rel="noopener noreferrer"`) |
| `step_retest_queued` | `type === "retest_queued"` | Numbered row, "Re-test on {target_pill_name} at D{n}" title, description with "In N days. M questions, ~T min" — N derived client-side from `queued_for - now`. `Pill tone="queued"` badge, CTA "Defer" (no-op in v1; deferral mechanics live in FE-9 admin operations — surfaced as §E.1 placeholder). |
| `step_step_down` | Any step + `step_down_hint === true` | Step description gains "We've stepped the difficulty down by 1 band per AC-D9 since this was your third weak attempt" sub-line per `testee.jsx:447`. |
| `empty` | `result.adaptive_loop.length === 0` (matches B.3 empty state — no weak pills, no loop) | Card hides entirely. |
| `loading` | `result.status === "review_pending"` | Card hidden (loop steps only resolve post-review). |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Safety pill routes to external link set
  Given a step with type "external_link_set" and a target safety-tagged pill
  When the testee clicks the CTA
  Then a new tab opens to route_href
  And the testee remains on the result page
```

```gherkin
Scenario: Non-safety pill routes to in-app explainer
  Given a step with type "explainer"
  When the testee clicks the CTA
  Then next/link navigates to /pills/{target_pill_id}
  And the result page unmounts via the (testee) shell
```

```gherkin
Scenario: Step-down hint surfaces on third-failed iteration
  Given a step with step_down_hint === true
  Then the row description includes "stepped down to D{n-1}" copy
```

```gherkin
Scenario: Empty loop hides the card
  Given result.adaptive_loop is empty
  Then AdaptiveLoopCard does not mount
```

**7. Edge cases / gotchas**

- **AC-D21 safety overrides AC-D6 default.** If a weak pill is safety-tagged, the loop never serves AI explainer content — only external link sets. Backend handles the type decision; FE renders the type it's given.
- **Re-test "queued in N days" relative date:** N = `Math.ceil((queued_for - now) / (1000*60*60*24))`. If `queued_for` is in the past (backend lag), display "Today"; if `null`, display "soon" (placeholder per §E.2).
- **External-link `target="_blank"` security:** always `rel="noopener noreferrer"`.
- **Defer CTA is a v1 no-op.** Surfaces as a button but does nothing — FE-9 admin-ops PR wires it. Tooltip on hover: "Deferral lands in a later release."
- **AC-D6 autonomous vs admin-reviewed mode.** SPEC §4.9 distinguishes autonomous mode (loop runs immediately) from admin-reviewed mode (admin authorises before testee sees the loop). FE-6 assumes autonomous mode for the testee-facing surface; admin-reviewed mode's "weakness report routed to admin" state would surface as `result.adaptive_loop === null` with a banner copy "Your admin is reviewing your weakness report" — verify at build time (§H (b) item 6 sub-case).

**8. Visual reference**

- `testee.jsx:436–449` — adaptive loop card with three example LoopSteps.
- `testee.jsx:466–491` — `LoopStep` helper (renamed `LoopStepRow` in code).
- Screenshot: `v6-fe6-14-review-states.png`.

---

### B.6 TransparencyBlock — cross-family model-name + flagged-attention note

**1. Route segment + URL state**

- Child component, mounted below AdaptiveLoopCard in the right column. Renders as a "sunk" card variant (recessed chrome per `testee.jsx:451`).

**2. Components**

- **Scaffold reused:** shadcn `Card` (sunk variant — FE-2 token).
- **New in this PR:** `TransparencyBlock` composer with model-name line + optional flagged-attention sub-line.
- **Design primitives reused:** mono text via `<span className="mono">` for model IDs per `testee.jsx:454–455`.

**3. API endpoints consumed**

Reads from `result.review_summary` on the page-level query:

```ts
result.review_summary.ai_grader_model: string         // e.g. "claude-sonnet-4-5"; from AC-CD18 env default
result.review_summary.reviewer_model: string          // e.g. "openai gpt-4o-mini"; from AC-CD18 env default
result.review_summary.review_duration_ms?: number     // for "in X.Xs" copy
result.review_summary.flagged_count: number
result.review_summary.flagged_question_positions: number[]   // e.g. [7] → "your Q7 grade may be too low"
```

**Model IDs are read from the response, NEVER hardcoded** per AC-CD18 — locked in the spec body. §H (b) item 5 verifies the field shape against `app/schemas.py`.

**4. Form fields**

n/a.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `no_flags` | `flagged_count === 0` | "Your AI-graded responses were graded by {ai_grader_model} and independently reviewed by {reviewer_model}. Both passes ran in a single {duration}-second batch." per `testee.jsx:454–455` |
| `one_flag` | `flagged_count === 1` | Above + sub-line "One review was flagged for admin attention — your Q{position} grade may be too low. You'll be notified if the admin adjusts it." per `testee.jsx:456–457` |
| `multiple_flags` | `flagged_count > 1` | Above + sub-line "{N} reviews were flagged — your Q{pos1}, Q{pos2}, … grades may be too low." |
| `pending` | `result.status === "review_pending"` | Block hidden — model names + flagged count not yet known. |
| `deterministic_only` | No AI grades in attempt | Block hidden. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: No flags renders the bare model-name line
  Given result.review_summary.flagged_count === 0
  Then the TransparencyBlock renders only the model-name copy
  And the flagged-attention sub-line is absent
```

```gherkin
Scenario: One flag surfaces the sub-line with anchor link
  Given flagged_count === 1 and flagged_question_positions === [7]
  Then the sub-line reads "your Q7 grade may be too low"
  And clicking "Q7" scrolls the ByQuestionCard row #question-7 into view
```

```gherkin
Scenario: Plural flags pluralise the sub-line
  Given flagged_count === 2 and flagged_question_positions === [3, 7]
  Then the sub-line reads "your Q3, Q7 grades may be too low"
```

**7. Edge cases / gotchas**

- **Unfamiliar model IDs render as-is.** If backend returns `claude-opus-5` and the FE has no special handling, the string passes through verbatim. No allow-list, no validation. Per AC-CD18.
- **Duration formatting:** ms → seconds with one decimal (e.g. 4200 → "4.2"). If `review_duration_ms` absent, copy omits "in X.Xs" gracefully — "Both passes ran in a single batched call".
- **Sub-line shares anchor pattern with B.8.** Both target `#question-{position}` IDs on ByQuestionCard rows. `scrollIntoView` helper lives at `frontend/src/lib/result/scroll-to-question.ts` (D.1 unit test).
- **Provider rebranding (AC-CD18) safety:** the "OpenAI" / "Anthropic" prose strings could go stale if provider names change. The spec keeps the prose generic — "{ai_grader_model}" / "{reviewer_model}" — and lets the model-id string stand for the provider identification.

**8. Visual reference**

- `testee.jsx:451–459` — the sunk transparency card with model-name + flagged sub-line.
- Screenshot: `v6-fe6-14-review-states.png`.

---

### B.7 PdfExportButton — Blob URL download with four states

**1. Route segment + URL state**

- Child component, mounted in the `ByQuestionCard` header (right side; left side carries the card title per `testee.jsx:393–395`).
- Page-state-driven via TanStack `useMutation`, not URL state.

**2. Components**

- **Scaffold reused:** shadcn `Button` (size `sm`, variant `ghost` per `testee.jsx:394`), `Tooltip` (FE-2), Sonner toast (mounted at root layout per FE-1 §C.3).
- **New in this PR:** `PdfExportButton` composer (4-state button — `idle` / `generating` / `success` / `error` plus the `gated` state when review is pending), `PdfExportToast` (4-variant toast per `results-additions.jsx:243–290`).
- **Design primitives reused:** spinner icon (FE-2 `<Icon name="spinner" />`), check icon (`name="check"`), x icon (`name="x"`).

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/attempts/{attempt_id}/export.pdf` | Returns the attempt result PDF as binary blob per AC-CD6. Synchronous-blocking (3–10s typical, may exceed for large attempts). | **Implemented.** Spec assumes `Content-Disposition: attachment; filename="..."` header is set; §H (b) item 9 verifies. |

Error envelope per AC-CD6: 422 `attempt_not_submitted` if attempt isn't submitted yet (defensive — should never fire from FE-6 since results page only mounts post-submit, but error path is wired for completeness).

**4. Form fields + useMutation contract**

n/a (no form). **useMutation contract:**

```ts
const pdfMutation = useMutation({
  mutationFn: async () => {
    const response = await fetch(`/v1/attempts/${attemptId}/export.pdf`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw await response.json();   // error envelope per AC-CD6
    const blob = await response.blob();
    const filename = parseContentDisposition(response.headers.get("Content-Disposition"))
                     ?? `attempt-${attemptId.slice(0, 5)}.pdf`;
    return { blob, filename };
  },
  onSuccess: ({ blob, filename }) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success(`${filename} · check your downloads`);
  },
  onError: (err: ApiError) => {
    toast.error("Couldn't export the PDF", {
      description: err.code === "attempt_not_submitted"
        ? "This attempt hasn't been submitted yet."
        : "Something went wrong. Try again.",
      action: { label: "Try again →", onClick: () => pdfMutation.mutate() },
    });
  },
});
```

`parseContentDisposition` helper lives at `frontend/src/lib/result/parse-content-disposition.ts` (D.1 unit test).

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `gated` | `result.status === "review_pending"` | Button `aria-disabled` + greyed; tooltip "Results aren't ready yet — try once review completes" per `results-additions.jsx:130`. |
| `idle` | `result.status === "complete"` AND `pdfMutation.isIdle` | "Download PDF →" button, ghost variant, sm size, per `testee.jsx:394`. |
| `generating` | `pdfMutation.isPending` | Spinner icon + "Generating… (typically 3–10s)" copy; button `disabled`; pulse animation on spinner per `results-additions.jsx:225–230`. |
| `success` | `pdfMutation.isSuccess`, briefly | Green check icon + "Downloaded" copy for ~2s, then re-arms to `idle`. Toast simultaneously. |
| `error` | `pdfMutation.isError` | Red x icon + "Export failed" copy; toast with "Try again →" retry per `results-additions.jsx:264–290`. Re-arms to `idle` on next user click. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Happy path PDF download
  Given the result page is in state complete
  When the testee clicks "Download PDF"
  Then the button transitions to generating
  And the fetch resolves with a blob and Content-Disposition filename
  And the browser downloads the file via the synthetic <a download> click
  And a success toast renders "{filename} · check your downloads"
  And the button briefly shows success then returns to idle
```

```gherkin
Scenario: PDF gated during review_pending
  Given the result page is in state review_pending
  Then the PdfExportButton is in state gated
  And clicking it is a no-op
  And the tooltip surfaces the gating reason
```

```gherkin
Scenario: PDF error surfaces toast with retry
  Given the result page is in state complete
  When the testee clicks "Download PDF" and the fetch returns 5xx
  Then the button transitions to error
  And a toast renders with "Try again →" action
  And clicking the action re-runs the mutation
```

**7. Edge cases / gotchas**

- **Long-running export.** Large attempts (50+ Qs) may exceed 10s. Button stays in `generating`; no client-side timeout in v1 — backend reportlab call is the bottleneck (`FE_ROADMAP.md:133` risk note). Copy `(typically 3–10s)` is calibrated by §H (b) item 8 build-time verification.
- **Filename fallback.** If `Content-Disposition` absent or unparseable, fall back to `attempt-${attemptId.slice(0,5)}.pdf`.
- **Authorization header in fetch.** `useMutation`'s `mutationFn` is a raw `fetch`, not `openapi-fetch` — Blob responses don't go through the typed client. The bearer token is read from the same memory context as `client` (FE-0 / FE-1 auth context).
- **Memory cleanup.** `URL.revokeObjectURL(url)` fires on next tick to ensure the `<a download>` click completes first.
- **No retry-with-backoff in v1.** Failed mutation → toast with manual retry. Auto-retry deferred.
- **No simultaneous-download guard.** If the user clicks while in `generating`, the button is `disabled` — no second mutation fires.

**8. Visual reference**

- `results-additions.jsx:151–212` — `PdfExportSheet` showing all four button states side-by-side.
- `results-additions.jsx:214–240` — `PdfExportButton` with the state-driven render.
- `results-additions.jsx:243–290` — `PdfToast` (success / error / generating variants).
- `testee.jsx:394` — the canonical button position in the ByQuestionCard header.
- Screenshot: `v6-fe6-15-pdf-export.png`.

---

### B.8 RealismAggregateCard — post-attempt flagged-Q list

**1. Route segment + URL state**

- Child component, mounted below TransparencyBlock in the right column. Mounts only when `attempt.questions[].realism_flagged_by_me === true` for ≥1 Q.

**2. Components**

- **Scaffold reused:** shadcn `Card`.
- **New in this PR:** `RealismAggregateCard` composer; `RealismFlagRow` (one per flagged Q — Q#, prompt excerpt, testee note, age).
- **Design primitives reused:** eyebrow + mono Q# from `results-additions.jsx:390–432`.

**3. API endpoints consumed**

Reads from `result.questions[]` + the secondary `attempt` query. **User-locked decision (Answer 3): "Consume from AttemptView".** Spec assumes the secondary fetch `GET /v1/attempts/{attempt_id}` surfaces:

```ts
attempt.questions[].question_id: string
attempt.questions[].attempt_position: number
attempt.questions[].prompt_text: string                      // for excerpt
attempt.questions[].realism_flagged_by_me: boolean
attempt.questions[].realism_flag_note?: string               // testee's note from FE-4 flagging
attempt.questions[].realism_flagged_at?: string              // ISO datetime, for relative-age display
```

**§H (b) item 7 verifies these three field surfaces on `AttemptView`.** If absent, the spec escalates to §H (a) (user-authored spec-clarification PR), per the user's bounded "if missing, blocker" caveat on Answer 3.

If the result endpoint inlines these (so the secondary fetch isn't needed), §C.6 explains the de-duplication; spec defaults to two queries because `attempt.questions[]` is the canonical source per FE-4 §C.7 resume semantics.

**4. Form fields**

n/a (read-only aggregate; the during-attempt flagging form lives in FE-4 §B.1).

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `with_flags` | ≥1 `realism_flagged_by_me === true` | Card visible; header "YOU FLAGGED {N} QUESTION(S)" per `results-additions.jsx:390`; row list of `RealismFlagRow` per flagged Q |
| `empty` | Zero flagged | Card hides entirely per `results-additions.jsx:441–457` empty-state rule ("No flags raised this attempt" — design draws it but spec hides; spec follows the design-comment in `results-additions.jsx:436` "hides in production"). |
| `row_with_note` | Per row: `realism_flag_note` non-empty | Row renders: Q# (mono) + prompt excerpt (line-clamp-1) + "Your note · {note}" + "flagged {age}" |
| `row_without_note` | Per row: `realism_flag_note` empty/null | Row renders the above with "(no note)" in muted tone in place of the note |
| `loading` | Secondary `attempt` query in-flight (only fires once `result.status === "complete"`) | Card skeleton (3 rows worth) |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Zero flags hides the card
  Given attempt.questions has no realism_flagged_by_me === true
  Then RealismAggregateCard does not mount
```

```gherkin
Scenario: One flag renders one row
  Given attempt.questions has exactly one realism_flagged_by_me === true
  Then RealismAggregateCard mounts
  And header reads "YOU FLAGGED 1 QUESTION"
  And one RealismFlagRow renders for that Q
```

```gherkin
Scenario: Flag row anchors to ByQuestionCard
  Given a flag row for Q5
  When the testee clicks the row
  Then the ByQuestionCard row with data-question-id matching Q5 scrolls into view
  And the row briefly flashes via the highlight keyframe
```

**7. Edge cases / gotchas**

- **Long testee notes.** `line-clamp-2` truncation on `realism_flag_note`; expand-on-click reveals full text.
- **Relative-age formatting.** `formatRelative(realism_flagged_at)` — "5 minutes ago", "an hour ago". Helper lives at `frontend/src/lib/result/format-relative.ts` (shared with FE-2 / FE-3 if compatible; D.1 unit test).
- **Pluralisation.** "YOU FLAGGED 1 QUESTION" vs "YOU FLAGGED 3 QUESTIONS". Helper handles singular/plural.
- **Re-fetching after `complete`.** Secondary `attempt` query has no `refetchInterval` — once the page reaches `complete`, the flagged set is stable. If the testee re-flags from another tab during the attempt (rare), the aggregate is stale; refresh resolves.
- **Card empty-state design exists but spec hides it.** The `RealismCardEmpty` at `results-additions.jsx:441–457` is shown in the design sheet but the design comment at line 436 says "hides in production". Spec follows the production rule.

**8. Visual reference**

- `results-additions.jsx:302–340` — `RealismFeedbackSheet` (the design's variant strip).
- `results-additions.jsx:387–438` — `RealismCardWithFlags` (the in-spec variant).
- `results-additions.jsx:441–457` — `RealismCardEmpty` (design-only; spec hides).
- `results-additions.jsx:460–489` — `RealismFlagToast` (lives in FE-4 during-attempt flow, NOT FE-6; referenced here for cross-link).
- Screenshot: `v6-fe6-16-realism.png`.

---

## C. Cross-page concerns

### C.1 Shared components introduced this PR

Eight new files under `frontend/src/components/result/`:

```
frontend/src/components/result/
├── result-hero.tsx              # B.2
├── review-banner.tsx            # B.2 sub
├── by-pill-card.tsx             # B.3
├── pill-weakness-row.tsx        # B.3 sub
├── by-question-card.tsx         # B.4
├── question-grade-row.tsx       # B.4 sub
├── ai-review-chip.tsx           # B.4 sub
├── adaptive-loop-card.tsx       # B.5
├── loop-step-row.tsx            # B.5 sub
├── transparency-block.tsx       # B.6
├── realism-aggregate-card.tsx   # B.8
├── realism-flag-row.tsx         # B.8 sub
├── pdf-export-button.tsx        # B.7
└── review-status-dot.tsx        # shared (B.2 + B.4)
```

Total 14 new files. AC-CD-level structural addition under `SESSION_START.md:86–96` carve-out (cluster under one new domain folder, well-rationalised against existing AC-CDs).

### C.2 `attemptQueryKeys` library — consumed unchanged

`frontend/src/lib/queries/attempts.ts` (FE-4 §C.5) already defines `attemptQueryKeys.result(id)` and `attemptQueryKeys.detail(id)`. FE-6 consumes both unchanged — no new keys, no edit to the key library. The `refetchInterval` policy lives at the page-level `useQuery` call-site per AC-CD21 (TanStack Query is "co-located with caller", not abstracted into per-key option blocks).

### C.3 Helper libraries introduced

New files under `frontend/src/lib/result/`:

```
frontend/src/lib/result/
├── format-delta.ts                  # signed-float → tone + sign helper (B.2)
├── format-relative.ts               # ISO datetime → "5 minutes ago" (B.8)
├── parse-content-disposition.ts     # Content-Disposition filename extractor (B.7)
└── scroll-to-question.ts            # anchor-link helper (B.6 + B.8)
```

Each carries a D.1 unit test.

### C.4 Pattern A / B / C in the results context

- **Pattern A — inline error:** not used (no inline forms; results page is read-only).
- **Pattern B — toast:** PDF export success/error toasts (B.7). The during-attempt realism-flag toast lives in FE-4, not FE-6.
- **Pattern C — boundary:** `(testee)/attempts/[attemptId]/result/error.tsx` for initial fetch failures. Copy: "Couldn't load these results." + "Try again" (resets boundary) + "Go to dashboard" routes to `/`. Mirrors FE-3 §C.6 / FE-4 §C.6 pattern.

### C.5 Route guard posture (AC-CD20)

Testee role only. Admin role → `/403` per the AC-CD20 five-posture matrix locked in FE-1 §C.4. Privacy-unacked user → `/privacy`. The `(testee)` route group's `layout.tsx` (FE-2 / FE-3) handles both. FE-6 ships no admin variant of the route (FE-9 territory).

### C.6 Inter-page dependencies

- **FE-4 → FE-6.** `GradingOverlay` dismisses on `result.status === "complete"`; `router.push('/attempts/[attemptId]/result')`; the file FE-6 builds out exists today as FE-4's "FE-6 pending" placeholder. Edit-in-place per §H (c) item 18.
- **FE-6 → FE-3.** AdaptiveLoopCard CTAs route to FE-3 pill detail (`/pills/[pillId]`); safety-pill CTAs route external (no FE-3 page involved); re-test CTA routes to `/pills/[pillId]?practice=true` (FE-3 entry point, blocked on LD3 pill→test resolver — inherited blocker from FE-3 §H (b) item 3 / FE-4 §H (a) item 2).
- **FE-6 → FE-7.** No direct hand-off. Constellation / competency profile (FE-7) doesn't link from the result page in v1; the testee navigates to it from the (testee) shell rail.
- **FE-6 → FE-9.** "Defer" CTA on the retest row (B.5) is a v1 no-op; the deferral mechanism lands in FE-9 admin operations. Surfaced as §E.1 placeholder.

### C.7 Polling cadence policy (user-locked — Answer 2)

- `refetchInterval: 5000` while `status === "review_pending"`; stops on `complete`.
- `refetchOnWindowFocus: true`.
- `refetchIntervalInBackground: false` (TanStack v5 default — backgrounded tab pauses polling; verified §H (b) item 10).
- Past the 60-s ceiling (derived client-side from `submitted_at`), no special client behaviour — poll continues at 5 s indefinitely; copy shifts to "admin will review within ~5 min" per the `review_pending_overdue` state (B.1, B.2). Reconcile cron resolves the row server-side within ~5 min worst case (AC-D19 v1.7 / SPEC.md §8.9).

### C.8 Image / figure stub contracts (per AC-CD24) — unchanged from FE-4 §C.9

ByQuestionCard's row + expand-row thread images through FE-2 primitives. Backend emits `url === null` in v1; FIG badge per `testee.jsx:416–425` renders the badge only, no image body. v1.x visual-content PR lights up rendering.

### C.9 Anchor-link interaction (B.6 + B.8 → B.4)

Both the TransparencyBlock flagged-sub-line and the RealismAggregateCard row click target `#question-{attempt_position}` IDs on ByQuestionCard rows. `scroll-to-question.ts` helper handles smooth-scroll + brief row highlight. Shared anchor pattern documented once here, referenced from B.4 / B.6 / B.8.

---

## D. Test cases (Vitest)

Four-tier test plan per FE-1 / FE-5 precedent.

### D.1 Unit tests (lib + helpers)

- `format-delta.test.ts` — sign + tone mapping (positive → ok, negative → danger, zero → ink-dim, null → "—").
- `format-relative.test.ts` — relative-age formatting against fixed `Date.now()` mock.
- `parse-content-disposition.test.ts` — `attachment; filename="x.pdf"` → `"x.pdf"`; missing header → `null`; quoted-printable encoding fallback.
- `scroll-to-question.test.ts` — calls `scrollIntoView` on the matching DOM node; adds highlight class for 600 ms then removes.
- `review-status-derive.test.ts` — `result.status` + elapsed since `submitted_at` → poll-active + overdue boolean.
- `pdf-export-mutation.test.ts` — `useMutation` happy path: blob → object-URL trigger → revoke; error path: throws ApiError → toast called with retry action.
- `adaptive-loop-relative-date.test.ts` — `queued_for` future → "in N days"; past → "Today"; null → "soon".

### D.2 Page integration tests (Vitest + RTL + MSW)

One scenario per state in B.1 table:

- `result-page-loading.test.tsx` — MSW returns pending response on slow timer; skeleton renders.
- `result-page-pending-to-complete.test.tsx` — MSW fixtures: first poll returns `review_pending`, second poll (after 5 s advanced via fake timers) returns `complete`; assert banner transition + AdaptiveLoopCard mount.
- `result-page-pending-overdue.test.tsx` — fixture: `submitted_at` 90 s ago + status still `review_pending`; assert amber banner + overdue copy.
- `result-page-complete-flagged.test.tsx` — fixture: `review_summary.flagged_count === 1` + `flagged_question_positions === [7]`; assert TransparencyBlock sub-line + ByQuestionCard row #question-7 in `row_ai_flagged`.
- `result-page-complete-deterministic-only.test.tsx` — fixture: all `question_type === "multiple_choice"`; assert TransparencyBlock hidden + hero hint.
- `result-page-complete-benchmark.test.tsx` — fixture: `attempt.test.mode === "benchmark"`; assert AdaptiveLoopCard hidden + competence column hidden.
- `result-page-error.test.tsx` — MSW returns 5xx; assert Pattern C boundary card mounts with "Try again" reset.
- `result-page-role-mismatch.test.tsx` — auth context returns admin role; assert redirect to `/403` (mock router).
- `result-page-pdf-happy.test.tsx` — assert mutation flow + toast.
- `result-page-pdf-gated.test.tsx` — `review_pending` state; click PDF → no mutation; tooltip visible.
- `result-page-pdf-error.test.tsx` — MSW returns 5xx on `/export.pdf`; assert error toast with retry.
- `result-page-realism-aggregate.test.tsx` — fixture: 3 flagged Qs; assert card mounts with 3 rows.
- `result-page-realism-empty.test.tsx` — fixture: zero flagged; assert card not mounted.
- `result-page-anchor-link.test.tsx` — click TransparencyBlock flagged Q anchor; assert scroll-to-question helper called.

### D.3 Round-trip integration test (cross-spec)

`result-page-from-grading-overlay.test.tsx` — FE-4 GradingOverlay dismissal → router push → FE-6 page mount → poll resolution → PDF download. Single test spans FE-4 + FE-6 with MSW handlers for both `/submit` + `/result` + `/export.pdf`. Recorded as FE-4 ↔ FE-6 cross-spec test in §C.6.

### D.4 Playwright E2E (extends FE-4 §D.4)

`results-end-to-end.spec.ts` — full happy-path E2E: login → start attempt → complete → submit → wait for result page → assert hero REVIEW COMPLETE → click "Download PDF" → assert browser download triggered. One E2E covers the testee golden path post-attempt.

### D.5 Existing tests preserved

All FE-1..FE-5 tests must continue passing. FE-4's `result/page.tsx` placeholder test (if any) is replaced by FE-6's tests.

### D.6 Coverage gate (FE_CHECKLIST.md FE-6 rows tick on)

| FE-6 row (`FE_CHECKLIST.md:90–94`) | Satisfied by |
|---|---|
| Results page (score, delta, time, Q-by-Q) | `result-page-pending-to-complete.test.tsx` + `result-page-complete-flagged.test.tsx` + `result-page-from-grading-overlay.test.tsx` |
| AI-grading review-pending state | `result-page-pending-to-complete.test.tsx` + `result-page-pending-overdue.test.tsx` |
| Adaptive loop card + steps | `result-page-complete-flagged.test.tsx` + `result-page-complete-benchmark.test.tsx` |
| PDF export download (Blob URL pattern) | `result-page-pdf-happy.test.tsx` + `result-page-pdf-gated.test.tsx` + `result-page-pdf-error.test.tsx` + `pdf-export-mutation.test.ts` |
| Realism feedback flow (results-page integration of per-Q button) | `result-page-realism-aggregate.test.tsx` + `result-page-realism-empty.test.tsx` |

---

## E. Known placeholders (DO NOT SHIP AS-IS)

| # | Placeholder | Location | Action before production |
|---|---|---|---|
| E.1 | "Defer" CTA on retest row is a v1 no-op | `adaptive-loop-card.tsx` (B.5 `step_retest_queued`) | FE-9 admin operations PR wires the deferral mechanic; tooltip "Deferral lands in a later release" until then |
| E.2 | "queued in N days" copy may render "soon" if `queued_for` absent | `adaptive-loop-card.tsx` (B.5) | §H (b) item 6 confirms `queued_for` is surfaced; if not, the placeholder ships and the v1.x learning-center PR closes it |
| E.3 | Calibration confidence threshold value (`n=20` per AC-D20 prior) | `by-pill-card.tsx` (B.3 tooltip + suffix flip-point) | Build-session opens with a read of `DECISIONS.md` AC-D20 to confirm the threshold value; spec body updates if different |
| E.4 | PDF "typically 3–10s" copy | `pdf-export-button.tsx` (B.7 generating state) | §H (b) item 8 calibrates against real fixture timings; copy adjusts if median diverges materially |
| E.5 | Loop-card explainer route — if Learning Center v1.x route isn't live by FE-6 build time | `adaptive-loop-card.tsx` (B.5 `step_explainer` CTA) | Temporary route to FE-3 pill detail per FE-1 §F.1 Learning Center deferral |

---

## F. Scope additions beyond `fe-specs/FE-6-results.md`

### F.1 New `frontend/src/components/result/*` cluster

14 new files per §C.1. AC-CD-level structural addition under `SESSION_START.md:86–96` (cluster under one new domain folder; well-rationalised against AC-CD19 + AC-CD20 routing model). Folds into the FE-6 build PR's handover.

### F.2 New `frontend/src/lib/result/*` helper cluster

4 helper files per §C.3. AC-CD-level structural addition; folds into handover.

### F.3 `(testee)/attempts/[attemptId]/result/error.tsx` boundary

New file. Pattern C per FE-1 §C.6. Mirrors FE-4 / FE-5 boundary files; folds into handover.

### F.4 Edits to FE-4-owned files

- `frontend/src/app/(testee)/attempts/[attemptId]/result/page.tsx` — replace the FE-4 placeholder body with the FE-6 composition. Direct edit to an FE-4-owned file (the placeholder file). Mirrors FE-5's edit to FE-4's `page.tsx` mode-branch (FE-5 §F.6). Recorded in §H (c) item 18.

### F.5 Edit to FE-2-owned `globals.css` (conditional)

If `@keyframes flash` (anchor-link row-highlight per B.4 `row_anchor_target` state) is absent from FE-2's globals.css, FE-6 adds it. Conditional structural addition; §H (b) item 11 verifies at build-session start. If FE-2 ships it (per the design-ref highlight pattern), no edit needed.

### F.6 No new `attemptQueryKeys` keys

§C.2 — library consumed unchanged. No FE-4 file edit beyond the result placeholder body (F.4).

### F.7 Design-reference completeness note

The cross-walk against `results-additions.jsx` + `testee.jsx` surfaced two design-ref gaps:

1. **Per-Q `confirmed` chip not drawn.** The v6 mock at `testee.jsx:426–428` enumerates three meta-pill variants (`AI graded`, `Partial`, `Admin reviewing`) but no explicit `pending` state and no explicit `confirmed` chip distinct from `AI graded`. The spec's `AiReviewChip` (B.4) introduces the missing variants. User-locked decision Answer 1 commits FE-6 to ship per-Q granularity; spec fills the design gap with new chip primitives composing existing FE-2 `Pill`. Surfaced in §H (c) item 14.

2. **Calibration confidence label not on hero.** The v6 mock surfaces calibration confidence only on the per-pill catalogue card (`testee.jsx:278–280`), not on the result-page hero or by-pill weakness card. Spec extends the catalogue pattern to the results-page by-pill card (B.3) — consistent design treatment. Hero suppresses the label per the mock. Recorded in §H (c) item 20 as an approved spec resolution.

3. **No "REVIEW SKIPPED" state in v1.** The design comment at `results-additions.jsx:136` notes "If review exceeds the 60s ceiling, the card swaps to REVIEW SKIPPED with a quiet note that admin will be notified — that case isn't in v1 scope but the slot stays the same size." Spec aligns: B.1 / B.2 use `review_pending_overdue` state with the "admin will review within ~5 min" copy, not a distinct REVIEW SKIPPED state. v1.x may light up REVIEW SKIPPED once AC-D19 reconcile-cron escalation surfaces are designed.

Three gaps documented; none escalate to §H (a) blocker. The first is filled by FE-6 implementation; the second is an approved spec resolution; the third defers to v1.x.

---

## G. Session 7 onwards — template propagation to FE-7..FE-9

The structure (§0 Context → §A inventory → §B per-page 8-section template → §C cross-page → §D tests → §E placeholders → §F scope-bleed → §G template propagation → §H drift roll-up) is the **template for every subsequent FE-N detail spec**.

Per-phase variances expected and ALLOWED:

- **FE-7 (constellation + history)** — unblocks only after two backend spec-clarification PRs merge on `main`: `GET /v1/attempts` (own-scope, admin-scope variants) and `GET /v1/me/competence`, per `FE_ROADMAP.md:149–152`. §H (a) of FE-7 will pin those two as blockers from the outset. Constellation SVG → larger §F structural-additions block; selected-pill detail card and matrix-view toggle add B-entries; expect 6–8 B-entries.
- **FE-8 (admin authoring suite)** — large surface; may split into multiple files if exceeding ~2500 lines per FE-1 §G precedent. Single editor with mode-conditional sections (lock-in from PR-033 §D2) means one B-entry covers the four test modes, not four separate B-entries.
- **FE-9 (admin operations)** — admin grade-review queue picks up the AC-D19 reconcile-cron flagged rows; touches the same `result.review_summary.flagged_count` data FE-6 surfaces, but from the admin side (adjudicate + override + notify-testee). FE-9 owns the "Defer" CTA wiring (§E.1) and any retest-scheduling admin controls.

Per-phase variances NOT allowed without spec-drift surface:

- Skipping Gherkin acceptance criteria.
- Skipping drift roll-up / verification / blocker callouts.
- Folding test list into per-page sections.
- Inlining query keys in page files (the `attemptQueryKeys` / `pillQueryKeys` library pattern is locked).
- Introducing a new error pattern beyond A/B/C.
- Adding admin variants to testee routes (admin gets its own route group; never branches on role inside a testee page).

---

## H. Spec-drift roll-up (post-review classification)

The cross-walk surfaced 20 candidate items. After review, classified into three groups.

### (a) BLOCKERS for the FE-6 build session — must land before the build session opens

1. **FE-1, FE-2, FE-3, FE-4, FE-5 builds must land first.** FE-6 inherits FE-4's runner + `GradingOverlay` + `attemptQueryKeys` + FE-2 primitives + FE-3 routing. Spec-merged but not built; sequence FE-1 build → FE-2 build → FE-3 build → FE-4 build → FE-5 build → FE-6 build. Inherited blocker pattern from FE-5 §H (a) item 3.

2. **Per-Q `review_verdict` surface on `/result` payload (provisional — escalates only if §H (b) item 3 finds the field missing).** User Answer 1 locked per-Q + aggregate granularity. The OpenAPI snapshot describes `result.questions` as `array<object>` with no detail. If `app/schemas.py` confirms `questions[].grade.review_verdict` IS surfaced — the (b) verification item resolves clean — this slot dissolves. If absent, **the FE-6 build session cannot open** until a user-authored spec-clarification PR amends the response shape. Recommended resolution direction: backend already persists `grade_review.ai_verdict` per AC-D19; the spec-clarification PR merely surfaces it on the testee-facing endpoint. **Spec body assumes the field is present; if §H (b) item 3 contradicts at build time, the build session pauses and surfaces.**

3. **Realism flag triple surface on `AttemptView` (provisional — escalates only if §H (b) item 7 finds the fields missing).** User Answer 3 locked consume-from-AttemptView. Spec assumes `attempt.questions[].realism_flagged_by_me` + `realism_flag_note` + `realism_flagged_at`. If absent, user-authored spec-clarification PR per the bounded "if missing, blocker" caveat at Answer 3.

4. **Adaptive loop payload on `/result` (provisional — escalates only if §H (b) item 6 finds the payload missing or on a different endpoint).** Spec assumes `result.adaptive_loop[]` inline. If the loop is on a separate endpoint or doesn't surface for testee role at all, spec body needs revision (different query, separate cache key, separate polling consideration) or spec-clarification PR shifts the contract.

### (b) BUILD-SESSION VERIFICATION TASKS — front-loaded at the start of the FE-6 build session

The build session opens with a verification step before any code lands: read `app/routers/attempts.py`, `app/routers/result.py` (if separate), `app/schemas.py`, `app/domain/grade_review.py`, `app/domain/competence.py`, `app/domain/calibration.py`, and `frontend/openapi/schema.json`. Confirm the assumed contracts.

5. **`AttemptResultResponse` per-Q payload shape.** Spec assumes `result.questions[].grade.{is_correct, points_awarded, points_possible, ai_grader_model?, ai_reasoning?, review_verdict, review_reasoning?, reviewer_model?}` and `result.questions[].{question_id, attempt_position, prompt_text, question_type, response?, has_figure}`. Verify against `app/schemas.py`. If `review_verdict` absent → escalates §H (a) item 2.

6. **`AttemptResultResponse` per-pill payload shape.** Spec assumes `result.pills[].{pill_id, pill_name, subject_id, score_percent, missed_count, total_count, band, competence_estimate?, n, confidence, severity, is_safety_tagged}`. Verify against `app/schemas.py` / `app/domain/calibration.py`. If `confidence` enum is not `"preliminary" | "confident"`, align spec body before build (likely string values; alias to the spec's labels).

7. **`AttemptResultResponse.review_summary` block shape.** Spec assumes `{ai_grader_model, reviewer_model, flagged_count, flagged_question_positions[], review_duration_ms?}`. Verify in `app/schemas.py`. If `review_duration_ms` absent, B.2 omits the "in X.Xs" copy (already noted in B.2 edge case).

8. **`AttemptResultResponse.adaptive_loop` block shape.** Spec assumes `result.adaptive_loop[]` of `{type, target_pill_id?, target_pill_name?, title, description, cta_label, route_href, status, queued_for?, step_down_hint?}`. Verify against `app/domain/competence.py` adaptive-loop step builder. If shape diverges or payload doesn't surface on the testee result endpoint, escalates §H (a) item 4. Also verify the autonomous-vs-admin-reviewed mode surface (B.5 edge case): does `result.adaptive_loop === null` surface a "your admin is reviewing" banner instead?

9. **Realism flag surface on `AttemptView`.** Per §H (a) item 3 — verify `attempt.questions[].realism_flagged_by_me` + `realism_flag_note?` + `realism_flagged_at?`. If absent, escalates.

10. **PDF export latency real-world distribution.** Spec copy "(typically 3–10s)" is illustrative per `FE_ROADMAP.md:133` risk note. Verify at build time against a fixture attempt; if real-world median is materially different, the copy adjusts (E.4).

11. **`Content-Disposition` filename header on `/v1/attempts/{id}/export.pdf`.** Spec assumes backend sets the header. If absent, FE-6 derives `attempt-${attemptId.slice(0,5)}.pdf` client-side per the B.7 mutation contract. Verify in the backend PDF export handler.

12. **`refetchIntervalInBackground` default in TanStack Query v5.** Spec assumes default is `false`. Verify in `@tanstack/react-query` v5 docs at build time. Spec already pins to the default behaviour.

13. **`@keyframes flash` in FE-2's `globals.css`.** Anchor-link row-highlight (B.4 `row_anchor_target`). If absent, FE-6 adds the keyframe — conditional structural addition per F.5.

14. **OpenAPI snapshot freshness.** Verify `frontend/openapi/schema.json` reflects the `/result` endpoint shape at FE-6 build-session start per the PR-033 §H (b) item 14 / FE-5 §H (b) item 11 precedent. If a backend endpoint change ships between FE-5 build and FE-6 build, fold the regen into the FE-6 PR.

15. **Benchmark mode behaviour on the result page.** Spec assumes benchmark attempts (`test.mode === "benchmark"`) suppress the adaptive loop card (AC-D5 + AC-D13) and the calibration confidence label. Verify against `app/domain/attempts.py` benchmark-grading code path. If `result.outcome === "n/a"` is the benchmark signal, align B.2 state table; if a different signal, update spec body.

16. **`result.outcome` enum values.** Spec assumes `"pass" | "fail" | "n/a"`. Verify against `app/schemas.py`. If different (e.g. `"pass" | "fail" | null`), align B.2 state table.

### (c) APPROVED RESOLUTIONS — folded into the FE-6 build PR scope, captured in the build PR's handover

These are not blockers. The spec body above locks the resolution; the build session implements; the build PR's handover records them under the `SESSION_START.md` AC-CD-level structural-additions carve-out.

17. **`refetchInterval: 5000` + `refetchOnWindowFocus: true`** while `status === "review_pending"`; stop on `complete`. Per user Answer 2. Call-site option (no library change); folds into handover.

18. **Per-Q `AiReviewChip` (`confirmed` / `flagged` / `pending` / `n/a`) on AI-graded rows.** Per user Answer 1. Design-ref drift — `confirmed` + `pending` chips not drawn in `results-additions.jsx`; FE-6 fills via a new primitive composing existing FE-2 `Pill`. Folds into handover under design-ref completeness deviation.

19. **Realism aggregate card consumed from `AttemptView` via secondary query.** Per user Answer 3. Conditional on §H (b) item 9 verification.

20. **`(testee)/attempts/[attemptId]/result/error.tsx` Pattern C boundary** for initial fetch failures. Mirrors FE-4 / FE-5 boundary precedent.

21. **14 new component files under `frontend/src/components/result/*`** per §C.1 / §F.1.

22. **4 new helper files under `frontend/src/lib/result/*`** per §C.3 / §F.2.

23. **`/result/page.tsx` replaces FE-4 placeholder** — direct edit to the FE-4-owned file (the placeholder body) on the FE-6 build PR. Mirrors FE-5's edit to FE-4's `page.tsx` mode-branch.

24. **Admin role hitting `/result` → /403** via AC-CD20 layout guard; no admin variant of the page ships in FE-6 (FE-9 territory).

25. **Calibration confidence label confined to B.3 ByPillCard** per the v6 mock; hero suppresses it. Design-aligned resolution per §F.7 item 2.

26. **REVIEW SKIPPED state deferred to v1.x.** Spec uses `review_pending_overdue` with "admin will review within ~5 min" copy past the 60-s ceiling, per §F.7 item 3.

27. **Anchor-link interaction (TransparencyBlock + RealismAggregateCard → ByQuestionCard rows)** via `scroll-to-question.ts` helper + `@keyframes flash` highlight. Shared pattern documented at §C.9.

28. **`useMutation` for PDF export, not `useQuery`.** Keeps button state local; doesn't interfere with the result-page cache. Locked at B.7 mutation contract.

29. **Provider-neutral transparency copy** — model IDs render via `{ai_grader_model}` / `{reviewer_model}` string interpolation; no provider allow-list, no hardcoding. Per AC-CD18.

30. **Anchor-link `data-question-id` attribute on `QuestionGradeRow`.** Stable target for the `scroll-to-question` helper. Locked at B.4 §7 / §C.9.
