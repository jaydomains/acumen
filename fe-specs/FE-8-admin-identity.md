# FE-8 — Admin identity (users + groups + assignments) (detail spec)

> **Status:** plan-mode authored, ready for build session (subject to §H (a) blockers — the cross-spec `applyApiErrorToForm` path drift from `fe-specs/FE-8-admin-catalogue.md §H (a) item 1` must resolve before this build session opens; same fix unblocks all three FE-8 files).
> **Owns:** the admin identity surfaces — users CRUD + deactivate/reactivate (`/admin/users`), groups CRUD + membership (`/admin/groups` + `/admin/groups/[id]`), and assignments (`/admin/assignments`).
> **PR target:** shared with `fe-specs/FE-8-admin-catalogue.md` + `fe-specs/FE-8-admin-tests.md` in a single PR — `PR-NNN-fe8-admin-authoring`.
> **Anchors:** AC-D2 (admin-driven user creation, two-role model: Administrator + Testee), AC-D14 (user deactivation — preserves data, blocks login), AC-D15 (groups for bulk assignment + reporting; three system-defined groups immutable: All Users / All Testees / All Administrators), AC-D26 (assignment engagement tracking — `engagement_status` derived field, auto-reminders, auto-escalation; backend-owned), AC-D6 (adaptive loop_mode), AC-CD11 (admin-only surfaces), AC-CD19 (FE stack lock), AC-CD20 (`(admin)` route group + role guard → `/403`), AC-CD21 (centralised query keys + form helper + error envelope).
>
> This is the **eighth per-page FE detail spec, sibling 2 of 3** (catalogue / identity / tests) for the FE-8 admin authoring phase. Template inheritance: per-page §B from `fe-specs/FE-1-auth.md:50–60` (verbatim); `adminKeys` query-key library + `(admin)` route group + filter-bar primitive + modal primitive + field primitives all **consumed from `fe-specs/FE-8-admin-catalogue.md §C.1–§C.8` unchanged**. Three-file split rationale at `fe-specs/FE-8-admin-catalogue.md §G`. Deviating from the template in FE-8+ is itself spec drift.

---

## 0. Context

This file is sibling 2 of 3 for FE-8 admin authoring. Read `fe-specs/FE-8-admin-catalogue.md §0` for the umbrella context (FE-N spec preconditions, three-file split rationale, FE-9 boundary). This file's specific scope:

**Owned surfaces:**
- `/admin/users` — users list + add / edit / deactivate modals + filter bar
- `/admin/groups` — groups list + create modal + system-immutability gate
- `/admin/groups/[groupId]` — group membership view + member picker modal + group-level stats
- `/admin/assignments` — assignments list + create / edit / delete modals + multi-target picker (testees + groups in one selector)

**Done-when contribution (this file owns the tail of the catalogue→test→assign chain per `FE_ROADMAP.md:166`):** Admin can assign an authored test to a group → testees in the group see it appear on their dashboards. The "see it appear on testee dashboards" part of done-when relies on FE-3's assigned-to-you card (`fe-specs/FE-3-content.md §B.1` consumer of `GET /v1/me/assignments`) — FE-8 ships the admin side, FE-3 ships the testee side.

**Scope boundary — what this file explicitly does NOT ship:**
- **Pill / subject / proposal / safety / path CRUD.** Owned by `fe-specs/FE-8-admin-catalogue.md`.
- **Test authoring + question editor.** Owned by `fe-specs/FE-8-admin-tests.md`.
- **Group-level reporting deep-dives.** AC-D15 mentions "team-level reporting"; v1 surfaces only basic counts (member count + assignment count + avg engagement + avg competence — design `admin-authoring.jsx:659–664`). Deeper reporting deferred to FE-9 ops dashboard. Surfaced as §F.2.
- **Bulk user invite (CSV / paste).** Design (`admin-authoring.jsx:386–388`) shows a "Bulk invite" CTA; v1 ships only single-user invite via the add modal. Bulk deferred to v1.x. Surfaced as §E item 4.
- **User profile deep view.** Design users list has an Edit row action only; no `/admin/users/[userId]` route. Per-user dashboards (history, attempt list, competence) live on the testee's own `/profile` + `/history` (FE-7) — admin can't drill into a testee's profile in v1. Deferred to v1.x admin-scoped variants. Surfaced as §E item 5.
- **Engagement queue (`/v1/admin/engagement/pending`).** Referenced from `fe-specs/FE-3-content.md §B.1` as the testee-scope endpoint's admin counterpart. FE-9 owns the consumer surface; FE-8 only creates the assignments that feed the queue.
- **Loop-driven follow-up approval queue.** When an assignment has `loop_mode: admin-reviewed`, follow-ups need admin approval before serving to the testee. The approve / reject affordance lives in FE-9 (`admin-ops.jsx:loop`). FE-8 only sets the `loop_mode` field at assignment-creation time.

---

## A. Page/feature inventory

| # | Capability | Route / file | Design source | Screenshot |
|---|---|---|---|---|
| 1 | Users list — `/admin/users` table + 4-variant modal (add / edit / deactivate / validation errors) | `(admin)/users/page.tsx` + `_components/users-table.tsx` + `_components/user-modal.tsx` + `_components/deactivate-modal.tsx` | `admin-authoring.jsx:356–532` (`UsersCrudMock`, `UserListBehind`, `UserModal`, `DeactivateModal`, `RoleChoice`) | `v6-fe8-18-users.png` |
| 2 | Groups list — `/admin/groups` table + create modal + system-group immutability gate | `(admin)/groups/page.tsx` + `_components/groups-table.tsx` + `_components/group-modal.tsx` | `admin-authoring.jsx:537–643` (`GroupsCrudMock`, `GroupListBehind`, `GroupModal`) | `v6-fe8-19-groups.png` |
| 3 | Group membership view — `/admin/groups/[groupId]` two-column page (stats + members table) + member-picker modal | `(admin)/groups/[groupId]/page.tsx` + `_components/group-membership-view.tsx` + `_components/member-picker-modal.tsx` | `admin-authoring.jsx:645–751` (`GroupMembershipView`, `MemberPickerModal`) | `v6-fe8-19-groups.png` (composite — membership view inset) |
| 4 | Assignments list — `/admin/assignments` table + assignment editor modal (create / edit) + delete confirm modal | `(admin)/assignments/page.tsx` + `_components/assignments-table.tsx` + `_components/assignment-editor.tsx` + `_components/delete-assignment-modal.tsx` | `admin-authoring.jsx:921–1147` (`AssignmentsCrudMock`, `AssignmentListBehind`, `AssignmentEditor`, `PickerTab`, `PickerChip`, `LoopChoice`, `DeleteAssignmentModal`) | `v6-fe8-22-assignments.png` |

Four rows. Each row is a route-level entry; modals nest under the row's §2 (Components) and §5 (States). The most coupled surface — `AssignmentEditor` (row 4) — depends on `Tests` (sibling `fe-specs/FE-8-admin-tests.md`), `LearningPaths` (sibling `fe-specs/FE-8-admin-catalogue.md` §B.6), `Users` (this file §B.1), and `Groups` (this file §B.2). Cross-file consumption explicitly noted in §B.4 §2.

URL state per row:
- Row 1 (users): `?q={search}&role={admin|testee|all}&status={active|invited|deactivated|all}` — debounced text + 2 segmented filters.
- Row 2 (groups): `?q={search}` — text search only (group volume is low).
- Row 3 (membership): `?member_q={search}` — filter members by name/email within the group.
- Row 4 (assignments): `?assigner={me|all}` — segmented filter ("my assignments" vs "all"); default `me`.

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

### B.1 Users list — `/admin/users`

**1. Route segment + URL state**

- File: `frontend/src/app/(admin)/users/page.tsx`. The `(admin)` route group exists per FE-2; the `users/` segment + its `error.tsx` boundary file are FE-8-introduced.
- URL state: `?q={search}&role={admin|testee|all}&status={active|invited|deactivated|all}` (defaults `q=""`, `role=all`, `status=all`). All filter changes call `router.replace()` per FE-3 §C.7 pattern.
- Modal state: ephemeral `useState<{mode: 'add' | 'edit' | 'deactivate' | null, userId?: string}>(null)`.
- Static `<title>Users · Acumen</title>`.
- Nav-rail anchor: `shell.jsx:15` declares the admin nav id as `users` with label "Users"; rail-highlight wiring per FE-2.

**2. Components**

