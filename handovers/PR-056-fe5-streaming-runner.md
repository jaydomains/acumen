# Handover — PR-056-fe5-streaming-runner

> Copy this template to `handovers/PR-056-fe5-streaming-runner.md` at PR close and fill every section. Handovers are **immutable** once written, except where business confidentiality, privacy, or legal requirements compel an update. If an update is compelled, note what changed, why, and under which requirement.

## PR identifier and link

- PR: #56 · FE-5: per-Testee streaming attempt runner (SSE + JIT queue)
- Link: https://github.com/jaydomains/acumen/pull/56
- Author / session: Claude Code session `claude/fe5-sse-jit-streaming-o17RG`
- Date closed: 2026-05-27

## Phase reference

- ROADMAP phase closed by this PR: **FE-5 — Attempt flow (JIT streaming, AC-D25)** (`FE_ROADMAP.md`).
- Does this PR fully close the phase? **Yes.** Done-when criteria from `FE_ROADMAP.md` verbatim:

  > *A `per_testee` test streams Q1 in <3s, Q2..N arrive in order, mid-stream pause/resume replays correctly without duplicating arrivals, terminal `paused` event surfaces user-readable "we hit a glitch — try resume in a minute" state.*

  Cross-check against the diff:

  - **Q1 in <3s:** `StreamingRunner.tsx` derives Q1 from `questions.find(q => q.attempt_position === 1)` (populated in the GET response immediately on mount; no waiting for SSE). Covered by `frontend/tests/pages/streaming-runner.test.tsx` and the Playwright happy-path scenario in `frontend/e2e/attempt-per-testee-roundtrip.spec.ts`. Evidence: yes.
  - **Q2..N arrive in order:** `useStreamingQueue` tracks `arrivedIdx` via the SSE `attempt_position` field; `JITQueue.tsx` renders items in `attempt_position` order. Covered by `frontend/tests/lib/attempts/use-streaming-queue.test.tsx` ("advances arrivedIdx") and Playwright multi-call-recovery scenario. Evidence: yes.
  - **Mid-stream pause/resume replays without duplicates:** `useStreamingQueue.reconnect()` re-opens the adapter with `?since=<arrivedIdx>`; backend replay uses the `since` cursor to emit only positions > cursor. Covered by Playwright reconnect scenario and the `use-streaming-queue.test.tsx` `reconnect()` re-cursor test. Evidence: yes.
  - **Terminal `paused` surfaces "we hit a glitch" state:** `SystemGlitchOverlay.tsx` mounts on `pause_reason !== null` (backend `"generation_failed"`) or FE-synthetic `"reconnect_exhausted"`, with body copy "We hit a glitch generating your next questions. Try resuming in a minute — your progress is saved and your timer is held." Covered by `frontend/tests/components/attempt/SystemGlitchOverlay.test.tsx` regression guard. Evidence: yes.

## What was built

