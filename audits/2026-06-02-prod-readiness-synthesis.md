# Production-Readiness Audit — Reviewer Synthesis (adjudication)

**Date:** 2026-06-03 (filed under the 2026-06-02 prod-readiness cycle)
**Role:** Reviewer — adjudicates between Auditor 1 (A1) and Auditor 2 (A2).
Does **no** original audit work; compares findings side-by-side, verifies
each against code, and manages convergence.
**Inputs:** `audits/2026-06-02-prod-readiness-auditor1.md` (A1 Round 1),
`audits/2026-06-02-prod-readiness-auditor2.md` (A2 Round 1), both on
branch `claude/practical-cannon-QKdwy`.
**Verification baseline:** `5f0f184` (PR-#92 "Slice 5") — the deploy
target both auditors pinned and the exact SHA of this reviewer session's
working tree, so every citation below was read directly against the audited
code, not a proxy.
**Classification key:** CONFIRMED (both auditors, or independently verified)
· VERIFIED (one auditor, reviewer verified the code) · DISPUTED (auditors
disagree — adjudicated) · REJECTED (finding incorrect) · WORTH-KNOWING (real
but does not gate the redeploy).

> **Status: Round 1 adjudicated — NOT converged.** This file carries the
> Round-1 adjudication only. The final synthesis (fix-workstream, firm
> pre/post-deploy tier split, carry-forward backlog) is appended after both
> auditors post their "no further findings" markers. Provisional tiering
> below is flagged as such.

---

## 1. Round-1 headcount

- **A1:** 8 graded findings (1 blocking · 3 serious · 4 worth-knowing) + 1
  out-of-scope + 1 operational note.
- **A2:** 6 graded findings (1 blocker · 2 high · 2 medium · 1 low) + 3
  out-of-scope/context notes.
- **Union after dedup:** **12 distinct graded findings.** Two are convergent
  (both auditors): the email-link blocker and the admin "v1.x" placeholders.
  The remaining ten are single-auditor and split cleanly across disjoint
  surfaces (A1 → error/recovery routing, anchor-ID leakage, privacy copy,
  shell polish; A2 → testee result-flow silent failures, dashboard
  assignments, engagement-sweep correctness).
- **Disputes:** none. The auditors nowhere contradict each other.
- **Rejections:** none. Every finding reproduced against `5f0f184`.

---

## 2. Side-by-side convergence table

| # | Finding (one-line) | A1 | A2 | Class | Reviewer severity |
|---|---|---|---|---|---|
| 1 | Setup/reset email links 404 for every user (path shape **+** API-vs-frontend host) | #1 BLOCKING | F1 BLOCKER | **CONFIRMED** | **Blocker** |
| 2 | Error/404/403 "Go to dashboard" hardcodes `/` → admin inescapable loop | #2 Serious | — | **VERIFIED** | Serious (pre-deploy) |
| 3 | Internal anchor IDs (`AC-D6/19/21/25`) render as visible UI text | #3 Serious | — | **VERIFIED** | Serious (pre-deploy) |
| 4 | Privacy gate shows non-legal-reviewed placeholder copy | #4 Serious | — | **VERIFIED** | Launch gate (operator) |
| 5 | Testee result page silently blanks on fetch error (dead `error.tsx`) | — | F2 High | **VERIFIED** | High (pre-deploy) |
| 6 | GradingOverlay spins forever on result-poll error | — | F3 High | **VERIFIED** | High (pre-deploy) |
| 7 | Learning-path assignments unstartable; pill names → hex IDs | — | F4 Medium | **VERIFIED** | Medium |
| 8 | Engagement escalation counted/audited "sent" while no email sent | — | F5 Medium | **VERIFIED** | Medium |
| 9 | Admin "Coming in v1.x" placeholders (cost `daily_history`, bulk-invite, path-editor, TopBar search) | #5 Worth-knowing | F6 Low | **CONFIRMED** | Worth-knowing |
| 10 | Admin group detail: 3/4 stats bare "—", no "deferred" cue | #6 Worth-knowing | — | **VERIFIED** | Worth-knowing |
| 11 | Disabled "Contact support" on 500 page contradicts its own copy | #7 Worth-knowing | — | **VERIFIED** | Worth-knowing |
| 12 | Rail active-nav lost on every deep route (exact-equality match) | #8 Worth-knowing | — | **VERIFIED** | Worth-knowing |
| — | Auth/privacy pages bypass theme tokens (dark-mode contrast) | OOS-1 | (implied) | WORTH-KNOWING | Cosmetic |
| — | `counterpart-change-detector` skill absent from checkout | Op note | Context | (coordination) | n/a — see §5 |

---

## 3. Per-finding adjudication

### CONFIRMED

**C1 — Setup/reset email links are structurally unreachable (BLOCKER).**
*A1 #1 + A2 F1; reviewer-verified.* Two compounding root causes, both live
in the deploy target:
- **Facet A — wrong path shape.** `app/permissions.py:266` /`:275` build
  `…/setup?token=` and `…/reset?token=` (query string). Verified at
  `5f0f184`. The only frontend routes are dynamic **path segments**
  `frontend/src/app/(auth)/setup/[token]/page.tsx` and `reset/[token]/`,
  reading the token from the path; there is no `/setup` or `/reset` index
  page and no rewrite/middleware → Next.js 404.
- **Facet B — wrong host.** `app/config.py:30` defaults `app_public_url =
  "http://localhost:8000"` (the **API** origin), and `app/main.py:111`
  hands the same value to the frontend as `api_base_url`. `docs/DEPLOYMENT.md`
  documents `APP_PUBLIC_URL` as the externally-visible **API** URL; the
  frontend origin is a separate value. So even a path-shaped link points at
  the API host, which serves no `/setup` page.

Both auditors independently caught both facets and agree on the fix
direction (path-segment link **and** a dedicated frontend-origin setting;
both must land). Reviewer note: the open, **unmerged** branch
`fix/auth-email-token-links` (PR #83, `6193e78`) patches **only Facet A**
and is based on a stale pre-#92 baseline — confirmed open in the PR list,
so it does not change the deploy target's broken state. A2's "both facets
must land or the link still 404s" is the correct framing. This is the
headline: **no invited KBC user can activate an account or reset a
password.** It escaped all five prior (2026-05-30) audits because the seam
is a backend-string ↔ FE-route join that no test exercises.

**C2 — Admin "Coming in v1.x" placeholders visible in the pilot UI
(worth-knowing).** *A1 #5 + A2 F6; reviewer-verified.* Convergent on two
sites; reviewer takes the **union** of all cited sites:
- `cost-dashboard.tsx:88` (disabled toggle `title="Coming in v1.x"`) and
  `:276–277` (placeholder chart that prints the internal `daily_history`
  field name) — both auditors.
- `users-list.tsx:150` disabled "Bulk invite" tooltip "Coming in v1.x" —
  both auditors.
- `path-editor.tsx:394` "Assignment summary coming in v1.x." — A1 only.
- `TopBar.tsx:127` no-op search stub (`// TODO(v1.x): wire search palette`)
  — A2 only.
All verified rendered. Mirrors the testee-FE sweep (PR-088…092) that
deliberately left the admin surface untouched (PR-092 handover "Open
questions"). Severity agreement (A1 worth-knowing ≈ A2 Low). The
`daily_history` field-name leak is the one item here with a mild
"unfinished/internal" smell worth a same-day reword.

### VERIFIED (single auditor, reviewer verified the code)

**V1 — Error/404/403 recovery routes the admin into an inescapable loop
(Serious).** *A1 #2.* `error.tsx:54` `router.push("/")`, `not-found.tsx:22`
`href="/"`, `403/page.tsx:54` `href="/"`. `/` is testee-gated
(`(testee)/layout.tsx`); an admin bounces `/` → `/403` → "Go to dashboard"
→ `/` → `/403`. The role-aware helper already exists:
`dashboardPathFor(role)` returns `/ops` for admins
(`frontend/src/lib/auth/guards.tsx:41`). Cheap fix (role-aware CTA). Real,
but triggers only on the error/404/403 surfaces and the browser back button
still works — serious polish/escape-hatch bug, not a core-flow blocker.

**V2 — Internal anchor IDs leak into production UI (Serious).** *A1 #3.*
Verified as **rendered JSX text** (not comments/aria) at: `JITQueue.tsx:78`
(`<span>Queue · AC-D25</span>` — shown while taking a per-Testee test),
`loop-step-row.tsx:74` (`<p>Stepped difficulty down · AC-D6 third-iteration
rule</p>` — result page), `SafetyPosterCard.tsx:22`, `SafetyEmpty.tsx:16`,
`SafetyLinks.tsx:28` (all `Curated/Safety … · AC-D21`, pill detail), and
`grade-review-queue.tsx:105` (`Cross-family review · AC-D19 · batched per
attempt · 60s ceiling`, admin). A1 correctly cited only the rendered sites
(those files also contain AC-D mentions in comments, which A1 excluded).
Trivial fix (strip the `· AC-Dxx` suffix); high-traffic surfaces; breaks the
"finished software" impression.

**V3 — Privacy gate shows non-legal-reviewed placeholder copy (Launch
gate).** *A1 #4.* `privacy/page.tsx:42` `// TODO(AC-D16): placeholder copy,
needs legal review before production`; the file's own header (`:24–25`) says
the copy "must clear legal review before any external user sees it." The
gate plumbing is independent of the copy, so this is **not a code fix** — it
is an **operator/legal launch gate**: real people click "I acknowledge" on a
binding consent. Correctly surfaced rather than buried in a TODO.

**V4 — Testee result page silently blanks on fetch error (High).** *A2 F2.*
`result/page.tsx:47–62` runs the result `useQuery` with **no
`throwOnError`**; `lib/query-client.ts:17–21` sets `retry:false`,
`staleTime:30_000`, no `throwOnError`. On error the query neither retries nor
throws → `isPending` false + `result` undefined → the render ternary
(`:110–114`) falls to `null` (header + blank body), and the Pattern-C
boundary `result/error.tsx` is **dead code**. Sibling `history`/`profile`
rethrow into their boundaries; result is the lone deviation. **This is
prior-cycle audit-4 S7-F1, triaged QUEUE on 2026-05-30 and never fixed** —
re-confirmed live. The climax surface of the whole testee flow.

**V5 — GradingOverlay spins "Working through your responses…" forever on a
result-poll error (High).** *A2 F3.* `GradingOverlay.tsx:111–121` advances
`pollCount` only inside a `useEffect` keyed on `resultQuery.dataUpdatedAt`,
guarded `if (dataUpdatedAt === 0) return`. `dataUpdatedAt` only moves on a
**successful** fetch, so on persistent error it stays `0`, `pollExhausted`
never flips, and `refetchInterval` (`:101–107`) keeps polling — unbounded
spinner, no error, no escape. The slow-grading cap exists but is unreachable
on the error path. **Prior-cycle audit-4 S7-F2, QUEUE, never fixed.** V4 + V5
together: the entire post-submit experience degrades to "blank or infinite
spinner" the moment the result endpoint hiccups.

**V6 — Learning-path assignments unstartable; pill names degrade to hex
(Medium).** *A2 F4.* `AssignmentsCard.tsx` `targetName()` returns the bare
label `"Learning path"` (no name) and `Row` sets `href = null` when
`pill_id` is null → no Start affordance for a path assignment. Pill names
resolve from a **first-page-only** `useCataloguePills` map, falling back to
`Pill {id.slice(0,8)}…` for any assigned pill not on page 1. Verified. Matches
PR-092's own carry-forward backlog #1 + Tier-B item — but from a pilot-user
lens these are live, visible defects on the primary testee landing surface,
so they belong in a production-readiness ledger.

**V7 — Engagement escalation counted/audited as "sent" while no email goes
out (Medium).** *A2 F5.* In `app/domain/engagement.py` (verified ~`:472–493`)
only `smtp.send(...)` is guarded by `if assigner is not None:`; the
`AssignmentReminder(kind=escalation)` insert, `assignment.escalation_sent_at
= now`, `summary["escalations_sent"] += 1`, and the `assignment.escalate`
audit are all **outside** the guard. When the assigner is missing/deactivated
the escalation is logged + audited + counted while no notification is sent,
and setting `escalation_sent_at` permanently suppresses future escalations
for that assignment. **Prior-cycle audit-4 S2-M1, QUEUE, never fixed.**

**V8 — Admin group detail: 3/4 stats bare "—" with no "deferred" cue
(Worth-knowing).** *A1 #6.* `group-detail.tsx:159–161` renders three
`<StatCard value="—" deferred />`; the `deferred` flag only sets a
`data-testid` (`:304`) — no muted style, caption, or tooltip — so the grid
reads as a data-load failure, not "not yet tracked."

**V9 — Disabled "Contact support" contradicts the 500 page's own copy
(Worth-knowing).** *A1 #7.* `error.tsx:50` body copy "…contact support if it
persists" vs `:58–59` a permanently `disabled` "Contact support" button
(`// TODO(v1.x): wire real support channel`). Verified.

**V10 — Rail active-nav lost on every deep route (Worth-knowing).** *A1 #8.*
`Rail.tsx:127` `const active = activeRoute === item.href` (exact equality).
Nested destinations (`/admin/tests/<id>/edit`, group detail,
`/attempts/<id>/result`, …) highlight nothing. Verified. Fix: prefix match
for non-root items, exact for `/`.

### WORTH-KNOWING (real, does not gate the redeploy)

- **Auth/privacy pages bypass the theme system** (A1 OOS-1). `(auth)` group +
  `/privacy` use hardcoded `gray-*` Tailwind utilities instead of theme
  tokens; a returning user who picked `carbon` (dark) sees light-gray auth
  cards on a token-driven background. New invited users (default `paper`) are
  unaffected → small blast radius, cosmetic. Reviewer concurs with A1's
  out-of-scope grading. (Cross-reference: this is the same token-discipline
  AC-CD23 prohibits; worth a sweep but not a gate.)
- **Token-lifetime UI copy** (A2 context; prior audit-3 L1-F4) — not
  re-traced this round; pairs naturally with the C1 email work.

### DISPUTED / REJECTED

None. The two auditors do not contradict each other on any finding, and
every finding reproduced against `5f0f184`. Where both touched the same
site (C1, C2) their accounts are consistent and complementary.

---

## 4. Cross-cutting reviewer observations

1. **The headline blocker (C1) escaped all five 2026-05-30 audits** and both
   independent auditors caught it this cycle on the same seam — strong signal
   the convergence is real, not coincidental. The seam (backend link-string ↔
   FE route table ↔ host config) has no test on either side.
2. **Three of A2's findings (V4/V5/V7 = audit-4 S7-F1, S7-F2, S2-M1) are
   prior-cycle QUEUE items that were never fixed.** The pre-deploy fix
   workstream (PR-073…079) shipped exactly the 5 fix-now items + the WS4
   pre-deploy doc subset; the queued silent-failure tier was deferred to the
   post-deploy WS1–WS4 track, which has not started. So these are not new
   regressions — they are **known-but-unfixed** debt now re-surfacing under a
   pilot-user lens. This reframes them: the question for the operator is
   whether the queued audit-4 silent-failure tier should be pulled forward
   into the pre-deploy patch set given V4/V5 sit on the testee result climax.
3. **Severity lens differs slightly but does not conflict.** A1 graded the
   routing/anchor/privacy surface "Serious"; A2 graded the result-flow silent
   failures "High." Both gradings are defensible; the reviewer's tiering in §6
   reconciles them on a single pre/post-deploy axis.

---

## 5. Coordination notes

- **Both auditors independently flagged the absent
  `counterpart-change-detector` skill** (`.claude/skills/…` does not exist in
  this checkout — only `agents/` + `commands/`). The reviewer confirms the
  same and is running an equivalent watcher manually (targeted `git ls-remote`
  poll on the auditor branch SHA + `pull_request_read` comment/review pairing
  on each wake, self-echo filtered). This is a **coordination-mechanism gap,
  not a product finding** — surfaced to the spec author for disposition; it
  does not gate the redeploy.
- **Coverage question for Round 2 (not a finding):** neither Round-1 file
  traced (a) the live SSE attempt-stream consumption end-to-end against the
  AC-CD22 fetch-streaming adapter / `Last-Event-ID` resume contract, nor (b)
  the cost/budget-alert email path (AC-D18 thresholds → SMTP). If either is in
  scope for this cycle, a Round-2 pass would close the map; if both auditors
  judge them out of scope or adequately covered by the prior cycle, say so and
  the reviewer will record the boundary. Posed as a question per the
  reviewer's no-original-discovery rule.

---

## 6. Provisional tier read (NOT final — pending convergence)

> Firm tiering, the fix-workstream grouping, and the carry-forward backlog
> are produced in the final synthesis after both "no further findings"
> markers. The split below is the reviewer's current read for discussion.

**Pre-deploy (blocks the next redeploy):**
- **C1** email-link blocker (both facets) — hard blocker; nothing else
  matters if users can't log in.
- **V3** privacy copy — operator/legal launch gate (not code).
- **V4 + V5** testee result blank / infinite spinner — High; the post-submit
  climax surface fails on any backend hiccup. Strong candidates to pull
  forward from the deferred audit-4 QUEUE tier.
- **V2** anchor-ID leak and **V1** admin recovery loop — trivial/cheap,
  high embarrassment, recommend bundling into the pre-deploy patch.

**Post-deploy / next maintenance window:**
- **V6** dashboard path assignments + hex pill names (needs the `pill_name` /
  `learning_path_name` backend fields — already PR-092 Tier-B).
- **V7** engagement escalation false-sent (backend correctness; pairs with the
  WS2 transactional-audit work).
- **C2 / V8 / V9 / V10** admin placeholders, group-detail dashes,
  contact-support, rail active-nav — worth-knowing polish; batch into a UI
  hygiene pass.
- Theme-token sweep on auth/privacy pages (OOS).

---

# Round 2 — adjudication (both auditors filed)

A2 filed a Round-2 follow-up (`auditor2.md` @ `9c28cba`) answering the
reviewer's Round-1 coverage question; A1 filed a Round-2 follow-up
(`auditor1.md` @ `1dc260b`) driving the one in-scope surface neither Round-1
file traced (mobile responsiveness) plus a concurrence on the coverage
question. Both verified against `5f0f184`. Notably, **the auditors
cross-concur**: A1 independently reviewed and endorsed A2-R2-F7 and A2's two
coverage negatives, and both partitioned Round 2 cleanly (A2 → dynamic-flow
surfaces, A1 → mobile) with no overlap and no dispute.

### VERIFIED (A2 Round 2)

**V11 — Streaming attempt dies unrecoverably on mid-stream access-token
expiry; the documented refresh mitigation is a no-op (Medium).** *A2-R2-F7.*
The per-Testee SSE runner attaches the bearer token at fetch time from
`getAccessToken()` (`storage.ts:21`), which is a **plain in-memory getter —
it never refreshes**. The access TTL is **900 s** (`config.py:49`
`jwt_access_ttl_seconds`). On (re)connect a `401` from an expired token hits
`if (!response.ok)` and **throws** `apiErrorFromBody(...)` straight to the
consumer (`sse.ts:318/325`) — only `fetch` *rejections* (network errors) get
the one-reconnect budget (`:309–316`), not HTTP-401. So the adapter docstring
(`sse.ts:54–57`) — *"the next reconnect picks up the fresh token via
getAccessToken()"* — is **false**: the SSE adapter refreshes nothing, and a
401 ends the stream. **Trigger:** idle think-time >15 min on one question, or
any reconnect after the token has expired (active answering refreshes the
token incidentally via autosave through `client.ts`, so it's an edge trigger,
not the common path). **Impact:** no data loss (answers autosave), but the
remaining-question generation dies and the testee must re-auth mid-assessment
— on the headline P10 streaming surface, with an in-code comment that asserts
it's handled (so it ships assumed-safe). Reviewer concurs with A2's **Medium**
grading; tiered **post-deploy** (degraded recovery on an edge trigger, not a
launch blocker) — but flagged as the one item that touches the core
adaptive-assessment flow, so it should not sit at the bottom of the queue.

### Coverage notes — reviewer's Round-1 question RESOLVED

A2 traced both surfaces the reviewer flagged as uncovered; reviewer
independently confirmed both negatives against `5f0f184`:

- **Cost/budget-alert email path (AC-D18) — sound, no finding.**
  `maybe_fire_budget_alert` (`app/ai/cost.py`) resolves the recipient as the
  first **active** admin with a loud `logger.warning` + no-send + `return []`
  when none exists (`:505–511`); `record_audit` runs **after** `smtp.send`
  per-threshold (`:523–537`), so an SMTP failure leaves no audit row and the
  next sweep retries — self-healing. The only residual is the **already-queued
  audit-4 S3-M** top-level `try/except` swallow (`:442–447`), not a new
  finding. Confirmed.
- **SSE resume / `Last-Event-ID` (AC-CD22) — contract honored, no finding.**
  The adapter sets `Last-Event-ID` (highest received id) on auto-reconnect and
  `?since=`/`Last-Event-ID` for consumer resume (`sse.ts:294–300`), and
  de-dups arrived positions via an `arrivedSet` keyed on `attempt_position`
  (`:278`, `:238–245`) — replay does not regenerate or reorder. Confirmed.
  **Note the boundary:** the resume *replay* path is sound; the resume *auth*
  path is exactly where V11 bites — same surface, orthogonal defect.

The reviewer's coverage question is now closed: both surfaces traced, one new
finding (V11), the rest sound.

### VERIFIED (A1 Round 2)

**V12 — Admin data tables overflow on mobile; the responsive-table wrapper was
applied to testee surfaces only (Worth-knowing).** *A1-R2-F9.* PR #82 made the
*shell* responsive (hamburger drawer, collapsing breadcrumbs) but the *content*
tables were not given the same treatment. Verified the asymmetry: testee tables
wrap in `overflow-x-auto` (`profile/history-table.tsx:54`,
`profile/matrix-table.tsx:78`); admin tables are bare `<table class="mt-5
w-full …">` with **no** overflow wrapper — confirmed at `users-list.tsx:276`,
`tests-table.tsx:247`, `assignments-list.tsx:242`, `pending-list.tsx:139`
(`overflow-x-auto` count = 0 in each), and A1 enumerates the rest (paths, loop,
calibration, cost, the four catalogue tabs, groups). The admin shell renders
content in `<main … w-full mx-auto>` inside a `min-w-0` grid column
(`(admin)/layout.tsx:44–46`) with no page-level overflow guard, so a table wider
than the viewport pushes the page into horizontal scroll rather than scrolling
within its card. A1's confidence note is fair — the missing-wrapper asymmetry is
structurally certain; the exact overflow pixel is content/device-dependent and
not headlessly renderable here. Reviewer concurs with **worth-knowing**; it is
the admin-side mirror of C2's "the testee sweep didn't reach admin" theme and
batches into the same post-deploy UI-hygiene pass.

---

## 7. Status

**Round 1 + both Round 2 follow-ups adjudicated.** Running tally: **14 graded
findings — 2 CONFIRMED · 12 VERIFIED · 0 DISPUTED · 0 REJECTED**, plus 2
worth-knowing OOS items and 1 coordination gap. Coverage question resolved
(A2-R2). Auditors cross-concur on Round-2 findings; no disputes anywhere in the
cycle.

**Convergence state:** both auditors have filed Round 2 (A2 → V11; A1 → V12),
each with exactly one new finding, and **both are holding their "no further
findings" markers pending this Round-2 adjudication** — which is now posted, so
both are clear to mark. The final synthesis (fix workstream, firm pre/post-deploy
tier split, carry-forward backlog) is written below this line the moment **both**
markers land. Reviewer watcher armed on `claude/practical-cannon-QKdwy`; PR #93
subscription live.

*Reviewer — Round 1 + both Round 2 complete. Final synthesis appended below this
line once both auditors signal no-further-findings.*

---

# FINAL SYNTHESIS (cycle converged)

Both auditors posted their "no further findings" markers — A2 @ `1519b25`,
A1 @ `d9b8702`. No further rounds. This section is the durable keystone:
final ledger, fix-workstream grouping, pre/post-deploy tier split, and the
carry-forward backlog. **Read-only cycle — no product code was modified by any
of the three sessions. The reviewer does not open the fix workstream or merge
PR #93; the spec author authorizes the next step.**

## F.1 Final ledger — 14 graded findings

| ID | Finding | Auditor(s) | Class | Severity | Tier |
|---|---|---|---|---|---|
| **C1** | Setup/reset email links 404 (path shape + API-vs-frontend host) | A1 #1 · A2 F1 | CONFIRMED | **Blocker** | **Pre-deploy** |
| C2 | Admin "Coming in v1.x" placeholders (incl. `daily_history` leak) | A1 #5 · A2 F6 | CONFIRMED | Worth-knowing | Post-deploy |
| V1 | Error/404/403 "Go to dashboard" → admin inescapable loop | A1 #2 | VERIFIED | Serious | **Pre-deploy** |
| V2 | Internal anchor IDs (`AC-D6/19/21/25`) rendered in UI | A1 #3 | VERIFIED | Serious | **Pre-deploy** |
| V3 | Privacy gate shows non-legal-reviewed placeholder copy | A1 #4 | VERIFIED | Launch gate | **Pre-deploy (operator/legal)** |
| V4 | Testee result page silently blanks on fetch error (dead boundary) | A2 F2 | VERIFIED | High | **Pre-deploy** |
| V5 | GradingOverlay spins forever on result-poll error | A2 F3 | VERIFIED | High | **Pre-deploy** |
| V6 | Learning-path assignments unstartable; pill names → hex IDs | A2 F4 | VERIFIED | Medium | Post-deploy |
| V7 | Engagement escalation counted/audited "sent" while no email sent | A2 F5 | VERIFIED | Medium | Post-deploy |
| V8 | Admin group detail: 3/4 stats bare "—", no deferred cue | A1 #6 | VERIFIED | Worth-knowing | Post-deploy |
| V9 | Disabled "Contact support" contradicts 500-page copy | A1 #7 | VERIFIED | Worth-knowing | Post-deploy |
| V10 | Rail active-nav lost on deep routes (exact-equality) | A1 #8 | VERIFIED | Worth-knowing | Post-deploy |
| V11 | SSE stream dies on mid-stream token expiry (refresh comment is a no-op) | A2 R2-F7 | VERIFIED | Medium | Post-deploy |
| V12 | Admin data tables overflow on mobile (no `overflow-x-auto` wrapper) | A1 R2-F9 | VERIFIED | Worth-knowing | Post-deploy |

**Tally: 2 CONFIRMED · 12 VERIFIED · 0 DISPUTED · 0 REJECTED.** Plus 2
worth-knowing out-of-scope items (OOS-1 auth/privacy theme-token bypass;
audit-3 L1-F4 token-lifetime UI copy, not re-traced) and 1 coordination gap
(the absent `counterpart-change-detector` skill — independently flagged by all
three sessions).

**Cycle integrity signals:** zero disputes and zero rejections across two
rounds and three sessions; the headline blocker (C1) was caught independently
by both auditors on a seam that escaped all five 2026-05-30 audits; the
auditors cross-concurred on each other's Round-2 findings; and three findings
(V4/V5/V7) are prior-cycle audit-4 QUEUE items (S7-F1/S7-F2/S2-M1) re-surfacing
because the pre-deploy fix workstream (PR-073…079) shipped only the 5 fix-now
items and deferred the silent-failure tier.

## F.2 Fix-workstream proposal

Six coherent workstreams (mirrors the audit-5 synthesis shape: cluster the
findings, don't fix them one-off). **Proposals — the spec author triages and
authorizes.**

- **WS-A · Auth activation path (the blocker). [Pre-deploy]** — *Closes C1.*
  Emit path-segment links (`…/setup/{token}`, `…/reset/{token}`) **and**
  introduce a dedicated frontend-origin setting (e.g. `APP_FRONTEND_URL`) used
  only for user-facing email links, distinct from the API `app_public_url`;
  fail-closed in prod if unset (same spirit as the existing secret/CORS boot
  guards); add a regression test asserting the emitted `{host}{path}` resolves
  to the `/setup/[token]` route. **Note:** the open PR #83 fixes **only Facet A**
  (path) and is stale-based — supersede/extend it; both facets must land or the
  link still 404s. *Effort: small-medium.*
- **WS-B · Testee result-flow silent failures. [Pre-deploy]** — *Closes V4, V5.*
  Add `throwOnError: true` to the result `useQuery` (activates the already-correct
  `result/error.tsx` boundary); advance the GradingOverlay poll cap on
  `isError`/`errorUpdatedAt`, not only `dataUpdatedAt`. Both are small targeted FE
  patches on the post-submit climax surface. *Effort: small.*
- **WS-C · UI honesty + polish sweep. [Split]** — *Closes C2, V1, V2, V8, V9,
  V10, V12, OOS-1.* **Pre-deploy subset:** V1 (role-aware recovery CTA via the
  existing `dashboardPathFor`) and V2 (strip `· AC-Dxx` from rendered strings) —
  both trivial and high-embarrassment. **Post-deploy remainder:** C2 (remove/reword
  admin placeholders + the `daily_history` leak), V8 (visible deferred cue), V9
  (wire or remove contact-support), V10 (prefix-match active-nav), V12 (hoist an
  `overflow-x-auto` wrapper into the shared table primitive), OOS-1 (theme-token
  sweep on auth/privacy pages). *Effort: trivial-small each; batch the
  post-deploy items.*
- **WS-D · Engagement + cost backend correctness. [Post-deploy]** — *Closes V7
  (+ the queued audit-4 S3-M).* Only mark/count/audit the escalation as sent when
  the email actually goes out; if `assigner is None`, log + leave
  `escalation_sent_at` unset (or audit a distinct `escalate_skipped`) so a later
  sweep retries. Pairs naturally with the prior-cycle WS2 transactional-audit work
  and the S3-M cost try/except. *Effort: small.*
- **WS-E · Streaming auth resilience. [Post-deploy]** — *Closes V11.* Route the
  SSE (re)connect through the same refresh coordinator / `ensureFreshToken()` the
  api client uses; on a `401`, refresh-once-and-retry rather than throwing; correct
  the `sse.ts:54-57` comment. Touches the core P10 streaming flow, so it should not
  sit at the bottom of the post-deploy queue. *Effort: small-medium.*
- **WS-F · Dashboard-assignment contract. [Post-deploy]** — *Closes V6.* Add
  `pill_name` + `learning_path_name` to `GET /v1/me/assignments` (already PR-092
  Tier-B) and give path-assignment rows a Start target. Backend + FE. *Effort:
  small-medium.*

**V3 is not a workstream** — it is an operator/legal launch gate: the privacy
copy must clear KBC legal sign-off before the pilot. The gate plumbing is
copy-independent, so the swap is low-risk once approved.

## F.3 Pre-deploy vs post-deploy tier split

**Pre-deploy — blocks the next redeploy (the pilot cannot launch credibly
without these):**
1. **C1** — email activation blocker (WS-A). Nothing else matters if invited
   users can't log in. **Hard blocker.**
2. **V3** — privacy copy legal sign-off (operator/legal, non-code gate).
3. **V4 + V5** — result-flow silent failures (WS-B). The post-submit climax
   surface fails blank / infinite-spinner on any backend hiccup; pulled forward
   from the deferred audit-4 QUEUE tier on the pilot-user lens.
4. **V1 + V2** — admin recovery loop + anchor-ID leak (WS-C pre-deploy subset).
   Trivial fixes, disproportionate embarrassment; bundle with the above.

**Post-deploy — next maintenance window (real, but the pilot survives them):**
- WS-C remainder (C2, V8, V9, V10, V12, OOS-1) — UI-hygiene batch.
- WS-D (V7 + cost S3-M) — engagement/cost correctness.
- WS-E (V11) — streaming auth resilience (prioritize within post-deploy; core flow).
- WS-F (V6) — dashboard-assignment backend contract.
- audit-3 L1-F4 token-lifetime UI copy — fold into WS-A.

## F.4 Carry-forward backlog (parked — not in this cycle's scope)

- **The prior-cycle (audit-5) post-deploy workstreams WS1–WS4 remain
  unstarted:** WS1 typed wire contracts + seam tests, WS2 transactional
  CRUD+audit+validation service, WS3 real-DB integration tier, WS4 remainder
  (competence/cost N+1 batch-loads, admin-`Field` a11y labels, aria-live). This
  cycle's V7 lands naturally with WS2; V4/V5/V11 type-safety with WS1/WS3.
- **DEC-S3-C** (PR-092) — `meQueryKeys.attempts()` never invalidated on submit;
  capped/infinite attempts list stale ≤30s after submit.
- **Catalogue per-card competence overlay** (PR-092 carry-forward #1) — endpoint
  live, `PillCard` per-Testee overlay still unwired.
- **Coordination gap** — the `counterpart-change-detector` skill is absent from
  the checkout; all three sessions ran the watcher manually. For the spec author
  to decide whether to add the skill or formalize the manual protocol.

## F.5 Disposition handoff

This synthesis is sealed and read-only. Recommended next step (spec author's
call): **open a fix workstream on a fresh branch against this synthesis**,
starting with the pre-deploy tier (WS-A → WS-B → WS-C pre-deploy subset, with V3
routed to legal in parallel). PR #93 (the audit artifact) is **not** merged by
the reviewer; the auditor files + this synthesis are the durable record.

**Status: final — audit converged.**

*Reviewer — production-readiness audit cycle 2026-06-02 complete. 14 findings
adjudicated (2 confirmed · 12 verified · 0 disputed · 0 rejected), 0 disputes
across the cycle, both auditors signalled no-further-findings. Sealed
`8d38074`-base + this commit.*
