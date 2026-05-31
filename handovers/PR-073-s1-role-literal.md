# Handover — PR-073 Slice 1: admin/administrator role-literal reconciliation

> Pre-deploy fix workstream, PR 2 of 8 (Slice 1 / A3-L1). Authored
> post-merge per the pipelined cadence; committed on the PR-3 (Slice 2)
> branch because PR-073 was already squash-merged when this was written.

## PR identifier and link

- PR: #73 — `fix(fe-8): reconcile admin/administrator role literal across the wire seam (Slice 1 / A3-L1)`
- Link: https://github.com/jaydomains/acumen/pull/73
- Author / session: Claude Code (`claude/pre-deploy-pr2-s1-role-literal`)
- Date closed: 2026-05-31 (squash-merged `cf115e6`)

## Phase reference

- ROADMAP phase closed by this PR: **none** — pre-deploy fix workstream
  Slice 1 (the first locked fix-now item, audit-5 §4 #1). FE-8 closed at
  PR-062 (#65); this patches that surface.
- Does this PR fully close the phase? **N/A** (workstream slice). It fully
  closes fix-now item A3-L1 + its X2-#3 test pairing.

## What was built

- Files added:
  - `frontend/src/lib/auth/role.ts` — the bidirectional role seam
    (`fromWireRole` / `toWireRole`).
  - `frontend/tests/lib/identity/role.test.ts` — seam unit tests.
  - `frontend/tests/lib/identity/role-context.test.tsx` — read-side proof.
- Files changed:
  - `frontend/src/lib/auth/context.tsx` — `narrowRole` delegates to
    `fromWireRole`.
  - `frontend/src/app/(authed)/(admin)/admin/users/_components/users-list.tsx`
    — list display, create body, edit-modal seed, and edit dirty-compare/send
    all route through the seam.
  - `frontend/src/lib/queries/admin-users.ts` — `?role=` filter maps to the
    wire literal.
  - `frontend/src/mocks/handlers.ts` — seed admin emits `"administrator"`;
    create handler validates against `{"administrator","testee"}`.
  - `frontend/tests/pages/admin-users-list.test.tsx` — existing testee→admin
    edit now asserts the wire `"administrator"`; new no-op-edit-on-admin case.
- Summary: the backend canon is `ROLE_ADMINISTRATOR = "administrator"`
  (`app/permissions.py:65`) and every wire role field is a bare `string`
  (no enum), so tsc never caught that the FE cohort was self-consistent on
  the wrong `"admin"` literal — narrowing a real admin to `null` (→ `/403`
  total lockout, read side) and posting `"admin"` on create/edit/filter
  (→ `422 invalid_role`, write side). A single seam now funnels both
  directions and the MSW cohort speaks the real enum.

## What was decided in this PR

- **Decision D1 (spec-author ruling) implemented:** backend
  `"administrator"` stays canonical; the FE adds a bidirectional mapping
  seam (`fromWireRole`/`toWireRole`) rather than remapping at the schema
  boundary — WS1-aligned (the seam is the one place a future role `enum`
  subsumes). The X2-#3 pairing includes the auditor's required
  edit-modal no-op case (a no-op save on an `"administrator"` user sends no
  `role` and does not 422).
- New anchors introduced: **none**. No SPEC/DECISIONS/CODE_SPEC edits.
- Existing anchors depended on: AC-CD5 (auth seam), AC-CD19 (FE stack),
  AC-CD20 (route guards), AC-CD21 (query layer). The seam is the
  pre-deploy patch the post-deploy **WS1** role enum will generalise.

## Drift flags raised and how they were resolved

- **The MSW cohort encoded the wrong literal** (`role: "admin"` seed +
  create-handler accepting `"admin"`). Resolved by realigning the mock to
  the backend's real `VALID_ROLES` (`{"administrator","testee"}`) — this is
  the "MSW mocks encode the FE's own wrong literals" pattern audit-5 §2(c)
  named. The pre-existing `admin-users-list` edit test asserted the buggy
  `patchBody.role === "admin"`; updated to `"administrator"` (it was
  asserting the bug).
- No spec drift surfaced (D1 already ruled; direction forced by the
  backend canon).

## Open questions deferred to a later phase

- **WS1 (post-deploy):** replace the bare-string wire role with a real
  `enum.Enum` and subsume this seam. The seam is intentionally the single
  funnel so that conversion is a one-file change.
- `fromWireRole` keeps **transitional acceptance** of the UI literal
  `"admin"` on the read side; WS1 can drop that once the wire is enum-typed
  end to end.

## Build state vs spec

- Complete: both read and write directions seamed; MSW aligned to the real
  enum; X2-#3 pairing (unit seam + read-side guard proof + edit-modal no-op).
- Partial: none.
- Stubbed: none.

## Test coverage and CI results

- Tests added/changed: `role.test.ts` (8), `role-context.test.tsx` (1),
  `admin-users-list.test.tsx` (updated 1 + added 1).
- Coverage: frontend suite 132 files / **946** tests green.
- CI result at merge: **all green** — fresh `get_check_runs` verify-poll
  showed 11/11 check runs `completed/success` (Gitar review approved +
  Gitar check-run success, `checks`, `migration-chain`, `docker-build`,
  `e2e`), zero `in_progress`, `mergeable_state: clean`.
- Manual verification: full local gate before push — `pnpm codegen:check`
  (no schema drift), `lint`, `format:check`, `typecheck`, `test --run`
  (946), `build`.

## Post-merge validation considerations

- Container-baked without source bind-mount? **Yes** — the `frontend`
  service bakes its image (no `node_modules` bind-mount). Post-merge local
  validation requires `docker compose build --no-cache frontend` before
  re-running (the stale-image trap, `SESSION_START.md`).
- Re-verify command:
  `cd frontend && pnpm install && pnpm test --run tests/lib/identity tests/pages/admin-users-list.test.tsx`.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading beyond `SESSION_START.md`: the workstream plan §G1 +
  Decision D1; `frontend/src/lib/auth/role.ts` (the seam).
- Known traps: **always route role across the wire through the seam** — a
  raw `role === "admin"` against a wire value is the bug class this slice
  closed. The MSW seed admin is now `"administrator"`; any new users-mock
  or role assertion must use the wire literal, and `fromWireRole` for
  display/narrowing.
- Recommended next action: **PR 3 / Slice 2 (startup config validation)** —
  this branch (already pushed). Slices proceed 1→2→3→4→5; 5 is spec-gated
  on PR-072 (now merged).
