# FE_ROADMAP — Acumen frontend phased build plan (canonical, one PR closes one phase)

> **Companion to** `ROADMAP.md` (backend phases) / `CODE_SPEC.md` AC-CD19..24
> (frontend stack + patterns) / `FE_CHECKLIST.md` (per-phase acceptance) /
> `SPEC.md` v1.2 / `DECISIONS.md` v1.2. Auth first → shell → testee golden
> path → admin → polish. **One prompt -> one branch -> one squash PR -> one
> phase.** Each PR closes with a handover from `HANDOVER_TEMPLATE.md`.
>
> Each phase lists **Deliverables**, **Done-when** (objective gate),
> **Anchors** (AC-D product / AC-CD technical), and **Risks**.
>
> **Scope:** frontend only. Backend phases live in `ROADMAP.md`. PR titling
> for frontend phases: `PR-NNN-feN-slug` (e.g. `PR-033-fe1-auth-surface`).

---

## FE-0 — Scaffold & stack lock (already built — PR-032)

**Deliverables:** Next.js 15 App Router scaffold at `frontend/`; pnpm + Node
22 LTS pinned; TypeScript strict + extra flags; Tailwind v4; shadcn/ui
folder reserved; `react-hook-form` + `zod`; TanStack Query v5; OpenAPI
codegen (`openapi-typescript` + `openapi-fetch` + `unwrap()`); auth context
with memory access-token + localStorage refresh-token + 401
refresh-and-retry; CORS middleware backend-side; Docker compose service
`acumen-frontend`; CI workflow `.github/workflows/frontend.yml`.
**Done-when:** `pnpm install --frozen-lockfile && pnpm codegen:check &&
pnpm lint && pnpm format:check && pnpm typecheck && pnpm test --run &&
pnpm build` all green; placeholder home page renders;
`tests/unit/test_cors.py` 3 cases passed.
**Anchors:** AC-CD19.
**Risks:** N/A — built and merged in PR-032.

## FE-1 — Auth surface

**Deliverables:** Login page (rhf + zod); password-reset request page;
password-reset consume page (token URL); setup-consume page (token URL,
admin-created user account activation); privacy-ack gate page + route-guard
middleware (AC-D16); logout + clear-tokens flow; route guards for unauth /
authed / role-mismatch / privacy-unacked postures; error-envelope display
pattern via `applyApiErrorToForm` helper.
**Done-when:** Admin-created user receives setup email → consumes setup
token → sets password → logs in → acknowledges privacy → lands on empty
"you have no assignments yet" dashboard shell. Deactivated user blocked at
login. Privacy-unacked user blocked from non-`/privacy` authed routes.
Role-mismatched user (testee hitting `/ops`) blocked at `/403`.
**Anchors:** AC-D2, AC-D10, AC-D16, AC-CD5, AC-CD19, AC-CD20, AC-CD21.
**Risks:** Setup-consume token UX (testees never authored before in
production); refresh-token race during dual-tab login.

## FE-2 — App shell + design tokens + role-routing

**Deliverables:** Design tokens in `globals.css` per AC-CD23 (paper theme);
shell primitives (`Rail`, `TopBar`, `PageHeader`); layout primitives
(`Stat`, `BandTag`, `BandPips`, `Pill`, `Icon`); shadcn/ui core install
(`Button`, `Card`, `Input`, `Select`, `Dialog`, `DropdownMenu`, `Tabs`,
`Toast`, `Skeleton`); role-gated route groups (`(testee)`, `(admin)`) with
their `layout.tsx` guards; 404 / 500 / loading boundaries per route group.
**Done-when:** Empty testee dashboard renders inside the shell; admin can
role-switch (via account-menu) and land on empty ops page; theme tokens
present in `globals.css`; all shadcn/ui primitives importable.
**Anchors:** AC-D9, AC-D20, AC-CD19, AC-CD20, AC-CD23.
**Risks:** Token naming churn if FE-3 catalogue work surfaces band-display
edge cases; shadcn/ui Tailwind v4 compatibility (verify install path).

## FE-3 — Testee dashboard + catalogue + pill detail

