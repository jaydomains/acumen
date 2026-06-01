# Testee frontend completion workstream — plan

**Date:** 2026-06-01
**Branch:** `claude/testee-fe-completion-plan-C1xtw` (plan PR); each slice runs
on its own fresh branch off latest `main` (precedent: `claude/pre-deploy-pr1…`).
**Authoritative source:** the 2026-06-01 production smoke-test write-up (3 issues)
+ this session's read-only grounding against `main`. FE roadmap closed after
FE-9; this workstream is a **post-roadmap completion pass** scoped strictly to
the testee surface.
**Status:** draft — decisions D1–D7 PENDING spec-author ruling.

> **What this package is.** The testee surface shipped with three classes of
> defect that the first real use exposed: (a) dashboard widgets showing
> `"v1.x · pending"` placeholder copy, (b) `Today's Reading` rendering static
> editorial that reads as live data, and (c) two nav items (`/attempts`,
> `/results`) that 404 on click. **The decisive grounding finding is that none
> of these are blocked on backend work** — every endpoint the testee surface
> needs is already live on `main`; the placeholders are *stale* (carry
> pre-Slice-B "endpoint unmounted" comments that the endpoint-landing PR never
> swept). This workstream is therefore overwhelmingly **frontend wiring against
> existing endpoints + honest removal of dead surfaces**, plus one mandatory
> spec-drift correction. WS1/WS2/WS3, the WS4 remainder, admin surfaces, the
> PR #82 shell fixes, and the backend email-link fix are **out of scope**.

---

## 1. Scope lock

**In scope (testee surface only):**

- Every testee dashboard widget showing placeholder/pending copy — wire to the
  live endpoint or remove honestly (`HeroStats`, dashboard `AdaptiveLoopCard`).
- `Today's Reading` — resolve the static-editorial-masquerading-as-live problem
  (decision D2).
- Every dead/placeholder testee nav destination — land or remove with honest
  reasoning (`/attempts`, `/results`).
- The stale-comment / stale-spec drift that makes the live endpoints *look*
  unmounted (mandatory spec-drift surfacing, D5).
- Test rewrites for any widget whose test currently locks the stale
  "no request fires" behavior.

**Out of scope (named for the boundary — do NOT touch):**

- WS1 (typed wire contracts), WS2 (transactional CRUD+audit), WS3 (real-DB
  integration tier), WS4 remainder (N+1 batching, a11y polish, StreamingRunner
  refactor beyond testee completion). All post-deploy.
- Admin surface improvements unrelated to testee completion.
- PR #82 shell/header fixes (in flight; user merging directly).
- The backend email-link route fix (separate standalone PR, parallel).
- The attempt **runner** itself (FE-4/FE-5) — fully landed and live
  (`attempts/[attemptId]/page.tsx`, three-mode branch); not re-litigated.

---

## 2. Grounding notes (verified read-only against `main`)

Every "current behavior" claim below was read from source. Citations are
`file:line` at authoring time.

### G1 — The placeholder widgets are STALE, not endpoint-blocked (keystone)

The smoke-test write-up reads the `"v1.x · pending"` copy as "APIs healthy but
widget unimplemented." Grounding shows the opposite: **the endpoint is live and
already consumed elsewhere; only the dashboard widget was never re-wired.**

- `app/routers/competency.py:9-11` — docstring: *"Pre-slice-B this file was an
  unmounted placeholder … Slice B is that dashboard's first endpoint; the file
  is now **mounted** via `app.main`."* `GET /v1/me/competence` is implemented
  (`competency.py:38-49`) and `GET /v1/me/assignments` (`competency.py:70-90`).
- `frontend/src/lib/queries/me.ts:43-48` — `useMeCompetence()` exists and is
  live; the **profile page already consumes it** (`profile/page.tsx`).
  `useMeAssignments()` (`me.ts:57-62`) and the `/v1/attempts` capped/infinite
  hooks (`me.ts:73-106`) are all live.
- **But** `frontend/src/components/dashboard/HeroStats.tsx:4-9` still says: *"In
  v1 ALL stat values render as '—' … because the backend competence router is
  **unmounted**; we DO NOT construct the query."* The stats are hardcoded
  `value="—"` with `hint="v1.x · pending /v1/me/competence"` (`HeroStats.tsx:40-46`).
  The component takes only `{displayName, dateLabel}` (`HeroStats.tsx:17-20`).
