# PR Handover: N4 — testee assignments endpoint + dashboard rewire (PR-067)

<!--
  Fill every section. Keep prose tight and factual. This document is
  the contract for the next session: what shipped, what was decided,
  what drifted, what remains. Cite file:line and AC/CD anchors.
-->

## 1. PR identifier and link

- **Title:** N4: testee assignments endpoint + dashboard rewire
- **Number:** #67 — https://github.com/jaydomains/acumen/pull/67
- **Branch:** `claude/n4-testee-assignments-Gx1GZ` → `main`
- **Merge:** squash-merge (commit recorded on merge).
- **Slices (one PR):** s1 backend (`150060c`), s2 frontend (`b67e7c3`)
  + s2 fixup (`a31c4f8` — shipped the wired card; the s2 commit had
  accidentally committed the old placeholder card), s3 E2E, s4 handover.

## 2. Phase reference

Not a phase — **N4** is a v1.x backlog item carried from the FE-8
handover (`handovers/PR-062-fe8-admin-authoring.md:266-273`): no
`GET /v1/me/assignments` endpoint existed, so the FE-3 "Assigned to you"
card rendered a placeholder and the Playwright round-trip terminated at
the admin picker. No detail fe-spec was authored (1 endpoint + 1 card +
1 test); the existing `AssignmentResponse` contract and the
`/v1/assignments` testee path are the reference (AC-D15 assignee
snapshot, AC-D6 loop mode, AC-D26 mandatory/deadline). FE-3 spec
(`fe-specs/FE-3-content.md`) is amended in-PR (see §4).

## 3. What was built

**Backend**
- `GET /v1/me/assignments` (`app/routers/competency.py`) on the existing
  `/v1/me` router (sibling of `GET /v1/me/competence`). Auth
  `get_privacy_acked_user`; returns `Page[AssignmentResponse]` via
  `assignment_domain.list_assignments(assignee_id=user.id)`
  (`app/domain/assignments.py:219`). Group-vs-direct dedup is already
  enforced at write time in `create_assignment` (AC-D15), so the read
  path is dedup-free.
- Regenerated OpenAPI snapshot `frontend/openapi/schema.json` +
  `frontend/src/types/api.d.ts` (codegen).

**Frontend**
- `useMeAssignments()` + `AssignmentResponse`/`AssignmentsPage` type
  aliases in `frontend/src/lib/queries/me.ts` (reuses the pre-locked
  `meQueryKeys.assignments()`).
- Wired `frontend/src/components/dashboard/AssignmentsCard.tsx`: consumes
  the endpoint, resolves pill names from the testee catalogue
  (`useCataloguePills`/`flattenPills`) with a `Pill {id8}…` fallback,
  renders loading/error/empty/rows, All/Mandatory tabs, a token-class
  Mandatory tag (`border-warn`/`text-warn` — no hex). Path-assignment
  rows show a generic "Learning path" label.
- Append-only MSW `meAssignmentsHandler` (+ `setMockMeAssignments`,
  `setMeAssignmentsStatus`, `resetMockMeAssignments`, getter) in
  `frontend/src/mocks/handlers.ts`.

**Tests**
- Backend: `tests/integration/test_p4_me_assignments.py` — direct
  assignee, system-group + ad-hoc-group membership, direct+group dedup
  (appears once), cross-testee scope isolation, empty list, auth gate.
- Frontend: rewrote `tests/components/dashboard/AssignmentsCard.test.tsx`
  (rows, fallback, mandatory filter, no-followups-tab, empty, error);
  updated the now-stale placeholder invariants in `dashboard.test.tsx`,
  `shell-roundtrip.test.tsx`, `auth-roundtrip.test.tsx`.
- E2E: extended `frontend/e2e/admin-authoring-roundtrip.spec.ts` with a
  testee-context test that navigates to the dashboard and asserts the
  assigned pill renders (resolved name + Mandatory tag).

## 4. What was decided in this PR

1. **Reuse `Page[AssignmentResponse]`; no new DTO** (serves AC-D15 /
   AC-D6 / AC-D26). Lifting the admin projection keeps FE wiring trivial;
   `engagement_status` (P4 Slice 3, derived) and name enrichment are out
   of scope.
2. **Drop the "Follow-ups" tab in v1.** Follow-ups are an *attempt*-level
   concept (`app/domain/loop.py` creates follow-up attempts, not
   assignments); `AssignmentResponse` has no field to filter on. Tabs are
   now All / Mandatory.
3. **Card name resolution via the testee catalogue, pill-only.**
   `/v1/learning-paths` is admin-only (`app/routers/paths.py:30`), so
   testees can resolve pill names (`/v1/catalogue/pills`) but not path
   names. Unresolved pill_ids fall back to `Pill {id8}…` (never blank).

