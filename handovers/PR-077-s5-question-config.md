# Handover — PR-077 Slice 5: question-config wire reconciliation (X3-H2 escapee)

> Pre-deploy fix workstream, PR 6 of 8 (Slice 5). Authored post-merge per the
> pipelined cadence; rides on the PR-8 (Slice 7) branch.

## PR identifier and link

- PR: #77 — `fix(fe-8): reconcile question-config wire shape to the backend contract (Slice 5 / X3-H2 escapee)`
- Link: https://github.com/jaydomains/acumen/pull/77
- Author / session: Claude Code (`claude/pre-deploy-pr6-s5-question-config`)
- Date closed: 2026-05-31 (squash-merged `7940f2f`)

## Phase reference

- ROADMAP phase: **none** — pre-deploy Slice 5 (audit-5 capstone, the X3-H2
  escapee), the spec-gated slice. Closes the escapee + its golden-fixture
  contract test.
- Fully closes the fix-now item.

## What was built

- Files added: `frontend/tests/data/question-config/{multiple_choice,true_false,matching,short_answer,scenario}.json`
  (golden fixtures); `tests/unit/test_question_config_contract.py` (backend
  contract test).
- Files changed: `frontend/src/lib/tests/compose-question-config.ts`,
  `unpack-question-config.ts`, `question-form.ts`,
  `…/_components/sa-grading-rubric.tsx`, `…/question-editor-inner.tsx`,
  `frontend/src/mocks/handlers.ts` (admin-question seed → new shape),
  `frontend/tests/lib/tests/compose-question-config.test.ts`.
- Summary: the editor composed `config` as `{body, choices|…}` with no
  `prompt`, but the backend's `validate_question_config` (+ presentation +
  grading) require `{prompt, options, correct:int, …}` — so every authored
  question 422'd in production, and short_answer/scenario were un-authorable
  (no `model_answer` field). The FE now emits the backend contract:
  `body→prompt`, MCQ `choices→options[]`+`correct:<index>`, SA/scenario
  `rubric`+`model_answer`; `unpack` is the exact inverse.

## What was decided in this PR

- **Direction forced (D3 / G2):** the FE changes, implemented against the
  amended FE-8 §H(a) (#72). `pill_id`/`is_anchor` ride along as tolerated
  extra keys (backend ignores; FE unpacks for display).
- **`model_answer` is now a required form field** for SA/scenario.
- **Golden fixtures are the single shared source of truth** across the FE
  compose test and the BE validate test — if either side drifts, one goes
  red.
- **Gitar fix-round (1, resolved):** `composeConfig` used
  `Math.max(0, findIndex)` which silently defaulted to choice 0 when no
  correct choice; changed to **throw** so the (zod-guaranteed) invariant
  fails loud rather than submitting the wrong answer key.
- New anchors: none (the §H(a) amendment was PR #72).

## Drift flags raised and how they were resolved

- The MSW admin-question seed used the old `{body, choices}` shape, which
  `unpack` (now reading `options`/`correct`) fell back to empty on → edit/
  save-next flows failed zod. Resolved by moving the seed to the new shape.
- No canonical-doc drift (the §H(a) amendment predates this slice).

## Open questions deferred to a later phase

- **WS1 (post-deploy)** replaces the bare-`object` `config` with a typed
  discriminated union (Pydantic + TypedDict) and subsumes this hand-rolled
  compose/unpack + the golden-fixture contract.
- A legacy `body`/`choices` cached row would unpack via the `prompt`←`body`
  fallback for text only; MCQ legacy rows fall back to empty choices. No such
  rows exist in production (the old shape 422'd on create), so this is purely
  defensive.

## Build state vs spec

- Complete: all 5 types author against the backend contract; SA/scenario
  carry `model_answer`; compose↔unpack round-trips; golden fixtures pass on
  both sides; the contract is enforced (negative cases).
- Partial / Stubbed: none.

## Test coverage and CI results

- Tests: 5 golden fixtures; FE compose deep-equal + round-trips (incl.
  `model_answer`); BE `test_question_config_contract.py` (golden-pass + extra-
  keys-tolerated + missing-prompt/non-int-correct/missing-model_answer
  rejected).
- CI at merge: **all green** — verify-poll on head `afc2949` showed 11/11
  `completed/success` (Gitar approved + check-run, `checks` ×3,
  `migration-chain` ×2, `docker-build` ×2, `e2e` ×2), `mergeable_state:
  clean`.
- Manual: FE `lint`/`format`/`codegen`/`typecheck`/`test`(951)/`build`; BE
  `structure_gate`/`ruff`/`mypy`/`pytest`(906).

## Post-merge validation considerations

- Container-baked without source bind-mount? **Yes** (frontend image +
  backend `acumen`). Local re-validation: `docker compose build --no-cache
  frontend acumen`.
- Re-verify: `cd frontend && pnpm test --run tests/lib/tests/compose-question-config.test.ts`
  and `pytest -q tests/unit/test_question_config_contract.py`.

## Anything a fresh Claude Code session needs to pick up cleanly

- The golden fixtures under `frontend/tests/data/question-config/` are the
  shared FE↔BE contract. **Any new question type or config-key change must
  update the fixtures and keep both the FE compose test and the BE
  `validate_question_config` test green** — they are deliberately coupled.
- `compose` ⇄ `unpack` must remain exact inverses or edit-mode prefill loses
  data.
- Recommended next action: **PR 8 / Slice 7 (deploy hygiene)** — this branch.
