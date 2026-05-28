# FE-8 — Admin test authoring (4 modes + question editor) (detail spec)

> **Status:** plan-mode authored, ready for build session (Phase 0 spec-clarification PR resolved the cross-spec drift and locked the FE-owned typing contract for v1; build session may open).
> **Owns:** the admin test authoring suite — test list (`/admin/tests`) + test editor (`/admin/tests/new` + `/admin/tests/[id]/edit`) with 4 mode-conditional sections (per_testee / frozen / hand_authored / benchmark) + publish/lock/unlock controls + question editor modal (5-type discriminated union pattern).
> **PR target:** shared with `fe-specs/FE-8-admin-catalogue.md` + `fe-specs/FE-8-admin-identity.md` in a single PR — `PR-NNN-fe8-admin-authoring`.
> **Anchors:** AC-D3 (sequence_number scope per Testee per Test), AC-D5 (AI-driven test generation — per_testee dynamic default + frozen + hand_authored + benchmark four creation paths), AC-D13 (benchmark mode — adaptive diagnostic, sequential walk, cohort comparison), AC-D17 (frozen-test snapshot at attempt start — edits apply forward only), AC-D24 (campaign lock + per-attempt presentation shuffle for frozen/hand_authored modes), AC-CD11 (admin-only surfaces), AC-CD19 (FE stack lock), AC-CD20 (`(admin)` route group + role guard → `/403`), AC-CD21 (centralised query keys + form helper + error envelope), AC-CD24 (image-field typed stubs — question editor surfaces text-only in v1).
>
> This is the **eighth per-page FE detail spec, sibling 3 of 3** (catalogue / identity / tests) for the FE-8 admin authoring phase. Template inheritance: per-page §B from `fe-specs/FE-1-auth.md:50–60` (verbatim); `adminKeys` query-key library + `(admin)` route group + filter-bar primitive + modal primitive + field primitives + form-error helper all **consumed from `fe-specs/FE-8-admin-catalogue.md §C.1–§C.8` unchanged**. Three-file split rationale at `fe-specs/FE-8-admin-catalogue.md §G`. **Variance declared in §G:** the 4 mode-conditional editor sections (per_testee / frozen / hand_authored / benchmark) compose inside §B.2's §2 (Components) rather than fanning out into 4 separate B-entries, per FE-7 §G precedent (`fe-specs/FE-7-profile.md:746`). Deviating from the template in FE-8+ is itself spec drift.

---

## 0. Context

This file is sibling 3 of 3 for FE-8 admin authoring. Read `fe-specs/FE-8-admin-catalogue.md §0` for the umbrella context (FE-N spec preconditions, three-file split rationale, FE-9 boundary).

**Owned surfaces:**
- `/admin/tests` — paginated test list with mode + status filters
- `/admin/tests/new` + `/admin/tests/[testId]/edit` — the same editor route in create vs edit mode
- The 4 mode-conditional editor sections (composed inside §B.2): per_testee, frozen, hand_authored, benchmark
- Question editor modal (5-type discriminated union: multiple_choice, true_false, matching, short_answer, scenario) — overlays the editor when admin clicks Edit on a pool question

**Done-when contribution (this file owns the "author a test with mixed question types" step per `FE_ROADMAP.md:166`):** Admin can create a frozen-mode test, add ≥1 question of each supported type (multi_choice + true_false + matching + short_answer + scenario), publish the test, and have it appear in the assignment editor's test picker (cross-file consumed by `fe-specs/FE-8-admin-identity.md §B.4`).

**Highest-risk surface in the entire FE-8 phase** per `FE_ROADMAP.md:172`: "Test-authoring data model is the largest single surface — recommend binding pause after first slice to lock the editor pattern before duplicating across the 4 modes". Binding-pause discipline:

> The FE-8 build session implementing this file SHOULD pause after the first mode (per_testee — the simplest) is fully wired end-to-end (form + state + Gherkin + Vitest), surface for review, then proceed to frozen / hand_authored / benchmark. This is a session-execution gate, not a spec-time decision. Spec body locks all 4 mode sections; build session decides if the per-mode pause is needed once it's into the work.

**Scope boundary — what this file explicitly does NOT ship:**
- **Pill / subject / proposal / safety / path CRUD.** Owned by `fe-specs/FE-8-admin-catalogue.md`.
- **Users / groups / assignments.** Owned by `fe-specs/FE-8-admin-identity.md`.
- **Question authoring with image / figure upload.** AC-CD24 image fields are typed stubs in v1 — `QuestionResponse.reference_image_url` + `reference_image_caption` exist on the backend response, but the editor surfaces text-only in v1. Image-upload UX deferred to v1.x. Surfaced as §E item 1.
- **Question reorder UX.** Design's frozen pool table renders questions in numeric order (`01`, `02`, ... `06`) but exposes no drag-handle reorder. v1 ships without reorder; question order = creation order (or backend `created_at` ASC). Deferred to v1.x. Surfaced as §E item 5.
- **Per-test analytics drill-down.** Design's published-status banner mentions "bound to 2 assignments · 14 testees · 8 attempts started"; v1 renders the literal counts from a derived field, no drill-down click-through to per-attempt views. Drill-down is FE-9 ops dashboard territory. Surfaced as §F.2.
- **Calibration / drift queue.** AC-D27 + design `admin-test-authoring.jsx:771` mention `/admin/calibration` for anchor drift exceeding 12%. FE-9 owns the calibration consumer surface.
- **Cohort window enforcement / campaign-lock validation.** Backend handles whether a benchmark cohort is mid-window; FE just sets the dates. AC-D24 + AC-D13.
- **AI generation invocation UI for per_testee / frozen.** v1 ships the test config + question editor; the AI generation invocation (the "generate questions for this spec" action that AC-D5 mentions for frozen mode) is **not in scope for FE-8** — the design's frozen-section just lists existing pool questions and an "Add question" button (manual + AI-invoked path is the same UI surface). The actual AI generation backend call is fired by the user clicking "Add question" → modal opens with a "Suggest with AI" button (deferred to v1.x). Surfaced as §E item 6.

---

## A. Page/feature inventory

| # | Capability | Route / file | Design source | Screenshot |
|---|---|---|---|---|
| 1 | Test list — `/admin/tests` table with mode + status filters, 4-stat aggregate strip, new-test CTA | `(authed)/(admin)/tests/page.tsx` + `_components/tests-table.tsx` | `admin-test-authoring.jsx:75–143` (`TestListPage`) | `v6-fe8-20-test-authoring.jpg` |
| 2 | Test editor — `/admin/tests/new` + `/admin/tests/[testId]/edit` single route handling create + edit + 4 mode-conditional middle sections + publish/lock/unlock controls | `(authed)/(admin)/tests/[testId]/edit/page.tsx` + `_components/test-editor.tsx` + `_components/{mode-picker,per-testee-section,frozen-section,hand-authored-section,benchmark-section,publish-controls,status-bar}.tsx` | `admin-test-authoring.jsx:156–603` (`TestEditor`, `ModePicker`, `PerTesteeSection`, `FrozenSection`, `HandAuthoredSection`, `BenchmarkSection`, `DifficultyPicker`, `DifficultyCurve`, `PublishControls`, `StatusBar`) | `v6-fe8-20-test-authoring.jpg` |
| 3 | Question editor modal — 5-type discriminated union (multiple_choice / true_false / matching / short_answer / scenario) overlay on top of the test editor | `(authed)/(admin)/tests/[testId]/edit/_components/question-editor-modal.tsx` + `_components/question-editor-inner.tsx` + per-type subcomponents (`mcq-choices.tsx`, `tf-choices.tsx`, `match-pairs.tsx`, `sa-grading-rubric.tsx`) | `admin-test-authoring.jsx:606–800` (`QuestionEditorModal`, `QuestionEditorInner`, `MCQChoices`, `TFChoices`, `SAGradingRubric`, `MatchPairs`) | `v6-fe8-20-test-authoring.jpg` (composite — question editor inset) |

Three rows. Capability #1 is the list-page route shell; #2 is the editor route shell with the 4 mode-conditional sections nested in §B.2 §2 (Components) per the §G variance; #3 is the question editor modal opened from inside the frozen/hand_authored sections of #2.

URL state per row:
- Row 1 (test list): `?mode={per_testee|frozen|hand_authored|benchmark|all}&status={draft|published|locked|all}` — two segmented filters. (`locked` is a derived display status mapping to `status=published && lock_mode=campaign-locked` per §H (a) item 1.)
- Row 2 (test editor): `testId` path param. Special value `"new"` triggers create-mode (no fetch). No filter URL state inside the editor.
- Row 3 (question editor modal): not a route. Ephemeral `useState` opens / closes it; the editing question's id is part of the modal-open state, not URL.

---

## B. Per-page detail specs

> **Template** (from `fe-specs/FE-1-auth.md:50–60`):
> 1. Route segment + URL state
> 2. Components (scaffold reused / new in this PR / shadcn primitive / design primitive)
> 3. API endpoints consumed
> 4. Form fields + zod rules + react-hook-form integration shape (or "n/a — read-only page" with TanStack Query notes)
> 5. States (every variant from the design state-strip + any extras the wire surfaces)
> 6. Acceptance criteria (Gherkin — each trio maps to one Vitest test)
> 7. Edge cases / gotchas
> 8. Visual reference

### B.1 Test list — `/admin/tests`

**1. Route segment + URL state**

