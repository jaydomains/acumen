# Handover — PR-061 FE-7 competency constellation + history

## PR identifier and link

- PR: #61 — FE-7: competency constellation + history
- Link: https://github.com/jaydomains/acumen/pull/61
- Author / session: Claude Code (FE-7 build session,
  `claude/fe7-competency-constellation-mH8o2`)
- Date closed: 2026-05-27

## Phase reference

- ROADMAP phase closed by this PR: FE-7 (testee competence profile +
  attempt history)
- Does this PR fully close the phase? **Yes.** All `FE_CHECKLIST.md`
  FE-7 rows tick on; `/profile` and `/history` mount with live wire
  data; the constellation visual encoding (size = competence,
  colour = band, ring length = calibration confidence, edges =
  related pills, red dot = safety) all render against the live
  `GET /v1/me/competence` shape; history paginates via cursor
  intersection.

## What was built

- Files added:
  - `frontend/src/app/(authed)/(testee)/profile/{page,error}.tsx`
  - `frontend/src/app/(authed)/(testee)/history/{page,error}.tsx`
  - `frontend/src/components/profile/{constellation-svg,view-toggle,legend,selected-pill-detail-card,sparkline,how-to-read,matrix-table,history-table,history-row}.tsx`
  - `frontend/src/lib/profile/{derive-sparkline,layout-constellation,confidence-qualifier}.ts`
  - `frontend/tests/lib/profile/{derive-sparkline,layout-constellation,confidence-qualifier}.test.ts`
  - `frontend/tests/components/profile/{constellation-svg,view-toggle,legend,selected-pill-detail-card,sparkline,how-to-read,matrix-table,history-table,history-row}.test.tsx`
  - `frontend/tests/pages/{profile-page,history-page}.test.tsx`
- Files changed:
  - `app/domain/competence.py` (LOCK-2 / LOCK-3 / Finding-10 backend
    amendments)
  - `app/schemas.py` (`MeCompetencePill.competence_estimate` tightened
    to non-nullable per LOCK-2)
  - `tests/integration/test_slice_b_me_competence.py` (re-seeded
    against derived `n` + null-estimate filter + tenant filter)
  - `tests/unit/test_slice_b_schemas.py` (asserts new non-nullable
    contract)
  - `fe-specs/FE-7-profile.md` (LOCK-1 / LOCK-2 / LOCK-3 / LOCK-4 +
    F8 / F11 / F12 amendments; §H(c) approved-resolutions block at
    items 34–40)
  - `frontend/openapi/schema.json` + `frontend/src/types/api.d.ts`
    (regenerated against the tightened schema)
  - `frontend/src/lib/queries/me.ts` (added `useMeCompetence`,
    `useMeAttemptsInfinite`, `useMeAttemptsCapped`,
    `flattenAttempts`; `"infinite"` / `"capped"` discriminators on
    the attempts keys so the two hooks can't collide regardless of
    `limit`)
  - `frontend/src/mocks/handlers.ts` (append-only — added
    `meCompetenceHandler` + `meAttemptsListHandler` with 6 fixture
    pills × 5 fixture attempts under the canonical `Page<T>`
    envelope)
  - `frontend/tests/setup.ts` (reset hooks for the new MSW
    stores)
- Files removed: none.
- **Summary:** Ships the testee competence profile experience — a
  constellation SVG view (subject-clustered, band-coloured, n-ringed,
  related-edge-connected stars), a selected-pill detail card with
  sparkline + practice CTAs, a matrix-view toggle (pill × difficulty
  grid), the "how to read this" sidebar, and a cursor-paginated
  attempt history table with `IntersectionObserver`-driven sentinel.
  Backend `list_me_competence` is amended to filter NULL estimates +
  tenant + derive `n` from real `Attempt` rows so the calibration
  visual encoding ships honest at v1.

## What was decided in this PR

