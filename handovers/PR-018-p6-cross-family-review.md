# Handover — PR-018 P6 Cross-family review (synchronous batched OpenAI review)

> **Post-hoc reconstruction.** This handover was reconstructed after
> the fact during the verification audit pass; the working-agreement
> requires handovers authored at PR close, and PR-018 was the gap.
> The reconstruction is built from the four slice commit bodies
> (`5559929` → `a17c6df` → `ad20b56` → `32b8972` → `3efaa5f` →
> `9e5ab36`), the merge commit (`7003dd7`), the v1.7 audited spec
> set at PR-018 build time, and the implementation that landed on
> `main` at merge. Where a section is necessarily thinner than a
> contemporaneous handover (no live "what surprised us this session"
> tone, no Gitar review-link archaeology) the gap is called out
> explicitly. The PR is closed and merged; the post-hoc handover
> exists to discharge the working-agreement obligation, not to
> reinterpret the work.

## PR identifier and link

- PR: #18 — P6 — Cross-family AI review batching (OpenAI synchronous
  batched review) (branch
  `claude/p6-openai-review-batching-OIfUJ`)
- Link: <https://github.com/jaydomains/acumen/pull/18>
- Merge commit: `7003dd7`
- Author / session: Claude Code session (P6 single attempt; sliced
  4 + 2 Gitar fix-up commits per the per-slice binding cadence in
  effect at the time — PR-019's autonomous-loop carve-out had not
  yet been enabled)
- Date closed: 2026-05-20 (merged to `main`)
- Handover authored: 2026-05-22 (post-hoc, during the verification
  audit pass that surfaced this gap)

## Phase reference

- ROADMAP phase closed by this PR: **P6 — Cross-family review**
- Does this PR fully close the phase? **Yes.** All three P6
  done-when criteria are met:
  1. AI-graded responses carry `confirmed`/`flagged` before the
     result displays for the within-60-s batched path —
     `tests/integration/test_p6_grade_review_submit.py::test_submit_writes_grade_review_rows_for_each_ai_grade`.
  2. Over-ceiling or provider-down yields a preliminary result
     page with `pending` rows; the §8.9 reconcile cron picks them
     up on its next pass —
     `tests/integration/test_p6_grade_review_submit.py` (timeout,
     provider-error, malformed-JSON, missing-items, unknown-grade,
     unknown-verdict — six fail-soft branches);
     `tests/integration/test_p6_grade_review_reconcile.py::test_reconcile_flags_pending_when_provider_returns_flagged`
     (plus the auto-flag SLA path and the multi-attempt batching
     path).
  3. The 60-s submit deadline is enforced —
     `app/domain/grade_review.py:85`
     `GRADE_REVIEW_SUBMIT_CEILING_SECONDS = 60.0` wrapped in
     `asyncio.wait_for` at `app/domain/grade_review.py:324`,
     inside `_review_ai_grades`.
- AC-CD11 P6 gate: closed at v1.7 (PR-017). PR-018 builds against
  the locked contract — no further user gate.

## What was built

Four slices + two Gitar fix-up commits, per the binding per-slice
cadence in effect at the time. Each slice was committed, pushed,
reviewed by Gitar, and (where findings surfaced) fixed on-branch
before the next slice opened.

**Slices:**

- Slice 1 (`5559929`) — `OpenAIProvider.review()` + grade-review
  prompt template + unit tests. Implements the OpenAI Chat
  Completions client side of the operation with
  `response_format=json_object`, tenacity exponential backoff on
  transient errors, and contextual `ValueError` on missing payload
  keys / malformed JSON. Ships the `grade_review` prompt
  (`VERSION 1.0.0`) framed as "is this grade defensible given the
  rubric?" per AC-D19 v1.1, with the `items[]` in / `items[]` out
  contract locked at AC-CD11 v1.7.
- Slice 2 (`a17c6df`) — `_review_ai_grades` at submit + the F14
  result-display gate widening. After P5's `_ai_grade_responses`
  writes Grade rows for short_answer / scenario responses, a single
  batched OpenAI `review()` call covers every AI grade in the
  attempt under the 60-s ceiling. Each AI Grade gets a paired
  `GradeReview` row inserted as `pending` before the call; the
  structured response updates rows in place to `confirmed` /
  `flagged` (AC-D19 v1.7 "updated in place, no history"). Cost +
  tokens are divided evenly across rows via
  `record_provenance_share` (AC-D18 — one call costs the same
  regardless of parse success). The F14 result-display gate widens
  from "any AI-graded ⇒ review_pending" to GradeReview-status-aware:
  pending ⇒ `review_pending`; flagged-not-overridden ⇒
  `status="under_admin_review"` (no AI score leak); confirmed ⇒
  normal display.