- File: `frontend/src/app/(authed)/(admin)/tests/page.tsx`. The `(admin)` route group exists per FE-2; the `tests/` segment + its `error.tsx` boundary file are FE-8-introduced.
- URL state: `?mode={per_testee|frozen|hand_authored|all}&status={draft|published|locked|all}` (defaults `mode=all`, `status=all`). Filter changes call `router.replace()` per FE-3 §C.7. **Benchmark mode filter segment renders disabled** per §E item 8 LOCKED deferral (v1 ships no benchmark mode authoring; existing benchmark rows still render in the list under `mode=all`).
- Modal state: none on this page (clicking Edit on a row navigates to the editor; clicking "+ New test" navigates to `/admin/tests/new/edit`).
- Static `<title>Tests · Acumen</title>`.
- Nav-rail anchor: `tests` rail id per the LOCKED ADMIN_NAV addition (`fe-specs/FE-8-admin-catalogue.md §C.2`). Top-level item (position 6 of 11); not nested under Catalogue.

**2. Components**

- **Scaffold reused:** `useAuth()` (FE-1); `client` + `unwrap` + `ApiError` (FE-0); `useInfiniteQuery` (TanStack Query v5); `useRouter` from `next/navigation`.
- **Shared admin primitives consumed from `fe-specs/FE-8-admin-catalogue.md §C`:** `adminKeys.tests.{all,list,detail}` (§C.1); `FilterBar` (§C.4); `(admin)` route guard (§C.2); toast (§C.7); Pattern C (§C.8).
- **New in this PR (tests scope):**
  - `TestsListPage` — top-level page. `PageHeader` + 4-card stat aggregate row (Tests / Published / Draft / Locked counts per `admin-test-authoring.jsx:78–83`) + `FilterBar` (mode + status segmented filters) + "+ New test" CTA + `TestsTable`.
  - `TestsTable` — table view per `admin-test-authoring.jsx:104–140`. Columns: Title (with mode-meta line under it: "4 to 12 questions sampled per testee" / "fixed pool · everyone sees the same questions" / "manually written · no generation" / "sequential walk · cohort comparison" per mode), Mode (mode-coloured `Pill`), Status (`<Pill tone="warn|ok|soft" mono>{label}</Pill>` — see §5), Pills count (numeric — derived per §H (b) item 2), Last edited (relative), Edit row action. Cursor-paginated via FE-3 §C.5 pattern.
  - `TestModePill` — mode badge primitive. Maps `TestMode` enum to tone: `per_testee → accent`, `frozen → soft`, `hand_authored → warn`, `benchmark → info`. Renders `<Pill tone={tone} mono>{mode}</Pill>`. Per `admin-test-authoring.jsx:145–151`.
  - `TestStatsRow` — 4-card stat strip per `admin-test-authoring.jsx:78–83`. Stats: total tests / published count / draft count / locked count. Counts derived from a summary endpoint OR computed from cached list pages (§H (b) item 3).
- **shadcn primitives installed:** none beyond FE-2's set.
- **Design primitives reused:** `Stat` (FE-2) for the 4-card aggregate; `Pill` (FE-2) for mode + status badges; `Icon` (lucide `Lock` for locked status, `Plus` for CTA). `.tbl`, `.card`, `.card-hd`, `.eyebrow`, `.h-3`, `.t-meta`, `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-sm`, `.seg`, `.row`, `.gap-2`, `.num`, `.right`, `.grid-4`, `.gap-4`, `.mb-6` design classes from FE-2 per AC-CD23.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/tests?cursor={cursor}&limit=50&mode={mode}&status={status}` | List tests (cursor-paginated, server-side filters). Consumed by `TestsTable`. `staleTime: 30_000` per AC-CD21. | **Exists** at `frontend/openapi/schema.json:7946`. Returns `Page_TestResponse_`. `mode` + `status` query param verification — §H (b) item 4. |
| `GET /v1/tests?summary_only=true` (TBD) | Aggregate counts for the 4-stat strip. If endpoint doesn't support a summary mode, FE computes counts client-side from the first page. | **TBD** — §H (b) item 3. v1 fallback: client-side count from first page. |

**4. Form fields + zod + rhf**

n/a — read-only list. TanStack Query notes:

```ts
const tests = useInfiniteQuery({
  queryKey: adminKeys.tests.list({ mode: modeFilter, status: statusFilter }),
  queryFn: ({ pageParam }) => unwrap(client.GET("/v1/tests", {
    params: { query: { cursor: pageParam, limit: 50, mode: modeFilter, status: statusFilter } }
  })),
  initialPageParam: undefined,
  getNextPageParam: (last) => last.meta.next_cursor,
});

// Status filter "locked" is derived display — maps to status=published + lock_mode=campaign-locked
// (see §H (a) item 1). If server doesn't accept "locked" as a status param, FE post-filters page rows.
const displayRows = useMemo(
  () => tests.data?.pages.flatMap(p => p.items).map(t => ({ ...t, displayStatus: deriveDisplayStatus(t) })) ?? [],
  [tests.data]
);
```

Helper at `frontend/src/lib/tests/derive-display-status.ts`:
```ts
export type DisplayStatus = 'draft' | 'published' | 'locked';
export function deriveDisplayStatus(test: TestResponse): DisplayStatus {
  if (test.status === 'draft') return 'draft';
  if (test.status === 'published' && test.lock_mode === 'campaign-locked') return 'locked';
  return 'published';
}
```

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `list_loading` | Initial query in-flight | 4-stat skeleton + table with 10 skeleton rows. |
| `list_empty` | Response `{ items: [] }` | Empty-state card "No tests yet — author your first test to start binding to assignments." + "+ New test" CTA. |
| `list_happy_first_page` / `list_loading_more` / `list_happy_no_more` | (mirrors `fe-specs/FE-8-admin-catalogue.md §B.2 §5`) | (mirrors) |
| `filter_mode_changed` / `filter_status_changed` | User clicks a segment in FilterBar | URL replaces; refetch; pagination resets. |
| `row_status_draft` | Per row: `deriveDisplayStatus(t) === 'draft'` | Status pill `<Pill tone="warn" mono>Draft</Pill>`. |
| `row_status_published` | Per row: `deriveDisplayStatus(t) === 'published'` | Status pill `<Pill tone="ok" mono>Published</Pill>`. |
| `row_status_locked` | Per row: `deriveDisplayStatus(t) === 'locked'` | Lock icon prefix + `<Pill tone="soft" mono>Locked</Pill>` per `admin-test-authoring.jsx:124–129`. |
| `row_click_edit` | User clicks Edit row action OR the row body | `router.push('/admin/tests/{testId}/edit')`. |
| `new_test_clicked` | "+ New test" clicked | `router.push('/admin/tests/new/edit')`. |
| `error` | Query throws (non-404) | Pattern C boundary via `(authed)/(admin)/tests/error.tsx`. |
| `role_mismatch` | Testee role hits `/admin/tests` | AC-CD20 layout guard redirects to `/403`. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Admin lands on tests list with default filters
  Given an admin opens /admin/tests with no filter params
  When the page mounts
  Then the URL stays at /admin/tests (no filter params added by default)
  And GET /v1/tests fires with no mode or status filter
  And the table renders all tests
  And the 4-stat strip shows total / published / draft / locked counts
```

```gherkin
Scenario: Filter by mode narrows the list
  Given the tests list shows 22 tests across all modes
  When the admin clicks the "frozen" mode segment
  Then URL replaces to /admin/tests?mode=frozen
  And GET /v1/tests refetches with mode=frozen
  And the list shows only frozen-mode tests
```

```gherkin
Scenario: Locked status filter post-filters when backend lacks the value
  Given the admin clicks the "Locked" status segment
  And backend status enum is draft|published only
  When GET /v1/tests fires with status=published (or no status param if backend rejects "locked")
  Then the list page-flatten pipeline filters to rows where lock_mode === "campaign-locked"
  And the table shows only locked tests
```

```gherkin
Scenario: Row status pill reflects derived display status
  Given the list returns a test with status="published" + lock_mode="campaign-locked"
  When the row renders
  Then the status pill is "Locked" (soft tone) with a lock icon prefix
  And NOT "Published"
```

```gherkin
Scenario: New test CTA navigates to editor
  Given the list page is rendered
  When the admin clicks "+ New test"
  Then router.push fires with /admin/tests/new/edit
```

```gherkin
Scenario: Edit row navigates to editor
  Given a test row is visible
  When the admin clicks Edit
  Then router.push fires with /admin/tests/{testId}/edit
```

```gherkin
Scenario: Pagination sentinel loads next page
  Given the list shows 50 rows with hasNextPage true
  When the admin scrolls the sentinel into view
  Then fetchNextPage fires
  And the next 50 rows append below
```

(Seven total scenarios mapped to §D.2 tests-list integration tests.)

**7. Edge cases / gotchas**

- **`pills` count column derivation.** Design column "Pills" shows numeric count (e.g. "7"). `TestResponse` doesn't include this directly. Two paths: (a) backend adds `pill_count` denormalised field, (b) FE derives from the questions list (requires N+1 — heavy). **§H (b) item 2** — verify; v1 placeholder "—" if absent.
- **Stat aggregate derivation.** Backend may or may not expose a `?summary_only=true` mode. v1 fallback: compute from first cached page; surface placeholder ">N" when paginated tail isn't loaded. §H (b) item 3.
- **`lock_mode` enum.** `TestResponse.lock_mode` is `string` (not enum-constrained in OpenAPI per `frontend/openapi/schema.json:3173–3176`). Per SPEC §5 + AC-D24: values `"open"` or `"campaign-locked"`. **§H (b) item 5** — verify; if backend returns different values, the display-status helper breaks.
- **Mode meta-line copy** uses verbatim design copy per `admin-test-authoring.jsx:114–117`. Locked at design.
- **Click-through pattern**: row body click + Edit button click both navigate. Standard tab/keyboard accessibility — entire row is keyboard-focusable per FE-2 table standards.

