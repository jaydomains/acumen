# Handover — F1 bootstrap-on-publish (the FINAL slice)

## PR identifier and link

- PR: #128 — "F1 — bootstrap-on-publish (reframed AC-D7/AC-D23) — the FINAL slice"
- Link: https://github.com/jaydomains/acumen/pull/128
- Author / session: executor session, autonomous-content sequenced cycle (A1→F1)
- Branch: `claude/content-gen-f1-bootstrap-on-publish` (off `main` @ `e4e1208`, post-E2)

> Slice **14/14** — the loop-closer. **FINAL slice — gated on spec-author auth (received, audit-at-PR mode) + the end-of-execution whole-cycle audit before the overseer seals.**

## Phase reference

- ROADMAP phase: **Autonomous content generation + retroactive oversight** (NS-5) — slice **F1**.
- Fully closes the phase? **Yes** — F1 is the last slice; on its seal, all 14 (A1→F1) are merged.

## What was built

- **`app/domain/bootstrap.py`** — `BOOTSTRAP_TASK_NAME="pill_bootstrap"`; `enqueue_pill_bootstrap(db, *, pill_id)` (a pending `pill_bootstrap` `ProcessingTask`); `bootstrap_pill(db, *, pill_id, http_client=None)` (per-pill: `generate_anchor_pool_for_pill(top_up=True)` + `curate_links_for_pill` self-guarded + audit `pill_generation.bootstrap`); `process_pending_bootstraps(db)` (the drain).
- **`app/domain/publish.py`** — `auto_publish_draft` enqueues the per-pill bootstrap on every publish (live + publish-with-warning). Async — a row insert (publish stays fast, DS14-a); the caller commits.
- **`app/worker.py`** — `pill_generation.bootstrap` off-cron Celery wrapper (NOT in `beat_schedule` → the canonical nine §8.9 crons unchanged).

## What was decided in this PR

- **Pure execution / NORMAL class** — AC-D7 + AC-D23 ratified with the bootstrap-on-publish reframe (AC-D23 PR-A; AC-D7 PR-C); empty anchor diff. Reuse-only, no new model/migration. The detail §14.3 "blocks F1 execution" was the stale pre-ratification lean — the ratified anchors govern (verify-before-write).
- **Async = `ProcessingTask`-enqueue + Celery-drain** (not `.delay()`) — the codebase's established async pattern (`pill_proposal`/`pill_generation` enqueue rows; no `.delay()` precedent), keeping the domain layer celery-free. *Flagged for review.*
- **Unconditional `curate_links_for_pill`** — it self-guards non-safety pills (no-op inside the primitive), so the caller stays simple (#106 M-a).
- **Every published pill bootstraps** — both live and publish-with-warning; the retained refiner approve path publishes through the same gate and now also bootstraps.

## Drift flags raised and how they were resolved

- **Verify-before-write (no drift):** detail §14.3 "AC-D7/AC-D23 body change blocks F1 execution" vs the ratified anchors on main — resolved in favour of the ratified anchors (pure execution), the recurring detail-vs-amendment-chain lesson.
- One design call flagged for the reviewers: the `ProcessingTask`-enqueue + drain-wrapper async pattern (vs `.delay()`); the wrapper's dispatch trigger is symmetric with the autonomous generation→publish drain.

## Open questions deferred to a later phase

- The dispatch/trigger of the off-cron `pill_generation.bootstrap` wrapper (and symmetrically the autonomous generation→publish drain) is a deployment/worker concern, not wired here.
- The admin **FE** for the oversight surface (FE-10) remains deferred (gated on the AC-CD26 backend, now complete).

## Build state vs spec

- Complete: the bootstrap-on-publish reframe (AC-D7/AC-D23) — per-pill incremental bootstrap on auto-publish, reuse-only.
- With F1, the **entire A1→F1 workstream is implemented**.

## Test coverage and CI results

- `tests/unit/test_p14_bootstrap_on_publish.py` (6) — enqueue-not-inline, primitives+audit, `top_up` idempotency, safety self-guard, drain, refiner-still-publishes.
- `tests/unit/test_p11_celery_wrappers.py` — `pill_bootstrap_task` wrapper smoke.
- **1067 unit+integration pass**; ruff (0.6.9 CI-parity) / format / `mypy app` / structure-gate / unpinned clean; anchor diff empty.

## Post-merge validation considerations

- No migration. Re-verify: `python -m pytest tests/unit/test_p14_bootstrap_on_publish.py -q`.
- Confirm a published pill's `pill_bootstrap` task is drained by the worker and its anchor pool + safety links populate (the wrapper commits — the D1-D2 caller-commits lesson applied).

## Anything a fresh Claude Code session needs to pick up cleanly

- **This is the final slice.** On its seal (3 sign-offs + three-layer green + the end-of-execution whole-cycle audit), the autonomous content-generation workstream (A1→F1) is complete.
- The merge is the overseer's (the executor never seals); F1 gates additionally on the spec-author authorization (received, audit-at-PR mode) + the end-of-execution audit on this PR.
- After F1 merges, the planner's global final-marker pass on the detail-plan (the A-45/OV-39 C1 §7.3 reconciliation + the global planner marker) is a separate `plans/**` concern, not an execution slice.
