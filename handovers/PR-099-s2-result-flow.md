# Handover — PR-099 (Slice 2 · WS-B result-flow silent failures)

## PR identifier and link

- PR: #99 — "Slice 2 — WS-B: honest result-flow failure states (V4 + V5)"
- Link: https://github.com/jaydomains/acumen/pull/99
- Author / session: Claude Code — post-audit pre-deploy fix workstream
- Date closed: 2026-06-06 (squash-merged `7f4f674`)

## Phase reference

- ROADMAP phase closed by this PR: none (audit-driven fix workstream, plan `621a549`/#94, Slice 2 of 4)
- Does this PR fully close the phase? Closes the two WS-B pre-deploy findings (V4, V5).

## What was built

- Files changed:
  - `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/result/page.tsx` — V4 `throwOnError` predicate + exported `resultErrorIsInitial`.
  - `frontend/src/components/attempt/GradingOverlay.tsx` — V5 distinct error affordance (`data-state="error"`); keeps polling through errors so a transient blip self-heals; clean-restart "Try again".
  - `frontend/tests/pages/result-page.test.tsx`, `frontend/tests/components/attempt/GradingOverlay.test.tsx` — tests.
- Summary: The testee result page no longer renders header-plus-blank on a fetch error (V4) — an initial-fetch failure throws into the already-correct `result/error.tsx` boundary via the predicate `throwOnError: (_err, q) => q.state.data === undefined`, while a transient mid-poll error on a rendered `review_pending` page recovers next interval. GradingOverlay no longer spins forever on a result-poll error (V5) — it escapes promptly to a distinct error affordance driven off `isError` and keeps polling so a one-off 5xx self-heals.

## What was decided in this PR

- Per plan D4/F3/F4: predicate (not literal) `throwOnError`; distinct error affordance (not the slow-grading `pollExhausted` card).
- Gitar round 1 (2 findings, both addressed in-commit): (1) keep polling through errors so a transient blip auto-recovers — aligns with the plan's own "errorUpdatedAt advances every interval" wording; (2) the "Try again" handler now resets `phaseIdx`/`pollCount`/`pollExhausted` for a clean restart.
- New anchors introduced: none. Existing anchors depended on: AC-CD21 (TanStack Query), AC-D19 (review states).

## Drift flags raised and how they were resolved

- None. (G4 test-harness caveat — the bare `QueryClientProvider` harness doesn't mount the App-Router boundary natively — was handled with a test `ErrorBoundary` shim + a config-level predicate assertion, per plan D4.)

## Open questions deferred to a later phase

- None specific to this slice. Workstream carry-forward backlog is in PR-102's handover.

## Build state vs spec

- Complete: V4 + V5 closed; matches audit synthesis + plan Slice 2.
- Partial / Stubbed: none.

## Test coverage and CI results

- Tests added/changed: `result-page.test.tsx` (predicate-return assertion + initial-500 boundary case), `GradingOverlay.test.tsx` (persistent-500 prompt escape + transient-blip auto-recovery).
- CI result at merge: three-layer green — all checks `success` (checks, docker-build, migration-chain, e2e ×2, Gitar), `mergeable_state: clean`, Gitar approved (2/2 resolved). Verified via fresh `get_check_runs` poll before merge.
- Manual verification: local `pnpm lint` / `format:check` / `typecheck` / `test --run` (975) / `build` all green.

## Post-merge validation considerations

- Frontend service bakes its image with no source bind-mount — post-merge local validation needs `docker compose build --no-cache acumen-frontend` before re-running.
- Re-verify: `cd frontend && pnpm test --run tests/pages/result-page.test.tsx tests/components/attempt/GradingOverlay.test.tsx`.

## Anything a fresh Claude Code session needs to pick up cleanly

- The result query polls while `review_pending`; any future change to `throwOnError` must stay a predicate (literal `true` would nuke a valid pending page on a transient poll error).
- GradingOverlay intentionally keeps polling on error (auto-recovery); the escape is a render-branch on `isError`, not a `refetchInterval` stop.
