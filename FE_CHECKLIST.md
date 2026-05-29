# FE_CHECKLIST — Acumen frontend per-phase acceptance & drift checklist (canonical)

> **Companion to** `FE_ROADMAP.md` / `CHECKLIST.md` (backend per-phase) /
> `CODE_SPEC.md` AC-CD19..24 / `SPEC.md` v1.2 / `DECISIONS.md` v1.2. One
> block per FE_ROADMAP phase. A row is ticked only when its **Evidence**
> (test path, command, or artifact) exists.
>
> **Status legend:** `built` — implemented and matches spec, with
> evidence · `partial` — started, incomplete (note what remains) ·
> `missing` — not started.
>
> Status / Evidence are intentionally blank until the phase lands.
>
> **Scope:** frontend only. Backend phases live in `CHECKLIST.md`.

---

## FE-0 — Scaffold & stack lock (PR-032)

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Next.js 15 App Router scaffold + Docker + CI | FE-0 | AC-CD19 | `frontend/` tree, `docker-compose.yml`, `.github/workflows/frontend.yml` | built | PR-032 lands `frontend/`; `pnpm install --frozen-lockfile && pnpm codegen:check && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test --run && pnpm build` green; `handovers/PR-032-frontend-scaffold.md` |
| Typed API client (openapi-typescript + openapi-fetch + unwrap) | FE-0 | AC-CD6, AC-CD19 | `frontend/src/lib/api/*` | built | `frontend/openapi/schema.json`, `frontend/src/types/api.d.ts`, `frontend/src/lib/api/client.ts`; CI drift check via `pnpm codegen:check` |
| Auth context + token storage + refresh coordinator | FE-0 | AC-CD5, AC-CD19 | `frontend/src/lib/auth/*` | built | `frontend/tests/smoke.test.ts` (6 cases) |
| CORS middleware (backend side, supporting frontend) | FE-0 | AC-CD19 | `app/main.py`, `app/config.py` | built | `tests/unit/test_cors.py` (3 cases) |

## FE-1 — Auth surface

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Login page + form (rhf + zod) | FE-1 | AC-D10, AC-CD19, AC-CD21 | `frontend/src/app/(auth)/login/page.tsx`, `frontend/src/lib/auth/forms.ts` | missing | — |
| Password-reset request page | FE-1 | AC-D10 | `frontend/src/app/(auth)/forgot/page.tsx` | missing | — |
| Password-reset consume page (token URL) | FE-1 | AC-D10 | `frontend/src/app/(auth)/reset/[token]/page.tsx` | missing | — |
| Setup-consume page (account activation, token URL) | FE-1 | AC-D2, AC-D10 | `frontend/src/app/(auth)/setup/[token]/page.tsx` | missing | — |
| Privacy-ack gate page | FE-1 | AC-D16 | `frontend/src/app/(authed)/privacy/page.tsx` | missing | — |
| Logout + clear-tokens flow | FE-1 | AC-CD5, AC-CD19 | TopBar avatar menu, `useAuth().logout()` | missing | — |
| Route guards (unauth/authed/role/privacy) | FE-1 | AC-D2, AC-D16, AC-CD20 | `(authed)/layout.tsx`, `(admin)/layout.tsx`, `(testee)/layout.tsx`, `frontend/src/lib/auth/guards.ts` | missing | — |
| Error-envelope display pattern (`applyApiErrorToForm` helper) | FE-1 | AC-CD6, AC-CD21 | `frontend/src/lib/api/form-errors.ts`, toast usage | missing | — |

## FE-2 — App shell + design tokens + role-routing

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Design tokens + theming (paper default) | FE-2 | AC-CD23 | `frontend/src/app/globals.css`, `frontend/tailwind.config.ts` | missing | — |
| App shell — Rail / TopBar / PageHeader | FE-2 | AC-CD20 | `frontend/src/components/shell/*` | missing | — |
| Layout primitives — Stat / BandTag / BandPips / Pill / Icon | FE-2 | AC-D9, AC-D20, AC-CD23 | `frontend/src/components/primitives/*` | missing | — |
| shadcn/ui core install (Button/Card/Input/Select/Dialog/DropdownMenu/Tabs/Toast/Skeleton) | FE-2 | AC-CD19 | `frontend/src/components/ui/*` | missing | — |
| Role-gated route groups + 404/500/loading boundaries | FE-2 | AC-CD20 | `(testee)/*`, `(admin)/*`, `error.tsx`, `not-found.tsx`, `loading.tsx` | missing | — |