- **Scaffold reused:** `useAuth()` (FE-1); `client` + `unwrap` + `ApiError` (FE-0); `useInfiniteQuery` + `useMutation` + `useQueryClient` (TanStack Query v5); `useForm` + `zodResolver` (rhf + zod per FE-1 §B.4); `applyApiErrorToForm` from `frontend/src/lib/api/form-errors.ts` per `fe-specs/FE-8-admin-catalogue.md §0` consensus path.
- **Shared admin primitives consumed from `fe-specs/FE-8-admin-catalogue.md §C`:** `adminKeys.users.{all,list,detail}` (§C.1); `FilterBar` (§C.4); `Modal` + `ModalHeader` + `ModalActions` (§C.5); `Field` + `FieldRow` + `FieldError` (§C.6); `(admin)` route guard (§C.2); toast helper (§C.7); Pattern C boundary (§C.8).
- **New in this PR (identity scope):**
  - `UsersListPage` — top-level page. Renders `PageHeader` + "+ Add user" CTA + "Bulk invite" CTA (disabled with tooltip "Coming in v1.x" per §E.4) + `FilterBar` + `UsersTable` + (conditional) `UserModal` / `DeactivateModal`.
  - `UsersTable` — table view per `admin-authoring.jsx:378–425` (`UserListBehind`). Columns: Name (or "(invited)" muted when user hasn't consumed setup), Email (mono), Role (`<Pill tone="accent" mono>admin</Pill>` or `<Pill tone="soft" mono>testee</Pill>`), Last active (relative — derived from `last_active_at` field; see §H (b) item 1), Status (Active ok pill / Invited warn pill / Inactive soft pill — derived display status; see §H (b) item 2), row actions (Edit + Resend on invited / Reactivate on deactivated). Cursor-paginated via `useInfiniteQuery` + IntersectionObserver sentinel per FE-3 §C.5.
  - `UserModal` — 2-variant modal per `admin-authoring.jsx:428–488`. Variants: `add` (full form: email + first/last name + role, plus info banner "We'll send a setup link to this email. It works for 7 days."), `edit` (email field readonly with sunk background, name + role editable, no setup banner). Validation-errors state nested within either variant via Pattern A.
  - `RoleChoice` — segmented 2-card chooser per `admin-authoring.jsx:490–502`. Active card flips to ink-background. Controlled `{value, onChange}`. Two options: testee + admin.
  - `DeactivateModal` — confirm modal per `admin-authoring.jsx:504–532`. Warn banner with red-tint citing immediate access loss + paused attempt + data preservation per AC-D14. Optional "Reason (internal note)" textarea (frontend-only; not sent to backend in v1 — see §H (b) item 3).
  - `ReactivateConfirm` — inline confirm via browser `confirm("Reactivate {name}? They'll be able to sign in again.")` (no full modal — low-risk re-enablement). Then fires `POST /v1/users/{id}/reactivate`.
- **shadcn primitives installed:** none beyond FE-2 + the `Sheet` added in catalogue B.4.
- **Design primitives reused:** `Pill` (FE-2) for role + status badges. `.tbl`, `.card`, `.eyebrow`, `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-sm`, `.row`, `.gap-2`, `.muted`, `.mono`, `.t-meta`, `.arrow`, `.pulse-dot` design classes from FE-2 per AC-CD23.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/users?cursor={cursor}&limit=50&role={role}&status={status}&q={text}` | List users (cursor-paginated). Consumed by `UsersTable`. `staleTime: 30_000` per AC-CD21. | **Exists** at `frontend/openapi/schema.json:8708`. Returns `Page_UserResponse_`. Verify `q`, `role`, `status` query param wiring — §H (b) item 4. |
| `POST /v1/users` | Create user (send setup email). Consumed by `UserModal` add variant. | **Exists** at `frontend/openapi/schema.json:8708+`. Body: `AdminCreateUserRequest` schema (`{email, name, role}`). Returns `UserResponse`. |
| `GET /v1/users/{user_id}` | Fetch single user (for edit modal pre-fill). | **Exists** at `frontend/openapi/schema.json:8874`. |
| `PATCH /v1/users/{user_id}` | Edit user (name + role). Email is immutable post-creation. | **Exists** at `frontend/openapi/schema.json:8874+`. Body: `UserUpdate` schema (`{name?, role?}`). |
| `POST /v1/users/{user_id}/deactivate` | Soft-deactivate. Empty body — design's "Reason" textarea is frontend-only in v1 (§H (b) item 3). | **Exists** at `frontend/openapi/schema.json:9000`. Returns `UserResponse` with `status: "deactivated"`. |
| `POST /v1/users/{user_id}/reactivate` | Reactivate. Empty body. | **Exists** at `frontend/openapi/schema.json:9059`. Returns `UserResponse` with `status: "active"`. |
| `POST /v1/users/{user_id}/resend-setup` | Resend the setup email for an invited user. **NOT VERIFIED** — not surfaced in this read of openapi.json. Design `admin-authoring.jsx:417` shows a "Resend" button. See §H (b) item 5. | **TBD** — if absent, the row action renders disabled with `// TODO(FE-8-build)` tag and a tooltip "Resend endpoint pending." |

**Locked filter contract:**
```ts
GET /v1/users?cursor=<opaque>&limit=50&q=<text>&role=<admin|testee|all>&status=<active|deactivated|all> → Page_UserResponse_
```
Note: `status` filter values exclude `invited` (which is a derived display status — §H (b) item 2). The status filter UI maps "Invited" to a client-side filter on `privacy_ack_at === null && status === "active" && last_active_at === null` (best-effort heuristic until backend exposes `setup_consumed_at` — §H (b) item 2).

**4. Form fields + zod + rhf**

```ts
const userAddSchema = z.object({
  email: z.string().email("We need a working email — that's how the setup link gets there."),
  name: z.string().max(255).optional().default(""),  // Optional per design; backend may require — verify §H (b) item 6
  role: z.enum(["admin", "testee"], { required_error: "Pick a role." }),
});
type UserAddInput = z.infer<typeof userAddSchema>;

const userEditSchema = z.object({
  name: z.string().min(1, "Name is required for editing.").max(255),
  role: z.enum(["admin", "testee"]),
});
type UserEditInput = z.infer<typeof userEditSchema>;

const form = useForm<UserAddInput | UserEditInput>({
  resolver: zodResolver(mode === 'add' ? userAddSchema : userEditSchema),
  mode: "onSubmit",
  defaultValues: editingUser
    ? { name: editingUser.name, role: editingUser.role as 'admin' | 'testee' }
    : { email: "", name: "", role: "testee" },  // Default to testee per design (more common role)
});
```

**Add submit handler:**
1. `unwrap(client.POST("/v1/users", { body: { email, name, role } }))` inside try/catch.
2. Success: `queryClient.invalidateQueries({ queryKey: adminKeys.users.all() })`; toast.info("Setup email sent to {email}"); close modal. Backend fires the setup email server-side per FE-1 spec preconditions.
3. `ApiError`: `applyApiErrorToForm(err, form, { fieldMap: { EMAIL_TAKEN: 'email' } })`. Business code `EMAIL_TAKEN` (if it exists — §H (b) item 7) projects under the email field.

**Edit submit handler:**
1. `unwrap(client.PATCH("/v1/users/{user_id}", { params: { path: { user_id } }, body: dirtyFieldsOnly }))`.
2. Success: invalidate + toast.info("User updated"); close modal.
3. Same error handling as add.

**Deactivate handler (separate from form):**
```ts
const deactivateMutation = useMutation({
  mutationFn: (userId: string) =>
    unwrap(client.POST("/v1/users/{user_id}/deactivate", { params: { path: { user_id: userId } } })),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: adminKeys.users.all() });
    toast.info("User deactivated");
  },
  onError: (err) => toast.error(err.message || "Couldn't deactivate"),
});
```

**Field-to-design mapping:**
- `email` → "Email" input (`admin-authoring.jsx:437–447`)
- `name` (parts) → "First name" + "Last name" inputs (`:450–456`). **Design splits into first + last; backend `name` field is single-string.** Pattern: join with space on submit (`name: firstName ? \`${firstName} ${lastName}\`.trim() : ""`). Edit pre-fill splits at first space. v1 acceptable; surfaces as §F.3 design-to-backend reconciliation note.
- `role` → `RoleChoice` 2-card chooser (`:458–463`).

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `list_loading` | Initial `useInfiniteQuery` in-flight | Table renders header + 10 skeleton rows. |
| `list_empty` | Response `{ items: [] }` | Empty-state card "No users yet — add your first user to get started." + Add CTA. |
| `list_happy_first_page` / `list_loading_more` / `list_happy_no_more` | (mirrors `fe-specs/FE-8-admin-catalogue.md §B.2 §5` list states) | (mirrors) |
| `filter_role_changed` / `filter_status_changed` / `filter_search_typed` | User changes a FilterBar control | URL replaces; refetch with new filter; pagination resets. |
| `row_status_active` | Per row: `status === "active"` AND user has activity | Status pill `<Pill tone="ok" mono>Active</Pill>`; Edit + (admin only) audit row actions. |
| `row_status_invited` | Per row: derived `invited` (see §H (b) item 2 heuristic) | Name renders muted as "(invited)"; status pill `<Pill tone="warn" mono>Invited · not set up</Pill>`; Edit + Resend row actions. |
| `row_status_deactivated` | Per row: `status === "deactivated"` | Status pill `<Pill tone="soft" mono>Inactive</Pill>`; only Reactivate row action; row dimmed. |
| `modal_add_open` | User clicks "+ Add user" | `UserModal` mounts in add variant; form pristine; setup-email info banner renders. |
| `modal_add_submitting` | rhf `isSubmitting` | Submit button pulse-dot + "Sending setup email…"; fields disabled. |
| `modal_add_validation_errors` | zod safeParse fails OR backend 422 | Inline errors per Pattern A. |
| `modal_add_email_taken` | Backend returns 422 / business code on duplicate email | Error projects under email field via `applyApiErrorToForm`. |
| `modal_edit_open` | User clicks Edit row action | `UserModal` mounts in edit variant; form pre-filled from cached UserResponse; email field readonly with sunk background. |
| `modal_edit_submitting` / `modal_edit_validation_errors` | (mirrors add) | (mirrors add) |
| `modal_success` | Save returns 2xx | Modal closes; invalidate; toast. |
| `modal_cancel_clean` | Cancel with pristine form | Modal closes without prompt. |
| `modal_cancel_dirty` | Cancel with dirty form | Browser `confirm("Discard unsaved changes?")` per `fe-specs/FE-8-admin-catalogue.md §B.2 §7`. |
| `deactivate_modal_open` | User clicks Deactivate row action (only available when status === "active") | `DeactivateModal` mounts with warn banner + optional Reason textarea. |
| `deactivate_modal_submitting` | User clicks Deactivate button | Mutation fires; modal closes on success; toast.info("User deactivated"). |
| `reactivate_confirm` | User clicks Reactivate row action (only available when status === "deactivated") | Browser `confirm("Reactivate {name}?")`; on OK fires `POST /v1/users/{id}/reactivate`; toast on success. |
| `resend_setup_action` | User clicks Resend row action (only on invited rows) | `POST /v1/users/{id}/resend-setup` fires (if endpoint exists — §H (b) item 5); toast.info("Setup email re-sent"). |
| `error` | Query throws (non-404) | Pattern C boundary card via `(admin)/users/error.tsx`. |
| `role_mismatch` | Testee role hits `/admin/users` | AC-CD20 layout guard redirects to `/403`. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Admin invites a new user
  Given the Users list is rendered
  When the admin clicks "+ Add user"
  And enters email "kabelo@sitemesh.co", first name "Kabelo", picks testee role
  And clicks "Send setup email"
  Then POST /v1/users fires with {email: "kabelo@sitemesh.co", name: "Kabelo", role: "testee"}
  And on 201 toast.info("Setup email sent to kabelo@sitemesh.co") renders
  And the modal closes
  And the users list refetches and shows the new user with status "Invited · not set up"
```

```gherkin
Scenario: Email validation surfaces inline
  Given the admin opens the Add user modal
  When the admin submits with malformed email "lerato@sitemesh"
  Then zod surfaces "We need a working email — that's how the setup link gets there." under the Email field
  And no network call fires
```

```gherkin
Scenario: Duplicate email projects under email field
  Given the admin tries to add a user with email "jay@sitemesh.co" which already exists
  When POST /v1/users returns 422 with detail [{loc: ["body", "email"], msg: "email already exists"}]
  Then applyApiErrorToForm projects the error under the Email field
  And the modal stays open
```

```gherkin
Scenario: Admin edits user role
  Given the admin clicks Edit on row "Lerato Dlamini"
  When UserModal mounts in edit variant
  Then the email field is readonly with sunk background
  And the form is pre-filled with name and role
  When the admin changes role from testee to admin and clicks Save
  Then PATCH /v1/users/{id} fires with {role: "admin"} (dirty-fields only)
  And on 2xx toast.info("User updated") renders
```

```gherkin
Scenario: Admin deactivates a user
  Given the admin clicks Deactivate on row "Themba Nkosi"
  When DeactivateModal mounts
  Then the warn banner mentions immediate access loss, paused attempts, and data preservation
  When the admin clicks Deactivate
  Then POST /v1/users/{id}/deactivate fires with empty body
  And on 2xx the row updates to status "Inactive"
  And only the Reactivate action remains
```

```gherkin
Scenario: Admin reactivates a deactivated user
  Given a deactivated user row is visible
  When the admin clicks Reactivate
  Then browser confirm("Reactivate {name}? They'll be able to sign in again.") fires
  When the admin confirms OK
  Then POST /v1/users/{id}/reactivate fires
  And on 2xx the row updates to status "Active"
```

```gherkin
Scenario: Filter by status narrows the list
  Given the Users list shows all statuses
  When the admin clicks the "Active" filter segment
  Then URL replaces to ?status=active
  And GET /v1/users refetches with status=active
  And the list shows only active users
```

```gherkin
Scenario: Filter by role narrows the list
  Given the Users list shows all roles
  When the admin clicks the "Admin" filter segment
  Then URL replaces to ?role=admin
  And the list refetches with role=admin
```

```gherkin
Scenario: Search text debounces
  Given the Users list is rendered
  When the admin types "ler" in FilterBar
  Then after 300ms idle URL replaces to ?q=ler
  And the list refetches with q=ler
```

```gherkin
Scenario: Bulk invite CTA is disabled in v1
  Given the Users list page is rendered
  When the admin hovers the "Bulk invite" button
  Then the button is disabled
  And the tooltip "Coming in v1.x" renders
```

```gherkin
Scenario: Testee hits admin users URL — 403
  Given a testee user opens /admin/users
  Then the (admin) layout guard redirects to /403
```

(Eleven total scenarios mapped to §D.2 users-list integration tests.)

**7. Edge cases / gotchas**

- **`invited` is a derived display status.** Backend `UserStatus` enum is `active|deactivated` only (`frontend/openapi/schema.json:3512–3519`). Frontend derives `invited` from `status === "active" && last_active_at === null && privacy_ack_at === null` (best-effort heuristic). §H (b) item 2 surfaces backend gap — a `setup_consumed_at` or `invited_at` timestamp field would make this deterministic.
- **`last_active_at` field is not in `UserResponse`.** Verify against `frontend/openapi/schema.json:3459–3511` — confirmed absent. §H (b) item 1 — if field missing, list column shows "—"; v1 placeholder per §E item 1.
- **`name` split first/last is frontend convention.** Backend stores single-string `name`. On submit: `name = [firstName, lastName].filter(Boolean).join(" ")`. On edit pre-fill: `[firstName, ...rest] = userResponse.name.split(" "); lastName = rest.join(" ")`. v1 acceptable; surfaces as §F.3.
- **`role` is `string` in OpenAPI, not enum.** `frontend/openapi/schema.json:3492–3494` declares `role: string` (no enum constraint). Spec body assumes `"admin" | "testee"` per AC-D2; build session verifies backend rejects other values. §H (b) item 8.
- **Deactivate textarea Reason is frontend-only in v1.** Backend deactivate endpoint accepts no body. Reason captured locally — if needed for audit, deferred to v1.x backend extension. §H (b) item 3.
- **Resend setup endpoint TBD.** If absent in OpenAPI, button disabled. §H (b) item 5.
- **No cross-tab user-state sync.** Two admins editing the same user simultaneously: last-write-wins on PATCH; no optimistic-lock guard in v1.
- **Self-deactivation guard.** Admin cannot deactivate themselves. Spec: Deactivate row action is hidden when `user.id === auth.user.id`. Backend likely enforces same; verify §H (b) item 9.

**8. Visual reference**

- `frontend/design-reference/prototype/admin-authoring.jsx:356–376` — `UsersCrudMock` sub-state strip.
- `frontend/design-reference/prototype/admin-authoring.jsx:378–425` — `UserListBehind` (table).
- `frontend/design-reference/prototype/admin-authoring.jsx:428–488` — `UserModal` (add + edit variants).
- `frontend/design-reference/prototype/admin-authoring.jsx:490–502` — `RoleChoice`.
- `frontend/design-reference/prototype/admin-authoring.jsx:504–532` — `DeactivateModal`.
- Screenshot: `v6-fe8-18-users.png`.

---

### B.2 Groups list — `/admin/groups`

**1. Route segment + URL state**

- File: `frontend/src/app/(admin)/groups/page.tsx`. The `groups/` segment + its `error.tsx` boundary file are FE-8-introduced.
- URL state: `?q={search}` (single text search; group volume is low and system-vs-custom is visually obvious).
- Modal state: ephemeral `useState<{mode: 'add' | null}>(null)`. Edit modal is NOT on the list page — clicking Edit on a custom group routes to `/admin/groups/[id]` (§B.3) where the group details + members are co-located.
- Static `<title>Groups · Acumen</title>`.
- Nav-rail anchor: `shell.jsx` admin nav `groups` id — **NOT in current 7-id list** per `shell.jsx:15` (which has ops/review/engagement/catalogue-admin/users/cost/loop). Either (a) FE-2 adds `groups` to the nav as a structural addition, or (b) groups nests under the Users nav as a sub-tab. **§H (b) item 10** — verify and decide.

**2. Components**

- **Scaffold reused:** same as §B.1 §2.
- **Shared admin primitives consumed from `fe-specs/FE-8-admin-catalogue.md §C`:** `adminKeys.groups.*` (§C.1); `FilterBar`; `Modal`; `Field`; route guard; toast; Pattern C.
- **New in this PR (identity scope):**
  - `GroupsListPage` — top-level page. `PageHeader` + "+ Add group" CTA + `FilterBar` (text-search only) + `GroupsTable` + (conditional) `GroupModal`.
  - `GroupsTable` — table view per `admin-authoring.jsx:558–625` (`GroupListBehind`). Columns: Group name (with lock icon prefix for system groups + "System" warn pill), Members (numeric count), Description (muted), row actions (Edit + Members for custom groups; both disabled with opacity for system groups). Cursor-paginated.
  - `SystemGroupBanner` — informational footer that renders below the table when at least one system group is in the current page. Copy: "System groups (All Users, All Testees, All Administrators) are maintained by Acumen — name, description, and membership can't be edited (AC-D15). Use a custom group to bind assignments to a specific cohort." Per `admin-authoring.jsx:609–622`.
  - `GroupModal` — single-variant add modal per `admin-authoring.jsx:627–642`. Fields: name (required, 1–255), description (optional, 0–1024). Edit modal is **not on this page** — see B.3.
- **shadcn primitives installed:** none beyond FE-2's set.
- **Design primitives reused:** `Pill` (FE-2) for "System" warn badge. `Icon` (lucide `Lock`) for system-group prefix. `.tbl`, `.card`, `.eyebrow`, `.btn`, `.muted`, `.num`, `.row` per FE-2.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/groups?cursor={cursor}&limit=50&q={text}` | List groups. Consumed by `GroupsTable`. | **Exists** at `frontend/openapi/schema.json:6102`. Returns `Page_GroupResponse_`. `q` query param verification — §H (b) item 4. |
| `POST /v1/groups` | Create group. Consumed by `GroupModal`. | **Exists** at `frontend/openapi/schema.json:6102+`. Body: `GroupCreate` schema (`{name, description?}`). |

System groups (`is_system === true`) cannot be PATCHed or DELETEd via the UI; rows render with disabled Edit / Members actions per design.

**4. Form fields + zod + rhf**

```ts
const groupAddSchema = z.object({
  name: z.string().min(1, "Group name is required.").max(255),
  description: z.string().max(1024).optional().default(""),
});
type GroupAddInput = z.infer<typeof groupAddSchema>;
```

Submit handler:
1. `unwrap(client.POST("/v1/groups", { body: { name, description: description || undefined } }))`.
2. Success: invalidate `adminKeys.groups.all()`; toast.info("Group created"); close modal.
3. `ApiError`: `applyApiErrorToForm(err, form)`.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `list_loading` / `list_empty` / `list_happy_*` | (mirrors §B.1 list states) | Empty: "No groups yet — system groups will appear once your first user is created." (system groups should auto-exist per AC-D15; if absent, surface as data drift) |
| `row_system_immutable` | Per row: `is_system === true` | Lock icon + "System" warn pill prefix the name; Edit + Members actions disabled (40% opacity). Hover tooltip "System groups are immutable (AC-D15)." |
| `row_custom_editable` | Per row: `is_system === false` | Standard row; Edit + Members actions enabled. |
| `filter_search_typed` | User types in FilterBar | Debounced 300ms; URL replaces; refetch. |
| `modal_add_open` | "+ Add group" clicked | `GroupModal` mounts; form pristine. |
| `modal_add_submitting` | rhf `isSubmitting` | Submit pulse-dot + "Creating…"; fields disabled. |
| `modal_add_validation_errors` | zod / backend 422 | Pattern A inline errors. |
| `modal_success` | 2xx response | Modal closes; invalidate; toast; row appears in list. |
| `edit_row_action_custom` | Edit on custom group row | `router.push('/admin/groups/{groupId}')` — navigates to membership view §B.3 where details + members are edited co-located. |
| `members_row_action_custom` | Members on custom group row | Same as Edit — both navigate to `/admin/groups/{groupId}` (membership view is the canonical detail page). |
| `delete_row_action` | (Hidden in v1) | Design does not surface Delete on the list. v1 ships no group-delete affordance; deferred to v1.x. §E item 6. |
| `error` | Query throws | Pattern C boundary. |
| `role_mismatch` | Testee hits `/admin/groups` | `/403`. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Groups list renders system + custom groups
  Given the admin opens /admin/groups
  When GET /v1/groups returns 3 system groups + 4 custom groups
  Then GroupsTable renders 7 rows
  And system groups show lock icon + "System" pill
  And custom groups show no lock icon
```

```gherkin
Scenario: System group actions disabled
  Given a system group row "All Testees" is visible
  Then Edit and Members buttons render at 40% opacity
  And clicking them does nothing
```

```gherkin
Scenario: Admin creates a custom group
  Given the admin clicks "+ Add group"
  When the admin enters name "Welding inspectors" and description
  And clicks "Create group"
  Then POST /v1/groups fires with {name, description}
  And on 201 toast.info("Group created") renders
  And the modal closes
  And the new group appears in the list
```

```gherkin
Scenario: Group name validation
  Given the Add group modal is open
  When the admin submits with empty name
  Then zod surfaces "Group name is required."
```

```gherkin
Scenario: Edit on custom group navigates to membership view
  Given a custom group row "Coatings inspectors" is visible
  When the admin clicks Edit
  Then router.push fires with /admin/groups/{coatings-uuid}
```

```gherkin
Scenario: Members on custom group navigates to membership view
  Given a custom group row is visible
  When the admin clicks Members
  Then router.push fires with /admin/groups/{groupId}
```

```gherkin
Scenario: Search filters the list
  Given the Groups list shows 7 groups
  When the admin types "inspect" in FilterBar
  Then after 300ms URL replaces to ?q=inspect
  And the list refetches with q=inspect
```

(Seven total scenarios mapped to §D.2 groups-list integration tests.)

**7. Edge cases / gotchas**

- **System groups must auto-exist after deployment.** Per AC-D15, the three system-defined groups (All Users, All Testees, All Administrators) are created server-side during initial deployment. If the list returns zero system groups, it's a backend deployment issue — surface a warning banner at the top of the page rather than rendering an empty list. v1 doesn't handle this auto-detection; build session evaluates whether to add the banner or accept the soft failure.
- **Group membership for system groups is derived, not stored.** "All Testees" includes every user with `role=testee && status=active`. The `member_ids[]` field on `GroupResponse` is server-computed for system groups. §H (b) item 11 — verify this is the contract.
- **No group delete in v1.** Design `admin-authoring.jsx:599–602` shows Edit + Members on custom rows; no Delete button. Backend has `DELETE /v1/groups/{id}` (`frontend/openapi/schema.json:6236+`) but design doesn't surface it. Deferred to v1.x — admin who wants to delete a group will need to clear its assignments first (separate UX path). §E item 6.
- **`shell.jsx` nav id gap.** `groups` is not in the 7-id ADMIN_NAV list. Build session adds either a top-level `groups` nav id (preferred — matches Users top-level pattern) or nests under Users. §H (b) item 10.

**8. Visual reference**

- `frontend/design-reference/prototype/admin-authoring.jsx:537–556` — `GroupsCrudMock` sub-state strip + composition.
- `frontend/design-reference/prototype/admin-authoring.jsx:558–625` — `GroupListBehind` (table + system-immutability banner).
- `frontend/design-reference/prototype/admin-authoring.jsx:627–642` — `GroupModal`.
- Screenshot: `v6-fe8-19-groups.png`.

---

### B.3 Group membership view — `/admin/groups/[groupId]`

**1. Route segment + URL state**

- File: `frontend/src/app/(admin)/groups/[groupId]/page.tsx`. Dynamic param `groupId`.
- URL state: `?member_q={search}` (filter members within the group by name/email). Modal state for member picker is ephemeral.
- Static `<title>{group.name} · Groups · Acumen</title>` (dynamic via `generateMetadata` in v1 — small cost, real value for browser tab clarity).

**2. Components**

- **Scaffold reused:** same as §B.1 §2.
- **Shared admin primitives:** `adminKeys.groups.{detail,members}` + `FilterBar` + `Modal` + `Field` + route guard + toast + Pattern C from catalogue §C.
- **New in this PR (identity scope):**
  - `GroupMembershipPage` — top-level page. Two-column layout per `admin-authoring.jsx:645–699`. Top: `PageHeader` (eyebrow "GROUP · {group name}", serif title, subtitle = group description, actions = "Edit group" + "+ Add member"). Below: 4-card stat grid (Members count, Assignments bound count, Avg engagement %, Avg competence). Below stats: Members card with `MembersTable`.
  - `MembersTable` — table per `admin-authoring.jsx:666–694`. Columns: Avatar + Name, Email (mono), Joined (relative — when user added to group), Last active (relative), Remove row action (danger). Filter member search above the table.
  - `EditGroupDetailsForm` — inline drawer or modal that opens via the "Edit group" action button. Fields: name + description (same shape as `GroupModal` from §B.2). Disabled for system groups.
  - `MemberPickerModal` — per `admin-authoring.jsx:702–751`. Search field + scrollable candidate list (all users in directory, with checkbox per row + role badge). Existing members render dimmed with "already in group" suffix. Selected count + dedup count footer ("2 selected · existing members are dimmed"). Submit fires `POST /v1/groups/{id}/members` with selected user_ids. Per `admin-authoring.jsx:743` design note: "Adding an administrator to a group is allowed but unusual — most groups are testee-only." — informational, no client-side block.
  - `RemoveMemberConfirm` — inline browser `confirm("Remove {name} from {group}? They'll lose any group-bound assignments.")` (no full modal); fires `DELETE /v1/groups/{id}/members/{user_id}` on OK.
- **shadcn primitives installed:** none beyond FE-2's set + `Sheet` from catalogue. May use `Sheet` for `EditGroupDetailsForm` drawer.
- **Design primitives reused:** `Stat` (FE-2) for the 4-card stat grid; `Pill` (FE-2) for role badges in the picker. `.tbl`, `.card`, `.avatar` (FE-2 shell pattern), `.eyebrow`, `.muted`, `.mono`, `.t-meta`, `.row`, `.gap-2`, `.grid-4`, `.gap-4` per FE-2.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/groups/{group_id}` | Fetch group details + member_ids for header + edit-form pre-fill. | **Exists** at `frontend/openapi/schema.json:6236`. Returns `GroupResponse`. |
| `GET /v1/groups/{group_id}/members?cursor={cursor}&limit=50&q={text}` | Cursor-paginated member list with embedded user details (name, email, joined_at, last_active_at). | **Exists** at `frontend/openapi/schema.json:6412`. Returns `Page_GroupMemberResponse_`. **Members search query param `q` verification — §H (b) item 4.** |
| `POST /v1/groups/{group_id}/members` | Add members (bulk). Body shape: `{ user_ids: string[] }` per design — verify schema name `AddGroupMemberRequest` exists. | **Exists** at `frontend/openapi/schema.json:6412+` (POST). Verify body schema name §H (b) item 12. |
| `DELETE /v1/groups/{group_id}/members/{user_id}` | Remove single member. | **Exists** at `frontend/openapi/schema.json:6481`. |
| `PATCH /v1/groups/{group_id}` | Edit group name + description (custom groups only; backend should 422 for system groups). | **Exists** at `frontend/openapi/schema.json:6236+`. Body: `GroupUpdate`. |
| `GET /v1/users?limit=200` | Member-picker source. Reuses adminKeys.users.list({}) cache shared with §B.1. | (same as §B.1) |

**Stat derivations:**
- "MEMBERS" → `group.member_ids.length` (or `members.total` from page response — verify §H (b) item 13).
- "ASSIGNMENTS BOUND" → derived field on `GroupResponse` (`assignment_count`?) — not in OpenAPI. §H (b) item 14.
- "AVG ENGAGEMENT" → AC-D26 engagement aggregate at group level — not in OpenAPI. §H (b) item 14.
- "AVG COMPETENCE" → roll-up across bound pills — not in OpenAPI. §H (b) item 14.

v1 placeholder: stats render "—" until backend lands the derived fields. Surfaced as §E item 2.

**4. Form fields + zod + rhf**

```ts
const groupEditSchema = z.object({
  name: z.string().min(1, "Group name is required.").max(255),
  description: z.string().max(1024).optional().default(""),
});

const memberPickerSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1, "Pick at least one user to add."),
});
```

Group edit submit:
1. `unwrap(client.PATCH("/v1/groups/{group_id}", { params: { path: { group_id } }, body: dirtyFields }))`.
2. Success: invalidate `adminKeys.groups.detail(groupId)` + `adminKeys.groups.all()` (list cache); toast.info("Group updated"); close edit form.
3. `ApiError`: `applyApiErrorToForm`.

Member picker submit:
1. `unwrap(client.POST("/v1/groups/{group_id}/members", { params: { path: { group_id } }, body: { user_ids: selected } }))`.
2. Success: invalidate `adminKeys.groups.members(groupId)`; toast.info("Added N members"); close modal.
3. `ApiError`: per-user errors map to root with toast.warn detailing which users failed.

Remove member: bare `DELETE` mutation per §2 above; on success invalidate members cache.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `loading_initial` | Mount before group + members queries resolve | Header + stat grid skeleton; members table 10 row skeleton. |
| `happy` | Both queries resolve | Full page renders. |
| `members_filter_typed` | User types in member search FilterBar | Debounced 300ms; URL replaces `?member_q=`; members query refetches. |
| `members_loading_more` / `members_no_more` | (mirrors §B.1 list states for the members table) | (mirrors) |
| `edit_group_open` | "Edit group" action clicked | `Sheet` opens (right drawer); form pre-filled. |
| `edit_group_submitting` / `edit_group_validation_errors` / `edit_group_success` | (mirrors B.2 §B5 modal states) | (mirrors) |
| `edit_group_system_blocked` | Group has `is_system === true` | "Edit group" action button disabled with tooltip "System groups are immutable (AC-D15)." Defensive UI even if backend would 422 anyway. |
| `add_member_modal_open` | "+ Add member" clicked | `MemberPickerModal` mounts; user list query fires (or hits cache). |
| `add_member_search` | User types in picker search field | Picker list filters by name/email (client-side filter on cached results in v1; server-side if cache miss). |
| `add_member_selection_change` | User toggles checkboxes | Selected count footer updates. |
| `add_member_submit` | User clicks "Add N members" | Mutation fires; modal closes on success. |
| `add_member_submit_partial_failure` | Some user_ids fail to add (e.g. already in group via race condition) | Mutation returns mixed — toast.warn detailing which users failed; refresh members list. |
| `remove_member_confirm` | User clicks Remove on a member row | `confirm("Remove {name} from {group}?")` fires. |
| `remove_member_submit` | Confirm OK | DELETE fires; member row disappears; toast.info("Member removed"). |
| `error` | Either query throws | Pattern C boundary via `(admin)/groups/[groupId]/error.tsx`. |
| `not_found` | `GET /v1/groups/{group_id}` returns 404 | Render "Group not found" empty-state with "Back to groups" CTA (similar to FE-6's `attempt-not-found` pattern). |
| `role_mismatch` | Testee role hits `/admin/groups/[id]` | `/403`. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Admin opens a custom group's membership view
  Given the admin opens /admin/groups/{coatings-uuid}
  When the group + members queries resolve
  Then PageHeader renders with the group name
  And the stat grid shows 4 stats (with "—" placeholders for derived fields per §E.2)
  And the members table renders the member rows
```

```gherkin
Scenario: Admin filters members by search
  Given the membership view is rendered with 14 members
  When the admin types "phiri" in the member search
  Then after 300ms URL replaces to ?member_q=phiri
  And the members query refetches with q=phiri
  And the table filters to matching rows
```

```gherkin
Scenario: Admin opens member picker and adds 2 users
  Given the membership view is rendered
  When the admin clicks "+ Add member"
  And MemberPickerModal mounts with the directory loaded
  And selects 2 candidates (Tshepo Mokoena + Zinhle Khanyile)
  And clicks "Add 2 members"
  Then POST /v1/groups/{id}/members fires with {user_ids: [tshepo-uuid, zinhle-uuid]}
  And on 2xx toast.info("Added 2 members") renders
  And the modal closes
  And the members table refetches showing the new members
```

```gherkin
Scenario: Existing members are dimmed in the picker
  Given the picker is open
  When candidates render
  Then candidates whose user_id is in the group's member_ids are dimmed
  And their checkboxes are disabled
  And the "already in group" suffix renders
```

```gherkin
Scenario: Picker shows admin-warning hint
  Given the admin selects an administrator candidate in the picker
  Then the footer copy reminds "Adding an administrator to a group is allowed but unusual — most groups are testee-only."
  And submission is not blocked
```

```gherkin
Scenario: Admin removes a member
  Given a member row "Themba Nkosi" is visible
  When the admin clicks Remove
  And confirms in the browser prompt
  Then DELETE /v1/groups/{id}/members/{themba-uuid} fires
  And on 2xx the row disappears
  And toast.info("Member removed") renders
```

```gherkin
Scenario: Admin edits group details
  Given the membership view is rendered for a custom group
  When the admin clicks "Edit group"
  And Sheet opens with name + description fields pre-filled
  And the admin updates the description
  And clicks Save
  Then PATCH /v1/groups/{id} fires with {description}
  And on 2xx toast.info("Group updated") renders
  And the PageHeader subtitle updates
```

```gherkin
Scenario: Edit group disabled for system groups
  Given the admin opens /admin/groups/{all-testees-uuid}
  Then the "Edit group" action button is disabled
  And the tooltip "System groups are immutable (AC-D15)." renders on hover
```

```gherkin
Scenario: Group not found
  Given the admin opens /admin/groups/{deleted-uuid}
  When GET /v1/groups/{id} returns 404
  Then the empty-state "Group not found" renders
  And the "Back to groups" CTA links to /admin/groups
```

```gherkin
Scenario: Testee hits group membership URL — 403
  Given a testee opens /admin/groups/{id}
  Then layout guard redirects to /403
```

(Ten total scenarios mapped to §D.2 group-membership integration tests.)

**7. Edge cases / gotchas**

- **System group membership is derived server-side.** Editing membership of "All Testees" should be impossible — verify backend 422 + frontend defensive disable (Add member + Remove actions hidden for `is_system === true` groups).
- **Stat derivations are not in OpenAPI.** Placeholder "—" rendering with `// TODO(FE-8-build)` tag per §E.2. Build session evaluates whether backend lands the derived fields or v1 ships with placeholders.
- **Member picker fetches the full user directory.** v1 simple — `useQuery({ queryKey: adminKeys.users.list({}), queryFn: () => unwrap(client.GET("/v1/users", { params: { query: { limit: 200 } } })) })`. For tenants with >200 users, server-side picker search would be required (deferred to v1.x). §E item 3.
- **`avatar` initial-letter visuals.** Avatar component shows first letter of name. Standard FE-2 pattern; reuse the `.avatar` class from FE-2's shell.
- **Joined-at column.** The `GroupMemberResponse` likely has a `joined_at` field; verify §H (b) item 13.
- **Edit drawer vs modal.** Chose `Sheet` over `Modal` because the membership view is a dense page and modal-over-it would obscure context; drawer slides in from the right preserving the table view behind it.

**8. Visual reference**

- `frontend/design-reference/prototype/admin-authoring.jsx:645–700` — `GroupMembershipView`.
- `frontend/design-reference/prototype/admin-authoring.jsx:702–751` — `MemberPickerModal`.
- Screenshot: `v6-fe8-19-groups.png` (composite — membership view inset).

---

### B.4 Assignments — `/admin/assignments` (list + editor + delete confirm)

**1. Route segment + URL state**

- File: `frontend/src/app/(admin)/assignments/page.tsx`. The `assignments/` segment + its `error.tsx` boundary file are FE-8-introduced.
- URL state: `?assigner={me|all}` (default `me` — admin sees their own assignments first; segmented filter to "all" shows org-wide). Modal state ephemeral: `useState<{mode: 'create' | 'edit' | 'delete' | null, assignmentId?: string}>(null)`.
- Static `<title>Assignments · Acumen</title>`.
- Nav-rail anchor: `shell.jsx` admin nav `assignments` id — same gap as `groups` (§B.2 §1 + §H (b) item 10). Build session decides whether to add as top-level nav id or nest under Users.

**2. Components**

- **Scaffold reused:** same as §B.1 §2.
- **Shared admin primitives:** `adminKeys.assignments.*` + `FilterBar` + `Modal` + `Field` + `FieldRow` + route guard + toast + Pattern C from catalogue §C.
- **Cross-file consumption:** `adminKeys.tests.list({})` + `adminKeys.paths.list()` from sibling files for the test/path picker dropdown; `adminKeys.users.list({})` + `adminKeys.groups.list({})` from this file for the testee/group picker. All consumed by `AssignmentEditor`.
- **New in this PR (identity scope):**
  - `AssignmentsListPage` — top-level page. `PageHeader` + "+ New assignment" CTA + `FilterBar` (assigner segment) + `AssignmentsTable` + (conditional) `AssignmentEditor` / `DeleteAssignmentModal`.
  - `AssignmentsTable` — table per `admin-authoring.jsx:941–972` (`AssignmentListBehind`). Columns: Bound to (derived display — group name with member count for group-bound, individual name for testee-bound, multi-target shows "{N} testees + {M} groups" summary), Test / Path (resolved name + (test, mode) annotation OR "(path)" annotation), Mode (auto-derived from pill_id vs learning_path_id), Loop ("autonomous" soft pill / "admin-reviewed" accent pill), Deadline (formatted "12 Jun" or "—"), Progress (string — "8/14 started" — derived field from `engagement_status` aggregate; see §H (b) item 15). Cursor-paginated.
  - `AssignmentEditor` — modal editor per `admin-authoring.jsx:975–1072`. 4 main fields: "Bound to" (the testee+group multi-target picker), Test or Learning Path (single-select dropdown grouped by Tests / Learning paths), Deadline date + Deadline time (two-column), Loop mode (2-card RoleChoice-style picker: autonomous vs admin-reviewed). Info banner at the bottom for create-mode: "{N} testees will receive a notification at the next reminder window."
  - `MultiTargetPicker` — the "Bound to" UX per `admin-authoring.jsx:986–1015`. 3-tab nav (Groups / Testees / Search all) above a free-form chip area where selected testees + groups render with type-coloured chips (group = accent-soft bg, testee = bg-raised). Includes inline add input. Footer: "{N} testees total · {M} unique after de-duplication" — server-side or client-side dedup decision (§H (b) item 16).
  - `PickerChip` — chip primitive per `admin-authoring.jsx:1085–1101`. Type-coloured background + Icon prefix (users for group, user for testee) + label + X dismiss button.
  - `LoopChoice` — 2-card chooser per `admin-authoring.jsx:1102–1115`. Disabled in edit mode if assignment has started (per design line 25: "Loop mode is the only field that can't be edited once the assignment has been started by any testee"). **Verify backend enforces this** — §H (b) item 17.
  - `DeleteAssignmentModal` — confirm modal per `admin-authoring.jsx:1117–1147`. Summary card (bound to / test / deadline / progress) + danger banner explaining what gets deleted (testees lose access immediately, completed attempts preserved in history, in-progress attempts paused and unrecoverable).
- **shadcn primitives installed:** none beyond FE-2's set + `Sheet` (catalogue B.4).
- **Design primitives reused:** `Pill` (FE-2) for mode + loop badges; `Icon` (lucide users / user / mail). `.tbl`, `.card`, `.eyebrow`, `.btn`, `.btn-primary`, `.muted`, `.mono`, `.t-meta`, `.row`, `.gap-2` per FE-2.

**3. API endpoints consumed**

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/assignments?cursor={cursor}&limit=50&assigner_id={uuid}` | List assignments. Consumed by `AssignmentsTable`. Default filter `assigner_id` = current user's id (the "me" filter); "all" filter omits the param. | **Exists** at `frontend/openapi/schema.json:4613`. Returns `Page_AssignmentResponse_`. |
| `POST /v1/assignments` | Create assignment. | **Exists** at `frontend/openapi/schema.json:4613+`. Body: `AssignmentCreate` (`{difficulty, deadline?, group_ids[], is_mandatory?, learning_path_id?, loop_mode?, pill_id?, testee_ids[]}` — `frontend/openapi/schema.json:178–257`). |
| `GET /v1/assignments/{assignment_id}` | Fetch single assignment for edit modal pre-fill. | **Exists** at `frontend/openapi/schema.json:4764`. Returns `AssignmentResponse` (`frontend/openapi/schema.json:259–352`). |
| `PATCH /v1/assignments/{assignment_id}` | Edit assignment. Backend behaviour for changing `loop_mode` after attempts have started: per design line 25, locked. Per OpenAPI: schema allows the field, backend may 422 on the change. §H (b) item 17. | **Exists** at `frontend/openapi/schema.json:4764+`. |
| `DELETE /v1/assignments/{assignment_id}` | Delete assignment. | **Exists** at `frontend/openapi/schema.json:4764+`. |
| `GET /v1/users?limit=200` (cross-file) | Source for `MultiTargetPicker` testee tab. Uses `adminKeys.users.list({})`. | (per §B.1) |
| `GET /v1/groups?limit=200` (cross-file) | Source for `MultiTargetPicker` groups tab. | (per §B.2) |
| `GET /v1/tests?limit=200` (cross-file from `fe-specs/FE-8-admin-tests.md`) | Source for "Test or Learning Path" picker tests dropdown group. Uses `adminKeys.tests.list({})` from sibling. | (per sibling B.1) |
| `GET /v1/learning-paths?limit=200` (cross-file from `fe-specs/FE-8-admin-catalogue.md`) | Source for "Test or Learning Path" picker paths dropdown group. Uses `adminKeys.paths.list()` from catalogue. | (per catalogue B.6) |

**4. Form fields + zod + rhf**

```ts
const assignmentFormSchema = z.object({
  // One-of: pill_id OR learning_path_id (test selection canonicalises to pill_id via the chosen test's pill — verify §H (b) item 18)
  pill_id: z.string().uuid().nullable().optional(),
  learning_path_id: z.string().uuid().nullable().optional(),
  // Difficulty — required
  difficulty: z.number().int().min(1).max(10),
  // Multi-target — at least one testee or group required
  testee_ids: z.array(z.string().uuid()).default([]),
  group_ids: z.array(z.string().uuid()).default([]),
  // Deadline composition — date + time → ISO datetime
  deadline_date: z.string().nullable().optional(),  // YYYY-MM-DD
  deadline_time: z.string().nullable().optional(),  // HH:MM (24h, local TZ)
  // Loop + mandatory
  loop_mode: z.enum(["autonomous", "admin_reviewed"]).default("autonomous"),
  is_mandatory: z.boolean().default(false),
})
.refine(d => d.pill_id || d.learning_path_id, {
  path: ["pill_id"],
  message: "Pick a test or learning path.",
})
.refine(d => d.testee_ids.length > 0 || d.group_ids.length > 0, {
  path: ["testee_ids"],
  message: "Bind to at least one testee or group.",
})
.refine(d => !d.deadline_date || (d.deadline_date && d.deadline_time), {
  path: ["deadline_time"],
  message: "Pick a deadline time too.",
});

type AssignmentFormInput = z.infer<typeof assignmentFormSchema>;
```

**Test/path picker behaviour:** the dropdown is grouped into `<optgroup label="Tests">` (option value = `test:{test_id}`) and `<optgroup label="Learning paths">` (option value = `path:{path_id}`). On change, the value is parsed: if `test:*`, fetch the test to derive its `pill_id` and set `pill_id` on the form (clearing `learning_path_id`); if `path:*`, set `learning_path_id` and clear `pill_id`. **§H (b) item 18** — verify: is the test's pill_id directly set on the assignment, or does backend resolve test→pill itself? If backend resolves, FE just sets `test_id` instead — but the OpenAPI `AssignmentCreate` doesn't have `test_id`.

**Submit handler (create):**
1. Compose `deadline` ISO string from `deadline_date + deadline_time` in local TZ (browser conversion to UTC ISO).
2. `unwrap(client.POST("/v1/assignments", { body: { pill_id, learning_path_id, difficulty, deadline, testee_ids, group_ids, loop_mode, is_mandatory } }))`.
3. Success: invalidate `adminKeys.assignments.all()`; toast.info("Assignment created — {N} testees will be notified."); close modal.
4. `ApiError`: `applyApiErrorToForm`.

**Submit handler (edit):**
1. Build PATCH body from dirty fields only.
2. If `loop_mode` is dirty AND the assignment has started (per backend signal — §H (b) item 17), the field is already disabled in UI; defensive backend 422 surfaces via toast.
3. Otherwise standard PATCH.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `list_loading` / `list_empty` / `list_happy_*` | (mirrors §B.1) | Empty: "No assignments yet — bind a test or path to testees or groups to get started." |
| `filter_assigner_me` | `?assigner=me` (default) | List filters to current user's assignments. |
| `filter_assigner_all` | User clicks "All" segment | URL replaces; refetch without `assigner_id` filter. |
| `editor_modal_create_open` | "+ New assignment" clicked | `AssignmentEditor` mounts in create variant; form pristine; `MultiTargetPicker` empty. |
| `editor_modal_edit_open` | Edit clicked on a row (row click) | `AssignmentEditor` mounts in edit variant; form pre-filled from `useQuery(adminKeys.assignments.detail(id))`; `LoopChoice` disabled if assignment has started. |
| `editor_picker_groups_tab` | User clicks Groups tab in MultiTargetPicker | Tab shows group candidates; clicking a group adds it as a chip + count footer updates. |
| `editor_picker_testees_tab` | User clicks Testees tab | Tab shows testee candidates. |
| `editor_picker_search_all` | User clicks Search all tab | Search across all users (regardless of role) + all groups. |
| `editor_picker_chip_added` | User picks a candidate | Chip renders in the chip area; footer count updates ("27 testees total · 22 unique after de-duplication" — see §H (b) item 16). |
| `editor_picker_chip_removed` | User clicks X on a chip | Chip removed; count footer updates. |
| `editor_test_path_picker_changed` | User picks an option in the test/path dropdown | Form's `pill_id` or `learning_path_id` updates per the parsing rule in §4. |
| `editor_deadline_changed` | User picks a date | ISO `deadline` composed on submit; time defaults to 17:00 if user only picks date. |
| `editor_loop_changed` | User clicks a LoopChoice card | `loop_mode` updates. |
| `editor_loop_locked_post_start` | Edit modal opens for an assignment with `started_at !== null` (per backend signal §H (b) item 17) | LoopChoice cards both disabled with opacity 0.7; tooltip "Loop mode locks once any testee starts." |
| `editor_submit_submitting` | rhf `isSubmitting` | "Create assignment" / "Save changes" button pulse-dot + label; fields disabled. |
| `editor_submit_validation_errors` | zod or 422 | Pattern A inline errors. |
| `editor_submit_success` | 2xx | Toast.info("Assignment created — {N} testees will be notified.") (create) or toast.info("Assignment updated") (edit); modal closes; list refetches. |
| `delete_confirm_open` | Delete row action clicked | `DeleteAssignmentModal` mounts with summary card + danger banner. |
| `delete_submitting` | User clicks Delete in confirm | DELETE fires; on 2xx toast.info("Assignment deleted") + row disappears. |
| `error` | List or detail query throws | Pattern C boundary. |
| `role_mismatch` | Testee hits `/admin/assignments` | `/403`. |

**6. Acceptance criteria (Gherkin)**

```gherkin
Scenario: Admin creates a single-testee assignment
  Given the admin clicks "+ New assignment"
  When AssignmentEditor mounts in create variant
  And the admin picks the test "Antifouling — focus"
  And picks testee "Lerato Dlamini" via the picker (Testees tab)
  And sets deadline 2026-06-12 at 17:00
  And leaves loop_mode at autonomous
  And clicks "Create assignment"
  Then POST /v1/assignments fires with {pill_id, difficulty, testee_ids: [lerato-uuid], group_ids: [], deadline: "2026-06-12T17:00:00...", loop_mode: "autonomous"}
  And on 201 toast.info("Assignment created — 1 testee will be notified.") renders
  And the modal closes
  And the list refetches
```

```gherkin
Scenario: Admin creates a multi-target (testees + groups) assignment
  Given the admin opens the editor
  When the admin selects 2 groups + 5 individual testees in the picker
  Then the footer shows "27 testees total · 22 unique after de-duplication"
  When the admin submits
  Then POST /v1/assignments fires with testee_ids: [5 uuids], group_ids: [2 uuids]
  And on 201 the assignee count in the success toast reflects 22 unique
```

```gherkin
Scenario: Admin binds a learning path instead of a test
  Given the editor is open
  When the admin picks "New inspector — foundations (path)" in the Test or Learning Path dropdown
  Then the form's learning_path_id updates to the path uuid
  And pill_id is cleared
  When submit fires
  Then POST /v1/assignments includes learning_path_id: {path-uuid}, pill_id: null
```

```gherkin
Scenario: Validation requires at least one testee or group
  Given the editor is open with a test picked but no targets
  When the admin clicks Create
  Then zod surfaces "Bind to at least one testee or group." under the picker
  And no network call fires
```

```gherkin
Scenario: Validation requires a test or path
  Given the editor is open with targets picked but no test/path
  When submit fires
  Then zod surfaces "Pick a test or learning path." under the picker
```

```gherkin
Scenario: Deadline date without time prompts validation
  Given the admin picks a deadline date but leaves time empty
  When submit fires
  Then zod surfaces "Pick a deadline time too." under the time field
```

```gherkin
Scenario: Admin edits an in-flight assignment — loop_mode is locked
  Given an assignment with started_at !== null is in the list
  When the admin clicks Edit on that row
  Then AssignmentEditor mounts in edit variant
  And the LoopChoice cards are disabled with opacity 0.7
  And the tooltip "Loop mode locks once any testee starts." renders on hover
  And other fields (deadline, is_mandatory) remain editable
```

```gherkin
Scenario: Backend 422 on loop_mode PATCH-after-start
  Given the LoopChoice cards are disabled in edit mode
  And the admin somehow submits a PATCH with a changed loop_mode (via raw HTTP)
  When backend returns 422 with code "LOOP_MODE_LOCKED"
  Then applyApiErrorToForm projects the error to root
  And a Pattern B error toast surfaces with the backend message
```

```gherkin
Scenario: Admin filters to "All" assignments
  Given the list defaults to ?assigner=me
  When the admin clicks the "All" segment
  Then URL replaces to ?assigner=all
  And the list refetches without assigner_id filter
```

```gherkin
Scenario: Admin deletes an assignment
  Given an assignment row is visible
  When the admin clicks Delete row action
  And DeleteAssignmentModal mounts with the summary card
  And the admin clicks Delete
  Then DELETE /v1/assignments/{id} fires
  And on 2xx the row disappears
  And toast.info("Assignment deleted") renders
```

```gherkin
Scenario: Editor cancel with dirty form prompts confirm
  Given AssignmentEditor is open with dirty fields
  When the admin clicks Cancel
  Then browser confirm("Discard unsaved changes?") fires
```

(Eleven total scenarios mapped to §D.2 assignments integration tests.)

**7. Edge cases / gotchas**

- **Dedup of testees-in-groups.** Per `admin-authoring.jsx:1012–1014`: "27 testees total · 22 unique after de-duplication". The unique count is the count of distinct testees after group expansion + dedup. **§H (b) item 16** — verify whether backend dedups server-side (preferred — single source of truth) or whether FE must compute the unique count client-side. v1 fallback: FE computes client-side using cached `group.member_ids` arrays.
- **Loop mode immutability post-start.** The design (`admin-authoring.jsx:25`) is explicit: "Loop mode is the only field that can't be edited once the assignment has been started by any testee." Backend OpenAPI doesn't surface a `started_at` signal directly — verify via §H (b) item 17. v1 best-effort: read `assignment.started_at` from extended `AssignmentResponse` (if backend adds it) OR fetch `GET /v1/assignments/{id}/attempts?count_only=true` to check if any attempts exist (extra query — heavier).
- **Test→pill_id resolution.** Per AC-D5 + AC-D17, a per_testee test has one pill, a frozen test has many pills (the question pool spans pills). The assignment likely sets `pill_id` for per_testee mode and uses a different mechanism for frozen/benchmark. **§H (b) item 18** — confirm assignment-to-test wiring; spec body assumes the simplest case (test selection sets pill_id from the test's primary pill).
- **Difficulty derivation.** Form's `difficulty` field is required per OpenAPI. Design doesn't surface it explicitly in the editor — likely derived from the chosen test's `target_difficulty` and pre-filled (read-only display in v1). **§H (b) item 19** — verify whether difficulty is admin-editable per assignment or auto-derived. Spec body assumes auto-derived from the test's `target_difficulty`.
- **Timezone handling.** Deadline date + time are entered in local TZ; submit converts to UTC ISO via `new Date(`${date}T${time}:00`).toISOString()`. The list renders deadline in local TZ. Cross-tab admin in different TZs sees their own local TZ formatting — acceptable for v1.
- **Notification timing.** The success toast mentions "at the next reminder window" — backend cron handles delivery per AC-D26 + the cron schedule (`beat_schedule.py` from PR-024). Frontend just creates the assignment; no immediate-send affordance.
- **`engagement_status` aggregate not in OpenAPI.** Progress column on the list — see §H (b) item 15.
- **Test or path display in list.** Backend returns `pill_id` + `learning_path_id` on `AssignmentResponse`; frontend resolves them via cached `adminKeys.tests` / `adminKeys.paths` queries. N+1 risk: if list has 17 assignments referencing 17 distinct tests, frontend fires 17 detail queries unless backend embeds the names. **§H (b) item 20** — verify whether `AssignmentResponse` should be extended with `test_name` / `path_name` for list display, OR whether a single batch query suffices.

**8. Visual reference**

- `frontend/design-reference/prototype/admin-authoring.jsx:921–940` — `AssignmentsCrudMock` sub-state strip.
- `frontend/design-reference/prototype/admin-authoring.jsx:941–973` — `AssignmentListBehind` (table).
- `frontend/design-reference/prototype/admin-authoring.jsx:975–1072` — `AssignmentEditor`.
- `frontend/design-reference/prototype/admin-authoring.jsx:1074–1115` — `PickerTab` + `PickerChip` + `LoopChoice` primitives.
- `frontend/design-reference/prototype/admin-authoring.jsx:1117–1147` — `DeleteAssignmentModal`.
- Screenshot: `v6-fe8-22-assignments.png`.

---

## C. Cross-page concerns

### C.1 `adminKeys` consumption (from catalogue)

`adminKeys.{users,groups,members,assignments}` consumed from `fe-specs/FE-8-admin-catalogue.md §C.1` unchanged. Import:

```ts
import { adminKeys } from "@/lib/queries/admin-keys";  // canonical — declared in FE-8-admin-catalogue.md §C.1
```

Identity-side invalidation chains:
- `POST /v1/users` → invalidate `adminKeys.users.all()`.
- `PATCH /v1/users/{id}` → invalidate `adminKeys.users.all()` + `adminKeys.users.detail(id)`.
- `POST /v1/users/{id}/deactivate|reactivate` → invalidate `adminKeys.users.all()` + `adminKeys.users.detail(id)`.
- `POST /v1/groups` → invalidate `adminKeys.groups.all()`.
- `PATCH /v1/groups/{id}` → invalidate `adminKeys.groups.all()` + `adminKeys.groups.detail(id)`.
- `POST /v1/groups/{id}/members` → invalidate `adminKeys.groups.members(id)` + `adminKeys.groups.detail(id)` (member_ids array changes).
- `DELETE /v1/groups/{id}/members/{user_id}` → same as add.
- `POST/PATCH/DELETE /v1/assignments[/{id}]` → invalidate `adminKeys.assignments.all()`.

### C.2 `(admin)` route group + role guard

Consumed from `fe-specs/FE-8-admin-catalogue.md §C.2` unchanged. Every page in this file mounts under `frontend/src/app/(admin)/{...}/page.tsx`.

### C.3 `applyApiErrorToForm` reuse

Consumed from `fe-specs/FE-8-admin-catalogue.md §C.3` unchanged. Path: `frontend/src/lib/api/form-errors.ts`. Every form in this file imports it.

### C.4–C.8 Other shared primitives

`FilterBar` (§C.4), `Modal` (§C.5), `Field`/`FieldRow`/`FieldError` (§C.6), toast helper (§C.7), Pattern C boundary (§C.8) — all consumed from `fe-specs/FE-8-admin-catalogue.md` unchanged.

### C.9 Cross-file picker integrations

`AssignmentEditor` (B.4) consumes 4 cross-resource lists simultaneously:
- `useQuery(adminKeys.users.list({}))` — from this file's B.1.
- `useQuery(adminKeys.groups.list({}))` — from this file's B.2.
- `useQuery(adminKeys.tests.list({}))` — from `fe-specs/FE-8-admin-tests.md §B.1`.
- `useQuery(adminKeys.paths.list())` — from `fe-specs/FE-8-admin-catalogue.md §B.6`.

All four queries fire on AssignmentEditor mount (or hit cache from prior visits). The 4 results compose into the picker UX. Cache-warm pattern: when admin visits `/admin/users` first then opens an assignment editor, the users query is hot.

---

## D. Test cases (Vitest)

### D.1 Unit tests (lib + helpers)

- `frontend/src/lib/identity/derive-invited-status.test.ts` — heuristic test for `invited` derivation: pure function `deriveStatus(user)` → "active" | "invited" | "deactivated" per §B.1 §7 rules.
- `frontend/src/lib/identity/dedup-assignees.test.ts` — pure function `dedupAssignees({testee_ids, group_ids, groupsMap})` → unique count. Tests overlap cases (testee in 2 groups, testee in group + direct selection).
- `frontend/src/lib/identity/compose-deadline.test.ts` — pure function `composeDeadline(date, time, tz)` → UTC ISO. Tests for missing time, TZ conversion, future-date validation.

### D.2 Page integration tests

One test file per §B entry:

- `frontend/src/app/(admin)/users/page.test.tsx` — §B.1 trios (11 scenarios).
- `frontend/src/app/(admin)/groups/page.test.tsx` — §B.2 trios (7 scenarios).
- `frontend/src/app/(admin)/groups/[groupId]/page.test.tsx` — §B.3 trios (10 scenarios).
- `frontend/src/app/(admin)/assignments/page.test.tsx` — §B.4 trios (11 scenarios).

Total: 39 identity-side integration scenarios.

### D.3 Round-trip integration test

`frontend/tests/integration/admin-identity-roundtrip.test.tsx`:
- Done-when in narrative form (identity slice): admin lands at `/admin/users` → invites a new testee → checks the user appears in "All Testees" system group → opens `/admin/groups` → creates custom group "QA inspectors" → adds the new testee to the group → opens `/admin/assignments` → creates an assignment binding test X to QA inspectors with deadline → returns to assignments list and verifies it's there.

Single test, exercises every page in the identity file + cross-file assignment editor.

### D.4 Coverage gate (FE_CHECKLIST.md FE-8 identity rows tick on)

- All §B Gherkin + D.3 round-trip green via `pnpm test --run`.
- `pnpm typecheck` clean.
- `pnpm lint` clean.
- `pnpm build` succeeds.

---

## E. Known placeholders (DO NOT SHIP AS-IS)

| # | Placeholder | Location | Action before production |
|---|---|---|---|
| 1 | `last_active_at` column on Users list (derived field not in `UserResponse`) | `(admin)/users/_components/users-table.tsx` | Backend adds `last_active_at` to `UserResponse` (§H (b) item 1). v1 placeholder: render "—" with `// TODO(FE-8-build)`. |
| 2 | Group membership stats (Members count works; Assignments bound / Avg engagement / Avg competence don't) | `(admin)/groups/[groupId]/_components/group-membership-view.tsx` | Backend lands the 3 derived fields on `GroupResponse` per §H (b) item 14. v1 placeholder: render "—" for the 3 missing stats. |
| 3 | Member picker fetches full directory (no server-side search) | `(admin)/groups/[groupId]/_components/member-picker-modal.tsx` | v1 fetches up to 200 users client-side. For tenants >200 users (deferred — SiteMesh v1 = single small tenant), v1.x adds server-side picker search. |
| 4 | Bulk invite CTA disabled | `(admin)/users/page.tsx` | Disabled button + "Coming in v1.x" tooltip. Bulk CSV/paste invite deferred. |
| 5 | No per-user admin profile drill-down | `/admin/users/[userId]` (not implemented) | v1 has no admin-scoped user profile page; admin can only Edit / Deactivate via the list modal. v1.x adds per-user attempt history + competence rollup (FE-7 admin variant). |
| 6 | No group delete affordance | `(admin)/groups/page.tsx` | Backend has `DELETE /v1/groups/{id}`; design surfaces no Delete row action. v1 ships without. v1.x adds with cascade-handling UX. |
| 7 | `engagement_status` aggregate ("Progress" column on Assignments list) — derived field not in `AssignmentResponse` | `(admin)/assignments/_components/assignments-table.tsx` | Backend adds aggregate (§H (b) item 15). v1 placeholder: render "—" or "TBD". |
| 8 | `test_name` / `path_name` on AssignmentResponse for list display | `(admin)/assignments/_components/assignments-table.tsx` | Backend adds resolved names OR batch query (§H (b) item 20). v1 best-effort: per-row `useQuery` for the test/path detail (N+1 with caching mitigates). |

---

## F. Scope additions beyond prior FE-N specs

### F.1 No SPEC.md edits required

No spec amendments. All AC anchors cited are already canonical.

### F.2 FE-9 boundary explicitly excluded

The following surfaces are explicitly **NOT** in FE-8 identity scope:

- Group-level reporting deep-dives (covers per-pill rollups, attempt distribution across the group, etc.) — FE-9 ops dashboard.
- Engagement queue consumption (`/v1/admin/engagement/pending`) — FE-9.
- Loop-driven follow-up approval queue — FE-9 `admin-ops.jsx:loop`.

FE-8 identity ships the create-time surface for assignments + loop_mode setting; FE-9 ships the operational queue surfaces that consume the assignment's downstream state.

### F.3 Frontend convention: `name` field split

Backend `UserResponse.name` is a single string. Design splits into first + last name input fields. Convention (per §B.1 §7): on submit, join with `" "`. On edit pre-fill, split at first space. This is a frontend-only display convention; no backend amendment needed. **Tag the helper at `frontend/src/lib/identity/split-name.ts`** with a clear note about the convention so future engineers don't try to round-trip the split.

### F.4 AC-CD-structural additions

None new in this file. Inherits the catalogue file's additions (`@dnd-kit`, `Sheet`).

---

## G. Session 2 onwards — template propagation

This file follows the catalogue file's variance declarations (§G of `fe-specs/FE-8-admin-catalogue.md`) — no additional variances declared.

**File-specific notes:**

- Modal states nested within their parent route-entry's §5 (States) — different from FE-1 where modals were route-level (Login / Forgot / etc are each their own route). Justification: FE-8 modals are overlays on a list page, not routes themselves. The 8-section template still applies per page; modal states join the list states.
- Assignment editor (`B.4`) is the most coupled page in the entire FE-8 phase (consumes 4 cross-resource lists). Cross-file consumption documented in §C.9 + §B.4 §2.

---

## H. Spec-drift roll-up (post-review classification)

The cross-walk surfaced 20 candidate items. After review, they're classified into three groups:

### (a) BLOCKERS for the FE-8 identity build session — must land before the build session opens

1. **Inherits `fe-specs/FE-8-admin-catalogue.md §H (a) item 1`** — `applyApiErrorToForm` path drift in FE-1 spec. Identity file has 5+ forms relying on the canonical path; the cross-spec one-line FE-1 fix unblocks this file too.

### (b) BUILD-SESSION VERIFICATION TASKS — front-loaded at the start of the FE-8 identity build session

The build session opens with a verification step before any code lands: read the FastAPI handlers for `/v1/users`, `/v1/groups`, `/v1/assignments` + the relevant Pydantic schemas, confirm the assumptions below match reality. If any diverge, halt and surface for spec-clarification PR.

1. **`last_active_at` field on `UserResponse`.** Not in `frontend/openapi/schema.json:3459–3511`. Verify backend has the field; if not, v1 placeholder per §E.1.
2. **`invited` status derivation.** Backend `UserStatus` enum is `active|deactivated` only. Spec heuristic: `active && privacy_ack_at === null && last_active_at === null` → `invited`. Verify with backend whether a `setup_consumed_at` / `invited_at` timestamp exists; if so, deterministic derivation; if not, the heuristic ships with `// TODO(FE-8-build)`.
3. **Deactivate `reason` field.** Backend endpoint accepts no body. Design's Reason textarea is frontend-only in v1. Confirm before build whether to keep the field (captured-but-not-sent for future v1.x) or drop it from the modal.
4. **Filter query params** (`q`, `role`, `status` on `/v1/users`; `q` on `/v1/groups`; `q` on `/v1/groups/{id}/members`; `assigner_id` on `/v1/assignments`). Verify which params are wired server-side; client-side fallback if missing.
5. **`POST /v1/users/{user_id}/resend-setup` endpoint.** Not surfaced in the OpenAPI read. Verify; if absent, the Resend row action is disabled with placeholder until backend lands the endpoint.
6. **`name` required-or-optional on `AdminCreateUserRequest`.** OpenAPI declares `name`; verify if it's required or optional. Design treats it as optional ("First name (optional)" — `admin-authoring.jsx:451`). Spec body matches design.
7. **`EMAIL_TAKEN` business error code.** Spec assumes 422 with field-level detail OR a top-level code. Verify backend's actual error shape on duplicate email.
8. **`role` enum.** OpenAPI declares `role: string` (no enum constraint). Spec body assumes `"admin" | "testee"` per AC-D2. Verify backend rejects other values via 422.
9. **Self-deactivation backend guard.** Verify backend 422s if admin tries to deactivate themselves. Frontend already hides the Deactivate action for `user.id === auth.user.id`.
10. **`shell.jsx` admin nav id gaps.** `groups` + `assignments` not in `shell.jsx:15`'s 7-id list. Build session adds top-level nav ids OR nests under Users. Decide; if structural-addition, fold into handover.
11. **System group membership is server-derived.** Verify `member_ids[]` on `GroupResponse` for `is_system === true` rows is computed server-side and read-only.
12. **`AddGroupMemberRequest` schema name.** Verify the request body shape for `POST /v1/groups/{id}/members` — likely `{user_ids: string[]}` per design.
13. **`GroupMemberResponse.joined_at` field.** Verify the response shape for `GET /v1/groups/{id}/members` includes per-membership `joined_at` timestamp.
14. **Group-level stat derivations** (`assignment_count`, `avg_engagement`, `avg_competence` on `GroupResponse`). Not in OpenAPI. Verify backend can add OR confirm v1 ships with "—" placeholders.
15. **Assignment `engagement_status` aggregate on `AssignmentResponse`.** Design shows "8/14 started · 3 completed" — derived field. Verify backend exposes; v1 placeholder otherwise.
16. **Assignment dedup of testees-in-groups.** Verify whether `POST /v1/assignments` server-side dedups `testee_ids ∩ group.member_ids` OR whether FE must dedup before POST.
17. **`AssignmentResponse.started_at` or equivalent signal for loop_mode lock.** Design line 25 locks loop_mode after start. Verify backend exposes a signal (added field on `AssignmentResponse`, OR backend 422 on PATCH-loop-mode-after-start).
18. **Assignment-to-test pill_id resolution.** Verify whether assignment.pill_id is set directly by FE (FE resolves test→pill) OR by backend (FE sends test_id; backend resolves). OpenAPI `AssignmentCreate` doesn't have `test_id`; spec assumes FE-resolves.
19. **Assignment `difficulty` field source.** Verify whether admin sets difficulty per assignment OR backend auto-derives from chosen test's `target_difficulty`. Design doesn't surface the field explicitly.
20. **Assignment list display — test/path name embedding.** Verify whether `AssignmentResponse` embeds `test_name` / `path_name` OR FE must per-row fetch. N+1 risk for the list.

### (c) APPROVED RESOLUTIONS — folded into FE-8 identity build PR scope, captured in the build PR's handover

These are not blockers. The spec body locks the resolution; the build session implements; the build PR's handover records them under the SESSION_START.md AC-CD-structural-additions carve-out.

21. **§C anchored canonically in `fe-specs/FE-8-admin-catalogue.md`** — this file consumes `adminKeys` + shared primitives by reference.
22. **Modals nested under list-page §B entries** (rather than route-level B-entries per FE-1) — modal-as-overlay pattern documented in §G.
23. **`AssignmentEditor` cross-file consumption** of `adminKeys.{tests,paths}` (§C.9) — single canonical declaration in catalogue file; identity file references.
24. **`name` field split convention** (first + last) is frontend-only display; backend stores single string (§F.3).
25. **Deactivate Reason textarea is frontend-only in v1** — captured locally but not sent to backend (§H (b) item 3 resolution path: keep field for v1.x audit extension).
26. **Browser `confirm()` for low-risk confirmations** (reactivate, cancel-dirty, remove-member) — custom `AlertDialog` deferred to v1.x per `fe-specs/FE-8-admin-catalogue.md §B.2 §7` precedent.

---

*End of FE-8-admin-identity.md. Sibling specs: `fe-specs/FE-8-admin-catalogue.md` + `fe-specs/FE-8-admin-tests.md`. Template propagates per `fe-specs/FE-8-admin-catalogue.md §G`; deviations surface as spec drift.*
