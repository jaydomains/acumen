# Handover — PR-078 Slice 6: Celery task-failure surfacing (S3-H)

> Pre-deploy fix workstream, PR 7 of 8 (Slice 6). Authored post-merge per the
> pipelined cadence; rides on the PR-8 (Slice 7, final) branch.

## PR identifier and link

- PR: #78 — `feat(worker): surface Celery task failures via structured logs (Slice 6 / S3-H + WS4)`
- Link: https://github.com/jaydomains/acumen/pull/78
- Author / session: Claude Code (`claude/pre-deploy-pr7-s6-celery-surfacing`)
- Date closed: 2026-05-31 (squash-merged `2ca66a1`)

## Phase reference

- ROADMAP phase: **none** — pre-deploy Slice 6 (WS4 subset, audit-4 S3-H).
  Independent of the locked fix-now ordering. Closes the Celery-failure
  observability gap.
- Fully closes the slice (structured-log scope per D6).

## What was built

- Files added: `tests/unit/test_worker_task_failure.py`.
- Files changed: `app/worker.py` (`task_failure` / `task_retry` signal
  handlers + module logger).
- Summary: the seven §8.9 cron wrappers carry no `autoretry` and write no
  audit row, so a task failing every run was invisible (only downstream
  symptoms showed). Two Celery signal handlers now emit a loud structured log
  (task name, id, exception) on any failure / retry.

## What was decided in this PR

- **Decision D6 — structured-log surfacing ONLY.** No audit-row write (that
  overlaps WS2's transactional CRUD+audit service and defers post-deploy).
- Handlers connect at module import (global `celery.signals`), so they fire
  for any task without per-task wiring. Reads nothing from the DB.
- New anchors: none.

## Drift flags raised and how they were resolved

- None. Additive observability; no spec drift.

## Open questions deferred to a later phase

- **WS2 (post-deploy):** persist task failures as audit rows via the
  transactional CRUD+audit service. Until then, logs are the signal.
- Metrics/alerting hooks (beyond structured logs) are out of pre-deploy
  scope.

## Build state vs spec

- Complete: failure + retry handlers, structured records, test proving
  connection + emission.
- Partial / Stubbed: none.

## Test coverage and CI results

- Test: `tests/unit/test_worker_task_failure.py` — sends both signals; asserts
  the handlers are connected (send only logs if a receiver is wired) and emit
  the expected `ERROR` / `WARNING` records with task name + id.
- CI at merge: **all green** — verify-poll on head `7ff442b` showed 11/11
  `completed/success` (Gitar approved + check-run, `checks` ×3,
  `migration-chain` ×2, `docker-build` ×2, `e2e` ×2), `mergeable_state:
  clean`.
- Manual: local `structure_gate` + `ruff` + `mypy app` (62 clean) +
  `pytest -q --ignore=tests/e2e` (898), incl. the existing
  `test_p11_celery_wrappers` / `test_p11_beat_schedule` unaffected.

## Post-merge validation considerations

- Container-baked without source bind-mount? **Yes** — `app/worker.py` runs
  in `acumen-worker` / `acumen-beat`. Local re-validation requires
  `docker compose build --no-cache acumen-worker acumen-beat`.
- Re-verify: `pytest -q tests/unit/test_worker_task_failure.py`; or trigger a
  failing task and confirm the `acumen.worker` ERROR log fires.

## Anything a fresh Claude Code session needs to pick up cleanly

- The signal handlers are global (connect at `app.worker` import). A worker
  process imports `app.worker`, so they're live wherever Celery runs.
- When WS2 lands the audit service, the `_on_task_failure` handler is the
  natural place to add the audit-row write (the log line stays).
- Recommended next action: **PR 8 / Slice 7 (deploy hygiene)** — the final
  slice, this branch.