**8. Visual reference**

- `frontend/design-reference/prototype/admin-test-authoring.jsx:75–143` — `TestListPage`.
- Screenshot: `v6-fe8-20-test-authoring.jpg`.

---

### B.2 Test editor — `/admin/tests/[testId]/edit`

**§G variance:** The 4 mode-conditional sections (per_testee, frozen, hand_authored, benchmark) are composed inside §2 (Components) rather than fanning out into 4 separate §B entries. Justification: each mode is selected via the same form-root, mounts/unmounts the same editor shell, shares the same publish controls + identity fields, and has no cross-page reuse rationale (the mode sections live exclusively under this route). Per FE-7 §G precedent (`fe-specs/FE-7-profile.md:746`) — "page-specific components with no cross-PR reuse rationale compose inside §B.2 rather than break out". Mode-specific Gherkin trios still land in §6 below (one trio per mode minimum).

**1. Route segment + URL state**

- File: `frontend/src/app/(authed)/(admin)/tests/[testId]/edit/page.tsx`. Dynamic param `testId`. Value `"new"` triggers create-mode (no fetch); any UUID triggers edit-mode (fetch the test on mount).
- URL state: none. All editor state is rhf form state + ephemeral modal state for the question editor.
- Modal state: `useState<{open: boolean, questionId?: string}>(closed)` for the question editor.
- Static `<title>` is dynamic via `generateMetadata`: "Author a test · Acumen" (create) or "Edit test · {title} · Acumen" (edit).

**2. Components**

- **Scaffold reused:** same as §B.1 §2 + `useForm` + `useMutation` + `useQueryClient` + `useFieldArray` (rhf for the frozen/hand_authored pool list).
- **Shared admin primitives consumed from `fe-specs/FE-8-admin-catalogue.md §C`:** `adminKeys.{tests,questions,pills}` (§C.1); `Modal` (§C.5); `Field` + `FieldRow` + `FieldError` (§C.6); `(admin)` route guard (§C.2); toast (§C.7); Pattern C (§C.8); `applyApiErrorToForm` (§C.3 — path: `frontend/src/lib/api/form-errors.ts`).
- **New in this PR (tests scope):**
  - `TestEditorPage` — top-level page. `PageHeader` (eyebrow flips per mode + status; serif title) + status bar (`StatusBar`) + locked-state warn banner + identity card (title + mode picker + description) + mode-conditional middle section + publish controls + (conditional) `QuestionEditorModal`. Two layout columns NOT used here — single-column flow.
  - `ModePicker` — 4-card grid chooser per `admin-test-authoring.jsx:297–328`. Each card: title + 1-2 line body + "USE · {use case}" line. Active card flips to ink-bg per FE-2 pattern. Disabled when `!isCreate` (mode locks after first save per AC-D17). Cards correspond to `MODES` constant at `:270–295`. **Benchmark card renders disabled with `coming-soon` badge per §E item 8 LOCKED deferral.**
  - `PerTesteeSection` — section component per `admin-test-authoring.jsx:333–368`. Fields: pill (single-select), difficulty target (1-10 picker), question count target (4-12 numeric input), time ceiling (optional minutes). Locked when test is published+ or locked.
  - `FrozenSection` — section component per `admin-test-authoring.jsx:370–414`. Renders the question pool list table (questions with id, type pill, pill name, difficulty, body preview, Edit action) + "Add question" CTA. Reads questions from `useQuery(adminKeys.questions.list(testId))`. Empty pool with "Add at least 2 more questions to reach recommended pool size of 8" hint. Edit on a row opens `QuestionEditorModal` (B.3).
  - `HandAuthoredSection` — per `admin-test-authoring.jsx:417–434`. Identical UI to `FrozenSection` + a top info-card explaining hand-authored differs from frozen by author posture only (no AI generation invoked). Composes `FrozenSection` inside.
  - `BenchmarkSection` — **v1 stub** per §E item 8 — renders a "Benchmark authoring coming in v1.x" notice card; full authoring (pills multi-select, difficulty curve, cohort window) deferred to v1.x. Original design ref `admin-test-authoring.jsx:437–481` preserved for v1.x revival.
  - `DifficultyPicker` — single-select 1-10 segmented picker per `admin-test-authoring.jsx:483–502`. Controlled `{value, onChange, disabled}`. Reused by `PerTesteeSection` + `QuestionEditorInner` (B.3).
  - `DifficultyCurve` — vertical bar chart per `admin-test-authoring.jsx:504–544` rendering N questions per band as height-scaled bars. v1 read-only display (the "edit distribution" link is deferred); admin enters distribution as a single field somewhere else (TBD — design ambiguity, surfaced as §H (b) item 6).
  - `StatusBar` — status display per `admin-test-authoring.jsx:253–265`. Renders status pill + mode pill + last-edited-by meta line.
  - `PublishControls` — 3-variant footer per `admin-test-authoring.jsx:549–603`. Variants: draft (Save draft + Publish), published (Save changes + Lock), locked (Unlock only). Variant copy + button affordances differ per variant; see §5.
- **shadcn primitives installed:** none beyond FE-2's set + `Sheet` from catalogue.
- **Design primitives reused:** `Pill` (FE-2) for mode + status badges; `Icon` (lucide `Lock`, `Pencil`); `PageHeader` (FE-2). `.card`, `.eyebrow`, `.row`, `.t-meta`, `.btn`, `.btn-primary`, `.btn-ghost`, `.muted`, `.mono`, `.serif`, `.serif-it`, `.arrow`, `.warn-soft` per FE-2.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/tests/{test_id}` | Fetch existing test (skipped in create-mode where `testId === "new"`). | **Exists** at `frontend/openapi/schema.json:8080`. Returns `TestResponse`. |
| `POST /v1/tests` | Create test (called from create-mode submit). Body: `TestCreate` (`name`, `mode`, optional `duration_minutes`, `target_difficulty`, `pass_threshold`, `timed`, `randomise_question_order`, `randomise_option_order`, `benchmark_scope`, ...). | **Exists** at `frontend/openapi/schema.json:7946+`. |
| `PATCH /v1/tests/{test_id}` | Update test fields (called from edit-mode submit). | **Exists** at `frontend/openapi/schema.json:8080+`. |
| `POST /v1/tests/{test_id}/publish` | Publish a draft test. Empty body. | **Exists** at `frontend/openapi/schema.json:8325`. |
| `POST /v1/tests/{test_id}/lock` | Lock a published test (sets `lock_mode = "campaign-locked"` per §H (a) item 1). | **Exists** at `frontend/openapi/schema.json:8256`. |
| `POST /v1/tests/{test_id}/unlock` | Unlock a locked test. | **Exists** at `frontend/openapi/schema.json:8649`. |
| `GET /v1/tests/{test_id}/questions?cursor={cursor}&limit=100` | Question pool list (consumed by `FrozenSection` + `HandAuthoredSection`). | **Exists** at `frontend/openapi/schema.json:8384`. Returns `Page_QuestionResponse_`. |
| `GET /v1/pills?limit=200` | Pill picker source for `PerTesteeSection` + `BenchmarkSection`. Uses `adminKeys.pills.list({})` cache shared with catalogue B.2. | (from catalogue) |

**4. Form fields + zod + rhf**

```ts
const testEditorSchema = z.object({
  name: z.string().min(1, "Title is required.").max(255),
  mode: z.enum(["per_testee", "frozen", "hand_authored", "benchmark"]),
  description: z.string().max(2048).optional().default(""),

  // Per-testee specific (optional/conditional)
  per_testee: z.object({
    pill_id: z.string().uuid("Pick a pill."),
    target_difficulty: z.number().int().min(1).max(10),
    question_count_target: z.number().int().min(4).max(12).default(8),
    duration_minutes: z.number().int().positive().nullable().optional(),
  }).optional(),

  // Benchmark specific — DEFERRED to v1.x per §E item 8.
  // The sub-object below is preserved here as a reference for the v1.x revival,
  // with `benchmark_scope` values locked to the canonical OpenAPI `BenchmarkScope`
  // enum (`subject|pill|path` — `frontend/openapi/schema.json:6847–6855`).
  // benchmark: z.object({
  //   pill_ids: z.array(z.string().uuid()).min(1, "Pick at least one pill."),
  //   difficulty_curve: z.record(z.string(), z.number().int().min(0)),
  //   duration_minutes: z.number().int().positive().nullable().optional(),
  //   cohort_window_start: z.string().nullable().optional(),
  //   cohort_window_end: z.string().nullable().optional(),
  //   benchmark_scope: z.enum(["subject", "pill", "path"]).optional(),
  // }).optional(),

  // Per-attempt randomisation (frozen + hand_authored modes — AC-D24)
  randomise_question_order: z.boolean().default(true),
  randomise_option_order: z.boolean().default(true),

  // Status fields (read-only on the form — set via dedicated mutations)
  status: z.enum(["draft", "published"]).optional(),
  lock_mode: z.string().optional(),  // "open" | "campaign-locked"
}).superRefine((data, ctx) => {
  if (data.mode === "per_testee" && !data.per_testee) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["per_testee"], message: "Per-testee config required." });
  }
  // benchmark superRefine deferred to v1.x per §E item 8.
});

