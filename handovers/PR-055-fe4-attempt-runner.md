# Handover — PR-055-fe4-attempt-runner

## PR identifier and link

- PR: #55 · FE-4: attempt runner (frozen + benchmark, non-streaming)
- Link: https://github.com/jaydomains/acumen/pull/55
- Author / session: Claude Code session
  `claude/fe4-attempt-runner-jrhTw`
- Date closed: 2026-05-27

## Phase reference

- ROADMAP phase closed by this PR: **FE-4 — Attempt flow (non-streaming modes)**
  (`FE_ROADMAP.md`).
- Does this PR fully close the phase? **Yes** for the done-when defined
  in `FE_ROADMAP.md`: a `frozen` test can be started → answered →
  autosaved → paused (content blanks) → resumed → next/previous →
  submitted; a `benchmark` test walks question-by-question via
  sequential `POST /v1/attempts/{id}/next`. Several v1.x backend
  follow-ups are filed below as spec drift (per-question response
  rehydration, focus-event endpoint).

## What was built

### Files added (new modules)

Foundation (slice 1a):
- `frontend/src/lib/queries/attempts.ts` — `attemptQueryKeys` +
  `useAttemptView` (parallel attempt + test fetch) + autosave / flag-
  realism / pause / resume / submit / benchmark-next / resolve-and-
  start mutations.
- `frontend/src/lib/attempts/answer-payloads.ts` — discriminated
  union with backend-matching field names (`{choice}` / `{answer}` /
  `{matches}` / `{text}`), `toServerPayload`, type guards.
- `frontend/src/lib/attempts/answers-cache.ts` — localStorage shim
  for the R-a answers rehydration cache.
- `frontend/src/lib/attempts/presented-question.ts` — runtime
  narrowing for the untyped `AttemptView.questions[]` wire shape.
- `frontend/src/lib/attempts/use-attempt.ts` — runner reducer +
  per-question debounce queue + exponential retry + answers-cache
  write-through.
- `frontend/src/lib/attempts/use-integrity.ts` — AC-D4 #1 (DOM
  deterrents) + #3 (tab-switch counter; client-only — no POST).
- `frontend/src/lib/attempts/use-now.ts` — 1Hz pause-aware clock.
- `frontend/src/lib/attempts/resume-detection.ts` — slice-2 resume-
  prompt hook + localStorage `acumen.attempts.inflight` bridge.

UI components (slice 1b + 2):
- `frontend/src/components/attempt/AttemptShell.tsx`
- `frontend/src/components/attempt/AttemptHeaderBand.tsx`
- `frontend/src/components/attempt/AutosaveIndicator.tsx`
- `frontend/src/components/attempt/Watermark.tsx`
- `frontend/src/components/attempt/IntegrityBadge.tsx`
- `frontend/src/components/attempt/ProgressDots.tsx`
- `frontend/src/components/attempt/TimerPill.tsx`
- `frontend/src/components/attempt/FlagRealismButton.tsx`
- `frontend/src/components/attempt/QuestionView.tsx`
- `frontend/src/components/attempt/questions/types.ts`
- `frontend/src/components/attempt/questions/QuestionMCQ.tsx`
- `frontend/src/components/attempt/questions/QuestionTrueFalse.tsx`
- `frontend/src/components/attempt/questions/QuestionMatching.tsx`
- `frontend/src/components/attempt/questions/QuestionShortAnswer.tsx`
- `frontend/src/components/attempt/FrozenRunner.tsx`
- `frontend/src/components/attempt/BenchmarkRunner.tsx` (slice 2)
- `frontend/src/components/attempt/PauseOverlay.tsx` (slice 2)
- `frontend/src/components/attempt/SubmitConfirmModal.tsx` (slice 2)
- `frontend/src/components/attempt/GradingOverlay.tsx` (slice 2)
- `frontend/src/components/dashboard/ResumePrompt.tsx` (slice 2)

Pages (slice 1b + 2):
- `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/page.tsx`
  (mode-branched runner)
- `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/layout.tsx`
- `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/loading.tsx`
- `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/error.tsx`
- `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/result/page.tsx`
  (FE-6-pending placeholder)

shadcn primitives (slice 1a, FE-2 token remap applied):
- `frontend/src/components/ui/alert-dialog.tsx`
- `frontend/src/components/ui/checkbox.tsx`
- `frontend/src/components/ui/radio-group.tsx`
- `frontend/src/components/ui/textarea.tsx`

Playwright introduction (slice 3):
- `frontend/playwright.config.ts`
- `frontend/e2e/attempt-frozen-roundtrip.spec.ts`

