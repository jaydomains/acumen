# Workstream handover — Post-audit pre-deploy fix workstream (SEALED)

**Date sealed:** 2026-06-07
**Plan:** `plans/2026-06-06-post-audit-pre-deploy-fix-workstream.md` (squash `621a549`/#94)
**Authoritative source:** `audits/2026-06-02-prod-readiness-synthesis.md` §F (ledger / workstreams / tier split)
**Outcome:** **Complete.** The pre-deploy **code** tier (C1, V4, V5, V1, V2) is shipped and on `main`. This is the production redeploy gate for the KBC pilot.

This is the workstream-level capstone. Per-slice 9-section handovers live alongside it (`PR-098`/`PR-099`/`PR-100`/`PR-102`).

---

## 1. Slices shipped (4 — all merged to `main`)

| Slice | Finding(s) | PR | Squash | Handover |
|---|---|---|---|---|
| 1 · WS-A | **C1** — setup/reset email links 404 (path shape + frontend-host) | #98 | `d88705d` | `PR-098-s1-auth-activation-path.md` |
| 2 · WS-B | **V4** result page blank-on-error + **V5** GradingOverlay infinite spinner | #99 | `7f4f674` | `PR-099-s2-result-flow.md` |
| 3 · WS-C | **V1** admin recovery loop (role-aware 404/403/500 CTA) | #100 | `1c10b7e` | `PR-100-s3-recovery-cta.md` |
| 4 · WS-C | **V2** rendered `AC-Dxx` anchor IDs (testee-facing scope, 13 sites) | #102 | `ddc59ac` | `PR-102-s4-anchor-id-leak.md` |

All five pre-deploy code findings from the synthesis F.3 ledger are closed (C1 blocker; V4/V5 high; V1/V2 serious). V3 (privacy-copy legal sign-off) was an operator/legal gate handled offline by the spec author — never in this workstream's code scope.

## 2. Spec amendments shipped (3 doc-only PRs — the spec-drift gates)

| PR | Amendment | Author | Gated |
|---|---|---|---|
| #96 (`83e7b43`) | AC-CD5 — setup/reset email link contract (D2b) | spec author (`J`) | Slice 1 |
| #97 (`9988aa0`) | FE-3 §B.4.6/§B.3 — Safety* verbatim copy (D3) | spec author (`J`) | Slice 4b |
| #101 (`40b81cd`) | FE-4/FE-5/FE-9 — strip `· AC-Dxx` from spec-verbatim eyebrows/phase copy | **separate Claude session** (`01K13tng…`) at the spec author's explicit "Option (a)" direction | Slice 4 |

> The plan body refers to "5 merged spec amendments" counting the AC-CD5 (#96) and FE-3 (#97) amendments plus their in-body anchor edits; the three standalone amendment **PRs** are #96/#97/#101. #101 was authored by a session distinct from this executor (`018p4Ti…`), honoring the spec-drift rule (`SESSION_START.md:80–85`) that the implementing session must not author the amendment that unblocks it. (Audit F1 — ratified by the overseer at merge.)

## 3. V2 scope outcome

- **Closed:** V2's **audited testee-facing scope** — 13 rendered `AC-Dxx` sites (plan's 7 + 6 found in verify-before-write). All 13 carry non-vacuous regression coverage (audit-verified).
- **Deferred (post-deploy UI-hygiene tier):** ~15 rendered `AC-D` occurrences in **admin** surfaces — ~8 spec-verbatim eyebrows (`system-page` ×4, `cost-dashboard`, `engagement/pending-list`, `loop-queue`, `calibration-view` — likely intentional ops scaffolding, **spec-author ruling needed**), ~7 admin tooltips/inline text (`users-list`, `safety-tab`, `groups`/`group-detail`, `override-drawer`), + ~3 mock-fixture instances (test data). These were never in V2's audited testee scope (auditor1 Finding 5: the testee sweep "didn't reach admin"). Full detail in `PR-102`'s discovery section.
- **F3 deferred (post-deploy):** `FE-4-runner.md:136` (amended by #101) re-quotes phase iii as `… · OpenAI gpt-4o-mini · 60s ceiling`, but `GradingOverlay.tsx:53` renders `… · OpenAI · 60s ceiling` — pre-existing spec/code divergence (Slice 4 only stripped ` per AC-D19`; the model name was never in the phase copy). Spec author to reconcile (drop from FE-4:136 or restore to the phase copy).

## 4. Carry-forward backlog (out of this workstream)

- **Admin `AC-D` occurrences (~15 sites)** — spec-author ruling (intentional ops scaffolding vs leak); if leak, a post-deploy FE-8/FE-9 amendment cycle (like #101) for the eyebrows + direct strip for tooltips.
- **F3 — FE-4:136 model-name spec/code divergence** — post-deploy reconcile (see §3).
- **Original audit-cycle WS1–WS4 remainder** — typed wire contracts + seam tests (WS1); transactional CRUD+audit+validation service + tenant repo (WS2); real-DB integration tier + FE-contract tests (WS3); observability + hot-path perf + a11y (WS4). Still unstarted.
- **DEC-S3-C** — `meQueryKeys.attempts()` invalidation on submit (≤30s stale window on hero/profile/history/results). Deferred.
- **FE-3 §7** — catalogue per-card competence overlay. Deferred.
- **Production-readiness post-deploy tier:** UI-hygiene batch (C2, V8, V9, V10, V12 + theme tokens); engagement/cost correctness (V7 + audit-4 S2-M1); streaming auth resilience (V11 — prioritize, core flow); dashboard-assignment backend contract (V6).
- **V3** — privacy-copy legal sign-off — offline (spec author), not a code task.
- **counterpart-change-detector skill files** — authored in a separate repo; transport into this repo when ready.

## 5. Process notes / lessons (recorded for future planning)

- **Grounding exhaustiveness failed at every layer — and was caught + surfaced, not buried.** The audit scoped V2 to a testee sweep (6 sites); the plan enumerated 7 (test-lock checked, not `fe-specs/`-checked); execution found 6 more testee sites (→13) and 2 spec-locked "4a" strips — but an intermediate execution grep was `head -40`-truncated, producing a transient "V2 fully closed" over-claim that an untruncated sweep disproved (~28 total). The over-claim was **surfaced explicitly** to the overseer and corrected (PR body + handover rewritten); V2 was re-scoped to its audited testee scope (Option A). **Takeaway:** for "no X in rendered UI" findings, grep the *entire* surface untruncated, cross-check `fe-specs/` verbatim before assuming a string is free, never assert "fully closed" from a piped/truncated grep, and distinguish *audited scope* from the broad property.
- **Spec-drift discipline held throughout:** four spec-verbatim sites surfaced (not silently amended); the executing session never authored a spec amendment; gated work paused until each amendment merged.
- **Pipeline + verify-before-write:** depth-2 pipeline; every intermediate merge gated on a fresh `get_check_runs` three-layer-green poll (CI + Gitar + mergeable); no "looks green" merges; the final slice held for the end-of-execution audit + explicit overseer authorization.
- **Audit outcome:** execution auditor approved #102 (final-marker `ead8fb3`); findings F1–F3 non-blocking; F1 ratified by the overseer, F2 trail recorded verbatim in `PR-102`, F3 carried forward.

## 6. Post-merge validation

- Frontend service bakes its image without a source bind-mount — post-merge local validation requires `docker compose build --no-cache acumen-frontend`.
- Backend (Slice 1): `pytest --ignore=tests/e2e` + `structure_gate` + `mypy app`.
- Frontend (Slices 2–4): `cd frontend && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test --run && pnpm build`.
- A bare `grep -rnE "AC-D[0-9]" frontend/src` still reports the ~15 deferred admin occurrences — expected, not a regression.

---

**Workstream sealed.** Pre-deploy code tier complete; deploy gate cleared pending the operator/legal V3 sign-off. Remaining items are post-deploy carry-forward (§4).
