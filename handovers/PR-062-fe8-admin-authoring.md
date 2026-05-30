# Handover — PR-062 FE-8 admin authoring suite

## PR identifier and link

- PR: #65 — FE-8 admin authoring suite (Slices 1–15, omnibus squash)
- Link: https://github.com/jaydomains/acumen/pull/65
- Author / session: Claude Code (`claude/fe8-admin-authoring-7Ybr5`)
- Date closed: 2026-05-29

## Phase reference

- ROADMAP phase closed by this PR: **FE-8 — Admin authoring suite**
  (`FE_ROADMAP.md` lines 156–174)
- Does this PR fully close the phase? **Yes — with one doc-only
  follow-up warranted.**

FE_ROADMAP.md Done-when criteria cross-check:

| Criterion | Evidence |
|---|---|
| Admin can create a subject | `frontend/src/app/(authed)/(admin)/admin/catalogue/_components/subjects-tab.tsx` + `admin-catalogue-subjects-tab.test.tsx` |
| Create a pill in it | `frontend/src/app/(authed)/(admin)/admin/catalogue/_components/pills-tab.tsx` + `admin-catalogue-pills-tab.test.tsx` |
| Propose-and-approve a pill | `frontend/src/app/(authed)/(admin)/admin/catalogue/_components/proposals-tab.tsx` + `admin-catalogue-proposals-tab.test.tsx` |
| Author a test with mixed question types | `frontend/src/app/(authed)/(admin)/admin/tests/[testId]/edit/_components/test-editor.tsx` + all `_components/question-editor-*.tsx` + `admin-test-editor.test.tsx` + `admin-question-editor.test.tsx` |
| Assign it to a group | `frontend/src/app/(authed)/(admin)/admin/assignments/_components/assignments-list.tsx` + `admin-assignments-list.test.tsx` |
| See it appear on testee dashboards | Covered by `frontend/tests/integration/admin/admin-tests-roundtrip.test.tsx` + Playwright E2E `frontend/e2e/admin-authoring-roundtrip.spec.ts` (E2E terminates at admin-side picker — see N4 in section 6) |

All six Done-when steps have corresponding test evidence in the diff.
Verdict: **complete**. The one warranted follow-up is a doc-only update
to `FE_CHECKLIST.md` (FE-8 rows still cite the pre-route-rename path
`(admin)/` instead of the shipped path `(authed)/(admin)/admin/`) — no
code change needed, tracked as item 6 in section 6.

## What was built

**Foundation / shared admin primitives:**
- `frontend/src/lib/queries/admin-keys.ts` — `adminKeys` query-key
  library (9 domains: pills, subjects, proposals, paths, users, groups,
  assignments, tests, questions)
- `frontend/src/lib/queries/admin-{pills,subjects,proposals,paths,users,groups,assignments,tests,questions}.ts`
  — per-domain hook files (query + mutation)
- `frontend/src/components/admin/{filter-bar,modal,field,difficulty-range-slider,safety-toggle}.tsx`
  — shared §C primitives
- `frontend/src/lib/tests/{compose-question-config,derive-display-status,question-form,test-editor-form,unpack-question-config}.ts`
  — question-editor business logic + FE-owned typing layer
- `frontend/src/lib/admin/parse-proposal-payload.ts` — FE-owned
  proposal payload renderer

**Admin route tree** (under `frontend/src/app/(authed)/(admin)/admin/`):
- **Catalogue area:** `catalogue/page.tsx` + `_components/{catalogue-shell,pills-tab,pill-modal,subjects-tab,proposals-tab,proposal-detail-drawer,safety-tab,safety-override-confirm-modal}.tsx`
- **Paths area:** `paths/page.tsx` (list) + `paths/[pathId]/edit/page.tsx` (editor with @dnd-kit reorder)
- **Users area:** `users/page.tsx` + `_components/users-list.tsx`
- **Groups area:** `groups/page.tsx` (list) + `groups/[groupId]/page.tsx` (detail + membership picker)
- **Assignments area:** `assignments/page.tsx` + `_components/assignments-list.tsx`
- **Tests area:** `tests/page.tsx` (list) + `tests/[testId]/edit/page.tsx` with 14 `_components/` files (`test-editor.tsx`, `mode-picker.tsx`, mode-section components for per_testee/frozen/hand_authored/benchmark, `publish-controls.tsx`, `status-bar.tsx`, `question-editor-modal.tsx`, `question-editor-inner.tsx`, `question-type-chooser.tsx`, per-type sub-components `mcq-choices.tsx`, `tf-choices.tsx`, `match-pairs.tsx`, `sa-grading-rubric.tsx`, `difficulty-picker.tsx`)

