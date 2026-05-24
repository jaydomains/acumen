# FE-4 — Attempt runner (detail spec)

> **Status:** plan-mode authored, ready for build session.
> **Owns:** the attempt runner UI for non-streaming test modes (`frozen` + `benchmark`); resume-prompt hook; per-question realism flag wiring; integrity surface (watermark, deterrents, focus tracking); autosave + pause + submit + grading-pending overlay; image-field typed stubs per AC-CD24.
> **PR target:** `PR-NNN-fe4-runner` (one squash PR closes the build phase per FE_ROADMAP discipline). This doc PR is its own slice.
> **Anchors:** AC-D4 (test integrity — deterrence, focus, watermark, deterministic n-gram overlap base), AC-D5 (per-Testee + frozen + hand_authored + benchmark mode set), AC-D11 (pause mechanics — content-blanking overlay + max_pause_duration + autosave-reuse snapshot per v1.6), AC-D13 (benchmark sequential walk + adaptive difficulty + untimed default), AC-D17 (snapshot at attempt; autosave-flush as the v1.6 mechanism), AC-D19 (review_pending → confirmed/flagged at grading), AC-D22 (per-question realism flag idempotent on (question, testee)), AC-D24 (shuffle seed + randomise_question_order + question_group_id), AC-D26 (engagement_status implications on assignment_id), AC-CD6 (uniform error envelope), AC-CD19 (frontend stack lock), AC-CD20 (routing + role guards), AC-CD21 (TanStack Query + react-hook-form + error envelope), AC-CD24 (image-field typed stubs, render `null` in v1).
>
> This is the **fourth per-page FE detail spec.** Template inheritance: per-page §B from `fe-specs/FE-1-auth.md` (verbatim). Deviating from the template in FE-5+ is itself spec drift.

---

## 0. Context

