# FE-8 — Admin catalogue + learning paths (detail spec)

> **Status:** plan-mode authored, ready for build session (subject to §H (a) blockers — the cross-spec drift on `applyApiErrorToForm` path in `fe-specs/FE-1-auth.md:538` and the `PillProposalResponse.payload` untyped-object contract must resolve before the FE-8 catalogue build session opens). FE-1..FE-7 builds must also land first per FE_ROADMAP dependency order.
> **Owns:** the admin catalogue surface (`/admin/catalogue` — 4 tabs: pills, subjects, proposals, safety) + learning-path authoring (`/admin/paths` list, `/admin/paths/[id]/edit` editor). **Also owns the canonical `adminKeys` query-key library** (§C.1) consumed by reference from `fe-specs/FE-8-admin-identity.md` and `fe-specs/FE-8-admin-tests.md`.
> **PR target:** `PR-NNN-fe8-admin-authoring` (one squash PR closes the phase; ships three sibling docs — this file + `fe-specs/FE-8-admin-identity.md` + `fe-specs/FE-8-admin-tests.md`).
> **Anchors:** AC-D2 (admin-driven creation), AC-D7 (pill catalogue + discoverable + safety_relevant + difficulty range), AC-D8 (AI-proposed pills — approve/reject, no edit-then-approve in v1), AC-D17 (frozen-test snapshot — informs pill lock-on-use UX), AC-D21 (safety pills — no AI teaching material, curated external links via bootstrap cron), AC-CD11 (admin-only surfaces), AC-CD19 (FE stack lock), AC-CD20 (`(admin)` route group + role guard → `/403`), AC-CD21 (centralised query keys + form helper + error envelope).
>
> This is the **eighth per-page FE detail spec**, first of three siblings (catalogue / identity / tests) for the FE-8 admin authoring phase. Template inheritance: per-page §B from `fe-specs/FE-1-auth.md:50–60` (verbatim — eight-point template per page); FE-2's `(admin)` route group + AdminGate primitive consumed unchanged per `fe-specs/FE-2-shell.md`; FE-3's cursor pagination + filter-bar + URL-state-sync patterns reused (`fe-specs/FE-3-content.md:527–644`); FE-1's `applyApiErrorToForm` precedent consumed by every modal form (path: `frontend/src/lib/api/form-errors.ts` per `CODE_SPEC.md:1024` + `fe-specs/FE-3-content.md:16` + `fe-specs/FE-4-runner.md:16` consensus — **NOT** FE-1:538's stale `lib/forms/` path; cross-spec drift surfaced in §H (b)). Three-file split selected per `fe-specs/FE-1-auth.md:747` escape clause; user-locked at plan time. Deviating from the template in FE-8+ is itself spec drift.

---

## 0. Context

FE-0 (PR-032) shipped the Next.js 15 / App Router scaffold + typed `openapi-fetch` client. PR-033 locked AC-CD20..24. FE-1..FE-7 **spec-merged** auth, shell, content, runner, streaming, results, profile — none built yet; FE-8 presumes their builds land in roadmap order before this build session opens (§H (a) item 1).

FE-8 is the admin authoring phase — the first form-heavy phase since FE-1 auth. It owns the complete admin CRUD suite. Per FE-1 §G escape clause (`fe-specs/FE-8-admin-authoring-{...}.md` when a single file exceeds ~2500 lines), FE-8 ships as **three sibling spec files**:

- `fe-specs/FE-8-admin-catalogue.md` (this file) — pill catalogue (4 tabs: pills, subjects, proposals, safety) + learning paths
- `fe-specs/FE-8-admin-identity.md` — users CRUD + groups CRUD + assignments
- `fe-specs/FE-8-admin-tests.md` — test authoring (4 modes) + question editor (5 types)

The three files share a single PR. Three-file split chosen over the FE-1:747 example's 4-file split (catalogue / users / groups / tests) on domain-boundary grounds: users + groups + assignments are tightly coupled (assignments span both); splitting them apart forces assignments into "groups" where it doesn't fit. Three files at 900–1400 lines each is the right granularity.

**FE-N spec preconditions FE-8 extends, not replaces** (the contracts FE-8 builds against — quote and cite, do not re-decide):

- **FE-1 `applyApiErrorToForm` helper** at `frontend/src/lib/api/form-errors.ts` per `CODE_SPEC.md:1024` + `fe-specs/FE-3-content.md:16` + `fe-specs/FE-4-runner.md:16`. Every FE-8 modal form uses this helper. FE-1's body locks the signature at `fe-specs/FE-1-auth.md:558–562`:
  ```ts
  export function applyApiErrorToForm<T extends FieldValues>(
    err: unknown,
    form: UseFormReturn<T>,
    opts?: { fieldMap?: Record<string, Path<T> | 'root'> },
  ): void
  ```
- **FE-1 error patterns A/B/C** at `fe-specs/FE-1-auth.md:567–658`: Pattern A (inline + root via `setError`), Pattern B (sonner toast with severity-coded auto-dismiss 3s/5s/7s), Pattern C (full-page boundary card with wave icon + "Try again" + "Go to dashboard"). FE-8 uses A for modal forms, B for save-success / non-field error surfacing, C for `(admin)` route-group error boundary.
- **FE-1 five-posture route-guard matrix** at `fe-specs/FE-1-auth.md:603–611`. Posture 4 (authed, role mismatch — e.g. testee hits `/admin/catalogue`) redirects to `/403`. FE-8's `(admin)` route group consumes the matrix unchanged.
- **FE-2 `(admin)` route group + AdminGate** at `fe-specs/FE-2-shell.md` (B.14 — admin shell composition; admin role guard at layout level). FE-8 mounts pages under `frontend/src/app/(admin)/` without adding new guard plumbing.
- **FE-2 primitives** consumed unchanged: `Pill` (FE-2 — used for status badges, role chips, mode pills), `Stat` (FE-2 — used for group-membership stats, test-list aggregate stats), `PageHeader` (FE-2 — eyebrow + serif-italic title pattern), `Icon` (lucide-react). shadcn install set from FE-2 (`Card`, `Button`, `Input`, `Label`, `Select`, `Dialog`, `DropdownMenu`, `Tabs`, `Toast`, `Skeleton`) — no new shadcn primitives needed for FE-8.
- **FE-3 cursor pagination pattern** at `fe-specs/FE-3-content.md:634–636` — `useInfiniteQuery` with `getNextPageParam: (last) => last.meta.next_cursor` + `IntersectionObserver` sentinel. Every list table in FE-8 reuses this pattern unchanged. Backend `Page_T_` envelope contract at `frontend/openapi/schema.json` matches.
- **FE-3 URL-state ↔ filter-state sync** at `fe-specs/FE-3-content.md:642–644` — `useRouter().replace()` (not `push`) so back-button doesn't accumulate filter noise. Catalogue's `?tab={tab}` tab state + paths/assignments filter state inherit this pattern.
- **FE-3 filter-bar pattern** at FE-3 §B.2 — debounced text search (300ms) + segmented filter buttons (`.seg` class). FE-8's pill/user/test list filters inherit unchanged.
- **FE-3 `meQueryKeys` precedent** at `fe-specs/FE-3-content.md:527–535`. FE-8 introduces `adminKeys` (§C.1) rooted at `['admin']`, mirroring the same shape (all / list(filters) / detail(id) hierarchy). No edit to FE-3's `meQueryKeys` library; FE-8 adds a sibling library in the same `frontend/src/lib/queries/` directory.

**Done-when (verbatim from `FE_ROADMAP.md:156–166`):** Admin can: create a subject → create a pill in it → propose-and-approve a pill → author a test with mixed question types → assign it to a group → see it appear on testee dashboards. **This file owns the first three steps** (subject + pill + propose-and-approve); the last three live in `fe-specs/FE-8-admin-tests.md` (author a test) and `fe-specs/FE-8-admin-identity.md` (assign → group → dashboard surface).

**Scope boundary — what this file explicitly does NOT ship:**

- **Pill safety-link curation.** AC-D21 says safety pills carry curated external link sets from the bootstrap cron (PR-024 P11 — `app/api/operations/safety_links.py`), NOT from admin UI. The pill editor exposes the `safety_relevant` boolean toggle ONLY; the link list itself is curated server-side. Verified against AC-D21 and SPEC §6.4. Surfaced as §F.1 + §H (b) item 4.
- **Pill-proposal edit-then-approve.** AC-D8 + `FE_ROADMAP.md:163` lock v1 at approve / reject only. No "edit the AI's proposal then approve" path. Reject → hand-author a replacement pill separately. Surfaced as §F.2.
- **Pill cloning / migration.** Design (`admin-authoring.jsx:228–229`) mentions cloning a pill to change locked fields once it's in use. v1 does not ship a clone affordance — the editor just locks the affected fields with copy explaining why. Cloning deferred to v1.x. Surfaced as §E item 4.
- **User management, group management, assignments.** Owned by `fe-specs/FE-8-admin-identity.md`.
- **Test authoring + question editor.** Owned by `fe-specs/FE-8-admin-tests.md`.
- **Engagement queue, grade-review, ops dashboard, cost dashboard, adaptive-loop approve/reject.** FE-9 territory (`admin-ops.jsx` + `admin.jsx`). FE-8 ships no consumer for `/v1/admin/engagement/pending` (referenced from FE-3 §B.1) or for `/v1/admin/loop/*` operations. Out-of-scope surfaces explicitly excluded in §F.4.
- **Subject deletion with cascade behaviour.** Backend exposes `DELETE /v1/subjects/{id}` (`frontend/openapi/schema.json:7879`); behaviour with pills attached is unspecified in the OpenAPI. v1 surfaces a delete affordance only when zero pills are attached to the subject; otherwise the delete button is disabled with a "subject has N pills" hint. Cascade-delete UX deferred to v1.x. Surfaced as §E item 3.

**Additions to `(admin)/layout.tsx`:** none beyond what FE-2 mounts. The shared `(admin)` shell from FE-2 hosts all FE-8 pages unchanged.

---

## A. Page/feature inventory

| # | Capability | Route / file | Design source | Screenshot |
|---|---|---|---|---|
| 1 | Catalogue shell — 4-tab page with URL state `?tab={pills,subjects,proposals,safety}`, admin role guard | `(admin)/catalogue/page.tsx` | `admin-authoring.jsx:10–44` (`AdminAuthoringMock`) | `v6-fe8-17-pill-crud.png` (only the pills tab is screenshotted; other tabs §E.1) |
| 2 | Pills tab — list + 5-variant modal (create / edit / submitting / errors / locked) | `(admin)/catalogue/_components/pills-tab.tsx` + `_components/pill-modal.tsx` | `admin-authoring.jsx:149–286` (`PillCrudMock`) | `v6-fe8-17-pill-crud.png` |
| 3 | Subjects tab — list + simpler create/edit modal | `(admin)/catalogue/_components/subjects-tab.tsx` + `_components/subject-modal.tsx` | not in prototype — §E.1 design-reference gap | absent — §E.1 |
| 4 | Proposals tab — AI-proposed pills queue with approve / reject row affordance (no modal, no edit-then-approve per AC-D8) | `(admin)/catalogue/_components/proposals-tab.tsx` | not in prototype — §E.1 design-reference gap | absent — §E.1 |
| 5 | Safety tab — pills with `safety_relevant === true`, safety-override toggle reuses `SafetyToggle` from pill modal | `(admin)/catalogue/_components/safety-tab.tsx` | `admin-authoring.jsx:321–351` (`SafetyToggle` reused) | inherits row 2 |
| 6 | Paths list — `/admin/paths` table view + 3-action row (Edit / Delete / new path button) | `(admin)/paths/page.tsx` + `_components/path-list.tsx` | `admin-authoring.jsx:767–803` (`PathListView`) | `v6-fe8-21-paths.png` |
| 7 | Path editor — `/admin/paths/[id]/edit` two-column form (path details left + assigned-to + mechanics right) with drag-reorder pill rows | `(admin)/paths/[pathId]/edit/page.tsx` + `_components/path-editor.tsx` + `_components/path-pill-row.tsx` | `admin-authoring.jsx:805–916` (`PathEditor` + `PathPillRow`) | `v6-fe8-21-paths.png` |

Seven rows. Capability #1 is the route shell (4-tab page); capabilities #2–#5 are tab-content capabilities composed under #1 (each tab a distinct `_components/*-tab.tsx`); capability #6 is the paths-list route shell; capability #7 is the path-editor route shell with its drag-reorder row composed under §B.7 §2.