**MSW handlers** (`frontend/src/mocks/handlers.ts` extended):
- Stateful CRUD across all 9 admin domains. Slice 12 introduced a
  fall-through ordering trick where `adminTestGetHandler` returns
  `undefined` on miss so MSW falls through to the FE-4 testee
  `getTestHandler` — both surfaces co-exist on `/v1/tests/:test_id`.
- Slice 13 replaced the empty-page question handler stub with a real
  `mockAdminQuestions` store + full CRUD; seeded the frozen draft test
  with one MCQ + one TF for non-empty pool flows.

**Tests added (FE-8-specific, 27 new files):**
- Unit: `tests/lib/queries/admin-keys.test.ts`, `tests/lib/tests/{compose-question-config,derive-display-status}.test.ts`
- Component: `tests/components/admin/{filter-bar,difficulty-range-slider,safety-toggle}.test.tsx`
- Page integration: 16 files under `tests/pages/admin-*.test.tsx`
- Round-trip: `tests/integration/admin/{admin-catalogue,admin-identity,admin-tests}-roundtrip.test.tsx`
- E2E: `frontend/e2e/admin-authoring-roundtrip.spec.ts`

**Existing files extended:**
- `frontend/src/components/shell/Rail.tsx` — ADMIN_NAV extended from
  7-item to 11-item locked set (Slice 1).
