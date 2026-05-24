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
| SSE client (fetch-streaming adapter, Last-Event-ID resume) | FE-5 | AC-D25, AC-CD10, AC-CD22 | `frontend/src/lib/api/sse.ts` | missing | — |
| JIT queue UI + arrivedIdx reducer | FE-5 | AC-D25, AC-CD22 | `frontend/src/components/attempt/jit-queue.tsx` | missing | — |
| Streaming progress dots + animations | FE-5 | AC-D25 | progress-dots component | missing | — |
| Terminal `paused` event handling | FE-5 | AC-D11, AC-D25 | attempt hero error state | missing | — |
| Per-Testee + benchmark routing (SSE only in per_testee) | FE-5 | AC-D5, AC-D13, AC-D25 | attempt-mode resolver | missing | — |

## FE-6 — Results + adaptive loop + grade review

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Results page (score, delta, time, Q-by-Q) | FE-6 | AC-D9, AC-D19 | `frontend/src/app/(testee)/attempts/[attemptId]/result/page.tsx` | missing | — |
| AI-grading review-pending state | FE-6 | AC-D19 | per-Q row | missing | — |
| Adaptive loop card + steps | FE-6 | AC-D6 | loop-step component | missing | — |
| PDF export download (Blob URL pattern) | FE-6 | AC-CD6 | result page download link | missing | — |
| Realism feedback flow (results-page integration of per-Q button) | FE-6 | AC-D22 | result page realism summary | missing | — |

## FE-7 — Constellation + history

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Competency constellation SVG | FE-7 | AC-D9, AC-D20, AC-D27 | `frontend/src/components/constellation/*` | missing | — |
| Selected-pill detail card (band, n, confidence, trend, related, CTAs) | FE-7 | AC-D9, AC-D20 | constellation profile page | missing | — |
| Sparkline derived client-side from attempts list | FE-7 | AC-D9 | sparkline component | missing | — |
| Matrix-view toggle | FE-7 | AC-D9 | matrix view component | missing | — |
| Attempt history table | FE-7 | AC-D3 | `frontend/src/app/(testee)/history/page.tsx` | missing | — |
| **Backend dep (must merge before FE-7 opens):** `GET /v1/attempts` (own scope) | FE-7 | (spec-drift PR, user-authored) | backend | missing | — |
| **Backend dep (must merge before FE-7 opens):** `GET /v1/me/competence` | FE-7 | (spec-drift PR, user-authored) | backend | missing | — |

## FE-8 — Admin authoring

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Admin catalogue (pills/subjects/proposals/safety tabs) | FE-8 | AC-D7, AC-D8, AC-D21 | `frontend/src/app/(admin)/catalogue/page.tsx` | missing | — |
| Pill CRUD + safety-override toggle | FE-8 | AC-D7, AC-D21 | pill editor | missing | — |
| Pill-proposal approve/reject (no edit-then-approve in v1) | FE-8 | AC-D8 | proposals tab | missing | — |
| Users CRUD + deactivate/reactivate | FE-8 | AC-D2, AC-D14 | `frontend/src/app/(admin)/users/page.tsx` | missing | — |
| Groups CRUD + membership (system-group immutability) | FE-8 | AC-D15 | `frontend/src/app/(admin)/groups/page.tsx` | missing | — |
| Test authoring (4 modes, **single editor with mode-conditional sections**, question editor, publish/lock/unlock) | FE-8 | AC-D3, AC-D5, AC-D13, AC-D17, AC-D24 | `frontend/src/app/(admin)/tests/*` | missing | — |
| Learning-path authoring | FE-8 | AC-D7 | `frontend/src/app/(admin)/paths/*` | missing | — |
| Assignment authoring (testees + groups, deadline, loop_mode) | FE-8 | AC-D15, AC-D26, AC-D6 | `frontend/src/app/(admin)/assignments/page.tsx` | missing | — |

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
