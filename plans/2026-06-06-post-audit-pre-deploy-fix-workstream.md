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
  RAISEs on `change-me` secrets / wildcard|localhost CORS.
- `app/main.py:42` `run_startup_checks(...)` called from the `:70` FastAPI
  lifespan — logs warnings, raises `RuntimeError` on any error.

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
anchor woven in. Stripping it blindly would damage the policy copy. See
**Decision D3** (reword vs strip).

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
- **(a) Settings field + fail-closed wiring.** Recommendation: add
  `app_public_web_url: str = "http://localhost:3000"` to `Settings`
  (mirroring the `cors_allowed_origins` default), build the setup/reset links
  from it with path-segment shape, and add **one** fail-closed clause to
  `check_startup_config` — RAISE in a non-dev env when `app_public_web_url` is
  unset/empty or localhost (reuse the existing `_LOOPBACK_MARKERS` /
  `_cors_is_insecure` style at `config.py:127–143`). This keeps the whole fix
  inside the existing G1 boot-guard with zero new modules and no structure-gate
  change.
- **(b) Anchor.** The email templates live at the AC-CD5 auth seam
  (`permissions.py:259–281` comment). The link **contract** (user-facing links
  use the public **web** origin with a path-segment token, distinct from the
  API `app_public_url`) is currently undocumented (AC-CD5 body,
  `CODE_SPEC.md:597–602`, is silent on it). Recommendation: **amend AC-CD5's
  body** in-place to record the link-building contract, folded into Slice 1's
  commit under the structural-additions carve-out (`SESSION_START.md:86–96`) —
  this is a defect-fix clarification of existing intent (links are *meant* to
  reach the FE), not a new product rule, so it does not require a separate
  user-authored spec PR. **Surface for confirmation:** if the spec author
  judges the anchor edit to be spec-drift rather than an absorbable
  clarification, they author a standalone AC-CD5 amendment PR first and Slice 1
  implements against it (spec-drift pause, `SESSION_START.md:80–85`).

### D3 — V2 scope: the seventh site + the safety-policy sentence (refines WS-C/V2)
**Recommendation:** strip the decorative `· AC-Dxx` trace suffix from all six
A1 sites (keep the human-readable head — `Queue`, `Curated industry sources`,
`Cross-family review`, etc.), **and reword** `SafetyEmpty.tsx:26` from
`Per AC-D21 · Acumen never generates safety teaching content` to
`Acumen never generates safety teaching content.` — preserving the policy
statement while dropping the meaningless-to-users anchor. This is an
**out-of-A1-scope discovery** (G6), surfaced rather than silently folded:
confirm the reword wording, or rule that `:26` stays as-is (intentional
provenance copy).

### D4 — Test strategy for V4/V5 (runtime-state findings)
These are render-under-failure-mode issues; the existing result-page harness
doesn't run the App-Router boundary (G4). **Recommendation:**
- **V4:** (i) assert the result `useQuery` is configured `throwOnError: true`
  (config-level guard), **and** (ii) add a vitest case that seeds an MSW 500
  for `GET /v1/attempts/{id}/result`, wraps `<ResultPage/>` in a **test
  `ErrorBoundary`**, and asserts the boundary's fallback renders (proving the
  query throws rather than blanking to `null`). This exercises the seam the
  real `error.tsx` sits on without depending on App-Router internals.
- **V5:** in `GradingOverlay.test.tsx`, seed a persistent MSW 500 + fake
  timers, advance past `POLL_MAX_ATTEMPTS` intervals, and assert the overlay
  reaches an **error/exhausted affordance** (not an eternal spinner) — i.e. the
  cap now advances on `isError`/`errorUpdatedAt`, not only `dataUpdatedAt`.

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
S1 (WS-A · C1)  ─┬─ S2 (WS-B · V4+V5)
                 ├─ S3 (WS-C · V1)
                 └─ S4 (WS-C · V2)
