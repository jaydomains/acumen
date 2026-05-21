# Handover — PR-020 P8 anchor calibration

## PR identifier and link

- PR: #20 — P8 — Anchor calibration (branch `claude/anchor-calibration-p8-zCV80`)
- Link: <https://github.com/jaydomains/acumen/pull/20>
- Author / session: Claude Code session (P8 single attempt; sliced 4 + 3 Gitar fix-up commits per the autonomous-loop carve-out the user enabled at start of Slice 2)
- Date closed: 2026-05-21 (PR opened as draft after Slice 1 push; left open for review through all four slices; user merges)

## Phase reference

- ROADMAP phase closed by this PR: **P8 — Anchor calibration**
- Does this PR fully close the phase? **Yes.** All five P8 done-when criteria are met:
  1. **Anchor pool generation per band** (AC-D20 / AC-D23) — `tests/integration/test_p8_anchor_bootstrap.py::test_anchors_generate_happy_path_writes_live_anchors`. Admin-triggered batch action; full AC-D23 cross-pill orchestration script defers to P11 (deliberate scope split, documented below).
  2. **Per-attempt anchor draw record** (AC-D20) — `tests/integration/test_p8_anchor_draw.py::test_anchor_draw_writes_two_attempt_anchor_rows`. 1–2 anchors enter the per_testee snapshot at `start_attempt`; `AttemptAnchor` rows recorded; resume-stable via sorted pool + `attempt.shuffle_seed`.
  3. **Daily Bayesian shrinkage of `effective_difficulty`** (AC-D27 / CODE_SPEC §12) — `tests/unit/test_p8_calibration.py` (26 worked-fixture tests) + `tests/integration/test_p8_calibration_sweep.py::test_calibration_sweep_worked_fixture_shrinks_toward_observed_mean`. Admin-triggered now; beat-scheduled in P11.
  4. **Fresh-question delta** (AC-D27 / CODE_SPEC §12) — `tests/integration/test_p8_anchor_submit.py::test_fresh_question_delta_shifts_competence_estimate`. Per_testee questions in anchor-bearing attempts derive effective difficulty from `mean(anchor.effective - assigned)`; lifts the P7 fall-through inside `competence._effective_difficulty`.
  5. **`preliminary -> confident` at n threshold** (AC-D20 / AC-D27 #3) — `tests/integration/test_p8_calibration_state.py::test_band_state_at_threshold_flips_to_confident`. Per-pill+band display state surfaced via `GET /v1/calibration/pills/{pill_id}/bands/{band}`.

## What was built

Four slices + three Gitar fix-up commits, all under the autonomous-loop carve-out the user enabled at start of Slice 2 ("do not wait for my approval, watch pr for gitar issues, fix flagged items. when green, proceed with next slice"). Per-slice Gitar review ran on each slice commit; every fix-up round resolved findings on-branch with regression rationale recorded inline.

**Files added (8):**
- `app/ai/prompts/anchor_self_review.py` — new prompt module with AC-D23 quality criteria verbatim (pill-fit, difficulty calibration, rubric clarity, freedom from ambiguity, factual reasonableness) + the locked JSON output shape `{items: [{anchor_question_id, verdict, reasoning?}]}`. Mirrors the P6 `grade_review.py` shape.
- `tests/unit/test_p8_calibration.py` (26 worked-fixture tests) — pure-math coverage of `compute_effective_difficulty`, `compute_fresh_question_delta`, `is_confident` with numbers derived directly from AC-D27 / CODE_SPEC §12.
- `tests/unit/test_p8_openai_anchor_review.py` (9 tests) — `OpenAIProvider.review(Operation.anchor_self_review)` happy paths, malformed-JSON contextual error, brace-scan recovery, regression guard against the P6-era NotImplementedError branch.
- `tests/integration/test_p8_anchor_bootstrap.py` (9 tests) — `POST /v1/admin/pills/{pill_id}/anchors/generate` end-to-end: happy path, flag-then-pass regeneration, 3-strikes excluded rows, 409 re-bootstrap guard, 404 missing pill, 403 unauthorised, audit log + multi-band coverage + generation payload contract.
- `tests/integration/test_p8_anchor_draw.py` (9 tests) — anchor draw at `start_attempt`, resume-stability under explicit `sorted(pool, key=a.id)`, edge cases (empty pool / learning-path / non-matching band / excluded-only pool / self-initiated origin / frozen test mode).
- `tests/integration/test_p8_anchor_submit.py` (5 tests) — score denormalisation + the worked-fixture fresh-question delta producing `competence_estimate=8.0` instead of the 7.33 it would be without the delta.
- `tests/integration/test_p8_calibration_sweep.py` (7 tests) — `POST /v1/admin/calibration/run`: empty world, no-observations skip, worked-fixture shrinkage, pass_rate accounting, excluded-row skip, per-anchor failure isolation, 403 unauthorised.
- `tests/integration/test_p8_calibration_state.py` (6 tests) — `GET /v1/calibration/pills/{pill_id}/bands/{band}`: cold start, below / at-inclusive-threshold flip, excluded-vs-live partition, band partitioning, 403 unauthorised.
- `tests/integration/test_p8_anchor_admin.py` (12 tests) — flag queue + per-row resolve actions (keep / substitute_wording / reject) with all 404 / 409 / 422 / 403 error envelopes.
- `handovers/PR-020-p8-anchor-calibration.md` — this file.

**Files changed (10):**
- `app/domain/calibration.py` — grew from a docstring-only stub into the full P8 module: three pure functions (`compute_effective_difficulty`, `compute_fresh_question_delta`, `is_confident`) with the AC-D27 / CODE_SPEC §12 formulas quoted verbatim in the module docstring (defensive citation pattern from PR-018 / PR-019); `generate_anchor_pool_for_pill` admin-triggered bootstrap with up-to-3 generate→review per slot per AC-D23; `draw_anchors_for_attempt` per-attempt helper called from `start_attempt`; `run_calibration_sweep` admin-triggered §12 recompute; `list_flagged_anchors` + `resolve_flagged_anchor` admin queue + per-row resolution; `band_calibration_state` preliminary/confident endpoint.
- `app/domain/attempts.py` — `start_attempt` (per_testee branch only) calls `draw_anchors_for_attempt` after the generation flush and folds the returned anchor `Question` rows into `question_snapshot`. `submit_attempt` denormalises `Response.response_score` into `AttemptAnchor.score` after the grade flush, failure-isolated with `_log.exception(...)` per the P7 pattern at attempts.py:782-789.
- `app/domain/competence.py` — `_effective_difficulty` adds the per_testee fresh-question-delta branch (`question.attempt_id IS NOT NULL`) using Slice 1's `compute_fresh_question_delta`. The anchor-owned branch (`question.pill_id IS NOT NULL`) is unchanged.
- `app/ai/prompts/__init__.py` — registers `anchor_self_review` in `_REGISTRY`; KeyError message no longer mentions P8 as pending.
- `app/ai/openai.py` — widens `_REVIEW_OPS` to include `Operation.anchor_self_review`; adds the 2000-token output ceiling; removes the P6-era NotImplementedError branch that pointed at P8.
- `app/routers/calibration.py` — populates the P1 stub with `GET /v1/calibration/pills/{pill_id}/bands/{band}`.
- `app/routers/admin.py` — four new endpoints: `POST /v1/admin/pills/{pill_id}/anchors/generate`, `POST /v1/admin/calibration/run`, `GET /v1/admin/anchors/flagged`, `POST /v1/admin/anchors/{anchor_id}/resolve`. All `require_role(ROLE_ADMINISTRATOR)`; bootstrap + resolve carry `record_audit` calls at `anchors.bootstrap` / `anchors.resolve`.
- `app/main.py` — wires `calibration.router` in alongside the existing routers.
- `app/schemas.py` — Pydantic models: `AnchorBootstrapResult`, `AnchorBandSummary`, `CalibrationSweepResult`, `BandCalibrationState`, `FlaggedAnchorItem`, `FlaggedAnchorListResponse`, `AnchorResolveRequest`, `AnchorResolveResult`.
- `tests/unit/test_p5_prompts.py` — moves `anchor_self_review` from the deferred list to the registered list; KeyError regex tightens from `P[89]` to `P9` (embed is the only remaining deferred op after P8).
- `tests/unit/test_p6_openai_review.py` — replaces the obsolete `test_review_anchor_self_review_still_raises_with_p8_pointer` with `test_review_rejects_embed_with_routing_message`.
- `tests/integration/conftest.py` — `RecordingProvider.set_response_fn(operation, callable)` extension so tests can shape a response based on the call's payload (needed because the anchor self-review reviewer must echo each item's `anchor_question_id` per the AC-D23 prompt contract).
- `CHECKLIST.md` — five P8 rows ticked `built` with specific Evidence test paths.

