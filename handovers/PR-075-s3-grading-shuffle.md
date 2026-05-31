# Handover — PR-075 Slice 3: grading shuffle inversion (A2-H1) + AC-D24 contract

> Pre-deploy fix workstream, PR 4 of 8 (Slice 3). Authored post-merge per the
> pipelined cadence; rides on the PR-5 (Slice 4) branch.

## PR identifier and link

- PR: #75 — `fix(grading): invert the presentation shuffle at grade time (Slice 3 / A2-H1) + AC-D24 contract`
- Link: https://github.com/jaydomains/acumen/pull/75
- Author / session: Claude Code (`claude/pre-deploy-pr4-s3-grading-shuffle`)
- Date closed: 2026-05-31 (squash-merged `beda289`)

## Phase reference

- ROADMAP phase: **none** — pre-deploy Slice 3 (audit-5 §4 #3). Closes
  A2-H1 + X2-#1, and folds the Decision-D5 AC-D24 doc edit.
- Fully closes the fix-now item.

## What was built

- Files added: `tests/integration/test_p4_grading_shuffle.py`.
- Files changed: `app/domain/attempts.py` (`_grade_permutation` +
  `_grade_mcq`/`_grade_matching`/`_grade_response_score` perm param +
  `_auto_grade_deterministic` seed/perm threading); `DECISIONS.md` (AC-D24
  inversion contract); 7 test fixtures set `randomise_option_order=False`
  (`test_p4_grading`, `test_p4_attempts`, `test_p5_grading`,
  `test_p6_grade_review_submit`, `test_p6_grade_review_reconcile`,
  `test_p6_result_view_gate`, `test_p6_admin_flag_queue`).
- Summary: AC-D24 `randomise_option_order` shuffles the presented order of
  MCQ options / matching right-sides (presented `j` shows original
  `perm[j]`); the Testee submits an index into the **presented** order.
  Grading compared that presented index directly against the original answer
  key, so any non-identity shuffle silently mis-scored MCQ and matching
  (A2-H1). The fix re-derives the exact `_present_one` permutation at grade
  time and inverts it.

## What was decided in this PR

- **Inversion at grade time, lockstep with presentation.** `_grade_permutation`
  mirrors `_present_one` exactly — same `option_permutation(qid, seed, n)`,
  same seed (`attempt.shuffle_seed or seed_for(attempt.id)`), same `n`. The
  grading functions map `perm[submitted] → original` before comparison; they
  also harden against non-int / out-of-range indices.
- **Decision D5 (folded):** `DECISIONS.md` AC-D24 now pins the
  presentation↔grading inversion contract (amendment note + Implications
  paragraph). Code + spec landed in the same slice so the reviewer saw both.
- **Forced test-fixture change (see Drift flags).**
- New anchors: none. AC-D24 amended in place (existing anchor).

## Drift flags raised and how they were resolved

- **The fix has a broad, forced blast radius on the test suite.** The
  FakeSession assigns **random `uuid4`** attempt ids → the shuffle seed is
  random per run. Many existing grading/review/result-view/lifecycle tests
  autosave **original-order** indices and bypass the presentation layer; they
  never truly exercised the option shuffle and only passed because grading
  didn't invert. Under the (now correct) inversion they'd mis-score against
  the random seed — i.e. become **flaky**, not deterministically failing.
  Resolved by setting `randomise_option_order=False` on the 7 affected
  fixtures (they test grading/review logic, not the shuffle — which the new
  dedicated test now owns). None of the 7 asserted shuffle/presentation
  behaviour (verified). This was flagged prominently in the PR body.
- No canonical-doc spec drift (AC-D24 amendment is the D5-ruled edit).

## Open questions deferred to a later phase

- The frontend submit path for shuffled MCQ/matching: this PR fixes the
  **backend** grade-time inversion. The FE renders presented options and
  submits the presented index (correct by construction). No FE change
  needed; the round-trip test exercises the real API.
- `randomise_question_order` (question/block order) is a separate shuffle,
  unaffected by this fix and already covered (`test_p4_shuffle`,
  `test_p4_attempts` block test).

## Build state vs spec

- Complete: inversion for MCQ + matching; unshuffled path unchanged
  (perm `None`); AC-D24 contract documented; X2-#1 (unit inversion math +
  guaranteed-non-identity API round-trips for both types).
- Partial / Stubbed: none.

## Test coverage and CI results

- Tests: new `test_p4_grading_shuffle.py` (6 cases — 3 deterministic unit, 3
  API round-trip); 7 fixture flips.
- CI at merge: **all green** — verify-poll on head `a3a8ad3` showed 11/11
  `completed/success` (Gitar approved + check-run, `checks`,
  `migration-chain`, `docker-build`, `e2e`), `mergeable_state: clean`.
- Manual: local `structure_gate` + `ruff` + `mypy app` (62 clean) +
  `pytest -q --ignore=tests/e2e` run **twice with different random uuids →
  879 passed both** (proving no residual flakiness).

## Post-merge validation considerations

- Container-baked without source bind-mount? **Yes** (`app/domain/attempts.py`
  runs in `acumen`/`acumen-worker`). Local re-validation requires
  `docker compose build --no-cache acumen acumen-worker` before re-running.
- Re-verify: `pytest -q tests/integration/test_p4_grading_shuffle.py
  tests/integration/test_p4_grading.py` (run a few times — the round-trips
  use random seeds and assert under a guaranteed non-identity shuffle).

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading beyond `SESSION_START.md`: plan Slice 3 + §7 risk note
  ("Slice 3 lockstep"); `DECISIONS.md` AC-D24 (now carries the contract).
- **Known trap — lockstep:** `_grade_permutation` must re-derive the EXACT
  permutation `_present_one` applied (same seed, same `option_permutation`
  call, same `n`). Any drift between the two derivations silently
  re-introduces A2-H1. The round-trip test is the guard — keep it.
- **Known trap — test fixtures:** new grading/review tests that autosave a
  deterministic answer as an original-order index MUST set
  `randomise_option_order=False` (or submit the presented index read from
  the attempt view), else they flake on the random FakeSession seed. The
  shuffle path itself is owned by `test_p4_grading_shuffle.py`.
- Recommended next action: **PR 5 / Slice 4 (MCQ form wipe)** — this branch.
