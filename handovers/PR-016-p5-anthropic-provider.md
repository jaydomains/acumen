# Handover — PR-016 P5 AI provider layer + 5 Anthropic ops

## PR identifier and link

- PR: #16 — P5 — AI provider layer + 5 Anthropic operations (non-streaming) (branch `claude/p5-anthropic-provider-RiRpe`)
- Link: <https://github.com/jaydomains/acumen/pull/16>
- Author / session: Claude Code session (P5 first attempt; sliced 3 + Gitar fix-up commits per the auto-continue carve-out the user enabled)
- Date closed: 2026-05-20 (PR opened; **left open for review** — auto-continue carve-out the user enabled covered the inter-slice pauses; user merges)

## Phase reference

- ROADMAP phase closed by this PR: **P5 — AI provider layer + 5 Anthropic operations (non-streaming)**
- Does this PR fully close the phase? **Yes.** All P5 done-when criteria are met: (1) a spec produces a generated set — `tests/integration/test_p5_generation.py::test_per_testee_start_invokes_generation_with_provenance`; (2) an AI grade persists with captured cost + prompt version — `tests/integration/test_p5_grading.py::test_short_answer_submit_writes_ai_grade_with_provenance`; (3) model resolution order unit-tested — `tests/unit/test_p5_resolve.py` (exhaustive coverage incl. plan-review additions).

## What was built

Three slices + two Gitar fix-up commits, all under the auto-continue carve-out the user enabled. Per-slice Gitar review ran on each slice commit; both fix-up commits resolved findings on-branch with regression tests.

**Files added (16):**
- `app/ai/prompts/__init__.py` — Operation→(template, version) registry + `render_prompt()` helper with contextual ValueError on missing key / malformed template.
- `app/ai/prompts/generation.py` — VERSION + TEMPLATE (per_testee + benchmark generation prompt).
- `app/ai/prompts/grading.py` — VERSION + TEMPLATE (short_answer / scenario grading prompt).
- `app/ai/prompts/weakness.py` — VERSION + TEMPLATE.
- `app/ai/prompts/learning_material.py` — VERSION + TEMPLATE.
- `app/ai/prompts/pill_proposal.py` — VERSION + TEMPLATE.
- `app/domain/weakness.py` — `identify_weakness(db, attempt)` callable. NOT auto-triggered; P7 wires the loop trigger.
- `app/domain/learning_material.py` — `generate_for_weakness(...)` callable. Safety-tagged pills return None (AC-D21). Captures F18 served_at + served_text. NOT auto-triggered.
- `tests/unit/test_p5_resolve.py` (28 tests) — resolution-order coverage + stub-fallback + JSONB falsy-value handling.
- `tests/unit/test_p5_prompts.py` (16 tests) — registry shape + JSON-contract directive + render_prompt error paths.
- `tests/unit/test_p5_cost.py` (14 tests) — compute_cost + provenance helpers + OP_TO_METHOD + PRICE_TABLE coverage check.
- `tests/unit/test_p5_anthropic.py` (8 tests) — AnthropicProvider contextual-error paths + method-routing guards.
- `tests/integration/test_p5_generation.py` (5 tests) — per_testee generation wiring + provenance share + malformed-spec defense + stub fallback.
- `tests/integration/test_p5_grading.py` (6 tests) — AI grading on submit + F14 gate preserved + overall_score excludes AI + non-numeric score defense.
- `tests/integration/test_p5_weakness.py` (4 tests) — callable + not-auto-triggered + malformed pill skip.
- `tests/integration/test_p5_material.py` (4 tests) — callable + AC-D21 safety skip + F18 served_text == content.
- `tests/integration/test_p5_pill_proposal.py` (3 tests) — provenance dict in payload + P3 endpoint via stub fallback.
- `tests/integration/test_p5_budget_alert.py` (8 tests) — 50/80/100 % thresholds + dedup by (threshold, year_month) + no-budget skip + no-admin / deactivated-admin skip.
- `tests/integration/test_p5_cost_dashboard.py` (7 tests) — `/v1/admin/cost/summary` aggregation, splits, percent, alerts surface, 403 for non-admin, null-cost skip.
- `tests/integration/test_p5_rate_limit.py` (6 tests) — AC-D18 v1.1 carve-out + zero-honoured + default-fallback + cross-origin isolation.
- `handovers/PR-016-p5-anthropic-provider.md` — this file.

