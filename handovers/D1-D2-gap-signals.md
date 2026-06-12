# Handover — D1-D2 the §6.5 GapSignal signal spine + signal-layer dedup

## PR identifier and link

- PR: #123 — "D1-D2 — §6.5 GapSignal signal spine + signal-layer dedup"
- Link: https://github.com/jaydomains/acumen/pull/123
- Author / session: executor session, autonomous-content sequenced cycle (A1→F1)
- Date closed: 2026-06-12 (squash-merged to `main` @ `581a095` by the code-overseer)

> Slice **9/14 — Stage D begun.** Five review rounds / five findings closed — the deepest review cycle so far (test-fidelity systemic catch).

## Phase reference

- ROADMAP phase: **Autonomous content generation + retroactive oversight** (NS-5) — slice **D1-D2**.
- Fully closes the phase? **Partial** — the D1–F1 row stays `partial` (D3–F1 remain).

## What was built

- Files added: `app/domain/signals.py`, `alembic/versions/0012_d1_d2_gap_signal.py`, `tests/unit/test_gap_signals.py`, `tests/e2e/test_gap_signal_persistence.py`.
- Files changed: `app/models.py` (`GapSignalType` enum + `GapSignal` model), `app/domain/catalogue.py` (discovery-miss capture in `list_discoverable_pills` + commit), `app/domain/attempts.py` (question-tag capture in the per_testee branch), `tests/unit/test_p1_schema.py`, `tests/integration/test_p3_catalogue.py`, `tests/integration/test_p4_attempts.py`, `CHECKLIST.md`.
- Summary: the single polymorphic `GapSignal` store (the D3 sweep's input) + `capture_discovery_miss` / `capture_question_tag` + the `(signal_type, dedup_key)` **signal-layer dedup** (first of the three arms; SQL-index-bounded read + `occurrence_count` increment). `scope_clarification` type defined, capture deferred (signal-3).

## What was decided in this PR

- **NORMAL class** — `GapSignal` ratified SPEC §5:302/§6.5:356 (PR-D); no separate AC-CD; anchor diff empty. Migration `0012` (table + enum type; `consumed_at` authored complete here — D3 sets it, no second migration).
- **question_tag pill sourcing:** keyed on the **actual generation pill** — `rag_pill` (assignment-scoped) with a fallback to `test.pill_id` (self-initiated); pill-less → no capture. Deduped on the normalized topic **name** (intended topic clustering) with the contributing `pill_id` in `detail`.

## Drift flags raised and how they were resolved

- None spec-class. **5 review rounds** (auditor CA-D-1..5 + Gitar x6 + the overseer test-fidelity catch): question_tag was unwired (CA-D-1); discovery_miss never persisted (GET no commit, CA-D-2); O(n) tenant scan ignoring the index; whitespace empty-key; question_tag used `test.pill_id` not the generation pill; name-dedup traceability. **The systemic root cause:** fake-only tests masked the no-persist bug + let prod degrade to fit the fake — closed with a **real-DB e2e persist test** + a commit-spy + index-bounded queries. **#3 (concurrent-dup partial unique index)** declined-with-rationale (recommended-not-blocking; would 500 on a rare race without the full ON-CONFLICT machinery; single-tenant + D3 dedup arm backstop).

## Open questions deferred to a later phase

- **#3 race-safety** (partial unique index + ON CONFLICT/savepoint) — a clean follow-up if concurrency grows.
- `scope_clarification` capture — the admin assignment-clarification feature (signal-3), deferred.

## Build state vs spec

- Complete: the signal spine (model + migration + capture + dedup), persisted + index-bounded + correctly pill-sourced (3 branches), guarded by real-DB + spy tests.
- Partial (later): the gap-detection sweep that **consumes** these signals (D3 — sets `consumed_at`); the crons that schedule it (D4); the oversight dashboard (E1/E2).

## Test coverage and CI results

- `tests/unit/test_gap_signals.py` (capture/dedup/consumed/scope-deferred) + integration (`test_discovery_miss_persists_gap_signal` real-path + commit-spy; `test_per_testee_{assignment,self_initiated}_..._question_tag` + pill-less-none) + `tests/e2e/test_gap_signal_persistence.py` (real-DB cross-session persist). 1012/1012 unit+integration at merge; e2e green in CI.
- CI at merge: all green (incl. e2e); 3 sign-offs + Gitar 7/7 + mergeable clean.

## Post-merge validation considerations

- Migration `0012` additive (gap_signal table + enum type; up/down clean). Re-verify: `python -m pytest tests/unit/test_gap_signals.py tests/unit/test_p1_schema.py tests/integration/test_p3_catalogue.py -q`.
- The e2e persist test runs only in CI (real Postgres): `pytest tests/e2e/test_gap_signal_persistence.py`.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading: `plans/REQUIRED_READING.md`, detail §9 (D1-D2) / §10 (D3).
- Next is **D3** (the gap-detection sweep, §10): `gap_detection_sweep` (cluster `GapSignal`s by `dedup_key` → topic-weight threshold → **third-arm dedup** [skip if a live `Pill` covers it or a pending B3 `pill_generation` batch exists] → `enqueue_generated_drafts(topic, batch_id, gap_signal)` → set `GapSignal.consumed_at`) + `catalogue_health_check` (NS-4: thin-band pills + uncovered subjects → same path). **§6.5 ratified PR-C → NORMAL class.** No crons (D4). D3 must stay distinct from A3's corpus-refresh (D3 generates pills; A3 refreshes corpus) — both read the catalogue.
- **Verify-before-write against merged main + DECISIONS/CODE_SPEC, not the detail-plan body** (the standing note — three drifts surfaced this cycle).
