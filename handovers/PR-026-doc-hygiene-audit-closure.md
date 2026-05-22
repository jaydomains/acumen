# Handover — PR-026 doc-hygiene audit closure (post-PR-025)

> Doc-only PR. Closes six findings from the post-PR-025 verification
> audit. Single editorial pass under the PR-025 auto-continue default;
> one follow-up commit when CI surfaced a structure-gate breach the
> audit had under-rated.

## PR identifier and link

- PR: #26 — *doc-hygiene: close 6 verification-audit findings (post-PR-025)*
- Link: https://github.com/jaydomains/acumen/pull/26
- Author / session: Claude Code session `01SoqN5GCMduzBZERULpCsAn` (Opus 4.7 1M)
- Date closed: 2026-05-22

## Phase reference

- ROADMAP phase closed by this PR: **none** — interstitial doc hygiene, same class as PR-014 / PR-017 / PR-022 / PR-025. P0–P11 are complete; P12 (full hardening / end-to-end) remains the next operator's call.
- Does this PR fully close the phase? n/a — no phase closed. The PR closes a cluster of doc deferrals surfaced by the post-PR-025 verification audit (built rows still marked `missing`, one missing handover, stale stub references in the done-when prose, drifted current-state phasing, mis-rated stub deletions, an eroded test-directory placeholder).

## What was built

- Files added:
  - `handovers/PR-018-p6-cross-family-review.md` — post-hoc handover for PR-018 (the only gap in the otherwise-complete sequence). Opening paragraph marks it as post-hoc per the working-agreement.
  - `handovers/PR-026-doc-hygiene-audit-closure.md` — this file.
  - `tests/e2e/README.md` — seed README explaining the directory's reserved state (v1 has no E2E harness; P12 is the intended home).
- Files changed:
  - `CHECKLIST.md` — F1: P6 rows 87–89 flipped `missing` → `built` with `test_p6_*` evidence + corrected "Files to touch" columns.
  - `ROADMAP.md` — F3: line 106 retargeted from the stub `app/routers/review.py` to `app/domain/grade_review.py:324` (`asyncio.wait_for` site) + named the `GRADE_REVIEW_SUBMIT_CEILING_SECONDS = 60.0` constant at line 85.
  - `SESSION_START.md` — F4: "Current state" bumped from "P0–P9 landed / 2 phases remain" to "P0–P11 landed / no remaining phases" (PR-023 P10 + PR-024 P11 reflected); "Open items (none)" wording updated; line 294 module reference swept (F5 spillover).
  - `CODE_SPEC.md` — F5 spillover: line 696 `app/routers/review.py (planned at P6)` → `app/domain/grade_review.py (_review_ai_grades)` (drop the now-stale "planned at P6" tense).
  - `app/routers/{review,competency,grading,loop}.py` — F5: initially deleted, then restored in the follow-up commit (see below) with docstrings upgraded to match `app/routers/internal.py`'s "RESERVED, unmounted in v1" framing.
- Files removed: `tests/e2e/.gitkeep` (replaced by the seeded README).
- Summary: closes the six post-PR-025 audit findings as a single editorial slice under the new auto-continue default. One follow-up commit reversed the F5 deletions when CI surfaced a structure-gate breach the audit had under-rated, restoring the four files as documented RESERVED port seams so the structure-gate contract holds without requiring an AC-CD2 amendment.

## What was decided in this PR