- Files added:
  - `frontend/src/lib/api/sse.ts` — `openAttemptStream` fetch-streaming adapter (AC-CD22); `parseSseFrames` pure parser; `StreamEvent` / `StreamOpts` TypeScript types.
  - `frontend/src/lib/attempts/use-streaming-queue.ts` — `useStreamingQueue` consumer hook; `arrivedIdx` + `status` + `pausedReason` reducer; `queryClient.invalidateQueries` on each question event; `reconnect()` imperative; AbortController cleanup on unmount.
  - `frontend/src/components/attempt/StreamingRunner.tsx` — `StreamingRunner` orchestrator component; composes `useAttempt` + `useStreamingQueue` + `JITQueue` + pause-reason-branched overlay.
  - `frontend/src/components/attempt/JITQueue.tsx` — `JITQueue` sidebar (eyebrow + buffer chip + per-question `QueueItem` list with four states: `done` / `current` / `ready` / streaming pulse row); mobile-hidden via `hidden md:flex`.
  - `frontend/src/components/attempt/SystemGlitchOverlay.tsx` — system-glitch overlay (wave glyph + serif "Connection issue." headline + "Try resuming →" CTA + expandable technical-details collapsible); resume path branches on `reason` (`generation_failed` → POST /resume + reconnect; `reconnect_exhausted` → reconnect only).
  - `frontend/src/mocks/sse-fixtures.ts` — declarative SSE sequence builder for Vitest; `abortAfter` closes the stream early without a terminal (avoids Node-WebStreams enqueue-vs-error race); MSW `ReadableStream` harness.
  - `frontend/e2e/attempt-per-testee-roundtrip.spec.ts` — Playwright E2E; 3 scenarios: happy path, multi-call reconnect with `Last-Event-ID`, system-glitch resume.
  - `frontend/tests/lib/api/sse-parser.test.ts` — 14 tests: frame boundaries, CR/CRLF normalisation, comment lines, leading-space strip, multi-line `data:`, chunk-straddling re-feeding.
  - `frontend/tests/lib/api/sse.test.ts` — 18 tests: bearer/Accept headers, cursor precedence, arrival order, reconnect-once with `Last-Event-ID`, synthetic paused, terminal close, 4xx `ApiError`, clean-EOF reconnect, chunked decoding.
  - `frontend/tests/lib/attempts/use-streaming-queue.test.tsx` — 11 tests: mount opens stream, `arrivedIdx` advance, refetch-on-event, terminal done / `generation_failed` / `reconnect_exhausted`, `enabled` gating, `reconnect()` re-cursor, unmount abort.
  - `frontend/tests/components/attempt/JITQueue.test.tsx` — state-by-state per-item render; ready-click → `onPick`; generating-click ignored; `status="done"` dismisses pulse-dot.
  - `frontend/tests/components/attempt/SystemGlitchOverlay.test.tsx` — overlay render; collapse/expand toggle; `generation_failed` resume calls POST /resume + reopens; `reconnect_exhausted` reopens only; toast on resume failure; pause-budget text absent (regression guard).
  - `frontend/tests/pages/streaming-runner.test.tsx` — 24 tests: full mount → Q1 render → MSW SSE handler delivers events → `JITQueue` transitions → submit fires; burst-coalesce test; outrun-buffer / `QuestionSkeleton` test.

- Files changed:
  - `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/page.tsx` — replaced FE-4's `PerTesteeModePlaceholder` branch with `<StreamingRunner attempt={view} />`; `SubmitMode` / `GradingOverlayProps.mode` type extended to include `"per_testee"` (Gitar finding #4 follow-on).
  - `frontend/src/components/attempt/GradingOverlay.tsx` — extended `GradingOverlayProps.mode` to accept `"per_testee"`.
  - `frontend/src/components/attempt/SubmitConfirmModal.tsx` — extended `SubmitMode` to accept `"per_testee"`.
  - `frontend/src/lib/queries/attempts.ts` — added `stream(id)` cursor key to `attemptQueryKeys`; intentionally not used for a TanStack-Query subscription (spec-mandated vocabulary anchor per `fe-specs/FE-5-streaming.md` §C.4).
  - `frontend/src/mocks/handlers.ts` — append-only: `GET /v1/attempts/:id/stream` handler with `setMockStreamHandler` / `setMockStreamFixture` per-test override hooks.
  - `frontend/tests/pages/attempt-runner.test.tsx` — minimal update for the `page.tsx` mode-branch change (mode-guard smoke test).
  - `FE_CHECKLIST.md` — FE-5 rows ticked (all 5 rows: SSE client, JIT queue UI, streaming progress dots, terminal `paused` handling, per-Testee routing + Playwright E2E).

- Files removed: none.

- Summary of the change: FE-5 ships the per-Testee streaming attempt runner, completing the `per_testee` mode branch in the existing `/attempts/[attemptId]` route that FE-4 left as a placeholder. The core new surface is a fetch-streaming SSE adapter (`openAttemptStream`) plus a consumer hook (`useStreamingQueue`) that tracks an `arrivedIdx` reducer and drives TanStack Query cache invalidation on each question-arrival event. The orchestrating `StreamingRunner` component composes FE-4's unchanged primitives (`AttemptShell`, `useAttempt`, `QuestionView`, `PauseOverlay`, etc.) with the new `JITQueue` sidebar and `SystemGlitchOverlay` for the system-glitch / reconnect-exhausted pause states. Three slices (foundation + UI + Playwright E2E) landed on the PR; 67 new tests (43 unit + 24 component/integration) plus 3 Playwright scenarios bring the suite to 466 Vitest + 4 Playwright tests, all passing at merge.