Tests added (29 new test files; 399 total tests, +22 since
`main`):
- `frontend/tests/lib/attempts/{answer-payloads,answers-cache,
  presented-question,use-attempt,use-integrity,use-now}.test.{ts,tsx}`
- `frontend/tests/lib/queries/attempts.test.ts`
- `frontend/tests/components/attempt/{QuestionRenderers,Watermark,
  PauseOverlay,SubmitConfirmModal,GradingOverlay}.test.tsx`
- `frontend/tests/components/dashboard/ResumePrompt.test.tsx`
- `frontend/tests/pages/{attempt-runner,attempt-runner-lifecycle}.test.tsx`

### Files changed (existing modules)

- `frontend/src/app/(authed)/(testee)/layout.tsx` — focus-mode
  pathname carve-out: strips Rail + TopBar when pathname starts
  with `/attempts/`.
- `frontend/src/app/(authed)/(testee)/page.tsx` — mounts
  `<ResumePrompt />` above `<HeroStats />`.
- `frontend/src/app/(authed)/(testee)/pills/[pillId]/page.tsx` —
  FE-3 TODO at line 88 replaced with end-to-end pill-CTA wiring:
  `GET /v1/tests/resolve` → `POST /v1/attempts` →
  `setInflightAttemptId` → `router.push(/attempts/<id>)`. 404 → toast
  pointing at admin.
- `frontend/src/lib/queries/index.ts` — barrel-exports
  `attemptQueryKeys` + types.
- `frontend/src/mocks/handlers.ts` — append-only: GET /attempts/{id},
  GET /tests/{id}, GET /tests/resolve, POST /attempts,
  /autosave, /pause, /resume, /submit, /result, /next,
  /flag-realism. Module-scope fixture state + test-only seed helpers.
- `frontend/tests/setup.ts` — resetMockAttemptState in `afterEach`.
- `frontend/tests/pages/pill-detail.test.tsx` — updated for slice-2
  pill-CTA behaviour (was a toast no-op; now resolve+start+push).
- `frontend/package.json` — `@playwright/test@1.60.0` exact; `e2e`,
  `e2e:ui`, `e2e:install` scripts.
- `frontend/pnpm-lock.yaml` — locked.
- `frontend/.gitignore` — Playwright artifact directories.
- `.github/workflows/frontend.yml` — `e2e` job (`needs: checks`)
  with `[skip e2e]` marker on both push commit + PR title.

### Files removed

None.

### Summary of the change

FE-4 ships the entire non-streaming attempt runner. A testee can
now reach `/attempts/<uuid>` (directly or via the pill detail
"Practice at D{n}" CTA), be presented with the focus-mode runner
chrome (watermark + integrity badge + DOM deterrents), answer
five question types with debounced autosave, pause and resume
with content-blanking, submit, see the 4-phase grading overlay
poll for the result, and land on the placeholder result page that
FE-6 will build out. Benchmark-mode attempts walk
question-by-question via `/next` (saving the prior answer via
`/autosave` first since `/next` accepts no body). Resume-prompt
on the dashboard surfaces an in-flight attempt via a localStorage
bridge.

## What was decided in this PR

Plan-mode locked these decisions before any code landed (R-a, F-a
captured below as drift items 1 and 2; the others were absorbed
without needing a spec amendment):

- **R-a (locked at plan time):** localStorage answers cache at
  `acumen.attempts.<id>.answers` is the single-device rehydration
  mechanism for v1; `AttemptView.questions[]` doesn't carry
  `response.answer_payload`. Cross-device durable hydrate filed as
  v1.x backend follow-up.
- **F-a (locked at plan time):** `useIntegrity` tracks tab-switch
  events client-side only; `POST /v1/attempts/{id}/focus-events`
  doesn't exist on the backend. Filed as v1.x backend follow-up.