URL state declared on row #1: `?tab={pills,subjects,proposals,safety}` (default `pills`). Paths list (#6) has no URL state in v1 (deferred filter/search to v1.x — §E item 5). Path editor (#7) is a single-resource route; no URL state.

---

## B. Per-page detail specs

> **Template** (used identically for every page; from `fe-specs/FE-1-auth.md:50–60`):
> 1. Route segment + URL state
> 2. Components (scaffold reused / new in this PR / shadcn primitive / design primitive)
> 3. API endpoints consumed
> 4. Form fields + zod rules + react-hook-form integration shape (or "n/a — read-only page" with TanStack Query notes)
> 5. States (every variant from the design state-strip + any extras the wire surfaces)
> 6. Acceptance criteria (Gherkin — each trio maps to one Vitest test)
> 7. Edge cases / gotchas
> 8. Visual reference

### B.1 Catalogue shell — `/admin/catalogue`

**1. Route segment + URL state**

- File: `frontend/src/app/(admin)/catalogue/page.tsx`. The `(admin)` route group exists per FE-2; the `catalogue/` segment + its `error.tsx` boundary file are FE-8-introduced.
- URL state: `?tab={pills|subjects|proposals|safety}` — default `pills` on mount if absent. Tab change calls `router.replace()` (not `push`) per FE-3 §C.7 precedent so back-button doesn't accumulate tab noise.
- Server-side: static `<title>Catalogue · Acumen</title>` from `layout.tsx`. No `generateMetadata` dynamic-title in v1.
- Nav-rail anchor: `shell.jsx:15` declares the admin nav id as `catalogue-admin` with label "Catalogue"; rail-highlight wiring per FE-2.

**2. Components**

- **Scaffold reused:** `useAuth()` (FE-1); `client` + `unwrap` (FE-0); `PageHeader` (FE-2); `useRouter`, `useSearchParams` from `next/navigation`.
- **New in this PR (catalogue shell scope):**
  - `CatalogueTabs` — 4-button segmented nav (`.seg` class per FE-2's globals.css) wired to `?tab=`. Active tab marked by `data-active="true"` per design.
  - `CatalogueHeader` — `PageHeader` with eyebrow "Pill catalogue" + serif-italic title that flips per tab ("Pills" / "Subjects" / "Proposals" / "Safety pills") + dynamic count from the tab's primary query.
- **Composed (defined under §B.2–§B.5 below):** `PillsTab`, `SubjectsTab`, `ProposalsTab`, `SafetyTab` — each its own §B entry.
- **shadcn primitives installed in this PR:** none beyond FE-2's installed set.
- **Design primitives reused:** `Pill` (FE-2) for tab-content status badges, `Stat` (FE-2 — none on the shell itself; nested tabs may use it). `.seg`, `.eyebrow`, `.h-display`, `.serif-it` design classes from FE-2 per AC-CD23.

**3. API endpoints consumed**

The shell itself fires no queries; each tab consumes its own. The active tab determines which queries mount.

| Endpoint | Purpose | Status |
|---|---|---|
| (delegated to tabs) | — | — |

**4. Form fields + zod + rhf**

n/a — read-only shell. Tab selection is local + URL state, no form. TanStack Query notes apply per tab in §B.2–§B.5.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `loading_initial` | Mount before any tab query resolves | `CatalogueHeader` renders eyebrow + title skeleton; tab nav renders fully (cheap); tab content area shows the active tab's skeleton (delegated per §B.2–§B.5). |
| `tab_pills_active` | `?tab=pills` (default) | `PillsTab` mounts; other tabs unmounted (React state, not lazy-load — Tab queries kept-fresh via TanStack Query cache once visited). |
| `tab_subjects_active` | `?tab=subjects` | `SubjectsTab` mounts. |
| `tab_proposals_active` | `?tab=proposals` | `ProposalsTab` mounts. |
| `tab_safety_active` | `?tab=safety` | `SafetyTab` mounts. |
| `tab_invalid` | URL `?tab=foo` not in the four-valid set | Fall back to `pills` (default); `router.replace('?tab=pills')` clears stale param. No error banner; silent recovery. |
| `error` | Any tab's query throws (non-404 — 5xx / network) | Pattern C boundary card mounts via `(admin)/catalogue/error.tsx`. Copy: "Couldn't load the catalogue." + "Try again" (resets boundary) + "Go to admin dashboard". |
| `role_mismatch` | Testee role hits `/admin/catalogue` | AC-CD20 `(admin)` layout guard redirects to `/403` before page mount (FE-1 §C.4 five-posture matrix locked). |
| `privacy_unacked` | Authed user with `privacy_ack_at === null` | AC-CD20 `(authed)` parent guard redirects to `/privacy` before the `(admin)` layout runs. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Admin lands on /admin/catalogue with no tab param
  Given an admin user opens /admin/catalogue
  And no ?tab query param is present
  When the page mounts
  Then the Pills tab is active
  And the URL replaces to /admin/catalogue?tab=pills
  And PillsTab mounts with its initial query in-flight
```

```gherkin
Scenario: Admin switches tab
  Given the Pills tab is active
  When the admin clicks the "Subjects" tab button
  Then the URL replaces to /admin/catalogue?tab=subjects
  And SubjectsTab mounts
  And PillsTab unmounts (its query stays cached)
```

```gherkin
Scenario: Invalid tab param falls back to default
  Given the admin opens /admin/catalogue?tab=foo
  When the page mounts
  Then the Pills tab activates
  And the URL replaces to /admin/catalogue?tab=pills
```

```gherkin
Scenario: Testee hits admin catalogue URL — 403
  Given a testee user opens /admin/catalogue
  When the (admin) layout-guard evaluates the role
  Then the user is redirected to /403
  And the catalogue page never mounts
```

```gherkin
Scenario: Initial fetch failure — Pattern C boundary
  Given an admin opens the catalogue page
  When the active tab's primary query throws (non-404 error — 5xx, network)
  Then catalogue/error.tsx renders with "Couldn't load the catalogue."
  And "Try again" resets the boundary and refetches
```

(Five total scenarios mapped to §D.2 catalogue-shell integration tests.)

**7. Edge cases / gotchas**

- **Tab queries are not lazy-mounted** — once a tab is visited, its `useInfiniteQuery` or `useQuery` stays in the TanStack cache so the second visit is instant. Switching back to a tab does NOT re-fire the query if `staleTime` (30s default per AC-CD21) hasn't elapsed.
- **No tab badge counters in v1** — design doesn't show counts on the tab buttons themselves (only on the active tab's eyebrow). Adding counts would require firing all four queries at mount, defeating the cache strategy.
- **`?tab=` URL state with `router.replace` not `push`** per FE-3 §C.7. Back button returns to whatever route preceded `/admin/catalogue`, not to each prior tab.
- **No deep link to a specific pill / subject / proposal** in v1. Click-through to edit-modal opens the modal as ephemeral state; the modal's open state is NOT in the URL (matches design's modal-as-overlay pattern, not modal-as-route). Future v1.x may add `?pill={id}&modal=edit`.

**8. Visual reference**

- `frontend/design-reference/prototype/admin-authoring.jsx:10–44` — `AdminAuthoringMock` shell with tab nav.
- `frontend/design-reference/prototype/shell.jsx:15` — `catalogue-admin` nav id wiring.
- Screenshot: `v6-fe8-17-pill-crud.png` (only pills tab is screenshotted; subjects / proposals / safety tabs are §E.1 design-reference gaps).

---

### B.2 Pills tab — list + 5-variant modal

**1. Route segment + URL state**

- File: `frontend/src/app/(admin)/catalogue/_components/pills-tab.tsx`. Composed under `/admin/catalogue?tab=pills`. No own URL segment.
- Filter URL state: `?q={search}&subject={subjectId}&difficulty={d}&status={draft|published|all}` — debounced text search via `q`, segmented filter for subject, difficulty, status. All filter changes call `router.replace()` per FE-3 §C.7.
- Modal state: NOT in URL (ephemeral). Modal-open state lives in `useState<{mode: 'create' | 'edit' | null, pillId?: string}>(null)` inside `PillsTab`.

**2. Components**

- **Scaffold reused:** `client` + `unwrap` + `ApiError` (FE-0); `useInfiniteQuery` + `useMutation` + `useQueryClient` (TanStack Query v5 per FE-3 §C.5); `useForm` + `zodResolver` (react-hook-form + zod per FE-1 §B.4); `applyApiErrorToForm` (FE-1, path: `frontend/src/lib/api/form-errors.ts` per §0).
- **New in this PR:**
  - `PillsTab` — top-level tab component. Renders `FilterBar` + `PillsTable` + (conditional) `PillModal`. Manages modal-open state.
  - `FilterBar` — reusable filter row (debounced text search 300ms + 3 segmented filters: subject / difficulty / status). Source pattern: FE-3 catalogue filter-bar per `fe-specs/FE-3-content.md` §B.2.2. **Extracted to `frontend/src/components/admin/filter-bar.tsx`** for reuse across FE-8 list pages (also consumed by `UsersList`, `TestsList` in sibling files).
  - `PillsTable` — table view per `admin-authoring.jsx:169–203` (`PillListBehind`). Columns: Pill name, Subject, Difficulty range (`Dmin–Dmax` mono), Safety (`<Pill tone="danger" mono>Safety</Pill>` or em-dash), Used in (count of tests referencing the pill — derived field; see §H (b) item 3), Status (`Draft` warn pill / `Published` ok pill via `discoverable` mapping — see §H (b) item 7), Edit action. Cursor-paginated via `useInfiniteQuery` + IntersectionObserver sentinel per FE-3 §C.5.
  - `PillModal` — 5-variant modal per `admin-authoring.jsx:205–286`. Variants: `create` (empty form, no banner), `edit` (pre-filled form, no banner), `submitting` (button shows "Saving…" + pulse-dot, fields disabled), `errors` (validation errors rendered inline per Pattern A), `locked` (pill is used in N tests — top warn banner + most fields read-only with lock icon; only Title + Description editable per AC-D17 historical-comparability).
  - `DifficultyRangeSlider` — two-handle range input rendering D1–D10 as 10 segmented buttons with in-range background per `admin-authoring.jsx:289–319`. Controlled `{min, max, onChange, disabled}` shape. Reused by `BenchmarkSection` in `fe-specs/FE-8-admin-tests.md` — extracted to `frontend/src/components/admin/difficulty-range-slider.tsx`.
  - `SafetyToggle` — single-toggle switch with copy-flip per `admin-authoring.jsx:321–351`. Controlled `{on, onChange, disabled}` shape. Used in pill modal + safety tab (`B.5`). Extracted to `frontend/src/components/admin/safety-toggle.tsx`.
- **shadcn primitives installed:** none beyond FE-2's set. Modal wraps shadcn `Dialog` styled with paper-card chrome to match `admin-authoring.jsx:49–67` (`Modal` design primitive).
- **Design primitives reused:** `Pill` (FE-2) for status + safety badges. `.tbl`, `.btn`, `.btn.btn-primary`, `.btn.btn-ghost`, `.btn.btn-sm`, `.card`, `.card-hd`, `.eyebrow`, `.h-3`, `.muted`, `.mono`, `.right`, `.num`, `.pulse-dot`, `.arrow` design classes from FE-2 per AC-CD23.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/pills?cursor={cursor}&limit=50&search={q}&subject_id={sid}` | List pills (cursor-paginated, server-side filters). Consumed by `PillsTable` via `useInfiniteQuery`. `staleTime: 30_000` per AC-CD21 default. | **Exists** at `frontend/openapi/schema.json:7129`. Returns `Page_PillResponse_`. **Filter query params confirmation pending — `search` + `subject_id` may not be wired server-side.** See §H (b) item 2. |
| `POST /v1/pills` | Create pill. Consumed by `PillModal` create variant. Returns `PillResponse`. | **Exists** at `frontend/openapi/schema.json:7263+`. Body: `PillCreate` schema. |
| `PATCH /v1/pills/{pill_id}` | Edit pill. Consumed by `PillModal` edit variant. Returns updated `PillResponse`. | **Exists** at `frontend/openapi/schema.json:2377+`. Body: `PillUpdate` schema (all fields optional). |
| `DELETE /v1/pills/{pill_id}` | Delete a pill. **Not wired in v1** — design uses `POST /v1/pills/{pill_id}/retire` (soft delete) for pills in use; hard delete only for never-used draft pills. See §H (b) item 1. | **Exists** at `frontend/openapi/schema.json:7263+` (DELETE) and `:7508` (retire endpoint). |
| `POST /v1/pills/{pill_id}/retire` | Soft-delete a pill that's referenced by published tests. Consumed by the future pill-delete affordance (deferred — design doesn't surface delete; see §E.4). | **Exists** at `frontend/openapi/schema.json:7508`. v1 surface: out-of-scope (no delete UI in pills tab). |
| `GET /v1/subjects?limit=200` | Subject options for the Subject dropdown in `PillModal` + the FilterBar's subject filter. Cached separately; consumed by `useQuery({ queryKey: adminKeys.subjects.list({}) })`. | **Exists** at `frontend/openapi/schema.json:7636`. Returns `Page_SubjectResponse_`. |