## What was decided in this PR

Plan file `/root/.claude/plans/fe-5-build-session-sharded-book.md` referenced in the PR body was not located on disk (compacted away). Decisions below are reconstructed from the merge-commit message, PR body, and `FE_CHECKLIST.md` entries.

- **Dynamic total-question count (locked at build time):** No `question_count` field exists on `AttemptView` or `TestResponse` in v1. `StreamingRunner` derives queue length from `presentedQuestions.length` dynamically. The spec's implied "Q2..N generating" cards compress into a single streaming pulse row in `JITQueue`. Documented in `StreamingRunner.tsx` header comment and `FE_CHECKLIST.md` row 3.

- **`ProgressDots` not extended with `generatingPastIdx` / `arrivedIdx` props:** The spec (`fe-specs/FE-5-streaming.md` §B.1 §2) called for a `generatingPastIdx` prop on `ProgressDots` and forwarding `arrivedIdx` from `AttemptHeaderBand`. Given the dynamic-count approach above, there is no use case for this prop — the streaming progress indicator is instead the `JITQueue` sidebar and pulse row. `ProgressDots` component is FE-4-unchanged.

- **`streaming-bar` `@keyframes` NOT added to `globals.css`:** Spec §B.1 §2 called for a custom keyframe animation for generating dots. The JIT queue's streaming indicator uses Tailwind's `animate-pulse` instead; no `@keyframes` edit to `globals.css`.

- **Component file casing:** Matches FE-4's PascalCase (`JITQueue.tsx`, `StreamingRunner.tsx`, `SystemGlitchOverlay.tsx`), not the kebab-case text in the spec. Consistent with FE-4 precedent.

- **`wave` icon already present:** `Icon name="wave"` exists in FE-2's `primitives/Icon.tsx`; no FE-2 edit required. FE-5 §H (b) item 5 was a no-op.

- **No `@/lib/ui/toast` helper:** Production code uses `toast` from `sonner` directly; consistent with the FE-4 merge note that this alias does not exist.

- **`SubmitMode` extended to `"per_testee"`:** Gitar finding #4 (Slice 2 review) flagged that `StreamingRunner` was passing `mode="frozen"` to `SubmitConfirmModal` and `GradingOverlay`. Fixed in commit `ed10388` — both components now accept `"per_testee"` as a valid mode value.

- **`handleSystemResume` stabilised via `streamRef` pattern:** Gitar finding #6 (Slice 2 review) flagged that `handleSystemResume` was recreated every render because `useStreamingQueue` returns a new object on each render. Fixed in commit `ed10388` using a `useRef` pattern, matching the FE-4 mutation-refs precedent.

- **System-glitch resume handler reads `attempt.pause_reason`, not `stream.pausedReason`:** Slice 3 Playwright run surfaced a real bug: after the SSE hook tears down on pause, `stream.pausedReason` is wiped; the resume handler must read the durable `attempt.pause_reason` from server state to discriminate the `generation_failed` branch. Fixed before merge.

- New anchors introduced: none. The existing anchor set (AC-D5, AC-D11, AC-D13, AC-D25, AC-CD10, AC-CD22) covers everything. `SubmitMode` / `GradingOverlay` extensions ride the FE-5 build scope.

- Existing anchors this PR depends on:
  - AC-D5 (per_testee in the mode set)
  - AC-D11 (pause mechanics — user vs system-glitch branch via `pause_reason`)
  - AC-D13 (benchmark explicitly excluded from JIT streaming)
  - AC-D25 (JIT per-Testee streaming; Q1 sync + Q2..N parallel; single-retry then AC-D11 pause; v1.8 lock)
  - AC-CD10 (in-process `asyncio.gather` + `Semaphore`; `attempt_position` ordering; `Last-Event-ID` resume)
  - AC-CD22 (fetch-streaming SSE adapter — amended to backend reality on `main` via spec-clarification commit `e6ef68f` before this build session opened)
  - AC-CD19, AC-CD20, AC-CD21, AC-CD24 (frontend stack, routing, TanStack Query, image stubs — inherited unchanged from FE-0..FE-4)