**Files removed:** none.

**Summary:** P8 closes the loop P7 deliberately left open inside `competence._effective_difficulty` (the fall-through to `Question.assigned_difficulty` when `AnchorQuestion.effective_difficulty IS NULL`). The Slice 1 pure-math module ships the AC-D27 / CODE_SPEC §12 Bayesian-shrinkage estimator, the fresh-question delta function, and the preliminary → confident gate. Slice 2 adds the admin-triggered bootstrap loop that produces a pill's anchor pool with cross-family self-review (Anthropic generates, OpenAI reviews per AC-D12 v1.6 / AC-D19 v1.1) and up to 3 regenerations per slot per AC-D23 — anchors that pass go live, anchors that fail 3 times land with `excluded=True`, `needs_admin_attention=True` for admin queue resolution. Slice 3 wires the per-attempt draw into `start_attempt`: up to 2 anchors per attempt (sorted-pool + seeded sample for resume stability), `AttemptAnchor` rows recorded, scores denormalised from `Response.response_score` on submit, and the fresh-question delta lifts inside `_effective_difficulty` so per_testee questions in anchor-bearing attempts shift toward each Testee's observed anchor difficulty. Slice 4 ships the admin-triggered calibration sweep that runs the shrinkage recompute across the pool, plus the admin flag queue + per-row resolution (`keep` / `substitute_wording` / `reject`), plus the preliminary/confident band-state endpoint. All AI calls run through the existing `resolve_provider` per-op routing and `record_provenance` cost-share pipeline so the cost dashboard's per-call sum-to-total invariant holds for both gen and review costs (AC-D18).