type TestEditorInput = z.infer<typeof testEditorSchema>;
```

**Save handler (draft save — create + edit):**
1. Compose body from form data, mapping mode-specific sub-objects to flat TestCreate/TestUpdate fields per backend's expected shape (e.g. `per_testee.pill_id` → top-level `target_difficulty` + question generation lives in `/v1/tests/{id}/questions` separately).
2. Create: `unwrap(client.POST("/v1/tests", { body }))`. Edit: `unwrap(client.PATCH("/v1/tests/{test_id}", { params: { path: { test_id } }, body: dirtyFields }))`.
3. Success: invalidate `adminKeys.tests.all()` + `adminKeys.tests.detail(testId)`; toast.info("Test saved"); if create-mode, `router.replace('/admin/tests/{newId}/edit')` (URL flips from `new` to the actual id).
4. `ApiError`: `applyApiErrorToForm`.

**Publish handler:**
1. `unwrap(client.POST("/v1/tests/{test_id}/publish"))`. Refuses if there's no test_id yet (create-mode forces save-as-draft first).
2. Success: invalidate; toast.info("Test published — bindable to assignments"); UI re-renders with the locked-fields state.

**Lock handler:**
1. `unwrap(client.POST("/v1/tests/{test_id}/lock"))`.
2. Success: invalidate; toast.info("Test locked — fully immutable"); PublishControls flips to locked variant.

**Unlock handler:**
1. `unwrap(client.POST("/v1/tests/{test_id}/unlock"))`.
2. Backend likely 422s if any in-flight attempts exist per design copy (`admin-test-authoring.jsx:594–596`). On 422, surface error toast with backend message.
3. Success: invalidate; toast.info("Test unlocked — back to published"); UI flips to published variant.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `create_mount` | `testId === "new"` | Form pristine; mode picker enabled (active card = none until admin picks); mode-conditional section hidden until mode chosen; identity card visible; publish controls render in draft state but Publish disabled (must save first). |
| `create_mode_picked` | Admin clicks a ModePicker card | `mode` form field updates; mode-conditional section mounts. |
| `edit_loading` | `testId !== "new"` and `GET /v1/tests/{id}` in-flight | Skeleton: PageHeader + status bar + identity card + mode section + publish controls all show skeletons. |
| `edit_happy_draft` | Fetch resolves; `status === "draft"` | All editable fields render in editable state; mode picker disabled (mode locks after first save per AC-D17); publish controls show "Save draft" + "Publish" buttons. |
| `edit_happy_published` | Fetch resolves; `status === "published"` AND `lock_mode === "open"` | Warn banner mounts at top with copy per `admin-test-authoring.jsx:185–187`. Title + description + loop_mode (where present per mode) remain editable; mode + pill + difficulty + question pool render locked (lock icon + readonly + sunk bg). Publish controls show "Save changes" + "Lock" buttons. |
| `edit_happy_locked` | Fetch resolves; `lock_mode === "campaign-locked"` | Warn banner with copy per `:188`. **All** fields read-only. Publish controls show "Unlock" button only. |
| `mode_per_testee_active` | `mode === "per_testee"` | `PerTesteeSection` renders inside the middle card. |
| `mode_frozen_active` | `mode === "frozen"` | `FrozenSection` renders inside the middle card. Question pool list fetched + rendered. |
| `mode_hand_authored_active` | `mode === "hand_authored"` | `HandAuthoredSection` renders with the info-card + nested `FrozenSection`. |
| `mode_benchmark_active` | `mode === "benchmark"` (only reachable via existing benchmark rows from before §E item 8 lock; ModePicker disabled for new) | Renders v1 stub per §E item 8 — "Benchmark authoring coming in v1.x" notice card; no editable fields. |
| `frozen_pool_empty` | Question pool query returns 0 questions | Pool table renders empty-state copy "No questions yet — click 'Add question' to start." + Add CTA. |
| `frozen_pool_below_recommended` | Pool count < 8 | Inline hint "Add at least N more questions to reach the recommended pool size of 8." per `admin-test-authoring.jsx:410–412`. |
| `add_question_clicked` | Admin clicks "+ Add question" in `FrozenSection` / `HandAuthoredSection` | `QuestionEditorModal` (B.3) mounts in create mode. |
| `edit_question_clicked` | Admin clicks Edit on a pool question row | `QuestionEditorModal` mounts in edit mode with the question_id. |
| `save_submitting` | Save button clicked; rhf `isSubmitting` | Button shows pulse-dot + "Saving…"; fields disabled. |
| `save_validation_errors` | zod safeParse fails OR backend 422 | Pattern A inline errors per field. |
| `save_success_create` | Create 2xx | toast.info("Test saved"); `router.replace('/admin/tests/{newId}/edit')` (id flip); UI now in edit-mode against the new id. |
| `save_success_edit` | Edit 2xx | toast.info("Test saved"); UI updates. |
| `publish_clicked_unsaved_creates` | Publish clicked in create-mode before save | Inline notice "Save the test as draft first, then publish." Publish button disabled until at least one save lands. |
| `publish_submitting` | Publish endpoint in-flight | Publish button pulse-dot + "Publishing…". |
| `publish_success` | 2xx | toast.info("Test published — bindable to assignments"); query invalidates; UI flips to published state. |
| `lock_submitting` / `lock_success` | Lock action | Mutation fires; on 2xx UI flips to locked state. |
| `unlock_blocked_inflight` | Unlock returns 422 with code suggesting in-flight attempts exist | Pattern B error toast with backend message ("Can't unlock — N attempts in flight"). UI stays in locked state. |
| `unlock_success` | Unlock 2xx | toast.info("Test unlocked"); UI flips to published. |
| `cancel_dirty` | User clicks Cancel with dirty form (only on the publish footer? — design doesn't surface a top-level Cancel; navigation away is implicit) | If admin navigates away via the Rail with dirty form, browser `beforeunload` prompt fires. v1 standard. |
| `error` | Initial query throws | Pattern C boundary via `(authed)/(admin)/tests/[testId]/edit/error.tsx`. |
| `not_found` | `GET /v1/tests/{id}` returns 404 | Empty-state "Test not found" + "Back to tests" CTA. |
| `role_mismatch` | Testee role hits the editor | `/403`. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Admin creates a per-testee test
  Given the admin opens /admin/tests/new/edit
  When the admin picks the "Per-testee" mode card
  And enters title "Antifouling — focus", picks pill "Antifouling Systems", sets difficulty D5, question count 8, time ceiling 30 min
  And clicks "Save draft"
  Then POST /v1/tests fires with {name, mode: "per_testee", target_difficulty: 5, duration_minutes: 30, ...}
  And on 201 the URL replaces to /admin/tests/{newId}/edit
  And toast.info("Test saved") renders
```

```gherkin
Scenario: Admin authors a frozen test with a question pool
  Given the admin opens /admin/tests/new/edit and picks "Frozen pool" mode
  When the admin enters title and saves draft
  And the URL flips to /admin/tests/{newId}/edit
  And the admin clicks "+ Add question" in the pool table
  And QuestionEditorModal opens, the admin enters an MCQ and saves
  Then the question appears in the pool table
  And the "Add at least N more questions" hint updates
```

```gherkin
Scenario: Mode locks after first save
  Given a draft test exists with mode "frozen"
  When the admin opens /admin/tests/{id}/edit
  Then the ModePicker is disabled
  And clicking other mode cards has no effect
```

```gherkin
Scenario: Publishing locks mode + pill + question pool but leaves title editable
  Given a draft frozen test with 8 questions
  When the admin clicks "Publish"
  And POST /v1/tests/{id}/publish returns 200
  Then the warn banner "This test is published" renders
  And the title field remains editable
  And the question pool table rows have Edit buttons disabled (per locked status)
  And PublishControls shows "Save changes" + "Lock" buttons
```

```gherkin
Scenario: Locking a published test makes all fields read-only
  Given a published test with status="published" + lock_mode="open"
  When the admin clicks "Lock"
  And POST /v1/tests/{id}/lock returns 200
  Then lock_mode becomes "campaign-locked"
  And the warn banner copy updates to "This test is locked"
  And all fields including title are read-only
  And PublishControls shows "Unlock" button only
```

```gherkin
Scenario: Unlocking blocked by in-flight attempts
  Given a locked test
  When the admin clicks Unlock
  And POST /v1/tests/{id}/unlock returns 422 with backend message about in-flight attempts
  Then a Pattern B error toast renders with the backend message
  And the test stays in locked state
```

```gherkin
Scenario: Per-testee mode form validation
  Given the admin opens /admin/tests/new/edit and picks per-testee
  When the admin clicks Save draft without picking a pill
  Then zod surfaces "Pick a pill." under the pill field
  And no network call fires
```

```gherkin
Scenario: Benchmark mode card is disabled in v1 ModePicker
  Given the admin opens /admin/tests/new/edit
  When the ModePicker mounts
  Then the benchmark card renders with a "coming-soon" badge and disabled state
  And clicking it does not change the form's mode field
  And the tooltip "Benchmark authoring coming in v1.x" renders on hover
```

```gherkin
Scenario: Frozen mode shows pool count hint
  Given a frozen test with 3 questions in pool
  When the editor renders
  Then the FrozenSection shows "Add at least 5 more questions to reach the recommended pool size of 8."
```

```gherkin
Scenario: Test not found
  Given the admin opens /admin/tests/{deleted-uuid}/edit
  When GET /v1/tests/{id} returns 404
  Then the empty-state "Test not found" renders
  And the "Back to tests" CTA links to /admin/tests
```

```gherkin
Scenario: Backend 422 projects to field
  Given the admin submits with a duplicate title
  When PATCH returns 422 with detail [{loc: ["body", "name"], msg: "duplicate"}]
  Then applyApiErrorToForm projects the error under the title field
```

```gherkin
Scenario: Publish disabled in create-mode before first save
  Given the admin is on /admin/tests/new/edit
  And mode is picked, title entered, but no save has happened
  Then the Publish button is disabled with tooltip "Save the test as draft first."
```

