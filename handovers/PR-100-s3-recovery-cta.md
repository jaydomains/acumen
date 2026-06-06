# Handover — PR-100 (Slice 3 · WS-C admin recovery loop)

## PR identifier and link

- PR: #100 — "Slice 3 — WS-C: role-aware recovery CTA on 404/403/500 (V1)"
- Link: https://github.com/jaydomains/acumen/pull/100
- Author / session: Claude Code — post-audit pre-deploy fix workstream
- Date closed: 2026-06-06 (squash-merged `1c10b7e`)

## Phase reference

- ROADMAP phase closed by this PR: none (fix workstream, plan `621a549`/#94, Slice 3 of 4)
- Does this PR fully close the phase? Closes the V1 WS-C pre-deploy finding.

## What was built

- Files added: `frontend/src/components/shell/DashboardLink.tsx`, `frontend/tests/components/shell/recovery-cta.test.tsx`.
- Files changed: `frontend/src/lib/auth/guards.tsx` (export `dashboardPathFor`), `frontend/src/app/error.tsx`, `frontend/src/app/403/page.tsx`, `frontend/src/app/not-found.tsx`, `frontend/tests/pages/403.test.tsx`, `frontend/tests/pages/not-found.test.tsx`. Also lands the trailing `handovers/PR-098-s1-auth-activation-path.md`.
- Summary: The root 500/404/403 recovery surfaces routed "Go to dashboard" to `/` (testee-gated), so an admin bounced `/`→`/403`→`/`. `dashboardPathFor` is now exported (admins→`/ops`, testees→`/`); a role-aware client `DashboardLink` is used by `403/page.tsx` and the server `not-found.tsx` (which can't call `useAuth` itself); `error.tsx` pushes the role-aware target.

## What was decided in this PR

- Per plan G5: export the existing module-local helper; bridge the server `not-found.tsx` via a tiny client component. `result/error.tsx` left untouched (testee-scoped boundary → `/` is correct there, plan §6).
- Gitar: approved, no findings.
- New anchors: none. Existing anchors depended on: AC-CD20 (routing + role guards).

## Drift flags raised and how they were resolved

- None. (Existing `403.test.tsx` / `not-found.test.tsx` started rendering `DashboardLink` → `useAuth`; updated both with a default testee `useAuth` mock in the same commit — coupled-test update, not spec drift.)

## Open questions deferred to a later phase

- None specific to this slice. See PR-102 handover for the workstream carry-forward backlog.

## Build state vs spec

- Complete: V1 closed. Partial / Stubbed: none.

## Test coverage and CI results

- Tests: new `recovery-cta.test.tsx` (admin→`/ops`, testee→`/`, null→`/` for each surface); updated `403`/`not-found` page tests.
- CI result at merge: three-layer green — all checks `success` (checks, docker-build, migration-chain, e2e ×2, Gitar), `mergeable_state: clean`, Gitar approved. Verified via fresh `get_check_runs` poll before merge.
- Manual verification: local `pnpm lint` / `format:check` / `typecheck` / `test --run` (981) / `build` all green.

## Post-merge validation considerations

- Frontend image bakes without a source bind-mount — `docker compose build --no-cache acumen-frontend` before post-merge local re-verification.
- Re-verify: `cd frontend && pnpm test --run tests/components/shell/recovery-cta.test.tsx tests/pages/403.test.tsx tests/pages/not-found.test.tsx`.

## Anything a fresh Claude Code session needs to pick up cleanly

- `not-found.tsx` is a server component — keep the role-aware CTA in the client `DashboardLink`; calling `useAuth()` directly there will not compile.
- `dashboardPathFor` is now the single source for role→home routing; reuse it rather than re-hardcoding `/ops` / `/`.
