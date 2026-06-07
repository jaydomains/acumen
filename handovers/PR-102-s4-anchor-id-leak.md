# Handover — PR-102 (Slice 4 · WS-C anchor-ID UI leak) + workstream capstone

## PR identifier and link

- PR: #102 — "Slice 4 — WS-C: strip rendered AC-Dxx anchor IDs from the testee-facing UI (V2)"
- Link: https://github.com/jaydomains/acumen/pull/102
- Author / session: Claude Code — post-audit pre-deploy fix workstream (final slice)
- Date closed: **pending** — final slice held for the end-of-execution audit + explicit user merge authorization (per workstream contract). CI green at push.

## Phase reference

- ROADMAP phase closed by this PR: none (fix workstream, plan `621a549`/#94, Slice 4 of 4 — final).
- Does this PR fully close the phase? Closes **V2's audited testee-facing scope** (13 sites) and completes the pre-deploy code tier (C1, V4, V5, V1, V2). Admin-surface `AC-D` occurrences (~15) are an out-of-plan discovery, deferred to the post-deploy UI-hygiene tier — see the discovery section below.

## What was built

- Files changed (component strips — 13 rendered `AC-Dxx` sites):
  - 4a/plan: `attempt/JITQueue.tsx` (`Queue · AC-D25`→`Queue`), `(admin)/review/_components/grade-review-queue.tsx` (drop `· AC-D19`), `result/loop-step-row.tsx` (drop `AC-D6`), `pill-detail/SafetyPosterCard.tsx` (`Safety pill · AC-D21`→`Safety pill`).
  - 4b/Safety* (spec-locked, FE-3 amended in #97): `pill-detail/SafetyEmpty.tsx` (eyebrow→`Curated industry sources`, footer→`Acumen never generates safety teaching content.`), `pill-detail/SafetyLinks.tsx` (eyebrow).
  - Discovered-in-execution (6): `attempt/GradingOverlay.tsx` (phase iii drop `per AC-D19`, phase iv drop `per AC-D9`), `attempt/IntegrityBadge.tsx` (drop `per AC-D11`; `Integrity surface (AC-D4)`→`Integrity surface`), `admin/safety-toggle.tsx` (drop `(AC-D21)`), `(testee)/pills/[pillId]/page.tsx` (subtitle drop `(AC-D21)`).
- Files added: `frontend/tests/components/anchor-leak-guard.test.tsx` (no-`AC-D\d` render guard, **scoped to V2's testee-facing set** — 6 leaf surfaces).
- Tests changed: `pill-detail/SafetyLinks.test.tsx` (eyebrow + footer → amended copy), `pages/pill-detail.test.tsx` (footer + targeted subtitle guard), `components/result/adaptive-loop-card.test.tsx` (loop-step-row guard), `components/attempt/GradingOverlay.test.tsx` (frozen-phase guard), `pages/admin-grade-review-queue.test.tsx` (eyebrow guard). Together these assert no `AC-D\d` on all 13 stripped sites. Also lands trailing `PR-099` + `PR-100` handovers.
- Summary: strips internal `AC-Dxx` anchor decoration from the 13 testee-facing rendered sites, keeping readable copy. Comments/aria/docstrings untouched except the `SafetyEmpty` docstring quoting the (now-amended) footer copy.

## What was decided in this PR

- **Scope = V2's audited testee-facing set: 13 sites** (overseer-authorized "Option B", then re-confirmed "Option A" once the full picture emerged). The plan enumerated 7; verify-before-write found 6 more testee-facing rendered leaks. (A later exhaustive sweep found the *total* rendered-`AC-D` set across the app is ~28 — the extra ~15 are admin-surface and out of V2's audited scope; see the discovery section.)
- **Spec-lock gate honored:** of the 13, four were spec-verbatim — `GradingOverlay` phase copy (FE-4-runner.md:119, new discovery) and, unexpectedly, two of the plan's "4a, no spec gate" sites (`JITQueue` → FE-5-streaming.md:520; `grade-review-queue` → FE-9-admin-ops.md:248). These were surfaced (not silently amended) and unblocked by the user-authored standalone doc-only amendment **PR #101** (`40b81cd`), which landed on `main` before this commit — same spec-drift pattern as #96/#97. The Safety* group (4b) was already covered by FE-3 amendment #97.
- New anchors: none. Existing anchors depended on: AC-D4/6/9/11/19/21/25 (now removed from UI text only; anchors remain in DECISIONS/CODE_SPEC and in code comments).

## Drift flags raised and how they were resolved

- **Enumeration gap (V2):** plan enumerated 7 sites; actual rendered set is 13. Surfaced to the overseer mid-slice; scope expanded with explicit authorization. See the lesson below.
- **Spec-lock on plan's "test-safe" 4a group:** the plan's G6.1 verified 4a sites had no *test* assertion but did not grep `fe-specs/` for verbatim *spec* citations — so `JITQueue` and `grade-review-queue` (marked "no spec gate") were actually spec-locked. Surfaced; resolved via amendment #101.
- **Over-claim, then corrected (honest record):** an intermediate Slice-4 PR body + an earlier draft of this handover stated "V2 fully closed / grep returns only comments / no visible-text leaks remain." That was based on a `head -40`-**truncated** grep and was wrong. An exhaustive sweep found ~15 more rendered `AC-D` occurrences in admin surfaces. Surfaced to the overseer (not buried); V2 was re-scoped to its audited testee-facing set (Option A); the admin set is deferred (discovery section). The PR body was rewritten to match.

## Out-of-plan discovery — admin-surface AC-D occurrences (~15 sites, deferred)

A full exhaustive sweep (`grep -rnE "AC-D[0-9]" frontend/src`, untruncated) found ~15 rendered `AC-D` occurrences **outside V2's audited testee-facing scope**, all on admin surfaces. The production-readiness audit's V2 was a *testee*-surface sweep — auditor1 explicitly noted "the testee sweep didn't reach admin" (its Finding 5) — so these were never in V2's scope.

- **~8 spec-verbatim eyebrows** (likely *intentional* ops scaffolding for admin power users — needs a spec-author ruling, intentional vs leak): `system/system-page.tsx:84/118/170/203` (`AC-D2/14/24/21 · …`), `cost/cost-dashboard.tsx:46` (`AC-D18 · …`), `engagement/pending-list.tsx:65` (`AC-D26 · …`), `loop/loop-queue.tsx:118` (`AC-D6 · …`), `calibration/calibration-view.tsx:104` (`AC-D27 · …`). These mirror the FE-9 grade-review eyebrow pattern that #101 amended.
- **~7 admin tooltips / inline text** (likely free to strip, but still need verification): `admin/users/users-list.tsx:651` (AC-D14), `admin/catalogue/safety-tab.tsx:134/372` (AC-D21), `admin/groups/groups-list.tsx:112/218/229` + `admin/groups/[groupId]/group-detail.tsx:139/148` (AC-D15 tooltips), `review/override-drawer.tsx:178` (AC-D19).
- **~3 mock-fixture instances** (test data, NOT production): `mocks/handlers.ts:241/248` (pill `description`), `:2349/2389/2451` (error messages).

**Deferred to the post-deploy UI-hygiene tier.** If the spec-author rules the admin eyebrows are leaks: a post-deploy FE-8/FE-9 amendment cycle (like #101) for the eyebrows + direct strip for the tooltips. Tracked here and in the carry-forward backlog.

## Open questions deferred to a later phase — workstream carry-forward backlog

These are explicitly **out of this workstream** (noted per the workstream contract):

- **Admin `AC-D` occurrences (~15 sites)** — spec-author ruling needed on intentional ops scaffolding vs leak; if leak, post-deploy amendment cycle for FE-8/FE-9 eyebrows + direct strip for tooltips. Tracked in the discovery section above.

- **Original audit cycle WS1–WS4 remainder** (typed wire contracts + seam tests; transactional CRUD+audit+validation; real-DB integration tier; observability/perf/a11y) — still unstarted.
- **DEC-S3-C** — `meQueryKeys.attempts()` invalidation on submit (≤30s stale window) — deferred.
- **FE-3 §7** — catalogue per-card competence overlay — deferred.
- **Post-deploy tier (production-readiness audit):** UI-hygiene batch (C2, V8, V9, V10, V12 + theme tokens); engagement/cost correctness (V7 + audit-4 S2-M1); streaming auth resilience (V11 — prioritize, core flow); dashboard-assignment backend contract (V6).
- **V3** — privacy-copy legal sign-off — handled offline by the spec author (not a code task).
- **counterpart-change-detector skill files** — being authored in a separate repo; transport into this repo when ready.

## Build state vs spec

- Complete: pre-deploy code tier (C1 #98, V4+V5 #99, V1 #100, V2 #102) — **V2's audited testee-facing scope** closed across 13 rendered sites, spec-aligned (#97 + #101).
- Partial: V2 in the broad "no `AC-D` anywhere in the app" sense — ~15 admin-surface occurrences remain (out of audited scope; discovery section; post-deploy tier).
- Stubbed: none.

## Test coverage and CI results

- Tests: new `anchor-leak-guard.test.tsx` (6 cases, scoped to V2's testee set); rewrote the 3 Safety* coupled assertions to the amended copy; added `not.toMatch(/AC-D\d/)` guards to the render tests for the remaining stripped sites (GradingOverlay frozen phases, loop-step-row, grade-review eyebrow, pill-detail subtitle) so all 13 have anti-regression coverage. The guard is **deliberately scoped** to the 13 V2 sites — not a codebase-wide `AC-D` check (which would correctly fail on the deferred admin set).
- CI result: local `pnpm lint` / `format:check` / `typecheck` / `test --run` / `build` all green at push. **Merge pending** end-of-execution audit + user authorization — no merge performed.
- Manual verification: `grep -rnE "AC-D[0-9]" frontend/src` over the **13 testee-facing sites** returns only comments/docstrings; the ~15 admin-surface occurrences are tracked in the discovery section (out of V2 scope), not silently removed.

## Post-merge validation considerations

- Frontend image bakes without a source bind-mount — `docker compose build --no-cache acumen-frontend` before post-merge local re-verification.
- Re-verify: `cd frontend && pnpm test --run tests/components/anchor-leak-guard.test.tsx tests/components/pill-detail/SafetyLinks.test.tsx tests/pages/pill-detail.test.tsx tests/components/attempt/GradingOverlay.test.tsx tests/pages/admin-grade-review-queue.test.tsx`. Note: a bare `grep -rnE "AC-D[0-9]" frontend/src` will still report the ~15 admin-surface occurrences (out of V2 scope, deferred) — that is expected, not a regression.

## Anything a fresh Claude Code session needs to pick up cleanly

- **Lesson — grounding-exhaustiveness failed at every layer, including execution (record for future plans):**
  1. The **audit** scoped V2 to a testee-surface sweep (6 sites) and explicitly didn't reach admin.
  2. The **plan** enumerated 7 and checked *test*-locks but not `fe-specs/` verbatim citations.
  3. **Execution verification** then found 6 more testee-facing sites (→ 13) and 2 spec-locked "4a" strips — good — **but its own confirming grep was `head -40`-truncated**, which produced an *over-claim* ("V2 fully closed / no leaks remain") that an untruncated sweep disproved (~15 admin occurrences; ~28 total).
  - **Takeaways:** for any "no X rendered in UI" finding, (a) grep the *entire* rendered surface untruncated; (b) cross-check `fe-specs/` verbatim before assuming a string is free to change; (c) never assert "fully closed" from a piped/truncated grep; (d) distinguish *audited scope* (here: testee-facing) from the broad property — V2 closed its audited scope, with the broader admin set surfaced and deferred, not silently absorbed or silently dropped. The over-claim was recoverable because it was surfaced explicitly rather than buried.
- Workstream sequence: Slice 1 `#98` (`d88705d`), Slice 2 `#99` (`7f4f674`), Slice 3 `#100` (`1c10b7e`), spec amendments `#96`/`#97`/`#101`, Slice 4 `#102` (this — pending audit + authorization).
- This is the production redeploy gate for the KBC pilot. After audit sign-off + merge authorization, squash-merge `#102`, delete the branch, and author this slice's final `Date closed` line.
