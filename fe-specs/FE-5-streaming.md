# FE-5 — Per-Testee streaming attempt runner (detail spec)

> **Status:** plan-mode authored, ready for build session (subject to two SSE drift items in §H (a) being resolved by user-authored spec-clarification PRs first).
> **Owns:** the per_testee variant of the attempt runner — SSE client adapter (AC-CD22), JIT queue sidebar with `arrivedIdx` reducer, streaming-aware progress dots, system-glitch ("connection issue") overlay, mode-branch wiring at `(testee)/attempts/[attemptId]/page.tsx` that replaces FE-4's `per_testee` placeholder with the real runner. Q1 sync render via POST response payload; Q2..N via SSE refetch-on-event.
> **PR target:** `PR-NNN-fe5-streaming` (one squash PR closes the build phase per FE_ROADMAP discipline). This doc PR is its own slice.
> **Anchors:** AC-D5 (per_testee in the mode set), AC-D11 (pause mechanics — user vs system-glitch branch via `pause_reason`), AC-D13 (benchmark explicitly excluded from JIT), AC-D17 (snapshot/replay semantics), AC-D24 (shuffle seed + question_group_id; anchor interleave is server-side), AC-D25 (JIT per-Testee streaming, Q1 sync + Q2..N parallel, single-retry then AC-D11 pause), AC-CD6 (uniform error envelope), AC-CD10 (in-process `asyncio.gather` + `Semaphore`; `attempt_position` ordering; `Last-Event-ID` resume), AC-CD19 (frontend stack lock), AC-CD20 (routing + role guards), AC-CD21 (TanStack Query + react-hook-form + error envelope), AC-CD22 (fetch-streaming SSE adapter, **subject to spec-clarification PRs below**), AC-CD24 (image-field typed stubs, render `null` in v1).
>
> This is the **fifth per-page FE detail spec.** Template inheritance: per-page §B from `fe-specs/FE-1-auth.md` (verbatim); the SSE event-sequence subsection nests inside §5 (States) of the consuming page per FE-1 §G. Deviating from the template in FE-6+ is itself spec drift.
>
> **Amendment (2026-06-06 — post-audit pre-deploy fix workstream).** This
> doc is amended in place per the spec-author ruling for the 2026-06-02
> production-readiness audit finding **V2** (internal anchor IDs rendered in
> the UI — `audits/2026-06-02-prod-readiness-synthesis.md` §V2). Authorizing
> context: `plans/2026-06-06-post-audit-pre-deploy-fix-workstream.md` (merged
> at `621a549`, PR #94), §4 Slice 4. The **`JITQueue`** eyebrow row (§B.1,
> `JITQueue.tsx`) drops its `· AC-D25` provenance suffix — internal anchor
> decoration, not testee-facing copy: `"Queue · AC-D25"` becomes `"Queue"`.
> The plan's Slice 4a grounded "test-safe" only against component tests and
> missed that this rendered copy is quoted verbatim here; per spec-drift
> discipline (`SESSION_START.md:80–85`) the build session paused the strip
> until this amendment landed. The build session's Slice 4 strips the
> matching `JITQueue.tsx` string. Same fork as PR #97 (FE-3 Safety\* copy).
> Legitimate `AC-D…` references elsewhere in this doc (the Anchors block,
> prose contract notes, §H items) are unchanged.

---

## 0. Context

FE-0 (PR-032) shipped the Next.js 15 / App Router scaffold, the typed `openapi-fetch` client with `unwrap()`, the auth context, the OpenAPI codegen pipeline. PR-033 locked AC-CD20..24. FE-1 → FE-2 → FE-3 → FE-4 **spec-merged** the auth surface, shell, dashboard/catalogue, and the non-streaming attempt runner. None of FE-1..FE-4 are *built* yet; FE-5 presumes their builds land in roadmap order before the FE-5 build session opens (see §H (a) item 3).

**FE-4 spec preconditions for the FE-5 build session** (the foundation FE-5 extends, not replaces):

- The `(testee)/attempts/[attemptId]/` route owns the runner page (FE-4 `page.tsx`) and the focus-mode child layout that bypasses Rail + TopBar (FE-4 `layout.tsx`, locked decision LD1 in FE-4 §F.6 / §C.2). FE-5 reuses both verbatim.
- `AttemptShell`, `AttemptHeaderBand`, `ProgressDots`, `TimerPill`, `IntegrityBadge`, `Watermark`, `QuestionView` + per-type renderers, `PauseOverlay`, `SubmitConfirmModal`, `GradingOverlay`, `FlagRealismButton`, `AutosaveIndicator`, `useAttempt`, `useIntegrity`, `useNow` (FE-4 §B.1 §2).
- `attemptQueryKeys` library at `frontend/src/lib/queries/attempts.ts` (FE-4 §C.5) — FE-5 extends with a `stream` cursor key (see §C.5).
- `frontend/src/lib/attempts/answer-payloads.ts` discriminated union (FE-4 §F.5).
- The `per_testee` mode-guard placeholder (FE-4 §B.1 §5 `mode-guard:per_testee` state) that FE-5 *replaces*. FE-4's mode resolver at `page.tsx` branches `mode === "per_testee"` to a placeholder; FE-5 wires that branch to the streaming runner introduced here.

**What FE-5 builds:**

1. **`openAttemptStream` SSE adapter** at `frontend/src/lib/api/sse.ts` per AC-CD22 — fetch-streaming, bearer auth, `Last-Event-ID` resume, single-retry-then-synthetic-paused failure path, returns an `AsyncIterable<StreamEvent>` plus `close()`.
2. **`useStreamingQueue` hook** at `frontend/src/lib/attempts/use-streaming-queue.ts` — wraps `openAttemptStream`, tracks `arrivedIdx` reducer, drives TanStack-Query invalidation of `attemptQueryKeys.detail(id)` on each question event so the full question content lands in cache.
3. **`JITQueue` sidebar** at `frontend/src/components/attempt/jit-queue.tsx` — buffer chip + per-question card list with four states (`done` / `current` / `ready` / `generating`); design source: `attempt.jsx:295–403`.
4. **Streaming-aware `ProgressDots`** — extends FE-4's `ProgressDots` with the `generating` state (dashed border + `streaming-bar` animated gradient overlay per `attempt.jsx:118–151`). Same component file; behaviour gated on `mode === "per_testee"`.
5. **`SystemGlitchOverlay`** at `frontend/src/components/attempt/system-glitch-overlay.tsx` — alternate to FE-4's `PauseOverlay` for `pause_reason !== null` (currently only `"generation_failed"`). Wave glyph + serif headline "*Connection* issue." + "Try resuming →" + collapsible technical-details block per `streaming-paused.jsx:132–191`.
6. **`StreamingAttemptRunner`** at `frontend/src/components/attempt/streaming-attempt-runner.tsx` — the per_testee branch component invoked by FE-4's `page.tsx` mode resolver. Composes `useAttempt` + `useStreamingQueue` + the JIT queue sidebar + the pause-reason-branched overlay.
7. **Mode-branch wiring** in FE-4's `page.tsx`: replace the `per_testee` placeholder return with `<StreamingAttemptRunner attempt={...} />`. Single-line spec change in FE-4's mode resolver; FE-5 build owns the edit.
8. **Test-mode plumbing for SSE** under MSW — MSW v2's `ReadableStream` response support is used to ship a Vitest harness for fixture-driven event sequences (single connect, reconnect with `Last-Event-ID`, terminal `done`, terminal `paused`).

**Done-when (verbatim from FE_ROADMAP):** *A `per_testee` test streams Q1 in <3s, Q2..N arrive in order, mid-stream pause/resume replays correctly without duplicating arrivals, terminal `paused` event surfaces user-readable "we hit a glitch — try resume in a minute" state.*

**Scope boundary — what FE-5 explicitly does NOT ship:**

- **`live` mode.** Inherited from FE-4 §H (a) item 1 — still unanchored in DECISIONS, still a user-authored spec-clarification PR blocker. FE-5 keeps the FE-4 `live`-mode placeholder unchanged.
- **Pill-detail "Practice at D{n}" → POST /v1/attempts wiring.** Inherited from FE-3 §H (b) item 3 / FE-4 §H (a) item 2 (pill→test resolver missing). FE-5 runner builds against direct `/attempts/[attemptId]` deep-link entry **with a pre-existing attempt row** (i.e. someone — admin, or a future FE-3 fix — already called POST /v1/attempts). The POST response's `q1` field carries Q1 only on POST; on direct deep-link GET, Q1 lives in `questions[]` with `attempt_position = 1` and the FE renders it the same way. Documented in §C.6.
- **Results page rendering / cross-family review surface.** FE-6 territory. FE-5 routes through FE-4's `GradingOverlay` + result-poll exactly as FE-4 does — no FE-5 change.
- **Attempt history list / multi-attempt resume.** Inherited from FE-7 backend dependency (`GET /v1/attempts`).
- **In-question image rendering.** AC-CD24 — typed stubs return `null` in v1.
- **JIT queue mobile layout.** Sidebar is desktop-only per `attempt.jsx:211` (`className="hide-mobile"`). Mobile renders the runner without the queue; testees still see the streaming progress dots + question pane. Documented in §C.3.

**Additions to `(testee)/attempts/[attemptId]/layout.tsx`:** none. The focus-mode shell (FE-4 §F.6) hosts both the FE-4 frozen/benchmark runner and the FE-5 streaming runner without modification.

---

## A. Page/feature inventory