- Slice 2 Gitar fix (`ad20b56`) — extract `_outcome_for` to a
  neutral `app/domain/_scoring.py` so `attempts.py` and
  `grade_review.py` both import from it (no duplicate body, no
  silent logic drift); promote `import json` to module-level. The
  third Gitar finding (N+1 query pattern) was replied-to on the
  PR and intentionally not fixed — `Column.in_(...)` breaks the
  AC-CD15 zero-DB equality-WHERE harness.
- Slice 3 (`32b8972`) — `reconcile_pending_grade_reviews(db)` +
  Celery task + admin trigger endpoint. One sweep pass: query
  pending rows; auto-flag those older than the ≈50-min SLA window
  (`reason="auto_flagged_stuck_pending"`); group still-active rows
  by `attempt_id`; re-run the batched `provider.review()` call
  against each attempt's pending subset under a generous 90-s
  off-submit-path internal timeout; recompute overall_score for
  attempts whose grade_review set changed. Surfaces:
  `@celery_app.task(name="grade_review.reconcile")` in
  `app/worker.py:60–87` (`reconcile_grade_reviews_task`) plus
  `POST /v1/admin/grade-reviews/reconcile` (manual sweep trigger).
- Slice 4 (`3efaa5f`) — admin flag queue + per-row override
  resolution. `GET /v1/admin/grade-reviews/flagged` lists flagged
  rows whose underlying Grade has NOT been overridden, oldest-first
  (operator priority hint). `POST /v1/admin/grade-reviews/{id}/resolve`
  takes `{action, score?, verdict?, reasoning?}` with per-action
  semantics: `keep_ai` (Grade unchanged; override columns set);
  `accept_reviewer` (`Grade.score=0.0`, `verdict=none`,
  `ai_reasoning ← review_reasoning` preserving the reviewer
  pushback); `substitute` (admin supplies score/verdict/reasoning,
  Pydantic enforces both required). All actions set
  `overridden_by` + `overridden_at`, sync `Response.response_score`,
  recompute overall_score, write an audit row.
- Slice 4 Gitar fix (`9e5ab36`) — raise `500 broken_grade_chain`
  rather than returning a `uuid.UUID(int=0)` sentinel when the
  grade → response → attempt → test chain has a missing link. The
  chain is an FK invariant ("shouldn't happen" in production), but
  if it ever fires the data-corruption signal must be loud, not
  silent. Consequent control-flow cleanup: response_score sync and
  `_recompute_overall_score` now run unconditionally; the response
  dict drops Optional guards.

**Files added (9 + this handover = 10):**

- `app/domain/grade_review.py` — the P6 domain module (889 lines at
  PR close). Houses `_review_ai_grades` (submit-path batched call,
  line 228 onward); `reconcile_pending_grade_reviews` (off-submit
  sweep); `list_flagged_grade_reviews`, `resolve_flagged_review`
  (admin surface); `_recompute_overall_score`,
  `_apply_keep_ai` / `_apply_accept_reviewer` / `_apply_substitute`
  helpers; the three operational constants
  (`GRADE_REVIEW_SUBMIT_CEILING_SECONDS = 60.0` at line 85;
  `GRADE_REVIEW_RECONCILE_INTERVAL_MINUTES = 5`;
  `GRADE_REVIEW_MAX_RETRY_ATTEMPTS = 10`).
- `app/domain/_scoring.py` — Slice 2 Gitar-fix extraction. Houses
  the `outcome_for` shared by `attempts.py` and `grade_review.py`.
- `app/ai/prompts/grade_review.py` — Slice 1 prompt template
  (`VERSION 1.0.0`), batched `items[]` in/out contract.
- `tests/unit/test_p6_openai_review.py` — 12 unit tests on
  `OpenAIProvider.review()` (success paths + contextual-error paths
  on every off-contract input).