## FE-3 — Testee dashboard + catalogue + pill detail

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Testee dashboard layout + widgets | FE-3 | AC-D3, AC-D6, AC-D8, AC-D26 | `frontend/src/app/(testee)/dashboard/page.tsx` | missing | — |
| Today's Reading widget (frontend-only, deterministic by day) | FE-3 | — | `frontend/src/components/dashboard/readings.tsx` | missing | — |
| Catalogue discovery + filters | FE-3 | AC-D7, AC-D8 | `frontend/src/app/(testee)/catalogue/page.tsx` | missing | — |
| Pill detail + learning-material viewer | FE-3 | AC-D8, AC-D21 | `frontend/src/app/(testee)/pills/[pillId]/page.tsx` | missing | — |
| Safety-pill curated-links branch | FE-3 | AC-D21 | same page; branches on `safety_relevant` response | missing | — |
| TanStack Query keys + invalidation conventions | FE-3 | AC-CD21 | `frontend/src/lib/queries/*` | missing | — |

## FE-4 — Attempt flow (non-streaming modes)

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Attempt hero screen layout | FE-4 | AC-D5, AC-D11, AC-D24 | `frontend/src/app/(testee)/attempts/[attemptId]/page.tsx` | missing | — |
| Question rendering (MCQ / TF / matching / short-answer / scenario) | FE-4 | AC-D5 | `frontend/src/components/attempt/question-*.tsx` | missing | — |
| Autosave (debounced) + answer state | FE-4 | AC-D4 | attempt hooks | missing | — |
| Pause overlay + content blanking | FE-4 | AC-D11 | overlay component | missing | — |
| Integrity surface (watermark / focus / copy-paste deterrence) | FE-4 | AC-D4 | overlay component | missing | — |
| Submit confirm + grading-pending state | FE-4 | AC-D19 | submit modal + grading-overlay component | missing | — |
| Resume prompt on stale attempt | FE-4 | AC-D5 | dashboard hook + modal | missing | — |
| Image-rendering scaffold (typed but unrendered) | FE-4 | AC-CD24 | question components accept image-field props, render `null`; `Figure` primitives stubbed | missing | — |
| Benchmark mode sequential walk | FE-4 | AC-D13 | `POST /v1/attempts/{id}/next` wiring | missing | — |
| Flag-realism per-question button | FE-4 | AC-D22 | per-Q flag button | missing | — |

## FE-5 — JIT streaming

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| SSE client (fetch-streaming adapter, Last-Event-ID resume) | FE-5 | AC-D25, AC-CD10, AC-CD22 | `frontend/src/lib/api/sse.ts` | ✅ landed | PR #56 slice 1 — `openAttemptStream` adapter + `parseSseFrames` parser + 32 unit tests covering bearer/Accept headers, cursor precedence, one-reconnect with `Last-Event-ID`, synthetic `reconnect_exhausted` after second failure, clean `close()` exit, `409 not_per_testee` ApiError surface, terminal `done` / `paused (generation_failed)` events. |
| JIT queue UI + arrivedIdx reducer | FE-5 | AC-D25, AC-CD22 | `frontend/src/components/attempt/JITQueue.tsx` | ✅ landed | PR #56 slice 2 — `JITQueue` sidebar + `useStreamingQueue` reducer hook. Per-item state matrix (done / current / ready) sized dynamically from `presentedQuestions.length`; streaming pulse row at the foot while `status === "streaming" \| "connecting"`; mobile-hidden via `hidden md:flex`. Reducer covers `arrivedIdx` advance + refetch invalidation + terminal handling (done / generation_failed / reconnect_exhausted) + enabled gating + `reconnect()`. |
| Streaming progress dots + animations | FE-5 | AC-D25 | progress-dots component | ✅ landed (dynamic-count carve-out) | PR #56 slice 2 — the runner derives queue length from `presentedQuestions.length` dynamically (no `question_count` on `AttemptView` / `TestResponse` in v1), so the "Q2..N generating" cards compress into a single "streaming…" pulse row. `ProgressDots` itself is FE-4 unchanged. Documented in `StreamingRunner.tsx` header. |
| Terminal `paused` event handling | FE-5 | AC-D11, AC-D25 | `frontend/src/components/attempt/SystemGlitchOverlay.tsx` | ✅ landed | PR #56 slice 2 — `SystemGlitchOverlay` with serif "*Connection* issue." headline, expandable code / trace / buffer rows, no pause-budget copy (regression-guarded). Resume CTA branches: `generation_failed` → POST /resume + reconnect; `reconnect_exhausted` → reconnect only. |
| Per-Testee + benchmark routing (SSE only in per_testee) | FE-5 | AC-D5, AC-D13, AC-D25 | attempt-mode resolver | ✅ landed | PR #56 slice 2 — `page.tsx` branches `mode === "per_testee"` to `<StreamingRunner>`; `benchmark` + `frozen` / `hand_authored` unchanged. SSE opened only when `mode === "per_testee" && !attempt.paused && !attempt.submitted_at`. |
| Playwright E2E (happy / reconnect / system-glitch) | FE-5 | AC-D25, AC-CD22 | `frontend/e2e/attempt-per-testee-roundtrip.spec.ts` | ✅ landed | PR #56 slice 3 — full round-trip via Playwright `page.route` + chunked stream fulfillment. |

