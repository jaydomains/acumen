# Handover — PR-102 (Slice 4 · WS-C anchor-ID UI leak) + workstream capstone

## PR identifier and link

- PR: #102 — "Slice 4 — WS-C: strip rendered AC-Dxx anchor IDs from the UI (V2, full 13-site set)"
- Link: https://github.com/jaydomains/acumen/pull/102
- Author / session: Claude Code — post-audit pre-deploy fix workstream (final slice)
- Date closed: **pending** — final slice held for the end-of-execution audit + explicit user merge authorization (per workstream contract). CI green at push.

## Phase reference

- ROADMAP phase closed by this PR: none (fix workstream, plan `621a549`/#94, Slice 4 of 4 — final).
- Does this PR fully close the phase? Closes V2 in full and completes the pre-deploy code tier (C1, V4, V5, V1, V2).

## What was built

- Files changed (component strips — 13 rendered `AC-Dxx` sites):
  - 4a/plan: `attempt/JITQueue.tsx` (`Queue · AC-D25`→`Queue`), `(admin)/review/_components/grade-review-queue.tsx` (drop `· AC-D19`), `result/loop-step-row.tsx` (drop `AC-D6`), `pill-detail/SafetyPosterCard.tsx` (`Safety pill · AC-D21`→`Safety pill`).
  - 4b/Safety* (spec-locked, FE-3 amended in #97): `pill-detail/SafetyEmpty.tsx` (eyebrow→`Curated industry sources`, footer→`Acumen never generates safety teaching content.`), `pill-detail/SafetyLinks.tsx` (eyebrow).
  - Discovered-in-execution (6): `attempt/GradingOverlay.tsx` (phase iii drop `per AC-D19`, phase iv drop `per AC-D9`), `attempt/IntegrityBadge.tsx` (drop `per AC-D11`; `Integrity surface (AC-D4)`→`Integrity surface`), `admin/safety-toggle.tsx` (drop `(AC-D21)`), `(testee)/pills/[pillId]/page.tsx` (subtitle drop `(AC-D21)`).
- Files added: `frontend/tests/components/anchor-leak-guard.test.tsx` (no-`AC-D\d` render guard on the leaf surfaces).
- Tests changed: `pill-detail/SafetyLinks.test.tsx` (eyebrow + footer assertions → amended copy), `pages/pill-detail.test.tsx` (footer assertion). Also lands trailing `PR-099` + `PR-100` handovers.
- Summary: strips all internal `AC-Dxx` anchor decoration from visible UI text, keeping readable copy. Comments/aria/docstrings untouched except the `SafetyEmpty` docstring quoting the (now-amended) footer copy.

## What was decided in this PR

- **Scope expanded from the plan's 7 sites to the full 13-site V2 set** (overseer-authorized, "Option B"). The 6 extra rendered leaks were found during verify-before-write; the plan was grounded but not exhaustive.
- **Spec-lock gate honored:** of the 13, four were spec-verbatim — `GradingOverlay` phase copy (FE-4-runner.md:119, new discovery) and, unexpectedly, two of the plan's "4a, no spec gate" sites (`JITQueue` → FE-5-streaming.md:520; `grade-review-queue` → FE-9-admin-ops.md:248). These were surfaced (not silently amended) and unblocked by the user-authored standalone doc-only amendment **PR #101** (`40b81cd`), which landed on `main` before this commit — same spec-drift pattern as #96/#97. The Safety* group (4b) was already covered by FE-3 amendment #97.
- New anchors: none. Existing anchors depended on: AC-D4/6/9/11/19/21/25 (now removed from UI text only; anchors remain in DECISIONS/CODE_SPEC and in code comments).

## Drift flags raised and how they were resolved

- **Enumeration gap (V2):** plan enumerated 7 sites; actual rendered set is 13. Surfaced to the overseer mid-slice; scope expanded with explicit authorization. See the lesson below.
- **Spec-lock on plan's "test-safe" 4a group:** the plan's G6.1 verified 4a sites had no *test* assertion but did not grep `fe-specs/` for verbatim *spec* citations — so `JITQueue` and `grade-review-queue` (marked "no spec gate") were actually spec-locked. Surfaced; resolved via amendment #101.

## Open questions deferred to a later phase — workstream carry-forward backlog

These are explicitly **out of this workstream** (noted per the workstream contract):

- **Original audit cycle WS1–WS4 remainder** (typed wire contracts + seam tests; transactional CRUD+audit+validation; real-DB integration tier; observability/perf/a11y) — still unstarted.
- **DEC-S3-C** — `meQueryKeys.attempts()` invalidation on submit (≤30s stale window) — deferred.
- **FE-3 §7** — catalogue per-card competence overlay — deferred.
- **Post-deploy tier (production-readiness audit):** UI-hygiene batch (C2, V8, V9, V10, V12 + theme tokens); engagement/cost correctness (V7 + audit-4 S2-M1); streaming auth resilience (V11 — prioritize, core flow); dashboard-assignment backend contract (V6).
- **V3** — privacy-copy legal sign-off — handled offline by the spec author (not a code task).
- **counterpart-change-detector skill files** — being authored in a separate repo; transport into this repo when ready.

## Build state vs spec

- Complete: pre-deploy code tier (C1 #98, V4+V5 #99, V1 #100, V2 #102) — V2 fully closed across all 13 rendered sites, spec-aligned (#97 + #101).
- Partial / Stubbed: none.

## Test coverage and CI results

- Tests: new `anchor-leak-guard.test.tsx` (4 cases); rewrote the 3 Safety* coupled assertions to the amended copy; existing render tests cover the remaining stripped surfaces.
- CI result: local `pnpm lint` / `format:check` / `typecheck` / `test --run` (**989 passed**, 135 files) / `build` all green at push. **Merge pending** end-of-execution audit + user authorization — no merge performed.
- Manual verification: `grep -rnE "AC-D[0-9]" frontend/src` over rendered JSX returns only comments/aria/docstrings/anchor-banners; no visible-text leaks remain.

## Post-merge validation considerations

- Frontend image bakes without a source bind-mount — `docker compose build --no-cache acumen-frontend` before post-merge local re-verification.
- Re-verify: `cd frontend && pnpm test --run tests/components/anchor-leak-guard.test.tsx tests/components/pill-detail/SafetyLinks.test.tsx tests/pages/pill-detail.test.tsx`, plus `grep -rnE "AC-D[0-9]" frontend/src` to confirm no rendered-text anchor survives.

## Anything a fresh Claude Code session needs to pick up cleanly

- **Lesson — planning grounding was not exhaustive (record for future plans):** the V2 plan enumerated 7 sites from the audit's sample + a test-lock check; execution verification (full `grep -rE 'AC-D[0-9]'` over `src/` rendered JSX **plus** a `fe-specs/` verbatim cross-check) found **13** — 6 unenumerated rendered sites and 2 supposedly-free 4a strips that were actually spec-verbatim. For any "no X in rendered UI" finding, ground against the *full* rendered surface and cross-check spec citations, not the audit's enumeration alone. The end-of-execution audit should find zero rendered leaks **because** the executor closed the gap (and surfaced it) rather than because the plan was complete.
- Workstream sequence: Slice 1 `#98` (`d88705d`), Slice 2 `#99` (`7f4f674`), Slice 3 `#100` (`1c10b7e`), spec amendments `#96`/`#97`/`#101`, Slice 4 `#102` (this — pending audit + authorization).
- This is the production redeploy gate for the KBC pilot. After audit sign-off + merge authorization, squash-merge `#102`, delete the branch, and author this slice's final `Date closed` line.