- `tests/integration/test_p6_grade_review_submit.py` — 11
  integration tests covering happy path, six fail-soft branches,
  ceiling-breach, telemetry assertion.
- `tests/integration/test_p6_result_view_gate.py` — 4 integration
  tests on the F14 widening (review_pending / under_admin_review /
  confirmed-normal-display / flagged-overridden-included).
- `tests/integration/test_p6_grade_review_reconcile.py` — 8
  integration tests covering empty-sweep zero counts, confirm path,
  flag path, auto-flag SLA boundary, overall_score recompute after
  auto-flag, provider continues to fail, admin-override skip,
  multi-attempt batching (one provider call per attempt — not one
  mega-call across attempts).
- `tests/integration/test_p6_admin_reconcile_endpoint.py` — 3
  integration tests (returns-counts, zero-counts, forbidden-for-non-admin).
- `tests/integration/test_p6_admin_flag_queue.py` — 15 integration
  tests: list returns unresolved-only, excludes overridden,
  oldest-first, Testee-403; resolve happy paths for `keep_ai`,
  `accept_reviewer`, `substitute`; 4xx error paths
  (not_flagged, already_overridden, not_found, 422 shape);
  overall_score recompute on substitute; audit log content;
  broken-grade-chain 500.
- `handovers/PR-018-p6-cross-family-review.md` — this file (post-hoc).

**Files changed (6):**

- `app/ai/openai.py` — Slice 1: full `OpenAIProvider.review()`
  implementation (212-line diff). Mirrors the `AnthropicProvider`
  shape so the two providers stay operationally symmetric.
- `app/ai/prompts/__init__.py` — Slice 1: register the new
  `grade_review` prompt template.