- The dashboard page header repeats the stale claim: `page.tsx` — *"`GET
  /v1/me/competence|assignments` are unmounted/absent in v1"* — yet mounts
  `AssignmentsCard` (live on `useMeAssignments`) directly below.

→ Wiring `HeroStats` is a small change: the hook, endpoint, and query-key
already exist. The blocker is the **stale FE-3 spec** (G6) and the **tests that
lock the stub** (G7).

### G2 — Today's Reading is fabricated editorial, not live content

- `frontend/src/data/readings.tsx:27-62` — a 3-entry hardcoded `READINGS` array
  of horoscope/"fortune"-style copy referencing **fabricated** competence:
  *"Antifouling is dim today — you've slipped half a band,"* *"Inspection
  Instruments … expert band, 71 attempts."* `pickReading()` (`:76`) is a pure
  UTC-day modulo; **no API call** (`:11` "frontend-only — no API call").
- This is worse than a neutral placeholder: it asserts specific (false) facts
  about the testee's progress. Anchored to `AC-D8` framing in `FE-3-content.md:1`
  but the content is sample text from the prototype (`testee.jsx:21-46`).

→ Product decision required (D2). There is **no** readings/insights endpoint on
the backend (confirmed: backend inventory has no such route).

### G3 — Two nav items are dead; one is cheaply landable, one needs backend

- `frontend/src/components/shell/Rail.tsx:31-38` `TESTEE_NAV`:
  `In Progress → /attempts` (`:33`), `Latest Result → /results` (`:35`).
  Rail comment (`:7-9`) acknowledges hrefs "will 404 until later phases land
  them."
- Verified route tree under `app/(authed)/(testee)/`: pages exist for `/`,
  `/catalogue`, `/pills/[pillId]`, `/profile`, `/history`,
  `/attempts/[attemptId]`, `/attempts/[attemptId]/result`. **No `/attempts`
  index, no `/results` page** → both top-level hrefs 404.
- `FE-2-shell.md:323` records the original intent: `In Progress` = "attempt
  route from FE-4 — placeholder anchor"; `Latest Result` = "results — FE-6
  anchor." FE-4/FE-6 shipped the *parametrized* routes
  (`/attempts/[attemptId]`, `/attempts/[attemptId]/result`) but never the
  top-level landing pages the nav points at.
- **`/results` (Latest Result) is cheaply landable with no backend:** the most
  recent submitted attempt is derivable from `GET /v1/attempts` (limit 1) via
  the existing `useMeAttemptsCapped` hook; a thin page can redirect to
  `/attempts/{id}/result`.
- **`/attempts` (In Progress) is NOT cheaply landable:** `GET /v1/attempts`
  returns **submitted** attempts only (`AttemptListItem` carries `submitted_at`,
  `score_percent`, `band`). There is **no endpoint that lists in-progress
  (unsubmitted) attempts.** Resume today is localStorage-based via
  `ResumePrompt` on the dashboard (`ResumePrompt.tsx`, reads
  `localStorage["acumen.attempts.inflight"]`).

### G4 — Dashboard AdaptiveLoopCard is a hardcoded narrative with no-op CTAs

- `frontend/src/components/dashboard/AdaptiveLoopCard.tsx:30-36` — hardcoded
  *"Two weak areas surfaced from your last attempt … queued a targeted re-test
  five days out."* Two CTAs are `toast()` no-ops tagged `TODO(v1.x)`
  (`:43` explainer, `:56` defer). No API call.
- Real adaptive-loop data **does** exist, but **per attempt**: the
  `GET /v1/attempts/{id}/result` response carries `adaptive_loop: list[LoopStep]`
  (backend `AttemptResultResponse`), and the **result page already renders a
  real `components/result/AdaptiveLoopCard`** (distinct component, landed).
- There is **no** dashboard-level "current loop state for this testee"
  endpoint. A dashboard loop card must either derive from the latest result or
  be removed.

### G5 — Assignment learning-path names degrade (lower priority)

- `frontend/src/components/dashboard/AssignmentsCard.tsx` resolves pill names
  from the catalogue but renders a generic "Learning path" label for
  learning-path assignments, because `AssignmentResponse` carries
  `pill_id`/`learning_path_id` but **no names** (backend schema), and
  `/v1/learning-paths` is admin-only. The card's own comment flags the v1.x fix:
  add `pill_name` + `learning_path_name` to the `/v1/me/assignments` response.
- This is a graceful degradation, not a dead/fake surface. Backend enhancement.

### G6 — SPEC DRIFT: FE-3 spec still describes competence as unmounted

- `fe-specs/FE-3-content.md:105` — *"`GET /v1/me/competence` … competency router
  exists at `app/routers/competency.py` but is **unmounted/empty in v1**. See
  §H (a) item 5. v1 fallback: hero renders v1.x-pending copy."* This is **false
  against current `main`** (G1: it is mounted and consumed by `/profile`).
- `FE-3-content.md:92` defines the intended `HeroStats` prop signature
  (`overallCompetence`, `pillCount`, `workingPlusCount`, `streakDays:
  number | null`) — the actual component (`HeroStats.tsx:17-20`) implements
  **none** of these props. Implementation never caught up to spec.
- `FE-3-content.md:111` — day streak is "derivable from `GET /v1/attempts`
  history" (client-side; no backend needed).
- Per `SESSION_START.md` spec-drift discipline, this is surfaced for spec-author
  resolution, **not** silently reconciled. See D5.

### G7 — Tests lock the stale "no request fires" behavior

- `frontend/tests/pages/dashboard.test.tsx` and
  `frontend/tests/components/dashboard/HeroStats.test.tsx` exist and (per
  `FE-3-content.md:160-164, :679, :705`) assert the hero renders `"—"` +
  "Coming in v1.x" and **no `/v1/me/competence` request fires**. Wiring
  `HeroStats` (Slice 1) **requires rewriting these two tests** — the fix and the
  test rewrite are one slice (fix+test paired, per the pre-deploy precedent).

### G8 — Dead-code "endpoint_absent" fallbacks on profile/history

- `profile/page.tsx` and `history/page.tsx` carry 404/405 fallback branches with
  copy like *"Your … arrives once we light up the `/v1/me/competence` /
  `/v1/attempts` endpoint."* Both endpoints are live (G1), so these branches are
  unreachable in production and their copy is misleading. Low-risk hygiene.

---

## 3. Decisions needed (spec-author ruling) — load-bearing, do not pick silently

> Surfaced in the plan body for the spec author to rule on via PR comment.
> Recommended option listed first. Slices cite the decision that gates them.

### D1 — What is "finished" for v1? (gates the whole slice set) — PENDING

Proposed tiers (recommend **Tier A** for the KBC pilot redeploy):

- **Tier A — "honest surface" (recommended).** No dead nav, no fake/placeholder
  content, all dashboard widgets either live or removed. **Pure frontend against
  endpoints that already exist** — no backend dependency, no new endpoint.
  Closes all three smoke-test issues. = Slices 1–5.
- **Tier B — "parity-lite."** Tier A + learning-path names in assignments (G5,
  backend enhancement) + an In-Progress attempts page (G3, needs a new backend
  list endpoint). = Slices 1–5 + 6–7, backend-gated.
- **Tier C — "full parity."** Tier B + dashboard-level adaptive-loop wired to a
  real per-testee loop endpoint + dynamic readings. Largest; not recommended for
  the pilot.

**Recommendation:** ship **Tier A** now (unblocks redeploy with zero backend
risk); track B/C items as explicit deferrals.

### D2 — Today's Reading disposition (gates Slice 2) — PENDING

- **(a) Remove from v1 dashboard (recommended).** The content asserts false
  facts about the testee's progress (G2); relabeling it "sample" still ships
  fabricated competence claims on the primary surface. Cheapest, most honest.
- **(b) Keep, clearly relabeled** as editorial/sample with neutral copy that
  references no specific (fake) progress. Cheap but retains an
  editorial-filler widget of unclear product value.
- **(c) Dynamic from a new `/v1/me/insights` endpoint.** Real value but a
  backend build with AI-cost implications; out of proportion for the pilot.

**Recommendation:** (a) remove for v1; revisit a real "insights" surface in
v1.x if engagement signals justify it (SPEC.md:157 lists streaks/gamification as
v1.x).

### D3 — Dead-nav model (gates Slice 3) — PENDING

- **Recommended:** **remove `In Progress` (`/attempts`)** from `TESTEE_NAV`
  (resume is already handled by `ResumePrompt` on the dashboard; no backend
  in-progress list exists — G3); **replace `Latest Result` (`/results`)** with a
  thin redirect page to the latest attempt's result (cheap, no backend).
  Resulting v1 testee nav: `Dashboard · Discover · Latest Result · Competency ·
  History`.
- **Alt 1:** remove **both** `/attempts` and `/results`; rely on the dashboard
  `RecentAttemptsCard` + `History` page. Smallest surface.
- **Alt 2:** build a real In-Progress page (defers to Tier B / D6 — needs
  backend).

**Recommendation:** recommended option above (remove In-Progress, redirect
Latest Result).

### D4 — Dashboard AdaptiveLoopCard disposition (gates Slice 4) — PENDING

- **Recommended:** **remove the dashboard card for v1.** The per-attempt result
  page already renders a real adaptive-loop card (G4); a dashboard-level card
  with no dedicated endpoint can only fake or duplicate it.
- **Alt:** wire the dashboard card to the **latest** submitted attempt's
  `result.adaptive_loop` (data exists) and point "Read the explainer" at the
  existing pill learning-material route. Medium effort; partial value.

**Recommendation:** remove from dashboard for v1; defer a first-class
dashboard loop surface to v1.x.

### D5 — FE-3 spec-drift correction (BLOCKS Slice 1) — PENDING

Per `SESSION_START.md` spec-drift discipline (never silently reconciled), the
spec author authors a **separate, standalone, doc-only** spec-clarification PR
amending `fe-specs/FE-3-content.md`:

- `:105` / §H(a) item 5 / §E item 1: `GET /v1/me/competence` is **live and
  mounted**, not unmounted; the hero **wires** to it (drop the "v1.x-pending"
  fallback as the default state).
- Confirm the `HeroStats` prop contract (`:92`) is the build target.
- Note day streak is client-derived from `/v1/attempts` (`:111`).

**Hard gate:** Slice 1 waits for this amendment to land on `main` first (mirrors
the pre-deploy plan's D3 spec-gate). Slices 2–5 are unblocked and proceed
meanwhile. **This plan does not author the amendment.**

**Recommendation:** author the amendment as described; gate Slice 1 on it.

### D6 — Missing/enhancement backend endpoints — PENDING

Identified by name and shape; recommend **none built for Tier A**:

- **In-progress attempts list** (only if D1 = Tier B / D3 = Alt 2). MISSING.
  Proposed: `GET /v1/me/attempts?status=in_progress → Page<InProgressAttempt>`
  where `InProgressAttempt = {attempt_id, test_id, pill_id, pill_name,
  started_at, last_activity_at, paused: bool, sequence_number}`. Defer to a
  separate backend workstream.
- **Assignment names** (G5, only if Tier B). ENHANCEMENT: add `pill_name` +
  `learning_path_name` to `AssignmentResponse` (`/v1/me/assignments`). Defer to
  backend workstream.
- **Readings/insights** (only if D2 = (c)). MISSING. Defer.

**Recommendation:** Tier A ships with zero new backend; surface the above as
deferred-to-backend-workstream so they aren't silently dropped.

### D7 — New anchors required? — PENDING

- Wiring `HeroStats` to live competence + deriving streak: **no new anchor**
  (covered by `AC-D9` competence, `AC-D20` confidence, `AC-CD20/21` FE
  routing/query patterns).
- The v1 testee **nav model** (D3) is a product decision. Optionally mint
  **`AC-D27`** to anchor it (next free number; current max `AC-D26`). Proposed
  text:
  > **AC-D27 — v1 testee navigation surface.** The v1 testee rail is
  > `Dashboard · Discover · Latest Result · Competency · History`. "In Progress"
  > is dropped in v1 (resume is surfaced contextually on the dashboard; no
  > in-progress list endpoint exists). "Latest Result" resolves to the most
  > recent submitted attempt's result page. Rationale: the rail must list only
  > destinations that resolve; dead anchors are removed rather than 404. Related:
  > AC-D3, AC-D6; CODE_SPEC AC-CD20.
- Today's Reading removal (D2): amend `AC-D8` framing or note in handover.
  Recommend **handover note**, not a heavyweight anchor.

**Recommendation:** mint `AC-D27` only if the spec author wants the nav model
anchored; otherwise record decisions in the slice handovers. No `AC-CD` needed
(next free `AC-CD25`, unused).

---

## 4. Slice decomposition

Each slice = one logical change, one commit on a fresh branch off latest `main`,
< 2500 lines, fix+test paired. Pipeline depth 2 acceptable (one in CI, one being
authored), per the pre-deploy precedent. Slices auto-continue on clean review
unless a spec-drift pause fires (Slice 1's D5 gate). The executing session
should run `/drift-sweep` against the testee surface before authoring each
slice's diff.

### Dependency / execution graph

```
D5 spec-amendment PR (external, spec-author) ── S1  (wire HeroStats)
                                                  │