**Locked filter contract** (spec body — `q` + `subject_id` query params must be supported server-side or filtering moves client-side):

```ts
GET /v1/pills?cursor=<opaque>&limit=50&q=<text>&subject_id=<uuid> → Page_PillResponse_
```

**4. Form fields + zod + rhf**

```ts
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const pillFormSchema = z.object({
  name: z.string().min(1, "Title is required.").max(255),
  description: z.string().max(2048).optional().default(""),
  subject_id: z.string().uuid({ message: "Pick a subject." }),
  discoverable: z.boolean().default(true),                    // maps to design's "Status: Draft | Published"
  available_difficulty_min: z.number().int().min(1).max(10),
  available_difficulty_max: z.number().int().min(1).max(10),
  safety_relevant: z.boolean().default(false),
  estimated_minutes: z.number().int().positive().nullable().optional(),
}).refine(d => d.available_difficulty_min <= d.available_difficulty_max, {
  path: ["available_difficulty_max"],
  message: "Max difficulty must be ≥ min.",
});
type PillFormInput = z.infer<typeof pillFormSchema>;

const form = useForm<PillFormInput>({
  resolver: zodResolver(pillFormSchema),
  mode: "onSubmit",
  defaultValues: editingPill
    ? { ...editingPill, description: editingPill.description ?? "" }
    : { discoverable: true, safety_relevant: false, available_difficulty_min: 1, available_difficulty_max: 10 },
});
```

Submit handler:
1. `unwrap(client.POST("/v1/pills", { body: data }))` (create) OR `unwrap(client.PATCH("/v1/pills/{pill_id}", { params: { path: { pill_id } }, body: dirtyFieldsOnly }))` (edit) inside try/catch.
2. Success: `queryClient.invalidateQueries({ queryKey: adminKeys.pills.all() })`; toast.info("Pill saved"); close modal.
3. `ApiError`: `applyApiErrorToForm(err, form)` — 422 validation errors project onto field names per FE-1 §C.2. Non-field errors (e.g. `PILL_NAME_TAKEN` business code if it exists) fall through to root + Pattern B toast.

**Field-to-design mapping:**
- `name` → "Title" input (`admin-authoring.jsx:233–237`)
- `description` → "Description" textarea (`:239–243`)
- `subject_id` → "Subject" select (`:246–256`)
- `discoverable` → "Status" select (Draft / Published — `discoverable=false` = Draft, `discoverable=true` = Published) (`:257–262`). **§H (b) item 7: confirm this maps to `discoverable` field, not a separate `status` field on PillResponse.**
- `available_difficulty_min` / `available_difficulty_max` → `DifficultyRangeSlider` (`:265–268`)
- `safety_relevant` → `SafetyToggle` (`:270–273`)

**Locked-mode behaviour** (pill is referenced by ≥1 published test, per the `Used in` column on the list): the modal opens with a warn banner ("This pill is used in N published tests — most fields are locked to preserve historical comparability per AC-D17"). The following fields render with `locked` prop set (lock icon next to label, `readOnly`/`disabled` on input, sunk background): `discoverable`, `available_difficulty_min/max`, `safety_relevant`. Only `name` + `description` remain editable. Submit button stays enabled (it only saves the editable fields).

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `list_loading` | Initial `useInfiniteQuery` for pills in-flight | Table renders header + 10 skeleton rows. |
| `list_empty` | Response is `{ items: [], next_cursor: null }` (no pills exist) | Empty-state card with copy "No pills yet — add your first pill to start building the catalogue." + "Add pill" CTA. |
| `list_happy_first_page` | First page returns pills + `next_cursor !== null` | Table renders with N rows + IntersectionObserver sentinel visible. |
| `list_loading_more` | Sentinel intersected, `isFetchingNextPage === true` | Sentinel renders "Loading more pills…" spinner; existing rows unchanged. |
| `list_happy_no_more` | Response has `next_cursor === null` | Table renders; sentinel hidden. |
| `filter_search_typed` | User types in FilterBar text input | After 300ms debounce, `router.replace(?q={text})` fires; query refetches with new `q` param; pagination resets to first page. |
| `filter_subject_changed` | User clicks a subject segment in FilterBar | `router.replace(?subject={subjectId})` fires; query refetches; pagination resets. |
| `filter_difficulty_changed` | User picks a difficulty band in FilterBar | Same pattern as subject filter. |
| `filter_status_changed` | User picks `Draft` / `Published` / `All` in FilterBar status filter | Same pattern. Client-side filter on `discoverable` field (server may not support — §H (b) item 2). |
| `modal_create_open` | User clicks "+ Add pill" CTA | `PillModal` mounts with `variant="create"`; form pristine; Subject dropdown populated from `useQuery(adminKeys.subjects.list())`. |
| `modal_create_submitting` | User clicks "Create pill", rhf `isSubmitting === true` | Submit button shows pulse-dot + "Saving…"; fields disabled. |
| `modal_create_validation_errors` | zod `safeParse` fails OR backend 422 | Inline errors render under each failing field per Pattern A; root error if any (toast Pattern B fallback for non-field errors). |
| `modal_edit_open` | User clicks "Edit" row action | `PillModal` mounts with `variant="edit"`; form pre-filled from `useQuery(adminKeys.pills.detail(pillId))` cached response; lock-banner conditional on `usedInCount > 0`. |
| `modal_edit_locked` | Editing a pill where backend returns `usedInCount > 0` (see §H (b) item 3 — Used-In derivation) | Warn banner mounts at top of modal; lock icons appear next to locked field labels; locked inputs disabled with sunk background. |
| `modal_success` | Save returns 2xx | Modal closes; `adminKeys.pills.all()` invalidated; toast.info("Pill saved"); list refetches. |
| `modal_cancel` | User clicks Cancel | Modal closes without save; form state discarded. |
| `modal_close_with_dirty` | User clicks Cancel with `formState.isDirty === true` | Browser-native `confirm()` "Discard unsaved changes?" before close. v1 simple; no custom dialog. |
| `error` | List query throws (non-404) | Pattern C boundary card mounts via parent `(admin)/catalogue/error.tsx`. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Admin creates a new pill
  Given the Pills tab is active
  And the admin clicks "+ Add pill"
  When PillModal mounts in create variant
  And the admin enters Title "Cathodic Protection", picks Subject "Materials", sets difficulty range D2–D8, leaves safety off
  And clicks "Create pill"
  Then POST /v1/pills fires with {name, subject_id, available_difficulty_min: 2, available_difficulty_max: 8, discoverable: true, safety_relevant: false}
  And the response 201 returns the new PillResponse
  And toast.info("Pill saved") renders
  And the modal closes
  And the pills list refetches and shows the new pill
```

```gherkin
Scenario: Admin edits a pill that's not in use
  Given the admin clicks "Edit" on row "Antifouling Systems"
  And the pill has zero referencing tests
  When PillModal mounts in edit variant
  Then the form is pre-filled from /v1/pills/{id}
  And no warn banner renders
  And all fields are editable
```

```gherkin
Scenario: Admin edits a pill that's in use — locked-fields mode
  Given the admin clicks "Edit" on row "Antifouling Systems"
  And the pill is referenced by 14 published tests
  When PillModal mounts in edit variant
  Then the warn banner "This pill is used in 14 published tests" renders at the top
  And the discoverable, difficulty range, and safety-relevant fields render with lock icons and disabled inputs
  And the title and description fields remain editable
  And clicking "Save changes" PATCHes only the editable dirty fields
```

```gherkin
Scenario: Validation errors render inline
  Given the admin opens PillModal in create variant
  When the admin clicks "Create pill" without entering a title or subject
  Then zod surfaces "Title is required." under the Title field
  And "Pick a subject." under the Subject field
  And no network call is fired
```

```gherkin
Scenario: Backend 422 projects onto the right field
  Given the admin submits a pill with a name that the backend rejects (e.g. duplicate)
  When POST /v1/pills returns 422 with detail [{loc: ["body", "name"], msg: "name already exists", ...}]
  Then applyApiErrorToForm projects the error under the Title field
  And the modal stays open
  And no toast fires
```

```gherkin
Scenario: Difficulty range min > max rejected
  Given the admin sets min D8 and max D5
  When the admin clicks "Create pill"
  Then zod refine rule surfaces "Max difficulty must be ≥ min." under the max field
  And no network call is fired
```

```gherkin
Scenario: Filter by subject narrows the list
  Given the Pills tab is active with 137 pills loaded
  When the admin clicks the "Materials" subject filter
  Then the URL replaces to ?tab=pills&subject={materials-uuid}
  And GET /v1/pills refetches with subject_id={materials-uuid}
  And the list renders only Materials pills
```

```gherkin
Scenario: Filter text search debounces
  Given the Pills tab is active
  When the admin types "antifouling" in the FilterBar
  Then after 300ms idle the URL replaces to ?tab=pills&q=antifouling
  And GET /v1/pills refetches with q=antifouling
  And typing more characters within 300ms does NOT fire intermediate queries
```

```gherkin
Scenario: Pagination sentinel loads next page
  Given the Pills tab list shows 50 rows with hasNextPage true
  When the admin scrolls the sentinel into view
  Then fetchNextPage fires
  And the next 50 rows append below the first page
```

```gherkin
Scenario: Cancel with dirty form prompts confirm
  Given PillModal is open in create variant with title "Test"
  When the admin clicks Cancel
  Then browser confirm("Discard unsaved changes?") fires
  And on confirm OK the modal closes
  And on confirm Cancel the modal stays open
```

(Ten total scenarios mapped to §D.2 pills-tab integration tests.)

**7. Edge cases / gotchas**

- **`Used in` column derivation is not in `PillResponse`.** The OpenAPI `PillResponse` does not include `used_in_count` or similar. Two resolutions: (a) backend adds the field as a denormalised count, (b) frontend fires a parallel `GET /v1/tests?pill_id={id}` per row (N+1 problem). **§H (b) item 3 — verify backend has or will add `used_in_count` to `PillResponse` before build session opens.** v1 placeholder: render "—" in the column with a `// TODO(FE-8-build)` tag until the backend field lands.
- **`Status: Draft | Published` mapping.** Design shows Draft / Published as a status dropdown; OpenAPI `PillResponse` has no `status` field but has `discoverable: boolean`. Tentative mapping: `discoverable=false` → Draft, `discoverable=true` → Published. **§H (b) item 7 — verify with backend that this is the canonical mapping (not a separate `status` enum).**
- **Filter query params may not be wired server-side.** OpenAPI schema for `GET /v1/pills` parameters list isn't fully reproduced in this spec — `q` and `subject_id` may not exist. **§H (b) item 2 — verify the parameter set; if missing, filtering moves client-side with a warn note in §E.5.**
- **Modal-as-overlay, not modal-as-route.** Modal state is `useState`, not URL. Refreshing the page closes the modal; intentional v1 behaviour. Future v1.x may add deep-link modal state.
- **`Cancel with dirty` uses browser `confirm()`.** Simple v1; deferred custom dialog to v1.x. shadcn `AlertDialog` is in FE-2's installed set but design doesn't show a custom confirm flow for this case.
- **Optimistic updates not used.** All mutations wait for backend response before invalidating. Simpler error handling; design doesn't require optimistic UI.
- **Backend 8-char min vs zod 1-char min on name.** Zod allows any non-empty string; backend likely has stricter min (verify in §H (b) item 6). FE-1 precedent (B.3 §7) is to let backend's stricter rule win on submit — backend 422 surfaces under the field via `applyApiErrorToForm`.
- **`PillUpdate` PATCH dirty-fields-only.** Use rhf's `formState.dirtyFields` to build the PATCH body; sending unchanged fields is wasteful and may trigger needless audit log entries. Pattern: `const dirtyData = Object.fromEntries(Object.entries(formData).filter(([k]) => dirtyFields[k]))`.