## FE-6 — Results + adaptive loop + grade review

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Results page (score, delta, time, Q-by-Q) | FE-6 | AC-D9, AC-D19 | `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/result/page.tsx` | ✅ landed | PR #59 slice 2 — ResultHero (stats + ReviewBanner) + slice 3 ByQuestionCard. |
| AI-grading review-pending state | FE-6 | AC-D19 | per-Q row | ✅ landed | PR #59 slice 3 — AiReviewChip (pending / confirmed / flagged) + under_admin_review status, polled via slice 2 useQuery refetchInterval. |
| Adaptive loop card + steps | FE-6 | AC-D6 | loop-step component | ✅ landed | PR #59 slice 4 — AdaptiveLoopCard + LoopStepRow (explainer / external_link_set / retest_queued + step_down_hint). |
| PDF export download (Blob URL pattern) | FE-6 | AC-CD6 | result page download link | ✅ landed | PR #59 slice 5 — PdfExportButton with five states + Content-Disposition filename parsing + Sonner toasts. |
| Realism feedback flow (results-page integration of per-Q button) | FE-6 | AC-D22 | result page realism summary | ✅ landed | PR #59 slice 5 — RealismAggregateCard + RealismFlagRow + AttemptView realism triple surfaced by slice 1's view_attempt extension. |

## FE-7 — Constellation + history

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Competency constellation SVG | FE-7 | AC-D9, AC-D20, AC-D27 | `frontend/src/components/profile/constellation-svg.tsx` | ✅ landed | PR #61 slice 2 — subject-clustered polar layout via `layout-constellation.ts`; band-coloured stars sized by `competence_estimate`; confidence ring length `min(1, n/30)` normalised by `pathLength={100}`; safety mark + selected ring + label-on-gate; edges from `related_pill_ids` de-duped by `p.id < rid`. |
| Selected-pill detail card (band, n, confidence, trend, related, CTAs) | FE-7 | AC-D9, AC-D20 | `frontend/src/components/profile/selected-pill-detail-card.tsx` | ✅ landed | PR #61 slice 3 — first-class consumer of `BandTag` `estimate` + `confidence` pair (FE-2 §B.6); 2-Stat grid + BandPips + Sparkline + related chip row + Practice/Step-up CTAs into FE-3 pill detail. |
| Sparkline derived client-side from attempts list | FE-7 | AC-D9 | `frontend/src/lib/profile/derive-sparkline.ts` + `frontend/src/components/profile/sparkline.tsx` | ✅ landed | PR #61 slice 1 + 3 — helper filters by `pill_id`, sorts asc by `submitted_at`, projects `score_percent/10`, truncates to 6; component renders path + fill + dots, em-dash placeholder for <2 points. |
| Matrix-view toggle | FE-7 | AC-D9 | `frontend/src/components/profile/{view-toggle,matrix-table}.tsx` | ✅ landed | PR #61 slice 2 + 3 — segmented two-button ViewToggle (controlled, aria-pressed); MatrixTable 11-col CSS grid with band-tinted cells filling up to `round(competence_estimate)`, current-difficulty cell at opacity-100 bearing the float; selected row `bg-accent-soft`. |
| Attempt history table | FE-7 | AC-D3 | `frontend/src/components/profile/{history-table,history-row}.tsx` + `frontend/src/app/(authed)/(testee)/history/page.tsx` | ✅ landed | PR #61 slice 4 — When / Pill / Origin / Score / Band / Δcomp columns; `IntersectionObserver` sentinel drives `fetchNextPage`; LOCK-4 long-form origin enum; row click → `/attempts/{id}/result`. |
| **Backend dep:** `GET /v1/attempts` (own scope) | FE-7 | (spec-drift PR, user-authored) | backend | ✅ landed | Merged on `main` ahead of FE-7 open; PR #61 amends the spec body in §B.2 §3 / §H(a) item 3 to LOCK-1 canonical `Page<T>` envelope. |
| **Backend dep:** `GET /v1/me/competence` | FE-7 | (spec-drift PR, user-authored) | backend | ✅ landed | Merged on `main` ahead of FE-7 open; PR #61 backend amendment (LOCK-2 + LOCK-3 expanded + Finding 10) tightens schema to non-nullable estimate, filters tenant + NULL rows, derives `n` from `Attempt` rows. |

