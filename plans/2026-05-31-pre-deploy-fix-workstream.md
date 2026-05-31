# Pre-deploy fix workstream — plan

**Date:** 2026-05-31
**Branch:** `claude/zen-bell-VMa3b`
**Authoritative source:** `audits/2026-05-30-audit-5-improvements.md` §"CROSS-AUDIT SYNTHESIS" §4 (fix-now tier) + §5 (deployment-readiness pass).
**Status:** rev-2 — spec-author rulings D1–D6 folded; re-entering auditor review. rev-1's two final-markers are **invalidated** by this revision (halt-class) and re-apply only after the auditor re-reviews rev-2 HEAD.

> **What this package is.** The merge of this package is the production
> deployment gate for KBC. Nothing else stands between the current
> `main` and going live except hosting + DNS. Scope is the audit-cycle
> **pre-deploy tier**: the 5 locked fix-now items (each paired with its
> X2 test gap) plus the WS4 pre-deploy subset. WS1, WS2, WS3, and the
> WS4 remainder are **post-deploy** and out of scope here (audit-5
> §3, §5 "Post-deploy workstream sequencing").

---

## 1. Scope lock (from triage — not re-litigated)

Locked at audit-5 close (`audit-5:103-109`), carried verbatim:

- **Fix-now (5, sequenced):** A3-L1 (role literal) → A4-S3-C (stub AI) →
  A2-H1 (grading shuffle) → A2-H2 (MCQ form wipe) → question-config
  escapee (X3-H2).
- Each fix lands **with** its X2 test pairing in the same slice (fix and
  test do not split into separate slices).
- **WS4 pre-deploy subset** (`audit-5:86`, `:93-94`): startup
  key/secret check, Celery task-failure surfacing, CORS prod-origin
  verification, required-env-var docs.
- **Out of scope (post-deploy):** WS1 (typed wire contracts), WS2
  (transactional CRUD+audit+validation service), WS3 (real-DB
  integration tier), WS4 remainder (competence/cost N+1 batch-load,
  admin-`Field` a11y labels, aria-live gaps).

The 5 patches are deliberately targeted now and later **subsumed by
WS1** (role enum, config union) post-deploy (`audit-5:82`). Patch first
for speed; let WS1 generalise.

---

## 2. Grounding notes (verified against the codebase)

Each fix-now claim was re-verified read-only against current `main`
(HEAD `640ca14`). Three findings are **larger or different** than the
audit text — surfaced here because "a plan unverified against the
codebase is just a story."

### G1 — Role literal is **bidirectional**, not "one literal" (refines A3-L1)
- Backend canonical: `ROLE_ADMINISTRATOR = "administrator"`
  (`app/permissions.py:65`); `VALID_ROLES` rejects anything else; the
  `Role` schema validator is a passthrough that 422s non-members
  (`app/schemas.py:38-44`).
- **Read side** (wire→FE): `narrowRole` accepts only `"admin"|"testee"`
  → returns `null` for `"administrator"`
  (`frontend/src/lib/auth/context.tsx:71-72`). Downstream the FE codes
  `role === "admin"` directly in `Rail.tsx:82-84`, `guards.tsx:41`,
  `(admin)/layout.tsx:18,29`, and `users-list.tsx:333`. A real admin
  narrows to `null` → admin `Gate` routes to `/403`.
- **Write side** (FE→wire): user create/edit submits `role: values.role`
  where the value is the literal `"admin"` (`users-list.tsx:441`, role
  radio values `:687/:700`, filter value `:174`); the role filter query
  sends `role: filters.role ?? null` (`admin-users.ts:54`). Backend
  receives `"admin"` → `422 invalid_role`.
- **Why both audits & green tests missed it:** `schema.json` types
  `role` as bare `string` (no enum → no tsc catch); every FE mock uses
  `"admin"` (`handlers.ts:1990`, and the handler validates
  `role === "admin" || role === "testee"` at `:2073`) — the FE cohort is
  self-consistent on the wrong literal.
- **Consequence for the plan:** a one-line `narrowRole` patch fixes only
  the read side. The fix must seam **both** directions. See **Decision
  D1**.

### G2 — Question-config escapee has a **third, un-audited gap** (extends X3-H2)
FE→BE shape divergence, per type (`compose-question-config.ts:35-52`
vs `validate_question_config` `app/domain/tests.py:319-390`):

