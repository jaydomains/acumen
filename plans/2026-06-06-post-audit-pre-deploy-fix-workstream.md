# Post-audit pre-deploy fix workstream — plan

**Date:** 2026-06-06
**Branch:** `claude/clever-newton-BdxuT`
**Authoritative source:** `audits/2026-06-02-prod-readiness-synthesis.md`
§"FINAL SYNTHESIS" (F.1 ledger, F.2 workstreams, F.3 tier split), grounded
against the two auditor files (`…-auditor1.md`, `…-auditor2.md`).
**Verification baseline:** working tree at HEAD `fd7f267` (PR #93 merged to
`main`). Every `file:line` below was read directly against this tree, not a
proxy. Where current code differs from or extends the synthesis text, it is
flagged in §2.
**Status:** draft — awaiting auditor review. (See the two final-marker lines
appended at convergence. Draft→ready PR flip is the overseer's call, not the
planner's.)

> **What this package is.** The execution of this plan is the production
> redeploy gate for the KBC pilot. Scope is the audit's **pre-deploy code
> tier**: the C1 activation blocker (WS-A), the V4/V5 testee result-flow
> silent failures (WS-B), and the V1/V2 pre-deploy subset of WS-C. **V3**
> (privacy-copy legal sign-off) is an operator/legal launch gate handled
> offline by the spec author and is **out of this workstream**. All
> post-deploy tier items (C2, V6–V12, OOS-1) and all audit-5 carry-forward
> workstreams (WS1–WS4) are **out of scope** (synthesis F.3, F.4).

---

## 1. Scope lock (from the synthesis — not re-litigated)

Closes exactly the five pre-deploy **code** findings (synthesis F.3):

| ID | Finding | Workstream | Tier |
|---|---|---|---|
| **C1** | Setup/reset email links 404 (path shape **+** API-vs-frontend host) | **WS-A** | Pre-deploy — **hard blocker** |
| **V4** | Testee result page silently blanks on fetch error (dead boundary) | **WS-B** | Pre-deploy (High) |
| **V5** | GradingOverlay spins forever on result-poll error | **WS-B** | Pre-deploy (High) |
| **V1** | Error/404/403 "Go to dashboard" → admin inescapable loop | **WS-C subset** | Pre-deploy (Serious) |
| **V2** | Internal anchor IDs (`AC-D6/19/21/25`) rendered in UI | **WS-C subset** | Pre-deploy (Serious) |

**Explicitly out of scope** (named for the boundary, do not absorb):
- **V3** — privacy-copy legal sign-off (operator/legal, offline; not code).
- **C2, V8, V9, V10, V12, OOS-1** — WS-C post-deploy remainder (UI hygiene).
- **V6** (WS-F dashboard contract), **V7** (WS-D engagement/cost), **V11**
  (WS-E streaming auth) — all post-deploy.
- **audit-5 WS1–WS4**, DEC-S3-C, catalogue overlay, the absent
  `counterpart-change-detector` skill — carry-forward (synthesis F.4).

---

## 2. Grounding notes (verified read-only against `fd7f267`)

Each finding was re-verified against current code. Five items are **larger,
narrower, or different** than a naïve read of the synthesis — surfaced here
because "a plan unverified against the codebase is just a story."

### G1 — C1's fail-closed boot infra **already exists** (narrows WS-A Facet B)
The 2026-05-31 pre-deploy workstream (Slice 2, PR-074) already shipped the
exact boot-guard scaffold WS-A Facet B needs:
- `app/config.py:146` `check_startup_config(settings) -> (warnings, errors)`,
  reading **only** `Settings` (no `app.ai`/`app.domain` import — structure-gate
  safe per AC-CD2).
- `app/config.py:123` `DEV_ENVS = {"development","dev","local","test"}`;
  `:135` `_cors_is_insecure(...)`; `:178` the non-dev fail-closed block that
  **appends to the returned `errors` list** on `change-me` secrets /
  wildcard|localhost CORS.
- `app/main.py:42` `run_startup_checks(...)` called from the `:70` FastAPI
  lifespan — logs warnings and **raises** `RuntimeError` when the `errors`
  list is non-empty (`main.py:57-63`). **Note the two-layer contract (auditor
  F6):** `check_startup_config` never raises — it returns `(warnings,
  errors)`; the raise lives one layer up. Any C1 fail-closed clause must
  *append to `errors`*, not raise, or it breaks the structure-gate-safe
  return contract.

**Consequence:** WS-A Facet B is **not new infrastructure** — it is one new
`Settings` field plus one new fail-closed clause inside the existing
`check_startup_config`. This is materially smaller than the synthesis WS-A
text ("introduce a dedicated frontend-origin setting … fail-closed in prod if
unset") implies. The pattern to mirror is the existing `_cors_is_insecure`
clause verbatim.

### G2 — C1 Facet A + B confirmed exactly as audited
- **Facet A (path shape):** `app/permissions.py:266`
  `link = f"{get_settings().app_public_url}/setup?token={raw_token}"` and
  `:275` `…/reset?token={raw_token}` — query-string. The only FE routes are
  path-segment dynamic routes: `frontend/src/app/(auth)/setup/[token]/page.tsx`
  reads `params: Promise<{ token: string }>` (`:34–41`) and `reset/[token]/`.
  `ls frontend/src/app/(auth)/` confirms **no** `/setup` or `/reset` index page
  and no middleware/rewrite → `/setup?token=…` 404s. Verified.
- **Facet B (host):** `app/config.py:30` `app_public_url = "http://localhost:8000"`
  (the **API** origin); `app/main.py:111` hands the same value to API consumers
  as `api_base_url`. `docs/DEPLOYMENT.md:47` documents `APP_PUBLIC_URL` as the
  externally-visible **API** URL; the frontend origin lives separately in
  `CORS_ALLOWED_ORIGINS` (`config.py:93` default `http://localhost:3000`;
  `.env.example:87`). There is **no** config knob holding the frontend origin
  for link-building. Verified. Both facets must land or the link still 404s.

### G3 — PR #83 is a stale, Facet-A-only partial (gates Decision D1)
`gh`/MCP read of PR #83 (`fix/auth-email-token-links`, head `6193e78`):
**open, NOT draft**, **base `072725b`** (far behind the current `main`
`fd7f267`), **1 file changed, +2/−2** — it rewrites only the two
`permissions.py` link strings to path-segment shape (**Facet A only**), with
**no** frontend-origin setting (Facet B), **no** boot-guard wiring, and **no**
regression test. Rebasing it forward buys ~2 lines that WS-A Slice 1 rewrites
anyway. See **Decision D1**.

### G4 — V4 + V5 confirmed; the test harness cannot natively exercise the fix
- **V4:** `result/page.tsx:47–62` runs the result `useQuery` with **no**
  `throwOnError`; `lib/query-client.ts` sets `retry:false, staleTime:30_000`,
  no `throwOnError`. On error `isPending` is false and `result` is `undefined`,
  so the render ternaries fall to `null`/empty (`:109–113` hero, `:120`, `:142`
  question/loop slots) — header + blank body. The Pattern-C boundary
  `result/error.tsx` exists, is correct, and is **dead** (the query never
  throws). Verified.
- **V5:** `GradingOverlay.tsx:111–121` advances `pollCount` only inside a
  `useEffect` keyed on `resultQuery.dataUpdatedAt`, guarded `if (… === 0)
  return`. `dataUpdatedAt` only moves on a **successful** fetch, so on
  persistent error it stays `0`, `pollExhausted` never flips, and
  `refetchInterval` (`:101–105`, `POLL_INTERVAL_MS=1500`,
  `POLL_MAX_ATTEMPTS=30`) keeps polling — unbounded spinner. Verified.
- **Test-harness caveat (drives Decision D4):** the existing
  `frontend/tests/pages/result-page.test.tsx` mounts `<ResultPage/>` **directly**
  inside a bare `QueryClientProvider` (`:46–58`) — it does **not** run through
  the Next.js App-Router segment tree, so a Next.js `error.tsx` boundary is
  **not** natively rendered in this harness. Asserting "the boundary now fires"
  therefore needs an explicit strategy (D4), not just `throwOnError: true`.
  `frontend/tests/components/attempt/GradingOverlay.test.tsx` already exists and
  drives MSW + fake timers, so V5 is straightforwardly testable there.

### G5 — V1 fix surface: one un-exported helper, one server component
- `frontend/src/app/error.tsx:54` `router.push("/")` (**client** — `"use
  client"` at `:1`), `frontend/src/app/403/page.tsx:54` `href="/"` (**client**),
  `frontend/src/app/not-found.tsx:23` `<Link href="/">` (**server component** —
  no `"use client"`). `/` is testee-gated.
- The role-aware helper `dashboardPathFor(role)` returns `/ops` for admins, but
  it is a **module-local `const` at `guards.tsx:40` — NOT exported** (used only
  internally at `:86`/`:100`). The fix must **export** it (or lift it to a
  shared `lib/auth/role.ts`-adjacent location).
- `AuthProvider` is mounted in the **root** `layout.tsx:50`, and Next.js
  `app/error.tsx` / `app/403/page.tsx` render **inside** the root layout, so
  both client surfaces **can** read `useAuth().role`. `not-found.tsx` is a
  server component and **cannot** use the hook — its CTA must be extracted into
  a tiny client component (or a role-detecting redirect), per A1's own note
  (`auditor1.md:98–103`).

### G6 — V2 has a **seventh** rendered anchor site beyond A1's six (extends V2)
A1 cited six rendered-JSX sites (all verified):
`JITQueue.tsx:78` (`Queue · AC-D25`), `loop-step-row.tsx:74`
(`Stepped difficulty down · AC-D6 third-iteration rule`),
`SafetyPosterCard.tsx:22` (`Safety pill · AC-D21`), `SafetyEmpty.tsx:16`
(`Curated industry sources · AC-D21`), `SafetyLinks.tsx:28`
(`Curated industry sources · AC-D21`), and
`grade-review-queue.tsx:105` (`Cross-family review · AC-D19 · batched per
attempt · 60s ceiling`). **But `SafetyEmpty.tsx:26` also renders
`Per AC-D21 · Acumen never generates safety teaching content` as visible body
text** — a seventh leak A1 did not enumerate. Unlike the decorative `·
AC-Dxx` suffixes, this one is a substantive safety-policy sentence with the
anchor woven in.

**G6.1 — the Safety* anchor strings are spec-verbatim AND test-asserted
(auditor Round-1 F1; re-verified).** The original G6 read the render sites but
not the spec/test lock — a grounding gap. Re-verified:
- `fe-specs/FE-3-content.md:347` locks the SafetyEmpty footer **verbatim**
  ("Footer copy verbatim: *Per AC-D21 · Acumen never generates safety teaching
  content*") and the §B.4.6 Gherkin at `:489` repeats it as an acceptance
  criterion; `:462` describes the SafetyLinks header as rendering
  `"Curated industry sources · AC-D21"`. `SafetyEmpty.tsx:6-8` self-documents
  the footer as "VERBATIM per spec".
- Three existing assertions lock the strings:
  `tests/components/pill-detail/SafetyLinks.test.tsx:26`
  (`/Curated industry sources · AC-D21/i`), `:48` (exact footer string), and
  `tests/pages/pill-detail.test.tsx:224` (same footer). Stripping these and
  adding Slice 4's "no `AC-D` in rendered text" guard **cannot both pass** —
  the old assertions must be rewritten, downstream of a spec amendment.
- **Two-group split (verified):** the spec/test coupling is confined to the
  three **Safety\*** strings — `SafetyEmpty.tsx:16` & `SafetyLinks.tsx:28`
  (eyebrow, FE-3:462) and `SafetyEmpty.tsx:26` (footer, FE-3:347/489). The
  other four — `JITQueue.tsx:78`, `grade-review-queue.tsx:105`,
  `loop-step-row.tsx:74` (test `adaptive-loop-card.test.tsx:107` asserts only
  the partial `/Stepped difficulty down/`), and **`SafetyPosterCard.tsx:22`**
  (`Safety pill · AC-D21` — FE-3:344 describes the card but does **not** quote
  this eyebrow verbatim, and no test asserts it) — are **test-safe** to strip.

Consequence: the Safety* group is a **spec-drift** fix (FE-3 amendment first),
not a free copy tweak. See the rewritten **Decision D3** and Slice 4.

---

## 3. Decisions needed (spec-author ruling) — load-bearing, do not pick silently

> Per the workstream contract, these are surfaced in the plan body for the
> spec author to rule on (via PR comment). Recommended option listed first.

### D1 — PR #83 disposition (gates WS-A Slice 1)
**Recommendation: SUPERSEDE — close PR #83 unmerged; WS-A reimplements both
facets fresh.** Grounding (G3): #83 is stale-based (`072725b` ≪ `fd7f267`),
non-draft, Facet-A-only (+2/−2), no Facet B, no boot-guard, no test. A
rebase/fold preserves ~2 lines that Slice 1 rewrites anyway and inherits a
stale base. Cleanest path: the spec author closes #83 with a one-line "carry
into WS-A" note; Slice 1 lands path shape **and** host **and** test in one
coherent commit.
*(Alternatives: **rebase** #83 onto `fd7f267` then extend it with Facet B +
test — more git friction, same end state; **fold** its commit into Slice 1 —
no benefit over rewriting two strings. Both rejected as strictly more work.)*

### D2 — C1 frontend-origin config shape + AC-CD5 anchor (gates WS-A Slice 1)
Two coupled sub-decisions:
- **(a) Settings field + fail-closed wiring** *(revised per auditor F5).*
  Recommendation: add **`app_frontend_url: str = "http://localhost:3000"`**
  (`APP_FRONTEND_URL`) to `Settings` — matching the synthesis F.2 suggestion
  and **deliberately distinct** from `APP_PUBLIC_URL` (the original draft's
  `app_public_web_url` differed by one infix token, so an operator swap of two
  real `https://…` URLs would evade the guard and silently re-introduce C1
  Facet B — auditor F5.1). Build the setup/reset links from it with
  path-segment shape, and add **two** clauses to `check_startup_config` (both
  **append to `errors`** in a non-dev env, never raise — see G1/F6):
  (i) reject empty/localhost `app_frontend_url` (reuse `_LOOPBACK_MARKERS` /
  `_cors_is_insecure` style at `config.py:127–143`); **(ii) cross-consistency —
  assert `app_frontend_url` ∈ `cors_allowed_origins_list`** (the browser app's
  own origin must already be CORS-allowed), which catches both the swap and a
  plain typo for ~one line, reusing the existing list accessor (auditor F5.2).
  Keeps the whole fix inside the existing G1 boot-guard — zero new modules, no
  structure-gate change.
- **(b) Anchor** *(re-grounded per auditor F2).* The email templates live at
  the AC-CD5 auth seam (`permissions.py:259–281` comment); the link
  **contract** (user-facing links use the public **frontend** origin with a
  path-segment token, distinct from the API `app_public_url`) is undocumented
  (AC-CD5 body, `CODE_SPEC.md:597–602`). **Correction:** the draft cited the
  `SESSION_START.md:86–96` structural-additions carve-out to fold the AC-CD5
  edit into Slice 1 — but that carve-out covers *new files / modules /
  dependencies*, **not anchor-body edits**. An anchor-body edit is governed by
  the spec-drift rule (`:80–85`) + Anchor discipline (`:97+`), so the
  **default is the spec-drift fork**, not the fold: the spec author authors a
  standalone AC-CD5 body amendment PR (the same shape as the precedent's FE-8
  §H(a) handling), and Slice 1 implements against it (pause,
  `SESSION_START.md:80–85`). This also makes D2(b) consistent with D3's F1
  spec-drift handling. **Surface for ruling:** confirm the standalone-AC-CD5
  -amendment route, or rule the contract is already implied by AC-CD5 and no
  anchor edit is needed (in which case Slice 1 ships the code + a handover note
  only).

### D3 — V2 scope: the Safety* strings are spec-drift, not a copy tweak (revised per auditor F1)
The draft framed `SafetyEmpty.tsx:26` as a free reword. It is not — G6.1
(verified) shows the Safety* strings are **spec-verbatim** (FE-3 §B.4.6 /
§B.3, lines 347/462/489) and **test-asserted** (3 assertions). So V2 splits
into two groups:
- **Test-safe group — strip in Slice 4, no spec gate:** `JITQueue.tsx:78`,
  `grade-review-queue.tsx:105`, `loop-step-row.tsx:74`, **and**
  `SafetyPosterCard.tsx:22` (not verbatim-locked, no exact-text test — G6.1).
  Strip the `· AC-Dxx` suffix, keep the human-readable head.
- **Spec-locked group — Safety* eyebrows + footer (`SafetyEmpty.tsx:16`,
  `SafetyLinks.tsx:28`, `SafetyEmpty.tsx:26`):** rewording/stripping these
  edits FE-3 acceptance criteria → **spec-drift** (`SESSION_START.md:80–85`),
  handled the **same way as D2(b)**: the spec author authors the FE-3 §B.4.6 /
  §B.3 amendment (proposed text e.g. footer → `Acumen never generates safety
  teaching content.`; eyebrow → `Curated industry sources`), then Slice 4
  implements against it and **owns rewriting the 3 coupled assertions**
  (`SafetyLinks.test.tsx:26`/`:48`, `pill-detail.test.tsx:224`).
**Recommendation:** confirm the FE-3 amendment route + the proposed replacement
copy, **or** rule the Safety* `· AC-D21` provenance stays (it is arguably
deliberate safety-policy attribution, unlike the other anchor decorations) —
in which case Slice 4 ships only the test-safe group and V2 is partially
closed. Either ruling is clean; the asymmetry the draft had (D2(b) applied the
spec-drift rule, D3 didn't) is now removed.

### D4 — Test strategy for V4/V5 (runtime-state findings)
These are render-under-failure-mode issues; the existing result-page harness
doesn't run the App-Router boundary (G4). **Recommendation:**
- **V4** *(predicate, not literal — auditor F3).* The result query **polls**
  (`result/page.tsx:58-59` keeps refetching while `status === "review_pending"`),
  so a literal `throwOnError: true` would throw to the boundary on a *transient
  poll-refetch 500 after a successful initial load*, nuking a valid pending
  page. Use the library's "only throw when we have nothing to show" predicate:
  `throwOnError: (_err, query) => query.state.data === undefined` — fires the
  boundary for V4's **initial-blank** case, lets a transient mid-poll error
  recover next interval. Test: (i) a config-level assertion that the predicate
  returns `true` for `data === undefined` and `false` otherwise (not `===
  true`), and (ii) an MSW-500 + test-`ErrorBoundary` case proving the boundary
  fallback renders on initial failure.
- **V5** *(distinct error affordance, not the exhausted card — auditor F4).*
  The `pollExhausted` branch (`GradingOverlay.tsx:129-148`) renders **"Still
  grading / Taking longer than expected — check back soon."** — correct for
  slow grading, **wrong** for a hard 500 (and folding the error into
  `pollExhausted` delays escape ~45s = `POLL_MAX_ATTEMPTS × POLL_INTERVAL_MS`).
  Prefer: on persistent `isError` (with `retry:false`, each poll fails
  immediately so `errorUpdatedAt` advances every interval), escape **promptly**
  to a **distinct error affordance** (retry/report copy), not the slow-grading
  card. Test in `GradingOverlay.test.tsx`: persistent MSW 500 + fake timers →
  the distinct error affordance appears quickly (not after the full cap, not
  the "still grading" copy).

Confirm this strategy, or specify a preferred harness (e.g. a Playwright
route-mock e2e for the boundary instead of the test-ErrorBoundary shim).

### D5 — WS-C slice granularity (V1 vs V2)
**Recommendation:** keep V1 and V2 as **two separate slices** (Slices 3 and
4) — disjoint file sets, independent logical changes, clean per-slice
rollback. They may be **collapsed into one WS-C slice** if the overseer
prefers fewer commits; flagged because both are trivial and the synthesis
groups them as a single "WS-C pre-deploy subset." No code consequence either
way.

---

## 4. Slice decomposition

Four slices. Each is **one commit, < 2500 lines, fix+test paired**, with
acceptance criteria the executing session verifies. WS-A is first for
visibility (the hard blocker); WS-B and WS-C carry no hard dependency on each
other and may proceed in any order after Slice 1.

### Dependency / execution graph
```
S1 (WS-A · C1) [code unblocked; AC-CD5 doc via D2b spec PR] ─┬─ S2 (WS-B · V4+V5)
                                                            ├─ S3 (WS-C · V1)
                                                            └─ S4a (WS-C · V2 test-safe)
                                                               S4b (V2 Safety*) ── GATED on FE-3 amend (D3)
```
S1 first (blocker visibility, synthesis F.3 #1). S2/S3/S4a are mutually
independent (disjoint surfaces) and auto-continue on clean review.
**Two spec-drift gates now apply** (auditor F1/F2, surfaced not absorbed):
- **D2(b) — AC-CD5 link contract:** default route is a standalone
  user-authored AC-CD5 amendment PR; S1's *code* (config/email/test) is
  unblocked and proceeds, the *anchor doc* lands via that PR.
- **D3 — FE-3 Safety* strings:** S4b waits on the user-authored FE-3
  §B.4.6/§B.3 amendment; S4a proceeds meanwhile.
Both honour the spec-drift pause (`SESSION_START.md:80–85`): the executing
session does not author either amendment.

---

### Slice 1 — WS-A: auth activation path (C1, both facets) + regression test
**Gated on Decisions D1 + D2.** If D2(b) is ruled the spec-drift route
(recommended), Slice 1's code waits on the standalone AC-CD5 amendment PR
landing on `main`; the email/config/test work below is otherwise unblocked.
**Fix:**
- `app/config.py` — add **`app_frontend_url: str = "http://localhost:3000"`**
  (`APP_FRONTEND_URL`, D2a — distinct from `APP_PUBLIC_URL`); add **two
  clauses to `check_startup_config`** that **append to the returned `errors`
  list** (never raise — G1/F6) in a non-dev env: (i) `app_frontend_url`
  empty/localhost (reuse `_LOOPBACK_MARKERS`, `config.py:132`); (ii)
  `app_frontend_url ∉ cors_allowed_origins_list` (cross-consistency, F5.2).
- `app/permissions.py:266` / `:275` — rebuild both links as **path segments**
  off the **frontend** origin:
  `f"{get_settings().app_frontend_url}/setup/{raw_token}"` and
  `…/reset/{raw_token}`.
- `docs/DEPLOYMENT.md` + `.env.example` — document `APP_FRONTEND_URL` as the
  externally-visible **frontend** origin (distinct from the API
  `APP_PUBLIC_URL`), required-in-prod, no-localhost, **must be a member of
  `CORS_ALLOWED_ORIGINS`**; cross-reference the new boot assertions (mirror the
  existing CORS checklist `DEPLOYMENT.md:55–57`).
- **(D2b)** AC-CD5 link-contract documentation — via the standalone amendment
  PR (D2b spec-drift route), not folded here.
**Test (the seam no test exercised — auditor1.md:70):**
- `tests/integration/test_auth_email_links.py` (new) — assert
  `setup_email_content(tok)` / `reset_email_content(tok)` emit
  `{app_frontend_url}/setup/{tok}` and `…/reset/{tok}` (path shape + frontend
  host), and that the emitted path matches the FE `[token]` route pattern
  (token as the **last path segment**, no query string).
- Extend `tests/unit/test_startup_config.py`, **mirroring the existing
  dual-assert pattern** (`check_startup_config` *collects the error* +
  `run_startup_checks` *raises* — `:107-110`, `:120-124`, `:161-162`):
  `development` boots clean on the localhost frontend default; a non-dev env
  with empty/localhost `app_frontend_url`, or a frontend URL outside the CORS
  list, **collects an error (and `run_startup_checks` raises)**; a real
  CORS-member frontend origin passes.
**Acceptance:** a created user's setup email links to
`{frontend-origin}/setup/{token}` (resolves to `setup/[token]/page.tsx`, no
404); `development` + CI boot clean; a non-dev env without a real CORS-member
`APP_FRONTEND_URL` fails fast; `pytest --ignore=tests/e2e` + `structure_gate`
+ `mypy` green. **PR #83 superseded** (D1).

### Slice 2 — WS-B: testee result-flow silent failures (V4 + V5) + tests
**Fix:**
- **V4** — `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/result/
  page.tsx:47–62` — add the **predicate** `throwOnError: (_err, query) =>
  query.state.data === undefined` to the result `useQuery` (F3) so an
  **initial-fetch** error throws into the already-correct Pattern-C boundary
  `result/error.tsx` (no longer dead code), while a transient mid-poll error
  on an already-rendered `review_pending` page recovers on the next interval
  rather than nuking valid UI.
- **V5** — `frontend/src/components/attempt/GradingOverlay.tsx:111–121` — on
  persistent `resultQuery.isError`, escape **promptly** to a **distinct error
  affordance** (retry/report copy), **not** the slow-grading `pollExhausted`
  card (whose "Still grading / check back soon" copy at `:129-148` is wrong for
  a 500, and which delays escape ~45s) (F4). With `retry:false`, each poll
  fails immediately so `errorUpdatedAt` advances every interval — drive the
  error escape off `isError`/`errorUpdatedAt`.
**Test (per D4):**
- `frontend/tests/pages/result-page.test.tsx` (extend) — MSW 500 on the result
  endpoint + a test `ErrorBoundary` wrapper; assert the boundary fallback
  renders on **initial** failure (not a blank body). Plus a config-level
  assertion that the `throwOnError` predicate returns `true` for `data ===
  undefined` and `false` otherwise.
- `frontend/tests/components/attempt/GradingOverlay.test.tsx` (extend) —
  persistent MSW 500 + fake timers; assert the **distinct error affordance**
  appears **promptly** (not the "Still grading" exhausted copy, not after the
  full `POLL_MAX_ATTEMPTS` cap, no eternal spinner).
**Acceptance:** a result-fetch 500 on initial load renders the result error
boundary (not header + blank); a transient mid-poll 500 does not unmount a
valid pending page; a persistent grading-poll error escapes promptly to a
distinct error affordance; `pnpm test` + `pnpm typecheck` green.

### Slice 3 — WS-C: admin recovery loop (V1) + test
**Fix:**
- Export `dashboardPathFor` from `frontend/src/lib/auth/guards.tsx:40` (G5).
- `frontend/src/app/error.tsx:54` (client) — replace `router.push("/")` with
  `router.push(dashboardPathFor(useAuth().role))`.
- `frontend/src/app/403/page.tsx:54` (client) — replace `href="/"` with the
  role-aware target via `dashboardPathFor(useAuth().role)`.
- `frontend/src/app/not-found.tsx` (server) — extract the CTA into a tiny
  `"use client"` component that reads `useAuth().role` (or a role-detecting
  redirect), so an admin lands on `/ops` and a testee on `/`.
  *(Note: `result/error.tsx:38` also routes "Go to dashboard" to `/`, but that
  boundary is testee-scoped, so `/` is correct there — left untouched.)*
**Test:**
- `frontend/tests/components/shell/` (new) — render each recovery surface with
  a mocked `useAuth` admin role → CTA target is `/ops`; with testee role → `/`.
**Acceptance:** an admin hitting 404/500/403 has a working recovery CTA to
`/ops` (no `/` → `/403` loop); a testee still routes to `/`; `pnpm test` +
`pnpm typecheck` green.

### Slice 4 — WS-C: anchor-ID UI leak (V2) + test
**Two groups per D3 / G6.1.** Comments/aria/docstrings that mention `AC-D…`
are **not** touched (A1 already excluded them).

**4a — test-safe group (no spec gate; ships in this slice unconditionally):**
strip the `· AC-Dxx` suffix, keep the human-readable head, at
`JITQueue.tsx:78`, `grade-review-queue.tsx:105`, `loop-step-row.tsx:74`, and
`SafetyPosterCard.tsx:22` (G6.1 — none is verbatim-locked or exact-text
tested).

**4b — Safety* spec-locked group — GATED on the D3 FE-3 amendment (spec-drift):**
`SafetyEmpty.tsx:16`, `SafetyLinks.tsx:28` (eyebrow), `SafetyEmpty.tsx:26`
(footer) are spec-verbatim (FE-3:347/462/489) and test-asserted. Implement
**only after** the user-authored FE-3 §B.4.6/§B.3 amendment lands on `main`
(pause per `SESSION_START.md:80–85`); then strip/reword to match the amended
spec **and rewrite the 3 coupled assertions** that currently lock the old
strings: `tests/components/pill-detail/SafetyLinks.test.tsx:26` & `:48`,
`tests/pages/pill-detail.test.tsx:224`. *(If D3 is ruled "Safety* provenance
stays," 4b is dropped and V2 closes on 4a alone.)*

**Test:**
- `frontend/tests/components/` (new/extend) — render each **4a** component and
  assert its visible text contains **no** `AC-D` substring (regex guard).
- For **4b** (post-amendment): rewrite the 3 coupled assertions to the amended
  copy and extend the no-`AC-D` guard to the Safety* surfaces.
**Acceptance:** the 4a surfaces render no `AC-Dxx` token, human-readable heads
intact, `pnpm test` + `pnpm typecheck` green; 4b lands the same guarantee on
the Safety* surfaces once the FE-3 amendment is on `main`, with the 3 coupled
assertions rewritten (no pre-existing test left red).

---

## 5. Test-pairing matrix

| Slice | Finding(s) | Test | Location |
|---|---|---|---|
| 1 | C1 (WS-A) | email-link shape+host; startup fail-closed | `tests/integration/test_auth_email_links.py` (new) + `tests/unit/test_startup_config.py` (extend) |
| 2 | V4 + V5 (WS-B) | result-error boundary fires; grading-overlay escapes | `frontend/tests/pages/result-page.test.tsx` + `…/components/attempt/GradingOverlay.test.tsx` (extend both) |
| 3 | V1 (WS-C) | role-aware recovery CTA | `frontend/tests/components/shell/*` (new) |
| 4a | V2 test-safe | no `AC-D` in rendered text | `frontend/tests/components/*` (new/extend) |
| 4b | V2 Safety* (post FE-3 amend) | rewrite 3 coupled asserts + no-`AC-D` guard | `SafetyLinks.test.tsx:26/:48`, `pill-detail.test.tsx:224` |

---

## 6. Out-of-plan-scope discoveries (surfaced, not absorbed)

- **G6 / V2 seventh site** — `SafetyEmpty.tsx:26` renders `AC-D21` beyond A1's
  six. Folded into Slice 4 **via Decision D3** (not silently), because it is
  the same finding's surface; the *wording* needs a ruling.
- **`result/error.tsx:38`** routes "Go to dashboard" to `/` — correct here
  (testee-scoped boundary), so deliberately left out of the V1 fix. Noted so a
  later reviewer doesn't read it as a missed V1 site.
- **C1 ↔ result coupling (informational):** V4/V5 and the GradingOverlay all
  consume `GET /v1/attempts/{id}/result`; the V4/V5 fixes harden the FE against
  *any* backend hiccup on that endpoint and are independent of C1.

No findings outside the stated pre-deploy scope were absorbed. Post-deploy and
carry-forward items remain parked per synthesis F.3/F.4.

---

## 7. Open risks the executor must watch

- **Slice 1 host correctness.** The email link must be built from the
  **web** origin, not `app_public_url` (the API origin). The integration test
  is the guard — assert the host is the web origin and the token is the final
  path segment.
- **Slice 1 structure-gate.** Keep all C1 config logic in `app/config.py`
  reading only `Settings`; `app/main.py` must not import `app.ai`/`app.domain`
  (AC-CD2; grounding G1). The existing `check_startup_config` already honours
  this — extend it, don't relocate it.
- **Slice 2 boundary harness.** The result-page test does not run the
  App-Router boundary natively (G4); use the D4 test-ErrorBoundary shim, and
  assert `throwOnError` at the config level so the regression is caught even
  if the harness shim drifts.
- **Slice 3 server-component constraint.** `not-found.tsx` is a server
  component — the role-aware CTA **must** be a separate client component;
  calling `useAuth()` directly in `not-found.tsx` will not compile.
- **Slice 4 over-strip.** Strip only the decorative `· AC-Dxx` suffixes and
  the D3-reworded sentence; do not touch comments/aria/docstrings or the
  human-readable label heads.
- **Two spec-drift gates (rev-1).** The AC-CD5 link contract (D2b) and the
  FE-3 Safety* strings (D3/Slice 4b) are now both **spec-drift by default** —
  each needs a user-authored amendment PR; the executing session must not
  author either, and must pause the gated work until the amendment is on `main`
  (S1 code and S4a proceed meanwhile). If the spec author instead rules either
  contract is already implied (no amendment), that work un-gates.
- **Slice 4b coupled tests.** 4b must rewrite the 3 existing assertions
  (`SafetyLinks.test.tsx:26/:48`, `pill-detail.test.tsx:224`) in the **same**
  commit as the strip, or the slice lands red — they exact-match the old
  strings and the new no-`AC-D` guard directly contradicts them.

---

*Plan grounded against HEAD `fd7f267`. Citations are `file:line` at time of
authoring. Decisions D1–D5 are open and await the spec author's ruling (via PR
comment). The planner authors and revises in response to audit only — it does
not execute slices or flip draft→ready.*

## rev-1 — auditor Round-1 findings folded (F1–F6)

All six Round-1 findings verified valid against `fd7f267` and folded:
- **F1 (real gap)** — V2 Safety* strings are spec-verbatim (FE-3:347/462/489)
  + test-asserted (3 assertions): added **G6.1**, rewrote **D3** as a
  spec-drift fork, split **Slice 4** into 4a (test-safe) / 4b (spec-gated +
  owns the 3 coupled-test rewrites). Independently confirmed `SafetyPosterCard
  :22` is **not** locked → moved to the test-safe group.
- **F2 (real gap)** — AC-CD5 amendment was miscited to the `:86-96` structural
  carve-out; it is spec-drift (`:80-85`) — **D2(b)** default flipped to a
  standalone user-authored AC-CD5 PR; Slice 1 code unblocked, anchor doc via
  that PR.
- **F3** — V4 `throwOnError` made a **predicate** (`data === undefined`), not
  literal `true`, to spare the polling query (D4, Slice 2).
- **F4** — V5 escapes to a **distinct error affordance** on `isError`, not the
  slow-grading `pollExhausted` card (D4, Slice 2).
- **F5** — config field renamed `app_public_web_url` → **`app_frontend_url`
  (`APP_FRONTEND_URL`)** + added a **CORS-membership** boot assertion (D2a,
  Slice 1).
- **F6** — corrected "raises" → "appends to `errors` (and `run_startup_checks`
  raises)"; Slice 1 test mirrors the existing dual-assert pattern (G1, Slice 1).

**Set-diff gate (rev-0 → rev-1):** no finding IDs dropped — C1, V4, V5, V1, V2
all still in scope; the only scope *change* is V2 splitting into 4a/4b and two
new spec-drift gates (D2b, D3) surfaced for the spec author. rev-1 edits are
audit-driven only (G1, G6.1, D2, D3, D4, Slices 1/2/4, graph, matrix).
