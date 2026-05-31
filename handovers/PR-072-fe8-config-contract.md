# Handover — PR-072 FE-8 §H(a) config-contract spec amendment

> Pre-deploy fix workstream, PR 1 of 8 (the spec-amendment that unblocks
> Slice 5 / PR 6). Authored post-merge per the pipelined workstream cadence;
> committed on the PR-2 (Slice 1) branch because PR-072 was already squash-
> merged when this handover was written.

## PR identifier and link

- PR: #72 — `spec(fe-8): amend §H(a) item 2 — config contract {body,choices} → {prompt,options,correct,model_answer}`
- Link: https://github.com/jaydomains/acumen/pull/72
- Author / session: Claude Code (`claude/pre-deploy-pr1-fe8-config-contract`)
- Date closed: 2026-05-31 (squash-merged `57e51d0`)

## Phase reference

- ROADMAP phase closed by this PR: **none** — this is not a ROADMAP/FE
  phase. It is the pre-deploy fix workstream's **spec-clarification PR**
  (plan decision **D3**, `plans/2026-05-31-pre-deploy-fix-workstream.md`).
  FE-8 itself closed at PR-062 (#65); this PR amends the FE-8 detail spec.
- Does this PR fully close the phase? **N/A.** It is a doc-only gate: it
  clears the spec-drift that blocked Slice 5 (X3-H2 question-config
  escapee) from opening. Slice 5 / PR 6 implements against the corrected
  text in a later, separate PR.

## What was built

- Files added: none.
- Files changed: `fe-specs/FE-8-admin-tests.md` (§H(a) item 2 only; +58 / −1).
- Files removed: none.
- Summary: §H(a) item 2 previously locked `QuestionCreate.config` as
  **FE-owned** with per-type keys `{body, choices}` (MCQ
  `choices:[{id,text,correct:bool}]`; short_answer/scenario `{rubric}`
  only). The pre-deploy audit cycle (audit-5 capstone, verified against
  the backend) found the backend's own presentation + grading already read
  a **different** key set. The amendment rewrites item 2 to lock the
  **backend-validated runtime key contract** — `prompt` (all types), MCQ
  `options[]`+`correct:int`, true_false `correct:bool`, matching `pairs[]`,
  short_answer/scenario `rubric`+**`model_answer`** — and marks the
  illustrative §B.3 §4 zod schemas + §B.3 §6/§7 references as superseded
  (in-body override pattern).

## What was decided in this PR

- **The direction of the question-config reconciliation is forced: the FE
  changes, not the backend.** Grounded against current `main` (HEAD
  `ae80990`): `app/domain/tests.py::validate_question_config` requires
  `prompt` for every type, MCQ `options`+`correct:int`, true_false
  `correct:bool`, matching `pairs`, short_answer/scenario `rubric`+
  `model_answer`; `app/domain/attempts.py::_present_one` reads
  `config.get("prompt")`; `_grade_mcq` compares `config.get("correct")` as
  an int. A validator relaxation to accept `{body, choices}` would still
  mis-present/mis-grade, so it is foreclosed.
- **`model_answer` is newly required** for short_answer/scenario. The
  original lock carried only `rubric`, leaving those two types
  structurally un-authorable (they 422 on `validate_question_config`). This
  widens Slice 5 beyond a pure prompt/options rename (plan G2).
- New anchors introduced: **none.** This amends an existing FE-8 detail
  spec; no SPEC.md / DECISIONS.md (AC-D) / CODE_SPEC.md (AC-CD) edits were
  required or made.
- Existing anchors this PR depends on: AC-D5 (question types), AC-CD19 (FE
  stack), AC-CD6 (the `/v1` contract the backend validator backs); the
  `SESSION_START.md` in-body override pattern (this item supersedes the
  stale §B.3 illustrative schemas).

## Drift flags raised and how they were resolved

- **The drift this PR exists to resolve:** FE-compose (`{body, choices}`)
  vs BE-validate (`{prompt, options, correct, model_answer}`). Resolved by
  **correcting the spec** (this PR), not the implementation — the FE code
  fix is Slice 5 / PR 6, which is hard-gated on this amendment being on
  `main` first (honours the `SESSION_START.md` spec-drift-pause rule: the
  drift is surfaced and the spec corrected before the implementing slice
  opens).
- **Intra-file contradiction introduced + disposed:** §B.3 §4 zod schemas
  and §B.3 §6/§7 Gherkin/notes still show `{body, choices}`. Rather than
  edit them in this scoped single-file amendment, item 2 declares them
  **superseded** via the in-body override pattern; the pre-deploy
  question-config slice (Slice 5) realigns them when it lands the FE code.

## Open questions deferred to a later phase

- **Slice 5 (X3-H2) FE implementation** — `compose-question-config.ts` +
  `unpack-question-config.ts` + `question-form.ts` (add required
  `model_answer` to the rubric schema) + a rubric-editor `model_answer`
  input must be reconciled to the contract this PR locked. Gated on this PR
  (now merged). The golden-fixture contract test (FE-compose deep-equals a
  fixture that **also** passes `validate_question_config`) is the seam X2
  found uncovered.
- **Per-type discriminated-union *typing*** of `QuestionCreate.config`
  (bare `object`/`dict` today) stays deferred to v1.x / **WS1** — out of
  pre-deploy scope.
- **`pill_id` / `is_anchor` packing** — the editor carries them but the
  authored-frozen-question endpoint does not read them (pill comes from the
  owning `Test`; anchor membership is the separate `pill_id`-owned path).
  Whether Slice 5 keeps them as tolerated extra `config` keys or drops them
  is a build-slice detail, explicitly outside the locked key contract.

## Build state vs spec

- Complete: §H(a) item 2 now states the backend-validated key contract; the
  spec is internally consistent via the explicit supersede note.
- Partial: the FE code (`compose-question-config.ts` et al.) still emits the
  old `{body, choices}` shape — that is Slice 5's job, intentionally not in
  this PR.
- Stubbed: none.

## Test coverage and CI results

- Tests added / changed: none (doc-only).
- Coverage delta: none.
- CI result at merge: **all green.** Fresh `get_check_runs` verify-poll
  before merge showed 11/11 check runs `completed/success` (Gitar review
  approved + Gitar check-run success, `checks`, `migration-chain`,
  `docker-build`, `e2e` all success), zero `in_progress`,
  `mergeable_state: clean`, `draft: false`.
- Manual verification performed: backend reality cross-checked by reading
  `validate_question_config`, `_present_one`, `_grade_mcq`/`_grade_matching`
  before authoring the amendment text.

## Post-merge validation considerations

- Does this PR touch container-baked code without a source bind-mount?
  **No** — doc-only (`fe-specs/`). No `docker compose build` needed; the
  stale-image trap does not apply.
- Re-verify command: `git show 57e51d0 -- fe-specs/FE-8-admin-tests.md`
  (confirms §H(a) item 2 reads the corrected contract). No runtime check.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading beyond `SESSION_START.md`: the workstream plan
  `plans/2026-05-31-pre-deploy-fix-workstream.md` (esp. §G2 + Decision D3
  + Slice 5), and `fe-specs/FE-8-admin-tests.md §H(a)` (now amended).
- Environment / setup notes: none.
- Known traps: when Slice 5 lands, **do not** re-litigate the direction —
  it is forced and locked here. Add `model_answer` as a required field, not
  just a prompt/options rename. Keep `unpack` the exact inverse of
  `compose` or edit-mode loses the correct-choice/model_answer on reload
  (plan §7 risk note).
- Recommended next action: **PR 2 / Slice 1 (A3-L1 role literal)** — this
  branch. Slice 5 / PR 6 opens only after this amendment is on `main`
  (now satisfied).
