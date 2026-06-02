# Handover — PR-092 Slice 5: honest profile/history error states + drift-comment hygiene — FINAL

> Testee FE completion workstream, PR 5 of 5 (Slice 5) — the final slice.
> Authored on its own branch before the user-authorized final merge (the final
> merge is the one merge this workstream reserves for explicit user sign-off);
> the merge SHA + date are recorded by the merge itself. Carries the Slice 4
> handover (PR-091), this Slice 5 handover, and the workstream summary below.

## PR identifier and link

- PR: #92 — `Slice 5 — honest profile/history error states + drift-comment hygiene`
- Link: https://github.com/jaydomains/acumen/pull/92
- Author / session: Claude Code (`claude/testee-fe-s5-hygiene`)
- Date closed: 2026-06-02 (merged on explicit user authorization after a fresh
  three-layer verify-poll)

## Phase reference

- ROADMAP phase: **none** — post-roadmap testee-FE completion (Tier A), Slice 5
  of 5 (the final slice). Closes workstream acceptance #4 (no testee-facing copy
  claims a live endpoint is unbuilt). Not gated on any spec PR.
- Fully closes Slice 5 **and** the Tier-A workstream.

## What was built

- Files added: none.
- Files changed: `frontend/src/app/(authed)/(testee)/profile/page.tsx`,
  `frontend/src/app/(authed)/(testee)/history/page.tsx`,
  `frontend/src/app/(authed)/(testee)/profile/error.tsx`,
  `frontend/src/app/(authed)/(testee)/history/error.tsx`,
  `frontend/src/components/pill-detail/PillMetaCard.tsx`,
  `frontend/tests/pages/profile-page.test.tsx`,
  `frontend/tests/pages/history-page.test.tsx`,
  `frontend/tests/integration/auth-roundtrip.test.tsx`,
  `frontend/tests/integration/shell-roundtrip.test.tsx`.
- Files removed: none.
- Summary: the `/profile` + `/history` 404/405 branches kept their inline guard
  but were reframed from "endpoint absent / Coming in v1.x / arrives once we light
  up the endpoint" to a neutral load error (`loadError`, testid `*-error`,
  "Unavailable" eyebrow + "We couldn't load … please try again shortly"). The
  `PillMetaCard` JSDoc + two integration-test comments were swept off the stale
  "unmounted" framing.

## What was decided in this PR

- **DEC-S5-A — reframe AND rename** the 404/405 branch (honest `loadError` /
  `*-error` identifiers + neutral copy), not copy-only.
- **DEC-S5-B — keep the inline 404/405 guard** (gentler than blanking via the
  Pattern C boundary); non-404/405 still throw to the boundary.
- **PillMetaCard** per-Testee rows reframed as a deferred v1.x overlay *feature*,
  not a missing endpoint.
- New anchors: none. Error ≠ empty preserved (the 404/405 branch returns before
  the empty check).

## Drift flags raised and how they were resolved

- None new — this slice *is* the drift cleanup. The full testee-surface
  "unmounted"/v1.x-pending sweep is now complete across S1 (dashboard) + S5
  (profile/history/PillMetaCard/integration tests). Remaining "unmounted" hits are
  genuine React-lifecycle uses (`privacy/layout`, `auth/context`,
  `use-streaming-queue` test) and the nav-active `layout.tsx` "light up" prose —
  intentionally left (inverse-mirror-sweep guard).

## Open questions deferred to a later phase

- **Admin-surface "Coming in v1.x"** copy (`admin/users` list, `cost` dashboard)
  is outside the testee workstream scope — not touched.

## Build state vs spec

- Complete: no testee-facing copy claims a live endpoint is unbuilt; the
  profile/history 404/405 render a neutral error card with honest `*-error`
  testids; non-404/405 still escalate to the boundary; error stays distinct from
  empty.
- Partial / Stubbed: none.

## Test coverage and CI results

- Tests: reframed (not deleted) the profile/history error-state tests (same 404
  trigger, assert neutral copy + absence of false copy); corrected two
  integration-test comments. One local fix-round: the initial
  `/unavailable|couldn't load/i` assertion matched both the eyebrow and body
  (multiple-match), narrowed to the unique body copy; plus a Prettier pass.