**8. Visual reference**

- `frontend/design-reference/prototype/admin-authoring.jsx:149–167` — `PillCrudMock` (5-variant sub-state strip + list-behind + modal overlay).
- `frontend/design-reference/prototype/admin-authoring.jsx:169–203` — `PillListBehind` (table).
- `frontend/design-reference/prototype/admin-authoring.jsx:205–286` — `PillModal` (5 variants: create / edit / submitting / errors / locked).
- `frontend/design-reference/prototype/admin-authoring.jsx:289–319` — `DifficultyRangeSlider`.
- `frontend/design-reference/prototype/admin-authoring.jsx:321–351` — `SafetyToggle`.
- Screenshot: `v6-fe8-17-pill-crud.png`.

---

### B.3 Subjects tab — list + simpler modal

**1. Route segment + URL state**

- File: `frontend/src/app/(admin)/catalogue/_components/subjects-tab.tsx`. Composed under `/admin/catalogue?tab=subjects`.
- Filter URL state: `?q={search}` (single text search; subjects don't have nested taxonomy in v1).
- Modal state: ephemeral `useState`, not URL.

**2. Components**

- **Scaffold reused:** same as `PillsTab` §2.
- **New in this PR:**
  - `SubjectsTab` — top-level tab component. Renders simpler `FilterBar` (text-search only) + `SubjectsTable` + (conditional) `SubjectModal`.
  - `SubjectsTable` — columns: Subject name, Pill count (derived; see §H (b) item 3 sibling), Description, Edit + Delete row actions. Cursor-paginated per FE-3 §C.5.
  - `SubjectModal` — 2-variant modal: `create` (empty) and `edit` (pre-filled). Fields: name (required, 1–255), description (optional, 0–1024). No safety / discoverable / difficulty — subjects are containers only.
  - `DeleteSubjectModal` — confirmation modal when subject has zero pills (delete enabled) OR with a "blocked" message when subject has ≥1 pill (per scope boundary in §0).
- **shadcn primitives installed:** none beyond FE-2's set.
- **Design primitives reused:** `Pill` for nothing in v1 (subjects are unstyled). `.tbl`, `.card`, `.eyebrow`, `.btn` classes per FE-2.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/subjects?cursor={cursor}&limit=50&q={text}` | List subjects. Consumed by `SubjectsTable`. | **Exists** at `frontend/openapi/schema.json:7636`. Returns `Page_SubjectResponse_`. `q` query param verification — §H (b) item 2. |
| `POST /v1/subjects` | Create subject. Consumed by `SubjectModal` create. | **Exists** at `frontend/openapi/schema.json:7636+` (POST verb). Body: `SubjectCreate` schema. |
| `PATCH /v1/subjects/{subject_id}` | Edit subject. Consumed by `SubjectModal` edit. | **Exists** at `frontend/openapi/schema.json:7770+`. Body: `SubjectUpdate`. |
| `DELETE /v1/subjects/{subject_id}` | Delete subject. Behaviour with attached pills is unspecified; v1 only fires when pill count is zero. | **Exists** at `frontend/openapi/schema.json:7879`. v1 gates by client-side pill-count check. §H (b) item 5. |

**4. Form fields + zod + rhf**

```ts
const subjectFormSchema = z.object({
  name: z.string().min(1, "Subject name is required.").max(255),
  description: z.string().max(1024).optional().default(""),
});
type SubjectFormInput = z.infer<typeof subjectFormSchema>;
```

Submit pattern identical to `PillModal` §B.2 §4 — `unwrap` + try/catch + `applyApiErrorToForm` on `ApiError` + invalidate `adminKeys.subjects.all()` on success.

**5. States**

Same shape as `PillsTab` §B.2 §5 minus the locked-mode variant (subjects don't lock-on-use in v1):

| State | Trigger | Visual |
|---|---|---|
| `list_loading` / `list_empty` / `list_happy_first_page` / `list_loading_more` / `list_happy_no_more` | (mirrors PillsTab) | (mirrors PillsTab) |
| `filter_search_typed` | User types in FilterBar | Debounced 300ms; URL replaces; refetch. |
| `modal_create_open` / `modal_create_submitting` / `modal_create_validation_errors` / `modal_edit_open` / `modal_success` / `modal_cancel` | (mirrors PillsTab) | (mirrors PillsTab) |
| `delete_confirm_open_clean` | Admin clicks Delete on a subject with `pill_count === 0` | `DeleteSubjectModal` mounts with "Delete this subject? It has no pills." + Cancel + Delete buttons. |
| `delete_confirm_blocked` | Admin clicks Delete on a subject with `pill_count > 0` | `DeleteSubjectModal` mounts with "Can't delete — this subject has {N} pills. Re-assign or delete the pills first." Delete button disabled. |
| `delete_submitting` | Admin clicks Delete in clean-state modal | DELETE /v1/subjects/{id} fires; on success modal closes + list refetches + toast.info("Subject deleted"). |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Admin creates a new subject
  Given the Subjects tab is active
  When the admin clicks "+ Add subject" and enters name "Welding"
  And clicks "Create subject"
  Then POST /v1/subjects fires with {name: "Welding"}
  And the modal closes
  And the list refetches
```

```gherkin
Scenario: Admin tries to delete a subject with pills
  Given the admin clicks Delete on subject "Materials" which has 14 pills
  When DeleteSubjectModal mounts
  Then the modal shows "Can't delete — this subject has 14 pills"
  And the Delete button is disabled
```

```gherkin
Scenario: Admin deletes an empty subject
  Given the admin clicks Delete on subject "Welding" which has 0 pills
  And clicks Delete in the confirmation modal
  When DELETE /v1/subjects/{id} returns 204
  Then toast.info("Subject deleted") renders
  And the modal closes
  And the list refetches without the deleted subject
```

```gherkin
Scenario: Subject name validation
  Given the admin opens SubjectModal in create variant
  When the admin submits with empty name
  Then zod surfaces "Subject name is required."
```

```gherkin
Scenario: Subject filter by text search
  Given 30 subjects are loaded
  When the admin types "ma" in FilterBar
  Then after 300ms the URL replaces to ?tab=subjects&q=ma
  And the list refetches with q=ma
```

(Five total scenarios mapped to §D.2 subjects-tab integration tests.)

**7. Edge cases / gotchas**

- **`pill_count` derivation.** Same as pills' `used_in_count` — not in OpenAPI `SubjectResponse`. **§H (b) item 3 covers both.** v1 placeholder: render "—" in the column until backend lands the field.
- **No description on `SubjectResponse`?** Verify — `frontend/openapi/schema.json:2866+` should have the field per `SubjectCreate` having it. If absent, surfacing in modal-edit pre-fill defaults to empty string.
- **No screenshot for this tab.** §E.1 records the design-reference gap; spec body locks the structure from the FE-1 + pills-tab patterns by inheritance.

**8. Visual reference**

- No prototype JSX or screenshot for the Subjects tab. §E.1 records the gap. Spec body inherits the FE-1 + `PillsTab` patterns for the modal and table structure.

---

### B.4 Proposals tab — AI-proposed pills queue (approve / reject)

**1. Route segment + URL state**

- File: `frontend/src/app/(admin)/catalogue/_components/proposals-tab.tsx`. Composed under `/admin/catalogue?tab=proposals`.
- Filter URL state: `?status={pending|approved|rejected|all}` (default `pending`). No text search in v1 (proposal volume is low).
- Modal state: NO modal in v1. Approve / reject fire as inline row actions per the "no edit-then-approve in v1" rule (AC-D8 + `FE_ROADMAP.md:163`).

**2. Components**

- **Scaffold reused:** same as `PillsTab` §2.
- **New in this PR:**
  - `ProposalsTab` — top-level tab. Renders status segmented filter + `ProposalsTable`.
  - `ProposalsTable` — columns: Created at (relative), Pill payload preview (name + subject + brief — extracted from `proposal.payload`), Status badge (Pending / Approved / Rejected pill), Approve + Reject row actions (rendered only when `status === "pending"`). Cursor-paginated per FE-3 §C.5.
  - `ProposalDetailDrawer` (right-side drawer, NOT modal) — opens when admin clicks a proposal row. Shows full `payload` as a read-only display (formatted JSON or structured fields, depending on `payload` shape — see §H (a) item 2). Drawer has Approve + Reject buttons at the bottom.
- **shadcn primitives installed:** `Sheet` (shadcn drawer). **Add to FE-2's installed set; AC-CD-structural addition fold.** Note in §F.3.
- **Design primitives reused:** `Pill` for status badges. `.tbl`, `.card`, `.t-meta`, `.btn` per FE-2.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/pill-proposals?cursor={cursor}&limit=50&status={status}` | List pill proposals. Consumed by `ProposalsTable`. | **Exists** at `frontend/openapi/schema.json:6860`. Returns `Page_PillProposalResponse_`. `status` query param verification — §H (b) item 2. |
| `POST /v1/pill-proposals/{proposal_id}/approve` | Approve a proposal — backend converts the proposal payload into a real pill row. | **Exists** at `frontend/openapi/schema.json:6994`. Empty body. Returns updated `PillProposalResponse` with `status="approved"`. |
| `POST /v1/pill-proposals/{proposal_id}/reject` | Reject a proposal. | **Exists** at `frontend/openapi/schema.json:7053`. Empty body. Returns updated `PillProposalResponse` with `status="rejected"`. |

**4. Form fields + zod + rhf**

n/a — no forms. Approve / reject are bare mutations.

```ts
const approveMutation = useMutation({
  mutationFn: (proposalId: string) =>
    unwrap(client.POST("/v1/pill-proposals/{proposal_id}/approve", { params: { path: { proposal_id: proposalId } } })),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: adminKeys.proposals.all() });
    queryClient.invalidateQueries({ queryKey: adminKeys.pills.all() }); // approved proposal creates a pill
    toast.info("Proposal approved — pill created in catalogue");
  },
  onError: (err) => toast.error(err.message || "Couldn't approve proposal — try again"),
});

const rejectMutation = useMutation({
  mutationFn: (proposalId: string) =>
    unwrap(client.POST("/v1/pill-proposals/{proposal_id}/reject", { params: { path: { proposal_id: proposalId } } })),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: adminKeys.proposals.all() });
    toast.info("Proposal rejected");
  },
  onError: (err) => toast.error(err.message || "Couldn't reject proposal — try again"),
});
```

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `list_loading` / `list_empty_no_pending` / `list_happy_first_page` / `list_loading_more` / `list_happy_no_more` | (mirrors PillsTab list states) | Empty state copy when status filter is `pending` and zero results: "No proposals waiting for review — AI-proposed pills will appear here as the catalogue evolves." |
| `filter_status_changed` | Admin clicks Approved / Rejected / All segment | URL replaces; refetch. |
| `drawer_open` | Admin clicks a row | `ProposalDetailDrawer` mounts from the right (`Sheet`). Reads `proposal.payload` (untyped `object` per `frontend/openapi/schema.json:2230–2239` — §H (a) item 2). Renders structured fields if payload shape is known, otherwise formatted JSON. |
| `approve_submitting` | Admin clicks Approve (from row or drawer) | Button shows spinner; row dims; on success the proposal status flips to "approved" + a new pill appears in `/admin/catalogue?tab=pills`. |
| `reject_submitting` | Admin clicks Reject | Similar to approve; proposal status flips to "rejected". |
| `approve_error` / `reject_error` | Mutation throws | Pattern B error toast surfaces; row remounts to pending state. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Admin views pending proposals on tab mount
  Given the Proposals tab is active with no filter param
  When the page mounts
  Then the URL replaces to ?tab=proposals&status=pending
  And GET /v1/pill-proposals?status=pending fires
  And the table renders pending proposals
```

```gherkin
Scenario: Admin approves a proposal — pill is created
  Given a pending proposal "Cathodic Protection Field Inspection" is visible
  When the admin clicks "Approve" on the row
  And POST /v1/pill-proposals/{id}/approve returns 200
  Then toast.info("Proposal approved — pill created in catalogue") renders
  And the proposal row updates to status "approved" (or disappears if filter is "pending")
  And adminKeys.pills.all() is invalidated (Pills tab refetches on next visit)
```

```gherkin
Scenario: Admin rejects a proposal
  Given a pending proposal is visible
  When the admin clicks "Reject"
  And POST /v1/pill-proposals/{id}/reject returns 200
  Then toast.info("Proposal rejected") renders
  And the proposal row updates to status "rejected"
```

