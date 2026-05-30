# PR Handover: FE-9 count meta — bootstrap status count enrichment (PR-069)

<!--
  Fill every section. Keep prose tight and factual. This document is
  the contract for the next session: what shipped, what was decided,
  what drifted, what remains. Cite file:line and AC/CD anchors.
-->

## 1. PR identifier and link

- **Title:** FE-9 count meta — bootstrap status count enrichment
- **Number:** #69 — https://github.com/jaydomains/acumen/pull/69
- **Branch:** `claude/gallant-cori-xvo48` → `main`
- **Merge:** squash-merge (after explicit poll-to-green).
- **Slices (one PR):** s1 backend convention (`2abdcfb`), s2 frontend
  rewire (`c0fe14e`), s3 handover (this commit).

## 2. Phase reference

Not a phase — **FE-9 count meta** is the persistent v1.x backlog item
carried as **FE-9 Finding 6** from PR-066 (FE-9 admin operations). No
detail fe-spec was authored (1 schema field + helper change + 1 FE hook +
1 card rewire + tests). The existing `Page` / `PageMeta` envelope
(`app/schemas.py:154`), the `paginate` helper
(`app/domain/catalogue.py:80`), and the `/v1/pills` + `/v1/admin/drive/index`
endpoints are the reference convention.

## 3. What was built

**Backend (count-meta convention)**
- `PageMeta.count: int | None = None` (`app/schemas.py:154`) — full
  collection size; `None` on endpoints that don't route through
  `paginate`. Backward compatible.
- `paginate` (`app/domain/catalogue.py:80`) now returns
  `(page, next_cursor, total)` where `total = len(rows)` — the full row
  set is already loaded for in-Python sort/slice, so **no SQL `COUNT(*)`**
  (keeps the FakeSession harness constraint, AC-CD15).
- Threaded `count` through **every** paginate-backed list endpoint:
  domain fns `list_subjects` / `list_pills` / `list_discoverable_pills` /
  `list_pill_proposals` / `list_paths` / `list_groups` (catalogue),
  `list_users` / `list_group_members` (users), `list_assignments`
  (assignments), `list_tests` (tests); routers `catalogue.py`, `users.py`,
  `paths.py`, `groups.py`, `assignments.py`, `tests.py`, `competency.py`
  (the `/v1/me` assignments mirror). Non-paginate `PageMeta` sites
  (`attempts.py` own-attempts, `tests.py` `list_questions`) keep
  `count=None` — no change.
- Regenerated OpenAPI snapshot `frontend/openapi/schema.json` +
  `frontend/src/types/api.d.ts` (they move together per
  `frontend/README.md`).

**Frontend (rewire System Bootstrap card)**
- `adminKeys.pills.count()` (`frontend/src/lib/queries/admin-keys.ts:32`)
  — child of `pills.all()`.
- `useAdminPillsCount()` (`frontend/src/lib/queries/admin-pills.ts`) — a
  `?limit=1` probe reading `PageMeta.count` via react-query `select`
  (returns `number | null`, no page flattening).
- `system-page.tsx` Bootstrap card (`system-card-bootstrap`): **Pills**
  stat now reads the count probe; **Drive files** reads the existing
  `useDriveIndex().data.files`. **Anchors** + **Safety links** stay
  session-local (`lastBootstrap`) — no corpus-total source exists.
- Append-only `count` on the existing `/v1/pills` MSW handler
  (`frontend/src/mocks/handlers.ts:1459`).

**Tests**
- Backend: `tests/integration/test_p3_catalogue.py` — `meta.count` on the
  cursor round-trip + a dedicated `?limit=1` probe assertion; fixed the
  one exact-match empty-page meta assertion in
  `tests/integration/test_p3_paths_groups.py:220`.
- Frontend: `tests/pages/admin-system-page.test.tsx` — new test asserts
  the Bootstrap card shows Pills (6) + Drive files (412) **on load**
  before any run; retargeted the run test to a still-session-local stat
  (Anchors 2740, was Pills 137).

## 4. What was decided in this PR

User-confirmed (asked in plain text after the AskUserQuestion modal was
dismissed): **1A + 2A + 3A**.

1. **1A — `count` on `PageMeta`, always populated by `paginate`.** Chosen
   over an `include_count` opt-in param or dedicated `/count` endpoints.
   The total is already in hand inside `paginate`, so populating it
   uniformly is near-free and gives every `Page[T]` endpoint a count for
   free.
2. **2A — target `system-card-bootstrap`** in `system-page.tsx:81-89`
   (the stats that render "—" until a run), **not** the component
   literally named `BootstrapStatusCard` in `ops-landing.tsx` (which
   already renders drive stats with no placeholders).
3. **3A — wire Pills + Drive files only.** Pills via the new count meta;
   Drive files via the pre-existing `drive/index.files`. Anchors +
   Safety links stay session-local — no corpus-total source exists and
   inventing one (new endpoints) was explicitly out of scope.

**New anchors introduced:** none (the `count` field is a CODE_SPEC §5
envelope extension; no new AC-D/AC-CD anchor was minted this PR).

## 5. Drift flags raised and how they were resolved

- **D1 — the task's "fire `?limit=1`, read `meta.total`" premise only
  fits Pills.** The framing assumed pills/anchors/drive are all `Page[T]`
  list endpoints. Reality: `/v1/pills` is `Page[T]` ✅;
  `/v1/admin/drive/index` is `DriveIndexStatus` and **already** returns
  `files`/`chunks` ✅ (no meta needed); `/v1/admin/anchors/flagged` is a
  flat `FlaggedAnchorListResponse{data}` — **not a `Page`**, no meta, and
  *flagged-subset* semantics (flagged ≠ generated/total). **Surfaced
  before coding**; resolved by scope 3A (Pills + Drive only).