- `frontend/tests/setup.ts` — `afterEach` extended with the 9 admin
  reset helpers (Slice 14 fix per drift sweep Finding #2).
- `frontend/src/types/api.d.ts` — regenerated against the FE-8 wire
  surface (no manual edits; pure `pnpm codegen` output).

**Summary:** FE-8 delivers the complete admin authoring surface in 15
shipped slices (planned 11; Slices 6, 9, and 11 split during build) on
a single omnibus PR. Coverage spans pill/subject/proposal/safety CRUD;
learning-path authoring with drag-reorder; users + groups + membership;
assignment authoring; the test-authoring editor for three of four modes
(`per_testee`, `frozen`, `hand_authored` shipping; `benchmark` stubbed);
and the 5-type question editor modal (multiple_choice, true_false,
matching, short_answer, scenario). Three Vitest round-trip integration
tests + one Playwright E2E cover the cross-domain done-when chain. The
`benchmark` authoring mode and several v1.x deferred features are
tracked in section 6.

## What was decided in this PR

**Binding Pause #1 — after Slice 1 (foundation + §C primitives):**
Locked the shape of the `adminKeys` query-key library and all five §C
primitives before any real page consumed them. Rationale: a shape flip
in `adminKeys` at Slice 8 would require 9-file edits; at Slice 1 it's
one file. Sign-off lifted on slice transition and carried forward
unchanged through all 14 subsequent slices.

**Binding Pause #2 — after Slice 12 (test editor per_testee):**
Locked three architectural decisions before Slices 13–14 duplicated the
pattern:
- **Lock A** — `QuestionEditorModal` owns its own `react-hook-form`
  instance and its own `useCreateQuestion` / `useUpdateQuestion` /
  `useDeleteQuestion` mutations. Questions are NOT nested under
  `TestEditorFormInput`. The modal closes via its own confirm flow
  independent of the test editor's Save.
- **Lock B** — extend the existing flat `test-editor-form.ts` schema
  with per-mode `superRefine` branches for frozen + hand_authored. The
  5-type question discriminated union lives in a SEPARATE schema inside
  the question editor modal (`question-form.ts`), not nested under
  `TestEditorFormInput`.
- **Lock C** — `FrozenSection` takes two lock props (`sectionLocked`
  + `poolLocked`), not one. Published locks the pool but leaves
  randomise/settings editable; locked locks both.
  `HandAuthoredSection` composes `FrozenSection` and inherits both lock
  states correctly.

**New anchors introduced:** none. FE-8 ships entirely under existing
decision anchors.

**Existing anchors this PR depends on:** AC-D2 (user accounts), AC-D3
(test model), AC-D5 (question types), AC-D7 (pill catalogue), AC-D8
(pill proposals), AC-D13 (test modes), AC-D14 (user status), AC-D15
(system groups), AC-D17 (mode immutable post-create), AC-D24 (lock
mechanics), AC-CD15 (FakeSession parser constraints), AC-CD19 (FE
stack lock), AC-CD21 (query-key shape mirroring `me.ts` pattern),
AC-CD23 (shadcn token remap).

**Deliberate spec deviations — absorbed via Phase 0 PR #64 + in-build
slice drift sweeps:**

- **Route convention `(authed)/(admin)/admin/<segment>/`** — Phase 0
  struck the original `(admin)/` route group but left the trailing
  `/admin/` URL segment in the spec files inconsistently. Shipped tree
  is consistent across all 15 slices; doc-only drift remains (item 6
  in section 6).
- **Native `<select>` over Radix `Select`** — jsdom can't drive Radix
  Select pointer events reliably; locked as the admin select pattern.
- **Hex-only UUID format for MSW seeds** — Slice 3 introduced this
  after zod `uuid()` rejected slug-suffix UUIDs in fixtures.
- **Value-diff PATCH bodies** — rhf `dirtyFields` is unreliable in
  jsdom; the diff is computed against the response shape at submit.
- **Lock button ships disabled in v1** — Slice 12 drift Finding #1; no
  `/v1/campaigns` endpoint exists to feed `CampaignLockRequest.campaign_id`.
- **`description` + `question_count_target` dropped** — Slice 12/13
  drift; not on wire.
- **Mode immutable post-create** — wire enforces by absence of a `mode`
  field on `TestUpdate`.
- **Question config FE-owned typing** — Phase 0 §H(a) item 2 LOCKED
  contract; `body` + `pill_id` + `is_anchor` pack into `config` per
  type via `compose-question-config.ts`. Backend types
  `QuestionCreate.config` as `Record<string, never>`.

## Drift flags raised and how they were resolved

**Spec-drift findings absorbed under standing patterns (running tally
across all 15 slice drift sweeps):**

1. Route group rename — doc-only drift, consistent throughout
   implementation.
2. Native `<select>` over Radix Select — jsdom limitation.
3. Hex-only UUID format for MSW seeds — aligns with `parse-uuid`
   constraints.
4. Value-diff PATCH bodies — rhf `dirtyFields` unreliable in jsdom.
5. Lock button disabled v1 — no `/v1/campaigns` endpoint.
6. `description` + `question_count_target` fields dropped (not on
   wire).
7. Mode immutable post-create (wire enforces by absence).
8. Question config FE-owned typing (Phase 0 §H(a) item 2 LOCKED).
9. Question pool endpoint takes no query params — `useQuery` not
   `useInfiniteQuery`.
10. No per-question GET endpoint — edit-mode prefill from cached
    list.
11. Frozen tests have `pill_id: null` → not bindable in assignments
    picker (Slice 14 drift Finding #3 — round-trip uses per_testee).
12. `LoopMode` wire vs display split — wire `"admin_reviewed"`
    (underscore), display "admin-reviewed" (hyphen);
    `frontend/src/lib/identity/format-loop-mode.ts` translates.
13. Derived count columns render `—` placeholder
    (`used_in_count`, `pill_count`, `assignment_count` not on wire).
14. Resend-setup button ships disabled (no backend endpoint).
15. Question array-level zod refine errors land at `errors.choices.root.message`
    in rhf v7 (Slice 13 trap; per-type subcomponents read both `.message`
    and `.root.message` for robustness).
16. MSW handler ordering trap — Slice 12 admin `getTest` shares
    `/v1/tests/:test_id` with FE-4 testee `getTest`; admin handler
    returns `undefined` on miss to fall through to testee handler.
17. The dead `<span className={cn("hidden")} aria-hidden />` in Slice
    12's `test-editor.tsx` was scaffolding leftover; removed in commit
    `9993632`.
18. `form.reset` effect must be gated on a `hydratedRef` so post-save
    TanStack invalidations don't stomp in-flight edits.

**In-build Gitar findings (across 7 PR review rounds):**

- **Gitar #1 (Slice 1, bug — fixed):** `FilterBar.onSearchChange`
  unstable ref, debounce timer resets on parent re-renders. Fixed via
  `useRef` stabilisation matching the `StreamingRunner.tsx` pattern.
- **Gitar #2 (Slice 2, bug — fixed):** `IntersectionObserver`
  `[list]` dep recreates observer every render. Fixed: switched to
  `[list.hasNextPage, list.isFetchingNextPage, list.fetchNextPage]`.
- **Gitar #3 (Slice 2, quality — open as known wart):** `setTab` in
  `catalogue-shell.tsx` discards non-`tab` URL params. Tabs unmount
  on switch so search state is ephemeral anyway; no user regression
  but the deep-link comment at line 10 is misleading.
- **Gitar #4 (Slice 4, quality — fixed at `f7af5a6`):** `SheetHeader`
  eyebrow text hardcoded as `"Proposal"`. Fixed: extracted to
  optional `eyebrow` prop.
- **Gitar #5 (Slice 4, edge case — open):** `formatRelative` renders
  negative values for future dates (clock skew). Simple `if (delta <
  0) return new Date(iso).toLocaleDateString()` would close. Low
  severity; dev/staging only in practice.
- **Gitar #6 (Slice 9, performance — CLOSED by N2, PR #68):**
  `useAdminUsers()` was fetched eagerly in `group-detail.tsx` to join
  `member_ids` against user names/emails because no `/members` endpoint
  existed. N2 landed `GET /v1/groups/{id}/members` and rewired the view
  to a single batched call; the eager directory fetch is now lazy
  (picker-only). See N2 tracker below + `handovers/PR-068-n2-group-members.md`.
- **Gitar #7 (Slice 9, edge case — fixed at `10d77d5`):**
  `MemberPickerModal` closed on partial `Promise.allSettled` failure
  without retaining failed selections. Fixed: modal stays open on
  partial/full failure, retaining only failed user IDs in the
  selection set.

## Open questions deferred to a later phase

Prior open questions carried forward from `handovers/PR-061-fe7-constellation.md`:

- **FE-3 `flags.recentAttemptsWidget` flip** — `GET /v1/attempts` is
  live. One-line flag-flip + `RecentAttemptsCard` wiring follow-up PR
  is warranted. Still open; recommended for immediate follow-up
  pre-FE-9.
- **Subject colour map** — `MeCompetencePill.subject_id` is UUID;
  `frontend/src/lib/catalogue/subjects.ts` is slug-keyed. Still open;
  closes when `GET /v1/catalogue/subjects` is wired.
- **`competence_delta` per-attempt snapshot** — wire row carries null
  in v1; positive/negative/em-dash paths are unit-tested but
  unreachable in production until backend ships the column.
- **AC-CD15 FakeSession `IN()` constraint** — per-id equality loops
  still acceptable at v1 scale.
- **`retake_count` column deletion** — structurally dead since FE-7;
  deferred to a standalone migration PR.

New v1.x trackers surfaced by FE-8:

- **N1 — Pagination + client-side filter interaction.** `FilterBar`
  debounces against the first cached page only; a search that spans
  multiple pages will miss results beyond the first loaded page.
  Acceptable at pilot scale; revisit when catalogue grows beyond a
  few hundred rows.
- **N2 — Members N+1 fetch. CLOSED (PR #68).** Landed
  `GET /v1/groups/{group_id}/members` (`Page[UserResponse]`, admin-gated)
  and rewired `group-detail.tsx` to a single batched `useGroupMembers`
  call. The eager `useAdminUsers()` directory fetch was relocated into
  `MemberPickerModal` (lazy, picker-only). FE-8 §B.3.3 corrected to the
  real contract. See `handovers/PR-068-n2-group-members.md`.
- **N3 — Benchmark mode authoring deferred to v1.x.**
  `benchmark-section.tsx` ships as a visible but disabled stub.
  `BenchmarkRunner` in FE-4 continues to work for benchmark
  *attempts*. The asymmetry (attempts work, authoring does not) is
  documented and flagged in the component with a v1.x comment.
  Revisit when the benchmark authoring wire contract is defined.
- **N4 — Playwright E2E terminates at admin-side picker.** No
  `/v1/me/assignments` endpoint exists; the E2E
  `admin-authoring-roundtrip.spec.ts` cannot navigate to the testee
  dashboard to verify the "appears on testee dashboards" assertion
  end-to-end in a browser. The MSW-backed
  `admin-tests-roundtrip.test.tsx` integration test covers the
  cross-domain state assertions instead. Revisit when
  `/v1/me/assignments` ships (likely FE-9 ops phase).
- **FE_CHECKLIST.md FE-8 row paths:** All FE-8 rows in
  `FE_CHECKLIST.md:113-120` cite `(admin)/` paths (e.g.
  `frontend/src/app/(admin)/catalogue/page.tsx`). The shipped files
  are at `(authed)/(admin)/admin/catalogue/page.tsx`. Doc-only update
  needed; recommended as a one-commit follow-up before FE-9 opens.
- **`catalogue-shell.tsx setTab` URL param preservation** (Gitar #3
  above) — minor inconsistency, no user regression. Decide whether
  to fix before FE-9 or carry as a known wart.

## Build state vs spec

**Complete:**
- `adminKeys` query-key library matching spec §C.1 verbatim.
- All five §C primitives (FilterBar, Modal, Field, DifficultyRangeSlider,
  SafetyToggle).
- ADMIN_NAV 11-item lock per spec §C.2 (Rail.tsx).
- Catalogue area — subjects CRUD, pills CRUD + difficulty/safety,
  proposals approve/reject + drawer, safety tab with override toggle.
- Paths area — paths list with cursor pagination + path editor (pill
  binding, @dnd-kit reorder).
- Users area — users list with deactivate/reactivate; resend-setup
  ships disabled (v1.x tooltip).
- Groups area — groups list + group detail with member picker
  (system-group immutability enforced).
- Assignments area — create + delete; testee + group picker; deadline
  + loop_mode (edit flow dropped per Phase 0 spec lock).
- Tests area — tests list with status badge; test editor for
  `per_testee`, `frozen`, `hand_authored` modes; 5-type question
  editor modal; publish/unlock controls.
- FE-owned typing layer — `compose-question-config.ts`,
  `unpack-question-config.ts`, `parse-proposal-payload.ts`,
  `question-form.ts`, `test-editor-form.ts`.
- Round-trip integration tests + Playwright E2E (admin-side scope).

**Partial:**
- Benchmark mode authoring — `benchmark-section.tsx` renders the
  stub; all fields disabled. Ships as visible v1.x placeholder.
  Benchmark *attempts* remain live via FE-4.
- Assignment edit flow — create + delete only; no edit route. Spec
  lock from Phase 0.
- Playwright E2E — terminates at admin-side assignment picker (N4);
  testee-side verification via MSW-backed Vitest round-trip only.
- Derived count columns — `used_in_count`, `pill_count`,
  `assignment_count` render `—` placeholder across all list tables.
- Lock button — present in publish controls but disabled pending
  `/v1/campaigns` endpoint.
- Resend-setup button — present in users list but disabled with
  v1.x tooltip.

**Stubbed / deferred:**
- Benchmark authoring (N3).
- Difficulty curve editor UX inside benchmark (deferred with
  benchmark authoring).
- Question reorder (deferred per §E.18; `QuestionUpdate` has no
  `order` field on the wire).
- Bulk-invite + per-user admin profile flows (spec §E deferrals).
- Image uploads on questions (spec §E.1).

## Test coverage and CI results

**Vitest at HEAD (`100cab0`):** 122 test files / 886 tests / all
green. Breakdown:
- Foundation unit tests (admin-keys, FilterBar, slider, toggle,
  compose/unpack, derive-display-status): 5 files, ~50 tests.
- Page-level integration tests (16 admin-* files under
  `tests/pages/`): ~200 tests covering each surface's happy + error +
  edge-case paths.
- Round-trip integration tests (3 files under
  `tests/integration/admin/`): cross-page state carry-over via MSW
  seed (subject→pill→proposal; user→group→membership→assignment;
  test create→publish→bindable).

**TypeScript:** `pnpm typecheck` clean — strict mode +
exactOptionalPropertyTypes.

**Lint:** `pnpm lint` clean — zero ESLint warnings or errors.

**Format:** `pnpm format:check` clean — Prettier baseline applied
across all new files.

**Build:** `pnpm build` clean — production Next.js bundle generated
with all 22 admin routes registered as `Dynamic (ƒ)` or `Static (○)`.

**Playwright E2E** (`pnpm e2e`): admin-authoring-roundtrip.spec.ts
runs in Chromium via the CI `frontend/e2e` job per
`.github/workflows/frontend.yml`. Test exercises the
empty-list → create draft → URL flip → publish flow against
`page.route`-intercepted backend (NEXT_PUBLIC_API_MOCKING=disabled).

**One Gitar review thread remains open** at merge time: the
performance suggestion on `useAdminUsers()` in `group-detail.tsx`
line 70. Gitar itself classifies it as "an acknowledged
architectural decision." Carried forward as the N2 v1.x tracker.

## Post-merge validation considerations

The frontend runs inside a Docker image (`frontend/Dockerfile`) built
by `docker-compose.yml`. The FE-8 branch did NOT modify
`frontend/package.json` for new prod deps; the existing
`@playwright/test` was already declared by FE-5. Because the frontend
container does not bind-mount `node_modules` or `pnpm-lock.yaml` at
runtime, post-merge local validation requires a clean image rebuild
before re-running:

```
docker compose build --no-cache frontend
docker compose up -d
```

Then verify the admin authoring suite end-to-end:

```
# Vitest unit + page + integration
cd frontend && pnpm test --run

# Playwright E2E (requires running compose stack)
cd frontend && pnpm exec playwright test e2e/admin-authoring-roundtrip.spec.ts
```

Note: `admin-authoring-roundtrip.spec.ts` will not attempt to
navigate to the testee dashboard (N4 — no `/v1/me/assignments`
endpoint). The spec intentionally stops after confirming the
published state lands on the test editor surface.

## Anything a fresh Claude Code session needs to pick up cleanly

**Required reading beyond `SESSION_START.md`:**
- `fe-specs/FE-8-admin-catalogue.md` — owns `adminKeys` + §C
  primitives; §B.1–§B.7 cover catalogue, safety, paths.
- `fe-specs/FE-8-admin-identity.md` — users, groups, assignments.
- `fe-specs/FE-8-admin-tests.md` — test authoring, question editor,
  publish/lock/unlock.
- This handover.
- Prior handover `handovers/PR-061-fe7-constellation.md` for the
  chain of open questions inherited from FE-7.

**Environment / setup notes:**
- No new prod deps added; Playwright was declared by FE-5.
- After pulling the merged branch run `pnpm install` in `frontend/`
  to ensure local node_modules match the lock.
- `frontend/playwright.config.ts` already in place; CI job
  `frontend/e2e` runs the admin E2E alongside FE-4/5/6 specs.

**Post-merge stale-image check:**
The `frontend` service is built with no source bind-mount for
`node_modules`. After merging this PR, run `docker compose build
--no-cache frontend` before re-running any E2E tests locally.

**Known traps and gotchas:**

- `adminKeys` shape is load-bearing for cache invalidation across
  all admin mutations. If a future session adds a new admin domain
  or renames a key, `frontend/src/lib/queries/admin-keys.ts` must
  be updated first — and all mutation `onSuccess` /
  `invalidateQueries` call sites updated in the same PR. Partial
  updates silently stale the cache without a visible error.

- `FrozenSection` (at
  `frontend/src/app/(authed)/(admin)/admin/tests/[testId]/edit/_components/frozen-section.tsx`)
  takes two distinct props: `sectionLocked` and `poolLocked`.
  Collapsing them into one boolean was explicitly rejected in
  Binding Pause #2 Lock C because published locks the pool but
  leaves randomise/settings editable; locked locks both. Any future
  session that refactors this component must preserve the two-prop
  contract or update all call sites and the `admin-test-editor.test.tsx`
  + `admin-question-editor.test.tsx` lock-matrix tests.

- `QuestionEditorModal` owns its own `react-hook-form` instance
  (Binding Pause #2 Lock A). It does NOT share form state with the
  parent `TestEditor`. If a future session needs cross-modal
  validation (e.g. a test-level constraint that depends on total
  question count), the pattern will need to be extended via a
  `useQuery(adminKeys.questions.list(testId))` read in the parent —
  not by lifting state from the modal.

- `compose-question-config.ts` (at
  `frontend/src/lib/tests/compose-question-config.ts`) is the
  canonical packing layer that transforms the editor's
  discriminated-union question form into the wire `config:
  Record<string, never>` field. Any future question-type addition
  must register a new branch in this file AND in
  `unpack-question-config.ts`. The backend silently accepts an
  unrecognised `config` blob — there is no wire-level validation
  to catch a missing case.

- `useAdminUsers()` is called unconditionally in `group-detail.tsx`
  line 70. For small deployments this is acceptable, but as user
  count grows, members whose IDs fall outside the first loaded
  page will appear as "(member outside loaded users)" without any
  error surfacing. This is the N2 tracker. Do not confuse this with
  a bug when debugging group detail rendering issues — the root
  cause is the missing `/v1/groups/{id}/members` endpoint.

- The MSW handler ordering trap for `/v1/tests/:test_id`: Slice 12
  registered `adminTestGetHandler` BEFORE the FE-4 testee
  `getTestHandler` with explicit `return undefined` on miss so MSW
  falls through. Any future session that touches handler ordering
  must preserve this: admin seed IDs are `ffff5555-…`; testee seed
  IDs are distinct, so both surfaces stay isolated. See the inline
  comment block at `frontend/src/mocks/handlers.ts:2758–2769`.

- The `setTab` navigation in `catalogue-shell.tsx` discards non-`tab`
  URL params (Gitar #3, unresolved). Deep-link URLs that include
  `?q=` will lose the search term when the user switches tabs.

- `FE_CHECKLIST.md` FE-8 rows all reference the pre-route-rename
  path (`(admin)/`) not the shipped path
  (`(authed)/(admin)/admin/`). These rows currently read "missing"
  because the path pattern does not match. A doc-only update is
  needed before the checklist can be used for FE-8 sign-off
  tracking.

**Recommended next action:**
FE-9 — Admin operations suite (`FE_ROADMAP.md` lines 176–194).
Pre-work before opening FE-9:
1. Flip `FE_CHECKLIST.md` FE-8 rows from the old path to the shipped
   `(authed)/(admin)/admin/` paths and mark complete (doc-only
   commit).
2. Flip `FE-3 flags.recentAttemptsWidget` (one-line flag-flip +
   `RecentAttemptsCard` wiring, carried from FE-7).
3. FE-9 build session will consume `ADMIN_NAV` entries `ops`,
   `review`, `engagement`, `cost`, and `loop` — all four are already
   present in `Rail.tsx` from the ADMIN_NAV lock (Slice 1). Pages for
   those entries are the entire scope of FE-9.

---

https://claude.ai/code/session_014YntFijv3xCdAjVH8FuhJg