| Type | FE `composeConfig` emits | BE validator requires | BE present/grade reads |
|---|---|---|---|
| (all) | `body` | `prompt` (str, required) `tests.py:328-330` | `config.get("prompt")` `attempts.py:_present_one` |
| `multiple_choice` | `choices:[{id,text,correct:bool}]` | `options:[str\|{text,image_url}]` + `correct:int` `tests.py:332-355` | `config.get("options")`, `config.get("correct")` (int) `_grade_mcq` |
| `true_false` | `correct:bool` | `correct:bool` ✅ | `config.get("correct")` ✅ |
| `matching` | `pairs:[{left,right}]` | `pairs:[{left,right}]` ✅ | `config.get("pairs")` ✅ |
| `short_answer`/`scenario` | `rubric:str` | `rubric:str` **+ `model_answer:str` (required)** `tests.py:382-388` | (AI-graded) |

- **Direction is forced.** The audit left it open ("reconcile FE … or
  vice-versa", `audit-5:80`). Grounding forecloses "vice-versa": the
  backend's **own** presentation (`_present_one`, reads
  `config.get("prompt")`/`("options")`) and grading (`_grade_mcq`,
  compares `config.get("correct")` as an int) already speak
  `{prompt, options, correct}`. Changing the validator to accept
  `{body, choices}` would still render blank prompts and mis-grade.
  **The FE is the side that must change.**
- **The missed gap.** `validate_question_config` requires `model_answer`
  for short_answer/scenario (`tests.py:382-388`), but the FE
  `rubricConfigSchema` has **only** `rubric` — no `model_answer` field,
  no editor input (`question-form.ts` rubric branch). So those two types
  are not merely 422-ing on `prompt`: they are **structurally
  un-authorable** even after a prompt/options fix. This widens Slice 5.
- **Spec collision.** The `{body, choices}` shape is a **LOCKED** v1
  contract — `compose-question-config.ts:7-10` and `question-form.ts`
  header both cite "FE-8 admin-tests §H(a) item 2 LOCKED". Reconciling
  the FE contradicts a locked fe-spec → **spec-drift, which Acumen
  discipline forbids resolving silently** (`SESSION_START.md:80-85`,
  auto-continue rule (a) `:199-208`). See **Decision D3** — Slice 5 is
  spec-gated.

### G3 — Startup check must respect the structure-gate (constrains A4-S3-C)
- `resolve_provider` returns `_STUB` on an empty key with **no log**
  (`app/ai/provider.py:378-383`); its docstring promises a startup
  warning (`:361`) that does not exist; `app/main.py` has no
  lifespan/startup hook (verified — `main.py:36-131` is factory +
  health probes + CORS + router includes only).
- **Constraint:** `scripts/structure_gate.py` forbids `app/main.py` from
  importing `app.domain`/`app.models`/`app.ai`/`app.worker`/`celery`/
  `sqlalchemy` (`structure_gate.py:88-99`). So the startup check **may
  not** import `app.ai` to inspect the provider. It must read only
  `settings` (from `app.config`, already imported at `main.py:16`) —
  which is sufficient: every relevant value
  (`anthropic_api_key`/`openai_api_key`/`app_secret_key`/`jwt_secret`/
  `cors_allowed_origins_list`/`app_env`) lives on `Settings`
  (`app/config.py:31,47,53,61,93-97`). **Plan:** the validation helper
  lives in `app/config.py`; `main.py` calls it from a FastAPI lifespan
  using stdlib `logging` only. No structure-gate change, no new module —
  inside the AC-CD2 "setup-only" envelope.

### G4 — Test surfaces (confirms the X2 pairings are runnable in CI)
- Backend: `pytest --ignore=tests/e2e` runs the FakeSession unit/
  integration suite (`ci.yml:36`); a separate job runs real-PG
  `tests/e2e/` (`ci.yml:91-97`). All four backend-side pairings here are
  pure-function / settings / signal tests → FakeSession-tier, **not**
  the e2e job (that expansion is WS3, post-deploy).
- Frontend: vitest + Playwright (`frontend.yml`). The role + MCQ + compose
  pairings are component/unit tests under `frontend/tests/`.

