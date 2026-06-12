# Handover — B3 N-draft fan-out + processing_tasks persistence + cost-share

## PR identifier and link

- PR: #120 — "B3 — N-draft fan-out + processing_tasks persistence + cost-share (AC-D29 / §6.8 / AC-CD7)"
- Link: https://github.com/jaydomains/acumen/pull/120
- Author / session: executor session, autonomous-content sequenced cycle (A1→F1)
- Date closed: 2026-06-12 (squash-merged to `main` @ `ba8aa46` by the code-overseer)

> Slice **6/14** — **Stage B complete** (the autonomous generator now grounds, records provenance, and persists N candidate drafts).

## Phase reference

- ROADMAP phase: **Autonomous content generation + retroactive oversight** (NS-5 workstream) — slice **B3**.
- Fully closes the phase? **Yes for the B1–B3 row** (now `done`); Stage B complete.

## What was built

- Files changed: `app/domain/generation.py` (`enqueue_generated_drafts`, `_pending_batch_for`, `GENERATION_TASK_NAME`; `generate_grounded_drafts` extended with `batch_id`), `app/ai/cost.py` (`_pill_generation_spend` + `current_month_spend` registration), `tests/unit/test_generation_fanout.py` (new), `CHECKLIST.md`.
- Summary: `enqueue_generated_drafts` fans one grounded-generation call into **N `pending` `pill_generation` `ProcessingTask` rows**, each payload carrying the draft + a shared **`batch_id`** + the `gap_signal` + its **1/N `cost_share`**. The `batch_id` seam threads through B2's writer (additive `batch_id` arg) so every `GenerationProvenance` row carries it — E2 resolves per-source **and** per-batch rollback. `_pill_generation_spend` folds the per-draft share into `current_month_spend` (AC-CD8).

## What was decided in this PR

- **NORMAL class** — no `SPEC`/`CODE_SPEC`/`DECISIONS` edit (rides ratified AC-D29 / §6.8 / AC-CD7); `_pill_generation_spend` is an **absorbable AC-CD8-pattern mirror** of `_pill_proposal_spend`, not a new anchor. **No migration** (reuses `processing_tasks`; `batch_id` was minted nullable at B2).
- **G3 = ratified min/max-only** (SPEC §6.8:390 — verified against merged spec, the A3 lesson): no per-band field.
- **DS6-a/b** leans held: `batch_id` field (not a `GenerationBatch` table — deferred to E2); drafts reuse `processing_tasks` (`task_name="pill_generation"`), distinct from the `pill_proposal` refiner.

## Drift flags raised and how they were resolved

- None spec-class. **Gitar round-1 (Changes-requested, 3 findings, all folded, none touching a ratified contract):** (1) ⚠️ perf — `_pending_batch_for` full-scan → pushed indexed `task_name`+`status` into SQL (bounds the D3 hot-path scan), kept a Python re-check for the WHERE-ignoring AC-CD15 fake; (2) 💡 idempotency `gap_signal=None` collapse → made dedup **gap-keyed** (only dedup when `gap_signal is not None`; D3 always supplies one); (3) 💡 empty-draft cost leak → WARN the rare AC-CD8 leak + return `[]`. The auditor's CA-B3-1 (= finding 1) was explicitly non-blocking.

## Open questions deferred to a later phase

- **`batch_id` per-batch rollback** is consumed by **E2** (the dashboard/rollback queries `GenerationProvenance.batch_id` + `source_host`). A `GenerationBatch` *table* (batch metadata) is an E2 decision (DS6-a) if needed.
- The **single global confidence threshold** + auto-publish gate that consumes these `pending` rows is **C2**.

## Build state vs spec

- Complete: the fan-out + persistence + cost-share + `batch_id` stamping (AC-D29's B3 deliverables).
- Partial (later slices): self-review protocol (C1), confidence + auto-publish gate (C2), gap-detection trigger (D3 calls `enqueue_generated_drafts`), per-source/per-batch rollback dashboard (E2).

## Test coverage and CI results

- `tests/unit/test_generation_fanout.py` — 8 zero-network tests: fan-out (N pending rows), shared-`batch_id` provenance seam, exact 1/N cost-share summing to the call total via `current_month_spend`, `(topic, gap_signal)` idempotency, done/other-task exclusion, no-dedup-without-gap-signal, empty-draft WARN, G3 min/max-only. 469/469 unit pass at merge.
- CI at merge: green (checks/migration-chain/docker-build/e2e/Gitar). 3 sign-offs at `c4119b6` (executor + auditor content-final + overseer governance-seal) + Gitar-green + mergeable=clean.

## Post-merge validation considerations

- No migration / container concern (pure domain + cost-aggregator code).
- Re-verify: `python -m pytest tests/unit/test_generation_fanout.py tests/unit/test_grounded_generation.py tests/unit/test_p5_cost.py -q`.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading: `plans/REQUIRED_READING.md`, `.claude/roles/planner.md`, detail plan §6 (B3) / §7 (C1).
- **Stage B is complete.** Next is **C1** (the multi-pass cross-model self-review protocol, AC-D30 / §6.9) — it mints `Operation.content_self_review` (the ninth named op, the 2nd ops-count expansion), three `_VARIANT_REGISTRY` passes (grounding/safety/provenance), `self_review_draft`, and the NS-7 degrade switch. **All of C1's surfaces (AC-D30, NS-2 one-op-three-variants, NS-7 degrade-not-gate, AC-D21 safety re-adjudication) are ratified on main** — C1 is execution, NORMAL class, no migration.
- **Verify-before-write against merged main, not the detail plan** (re-confirmed at B3: G3's "surfaced, not baked" was actually ratified min/max-only in SPEC §6.8:390).
- The B3 `enqueue_generated_drafts` output (the `pending` draft rows + their provenance + `batch_id`) is what **C1** self-reviews and **C2** gates/publishes.