```gherkin
Scenario: Hand-authored mode shows info card + frozen-style pool
  Given the admin picks hand_authored mode
  Then the editor shows the "You're writing every question by hand" info card
  And the FrozenSection pool table renders below the card
```

```gherkin
# DEFERRED v1.x — Benchmark mode renders difficulty curve display
# (See §E item 8 — benchmark authoring deferred from v1.)
```

(Thirteen active scenarios mapped to §D.2 test-editor integration tests — at least one trio per non-benchmark mode plus publish/lock/unlock/edit flow scenarios; the prior benchmark-display Gherkin is deferred per §E item 8.)

**7. Edge cases / gotchas**

- **`status: "locked"` is derived, not backend-enum.** Backend `TestStatus` enum is `draft|published` only (`frontend/openapi/schema.json:3273–3279`). Design's "locked" = `status=published` + `lock_mode="campaign-locked"`. Display helper at `frontend/src/lib/tests/derive-display-status.ts` (§B.1 §4) is the single source. §H (a) item 1.
- **Mode picker locks after first save (not after publish).** Per AC-D17 + design `admin-test-authoring.jsx:203–204`: "Mode is locked once the test is published" — but a draft test that's been saved at least once already has a `testId`, and changing mode would create a different data shape (per_testee config vs benchmark config etc.). v1 simplest: lock mode after first save regardless of status. Verify with build session — if backend allows mode change on drafts, FE can unlock; if not, spec body is correct.
- **`per_testee` mode has no question pool.** AC-D5 says per_testee tests generate questions JIT at testee attempt-start. Editor for per_testee mode shows no `FrozenSection`; only the per_testee config card. No Add question button.
- **`benchmark` mode also has no question pool in the editor.** Per AC-D13: questions are drawn from pre-calibrated anchors per the difficulty curve. Editor configures the spec only.
- **`hand_authored` mode reuses `FrozenSection` table.** Per design (`admin-test-authoring.jsx:432` — `<FrozenSection locked={locked}/>` inside HandAuthoredSection). Same table component, different parent posture.
- **`frozen` vs `hand_authored` distinction.** Per design comments + spec body: both have a pool of admin-managed questions. The difference is just authorship posture (whether the admin invoked AI to generate the initial pool or not). Backend may not distinguish; if both are stored identically and only differ by an `authoring_mode` field, that's fine. Verify §H (b) item 7.
- **Question pool query is separate from the test query.** `useQuery(adminKeys.tests.detail(id))` for test fields; `useInfiniteQuery(adminKeys.questions.list(id))` for the pool. Two parallel fetches; both must resolve before the editor is fully rendered.
- **Cross-mode form state preservation.** If admin picks frozen, fills some fields, then switches to per_testee, then back to frozen — the frozen-specific config is lost (form state for per_testee replaces it). v1 acceptable; admin can re-enter. (Doesn't matter post-first-save because mode locks.)
- **`difficulty_curve` editor UX.** Design `admin-test-authoring.jsx:504–544` shows a bar chart display with an "edit distribution" link that's deferred ("not yet shipped"). v1 ships read-only display of an admin-entered distribution; the entry UX is TBD — likely a per-band numeric input grid OR a JSON textarea (admin-tier UX acceptable). §H (b) item 6.
- **`benchmark_scope` field.** Backend `TestCreate.benchmark_scope` is the OpenAPI `BenchmarkScope` enum with values `"subject" / "pill" / "path"` (verified against `frontend/openapi/schema.json:6847–6855`). v1 ships no benchmark authoring per §E item 8; v1.x revival must use these canonical values (NOT the prior `learning_path` paraphrase).
- **`cohort_window` locks the test once any testee starts.** AC-D13 + design `admin-test-authoring.jsx:473–474`: "Locked once any testee starts." Same loop_mode-lock pattern as assignments (§B.4 from identity file). Verify via §H (b) item 9.
- **Optimistic updates not used.** All mutations wait for backend response.
- **No save-button-in-fields-card.** Save is in the bottom PublishControls only. Design pattern.

**8. Visual reference**

- `frontend/design-reference/prototype/admin-test-authoring.jsx:156–234` — `TestEditor` (top-level shell).
- `frontend/design-reference/prototype/admin-test-authoring.jsx:236–252` — `titleFor` + `descriptionFor` mode-specific copy helpers.
- `frontend/design-reference/prototype/admin-test-authoring.jsx:253–265` — `StatusBar`.
- `frontend/design-reference/prototype/admin-test-authoring.jsx:270–328` — `MODES` constant + `ModePicker`.
- `frontend/design-reference/prototype/admin-test-authoring.jsx:333–368` — `PerTesteeSection`.
- `frontend/design-reference/prototype/admin-test-authoring.jsx:370–414` — `FrozenSection`.
- `frontend/design-reference/prototype/admin-test-authoring.jsx:417–434` — `HandAuthoredSection`.
- `frontend/design-reference/prototype/admin-test-authoring.jsx:437–481` — `BenchmarkSection`.
- `frontend/design-reference/prototype/admin-test-authoring.jsx:483–502` — `DifficultyPicker`.
- `frontend/design-reference/prototype/admin-test-authoring.jsx:504–544` — `DifficultyCurve`.
- `frontend/design-reference/prototype/admin-test-authoring.jsx:549–603` — `PublishControls` (3 variants).
- Screenshot: `v6-fe8-20-test-authoring.jpg`.

---

### B.3 Question editor modal — 5-type discriminated union (pattern + reference)

**1. Route segment + URL state**

- Not a route. Modal overlay opened from `FrozenSection` / `HandAuthoredSection` inside §B.2.
- Ephemeral modal state: `useState<{open: boolean, questionId?: string}>(closed)` lives in `TestEditorPage`.

**2. Components**

- **Scaffold reused:** same as §B.2 §2 — `useForm` + `zodResolver` + `useMutation` + `useQueryClient` + `applyApiErrorToForm`.
- **Shared admin primitives consumed from `fe-specs/FE-8-admin-catalogue.md §C`:** `Modal` + `ModalHeader` + `ModalActions` (§C.5); `Field` + `FieldRow` (§C.6); toast (§C.7).
- **New in this PR (tests scope):**
  - `QuestionEditorModal` — top-level modal wrapper. Renders `Modal` + `ModalHeader` (eyebrow "EDIT QUESTION · NN OF MM" + serif title) + `QuestionEditorInner` + `ModalActions` (Cancel + Save & previous / Save & next). Per `admin-test-authoring.jsx:616–632`.
  - `QuestionEditorInner` — the discriminated-union form per `admin-test-authoring.jsx:650–716`. Shared fields: question type chooser (5 cards), pill (single-select), difficulty (`DifficultyPicker`), anchor status (anchor vs non-anchor toggle), question body (markdown textarea). Type-specific subcomponent mounts based on selected type.
  - `QuestionTypeChooser` — 5-card type chooser per `admin-test-authoring.jsx:654–674`. Maps `QUESTION_TYPES` constant at `:608–614` to cards. Active card flips to ink-bg. Disabled in edit mode (type locks after first save).
  - **Per-type subcomponents** (lightweight wrappers reading their own slice of `config` form field):
    - `MCQChoices` per `admin-test-authoring.jsx:718–748`. 2–6 choices with radio for correct + text input per choice + Remove + Add choice.
    - `TFChoices` per `:750–761`. Two-button True / False picker.
    - `MatchPairs` per `:777–800`. 2–8 left-right pairs as two-column input rows.
    - `SAGradingRubric` per `:763–775`. Single rubric textarea. Reused for both `short_answer` AND `scenario` types per design `:712`.
  - **NOTE: Per the user-locked plan decision (`/root/.claude/plans/fresh-session-fe-8-tingly-candy.md` §10 Q2 = "pattern + reference"), per-type form field shapes are documented at the **pattern level** here (discriminated union by `kind`), with the per-type schemas held in `admin-test-authoring.jsx:650+` as the authoritative reference. Build session resolves the per-type field shapes against the JSX + the backend's `config: object` contract (untyped — see §H (a) item 2).**
- **shadcn primitives installed:** none beyond FE-2's set + `Sheet` from catalogue.
- **Design primitives reused:** `Pill` (FE-2) for type badges where shown. `.card`, `.input`, `.eyebrow`, `.serif`, `.serif-it`, `.btn`, `.btn-primary`, `.btn-ghost`, `.mono`, `.t-meta`, `.muted` per FE-2.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/tests/{test_id}/questions/{question_id}` | Fetch existing question for edit-mode pre-fill. | **Exists** at `frontend/openapi/schema.json:8510`. Returns `QuestionResponse`. |
| `POST /v1/tests/{test_id}/questions` | Create new question. Body: `QuestionCreate` (`type`, `config: object`, `assigned_difficulty`, optional `question_group_id`). | **Exists** at `frontend/openapi/schema.json:8384+`. |
| `PATCH /v1/tests/{test_id}/questions/{question_id}` | Update existing question. Body: `QuestionUpdate`. | **Exists** at `frontend/openapi/schema.json:8510+`. |
| `DELETE /v1/tests/{test_id}/questions/{question_id}` | Delete question. | **Exists** at `frontend/openapi/schema.json:8510+`. |

**4. Form fields + zod + rhf (pattern + reference)**

**LOCKED v1 contract:** FE owns the per-type `config` shape via the `compose-question-config.ts` helper. Backend `QuestionCreate.config` stays `object` for v1; per-type backend typing is deferred to v1.x.

```ts
// Discriminated union by question type.
// Per-type config schemas resolved at build time against admin-test-authoring.jsx:650+
// and the backend's QuestionCreate.config: object (LOCKED FE-owned for v1 per §H (a) item 2).

const questionBaseSchema = z.object({
  type: z.enum(["multiple_choice", "true_false", "matching", "short_answer", "scenario"]),
  pill_id: z.string().uuid("Pick a pill."),
  assigned_difficulty: z.number().int().min(1).max(10),
  question_group_id: z.string().uuid().nullable().optional(),
  body: z.string().min(1, "Question body is required.").max(4096),
  is_anchor: z.boolean().default(false),  // anchor pool membership for calibration
});

// Per-type config — resolved against design reference; FE owns the contract until backend types it.
const mcqConfigSchema = z.object({
  choices: z.array(z.object({
    id: z.string(),                   // "A" | "B" | "C" | "D" | "E" | "F"
    text: z.string().min(1).max(512),
    correct: z.boolean().default(false),
  })).min(2).max(6),
}).refine(d => d.choices.filter(c => c.correct).length === 1, {
  path: ["choices"],
  message: "Mark exactly one choice as correct.",
});

const tfConfigSchema = z.object({
  correct: z.boolean(),
});

const matchConfigSchema = z.object({
  pairs: z.array(z.object({
    left: z.string().min(1),
    right: z.string().min(1),
  })).min(2).max(8),
});

const saConfigSchema = z.object({
  rubric: z.string().min(1, "AI grading rubric is required for short-answer questions.").max(4096),
});

const scenarioConfigSchema = z.object({
  rubric: z.string().min(1).max(4096),  // shares the SA rubric pattern per design :712
});

const questionSchema = z.discriminatedUnion("type", [
  questionBaseSchema.extend({ type: z.literal("multiple_choice"), config: mcqConfigSchema }),
  questionBaseSchema.extend({ type: z.literal("true_false"), config: tfConfigSchema }),
  questionBaseSchema.extend({ type: z.literal("matching"), config: matchConfigSchema }),
  questionBaseSchema.extend({ type: z.literal("short_answer"), config: saConfigSchema }),
  questionBaseSchema.extend({ type: z.literal("scenario"), config: scenarioConfigSchema }),
]);

type QuestionInput = z.infer<typeof questionSchema>;
```

**Submit handler:**
1. Compose `QuestionCreate` body. **The `body` + `is_anchor` fields are NOT in `QuestionCreate` per OpenAPI `:2479–2515` — they must go into `config` per FE convention until backend types them out.** §H (a) item 2.
2. Pack the form's per-type config + body + pill_id + is_anchor into `config` object: `config = { ...typeSpecificConfig, body, pill_id, is_anchor }`.
3. Create: `unwrap(client.POST("/v1/tests/{test_id}/questions", { body: { type, config, assigned_difficulty, question_group_id } }))`.
4. Edit: `unwrap(client.PATCH("/v1/tests/{test_id}/questions/{question_id}", { body: { config, assigned_difficulty, question_group_id } }))`. (Type is immutable on edit per §B.2 §7 pattern.)
5. Success: invalidate `adminKeys.questions.list(testId)`; toast.info("Question saved"); close modal (or advance to next if Save & next clicked).
6. `ApiError`: `applyApiErrorToForm(err, form)` — backend 422 detail array projects onto field paths per FE-1 §C.2.

**Pill picker for the question:** sub-select reading `useQuery(adminKeys.pills.list({}))`. Same pattern as `PerTesteeSection`'s pill picker (§B.2).

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `modal_create_open` | Add question clicked in `FrozenSection` | Modal mounts; form pristine; type chooser pristine (no type pre-selected — admin must pick); body field empty. |
| `modal_edit_open` | Edit clicked on a pool question row | Modal mounts; form pre-filled from `GET /v1/tests/{id}/questions/{qid}`; type chooser disabled (type immutable post-create). |
| `type_picked_mcq` | Admin clicks MCQ type card | `MCQChoices` subcomponent mounts; type-specific config initialised with empty choices array. |
| `type_picked_tf` | Admin clicks T/F card | `TFChoices` subcomponent mounts. |
| `type_picked_match` | Admin clicks Match card | `MatchPairs` subcomponent mounts. |
| `type_picked_sa` | Admin clicks Short Answer card | `SAGradingRubric` subcomponent mounts. |
| `type_picked_scenario` | Admin clicks Scenario card | `SAGradingRubric` reused (per design `:712`). |
| `mcq_choice_added` | Admin clicks "Add choice (max 6)" | New choice row appends with empty text + correct=false. |
| `mcq_choice_removed` | Admin clicks X on a choice | Choice removed (min 2 enforced). |
| `mcq_correct_changed` | Admin clicks radio next to a choice | That choice's `correct` flips to true; others flip to false (single-correct invariant). |
| `match_pair_added` | Admin clicks "Add pair (max 8)" | New pair row appends. |
| `submit_submitting` | rhf `isSubmitting` | "Save & next" button pulse-dot + "Saving…"; fields disabled. |
| `submit_validation_errors` | zod safeParse fails OR backend 422 | Pattern A inline errors per field. |
| `submit_success` | 2xx | Modal closes (or advances on "Save & next"); pool list refetches. |
| `cancel_dirty` | Cancel with dirty form | Browser `confirm("Discard unsaved changes?")`. |
| `save_and_next` | "Save & next →" clicked | After save, mount the next question in the pool for editing (loops through pool list). |
| `save_and_previous` | "Save & previous" clicked | After save, mount the previous question for editing. |
| `error` | Mutation throws non-422 | Pattern B error toast. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Admin authors an MCQ question
  Given the question editor modal is open in create mode
  When the admin picks the MCQ type card
  And enters a question body
  And adds 4 choices with the second marked correct
  And picks a pill, sets difficulty D4, marks anchor=true
  And clicks Save & next
  Then POST /v1/tests/{id}/questions fires with type="multiple_choice", config={body, pill_id, is_anchor, choices: [...]}
  And on 201 the modal advances to edit the next pool question (or closes if pool is now empty)
```

```gherkin
Scenario: MCQ requires exactly one correct choice
  Given the admin marks two MCQ choices as correct
  When submit fires
  Then zod surfaces "Mark exactly one choice as correct." under the choices field
```

```gherkin
Scenario: True/False question
  Given the admin picks the T/F type card and enters a question body
  And clicks the True or False button (let's say False is correct)
  And clicks Save
  Then POST fires with type="true_false", config={body, pill_id, is_anchor, correct: false}
```

```gherkin
Scenario: Matching question
  Given the admin picks the Match type card
  And enters 4 left/right pairs
  And submits
  Then POST fires with type="matching", config={body, pill_id, is_anchor, pairs: [...]}
```

```gherkin
Scenario: Short-answer question requires rubric
  Given the admin picks the Short Answer type card
  And enters question body but leaves rubric empty
  When submit fires
  Then zod surfaces "AI grading rubric is required for short-answer questions."
```

```gherkin
Scenario: Scenario question reuses the SA rubric pattern
  Given the admin picks the Scenario type card
  Then SAGradingRubric subcomponent mounts (shared with Short Answer per design)
  And submit composes config with rubric field
```

```gherkin
Scenario: Type is immutable in edit mode
  Given the admin opens the editor on an existing MCQ question
  Then the type chooser cards are disabled
  And the MCQ card is active and read-only
```

```gherkin
Scenario: Backend 422 projects to nested config field
  Given the admin submits an MCQ with malformed config
  When POST returns 422 with detail [{loc: ["body", "config", "choices", 0, "text"], msg: "too long"}]
  Then applyApiErrorToForm projects the error to config.choices.0.text
  And the modal stays open
```

```gherkin
Scenario: Cancel with dirty form prompts confirm
  Given the modal is open with unsaved changes
  When the admin clicks Cancel
  Then browser confirm("Discard unsaved changes?") fires
```

```gherkin
Scenario: Save & next advances within the pool
  Given the pool has 3 questions and the admin is editing question 2
  When the admin clicks Save & next
  And the save succeeds
  Then the modal updates to question 3 in edit mode (next in pool list)
  And the pool list refetches in the background
```

```gherkin
Scenario: Save & previous on first question disables previous
  Given the admin is editing the first question in the pool
  Then the Save & previous button is disabled
```

(Eleven total scenarios mapped to §D.2 question-editor integration tests.)

**7. Edge cases / gotchas**

- **`config` is `object` (untyped) on the backend — LOCKED FE-owned v1 contract** per §H (a) item 2. Per `QuestionCreate.config: object` (`frontend/openapi/schema.json:2488–2491`), `compose-question-config.ts` is the source of truth; backend typing deferred to v1.x.
- **`pill_id`/`body`/`is_anchor` are NOT on `QuestionResponse` — LOCKED packed inside `config`** per the §H (a) item 2 v1 contract via `compose-question-config.ts`. Backend typing of these as first-class fields is deferred to v1.x. Design shows pill / body / anchor per question (table column); FE renders by unpacking `config` via `unpack-question-config.ts`.
- **Edit-mode pre-fill via cached list (LOCKED v1).** Per §E item 7, edit modal pre-fills from `adminKeys.questions.list(testId)` cached pages; no per-question detail `GET /v1/tests/{id}/questions/{qid}` is fired unless the cache misses (deep-link reload). Saves still PATCH the per-question endpoint.
- **Question type is immutable post-create.** Spec body assumes; verify backend 422s on type change in PATCH. Reason: changing type changes the entire `config` shape — destructive without explicit migration.
- **Image / figure attachments not in v1.** `QuestionResponse.reference_image_url` + `reference_image_caption` exist (`frontend/openapi/schema.json:2549–2569`), but design's editor doesn't surface upload UX. v1 ships text-only per AC-CD24 typed-stub pattern (FE-2 spec). Future v1.x adds image upload. §E.1.
- **`Save & next` requires pool context.** The modal needs to know the full ordered pool to advance. Pass it via parent prop OR re-read from `useQuery(adminKeys.questions.list(testId))` cache.
- **`Save & previous` on first question is disabled.** Same for `Save & next` on last question (which becomes "Save and close" copy).
- **No question delete from inside the modal.** Delete affordance lives on the pool row (FrozenSection table row action OR a context menu — design doesn't surface explicit delete; spec body adds a Remove row action). v1 build session decides whether to add inline.
- **`question_group_id` is for question grouping.** Per design line 2492-2503: backed by uuid. Spec body treats as optional (groups are a v1.x feature — questions can stand alone). Verify backend doesn't require it.
- **MCQ choice ids (A/B/C...) are FE-assigned.** Backend just receives an array; the letter prefix is display-only. Spec body uses array index → letter mapping in render.

**8. Visual reference**

- `frontend/design-reference/prototype/admin-test-authoring.jsx:606–614` — `QUESTION_TYPES` constant (5 types with metadata).
- `frontend/design-reference/prototype/admin-test-authoring.jsx:616–632` — `QuestionEditorModal`.
- `frontend/design-reference/prototype/admin-test-authoring.jsx:634–648` — `QuestionEditorIsolated` (review-only view; in practice renders as modal).
- `frontend/design-reference/prototype/admin-test-authoring.jsx:650–716` — `QuestionEditorInner` (shared fields + per-type switch).
- `frontend/design-reference/prototype/admin-test-authoring.jsx:718–748` — `MCQChoices`.
- `frontend/design-reference/prototype/admin-test-authoring.jsx:750–761` — `TFChoices`.
- `frontend/design-reference/prototype/admin-test-authoring.jsx:763–775` — `SAGradingRubric` (shared with Scenario).
- `frontend/design-reference/prototype/admin-test-authoring.jsx:777–800` — `MatchPairs`.
- Screenshot: `v6-fe8-20-test-authoring.jpg` (composite — question editor inset).

---

## C. Cross-page concerns

### C.1 `adminKeys` consumption (from catalogue)

`adminKeys.{tests,questions,pills}` consumed from `fe-specs/FE-8-admin-catalogue.md §C.1` unchanged. Import:

```ts
import { adminKeys } from "@/lib/queries/admin-keys";  // canonical — declared in FE-8-admin-catalogue.md §C.1
```

Tests-side invalidation chains:
- `POST /v1/tests` → invalidate `adminKeys.tests.all()`.
- `PATCH /v1/tests/{id}` → invalidate `adminKeys.tests.all()` + `adminKeys.tests.detail(id)`.
- `POST /v1/tests/{id}/publish|lock|unlock` → invalidate `adminKeys.tests.all()` + `adminKeys.tests.detail(id)`.
- `POST /v1/tests/{id}/questions` → invalidate `adminKeys.questions.list(id)` + `adminKeys.tests.detail(id)` (pill_count derived from questions list).
- `PATCH /v1/tests/{id}/questions/{qid}` → invalidate `adminKeys.questions.list(id)` + `adminKeys.questions.detail(id, qid)`.
- `DELETE /v1/tests/{id}/questions/{qid}` → invalidate `adminKeys.questions.list(id)`.

### C.2–C.8 Shared primitives

All shared primitives (`(admin)` route guard, `applyApiErrorToForm`, `FilterBar`, `Modal`, `Field`/`FieldRow`/`FieldError`, toast helper, Pattern C boundary) consumed from `fe-specs/FE-8-admin-catalogue.md §C.2–§C.8` unchanged.

### C.9 Cross-file picker integrations

- `PerTesteeSection` (`B.2`) consumes `adminKeys.pills.list({})` for pill picker.
- `BenchmarkSection` (`B.2`) consumes `adminKeys.pills.list({})` for pill multi-select.
- `QuestionEditorInner` (`B.3`) consumes `adminKeys.pills.list({})` for pill single-select.

All three converge on the same `adminKeys.pills.list({})` cache — single fetch covers all three pickers across the editor session.

### C.10 Display-status helper (tests-specific)

`frontend/src/lib/tests/derive-display-status.ts` (declared in §B.1 §4) is a tests-domain helper for the 3-status display (`draft|published|locked`) from the 2-status backend enum + `lock_mode` field. **Single source for the derivation**; consumed by `TestsTable` (B.1), `StatusBar` (B.2), `PublishControls` (B.2), `WarnBanner` (B.2). Unit-tested per §D.1; helper is the LOCKED v1 source of truth for the 3-status display derivation from the 2-status backend enum + `lock_mode` (no separate `is_locked` field — verified against `frontend/openapi/schema.json:3273–3279`).

---

## D. Test cases (Vitest)

### D.1 Unit tests (lib + helpers)

- `frontend/src/lib/tests/derive-display-status.test.ts` — exhaustive table of (`status`, `lock_mode`) → display status combinations.
- `frontend/src/lib/tests/compose-question-config.test.ts` — pure helper that packs per-type form data into the `config` object (per §B.3 §4 step 2). Tests each of 5 types. **This helper is the LOCKED v1 contract per §H (a) item 2** — backend per-type typing deferred to v1.x.
- `frontend/src/lib/tests/unpack-question-config.test.ts` — pure helper that unpacks `config` from `QuestionResponse` into form-friendly per-type subobjects.

### D.2 Page integration tests

One test file per §B entry:

- `frontend/src/app/(authed)/(admin)/tests/page.test.tsx` — §B.1 trios (7 scenarios).
- `frontend/src/app/(authed)/(admin)/tests/[testId]/edit/page.test.tsx` — §B.2 trios (14 scenarios).
- `frontend/src/app/(authed)/(admin)/tests/[testId]/edit/_components/question-editor-modal.test.tsx` — §B.3 trios (11 scenarios).

Total: 32 tests-side integration scenarios.

### D.3 Round-trip integration test

`frontend/tests/integration/admin-tests-roundtrip.test.tsx`:
- Done-when in narrative form (tests slice): admin opens `/admin/tests/new/edit` → picks frozen mode + title + saves draft → URL flips to `/admin/tests/{id}/edit` → adds one MCQ + one T/F + one Match + one Short Answer + one Scenario question via the question editor modal → publishes → returns to `/admin/tests` list and verifies the published row → opens `/admin/assignments/new/edit` (cross-file from identity) and verifies the test appears in the test picker.

Single test, exercises every page in the tests file + cross-file integration with the assignment editor.

### D.4 Coverage gate (FE_CHECKLIST.md FE-8 tests row ticks on)

- All §B Gherkin + D.3 round-trip green via `pnpm test --run`.
- `pnpm typecheck` clean.
- `pnpm lint` clean.
- `pnpm build` succeeds.

---

## E. Known placeholders (DO NOT SHIP AS-IS)

| # | Placeholder | Location | Action before production |
|---|---|---|---|
| 1 | Question editor image / figure attachment | `(authed)/(admin)/tests/[testId]/edit/_components/question-editor-inner.tsx` | v1 ships text-only per AC-CD24 typed-stub pattern. `QuestionResponse.reference_image_url` field exists backend-side; v1.x adds upload UX. |
| 2 | `pills` count column on test list (derived) + 4-stat aggregate counts | `(authed)/(admin)/tests/_components/tests-table.tsx` + `_components/test-stats-row.tsx` | Backend adds `pill_count` to `TestResponse` + a `/v1/tests?summary_only=true` aggregate endpoint OR a `/v1/tests/stats` endpoint. Until landed: render "—" / compute from cached pages. §H (b) items 2 + 3. |
| 3 | Question pool reorder | (no v1 surface) | v1 question order = creation order (`created_at` ASC server-side). v1.x adds drag-handle reorder (`@dnd-kit` already added in catalogue B.7). |
| 4 | `difficulty_curve` editor UX | `(authed)/(admin)/tests/[testId]/edit/_components/benchmark-section.tsx` | v1 display-only bar chart; entry UX TBD. v1.x adds per-band numeric input grid OR sliders. §H (b) item 6. |
| 5 | AI generation invocation ("Suggest with AI" button in question editor) | `(authed)/(admin)/tests/[testId]/edit/_components/question-editor-inner.tsx` | v1 manual-only authoring. v1.x adds AI-suggest affordance for frozen-mode pool authoring. |
| 6 | Per-test analytics drill-down | (no v1 surface) | Published-state banner shows "8 attempts started" as text; v1.x adds click-through to per-attempt list (FE-9 territory). |
| 7 | Question editor pre-fill reads from cached pool list, not per-question GET | `(authed)/(admin)/tests/[testId]/edit/_components/question-editor-modal.tsx` | LOCKED v1: edit-mode modal pre-fills from the already-cached `useInfiniteQuery(adminKeys.questions.list(testId))` flattened pages. Skip the per-question `GET /v1/tests/{id}/questions/{qid}` round-trip. Defensive: re-fetch only on cache miss (e.g. deep-link reload). |
| 8 | Benchmark mode authoring dropped from v1 | `(authed)/(admin)/tests/[testId]/edit/_components/benchmark-section.tsx` | LOCKED v1: `BenchmarkSection` ships **as a stub** that renders a "Benchmark authoring coming in v1.x — pre-calibrated benchmark tests are administrator-config-only for v1" notice. The four-card `ModePicker` renders the benchmark card with a `coming-soon` badge and `disabled aria-disabled` state. Per-testee, frozen, and hand-authored modes ship full editor surfaces. |

---

## F. Scope additions beyond prior FE-N specs

### F.1 No SPEC.md edits required

No spec amendments. All AC anchors cited are already canonical.

### F.2 FE-9 boundary explicitly excluded

The following surfaces are explicitly **NOT** in FE-8 tests scope:

- Calibration / anchor drift queue (`/admin/calibration`) — FE-9.
- Per-attempt drill-down from a published test — FE-9 ops dashboard.
- AI question generation invocation UX — deferred to v1.x.
- Test version history / diff view — deferred.

### F.3 AC-CD-structural additions

None new in this file. Inherits the catalogue file's additions (`@dnd-kit`, `Sheet`).

---

## G. Session 2 onwards — template propagation + variances declared

This file follows the catalogue file's variance declarations (§G of `fe-specs/FE-8-admin-catalogue.md`) — and declares one additional variance specific to the test editor:

**Additional file-specific variance (declared per FE-7 §G precedent at `fe-specs/FE-7-profile.md:746`):**

- **The 4 mode-conditional editor sections (per_testee / frozen / hand_authored / benchmark) compose inside §B.2's §2 (Components) rather than fanning out into 4 separate §B entries.** Justified: each mode is selected via the same form-root, mounts/unmounts inside the same editor shell, shares the same publish controls + identity fields, and the mode sections are page-specific with no cross-PR reuse rationale (they live exclusively under `/admin/tests/[testId]/edit`). The 8-section template still applies per §B entry; mode-specific Gherkin trios land in §B.2 §6 (one trio per mode minimum — 4 mode-specific scenarios + 10 cross-mode scenarios = 14 total).

  Alternative considered: fan out into B.2 (test editor shell), B.3 (per_testee section), B.4 (frozen section), B.5 (hand_authored section), B.6 (benchmark section), B.7 (publish controls), B.8 (question editor modal). Rejected: 5 of the 7 B-entries would have effectively identical §1 (same route segment) + §2 (composed under the editor shell) + §3 (no own API endpoints — share with §B.2) + §6 (Gherkin scenarios are mode-specific but small) — fanning would inflate §A without adding spec clarity. FE-7 §G precedent: when components are page-specific with no cross-PR reuse, nest them inside §B.2 §2.

**Per the FE-7 §G clause "Deviating from the template in FE-8+ is itself spec drift"**: this variance is explicitly declared as a deviation and justified above. Future FE-N specs may inherit this nested-mode pattern when applicable (e.g. FE-9 may have similar mode-switched editor surfaces in calibration or loop-approval flows).

**Per-phase variances expected and ALLOWED** (inherited from FE-1:745):
- FE-5 (SSE) adds an "SSE event sequence" subsection per consuming page.
- FE-8 / FE-9 may split into multiple files (this file is sibling 3 of 3 in the FE-8 split).

**Per-phase variances NOT allowed without spec-drift surface** (inherited):
- Skipping Gherkin acceptance criteria. Every state must have a trio.
- Skipping drift-watch / verification / blocker callouts.
- Folding test list into per-page sections. Tests live in §D for scannability and coverage-counting.

---

## H. Spec-drift roll-up (post-review classification)

The cross-walk surfaced 12 candidate items. After review, they're classified into three groups:

### (a) BLOCKERS for the FE-8 tests build session — must land before the build session opens

**Phase 0 spec-clarification PR (this PR) cleared the cross-spec drift on `applyApiErrorToForm` path (FE-1 already canonically cites `frontend/src/lib/api/form-errors.ts` per `CODE_SPEC.md:1024` — no FE-1 amendment required) and LOCKED the `QuestionCreate.config` FE-owned typing contract for v1.**

1. **`TestStatus` enum + `lock_mode` mapping drift.** Backend `TestStatus` enum is `draft|published` only (`frontend/openapi/schema.json:3273–3279`). Design's "Locked" state (`admin-test-authoring.jsx:124–129` + `:259` + `:585–600`) implies a 3rd status. **Resolution chosen:** spec body locks the derivation `displayStatus = lock_mode === "campaign-locked" ? 'locked' : status` via the helper at `frontend/src/lib/tests/derive-display-status.ts`. **Verification needed before build session opens:** confirm with backend that `lock_mode === "campaign-locked"` is the canonical signal (not e.g. a separate `is_locked` field). If the backend uses a different signal, spec body must update before code lands. Surfaced for user decision.
2. **`QuestionCreate.config` FE-owned typing contract — LOCKED for v1.** Backend `QuestionCreate.config` is `object` per `frontend/openapi/schema.json:2488–2491`. v1 packs per-type config + `body` + `pill_id` + `is_anchor` into `config` via `frontend/src/lib/tests/compose-question-config.ts` (per §D.1 helper + §B.3 §4 step 2 schema). Backend typing of the per-type discriminated union is **deferred to v1.x**. Tests assert against the helper, not against backend schema.

### (b) BUILD-SESSION VERIFICATION TASKS — front-loaded at the start of the FE-8 tests build session

The build session opens with a verification step before any code lands: read the FastAPI handlers for `/v1/tests`, `/v1/tests/{id}/{publish,lock,unlock}`, `/v1/tests/{id}/questions` + the relevant Pydantic schemas, confirm the assumptions below match reality. If any diverge, halt and surface for spec-clarification PR.

1. **`shell.jsx` admin nav `tests` id.** RESOLVED by `fe-specs/FE-8-admin-catalogue.md §C.2` LOCKED ADMIN_NAV addition — `tests` is a top-level rail id (position 6 of 11); not nested under Catalogue.
2. **`pill_count` field on `TestResponse`.** Design shows "Pills" column on test list. Not in OpenAPI. v1 placeholder "—" if absent.
3. **`/v1/tests?summary_only=true` or `/v1/tests/stats` aggregate endpoint.** v1 fallback: compute from first cached page.
4. **`mode` + `status` query params on `/v1/tests`.** Verify wiring; client-side fallback if missing. Note: backend `status` enum is `draft|published` — `locked` filter value is FE-derived (won't be accepted server-side).
5. **`TestResponse.lock_mode` enum values.** OpenAPI declares as `string` (no enum constraint). Spec body assumes `"open" | "campaign-locked"` per SPEC §5 + AC-D24. Verify; if different, update display-status helper.
6. **`difficulty_curve` entry UX shape.** RESOLVED by §E item 8 — benchmark mode authoring deferred from v1; difficulty_curve entry UX deferred along with the rest of the BenchmarkSection.
7. **Frozen vs hand_authored backend distinction.** Backend may treat them identically (both have admin-managed pools) or distinguish via `authoring_mode` field. Verify; if identical, the editor still surfaces them as 2 separate mode cards but PATCH submits the same payload.
8. **`benchmark_scope` derivation.** RESOLVED by §E item 8 — benchmark mode authoring deferred from v1. Enum values locked to OpenAPI `BenchmarkScope` = `subject|pill|path` for the v1.x revival; spec text references the canonical OpenAPI value, not the prior `learning_path` paraphrase.
9. **Cohort window lock signal.** Per design `:473–474` cohort window locks once any testee starts. Verify backend signal — likely `started_at` or equivalent on `TestResponse`, OR backend 422s on PATCH-after-start. Same pattern as assignment loop_mode (identity §B.4 §H (b) item 17).
10. **`pill_id`, `body`, `is_anchor` storage on questions.** RESOLVED by §H (a) item 2 LOCKED FE-owned typing — packed inside `config` via `compose-question-config.ts`; backend typing deferred to v1.x.
11. **Mode-locks-after-first-save.** Spec body assumes mode is immutable after first PATCH. Verify backend behaviour: does backend 422 on PATCH-mode-change, OR allow it for drafts? If allowed for drafts, FE can unlock the ModePicker until publish.
12. **`question_group_id` purpose.** Backend supports it; design doesn't surface. Verify: is it for grouping by pill (replacing pill_id as the linker)? For grouping by topic-within-pill? Spec body treats as optional. If `pill_id` resolution path (§H (b) item 10) lands as "question_group_id IS the pill linker", the spec body changes.

### (c) APPROVED RESOLUTIONS — folded into FE-8 tests build PR scope, captured in the build PR's handover

These are not blockers. The spec body locks the resolution; the build session implements; the build PR's handover records them under the SESSION_START.md AC-CD-structural-additions carve-out.

13. **§G variance declared** — 4 mode-conditional sections nested in §B.2 §2 (FE-7 precedent).
14. **§C anchored canonically in `fe-specs/FE-8-admin-catalogue.md`** — this file consumes by reference.
15. **Display-status helper** at `frontend/src/lib/tests/derive-display-status.ts` is the single source for the `draft|published|locked` 3-status display.
16. **Question editor specced as pattern + reference** per user-locked plan decision (`/root/.claude/plans/fresh-session-fe-8-tingly-candy.md` §10 Q2). Per-type field shapes documented at pattern level; build session resolves per-type details against `admin-test-authoring.jsx:650+` and backend's `config: object` contract.
17. **v1 ships text-only question editing** — image / figure attachments deferred to v1.x per AC-CD24 typed-stub pattern (§E.1).
18. **Binding-pause discipline** — build session may pause after the first mode is fully wired (per `FE_ROADMAP.md:172` risk note) before duplicating across the other 3 modes. Session-execution gate, not a spec gate.
19. **Cross-file consumption** of `adminKeys.{tests}` from sibling `fe-specs/FE-8-admin-identity.md §B.4` (assignment editor's test picker) — declared canonically in catalogue file's §C.1; identity file's §C.9 cross-references; this file's §C.1 is the publisher of `adminKeys.tests` invalidation discipline.

---

*End of FE-8-admin-tests.md. Sibling specs: `fe-specs/FE-8-admin-catalogue.md` + `fe-specs/FE-8-admin-identity.md`. Template propagates per `fe-specs/FE-8-admin-catalogue.md §G`; deviations surface as spec drift.*