### G5 — `msw` ships in prod `dependencies` (audit X4 trivial item)
`"msw": "^2.14.6"` sits in `dependencies` (`frontend/package.json:43`),
not `devDependencies` (block starts `:53`). The mock-service-worker is
bundled into the production install. Audit-5 tags this "trivial
fix-now … next maintenance pass" (`audit-5:107`). It is deployment
hygiene → folded into Slice 7. See **Decision D4** (include vs defer).

---

## 3. Decisions needed (spec-author ruling) — load-bearing, do not pick silently

> Per the workstream contract, these are surfaced in the plan body for
> the spec author to rule on. Recommended option listed first.

### D1 — Canonical wire role literal (gates Slice 1) — ✅ RULED (rev-2)
**Ruling:** backend `"administrator"` stays canonical; FE adds a
bidirectional mapping seam (`fromWireRole`/`toWireRole`) — WS1-aligned.
Slice 1 covers the three write sites (`users-list.tsx:441`/`:525`/`:536`),
the `:333` display, the role filter site, and the edit-modal value-diff
comparator. The X2-#3 test pairing **must include the edit-modal
no-op-edit case** (the auditor's verified refinement finding — a no-op
save on an `"administrator"` user must send no `role` and not 422).
*(Rejected alt: backend remap at the schema boundary — diverges from
internal `ROLE_ADMINISTRATOR`, not WS1-aligned, larger surface.)*

### D2 — Startup-check severity + environment gating (gates Slice 2) — ✅ RULED (rev-2)
**Ruling — default-strict, explicit relax-for-dev:**
- **WARN** (structured log) on missing AI key(s), in **every** env — the
  A4-S3-C fix (the stub is no longer silently served as real).
- **RAISE on boot** when `app_env != "dev"` **AND** any of:
  `app_secret_key == "change-me"`, `jwt_secret == "change-me"`,
  `cors_allowed_origins_list` is wildcard (`"*"`) or localhost.
- **Sentinel is `!= "dev"`, not `== "production"`** — this fails *closed*:
  an unknown/misconfigured `app_env` value fails strict (RAISE) rather
  than fail-open. This **supersedes** the earlier "wildcard CORS → WARN"
  softening considered during round-1; under this ruling wildcard/
  localhost CORS in any non-dev env is a **RAISE**, not a warning.

### D3 — FE-8 §H(a) spec amendment (BLOCKS Slice 5) — ✅ RULED (rev-2)
**Ruling:** the spec author authors a **separate, standalone**
spec-clarification PR amending `fe-specs/FE-8-admin-tests.md` §H(a) from
`{body, choices}` to `{prompt, options, correct, model_answer}`. Doc-only
single-file PR; lands on `main` independently of this plan. Direction is
forced (G2: BE presentation+grading already read these keys).
- **This plan does NOT author the amendment** — it is a separate
  workstream owned by the spec author.
- **Hard sequencing gate:** Slice 5 is gated on the §H(a) amendment
  landing on `main` **first**. The executing session **waits** for that
  PR before starting Slice 5 (honours the spec-drift pause,
  `SESSION_START.md:199-208`). Slices 1–4, 6, 7 are unblocked and proceed
  while Slice 5 waits. See the Slice 5 header and the §4 execution graph.

### D4 — Pre-deploy scope candidates — ✅ RULED (rev-2)
- **`msw` → `devDependencies`** (G5): **INCLUDE** in Slice 7. Small, real
  prod-bundle issue today.
- **S8-F2 — live attempt silently graded on a question subset**
  (`presented-question.ts:107-118`, audit-4 High): **DEFER** post-deploy.
  Naturally subsumed by WS1 typed contracts — malformed/unknown-type
  questions become structurally impossible once the wire is typed.
- **S8-F1 — decisionless proposal renders as "approved"**
  (`parse-proposal-payload.ts:38-55`, audit-4 High): **DEFER** post-deploy.
  Same WS1 subsumption.

### D5 — AC-D24 documentation — ✅ RULED: APPROVED (rev-2)
**Ruling:** document the presentation↔grading permutation-inversion
contract that Slice 3 enforces. **Fold the `DECISIONS.md` AC-D24 edit
into Slice 3's commit** (a single sentence/paragraph addition under
AC-D24) — code and spec edit land together so the auditor reviews both
in the same slice. No longer optional; now in-scope for Slice 3.

### D6 — Celery task-failure surfacing depth (gates Slice 6) — ✅ RULED (rev-2)
**Ruling:** **structured-log surfacing** for Slice 6 (pre-deploy).
Slice 6 ships a `logs.error` + `task_failure` signal handler; **no
audit-row write**. Audit-row persistence overlaps WS2's transactional
CRUD+audit service and defers to post-deploy.