- **D2 — the em-dashes aren't where the task names them.** The task said
  "System page's `BootstrapStatusCard`". The component named
  `BootstrapStatusCard` lives in `ops-landing.tsx` and renders drive
  stats with **no** em-dashes. The actual placeholders are in
  `system-page.tsx`'s "Bootstrap" `SystemOpCard`. Resolved by 2A.
- **D3 — the em-dash values are bootstrap-*run* deltas, not list totals.**
  `lastBootstrap.{pills_processed,anchors_generated,safety_links_added,
  drive_files_seen}` are session-local (POST result), "—" until "Run
  bootstrap". The fix changes Pills/Drive-files to **live corpus totals**
  (refreshed post-run via the existing `pills.all()` + `driveIndex`
  invalidation in `useRunBootstrap`); Anchors/Safety-links keep run-delta
  semantics. The card now mixes corpus totals (Pills, Drive files) and
  run-deltas (Anchors, Safety links) — an accepted consequence of 3A.

All three were surfaced to the user (not silently reconciled) and the
loop paused for the 1A/2A/3A decision before any code was written.

## 6. Open questions deferred to a later phase

- **Anchors corpus total.** No "all anchor questions" list endpoint
  exists — only `/v1/admin/anchors/flagged` (flagged subset, flat list).
  A future slice could add a total-anchors source (or surface a count on
  the flagged endpoint) to populate the Anchors stat on load.
- **Safety-links count.** No status/count endpoint exists; the stat stays
  session-local until one is added.
- **Card semantics.** If the mixed corpus-total + run-delta presentation
  reads oddly, a follow-up could either (a) give Anchors/Safety-links
  corpus sources, or (b) revert Pills/Drive-files to run-deltas. Left as a
  product call.
- **`count` on non-paginate `PageMeta` sites** (`attempts` own-attempts,
  `list_questions`) is `None`; populate if a consumer ever needs it.

## 7. Build state vs spec

- **Complete:** `PageMeta.count` convention populated across all
  paginate-backed endpoints; OpenAPI snapshot + types regenerated;
  `useAdminPillsCount` + Bootstrap card Pills/Drive-files wired to real
  on-load counts; MSW + unit/integration coverage.
- **Intentionally omitted (3A scope):** Anchors + Safety-links corpus
  totals (no source endpoint).
- **Stubbed:** none.

## 8. Test coverage and CI results

- **Backend:** full `pytest --ignore=tests/e2e` green (**873 passed**);
  `ruff check .` + `ruff format --check .` clean repo-wide (CI-pinned
  ruff **0.6.9**); `mypy app` clean (62 files).
- **Frontend:** full Vitest suite green (**936 tests**); `pnpm lint`,
  `format:check`, `typecheck`, `codegen:check` (exit 0), and `pnpm build`
  all clean.
- **CI:** the `frontend` + `ci` workflows are polled to green on the final
  commit **before** squash-merge (locked at FE-9/N4) — subscription
  pushes failures only, so green is confirmed via the explicit poll loop.
  No "looks green" merge.
- **Manual verification:** the new vitest test exercises the end-to-end FE
  behaviour (Pills count probe + drive-index files render on load, before
  any bootstrap run).

## 9. Anything a fresh Claude Code session needs to pick up cleanly

- **`count` rides `paginate`.** Any new `Page[T]` endpoint that paginates
  through `app/domain/catalogue.py:paginate` gets `meta.count` for free —
  just unpack the **3-tuple** `(rows, next_cursor, count)` and pass
  `count=count` to `PageMeta`. Forgetting the third value is a tuple-unpack
  error caught by `mypy`/`pytest`.
- **Snapshot regen — do NOT full-regen with `sort_keys`.** The committed
  `frontend/openapi/schema.json` is **not** sorted (FastAPI natural key
  order). The `frontend/README.md` recipe's `sort_keys=True` reorders
  ~9000 lines and produces a useless diff. This PR added the `count` field
  with a **surgical edit** to the `PageMeta` block of the committed
  snapshot, then `pnpm codegen` to regenerate `api.d.ts`. To match the
  exact field JSON, dump just the component:
  `python -c "import json; from app.main import app;
  print(json.dumps(app.openapi()['components']['schemas']['PageMeta'], indent=2))"`.
  CI's `codegen:check` only asserts `api.d.ts` ↔ `schema.json` (it never
  diffs the snapshot against the live backend), so the snapshot's exact
  formatting only matters for diff hygiene.
- **MSW handlers are append-only.** The `count` field was added in place
  to the existing `/v1/pills` handler's `meta` (a duplicate `/v1/pills`
  handler would collide); no handler was removed or reordered.
- **Pills count refresh rides `pills.all()`.** `useRunBootstrap` already
  invalidates `adminKeys.pills.all()` and `system.driveIndex()`
  (`admin-system.ts:50-52`), and `pills.count()` is a child key — do not
  add a separate count invalidation.
- **Env setup.** Backend deps are not pre-installed and the system PyJWT
  is Debian-owned (blocks a clean uninstall in the global site). This
  session used a venv: `python -m venv .venv && . .venv/bin/activate &&
  pip install -r requirements.txt -r requirements-dev.txt` — this also
  pins `ruff 0.6.9` (the local global ruff is newer and flags rules CI
  doesn't, e.g. UP046). Frontend: `pnpm install --frozen-lockfile` then
  `pnpm test --run` / `typecheck` / `lint` / `build` (node 22, pnpm
  10.33.0).
- Next backlog candidate: the Anchors / Safety-links corpus-total sources
  in §6 (would let the Bootstrap card drop the last two em-dashes).