```gherkin
Scenario: Admin opens proposal drawer to inspect payload
  Given a pending proposal row
  When the admin clicks the row body (not the action buttons)
  Then ProposalDetailDrawer opens from the right
  And it renders the proposal payload contents
  And the Approve + Reject buttons appear at the bottom of the drawer
```

```gherkin
Scenario: Approve mutation fails — error toast
  Given a pending proposal
  When the admin clicks Approve
  And POST /.../approve throws 500
  Then a Pattern B error toast renders with the backend message
  And the row stays in pending state
```

```gherkin
Scenario: Admin switches filter to Approved
  Given the Proposals tab is active with status=pending
  When the admin clicks the "Approved" segment
  Then the URL replaces to ?tab=proposals&status=approved
  And the table refetches with status=approved
```

```gherkin
Scenario: No edit-then-approve affordance in v1
  Given a proposal drawer is open
  When the admin scans the drawer
  Then there is NO "Edit and approve" button
  And the payload renders as read-only
```

(Seven total scenarios mapped to §D.2 proposals-tab integration tests.)

**7. Edge cases / gotchas**

- **`PillProposalResponse.payload` is untyped (`object`).** `frontend/openapi/schema.json:2230–2239` declares `payload: object | null`. The drawer renders defensively: if `payload` has known fields (name, subject hint, description, difficulty hint), render structured rows; otherwise fall back to formatted JSON. **§H (a) item 2 — request backend types the payload contract before build session opens, OR confirm "formatted JSON fallback is acceptable for v1".**
- **Approve creates a pill — but with what subject?** If the proposal payload contains a subject suggestion, the backend resolves it to a `subject_id` at approve time. If subject suggestion is missing, backend behaviour is unclear — does it 422 or create with a default subject? **§H (b) item 8 — verify approve-without-subject behaviour.**
- **Reject is final in v1.** No undo affordance. Rejected proposals stay in the list (filterable via status filter) but cannot be reverted to pending. Design doesn't show an "Unreject" path. Surfaced as §F.2.
- **Drawer over modal.** Chose drawer (`Sheet`) over modal because the payload may be lengthy (multi-paragraph description, difficulty rationale, related pills suggestions) and drawers handle scrolling better. Modal-as-overlay still used for pill / subject CRUD because those forms are short.

**8. Visual reference**

- No prototype JSX or screenshot for the Proposals tab. Spec body inherits the FE-1 + Pills patterns + adds the row-action affordance documented above. **§E.1 covers the gap.**

---

### B.5 Safety tab — pills with safety_relevant=true + override toggle

**1. Route segment + URL state**

- File: `frontend/src/app/(admin)/catalogue/_components/safety-tab.tsx`. Composed under `/admin/catalogue?tab=safety`.
- Filter URL state: `?q={search}&subject={subjectId}` (no status filter — all rows are `safety_relevant=true` by definition).
- Modal state: ephemeral confirm modal for override-off toggle (high-impact action — see §5).

**2. Components**

- **Scaffold reused:** same as `PillsTab` §2.
- **New in this PR:**
  - `SafetyTab` — top-level tab. Renders `FilterBar` + `SafetyPillsTable`.
  - `SafetyPillsTable` — columns: Pill name, Subject, Override status (Auto-derived / Admin override since {date}), Toggle action (flips `safety_relevant` via `POST /v1/pills/{id}/safety`), Edit row action (opens `PillModal` from B.2). Cursor-paginated per FE-3 §C.5.
  - `SafetyOverrideConfirmModal` — confirmation modal when toggling OFF (i.e., admin sets `safety_relevant=false` on a pill currently `true`). High-impact because it re-enables AI teaching material generation per AC-D21. Toggling ON has no confirm step (additive — adds safety treatment).
- **shadcn primitives installed:** none beyond FE-2's set + `Sheet` added in B.4.
- **Design primitives reused:** `Pill` (FE-2) for the "Safety" badge + override-source badge ("Auto" / "Admin"). `SafetyToggle` from B.2 reused.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/pills?cursor={cursor}&limit=50&safety_relevant=true&q={text}&subject_id={sid}` | List safety pills only. Consumed by `SafetyPillsTable`. | **Exists** (same endpoint as B.2). `safety_relevant=true` filter param verification — §H (b) item 2. |
| `POST /v1/pills/{pill_id}/safety` | Toggle the safety_relevant flag. Body: `{ safety_relevant: boolean }`. | **Exists** at `frontend/openapi/schema.json:7567`. Request schema `PillSafetyOverride` at `:2363`. Returns updated `PillResponse`. |

**4. Form fields + zod + rhf**

n/a — single-toggle mutation, no form.

```ts
const safetyToggleMutation = useMutation({
  mutationFn: ({ pillId, value }: { pillId: string; value: boolean }) =>
    unwrap(client.POST("/v1/pills/{pill_id}/safety", {
      params: { path: { pill_id: pillId } },
      body: { safety_relevant: value },
    })),
  onSuccess: (updatedPill) => {
    queryClient.setQueryData(adminKeys.pills.detail(updatedPill.id), updatedPill);
    queryClient.invalidateQueries({ queryKey: adminKeys.pills.all() });
    toast.info(updatedPill.safety_relevant ? "Marked safety-relevant" : "Safety override removed");
  },
  onError: (err) => toast.error(err.message || "Couldn't update safety flag"),
});
```

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `list_loading` / `list_empty` / `list_happy_*` | (mirrors PillsTab) | Empty: "No safety-tagged pills yet." |
| `filter_search_typed` / `filter_subject_changed` | (mirrors PillsTab) | (mirrors PillsTab) |
| `row_override_source_auto` | Pill has `safety_relevant_overridden_at === null` | Override-source badge renders `<Pill tone="soft" mono>Auto</Pill>` — derived by AC-D21 cron, no admin action. |
| `row_override_source_admin` | Pill has `safety_relevant_overridden_at !== null` | Override-source badge renders `<Pill tone="warn" mono>Admin · {relative date}</Pill>` — admin manually overrode the auto-derivation. |
| `toggle_on_optimistic` | Admin clicks toggle to flip OFF → ON | `safetyToggleMutation` fires with `value=true`; row UI flips immediately (optimistic); on success toast confirms; on failure rollback + error toast. |
| `toggle_off_confirm` | Admin clicks toggle to flip ON → OFF | `SafetyOverrideConfirmModal` mounts: "Remove safety override for {pill name}? Acumen will resume generating AI teaching material for this pill per AC-D21." Cancel + Confirm buttons. |
| `toggle_off_submitting` | Admin confirms in the override-off modal | Mutation fires with `value=false`; modal closes on success; toast confirms; row updates. |
| `edit_row_action` | Admin clicks Edit on a row | Reuses `PillModal` from B.2 in edit variant. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Safety tab lists only safety-relevant pills
  Given the Safety tab is active
  When GET /v1/pills?safety_relevant=true fires
  Then the table renders only pills with safety_relevant=true
  And every row shows a "Safety" badge
```

```gherkin
Scenario: Override-source badge differs by source
  Given pill A is safety-tagged with safety_relevant_overridden_at=null
  And pill B is safety-tagged with safety_relevant_overridden_at=2026-04-12T10:00:00Z
  When the rows render
  Then pill A shows "Auto" badge
  And pill B shows "Admin · 6 weeks ago" badge
```

```gherkin
Scenario: Admin removes a safety override (turns off)
  Given pill A is safety-relevant=true
  When the admin clicks the toggle to flip it OFF
  Then SafetyOverrideConfirmModal mounts
  And the modal copy mentions resuming AI teaching material per AC-D21
  When the admin clicks Confirm
  Then POST /v1/pills/{id}/safety fires with {safety_relevant: false}
  And on 2xx the row updates and toast.info("Safety override removed") renders
```

```gherkin
Scenario: Admin marks a pill safety-relevant (turns on) — no confirm
  Given pill C is safety_relevant=false
  When the admin clicks the toggle to flip it ON
  Then NO confirm modal mounts (additive action, low-risk)
  And POST /v1/pills/{id}/safety fires with {safety_relevant: true}
  And on 2xx the row updates and toast.info("Marked safety-relevant") renders
```

```gherkin
Scenario: Safety toggle mutation fails — rollback
  Given pill A is safety_relevant=true
  When the admin tries to toggle it OFF, confirms, and the mutation throws 500
  Then the row reverts to the pre-toggle state
  And a Pattern B error toast renders
```

```gherkin
Scenario: Filter by subject narrows the safety list
  Given the Safety tab is active
  When the admin picks subject "Safety" in FilterBar
  Then URL replaces to ?tab=safety&subject={safety-uuid}
  And GET /v1/pills refetches with safety_relevant=true&subject_id={safety-uuid}
```

(Six total scenarios mapped to §D.2 safety-tab integration tests.)

**7. Edge cases / gotchas**

- **The Pills tab and Safety tab share `adminKeys.pills.*` cache.** Toggling a pill's safety in the Safety tab invalidates the Pills tab's cache (next visit refetches with the new safety state). Vice-versa: editing safety in `PillModal` (B.2) also propagates.
- **`safety_relevant_overridden_at` may be `null` even when `safety_relevant === true`.** That means the auto-derivation set the flag (AC-D21 cron). Override badge shows "Auto". Admin-set means the timestamp is non-null. Spec body relies on this contract; verify in §H (b) item 4.
- **No filter for `Auto vs Admin override` in v1.** Could be added in v1.x; for now both sources interleave in the list ordered by name.
- **Confirm modal copy must cite AC-D21.** "AI teaching material" is the key phrase — surfaces the safety regime to the admin who's about to remove it.

**8. Visual reference**

- `frontend/design-reference/prototype/admin-authoring.jsx:321–351` — `SafetyToggle` (reused).
- No dedicated screenshot for the Safety tab; inherits `v6-fe8-17-pill-crud.png` for the table treatment.

---

### B.6 Paths list — `/admin/paths`

**1. Route segment + URL state**

- File: `frontend/src/app/(admin)/paths/page.tsx`. The `(admin)` route group exists per FE-2; the `paths/` segment + its `error.tsx` boundary file are FE-8-introduced.
- URL state: none in v1. (Filter / search deferred to v1.x per §E item 5.)
- Static `<title>Learning paths · Acumen</title>`.
- Nav-rail anchor: `shell.jsx` admin nav `paths` id (FE-2 adds the rail entry; verify §H (b) item 9).

**2. Components**

- **Scaffold reused:** same as `PillsTab` §2.
- **New in this PR:**
  - `PathsListPage` — top-level page. Renders `PageHeader` + "+ Add path" CTA + `PathsTable`.
  - `PathsTable` — columns per `admin-authoring.jsx:777–800`: Name, Pills count, Assigned to (text summary — "14 testees" or "Seniors group"), Last edited (relative), Edit + Delete row actions. Cursor-paginated.
  - `PathCreateInline` — clicking "+ Add path" navigates directly to `/admin/paths/new/edit` (no modal; the editor is a full page). Alternative: a thin modal asking name + description, then navigates to the editor. Design shows a button → direct-to-editor pattern; v1 follows that.
  - `DeletePathConfirmModal` — confirmation modal: "Delete path '{name}'? Bound assignments will lose their reference (testees keep their attempt history). This action can't be undone." Cancel + Delete buttons.
- **shadcn primitives installed:** none beyond FE-2's set.
- **Design primitives reused:** standard table + button + `Pill` classes per FE-2.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/learning-paths?cursor={cursor}&limit=50` | List learning paths. | **Exists** at `frontend/openapi/schema.json:6550`. Returns `Page_LearningPathResponse_`. |
| `POST /v1/learning-paths` | Create path (called from `PathEditor` B.7 on first save of a new path). | **Exists** at `frontend/openapi/schema.json:6550+` (POST verb). Body: `LearningPathCreate`. |
| `DELETE /v1/learning-paths/{path_id}` | Delete path. Backend behaviour with bound assignments unspecified — likely cascades to remove the reference (assignments survive but lose the path). §H (b) item 11. | **Exists** at `frontend/openapi/schema.json:6684+`. v1 fires after confirm modal accepts. |

**4. Form fields + zod + rhf**

n/a — read-only list. Create flow navigates to the editor (`B.7`); delete is a bare mutation with confirm.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `list_loading` / `list_empty` / `list_happy_*` | (mirrors PillsTab) | Empty: "No learning paths yet — add your first path to bundle pills into a curriculum." |
| `add_path_clicked` | Admin clicks "+ Add path" | `router.push('/admin/paths/new/edit')` — navigates to PathEditor (§B.7) in create mode. |
| `edit_row_clicked` | Admin clicks Edit on a row | `router.push('/admin/paths/{pathId}/edit')`. |
| `delete_confirm_open` | Admin clicks Delete on a row | `DeletePathConfirmModal` mounts. |
| `delete_submitting` | Admin confirms delete | DELETE fires; on 2xx list invalidates + toast.info("Path deleted"). |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Paths list renders existing paths
  Given the admin opens /admin/paths
  When GET /v1/learning-paths returns 4 paths
  Then PathsTable renders 4 rows with name, pill count, assigned-to summary, last-edited
```

