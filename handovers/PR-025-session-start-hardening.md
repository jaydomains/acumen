# Handover — PR-025 SESSION_START hardening

> Doc-only PR. Pays down accumulated SESSION_START / canonical-doc drift
> deferred across PR-014, PR-017, PR-022, PR-023, PR-024. Three slices:
> discipline patterns + cadence-default flip; version-string sweep
> across canonical docs; behavioural-constants dispositions.

## PR identifier and link

- PR: #25 — *SESSION_START hardening — discipline patterns, version-string sweep, behavioural-constants dispositions*
- Link: https://github.com/jaydomains/acumen/pull/25
- Author / session: Claude Code session `014nbFXS3pbQTtmsvVudMoLU` (Opus 4.7 1M)
- Date closed: 2026-05-22

## Phase reference

- ROADMAP phase closed by this PR: **none** — this PR is *interstitial doc hygiene*, not a ROADMAP phase. P0–P11 are complete; P12 (full hardening / end-to-end) is the next operator's call.
- Does this PR fully close the phase? n/a — no phase is being closed. The PR closes a cluster of doc deferrals (footer staleness, undocumented discipline patterns, undocumented constant dispositions) accumulated across PR-014 / PR-017 / PR-022 / PR-023 / PR-024.

## What was built

- Files added: `handovers/PR-025-session-start-hardening.md` (this file).
- Files changed:
  - `SESSION_START.md` — Slice 1 (cadence-default flip + four discipline-pattern bullets) and Slice 2 (deferral-note removal + footer update).
  - `SPEC.md` — Slice 2 (footer to v1.8 with full amendment ledger).
  - `DECISIONS.md` — Slice 2 (footer to v1.8 with full amendment ledger).
  - `CODE_SPEC.md` — Slice 2 (top-blockquote companion-line v1.2 → v1.8; footer v1.4 → v1.8; removes the misleading "One open technical anchor: AC-CD11 (P6 gate)" line) and Slice 3 (new "Intentionally outside `system_settings`" subsection in §4 listing per-item dispositions for seven behavioural constants + the `accept_reviewer` semantic).