- **F1 (high) — CHECKLIST.md P6 rows 87–89 flipped `missing` → `built`.** PR-018 shipped at merge `7003dd7` on 2026-05-20 but the three P6 rows were never updated. Row 87's "Files to touch" also pointed at the stub `app/routers/review.py` rather than the real surface (`app/domain/grade_review.py` + `app/routers/admin.py`). Evidence cells now name the specific tests + line-numbered code sites.
- **F2 (high) — Post-hoc PR-018 handover authored.** Reconstructed from slice commits `5559929` → `a17c6df` → `ad20b56` → `32b8972` → `3efaa5f` → `9e5ab36`, merge `7003dd7`, the v1.7 spec set (CODE_SPEC §11 + §18 AC-CD11; DECISIONS AC-D19 v1.7; SPEC §6.6 / §4.8), and the implementation that landed at merge. Opening paragraph carries the post-hoc disclosure verbatim per the working-agreement obligation. Length / depth match the bracketing handovers (PR-017 at 346 lines; PR-019 at 433 lines).
- **F3 (medium) — ROADMAP.md:106 retargeted.** The 60-s submit-deadline enforcer is `app/domain/grade_review.py:324` (`asyncio.wait_for` inside `_review_ai_grades`), wrapping the constant `GRADE_REVIEW_SUBMIT_CEILING_SECONDS = 60.0` at line 85. Both line numbers cited inline.
- **F4 (medium) — SESSION_START.md current state bumped from P9 to P11.** Three stale passages updated: the "P0–P9 landed / 2 phases remain" block (lines 348–356) → "P0–P11 landed / no remaining phases"; the "Open items (none)" wording (lines 313–315) extended with the actual PR-023 / PR-024 landings; line 294's cross-family review module reference swept as part of F5 spillover. Other phase-identifier mentions (lines 27, 53–54, 196, 213–214, 216) are static enumerations and remain accurate.
- **F5 (low) — Four stub routers initially deleted, then restored as RESERVED port seams (follow-up commit).** Initial commit deleted `app/routers/{review,competency,grading,loop}.py` (each a 6–7-line module-docstring-only stub with zero code imports). Structure-gate CI broke; see "Drift flags" for the audit-pattern lesson. Follow-up restored the four with docstrings upgraded to parallel `internal.py`'s explicit "RESERVED, unmounted in v1" framing — port-seam intent, v1 implementation surface citation, admin-consolidation note (where applicable), and the "not included by app.main" mount-status line. AC-CD2 / CODE_SPEC §3 unchanged. Live-state doc-reference sweeps (CODE_SPEC.md:696, SESSION_START.md:294, plus the CHECKLIST + ROADMAP edits already covered in F1 / F3) stand on their own — they retarget to the real implementation surfaces regardless of whether the stubs exist.
- **F6 (informational) — tests/e2e/ README seed.** `.gitkeep` replaced by a README explaining (a) v1 has no live E2E harness, (b) `tests/integration/test_p11_bootstrap_idempotent.py::test_bootstrap_re_run_is_counter_zero_no_op` discharges the ROADMAP.md:198 idempotency risk note, (c) `ROADMAP.md:200` preserves the directory as the conditional P12 home.
- **Auto-continue cadence honoured.** Single editorial pass for the initial commit; one focused follow-up for the F5 reversal when CI flagged the structure-gate breach. No per-slice binding pause declared or needed. Matches the PR-025 default-flip.
- New anchors introduced: **none**. Existing anchors referenced (no amendments): AC-D19 / AC-CD11 (P6); AC-D9 (P7 competence); AC-D6 (P7 loop); AC-D5 / AC-D19 (grading); AC-D23 / AC-CD7 (P11 bootstrap idempotency); AC-CD2 (repository layout — the structure-gate authority).

## Drift flags raised and how they were resolved

- **F5 mis-rating: structure-gate dependency missed.** The audit rated F5 as `low — verify zero imports first`. Zero code imports was satisfied — but `scripts/structure_gate.py` (the CODE_SPEC §3 / AC-CD2 enforcer, with pytest hard gate at `tests/unit/test_structure_gate.py::test_required_paths_present`) requires *all* listed routers exist on disk, not just the ones with runtime imports. CI failed on the initial commit. **Resolution**: follow-up commit restored the four files with upgraded "RESERVED" docstrings (see F5 above); no AC-CD2 amendment needed.
- **PR description body updated with the lesson.** Added a "Follow-up: F5 partially reverted" section near the top of the PR body so the structural-file audit lesson surfaces in the merged history without requiring a reader to dig into commit messages. PR-018 handover's "Open questions deferred" section also gained a forward-looking note on the AC-CD2-per-feature-router-layout vs admin-consolidation-reality divergence (the underlying spec/implementation tension F5 surfaced).
- **No other spec drift.** The verification audit's six findings were the full scope. The post-hoc PR-018 handover reconstruction confirms PR-018's spec alignment was clean at merge — no retroactive drift discovered during the reconstruction pass.

## Open questions deferred to a later phase

- **AC-CD2 / CODE_SPEC §3 layout vs admin-consolidation reality.** Documented in the updated PR-018 handover's "Open questions deferred" section. The v1 implementation concentrates admin surfaces in `app/routers/admin.py` and leaves four per-feature routers (review, grading, loop, competency) as unmounted stubs. A future v1.x decision either (a) amends AC-CD2 / §3 to reflect the admin-consolidation pattern, or (b) populates the per-feature routers as thin pass-throughs (most likely for Testee-facing surfaces — "show me my review verdict", "list my pending follow-ups", "show me my per-pill competence_estimate"). Not blocking; flagged so the next layout audit doesn't relitigate from scratch.
- **P12 (full hardening / end-to-end) ownership.** Same disposition as at PR-025 close. ROADMAP.md:200 carries the conditional. The seeded `tests/e2e/README.md` reserves the directory but defers the plan.

## Build state vs spec