S2 (Today's Reading) ─┐                           │
S3 (dead nav)        ─┼─ independent, any order ──┤
S4 (AdaptiveLoopCard)─┘                           │
S5 (drift/dead-code hygiene) ── after S1 (folds Slice-1 comment cleanup)
                                                  │
[Tier B, backend-gated, deferred]                 │
S6 (assignment names)  ── gated on backend enhancement PR
S7 (in-progress page)  ── gated on new backend endpoint PR
```

S2/S3/S4 have **no** inter-dependencies and may run in any order or in parallel
(depth 2). S1 is the only spec-gated slice. S5 trails S1 only because it sweeps
the same stale comments.

---

### Slice 1 — Wire HeroStats to live competence + derived day streak — **SPEC-GATED on D5**

**BLOCKED until the FE-3 spec-amendment PR (D5, separate doc-only PR by the spec
author) lands on `main`.** The executing session waits (honors the spec-drift
pause, `SESSION_START.md`); Slices 2–5 proceed meanwhile.

**Implements:** dashboard hero stats render real data from the already-live
`/v1/me/competence` + `/v1/attempts`, replacing the stale `"—"` / `"v1.x ·
pending"` placeholders (closes smoke-test issue #1).

**Files touched (verified):**
- `frontend/src/components/dashboard/HeroStats.tsx` — adopt the spec prop
  contract (`FE-3-content.md:92`); call `useMeCompetence()` (`me.ts:43`) +
  `useMeAttemptsCapped()` (`me.ts:96`); derive `overallCompetence` (mean
  `competence_estimate`, 1 dp), `workingPlusCount` (count `band ≥ working`),
  `pillCount`, `streakDays`; render loading/empty/populated states; **delete the
  stale `:4-9` "unmounted" comment.**
- `frontend/src/lib/competence/derive-streak.ts` (new) — pure helper:
  consecutive-UTC-day streak from `AttemptListItem[].submitted_at`
  (`FE-3-content.md:111`).
- `frontend/src/app/(authed)/(testee)/page.tsx` — pass derived data / remove the
  stale page-header drift comment.

**Tests (paired):**
- `frontend/tests/components/dashboard/HeroStats.test.tsx` — **rewrite** (G7):
  populated stats from a mocked competence payload; empty (new testee → `0`/`—`
  per spec); loading skeleton; the competence request **does** fire.
- `frontend/tests/pages/dashboard.test.tsx` — **rewrite** the hero assertions to
  the live path (drop "no request fires").
- `frontend/tests/lib/competence/derive-streak.test.ts` (new) — streak edge
  cases (no attempts, single day, gap-breaks-streak, today-inclusive).

**Acceptance:** dashboard hero shows real overall competence (1 dp),
pills-at-working+ count, and day streak from live endpoints; new-testee empty
state is honest (not "pending"); no `"v1.x · pending"` copy remains in
`HeroStats`; `pnpm test` + `pnpm typecheck` green.

**Complexity:** medium (~1 component rewrite + 1 helper + 2 test rewrites + 1 new
test; < 400 lines).

---

### Slice 2 — Today's Reading disposition — gated on D2

**Implements:** removes the fabricated-editorial widget from the primary surface
(D2 recommended = remove) (closes smoke-test issue #2).

**Files touched (verified):**
- `frontend/src/app/(authed)/(testee)/page.tsx` — remove the `<TodaysReading />`
  mount + import.
- `frontend/src/components/dashboard/TodaysReading.tsx`, `frontend/src/data/readings.tsx`
  — delete (if D2 = remove) **or** reframe to neutral, non-fabricated copy (if
  D2 = (b) relabel).

**Tests:**
- `frontend/tests/pages/dashboard.test.tsx` — assert `Today's Reading` no longer
  renders (remove) / renders neutral labeled copy (relabel).
- Remove/adjust any `readings`/`TodaysReading` test if present.

**Acceptance:** the dashboard contains no widget asserting fabricated competence;
`pnpm test` green.

**Complexity:** small (< 120 lines, mostly deletions).

---

### Slice 3 — Dead-nav resolution — gated on D3

**Implements:** no testee nav item 404s (closes smoke-test issue #3).

**Files touched (verified):**
- `frontend/src/components/shell/Rail.tsx:31-38` — remove the `In Progress`
  (`/attempts`) item; update the `Latest Result` (`/results`) item per D3.
- `frontend/src/app/(authed)/(testee)/results/page.tsx` (new, if D3 = redirect)
  — fetch latest submitted attempt via `useMeAttemptsCapped(1)`; `redirect` to
  `/attempts/{id}/result`; honest empty state when none.
- Sweep the `Rail.tsx:7-9` placeholder comment to reflect the now-resolved nav.

**Tests:**
- `frontend/tests/components/shell/Rail.test.tsx` (and the FE-2 nav assertion at
  `FE-2-shell.md:344`) — update the expected `TESTEE_NAV` label set.
- `frontend/tests/pages/results-redirect.test.tsx` (new, if redirect) — latest
  attempt → redirect target; empty → empty state.

**Acceptance:** clicking every testee nav item resolves (no 404); the
`TESTEE_NAV` set matches the D3 ruling; `pnpm test` + `pnpm typecheck` green.

**Complexity:** small–medium (< 250 lines).

---

### Slice 4 — Dashboard AdaptiveLoopCard disposition — gated on D4

**Implements:** the dashboard no longer renders a hardcoded loop narrative with
no-op CTAs (D4 recommended = remove).

**Files touched (verified):**
- `frontend/src/app/(authed)/(testee)/page.tsx` — remove the
  `<AdaptiveLoopCard />` mount + import (remove path); adjust the dashboard grid.
- `frontend/src/components/dashboard/AdaptiveLoopCard.tsx` — delete (remove) **or**
  rewire to the latest attempt's `result.adaptive_loop` + real CTA routes (wire
  path, D4 alt).

**Tests:**
- `frontend/tests/pages/dashboard.test.tsx` — assert the dashboard card is gone
  (remove) / renders real loop steps from a mocked latest-result (wire).

**Acceptance:** no dashboard widget renders hardcoded "two weak areas" / no-op
toast CTAs; `pnpm test` green.

**Complexity:** small (remove; < 120 lines) / medium (wire).

---

### Slice 5 — Drift-comment + dead-code hygiene — after S1

**Implements:** removes the now-false "endpoint absent / coming in v1.x" copy
and stale comments left across the testee surface (G6, G8), so code and live
reality agree.

**Files touched (verified):**
- `frontend/src/app/(authed)/(testee)/profile/page.tsx`,
  `frontend/src/app/(authed)/(testee)/history/page.tsx` — keep the 404/405
  defensive guard but replace the misleading "arrives once we light up the
  endpoint" copy with a neutral generic-error message.
- Any residual stale "unmounted/absent" comments not already swept by S1.
- (No spec edits here — the FE-3 spec correction is the D5 standalone PR.)

**Tests:**
- Update profile/history error-state tests to the neutral copy.

**Acceptance:** no testee-facing copy claims a live endpoint is unbuilt;
defensive 404 handling preserved; `pnpm test` green.

**Complexity:** small (< 150 lines).

---

### Slice 6 — [Tier B, DEFERRED] Assignment names in `/v1/me/assignments`

**Gated on D1 = Tier B + a backend enhancement PR** adding `pill_name` /
`learning_path_name` to `AssignmentResponse` landing on `main` first. FE then
renders real names in `AssignmentsCard` and drops the generic "Learning path"
fallback. Not in the Tier-A redeploy.

### Slice 7 — [Tier B, DEFERRED] In-Progress attempts page

**Gated on D1 = Tier B / D3 = Alt 2 + a new backend endpoint** (`GET
/v1/me/attempts?status=in_progress`, shape in D6) landing on `main` first. Then
restore the `/attempts` nav item + page. Not in the Tier-A redeploy.

---

## 5. Test-pairing matrix

| Slice | Change | Test (paired in same commit) |
|---|---|---|
| 1 | Wire HeroStats | `HeroStats.test.tsx` (rewrite) + `dashboard.test.tsx` (rewrite) + `derive-streak.test.ts` (new) |
| 2 | Today's Reading | `dashboard.test.tsx` (assert removed/relabeled) |
| 3 | Dead nav | `Rail.test.tsx` (nav set) + `results-redirect.test.tsx` (new, if redirect) |
| 4 | AdaptiveLoopCard | `dashboard.test.tsx` (assert removed/wired) |
| 5 | Drift/dead-code hygiene | profile/history error-state tests (copy) |

---

## 6. Risk register

- **R1 — Spec-gate stall (Slice 1).** If the D5 amendment PR doesn't land, Slice
  1 cannot start. *Mitigation:* Slices 2–5 are independent and proceed; D5 is a
  one-file doc PR.
- **R2 — Empty-state semantics for new testees.** `/v1/me/competence` returns
  `{pills: []}` for a new account (`competency.py:43-45`). The hero must render
  an honest zero/empty state, **not** revert to "pending." *Mitigation:* Slice 1
  acceptance + a dedicated empty-state test.
- **R3 — Streak derivation correctness.** Client-side UTC-day streak is easy to
  get subtly wrong (timezone, today-inclusive, gaps). *Mitigation:* pure helper
  + dedicated edge-case test; mirror the UTC-day approach already proven in
  `readings.tsx:64-78`.
- **R4 — Test rewrites mask regressions.** Rewriting `dashboard.test.tsx` /
  `HeroStats.test.tsx` (G7) risks weakening coverage. *Mitigation:* the rewrite
  must add the live-path assertion, not just delete the stub assertion;
  reviewer checks the diff is additive in coverage.
- **R5 — Hidden consumers of removed surfaces.** Removing `TodaysReading` /
  `AdaptiveLoopCard` / readings data may break imports/tests elsewhere.
  *Mitigation:* grep for importers before deletion; `pnpm typecheck` is the gate.
- **R6 — Scope creep into WS1/WS4.** Wiring may tempt typed-contract or
  N+1-batch fixes. *Mitigation:* those are explicitly out of scope (§1); surface
  as out-of-plan findings, do not absorb.

---

## 7. Spec-drift findings & out-of-plan scope (surfaced, not silently resolved)

**Spec drift (for spec-author resolution — feeds D5):**
- `fe-specs/FE-3-content.md:105` / §H(a) item 5 / §E item 1 assert
  `/v1/me/competence` is unmounted; it is live (G1, G6).
- `FE-3-content.md:92` defines a `HeroStats` prop contract the component never
  implemented (G1) — implementation drift.

**Out-of-plan scope (found while grounding; NOT absorbed):**
- Assignment learning-path names (G5) — backend enhancement; Tier B / D6.
- `AttemptListItem.competence_delta` is always `None` in the current backend
  slice → `RecentAttemptsCard` delta always renders `—`. Cosmetic; tied to a
  backend computation, out of this FE workstream.
- The dashboard `recentAttemptsWidget` flag module is now an empty skeleton
  (`FE-3-content.md:652, :735`) — harmless dead scaffold; leave for a future
  cleanup, do not touch here.

---

## 8. Workstream acceptance criteria (definition of done)

1. **No placeholder copy** of the form `"v1.x · pending"` remains on any testee
   dashboard widget; the hero renders live competence + streak (Slice 1).
2. **No testee nav item 404s**; the `TESTEE_NAV` set matches the D3 ruling
   (Slice 3).
3. **No fabricated-as-live content** on the dashboard (Today's Reading resolved,
   Slice 2; AdaptiveLoopCard resolved, Slice 4).
4. **No testee-facing copy** claims a live endpoint is unbuilt (Slice 5).
5. All slices: CI green (vitest + `pnpm typecheck`; Playwright unaffected),
   fix+test paired, < 2500 lines each, one commit per slice on a fresh branch.
6. Decisions D1–D7 are ruled by the spec author before the slices they gate
   open; D5's spec-amendment PR is merged to `main` before Slice 1 starts.
7. Each merged slice carries a handover per `HANDOVER_TEMPLATE.md`; the final
   handover records the v1 testee surface state and the Tier-B/C deferrals.

---

*Plan grounded read-only against `main` at authoring time; citations are
`file:line`. Decisions D1–D7 are PENDING spec-author ruling. The execution
session opens after this plan PR merges.*