FE-0 (PR-032) shipped the Next.js 15 / App Router scaffold, the typed `openapi-fetch` client with `unwrap()`, the auth context (memory access + localStorage refresh + 401 dedup-retry), and the OpenAPI codegen pipeline. PR-033 locked AC-CD20..24 (routing/guards, server-state + forms + errors, SSE, theming + primitives, visual-content deferral). FE-1 (PR #38), FE-2 (PR #39), and FE-3 (PR #40) **locked specs but did not ship builds** — the FE-4 build presumes those three builds land first per FE_ROADMAP dependency order. This doc PR is the fourth sibling spec; FE-4 build cannot open until FE-1 + FE-2 + FE-3 builds are merged on `main` (see §H (a) item 3).

**FE-1 spec preconditions for the FE-4 build session:** auth surfaces (`/login`, `/forgot`, `/reset/[token]`, `/setup/[token]`, `/privacy`); `AuthContext` extended with `refresh()` + `setUserPrivacyAck()`; `applyApiErrorToForm` at `frontend/src/lib/api/form-errors.ts`; route guards (`requireAuthed`, `requireRole`, `requirePrivacyAck`) at `frontend/src/lib/auth/guards.ts`; sonner `<Toaster />` + `QueryClientProvider` mounted in `app/layout.tsx`; error patterns A (inline), B (toast), C (boundary).

**FE-2 spec preconditions:** full token system (`globals.css` paper theme, hard corners `--r: 0`, FOUC bootstrap); shell composition (`Rail`, `TopBar`, `PageHeader`, `AvatarMenu`, `ThemeToggle`); primitives at `frontend/src/components/primitives/` — `Stat`, `BandTag`, `BandPips`, `Pill`, `Icon`, plus `Figure` / `InlineFigure` / `ChoiceFigure` typed stubs returning `null` when `url === null` per AC-CD24; shadcn install (Button, Card, Input, Select, Dialog, DropdownMenu, Tabs, Toast, Skeleton); `(testee)/layout.tsx` with role guard; per-route 404 / 500 / loading boundaries.

**FE-3 spec preconditions:** query-key library at `frontend/src/lib/queries/*` (catalogue, pills, me + invalidation helpers); feature-flag module at `frontend/src/lib/flags.ts`; subject colour helper at `frontend/src/lib/catalogue/subjects.ts`; URL-state ↔ filter-state helper at `frontend/src/lib/catalogue/url-state.ts`; cursor-pagination via `useInfiniteQuery`. The dashboard mounts in `(testee)`; FE-4 adds the **resume prompt hook** to that dashboard.

**What FE-4 builds:**

1. **Frozen attempt runner** — `/attempts/[attemptId]` rendered in a **focus-mode route-group carve-out** (no Rail, no TopBar; only watermark + in-attempt header band + question pane + footer nav) per the locked decision in §F.6. Five question-type renderers (MCQ, true-false, matching, short-answer, scenario); debounced autosave (600 ms idle); pause overlay with content-blanking per AC-D11; integrity surface per AC-D4; submit confirm + grading-pending overlay.
2. **Benchmark attempt runner** — same route, branched on `attempt.test.mode === "benchmark"`. Sequential walk via `POST /v1/attempts/{id}/next`. No autosave (saves on `next`); no jump-via-progress-dots; no realism flag button per the design.
3. **Resume prompt** — dashboard hook + modal (`useResumeDetection` + `ResumePrompt`) using a localStorage bridge (`acumen.attempts.inflight`), avoiding the missing `GET /v1/attempts` list endpoint.
4. **Per-question realism flag wiring** — idempotent `POST /v1/attempts/{id}/questions/{qid}/flag-realism` per AC-D22; testee-only.
5. **Integrity surface** — watermark + DOM-level deterrents (right-click, text selection, copy/paste keyboard shortcuts) + tab-focus tracking, per AC-D4 layers #1, #2, #3.
6. **Image-field stubs** — every question-type component types image fields and passes through to FE-2's `Figure` / `InlineFigure` / `ChoiceFigure`; the FE-2 primitives return `null` when `url === null` (v1 default).
7. **Playwright introduction** — first E2E-worth flow per FE_ROADMAP FE-4 risks block. Single happy-path E2E (`frontend/e2e/attempt-frozen-roundtrip.spec.ts`).
8. **Query-key library extension** — `frontend/src/lib/queries/attempts.ts` following the FE-3 §G pattern propagation rule.

**Done-when (verbatim from FE_ROADMAP):** *A `frozen`-mode test can be: started → answered → autosaved → paused (content blanks) → resumed → next/previous navigated → submitted. A `benchmark`-mode test walks question-by-question via sequential `next` calls.*

**Scope boundary — what FE-4 explicitly does NOT ship:**

- **`per_testee` mode JIT/SSE runner.** FE-5 territory (AC-D25 / AC-CD10 / AC-CD22). FE-4's mode branch displays a "not yet supported" placeholder for `per_testee` until FE-5 builds.
- **`live` mode.** Listed in `FE_ROADMAP.md` / `FE_CHECKLIST.md` but unanchored in DECISIONS. Surfaces as §H (a) item 1 — user-authored spec-clarification PR resolves the mode shape (or retires the term as a typo) before FE-4 build opens.
- **Pill detail "Practice at D{n}" entry-point wiring.** FE-3 §H (b) item 3 punted on the pill+difficulty → test resolver. FE-4 inherits as §H (a) item 2 — user-authored spec-clarification PR adds the resolver endpoint. FE-4's runner builds against direct `/attempts/[attemptId]` deep-link entry.
- **Results page rendering.** FE-6 territory. FE-4's GradingOverlay polls `GET /v1/attempts/{id}/result` and routes to `/attempts/[attemptId]/result` (which exists as a placeholder in FE-4; FE-6 builds it out).
- **Attempt history list.** Needs `GET /v1/attempts` which doesn't exist (FE-7 sequencing blocker per PR-033). FE-4's resume prompt uses a localStorage bridge instead — single-device only, documented in §E item 4.
- **In-question image rendering.** Per AC-CD24, FE-2 ships typed stubs that return `null`; FE-4 honors the contract. v1.x visual-content PR (trigger: backend starts emitting non-null image URLs) lights up rendering.
- **PDF export download.** `GET /v1/attempts/{id}/export.pdf` exists but is FE-6 territory.

**Additions to `(testee)/layout.tsx`:** none. FE-4's chrome carve-out is a **child layout** at `(testee)/attempts/[attemptId]/layout.tsx` that overrides the shell — parent's auth + privacy guards inherit via layout composition; Rail + TopBar do not render under that child layout. See §C.2 and §F.6.

---

## A. Page/feature inventory

| # | Capability | Route | Design source | Screenshot |
|---|---|---|---|---|
| 1 | Frozen attempt runner | `/attempts/[attemptId]` (mode=frozen) | `attempt.jsx:47–237` (AttemptScreen, JIT queue sidebar omitted for FE-4) + `attempt.jsx:425–602` (per-type QuestionView) | `01-attempt.png`, `02-attempt.png`, `03-attempt.png` (legacy frozen screenshots accepted as canonical per §F.7) |
| 2 | Benchmark attempt runner | `/attempts/[attemptId]` (mode=benchmark) | `attempt-variants.jsx:97–256` (BenchmarkAttemptScreen) | `v6-fe4-11-benchmark-attempt.png` |
| 3 | Autosave indicator (header-band slot) | n/a (component, shared) | `attempt-variants.jsx:319–432` (AutosaveSheet + AutosaveAtom) | `v6-fe4-12-autosave.png` |
| 4 | Resume prompt (dashboard hook + modal) | mounted by FE-3 dashboard; FE-4 owns the hook + modal | inferred from `FE_CHECKLIST` FE-4 row "Resume prompt on stale attempt" | n/a |
| 5 | Submit confirm modal + grading-pending overlay | in-route components | `attempt.jsx:217–234` (submit) + `attempt.jsx:607–650` (grading) · `attempt-variants.jsx:235–253` (benchmark variants) | embedded in #1 / #2 |
| 6 | Per-question realism flag button | footer-row component | `attempt.jsx:196–198` | embedded in #1 |
| 7 | Integrity surface (watermark + IntegrityBadge + DOM deterrents + focus tracking) | layout-level | `attempt.jsx:87–94` (watermark) + `attempt.jsx:242–269` (IntegrityBadge) | embedded in #1 |
| 8 | Pause overlay (user-initiated) | overlay component | `attempt.jsx:155–171` | embedded in #1 |

> **Note on design-reference completeness (per SESSION_START.md "Design reference completeness check" rule).** `01/02/03-attempt.png` (legacy) cover the frozen runner shape predating the `v6-fe*` naming convention; `v6-fe4-11-benchmark-attempt.png` + `v6-fe4-12-autosave.png` cover benchmark + autosave specifically. No `v6-fe4-*` screenshot exists for the pause overlay, submit confirm modal, grading overlay, or integrity badge popover. Per the FE-3 §F.2 precedent, `attempt.jsx` + `attempt-variants.jsx` are accepted as canonical for those gaps. Recorded in §F.7 so future visual-content sweeps can backfill without re-litigation.

---

## B. Per-page detail specs

> **Template** (used identically for every page; propagates to FE-5..FE-9 verbatim):
> 1. Route segment + URL state
> 2. Components (scaffold reused / new in this PR / shadcn primitive / design primitive)
> 3. API endpoints consumed
> 4. Form fields + zod rules + react-hook-form integration shape (or "n/a — interaction-driven page" with TanStack Query + reducer notes)
> 5. States (every variant from the design state-strip + any extras the wire surfaces)
> 6. Acceptance criteria (Gherkin — each trio maps to one Vitest test)
> 7. Edge cases / gotchas
> 8. Visual reference

### B.1 Frozen attempt runner — `/attempts/[attemptId]` (mode=frozen)

**1. Route segment + URL state**

- File path: `frontend/src/app/(testee)/attempts/[attemptId]/page.tsx`.
- Route group: `(testee)`, with a **child layout** at `frontend/src/app/(testee)/attempts/[attemptId]/layout.tsx` that **overrides the shell** — renders only `{children}` wrapped in `AttemptShell` (watermark + header band). Parent `(testee)/layout.tsx`'s `requireAuthed` + `requirePrivacyAck` + role guard inherit via layout composition; Rail + TopBar do **not** render under this child layout. See §C.2 and §F.6.
- URL params: `attemptId` (uuid path segment).
- Query state: none in v1. (No `?question=N` deep-link; current-question state is local React state seeded from server-returned attempt position.)
- Post-action routing:
  - "Exit" → routes back to dashboard (`/`) after a confirm dialog if unsubmitted answers exist on the current question.
  - "Submit" → opens SubmitConfirmModal; on confirm, POSTs `/submit`, mounts GradingOverlay, polls `/result` until `status !== "review_pending"`, routes to `/attempts/[attemptId]/result` (FE-6 territory).
  - **Mode guard:** if the loaded attempt's `test.mode === "per_testee"` → render the FE-5-pending placeholder. If `mode === "live"` (LD2 blocker still open) → render a "this mode is not yet supported" placeholder.
- Client component (interaction-heavy; reducer-driven state).

**2. Components**

*Scaffold reused (from FE-0 / FE-1 / FE-2 / FE-3 — preconditions per §0):*
- `useAuth()` — `user.name` for watermark text; `user.role` is `testee` per route group guard.
- `client` + `unwrap` from `@/lib/api/client`; `ApiError` from `@/lib/api/errors`.
- sonner `toast` helpers from FE-1's `@/lib/ui/toast`.
- shadcn `Card`, `Button`, `Dialog`, `Skeleton` from FE-2's install.
- `Figure` / `InlineFigure` / `ChoiceFigure` typed stubs from FE-2's `@/components/primitives/figure` (return `null` when `url === null`).
- `Pill`, `Icon` from FE-2 primitives.
- `attemptQueryKeys` from `@/lib/queries/attempts` (new — see §B.5).

*New in this PR (under `frontend/src/components/attempt/`):*
- `AttemptShell` (`attempt-shell.tsx`) — focus-mode container; mounts `Watermark`, `AttemptHeaderBand`, children. No Rail / TopBar.
- `AttemptHeaderBand` (`attempt-header-band.tsx`) — left: Exit button + "ATTEMPT" eyebrow + pill-name + difficulty Pill + "{N} questions · timed" copy. Right: IntegrityBadge + AutosaveIndicator + TimerPill + Pause/Resume button. Below: ProgressDots strip per `attempt.jsx:118–151`.
- `ProgressDots` (`progress-dots.tsx`) — fine-grained per-question strip. States: `current` (var(--ink)), `answered` (var(--ok)), `unanswered` (var(--bg-deep)). Click navigates (frozen only; benchmark disables jump). Width 5 px, 6 px gap per design.
- `TimerPill` (`timer-pill.tsx`) — countdown derived from `useNow` (1 s tick, paused-aware) against `attempt.started_at + test.duration_minutes*60 - attempt.total_pause_duration_seconds - currentPauseWindowElapsed`. Renders as a mono pill chip.
- `IntegrityBadge` (`integrity-badge.tsx`) — chip + hover popover per `attempt.jsx:242–269`. Popover items: watermark, focus tracking, copy/paste blocked, content blanked on pause, n-gram overlap at grading.
- `Watermark` (`watermark.tsx`) — fixed div, aria-hidden, repeating grid (12 rows × 6 reps) of "{user.name} · ACUMEN · {date} · ATTEMPT {attemptId.slice(0,7)}". Memoised against user.name + attemptId (does not re-render on clock tick).
- `QuestionView` (`question-view.tsx`) — dispatcher; switches on `question.type` ∈ { `multiple_choice`, `true_false`, `matching`, `short_answer`, `scenario` }. Composes question prompt + optional `referenceImage` via `Figure` + per-type renderer + footer (realism flag + char counter where applicable).
- Per-type renderers (`questions/`):
  - `QuestionMCQ` (`questions/mcq.tsx`) — shadcn `RadioGroup` (single-select default) or `Checkbox` group (multi-select; verify in §H (b) item 6). Per option: letter, optional `ChoiceFigure`, body text. Selected state: invert ink/bg per `attempt.jsx:485–533`.
  - `QuestionTrueFalse` (`questions/true-false.tsx`) — two side-by-side buttons, capitalised serif, selected state inverts per `attempt.jsx:535–549`.
  - `QuestionMatching` (`questions/matching.tsx`) — left column static; right column shadcn `Select` per row; deterministic shuffle of right side via server-supplied seed (FE renders in order returned). Answer shape `{pairs: Record<leftIdx, rightIdx>}`.
  - `QuestionShortAnswer` (`questions/short-answer.tsx`) — shadcn `Textarea` (minHeight 140 px); footer "AI graded · expected ~{q.expected_seconds}s · then reviewed cross-family" + char counter per `attempt.jsx:555–570`.
  - `QuestionScenario` (`questions/scenario.tsx`) — same as short-answer with minHeight 220 px and "scenario" eyebrow.
- `PauseOverlay` (`pause-overlay.tsx`) — fixed overlay (zIndex 30, bg `color-mix(in oklab, var(--bg) 92%, transparent)`). Centered card per `attempt.jsx:155–171`: "paused" headline (serif-it), AC-D11 copy, Resume button, "N of {max_pause_duration_minutes} pause minutes remaining today" footer. Content beneath remains in DOM (for autosave continuity) but is blanked via the overlay; question-pane visibility is `hidden` to belt-and-braces the integrity rule.
- `SubmitConfirmModal` (`submit-confirm-modal.tsx`) — shadcn `AlertDialog`. Copy per `attempt.jsx:217–234`: eyebrow "Submit attempt", title "Ready to hand this in?", body "You've answered N of M questions. Once submitted, your AI-graded responses run through OpenAI cross-family review before your result is shown — usually 3–6 seconds." (AC-D19 wording). Buttons: "Keep going" (dismiss) + "Submit →" (primary).
- `GradingOverlay` (`grading-overlay.tsx`) — fixed overlay (zIndex 50, backdrop blur). 4-phase progress per `attempt.jsx:607–650`: (i) "Auto-grading deterministic responses · MCQ + T/F + matching", (ii) "AI grading short-answer responses · claude-sonnet-4-5", (iii) "Cross-family review pass · OpenAI gpt-4o-mini · 60s ceiling per AC-D19", (iv) "Computing competence + queueing loop · recency-weighted per AC-D9". Phase timing: 600 ms / 1400 ms / 2400 ms / 3200 ms breakpoints (local animation only). After phase 4, polls `GET /v1/attempts/{id}/result` every 1.5 s until `status !== "review_pending"`, then routes to FE-6 result placeholder.
- `FlagRealismButton` (`flag-realism-button.tsx`) — chip with flag icon, "Flag as unrealistic" copy per `attempt.jsx:196–198`. Hidden in benchmark mode. Mutation: idempotent `POST /v1/attempts/{id}/questions/{qid}/flag-realism`. Local Set seeded from initial fetch (§H (b) item 10 verifies whether the server pre-populates flagged state).
- `AutosaveIndicator` (`autosave-indicator.tsx`) — atom per `attempt-variants.jsx:319–432`. States: `idle` (invisible spacer, width 120 px), `saving` (pulse-dot + "Saving…", ink-3), `saved` (check + "Saved Ns ago", ok colour; client-side relative timestamp updates every 1 s; fades to idle after 5 s), `failed` (x + "Save failed · retry {n}", danger colour). After 3 consecutive failures, escalates to sonner toast + persistent banner (per `attempt-variants.jsx:382–389`).
- `useAttempt` (`use-attempt.ts`) — reducer hook. State: `{ currentIndex, answers: Map<questionId, AnswerPayload>, autosaveState, flaggedQuestions: Set<questionId>, pauseState }`. Actions: `setAnswer`, `advanceTo`, `commitAutosave`, `markPause`, `markResume`, `markFlagged`. Owns the 600 ms debounce per question and the autosave mutation queue.
- `useIntegrity` (`use-integrity.ts`) — installs AC-D4 #1 deterrents on mount (`document.addEventListener('contextmenu', preventDefault)`, `document.body.style.userSelect = 'none'`, copy/paste shortcut suppression via `keydown` capture). Returns cleanup for unmount. Also installs `document.visibilitychange` listener that POSTs focus events (endpoint verified in §H (b) item 7).
- `useNow` (`use-now.ts`) — 1 s interval clock, pauses when `attempt.paused === true`. Source: `Date.now()`.

*shadcn primitives required (in addition to FE-2's install):*
- `RadioGroup` — MCQ single-select.
- `Checkbox` — MCQ multi-select (verify §H (b) item 6).
- `Textarea` — short-answer + scenario.
- `AlertDialog` — submit confirm modal.

Install at build time via `pnpm dlx shadcn@latest add radio-group checkbox textarea alert-dialog`. AC-CD-level structural addition; folds into handover (§F.3).

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/attempts/{attempt_id}` | Fetch on mount; populates `AttemptView` (questions array + Q1 + pause state + per-question answer payloads on resume) | **Implemented.** Response shape locked in `app/schemas.py`; FE narrows on `attempt.test.mode` for frozen vs benchmark branching. |
| `POST /v1/attempts/{attempt_id}/autosave` | Per-question save; body `{question_id, answer_payload?, time_ms?}` → `{status: "ok"}` | **Implemented.** Idempotent on (attempt, question) via `uq_response_attempt_question`; last-write-wins (no etag/version). |
| `POST /v1/attempts/{attempt_id}/pause` | User-initiated pause; empty body → `{status: "paused"}` | **Implemented.** Creates `AttemptPauseEvent` row server-side. |
| `POST /v1/attempts/{attempt_id}/resume` | Resume; empty body → `{status: "resumed"}` | **Implemented.** Lazy auto-resume on `max_pause_duration_minutes` elapsed. |
| `POST /v1/attempts/{attempt_id}/submit` | Finalise; empty body → `AttemptView` (post-submit, `submitted_at` populated) | **Implemented.** Triggers grading for deterministic types + queues AI grading + cross-family review per AC-D18 / AC-D19. **No double-submit guard server-side** — FE disables submit button on click. |
| `GET /v1/attempts/{attempt_id}/result` | Polled post-submit until `status !== "review_pending"` | **Implemented.** F14 gate; returns `status: "review_pending" \| "complete"`, `overall_score`, `outcome`, populated `questions[].grade` once complete. |
| `POST /v1/attempts/{attempt_id}/questions/{question_id}/flag-realism` | Per-question realism flag (AC-D22); empty body → `{realism_flag_id, question_id, testee_id, created}` | **Implemented.** Idempotent via `uq_realism_question_testee`; testee-only (admin 403). |
| `POST /v1/attempts/{attempt_id}/focus-events` | Tab focus / blur events per AC-D4 #3 + AC-D11 v1.6 (`attempt_focus_event` table). **Endpoint shape verification pending** — see §H (b) item 7. | **VERIFY** — backend ships `attempt_focus_event` rows per AC-D11 v1.6 Implications; the API router serving them needs confirmation. If absent, focus events ride on autosave with an `event_kind` discriminator (acceptable v1 trade). |

**4. Form fields + zod rules + react-hook-form integration shape**

n/a — no rhf form. Page is interaction-driven, not form-driven. State machine summary:

- TanStack Query: `useQuery({ queryKey: attemptQueryKeys.detail(attemptId), queryFn: () => unwrap(client.GET("/v1/attempts/{attempt_id}", { params: { path: { attempt_id: attemptId } } })) })`.
- `useAttempt` reducer (see §2). Answer payload TypeScript discriminated union at `frontend/src/lib/attempts/answer-payloads.ts`:

```ts
export type AnswerPayload =
  | { type: "multiple_choice"; choice_id: string }                                  // single-select
  | { type: "multiple_choice_multi"; choice_ids: string[] }                          // multi-select (pending §H (b) item 6)
  | { type: "true_false"; value: boolean }
  | { type: "matching"; pairs: Record<number, number> }                              // leftIdx -> rightIdx
  | { type: "short_answer"; text: string }
  | { type: "scenario"; text: string };
```

- Autosave mutations: `useMutation({ mutationFn: ({question_id, answer_payload, time_ms}) => unwrap(client.POST("/v1/attempts/{attempt_id}/autosave", ...)) })`. Per-question debounce 600 ms via `useAttempt`'s reducer queue (coalesces consecutive writes to the same question).
- Pause / Resume / Submit / Flag-realism: standalone `useMutation` instances; optimistic UI for pause overlay (POST is fire-and-forget UX-wise; on failure → Pattern B toast + un-blank).
- `staleTime: 0` for `attempt.detail` (changes on every interaction); `staleTime: Infinity` for `attempt.result` polling cache (manual invalidation per poll tick).

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `loading` | First render, fetch pending | Skeleton header band + skeleton question pane |
| `ready` | Fetch resolves with `submitted_at === null` and `mode === "frozen"` | Header band populated, current question rendered, autosave indicator idle |
| `autosave:idle` | No pending writes | Invisible spacer in autosave slot |
| `autosave:saving` | Mutation in flight (post-debounce) | Pulse-dot + "Saving…" (ink-3) |
| `autosave:saved` | Mutation resolves 2xx | Check + "Saved Ns ago" (ok); ticks every 1 s; fades to idle after 5 s |
| `autosave:failed` | Mutation throws | x + "Save failed · retry N" (danger); 3 retries with exponential backoff (2/4/8 s); 4th failure → sonner toast + persistent banner |
| `paused` | User clicks Pause; mutation succeeds | PauseOverlay mounted; question pane visibility hidden; timer holds |
| `paused:expired` | `pause_seconds_remaining` reaches 0 on next interaction | Auto-resume; PauseOverlay dismissed; question pane visible; timer resumes; toast "Pause window expired — your test resumed automatically" |
| `submitting` | User confirms submit; mutation in flight | Submit button disabled; spinner; subsequent clicks ignored |
| `grading:phase-0..3` | Local timer post-submit | GradingOverlay 4-phase animation per `attempt.jsx:607–650` |
| `grading:review-pending` | After phase 4, polled `result.status === "review_pending"` | Overlay remains; copy shifts to "Hold on — cross-family review still running…" |
| `grading:complete` | `result.status === "complete"` | Overlay dismisses; router pushes `/attempts/[attemptId]/result` (FE-6 placeholder for v1) |
| `error:fetch` | Initial GET throws | Pattern C boundary at `(testee)/attempts/[attemptId]/error.tsx` |
| `error:autosave-persistent` | 4th consecutive autosave failure | sonner danger toast + persistent banner "Saves are failing — refresh or contact support" |
| `mode-guard:per_testee` | `mode === "per_testee"` | Placeholder card "Streaming attempt mode is coming with FE-5 — for now, contact admin if this was assigned to you." |
| `mode-guard:live` | `mode === "live"` (pending LD2 resolution) | Placeholder card "This test mode is not yet supported in v1." |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Frozen attempt loads and renders Q1
  Given an authenticated testee with a frozen-mode attempt in progress
  When the testee navigates to /attempts/{attemptId}
  Then GET /v1/attempts/{attemptId} fires exactly once
  And the header band renders the pill name, difficulty Pill, and progress dots
  And the question pane renders Q1 with autosave indicator in the idle state

Scenario: Answering an MCQ option fires debounced autosave
  Given the frozen attempt is loaded at Q1 (multiple_choice)
  When the testee clicks option B
  Then no POST /v1/attempts/{attemptId}/autosave fires within 100ms
  And exactly one POST /v1/attempts/{attemptId}/autosave fires by 650ms
  And the request body is { question_id, answer_payload: { type: "multiple_choice", choice_id: "B" }, time_ms }
  And the autosave indicator transitions idle → saving → saved

Scenario: Pause click blanks question content and holds the timer
  Given the frozen attempt is loaded at Q3
  When the testee clicks the Pause button
  Then POST /v1/attempts/{attemptId}/pause fires
  And the PauseOverlay renders with AC-D11 copy
  And the question pane visibility is hidden
  And TimerPill text stops changing

Scenario: Resume restores content and restarts the timer
  Given the frozen attempt is in the paused state
  When the testee clicks "Resume →" in the PauseOverlay
  Then POST /v1/attempts/{attemptId}/resume fires
  And the PauseOverlay dismisses
  And the question pane visibility returns to visible
  And TimerPill resumes ticking from the server-returned remaining seconds

Scenario: Max pause duration auto-resume on next interaction
  Given the attempt has been paused for longer than test.max_pause_duration_minutes
  When the testee returns to the tab and clicks anything
  Then the PauseOverlay dismisses automatically
  And a sonner info toast surfaces "Pause window expired — your test resumed automatically"

Scenario: Submit confirm → grading overlay → result polling → route to result page
  Given the frozen attempt is loaded with at least one answered question
  When the testee clicks the Submit button
  Then the SubmitConfirmModal opens with "Submit attempt" eyebrow
  When the testee clicks "Submit →"
  Then POST /v1/attempts/{attemptId}/submit fires
  And the GradingOverlay renders with phase 0
  And after ~3.2s the overlay reaches phase 4
  And GET /v1/attempts/{attemptId}/result polls every 1.5s
  And when result.status === "complete", the router pushes /attempts/{attemptId}/result

Scenario: Realism flag click is idempotent
  Given the frozen attempt is loaded at any question
  When the testee clicks the "Flag as unrealistic" button
  Then POST /v1/attempts/{attemptId}/questions/{questionId}/flag-realism fires
  And the button toggles to the flagged state
  When the testee clicks the button again
  Then a second POST fires returning created: false
  And the button remains in the flagged state

Scenario: Tab blur during attempt fires a focus event (not during pause)
  Given the frozen attempt is loaded and not paused
  When the tab loses focus
  Then a focus event POSTs to the attempt_focus_event endpoint (per §H (b) item 7)
  When the testee initiates a pause and then loses focus
  Then no focus event POSTs during the pause window

Scenario: Copy and paste keyboard shortcuts are suppressed during the attempt
  Given the frozen attempt is loaded
  When the testee presses Ctrl/Cmd+C or Ctrl/Cmd+V over the question pane
  Then the default behaviour is prevented
  And no system clipboard mutation occurs

Scenario: Watermark renders user name and attempt ID prefix across viewport
  Given the frozen attempt is loaded for a user named "Joana"
  When the page renders
  Then the Watermark contains "Joana · ACUMEN · {date} · ATTEMPT {first-7-chars-of-attemptId}"
  And it spans the viewport via fixed positioning at low opacity

Scenario: Image fields render null per AC-CD24
  Given a question with image fields populated to null on the response
  When the question renders
  Then the Figure / InlineFigure / ChoiceFigure stubs return null
  And the question prompt renders without image placeholders

Scenario: per_testee mode guard placeholder
  Given the attempt response carries mode === "per_testee"
  When the page renders
  Then the FE-5-pending placeholder card renders
  And the AttemptShell does not mount the question pane
```

**7. Edge cases / gotchas**

- **Resume on reload.** GET /v1/attempts/{id} returns the full `AttemptView` with embedded per-question answer payloads on resume (verify exact field path in §H (b) item 4). `useAttempt` rehydrates the answers Map from that on first mount.
- **Network jitter during autosave.** 3 retries with exponential backoff (2/4/8 s) at the mutation level; 4th failure → sonner danger toast + persistent banner. Backend has no etag/version, so last-write-wins is acceptable for v1.
- **Pause overlay must blank content immediately.** Optimistic UI: PauseOverlay mounts before POST /pause resolves; failure surfaces as Pattern B toast and un-blanks. The integrity rule (AC-D11) prefers a false-positive blank over a false-negative non-blank.
- **Submit during pending autosave.** `useAttempt` queues the submit until in-flight autosaves resolve; submit button copy shifts to "Saving final answer…" while the queue drains, then fires submit.
- **Double-submit prevention.** Submit button disables on click; the mutation's `isPending` flag re-disables on every render. No server-side guard exists.
- **Question shuffle.** Server resolves order via `shuffle_seed` (AC-D24); FE renders in the array order returned. FE never sees the seed.
- **Image-field stubs (AC-CD24).** Every question component types image fields and passes them through to FE-2's `Figure` / `InlineFigure` / `ChoiceFigure`. Backend always emits `null` in v1, so the primitives return `null`. Type-checks; no UI surfaces.
- **Watermark performance.** `Watermark` is `React.memo`'d against `[user.name, attemptId, date]`; does NOT re-render on every clock tick. The repeating grid (12 × 6 = 72 text spans) renders once per attempt.
- **AC-D4 deterrent install timing.** `useIntegrity` installs deterrents on `(testee)/attempts/[attemptId]/layout.tsx` mount; cleanup on unmount returns the document to its baseline. Tests must verify cleanup so other route groups aren't affected.
- **Mode branch — `per_testee`.** Routed-here attempts in `per_testee` mode display the FE-5-pending placeholder (do not render the runner). This protects testees from seeing a broken stream-less attempt.
- **`live` mode (LD2 blocker).** Until the spec-clarification PR resolves, FE-4 ships a generic "not yet supported" placeholder for `mode === "live"`. Build session re-evaluates after the blocker resolves.
- **GradingOverlay local animation vs backend timing.** The 4-phase animation timing (600/1400/2400/3200 ms) is purely visual; backend grading may complete faster or slower. The polling-loop drives actual dismissal; the animation is decorative.
- **Realism flag idempotency.** Second click is a no-op server-side (returns `created: false`); UI keeps the flagged state. Do not visually toggle off on second click.
- **Focus event noise.** Spec ships focus tracking active outside pause windows only (per AC-D11 implication). The `useIntegrity` listener checks `attempt.paused` before POSTing.
- **Children of `useNow` should subscribe selectively.** Only TimerPill subscribes; Watermark + IntegrityBadge do not. Avoids 1-Hz re-render of large components.

**8. Visual reference**

- `attempt.jsx:47–237` (AttemptScreen root; JIT queue sidebar at lines 295–403 ignored for FE-4)
- `attempt.jsx:425–602` (QuestionView + per-type renderers)
- `attempt.jsx:155–171` (PauseOverlay)
- `attempt.jsx:217–234` (SubmitConfirmModal)
- `attempt.jsx:607–650` (GradingOverlay)
- `attempt.jsx:87–94` (Watermark)
- `attempt.jsx:242–269` (IntegrityBadge)
- `attempt.jsx:196–198` (FlagRealismButton)
- Screenshots: `01-attempt.png`, `02-attempt.png`, `03-attempt.png` (legacy frozen runner; canonical per §F.7).

---

### B.2 Benchmark attempt runner — `/attempts/[attemptId]` (mode=benchmark)

**1. Route segment + URL state**

Same route as B.1; branched on `attempt.test.mode === "benchmark"`. The same `(testee)/attempts/[attemptId]/layout.tsx` focus-mode carve-out applies.

**2. Components**

Reuses B.1's `AttemptShell`, `AttemptHeaderBand`, `TimerPill` (renders "untimed" when `test.timed === false`), `IntegrityBadge`, `Watermark`, `QuestionView` + per-type renderers, `PauseOverlay` (only if AC-D13 untimed-default verification in §H (b) item 8 allows pause; v1 default ships pause-hidden for benchmark), `SubmitConfirmModal` (distinct copy), `GradingOverlay` (distinct copy), `useAttempt` (reduced state — no debounce; saves on `next`), `useIntegrity`, `useNow` (timer only if `test.timed === true`).

*Benchmark-specific deltas:*
- No `AutosaveIndicator` — benchmark saves on `next` only per `attempt-variants.jsx:387`.
- No `FlagRealismButton` per `attempt-variants.jsx:148–155`.
- `ProgressDots` rendered without jump-on-click (sequential only); states `done` / `current` / `not-arrived` per `attempt-variants.jsx:129–149`.
- `SubmitConfirmModal` copy: eyebrow "Submit benchmark", body "You've answered N of M questions. Benchmarks can't be re-taken — once submitted, your result is locked into the SiteMesh Annual Competency record." per `attempt-variants.jsx:235–250`.
- `GradingOverlay` phase copy: phase 4 reads "Computing benchmark score + bands · no recency weighting (single sitting)" per `attempt-variants.jsx:253`.
- No realism flag button; per-question footer renders only the char counter / type label.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/attempts/{attempt_id}` | Initial fetch; benchmark response includes Q1 only (sequential mode) | **Implemented.** |
| `POST /v1/attempts/{attempt_id}/next` | Sequential walk; empty body → `{done: bool, step?: int, asked?: int, question?: object}` | **Implemented.** Capped at `P4_BENCHMARK_STEP_CAP=5` server-side (verify cap exposure / configurability in §H (b) item 9). |
| `POST /v1/attempts/{attempt_id}/submit` | Finalise; same shape as B.1 | **Implemented.** |
| `GET /v1/attempts/{attempt_id}/result` | Polled post-submit | **Implemented.** |

No autosave, no pause/resume (pause-hidden in benchmark UI in v1), no realism flag.

**4. Form fields + zod rules + react-hook-form integration shape**

n/a — same reducer pattern as B.1, simplified (no autosave queue). Per-question advance: testee answers + clicks "Next" → POST `/next` → updates `useAttempt` with the returned question → renders next.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `loading` | First render | Skeleton |
| `ready` | Q1 fetched | Question pane renders Q1 |
| `submitting-answer` | "Next" click; POST /next in flight | Next button disabled + spinner |
| `awaiting-next` | Between resolution and re-render | Brief skeleton (~200 ms typical) |
| `done` | `next.done === true` | SubmitConfirmModal opens (benchmark copy) |
| `submitting` | Submit confirm; POST /submit in flight | Submit button disabled |
| `grading:phase-0..3` | Post-submit overlay | Benchmark-copy GradingOverlay |
| `grading:complete` | result.status === "complete" | Routes to `/attempts/[attemptId]/result` (FE-6) |
| `error:fetch` / `error:next` | Mutation throws | Pattern C boundary or Pattern B toast |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Benchmark attempt loads Q1
  Given an authenticated testee with a benchmark-mode attempt in progress
  When the testee navigates to /attempts/{attemptId}
  Then the question pane renders Q1
  And the AutosaveIndicator is not rendered
  And the FlagRealismButton is not rendered

Scenario: Next click fires POST /next and renders the returned question
  Given the benchmark attempt is at Q1
  When the testee answers and clicks Next
  Then POST /v1/attempts/{attemptId}/next fires with empty body
  And the response carries { done: false, step: 2, question: { ... } }
  And the question pane re-renders with the new question
  And the ProgressDots advance by one

Scenario: Benchmark final question triggers submit modal
  Given the benchmark attempt is at the last question
  When the testee answers and clicks Next
  Then POST /v1/attempts/{attemptId}/next returns { done: true }
  And the SubmitConfirmModal opens with "Submit benchmark" eyebrow
  And the body reads "Benchmarks can't be re-taken..."

Scenario: Benchmark grading overlay phase 4 reads benchmark copy
  Given the benchmark attempt has been submitted
  When the GradingOverlay reaches phase 4
  Then the phase 4 copy reads "Computing benchmark score + bands · no recency weighting (single sitting)"

Scenario: Pause is unavailable in benchmark mode (v1 default)
  Given the benchmark attempt is loaded
  When the testee inspects the header band
  Then no Pause button is rendered (pending §H (b) item 8 verification)
```

**7. Edge cases / gotchas**

- **No autosave means losing the answer mid-question is permanent for that question.** Acceptable per AC-D13 untimed default + sequential walk; resume hydrates from the previous `next` response (last answered question stays answered).
- **Pause behaviour.** v1 ships pause-hidden in benchmark mode per AC-D13's untimed default. If §H (b) item 8 verification finds pause is genuinely needed, build session adds the Pause button — small change.
- **`P4_BENCHMARK_STEP_CAP=5`.** Server-side cap; FE renders whatever `next.done` says. If the test has more than 5 questions configured, `next.done` returns true at step 5 regardless. Verify in §H (b) item 9.
- **Sequential adaptive difficulty.** Backend picks next question difficulty based on previous outcome (AC-D13); FE renders whatever the server returns. No client-side adaptive logic.
- **No realism flagging in benchmark.** Per design; matches `attempt-variants.jsx:148–155`.
- **Watermark + integrity surface still active.** Benchmarks honour all AC-D4 layers; only the per-question realism flag is dropped (AC-D22 is per-Testee feedback on AI-generated content; benchmarks pull from a pool, not regenerated content).

**8. Visual reference**

- `attempt-variants.jsx:97–256` (BenchmarkAttemptScreen)
- `attempt-variants.jsx:235–250` (SubmitConfirmModal benchmark copy)
- `attempt-variants.jsx:253` (BenchmarkGradingOverlay phase 4 copy)
- Screenshot: `v6-fe4-11-benchmark-attempt.png`.

---

### B.3 Resume prompt — dashboard hook + modal

**1. Route segment + URL state**

- Files: `frontend/src/components/dashboard/resume-prompt.tsx` (modal) + `frontend/src/lib/attempts/resume-detection.ts` (hook).
- Mounted by FE-3 dashboard at `(testee)/page.tsx` (or `(testee)/dashboard/page.tsx` per FE-3 §H (b) item 1).
- No route of its own; renders conditionally above the dashboard hero.

**2. Components**

- `useResumeDetection()` — hook. Reads `acumen.attempts.inflight` from `localStorage`; if present, fires `useQuery({ queryKey: attemptQueryKeys.detail(inflightId) })`. If response carries `submitted_at === null`, returns `{ status: "resumable", attempt }`. If `submitted_at !== null` or fetch fails, clears localStorage silently and returns `{ status: "none" }`.
- `ResumePrompt` — shadcn `Dialog` modal: "Resume {pill name} attempt (started {N minutes ago}) · {answered}/{total} questions answered". Buttons: "Resume →" (routes to `/attempts/[attemptId]`) and "Discard" (clears localStorage, dismisses).
- **localStorage write-path.** FE-3 owns the `POST /v1/attempts` call from pill detail (once LD3 unblocks); FE-3 spec must include the `localStorage.setItem("acumen.attempts.inflight", attemptId)` step on attempt-create success. **Pending FE-3 spec coordination** — surfaced in §H (b) item 13.

**3. API endpoints consumed**

- `GET /v1/attempts/{attempt_id}` — single fetch keyed by the inflight UUID; reuses the same query key as B.1.

**4. Form fields + zod rules + react-hook-form integration shape**

n/a — single modal with two buttons.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `none` | No inflight key in localStorage | Hook returns; modal not rendered |
| `loading` | Inflight key present, fetch in flight | Modal not rendered yet (no flash) |
| `resumable` | Fetch resolves with `submitted_at === null` | Modal renders with attempt summary + Resume/Discard buttons |
| `expired` | Fetch resolves with `submitted_at !== null` (attempt completed in another tab) | localStorage cleared silently; modal not rendered |
| `error` | Fetch throws | localStorage cleared silently; modal not rendered (avoids dead-end modals) |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Dashboard mount with no inflight key
  Given localStorage has no "acumen.attempts.inflight" key
  When the dashboard mounts
  Then the ResumePrompt modal is not rendered
  And no GET /v1/attempts/{attemptId} request fires

Scenario: Dashboard mount with valid inflight attempt
  Given localStorage carries "acumen.attempts.inflight" = "<uuid>"
  And GET /v1/attempts/<uuid> returns submitted_at === null
  When the dashboard mounts
  Then the ResumePrompt modal renders
  And the modal title includes the pill name and "{N minutes ago}"
  And the Resume button routes to /attempts/<uuid>

Scenario: Stale inflight key (attempt completed elsewhere) is cleared silently
  Given localStorage carries "acumen.attempts.inflight" = "<uuid>"
  And GET /v1/attempts/<uuid> returns submitted_at !== null
  When the dashboard mounts
  Then localStorage no longer contains "acumen.attempts.inflight"
  And the ResumePrompt modal is not rendered

Scenario: Discard clears the inflight key without backend call
  Given the ResumePrompt modal is rendered
  When the testee clicks "Discard"
  Then localStorage no longer contains "acumen.attempts.inflight"
  And no POST or DELETE request to /v1/attempts fires
  And the modal dismisses
```

**7. Edge cases / gotchas**

- **Single-device only.** Cross-device resume requires `GET /v1/attempts` (own scope), which is FE-7's blocker. Documented as known limitation in §E item 4.
- **Discard does NOT abandon the attempt server-side.** The attempt stays in-progress on the server; documented in §E item 7. A v1.x backend endpoint could add explicit abandonment.
- **Race with attempt creation.** FE-3's `POST /v1/attempts` success handler must set `localStorage.setItem("acumen.attempts.inflight", attemptId)` synchronously before navigating to the runner. FE-4's runner SHOULD also set the key on mount (defensive; covers direct-link entry).
- **Multiple in-flight attempts not supported.** localStorage holds one key only. If the backend allows multiple concurrent in-flight attempts (verify), this design is incomplete; v1.x could add a per-pill map.

**8. Visual reference**

- No prototype mock; design is straightforward shadcn `Dialog`. Build session matches the dashboard's modal styling (paper card + serif title).

---

### B.4 Per-question realism flag — `FlagRealismButton`

**1. Route segment + URL state**

Component co-located with `QuestionView` (used by B.1 only; hidden in benchmark per B.2).

**2. Components**

- `FlagRealismButton` (`@/components/attempt/flag-realism-button.tsx`) — chip with flag icon + "Flag as unrealistic" copy. Renders only when `attempt.test.mode !== "benchmark"`.
- Mutation: `useMutation({ mutationFn: ({question_id}) => unwrap(client.POST("/v1/attempts/{attempt_id}/questions/{question_id}/flag-realism", { params: { path: { attempt_id, question_id } } })) })`.
- Local state seeded from initial fetch (`questions[].realism_flagged_by_me`? — verify §H (b) item 10); fall back to write-only Set if backend doesn't surface.

**3. API endpoints consumed**

- `POST /v1/attempts/{attempt_id}/questions/{question_id}/flag-realism` — empty body → `{realism_flag_id, question_id, testee_id, created}`. Idempotent on (question, testee) per `uq_realism_question_testee`. Testee-only; admin → 403.

**4. Form fields + zod rules + react-hook-form integration shape**

n/a — single button click.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `idle` | Default | Chip with flag outline, "Flag as unrealistic" |
| `flagging` | Mutation in flight | Chip dimmed + pulse-dot |
| `flagged` | Mutation succeeds (created or idempotent) | Chip filled (ok colour), copy "Flagged" |
| `error` | Mutation throws | sonner Pattern B toast "Couldn't flag — try again"; chip reverts to idle |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: First click fires the flag mutation
  Given the frozen attempt is loaded at any question
  When the testee clicks "Flag as unrealistic"
  Then POST /v1/attempts/{attemptId}/questions/{questionId}/flag-realism fires
  And the button transitions to the flagged state on 2xx

Scenario: Second click is idempotent and keeps the flagged state
  Given the button is already in the flagged state
  When the testee clicks the button again
  Then a second POST fires and returns { created: false }
  And the button remains in the flagged state

Scenario: Flag fails surfaces a Pattern B toast and reverts the chip
  Given the frozen attempt is loaded
  When the testee clicks the flag button
  And the backend returns 5xx
  Then a sonner danger toast "Couldn't flag — try again" surfaces
  And the button reverts to the idle state

Scenario: Flag is hidden in benchmark mode
  Given the benchmark attempt is loaded at any question
  When the question pane renders
  Then the FlagRealismButton is not in the DOM
```

**7. Edge cases / gotchas**

- **Hydration source of truth.** If `GET /v1/attempts/{id}.questions[].realism_flagged_by_me` is surfaced (verify §H (b) item 10), use it as the initial state. Otherwise the Set is write-only — a tab reload re-shows the idle state for already-flagged questions until the testee re-clicks. Acceptable v1 trade.
- **Admin role does NOT see this button.** The route group enforces `testee` role; admins can't enter the runner. Safety net: backend returns 403 if hit.
- **Generation context.** Server-derived from the Question row's `AIProvenanceMixin`; FE does not pass it.

**8. Visual reference**

- `attempt.jsx:196–198` (FlagRealismButton chip).
- `attempt-variants.jsx:148–155` (confirms hidden in benchmark variant).

---

## C. Cross-page concerns

### C.1 Integrity surface (AC-D4 layers, FE-4 ownership)

| AC-D4 layer | FE-4 ownership | Implementation |
|---|---|---|
| #1 Frictional deterrents | Yes | `useIntegrity` hook installs document-level listeners for `contextmenu`, `selectstart`, `copy`, `paste`, `cut`, and Ctrl/Cmd+C/V keyboard combos; all call `preventDefault`. Body style sets `user-select: none` while attempt mounted. Cleanup on unmount restores defaults. |
| #2 Watermarking | Yes | `Watermark` component (fixed grid, low opacity, memoised). Text shape: `{user.name} · ACUMEN · {date} · ATTEMPT {attemptId.slice(0,7)}` per `attempt.jsx:87–94`. |
| #3 Tab-switch / focus tracking | Yes | `useIntegrity` installs `document.visibilitychange` listener; POSTs to focus-event endpoint outside pause windows (skip when `attempt.paused === true`). Endpoint verification: §H (b) item 7. |
| #4 Time-per-question logging | Yes | `time_ms` field on autosave body, derived from `useAttempt`'s per-question dwell timer. |
| #5 Deterministic served-material overlap | No | Backend-only; runs at grading. |
| #6 Integrity through test design | No | Catalogue / generation concern (FE-3 + FE-8). |
| #7 Anti-collusion shuffle (AC-D24) | No | Server-side via `shuffle_seed`; FE renders in returned order. |

### C.2 Focus-mode route-group carve-out

**Locked decision (LD1 per plan exit):** the attempt runner ships in a focus-mode child layout that **bypasses Rail + TopBar**.

```
frontend/src/app/(testee)/
  layout.tsx                                 # FE-2: Rail + TopBar + role guard
  page.tsx                                   # FE-3: dashboard
  attempts/
    [attemptId]/
      layout.tsx                             # FE-4: focus-mode override (no Rail, no TopBar)
      page.tsx                               # FE-4: runner page (B.1 + B.2 branched on mode)
      error.tsx                              # FE-4: Pattern C boundary
      loading.tsx                            # FE-4: Pattern A inline-skeleton in shell
      result/
        page.tsx                             # FE-4: placeholder (FE-6 owns build)
```

The child `layout.tsx` renders only `{children}` wrapped in `AttemptShell`. Parent's `requireAuthed` + `requirePrivacyAck` + `role === "testee"` guards still apply (Next.js layouts compose), but the parent's `<Rail />` and `<TopBar />` JSX are NOT inherited by the child route — only the **dependencies** (`AuthProvider`, `QueryClientProvider`, `Toaster`) are, because they live in `app/layout.tsx` (root), not the testee-group layout.

**Implementation discipline.** The `(testee)/layout.tsx` (FE-2) must structure its JSX as:

```tsx
// FE-2 sketch (illustrative, not normative)
<RoleGuard role="testee">
  <PrivacyAckGuard>
    {/* shell wrapper is conditional: render Rail+TopBar only when NOT in a focus-mode child route */}
    {children}
  </PrivacyAckGuard>
</RoleGuard>
```

…with the actual Rail + TopBar mounted in either a per-page surface or a sibling layout that the attempt route does not pass through. FE-2 spec should be updated (out of FE-4 scope; surfaced in §H (b) item 14) to clarify the seam so FE-4's carve-out lands cleanly.

Structural addition per the AC-CD-level structural carve-out (SESSION_START.md); folds into FE-4 build PR's handover. Reused by FE-5 streaming runner (same focus-mode posture).

### C.3 `useAttempt` reducer + answer-payload module

Single source of truth for in-progress runner state. Reducer shape (sketch):

```ts
type AttemptState = {
  currentIndex: number;
  answers: Map<QuestionId, AnswerPayload>;
  autosaveQueue: Map<QuestionId, { payload: AnswerPayload; queuedAt: number }>;
  autosaveState: "idle" | "saving" | "saved" | "failed";
  flaggedQuestions: Set<QuestionId>;
  pauseState: "active" | "pausing" | "paused" | "resuming";
};

type AttemptAction =
  | { type: "hydrate"; attempt: AttemptView }
  | { type: "set-answer"; questionId: string; payload: AnswerPayload }
  | { type: "advance-to"; index: number }
  | { type: "autosave-start"; questionId: string }
  | { type: "autosave-success"; questionId: string }
  | { type: "autosave-failure"; questionId: string; retryCount: number }
  | { type: "pause-start" } | { type: "pause-success" }
  | { type: "resume-start" } | { type: "resume-success" }
  | { type: "flag-realism"; questionId: string };
```

Answer-payload TypeScript discriminated union centralised at `frontend/src/lib/attempts/answer-payloads.ts` (see §B.1 §4). Reused by FE-6 results page to render per-question grade rows.

### C.4 Autosave debounce + retry policy

- **Per-question debounce 600 ms** per `attempt-variants.jsx:382–389`. Per-question queue coalesces consecutive writes (a 5-keystroke burst on short-answer fires one autosave 600 ms after the last keystroke).
- **Retry policy:** 3 retries with exponential backoff (2 s / 4 s / 8 s). 4th consecutive failure → sonner danger toast + persistent banner per `attempt-variants.jsx:416–420`.
- **Last-write-wins.** Backend has no etag/version; FE does not implement optimistic concurrency. Cross-tab races are tolerated (second tab's later write overwrites first tab's earlier write); documented edge case.
- **Submit gate.** Submit mutation waits for autosave queue to drain (button copy: "Saving final answer…" during drain).

### C.5 Query-key library extension

New file: `frontend/src/lib/queries/attempts.ts`. Pattern matches FE-3 §B.5 / §C.2:

```ts
export const attemptQueryKeys = {
  all: ["attempts"] as const,
  detail: (id: string) => [...attemptQueryKeys.all, id] as const,
  result: (id: string) => [...attemptQueryKeys.all, id, "result"] as const,
  inFlight: () => [...attemptQueryKeys.all, "inflight"] as const,  // localStorage shim, not server-fetched
};

export function invalidateAttempt(qc: QueryClient, attemptId: string) {
  return qc.invalidateQueries({ queryKey: attemptQueryKeys.detail(attemptId) });
}
```

`inFlight()` key is intentional — it lets the resume-detection hook participate in the cache without firing a network request (the localStorage read is the data source; the query function returns the localStorage value as a `Promise`).

### C.6 Pattern A / B / C in the runner context

- **Pattern A — inline error.** Autosave-indicator's `failed` state; per-card per-section retry. Per `attempt-variants.jsx:414–420`.
- **Pattern B — toast.** Transient mutation failures (pause, resume, flag-realism, submit pre-confirm). Sonner toasts mapped from `ApiError.code` to user-facing copy.
- **Pattern C — boundary card.** `(testee)/attempts/[attemptId]/error.tsx` for initial fetch failures. Copy: "Couldn't load this attempt." + "Try again" (resets) + "Go to dashboard" routes to `/`.

### C.7 Resume / replay snapshot semantics (AC-D17 + AC-D11 v1.6)

- Backend snapshot = autosave reuse (no separate artifact per AC-D11 v1.6 Implications).
- On `GET /v1/attempts/{id}` resume, FE rehydrates `useAttempt`'s `answers` Map from `attempt.questions[].response.answer_payload` (verify exact field path §H (b) item 4).
- Pause/resume cycle: `POST /pause` triggers server-side flush of pending autosaves; `POST /resume` returns `pause_seconds_remaining` (server-derived). FE timer adjusts.
- Stable ordering: server resolves via `shuffle_seed` + `attempt_position` (per AC-CD10 v1.8); FE renders in returned array order.

### C.8 Inter-page dependencies

- **FE-3 → FE-4 entry point** is blocked on LD3 (pill→test resolver). FE-3 spec must include the `localStorage.setItem("acumen.attempts.inflight", attemptId)` step on `POST /v1/attempts` success once unblocked.
- **FE-4 → FE-5 mode routing.** Per_testee attempts deep-linked to `/attempts/[attemptId]` render the FE-5-pending placeholder in FE-4. FE-5 builds the streaming runner that branches on `mode === "per_testee"`; the same route handles both modes via the mode-branch in `page.tsx`.
- **FE-4 → FE-6 results route.** GradingOverlay dismisses on `result.status === "complete"`; router pushes `/attempts/[attemptId]/result`. FE-4 ships a stub `result/page.tsx` with "FE-6 pending" copy; FE-6 builds the real result UI.
- **FE-4 → FE-3 dashboard.** `ResumePrompt` (B.3) mounts on the FE-3 dashboard. FE-3's dashboard page must import + render `<ResumePrompt />` above the hero in the build session that follows FE-4 spec merge; recorded as cross-spec coordination in §H (b) item 13.

### C.9 Image / figure stub contracts (per AC-CD24)

FE-4 question components type every image field and pass through to FE-2's primitives:

- `Question` payload may carry: `reference_image?: { url: string | null; alt?: string | null; caption?: string | null }` (verify field names §H (b) item 4), `inline_images?: Array<{ url: string | null; alt?: string | null; n: number }>`, `choices[].image?: { url: string | null; alt?: string | null }`.
- All three render via FE-2 primitives:
  - `<Figure variant="reference" url={...} alt={...} caption={...} />`
  - `<InlineFigure url={...} alt={...} number={n} />` injected mid-prompt via `renderPromptWithInlineFigures`.
  - `<ChoiceFigure url={...} alt={...} />` in MCQ choice cells.
- Backend always emits `url === null` in v1 per AC-CD24; FE-2 stubs return `null`. Type-checks; no UI surfaces. v1.x visual-content PR lights up rendering.

---

## D. Test cases (Vitest + Playwright)

Vitest config + RTL + MSW per FE-1 / FE-3. New: Playwright introduced in this PR per LD4.

### D.1 Unit tests (lib + helpers + reducers)

- `useAttempt` reducer (`use-attempt.test.ts`): hydrate from `AttemptView`; set-answer queues autosave; debounce coalesces consecutive set-answer for same question; autosave-success transitions saved; autosave-failure exponential backoff + escalation after 4th failure; pause-start blocks set-answer; resume-success unblocks.
- Answer-payload module (`answer-payloads.test.ts`): discriminated-union narrowing; type-guard helpers.
- `useIntegrity` hook (`use-integrity.test.tsx`): installs document-level deterrent listeners on mount; cleanup restores defaults; focus events skip during pause; copy/paste suppression via `preventDefault`.
- `useResumeDetection` hook (`resume-detection.test.tsx`): no-key returns none; stale-key with submitted attempt clears silently; valid in-progress key returns resumable.
- `useNow` (`use-now.test.tsx`): 1 Hz tick; paused-aware (does not tick when `paused === true`); cleanup on unmount.
- `attemptQueryKeys` (`attempts.test.ts`): structural equality; sibling-key isolation; `inFlight()` distinct from `detail()`.
- Per-type answer-payload renderers: MCQ option selection; TF inversion; matching pair selection; short-answer textarea + char counter; scenario textarea.

### D.2 Page integration tests (Vitest + RTL + MSW)

One test per Gherkin scenario in B.1, B.2, B.3, B.4. Mounted at the runner route with MSW handlers seeded per scenario.

- **B.1 frozen runner:** load + Q1 render; MCQ click debounced autosave; pause blanks + holds; resume restores + restarts; max-pause auto-resume; submit modal → grading overlay → result polling → route; realism flag idempotent; tab blur fires focus event; copy/paste suppressed; watermark text shape; image fields null per AC-CD24; per_testee mode-guard.
- **B.2 benchmark runner:** load Q1; next click POSTs `/next`; final `done: true` opens submit modal with benchmark copy; grading overlay phase 4 benchmark copy; pause button absent.
- **B.3 resume prompt:** no-key → no modal; valid key → modal renders with attempt summary; stale key cleared silently; Discard clears localStorage no-backend-call.
- **B.4 realism flag:** first click POSTs; second click idempotent; failure surfaces toast; hidden in benchmark.

### D.3 Per-question-type render tests

`questions/mcq.test.tsx`, `true-false.test.tsx`, `matching.test.tsx`, `short-answer.test.tsx`, `scenario.test.tsx`: idle / selected / disabled / image-stubbed (per AC-CD24) / footer-meta rendering.

### D.4 Playwright E2E (LD4 — first E2E flow)

`frontend/e2e/attempt-frozen-roundtrip.spec.ts`:
- Mock backend via Playwright's `route` API (MSW does not run cleanly under Playwright; use Playwright's built-in mock).
- Happy path: deep-link `/attempts/<uuid>` → fetch returns frozen attempt with 3 questions → answer Q1 (MCQ click) → wait for autosave indicator "Saved Ns ago" → next → answer Q2 (TF) → autosave → pause → assert PauseOverlay visible + question pane visibility hidden → resume → answer Q3 (short-answer textarea) → autosave → submit → assert SubmitConfirmModal → confirm → assert GradingOverlay → mock `/result` to return `status: "complete"` → assert router pushes `/attempts/<uuid>/result`.
- Run via `pnpm e2e`. New scripts in `frontend/package.json`: `"e2e": "playwright test"`, `"e2e:ui": "playwright test --ui"`.
- CI: `.github/workflows/frontend.yml` extends to run `pnpm e2e` gated on Vitest pass; adds Playwright browser cache.

### D.5 Existing tests preserved

FE-0 smoke tests + FE-1 / FE-2 / FE-3 test suites (all spec-merged, none built yet) continue to pass. FE-4's spec PR introduces no test files (doc-only); the build PR introduces all of D.1–D.4.

### D.6 Coverage gate (FE_CHECKLIST.md FE-4 rows tick on)

- `pnpm test --run` green (Vitest D.1–D.3).
- `pnpm typecheck` clean.
- `pnpm lint` clean.
- `pnpm format:check` clean.
- `pnpm build` succeeds.
- `pnpm e2e` green (Playwright D.4).
- Meaningful coverage on the new files under `frontend/src/components/attempt/`, `frontend/src/lib/attempts/`, `frontend/src/lib/queries/attempts.ts`. Page-level files (`app/(testee)/attempts/[attemptId]/{page,layout,error,loading}.tsx`) covered via D.2 page-integration tests + D.4 E2E.

---

## E. Known placeholders (DO NOT SHIP AS-IS)

| # | Placeholder | Location | Action before production |
|---|---|---|---|
| 1 | `per_testee` mode-guard placeholder card | `(testee)/attempts/[attemptId]/page.tsx` mode branch | FE-5 build replaces with the JIT/SSE runner |
| 2 | `live` mode-guard placeholder card | same | Pending LD2 spec-clarification PR resolution; either FE-N owns build or `live` is retired as a typo |
| 3 | Pill detail "Practice at D{n}" entry point remains placeholder until pill→test resolver lands (LD3 blocker, inherited from FE-3) | FE-3 pill detail (`StickyDifficultyBar`) | User-authored spec-clarification PR adds resolver endpoint |
| 4 | Resume prompt is single-device only (localStorage bridge, not server-listed) | `frontend/src/lib/attempts/resume-detection.ts` | Wire to `GET /v1/attempts` once it lands (FE-7 backend dep, also helps here) |
| 5 | GradingOverlay 4-phase animation copy is local; real grading completion polls `GET /v1/attempts/{id}/result` separately | `frontend/src/components/attempt/grading-overlay.tsx` | Once FE-6 ships, route on `status === "complete"`; for v1 route to a placeholder result page that reads "FE-6 pending" |
| 6 | Image-field stubs render null per AC-CD24 | every question-type component | v1.x visual-content PR wires real image rendering when backend starts emitting non-null URLs |
| 7 | Resume-prompt "Discard" does NOT call any backend endpoint (just clears localStorage); the abandoned attempt stays in-progress server-side | `resume-prompt.tsx` Discard handler | Wire to a v1.x backend "abandon attempt" endpoint if/when added |
| 8 | Realism-flag hydration is write-only if `realism_flagged_by_me` field not present (§H (b) item 10) | `flag-realism-button.tsx` initial state | Hydrate from server field when verified or added |
| 9 | Focus-event endpoint shape pending verification (§H (b) item 7); spec assumes `POST /v1/attempts/{id}/focus-events` | `use-integrity.ts` | Build session opens with verification; if endpoint missing, fold into autosave with `event_kind` discriminator |
| 10 | `/attempts/[attemptId]/result/page.tsx` ships as placeholder "FE-6 pending" copy | FE-4 build PR | FE-6 build replaces with the real result UI |

---

## F. Scope additions beyond `fe-specs/FE-4-runner.md`

### F.1 `frontend/src/lib/queries/attempts.ts` — new query-key file

Anchored at AC-CD21; structural addition under the FE-3 §G pattern propagation rule. Exports `attemptQueryKeys` + `invalidateAttempt`. Three keys: `all`, `detail(id)`, `result(id)`, `inFlight()` (localStorage shim).

### F.2 Playwright config + first E2E (LD4)

This PR amends `FE_ROADMAP.md` FE-4 done-when to record Playwright introduction (existing risks block already anticipates this; no new wording needed beyond the per-PR handover note). Adds:

- `@playwright/test` dev dependency (pinned exact per AC-CD19).
- `frontend/playwright.config.ts` — Chromium + Firefox + WebKit projects; baseURL `http://localhost:3000`; reporter html.
- `frontend/e2e/` directory + first spec.
- `frontend/package.json` scripts: `"e2e"`, `"e2e:ui"`.
- `.github/workflows/frontend.yml` extension: install browsers, cache, run `pnpm e2e` gated on Vitest pass.

AC-CD-level structural addition; folds into handover.

### F.3 shadcn primitive additions

Add via `pnpm dlx shadcn@latest add radio-group checkbox textarea alert-dialog` at build time. Token discipline applies (override `rounded-*` to `rounded-none`); folds into handover. (FE-2 install list does not include these four; FE-4 needs them for question rendering + submit modal.)

### F.4 `useIntegrity` hook + DOM deterrent install module

New utility at `frontend/src/lib/attempts/use-integrity.ts`. No new anchor needed beyond AC-D4.

### F.5 `frontend/src/lib/attempts/answer-payloads.ts` — per-type discriminated union

Reused by FE-6 results page; centralised in one file so the contract is single-source.

### F.6 Focus-mode route-group carve-out (LD1)

`(testee)/attempts/[attemptId]/layout.tsx` overrides parent shell. Bypasses Rail + TopBar; inherits auth + privacy + role guards via parent layout composition. Structural addition per AC-CD-level carve-out (SESSION_START.md); folds into handover.

**Coordination with FE-2.** FE-2 spec must structure `(testee)/layout.tsx`'s JSX so the shell wrappers (Rail + TopBar) are mounted in a way that the focus-mode child layout can override. Per §C.2 discipline note; surfaced in §H (b) item 14.

### F.7 Design-reference completeness note

Frozen runner screenshots use the legacy `01/02/03-attempt.png` naming (predates `v6-fe*` convention); `v6-fe4-11-benchmark-attempt.png` + `v6-fe4-12-autosave.png` cover benchmark + autosave. No `v6-fe4-*` for pause overlay, submit confirm, grading overlay, integrity badge popover, or realism-flag chip — `attempt.jsx` + `attempt-variants.jsx` accepted as canonical for those gaps per FE-3 §F.2 precedent.

### F.8 `useAttempt` reducer hook

New utility at `frontend/src/lib/attempts/use-attempt.ts`. Owns autosave queue + debounce + retry. No new anchor needed beyond AC-CD21.

### F.9 `useResumeDetection` hook + `ResumePrompt` modal

New utility at `frontend/src/lib/attempts/resume-detection.ts` + `frontend/src/components/dashboard/resume-prompt.tsx`. Anchored at FE_CHECKLIST FE-4 "Resume prompt on stale attempt" row.

---

## G. Session 5 onwards — template propagation to FE-5..FE-9

The structure (Context → A inventory → B per-page 8-section template → C cross-page → D tests → E placeholders → F scope-bleed → G template propagation → H drift roll-up) is the **template for every subsequent FE-N detail spec**.

Per-phase variances expected and ALLOWED:

- **FE-5 (SSE / JIT streaming)** adds an "SSE event sequence" subsection per consuming page. 8-section template still applies; SSE nests inside §5 (States) per FE-1 §G note. FE-5 inherits the focus-mode carve-out (§F.6) verbatim — the per_testee runner replaces FE-4's mode-guard placeholder at the same route.
- **FE-6 (results)** uses the answer-payload discriminated union from `frontend/src/lib/attempts/answer-payloads.ts` (§F.5) to render per-question grade rows.
- **FE-7 (constellation + history)** unblocks once `GET /v1/attempts` lands; the resume-prompt's localStorage bridge can move to the listing endpoint at that time (§E item 4).
- **FE-8 / FE-9** may split into multiple files if exceeding ~2500 lines per FE-1 §G; detail-spec session decides at plan time.

Per-phase variances NOT allowed without spec-drift surface:

- Skipping Gherkin acceptance criteria. Every state must have a trio.
- Skipping drift-watch / verification / blocker callouts. No callouts means either the cross-walk was incomplete or the spec is genuinely clean — declare which.
- Folding test list into per-page sections. Tests live in §D for scannability and coverage-counting.
- Introducing a second route-group layout pattern beyond the focus-mode carve-out (§C.2) without an AC-CD-level structural addition.
- Inlining query keys in page files; always reference the library.
- Introducing optimistic-concurrency guards on attempt mutations without a backend etag/version field — last-write-wins is the v1 contract per the API agent's report.

---

## H. Spec-drift roll-up (post-review classification)

The cross-walk surfaced 24 candidate items. After review, classified into three groups.

### (a) BLOCKERS for the FE-4 build session — must land before the build session opens

1. **`live` test mode is unanchored vocabulary.** `FE_ROADMAP.md` (line 86) and `FE_CHECKLIST.md` (FE-4 row anchors AC-D5) reference `live` as the fourth non-streaming mode; `DECISIONS.md` AC-D5 / AC-D13 ship per_testee + frozen + hand_authored + benchmark — no `live`. **Resolution:** user authors a small spec-clarification PR to either (i) add `live` to AC-D5 with shape (synchronous proctored mode? same-time-window? something else?) and update `app/models.py` Test.mode enum, or (ii) retire `live` from FE_ROADMAP / FE_CHECKLIST as a typo. **The FE-4 build session cannot open without this resolution** because it determines whether FE-4 ships a `mode === "live"` placeholder with "coming soon" copy or no branch at all.

2. **Pill+difficulty → test resolver endpoint missing (inherited from FE-3 §H (b) item 3).** FE-3 punted; FE-4 inherits. **Resolution:** user authors a spec-clarification PR adding `GET /v1/tests/resolve?pill_id=X&difficulty=N` → `{test_id}` (or equivalent shape — the exact shape is the user's call). **The FE-4 runner itself can build without this** (entry is direct `/attempts/[attemptId]` deep-link); but the pill detail "Practice at D{n}" wiring stays broken until this PR lands. Surfaced here so the FE-4 build session's handover documents the still-incomplete round-trip from pill detail → runner.

3. **FE-1, FE-2, FE-3 builds must land first.** FE-4 presumes auth surfaces, route guards, shell composition, token system, primitives, shadcn install, `applyApiErrorToForm` helper, sonner Toaster + QueryClientProvider mounts, `(testee)/layout.tsx` role guard, query-key library convention, and the FE-3 dashboard (which mounts the resume prompt). Spec-merged but not built; sequence FE-1 build → FE-2 build → FE-3 build → FE-4 build.

### (b) BUILD-SESSION VERIFICATION TASKS — front-loaded at the start of the FE-4 build session

The build session opens with a verification step before any code lands: read `app/routers/attempts.py`, `app/routers/rag.py`, `app/schemas.py`, `app/models.py`, and the OpenAPI snapshot at `frontend/openapi/schema.json`. Confirm the assumed contracts. If any diverge, halt and surface for a spec-clarification PR.

4. **Attempt response field shape for resume rehydration.** Spec assumes `GET /v1/attempts/{id}.questions[].response.answer_payload` carries the autosaved payload. Verify the exact field path against `AttemptView` + `Response` Pydantic schemas. If the payload lives elsewhere or is omitted, surface as drift.

5. **Test-mode field path.** Spec assumes `attempt.test.mode` (nested). Verify against the AttemptView shape; if FE wants a flatter `attempt.mode`, surface as spec-clarification.

6. **MCQ multi-select shape.** Verify whether MCQ supports multi-select (`choice_ids: string[]`) or only single-select (`choice_id: string`). AC-D5 / SPEC §4 do not explicitly say. Question schema in `app/models.py` + per-type answer-payload validation in `app/domain/grading.py` is the truth. If multi-select supported, the spec's `multiple_choice_multi` discriminator is real; if not, drop it.

7. **Focus-event endpoint.** AC-D4 #3 + AC-D11 v1.6 say `attempt_focus_event` table shipped. Verify the router serving it — likely `POST /v1/attempts/{id}/focus-events` per spec assumption. If absent, fold focus events into the autosave body with an `event_kind` discriminator (acceptable v1 trade) and surface as spec-clarification for a follow-up.

8. **Benchmark pause support.** Verify whether benchmark mode honors `POST /pause` / `POST /resume` (backend endpoints accept the call regardless of mode per API agent report), and whether AC-D13's "untimed by default" implies pause is N/A. Spec ships pause-hidden for benchmark in v1; if verification surfaces a use case, build session adds the Pause button.

9. **`P4_BENCHMARK_STEP_CAP=5` configurability.** Cap is hard-coded server-side per the API agent report. Verify whether configurable per test (e.g., a `max_questions` field on Test or BenchmarkConfig). Spec assumes backend-authoritative; FE renders whatever `next.done` says.

10. **Realism-flag UI hydration source.** Verify whether `GET /v1/attempts/{id}.questions[].realism_flagged_by_me: bool` is surfaced. If yes, hydrate the FlagRealismButton initial state from it. If no, FE seeds an empty Set and treats flagging as write-only.

11. **Pause overlay timer-hold semantics.** Verify that `pause_seconds_remaining` returned by `/resume` is the pause-window-remaining (capped at `max_pause_duration_minutes`), not the wall-clock-time-budget-remaining. AC-D11 v1.6 Implications imply pause-window-remaining; misreading produces a wrong countdown.

12. **shadcn primitives availability.** Verify FE-2 install list at build time; add `radio-group`, `checkbox`, `textarea`, `alert-dialog` via `pnpm dlx shadcn@latest add` if absent. Folded into handover.

13. **FE-3 dashboard imports `<ResumePrompt />`.** Cross-spec coordination: FE-3's dashboard page must mount the FE-4-owned modal. Either (a) FE-3 spec is amended to import from `@/components/dashboard/resume-prompt` in the build session (small change, no spec-drift PR), or (b) FE-4 build session edits FE-3's dashboard page directly under the structural-additions carve-out. Build session picks at PR-open time.

14. **FE-2 spec coordination on focus-mode carve-out.** Per §C.2, FE-2's `(testee)/layout.tsx` must structure JSX so Rail + TopBar don't propagate into the focus-mode child route. FE-2 spec doesn't explicitly anticipate this. Either (a) FE-2 spec is amended in a follow-up (out of FE-4 scope), or (b) FE-4 build session lands the `(testee)/attempts/[attemptId]/layout.tsx` carve-out and the FE-4 PR's handover documents what FE-2 build should mirror.

15. **Submit endpoint return shape vs polled `/result`.** `POST /v1/attempts/{id}/submit` returns `AttemptView` (post-submit); `GET /v1/attempts/{id}/result` returns the gated result envelope. Verify which one drives GradingOverlay dismissal — spec assumes `/result` polling (because `/submit` resolves immediately on deterministic-grading completion, not on cross-family review per AC-D19). Confirm.

16. **Page params async signature.** Next.js 15 / React 19 `params` is a Promise (`use(params)` idiom per FE-1 §B.3); verify the runner page reads `attemptId` via `use(params)` not direct destructure.

### (c) APPROVED RESOLUTIONS — folded into the FE-4 build PR scope, captured in the build PR's handover

These are not blockers. The spec body above locks the resolution; the build session implements; the build PR's handover records them under the SESSION_START.md AC-CD-level structural-additions carve-out.

17. **Focus-mode carve-out (LD1).** `(testee)/attempts/[attemptId]/layout.tsx` overrides parent shell. Structural addition.

18. **Frozen + benchmark scope (LD2).** FE-4 ships frozen + benchmark; per_testee and live render mode-guard placeholders.

19. **Entry from direct attemptId only (LD3).** FE-4 takes test_id only via attempt deep-link; pill→test resolver remains the upstream blocker.

20. **Playwright introduction (LD4).** Playwright config + frozen-mode happy-path E2E in `frontend/e2e/`. AC-CD-level structural addition.

21. **Resume prompt via localStorage bridge** at `acumen.attempts.inflight`. Avoids GET /v1/attempts dependency. Single-device only; documented limitation.

22. **Autosave debounce 600 ms + 3-retry exponential backoff** per `attempt-variants.jsx:382–389`.

23. **Submit → grading flow.** SubmitConfirmModal → POST /submit → GradingOverlay 4-phase local animation (600/1400/2400/3200 ms) → polled GET /result every 1.5 s until `status === "complete"` → route to `/attempts/[attemptId]/result` (FE-6 placeholder).

24. **AC-D4 deterrent install via `useIntegrity` hook** on `(testee)/attempts/[attemptId]/layout.tsx` mount; cleanup on unmount restores document defaults.

25. **Watermark per AC-D4 #2** via fixed-position memoised component; `user.name · ACUMEN · {date} · ATTEMPT {attemptId.slice(0,7)}` text shape. Repeating grid 12 × 6 per `attempt.jsx:87–94`.

26. **Per-type answer-payload module** at `frontend/src/lib/attempts/answer-payloads.ts`; discriminated union per question.type.

27. **Query-key library extension** at `frontend/src/lib/queries/attempts.ts` per FE-3 §G pattern propagation rule.

28. **shadcn install additions** — `radio-group`, `checkbox`, `textarea`, `alert-dialog` per §F.3.

29. **`useAttempt` + `useIntegrity` + `useResumeDetection` + `useNow`** as new hooks under `frontend/src/lib/attempts/`. New module per AC-CD-level structural addition.

30. **GradingOverlay polling interval 1.5 s.** Spec lock; build session may adjust if observed grading durations diverge significantly from AC-D19's "3–6 seconds" wording.

31. **`per_testee` mode-guard placeholder copy** ("Streaming attempt mode is coming with FE-5 — for now, contact admin if this was assigned to you.") — placeholder until FE-5 builds.

32. **Design-reference completeness acceptance** — `attempt.jsx` + `attempt-variants.jsx` accepted as canonical for non-screenshotted UI elements (pause overlay, submit confirm, grading overlay, integrity badge popover, realism-flag chip). Per FE-3 §F.2 precedent.

---

*End of FE-4-runner.md. Template propagates to FE-5..FE-9 per §G; deviations surface as spec drift.*
