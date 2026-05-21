# Handover — PR-019 P7 adaptive learning loop, competence, integrity

## PR identifier and link

- PR: #19 — P7 — Adaptive learning loop, competence, integrity (branch `claude/adaptive-learning-loop-E3acZ`)
- Link: <https://github.com/jaydomains/acumen/pull/19>
- Author / session: Claude Code session (P7 single attempt; sliced 3 + 2 Gitar fix-up commits per the autonomous-loop carve-out the user enabled mid-session)
- Date closed: 2026-05-21 (PR opened as draft; **left open for review** — autonomous-loop carve-out covered the inter-slice pauses; user merges)

## Phase reference

- ROADMAP phase closed by this PR: **P7 — Adaptive learning loop, competence, integrity**
- Does this PR fully close the phase? **Yes.** All three P7 done-when criteria are met:
  1. Failed pill → weakness report → learning material → follow-up Assignment + loop_driven Attempt (rate-limit exempt) — `tests/integration/test_p7_loop.py::test_failed_assignment_attempt_triggers_autonomous_loop`.
  2. `competence_estimate` recomputes with recency decay; null-handling preserved — `tests/integration/test_p7_loop.py::test_failed_attempt_writes_competence_estimate`; `tests/unit/test_p7_competence.py::TestComputeCompetenceEstimate::test_empty_returns_none`.
  3. N-gram overlap flag fires at the 60% threshold against last served `learning_material.served_text` — `tests/integration/test_p7_loop.py::test_overlap_check_flags_near_verbatim_copy`.

## What was built

Three slices + two Gitar fix-up commits, all under the autonomous-loop carve-out the user enabled. Per-slice Gitar review ran on each slice commit; both fix-up rounds resolved findings on-branch with regression tests.

**Files added (5):**
- `app/domain/loop.py` — main loop module: `apply_overlap_check`, `run_loop_after_submit`, `_create_followup`, `_loop_chain_depth`, `MAX_LOOP_DEPTH`, plus Slice 3 admin queue helpers (`list_admin_queue`, `approve_admin_queue`, `reject_admin_queue`, `_resolve_queue_row`).
- `tests/unit/test_p7_competence.py` (38 worked-fixture tests) — pure-math coverage of `response_competence`, `attempt_competence`, `compute_competence_estimate`, `loop_target_difficulty` with numbers derived directly from AC-D9 v1.2.
- `tests/unit/test_p7_ngram.py` (27 tests) — trigram_shingles + jaccard_overlap + compute_overlap + is_flagged coverage.
- `tests/integration/test_p7_loop.py` (10 tests) — autonomous happy path, safety-pill branch, admin-reviewed routing, competence integration, overlap flag, depth cap, out-of-scope skips.
- `tests/integration/test_p7_loop_admin.py` (12 tests) — GET/POST queue endpoints (happy, 404, 409, 403 across all three).
- `handovers/PR-019-p7-adaptive-loop.md` — this file.

