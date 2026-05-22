# tests/e2e/

Empty in v1. This directory is preserved as a seam for the conditional
post-build phase noted at `ROADMAP.md:200`:

> P12 (hardening / full E2E) folds into P11's done-when, or becomes a
> separate P12 (hardening / full E2E).

P11 closed (PR-024) without a separate live E2E harness. The v1
done-when criteria across every phase are discharged at integration
level — every cron, every domain function, every router endpoint, and
every cross-component flow has integration coverage under
`tests/integration/`. The AC-CD15 zero-DB / zero-network harness means
those integration tests run without a live PostgreSQL or live HTTP
provider; they cover behaviour, not deployment shape.

## Where v1 covers what an E2E harness would cover

The P11 risk note at `ROADMAP.md:198` — "bootstrap idempotency: assert
re-run is a no-op in E2E" — is discharged by
`tests/integration/test_p11_bootstrap_idempotent.py`. In particular
`test_bootstrap_re_run_is_counter_zero_no_op` asserts the AC-CD7
contract that a re-run on an already-populated deployment surfaces
all-zero counters across all four bootstrap steps (anchor top-up,
safety-link curation, Drive ingest, beat-schedule registration).
Other end-to-end-style integration coverage:

- `tests/integration/test_p6_grade_review_*.py` — submit-to-result
  with the cross-family review pass and the reconcile cron.
- `tests/integration/test_p7_loop.py` — failed-attempt → weakness →
  material → follow-up Attempt across the autonomous and admin-
  reviewed branches.
- `tests/integration/test_p11_*.py` — bootstrap, beat schedule, cost
  dashboard, budget alerts, engagement sweep, comms.

## Why the directory is preserved rather than deleted

The future P12 phase — if scheduled — is the intended home for any
browser-driven / multi-service / live-provider E2E coverage that the
zero-DB harness cannot reach. Deleting the directory now would require
recreating it under P12; keeping it costs nothing and documents the
seam. The decision is informational; either option is defensible.