**FE-3 spec absorption (decision 2C, done in-PR).** Per the workstream
directive, the FE-3 spec edit landed inside this N4 PR rather than as a
separate spec-clarification PR — N4 is a v1.x backlog item, not a
phase-opening drift surface, so the lighter-weight in-PR absorption is
appropriate. Edits to `fe-specs/FE-3-content.md`: removed Follow-ups from
the segmented control, `AssignmentRow`, the tab type, the Gherkin
scenario, and the test list; flipped the `/v1/me/assignments` §H drift
rows to **SHIPPED (N4)**; added the v1.x tracker (below).

## 5. Drift flags raised and how they were resolved

- **`meQueryKeys.assignments()` already existed** (`lib/queries/me.ts`,
  pre-locked at FE-3). Expected to add it; found it present → reused, not
  re-added.
- **`GET /v1/assignments` already served testees their own assignments**
  (`app/routers/assignments.py:97-100`, the `else` branch). The new
  `/v1/me/assignments` re-exposes the same capability on the canonical
  `/v1/me/*` surface and reuses the same domain function — additive, not
  a reconciliation. Surfaced rather than silently collapsing the two.
- **`/v1/learning-paths` is admin-only.** Resolved by rendering pill
  names only; path rows get a generic label (deferred enrichment, §6).
- **Hero fires `GET /v1/me/competence`.** `TesteeDashboard`
  (`src/components/dashboard/TesteeDashboard.tsx:9`) calls
  `useMeCompetence()` live; the dashboard's older "no competence request
  fires" comment is stale (the Vitest suite stays green because the MSW
  `meCompetenceHandler` resolves it). Surfaced here; the E2E testee leg
  mocks `/v1/me/competence` so navigation settles.

## 6. Open questions deferred to a later phase

**v1.x tracker (recorded in `fe-specs/FE-3-content.md` §H item 2):**
- Add `pill_name` + `learning_path_name` to the `/v1/me/assignments`
  `AssignmentResponse` so name resolution no longer depends on catalogue
  pagination (today only the first catalogue page is consulted;
  unresolved → `Pill {id8}…`).
- Restore the **Follow-ups** tab when attempt-level follow-up data is
  exposed (`parent_assignment_id` on `Assignment` OR a `/v1/me/follow-ups`
  endpoint).
- `engagement_status` per assignment (AC-D26, P4 Slice 3 derivation)
  remains off the testee response.

## 7. Build state vs spec

- **Complete:** testee assignment list endpoint + dashboard card + MSW +
  unit/integration/E2E coverage; FE-3 spec aligned with shipped behaviour.
- **Intentionally omitted (v1.x):** name enrichment on the wire,
  Follow-ups tab, `engagement_status`, learning-path name resolution.
- **Stubbed:** none. The card is fully wired; the placeholder is gone.

## 8. Test coverage and CI results

- **Backend:** `tests/integration/test_p4_me_assignments.py` (7 cases)
  green; full `pytest --ignore=tests/e2e` green; pinned `ruff==0.6.9`
  check + format clean repo-wide. (Note: a newer local ruff 0.15.8 flags
  pre-existing files — ignore; CI pins 0.6.9.)
- **Frontend:** full Vitest suite green (934 tests); `pnpm lint`,
  `format:check`, `typecheck`, `codegen:check` all clean.
- **E2E:** `admin-authoring-roundtrip` — both tests pass locally
  (Chromium, real `next dev`).
- **CI:** poll the `frontend` + `ci` workflows to green on the final
  commit before squash-merge (subscription pushes failures only — use the
  explicit poll loop, locked at FE-9).

## 9. Anything a fresh Claude Code session needs to pick up cleanly

- **Codegen is the contract seam.** Any backend schema change must
  regenerate `frontend/openapi/schema.json` (via `app.openapi()`, e.g.
  `python -c "import json; from app.main import app;
  print(json.dumps(app.openapi()))"`) **and** `pnpm codegen`, or
  `codegen:check` (CI gate) goes red. Backend deps were not pre-installed
  in this session — `uv venv` + system `python3` (which has fastapi) ran
  the suite; `uvx ruff@0.6.9` ran the pinned linter.
- **E2E has no shared backend.** MSW is disabled under Playwright; every
  call is `page.route`-mocked. A testee dashboard navigation needs
  `/api/config`, `/v1/auth/refresh`, `/v1/auth/me`, `/v1/me/assignments`,
  `/v1/catalogue/pills`, `/v1/attempts`, and `/v1/me/competence` mocked.
- **MSW handlers are append-only** and `meAssignmentsHandler` inlines its
  `components[...]` types via `import("@/lib/api/types")` (the file's
  top-level import already exposes `components`, so either form works).
- **The FE-3 spec now matches shipped behaviour** — no separate
  spec-clarification PR is pending for N4.
- Next backlog candidate: the v1.x name-enrichment + Follow-ups
  restoration in §6.