**Files changed (5):**
- `app/domain/competence.py` — Slice 1: full AC-D9 v1.2 pure-function math (`response_competence`, `attempt_competence`, `compute_competence_estimate`, `loop_target_difficulty`) replacing the skeleton. Slice 1 Gitar fix: `math.floor(x + 1.0)` replaces `round(x + 0.5)` to preserve the +0.5 stretch on even-integer estimates (banker's rounding edge case). Slice 2: `apply_competence_update` DB-writing wrapper (resolves effective_difficulty via AnchorQuestion when anchor-backed, else assigned_difficulty; walks Response→Question via id rather than attempt_id-prefilter to support frozen + per_testee + anchor ownership patterns).
- `app/domain/ngram.py` — Slice 1: full AC-D4 #5 / AC-CD14 trigram-shingle + Jaccard pure-function impl with case + whitespace normalisation, replacing the skeleton.
- `app/domain/attempts.py` — Slice 2: three failure-isolated hooks wired into `submit_attempt` after AI grade / after review: `apply_overlap_check`, `apply_competence_update`, `run_loop_after_submit`. Slice 2 Gitar fix: `logging.getLogger(__name__)` + `_log.exception(...)` replacing silent `pass` — production loop faults now emit at ERROR with full traceback.
- `app/routers/admin.py` — Slice 3: three new endpoints `/v1/admin/loop/queue` (GET list), `/v1/admin/loop/queue/{id}/approve` (POST 201), `/v1/admin/loop/queue/{id}/reject` (POST 201). Same `require_role(ROLE_ADMINISTRATOR)` gate as the P6 flag queue.
- `app/schemas.py` — Slice 3: `LoopQueueItem`, `LoopQueueListResponse`, `LoopApproveResult`, `LoopRejectResult` Pydantic models for the three endpoints.
- `CHECKLIST.md` — P7 rows ticked `built` with specific Evidence test paths.

**Files removed:** none.

**Summary:** P7 ships the end-to-end adaptive learning loop. On a failed in-scope attempt, `submit_attempt` runs (in order): AI-grade overlap pass against the last served `LearningMaterial.served_text` for (Testee, pill); cross-family review per P6; `competence_estimate` refresh as a recency-weighted aggregate over all submitted attempts on the pill; weakness identification (AI call) writing `WeaknessReport` + `WeaknessReportPill` rows; per non-safety weak pill, learning-material generation (AI call) with `served_at` + `served_text` populated for the next attempt's overlap lookup; branch on `Assignment.loop_mode` — **autonomous** creates a fresh per_testee Test + Assignment + AssignmentAssignee + `loop_driven` Attempt inline (the existing per_testee `start_attempt` path runs the generation AI call when the follow-up Attempt opens) with `parent_attempt_id` pointing at the failed parent; **admin_reviewed** flips `WeaknessReport.routed_to_admin = True` and stops — Slice 3's admin endpoints (`GET /queue`, `POST /approve`, `POST /reject`) drive resolution from there. `MAX_LOOP_DEPTH = 10` bounds the loop-of-loops chain as defense in depth (AC-D6's primary terminators remain pass, admin override, and budget alerts). All hooks are scope-guarded to single-pill assignment-backed origins (`assignment_driven` + `loop_driven` with `assignment.pill_id` set) — self-initiated and learning-path attempts skip silently. All three submit-path hooks are failure-isolated with `_log.exception(...)` so a loop fault cannot fail the user's submit.

## What was decided in this PR

**New anchors introduced:** none. Implementation lands against the v1.7 audited spec.

**Existing anchors this PR depends on:**

- Product: AC-D6 (loop trigger + autonomous vs admin_reviewed branches), AC-D9 v1.2 (full competence_estimate formula + 90-day half-life default + 2.0 sensitivity default + null-handling + three-consecutive step-down), AC-D4 #5 (n-gram overlap on AI-graded responses against last served material), AC-D21 (safety-tagged pills skip AI explainer; curated_safety_links is P11), AC-D18 v1.1 (loop_driven origin in `_RATE_EXEMPT_ORIGINS` since P5; budget alerts fire on each AI call without blocking), AC-D26 v1.4 (loop_driven attempts carry `assignment_id` validated against the assignee snapshot), AC-D27 (anchor `effective_difficulty` is float — Bayesian-shrunk by the P8 cron; competence_update falls through to `Question.assigned_difficulty` until P8 lands).
- Technical: AC-CD2 (thin routers — admin.py is the only router change; new admin endpoints inline-thin), AC-CD5 (auth seam — `require_role(ROLE_ADMINISTRATOR)` on all three loop endpoints), AC-CD8 v1.6 (every AI-produced entity carries per-call provenance — WeaknessReport, LearningMaterial), AC-CD13 (competence_estimate IRT-style formula with all knobs from `system_settings`), AC-CD14 (n-gram overlap base = AI-generated `served_text` only; trigram size + 60 % threshold are code constants), AC-CD15 (zero-DB / zero-network harness intact — every query is single-column equality where; Slice 2 Gitar fix forward-walks Response→Grade by `attempt_id` to avoid tenant-wide Grade scans), AC-CD16 (201 Created on admin write endpoints — matches P6 grade_review_resolve precedent).

**Decisions recorded with the user (plan-mode questions):**

1. **Slice boundaries.** Three slices: (1) pure domain math + unit tests; (2) submit-path wiring + autonomous follow-up + integration tests; (3) admin-reviewed mode endpoints + CHECKLIST + handover. Binding per-slice Gitar cadence; mid-session the user enabled an autonomous-loop carve-out ("subscribe to the pr and watch for gitar reviews, apply fixes and then continue with next slice when gitar goes green. do not pause to wait for me") which made each slice's Gitar review → fix-up cycle automatic.
2. **Scope of competence + autonomous loop:** **single-pill assignment-backed attempts only** (`origin ∈ {assignment_driven, loop_driven}` AND `assignment.pill_id IS NOT NULL`). Self-initiated and learning-path attempts produce WeaknessReport + LearningMaterial via the loop driver but skip the competence update and the follow-up creation — neither has a single pill to attribute to. Broader pill-resolution lands when self-directed pill selection lands on the data model (post-v1).
3. **Decay strategy:** **write-time-with-all-history.** `competence_estimate` is computed at submit time from this attempt and every prior submitted attempt by the Testee on the pill with current decay weights. The stored value is fresh as of the last submit and goes stale between submits, but staleness only matters once new data exists; if a future operational dashboard needs live decay against a fixed point in time, that lookup recomputes from history (which is what the code does) rather than reading the stored estimate. Documented in the competence.py module docstring so a future session doesn't "fix" the perceived staleness incorrectly.

**Deliberate documentation-narrative decisions:**

- **No canonical-doc edits during the slices.** SPEC / DECISIONS / CODE_SPEC / SESSION_START / ROADMAP are untouched. Only `CHECKLIST.md` moves, at PR close. Matches the discipline carried forward from P4 / P5 / P6.
- **Autonomous-loop carve-out (this session only).** Per the user's mid-session instruction, the binding per-slice Gitar pause was carved out for this session. The pattern: after each slice, commit → push → on Gitar review, fix in-place (one round each), then continue to the next slice when Gitar reports green. Both fix-up rounds produced findings; all were tractable and resolved with regression tests; Gitar re-reviewed each fix-up commit and approved.
- **The < 0.4 "well below the difficulty" threshold.** AC-D9 v1.2 names the three-consecutive step-down rule but does not name the threshold — the exact spec wording is "Three consecutive attempts where the Testee's score is well below the difficulty trigger a step-down of one integer regardless of formula." AC-D9 also defines `response_score = 0.5` as "performed exactly at the question's difficulty"; "well below" therefore means materially under 0.5. The 0.4 cut-off is a P7 implementation choice (0.1 below the at-difficulty midpoint) — small enough to not fire on a normal 50/50 attempt but loose enough to catch a clear pattern of under-performance. Could become a `system_settings` column in v1.x if operational tuning needs it; cited inline in the `loop_target_difficulty` docstring so a future reader can verify against the spec without re-reading the anchor (same defensive pattern PR-018 used for `accept_reviewer`'s semantic).
- **Code constants for `_TRIGRAM_SIZE = 3` and `_OVERLAP_THRESHOLD = 0.60`.** AC-CD14 spec'd both as defaults; the P7 code ships them as module-level constants per the user's planning-phase direction. Could become `system_settings` columns in v1.x if operational tuning needs it.
- **Banker's rounding fix on `loop_target_difficulty`.** AC-D9 v1.2 says "round" without naming a mode; Python's banker's rounding silently killed the stretch on every even-integer estimate (`round(4.0 + 0.5) == 4` under round-half-to-even). The implementation uses `math.floor(competence_estimate + 1.0)` so the +0.5 bias is genuinely upward at every integer / half-integer boundary (mathematically equivalent to round-half-up of `estimate + 0.5`). PR-019 Slice 1 Gitar review caught this; the fix preserves the spec's stated intent.
- **Follow-up Attempt at loop time vs at Testee-start.** Plan locked: create the Attempt at loop time by invoking `start_attempt(origin=loop_driven, assignment_id=<new>)` inline. The existing per_testee branch in `start_attempt` runs the AI generation call when the Attempt is created, so the follow-up is "ready to go" the moment the Testee opens it. Trade-off: 1 extra inline AI call at submit time (the generation call) on top of the weakness + N material calls. Acceptable per AC-D18 cost shape; budget alerts fire inline. The autonomous follow-up's `parent_attempt_id` was the subtle part — `start_attempt` sets it from the in-test attempt chain (most-recent prior on same Test), which is None for a freshly-created per_testee follow-up Test. The loop chain needs a different semantic — point at the **failed parent attempt** regardless of Test — so `_create_followup` overrides `parent_attempt_id` after `start_attempt` returns. This matches the planned semantics and makes `_loop_chain_depth` walkable.
- **`MAX_LOOP_DEPTH = 10` cap.** AC-D6 says the loop continues "until the Testee passes or the admin overrides"; admin override + budget alerts are the spec's primary termination conditions. PR-019 Slice 2 Gitar review (correctly) noted these are organisational mitigations, not code-level safeguards. The cap is the safety bound for the edge case where neither fires — a Testee who consistently fails 10 times in a row will see the 11th submit produce no further follow-up Attempt. The WeaknessReport + LearningMaterial are still written (audit trail + admin queue intact); only follow-up creation is gated. Cap set to 10 — far above any realistic learning progression but tight enough to bound runaway AI cost. P7 code constant; could become a `system_settings` column in v1.x.
- **Loop-driven budget consumption is a known cost amplifier.** Documented in the loop.py module docstring. One failed attempt with N weak pills triggers ~(1 + N) inline AI calls at submit time (1 weakness + N learning_material). Each autonomous follow-up adds 1 inline AI call (per_testee generation) when the loop invokes `start_attempt`, plus 1 AI grade call per AI-graded response at the next submit. Budget alerts fire per AC-D18 v1.1 but do not block — correct per spec. Future operational dashboards (P11) should surface `loop_driven` vs `self_initiated` vs `assignment_driven` cost shares for tuning; ROADMAP P11 task noted.
- **Overlap check ordering: AFTER AI grade, BEFORE review.** Sets `Grade.overlap_pct` + `Grade.overlap_flagged` so the review payload can include the overlap signal if the prompt template wants it later (today it doesn't, but the ordering preserves the option without a re-flush). Failure-isolated independently of the review pass.
- **Defense-in-depth observability.** PR-019 Slice 2 Gitar review caught that the three `try/except Exception: pass` blocks in submit_attempt silently swallowed exceptions despite the inline comments claiming "logged + skipped". Added `import logging` + `_log = logging.getLogger(__name__)` to attempts.py and replaced each `pass` with `_log.exception(...)` so production loop faults emit at ERROR with full traceback. The failure-isolation contract (loop fault must not fail the user's submit) is preserved.

## Drift flags raised and how they were resolved

**No spec drift surfaced.** The v1.7 spec is consistent with the P7 implementation. CHECKLIST.md is the only canonical doc updated.

**Four Gitar findings across two review cycles, all resolved on-branch:**

Slice 1 review (commit `6e08885`, 1 finding):
1. **Banker's rounding nullifies +0.5 stretch on even-integer estimates** (`app/domain/competence.py:178`) — fixed via `math.floor(competence_estimate + 1.0)` replacing `round(competence_estimate + 0.5)`. Added `test_integer_estimate_always_stretches` covering 4.0 → 5, 5.0 → 6, 6.0 → 7 to lock in the fix; updated `test_empty_history_no_step_down` (4.0 now stretches to 5, not 4).

Slice 2 review (commit `978a69e`, 3 findings):
1. **Full-table Grade scan in `_ai_grades_for_attempt` + `_wrong_question_prompts`** (`app/domain/loop.py:121-132`, `:208-212`) — both functions previously ran `select(Grade).where(Grade.tenant_id == SEED_TENANT_ID)` then filtered in Python. At KBC scale that scan grows with every graded response across every Testee. Refactored to forward-walk: attempt → `Response.attempt_id` (indexed equality) → per-response Grade (FK-indexed equality). Same results, O(responses-on-this-attempt) DB queries instead of O(total tenant grades). Harness-compatible (every where remains single-column equality).
2. **Silent exception swallow in submit_attempt** (`app/domain/attempts.py:779-784`, `:796-803`) — the three try/except blocks had inline comments claiming "logged + skipped" but no logger existed. Added module logger; replaced each `pass` with `_log.exception(...)`.
3. **No loop termination bound on recursive follow-ups** (`app/domain/loop.py:370-384`, `:469-475`) — added `MAX_LOOP_DEPTH = 10` + `_loop_chain_depth` helper. WeaknessReport + LearningMaterial still written at depth (audit + admin queue intact); only follow-up Attempt creation is gated. Required overriding `parent_attempt_id` on the loop follow-up post-`start_attempt` (the in-test chain default sets it to None for a fresh Test, which would have made the loop chain unwalkable). Added `test_followup_chain_capped_at_max_loop_depth` integration test hand-building MAX_LOOP_DEPTH chained attempts.

After both fix-up commits, Gitar re-reviewed and produced ✅ Approved (4/4 resolved) on Slice 2's revised state.

## Open questions deferred to a later phase

- **Anchor calibration cron (P8).** `apply_competence_update` resolves `effective_difficulty` via `AnchorQuestion.effective_difficulty` when the question is anchor-backed; else falls through to `Question.assigned_difficulty`. P8 lifts this by populating the Bayesian-shrunk effective_difficulty values; no P7 code changes needed.
- **Drive RAG context injection at generation (P9).** Loop-driven follow-up generation today carries `test_name`, `target_difficulty`, `question_count`, `attempt_id` — same payload shape as P5 per_testee generation. P9 adds RAG context lookup to the payload; no P7 code changes needed.
- **JIT streaming for follow-up Attempts (P10).** The follow-up Attempt today runs the full generation call inline at `start_attempt`. P10 swaps in SSE + parallel Celery tasks for Q2..N per AC-D25; the loop-driven path inherits whatever generation pattern start_attempt provides at that point. No P7 code changes needed.
- **Beat-schedule wiring for any P7-introduced schedules (P11).** P7 has no scheduled jobs. Budget alerts fire inline at each AI call site; admin queue surfaces are pulled on-demand by the admin.
- **Orphan-row reconcile sweep (P11).** `run_loop_after_submit` creates Test/Assignment/Assignee rows before invoking `start_attempt` for the follow-up Attempt. A mid-flow failure could leave partial rows. Slice 2 Gitar fix added a logger + an inline note flagging this risk; the WeaknessReport (which writes first) is the admin queue's authoritative input, so manual reconciliation is possible today. A P11 reconcile sweep that detects orphaned Test/Assignment without a started follow-up Attempt and either completes or rolls them back is on the backlog.
- **`system_settings` columns for tuning constants.** `MAX_LOOP_DEPTH = 10`, `_OVERLAP_THRESHOLD = 0.60`, `_TRIGRAM_SIZE = 3`, and `_WELL_BELOW_DIFFICULTY_THRESHOLD = 0.4` are P7 code constants. If operational tuning ever needs them per-tenant, lift each to a `system_settings` column in a future migration. None blocks v1.
- **Frontend UX for "your follow-up is ready" notifications.** No P7 code change; the notification path is the existing assignment notification surface.
- **Competence per-pill updates for self-initiated and learning-path attempts.** Locked at planning as out of scope — multi-pill resolution is post-v1.
- **`Loop_driven` cost share on the cost dashboard (P11).** The cost-summary endpoint today aggregates by AI operation; splitting by attempt origin would require a join through `Grade.response_id → Response.attempt_id → Attempt.origin` (or a denormalised origin column on the provenance row). P11 if operational tuning needs it.

## Build state vs spec

- **Complete:**
  - `app/domain/competence.py` — pure-function math (`response_competence`, `attempt_competence`, `compute_competence_estimate`, `loop_target_difficulty`) per AC-D9 v1.2 with 38 worked-fixture unit tests; DB-writing wrapper `apply_competence_update` invoked from submit_attempt for in-scope attempts.
  - `app/domain/ngram.py` — trigram_shingles + jaccard_overlap + compute_overlap + is_flagged per AC-D4 #5 / AC-CD14 with 27 unit tests.
  - `app/domain/loop.py` — `apply_overlap_check`, `run_loop_after_submit`, `_create_followup` (with `MAX_LOOP_DEPTH = 10` defense in depth), `list_admin_queue`, `approve_admin_queue`, `reject_admin_queue`.
  - `app/domain/attempts.py` — three failure-isolated hooks wired into submit_attempt (overlap → competence → loop driver), with `_log.exception(...)` observability.
  - `app/routers/admin.py` — three loop queue endpoints (`GET /v1/admin/loop/queue`, `POST /v1/admin/loop/queue/{id}/approve`, `POST /v1/admin/loop/queue/{id}/reject`) with `require_role(ROLE_ADMINISTRATOR)` gate.
  - `app/schemas.py` — `LoopQueueItem`, `LoopQueueListResponse`, `LoopApproveResult`, `LoopRejectResult`.
  - 87 net new tests (38 + 27 unit + 10 + 12 integration) covering happy paths, scope-guard skips, safety pill branch, admin-reviewed mode, depth cap, and 404/409/403 error paths.

- **Partial:** none for P7.

- **Stubbed:** `app/routers/loop.py` still ships the empty stub from P1 — admin endpoints landed in `app/routers/admin.py` to match the P6 grade_review precedent (all admin endpoints in one router). A future Testee-facing loop endpoint (e.g. "list my pending follow-ups") could populate `routers/loop.py`; no P7 use case required it.

## Test coverage and CI results

- **Full suite:** `python -m pytest -q` → 433 passed (P6 baseline 346 + 65 unit + 22 integration = 433).
- **Slice 1 unit tests:** `tests/unit/test_p7_competence.py` (38) + `tests/unit/test_p7_ngram.py` (27) = 65, run in 0.10s.
- **Slice 2 integration tests:** `tests/integration/test_p7_loop.py` (10).
- **Slice 3 integration tests:** `tests/integration/test_p7_loop_admin.py` (12).
- **CI parity sweep clean:** `ruff check .`, `ruff format --check .`, `mypy app`, `scripts/structure_gate.py`, `scripts/check_unpinned_deps.py` — all pass.
- **Gitar reviews:** Slice 1 ✅ Approved (1/1 resolved); Slice 2 ✅ Approved (4/4 resolved across two review cycles); Slice 3 review pending at handover authoring.

## Acknowledged spec / handover continuity

PR-018 (v1.7 audit) is the immediate predecessor; PR-019 builds against the v1.7 audited spec without modification. PR-019 introduces no new anchors and no spec amendments. The next phase is **P8 — Anchor calibration**, which lifts the fall-through path in `_effective_difficulty` (anchor-backed questions today fall through to `assigned_difficulty` when `AnchorQuestion.effective_difficulty IS NULL`) by populating the Bayesian-shrunk float values via the daily calibration cron per AC-D27.