- **LOCK-1** — `GET /v1/attempts` ships under the canonical `Page<T>`
  envelope (`{data, meta: {next_cursor}}` per CODE_SPEC §5).
  FE-7-profile.md §B.1 §4 / §B.2 §3 / §B.2 §4 / §H(a) item-3
  amended in-PR. Anchors: AC-CD-19 (FE stack lock); CODE_SPEC §5
  envelope.
- **LOCK-2** — `competence_estimate` non-nullable on the wire.
  `list_me_competence` filters `IS NULL` rows server-side; schema
  field tightened from `float | None` → `float`. FE-7 ships with no
  null-guards on the float. Anchors: AC-D9 (competence estimate
  axis); FE-7-profile.md §B.1 §7 "null is impossible" contract
  honoured.
- **LOCK-3 (expanded)** — `n` derived from submitted `Attempt`
  rows joined to `Test.pill_id`, not the structurally-dead
  `CompetencyProfile.retake_count` column. Drift-sweep verification
  proved no v1 code path increments `retake_count`; shipping
  against it would have rendered every confidence ring at 0%.
  Anchors: AC-D20 (calibration confidence threshold); FE-7-profile
  §H(c) item 36.
- **LOCK-4** — `origin` enum aligned to live long-form values
  (`self_initiated | assignment_driven | loop_driven`).
  §B.2 §3 contract, §H(a) item-3 contract, §B.2 §5 row-origin
  state names, §C.5 BandTag history-row note all amended in-PR;
  FE consumes the live enum directly. Anchors: AC-D6 (adaptive
  loop), AC-D26 (origin enum); FE-7-profile §H(c) item 37.
- **Finding 10** — `list_me_competence` filters
  `CompetencyProfile.tenant_id == SEED_TENANT_ID` alongside the
  adjacent `Pill` / `PillRelated` queries. Port-time RLS insurance.
  Anchors: AC-CD3 (single-tenant v1, RLS deferred); §H(c) item 38.
- **Finding 13 (punted)** — FE-3's `flags.recentAttemptsWidget`
  stays off in this PR. With `GET /v1/attempts` now live, flipping
  the flag is a one-line follow-up PR. §H(c) item 39.
- **New anchors introduced by this PR:** none. FE-7 ships under
  existing anchors only (AC-D6, AC-D9, AC-D20, AC-D21, AC-D26,
  AC-D27, AC-CD3, AC-CD19, AC-CD20, AC-CD21, AC-CD23).
- **Existing anchors this PR depends on:** AC-D3 / AC-D6 / AC-D9 /
  AC-D20 / AC-D21 / AC-D26 / AC-D27 / AC-CD3 / AC-CD15 / AC-CD19 /
  AC-CD20 / AC-CD21 / AC-CD23.

## Drift flags raised and how they were resolved

Drift sweep before plan-mode surfaced 13 findings. Four required
operator locks (resolved as above); the rest:

- **F1 / F2 (spec-drift, absorbed)** — §H(a) blockers
  (`/v1/me/competence`, `/v1/attempts`) were already merged on `main`
  ahead of the build. Spec body lifted from "BLOCKED" to live in
  §0 status line.
- **F6 (doc-drift, absorbed)** — Route group is `(authed)/(testee)/`,
  not `(testee)/` as the spec body still names. Carries forward
  unchanged from FE-6 PR-059; same precedent, same noop.
- **F7 (absorbable)** — UUID `format: "uuid"` wire fields emit as
  `string` via `openapi-typescript`. No impact; documented.
- **F8 (impl-drift)** — History-row `band` is derived from
  `score_percent / 10` in `app/domain/attempts.py:2086-2097`
  because `Attempt` lacks a per-attempt band snapshot column. New
  §B.2 §7 edge-case note captures this.
- **F11 (impl-drift)** — `list_own_submitted_attempts` loads all
  testee attempts then Python-paginates (AC-CD15 FakeSession
  constraint; canonical `paginate` orders ASC by `created_at, id`
  but FE-7 needs `submitted_at DESC`). At v1 scale (~tens per
  testee) acceptable; surfaced in §B.2 §7.