| # | Capability | Route / file | Design source | Screenshot |
|---|---|---|---|---|
| 1 | Per-Testee attempt runner (mode branch of FE-4's runner page) | `/attempts/[attemptId]` (`mode === "per_testee"`); branch component at `frontend/src/components/attempt/streaming-attempt-runner.tsx` | `attempt.jsx:47–237` (AttemptScreen — the JIT-queue-bearing variant FE-4 stripped) + `attempt.jsx:295–403` (JITQueue + QueueItem) + `attempt.jsx:118–151` (streaming-aware ProgressDots) | reuses FE-4's `01-attempt.png`/`02-attempt.png`/`03-attempt.png` for runner chrome; sidebar in those screenshots is canonical (legacy naming per FE-3 §F.2 / FE-4 §F.7 precedent) |
| 2 | SSE client (`openAttemptStream`) | `frontend/src/lib/api/sse.ts` | n/a (adapter lib; AC-CD22 anchor body is the spec) | n/a |
| 3 | JIT queue sidebar component | `frontend/src/components/attempt/jit-queue.tsx` | `attempt.jsx:295–403` (`JITQueue` + `QueueItem`) | embedded in #1 |
| 4 | Streaming-aware progress dots (extension of FE-4's `ProgressDots`) | `frontend/src/components/attempt/progress-dots.tsx` (file owned by FE-4; FE-5 amends) | `attempt.jsx:118–151` (per-question dots with `arrived` dashed state + `streaming-bar` animation) | embedded in #1 |
| 5 | System-glitch overlay (terminal `paused` event) | `frontend/src/components/attempt/system-glitch-overlay.tsx` | `streaming-paused.jsx:132–191` (`SystemGlitchOverlay`) + `streaming-paused.jsx:196–234` (comparison note pinning the divergence from `UserPausedOverlay`) | `v6-fe5-13-streaming-paused.png` |
| 6 | `useStreamingQueue` reducer hook | `frontend/src/lib/attempts/use-streaming-queue.ts` | `attempt.jsx:17–42` (`useStreamingQueue` simulation hook in design; FE-5 ports the contract, replaces the simulated `setTimeout` with the real SSE adapter) | n/a |

Capability 4 is a small extension; FE-5 owns the edit to FE-4's file. Capability 7-onwards aren't listed because they're inherited unchanged from FE-4 (AttemptShell, header band, watermark, timer, integrity badge, submit modal, grading overlay, autosave, realism flag are all reused).

---

## B. Per-page detail specs

> **Template** (used identically for every page; propagates to FE-6..FE-9 verbatim):
> 1. Route segment + URL state
> 2. Components (scaffold reused / new in this PR / shadcn primitive / design primitive)
> 3. API endpoints consumed (incl. **SSE event sequence subsection** nested under §5 per FE-1 §G when SSE is involved)
> 4. Form fields + zod rules + react-hook-form integration shape (or "n/a — interaction-driven page" with TanStack Query + reducer notes)
> 5. States (every variant from the design state-strip + any extras the wire surfaces) — **for SSE-consuming pages: an "SSE event sequence" subsection sits below the state table and enumerates the event order**
> 6. Acceptance criteria (Gherkin — each trio maps to one Vitest test)
> 7. Edge cases / gotchas
> 8. Visual reference

### B.1 Per-Testee streaming runner — `/attempts/[attemptId]` (mode=per_testee)

**1. Route segment + URL state**

- File: existing FE-4 `frontend/src/app/(testee)/attempts/[attemptId]/page.tsx` — FE-5's only edit there is the mode branch swap (FE-4's `mode === "per_testee"` placeholder → `<StreamingAttemptRunner attempt={view} />`).
- Branch component: `frontend/src/components/attempt/streaming-attempt-runner.tsx` (new in FE-5). Mirrors FE-4's `FrozenAttemptRunner` / `BenchmarkAttemptRunner` shape (the FE-4 build session may name them inline within `page.tsx` rather than as separate components — FE-5 lifts the per-testee branch into its own file because its component graph is larger and tested in isolation).
- Route group + focus-mode child layout inherited from FE-4 §F.6 (`AttemptShell` wrapper, no Rail / no TopBar; parent guards for `requireAuthed` + `requirePrivacyAck` + `role === "testee"` still apply).
- URL params: `attemptId` (uuid). No query state. (Stream cursor is internal to `useStreamingQueue`; `?since=N` is sent on the SSE request, not reflected in the page URL.)
- Post-action routing: unchanged from FE-4 §B.1 — Exit → `/`, Submit → SubmitConfirmModal → GradingOverlay → `/attempts/[attemptId]/result` (FE-6 placeholder).
- Client component (interaction-heavy; reducer-driven state).

**2. Components**

*Scaffold reused (from FE-0..FE-4 — preconditions per §0):*

- All FE-4 attempt-runner primitives: `AttemptShell`, `AttemptHeaderBand`, `TimerPill`, `IntegrityBadge`, `Watermark`, `QuestionView` + per-type renderers (`QuestionMCQ`, `QuestionTrueFalse`, `QuestionMatching`, `QuestionShortAnswer`, `QuestionScenario`), `QuestionSkeleton` (FE-5 surfaces this — FE-4 §B.1 §2 lists it implicitly via the `loading` state but doesn't break it into its own component; FE-5's build session lifts it from the design's `attempt.jsx:408–422` and co-locates with `QuestionView`), `PauseOverlay` (user-pause case), `SubmitConfirmModal`, `GradingOverlay`, `FlagRealismButton`, `AutosaveIndicator`.
- All FE-4 hooks: `useAttempt`, `useIntegrity`, `useNow`.
- `attemptQueryKeys` from FE-4 §C.5, extended in §C.5 below.
- `client` + `unwrap` from `@/lib/api/client`; `ApiError` from `@/lib/api/errors`; sonner `toast` helpers from FE-1's `@/lib/ui/toast`.
- shadcn `Card`, `Button`, `Skeleton` from FE-2; `AlertDialog`, `RadioGroup`, `Checkbox`, `Textarea` from FE-4 §F.3.
- `Figure` / `InlineFigure` / `ChoiceFigure` typed stubs from FE-2.
- `Pill`, `Icon` from FE-2 primitives — `Icon name="wave"` (system-glitch glyph; verify availability in FE-2's icon set or add per §H (b) item 5).

*New in this PR (under `frontend/src/components/attempt/` and `frontend/src/lib/`):*

- `StreamingAttemptRunner` (`streaming-attempt-runner.tsx`) — composes the runner. Mounts `useAttempt`, calls `useStreamingQueue(attemptId, totalQuestionCount)`, renders `<AttemptShell>` → `<AttemptHeaderBand>` (with streaming-aware ProgressDots passed `arrivedIdx`) → two-column body: left = `<QuestionView>` (or `<QuestionSkeleton>` when `idx >= arrivedIdx`) + footer nav, right = `<JITQueue>` (desktop only). Pause overlay choice branches on `attempt.pause_reason`: `null` → FE-4's `<PauseOverlay>` (user-pause case), non-null (currently only `"generation_failed"`) → `<SystemGlitchOverlay reason={...} />`.
- `JITQueue` (`jit-queue.tsx`) — sidebar component per `attempt.jsx:295–343`. Props: `{ questions, idx, arrivedIdx, answers, onPick(i) }`. Internal: renders eyebrow + streaming pulse-dot + buffer card (positions ahead ready count) + 8-position bar + per-question `QueueItem` list.
- `QueueItem` (co-located in `jit-queue.tsx` or `jit-queue/item.tsx`) — per `attempt.jsx:345–403`. Four states: `done` (past, dimmed, ok dot) / `current` (raised bg, ink border, accent dot) / `ready` (default, accent dot) / `generating` (dashed border, `streaming-bar` keyframe overlay, pulse-dot). Click navigates iff state ≠ `generating`.
- `useStreamingQueue` (`@/lib/attempts/use-streaming-queue.ts`) — wraps `openAttemptStream`; returns `{ arrivedIdx, status, paused, close }`. `status ∈ "idle" | "connecting" | "streaming" | "done" | "paused" | "error"`. Drives `queryClient.invalidateQueries({ queryKey: attemptQueryKeys.detail(attemptId) })` on each question event (the SSE payload carries only `{id, attempt_position, attempt_id}`; the FE needs the refetched attempt view for the full question content — see §H (a) item 1). Internal: AbortController; cleanup on unmount; reconnect-with-`Last-Event-ID` policy delegated to the adapter.
- `openAttemptStream` (`@/lib/api/sse.ts`) — see §B.2 for the adapter spec.
- `SystemGlitchOverlay` (`system-glitch-overlay.tsx`) — see §B.4.

*Edits to FE-4 files (FE-5 owns these edits):*

- `frontend/src/app/(testee)/attempts/[attemptId]/page.tsx` — replace the `mode === "per_testee"` placeholder with `<StreamingAttemptRunner attempt={view} />`.
- `frontend/src/components/attempt/progress-dots.tsx` — extend with the `generating` state (dashed border + `streaming-bar` animated gradient) per `attempt.jsx:118–151`. Gated on a new `generatingPastIdx` prop (when `null`, FE-4 behaviour is unchanged; when set, positions ≥ `generatingPastIdx` render as `generating`).
- `frontend/src/lib/queries/attempts.ts` — add the `stream(id)` cursor key (see §C.5).
- `frontend/src/components/attempt/attempt-header-band.tsx` (if needed) — accept optional `arrivedIdx` prop and forward to `ProgressDots` via `generatingPastIdx={arrivedIdx}`. FE-4's spec text doesn't enumerate this prop shape; the FE-5 build session adds it as a small, additive extension.
- `frontend/src/app/globals.css` (FE-2 owned) — add the `@keyframes streaming-bar` rule per `attempt.jsx` (referenced but not authored in the prototype's CSS file). AC-CD-level structural addition; folds into FE-5 handover under FE-2 §G.

*shadcn primitives required:* none beyond FE-2 + FE-4. The JIT queue sidebar is hand-styled; the system-glitch overlay reuses `Card` + `Button`.

*Design primitives borrowed:* `Icon name="wave"` (the glitch glyph per `streaming-paused.jsx:144`); the design prototype's `streaming-bar` keyframe animation.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/attempts/{attempt_id}` | Initial fetch (resume / direct deep-link). For per_testee, `questions[]` contains rows with `attempt_position` populated up to the highest persisted position; `q1` field is **NULL on GET** (`q1` is only populated on POST per `app/schemas.py:548`). Re-fetched on each SSE event to populate full content for newly-arrived positions. | **Implemented.** Verified via OpenAPI + `app/routers/attempts.py:143`. |
| `POST /v1/attempts` | First-time entry — initial POST returns `AttemptView` with `q1` populated for per_testee (sub-3-s Q1 sync render). FE-5 does **not** own this caller; pill-detail "Practice at D{n}" (FE-3, blocked) does. FE-5 runner consumes a pre-existing attempt. | **Implemented.** `app/routers/attempts.py:100–130`. Surfaced as a constraint, not a FE-5 deliverable. |
| `GET /v1/attempts/{attempt_id}/stream` | **SSE endpoint.** Query `?since=N` (cursor; wins over `Last-Event-ID`). Header `Last-Event-ID` (browser auto-reconnect default). Header `Authorization` (bearer; the fetch-streaming adapter sets this — `EventSource` cannot per AC-CD22 rationale). Returns 409 `not_per_testee` for non-per-testee modes. See §5 SSE event-sequence subsection for payload shapes. | **Implemented.** Verified via OpenAPI (`/v1/attempts/{attempt_id}/stream`) + `app/routers/attempts.py:370–479`. Event payload shape carries **only identifying fields** (`id`, `attempt_position`, `attempt_id`); FE must refetch attempt view for the full question content. **Spec drift vs AC-CD22 wording — see §H (a) item 1.** |
| `POST /v1/attempts/{attempt_id}/pause` | User pause (unchanged from FE-4). On user-initiated pause during an active stream, FE closes the SSE adapter; backend in-flight Q-N tasks complete and persist before pause takes effect (verify §H (b) item 4). | **Implemented.** |
| `POST /v1/attempts/{attempt_id}/resume` | User resume. After resume, FE re-opens SSE with `?since=<highestArrivedPosition>` to replay any positions that completed during the pause window + continue any unfilled. | **Implemented.** |
| `POST /v1/attempts/{attempt_id}/autosave` | Per-question autosave (unchanged from FE-4). | **Implemented.** |
| `POST /v1/attempts/{attempt_id}/submit` | Submit (unchanged from FE-4). | **Implemented.** |
| `GET /v1/attempts/{attempt_id}/result` | Polled post-submit (unchanged from FE-4). | **Implemented.** |
| `POST /v1/attempts/{attempt_id}/questions/{question_id}/flag-realism` | Realism flag per AC-D22 (unchanged from FE-4; visible in per_testee mode per FE-4 §B.4). | **Implemented.** |

**4. Form fields + zod rules + react-hook-form integration shape**

n/a — interaction-driven page (same as FE-4 §B.1 §4). State extended via the FE-4 `useAttempt` reducer + the FE-5 `useStreamingQueue` hook running alongside it:

```ts
// useStreamingQueue contract (sketch)
type StreamStatus = "idle" | "connecting" | "streaming" | "done" | "paused" | "error";
type StreamingQueue = {
  arrivedIdx: number;   // highest attempt_position seen via the stream so far
  status: StreamStatus;
  // populated when status === "paused"
  pausedReason: "generation_failed" | "reconnect_exhausted" | null;
  failedPosition: number | null;
  // imperative
  close: () => void;
};
```

`useStreamingQueue` opens `openAttemptStream` on mount when `mode === "per_testee"` and `attempt.paused === false` and `attempt.submitted_at === null`. On each non-terminal event, it (a) advances `arrivedIdx` to the event's `attempt_position` and (b) invalidates `attemptQueryKeys.detail(attemptId)`. Terminal `done` transitions `status → "done"` and closes the adapter. Terminal `paused` transitions `status → "paused"` and surfaces `pausedReason` ∈ `{"generation_failed", "reconnect_exhausted"}` — `"generation_failed"` is the backend-emitted terminal; `"reconnect_exhausted"` is the FE-synthetic emitted by the adapter after the second reconnect failure (AC-CD22 contract). Both flavours surface the same `<SystemGlitchOverlay>` UI; the technical-details collapsible distinguishes them.

**TanStack Query coalescing.** Successive `invalidateQueries` calls during a burst of SSE events are coalesced by TanStack Query's natural deduplication (a single in-flight refetch absorbs further invalidations). No FE-side debounce required; verified against the v5 docs at build time.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `loading` | Initial GET in flight | Skeleton header band + skeleton question pane + skeleton sidebar |
| `q1-ready` | GET resolves; `arrivedIdx === 1` (Q1 persisted, Q2..N pending) | Q1 rendered in question pane; sidebar shows Q1 `current`, Q2..N `generating`; ProgressDots Q2..N dashed with animated bar |
| `streaming` | SSE open; one or more `arrivedIdx` advance events received | Question pane unchanged; sidebar Q≤arrivedIdx transitions `generating → ready`; ProgressDots updates accordingly |
| `done` | Terminal `done` event received | Sidebar all-non-current cells `ready` / `done`; ProgressDots all solid; streaming pulse-dot dismisses |
| `outrun-buffer` | `idx >= arrivedIdx && status !== "done"` | Question pane shows `<QuestionSkeleton>` with "preparing next question…" copy per AC-D25 wording; Next button disabled |
| `user-paused` | `attempt.paused === true && pause_reason === null` (FE-4 §B.1 `paused` state) | FE-4's `<PauseOverlay>` mounts; SSE adapter closed |
| `system-paused` | `attempt.paused === true && pause_reason !== null` (currently only `"generation_failed"`) | `<SystemGlitchOverlay reason="generation_failed">` mounts; SSE adapter closed; resume CTA reopens stream |
| `reconnect-exhausted` | FE-synthetic — adapter failed two reconnect attempts | `<SystemGlitchOverlay reason="reconnect_exhausted">` mounts; resume CTA reopens stream |
| `submitting` / `grading:*` | Per FE-4 §B.1 | Per FE-4 §B.1 |
| `error:fetch` | Initial GET throws | Pattern C boundary at FE-4's `(testee)/attempts/[attemptId]/error.tsx` (no FE-5 change) |
| `mode-guard:live` | `mode === "live"` (still unresolved per FE-4 §H (a) item 1) | FE-4's existing "not yet supported" placeholder; unchanged |

**SSE event sequence (per FE-1 §G — nested under §5)**

The wire-shape FE-5 implements against, sourced from `app/routers/attempts.py:370–479` + `app/domain/streaming.py:73–80`. **AC-CD22's wording diverges from this; FE-5 builds against the backend reality and surfaces the divergence as a blocker.**

**Initial connect (no prior stream).**

```
HTTP GET /v1/attempts/{attempt_id}/stream?since=0
Authorization: Bearer <access_token>
Accept: text/event-stream

→ 200 text/event-stream

  (no event: name — default "message")
  id: 2
  data: {"id": "<uuid>", "attempt_position": 2, "attempt_id": "<uuid>"}

  (no event: name)
  id: 3
  data: {"id": "<uuid>", "attempt_position": 3, "attempt_id": "<uuid>"}

  …

  event: done
  data: {"completed_positions": [2,3,4,5,6,7,8], "replayed_positions": []}
```

Q1 is **not** on the stream — it was persisted synchronously at POST /v1/attempts time and carried back in the POST response's `q1` field (or, on resume via direct GET, in `questions[]` at `attempt_position === 1`).

**Reconnect mid-stream (browser auto-reconnect or explicit resume).**

```
HTTP GET /v1/attempts/{attempt_id}/stream
Authorization: Bearer <access_token>
Last-Event-ID: 4
Accept: text/event-stream

→ replays persisted Question rows where attempt_position > 4 (replayed_positions in the terminal payload), then continues orchestration for any unfilled positions
```

If the FE wants explicit cursor control (e.g. on an `attempt.paused`-then-`resume` cycle where the adapter has been closed and re-opened deliberately), it sends `?since=N` instead of `Last-Event-ID`; the query param wins (`app/routers/attempts.py` cursor-precedence comment).

**Terminal `paused` (single Q-N retry exhausted server-side).**

```
event: paused
data: {"reason": "generation_failed", "failed_position": 5, "completed_positions": [2,3,4]}
```

The orchestration layer has already called `pause_attempt_from_streaming(attempt_id, "generation_failed")` server-side before emitting; the next GET /v1/attempts/{id} returns `paused: true, pause_reason: "generation_failed"`. FE-5 derives the system-glitch overlay from the `pause_reason`, not from in-memory state, so a tab reload that lands on a system-paused attempt still surfaces the correct overlay.

**FE-synthetic `paused` (adapter reconnect-exhausted).**

Emitted by the adapter (not the backend) after two reconnect failures. The adapter yields:

```ts
{ event: "paused", data: { reason: "reconnect_exhausted", failed_position: null, completed_positions: <arrivedIdx-set> } }
```

The FE attempt-row is **not** marked paused server-side in this case (the backend doesn't know the adapter died); on user click of "Try resuming →" the FE calls `openAttemptStream` afresh with `?since=<arrivedIdx>`. If the server has continued generating in the background, the persisted rows replay; if it hasn't (e.g. the server-side stream completed and the FE missed the terminal event), the replay catches up the FE state and the terminal `done` arrives.

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Per-Testee runner mounts and renders Q1 from POST response payload (entry via fresh POST /v1/attempts)
  Given an authenticated testee starts a per_testee attempt
  And POST /v1/attempts returns AttemptView with q1 populated and questions=[Q1]
  When the runner mounts at /attempts/{attemptId}
  Then the question pane renders Q1 immediately (no GET refetch needed)
  And the JITQueue sidebar renders Q1 as "current" and Q2..N as "generating"
  And the SSE stream opens at GET /v1/attempts/{attemptId}/stream?since=1

Scenario: Direct deep-link entry renders Q1 from GET response questions[]
  Given an authenticated testee navigates directly to /attempts/{attemptId} for a per_testee attempt with Q1 already persisted (sequence_number > 0, attempt_position=1 question exists)
  When the runner mounts
  Then GET /v1/attempts/{attemptId} fires
  And the question pane renders the questions[] entry where attempt_position === 1
  And q1 is null in the response (per the GET vs POST contract)
  And the SSE stream opens at ?since=1

Scenario: SSE question_ready event advances arrivedIdx and invalidates attempt cache
  Given the streaming runner is mounted with arrivedIdx === 1
  When an SSE event arrives with id=2 and data={attempt_position: 2, ...}
  Then arrivedIdx advances to 2
  And attemptQueryKeys.detail(attemptId) is invalidated
  And a single refetch of GET /v1/attempts/{attemptId} fires (TanStack Query coalescing)
  And once the refetch resolves, the JITQueue Q2 row transitions from "generating" to "ready"
  And the ProgressDots Q2 transitions from dashed-with-bar to solid var(--bg-deep)

Scenario: Burst of SSE events coalesces to a single refetch
  Given the streaming runner is mounted with arrivedIdx === 1
  When three SSE events arrive within 100ms (positions 2, 3, 4)
  Then arrivedIdx advances to 4
  And exactly one refetch of GET /v1/attempts/{attemptId} fires (no per-event refetch storm)
  And after the refetch resolves, Q2, Q3, Q4 all transition to "ready"

Scenario: User outruns the buffer
  Given arrivedIdx === 3 and idx === 0 (user is on Q1)
  When the user clicks Next twice (idx → 2)
  Then the question pane renders Q3 (idx=2; arrivedIdx === 3 means Q3 ready)
  When the user clicks Next once more (idx → 3, but arrivedIdx still === 3)
  Then the question pane renders <QuestionSkeleton> with the AC-D25 "preparing next question…" copy
  And the Next button is disabled
  When the next SSE event arrives (arrivedIdx → 4)
  Then the question pane refetches and renders Q4
  And the Next button re-enables

Scenario: Terminal done event closes the stream cleanly
  Given the streaming runner is mounted and the buffer has filled through arrivedIdx === N (all questions arrived)
  When an SSE event with event: done arrives
  Then the streaming status transitions to "done"
  And the JITQueue streaming pulse-dot dismisses (replaced by "all questions arrived")
  And the ProgressDots no longer animate
  And the SSE adapter close() runs (no further reconnect attempts)

Scenario: Terminal paused event (backend-emitted, generation_failed) surfaces system-glitch overlay
  Given the streaming runner is mounted with arrivedIdx === 3
  When an SSE event with event: paused and data={reason: "generation_failed", failed_position: 4, ...} arrives
  Then the streaming status transitions to "paused" with pausedReason === "generation_failed"
  And the <SystemGlitchOverlay reason="generation_failed"> mounts
  And the question pane visibility is hidden (same integrity rule as user-pause)
  And subsequent GET /v1/attempts/{attemptId} returns paused=true and pause_reason="generation_failed"
  And clicking "Try resuming →" calls POST /v1/attempts/{attemptId}/resume then re-opens the SSE stream

Scenario: Adapter reconnect-exhausted emits FE-synthetic paused
  Given the streaming runner is mounted with arrivedIdx === 2
  When the underlying fetch stream errors mid-stream
  Then the adapter retries once with Last-Event-ID: 2
  When the retry also errors
  Then the adapter yields a synthetic event paused with reason="reconnect_exhausted"
  And the streaming status transitions to "paused" with pausedReason === "reconnect_exhausted"
  And the <SystemGlitchOverlay reason="reconnect_exhausted"> mounts
  And the attempt is NOT marked paused on a subsequent GET /v1/attempts/{attemptId}
  And clicking "Try resuming →" re-opens the SSE stream with ?since=2 (does NOT call POST /resume)

Scenario: User-pause closes the stream; resume reopens with cursor
  Given the streaming runner is mounted with arrivedIdx === 4 and idx === 1
  When the user clicks Pause
  Then POST /v1/attempts/{attemptId}/pause fires
  And the SSE adapter close() runs
  And FE-4's <PauseOverlay> mounts (NOT the SystemGlitchOverlay — pause_reason is null)
  When the user clicks Resume
  Then POST /v1/attempts/{attemptId}/resume fires
  And the SSE stream re-opens at ?since=4
  And any positions that completed server-side during the pause window are replayed and arrivedIdx advances accordingly

Scenario: Mode resolver routes per_testee through StreamingAttemptRunner
  Given the runner page mounts with attempt.test.mode === "per_testee"
  When the page renders
  Then <StreamingAttemptRunner /> renders (not FE-4's mode-guard placeholder)

Scenario: Mode resolver routes frozen / benchmark through FE-4 runners unchanged
  Given the runner page mounts with attempt.test.mode === "frozen"
  When the page renders
  Then FE-4's FrozenAttemptRunner renders (no streaming machinery activated, no SSE call)

Scenario: 409 not_per_testee defends against routing bugs
  Given the runner page somehow opens the SSE stream for a frozen attempt
  When GET /v1/attempts/{attemptId}/stream returns 409 with code "not_per_testee"
  Then the adapter throws ApiError and the streaming status transitions to "error"
  And a sonner danger toast surfaces "streaming unavailable for this attempt mode"
  And the runner falls back to non-streaming mode for the current render (no second connect attempt)

Scenario: JIT queue hidden on mobile per design
  Given the runner is mounted at a viewport <= md breakpoint
  When the streaming runner renders
  Then the JITQueue aside element does not render (mobile-hide rule per attempt.jsx:211)
  And the ProgressDots strip still renders with the streaming-aware variant
```

**7. Edge cases / gotchas**

- **Q1 sync vs GET-resume asymmetry.** `POST /v1/attempts` for per_testee returns `q1` in the AttemptView; `GET /v1/attempts/{id}` does **not** populate `q1` (verified in `app/schemas.py:548–556`). On resume / direct-deep-link, FE-5 reads Q1 from `questions[]` where `attempt_position === 1`. The runner does NOT depend on `q1` being present — it derives the current question via `questions.find(q => q.attempt_position === idx + 1)`.
- **`questions[]` array is sparse mid-stream.** Until SSE events have advanced `arrivedIdx`, `questions[]` only contains positions 1..arrivedIdx. The runner reads from `questions.find(q => q.attempt_position === N)` and falls back to `<QuestionSkeleton>` when the lookup misses.
- **SSE event payload is identifying-only.** The backend payload carries `{id, attempt_position, attempt_id}` and the FE refetches via GET to populate full question content. This is intentional ("the FE follows up with a GET /v1/attempts/{id} … which keeps the SSE event small" — `app/routers/attempts.py:495–501`). **AC-CD22 spec wording diverges; see §H (a) item 1.**
- **Event-name shape: no explicit `event:` on question events.** Backend emits standard SSE `id: <N>` + `data: <json>` for question events (default `message` event type), with explicit `event:` only on terminal `done` / `paused`. AC-CD22 says `question_ready`. The adapter consumes whatever shape the backend emits; the abstraction the consumer reducer sees is `StreamEvent` with discriminated variants `{kind: "question", attempt_position, id, attempt_id} | {kind: "done", ...} | {kind: "paused", reason, ...}`. **See §H (a) item 2.**
- **Synthetic vs backend `paused`.** Both surface the same UI overlay; the technical-details collapsible distinguishes them via `reason` ("`generation_failed`" vs "`reconnect_exhausted`"). Server-side state differs: `generation_failed` flips `attempt.paused = true` server-side; `reconnect_exhausted` does NOT. The "Try resuming →" button branches:
  - `reason === "generation_failed"` → POST /v1/attempts/{id}/resume + re-open SSE
  - `reason === "reconnect_exhausted"` → re-open SSE only (no POST /resume; attempt was never server-paused)
- **Refetch storm avoidance.** TanStack Query v5 coalesces in-flight refetches: a second `invalidateQueries` call while a refetch is pending re-uses that pending refetch (does not fire a parallel one). No FE debounce required. Spec calls this out so the build session doesn't add a defensive debounce that masks bugs.
- **Authorization header on SSE.** AC-CD22 mandates the fetch-streaming adapter (not `EventSource`) specifically because `EventSource` cannot set arbitrary headers; the adapter sets `Authorization: Bearer <access_token>` from the in-memory access token. **Token refresh during a live stream:** if the access token expires mid-stream, the next fetch (on reconnect) gets 401, the FE 401-retry path (FE-0) refreshes, and the reconnect uses the new token. The mid-stream connection itself can't refresh — it stays open with the old token until the server drops it or the stream ends. v1 acceptable trade.
- **Watermark performance unchanged from FE-4.** `Watermark` is memoised against `[user.name, attemptId, date]` and does NOT re-render on SSE events.
- **`useNow` subscriptions unchanged.** Only `TimerPill` subscribes; SSE event arrival does not trigger a clock tick.
- **AbortController cleanup on unmount.** The adapter exposes `close()`; `useStreamingQueue`'s effect cleanup calls it. A route change away from the runner cleanly tears down the stream — verified in the page integration tests.
- **Anchor-question interleave** (AC-D25 v1.8) is server-side; FE renders whatever `questions[]` returns. No FE branch needed.
- **`?since=0` vs missing.** The adapter sends `?since=<arrivedIdx>` on first connect (initially `arrivedIdx === 1` because Q1 is already in hand; so `?since=1` is the first-connect cursor — replays positions > 1, i.e. Q2..N if any persisted, otherwise orchestrates them). The backend's "Defensive default if neither: cursor = 0 (replay everything from position 1)" path is **not** exercised by the FE — FE always sends an explicit cursor.
- **Streaming + `mode === "live"` interaction.** Out of scope until the `live`-mode spec-clarification PR lands (FE-4 §H (a) item 1). FE-5 does not branch on `live`.

**8. Visual reference**

- `attempt.jsx:47–237` (AttemptScreen — the JIT-queue-bearing variant; FE-5 is the FE realisation of this exact shape).
- `attempt.jsx:295–403` (JITQueue + QueueItem).
- `attempt.jsx:118–151` (per-question dots with streaming animation).
- `attempt.jsx:155–171` (user-paused overlay — FE-4 owned, FE-5 reuses).
- `streaming-paused.jsx:132–191` (system-glitch overlay — FE-5 new component).
- `streaming-paused.jsx:196–234` (comparison table pinning the lexicon divergence between user-pause and system-glitch).
- Screenshots: `01-attempt.png`, `02-attempt.png`, `03-attempt.png` (FE-4 inherits these as runner canonical — the sidebar visible in these screenshots is the FE-5 territory FE-4 explicitly omitted); `v6-fe5-13-streaming-paused.png` (the system-glitch overlay states).

---

### B.2 SSE client adapter — `openAttemptStream`

**1. Route segment + URL state**

n/a — this is a library function at `frontend/src/lib/api/sse.ts`. AC-CD22 is the spec body; this section is FE-5's implementation specification of that anchor.

**2. Components / exports / deps**

*Scaffold reused:*

- The base URL + bearer-token plumbing from `frontend/src/lib/api/client.ts` (FE-0). The adapter does **not** go through `openapi-fetch` — codegen does not produce typed bindings for SSE responses. The adapter is hand-written. Token access uses the same `getAccessToken()` accessor `openapi-fetch` uses.
- `ApiError` from `@/lib/api/errors` (FE-0) for 4xx / 5xx surface.

*New in this PR:*

- `openAttemptStream(attemptId, opts?)` — the adapter. Returns `{ events: AsyncIterable<StreamEvent>, close: () => void }`.
- `parseSseFrame(buffer: string)` — internal pure function that consumes the per-line SSE protocol (`id:`, `event:`, `data:`, blank-line terminator).
- TypeScript types:

```ts
export type StreamEvent =
  | { kind: "question"; id: string; attempt_position: number; attempt_id: string }
  | { kind: "done"; completed_positions: number[]; replayed_positions: number[] }
  | { kind: "paused"; reason: "generation_failed" | "reconnect_exhausted"; failed_position: number | null; completed_positions: number[] };

export type StreamOpts = {
  since?: number;            // explicit cursor (?since=N); takes precedence over Last-Event-ID
  lastEventId?: string;      // Last-Event-ID header (browser auto-reconnect convention)
};
```

*Adapter behaviour* (locks the AC-CD22 contract against the backend reality):

1. Opens `GET /v1/attempts/{attempt_id}/stream` with `Authorization: Bearer <access_token>` and `Accept: text/event-stream`. Adds `?since=<N>` query param if `opts.since` is set; otherwise adds `Last-Event-ID: <id>` header if `opts.lastEventId` is set; if neither, sends no cursor (backend defaults to `cursor = 0`).
2. Reads `response.body` as `ReadableStream<Uint8Array>`; pipes through `TextDecoderStream`; parses SSE frames line-by-line.
3. Each frame is dispatched into one of the three `StreamEvent` discriminants:
   - **Question event:** no `event:` line (default `message`), `id: <position>`, `data: {…}`. Adapter yields `{ kind: "question", id, attempt_position: Number(id), attempt_id }`.
   - **Terminal `done`:** `event: done`, `data: {…}`. Yields `{ kind: "done", … }`. Closes after yield.
   - **Terminal `paused` (backend):** `event: paused`, `data: { reason: "generation_failed", … }`. Yields `{ kind: "paused", reason: "generation_failed", … }`. Closes after yield.
4. On `response.ok === false`: throws `ApiError` (4xx / 5xx flow per FE-0). 409 `not_per_testee` is the canonical mode-misroute case.
5. On stream error mid-flight (network drop, unexpected EOF, server 5xx after headers): retries **once** with the highest received `id` as `Last-Event-ID`. If the second connect also errors before any further frame, yields a synthetic `{ kind: "paused", reason: "reconnect_exhausted", failed_position: null, completed_positions: <set of arrived positions> }` and closes.
6. `close()` aborts the underlying `AbortController`; the consumer `AsyncIterable` exits cleanly (`return` rather than throw).

*Module surface:*

```ts
export function openAttemptStream(
  attemptId: string,
  opts?: StreamOpts,
): { events: AsyncIterable<StreamEvent>; close: () => void };
```

No exports beyond `openAttemptStream` and the types. The consumer (`useStreamingQueue`) owns the reducer; the adapter is stateless beyond its in-flight connection.

**3. API endpoints consumed**

- `GET /v1/attempts/{attempt_id}/stream` (see §B.1 §3).

**4. Form fields + zod rules + react-hook-form integration shape**

n/a — pure library function.

**5. States**

n/a (library, not a UI). Consumer states live in `useStreamingQueue` (§B.1 §5).

**6. Acceptance criteria (Gherkin — unit-level)**

```gherkin
Scenario: Opens with bearer token and parses a question event
  Given the access token is "tok-abc"
  When openAttemptStream("a-1") is called
  Then the fetch is GET /v1/attempts/a-1/stream
  And the Authorization header is "Bearer tok-abc"
  And Accept is "text/event-stream"
  When the server emits id: 2\ndata: {"id":"q-uuid","attempt_position":2,"attempt_id":"a-1"}\n\n
  Then the iterator yields { kind: "question", id: "q-uuid", attempt_position: 2, attempt_id: "a-1" }

Scenario: Cursor precedence — since wins over lastEventId
  When openAttemptStream("a-1", { since: 4, lastEventId: "2" }) is called
  Then the request URL includes ?since=4
  And no Last-Event-ID header is sent

Scenario: Reconnect once with Last-Event-ID on mid-stream error
  Given a connection that errors after emitting id: 3
  When the stream errors
  Then the adapter immediately reconnects with Last-Event-ID: 3
  When the reconnect succeeds and emits id: 4
  Then the iterator yields the question event for position 4

Scenario: Synthetic paused after two failed connects
  Given a connection that errors before any frame
  When the adapter retries once with Last-Event-ID: <last seen> and that retry errors before any frame
  Then the iterator yields { kind: "paused", reason: "reconnect_exhausted", failed_position: null, completed_positions: [...arrived] }
  And the iterator then completes (no further yields)

Scenario: close() aborts cleanly
  Given an open stream with the iterator parked on the next frame
  When the consumer calls close()
  Then the AbortController fires
  And the iterator's next .next() call resolves to { done: true } (clean exit, no throw)

Scenario: 409 not_per_testee throws ApiError
  When openAttemptStream is called against a frozen attempt
  And the response status is 409 with body { error: { code: "not_per_testee", … } }
  Then the iterator throws ApiError with code "not_per_testee"

Scenario: Terminal done closes the stream
  Given an open stream
  When the server emits event: done\ndata: {"completed_positions":[2,3,4],"replayed_positions":[]}\n\n
  Then the iterator yields { kind: "done", completed_positions: [2,3,4], replayed_positions: [] }
  And the iterator then completes
```

**7. Edge cases / gotchas**

- **Multiline `data:` frames.** Backend emits single-line JSON (`json.dumps`), so the parser does not need to concatenate multi-`data:` frames. If a future backend change introduces multi-line payloads, the parser must concatenate per spec.
- **Browser `EventSource` rejected.** AC-CD22 rationale: `EventSource` can only carry the bearer token in the URL. We don't allow that.
- **`TextDecoderStream` polyfill.** Available in all evergreen browsers; Next.js 15 supports it natively. Test environment (jsdom + MSW v2 `ReadableStream` support) verified at build time.
- **AbortController on Safari.** Safari ≥ 17 supports `signal` on `fetch` requesting streaming bodies. v1 KBC-pilot deployment assumes evergreen browsers — out-of-scope to support older targets.
- **Retry counter is per-connection, not per-event.** Two successive errors *anywhere in the stream lifetime* exhaust the budget. Successful reconnect resets the counter (the second connect is what reset it; a third error → fourth connect is permitted? **No** — adapter is "one reconnect attempt, period"). Spec lock: total connect attempts per `openAttemptStream` call ≤ 2. To get a third try, the consumer must call `openAttemptStream` again (which `useStreamingQueue` does on user-resume).
- **Buffering inside `TextDecoderStream`.** Frames straddling chunk boundaries are handled by an internal line-buffer in `parseSseFrame`. Build session locks the buffer impl + a test that splits a frame across two reads.
- **Token expiry mid-stream.** Cannot be refreshed on the live connection. On reconnect (after error), the FE-0 401-refresh path applies via the standard `client.ts` plumbing. Acceptable v1 trade.

**8. Visual reference**

n/a — library code. AC-CD22 (`CODE_SPEC.md:1040–1095`) is the authoritative spec body.

---

### B.3 JIT queue sidebar — `JITQueue` + `QueueItem`

**1. Route segment + URL state**

Component co-located with the streaming runner (not its own route). File: `frontend/src/components/attempt/jit-queue.tsx`. Mobile-hidden via the parent `aside` carrying `className="hide-mobile"` (FE-2 owned utility class) per `attempt.jsx:211`.

**2. Components**

*Scaffold reused:* `Pill` (FE-2), `Icon` (FE-2). `attempt.jsx`'s `.pulse-dot` CSS rule and `streaming-bar` keyframe (added to `globals.css` in this PR per §B.1 §2).

*New in this PR:*

- `JITQueue` — wrapper component. Props: `{ questions: AttemptQuestion[], currentIdx: number, arrivedIdx: number, answers: Map<string, AnswerPayload>, status: StreamStatus, onPick(idx): void }`.
- `QueueItem` — per-question card. Props: `{ q: AttemptQuestion, idx: number, state: "done"|"current"|"ready"|"generating", answered: boolean, onPick(): void }`.

*Inner layout* (per `attempt.jsx:295–403`):

- Eyebrow row: "Queue" + pulse-dot + "streaming" meta (replaced by "done · {N} arrived" when `status === "done"`).
- Buffer card: "BUFFER · {arrivedIdx - currentIdx - 1} ready" (warn-coloured when < 2); 8-position bar; "{arrivedIdx} of {questions.length} arrived · Q1 took 2.4s · others stream in parallel" copy. The "Q1 took 2.4s" copy is **placeholder text** in the design; in production the FE pulls the actual Q1 generation time from `attempt.started_at - attempt.created_at` if surfaced (verify §H (b) item 7). If not, drop the timing copy and just show "{arrivedIdx} of {N} arrived".
- Per-question cards: `QueueItem` with the four states.

**3. API endpoints consumed**

n/a — pure render component. Data flows in via props from `StreamingAttemptRunner`.

**4. Form fields + zod rules + react-hook-form integration shape**

n/a.

**5. States**

| Component state | Trigger | Visual |
|---|---|---|
| `done` (per-item) | `idx < currentIdx` | Dim ink-3 text, ok-coloured dot, "answered" / "skipped" meta. |
| `current` (per-item) | `idx === currentIdx` | Raised bg, ink border, accent dot, "in progress" meta. |
| `ready` (per-item) | `idx > currentIdx && idx < arrivedIdx` | Default bg, ink-2 text, accent dot, "ready" meta. |
| `generating` (per-item) | `idx >= arrivedIdx` | Dashed border, `streaming-bar` animated overlay, pulse-dot dot, "Generating…" label + "asyncio.gather · pos {idx+1}" meta. |
| Streaming pulse-dot in eyebrow | `status === "streaming"` | Visible. |
| Buffer warn colour | `arrivedIdx - currentIdx - 1 < 2` | Warn-coloured numeric. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Initial render with arrivedIdx === 1 shows Q1 current and Q2..N generating
  Given questions=[Q1..Q8], currentIdx=0, arrivedIdx=1
  When JITQueue renders
  Then Q1 row carries state "current"
  And Q2..Q8 rows carry state "generating"
  And Q2..Q8 rows render the dashed border + streaming-bar overlay
  And the buffer chip reads "0 ready" with warn colour

Scenario: Click on a ready item navigates; click on a generating item is ignored
  Given currentIdx=0, arrivedIdx=3, questions=[Q1..Q8]
  When the testee clicks Q2 row
  Then onPick(1) is called
  When the testee clicks Q5 row (state="generating")
  Then onPick is NOT called
  And the cursor on Q5 is "not-allowed"

Scenario: Status done dismisses the streaming pulse-dot
  Given status="done"
  When JITQueue renders
  Then the eyebrow streaming pulse-dot is not rendered
  And the eyebrow meta reads "done · 8 arrived"
```

**7. Edge cases / gotchas**

- **Question-type label fallback.** `QueueItem`'s type label ("MC" / "T/F" / etc.) reads from `q.type`. For positions in `generating` state, the question hasn't been fetched yet — `q` is a placeholder `{attempt_position: N}`. The card shows "Generating…" instead of the type label per the design.
- **Layout regressions on long Q labels.** The design caps the QueueItem at the sidebar width (~260px); the type label is short by construction (2-8 chars). No truncation logic needed in v1.
- **`question_group_id` interleaving.** Per AC-D24, questions sharing a group shuffle as a block. The JIT queue renders in `attempt_position` order (whatever the server returned). The "this is a grouped question" hint is **not** surfaced in v1 — out of scope, no design.

**8. Visual reference**

- `attempt.jsx:295–403`. The sidebar is visible in `01-attempt.png`, `02-attempt.png`, `03-attempt.png` (the legacy screenshots that FE-4 retained as canonical for the runner chrome; FE-5 retroactively claims those screenshots' right-column sidebar as FE-5 territory).

---

### B.4 System-glitch overlay — `SystemGlitchOverlay`

**1. Route segment + URL state**

Component co-located with the streaming runner. File: `frontend/src/components/attempt/system-glitch-overlay.tsx`.

**2. Components**

*Scaffold reused:* shadcn `Card` (via FE-2), `Button` (via FE-2), `Icon name="wave"` (verify in FE-2's icon set, add if absent — §H (b) item 5).

*New in this PR:*

- `SystemGlitchOverlay` — props `{ reason: "generation_failed" | "reconnect_exhausted", failedPosition: number | null, traceId?: string | null, completedPositions: number[], onResume: () => void }`.
- Internal: `expanded: boolean` local state for the technical-details collapsible (default `false` per `streaming-paused.jsx:132`).

*Inner layout* (per `streaming-paused.jsx:132–191`):

- Wave glyph (42x42 circle, bg-sunk, ink-3, neutral border) — `streaming-paused.jsx:137–145`.
- Serif headline: "*Connection* issue." (serif-italic "Connection" + serif "issue.") — `streaming-paused.jsx:148–150`.
- Muted body: "We hit a glitch generating your next questions. Try resuming in a minute — your progress is saved and your timer is held." — `streaming-paused.jsx:151–154`.
- Primary CTA: "Try resuming →" (NOT "Resume →" — the lexical nuance per the `streaming-paused.jsx:196–234` comparison table is "gentle nuance — not certain") — `streaming-paused.jsx:156–160`.
- Collapsible: "+ show technical details" / "— hide technical details" toggle. When expanded, monospace block showing `code` (the `reason` value), `trace` (the `traceId` value or "—"), `buffer` (e.g. "0 questions ahead (Q{failedPosition}–Q{N} generating)" derived from `failedPosition` + `completedPositions`).
- Crucially: pause budget is **not** shown (system-glitch doesn't consume the user's pause budget per AC-D11 — the comparison-table row `Pause budget` confirms).

*Resume CTA wiring* (the differentiator between the two `reason` variants):

- `reason === "generation_failed"`: `onResume()` calls `POST /v1/attempts/{attemptId}/resume` then re-opens the SSE stream via `useStreamingQueue.reconnect()`.
- `reason === "reconnect_exhausted"`: `onResume()` only re-opens the SSE stream (no POST; the attempt was never server-side paused).

**3. API endpoints consumed**

- `POST /v1/attempts/{attempt_id}/resume` (only when `reason === "generation_failed"`).

**4. Form fields + zod rules + react-hook-form integration shape**

n/a — single CTA.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `collapsed` | Default | Wave + headline + body + CTA + "+ show technical details" link. |
| `expanded` | User clicks the disclosure toggle | Collapsible expanded; monospace block visible. |
| `resuming` | `onResume()` in flight | CTA disabled + spinner; "Try resuming…" copy. |
| `resume-failed` | `onResume()` mutation throws | sonner danger toast; overlay remains; CTA re-enabled. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Overlay renders with the wave glyph and "Connection issue." headline
  Given SystemGlitchOverlay is rendered with reason="generation_failed"
  Then the wave glyph renders
  And the headline contains "Connection issue." (with serif-italic "Connection")
  And the body contains "We hit a glitch generating your next questions"
  And the CTA reads "Try resuming →"
  And the technical-details block is collapsed

Scenario: Expand technical details reveals reason, trace, buffer
  Given SystemGlitchOverlay rendered with reason="generation_failed", failedPosition=5, traceId="abc", completedPositions=[2,3,4]
  When the testee clicks "+ show technical details"
  Then the block expands
  And it shows "code  generation_failed"
  And it shows "trace  abc"
  And it shows "buffer  0 questions ahead (Q5–QN generating)"
  When the testee clicks "— hide technical details"
  Then the block collapses

Scenario: generation_failed resume calls POST /resume then reopens SSE
  Given SystemGlitchOverlay rendered with reason="generation_failed"
  When the testee clicks "Try resuming →"
  Then POST /v1/attempts/{attemptId}/resume fires
  And on 2xx, the SSE stream re-opens at ?since=<arrivedIdx>
  And the overlay dismisses

Scenario: reconnect_exhausted resume reopens SSE without POST /resume
  Given SystemGlitchOverlay rendered with reason="reconnect_exhausted"
  When the testee clicks "Try resuming →"
  Then NO POST /resume fires
  And the SSE stream re-opens at ?since=<arrivedIdx>
  And the overlay dismisses
```

**7. Edge cases / gotchas**

- **Pause budget is intentionally absent.** The comparison table in `streaming-paused.jsx:196–234` is the canonical spec for what differs from the user-paused overlay. The build session must not silently add "N of 30 pause minutes remaining" to the system-glitch variant.
- **The `traceId` field.** FE-4 §H (c) item 5 already added optional `traceId` to `ApiError` populated from `x-acumen-trace` header. The streaming runner captures the trace id from the SSE response headers if present (verify §H (b) item 6) and threads it into the overlay. If the header isn't set on the SSE response, `traceId` is `null` and the row reads `trace —`.
- **Timer behaviour during system-glitch.** Per `streaming-paused.jsx:196` comparison row "Timer behaviour · held / held", both overlays hold the timer. For `reason === "generation_failed"`, the server has already marked the attempt paused, so `pause_seconds_remaining` is server-derived and the FE `TimerPill` is held via the existing FE-4 `paused`-aware path. For `reason === "reconnect_exhausted"`, the FE holds the timer locally (sets `useNow`'s `enabled=false`) until the resume succeeds — but the attempt is NOT server-paused, so on POST /resume there's nothing to resume server-side. **Verify §H (b) item 8.**
- **No "Decline" / "Abandon" path.** Design does not include an abandon CTA. Out of scope for v1.

**8. Visual reference**

- `streaming-paused.jsx:132–191` (the overlay).
- `streaming-paused.jsx:196–234` (comparison table — canonical for the user-pause vs system-glitch divergence; the build session reads this row-by-row before touching copy).
- Screenshot: `v6-fe5-13-streaming-paused.png`.

---

## C. Cross-page concerns

### C.1 Mode resolver at the runner page

FE-4 owns `(testee)/attempts/[attemptId]/page.tsx`. The page reads `attempt.test.mode` and branches:

- `mode === "frozen"` → FE-4 frozen runner (unchanged).
- `mode === "benchmark"` → FE-4 benchmark runner (unchanged).
- `mode === "per_testee"` → **FE-5 `<StreamingAttemptRunner />`** (replaces FE-4's placeholder).
- `mode === "live"` → FE-4 "not yet supported" placeholder (unchanged; blocker FE-4 §H (a) item 1 inherited).

The branch is a single edit FE-5 owns. No new page file.

### C.2 Focus-mode child layout (FE-4 §F.6) — reused unchanged

`(testee)/attempts/[attemptId]/layout.tsx` — FE-4's focus-mode override hosts the streaming runner the same way it hosts the frozen / benchmark runners. No new layout, no override.

### C.3 `useAttempt` reducer — extended (not replaced)

FE-5 does **not** introduce a parallel reducer. The existing `useAttempt` (FE-4 §C.3) already owns `currentIndex`, `answers`, `autosaveQueue`, `autosaveState`, `flaggedQuestions`, `pauseState`. FE-5 adds a sibling hook (`useStreamingQueue`) that runs alongside `useAttempt`; the streaming hook owns `arrivedIdx` + `status` + `pausedReason`. The two hooks coordinate via `attempt.paused` + `attempt.pause_reason` (server-side state read from the cached AttemptView) — they do **not** share a reducer.

Coordination rules:

- `useStreamingQueue` opens the stream on mount iff `mode === "per_testee" && !attempt.paused && !attempt.submitted_at`.
- When `attempt.paused === true` flips (via POST /pause from `useAttempt`, or via a backend `paused` terminal event refetching the attempt), `useStreamingQueue` closes its adapter.
- When `attempt.paused === false` flips (via POST /resume), `useStreamingQueue` re-opens with `?since=<arrivedIdx>`.

Spec lock: the runner does NOT thread `useStreamingQueue`'s `close()` imperatively through `useAttempt`'s actions; it reads `attempt.paused` reactively and tears down via a `useEffect` dependency.

### C.4 Query-key library extension

FE-4 introduced `attemptQueryKeys` at `frontend/src/lib/queries/attempts.ts`. FE-5 extends with the stream cursor key:

```ts
export const attemptQueryKeys = {
  all: ["attempts"] as const,
  detail: (id: string) => [...attemptQueryKeys.all, id] as const,
  result: (id: string) => [...attemptQueryKeys.all, id, "result"] as const,
  inFlight: () => [...attemptQueryKeys.all, "inflight"] as const,
  stream: (id: string) => [...attemptQueryKeys.all, id, "stream"] as const,  // new — FE-5
};
```

The `stream(id)` key is intentionally **not** used for a TanStack-Query subscription (SSE is an async iterable, not a query). It exists so the FE has a single place to record "this attempt's stream cursor" if a future need arises (e.g. cross-component coordination). For FE-5 itself, `useStreamingQueue` is the sole owner of stream state.

### C.5 Refetch-on-event strategy

Each non-terminal SSE event invalidates `attemptQueryKeys.detail(attemptId)`, which triggers a refetch. TanStack Query v5 coalesces in-flight refetches: a second `invalidateQueries` while a refetch is pending re-uses that refetch. The runner does not implement an FE-side debounce.

Rationale: the SSE event payload carries only `{id, attempt_position, attempt_id}` (the backend's intentional choice per `app/routers/attempts.py:494–501`). Without a refetch, the FE has no way to render the new question's content (`config`, `type`, `prompt`, etc.). The refetch returns the full attempt view including all persisted questions; subsequent events that arrive while the refetch is in flight coalesce.

**Trade-off documented for the build session:** every SSE event triggers a refetch of the full AttemptView (which can be tens of KB for a populated attempt). For a 5-question buffer in a 30-question attempt, that's ~5 refetches over the course of the answer window. Acceptable for v1; if the payload grows past ~100 KB / refetch in practice, the build session may add a debounce or switch to per-question fetches.

### C.6 Entry-point shapes (POST vs GET deep-link)

The runner page is reached in two ways:

- **Fresh POST /v1/attempts → router push:** the upstream caller (pill-detail "Practice at D{n}", once unblocked per FE-3 §H (b) item 3 / FE-4 §H (a) item 2) calls `POST /v1/attempts` with `{test_id, origin, assignment_id?}`. For per_testee mode, the response carries `q1` populated. The caller pushes to `/attempts/{attemptId}` and the runner mounts. The runner's `useQuery({ queryKey: attemptQueryKeys.detail(id) })` initially has no cache; it fires GET /v1/attempts/{id}. By the time GET resolves, `q1` is gone (POST-only field) but `questions[]` carries the position-1 entry, so the runner reads Q1 from `questions.find(q => q.attempt_position === 1)`.
  - **Optimisation:** the upstream caller `prefetchQuery` or `setQueryData` (`attemptQueryKeys.detail(id)`) with the POST response *before* the route push, so the runner mounts with the cache primed. The runner does not depend on this optimisation — it works either way.
- **Direct deep-link:** the testee hits `/attempts/{attemptId}` (refresh, browser back, etc.). The runner fires GET; `questions[]` carries all persisted positions; the runner reads Q1 from `questions[]`. If `attempt.paused === true`, the runner mounts directly into the appropriate overlay (user-pause vs system-glitch by `pause_reason`); the SSE stream does NOT open. On user-resume click, POST /resume fires and the stream opens.

### C.7 Integrity surface — unchanged from FE-4 §C.1

`useIntegrity` continues to install AC-D4 deterrents on the focus-mode child layout mount; the watermark continues to mount inside `AttemptShell`. SSE event activity is NOT a focus event; the existing `document.visibilitychange` listener is unaffected by stream presence.

### C.8 Pause origin distinction — the new server-side signal

`AttemptView.pause_reason` (`app/schemas.py:540–545`) is the FE-5 differentiator:

- `pause_reason === null` (server default for the user-pause path): FE-4's `<PauseOverlay>` mounts.
- `pause_reason === "generation_failed"` (the only non-null value in v1): FE-5's `<SystemGlitchOverlay>` mounts.

The discriminator is a **server-side** signal, so a tab reload that lands on a system-paused attempt reads the correct overlay without any FE-side state. The FE-synthetic `reconnect_exhausted` is FE-only — server sees `paused === false`.

### C.9 SSE adapter lifecycle and route changes

The runner unmount path runs `useStreamingQueue`'s cleanup (`abortController.abort()`), which closes the adapter, which exits the `AsyncIterable` cleanly. Next.js route changes (Exit button, submit-completion redirect) trigger unmount; no orphaned streams.

Server-side: if the FE drops the connection mid-stream, the orchestrator continues generating until it hits the buffer ceiling, then idles. Persisted Question rows survive; the next reconnect replays them via `?since=N`.

### C.10 Inter-page dependencies

- **FE-4 → FE-5 mode routing.** FE-5 swaps FE-4's `per_testee` placeholder for the real runner. Single edit in `page.tsx`.
- **FE-3 → FE-5 entry-point.** Blocked on the pill→test resolver (FE-3 §H (b) item 3 / FE-4 §H (a) item 2). FE-5 inherits the constraint; the streaming runner builds against deep-link entry with a pre-existing attempt.
- **FE-4 → FE-5 cross-references** in FE-4's §F.7 / §G call out that the streaming runner reuses the focus-mode carve-out and replaces the placeholder. No FE-4 spec change is required by FE-5.
- **FE-6 → FE-5 results route.** Unchanged from FE-4 — submit / grading / route to `/attempts/[attemptId]/result` (FE-6 territory). The streaming runner does not change the submit path.

### C.11 Pattern A / B / C in the streaming context

- **Pattern A — inline error.** None new; reuses FE-4's autosave-indicator + per-question footer states.
- **Pattern B — toast.** Two new toast surfaces: (a) `409 not_per_testee` defensive surface ("streaming unavailable for this attempt mode"), (b) `<SystemGlitchOverlay>` resume mutation failure ("couldn't resume — try again").
- **Pattern C — boundary card.** Unchanged from FE-4.

### C.12 Image / figure stub contracts (per AC-CD24) — unchanged from FE-4 §C.9

Per-Testee question payloads carry the same image-field stubs as frozen / benchmark questions; FE-2's `Figure` / `InlineFigure` / `ChoiceFigure` return `null` in v1.

---

## D. Test cases (Vitest + Playwright)

### D.1 Unit tests (lib + helpers + reducers)

- `openAttemptStream` (`sse.test.ts`): bearer-token header set; `?since` precedence over `Last-Event-ID`; parses a question event; parses terminal `done`; parses terminal `paused`; reconnects once on mid-stream error; emits synthetic `paused` (`reconnect_exhausted`) after second failure; `close()` exits the iterator cleanly; 409 throws `ApiError`. MSW v2 `ReadableStream` response harness — fixture per scenario.
- `parseSseFrame` (`sse-parser.test.ts`): single-line `data:` frame; multi-frame buffer (two frames in one chunk); frame straddling chunk boundary; comment line (`:` prefix) ignored; blank-line terminator boundary correctness.
- `useStreamingQueue` (`use-streaming-queue.test.tsx`): mount opens stream; question event advances `arrivedIdx` + invalidates query; burst coalesces to one refetch; terminal `done` closes; terminal `paused` (server) sets `pausedReason === "generation_failed"`; synthetic `paused` sets `pausedReason === "reconnect_exhausted"`; unmount aborts; `attempt.paused === true` reactive close.
- `JITQueue` (`jit-queue.test.tsx`): state-by-state per-item rendering; ready click → onPick; generating click ignored; status="done" dismisses the streaming pulse-dot.
- `SystemGlitchOverlay` (`system-glitch-overlay.test.tsx`): collapsed → expanded toggle; resume CTA for `generation_failed` calls POST /resume + reopens; resume CTA for `reconnect_exhausted` reopens only; resume failure surfaces toast; pause-budget text absent (regression guard against accidental copy reuse from `<PauseOverlay>`).

### D.2 Page integration tests (Vitest + RTL + MSW)

- `streaming-attempt-runner.test.tsx`: full mount → Q1 render → MSW SSE handler delivers three events (positions 2, 3, 4) → JITQueue Q2..Q4 transitions to ready → user advances to Q4 → submit fires.
- Burst-coalesce test: SSE handler emits five events within 50ms → exactly one GET /v1/attempts/{id} refetch fires.
- Outrun-buffer test: user advances faster than events → `<QuestionSkeleton>` renders → next event lands → question pane re-renders.
- Mode resolver test (in `(testee)/attempts/[attemptId]/page.test.tsx`): `mode === "per_testee"` renders `<StreamingAttemptRunner>`; `mode === "frozen"` renders FE-4 frozen runner; `mode === "live"` renders placeholder.
- User-pause-during-stream test: user clicks Pause → POST /pause fires → SSE adapter closes → on resume, SSE reopens with `?since=<arrivedIdx>` and replays.
- System-pause test: SSE delivers terminal `event: paused`/`reason: generation_failed` → MSW updates AttemptView with `paused: true, pause_reason: "generation_failed"` → `<SystemGlitchOverlay>` renders → resume click → POST /resume + SSE reopen.
- Reconnect-exhausted test: SSE handler closes connection abruptly twice → adapter yields synthetic paused → `<SystemGlitchOverlay reason="reconnect_exhausted">` renders.

### D.3 Cross-page test (FE-4 ↔ FE-5)

`streaming-mode-replacement.test.tsx` — render `/attempts/[attemptId]/page.tsx` with three different mocked attempt-view fixtures (per_testee / frozen / benchmark) and assert the right runner mounts. This is the regression guard against FE-5's mode-branch edit breaking FE-4 modes.

### D.4 Playwright E2E (extends FE-4 §D.4)

`frontend/e2e/attempt-per-testee-roundtrip.spec.ts`:

- Mock backend via Playwright `route`. Mock POST /v1/attempts with `q1` populated. Mock GET /v1/attempts/{id} returning paginated questions[]. Mock SSE stream via `route.fulfill({ body: stream })` with three sequential question events + terminal `done`.
- Happy path: navigate → Q1 renders → wait for first SSE event → JITQueue Q2 transitions ready → advance through Q2..Q8 → submit → GradingOverlay → `/result`.
- Reconnect path: mock first SSE call to drop after event 2; assert second SSE call carries `Last-Event-ID: 2`; mock second call to deliver events 3..N + `done`; assert UI continues without dropped data.
- System-glitch path: mock SSE to deliver terminal `paused` (`reason: "generation_failed"`); assert overlay; click resume; mock POST /resume; mock SSE re-open delivering remaining events; assert overlay dismisses.

CI: `.github/workflows/frontend.yml` already runs `pnpm e2e` after FE-4. No CI changes.

### D.5 Existing tests preserved

FE-0..FE-4 test suites continue to pass. FE-5's spec PR introduces no test files (doc-only); the FE-5 build PR introduces all of D.1–D.4.

### D.6 Coverage gate (FE_CHECKLIST.md FE-5 rows tick on)

- `pnpm test --run` green (Vitest D.1–D.3).
- `pnpm typecheck` clean.
- `pnpm lint` clean.
- `pnpm format:check` clean.
- `pnpm build` succeeds.
- `pnpm e2e` green (Playwright D.4).
- Meaningful coverage on the new files under `frontend/src/lib/api/sse.ts`, `frontend/src/lib/attempts/use-streaming-queue.ts`, `frontend/src/components/attempt/{jit-queue,system-glitch-overlay,streaming-attempt-runner}.tsx`.

---

## E. Known placeholders (DO NOT SHIP AS-IS)

| # | Placeholder | Location | Action before production |
|---|---|---|---|
| 1 | `live` mode placeholder card (inherited from FE-4) | `(testee)/attempts/[attemptId]/page.tsx` mode branch | Pending FE-4 §H (a) item 1 (`live` mode anchor) — user-authored spec-clarification PR resolves. |
| 2 | Pill-detail "Practice at D{n}" entry-point still placeholder (inherited from FE-3 / FE-4) | FE-3 pill detail (`StickyDifficultyBar`) | User-authored spec-clarification PR adds pill→test resolver endpoint (FE-3 §H (b) item 3). |
| 3 | "Q1 took 2.4s · others stream in parallel" copy in the JITQueue buffer card is **placeholder text** from the prototype | `frontend/src/components/attempt/jit-queue.tsx` | Either remove the latency copy, or wire to an actual `attempt.q1_generation_ms` field (verify §H (b) item 7). For v1, the build session ships with the copy removed if the field isn't surfaced. |
| 4 | Image-field stubs render null per AC-CD24 (inherited) | every question-type component | v1.x visual-content PR. |
| 5 | The `traceId` row in `<SystemGlitchOverlay>` reads "—" when the SSE response doesn't expose `x-acumen-trace` | `system-glitch-overlay.tsx` | Verify backend response headers (§H (b) item 6). If absent, no production action required — the row reading "—" is acceptable. |

---

## F. Scope additions beyond `fe-specs/FE-5-streaming.md`

### F.1 `frontend/src/lib/api/sse.ts` — new file

Anchored at AC-CD22. The adapter as specified in §B.2. AC-CD-level structural addition; folds into FE-5 build PR's handover.

### F.2 `frontend/src/lib/attempts/use-streaming-queue.ts` — new file

Anchored at AC-D25 / AC-CD22. The consumer hook as specified in §B.1 §4. AC-CD-level structural addition.

### F.3 `frontend/src/components/attempt/streaming-attempt-runner.tsx` — new file

The per_testee branch of the runner page. Composes existing FE-4 primitives + the new FE-5 hooks + JIT queue + system-glitch overlay. AC-CD-level structural addition.

### F.4 `frontend/src/components/attempt/jit-queue.tsx` — new file

The sidebar. AC-CD-level structural addition. Lifts the `attempt.jsx:295–403` design verbatim.

### F.5 `frontend/src/components/attempt/system-glitch-overlay.tsx` — new file

The terminal-paused overlay. Lifts `streaming-paused.jsx:132–191`. AC-CD-level structural addition.

### F.6 Edits to FE-4-owned files

The FE-5 build session amends three FE-4 files:

- `frontend/src/app/(testee)/attempts/[attemptId]/page.tsx` — mode branch swap (`per_testee` placeholder → `<StreamingAttemptRunner>`).
- `frontend/src/components/attempt/progress-dots.tsx` — add the `generating` state with `streaming-bar` overlay.
- `frontend/src/components/attempt/attempt-header-band.tsx` — forward an optional `arrivedIdx` prop to `ProgressDots`.

Each edit is additive (does not break FE-4 frozen / benchmark behaviour). The FE-4 → FE-5 cross-page test (§D.3) guards against regressions.

### F.7 Edit to FE-2-owned `globals.css`

Add `@keyframes streaming-bar` (the design's animated gradient bar — referenced by `attempt.jsx:140–144` and `attempt.jsx:367–372` but not authored in the prototype's `styles.css`). The FE-5 build session adds the keyframe + the corresponding token-aware gradient. AC-CD-level structural addition; small, well-rationalised.

### F.8 Query-key library extension (§C.4)

`attemptQueryKeys.stream(id)` added to FE-4's `frontend/src/lib/queries/attempts.ts`. Single-line addition.

### F.9 Icon set extension (conditional on §H (b) item 5)

If FE-2's icon set doesn't include `wave`, FE-5 adds it to `frontend/src/components/primitives/Icon.tsx`. Single-glyph addition.

### F.10 Design-reference completeness note

The FE-5 surface set is covered by: `attempt.jsx` (JIT queue + streaming progress dots; the very file FE-4 explicitly stripped) + `streaming-paused.jsx` (system-glitch overlay) + the `v6-fe5-13-streaming-paused.png` screenshot. No surface in §A is unmocked. Per the SESSION_START.md "Design reference completeness check" rule, FE-5 passes the audit cleanly.

---

## G. Session 6 onwards — template propagation to FE-6..FE-9

The structure (Context → A inventory → B per-page 8-section template → C cross-page → D tests → E placeholders → F scope-bleed → G template propagation → H drift roll-up) is the **template for every subsequent FE-N detail spec**.

Per-phase variances expected and ALLOWED:

- **FE-6 (results)** consumes the `answer-payload` discriminated union (FE-4 §F.5) and the `attemptQueryKeys.result(id)` polling pattern.
- **FE-7 (constellation + history)** unblocks once `GET /v1/attempts` lands (FE-3 + FE-7 dependency); the resume-prompt's localStorage bridge can migrate to the listing endpoint at that time.
- **FE-8 / FE-9** may split into multiple files if exceeding ~2500 lines per FE-1 §G.

Per-phase variances NOT allowed without spec-drift surface:

- Skipping Gherkin acceptance criteria.
- Skipping drift-watch / verification / blocker callouts.
- Folding test list into per-page sections.
- Introducing a second SSE consumption pattern beyond `openAttemptStream` + `useStreamingQueue` without an AC-CD-level structural addition.
- Inlining query keys in page files.
- Adding adapter retry policies beyond AC-CD22's "one reconnect attempt".

---

## H. Spec-drift roll-up (post-review classification)

The cross-walk surfaced 14 candidate items. After review, classified into three groups.

### (a) BLOCKERS for the FE-5 build session — must land before the build session opens

1. **AC-CD22 wording must be amended to record backend reality (direction confirmed at plan close).** AC-CD22 (`CODE_SPEC.md:1067–1075`) says: "Events arrive with `event` field matching the AC-CD10 set: `question_ready` (carries `idx` and the `QuestionResponse`), `done` (terminal — clears generating-state), `paused` (terminal — surfaces the AC-D11 paused UI)." The shipped backend (`app/routers/attempts.py:481–516`) emits **default `message` event** for normal question events (no explicit `event:` line), payload carries only `{id, attempt_position, attempt_id}` (NOT a `QuestionResponse`); the FE refetches via GET /v1/attempts/{id} to obtain question content. The backend's small-payload-plus-refetch choice is intentional (`app/routers/attempts.py:495–501` rationale: "keeps the SSE event small, well inside event-source byte-size sanity"). **Resolution (locked):** user authors a spec-clarification PR amending AC-CD22's event-shape paragraphs to record reality — default `message` event for question events, identifying-only payload `{id, attempt_position, attempt_id}`, FE-refetch-on-event semantics for full question content, explicit `event: done` / `event: paused` for terminals only. Backend untouched. **The FE-5 build session cannot open until that spec-clarification PR is on `main`.** Once it lands, FE-5 implements against the corrected anchor and the spec body above (which already encodes the corrected contract) drops the "subject to spec-clarification" caveats.

2. **AC-CD22 event-name divergence folds into #1.** The "no `event:` line on question events; `event:` only on terminals" reality is part of item #1's resolution. Same spec-clarification PR resolves both.

3. **FE-1, FE-2, FE-3, FE-4 builds must land first.** FE-5 inherits the full FE-4 runner + its preconditions. Spec-merged but not built; sequence FE-1 build → FE-2 build → FE-3 build → FE-4 build → FE-5 build. (Inherited blocker pattern from FE-4 §H (a) item 3.)

### (b) BUILD-SESSION VERIFICATION TASKS — front-loaded at the start of the FE-5 build session

The build session opens with a verification step before any code lands: read `app/routers/attempts.py`, `app/domain/streaming.py`, `app/domain/attempts.py`, `app/schemas.py`, and the OpenAPI snapshot at `frontend/openapi/schema.json`. Confirm the assumed contracts.

4. **User-pause during active stream — backend behaviour.** Spec assumes that user-initiated POST /pause during an active stream (a) gracefully closes the SSE response, and (b) in-flight Q-N orchestrator tasks complete and persist before the pause takes effect (mirroring the AC-D25 v1.8 partial-progress-preserved rule). Verify in `app/routers/attempts.py` + `app/domain/streaming.py`: does POST /pause cancel the orchestrator? Does the orchestrator persist in-flight rows before unwinding? If not, the FE may see "duplicate Q-N arrivals" on resume (the cancelled task re-orchestrates the same position). Spec-clarify if behaviour diverges.

5. **`Icon name="wave"` availability in FE-2's icon set.** Verify FE-2's `frontend/src/components/primitives/Icon.tsx` ships the `wave` glyph (referenced by `streaming-paused.jsx:144`). If absent, FE-5 build adds it. Out-of-scope to spec-clarify; this is an FE-5 build-time fold.

6. **`x-acumen-trace` header on SSE responses.** Verify FastAPI's `StreamingResponse` carries the trace header (FE-4 §H (c) item 5 introduced trace capture in `unwrap()`; the SSE path does not go through `unwrap()`). If absent, the trace row in `<SystemGlitchOverlay>` reads "—".

7. **`attempt.q1_generation_ms` field surface.** The JIT-queue buffer card includes the prototype copy "Q1 took 2.4s · others stream in parallel". Verify whether `AttemptView` surfaces a Q1-generation-latency field (likely no — current schema doesn't). If absent, the FE-5 build session ships the buffer card with the latency copy removed (no spec drift; design-prototype copy was illustrative).

8. **Timer-hold behaviour on `reason === "reconnect_exhausted"`.** Spec assumes the FE holds the timer locally during the reconnect-exhausted overlay; backend does not know the adapter died, so `attempt.paused === false` and `pause_seconds_remaining` doesn't accumulate. Verify whether holding the timer FE-locally (without a backend pause) is acceptable per AC-D11. **Recommendation:** acceptable — the wall-clock continues elapsing for the testee either way; the FE display-hold is purely UI-cosmetic during the few seconds before the testee clicks "Try resuming →". If the testee abandons the tab, the test eventually times out per AC-D11. Confirm at build time.

9. **`POST /v1/attempts` Q1 generation failure surface.** `app/domain/attempts.py:160` defines `PAUSE_REASON_GENERATION_FAILED = "generation_failed"`; `app/domain/attempts.py:263` raises `APIError(503, "q1_generation_failed", ...)`. The two are distinct: Q1 failure prevents the attempt from starting at all (POST /v1/attempts returns 503), so the runner never mounts. Verify this is the contract; if so, FE-5's runner has no `q1_generation_failed` branch to handle. **Recommendation:** confirm POST surface in OpenAPI; if the 503 code is correct, document in the upstream caller (FE-3 pill detail) as the Q1-fail handling boundary, not FE-5.

10. **`?since` behaviour vs `since=0` edge case.** Verify that `?since=0` (the OpenAPI default) replays positions > 0 (i.e. all persisted positions starting from 1). The backend description says "Defensive default if neither: cursor = 0 (replay everything from position 1)". FE-5 always sends an explicit cursor (≥ 1), so this path is unused; verify the cursor-precedence logic at `app/routers/attempts.py` (`?since` wins over `Last-Event-ID`).

11. **OpenAPI snapshot freshness for the stream endpoint.** Verify `frontend/openapi/schema.json` reflects the `/v1/attempts/{attempt_id}/stream` shape (it does — verified in §B.1 §3). If a backend endpoint change ships during FE-1..FE-4 builds, fold the regen into the relevant FE-N PR per PR-033 §H (b) item 14 precedent.

12. **MSW v2 `ReadableStream` response support.** Verify MSW v2 (introduced by FE-4 §D) supports streaming response bodies for the SSE test harness. If not, the build session uses Playwright `route` for both unit and E2E SSE mocking. **Recommendation:** MSW v2 supports `ReadableStream` per docs (verified at FE-1 spec time). Confirm at build time.

13. **`POST /v1/attempts/{id}/resume` response shape.** Verify what `POST /resume` returns. Spec assumes `{status: "resumed"}` (FE-4 §B.1 §3). FE-5 doesn't depend on the response body beyond 2xx success — surfaced for completeness.

14. **`?since` cursor on user-resume.** Spec assumes that after user-pause + POST /resume, the FE opens a fresh SSE with `?since=<arrivedIdx>`. Verify this replays cleanly (positions ≤ `arrivedIdx` are NOT re-emitted) and that any positions completed by the server during the pause window arrive in order. The backend cursor semantics support this (`attempt_position > cursor`); flagged as a verification not a divergence.

### (c) APPROVED RESOLUTIONS — folded into the FE-5 build PR scope, captured in the build PR's handover

These are not blockers. The spec body above locks the resolution; the build session implements; the build PR's handover records them under the SESSION_START.md AC-CD-level structural-additions carve-out.

15. **`openAttemptStream` fetch-streaming adapter** per AC-CD22 (with the event-shape contract anchored against backend reality per §H (a) item 1's resolution).

16. **`useStreamingQueue` consumer hook** at `frontend/src/lib/attempts/use-streaming-queue.ts`; structural addition.

17. **`<StreamingAttemptRunner>` branch component** at `frontend/src/components/attempt/streaming-attempt-runner.tsx`; structural addition.

18. **`<JITQueue>` sidebar** at `frontend/src/components/attempt/jit-queue.tsx`; structural addition.

19. **`<SystemGlitchOverlay>`** at `frontend/src/components/attempt/system-glitch-overlay.tsx`; structural addition.

20. **`ProgressDots` extension** with the `generating` state — edit to FE-4 file.

21. **Mode-branch swap** in `(testee)/attempts/[attemptId]/page.tsx` — `per_testee` placeholder → `<StreamingAttemptRunner>`. Edit to FE-4 file.

22. **`attemptQueryKeys.stream(id)`** extension to FE-4's query-key library.

23. **`@keyframes streaming-bar`** in FE-2-owned `globals.css`. AC-CD-level structural addition; folds into handover.

24. **`Icon name="wave"` addition** to FE-2's icon set if absent (§H (b) item 5). Conditional structural addition.

25. **Refetch-on-event strategy** (every non-terminal SSE event invalidates `attemptQueryKeys.detail(id)`; TanStack-Query coalesces; no FE-side debounce). Trade-off documented for the build session.

26. **Mid-stream reconnect policy** per AC-CD22: one reconnect with `Last-Event-ID`; second failure → FE-synthetic `paused` (`reason: "reconnect_exhausted"`).

27. **Pause-origin branching** at the overlay level: `attempt.pause_reason === null` → user-paused UX, `=== "generation_failed"` → system-glitch UX. Server-side signal; resilient to tab reload.

28. **Per_testee mobile carve-out:** JIT queue sidebar mobile-hidden; ProgressDots strip renders the streaming-aware variant unchanged.

---

*End of FE-5-streaming.md. Template propagates to FE-6..FE-9 per §G; deviations surface as spec drift. Two blockers in §H (a) (AC-CD22 event-shape + event-name divergence) require a user-authored spec-clarification PR before the FE-5 build session opens.*