- Files removed: none.
- Summary: SESSION_START codifies four discipline patterns (extended AC-D-amendment + new AC-CD-closure pair; in-body override of mirror references; audit-pattern bias-toward-false-positive; reviewer-mode prescriptive-checks lesson) and flips the multi-slice cadence default from "binding pause" to "auto-continue when Gitar green; binding pause is the declared carve-out." The canonical-doc footers are brought from v1.2/v1.4/v1.6 (and CODE_SPEC's misleading open-anchor line) to a consistent v1.8 set. CODE_SPEC §4 gains an explicit disposition table for the seven v1.x tunable-candidate constants flagged across prior PRs plus the `accept_reviewer` pessimistic-zero semantic — default disposition "keep as-is" for all eight.

## What was decided in this PR

- **Multi-slice cadence default inverts.** Auto-continue when Gitar (or equivalent review) returns clean; binding per-slice pauses become the declared carve-out (opted into either at the session opener or inside the plan). Codified in `SESSION_START.md` Working-agreement section. Rationale: P9 / P10 / P11 ran with consistently clean Gitar reviews where the binding pause added latency without catching anything. The safety net stays available on declaration; the default just stops being it. Collapsing past a *declared* binding pause is still a plan deviation requiring explicit user approval.
- **Four discipline patterns codified** in `SESSION_START.md`:
  - Extended **Anchor-discipline** bullet covers both the AC-D amendment pattern (existing, with v1.1 / v1.2 / v1.6 / v1.7 / v1.8 examples) and the new **AC-CD closure pattern** (AC-CD11 v1.7, AC-CD10 v1.8 as canonical examples).
  - **In-body override of mirror references** — canonical authored prose wins over any mirror reference; sweep the mirror, never edit the canonical prose to match a stale mirror. Distinct from the existing `docs/`-vs-root rule.
  - **Audit-pattern discipline** — bias toward false-positive, read-only output, user triages. Protects authored prose from silent auto-edits under audit cover.
  - **Reviewer-mode prescriptive-checks lesson** — do not pre-load "things to watch" checklists before reading the diff; pre-loaded lists bias review toward the listed items and miss what the diff actually does.
- **Behavioural-constants dispositions (v1.8 snapshot)** documented in `CODE_SPEC.md` §4 as an "Intentionally outside `system_settings`" subsection. Eight items, all dispositioned **keep as-is**: `GRADE_REVIEW_RECONCILE_INTERVAL_MINUTES` (5), `GRADE_REVIEW_MAX_RETRY_ATTEMPTS` (10), `GRADE_REVIEW_SUBMIT_CEILING_SECONDS` (60.0), `_FLAG_RATIO_EXCLUSION_THRESHOLD` (0.6), `jit_buffer_size` (3), `jit_buffer_max` (5), `jit_persist_grace_seconds` (10), and the `accept_reviewer` pessimistic-zero semantic. Policy named explicitly: a knob migrates to `system_settings` when an operational signal surfaces (operator request, repeated incident, telemetry-driven sweep). Until then it stays where authored — schema stays minimal.
- New anchors introduced by this PR: **none**. No AC-D, no AC-CD added.
- Existing anchors this PR depends on: AC-D19 v1.6/v1.7 (grade-review reconcile cadence + cross-family review), AC-D22 (Drive RAG anchor-exclusion threshold), AC-D25 v1.8 (JIT streaming env-defaults), AC-CD10 v1.8 (orchestrator cleanup grace), AC-CD11 v1.7 (submit latency ceiling). These are *referenced* in the new disposition table, not amended.

## Drift flags raised and how they were resolved

- **Footer staleness across four canonical docs.** Pre-PR state: SPEC footer at v1.6, DECISIONS footer at v1.2, CODE_SPEC top blockquote at v1.2 + footer at v1.4 + a misleading "One open technical anchor: AC-CD11 (P6 gate)" line (AC-CD11 closed at v1.7; AC-CD10 closed at v1.8), SESSION_START footer at v1.2 + an explicit deferral note in the Current-state body. Pattern: prior PRs (PR-011 / PR-013 / PR-014 / PR-017) ran a "header-only precedent" so phase work could ship without doc-bookkeeping friction; the consolidated sweep was deliberately deferred to this hardening PR. **Resolution**: Slice 2 swept all four. Post-PR state: all footers and the CODE_SPEC top-blockquote companion-line read v1.8; the AC-CD11-open line is replaced with "No open technical anchors (AC-CD11 closed at v1.7; AC-CD10 closed at v1.8)"; the SESSION_START deferral note is removed (now obsolete).
- **Discipline patterns surfaced but uncodified.** PR-014 / PR-017 / PR-021 / PR-022 / PR-023 / PR-024 generated working rules (AC-CD closure as distinct from AC-D amendment; in-body authored-prose override; audit bias-toward-false-positive; reviewer-mode no-pre-loaded-checklist) that lived in handover bodies and operator memory. **Resolution**: Slice 1 codified all four in SESSION_START's Working-agreement section, with file-and-PR precedents inline.
- **Behavioural constants without a documented disposition.** Each of the seven constants carried an inline code-comment hint at "v1.x candidate for system_settings" but the v1.x catalogue lived only in handover bodies; the `accept_reviewer` pessimistic-zero semantic was implemented in PR-018 without a phrase-of-art codification in AC-D19. **Resolution**: Slice 3 added the explicit disposition subsection to CODE_SPEC §4 next to the `system_settings` columns list. The disposition is "keep as-is" for all eight; no operational signal has surfaced to motivate a schema migration.
- **Plan-to-execution drift on Slice 3 location.** Plan named "CODE_SPEC §5" as the disposition home; CODE_SPEC §5 is "API shape & conventions". The actual `system_settings` column documentation lives in **CODE_SPEC §4** ("Database schema & migration strategy"), where Slice 3 was inserted at write-time. The plan's intent — "natural complement to where `system_settings` is documented" — is preserved; the section number was a plan typo. Noted in the Slice 3 commit message.
- **Cron-count bookkeeping ("six crons" → "seven crons" stragglers).** PR-014 introduced the seventh cron; subsequent PR audits noted scattered "six crons" mentions and asked whether a sweep was complete. **Resolution**: Slice 3's Phase-1 grep confirms all *live* canonical/runtime files (SPEC, CODE_SPEC, SESSION_START, ROADMAP, CHECKLIST, `app/`, tests) read "seven crons." All remaining "six crons" mentions live only in immutable handovers (PR-014, PR-017, PR-022, PR-024) describing the six→seven transition. **No edit needed.**

## Open questions deferred to a later phase

- **Promotion of v1.x tunable candidates to `system_settings` columns.** The disposition table records the v1.8 snapshot, not a binding forever-decision. When an operational signal surfaces (operator-tuning request, repeated incident, telemetry-driven threshold sweep), the trigger for each knob is a follow-up doc-only AC-D/AC-CD amendment plus the corresponding Alembic migration. Most likely candidates if signal emerges first: `GRADE_REVIEW_SUBMIT_CEILING_SECONDS` (telemetry-conditioned per in-code comment) and the JIT trio (already env-tunable, lowest friction to promote).
- **`accept_reviewer` pessimistic-zero codification.** Phrase deliberately not codified in AC-D19 in this PR; trigger for codification is an operator questioning the zeroing behaviour. If the trigger arrives, the change is a focused AC-D19 amendment (one anchor, one bullet) — not a v1.8-class hardening pass.
- **Multi-tenancy on cost-budget sweep, SQL push-down for `_live_anchor_counts_by_band`, frontend SSE consumer, real-Postgres E2E for Q1-failure rate-limit-no-burn, P12 hardening / full E2E.** All carried forward from PR-024 — out of scope for this doc-only hardening PR; ownership reverts to the next operator (P12 plan-mode).

## Build state vs spec

- Complete: all three slices land doc edits that match the approved plan. SESSION_START reads internally consistent under the new cadence default. Canonical-doc footers and the CODE_SPEC companion-line all reference v1.8. CODE_SPEC §4 carries an explicit "outside `system_settings`" subsection with the eight-row disposition table.
- Partial: none. The PR is one-shot doc-hygiene; nothing is started-but-incomplete.
- Stubbed: none. No code or interfaces touched.

## Test coverage and CI results

- Tests added / changed: none — this is a doc-only PR. No test file in the diff.
- Coverage delta or current coverage: n/a — no executable code changed.
- CI result at merge: all green at HEAD `627f642`.
  - Gitar: ✅ success (run 77359298034, completed 2026-05-22T10:10:37Z). Approved both the Slice-1 head and the Slice-2+3 head (re-run on push) — "No issues found" on both.
  - GitHub Actions `checks` × 2: ✅ success (runs 77359308342 / 77359301137, completed ~2026-05-22T10:11:11Z).
- Manual verification performed:
  - `grep -nE "(paired with|companion to|document set|status:\s*v1\.)" SPEC.md DECISIONS.md CODE_SPEC.md SESSION_START.md | grep -iE "v1\.[0-7]\b"` → empty (no stale pairings post-Slice-2).
  - `grep -n "AC-CD11" CODE_SPEC.md` → all matches are historical/closed-status references; no "open" mention remains.
  - `grep -nE "six crons|six cron jobs" SPEC.md CODE_SPEC.md SESSION_START.md ROADMAP.md CHECKLIST.md app/ -r` → empty in live files (only handovers retain the historical phrase, as expected).
  - Read SESSION_START end-to-end after Slice 1 to confirm the cadence flip and four new bullets read coherently in the Working-agreement section.

## Anything a fresh Claude Code session needs to pick up cleanly

- **Required reading beyond SESSION_START**: none beyond the standard set. The discipline patterns codified in Slice 1 should be picked up on the first read of the new SESSION_START Working-agreement section.
- **The cadence default has flipped.** A multi-slice plan now defaults to **auto-continue when each slice's Gitar review is clean**. Binding per-slice pauses are still available — they're declared either at the session opener ("execute with binding pauses") or inside the plan for slices whose foundational decision warrants pre-Slice-N review. If a future PR involves a pattern flip, schema migration, or security-sensitive boundary, the plan should explicitly declare the binding-pause carve-out for the relevant slice boundary. (This PR itself ran under the old binding-pause rule because Slice 1's pattern flip was consequential enough to review before Slice 2 — user direction at the session opener.)
- **CODE_SPEC §4 disposition table is the v1.8 snapshot.** When code is touched near any of the eight listed knobs (`grade_review.py`, `drive_rag.py`, `config.py`'s jit settings, the `accept_reviewer` resolve path), check this table before promoting a constant — promotion is doc-policy-gated on an operational signal, not on convenience.
- **No open technical anchors (AC-CD) remain.** Both pre-build gates (AC-CD11 at v1.7, AC-CD10 at v1.8) closed prior to this PR. Footer claims to "open AC-CDs" should be treated as drift if they reappear.
- **Plan typo on Slice 3 location.** The plan named "CODE_SPEC §5" as the disposition home; the actual home is **CODE_SPEC §4** (§5 is API conventions). A future reader of the plan file at `/root/.claude/plans/starting-acumen-session-start-hardening-scalable-milner.md` should know the section number was corrected at write-time.
- **Recommended next action.** Merge this PR; next session starts fresh against the new `main`, reads the updated SESSION_START Working-agreement, and picks P12 (or whatever the next operator decides) under the new cadence default.