- `app/domain/attempts.py` — Slice 2: wire `_review_ai_grades` into
  the `submit_attempt` path after AI grading. The wiring is
  failure-isolated; submit MUST NOT fail because review failed (the
  P7 handover later cites this as the precedent for the loop
  driver's `try/except → _log.exception` pattern).
- `app/routers/admin.py` — Slices 3 + 4: three new endpoints
  (`POST /v1/admin/grade-reviews/reconcile`,
  `GET /v1/admin/grade-reviews/flagged`,
  `POST /v1/admin/grade-reviews/{grade_review_id}/resolve`) behind
  the existing `require_role(ROLE_ADMINISTRATOR)` gate.
- `app/schemas.py` — Slices 3 + 4: `GradeReviewReconcileResult`,
  `FlaggedGradeReviewItem`, `FlaggedGradeReviewListResponse`,
  `GradeReviewResolveRequest` (with Pydantic-enforced
  `substitute ⇒ score+verdict required`),
  `GradeReviewResolveResult`.
- `app/worker.py` — Slice 3: `@celery_app.task(name="grade_review.reconcile")`
  wrapper at lines 60–87. Imports `reconcile_pending_grade_reviews`
  + `_session_factory` lazily to match the AC-CD2 structure-gate
  convention; commits the session at the end so the in-place
  row updates persist; returns the same counts dict the admin
  trigger endpoint returns.
- `tests/unit/test_p5_prompts.py` — Slice 1: cover the new
  `grade_review` prompt entry in the prompt-registry assertion.

**Files removed:** none.

**Summary.** P6 ships the v1.7 AC-CD11 / AC-D19 contract end-to-end.
On submit, every AI-graded attempt fires a single batched OpenAI
`review()` call under a 60-second hard ceiling. Each AI Grade gets a
paired `GradeReview` row inserted `pending` before the call; the
batched structured response updates rows in place to `confirmed` /
`flagged`. On any off-contract outcome (timeout, provider error,
malformed JSON, missing `items` key, unknown `grade_id`, unknown
verdict) the affected rows stay `pending` and the §8.9 reconcile
cron picks them up on its next pass; the submit-path audit-log
entry always lands. The reconcile sweep auto-flags rows older than
the ≈50-min SLA window with `reason="auto_flagged_stuck_pending"`
without burning a provider call. The admin flag queue surfaces
flagged rows for keep / accept / substitute resolution per AC-D2's
override mechanism, with overall_score recomputed and an audit row
written on every resolution. The F14 result-display gate widens from
"any AI-graded ⇒ review_pending" to GradeReview-status-aware, so the
result page can show `review_pending` (sync window pending),
`under_admin_review` (flagged not yet resolved — no AI score leak),
or normal-display (confirmed or admin-resolved). Every `review()`
call emits structured telemetry (`latency_ms`, `success`,
`batched_payload_size`, `ceiling_breached`, `attempt_id`,
`tenant_id`) per the ROADMAP P6 deliverable — the empirical baseline
for tuning the 60-s ceiling.

## What was decided in this PR

**New anchors introduced:** none. Implementation lands against the
v1.7 audited spec (AC-CD11 closed at PR-017, AC-D19 amended in the
same change).

**Existing anchors this PR depends on:**

- Product: AC-D19 v1.7 (cross-family review — batched per attempt,
  60-s ceiling, fail-soft pending, ≈50-min SLA), AC-D18 (per-row AI
  provenance — divided evenly across the N rows produced by one
  batched call), AC-D2 (admin override mechanism — `overridden_by` +
  `overridden_at` + audit-row pattern), AC-D5 (AI grading pipeline
  produces the Grade rows that P6 reviews), AC-D12 (Anthropic
  primary grading; OpenAI is the cross-family reviewer).
- Technical: AC-CD11 v1.7 (locked contract — batched per attempt,
  60-s ceiling, fail-soft pending, ≈50-min SLA), AC-CD8 v1.6
  (provider routing via `resolve_provider(Operation.grade_review)`),
  AC-CD2 (thin routers — admin.py endpoints inline-thin to delegate
  into `app/domain/grade_review.py`), AC-CD5 (auth seam —
  `require_role(ROLE_ADMINISTRATOR)` on all three admin endpoints),
  AC-CD15 (zero-DB / zero-network test harness — every query in
  `grade_review.py` is single-column equality-where; the Slice 2
  Gitar N+1 finding was reply-deferred because `Column.in_(...)`
  breaks the harness), AC-CD16 (201/200 status conventions on
  admin write endpoints).

**Decisions recorded in slice commits + the PR's plan-mode pass:**

1. **Three operational constants stay as code constants, not
   `system_settings` columns.** `GRADE_REVIEW_SUBMIT_CEILING_SECONDS`
   (60), `GRADE_REVIEW_RECONCILE_INTERVAL_MINUTES` (5),
   `GRADE_REVIEW_MAX_RETRY_ATTEMPTS` (10) — all live as
   module-level constants in `app/domain/grade_review.py`. PR-017
   v1.7 locked this disposition; PR-018 honours it. The
   operator-visible ≈50-min "stuck pending → auto-flag" SLA is the
   product of the two reconcile constants (5 min × 10 = 50 min
   wall-clock). Tracked for v1.x promotion when the telemetry has
   enough real data to inform tuning.
2. **Retry counting is wall-clock against `grade_review.created_at`,
   NOT a per-row counter column.** Matches the AC-CD11 v1.7
   operator-visible ≈50-min SLA verbatim and avoids a schema
   migration. The cost: rows pending across cron downtime simply
   age out without multiple retries. Acceptable at the v1.7 defaults
   (queue is empty in normal operation; aged-out rows surface in
   the admin queue).
3. **`accept_reviewer` semantic.** Plan-mode question (user
   confirmed): the admin acting "I trust the reviewer's pushback"
   writes `Grade.score = 0.0`, `verdict = none`, and preserves the
   reviewer's pushback by copying `review_reasoning` into the
   Grade's `ai_reasoning` column. The original AI grade text is
   not preserved — the audit row records the action + reviewer
   reasoning so the trail is reconstructable, but the displayed
   Grade reflects the admin's decision to overturn.
4. **Provenance share calculation: divide by `items_sent`, not by
   `items_parsed`.** One OpenAI call costs the same regardless of
   parse success. If 4 items go in and the structured response
   parses only 3, all four rows share 1/4 of the call's cost +
   tokens; the unparsed row's provenance is correct, and it stays
   `pending` for the reconcile cron to pick up.
5. **Reconcile groups pending rows by `attempt_id` and fires one
   batched call per attempt.** Not one mega-call across attempts.
   Matches the submit-path shape exactly so provider-side prompt
   caching (if/when added) benefits both paths identically.
6. **No `app/routers/review.py` mount.** The cross-family review
   surface is fully domain-internal; the admin endpoints live in
   `app/routers/admin.py` alongside the other admin operations. The
   `app/routers/review.py` stub from P1 was left in place at PR-018
   close (the verification-audit PR — this one — deletes it). The
   ROADMAP P6 done-when wording at the time named
   `app/routers/review.py` as the deadline-enforcer; the wording
   was wrong (the wait_for landed in `app/domain/grade_review.py`),
   and the verification audit fixes it.

**Deliberate documentation-narrative decisions (per the
PR-014 / PR-017 / PR-019 precedent of CHECKLIST-only doc moves
during code phases):**

- **No canonical-doc edits during the slices.** SPEC / DECISIONS /
  CODE_SPEC / SESSION_START / ROADMAP are untouched. The intended
  CHECKLIST update at PR close did not happen — this is the gap the
  verification audit caught. The CHECKLIST flip-to-built lands in
  the same doc-hygiene PR that ships this post-hoc handover.

## Drift flags raised and how they were resolved

**No spec drift surfaced.** The v1.7 spec (PR-017 close) is the
build target; P6 lands against it without amendment.

**Four Gitar findings across two review cycles, all resolved on-branch
(one of the four was reply-deferred with a documented rationale, the
other three were code-fixed):**

Slice 2 review (commit `a17c6df`, 3 findings):

1. **Duplicate `_outcome_for` body in `attempts.py` and
   `grade_review.py`.** Risk: silent logic drift if one copy gets
   updated without the other. Fixed in `ad20b56` by extracting to
   `app/domain/_scoring.py` (`outcome_for`); both call sites now
   import from the neutral module. No cycle (neither side imports
   back into the other).
2. **`import json` inside `_review_ai_grades`.** Holdover from an
   earlier iteration with no circular-import justification. Fixed
   in `ad20b56` by promoting to the module-level import block.
3. **N+1 query pattern in the pending-row scan** (specifically the
   per-grade equality lookups during reconcile). Reply-deferred:
   `Column.in_(...)` breaks the AC-CD15 zero-DB test harness's
   equality-WHERE-only execute(). Every existing domain query
   follows the per-row equality pattern for the same reason. The
   PR-019 P7 handover later codifies this as a P11 / scale-driven
   refactor target: when operational data shows the queue routinely
   exceeds a small constant, swap in a JOIN-based query behind a
   `Protocol` boundary so the harness's equality-only walk remains
   the test seam.

Slice 4 review (commit `3efaa5f`, 1 finding):

1. **`resolve_flagged_review` returns `uuid.UUID(int=0)` as a
   sentinel when the grade → response → attempt → test chain has a
   missing link.** Risk: the schema declared `attempt_id` as
   non-optional, so the sentinel would have silently passed
   validation and confused downstream consumers. Fixed in `9e5ab36`
   by raising `500 broken_grade_chain` instead — the chain is an FK
   invariant, so this defensive path "shouldn't happen" in
   production, but if it ever fires the data-corruption signal must
   be loud. Consequent control-flow cleanup: `response_score` sync
   and `_recompute_overall_score` now run unconditionally (the
   chain check made the prior `if not None` guards redundant); the
   response dict no longer needs Optional guards on `attempt_id` /
   `overall_score` / `outcome`. Regression test:
   `test_resolve_500_when_grade_chain_is_broken` forces the broken
   state by clearing the Response store and verifies the 500 fires.

Slice 1 review: no findings. Slice 3 review: no findings.

## Open questions deferred to a later phase

- **Beat-schedule wiring of the §8.9 grade-review reconcile cron.**
  Deferred to P11 at PR-018 close. Slice 3 ships the Celery task
  (`@celery_app.task(name="grade_review.reconcile")` in
  `app/worker.py`) and the admin trigger endpoint, but the
  `beat_schedule.py` entry that fires the task every 5 minutes is
  not in PR-018. **Closed at PR-024 / P11 Slice 2** — see
  `app/beat_schedule.py:37–43` (`crontab(minute="*/5")`).
- **Frontend UI for the admin flag queue.** Deferred to the
  frontend session. The backend surface (`GET /flagged`,
  `POST /{id}/resolve`) is fully populated; the admin UX layer
  is out of scope for the v1 backend phases.
- **`system_settings` columns for the three P6 operational
  defaults.** Tracked for v1.x promotion when the telemetry has
  enough real data to inform tuning. PR-018 honours the PR-017 v1.7
  disposition (code constants only).
- **Preliminary-result UX over-the-ceiling.** AC-D19 v1.1's "no
  internalise-then-walk-back" durability guarantee depends on the
  over-ceiling preliminary-result page being **visibly preliminary**,
  not silently so. PR-018 ships the `under_admin_review` /
  `review_pending` server-side gate so the UX can render the right
  state; the visible-preliminary affordance itself is frontend
  territory.

## Build state vs spec

- **Complete:**
  - `OpenAIProvider.review()` against the OpenAI Chat Completions
    API with `response_format=json_object`, tenacity backoff, and
    contextual `ValueError` on every off-contract input.
  - Submit-path batched review with 60-s `asyncio.wait_for` ceiling
    and the full fail-soft branch coverage.
  - GradeReview rows: 1:1 with AI-graded Grade rows; in-place
    updates only (no history rows); pending → confirmed/flagged;
    auto-flagged for stuck pending past the ≈50-min wall-clock SLA.
  - Provenance: per-row OpenAI provenance via
    `record_provenance_share`, divided evenly across the N rows the
    batched call was sent.
  - Telemetry: per-`review()`-call structured log with
    `latency_ms`, `success`, `batched_payload_size`,
    `ceiling_breached`, `attempt_id`, `tenant_id`.
  - F14 result-display gate widening to GradeReview-status-aware
    (`review_pending` / `under_admin_review` / normal-display).
  - Reconcile sweep with auto-flag past SLA and per-attempt
    batching under the 90-s off-submit internal timeout.
  - Admin surface: `POST /grade-reviews/reconcile` (manual sweep
    trigger), `GET /grade-reviews/flagged` (oldest-first queue),
    `POST /grade-reviews/{id}/resolve` (keep_ai / accept_reviewer /
    substitute with Pydantic-enforced shape and the AC-D2 override
    columns + audit row).
  - 53 net new tests (12 unit + 41 integration); P6 baseline at
    merge: 346 total tests.
- **Partial:** none.
- **Stubbed:** `app/routers/review.py` was left in place at PR-018
  close as a 7-line module-docstring-only stub (the original P1
  scaffold placeholder). All P6 admin endpoints landed in
  `app/routers/admin.py` to match the convention of one admin
  router. The verification-audit PR (the one shipping this
  handover) deletes the stub and updates the corresponding
  doc references (`ROADMAP.md`, `CHECKLIST.md`, `CODE_SPEC.md`,
  `SESSION_START.md`) to point at the real implementation surface.

## Test coverage and CI results

- **Total at merge:** 346 tests passing. P5 baseline (`70414e3`)
  closed with somewhere around 293 tests; P6 added 12 unit tests in
  Slice 1, 15 integration tests in Slice 2 (11 submit + 4
  result-view-gate), 11 integration tests in Slice 3 (8 reconcile
  + 3 admin-endpoint), 14 integration tests in Slice 4
  (admin-flag-queue), and 1 regression test in the Slice 4 Gitar
  fix-up. The PR-019 P7 handover later cites "P6 baseline 346" as
  the P7 starting count, which matches.
- **Per-file test counts at PR close:**
  - `tests/unit/test_p6_openai_review.py` — 12 tests.
  - `tests/integration/test_p6_grade_review_submit.py` — 11 tests.
  - `tests/integration/test_p6_result_view_gate.py` — 4 tests.
  - `tests/integration/test_p6_grade_review_reconcile.py` — 8 tests.
  - `tests/integration/test_p6_admin_reconcile_endpoint.py` — 3 tests.
  - `tests/integration/test_p6_admin_flag_queue.py` — 15 tests.
- **CI parity sweep at each slice close:** `ruff check .`,
  `ruff format --check .`, `mypy app`,
  `scripts/structure_gate.py`, `scripts/check_unpinned_deps.py` —
  all reported clean in the slice commit messages.
- **CI result at merge:** green (the merge commit `7003dd7` is on
  `main`; no follow-up fix-forward commits target P6 code).
- **Manual verification at handover authoring (post-hoc):**
  - `grep -n "GRADE_REVIEW_SUBMIT_CEILING_SECONDS" app/domain/grade_review.py`
    → line 85 (constant) + line 324 (use site inside
    `_review_ai_grades`).
  - `grep -n "grade_review.reconcile" app/beat_schedule.py app/worker.py`
    → beat-schedule entry at `app/beat_schedule.py:38–43`
    (added in P11 Slice 2 — outside this PR); Celery task at
    `app/worker.py:60–87`.
  - `pytest tests/integration/test_p6_*.py tests/unit/test_p6_*.py -q`
    → all P6 tests still pass against the merged-to-main code
    (sanity check during the verification audit).

## Anything a fresh Claude Code session needs to pick up cleanly

- **Required reading beyond `SESSION_START.md`:**
  - `CODE_SPEC.md` §11 (cross-family review) + §18 AC-CD11 v1.7
    (locked contract).
  - `DECISIONS.md` AC-D19 (with the v1.6 + v1.7 amendment
    callouts).
  - `SPEC.md` §6.6 + §4.8 + §8.9.
  - `PR-017` handover for the AC-CD11 gate-closure rationale.
  - `PR-019` handover for how P7 builds on P6's failure-isolation
    pattern.
- **Recommended next action.** At PR-018 close, the next phase was
  **P7 — Adaptive learning loop, competence, integrity**. PR-019
  shipped that; subsequent phases (P8, P9, P10, P11) have also
  closed. The current live state is P0–P11 complete; the next
  meaningful work is the post-build hardening / observability sweep
  (the conditional P12 in `ROADMAP.md:200`).
- **Known traps / gotchas:**
  - **Failure-isolation contract.** The submit-path call into
    `_review_ai_grades` runs under a try/except that MUST NOT
    re-raise. If review fails for any reason — provider down,
    timeout, malformed payload — the affected GradeReview rows stay
    `pending` and the reconcile cron picks them up. Submit must
    succeed; the audit-log entry always lands. PR-019 P7 inherits
    this pattern for the loop driver.
  - **The 60-s submit ceiling vs the 90-s reconcile internal
    timeout.** Two different `asyncio.wait_for` boundaries on
    purpose. The submit ceiling (60 s) is the Testee-visible UX
    contract (AC-CD11). The reconcile internal timeout (90 s) is
    operational — generous because the Testee isn't waiting, but
    bounded so a single stuck provider call can't hang the sweep.
  - **Provenance share semantic.** `record_provenance_share`
    divides one batched call's cost + tokens evenly across the N
    rows the call was *sent*, not across the N rows successfully
    parsed. If parse fails partway, the unparsed rows still carry
    correct provenance for the call they were sent in; they stay
    `pending` and the reconcile sweep makes a fresh call (with
    fresh provenance) on the next pass.
  - **Auto-flag is wall-clock, not retry-counted.** A row created
    at T=0 with the cron offline through T=55min will auto-flag on
    its first reconcile pass after T=50min — even if no retries
    were attempted. This is intentional per AC-CD11 v1.7's
    operator-visible SLA wording.
  - **`accept_reviewer` overwrites `Grade.ai_reasoning` with the
    reviewer's pushback.** The original AI grade text is not
    preserved on the Grade row; it lives in the audit-log detail
    JSONB and (until any future audit-log cleanup) is recoverable
    from there. Plan-mode-confirmed semantic; documented inline in
    `_apply_accept_reviewer`.
- **Anchor amendments closed in this PR:** none. The v1.7 spec set
  is the build target verbatim. AC-CD11 closed at PR-017; AC-D19
  v1.7 amended in the same change; PR-018 ships against both
  without further amendment.

## Post-hoc reconstruction notes

The following sections were necessarily thinner than they would
have been in a contemporaneous PR-018 handover; they are flagged
here so a future reader can recognise the gap:

- **Drift flags raised** — Gitar review findings are reconstructed
  from the slice + fix-up commit bodies, not from the original PR
  conversation thread. The four findings above are the ones the
  fix-up commits explicitly address; any review banter / non-finding
  comments are not represented.
- **Manual verification at PR close** — the original handover would
  have listed the exact grep set the author ran at PR close. The
  post-hoc verification step in §"Test coverage and CI results"
  above is the audit-time substitute; it does not capture what was
  checked at the original close.
- **CHECKLIST flip** — PR-018 was expected to flip the three P6
  rows from `missing` to `built` at PR close. That edit did not
  land. The same doc-hygiene PR shipping this post-hoc handover
  performs the flip.

End of post-hoc reconstruction.