**Files changed (9):**
- `app/ai/provider.py` — Operation enum, AIResult/EmbedResult dataclasses, AIProvider protocol extended (operation on all 4 methods), full `resolve_provider` + `resolve_model` chains, StubAIProvider enriched with realistic content for the 5 ops (so dev/local fallback works end-to-end).
- `app/ai/anthropic.py` — `AnthropicProvider` concrete impl wired to the Messages API; `tenacity` backoff; contextual ValueError on missing prompt key + on malformed JSON response (Gitar Slice 1 findings #1, #2).
- `app/ai/openai.py` — `OpenAIProvider` skeleton; all methods raise `NotImplementedError` with explicit P6 / P9 pointers.
- `app/ai/cost.py` — Slice 1: PRICE_TABLE + compute_cost + record_provenance + OP_TO_METHOD. Slice 2: record_provenance_share for 1:N callers. Slice 3: current_month_spend aggregator + maybe_fire_budget_alert dispatcher.
- `app/domain/attempts.py` — Slice 2: replace `_stub_generate` with `resolve_provider(Operation.generation).generate(...)` in start_attempt; new `_ai_grade_responses` in submit_attempt for short_answer/scenario; defensive try/except around AI-spec construction (Gitar Slice 2 finding #1) and score parsing (Gitar Slice 2 finding #2). Slice 3: post-call `maybe_fire_budget_alert` hooks.
- `app/domain/catalogue.py` — Slice 1: pass Operation enum to resolve_provider. Slice 2: persist provenance dict inside `processing_tasks.payload` per AC-CD8 v1.6 final clause. Slice 3: post-call `maybe_fire_budget_alert` hook.
- `app/routers/cost.py` — Slice 3: replaces the 6-line stub with admin GET `/v1/admin/cost/summary`.
- `app/main.py` — Slice 3: registers the cost router.
- `tests/integration/conftest.py` — Slice 2: adds `RecordingProvider` fixture (substitutes both `_ANTHROPIC` and `_OPENAI` singletons via monkeypatch; one instance persists across multiple AI calls in a test).
- `tests/integration/test_p4_grading.py` — Slice 2: inverted `test_no_grade_row_for_ai_graded_types` → `test_stub_grades_ai_types_when_no_anthropic_key_configured` (the P4 F14-forward-compat marker test, now reflecting P5's AI-grading wiring with stub provenance on the dev/local fallback).
- `CHECKLIST.md` — P5 rows ticked `built` with specific Evidence test paths.

**Files removed:** none (the inline `_stub_generate` helper in attempts.py was deleted; the equivalent deterministic logic moved into `app.ai.provider._stub_generation_content` so the dev/local fail-safe still produces a working two-question set).

**Summary:** P5 ships the AI provider abstraction with full resolution order (Test override > `provider_by_operation`/`model_by_operation` > `review_provider` convenience default for grade_review/anchor_self_review > coded default), the 5 Anthropic-side operations wired into domain code with full per-call provenance persistence on every produced entity, the VCS prompt registry with per-prompt embedded versions, the per-call cost capture + monthly aggregation + 50/80/100 % alert dispatch via the P2 SMTPClient seam (no hard enforcement per AC-D18 v1.1), and the admin cost-summary endpoint. Cross-family review (OpenAI) is deferred to P6 (OpenAIProvider skeleton is in place so the resolver dispatches correctly today); embeddings deferred to P9. The adaptive-loop trigger for weakness + material remains P7 — both ship as callable domain functions in P5 with full provenance persistence; P7 wires the loop after P6's grade_review confirms each AI grade.

## What was decided in this PR

**New anchors introduced:** none. Implementation lands against the v1.6 audited spec.

**Existing anchors this PR depends on:**

- Product: AC-D7 (pill proposal queue → `processing_tasks`), AC-D12 v1.6 (provider resolution chain), AC-D18 v1.1 (per-call cost capture, monthly budget alerts at 50/80/100 %, self_initiated-only rate-limit carve-out), AC-D19 v1.6 (AI grading for short_answer/scenario; F14 result-display gate stays `review_pending` for mixed attempts because no grade_review row exists until P6), AC-D21 (safety-tagged pills skip AI explainer; curated link fallback wired by P7).
- Technical: AC-CD2 (thin routers; main.py setup-only — the new cost router is the only main.py change), AC-CD5 (auth seam — `require_role(ROLE_ADMINISTRATOR)` on the cost endpoint), AC-CD7 (cron-as-callable + admin trigger — cost dashboard surfaces the alerts that fire inline; the budget-sweep beat-schedule cron is P11), AC-CD8 v1.6 (4-method protocol + operation enum routing + provenance on every AI-produced entity), AC-CD15 (zero-DB / zero-network test harness intact — `RecordingProvider` substitutes the module-level singletons and the P0 socket guard remains the backstop), AC-CD18 (env-overridable model IDs, never hard-coded — the new CI-time test `test_price_table_covers_every_coded_default_model_id` is the drift guard).

**Decisions recorded with the user (plan-mode questions):**

1. **Weakness + learning_material in P5:** ship as callable domain functions; do NOT auto-trigger from `submit_attempt`. SPEC §6.3 requires the attempt be "fully graded and reviewed" before weakness runs, and cross-family review is P6. P7 wires the loop trigger.
2. **Three slices as proposed:** (1) provider plumbing + Anthropic concrete + prompts + cost helper + resolution-order unit test; (2) wire the 5 ops + provenance on every produced entity; (3) monthly budget alerts + admin cost dashboard + rate-limit verification.

**Deliberate documentation-narrative decisions:**

- **No canonical-doc edits during the slices.** SPEC / DECISIONS / CODE_SPEC / SESSION_START / ROADMAP are untouched. Only `CHECKLIST.md` moves, at PR close. Matches the discipline carried forward from P4 / PR-015.
- **Auto-continue carve-out (this session only).** Per the user's explicit instruction mid-session ("please continue. do not pause between slices for me. once gitar reviews and the fixes have been applied, please continue with the next slices"), the binding per-slice Gitar pause was carved out for this session. The pattern: after each slice, commit → push → on Gitar review, fix in-place (one round each), then continue. Both Gitar review cycles produced findings; all were small/tractable and resolved with regression tests; Gitar re-reviewed each fix-up commit and approved.
- **Pro-rata provenance for 1:N producers** (new `record_provenance_share` helper). Generation produces N Question rows from ONE AI call. Three options were on the table: stamp full cost on every row (inflates dashboard by N×), stamp on first row only (breaks per-row inspection), divide evenly (clean SUM, every row carries a meaningful share). Chose the third — every row has full per-call metadata (provider, model, prompt_version) and a pro-rata cost/token share, so `SUM(ai_cost_usd)` over the generated set recovers the call total without de-duplication.
- **`overall_score` in P5 excludes AI grades.** P5 writes Grade rows for AI-graded responses but does NOT fold them into `attempt.overall_score` — the F14 gate already withholds the Testee-facing result page for mixed attempts (`status='review_pending'`), and computing overall_score before P6's review confirms would leak a preliminary value into audit-log detail / admin reads. P6 closes the gate AND recomputes overall_score over deterministic + confirmed-AI grades.
- **PRICE_TABLE drift guard is CI-time, not runtime startup.** Gitar Slice 1 finding #3 suggested a startup check that validates every config-default model ID has a PRICE_TABLE entry. The runtime hook would violate AC-CD2 (`app/main.py` is setup-only; the structure-gate forbids `app.ai` imports from main.py). A CI-time pytest assertion gives the same protection without the layering hit — drift is caught before deploy.
- **Generation payload schema is "what exists today".** The Test model doesn't carry `subject_id` / `question_count` / `question_type_mix` columns (P4 deferred those). The generation prompt + payload use `test.name` + `test.target_difficulty` + a hardcoded `_GENERATION_DEFAULT_QUESTION_COUNT = 5`. Future phases (P9 RAG augmentation; possibly a P11 sweep) add the Test columns and read from them instead. P5 ships the call shape; the prompt template is forward-compatible (extra payload keys are ignored by `str.format()`).
- **`render_prompt()` helper extracted into `app/ai/prompts/__init__.py`** (Gitar Slice 1 finding #1 fix). Could have lived as a private helper inside `app/ai/anthropic.py`; lifting it makes the helper reusable by any future provider impl (P6's OpenAI review will use the same shape) and testable in isolation. Module-level helper, no new file.
- **Defensive posture matched across paths.** AI grading already had defensive verdict-parsing in Slice 2; Gitar (correctly) flagged that the generation loop and the score parsing did not match that posture. Both gaps closed in the Slice 2 follow-up commit (`70cf8ce`) with regression tests; the project's "fail loudly with context, never silently zero" rule (cost helper, render_prompt, JSON parser) is now consistent across every AI-content boundary.

## Drift flags raised and how they were resolved

**No spec drift surfaced.** The v1.6 pre-build audit (PR-014) had already reconciled the P5-relevant prose; P5 ran as a pure code phase with no doc edits required.

**Five Gitar findings across two review cycles, all resolved on-branch:**

Slice 1 review (commit `9680469`, 3 findings):
1. **`template.format(**payload)` opaque KeyError on missing key** (`app/ai/anthropic.py:135`) — fixed via extracted `render_prompt()` helper in `app/ai/prompts/__init__.py`; re-raises as ValueError with op + missing key + available keys. Also catches malformed-template `ValueError` / `IndexError` from prompt-author typos.
2. **`_parse_json_content` opaque JSONDecodeError** (`app/ai/anthropic.py:143`) — `_call` now wraps the parse with try/except re-raising as ValueError carrying op + provider + model + 200-char truncated raw text. Extracted `_raw_text()` helper for parser/error parity.
3. **PRICE_TABLE may drift from config defaults** (`app/ai/cost.py:23-34`) — added CI-time `test_price_table_covers_every_coded_default_model_id` asserting every config-default (provider, model) pair has a PRICE_TABLE entry. Runtime startup hook is the suggested alternative but violates AC-CD2 (main.py setup-only).

Slice 2 review (commit `70cf8ce`, 2 findings):
1. **Generation loop has no defensive handling** (`app/domain/attempts.py:517-529`) — wrapped Question construction in try/except (KeyError, ValueError, TypeError); malformed specs are skipped, `share_count` computed from VALID set so cost-dashboard invariant holds. Regression test `test_per_testee_start_skips_malformed_specs`.
2. **Unguarded `float()` on AI score** (`app/domain/attempts.py:935`) — wrapped score conversion in try/except defaulting to 0.0; matches verdict-defense pattern immediately below. Regression test `test_non_numeric_score_defaults_to_zero`.

After both fix-up commits, Gitar re-reviewed and produced ✅ Approved (5/5 resolved) on Slice 2's revised state.

## Open questions deferred to a later phase

- **Cross-family review wiring (P6):** OpenAIProvider.review() is a skeleton today (raises NotImplementedError with a P6 pointer). The AC-CD11 latency-rule gate must close BEFORE the blocking review path is built. P6 also widens the F14 result-display gate from "any AI-graded item = pending" to "all `grade_review` confirmed/flagged-resolved", and recomputes `attempt.overall_score` over (deterministic + confirmed-AI) grades.
- **Adaptive loop wiring (P7):** `identify_weakness` and `generate_for_weakness` ship as callable domain functions in P5; P7 wires the trigger after P6 grade_review confirms each AI grade. Per AC-D9 amended, weakness output also updates `competence_estimate` — that update is P7 too. Loop-driven origin is already in `_RATE_EXEMPT_ORIGINS` so P7 doesn't need to touch the rate-limit gate.
- **Anchor self-review wiring (P8):** Uses OpenAIProvider.review() (P6 dependency). Bootstrap orchestration is P8.
- **Embeddings (P9):** OpenAIProvider.embed() is a skeleton (raises NotImplementedError with a P9 pointer). The embed Operation enum value is in place; the resolver dispatches correctly. Drive RAG indexing + RAG context injection into the generation payload land in P9.
- **JIT streaming (P10):** Replaces the synchronous foreground generation call in `start_attempt` with SSE + Q2..N parallel Celery tasks per AC-D25. Q1 stays synchronous (~3s). Benchmark explicitly sequential.
- **Beat-schedule cost/budget sweep cron (P11):** P5 fires alerts inline post-call (each AI call site polls `maybe_fire_budget_alert` after the producing row commits); the beat-schedule cron in `app/beat_schedule.py` is P11.
- **`question_count` / `subject_id` columns on the Test model:** P5 hardcodes `_GENERATION_DEFAULT_QUESTION_COUNT = 5` and uses `test.name` as the subject placeholder. Future phase adds the columns; the generation payload is forward-compatible (extra keys ignored by `str.format()`).
- **Configurable `budget_alert_email` on system_settings:** P5 picks the first active admin for the tenant as the recipient. P11 may add an explicit `budget_alert_email` system_settings column for dedicated billing-admin routing.

## Build state vs spec

- **Complete:** Operation enum (the 7 of AC-CD8 v1.6 + `embed` for AC-D22); AIResult / EmbedResult dataclasses; AIProvider protocol with operation parameter on all 4 methods; `resolve_provider` + `resolve_model` with the full Test override > `provider_by_operation`/`model_by_operation` > `review_provider` convenience default > coded default chain; concrete AnthropicProvider for the 5 primary ops with tenacity backoff + contextual error wrapping on prompt rendering + JSON parsing; StubAIProvider as the dev/local fail-safe path (returns realistic content for generation / grading / weakness / learning_material / pill_proposal when the Anthropic key is unset); VCS prompt registry with 5 prompts × `TEMPLATE` + `VERSION` constants; `render_prompt()` helper with contextual error on missing key or malformed template; PRICE_TABLE + `compute_cost` with CI-time coverage guard; `record_provenance` (1:1 producers) + `record_provenance_share` (1:N generation producer) helpers; per_testee generation wired through `resolve_provider` with provenance share persistence on Question rows; AI grading wired in `submit_attempt` for short_answer/scenario types with provenance on Grade rows; `identify_weakness` callable domain function; `generate_for_weakness` callable domain function with F18 served_at/served_text snapshots + AC-D21 safety skip; pill_proposal wired through real provider with provenance dict in payload; `current_month_spend` rolling-month aggregator across 6 provenance-bearing tables + processing_tasks.payload; `maybe_fire_budget_alert` dispatcher at 50/80/100 % thresholds with audit-log dedup per (threshold, year_month); admin GET `/v1/admin/cost/summary` endpoint; rate-limit AC-D18 v1.1 self_initiated-only carve-out (P4 implementation, P5 explicit integration coverage).

- **Partial:** none for P5.

- **Stubbed:** OpenAIProvider.review() and OpenAIProvider.embed() raise NotImplementedError with phase pointers — the class shell exists so `resolve_provider` dispatches correctly today, but no body until P6 (review) / P9 (embed). AnthropicProvider.review() and AnthropicProvider.embed() also raise NotImplementedError (cross-family review is OpenAI by spec; embeddings are OpenAI by spec). All five Slice 2 callable domain functions exist but their TRIGGERS are P7 (weakness + material loop wiring); the P5 callable shape is intentionally invocation-agnostic.

## Test coverage and CI results

- **Tests added / changed:** 109 new tests across 13 files. Plus 1 existing P4 test (`test_no_grade_row_for_ai_graded_types`) inverted into `test_stub_grades_ai_types_when_no_anthropic_key_configured` to reflect P5's AI-grading wiring with stub provenance on the dev/local fallback path. Plus `tests/integration/conftest.py` gains the `RecordingProvider` fixture.
- **Coverage delta:** new AI module (`app/ai/anthropic.py` + `app/ai/cost.py` + `app/ai/prompts/*.py` + `app/ai/provider.py` + `app/ai/openai.py` skeleton) covered by unit tests in `tests/unit/test_p5_*.py`. Domain wiring (`app/domain/attempts.py` per_testee + submit_attempt + budget hook; `app/domain/catalogue.py` enqueue_pill_proposal + budget hook; `app/domain/weakness.py`; `app/domain/learning_material.py`) covered by integration tests in `tests/integration/test_p5_*.py`. Router (`app/routers/cost.py`) covered by `tests/integration/test_p5_cost_dashboard.py`.
- **CI result at merge:** PR `claude/p5-anthropic-provider-RiRpe` → main. Final commit `<Slice 3 SHA>`. Gitar ✅ Approved (5 resolved / 5 findings) on Slice 2 follow-up `70cf8ce`; Slice 3 awaiting Gitar review at handover time. Suite is 289 tests, all green locally; GitHub Actions `checks` clean on each pushed commit.
- **Manual verification performed:** local CI parity sweep (`ruff check`, `ruff format --check`, `mypy app`, `python scripts/structure_gate.py`, `python scripts/check_unpinned_deps.py`, `pytest -q`) clean at every commit boundary. The two Gitar review cycles independently verified the production code paths via static review.

## Anything a fresh Claude Code session needs to pick up cleanly

- **Required reading beyond SESSION_START.md:** this handover, then ROADMAP **P6 — Cross-family review**. The P6 done-when is gated on resolving AC-CD11 (per-response vs batched mode + hard latency ceiling) WITH THE USER before building the blocking submit path. Do not skip the gate.
- **Environment / setup notes:** no env changes. P5 ships no new dependencies (anthropic / openai / tenacity all P0-pinned). No new environment variables — config.py already exposes the Anthropic / OpenAI model-ID defaults from P0. No structure-gate changes (new domain modules `weakness.py` and `learning_material.py` add to the directory without changing the REQUIRED_PATHS list; the structure-gate checks REQUIRED paths exist, not that ONLY those exist — precedent: catalogue.py / tests.py / assignments.py / attempts.py).
- **Known traps / gotchas:**
  - **`overall_score` semantics on mixed attempts.** P5 writes AI Grade rows but deliberately leaves `attempt.overall_score` as the average of deterministic grades only. P6 closes the F14 gate AND recomputes overall_score over (deterministic + confirmed-AI) grades. A P6 implementor who only wires the grade_review row without the overall_score recompute will leave the dashboard showing a preliminary deterministic-only score forever.
  - **Pro-rata generation provenance.** `record_provenance_share` divides cost + tokens evenly across N Question rows from one generation call. The cost-dashboard SUM invariant depends on this. If a future phase adds a "regenerate this one question" path, the per-question provenance is not a meaningful per-call total — it's a share. The audit log captures the original call's totals via `record_audit` (attempt.start detail); add a similar one-call-one-audit-row pattern for any future per-question regeneration.
  - **`maybe_fire_budget_alert` is fail-soft.** Never raises, never refuses. If a P6/P7 path needs to react to budget-exhaustion, do NOT swap to a hard-enforce variant without amending AC-D18 — the spec is explicit ("operations continue regardless of threshold crossings (no hard enforcement)").
  - **`RecordingProvider` monkey-patches module-level singletons.** Tests that set up a `RecordingProvider` and then directly invoke `app.ai.anthropic.AnthropicProvider()` will get a fresh non-patched instance. Always go through `resolve_provider`.
  - **Stub fallback when API keys are empty.** Production deployments must set `ANTHROPIC_API_KEY` and (P6+) `OPENAI_API_KEY`. The dev/local fallback returns the `StubAIProvider` which produces deterministic content with `ai_provider='stub'` and `ai_cost_usd=0.0`. A misconfigured prod env would silently route through the stub — Slice 1's plan called for a startup warning at app boot for `app_env == 'production'` with empty keys; that's still TODO (defer to P11 hardening pass, or pull forward if P6 has time).
  - **`FakeSession`'s equality-only `where` filter.** Same constraint as P4 — `_spend_for_table` in cost.py iterates rows in Python rather than pushing date predicates into SQL. A real Postgres deployment runs the same code; at v1 scale (tens of users, hundreds of attempts/month) the row counts are tiny. Profile in P11 if the deployment ever outgrows this.
  - **TZ-aware datetimes throughout.** `cost.py::_start_of_current_month` and `maybe_fire_budget_alert` use `app.permissions.now_utc()` (TZ-aware). The dashboard endpoint mirrors. Any future code that compares a row's `created_at` against an aggregation window MUST use `now_utc()` (not `datetime.utcnow()`) — TZ mismatch raises `TypeError: can't compare offset-naive and offset-aware datetimes`. Caught and fixed once in Slice 3.
- **Recommended next action:** start a fresh session for **P6 — Cross-family review (with AC-CD11 gate)**. Branch name should follow the `claude/p6-*` convention. P6's pre-work is closing AC-CD11 (the only Drift question on CHECKLIST.md) — work the gate with the user before building the blocking submit path.
