# Handover — PR-023 P10 JIT streaming generation (per-Testee)

## PR identifier and link

- PR: #23 — P10 — JIT streaming generation (per-Testee) (branch
  `claude/acumen-p10-jit-streaming-uC96B`)
- Link: <https://github.com/jaydomains/acumen/pull/23>
- Author / session: Claude Code session (P10 single attempt; 4 slices
  with per-slice Gitar review pause; user enabled auto-continue
  carve-out after Slice 1 review). One Gitar fix-up commit on Slice 2
  (cancellation-correctness fix; root-caused beyond Gitar's surfaced
  finding); Slices 1, 3, 4 approved with zero findings.
- Date closed: 2026-05-21

## Phase reference

- ROADMAP phase closed by this PR: **P10 — JIT streaming generation
  (per-Testee)**
- Does this PR fully close the phase? **Yes.** All ROADMAP P10
  done-when criteria are met (verbatim from ROADMAP §157-179):
  1. **Q1 renders < ~3s** — `start_attempt` per-Testee branch performs
     one synchronous `provider.generate(question_count=1)` call inside
     the request handler, persists the Q1 Question with
     `attempt_position=1`, and returns the standard `AttemptView` with
     a new `q1` field carrying the rendered Q1 payload. The FE renders
     Q1 immediately from the POST response while opening the SSE
     stream in the background (`tests/integration/test_p10_start_attempt_streaming.py::test_per_testee_start_surfaces_q1_field_on_post_response`).
  2. **Buffer maintained ahead of position** — `stream_attempt_questions`
     spawns Q2..N tasks concurrently under
     `asyncio.Semaphore(Settings.jit_buffer_size)` (env-default 3,
     ceiling `Settings.jit_buffer_max=5`). With 5 unfilled positions
     and the default bound, never more than 3 provider calls are in
     flight (`tests/unit/test_p10_streaming_orchestrator.py::test_semaphore_bounds_concurrent_provider_calls`).
  3. **Mid-stream failure pauses with retry/abandon** — a per-Q-N task
     that fails on both the first call and the orchestration-layer
     single retry triggers `pause_attempt(system=True,
     reason="generation_failed")` via the
     `pause_attempt_from_streaming` helper; the SSE handler emits
     terminal `event: paused` and closes; `AttemptPauseEvent.reason`
     surfaces through `view_attempt` so the FE renders the
     retry/abandon affordance (`tests/integration/test_p10_sse_stream.py::test_sse_q_n_failure_emits_paused_terminal_and_writes_system_pause`).
  4. **Resume replays the snapshot with stable order and no
     regeneration** — `attempt_position`-ordered DB rows are replayed
     on SSE reconnect via the `?since=N` query param (FE explicit) or
     `Last-Event-ID` header (browser auto-reconnect); the orchestrator
     computes the unfilled position set from the persisted rows and
     re-runs only those (`tests/integration/test_p10_sse_stream.py::test_sse_after_pause_then_resume_re_orchestrates_unfilled_only` — Q1 and any completed Q-N persist across the failure and are NOT re-generated on resume).
  5. **Benchmark path verified sequential** — benchmark / frozen /
     hand-authored modes return 409 `not_per_testee` from the SSE
     endpoint; benchmark's `POST .../next` sequential adaptive path
     is unchanged from P4 (`tests/integration/test_p10_sse_stream.py::test_sse_returns_409_for_benchmark_mode` + `::test_sse_returns_409_for_frozen_mode`).

## What was built

