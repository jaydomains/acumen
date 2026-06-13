# Handover — D3 gap-detection sweep + catalogue-health check → generation trigger

## PR identifier and link

- PR: #124 — "D3 — gap-detection sweep + catalogue-health check → generation trigger (§6.5 / NS-4)"
- Link: https://github.com/jaydomains/acumen/pull/124
- Author / session: executor session, autonomous-content sequenced cycle (A1→F1)
- Date closed: 2026-06-13 (squash-merged to `main` @ `1e5c382` by the code-overseer)

> Slice **10/14** — the autonomous loop's **trigger**. The most iterative review of the cycle (6 rounds: CA-D3-1..5 + Gitar perf/N+1).

## Phase reference

- ROADMAP phase: **Autonomous content generation + retroactive oversight** (NS-5) — slice **D3**.
- Fully closes the phase? **Partial** — D4 schedules it (Stage D completes at D4).

## What was built

- Files added: `app/domain/gap_detection.py`, `tests/unit/test_gap_detection.py`.
- `gap_detection_sweep(db)` — clusters unconsumed `GapSignal`s by `dedup_key` (sum `occurrence_count` → topic weight ≥ `GAP_WEIGHT_THRESHOLD`); third dedup arm (`_suppressed_topics`: any pill, live or retired, AC-D14, suppresses); else `enqueue_generated_drafts` + mark `consumed_at`.
- `catalogue_health_check(db)` (NS-4) — uncovered subjects (`subjects_with_any_pill`, AC-D14) + thin-band pills (`MIN_BAND_COVERAGE`, with a `_generated_gap_signals` generate-once guard) → same path. A3/D3 coherence: generates pills, never refreshes corpus.

## What was decided in this PR

- **NORMAL class** — §6.5 ratified PR-C; anchor diff empty. **No migration** (`consumed_at` exists from D1-D2; the gap-weight threshold is a module constant), **no crons** (D4).
- **Consolidated pill-state policy:** a topic/subject backed by any pill — live (demand met) or retired (AC-D14 hidden-from-generation) — suppresses regeneration in both arms.

## Drift flags raised and how they were resolved

- None spec-class. **6 rounds:** CA-D3-1 (retired-pill regen vs AC-D14 — fixed via `_suppressed_topics`), CA-D3-2 (SQL-bound the unconsumed scan), CA-D3-3 (thin-band recurrence — generate-once guard), CA-D3-4 / Gitar N+1 (hoisted the guard to one query), the AC-D14 uncovered-subject forward-watch, dead-code + docstring (CA-D3-5). **Surfaced, not resolved:** the §6.5/AC-D20 thin-band remediation question (generation mints a *duplicate* pill, it cannot enrich the existing thin pill's bands) — the generate-once guard is the explicit stop-gap; the spec-author owns the intended NS-4 thin-band fix.

## Open questions deferred to a later phase

- **Thin-band remediation** (band-enrichment vs duplicate-pill) — a §6.5/AC-D20 spec-author question.
- The gap-weight / band-coverage thresholds could promote to `SystemSettings` if per-tenant tuning is wanted.

## Build state vs spec

- Complete: the gap-detection + catalogue-health trigger logic, bounded/idempotent/AC-D14-respecting.
- Partial (later): the crons that schedule it (D4); the oversight dashboard (E1/E2).

## Test coverage and CI results

- `tests/unit/test_gap_detection.py` — 12 zero-network tests (cluster ≥/< threshold, third-arm live + retired suppression, two-sweep idempotency, cross-type cluster, uncovered-subject + all-retired-subject, thin-band + generate-once guard, well-covered no-op, A3/D3 coherence). 1024/1024 unit+integration at merge.
- CI at merge: all green; 3 sign-offs + Gitar GREEN + mergeable clean.

## Post-merge validation considerations

- No migration. Re-verify: `python -m pytest tests/unit/test_gap_detection.py -q`.
- **D4 caller-commits forward-watch** (the overseer's note): `gap_detection_sweep` only *marks* `consumed_at`; the D4 cron task MUST `await session.commit()` (and ideally an e2e guard, per the D1-D2 lesson).

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading: `plans/REQUIRED_READING.md`, detail §10 (D3) / §11 (D4).
- Next is **D4** (the two crons, §11): add `gap_detection.sweep` + `catalogue_health.check` to `beat_schedule.py` + the `worker.py` task wrappers (each `worker_session` → D3 fn → **commit**) → the canonical **nine** registered crons (AC-CD7/§8.9, ratified PR-A; A3's net-0 swap gave 7). NORMAL class, no migration. Update the count mirrors (beat_schedule docstring/ASCII + the cron-count test 7→9).
- **Verify-before-write against merged main, not the detail-plan body** — the cron count is **nine** (ratified), the same A3 CA-A3-1 net-0 lesson.