- CI at merge: [recorded by the merge] — final merge proceeds only on a fresh
  `get_check_runs` three-layer verify-poll (every check `success`, zero
  `in_progress`, `mergeable_state: clean`, Gitar approved).
- Manual verification: local `typecheck` / `lint` / `format:check` / `test --run`
  (133 files / 973) green.

## Post-merge validation considerations

- FE-only; no dependency/config change. Re-verify locally: `cd frontend && pnpm
  install && pnpm test --run tests/pages/profile-page.test.tsx
  tests/pages/history-page.test.tsx tests/integration/auth-roundtrip.test.tsx
  tests/integration/shell-roundtrip.test.tsx`.

## Anything a fresh Claude Code session needs to pick up cleanly

- Pre-push gate must include `pnpm format:check` (Prettier) alongside `pnpm lint`.
- Recommended next action: the Tier-A testee-completion workstream is complete
  (see the summary below); the parked items are the next candidates.

---

## Workstream summary (Testee FE completion — Tier A, all 5 slices)

The post-roadmap testee-FE completion pass closed the three production
smoke-test defect classes with **zero new backend** (all endpoints were already
live; the defects were stale placeholders + dead surfaces):

| Slice | PR | Outcome |
|---|---|---|
| 1 | #88 | HeroStats wired to live `/v1/me/competence` + `/v1/attempts` (container; derived overall competence, pills-at-working+, day streak); honest empty/error states; new `derive-streak.ts`. |
| 2 | #89 | Today's Reading widget removed (fabricated competence claims). |
| 3 | #90 | Dead nav resolved — In-Progress removed, Latest Result (`/results`) redirects to the latest result. v1 `TESTEE_NAV` = Dashboard · Discover · Latest Result · Competency · History. |
| 4 | #91 | Dashboard AdaptiveLoopCard removed (real per-attempt loop kept on the result page). |
| 5 | #92 | Honest profile/history load-error states + testee-surface drift-comment sweep. |

**Workstream acceptance (definition of done) — all met:** no `"v1.x · pending"`
copy on any dashboard widget; no testee nav item 404s; no fabricated-as-live
content; no testee-facing copy claims a live endpoint is unbuilt; each slice CI
green, fix+test paired, one squash PR per slice on a fresh branch; each slice
carries a 9-section handover.

**Gate clearances:** D5 FE-3 amendment (#86) → Slice 1; D3 FE-2-shell amendment
(#87) → Slice 3. Both merged before their gated slice executed.

### Carry-forward backlog (parked — NOT touched in this workstream)

1. **FE-3 `:231` / §E item 7 — catalogue per-card competence overlay.** Still
   stale-vs-code: the competence endpoint is live but the catalogue `PillCard`
   per-Testee overlay feature is genuinely unwired. Different surface (catalogue,
   not dashboard). Park for separate triage. (Slice 5 only reworded the
   `PillMetaCard` *comment* to reflect this as a deferred feature; the overlay
   itself remains unbuilt.)
2. **DEC-S3-C — `meQueryKeys.attempts()` is never invalidated on submit.** Every
   attempt-flow `invalidateQueries` targets `attemptQueryKeys.detail` only, so the
   capped/infinite attempts list is stale for ≤ `staleTime: 30s` after a submit —
   affecting the hero day-streak, `/profile` sparkline, `/history`, and (absent
   the `/results` mount-fresh gate) "Latest Result". The systemic fix (invalidate
   `meQueryKeys.attempts()` in the grading/submit flow — `GradingOverlay` /
   `use-streaming-queue`) touches the runner, out of this nav/dashboard-scoped
   workstream. Slice 3's `/results` correctness is fully handled by the
   `useMeAttemptsCapped(1)` + `isFetchedAfterMount` gate; sealed Slice 1 was not
   reopened.

### Tier B / C (deferred, backend-gated — never in Tier-A scope)

- Slice 6 — assignment learning-path names (`pill_name` / `learning_path_name` on
  `/v1/me/assignments`); backend enhancement.
- Slice 7 — In-Progress attempts page (needs a new `GET /v1/me/attempts?status=in_progress`
  endpoint).
- Dashboard-level adaptive-loop surface + dynamic readings/insights (Tier C).