```gherkin
Scenario: Add path navigates to the editor
  Given the paths list is rendered
  When the admin clicks "+ Add path"
  Then router.push fires with /admin/paths/new/edit
```

```gherkin
Scenario: Delete confirm modal warns about assignment unbinding
  Given the admin clicks Delete on path "Q3 2026 induction"
  When DeletePathConfirmModal mounts
  Then the modal warns that "bound assignments will lose their reference"
  And the Delete button requires explicit confirm
```

```gherkin
Scenario: Empty list
  Given no learning paths exist
  When the page mounts
  Then the empty-state copy renders
  And the "+ Add path" CTA is the primary affordance
```

(Four total scenarios mapped to §D.2 paths-list integration tests.)

**7. Edge cases / gotchas**

- **`/admin/paths/new/edit` vs `/admin/paths/new`?** Use `/admin/paths/new/edit` so the editor page handles both create + edit modes via path param. Next 15 dynamic route `[pathId]/edit/page.tsx`; the literal `new` is a magic value the editor recognises. v1 acceptable; cleaner refactor (separate `/new` route) deferred to v1.x.
- **`assigned_to` summary derivation.** Not in `LearningPathResponse` (verify — `frontend/openapi/schema.json:1615+`). If absent, render "—" until backend lands the field. **§H (b) item 10 covers this.**
- **No filter / search in v1.** Path count is low (≤20 in v1 SiteMesh deployment); pagination cap of 50 handles it. v1.x adds search.

**8. Visual reference**

- `frontend/design-reference/prototype/admin-authoring.jsx:767–803` — `PathListView`.
- Screenshot: `v6-fe8-21-paths.png`.

---

### B.7 Path editor — `/admin/paths/[pathId]/edit`

**1. Route segment + URL state**

- File: `frontend/src/app/(admin)/paths/[pathId]/edit/page.tsx`. Dynamic param `pathId` — value `"new"` triggers create-mode (no fetch), any UUID triggers edit-mode (fetch the path on mount).
- URL state: none. All editor state is local rhf form state + local pill-array state. Save → navigate back to `/admin/paths`.
- Static `<title>Edit learning path · Acumen</title>` (in edit mode; "New learning path · Acumen" in create mode).

**2. Components**

- **Scaffold reused:** same as `PillsTab` §2 + `useForm` (rhf) + `useFieldArray` (rhf for the pill-array drag-reorder).
- **New in this PR:**
  - `PathEditorPage` — top-level page. Two-column layout per `admin-authoring.jsx:819–878`. Left column (col-span-7): path details card (name + description fields) + pills-in-path list with drag-handle reorder + "+ Add pill to this path" button. Right column (col-span-5): "Assigned to" sunk-card (member-avatar stack derived from assignments — read-only display) + "Path mechanics" sunk-card (explainer bullets, static copy).
  - `PathPillsList` — drag-reorder list per `admin-authoring.jsx:830–847`. Uses `@dnd-kit/core` + `@dnd-kit/sortable` for drag-reorder. **New runtime dep** — AC-CD-structural addition fold (§F.3).
  - `PathPillRow` — single row per `admin-authoring.jsx:883–916`. Drag handle (6-dot icon) + ordinal (`01`, `02`, etc — serif large display) + pill name + subject/difficulty meta + Remove action. Drag styling per design (translate + rotate + shadow when active).
  - `AddPillToPathModal` — opens when admin clicks "+ Add pill to this path". Reuses `PillsTable` (B.2) in a multi-select picker mode (different `isPicker` prop): rows have checkboxes instead of Edit actions; submit adds selected pill_ids to the path's pill array.
  - `PathDetailsForm` — wraps the name + description fields with rhf `useForm`. Schema:
    ```ts
    const pathDetailsSchema = z.object({
      name: z.string().min(1, "Path name is required.").max(255),
      description: z.string().max(2048).optional().default(""),
    });
    ```
- **shadcn primitives installed:** none beyond FE-2's set.
- **Design primitives reused:** `PageHeader` (FE-2) for top eyebrow + serif title + action buttons; `.card`, `.card.sunk`, `.col-span-7`, `.col-span-5`, `.grid-12`, `.eyebrow` per FE-2.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/learning-paths/{path_id}` | Fetch existing path. Skipped in create mode (`pathId === "new"`). | **Exists** at `frontend/openapi/schema.json:6684`. Returns `LearningPathResponse`. |
| `POST /v1/learning-paths` | Create path (called on first save in create mode). | **Exists** at `frontend/openapi/schema.json:6550+`. Body: `LearningPathCreate` (`{name, description, pill_ids[]}`). |
| `PATCH /v1/learning-paths/{path_id}` | Update path (called on save in edit mode). Body: `LearningPathUpdate` (partial). Includes `pill_ids[]` in canonical order — backend treats the array as a full replacement. | **Exists** at `frontend/openapi/schema.json:6684+`. |
| `GET /v1/pills?limit=200` | Pill picker source (in `AddPillToPathModal`). Uses adminKeys.pills.list({}) cache shared with PillsTab. | (same as B.2) |

**4. Form fields + zod + rhf**

```ts
const pathFormSchema = z.object({
  name: z.string().min(1, "Path name is required.").max(255),
  description: z.string().max(2048).optional().default(""),
  pill_ids: z.array(z.string().uuid()).min(1, "Add at least one pill to the path."),
});
type PathFormInput = z.infer<typeof pathFormSchema>;

const form = useForm<PathFormInput>({
  resolver: zodResolver(pathFormSchema),
  mode: "onSubmit",
  defaultValues: pathData
    ? { name: pathData.name, description: pathData.description ?? "", pill_ids: pathData.pill_ids ?? [] }
    : { name: "", description: "", pill_ids: [] },
});

const { fields, move, append, remove } = useFieldArray({ control: form.control, name: "pill_ids" });
```

Drag-reorder handler: `move(fromIndex, toIndex)` (rhf's `useFieldArray`).
Add-pill handler: `append(pillId)` once for each pill selected in `AddPillToPathModal`.
Remove handler: `remove(index)`.

Submit handler:
1. Create mode: `unwrap(client.POST("/v1/learning-paths", { body: data }))`.
2. Edit mode: `unwrap(client.PATCH("/v1/learning-paths/{path_id}", { params: { path: { path_id } }, body: data }))`.
3. Success: invalidate `adminKeys.paths.all()`; toast.info("Path saved"); `router.push('/admin/paths')`.
4. `ApiError`: `applyApiErrorToForm(err, form)`.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `create_mount` | `pathId === "new"` | Form pristine; pill_ids empty; "Assigned to" panel hidden (no path means no assignments); page title "Create learning path". |
| `edit_loading` | `pathId !== "new"` and `GET /v1/learning-paths/{id}` in-flight | Two-column skeleton: form fields as input skeletons, pill rows as 6 grey row skeletons, "Assigned to" stat skeleton. |
| `edit_happy` | Fetch resolves | Form pre-filled; pill rows render in canonical order; "Assigned to" panel renders avatars + count from derived field (`assigned_count` — verify in §H (b) item 10). |
| `pill_drag_start` | User mouse-down on a drag handle | Row gets `dragging` styling (translateY -6px, rotate -0.5deg, shadow-2) per `admin-authoring.jsx:892–896`. |
| `pill_drop` | User releases on a different position | `move(fromIndex, toIndex)` fires; rows reorder. |
| `pill_remove_clicked` | User clicks Remove on a row | `remove(index)` fires; row disappears. No confirm in v1 (low-risk; admin can re-add). |
| `add_pill_modal_open` | User clicks "+ Add pill to this path" | `AddPillToPathModal` mounts with `PillsTable` in picker mode. |
| `add_pill_modal_submit` | User selects N pills + clicks "Add N pills" | Modal closes; `append(pillId)` × N fires; new rows render at the end of the list. |
| `submit_pristine_empty_array` | User clicks Save with empty `pill_ids` | zod surfaces "Add at least one pill to the path."; submit blocked. |
| `submit_submitting` | rhf `isSubmitting === true` | Save button: pulse-dot + "Saving…"; cancel disabled. |
| `submit_success_create` | Create mode 2xx | toast.info("Path created"); `router.push('/admin/paths')`. |
| `submit_success_edit` | Edit mode 2xx | toast.info("Path saved"); `router.push('/admin/paths')`. |
| `submit_validation_errors` | 422 from backend | `applyApiErrorToForm` projects errors onto fields. |
| `cancel_dirty` | User clicks Cancel with dirty form | Browser `confirm("Discard unsaved changes?")` before navigation. |
| `error` | `GET /v1/learning-paths/{id}` 5xx | Pattern C boundary card mounts via `(admin)/paths/[pathId]/edit/error.tsx`. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Create a new path
  Given the admin opens /admin/paths/new/edit
  When the admin enters name "Welding fundamentals" and description
  And adds 3 pills via the picker
  And clicks "Save path"
  Then POST /v1/learning-paths fires with {name, description, pill_ids: [...3 uuids]}
  And toast.info("Path created") renders
  And router.push fires with /admin/paths
```

```gherkin
Scenario: Edit existing path — drag-reorder
  Given the admin opens /admin/paths/{existing-id}/edit
  And the path has 6 pills in order [A, B, C, D, E, F]
  When the admin drags row D up to position 2
  Then the rendered order is [A, D, B, C, E, F]
  And the form's pill_ids field reflects [A, D, B, C, E, F]
  When the admin clicks "Save path"
  Then PATCH /v1/learning-paths/{id} fires with pill_ids in the new order
```

```gherkin
Scenario: Remove a pill from the path
  Given an edit-mode path has 6 pills
  When the admin clicks Remove on row 3
  Then the row disappears
  And pill_ids array no longer contains that pill_id
  And no network call fires yet (save is required to persist)
```

```gherkin
Scenario: Pill picker adds multiple pills
  Given the path editor is open
  When the admin clicks "+ Add pill to this path"
  And the picker modal opens with PillsTable in picker mode
  And the admin selects 2 pills and clicks "Add 2 pills"
  Then both pills append to the end of the path's pill list
  And the modal closes
```

```gherkin
Scenario: Submit with empty pill_ids — validation block
  Given the admin enters name but doesn't add any pills
  When the admin clicks "Save path"
  Then zod surfaces "Add at least one pill to the path."
  And no network call fires
```

```gherkin
Scenario: Cancel with dirty form prompts confirm
  Given the editor has unsaved changes
  When the admin clicks Cancel
  Then browser confirm("Discard unsaved changes?") fires
  And on OK router.push fires with /admin/paths
```

```gherkin
Scenario: Backend 422 on save projects to field
  Given the admin submits a path with a name that the backend rejects
  When PATCH returns 422 with detail [{loc: ["body", "name"], msg: "duplicate path name"}]
  Then applyApiErrorToForm projects the error under the name field
  And the editor stays mounted
```

(Seven total scenarios mapped to §D.2 path-editor integration tests.)

**7. Edge cases / gotchas**

- **`useFieldArray` with array of strings (uuids)** — rhf's `useFieldArray` is typed for `{id: string, ...}` objects by default; using it with bare string arrays requires `name: "pill_ids"` + `keyName: "_internalId"`. Spec body assumes standard usage; build session resolves the typing.
- **`@dnd-kit` dep new in FE-8.** AC-CD-structural addition fold per SESSION_START.md carve-out (§F.3). Lightweight, accessible drag library; aligns with shadcn ecosystem.
- **Pills referenced in the path may have been retired since the path was authored.** Render retired pills with an "Retired" badge + greyed style; admin can remove them but can't promote them back. v1 acceptable; surfaces a "1 pill in this path is retired" notice at the top if any.
- **"Assigned to" panel is informational only.** Editing the path doesn't change which assignments reference it; the panel just shows the impact radius. No drilldown link in v1.
- **No drag-handle keyboard shortcut.** `@dnd-kit` supports keyboard reorder out of the box; spec body relies on that. Accessibility verification at build time.
- **Save-as-new-path affordance**: not in v1. If the admin wants to duplicate-and-modify, they manually create a new path. Deferred.