---

## 4. Slice decomposition

Seven slices. Each is one commit, < 2500 lines, fix+test paired, with
acceptance criteria the executing session verifies. **Locked fix
ordering 1→2→3→4→5 preserved** (audit-5 §4); Slices 6–7 (remaining WS4
subset) carry no inter-fix ordering and may run after Slice 4
regardless of the Slice 5 spec-gate.

### Dependency / execution graph
```
S1 ─ S2 ─ S3 ─ S4 ─┬─ S5  (BLOCKED on D3 spec-amendment PR; pauses loop)
                   └─ S6 ─ S7   (unblocked; proceed while S5 waits)
```
S2 must precede S3/S4/S5 (audit-5 §4 #2: until the startup key-check
exists, later fixes could be validated against silent stub output).

---

### Slice 1 — Role literal reconciliation (A3-L1) + X2-#3 test
**Gated on Decision D1.**
**Fix (assuming D1 = recommended):**
- `frontend/src/lib/auth/context.tsx:71-72` — `narrowRole` maps
  `"administrator"→"admin"` (accept both during transition), `"testee"`
  passthrough, else `null`.
- `frontend/src/app/(authed)/(admin)/admin/users/_components/users-list.tsx`
  — wrap role on the **write** paths through a `toWireRole` helper so
  `"admin"→"administrator"` on the wire. **Three write sites, not one**
  (auditor round-1 inline finding, verified against source):
  - `:441` — create-user body `role: values.role`.
  - **`:525` — `UserEditModal` seed.** Currently
    `role: user.role === "admin" ? "admin" : "testee"`; the wire value is
    `"administrator"`, so `=== "admin"` is false and a real admin's edit
    form seeds to **`"testee"`** (wrong role shown). Apply `fromWireRole`
    at the seed.
  - **`:536` — `UserEditModal` dirty-compare + send.** Currently
    `if (values.role !== user.role) body.role = values.role` compares the
    FE literal `"admin"` against the **wire** `"administrator"`, so it
    never matches: every save treats role as changed and sends raw
    `"admin"` → `422 invalid_role`. Make the comparison consistent
    (`toWireRole(values.role) !== user.role`) and send `toWireRole(...)`.
- `frontend/src/lib/queries/admin-users.ts:54` — map the role filter
  param to the wire literal.
- `users-list.tsx:333` (`u.role === "admin"` display) — normalise the
  list-response role through the same read mapper.
- Add a single shared `frontend/src/lib/auth/role.ts` (`toWireRole` /
  `fromWireRole`) so WS1 has one seam to enum-ify later.