- **F12 (absorbable)** — `format-relative.ts` shipped in FE-6 at
  `frontend/src/lib/result/format-relative.ts`; FE-7 imports it
  directly; spec §C.4 conditional-fallback branch dropped.

### Gitar review findings (resolved in-PR)

- **Gitar #1 (Slice 1, perf)** — `list_me_competence` loaded the
  whole tenant `Test` table then filtered in Python. Switched to
  per-id equality lookups bounded by the testee's submitted-
  attempt count (~tens at v1), AC-CD15-safe.
- **Gitar #2 (Slice 1, edge case)** — `useMeAttemptsCapped` and
  `useMeAttemptsInfinite` shared a sub-key shape (`{limit}` only)
  and would collide if the same `limit` was passed. Added
  `"infinite"` / `"capped"` discriminators so the two hooks can't
  collide regardless of `limit`.
- **Gitar #3 (Slice 2, bug)** — `ConstellationSVG` confidence-ring
  `strokeDasharray="X 100"` only reads as a percentage when the
  path's user-space length is 100. Without `pathLength={100}` the
  dasharray was user-units along the actual circumference, which
  scales with star radius. Visual encoding was silently broken
  across star sizes. Fix: added `pathLength={100}` + a
  regression-guard test against divergent
  `competence_estimate` values (1.0 vs 9.5).

## Open questions deferred to a later phase

- **FE-3 `flags.recentAttemptsWidget` flip.** `GET /v1/attempts` is
  now live with the LOCK-1 envelope; flipping the flag is a one-line
  follow-up PR plus a data-extraction wiring on the
  `RecentAttemptsCard`. Punted to keep FE-7 scope contained.
- **Subject colour map.** `MeCompetencePill.subject_id` is a UUID
  but `frontend/src/lib/catalogue/subjects.ts` is keyed by slugs;
  every subject resolves to the unknown-fallback neutral grey in
  v1. Layout still works (UUID is a stable cluster key). Closes
  when `GET /v1/catalogue/subjects` ships (FE-3 §H(b) item 5).
- **`competence_delta` per-attempt snapshot.** Wire row carries
  null on every history row in v1 (FE-6 absorbed trap); the
  positive / negative / em-dash rendering paths are unit-tested
  but never reached in production until a per-attempt snapshot
  column lands.
- **AC-CD15 FakeSession constraint on `IN()`.** Both
  `list_me_competence` (now) and `list_own_submitted_attempts`
  (FE-6 precedent) iterate per-id equality queries instead of an
  `IN()` clause. At v1 scale this is fine; if SiteMesh port-time
  RLS rolls out and the FakeSession harness gains compound-WHERE
  support, both call sites can collapse to bulk filtered loads.
- **`retake_count` column deletion.** The column is structurally
  dead — `list_me_competence` no longer reads it, no other code
  writes it. A follow-up migration can drop it; deferred for a
  separate PR that handles the migration chain in isolation.

## Build state vs spec

- **Complete:**
  - `/profile` route + Pattern C boundary; constellation SVG +
    legend + view-toggle + selected-pill detail card with
    sparkline + practice / step-up CTAs + how-to-read sidebar +
    matrix view.
  - `/history` route + Pattern C boundary; HistoryTable with
    cursor-driven sentinel pagination + per-row click navigation +
    Δcomp rendering (null em-dash, positive / negative colours).
  - All 5 helper modules under `lib/profile/`.
  - All 4 spec amendments under `fe-specs/FE-7-profile.md`.
  - Backend: `list_me_competence` tenant-filtered, NULL-estimate-
    filtered, n-derived. Schema tightened. 4 new integration tests
    + 1 amended unit test.
- **Partial:** none.
- **Stubbed:** none (Slice 1 stubs replaced in Slices 2–4).
- **Out of scope (per plan):** FE-3 RecentAttemptsCard flag-flip;
  subject colour UUID→meta map; per-attempt band snapshot column;
  v1.x history filter / search / date-range UI.