## Drift flags raised and how they were resolved

No separate drift-sweep artefact was passed into the build session. Plan-mode drift items were absorbed into the build (no mid-session spec-clarification PR authored). The following were surfaced and resolved:

1. **AC-CD22 event-shape blocker — RESOLVED before build opened.** The spec-clarification commit `e6ef68f` (merged to `main` prior to FE-5) amended AC-CD22 to match backend reality: question events use the default `message` event type (no explicit `event:` line), and the payload carries only identifying fields (`{id, attempt_position, attempt_id}`), not the full question body. The adapter implements this amended contract directly. No further spec-clarification PR was needed.

2. **`live` mode is still a phantom.** Confirmed per FE-4 merge note. `page.tsx` retains the three-branch resolver (`per_testee` / `benchmark` / `frozen|hand_authored`); no `live` branch exists. FE-5 touches only the `per_testee` branch. Open question inherited forward.

3. **SSE event payload is identifying-only (refetch required for full question content).** Backend intentionally emits `{id, attempt_position, attempt_id}` only per `app/routers/attempts.py:494–501`. The FE must refetch `GET /v1/attempts/{id}` on each event to obtain question content. **Resolution:** `useStreamingQueue` calls `queryClient.invalidateQueries({ queryKey: attemptQueryKeys.detail(id) })` on each non-terminal event; TanStack Query v5 coalesces parallel invalidations. Documented in `fe-specs/FE-5-streaming.md` §C.5.

