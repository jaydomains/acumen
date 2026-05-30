# PR Handover: N2 — group members endpoint + frontend rewire (PR-068)

<!--
  Fill every section. Keep prose tight and factual. This document is
  the contract for the next session: what shipped, what was decided,
  what drifted, what remains. Cite file:line and AC/CD anchors.
-->

## 1. PR identifier and link

- **Title:** N2: group members endpoint + frontend rewire
- **Number:** #68 — https://github.com/jaydomains/acumen/pull/68
- **Branch:** `claude/trusting-cray-BxvZ6` → `main`
- **Merge:** squash-merge (after explicit poll-to-green).
- **Slices (one PR):** s1 backend (`716d338`), s2 frontend (`a16135a`),
  s3 spec + handover (this commit).

## 2. Phase reference

Not a phase — **N2** is the persistent Gitar-acknowledged v1.x backlog
item carried from FE-7/FE-8 (`handovers/PR-062-fe8-admin-authoring.md`
§6 Gitar #6 + the N2 tracker): no `GET /v1/groups/{group_id}/members`
endpoint existed, so `group-detail.tsx` derived its member list
client-side from `GroupResponse.member_ids[]` joined against an **eager**
`useAdminUsers()` fetch of the whole directory (N+1 by design). No detail
fe-spec was authored (1 endpoint + 1 hook + 1 component rewire + 1 test
surface); the existing `UserResponse` / `GroupResponse` contracts and the
`/v1/users` admin endpoint are the reference convention. FE-8 §B.3.3 is
corrected in-PR (see §4/§5).

## 3. What was built

**Backend**
- `GET /v1/groups/{group_id}/members` (`app/routers/groups.py`) on the
  existing `/v1/groups` router. Auth `_require_admin` (`require_role(
  ROLE_ADMINISTRATOR)`); returns `Page[UserResponse]`. Reuses `_load`
  (404 guard) which already resolves `member_ids` via
  `catalogue.get_group`, so the route stays thin (CODE_SPEC §1).
- `users.list_group_members` (`app/domain/users.py`) — focused helper:
  filters `_tenant_users` by the supplied member-id set and paginates via
  the catalogue `paginate` helper (mirrors `list_users`).
- Regenerated OpenAPI snapshot `frontend/openapi/schema.json` +
  `frontend/src/types/api.d.ts` (codegen). New GET op references the
  pre-existing `Page_UserResponse_` schema → minimal type churn.

**Frontend**
- `useGroupMembers()` infinite-query hook + `flattenGroupMembers` +
  `GroupMembersPage`/`GroupMember` type aliases in
  `frontend/src/lib/queries/admin-groups.ts`. Keyed off the pre-locked
  `adminKeys.groups.members(groupId)` (`admin-keys.ts:86` — already
  existed, reused not re-added). Member add/remove mutations already
  invalidate `groups.detail(groupId)`, which prefix-matches the members
  key, so the list refreshes automatically — no mutation change needed.
- Rewired `group-detail.tsx`: members list sourced from `useGroupMembers`
  (rows are `UserResponse` directly; dropped the "member outside loaded
  users" fallback). The eager `useAdminUsers()` directory fetch was
  relocated into `MemberPickerModal` so it loads **lazily** on picker
  open. Added members loading/error states + a picker loading state.
- Append-only MSW `adminGroupMembersListHandler` in
  `frontend/src/mocks/handlers.ts` (resolves `member_ids` against the
  mock users directory, cursor-paginates, 404 on unknown group).

**Tests**
- Backend: `tests/integration/test_p3_paths_groups.py` (+5 cases) —
  direct members (paginated), system-group members read (200, not 403),
  empty group, unknown group 404, non-admin 403 auth gate.
- Frontend: `tests/pages/admin-group-detail.test.tsx` — new test asserts
  members load via the batched endpoint with **zero** eager `/v1/users`
  fetch (picker opens it lazily); picker-dependent tests now wait for the
  lazily-loaded candidate rows.

## 4. What was decided in this PR

1. **Return `Page[UserResponse]` (decision 1A), not a new
   `GroupMemberResponse`.** Mirrors `/v1/users` exactly and reuses the
   existing `Page_UserResponse_` schema (near-zero type churn). FE wiring
   stays trivial. `joined_at`/`last_active_at` are *not* on any model, so
   the "Last active" column keeps its em-dash placeholder. (CODE_SPEC §1
   thin router / domain layer, §5 cursor pagination, §6 admin auth.)
2. **Relocate `useAdminUsers()` into `MemberPickerModal`, lazy (decision
   2A).** The picker genuinely needs the full directory to pick
   candidates, so the hook can't be removed outright; making it lazy
   (picker-only) closes the eager-fetch finding while keeping add-member
   functional.
3. **No server-side `q` param.** Member search stays client-side over the
   loaded page, consistent with the rest of the admin suite (which also
   filters cached pages client-side; cf. N1).

**FE-8 spec absorption (done in-PR).** Per the standing N4 directive, the
FE-8 §B.3 spec edit landed inside this N2 PR rather than a separate
spec-clarification PR — N2 is a v1.x backlog item, not a phase-opening
surface. Edits to `fe-specs/FE-8-admin-identity.md`: corrected the §B.3.3
API-table members row to the real `Page_UserResponse_` contract (marked
**Built (N2)**), corrected the POST row from the fictional bulk
`AddGroupMemberRequest` to the real single-user `GroupMemberRequest`, and
updated the `MembersTable` column note (Joined column dropped; Last active
is a placeholder).

## 5. Drift flags raised and how they were resolved

- **D1 — FE-8 §B.3.3 described a phantom endpoint.** The spec claimed
  `GET /v1/groups/{group_id}/members` already existed at
  `schema.json:6412` returning `Page_GroupMemberResponse_` with embedded
  `name`/`email`/`joined_at`/`last_active_at` and a `q` param. All
  fictional: the generated schema had only POST+DELETE on that path, no
  `GroupMemberResponse` schema existed, line 6412 was unrelated, and no
  `last_active_at` lives on any model. **Surfaced before coding**;
  resolved by building the real `Page[UserResponse]` contract and
  correcting §B.3.3 (not silently reconciled).
- **D2 — `useAdminUsers` could not be dropped outright.** The picker
  needs the directory. Resolved via decision 2A (lazy, picker-only).
- **D3 — client-side member filter only covers loaded pages** against a
  paginated endpoint — but the rest of the app already loads only the
  first page of users, so first-page client-side filter is the
  *consistent* behaviour. Kept; tracked as the N1 family (no new server
  `q`).
- **D4 — `fetch-group-members.ts` / `members-table.tsx` don't exist.**
  The task named them, but the logic was inline in `group-detail.tsx` —
  nothing to delete. `adminKeys.groups.members` already existed and was
  reused.

## 6. Open questions deferred to a later phase

- **Member metadata on the wire.** When `joined_at` (available today as
  `GroupMember.created_at`) and/or `last_active_at` are exposed, restore
  the Joined column and populate Last active. Until then the column is an
  em-dash placeholder. Would warrant a leaner `GroupMemberResponse` DTO.
- **System-group rule resolution.** System groups currently resolve
  membership from the stored `group_member` join table only (empty for
  the seeded system groups until assignment-targeting writes rows in P4).
  The endpoint returns whatever is stored; rule-derived membership is a
  P4 concern.
- **Server-side member search (`q`)** + cross-page pagination UI — same
  family as N1 (client-side filter over the first cached page).

## 7. Build state vs spec

- **Complete:** admin-gated batched members endpoint + domain helper +
  `useGroupMembers` hook + group-detail rewire + lazy picker + MSW +
  unit/integration coverage; FE-8 §B.3.3 aligned with shipped behaviour;
  Gitar #6 / N2 trackers closed in the PR-062 handover.
- **Intentionally omitted (v1.x):** `joined_at`/`last_active_at` on the
  wire, server-side `q`, leaner member DTO.
- **Stubbed:** none. The view is fully wired; the N+1 derivation is gone.

## 8. Test coverage and CI results

- **Backend:** `tests/integration/test_p3_paths_groups.py` (10 cases, 5
  new) green; full `pytest --ignore=tests/e2e` green (873 passed);
  `scripts/structure_gate.py` OK; `ruff check` + `ruff format --check`
  clean repo-wide; `mypy app` clean (62 files).
- **Frontend:** full Vitest suite green (935 tests); `pnpm lint`,
  `format:check`, `typecheck`, `codegen:check`, and `pnpm build` all
  clean.
- **CI:** the `frontend` + `ci` workflows are polled to green on the
  final commit **before** squash-merge — subscription pushes failures
  only, so green is confirmed via the explicit poll loop (locked at
  FE-9/N4). No "looks green" merge.
- **Manual verification:** the new vitest test exercises the end-to-end
  FE behaviour (batched members fetch + zero eager `/v1/users` on load +
  lazy picker fetch on open).

## 9. Anything a fresh Claude Code session needs to pick up cleanly

- **Codegen is the contract seam.** Any backend schema change must
  regenerate `frontend/openapi/schema.json` (dump `app.main.app.openapi()`
  with `indent=2`, **no** trailing newline — `openapi/schema.json` is in
  `frontend/.prettierignore`, so match its existing format) **and** run
  `pnpm codegen`, or the `codegen:check` CI gate goes red. Backend deps
  were not pre-installed this session: `pip install --ignore-installed
  PyJWT -r requirements.txt -r requirements-dev.txt` (the system PyJWT is
  Debian-owned and blocks a clean uninstall); `pytest`/`ruff`/`mypy` then
  run from the main `python`.
- **MSW handlers are append-only.** `adminGroupMembersListHandler` was
  inserted into the existing `adminGroupsHandlers` array; the
  `/v1/groups/:group_id/members` path has an extra segment so it does not
  collide with the `:group_id` detail handler (ordering is irrelevant).
- **Members refresh rides group-detail invalidation.** Member add/remove
  mutations invalidate `adminKeys.groups.detail(groupId)`, which
  prefix-matches `groups.members(groupId)` — do not add a separate
  members invalidation.
- Next backlog candidate: the wire-metadata enrichment in §6 (restores
  Joined / Last active) or the N1 server-side search family.