## Test coverage and CI results

- Tests added / changed:
  - Backend integration: 3 new + 5 amended in
    `tests/integration/test_slice_b_me_competence.py`.
  - Backend unit: 1 amended in `tests/unit/test_slice_b_schemas.py`.
  - Frontend unit: 16 new across `lib/profile/`.
  - Frontend component: 39 new across `components/profile/`.
  - Frontend page integration: 14 new across `pages/`.
- Total deltas: backend 861 pass; frontend 95 files / 641 tests
  pass.
- CI result at merge: all `checks` + `migration-chain` +
  `docker-build` + `Gitar` + `e2e` jobs green.
- Manual verification: none (no dev server bring-up in the remote
  environment). All assertions covered by unit + integration tests.

## Post-merge validation considerations

- This PR touches `app/domain/competence.py`, which runs inside the
  `acumen` container without a source bind mount in some compose
  configurations. After merge, post-merge local validation needs
  `docker compose build --no-cache acumen` before re-running pytest
  against the container.
- Re-verify end-to-end with:

  ```sh
  pytest -q tests/integration/test_slice_b_me_competence.py
  cd frontend && pnpm codegen:check && pnpm typecheck && pnpm lint \
    && pnpm format:check && pnpm test --run
  ```

  The codegen:check is load-bearing: if a future PR edits
  `MeCompetencePill` or `AttemptListItem` and forgets to regenerate
  `frontend/openapi/schema.json`, the gate catches it.

## Anything a fresh Claude Code session needs to pick up cleanly

- **Required reading:** `fe-specs/FE-7-profile.md` § A → § H (§ H(c)
  items 34–40 are the FE-7-specific approved resolutions); FE-2
  `BandTag` `estimate` + `confidence` contract at
  `fe-specs/FE-2-shell.md:644-651` (FE-7 is the first-class
  consumer at scale).
- **Environment / setup notes:**
  - The FE-7 build session ran in a remote environment without a
    `frontend` dev server; visual verification was via component
    + page tests only. A local `pnpm dev` against the MSW fixture
    set should mount both routes cleanly (see
    `setMockMeCompetence` / `setMockMeAttempts` helpers).
- **Known traps / gotchas:**
  - **`retake_count` is dead.** Don't read it from
    `CompetencyProfile`; derive `n` from `Attempt` rows. A future
    migration can drop the column.
  - **`competence_estimate` is non-nullable on the wire.** The
    backend filter at `list_me_competence` enforces this — any
    new caller that reuses the helper should preserve the filter
    or document why null rows are acceptable.
  - **Subject colour UUID→meta gap.** Until FE-3 §H(b) item 5
    ships, every subject halo + chip colour resolves to the
    unknown-fallback grey. Don't take this as a v1 design choice
    — it's a wiring gap.
  - **`Page<T>` envelope on `GET /v1/attempts`.** The FE consumes
    `.data` + `.meta.next_cursor`. The earlier `{attempts,
    next_cursor}` shape in the FE-7 spec was authoring-time
    text only; never landed on the wire.
  - **`pathLength={100}` on the confidence ring** is load-bearing
    — without it the dasharray reads as user-units along the
    actual circumference and the visual encoding breaks across
    star sizes. A unit test in
    `tests/components/profile/constellation-svg.test.tsx` guards
    against accidental removal.
  - **`useMeAttemptsCapped` vs `useMeAttemptsInfinite`** share
    the `meQueryKeys.attempts()` root; the `"capped"` /
    `"infinite"` string discriminator is what keeps their cache
    entries distinct regardless of `limit`. Don't drop it.
  - **History `competence_delta` is null in v1.** The colour
    branches in `formatDelta` cover positive / negative but never
    fire on the live wire today.
- **Recommended next action:** Open the FE-3 `RecentAttemptsCard`
  flag-flip follow-up PR (one-line flag flip plus a data-extraction
  wiring on the component). Then FE-8 (admin authoring suite) per
  the roadmap.