- Complete: all six findings closed; the F5 follow-up resolved the structure-gate breach. Live-state doc references (CHECKLIST, ROADMAP, CODE_SPEC, SESSION_START) consistently retarget to the real implementation surfaces. Two new handovers (PR-018 post-hoc, PR-026 this file) added.
- Partial: none. The PR is single-pass doc hygiene; nothing started-but-incomplete.
- Stubbed: none. No code or interfaces touched (the four router files exist as documented RESERVED port seams, unchanged in shape from pre-PR; only their docstrings were upgraded).

## Test coverage and CI results

- Tests added / changed: none — doc-only PR.
- Coverage delta or current coverage: n/a — no executable code changed.
- CI result at merge: see PR #26 final state. Initial commit (`36050c7`) failed the `checks` job on the structure-gate test; follow-up commit (`9c52926`) restored the four routers and `python scripts/structure_gate.py` returns `structure gate: OK` locally. Gitar reviewed both commits ✅ Approved ("No issues found"). The Gitar summary auto-text on the initial commit referenced "removing four unused stub router files" — stale post-follow-up but informational, not actionable.
- Manual verification performed:
  - `python scripts/structure_gate.py` → `structure gate: OK` (post-follow-up; all 17 routers present per CODE_SPEC §3).
  - `grep -rn "app/routers/{review,competency,grading,loop}\.py" --include="*.md"` → matches only in (a) the post-hoc PR-018 handover narrative, (b) the immutable PR-017:250 / PR-019:112 handover references, (c) this handover. Zero hits in live-state docs other than the explicit port-seam framing in CHECKLIST / ROADMAP / CODE_SPEC / SESSION_START referencing them as RESERVED via the new docstrings.
  - `grep -rn "P0–P9 landed\|2 phases remain\|P10 builds against locked" --include="*.md"` → only the immutable PR-022 handover at `:91`; zero live-state hits.
  - Cited tests (`test_submit_writes_grade_review_rows_for_each_ai_grade`, `test_reconcile_flags_pending_when_provider_returns_flagged`, `test_list_flagged_returns_unresolved_only`, `test_bootstrap_re_run_is_counter_zero_no_op`) exist at the cited paths.
  - Cited code sites (`app/domain/grade_review.py:85` constant, `:324` `asyncio.wait_for`, `app/worker.py:60–87` `reconcile_grade_reviews_task`, `app/beat_schedule.py:38–43` 5-min crontab) exist at the cited line numbers.

## Anything a fresh Claude Code session needs to pick up cleanly

- **Audit-pattern discipline update — pre-deletion verification.** Add a working-rule to the next SESSION_START refinement: before recommending a file deletion, audits must verify (a) zero runtime imports (`grep -r "from app.X import" --include="*.py"`), (b) `scripts/structure_gate.py` `_ROUTERS` / `_DOMAIN` / `REQUIRED_PATHS` lists do not require the file, AND (c) `CODE_SPEC.md §3` layout diagram does not enumerate the file. PR-026's initial commit cleared (a) but failed (b) and (c). A "low-priority cleanup" rating is only defensible after clearing all three checks. This is a candidate addition to SESSION_START's "Audit-pattern discipline" bullet (codified at PR-025).
- **The four reserved router stubs read as documented port seams now.** A future audit looking at `app/routers/review.py` / `competency.py` / `grading.py` / `loop.py` and asking "why are these stubs?" should find the answer in the docstring itself (RESERVED, unmounted in v1, CODE_SPEC §3 / AC-CD2; port-seam intent + v1 implementation surface + admin-consolidation note). If a future audit still flags them as dead, that audit should escalate to "amend AC-CD2 / §3" rather than "delete the files" — the structure-gate contract is the authority.
- **PR-018 handover's "Open questions deferred" section is enriched.** A new bullet documents the AC-CD2-per-feature-router-layout vs admin-consolidation-reality divergence (the spec/implementation tension that F5 surfaced). The next layout-touching session should read that bullet before proposing any router-shape change.
- **All canonical-doc footers and current-state are at v1.8 / P0–P11 landed.** Drift signals to watch for in future audits: any reappearance of "P0–P9 landed", "2 phases remain", "planned at P6", or "AC-CD11 (P6 gate) open" should be treated as fresh drift, not historical reference (the historical references are confined to immutable handovers and reading them as live-state is the pattern PR-026 / F1 / F4 were closing).
- **Recommended next action.** Merge this PR; next session starts fresh against the new `main`, reads the updated SESSION_START + PR-018 / PR-026 handovers, and picks P12 (or whatever the next operator decides) under the established auto-continue cadence. If the next session is itself an audit pass, fold the three-check pre-deletion discipline above into its audit checklist.