## FE-8 — Admin authoring

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Admin catalogue (pills/subjects/proposals/safety tabs) | FE-8 | AC-D7, AC-D8, AC-D21 | `frontend/src/app/(authed)/(admin)/admin/catalogue/page.tsx` | done | PR #65 |
| Pill CRUD + safety-override toggle | FE-8 | AC-D7, AC-D21 | pill editor | done | PR #65 |
| Pill-proposal approve/reject (no edit-then-approve in v1) | FE-8 | AC-D8 | proposals tab | done | PR #65 |
| Users CRUD + deactivate/reactivate | FE-8 | AC-D2, AC-D14 | `frontend/src/app/(authed)/(admin)/admin/users/page.tsx` | done | PR #65 |
| Groups CRUD + membership (system-group immutability) | FE-8 | AC-D15 | `frontend/src/app/(authed)/(admin)/admin/groups/page.tsx` | done | PR #65 |
| Test authoring (3 of 4 modes shipping: per_testee + frozen + hand_authored; benchmark stubbed v1.x N3; **single editor with mode-conditional sections**, 5-type question editor modal, publish/unlock — lock disabled v1 pending /v1/campaigns) | FE-8 | AC-D3, AC-D5, AC-D13, AC-D17, AC-D24 | `frontend/src/app/(authed)/(admin)/admin/tests/*` | done | PR #65 |
| Learning-path authoring | FE-8 | AC-D7 | `frontend/src/app/(authed)/(admin)/admin/paths/*` | done | PR #65 |
| Assignment authoring (testees + groups, deadline, loop_mode; create + delete only, edit dropped per Phase 0 lock) | FE-8 | AC-D15, AC-D26, AC-D6 | `frontend/src/app/(authed)/(admin)/admin/assignments/page.tsx` | done | PR #65 |

## FE-9 — Admin operations

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Ops dashboard (flagged queues, engagement, cost summary, bootstrap status) | FE-9 | AC-D6, AC-D18, AC-D19, AC-D26 | `frontend/src/app/(admin)/ops/page.tsx` | missing | — |
| Grade-review queue split-detail | FE-9 | AC-D19 | `frontend/src/app/(admin)/grade-reviews/page.tsx` | missing | — |
| Admin override action (keep_ai / accept_reviewer / substitute) | FE-9 | AC-D19 | override panel | missing | — |
| Loop queue (autonomous vs admin-reviewed): approve/reject | FE-9 | AC-D6 | `frontend/src/app/(admin)/loops/page.tsx` | missing | — |
| Engagement (sweep + pending list; no per-row nudge in v1) | FE-9 | AC-D26 | `frontend/src/app/(admin)/engagement/page.tsx` | missing | — |
| Cost dashboard (rolling month, by provider/model, budget %, alerts) | FE-9 | AC-D18 | `frontend/src/app/(admin)/cost/page.tsx` | missing | — |
| Anchor calibration (run / flagged / resolve) | FE-9 | AC-D20, AC-D27 | `frontend/src/app/(admin)/calibration/page.tsx` | missing | — |
| System page (bootstrap / drive-ingest / drive-index status / realism aggregate / safety-link check) | FE-9 | AC-D22, AC-D23 | `frontend/src/app/(admin)/system/page.tsx` | missing | — |