## What was decided in this PR

**New anchors introduced:** none. Implementation lands against the v1.7 audited spec.

**Existing anchors this PR depends on:**

- Product: AC-D20 (anchor pool per pill+band frozen against the pill; admin Competency View surface), AC-D23 (bootstrap action — AI generation + cross-family self-review + up-to-3 regenerations per slot + admin queue on 3-fail), AC-D27 (Bayesian-shrinkage `effective_difficulty` formula + preliminary → confident at n threshold + fresh-question delta), AC-D9 v1.2 (competence-sensitivity constant + `score_i=0.5` "at-difficulty" semantic that the shrinkage estimator's `(0.5 − score_i)` term hinges on), AC-D18 v1.1 (bootstrap cost amplification — 120–360 AI calls per pill at defaults — stays within the ~$50–60 pilot envelope; budget alerts fire but do not block), AC-D19 v1.1 (cross-family review preserves orthogonal-signal property; Anthropic generates, OpenAI reviews), AC-D12 v1.6 (resolver routes `Operation.anchor_self_review` to OpenAI by coded default).
- Technical: AC-CD2 (thin routers — `app/routers/calibration.py` is the only new router, `app/routers/admin.py` gains four endpoints inline-thin), AC-CD5 (auth seam — every new endpoint protected by `require_role(ROLE_ADMINISTRATOR)`), AC-CD8 v1.6 (per-op resolver routing; every AI-produced entity carries per-call provenance; anchor Question gets the generation provenance, AnchorQuestion gets the review provenance — two AI calls, two provenance records, no double-counting), AC-CD11 v1.7 (60-s ceiling pattern carried forward via the existing OpenAI review path), AC-CD12 (anchor calibration math hot spot), AC-CD15 (zero-DB / zero-network test harness intact — every WHERE is single-column equality, boolean / band filters applied in Python after the equality fetch; Slice 4 Gitar-style discovery: SQLAlchemy `Column == True/False` doesn't compile against the fake `_CatResult` whose `c.right.value` lookup expects a plain literal — switched to Python-side filtering), AC-CD16 (admin write endpoints return 201 Created — matches the P6 / P7 admin write precedent).

**Decisions confirmed with the user at planning (plan-mode questions):**

1. **Full ROADMAP P8 scope in one PR.** All five deliverables (anchor pool + per-attempt draw + Bayesian shrinkage + fresh-question delta + preliminary→confident flip) ship together rather than splitting across phases. Anything that would justify deferral becomes a spec-clarification PR amending ROADMAP, not a build-time narrowing.
2. **Batch-only self-review trigger.** No per-anchor self-review hook on every AnchorQuestion creation — only the AC-D23 bootstrap loop runs review. Admin-authored anchors (via Slice 4 `substitute_wording`) are admin's wording responsibility; running an AI cross-check on admin authorship would invert the trust hierarchy.
3. **Spec formula, no min-n gate.** AC-D27 + CODE_SPEC §12 verbatim. The shrinkage math is stable from `n=0` by construction (returns the prior); the n threshold (`anchor_calibration_confidence_threshold`, default 20) gates only the preliminary → confident *display label*, not the recompute itself.
4. **Defensive citation pattern.** The spec formula is quoted verbatim inside the `app/domain/calibration.py` module docstring (same pattern as PR-018's `accept_reviewer` semantic and PR-019's `_WELL_BELOW_DIFFICULTY_THRESHOLD = 0.4`) so a future reader can verify the math against the anchor without re-reading SPEC / CODE_SPEC.

**Deliberate documentation-narrative decisions:**

- **No canonical-doc edits during the slices.** SPEC / DECISIONS / CODE_SPEC / SESSION_START / ROADMAP are untouched. Only `CHECKLIST.md` moves, at PR close. Matches the discipline carried forward from P4 / P5 / P6 / P7.
- **Autonomous-loop carve-out (this session only).** Per the user's mid-session instruction at start of Slice 2 ("do not wait for my approval, watch pr for gitar issues, fix flagged items. when green, proceed with next slice"), the binding per-slice Gitar pause was carved out for this session. Pattern: after each slice, commit → push → on Gitar review, fix in-place (one round each), then continue to the next slice when Gitar reports green. Three fix-up rounds (two on Slice 2, one on Slice 3); all were tractable and resolved with inline regression commentary referencing the Gitar finding number.

**Deliberate spec deviations (recorded here per the user's binding cadence):**

1. **409-on-re-bootstrap instead of AC-D23's "idempotent" wording.** AC-D23 calls the bootstrap "idempotent" — i.e. re-running it should top-up missing slots without re-billing already-good anchors. P8's admin endpoint instead returns `409 anchors_exist` if any anchor rows already exist for the pill. Operator must drain the flagged queue via the Slice 4 resolve actions before re-running. **Rationale:** the simpler 409 guard prevents an accidental double-bill from a fat-fingered re-run, which is the realistic failure mode at the admin-endpoint surface. Full idempotent top-up semantics (skip slots that already have live anchors, fill only the missing ones) belong at the **P11 bootstrap script** — the orchestrator AC-D23 actually names. Same defensive-deviation pattern as PR-019's `MAX_LOOP_DEPTH = 10`. A future P11 author reading this handover should know: implement idempotent top-up at the Celery-task layer, not by changing the admin endpoint's guard.

2. **Substitute-wording does not auto-rerun self-review.** When admin resolves a flagged anchor with `substitute_wording` + `new_config`, the new config replaces both the `AnchorQuestion.config` AND the shared-PK `Question.config`, and clears `excluded` / `needs_admin_attention` / `regeneration_attempts`. The substituted wording does NOT pass through the AC-D23 cross-family self-review. **Rationale:** admin is the authoritative reviewer of their own substitution; running an AI cross-check on admin authorship would invert the trust hierarchy (the AI's role is to flag for admin review, not to second-guess admin's resolution). Decision recorded in the `resolve_flagged_anchor` docstring + the AnchorResolveRequest schema docstring + the admin endpoint docstring.

3. **HTTP timeout risk on the bootstrap endpoint — production needs the P11 Celery wrap.** At default `anchor_pool_size_per_band = 20` over a 3-band pill, the bootstrap emits up to 360 sequential `await` AI calls per pill. At typical 2–5 s LLM latencies that's 12–30 minutes — beyond default reverse-proxy + ASGI timeouts. The synchronous admin endpoint is for dev/test scenarios and small pools; production at the default pool size MUST run this through the P11 Celery task wrapper (the same wrapper that hosts the AC-D23 cross-pill bootstrap orchestrator). Until P11 lands, the documented workaround is to temporarily lower `anchor_pool_size_per_band` (e.g. to 5) on the `system_settings` row OR narrow `pill.available_difficulty_min/max` before triggering, then restore after the call returns — both reversible without code changes. Recorded in both the `generate_anchor_pool_for_pill` docstring and the admin endpoint docstring per Gitar PR-#20 Slice 2 finding #2.

4. **Per-anchor failure isolation in the calibration sweep.** Per-anchor `try/except Exception: _log.exception(...)` so a single bad anchor (corrupt assigned_difficulty, divide-by-zero, shared-PK invariant break) cannot poison the sweep. Mirrors PR-019 Slice 2's defensive-observability pattern for the submit-path hooks. Telemetry counts (`anchors_processed` vs `anchors_updated`) make the silent-fail observable: an anchor that exceptioned during recompute won't show in `anchors_updated` but will show in `anchors_processed`.

5. **AnchorQuestion ↔ Question shared-PK convention (no foreign key).** Verified pre-existing at `app/domain/competence.py:282` (`select(AnchorQuestion).where(AnchorQuestion.id == question_id)` with `question_id` being a `Question.id`). The two tables share their primary-key UUID by writer-code convention — there is no FK linking them. Consequences: Slice 2's bootstrap inserts both rows with the same UUID per slot; Slice 3's anchor draw appends the shared UUID to the snapshot; Slice 3's submit-time denormalisation walks `AttemptAnchor.anchor_question_id == Response.question_id` (valid because the same UUID identifies both); Slice 4's `substitute_wording` updates both rows to keep the invariant. A future reader who touches anchor writes should respect the invariant or migrate to a real FK.

6. **Provenance routing for the cost dashboard.** The bootstrap loop produces TWO AI calls per anchor: generation (Anthropic) + review (OpenAI). To keep the dashboard's sum-to-call-total invariant intact across BOTH calls without double-counting, generation provenance lands on the `Question` row and review provenance lands on the `AnchorQuestion` row. Sum of Question.ai_cost_usd over anchor questions = total generation cost; sum of AnchorQuestion.ai_cost_usd = total review cost; both feed the dashboard via the existing 6-entity aggregation in `app/ai/cost.py::_spend_for_table`.

7. **Anchor draw cap at 2 per attempt (`_ANCHORS_PER_ATTEMPT = 2`).** Code constant per the planning-phase user-locked direction. AC-D20 says "1-2 anchors mixed into the question set"; this is the upper bound. Could become a `system_settings` column in v1.x if operational tuning needs it; cited inline in the `draw_anchors_for_attempt` docstring.

8. **AC-CD15 fake-harness flat-where pattern preserved.** Two queries originally used SQLAlchemy `Column == True/False` filters in WHERE clauses (`_all_live_anchors`, `list_flagged_anchors`). The fake `_CatResult` in `tests/integration/conftest.py` can't compile those (SQLAlchemy's `True_` element has no `.value` attribute that the harness reads from `c.right.value`). Switched both to equality-WHERE-on-tenant_id + Python-side boolean filter — the same equality-only walk pattern the Slice 2 / Slice 3 pool queries already use.

## Drift flags raised and how they were resolved

**No spec drift surfaced.** The v1.7 spec is consistent with the P8 implementation. CHECKLIST.md is the only canonical doc updated.

**Three Gitar finding rounds across four slices, all resolved on-branch:**

**Slice 2 review (commit `e6ddf6f`, 2 findings):**
1. **🚨 Bug: `scalar_one_or_none()` will raise on re-bootstrap check** (`app/domain/calibration.py::_existing_anchors`) — the query returned N rows after a successful bootstrap, and strict-mode SQLAlchemy raises `MultipleResultsFound`. Fake harness silently returns the first row, masking the bug. Fixed with `.limit(1)` per Gitar's recommended fix + inline comment recording the finding so a future reader doesn't strip the limit thinking it's redundant.
2. **⚠️ Performance: Synchronous sequential AI calls risk HTTP timeout** — see deliberate-deviation #3 above. Documented-only resolution via explicit operational note on both the bootstrap function and the admin endpoint pointing at the P11 Celery wrap. `asyncio.gather` parallelization not pursued in P8 (architectural change with its own concerns — provider rate limits, singleton thread safety, cost-visibility — belongs inside the P11 task wrapper).

**Slice 3 review (commit `4a63d09`, 1 finding):**
1. **💡 Bug: Missing tenant_id filter in anchor pool draw query** (`app/domain/calibration.py::draw_anchors_for_attempt`) — the per-attempt pool query filtered only by `pill_id`, missing the `tenant_id == SEED_TENANT_ID` guard every other query in the file carries. Fixed in both anchor-pool queries (`_existing_anchors` from Slice 2 also; Gitar didn't flag that one but the consistency audit caught it) with inline comments pointing back at this Gitar finding for future audit traceability.

Slice 1 and Slice 4 reviews approved with no findings.

## Open questions deferred to a later phase

1. **P11 — beat-schedule the calibration sweep + bootstrap loop.** `app/beat_schedule.py` is empty by design at v1; P11 wires the existing `run_calibration_sweep` callable to a daily cron (AC-D27) and wraps `generate_anchor_pool_for_pill` in the AC-D23 cross-pill bootstrap orchestrator (with idempotent top-up replacing the 409 guard documented above).
2. **P9 — Drive RAG context in anchor generation.** Slice 2's bootstrap reuses the `Operation.generation` payload shape (`test_name = pill.name`, `target_difficulty = band`, `question_count = 1`, `attempt_id = str(slot_uuid)`). P9 layers Drive RAG context onto the same payload via the same `Operation.generation` op — no anchor-side code change should be needed, only the prompt template + the resolver.
3. **Frontend UI for the flag queue + Competency View.** The admin Competency View consumes `GET /v1/calibration/pills/{pill_id}/bands/{band}` (preliminary / confident display); the flag queue consumes `GET /v1/admin/anchors/flagged` + `POST /v1/admin/anchors/{id}/resolve`. UI wiring is a frontend-session deliverable.
4. **`_ANCHORS_PER_ATTEMPT = 2` as a system_settings column.** Code constant in v1; could become a tunable column if operational tuning needs it. Same pattern as PR-019's `MAX_LOOP_DEPTH = 10`.
5. **Anchor pool ordering UX in the admin queue.** Current order is `created_at` ASC (oldest-first per AC-D23 + the P6 / P7 admin queue precedent). The Competency View frontend may want age + severity sorting once it lands.
6. **What happens when admin resolves the same anchor twice quickly.** The 409 `anchor_not_flagged` guard prevents a double-resolve race; no client-side de-bounce is required.

## Build state vs spec

- **AC-D20 (anchor pool per pill+band)** — complete.
- **AC-D23 (bootstrap action #1)** — complete for the anchor-pool generation + self-review action; the broader cross-pill orchestration script (safety-link fetch + Drive RAG index + cross-pill batching) is P11.
- **AC-D27 (Bayesian shrinkage + fresh-question delta + preliminary→confident)** — complete; admin-triggered sweep in P8, beat-scheduled in P11.
- **AC-D12 v1.6 routing for `Operation.anchor_self_review`** — complete; the resolver default is OpenAI for `_REVIEW_DEFAULT_OPS = {grade_review, anchor_self_review}` which has been in `app/ai/provider.py` since P5.
- **AC-CD8 v1.6 (per-op provenance)** — complete for both generation and review provenance through the bootstrap loop.
- **AC-CD11 v1.7 (60-s ceiling)** — inherited from the existing P6 review path; no change in P8.
- **AC-CD12 (anchor calibration math is a hot spot)** — complete; 26 worked-fixture unit tests + the per-anchor failure-isolation pattern are the AC-CD12 deliverable.

## Test coverage and CI results

**pytest -q: 513 passed** (P7 baseline 433 + ~80 net new — 33 Slice 1 + 9 Slice 2 + 14 Slice 3 + 24 Slice 4).

CI parity sweep clean: `ruff check .`, `ruff format --check .`, `mypy app`, `scripts/structure_gate.py`, `scripts/check_unpinned_deps.py` all pass.

End-to-end manual smoke (post-merge against a real DB):

```
# 1. Bootstrap anchors for one pill
POST /v1/admin/pills/{pill_id}/anchors/generate
  → 201, anchors_generated=<= 20 × len(bands)
# 2. Start an attempt against that pill (assignment-backed, per_testee)
POST /v1/attempts ... with origin=assignment_driven + assignment_id
  → attempt.question_snapshot has 1-2 anchor IDs intermixed
# 3. Submit the attempt
POST /v1/attempts/{id}/submit
  → AttemptAnchor.score populated from Response.response_score
# 4. Trigger calibration sweep
POST /v1/admin/calibration/run
  → 201, anchors_updated reflects the drawn anchors picking up the score
# 5. Re-read the competency state for the pill+band
GET /v1/calibration/pills/{pill_id}/bands/{band}
  → state='preliminary' (n=2, well below threshold=20)
# 6. Re-bootstrap rejection
POST /v1/admin/pills/{pill_id}/anchors/generate
  → 409 anchors_exist
```

## Acknowledged spec / handover continuity

- Predecessor: **PR-019 — P7 adaptive learning loop, competence, integrity.** The P7 fall-through inside `competence._effective_difficulty` (when `AnchorQuestion.effective_difficulty IS NULL`) was deliberately left in place; P8 populates the column via the Slice 4 calibration sweep and lifts the fresh-question delta inside `_effective_difficulty`. All P7 worked-fixture tests still pass — Slice 3's changes are strictly additive for attempts that don't draw anchors.
- Successor: **P9 — Drive RAG + realism feedback.** Layers Drive RAG context onto the existing `Operation.generation` payload shape; no anchor-side code change needed.
- Spec docs unchanged: SPEC.md, DECISIONS.md, CODE_SPEC.md, SESSION_START.md, ROADMAP.md — all v1.7 references stand. Only CHECKLIST.md updated (5 P8 rows ticked `built`).
- Handover continuity: this file follows the PR-019 section structure verbatim. A future session picking up P9 should read `handovers/PR-020-p8-anchor-calibration.md` for the "What was decided" deviations, then `handovers/PR-019-p7-adaptive-loop.md` for the upstream loop wiring, before touching `app/domain/calibration.py` or the resolver routing.