**8. Visual reference**

- `frontend/design-reference/prototype/admin-authoring.jsx:805–881` — `PathEditor`.
- `frontend/design-reference/prototype/admin-authoring.jsx:883–916` — `PathPillRow` (drag-row treatment).
- Screenshot: `v6-fe8-21-paths.png`.

---

## C. Cross-page concerns

### C.1 `adminKeys` — the canonical query-key library

**This is the canonical declaration consumed by all three FE-8 spec files.** Mirrors `fe-specs/FE-3-content.md:527–535` `meQueryKeys` shape under AC-CD21. Lives at `frontend/src/lib/queries/admin-keys.ts`.

```ts
export const adminKeys = {
  all: ['admin'] as const,

  // Pills
  pills: {
    all: () => [...adminKeys.all, 'pills'] as const,
    list: (filters: { q?: string; subject_id?: string; safety_relevant?: boolean; status?: 'draft' | 'published' }) =>
      [...adminKeys.pills.all(), 'list', filters] as const,
    detail: (pillId: string) => [...adminKeys.pills.all(), 'detail', pillId] as const,
  },

  // Subjects
  subjects: {
    all: () => [...adminKeys.all, 'subjects'] as const,
    list: (filters: { q?: string }) => [...adminKeys.subjects.all(), 'list', filters] as const,
    detail: (subjectId: string) => [...adminKeys.subjects.all(), 'detail', subjectId] as const,
  },

  // Pill proposals
  proposals: {
    all: () => [...adminKeys.all, 'proposals'] as const,
    list: (filters: { status?: 'pending' | 'approved' | 'rejected' | 'all' }) =>
      [...adminKeys.proposals.all(), 'list', filters] as const,
    detail: (proposalId: string) => [...adminKeys.proposals.all(), 'detail', proposalId] as const,
  },

  // Learning paths
  paths: {
    all: () => [...adminKeys.all, 'paths'] as const,
    list: () => [...adminKeys.paths.all(), 'list'] as const,
    detail: (pathId: string) => [...adminKeys.paths.all(), 'detail', pathId] as const,
  },

  // Users (consumed by FE-8-admin-identity.md §B.1)
  users: {
    all: () => [...adminKeys.all, 'users'] as const,
    list: (filters: { q?: string; role?: 'admin' | 'testee'; status?: 'active' | 'inactive' | 'invited' }) =>
      [...adminKeys.users.all(), 'list', filters] as const,
    detail: (userId: string) => [...adminKeys.users.all(), 'detail', userId] as const,
  },

  // Groups (consumed by FE-8-admin-identity.md §B.2)
  groups: {
    all: () => [...adminKeys.all, 'groups'] as const,
    list: (filters: { q?: string }) => [...adminKeys.groups.all(), 'list', filters] as const,
    detail: (groupId: string) => [...adminKeys.groups.all(), 'detail', groupId] as const,
    members: (groupId: string) => [...adminKeys.groups.detail(groupId), 'members'] as const,
  },

  // Assignments (consumed by FE-8-admin-identity.md §B.4)
  assignments: {
    all: () => [...adminKeys.all, 'assignments'] as const,
    list: (filters: { assigner_id?: string }) => [...adminKeys.assignments.all(), 'list', filters] as const,
    detail: (assignmentId: string) => [...adminKeys.assignments.all(), 'detail', assignmentId] as const,
  },

  // Tests (consumed by FE-8-admin-tests.md §B.1)
  tests: {
    all: () => [...adminKeys.all, 'tests'] as const,
    list: (filters: { mode?: TestMode; status?: 'draft' | 'published' }) =>
      [...adminKeys.tests.all(), 'list', filters] as const,
    detail: (testId: string) => [...adminKeys.tests.all(), 'detail', testId] as const,
  },

  // Questions per test (consumed by FE-8-admin-tests.md §B.2 + §B.3)
  questions: {
    all: (testId: string) => [...adminKeys.tests.detail(testId), 'questions'] as const,
    list: (testId: string) => [...adminKeys.questions.all(testId), 'list'] as const,
    detail: (testId: string, questionId: string) =>
      [...adminKeys.questions.all(testId), 'detail', questionId] as const,
  },
};
```