**Deliverables:** Testee dashboard (greeting, stats, assignments list with
start/resume CTAs, recommendations, recent attempts widget gated on the
`GET /v1/attempts` spec-drift PR landing, Today's Reading widget);
catalogue page (search + subject filter + pill cards); pill detail page
(description, difficulty, "practice at D{n}" button); learning-material
viewer (AI explainer for non-safety pills, curated links for safety
pills); TanStack Query keys + invalidation conventions per AC-CD21.
**Done-when:** Testee can browse the catalogue, open a pill, view learning
material, and reach the "start attempt" entry point. Recent attempts
widget either ships behind a feature flag or waits on the
`GET /v1/attempts` spec-drift PR.
**Anchors:** AC-D3, AC-D6, AC-D7, AC-D8, AC-D21, AC-D26, AC-CD19, AC-CD21.
**Risks:** Catalogue filter URL-state vs query-state sync; safety-pill
branch may surface new error-envelope shapes not yet covered.

## FE-4 — Attempt flow (non-streaming modes)

**Deliverables:** Attempt resume prompt; attempt hero screen with
full-screen layout; question rendering for MCQ / true-false / matching /
short-answer / scenario; debounced autosave; pause overlay with
content-blanking per AC-D11; integrity surface (watermark, focus tracking,
copy-paste deterrence per AC-D4); submit confirmation + grading-pending
state; benchmark mode sequential walk via `POST /v1/attempts/{id}/next`;
flag-realism per-question button; image-rendering scaffold per AC-CD24
(question components accept image fields, render null in v1).
**Done-when:** A `frozen`-mode test can be: started → answered → autosaved
→ paused (content blanks) → resumed → next/previous navigated → submitted.
A `benchmark`-mode test walks question-by-question via sequential `next`
calls.
**Anchors:** AC-D4, AC-D5, AC-D11, AC-D13, AC-D19, AC-D22, AC-D24,
AC-CD19, AC-CD24.
**Risks:** Autosave debounce vs network jitter; pause-blanking edge cases
mid-typing; Playwright introduction likely lands here (first E2E-worth
flow).

## FE-5 — Attempt flow (JIT streaming, AC-D25)

**Deliverables:** SSE client per AC-CD22 (fetch-streaming adapter at
`frontend/src/lib/api/sse.ts`); JIT queue UI with `arrivedIdx` reducer;
progress-dots with generating/ready states; streaming animations on
question-arrival; terminal `paused` event surfaces AC-D11 paused UI;
terminal `done` event clears generating-state; per-Testee mode routing
(use SSE only in `per_testee`, sequential `next` in `benchmark`); resume
on disconnect via `Last-Event-ID`.
**Done-when:** A `per_testee` test streams Q1 in <3s, Q2..N arrive in
order, mid-stream pause/resume replays correctly without duplicating
arrivals, terminal `paused` event surfaces user-readable
"we hit a glitch — try resume in a minute" state.
**Anchors:** AC-D5, AC-D11, AC-D13, AC-D25, AC-CD10, AC-CD22.
**Risks:** SSE seam is novel — recommend binding pause at phase opener to
lock the adapter pattern before downstream slices; mid-stream reconnection
edge cases hard to test without real network conditions.

## FE-6 — Results + adaptive loop + grade-review surface

**Deliverables:** Results page (score, competence delta, time-on-test,
Q-by-Q breakdown, weakness card, AC-D19 review-pending → confirmed/flagged
state, cross-family transparency block); adaptive-loop card with step CTAs
(read explainer / skim TDSes / re-test in N days); PDF export download
(`GET /v1/attempts/{id}/export.pdf` via Blob URL); realism feedback button
per AC-D22.
**Done-when:** Submitted attempt → result page renders → AI-graded
responses show "under review" until the reconcile cron resolves them →
loop card surfaces follow-up CTAs that route to learning material or
re-test entry point.
**Anchors:** AC-D6, AC-D9, AC-D19, AC-D22, AC-CD6.
**Risks:** PDF download blocks synchronously on the backend — spinner UX;
review-pending → confirmed transition needs polling or invalidation
strategy.

## FE-7 — Competency constellation + history

**Deliverables:** Competency constellation SVG visualization (stars per
pill positioned by subject, sized by band, ringed by confidence,
edge-connected to related pills); selected-pill detail card (band, n,
confidence, trend sparkline, related pills, "practice now" / "open
explainer" CTAs); matrix-view toggle (alternative table-based view per
D3); attempt history table.
**Done-when:** Testee can view their constellation with selected-pill
detail card, toggle to matrix view, browse paginated history. Sparkline
derived client-side from attempt list.
**Anchors:** AC-D3, AC-D9, AC-D20, AC-D27, AC-CD19.
**Risks:** **Backend dependency** — FE-7 cannot open until two spec-drift
PRs are merged on `main`: (a) `GET /v1/attempts` (testee scope: own
attempts; admin scope: any), (b) `GET /v1/me/competence` (returns all
pills × competence_estimate × band × n × confidence). These land
between FE-6 close and FE-7 open, not in parallel. SVG layout
performance with 100+ pills if catalogue grows.

## FE-8 — Admin authoring suite

**Deliverables:** Admin catalogue (pills / subjects / proposals / safety
tabs); pill CRUD + safety-override toggle; pill-proposal approve/reject
(no edit-then-approve in v1); users CRUD + deactivate/reactivate; groups
CRUD + membership with system-group immutability per AC-D15; **test
authoring with single editor and mode-conditional sections** for the 4
test modes (`frozen`, `per_testee`, `hand_authored`, `benchmark`), question editor
covering all 5 types, publish/lock/unlock; learning-path authoring;
assignment authoring (testees + groups, deadlines, `loop_mode`).
**Done-when:** Admin can: create a subject → create a pill in it →
propose-and-approve a pill → author a test with mixed question types →
assign it to a group → see it appear on testee dashboards.
**Anchors:** AC-D2, AC-D3, AC-D5, AC-D7, AC-D8, AC-D13, AC-D14, AC-D15,
AC-D17, AC-D21, AC-D24, AC-D26, AC-CD19.
**Risks:** Test-authoring data model is the largest single surface —
recommend binding pause after first slice to lock the editor pattern
before duplicating across the 4 modes; assignment-target picker UX
(testees + groups in one selector).

## FE-9 — Admin operations suite

**Deliverables:** Ops dashboard (flagged queues, engagement readout, cost
summary, bootstrap status); grade-review queue with split-detail and
override action (`keep_ai` / `accept_reviewer` / `substitute`); loop
monitor (autonomous vs admin-reviewed queues, approve/reject); engagement
(sweep button + pending list, no per-row nudge in v1); cost dashboard
(AC-D18 — daily bars, budget %, breakdown by provider/model, alerts);
anchor calibration (run + flagged list + resolve); system page
(bootstrap, drive ingest, drive index status, realism aggregate,
safety-link check).
**Done-when:** Admin can: see ops landing → click flagged grade →
adjudicate with override + reason → click engagement → run sweep → click
cost → see month-to-date + alerts → click system → run any cron-equivalent.
**Anchors:** AC-D6, AC-D18, AC-D19, AC-D20, AC-D22, AC-D23, AC-D26,
AC-D27.
**Risks:** Cost-dashboard data shape needs spot-check against backend; loop
monitor's autonomous vs admin queues distinction may surface
finer-grained statuses not yet in the API.

---

## FE-10 — Admin oversight: autonomous-content dashboard + rollback (deferred)

> **Deferred phase — spec authored, build gated.** Surface spec authored in the autonomous-content-generation cycle (PR-D, v1.9 — `fe-specs/FE-10-admin-oversight.md`); the build is **not** scheduled here. Gated on (a) the **AC-CD26** backend (`app/routers/oversight.py` read + rollback API behind E1/E2 execution) merging, and (b) FE-1..FE-9 builds landing first. Couples NS-5 (the FE-phase home for the autonomous-content workstream's admin surface).

**Deliverables:** the retroactive content-oversight admin surface (`/admin/oversight`) — read dashboard (recent publishes over `PublishRecord`, per-item provenance claim→source→tier, confidence + self-review verdicts, source-authority breakdown, low-confidence spot-check) + the rollback matrix actions (per pill / per question / per batch / per source, with the `demoted_sources` source-demotion on per-source rollback) + the relocated AC-D21 safety-tag override.
**Done-when (build phase):** Admin can open `/admin/oversight` → review recent autonomous publishes + provenance + confidence → spot-check a low-confidence sample → roll back a pill / question / batch / source (with reason) → demote a discredited source → retoggle a safety tag.
**Anchors:** AC-CD26 (oversight read + rollback + source-override), AC-D31 (`PublishRecord`), AC-D30 (self-review verdicts), AC-D29 (`GenerationProvenance`), AC-D28 (`demoted_sources`, DS13-a), AC-D21 (safety-tag override), AC-D14 (retract-not-delete), AC-CD5/20/21/23 (admin gate + FE conventions).
**Risks:** build deferred — the read/rollback response shapes need a spot-check against the AC-CD26 backend once executed; no SSE (poll/read surface).

---

## Non-goals (v1 frontend)

- Dedicated Learning Center (progress tracking, lesson sequences,
  recommended-next-pill, bookmarks) — deferred to v1.x. v1 training
  surface is the pill detail page (FE-3) consuming POST
  /v1/pills/{id}/learning-material (PR-031) on page load.

- Dedicated Testee-facing pill recommendations (Recommended-for-you
  dashboard card and any recommendations endpoint) — deferred to v1.x.
  v1 has no AC anchor for recommendations and no backend endpoint; the
  FE-3 dashboard ships without the card. Revisit once a recommendations
  anchor lands.

---

*End of Acumen FE_ROADMAP. Pairs `ROADMAP.md` (backend) one-to-one in
shape and discipline. Frontend stack pinned at AC-CD19; per-phase
patterns at AC-CD20..24.*