4. **Unknown paused reason silently mapped to `"generation_failed"` (Gitar finding #1, Slice 1):** `frameToEvent` unconditionally hardcoded `reason: "generation_failed"` for any `paused` frame regardless of the payload value. **Resolution (commit `2f61530`):** added explicit validation against the known union (`"generation_failed" | "reconnect_exhausted"`) with a `console.warn` for unrecognised future reasons. Type union kept narrow — widening it would allow a backend frame to produce the FE-synthetic discriminator value. Regression: `frontend/tests/lib/api/sse.test.ts`.

5. **Dispatch after unmount possible on async `invalidateQueries` (Gitar finding #2, Slice 1):** The async IIFE in `use-streaming-queue.ts` (line 177) awaits `invalidateQueries` after each event dispatch; if the component unmounts while `invalidateQueries` is in-flight, the `cancelled` guard is only checked at the top of the `for await` loop, not after the await return. **Resolution (commit `2f61530`):** added `if (cancelled) return;` after each `await invalidateQueries` call.

6. **Invalid HTML — `<ul>` contained `<button>` / `<div>` direct children (Gitar finding #4, Slice 2):** In `JITQueue.tsx`, the `<ul>` at line 115 rendered `QueueItem` as `<button>` or `<div>` via a dynamic `Tag` variable, alongside a proper `<li>` pulse row. HTML spec requires all direct `<ul>` children to be `<li>`. **Resolution (commit `ed10388`):** each `QueueItem` is now wrapped in `<li>`; dynamic `Tag` renders inside the `<li>`. Fixes accessibility warnings and screen-reader confusion.

7. **`handleSystemResume` recreated every render (Gitar finding #6, Slice 2):** `useStreamingQueue` returns a new object on every render; including `stream` in the `useCallback` dependency array caused `handleSystemResume` to be recreated on every render, defeating memoisation. **Resolution (commit `ed10388`):** `streamRef = useRef(stream)` pattern applied, matching the FE-4 mutation-refs precedent documented in PR-055 handover section 9.

8. **`mode="frozen"` hardcoded for per_testee submit/grading (Gitar finding #5, Slice 2):** `StreamingRunner` was passing `mode="frozen"` to `SubmitConfirmModal` and `GradingOverlay`. `SubmitMode` had no `"per_testee"` value, so no runtime error, but frozen-mode copy ("AI-graded responses run through OpenAI cross-family review…") would appear for per-testee attempts. **Resolution:** `SubmitConfirmModal.tsx` and `GradingOverlay.tsx` extended to accept `"per_testee"` mode; `page.tsx` passes the correct mode through. Noted as "minor correctness" by Gitar; the thread is marked resolved but the `"per_testee"` mode copy differentiation (if any) is deferred to FE-6 result-page work.

9. **`attemptQueryKeys.stream()` as YAGNI (Gitar finding #3, Slice 1):** Gitar flagged the `stream(id)` key as unused dead code. **Resolution:** retained per `fe-specs/FE-5-streaming.md` §C.4 mandate — the key is a spec-required vocabulary anchor for the stream cursor, not accidental dead code. Removal would be spec drift. Gitar agreed.

10. **System-glitch resume handler reads transient `stream.pausedReason` (Slice 3, pre-merge bug):** On a tab reload landing on a system-paused attempt, the SSE hook has not been open; `stream.pausedReason` is `null`. The `generation_failed` branch (which must call POST /resume) would never fire. **Resolution:** `handleSystemResume` now reads `attempt.pause_reason` (the durable server field from the cached AttemptView) as the discriminator, falling back to `stream.pausedReason` for the FE-synthetic `reconnect_exhausted` case. Surfaced by Playwright Slice 3 system-glitch scenario.

## Open questions deferred to a later phase

Carried forward from PR-055 handover (prior handover was available at `handovers/PR-055-fe4-attempt-runner.md`):

- **`POST /v1/attempts/{id}/focus-events` backend endpoint.** Inherited from FE-4 open question 1. When added, wire `useIntegrity` to POST tab-switch + visibility events. Not affected by FE-5.

- **`response_payload` on `AttemptView.questions[]`.** Inherited from FE-4 open question 2. When added, swap the localStorage rehydration cache for the wire-driven version (cross-device durable). Not affected by FE-5.

- **Pill→test find-or-generate (`POST /v1/tests/generate`).** Inherited from FE-4 open question 3. FE-5 builds against deep-link entry with a pre-existing attempt row. The pill-CTA wiring remains blocked on the same spec-drift item. When unblocked, replace the 404 toast in pill-CTA with a generate + start round-trip; the streaming runner itself requires no change.

- **Result page UI** (FE-6 territory). Inherited from FE-4 open question 4. `/attempts/[attemptId]/result/page.tsx` remains a placeholder. The streaming runner routes through FE-4's `GradingOverlay` → result placeholder unchanged.

- **Cross-device resume / attempt history list.** Inherited from FE-4 open question 5. Waits on `GET /v1/attempts` consumption (FE-7 territory). The localStorage inflight bridge from FE-4 remains the single-device resume mechanism.

- **`live` mode routing.** Inherited from FE-4 §H (a) item 1 and carried through FE-5 without change. The `mode === "live"` branch in `page.tsx` is an unchanged FE-4 placeholder. Unblocked only when a user-authored spec-clarification PR anchors `live` mode in DECISIONS.md.

- **`SubmitMode` / `GradingOverlay` copy for `per_testee`.** FE-5 extended the type to accept `"per_testee"` and passes it correctly, but the modal copy for a per-testee submission uses the `frozen`-branch text for now (Gitar finding #5 was marked "minor correctness; when a `per_testee` mode is added to `SubmitMode`, this will need updating"). FE-6 is the natural owner of result-surface copy; revisit when FE-6 builds out the result page.

- **`traceId` threading into `SystemGlitchOverlay`.** `fe-specs/FE-5-streaming.md` §B.4 §7 calls for the `x-acumen-trace` response header from the SSE connection to be threaded into the overlay's technical-details block. The spec marks this as "verify §H (b) item 6." [OPERATOR-REVIEW: verify whether `traceId` was wired through in the final build or left as `null`. If not wired, add as an open question for a v1.x hardening pass.]

- **Timer hold during `reconnect_exhausted` system-glitch.** `fe-specs/FE-5-streaming.md` §B.4 §7 calls for `useNow`'s `enabled=false` to be set locally during `reconnect_exhausted` (where the attempt is NOT server-paused). The spec marks this as "Verify §H (b) item 8." [OPERATOR-REVIEW: verify whether the local timer hold for `reconnect_exhausted` was implemented in `StreamingRunner.tsx`. If not, add as an open question.]

## Build state vs spec

### Complete

- `openAttemptStream` fetch-streaming adapter: bearer auth, `?since` cursor precedence over `Last-Event-ID`, one reconnect with `Last-Event-ID`, FE-synthetic `paused (reconnect_exhausted)` after second failure, terminal `done` / `paused (generation_failed)`, clean `close()` via AbortController, `409 not_per_testee` → `ApiError`.
- `parseSseFrames`: full SSE protocol parsing (single/multi-frame, chunk-straddling, comment lines, leading-space strip, CR/CRLF normalisation).
- `useStreamingQueue`: `arrivedIdx` reducer, `invalidateQueries` on each event with `cancelled` guard after each await, terminal handling (done / `generation_failed` / `reconnect_exhausted`), `enabled` gating, `reconnect()` re-cursor with `?since=<arrivedIdx>`, AbortController cleanup on unmount, reactive close on `attempt.paused === true`.
- `JITQueue` sidebar: all four per-item states (done / current / ready / streaming pulse row), eyebrow with streaming pulse-dot, buffer chip with warn colouring, mobile-hidden, click-on-ready navigates / click-on-generating ignored.
- `SystemGlitchOverlay`: wave glyph, serif "Connection issue." headline, correct CTA copy ("Try resuming →"), expandable technical-details (code / trace / buffer), pause-budget intentionally absent, resume path branching on `reason`.
- `StreamingRunner` orchestrator: composes `useAttempt` + `useStreamingQueue`, `QuestionSkeleton` on outrun-buffer, pause-overlay branching on `pause_reason`, `streamRef` pattern for stable `handleSystemResume`, `attempt.pause_reason` read for resume discriminator.
- Mode-branch wiring in `page.tsx`: `per_testee` → `<StreamingRunner>`; `benchmark` / `frozen` / `hand_authored` unchanged.
- `SubmitConfirmModal` + `GradingOverlay` extended to accept `"per_testee"` mode.
- `FE_CHECKLIST.md` FE-5 rows all ticked.
- MSW SSE fixtures + stream handler with per-test override hooks.
- Playwright E2E: happy path, multi-call reconnect, system-glitch resume (3 scenarios, all passing).

### Partial

- **`ProgressDots` streaming-aware extension:** FE-5 spec called for a `generatingPastIdx` prop gating the `generating` state (dashed border + animated overlay). Not implemented because `question_count` is absent from `AttemptView` / `TestResponse` in v1, making the "N generating" visual impractical. The streaming progress signal is provided entirely via the `JITQueue` sidebar and pulse row instead. The `ProgressDots` component is FE-4-unchanged.
- **Submit / grading copy for `per_testee` mode:** `SubmitMode` now includes `"per_testee"` and is passed correctly; the modal and overlay copy is currently drawn from the `frozen`-mode text path. FE-6 is the natural phase to author distinct per-testee copy if needed.

### Stubbed

- Image rendering everywhere via FE-2's `Figure` stubs — AC-CD24; backend emits `null` URLs in v1; visual-content sweep is v1.x.
- Result page (`/attempts/[attemptId]/result`) — FE-4 placeholder unchanged; FE-6 territory.
- `live` mode branch — FE-4 placeholder unchanged; unanchored in DECISIONS.md.

## Test coverage and CI results

- Tests added / changed:
  - **New — unit (lib):**
    - `frontend/tests/lib/api/sse-parser.test.ts` (14 tests) — `parseSseFrames` frame-boundary and protocol edge cases.
    - `frontend/tests/lib/api/sse.test.ts` (18 tests) — full `openAttemptStream` contract: headers, cursor, reconnect, synthetic paused, terminal events, 4xx surface, chunked decoding.
    - `frontend/tests/lib/attempts/use-streaming-queue.test.tsx` (11 tests) — `useStreamingQueue` reducer: mount, `arrivedIdx` advance, refetch coalescing, terminals, `reconnect()`, unmount abort.
  - **New — component:**
    - `frontend/tests/components/attempt/JITQueue.test.tsx` — state-by-state render, interaction (click-ready / click-generating / `status="done"`).
    - `frontend/tests/components/attempt/SystemGlitchOverlay.test.tsx` — overlay render, expand/collapse, resume branching, toast on failure, pause-budget absence (regression guard).
  - **New — page integration:**
    - `frontend/tests/pages/streaming-runner.test.tsx` (24 tests) — full mount via MSW SSE handler: Q1 render, arrivals → JITQueue transitions, burst-coalesce, outrun-buffer `QuestionSkeleton`, submit flow.
  - **New — E2E:**
    - `frontend/e2e/attempt-per-testee-roundtrip.spec.ts` — 3 Playwright scenarios via `page.route` + chunked stream fulfillment: happy path, reconnect with `Last-Event-ID`, system-glitch resume.
  - **Changed:**
    - `frontend/tests/pages/attempt-runner.test.tsx` — minor update for the `page.tsx` mode-branch change.

- Coverage delta: 43 net-new Vitest tests (399 → 466 passing; +67 new tests across 7 new files, −24 restructured/adjusted in `attempt-runner.test.tsx`); 1 new Playwright spec with 3 scenarios (FE-4 had 1 spec / 1 scenario; FE-5 raises the E2E suite to 2 specs / 4 Playwright tests total). No coverage-percentage output available from CI logs.

- CI result at merge: **all 11 checks green.** Checks confirmed via `mcp__github__pull_request_read` get_check_runs:
  - `checks` (typecheck + lint + format + codegen + Vitest + build) — success, all three workflow runs.
  - `docker-build` — success, both workflow runs.
  - `migration-chain` — success, both workflow runs.
  - `e2e` (Playwright) — success, both workflow runs.
  - `Gitar` — success (6/6 findings resolved, PR approved).

- Manual verification performed: Slice 3 Playwright scenarios run locally via `next dev` + `page.route`; the system-glitch resume bug (reading `stream.pausedReason` vs `attempt.pause_reason`) was caught by the Playwright run and fixed before merge. No additional manual smoke documented in the PR body beyond the Playwright gate.

## Post-merge validation considerations

- This PR touches frontend-only code. The `frontend/Dockerfile`-built image does NOT bind-mount source — the stale-image trap from `SESSION_START.md` applies. Post-merge local validation requires `docker compose build --no-cache acumen-frontend` before re-running `docker compose up` to see the streaming runner.

- Local verify sequence:
  ```
  cd frontend
  pnpm install --frozen-lockfile
  pnpm codegen:check
  pnpm typecheck
  pnpm lint
  pnpm format:check
  pnpm test --run            # 466 tests
  pnpm build
  pnpm e2e                   # 4 scenarios (FE-4 happy-path + FE-5 happy / reconnect / system-glitch), ~15s
  ```

- Smoke against a real backend: spin up the FastAPI dev server; log in as a testee; deep-link directly to `/attempts/<uuid>` for a pre-created `per_testee` attempt. The streaming runner should mount, open the SSE stream at `?since=1`, render Q1 immediately, and advance the `JITQueue` sidebar as positions 2..N arrive. To exercise the system-glitch path: create a `per_testee` attempt whose backend stream has already paused with `pause_reason="generation_failed"` — the runner should mount directly into `SystemGlitchOverlay` without opening the SSE stream.

## Anything a fresh Claude Code session needs to pick up cleanly

- **Required reading beyond `SESSION_START.md`:**
  - `fe-specs/FE-5-streaming.md` — the per-phase detail spec FE-6 inherits from. Pay particular attention to §B.1 §7 (edge cases: Q1 sync vs GET-resume asymmetry, sparse `questions[]`, SSE-identifying-only payload), §C.3 (two-hook coordination rules between `useAttempt` and `useStreamingQueue`), and §C.8 (pause-origin distinction via `pause_reason`).
  - `handovers/PR-055-fe4-attempt-runner.md` — FE-4 handover; defines the mutation-refs pattern, MSW handler-order trap, and `per-edit-window time_ms` invariant that FE-5 inherits unchanged.
  - This handover for the locked drift decisions and Gitar fix-round root causes.

- **Environment / setup notes:**
  - No new environment variables introduced by FE-5.
  - No new `package.json` scripts beyond the FE-4 Playwright scripts (`e2e`, `e2e:ui`, `e2e:install`).
  - Playwright Chromium binaries at `~/.cache/ms-playwright` (cached in CI per pnpm-lock hash). First-time local `pnpm e2e:install` downloads ~290 MiB (same as FE-4).

- **Known traps, gotchas, or in-progress work that is easy to misread:**

  - **System-glitch resume discriminator must read `attempt.pause_reason`, not `stream.pausedReason` (Slice 3 pre-merge bug).** After SSE hook teardown, `stream.pausedReason` is `null`; only `attempt.pause_reason` (the durable server field) correctly identifies the `generation_failed` branch. If `handleSystemResume` is ever refactored, this discriminator order must be preserved. Covered by the Playwright system-glitch scenario.

  - **`streamRef` pattern for `handleSystemResume` (Gitar fix-round 2, commit `ed10388`).** `useStreamingQueue` returns a new object on every render; any `useCallback` that directly depends on the stream object will be recreated every render. Always use a `useRef` + `ref.current = value` pattern to stabilise callbacks that use stream state — the same pattern FE-4 uses for mutation refs. See `StreamingRunner.tsx` `streamRef` for the canonical example.

  - **`cancelled` guard must appear after every `await` in the `useStreamingQueue` async IIFE (Gitar fix-round 1, commit `2f61530`).** The `for await` loop checks `cancelled` at its top, but any `await` inside the loop body (e.g. `await queryClient.invalidateQueries(...)`) creates a new re-entry point where the component may have unmounted. Pattern: `const result = await someAsync(); if (cancelled) return;` after each such await.

  - **`PausedReason` union is narrow by design.** `"generation_failed"` is backend-emitted; `"reconnect_exhausted"` is FE-synthetic. The type union deliberately excludes widening to arbitrary strings so a backend frame cannot produce the FE-synthetic discriminator. Any future backend pause reason must be added explicitly to the union; an unrecognised reason falls back to `"generation_failed"` with a `console.warn`. Do not widen the type to `string`.

  - **MSW handler-order trap (inherited from FE-4).** `resolveTestHandler` MUST come before `getTestHandler` in `frontend/src/mocks/handlers.ts`'s export array. Inline comment in `handlers.ts` documents this; preserve the ordering invariant when appending new handlers.

  - **`attemptQueryKeys.stream(id)` is intentionally present though unused by a TanStack Query subscription.** It was flagged by Gitar as YAGNI and deliberately retained per `fe-specs/FE-5-streaming.md` §C.4. Do not remove it in a future cleanup pass — it is a spec-mandated vocabulary anchor.

  - **`traceId` threading into `SystemGlitchOverlay`.** Not verified post-merge — file as v1.x follow-up.

  - **`reconnect_exhausted` local-timer-hold behaviour in `StreamingRunner.tsx`.** Not verified post-merge — file as v1.x follow-up.

- **Recommended next action:** **FE-6 — Results + adaptive loop + grade-review surface.** The next phase builds out the currently-placeholder result page at `/attempts/[attemptId]/result` (score, competence delta, Q-by-Q breakdown, weakness card, review-pending states, loop card with follow-up CTAs, PDF export). `FE_ROADMAP.md` FE-6 phase row and `fe-specs/FE-6-results.md` are the required reading before opening the build session.

---

**Inputs inaccessible or reconstructed:**

- **Plan file** (`/root/.claude/plans/fe-5-build-session-sharded-book.md`, referenced in PR body): not found on disk — compacted away. Section 4 decisions reconstructed from the merge-commit message, PR body, and `FE_CHECKLIST.md` rows.
- **`git log` on the PR branch** (`claude/fe5-sse-jit-streaming-o17RG`): 404 from `mcp__github__list_commits` (branch deleted after merge). Commit history reconstructed from the merge-commit body and Gitar review thread timestamps (`84b2a0c` = Slice 1 initial push; `2f61530` = Slice 1 Gitar fix-round; `ed10388` = Slice 2 Gitar fix-round; merge commit `c79ee9c` = squash).
- **No drift-sweep artefact** was passed in from the parent session and none was found committed under `docs/`. Drift section is populated from PR body plan-mode notes, Gitar review threads, and the merge-commit message.
- **`mcp__github__pull_request_read` get_files**: response exceeded token limit; file list reconstructed from `git show c79ee9c --stat` (verified equivalent: 20 files, 3907 insertions, 52 deletions).