- **Focus-mode pathname carve-out** lives in `(testee)/layout.tsx`
  (a strict child layout can't strip parent JSX wrappers in Next.js).
  Anchored at FE-4 §C.2 + §H(b)#14.
- **Playwright introduction** (AC-CD-level structural addition per
  AC-CD19 + FE-4 §F.2): `@playwright/test@1.60.0` exact dep,
  `playwright.config.ts`, single-Chromium project, CI `e2e` job
  with `[skip e2e]` marker.
- **Pill-CTA wiring** added in slice 2 since `/v1/tests/resolve`
  shipped between FE-3 and FE-4 sessions. Closes the FE-3 §H(b)
  item 3 TODO.
- **MCQ single-select only** (backend `correct` is a single int
  index — drift item below).

New anchors introduced: none. The existing FE-4 anchor set
(AC-D4, AC-D5, AC-D11, AC-D13, AC-D19, AC-D22, AC-D24, AC-CD19,
AC-CD20, AC-CD21, AC-CD24) covers everything; the structural
additions (Playwright, focus-mode carve-out) ride the AC-CD-level
structural carve-out carve-out from `SESSION_START.md`.

## Drift flags raised and how they were resolved

Surfaced during plan-mode verification; absorbed into the build
(no spec PRs authored mid-session). All recorded here so future
sessions see the divergence.

1. **`AttemptView.questions[]` omits `response.answer_payload`**
   (spec §B.1.7 + §C.7 + §H(b)#4). Backend `view_attempt()`
   (`app/domain/attempts.py:891`) builds questions[] without per-
   question response data. **Resolution (R-a, plan-locked):**
   localStorage answers cache. Cross-device durable hydrate is a
   v1.x backend follow-up — add `response_payload` to
   `AttemptView.questions[]`.

2. **`POST /v1/attempts/{id}/focus-events` doesn't exist** (spec
   §H(b)#7). The `attempt_focus_event` table ships
   (`app/models.py:1097`) but no router serves it.
   **Resolution (F-a, plan-locked):** ship client-only counter;
   IntegrityBadge displays the tab-switch count without POSTing.
   Filed as v1.x backend follow-up — add the endpoint.

3. **`AttemptView` carries `test_id` only, not nested `test.mode`**
   (spec §B.1.1 + §H(b)#5). **Resolution:** `useAttemptView` fires
   a parallel `GET /v1/tests/{test_id}` to obtain `mode` /
   `timed` / `duration_minutes` / `pause_allowance` /
   `max_pause_duration_minutes`. Two queries; acceptable cost.

4. **`AttemptResultResponse.status` is `"ready"`, not `"complete"`**
   as the spec writes (verified `app/schemas.py:598`).
   **Resolution:** GradingOverlay polls until `status === "ready"`.

5. **Answer-payload field names diverge from spec** (verified
   `app/domain/attempts.py:1161` / `:1170` / `:1176`):
   - MCQ: `{choice: number}` (not `choice_id: string`)
   - TF: `{answer: boolean}` (not `value`)
   - matching: `{matches: number[]}` (not `pairs: Record<…>`)
   **Resolution:** `answer-payloads.ts` uses backend field names;
   `toServerPayload` strips the FE-side `type` discriminator
   before POSTing.

6. **MCQ is single-select only** (`app/domain/tests.py:345` —
   `correct` is a single int index). **Resolution:** dropped the
   spec's `multiple_choice_multi` discriminator; RadioGroup only.

7. **`realism_flagged_by_me` not surfaced on questions**
   (spec §H(b)#10). **Resolution:** FE seeds an empty Set; clicks
   record locally; reload re-shows idle state. Acceptable v1 per
   spec.

8. **`live` test mode is NOT in FE_ROADMAP / FE_CHECKLIST**
   (spec §H(a)#1 claimed it was; `grep -n "\blive\b"` returns no
   actual `live` test-mode reference). Blocker (a)#1 was a phantom;
   no placeholder branch shipped.

9. **`POST /v1/attempts/{id}/next` accepts no body** (verified
   `api.d.ts:5679 — requestBody?: never`). **Resolution
   (Gitar-flagged + fixed mid-build):** BenchmarkRunner now fires
   `/autosave` for the current question BEFORE `/next` (and
   before `/submit`) — without this, benchmark answers exist only
   in ephemeral component state.

## Open questions deferred to a later phase

- **`POST /v1/attempts/{id}/focus-events` backend endpoint.**
  When added, wire `useIntegrity` to POST tab-switch + visibility
  events.
- **`response_payload` on `AttemptView.questions[]`.** When added,
  swap the localStorage rehydration cache for the wire-driven
  version (cross-device durable).
- **Pill→test find-or-generate** (`POST /v1/tests/generate`).
  When added, replace the 404 toast in pill-CTA with a generate +
  start round-trip.
- **Result page UI** (FE-6 territory).
  `/attempts/[attemptId]/result/page.tsx` is a placeholder.
- **Cross-device resume** waits on `GET /v1/attempts` consumption
  (the endpoint exists; FE-7 wires the history list and could
  retire the localStorage inflight bridge).

## Build state vs spec

### Complete
- Frozen + hand_authored runner end-to-end: load → render Q1..N →
  answer 5 question types → debounced autosave → pause/resume with
  content-blanking → submit → grading overlay → result placeholder.
- Benchmark runner: sequential walk via `/next`, autosave-before-
  next ensures answers persist, submit + grading overlay with
  benchmark-mode copy.
- Pill-detail "Practice at D{n}" wired end-to-end.
- Resume prompt on dashboard via localStorage bridge.
- Watermark + DOM deterrents + IntegrityBadge tab-switch counter.
- Image fields typed and piped through FE-2's null-returning
  `Figure` / `ChoiceFigure` stubs (AC-CD24).
- Playwright happy-path E2E in CI.

### Partial / placeholders
- **Result page** (`/attempts/[attemptId]/result`) — placeholder
  copy only; FE-6 builds the real UI.
- **Focus events** — local counter only; no POST until backend
  endpoint lands.
- **Resume-prompt cross-device** — single-device only.
- **per_testee mode** — placeholder card pointing at FE-5.

### Stubbed
- Image rendering everywhere via FE-2's `Figure` stubs — backend
  emits `null` URLs in v1; visual-content sweep is v1.x.

## Test coverage and CI results

- Tests added / changed: see "Files added" above. 22 new tests
  across hooks, queries, primitives, page integrations, and the
  Playwright E2E. **399 Vitest tests + 1 Playwright spec passing.**
- Regression tests pinning Gitar-flagged fixes:
  - `answerStartedAt` reset after autosave (slice 1 fix-round 1).
  - Benchmark autosave-before-next (slice 2 fix-round 2).
- CI result at merge: all 11 checks green (Vitest, typecheck,
  lint, format, codegen drift, build, Docker build, Playwright
  e2e, migration-chain × 2, Gitar review).
- Manual verification performed: ran `pnpm e2e` locally; full
  happy-path round-trip executes in ~10s.

## Post-merge validation considerations

- This PR touches frontend-only code. The
  `frontend/Dockerfile`-built image does NOT bind-mount source —
  the stale-image trap from `SESSION_START.md` applies. Post-
  merge local validation requires
  `docker compose build --no-cache acumen-frontend` before
  re-running `docker compose up` to see the runner.
- Local verify sequence:
  ```
  cd frontend
  pnpm install --frozen-lockfile
  pnpm codegen:check
  pnpm typecheck
  pnpm lint
  pnpm format:check
  pnpm test --run            # 399 tests
  pnpm build
  pnpm e2e:install           # one-time Chromium download
  pnpm e2e                   # 1 spec, ~10s
  ```
- Smoke against a real backend: spin up the FastAPI dev server,
  log in as a testee, click "Practice at D5" on any non-safety
  pill — the runner mounts, autosaves, allows pause/resume,
  submit → grading → result placeholder.

## Anything a fresh Claude Code session needs to pick up cleanly

- **Required reading beyond SESSION_START.md:**
  `fe-specs/FE-4-runner.md` (the per-page spec FE-5/FE-6 inherit
  from), and this handover for the locked drift decisions.
- **Environment / setup notes:** Playwright Chromium binaries
  download to `~/.cache/ms-playwright` (cached in CI per
  pnpm-lock hash). First-time local `pnpm e2e:install` downloads
  ~290 MiB.
- **MSW handler-order trap:** `resolveTestHandler` MUST come
  before `getTestHandler` in `frontend/src/mocks/handlers.ts`'s
  export array — `/v1/tests/resolve` matches both routes (the
  latter as `:test_id`). Inline comment in handlers.ts documents
  this; preserve the ordering invariant in any future append.
- **Mutation refs pattern (FrozenRunner + BenchmarkRunner):**
  React Query's `useMutation` returns a fresh object on every
  render. Both runners stash each mutation in a `useRef` so the
  `useCallback` handlers stay referentially stable. Slice 2
  Gitar review fix-round 3 codified this; preserve the pattern in
  FE-5 / FE-6.
- **Per-edit-window `time_ms` invariant:** `useAttempt`'s
  `answerStartedAt` map is cleared in the autosave `finally`
  block so a revision of the same question reports time from its
  own first keystroke, not the original. Slice 1 fix-round 1
  added the regression test; preserve the test if the autosave
  queue gets refactored.
- **Recommended next action:** **FE-5 — JIT streaming runner.**
  The same `/attempts/[attemptId]` route, branched on
  `test.mode === "per_testee"`. FE-5 replaces the FE-5-pending
  placeholder in `page.tsx` and reuses
  `AttemptShell` / `AttemptHeaderBand` / `Watermark` /
  `IntegrityBadge` / `QuestionView` / `useIntegrity` /
  `useNow` / `useAttempt`. The new surface is the SSE client +
  arrived-question queue per AC-CD22.