Four slices + one Gitar fix-up commit. Per-slice Gitar review ran on
each slice commit; the user enabled auto-continue carve-out after
Slice 1 ("when gitar turns green after fixes auto continue with the
next slices, dont wait for my approval"), so Slices 2-4 ran without
explicit user gating between them.

**Files added (5):**

- `alembic/versions/0007_p10_question_position.py` — additive
  migration: `question.attempt_position INTEGER NULL` + unique
  constraint `uq_question_attempt_position` on
  `(attempt_id, attempt_position)`; `attempt_pause_event.reason
  VARCHAR(255) NULL`. Reversible per AC-CD3. Postgres treats multiple
  NULLs as distinct under UNIQUE so the constraint naturally excludes
  unfilled slots (test_id-owned + pill_id-owned rows stay at NULL)
  without a partial-index WHERE. Shape mirrors 0005's
  `uq_attempt_test_testee_sequence`.
- `tests/integration/test_p10_pause_attempt_system.py` (9 tests) —
  Slice 1 `pause_attempt(system=True, reason=...)` extension
  coverage: bypass pause_blocked on untimed, bypass
  allowance_exhausted, no `pauses_used` increment, coalesce on
  already_paused, persistence of reason, `view_attempt` surfaces
  `pause_reason`, retains AC-D11 user-quota guards on `system=False`,
  errors on submitted attempts.
- `tests/unit/test_p10_streaming_orchestrator.py` (13 tests) —
  Slice 2 orchestrator core: semaphore bounds, position allocation,
  retry-once-then-success, failure-after-retry-pauses-and-raises,
  in-flight tasks persist before pause takes effect ("partial
  progress preserved" v1.8 contract), 1:1 provenance vs the old 1:N
  share, one session per persistence, question_count=1 stamping,
  shared payload carry-through, empty positions no-op, malformed
  parser → retry-then-pause, empty questions array → retry-then-
  pause, externally-cancelled task does not leak still_pending
  (Gitar PR-#23 Slice 2 finding #1).
- `tests/integration/test_p10_start_attempt_streaming.py` (9 tests)
  — Slice 3 wiring coverage: Q1 sync at position 1, question_count=1
  per SPEC §6.1 v1.8, q1 field on POST, anchor draw before Q1,
  snapshot holds streaming_payload_base + total_question_count,
  q1_generation_failed after retry, retry-once-then-success,
  view_attempt merges anchors + DB questions, view_attempt sorts by
  attempt_position.
- `tests/integration/test_p10_sse_stream.py` (10 tests) — Slice 4
  end-to-end SSE coverage: cold open after POST, browser auto-
  reconnect with Last-Event-ID, defensive default cursor=0,
  pause-on-failure terminal + AC-D11 system pause row, resume after
  pause re-orchestrates unfilled only, 409 for benchmark mode, 409
  for frozen mode, 404 for non-owner testee, cost-dashboard cross-
  cut (1:1 provenance × N rows), question_count=1 on every per-
  question call.
- `handovers/PR-023-p10-jit-streaming.md` — this file.

**Files changed (12):**

- `app/domain/streaming.py` — grew from a 6-line docstring stub into
  the full P10 orchestrator (≈300 lines): `GenerationStatus` enum +
  `GenerationSlot` / `OrchestratorResult` dataclasses (Slice 1);
  `stream_attempt_questions` async generator + `_generate_position`
  per-task body + `_persist_question` shielded helper +
  `GenerationFailedError` typed exception + `_extract_single_question_spec`
  defensive parser + `SessionFactory` / `PauseFn` type aliases
  (Slice 2). Each per-Q-N task wraps persistence in
  `asyncio.shield(_persist_question(...))` so an SSE disconnect
  mid-commit does not lose work the provider has already paid for.
  The orchestrator's finally clause uses `Task.uncancel()` to
  suppress the sticky cancel request during cleanup, then restores
  it so the SSE handler still observes the disconnect; this is the
  Python 3.11+ cancellation-correctness pattern needed for
  task-leak-free shutdown (Gitar PR-#23 Slice 2 finding #1).
- `app/domain/attempts.py` — `pause_attempt(system, reason)`
  extension at lines 877-921 (Slice 1); per-Testee branch of
  `start_attempt` rewritten at lines 698-792 (Slice 3) — anchors
  drawn BEFORE Q1, snapshot is anchors-only + carries
  `streaming_payload_base` + `total_question_count` for the SSE
  handler, Q1 sync via new `_generate_q1_sync` helper with one
  orchestration-layer retry then 503 `q1_generation_failed`,
  `record_provenance` (1:1) replaces `record_provenance_share`
  (1:N); `view_attempt` per-Testee branch at lines 952-980 fetches
  DB Question rows and merges with snapshot anchors before
  presentation shuffle; new `pause_attempt_from_streaming` helper
  at lines 171-209 (Slice 4) opens a short-lived session for the
  SSE orchestrator's pause_fn callback.
- `app/models.py` — `Question.attempt_position` column + unique
  `UniqueConstraint` declaration (Slice 1); `AttemptPauseEvent.reason`
  column (Slice 1).
- `app/config.py` — `Settings.jit_persist_grace_seconds: int = 10`
  (Slice 1, env-overridable; controls the SSE-disconnect grace
  window the orchestrator's finally awaits for in-flight tasks to
  persist).
- `app/routers/attempts.py` — `POST /v1/attempts` per-Testee
  response augmented with `q1` payload (Slice 3); `GET
  /v1/attempts/{id}/stream` SSE endpoint added (Slice 4) with
  `?since=N` + `Last-Event-ID` cursor resolution, replay step
  iterating persisted Question rows in Python-sorted
  attempt_position order, orchestrator invocation, terminal `done`
  / `paused` event emission; `get_jit_session_factory` FastAPI
  dependency hook so tests inject a CatalogueFakeSession-backed
  factory; `_format_sse_event` / `_format_sse_terminal` /
  `_slot_view` / `_question_view` SSE serialization helpers; built-
  in `StreamingResponse` (no `sse-starlette` dep per AC-CD1
  minimum-deps).
- `app/schemas.py` — `AttemptView.pause_reason: str | None = None`
  (Slice 1, surfaces the new pause-event reason on every view);
  `AttemptView.q1: dict | None = None` (Slice 3, per-Testee POST
  response field).
- `app/domain/attempts.py::_snapshot_from_questions` extended to
  carry `attempt_position` (Slice 3) so `_present_one` can
  propagate it into the presented view, letting the router locate
  Q1 by `attempt_position == 1`.
- `app/domain/attempts.py::_present_one` extended to include
  `attempt_position` in output (Slice 3).
- `tests/integration/conftest.py` — `cat_client` fixture extended
  to override `get_jit_session_factory` so the SSE handler's per-
  task persistence runs against the shared CatalogueFakeSession
  (Slice 4 wiring).
- `tests/unit/test_p1_schema.py` — extends `test_key_columns_present`
  with `question.attempt_position` + `attempt_pause_event.reason`
  assertions (Slice 1); adds `test_migration_0007_question_position_round_trip`
  (Slice 1).
- `tests/unit/test_p4_schema.py` — adds
  `test_question_attempt_position_unique_constraint_present`
  (Slice 1).
- `tests/integration/test_p4_attempts.py`,
  `tests/integration/test_p5_generation.py`,
  `tests/integration/test_p8_anchor_draw.py`,
  `tests/integration/test_p8_anchor_submit.py` — updated test
  expectations for the per-Testee shape change (Slice 3): single
  Q1 row persisted at attempt-start, snapshot anchors-only,
  question_count=1, 1:1 provenance, q1 field on POST. The
  "skip malformed specs" test (test_p5_generation.py) was
  repurposed as "take first question from provider response"
  reflecting the per-question contract.
- `CHECKLIST.md` — five P10 rows ticked `built` with specific
  evidence test paths (P5/P9 precedent).

**Files removed:** none.

**Summary:** P10 closes the P10 ROADMAP phase by delivering the v1.8
locked JIT streaming contract: per-Testee Q1 generates synchronously
inside `start_attempt` (~3-s render budget); Q2..N stream as
concurrent in-process `asyncio` tasks under an `asyncio.Semaphore`
inside the new `GET /v1/attempts/{id}/stream` SSE handler's lifetime;
each per-question call writes its own 1:1 provenance row;
`question.attempt_position` (new column from migration 0007) anchors
streamed-arrival order under concurrent task resolution; SSE
reconnect uses `?since=N` (FE explicit) or `Last-Event-ID` (browser
auto-reconnect) to skip already-delivered positions and replay only
the unfilled set without regeneration; a per-Q-N second failure
(after one orchestration-layer retry above tenacity's HTTP retries)
pauses the attempt via the new AC-D11 system path
(`pause_attempt(system=True, reason="generation_failed")`) so the
Testee sees the retry/abandon affordance on resume; benchmark /
frozen / hand-authored modes return 409 `not_per_testee` from the
SSE endpoint and keep their existing sequential / snapshot paths.

## What was decided in this PR

**New anchors introduced: none.** Implementation lands against the
v1.8 locked AC-D25 / AC-CD10 / SPEC §10 / §5 / §6.1 contract (PR-022).

**Existing anchors this PR depends on:**

- Product: AC-D25 v1.8 (JIT streaming execution model + ordering
  column + single-failure policy), AC-D11 v1.6 (pause-blanks-content +
  lazy-auto-resume — reused unchanged for the system-pause path),
  AC-D17 (snapshot resume semantics), AC-D22 (RAG context + low-
  realism examples — reused unchanged, computed once at attempt
  start per SPEC §6.1 v1.8), AC-D18 v1.1 (rate-limit exemption for
  assignment-driven + loop-driven origins — unchanged; checked once
  at attempt-start, inherited by all per-question calls), AC-D24
  (shuffle seed — unchanged; anchor draw uses it as before),
  AC-D20 (anchor draw — flipped to run BEFORE Q1 sync, otherwise
  unchanged).
- Technical: AC-CD10 v1.8 (execution model + ordering column +
  single-failure policy locked), AC-CD8 v1.6 (per-op provenance —
  retires `record_provenance_share` for per-Testee streaming;
  `record_provenance` 1:1 is the v1.8 shape), AC-CD15 (zero-DB /
  zero-network test harness intact — every WHERE is single-column
  equality, FakeSession ORDER BY gap respected with Python-side
  sort), AC-CD1 (minimum-deps — built-in `StreamingResponse`,
  no `sse-starlette`), AC-CD2 (SiteMesh layout — orchestrator
  lives in `app/domain/streaming.py`, SSE endpoint in
  `app/routers/attempts.py`, no business logic in routers besides
  HTTP envelope + auth + orchestration call), AC-CD3 (one acumen
  schema; reversible migration), AC-CD4 (entity → table mapping
  extended for `attempt_position` + `reason`).

**Deliberate documentation-narrative decisions:**

- **No canonical-doc edits during slices.** SPEC / DECISIONS /
  CODE_SPEC / SESSION_START / ROADMAP are untouched. Only
  `CHECKLIST.md` moves, at PR close. Matches the P4 / P5 / P6 / P7 /
  P8 / P9 discipline; v1.8 (PR-022) already wrote every spec mention
  of `attempt_position` / `asyncio.gather` / `generation_failed` so
  the build session simply implements against the locked text.
- **Autonomous-loop carve-out enabled mid-session.** User explicitly
  authorized after Slice 1 Gitar review: "when gitar turns green
  after fixes auto continue with the next slices, dont wait for my
  approval". Pattern matches PR-021 (P9). Slice 2 had one Gitar
  fix-up round; Slices 1, 3, 4 ran without fix-up commits.

**Deliberate spec deviations (recorded here per the user's binding
cadence):**

1. **Anchor draw moved to BEFORE Q1 sync.** Pre-P10 order was
   per-Testee generation → anchor draw → snapshot built from both.
   Under streaming, the snapshot must be immutable across the
   attempt lifetime so SSE-spawned per-Q-N tasks don't race
   against `view_attempt` reads. Anchor draw is cheap (DB read +
   Python sort + `random.sample(shuffle_seed)`; no AI call, no
   vector query). Documented inline in `start_attempt` per-Testee
   branch. v1.8 spec doesn't pin the draw order; this is a P10-
   implementation choice within the contract.

2. **Snapshot for per-Testee mode is anchors-only.** Per-Testee
   Question rows live in the DB keyed by `(attempt_id,
   attempt_position)`; `view_attempt` fetches them with the
   existing equality-only WHERE pattern and Python-sorts by
   `attempt_position`. The pre-P10 "snapshot stores all questions"
   contract retires for per-Testee; frozen / hand-authored still
   snapshot the full set as before. This eliminates snapshot-
   mutation races during streaming. Documented inline in
   `view_attempt`'s per-Testee branch.

3. **Snapshot carries `streaming_payload_base` +
   `total_question_count`.** The SSE handler needs the shared
   per-question payload (test_name, target_difficulty, rag_context,
   low_realism_negative_examples) without re-running the RAG
   retrieve (cost amplification + consistency guarantee) and needs
   the total question count to compute the unfilled position set.
   Both live on `attempt.question_snapshot` as new keys alongside
   `questions` (the anchor list). Spec doesn't pin a transport
   for this state; v1.8 says "shared RAG context computed once
   per attempt — reused unchanged across the per-question calls"
   (SPEC §6.1 v1.8) but doesn't specify *where* it's stored.

4. **POST returns AttemptView + q1 as a top-level field.** Per the
   user's lock at plan-mode: "POST /v1/attempts returns AttemptView
   + Q1 payload; SSE starts at event 2. The P10 point is sub-3s
   Q1 render — POST-bundling lets FE render Q1 immediately while
   SSE opens in background". `AttemptView.q1: dict | None = None`
   added to the pydantic schema; for non-per-Testee modes and all
   GETs, `q1=None`. The FE finds Q1 in the SSE replay via
   `attempt_position == 1`; the `q1` field is a convenience for
   the FE's first-render path.

5. **SSE cursor accepts both `?since=N` (FE explicit) and
   `Last-Event-ID` (browser default); `?since=` wins.** Per the
   user's lock: browser EventSource auto-reconnect sets
   Last-Event-ID; FE first-open after POST uses `?since=1` to
   skip Q1 (already delivered in the POST response). Defensive
   default if neither is present: cursor = 0 (replay from position
   1; covers page-refresh paths where FE has lost POST state).

6. **`Settings.jit_persist_grace_seconds = 10` is a P10-
   implementation-defined env default, not a `system_settings`
   column.** v1.8 spec names `jit_buffer_size` and `jit_buffer_max`
   as env-defaults; the grace-window default is an
   implementation choice for the orchestrator's cancellation-
   cleanup path. Could be promoted to a tunable column in v1.x;
   tracked in the "not yet columns" backlog alongside
   `jit_buffer_size` (per PR-022 handover deferral).

7. **`pause_attempt(system=True)` bypasses pause_blocked +
   pause_allowance_exhausted, doesn't increment `pauses_used`,
   but still errors on `already_paused`.** System pauses are
   operational (not user-quota), so the AC-D11 user-pause guards
   don't apply — but coalescing with an existing pause prevents
   double-writing PauseEvent rows. Documented inline in the
   extended `pause_attempt` signature.

8. **The pre-P10 "skip malformed specs" test is repurposed.** P5
   `test_per_testee_start_skips_malformed_specs` covered a defensive
   parser that skipped bad specs from a batch and shared cost over
   the remainder. Under the per-question contract (question_count=1
   per call), the "skip" semantic doesn't apply — a malformed spec
   IS the call failure. Test renamed to
   `test_per_testee_start_takes_first_question_from_provider_response`
   and rewritten to lock the per-question contract; the
   defensive-skip pattern doesn't carry forward.

9. **Per-task session factory parameterised via FastAPI Depends.**
   The SSE handler's orchestrator needs a per-task session factory
   that survives the request-session close on SSE disconnect. In
   production this is `_session_factory()` from `app/models.py`
   (the lazy `async_sessionmaker`); in tests we override via
   `app.dependency_overrides[get_jit_session_factory]` to yield
   the shared `CatalogueFakeSession`. Matches the existing
   `get_db` override pattern; no new test-harness primitive.

**Gitar findings + how they were resolved:**

- **Slice 2 finding #1 — `CancelledError` escapes finally block's
  `except Exception` (`app/domain/streaming.py:312-316`).** Gitar
  identified that `asyncio.CancelledError` inherits from
  `BaseException` (Python 3.9+), so iterating `done_in_grace` with
  `except Exception` would let a cancelled task's `.result()`
  CancelledError escape and skip the `still_pending.cancel()`
  cleanup. Investigation surfaced a deeper root cause Gitar didn't
  name: in Python 3.11+ the outer task's cancel request is
  "sticky" — the NEXT `await` in the finally (the cleanup
  `asyncio.wait`) ALSO re-raises CancelledError before the
  cleanup runs. The narrow except-handler change alone wouldn't
  fix the leak. Two coordinated fixes shipped together: (a)
  `_persist_question` factored out + wrapped in `asyncio.shield`
  at the per-task body so a cancel mid-commit doesn't roll back
  partial work; (b) the finally cleanup uses `Task.uncancel()`
  to clear the sticky cancel request, runs cleanup, then
  `Task.cancel()` to restore it. Regression test
  `test_externally_cancelled_jit_task_does_not_leak_still_pending`
  exhibits the exact leak: starts orchestrator with 3 positions,
  cancels one spawned task externally, cancels the consumer,
  asserts no jit-q* task remains pending in `asyncio.all_tasks()`
  after the grace window. Without either fix the test reports
  "orchestrator leaked 2 JIT tasks" and pytest reports "Task was
  destroyed but it is pending!" warnings.

- **Slice 1, 3, 4: zero findings.** Gitar approved each with no
  changes requested.

## Drift flags raised and how they were resolved

**No spec drift surfaced.** The v1.8 spec is consistent with the
P10 implementation. CHECKLIST.md is the only canonical doc updated.

## Open questions deferred to a later phase

1. **P11 — Real-Postgres E2E for rate-limit-no-burn on Q1 failure.**
   The contract: when Q1 fails (after one orchestration-layer
   retry), the surrounding transaction rolls back so no Attempt
   persists and the Testee's rate-limit budget is not consumed.
   Under the FakeSession harness `rollback()` is a noop so the
   contract is documented inline (`tests/integration/test_p10_start_attempt_streaming.py::test_q1_failure_after_retry_raises_typed_error`)
   but the rollback semantics themselves are deferred to real-
   Postgres E2E at P11. Same disposition pattern as PR-021's
   "P11 candidate for the SQL-aggregate sweep".

2. **P11 — `Settings.jit_buffer_size` / `jit_buffer_max` /
   `jit_persist_grace_seconds` as `system_settings` columns.** All
   three currently env-default in `app/config.py`. PR-022 handover
   flagged the first two as "v1.x candidates" for operator-tunable
   columns; this PR adds `jit_persist_grace_seconds` to the same
   ledger. Not in spec; not promoted in P10.

3. **P11 — Frontend SSE consumer.** P10 ships the backend SSE
   endpoint + the AttemptView `q1` field; the FE rendering of Q1
   from the POST response + EventSource consumption of the SSE
   stream + the retry/abandon UX on the `paused` terminal event
   are explicit out-of-scope for P10 (per the user's plan-mode
   carve-out). The FE session reads the `pause_reason` field on
   `view_attempt` to render the right resume affordance.

4. **`AttemptPauseEvent.reason` vocabulary lives in Python, not
   the schema.** Only `PAUSE_REASON_GENERATION_FAILED = "generation_failed"`
   exists at v1.8; future reasons (e.g. operator-initiated pause,
   safety-pill discovery) extend the Python constant set without
   schema migration. VARCHAR(255) on the column matches the P8
   `excluded_reason` precedent. If a future PR adds many reasons
   that warrant DB-side enum constraints, that's a v1.x candidate.

5. **Anchor draw timing flipped without spec amendment.** Pre-P10
   the order was generation → anchors; P10 flips to anchors →
   Q1-sync → SSE-spawned Q2..N. The v1.8 spec doesn't pin the
   draw order; this PR records it as a P10-implementation choice
   under the snapshot-anchors-only design. If a future spec
   audit wants to lock the order, it's an AC-D25 / AC-D20
   amendment, not a P10 build decision.

6. **`get_jit_session_factory` is a public function on the router
   module but the production session factory is private
   (`_session_factory`).** Tests override the public function via
   `app.dependency_overrides`. If the underlying private factory
   ever moves or gets renamed, the SSE handler's dependency
   needs to follow. The structure-gate doesn't catch this; a
   future docstring sweep could add a cross-reference between
   `_session_factory` and `get_jit_session_factory`.

7. **Snapshot carries new JSONB keys (`streaming_payload_base`,
   `total_question_count`) without schema versioning.** A future
   v1.x change to the streaming-payload shape would need a JSONB-
   migration helper or a defensive read with defaults. P10 ships
   with `.get(..., default)` reads in the SSE handler so missing
   keys produce empty payloads (no crash) but the SSE wouldn't
   regenerate anything sensibly. Tracked as a v1.x candidate if
   the shape grows.

8. **The `cat_client` fixture's `_jit_factory_override` yields the
   shared `cat_session` per task.** In production each per-task
   session is fresh; the test fixture conflates them. This is
   acceptable for the AC-CD15 in-memory harness because the
   single shared store IS the "database" — concurrent
   `cat_session.add()` calls all land in the same dict. But
   tests asserting on per-session boundaries would fail; none
   in this PR do.

## Build state vs spec

- **AC-D25 v1.8 (JIT generation with parallel streaming)** —
  complete. Per-Testee mode persists Q1 sync + streams Q2..N
  concurrently in-process; benchmark stays sequential.
- **AC-CD10 v1.8 (JIT streaming buffer mechanics + failure
  handling)** — complete. `asyncio.gather` + `asyncio.Semaphore`
  bound = `Settings.jit_buffer_size`; ceiling = `Settings.jit_buffer_max`;
  `question.attempt_position` unique anchor; single-Q-N-retry then
  AC-D11 pause via `pause_attempt(system=True, reason="generation_failed")`;
  partial progress preserved (in-flight tasks persist before pause
  takes effect).
- **AC-D11 (pause mechanism)** — extended with `system: bool` +
  `reason: str | None` parameters; user-quota guards retained for
  `system=False`. `AttemptPauseEvent.reason` column lands via
  migration 0007. The pre-P10 user-pause contract (allowance
  check, pause_blocked, pauses_used increment) is unchanged for
  `system=False`.
- **AC-D17 (snapshot resume)** — preserved for frozen / hand-
  authored; for per-Testee, the snapshot is now anchors-only and
  per-Testee Question rows are fetched live from DB ordered by
  `attempt_position`. Resume replays via SSE reconnect using
  `?since=N` + `Last-Event-ID`; no regeneration of completed
  positions.
- **AC-CD8 v1.6 (per-op provenance)** — `record_provenance` (1:1)
  replaces `record_provenance_share` (1:N) for per-Testee streamed
  generation. The cost dashboard's per-attempt sum invariant
  changes shape (N rows × full cost vs 1 batch × N-way share) but
  the aggregation in `current_month_spend` (which walks Question
  rows) sees the correct total.
- **AC-CD15 (zero-DB / zero-network test harness)** — preserved
  throughout. All WHERE clauses are single-column equality;
  Python-side sort handles `attempt_position` ordering;
  `get_jit_session_factory` override yields the shared
  CatalogueFakeSession for SSE per-task persistence; SSE event
  emission uses standard `text/event-stream` bytes that
  `TestClient` assembles into `response.text`.
- **AC-CD1 (minimum-deps)** — built-in `fastapi.responses.StreamingResponse`,
  no `sse-starlette` dep added.
- **AC-CD3 (reversible migrations)** — migration 0007 ships both
  upgrade and downgrade; round-trip asserted by
  `tests/unit/test_p1_schema.py::test_migration_0007_question_position_round_trip`.

## Test coverage and CI results

**pytest -q: 662 passed** (P9 baseline 619 + 43 net new — 9 Slice 1
pause-system + 2 schema (column-check + migration round-trip) + 1
unique-constraint (Slice 1) + 13 Slice 2 orchestrator + 9 Slice 3
start-attempt streaming + 10 Slice 4 SSE; 1 net adjustment for the
P5 test rewrite from "skip malformed" to "take first question").

CI parity sweep clean on every commit: `ruff check .`,
`ruff format --check .`, `mypy app`, `scripts/structure_gate.py`,
`scripts/check_unpinned_deps.py` all pass at the pinned versions
(`ruff==0.6.9`, `mypy` from requirements-dev.txt).

End-to-end manual smoke (post-merge against a real Postgres):

```
# 1. Per-Testee attempt POST returns AttemptView + q1
POST /v1/attempts ... {origin: assignment_driven, assignment_id, test_id}
  → 201 within ~3s; AttemptView with q1 payload (Q1 rendered); Q1 persisted
    at attempt_position=1; anchor rows present (if pill has anchors)

# 2. Open SSE stream cold (FE supplies ?since=1 to skip Q1)
GET /v1/attempts/{id}/stream?since=1
  → 200 text/event-stream; orchestrator runs Q2..Q5 under semaphore;
    events emit in attempt_position order; terminal `event: done`; closes

# 3. Browser auto-reconnect mid-stream
(disconnect after event-id=3; browser reconnects with Last-Event-ID: 3)
  → server replays nothing > 3 from DB (none missing); continues
    orchestration for 4, 5; emits remaining events + done

# 4. Q-N failure (provider returns 500 twice on Q3)
GET /v1/attempts/{id2}/stream?since=1
  → events 2, 4, 5 emit (in-flight persist before pause); terminal
    `event: paused` with {reason: generation_failed, failed_position: 3,
    completed_positions: [1,2,4,5]}; AttemptPauseEvent row written with
    reason="generation_failed"

# 5. Resume after pause-on-failure
POST /v1/attempts/{id2}/resume
  → 200; pause-event closed
GET /v1/attempts/{id2}/stream?since=2
  → server skips 1, 2; orchestrator runs position 3 only; event 3 emits;
    also replays 4, 5 from DB; `done`

# 6. Q1 failure
(provider raises on the first 2 generation calls)
POST /v1/attempts ... {origin: self_initiated}
  → 503 {"error":{"code":"q1_generation_failed", ...}}; no Attempt
    persists; rate-limit budget not consumed

# 7. Benchmark stays sequential
POST /v1/attempts ... {test.mode: benchmark}
  → 201; AttemptView with empty snapshot, no q1 field
GET /v1/attempts/{id3}/stream
  → 409 {"error":{"code":"not_per_testee", ...}}
POST /v1/attempts/{id3}/next
  → Q1 generated synchronously; sequential adaptive path unchanged from P4
```

## Anything a fresh Claude Code session needs to pick up cleanly

- **Required reading beyond `SESSION_START.md`:**
  - `handovers/PR-022-v1.8-ac-cd10-gate-closure.md` for the locked
    v1.8 contract (D1 execution model + D2 ordering + D3 single-
    failure policy) and the "P10 implementation pointers" section
    that named the call sites this PR rewrote.
  - This handover's "Deliberate spec deviations" section —
    particularly point #1 (anchor draw flipped to before Q1) and
    point #3 (snapshot carries `streaming_payload_base` +
    `total_question_count` keys); these are P10-implementation
    choices within the v1.8 contract.

- **Environment / setup notes:**
  - No new environment variables required. `Settings.jit_buffer_size`,
    `jit_buffer_max`, `jit_persist_grace_seconds` are env-overridable
    (defaults 3, 5, 10 respectively).
  - The Anthropic API key path is unchanged — when unset,
    `resolve_provider` falls back to `StubAIProvider` which returns
    2 deterministic questions; the orchestrator takes `questions[0]`
    per the per-question contract and the second is dropped (the
    SSE handler issues fresh calls for Q2..N each receiving the
    same 2-question stub response, taking [0] each time).

- **Known traps, gotchas, or in-progress work that is easy to
  misread:**
  - **The orchestrator's `finally` clause uses `Task.uncancel()` to
    suppress the sticky Python 3.11+ cancellation request during
    cleanup, then restores it.** Future refactors that touch the
    `_sse_event_stream` cleanup path or `stream_attempt_questions`
    finally must preserve this dance or risk re-introducing the
    Gitar PR-#23 Slice 2 task-leak. Regression test
    `test_externally_cancelled_jit_task_does_not_leak_still_pending`
    catches it.
  - **Per-task persistence is wrapped in `asyncio.shield(_persist_question(...))`.**
    The shield ensures a cancel arriving between `sess.add` and
    `sess.commit` doesn't roll back partial work; the row survives
    in the DB and replays on reconnect. A future refactor that
    inlines the persistence step without the shield would lose
    work on SSE disconnect.
  - **Snapshot for per-Testee is anchors-only.** Code that reads
    `attempt.question_snapshot["questions"]` expecting the full
    set will see only anchors for per-Testee attempts. Use
    `view_attempt` (which merges DB Question rows) for the full
    presented list.
  - **`attempt_position` is on `_present_one` output.** The router's
    `_find_q1_in_view` and any future "find question by position"
    code uses this field. If `_present_one` is refactored to drop
    fields, this must stay.
  - **`get_jit_session_factory` is a FastAPI dependency, not a
    direct call.** The SSE handler receives it via Depends so
    tests can override. Direct calls bypass the override and hit
    real Postgres.
  - **`Test.mode` check at the SSE endpoint is the only gate
    keeping non-per-Testee modes from hitting the orchestrator.**
    A future test mode added without updating this check would
    silently route through streaming.
  - **The `q1` field in `AttemptView` defaults to `None`.** Non-
    per-Testee POSTs and all GETs return `q1=None`. FE code that
    assumes `q1` is always present will break on those paths.

- **Finding → edit map (for future fix-it-up work):**
  - Streaming orchestrator → `app/domain/streaming.py` (single
    file; ~300 lines).
  - Q1 sync + per-Testee branch → `app/domain/attempts.py:172-209`
    (`pause_attempt_from_streaming`), `:211-260` (`_generate_q1_sync`),
    `:698-792` (per-Testee branch of `start_attempt`), `:952-980`
    (`view_attempt` per-Testee branch).
  - SSE endpoint → `app/routers/attempts.py:222-510` (everything
    from `get_jit_session_factory` through the helper functions
    at the bottom).
  - Schema → `app/models.py` (`Question.attempt_position` at the
    Question class definition; `AttemptPauseEvent.reason` at the
    AttemptPauseEvent class definition); migration
    `alembic/versions/0007_p10_question_position.py`.
  - Tests: 4 new test modules in `tests/integration/` and
    `tests/unit/`; updates to P4/P5/P8 tests for the per-Testee
    shape change.

- **Recommended next action:** Start P11 — Bootstrap, safety
  links, crons, cost, comms. The P9 + P10 handovers both flagged
  multiple operational-tunable defaults (`jit_buffer_size`,
  `jit_persist_grace_seconds`, `_FLAG_RATIO_EXCLUSION_THRESHOLD`,
  cron-interval, max-retry, 60-s ceiling, …) as v1.x candidates
  for `system_settings` columns. P11 is the natural place to
  promote any that operators need; the rest stay env-default. P11
  also wires the beat-schedule for the seven crons (Drive ingest +
  realism aggregation are admin-triggered shells at P9; grade-
  review reconcile is admin-triggered at P6; calibration sweep is
  admin-triggered at P8; the P11 schedule wiring is the connecting
  step). The SESSION_START hardening sweep (footer staleness in
  SPEC / DECISIONS / CODE_SPEC / SESSION_START) is the other
  parallel candidate per PR-014 / PR-017 / PR-022 precedent.