**Test (X2-#3, `audit-5:76`):**
- `frontend/tests/lib/identity/role.test.ts` (new) — assert
  `narrowRole("administrator") === "admin"` and `toWireRole("admin") ===
  "administrator"`.
- Update one MSW handler to emit the real enum `"administrator"`
  (`frontend/src/mocks/handlers.ts:1990`) and assert an admin-gated
  surface renders (not `/403`).
- **Edit-modal case (auditor round-1 finding):** open `UserEditModal` on
  an `"administrator"` user → the role field seeds to admin (not testee);
  a no-op save sends no `role` (a 200, not 422); a role-change save posts
  `"administrator"`.
**Acceptance:** an admin `/me` with wire role `"administrator"` renders
the admin shell (no `/403`); user-create with FE role `"admin"` posts
`"administrator"` and 201s (no 422); editing an existing admin seeds the
correct role and a no-op save does not 422; `pnpm test` + `pnpm
typecheck` green.

### Slice 2 — Startup config validation (A4-S3-C + WS4 subset) + X2-#4 test
**Gated on Decision D2.**
**Fix:**
- `app/config.py` — add `check_startup_config(settings)` returning
  `(warnings, errors)` per the D2 ruling: (a) a **warning** per missing
  AI key (every env); (b) an **error** when `app_env != "dev"` AND any of
  `app_secret_key == "change-me"`, `jwt_secret == "change-me"`,
  `cors_allowed_origins_list` wildcard (`"*"`) or localhost. Sentinel is
  `!= "dev"` (fail-closed). Reads only `Settings` (G3).
- `app/main.py` — add a FastAPI `lifespan` (stdlib `logging` only) that
  calls the helper, logs each warning loudly at startup, and **raises**
  on any error (boot fails closed). **No `app.ai`/`app.domain` import**
  (G3, keeps `structure_gate` green).
- Aligns `resolve_provider`'s docstring promise (`provider.py:361`) with
  reality — the warning now actually fires.
**Test (X2-#4, `audit-5:77`):**
- `tests/unit/test_startup_config.py` (new) — warns on empty AI key, no
  warning when set; with `app_env != "dev"` **raises** on a `"change-me"`
  secret **and** on wildcard/localhost CORS; with `app_env == "dev"` does
  not raise on either; an unknown `app_env` value fails strict (raises),
  proving the fail-closed sentinel.
**Acceptance:** booting with an unset AI key emits a startup WARN (stub
no longer silent); booting any non-`dev` env with a default secret or
wildcard CORS fails fast; `dev` boots clean; `pytest --ignore=tests/e2e`
+ `structure_gate` + `mypy` green.

### Slice 3 — Grading shuffle inversion (A2-H1) + X2-#1 test
**Fix:**
- `app/domain/attempts.py` — invert the presentation permutation at
  grade time so a submitted **presented** index maps back to the
  **original** index. The permutation is already stable and re-derivable
  (`option_permutation` `:468-474`, `seed_for` `:461-464`); re-derive it
  in `_grade_mcq`/`_grade_matching` (`:1201-1229`), mirroring the exact
  derivation `_present_one` uses (`:533-546`) so the two stay in lockstep.
  **Both graded types need inversion — spell each out** (rev-0 said
  "identity (matching)", which was imprecise; matching needs inversion
  too):
  - **MCQ** (`_grade_mcq`): presentation shuffles `options` (`:535-536`).
    Grade as `perm[submitted_choice] == config.correct`.
  - **Matching** (`_grade_matching`): presentation shuffles **only the
    `rights`**, lefts stay put (`:543-546`). `answer.matches[i]` is the
    **presented**-right index picked for left `i`; today grading checks
    `m == i` (`:1228`), wrong once rights are shuffled. Fix: score a pair
    correct when `perm[matches[i]] == i` — same `perm[...]` inversion as
    MCQ, applied element-wise to `answer.matches`.
- Affects MCQ **and** matching (audit-2 H1, `audit-2:36`).
- **Spec edit (D5, in this same commit):** add a single sentence/paragraph
  under `DECISIONS.md` AC-D24 documenting the presentation↔grading
  permutation-inversion contract this slice enforces (audit-3 L4-F3 noted
  AC-D24 never pinned how shuffled presentation maps back to grading).
  Code + spec edit land together so the auditor reviews both in one slice.
**Test (X2-#1, `audit-5:78`):**
- `tests/integration/test_p4_grading_shuffle.py` (new) — present→submit→
  grade round-trip with a **non-identity** permutation, **one case per
  graded type (MCQ and matching)**: a correct selection scores 1.0, a
  wrong one scores 0.0; matching with shuffled rights scores a correct
  pairing 1.0. (Existing `test_p4_grading.py` autosaves original-order
  indices and bypasses the presentation layer — it cannot catch this; the
  new test exercises the presented→graded seam for both types.)
**Acceptance:** with `randomise_option_order=True` and a non-identity
permutation, grading scores correctly for MCQ and matching; existing
grading tests stay green; `DECISIONS.md` AC-D24 carries the inversion
contract (D5); `pytest --ignore=tests/e2e` green.

### Slice 4 — MCQ "mark correct" form-state fix (A2-H2) + X2-#2 test
**Fix:**
- `frontend/src/app/(authed)/(admin)/admin/tests/[testId]/edit/_components/mcq-choices.tsx:46-52`
  — `setCorrect` currently loops `update(i, {...f})` over the stale
  `fields` snapshot, clobbering uncontrolled-input text with empty
  strings. Replace with `form.setValue("config.choices.${i}.correct",
  i===idx)` (or read live values via `getValues("config.choices")`) so
  only the `.correct` flag flips and typed text is preserved.
**Test (X2-#2, `audit-5:79`):**
- `frontend/tests/components/admin/mcq-choices.test.tsx` (new or extend)
  — type choice text, then click "mark correct"; assert the typed text
  survives (no "Choice text is required" zod error, text present in the
  composed payload).
**Acceptance:** typing then marking a choice correct preserves all typed
text through the POST body; `pnpm test` + `pnpm typecheck` green.

### Slice 5 — Question-config wire reconciliation (X3-H2 escapee) — **SPEC-GATED on D3**
**BLOCKED until the FE-8 §H(a) spec-amendment PR (a separate, standalone
doc-only PR authored by the spec author — D3) lands on `main` first.**
The executing session **waits** for that PR before starting Slice 5 —
it does not author the amendment, and it honours the spec-drift pause
(`SESSION_START.md:199-208`). Slices 1–4, 6, 7 proceed meanwhile. Once
§H(a) reads `{prompt, options, correct, model_answer}` on `main`,
implement against the corrected text.
**Fix (against the amended contract):**
- `frontend/src/lib/tests/compose-question-config.ts:35-52` — emit
  `prompt` (from `body`); for MCQ transform `choices:[{text,correct}]`
  → `options:[…text]` + `correct:<index of the true choice>`; for
  short_answer/scenario emit `rubric` **+ `model_answer`**.
- `frontend/src/lib/tests/unpack-question-config.ts` — reverse mapping
  for edit-mode prefill (prompt→body, options+correct→choices,
  model_answer→form field).
- `frontend/src/lib/tests/question-form.ts` — add `model_answer` to the
  `rubricConfigSchema` (required, non-empty) for short_answer/scenario.
- Rubric editor component — add the `model_answer` input (the form field
  is currently absent — G2).
**Test (the seam X2 found uncovered, `audit-5:80`):**
- Golden fixture per question type committed under
  `frontend/tests/data/` (or shared path) representing the agreed wire
  shape.
- `frontend/tests/lib/tests/compose-question-config.test.ts` — assert
  `composeQuestionCreate(form)` deep-equals the golden fixture for each
  type.
- `tests/unit/test_question_config_contract.py` (new, backend) — assert
  `validate_question_config(type, fixture)` accepts the **same** golden
  fixture for each type (the honest FE-compose→BE-validate contract).
**Acceptance:** every MCQ/TF/matching/short_answer/scenario authored via
the admin editor passes `validate_question_config` (no 422); short_answer
/scenario carry a `model_answer`; the golden fixture passes on **both**
sides; `pnpm test` + `pytest --ignore=tests/e2e` green.

### Slice 6 — Celery task-failure surfacing (WS4 subset / S3-H) + test
**Fix:**
- `app/worker.py` — register a `task_failure` (and `task_retry`) Celery
  signal handler that emits a **structured** `logs.error` for any failed
  task (task name, id, exception). The seven cron wrappers currently have
  no `autoretry`, no `task_failure` signal, no audit row, `acks_late=True`
  (`worker.py`, audit-4 S3-H `:46`) → a cron can fail every run with only
  downstream symptoms visible.
- **Scope (D6 ruling):** structured-log surfacing only — `logs.error` +
  `task_failure` signal handler, **no audit-row write**. Audit-row
  persistence overlaps WS2's transactional CRUD+audit service and defers
  to post-deploy.
**Test:**
- `tests/unit/test_worker_task_failure.py` (new) — assert the signal
  handler is connected and emits the structured log on a simulated task
  failure.
**Acceptance:** a failing Celery task produces a loud structured log
entry; `pytest --ignore=tests/e2e` green.

### Slice 7 — Deployment-readiness docs + hygiene (WS4 subset)
**Fix:**
- **Required-env-var docs** (`audit-5:92`): document the
  required-in-prod env set (AI keys, `app_secret_key`, `jwt_secret`,
  `cors_allowed_origins`, DB/Redis URLs, SMTP) — extend `.env.example`
  comments and add a deploy-readiness section (root `README.md` or
  `docs/`). Cross-reference the Slice 2 startup assertions so the doc and
  the boot check agree.
- **CORS prod-origin checklist** (`audit-5:91`): document that
  `cors_allowed_origins` must be set to the real prod origin(s), no
  wildcard — the doc complement to the Slice 2 boot assertion.
- **`msw` → `devDependencies`** (D4 ruling: INCLUDE): move
  `frontend/package.json:43` into `devDependencies`; verify build/test
  still green (the worker is only registered in dev/test).
**Test:** N/A (docs) for the env/CORS docs; for the `msw` move the gate is
`pnpm install && pnpm build && pnpm test` green (build must not pull msw).
**Acceptance:** deploy-readiness doc enumerates every required-in-prod
var and the no-wildcard CORS rule; `msw` no longer in prod
`dependencies` and `pnpm build` green.

---

## 5. Test-pairing matrix (audit-5 §4 X2 gaps)

| Slice | Fix-now item | X2 pairing | Test location |
|---|---|---|---|
| 1 | A3-L1 role literal | X2-#3 | `frontend/tests/lib/identity/role.test.ts` + MSW handler |
| 2 | A4-S3-C stub AI | X2-#4 | `tests/unit/test_startup_config.py` |
| 3 | A2-H1 grading shuffle (+ D5 AC-D24 spec edit) | X2-#1 | `tests/integration/test_p4_grading_shuffle.py` (+ `DECISIONS.md` AC-D24) |
| 4 | A2-H2 MCQ form wipe | X2-#2 | `frontend/tests/components/admin/mcq-choices.test.tsx` |
| 5 | escapee X3-H2 | seam contract | `compose-question-config.test.ts` + `tests/unit/test_question_config_contract.py` (golden fixture, both sides) |
| 6 | S3-H Celery surfacing | — (new) | `tests/unit/test_worker_task_failure.py` |

---

## 6. Out of scope (post-deploy — named for the boundary)

WS1 (typed wire contracts + seam tests), WS2 (transactional
CRUD+audit+validation service), WS3 (real-DB integration tier), WS4
remainder (competence/cost N+1 batch-load `Q1-#1/#2`, admin-`Field`
label a11y `X4`, aria-live gaps). Post-deploy sequencing per
`audit-5:97`: WS1‖WS2 in parallel, WS3 after WS1, WS4 remainder anytime.
S8-F1/S8-F2 flagged under Decision D4 but recommended deferred.

---

## 7. Open risks the executor must watch

- **Slice 3 lockstep.** The grade-time inversion must re-derive the
  *exact* permutation `_present_one` applied (same seed, same
  `option_permutation` call). Drift between the two derivations
  silently re-introduces H1. The X2-#1 round-trip test is the guard.
- **Slice 5 prefill round-trip.** `unpack` must be the exact inverse of
  `compose` or edit-mode loses the correct-choice/model_answer on
  reload. Golden fixture covers compose; add an unpack(compose(x))===x
  assertion.
- **Slice 2 structure-gate.** Any accidental `app.ai`/`app.domain` import
  from `main.py` fails `structure_gate`. Keep the helper in
  `app/config.py`, reading only `settings`.
- **Auto-continue pause at Slice 5.** Executor must honour the
  spec-drift halt (rule (a)) and not silently reconcile the locked FE-8
  contract. Slices 6–7 proceed in the meantime.

---

*Plan grounded against HEAD `640ca14`. Citations are `file:line` at time
of authoring. Decisions D1–D6 are now **all ruled by the spec author**
(rev-2); none remain open.*

## rev-2 — spec-author rulings folded (D1–D6)

The spec author ruled on every decision; rev-2 folds them in:
- **D1** — backend `"administrator"` canonical; FE bidirectional seam;
  Slice 1 X2-#3 must include the edit-modal no-op-edit case.
- **D2** — WARN missing AI keys (all envs); RAISE when `app_env != "dev"`
  AND (`change-me` secret OR wildcard/localhost CORS). Fail-closed
  sentinel. (Supersedes the round-1 "CORS → WARN" softening.)
- **D3** — §H(a) amendment is a **separate standalone doc-only PR** by the
  spec author; Slice 5 gated on it landing on `main` first; this plan does
  not author it.
- **D4** — `msw`→devDeps INCLUDE (Slice 7); S8-F1 + S8-F2 DEFER post-deploy.
- **D5** — AC-D24 inversion-contract doc edit folded into **Slice 3's**
  commit (code + spec together).
- **D6** — Slice 6 ships structured-log surfacing only (no audit row).

**Set-diff gate (rev-1 → rev-2):** no finding IDs dropped; G1–G5 and the
seven slices are unchanged in identity. rev-2 edits are ruling-driven
text only (D-sections + Slices 2/3/5/6/7 + matrix). Per the spec author,
**rev-2 invalidates rev-1's two final-markers (halt-class)** — they
re-apply only after the auditor re-reviews against rev-2 HEAD.

Status: rev-2 — awaiting auditor re-review (rev-1 final-markers invalidated by this revision).