**Sibling-file consumption pattern** (FE-8-admin-identity.md + FE-8-admin-tests.md §C reference this file by:
```ts
import { adminKeys } from "@/lib/queries/admin-keys";  // canonical — defined in FE-8-admin-catalogue.md §C.1
```
And §B entries cite `adminKeys.{users,groups,tests,...}` per the schema above.

**Invalidation discipline:**
- Mutations on a single resource invalidate the resource's `all()` key (which cascades to all `list(...)` keys via TanStack Query prefix-match).
- Cross-resource mutations (e.g. approving a proposal creates a pill — see B.4 §4) invalidate both: `adminKeys.proposals.all()` AND `adminKeys.pills.all()`.
- Optimistic updates not used in v1 (verified in §B.5 §7 + sibling files).

### C.2 `(admin)` route group + role guard

Inherited from FE-2 (`fe-specs/FE-2-shell.md` B.14). FE-8 adds no new guard plumbing — every FE-8 page mounts under `frontend/src/app/(admin)/{...}/page.tsx` and inherits:

- **Posture 4** (testee role → `/admin/*`): redirect to `/403` per FE-1 §C.4 five-posture matrix.
- **Posture 3** (privacy unacked): redirect to `/privacy` per FE-1 §C.4.
- **Posture 2** (unauthenticated): redirect to `/login?next={path}` per FE-1 §C.4.

The `(admin)/layout.tsx` from FE-2 mounts the admin shell (Rail with admin nav ids: `ops`, `review`, `engagement`, `catalogue-admin`, `users`, `cost`, `loop` per `shell.jsx:15`) and runs the role guard. FE-8 pages add their own segment + `error.tsx` (Pattern C boundary).

### C.3 `applyApiErrorToForm` reuse

Every modal form in FE-8 imports `applyApiErrorToForm` from `frontend/src/lib/api/form-errors.ts` (consensus path per `CODE_SPEC.md:1024` + FE-3:16 + FE-4:16; **NOT** FE-1:538's stale `lib/forms/` path — drift surfaced in §H (b) item 1). Pattern from FE-1 §C.2 used unchanged:

1. `try { await unwrap(client.POST(...)) }` → success path: invalidate + toast + close.
2. `catch (err) { applyApiErrorToForm(err, form, { fieldMap: { BUSINESS_CODE: 'field_name' } }) }` → 422 validation errors project onto field paths; business codes route via `fieldMap`; unknown errors fall through to root + Pattern B toast.

### C.4 Filter-bar primitive

`frontend/src/components/admin/filter-bar.tsx` — extracted from FE-3 catalogue filter pattern + extended for FE-8 use. Props:

```ts
type FilterBarProps = {
  // Text search
  searchValue?: string;
  onSearchChange?: (next: string) => void;       // already debounced internally to 300ms
  searchPlaceholder?: string;
  // Segmented filter groups (zero-to-many)
  segments?: Array<{
    label: string;
    value: string;
    options: Array<{ label: string; value: string }>;
    onChange: (next: string) => void;
  }>;
};
```

Consumed by `PillsTab` (B.2), `SubjectsTab` (B.3), `SafetyTab` (B.5), and (cross-file) `UsersList` + `TestsList` in sibling files. URL-state sync handled by the consumer (FilterBar is controlled).

### C.5 Modal primitive

Inline component matching `admin-authoring.jsx:49–67` (`Modal`). Wraps shadcn `Dialog` for keyboard / focus-trap handling; styles to match the paper-card chrome. Exposed at `frontend/src/components/admin/modal.tsx` with subcomponents `ModalHeader`, `ModalActions`. Shared across all three FE-8 files.

### C.6 Field primitives (Field, FieldRow, FieldError)

Inline components matching `admin-authoring.jsx:110–144`. `Field` wraps label + input slot + error slot + hint slot; `FieldRow` is a 2-column grid; `FieldError` renders an X icon + red copy. Extracted to `frontend/src/components/admin/field.tsx`. Shared across all three FE-8 files. **Decision: do NOT consolidate with FE-1's `AuthField`** — `AuthField` is auth-page-specific (single column, no row layout); the admin Field primitive supports inline-row layouts.

### C.7 Toasts (Pattern B reuse)

Sonner toast helper from FE-1 §C.3 at `frontend/src/lib/ui/toast.ts` reused unchanged. FE-8 calls:
- `toast.info("Pill saved")` / `toast.info("Path created")` on success — 3s auto-dismiss.
- `toast.error("Couldn't save — try again")` on non-field error — 7s auto-dismiss.

No new toast severity tiers introduced.

### C.8 Pattern C boundary

Each FE-8 page adds an `error.tsx` boundary file per FE-1 §C.6: `(admin)/catalogue/error.tsx`, `(admin)/paths/error.tsx`, `(admin)/paths/[pathId]/edit/error.tsx`. Each uses FE-1's `BoundaryFrame` pattern (wave icon + "Couldn't load X" + "Try again" + "Go to admin dashboard") with copy localised per page.

---

## D. Test cases (Vitest)

Vitest config from FE-0 + MSW from FE-1 §D. Tests under `frontend/tests/` and `frontend/src/**/*.test.tsx`.

### D.1 Unit tests (lib + helpers)

- `frontend/src/lib/queries/admin-keys.test.ts` — assert key shape stability (snapshot tests for each `adminKeys.{resource}.list(filters)` shape); assert invalidation prefix-match works (e.g. `adminKeys.pills.detail(id)` matches under `adminKeys.pills.all()` prefix).
- `frontend/src/components/admin/filter-bar.test.tsx` — debounce timing (typing 5 chars within 300ms fires 1 search; typing 5 chars over 500ms fires 5 searches but only the last lands due to TanStack Query's last-write-wins).
- `frontend/src/components/admin/difficulty-range-slider.test.tsx` — controlled component behaviour; min/max clamp; disabled mode.
- `frontend/src/components/admin/safety-toggle.test.tsx` — on/off rendering; disabled mode; onChange firing.

### D.2 Page integration tests

One test file per §B entry, using MSW handlers:

- `frontend/src/app/(admin)/catalogue/page.test.tsx` — §B.1 trios (5 scenarios).
- `frontend/src/app/(admin)/catalogue/_components/pills-tab.test.tsx` — §B.2 trios (10 scenarios).
- `frontend/src/app/(admin)/catalogue/_components/subjects-tab.test.tsx` — §B.3 trios (5 scenarios).
- `frontend/src/app/(admin)/catalogue/_components/proposals-tab.test.tsx` — §B.4 trios (7 scenarios).
- `frontend/src/app/(admin)/catalogue/_components/safety-tab.test.tsx` — §B.5 trios (6 scenarios).
- `frontend/src/app/(admin)/paths/page.test.tsx` — §B.6 trios (4 scenarios).
- `frontend/src/app/(admin)/paths/[pathId]/edit/page.test.tsx` — §B.7 trios (7 scenarios).

Total: 44 catalogue-side integration scenarios.

### D.3 Round-trip integration test

`frontend/tests/integration/admin-catalogue-roundtrip.test.tsx`:
- Done-when in narrative form (catalogue slice): admin lands at `/admin/catalogue` → switches to Subjects tab → creates subject "Welding" → switches to Pills tab → creates pill "Substrate Prep" in Welding → switches to Proposals tab → approves an AI-proposed pill → switches back to Pills tab and verifies both new pills appear → opens `/admin/paths` → creates new path "Welding fundamentals" containing the two new pills → returns to paths list and verifies it's there.

Single test, exercises every page in the catalogue file.

### D.4 Coverage gate (FE_CHECKLIST.md FE-8 catalogue row ticks on)

- All §B Gherkin + D.3 round-trip green via `pnpm test --run`.
- `pnpm typecheck` clean.
- `pnpm lint` clean.
- `pnpm build` succeeds.

---

## E. Known placeholders (DO NOT SHIP AS-IS)

| # | Placeholder | Location | Action before production |
|---|---|---|---|
| 1 | No prototype mocks for Subjects tab, Proposals tab, Safety tab (only Pills tab is screenshotted in `v6-fe8-17-pill-crud.png`) | `(admin)/catalogue/_components/{subjects,proposals,safety}-tab.tsx` | **Design-reference gap surfaced.** Build session inherits the Pills tab + FE-1 modal patterns by structural inheritance; design-Claude session adds the 3 missing tabs (Subjects + Proposals + Safety) post-FE-8 when usability feedback is in. Tag the 3 components with `// TODO(design-ref): mocks pending`. |
| 2 | `Used in` column on Pills tab + `pill_count` column on Subjects tab + `assigned_to` summary on Paths list — derived fields not in OpenAPI | `(admin)/catalogue/_components/{pills,subjects}-table.tsx` + `(admin)/paths/_components/path-list.tsx` | Backend adds denormalised count fields (covered by §H (b) item 3). Until landed, columns render "—" with a placeholder tag. |
| 3 | Subject deletion with attached pills | `(admin)/catalogue/_components/delete-subject-modal.tsx` | v1 disables delete when pill_count > 0 (client-side gate). v1.x: backend cascade behaviour + admin re-assignment UX. |
| 4 | Pill cloning + migration to clone | (no v1 surface) | Design (`admin-authoring.jsx:228–229`) mentions cloning to change locked fields. v1 ships no clone affordance; admin clones manually by re-creating. v1.x adds a Clone CTA in the locked-pill warning banner. |
| 5 | Paths list filter / search | `(admin)/paths/page.tsx` | v1 ships paginated list only. v1.x adds text search + filter by "has-assignments" / "no-assignments". |
| 6 | Drawer for proposal detail rendering with untyped `payload` field | `(admin)/catalogue/_components/proposal-detail-drawer.tsx` | Defensive rendering: structured display if payload fields are recognised, formatted JSON fallback otherwise. Resolves once §H (a) item 2 lands (backend types the payload contract). |

---

## F. Scope additions beyond prior FE-N specs

### F.1 `SPEC.md` AC-D21 alignment — safety-link curation source

No edit to SPEC.md required. Recorded here for the build session: AC-D21 + SPEC §6.4 lock safety pill links as curated by the bootstrap cron (PR-024 P11 `app/api/operations/safety_links.py`), NOT by admin UI. The pill editor + safety tab expose the `safety_relevant` boolean only; the link list itself is server-managed and surfaced read-only to testees via FE-3's pill detail page (safety variant). **No frontend surface for link CRUD in v1.**

### F.2 `FE_ROADMAP.md` AC-D8 alignment — no edit-then-approve

`FE_ROADMAP.md:163` is already explicit: "no edit-then-approve in v1". §B.4 honours this verbatim. Reject is final in v1 (no Unreject affordance). Confirmed at plan time, no scope amendment needed.

### F.3 `CODE_SPEC.md` AC-CD-structural additions

Two AC-CD-level structural additions surfaced at plan time, foldable into the FE-8 catalogue build PR's handover per SESSION_START.md carve-out:

1. **`@dnd-kit/core` + `@dnd-kit/sortable`** as runtime deps for `PathEditor` drag-reorder (B.7 §2). Lightweight, accessible drag library; aligns with shadcn ecosystem. No conflict with FE-2's installed primitives.
2. **shadcn `Sheet` primitive** added to FE-2's installed set for `ProposalDetailDrawer` (B.4 §2). Drawer pattern chosen over modal for longer payload contents.

Neither violates AC-CD19 (Next.js 15 stack lock); both are additive primitive/library installs.

### F.4 FE-9 boundary explicitly excluded

The following surfaces in `admin-ops.jsx` + `admin.jsx` are explicitly **NOT** in FE-8 scope and will be picked up by FE-9:

- Ops dashboard (`/admin/ops`)
- Grade-review queue (`/admin/review`)
- Engagement queue (`/admin/engagement` — consumes `/v1/admin/engagement/pending` referenced from FE-3 §B.1)
- Adaptive-loop approve/reject (`/admin/loop`)
- Cost dashboard (`/admin/cost`)
- Calibration view (`/admin/calibration`)

FE-8 navigates via the Rail (FE-2) but renders no consumer for these routes.

---

## G. Session 2 onwards — template propagation + variances declared

The structure (Context → A inventory → B per-page 8-section template → C cross-page → D tests → E placeholders → F scope-bleed → G propagation → H drift) is the **template for every subsequent FE-N detail spec**, propagated unchanged into FE-9 detail spec. The 8-section per-page template inside §B propagates verbatim.

**FE-8 catalogue file declared variances** (from the FE-1 §G + FE-7 §G allowed-variance lists):

1. **Three-file split** (this file + `fe-specs/FE-8-admin-identity.md` + `fe-specs/FE-8-admin-tests.md`) per the FE-1:747 escape clause for FE-8 / FE-9 when a single file would exceed ~2500 lines. Three-file split (vs the FE-1:747 example's 4-file `catalogue / users / groups / tests`) chosen on domain boundaries — users + groups + assignments cohere under `identity`. User-locked at plan time.
2. **Sibling-file §C reuse pattern.** `adminKeys` query-key library declared canonically here in §C.1; siblings reference by import + cite this spec file in their §C. Mirrors how FE-7 consumes FE-3's `meQueryKeys` per `fe-specs/FE-7-profile.md:8`. Cross-spec drift mitigation: every consumer block in siblings opens with the verbatim phrase "consumes from `fe-specs/FE-8-admin-catalogue.md §C.1` unchanged" so grep can audit.
3. **Per-page §B with composition** for the catalogue shell (B.1) — the 4 tabs are nested as separate B-entries (B.2–B.5) rather than collapsed into B.1's components list. Justified: each tab has distinct API + zod + Gherkin trios; collapsing would compress to the point of un-testability. Differs from FE-7's "nest inside §2 Components" precedent because the tabs are independently testable / API-distinct, not just visual variants.

**FE-9 inherits** the 8-section per-page template, the three-bucket §H drift structure, and the §G variance-declaration discipline. FE-9 may split further if its scope demands (engagement + grade-review + ops + cost is ~4 distinct surface families).

Per-phase variances expected and ALLOWED (inherited from FE-1:745):
- FE-5 (SSE) adds an "SSE event sequence" subsection per consuming page (8-section template still applies; SSE nests inside §5).
- FE-8 / FE-9 may split into multiple files (this file is the first concrete instance).

Per-phase variances NOT allowed without spec-drift surface:
- Skipping Gherkin acceptance criteria. Every state must have a trio.
- Skipping drift-watch / verification / blocker callouts. No callouts means the cross-walk was incomplete OR the spec is genuinely clean — declare which.
- Folding test list into per-page sections. Tests live in §D for scannability and coverage-counting.

---

## H. Spec-drift roll-up (post-review classification)

The cross-walk surfaced 12 candidate items. After review, they're classified into three groups:

### (a) BLOCKERS for the FE-8 catalogue build session — must land before the build session opens

1. **`applyApiErrorToForm` path drift in FE-1 spec.** FE-1-auth.md:538 + :519 + :664 say `frontend/src/lib/forms/applyApiErrorToForm.ts`; `CODE_SPEC.md:1024` + `fe-specs/FE-3-content.md:16` + `fe-specs/FE-4-runner.md:16` say `frontend/src/lib/api/form-errors.ts`. Consensus + CODE_SPEC win. **Resolution:** user authors a separate one-line cross-spec-drift PR correcting FE-1's three call-sites. **The FE-8 catalogue build session cannot open until that correction is on `main`** (FE-8 has 15+ forms across the three files; building against the stale path would fragment the codebase). User-locked at plan time per `/root/.claude/plans/fresh-session-fe-8-tingly-candy.md` §10 Q3 = "separate cross-spec-drift PR".
2. **`PillProposalResponse.payload` is untyped (`object`).** `frontend/openapi/schema.json:2230–2239` declares `payload: object | null`. The proposal detail drawer (B.4 §2) needs to render this content; defensive JSON-fallback works for v1 but a typed contract (name / subject hint / description / difficulty hint as discriminated fields) would be cleaner. **Resolution path A** (preferred): user authors a backend spec-clarification PR typing the proposal payload. **Resolution path B**: confirm "JSON-fallback is acceptable for v1" and proceed. Surfaced for user decision before build session opens.

### (b) BUILD-SESSION VERIFICATION TASKS — front-loaded at the start of the FE-8 catalogue build session

The build session opens with a verification step before any code lands: read the FastAPI handlers for `/v1/pills`, `/v1/subjects`, `/v1/pill-proposals`, `/v1/learning-paths` + the relevant Pydantic response schemas, confirm the assumptions below match reality. If any diverge, halt and surface for spec-clarification PR.

3. **`used_in_count` on `PillResponse` + `pill_count` on `SubjectResponse` + `assigned_count` on `LearningPathResponse`.** Design surfaces these derived counts in the list tables. OpenAPI does not currently include them. Verify: does backend expose them on the response schemas? If not, are they computable via a single `?include=counts` query param? If not, render "—" with a `// TODO(FE-8-build)` and surface as §E.2 ongoing placeholder.
4. **`safety_relevant_overridden_at` semantics.** Spec assumes `null` = auto-derived by AC-D21 cron, non-null = admin-override timestamp. Verify against `app/api/operations/safety_links.py` (PR-024) — the cron may set the timestamp itself, breaking the auto-vs-admin distinction. If so, surface a separate `safety_relevant_source: "auto" | "admin"` field.
5. **`DELETE /v1/subjects/{id}` behaviour with attached pills.** OpenAPI doesn't document the response. Verify: 422 with detail / 409 / cascade-delete the pills (unlikely)? Spec body assumes 422; v1 frontend gates by client-side pill-count check.
6. **`PillCreate.name` server-side min length.** OpenAPI may have `minLength: 8` (mirroring AC-CD password discipline) or `minLength: 1`. Verify; if stricter, FE zod stays at 1 but backend 422 surfaces under the field via `applyApiErrorToForm`.
7. **`PillResponse.discoverable` is the Draft/Published mapping.** Spec body assumes `discoverable=false → Draft, discoverable=true → Published`. Verify there isn't a separate `status` enum on `PillResponse`. If there is, switch the mapping.
8. **`POST /v1/pill-proposals/{id}/approve` without subject hint.** Verify backend behaviour: 422 / picks a default subject / creates without subject. Inform the proposal drawer's UX.
9. **`paths` nav-rail id.** Verify `shell.jsx` admin nav (`shell.jsx:15` declares 7 ids: ops, review, engagement, catalogue-admin, users, cost, loop). `paths` is NOT in that list — if FE-2 hasn't added it, FE-8 either (a) adds it as an AC-CD-structural addition fold or (b) nests path management inside the catalogue page as a 5th tab. Build session decides; spec body assumes (a).
10. **`LearningPathResponse` fields.** Verify `pill_ids[]` is present + ordered. Verify `assigned_count` or equivalent is present (covers item 3 sibling).
11. **`DELETE /v1/learning-paths/{id}` cascade.** Verify what happens to assignments referencing the path. Spec body assumes assignments survive with `path_id` set to null OR the assignment is hard-deleted. UX confirmation modal copy reflects either outcome with "bound assignments will lose their reference" verbiage that's true in both cases.

### (c) APPROVED RESOLUTIONS — folded into FE-8 catalogue build PR scope, captured in the build PR's handover

These are not blockers. The spec body locks the resolution; the build session implements; the build PR's handover records them under the SESSION_START.md AC-CD-structural-additions carve-out.

12. **Three-file split** (catalogue / identity / tests) — user-locked at plan time per `/root/.claude/plans/fresh-session-fe-8-tingly-candy.md` §10 Q1.
13. **§C anchored canonically in this file** — siblings consume by reference (§G variance declared).
14. **FE-9 boundary explicitly excluded** in §F.4 — no FE-8 consumer for engagement / grade-review / ops / cost / loop / calibration surfaces.
15. **`adminKeys` library rooted at `['admin']`** — mirrors FE-3 `meQueryKeys` shape per AC-CD21 (§C.1).
16. **`@dnd-kit/core` + `@dnd-kit/sortable` runtime deps** + shadcn `Sheet` primitive added — AC-CD-structural addition folds per §F.3.
17. **Pill safety-link curation is server-only** per AC-D21; pill editor exposes only the `safety_relevant` boolean toggle (§F.1).
18. **Proposal approve/reject is final in v1**; no edit-then-approve, no unreject (§F.2).
19. **`(admin)` route group + role guard reused from FE-2** unchanged; no new guard plumbing in FE-8 (§C.2).

---

*End of FE-8-admin-catalogue.md. Sibling specs: `fe-specs/FE-8-admin-identity.md` + `fe-specs/FE-8-admin-tests.md`. Template propagates to FE-9 per §G; deviations surface as spec drift.*