```
S1 first (blocker visibility, synthesis F.3 #1). S2/S3/S4 are mutually
independent (disjoint surfaces) and auto-continue on clean review.
**No spec-drift gate** is expected unless D2(b) is ruled to require a
standalone AC-CD5 amendment PR — in which case S1 pauses on that PR landing
(`SESSION_START.md:80–85`) and S2–S4 proceed meanwhile.

---

### Slice 1 — WS-A: auth activation path (C1, both facets) + regression test
**Gated on Decisions D1 + D2.**
**Fix:**
- `app/config.py` — add `app_public_web_url: str = "http://localhost:3000"`
  (D2a); add a fail-closed clause to `check_startup_config` (`:178` non-dev
  block) RAISEing when `app_public_web_url` is empty/localhost in a non-dev
  env, reusing `_LOOPBACK_MARKERS` (`:132`).
- `app/permissions.py:266` / `:275` — rebuild both links as **path segments**
  off the **web** origin:
  `f"{get_settings().app_public_web_url}/setup/{raw_token}"` and
  `…/reset/{raw_token}`.
- `docs/DEPLOYMENT.md` + `.env.example` — document `APP_PUBLIC_WEB_URL` as the
  externally-visible **frontend** origin (distinct from the API
  `APP_PUBLIC_URL`), required-in-prod, no-localhost; cross-reference the new
  boot assertion (mirror the existing CORS checklist `DEPLOYMENT.md:55–57`).
- **(D2b)** AC-CD5 body amendment documenting the link contract (folded here,
  pending D2b ruling).
**Test (the seam no test exercised — auditor1.md:70):**
- `tests/integration/test_auth_email_links.py` (new) — assert
  `setup_email_content(tok)` / `reset_email_content(tok)` emit
  `{app_public_web_url}/setup/{tok}` and `…/reset/{tok}` (path shape + web
  host), and that the emitted path matches the FE `[token]` route pattern
  (e.g. `/setup/<tok>` has the token as the **last path segment**, no query
  string).
- Extend `tests/unit/test_startup_config.py` — `development` boots clean on
  the localhost web URL default; a non-dev env with empty/localhost
  `app_public_web_url` **raises** (the new fail-closed clause); a real
  frontend origin passes.
**Acceptance:** a created user's setup email links to
`{frontend-origin}/setup/{token}` (resolves to `setup/[token]/page.tsx`, no
404); `development` + CI boot clean; a non-dev env without a real
`APP_PUBLIC_WEB_URL` fails fast; `pytest --ignore=tests/e2e` + `structure_gate`
+ `mypy` green. **PR #83 superseded** (D1).

### Slice 2 — WS-B: testee result-flow silent failures (V4 + V5) + tests
**Fix:**
- **V4** — `frontend/src/app/(authed)/(testee)/attempts/[attemptId]/result/
  page.tsx:47–62` — add `throwOnError: true` to the result `useQuery` so a
  fetch error throws into the already-correct Pattern-C boundary
  `result/error.tsx` (no longer dead code).
- **V5** — `frontend/src/components/attempt/GradingOverlay.tsx:111–121` —
  advance the poll cap on the **error** path too: key the cap-advance on
  `resultQuery.isError` / `errorUpdatedAt` (not only `dataUpdatedAt`), or break
  to an error affordance on `isError`, so a persistent result-poll error
  reaches `pollExhausted`/an escape card instead of spinning forever.
**Test (per D4):**
- `frontend/tests/pages/result-page.test.tsx` (extend) — MSW 500 on the result
  endpoint + a test `ErrorBoundary` wrapper; assert the boundary fallback
  renders (not a blank body). Plus a config-level assertion that the query sets
  `throwOnError`.
- `frontend/tests/components/attempt/GradingOverlay.test.tsx` (extend) —
  persistent MSW 500 + fake timers past `POLL_MAX_ATTEMPTS`; assert an
  error/exhausted affordance appears (no eternal spinner).
**Acceptance:** a result-fetch 500 renders the result error boundary (not
header + blank); a persistent grading-poll error escapes to an error/exhausted
state within the cap; `pnpm test` + `pnpm typecheck` green.

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
**Gated on Decision D3 (the `SafetyEmpty:26` reword).**
**Fix:** strip the `· AC-Dxx` trace suffix from the six rendered sites (G6) —
`JITQueue.tsx:78`, `loop-step-row.tsx:74`, `SafetyPosterCard.tsx:22`,
`SafetyEmpty.tsx:16`, `SafetyLinks.tsx:28`, `grade-review-queue.tsx:105` —
keeping the human-readable head; and reword `SafetyEmpty.tsx:26` per D3.
Comments/aria/docstrings that mention `AC-D…` are **not** touched (A1 already
excluded them).
**Test:**
- `frontend/tests/components/` (new/extend) — render each touched component and
  assert its visible text contains **no** `AC-D` substring (a regex guard so
  the leak can't silently return).
**Acceptance:** no user-facing surface renders an `AC-Dxx` token; the
human-readable labels and the safety-policy statement remain intact; `pnpm
test` + `pnpm typecheck` green.

---

## 5. Test-pairing matrix

| Slice | Finding(s) | Test | Location |
|---|---|---|---|
| 1 | C1 (WS-A) | email-link shape+host; startup fail-closed | `tests/integration/test_auth_email_links.py` (new) + `tests/unit/test_startup_config.py` (extend) |
| 2 | V4 + V5 (WS-B) | result-error boundary fires; grading-overlay escapes | `frontend/tests/pages/result-page.test.tsx` + `…/components/attempt/GradingOverlay.test.tsx` (extend both) |
| 3 | V1 (WS-C) | role-aware recovery CTA | `frontend/tests/components/shell/*` (new) |
| 4 | V2 (WS-C) | no `AC-D` in rendered text | `frontend/tests/components/*` (new/extend) |

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
- **D2(b) spec-drift fork.** If the spec author rules the AC-CD5 edit is
  drift (not absorbable), Slice 1 pauses on a standalone AC-CD5 amendment PR
  before landing; Slices 2–4 proceed meanwhile.

---

*Plan grounded against HEAD `fd7f267`. Citations are `file:line` at time of
authoring. Decisions D1–D5 are open and await the spec author's ruling (via PR
comment). The planner authors and revises in response to audit only — it does
not execute slices or flip draft→ready.*
