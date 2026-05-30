# Audit 5 — Improvements + Cross-Audit Synthesis

**Date:** 2026-05-30
**Type:** Improvements audit (read-only) — FINAL audit in the 5-audit cycle; includes the cross-audit synthesis keystone.
**Scope:** Code that works correctly but could be better — duplication, missing abstractions, performance, readability/maintainability, test-coverage gaps, accessibility, logging, type safety, bundle/build.
**Out of scope:** bugs (Audit 2), spec deltas (Audit 3), silent failures (Audit 4), style preference absent a rule, rearchitecting.
**Method:** 7 orthogonal lenses — Q1 (backend domain/AI logic), Q2 (backend HTTP/data), Q3 (frontend logic), X1 (cross-subsystem duplication — exclusive), X2 (test coverage — exclusive), X3 (type safety — exclusive), X4 (a11y + bundle — exclusive). Conservative bar: every finding carries a concrete change + concrete benefit + effort tag (trivial/small/medium/large). Severity: High / Medium / Low.

> **Triage note.** Triage locked at Audit 5 close. The audit cycle is closed by this commit; the next session opens the pre-deploy workstream on a fresh branch. No GitHub issues opened. No fix work begun during the audit cycle.

> **Three strong claims were source-verified before finalizing:** (1) the role-literal type hole (X3-H1) — backend emits `"administrator"`, FE `narrowRole` accepts only `"admin"`, schema types `role` as bare `string`; (2) the green-gate test-harness quantification (X2) — only 2 of 823 backend tests hit real Postgres; (3) **the question-config wire divergence (X3-H2)** — `compose-question-config.ts` sends `{body, choices}` while `validate_question_config` requires `{prompt, options, correct:int}` and `add_question` validates with no remap (`tests.py:392-460`), so admin question authoring 422s in production. The third escaped all four prior audits and is promoted to the fix-now tier.

---

## Verdict

The codebase is **well-built** — thin routers, separated math cores, named constants, memoised FE contexts, Radix-backed a11y, bounded retries, sound audit transactionality. Improvement debt clusters into coherent, high-leverage seams. Audit 5's verification caught **one real production-breaking bug that escaped all four prior audits** via the exact convergent patterns this cycle identified. ~50 findings: **9 High · ~24 Medium · ~14 Low**, plus the synthesis.

## Per-lane summary

| Lane | Headline findings |
|---|---|
| **Q1** Backend domain/AI | 2 High perf: `maybe_fire_budget_alert` ~9 full-table scans on every AI call (cost.py); `apply_competence_update` nested-N+1 recompute-all-history per submit (competence.py). + grade-review parse dup, follow-up-loop dup, anthropic/openai `_call` scaffold dup. In-repo bulk-load template exists. |
| **Q2** Backend HTTP/data | `Page[T]` wiring ×13 (→X1), load-or-404 per router (→X1), 7 near-identical Celery wrappers, `_validate_pills` N+1; **F8** difficulty-range validator-vs-router asymmetry, **F9** manual-sweep audit boilerplate (both name the asymmetry abstraction, also-A3/A4). |
| **Q3** Frontend logic | High: `flattenPages`+`PAGE_SIZE` copy ×12. + attempt-runner dup (mutation-ref pin ×14, error-toast ×10, 525-line StreamingRunner), 3 localStorage idioms, SSE invalidate triplet, debug-breadcrumb gap. |
| **X1** Cross-subsystem | **H1** missing transactional CRUD+audit wrapper (root of create-loud/update-quiet); **H2** missing Create/Update validation mixin; **H3** tenant-scoping repo (188 inline filters, RLS-blocker). + FE list/flatten/CRUD factory, `toastApiError`, `useInfiniteScroll`, band/role cross-stack SSOT. |
| **X2** Test coverage | The 4 fix-now test pairings (all confirmed). **≈0.24% of backend tests hit real Postgres (2 of 823); 0 FE tests assert a real backend wire value.** |
| **X3** Type safety | **H1** bare-string wire enums (role root); **H2** question-config `dict[Any]`/`Record<never>` (the escapee); **H3** AI-content `dict[Any]`. Green gate is hollow exactly at grading/AI/enums. |
| **X4** a11y + bundle | High: admin `Field` (`field.tsx:25-41`) no label association → every admin form input unlabeled to screen readers (`AuthField.tsx` is the fix template). + aria-live gaps (AutosaveIndicator, GradingOverlay); `msw` in prod dependencies; 6 needs-runtime items. |

## ★ Verified escapee (capstone)
**Question-config wire divergence — admin question authoring 422s.** FE `composeConfig` sends `{body, choices|correct|pairs|rubric}` with no `prompt`; BE `validate_question_config` requires `{prompt, options, correct:int, …}`; `add_question` validates with **no remap** and stores as-is (verified `app/domain/tests.py:392-460`). Every MCQ/TF/matching authored through the admin editor fails `config.prompt is required`. Escaped A1–A4 because the FE→BE seam is MSW-mocked on one side and BE-schema-bypassed on the other (X2), and `config:Any`/`Record<string,never>` blinds both type gates (X3). **Promoted to fix-now item #5.**

---

# CROSS-AUDIT SYNTHESIS (keystone artifact)

## 1. Convergence table (multi-lens sites, sorted by audit-count desc)

| Site / cluster | A1 build | A2 bugs | A3 functional | A4 silent | A5 improve |
|---|---|---|---|---|---|
| **Create-loud / update-quiet & audit asymmetry** | | M1·M6·B1-2 | L2-F2·L4-F2·L3-F3 | S5-1·S5-2·S1-H1/H2 | X1-H1·X1-H2·Q2-F8/F9 |
| **Test-harness validates assumptions, not contract** | e2e gap | B3-1·B3-2 | L7-A2 | (S5 mech note) | X2 (all)·X3 |
| **Competence / grading correctness surface** | | B2-1·B3-3 | L4-F3·L5-F1 | S1-H1·S1-H2 | Q1-#2·X3-H2 |
| **Grading shuffle** | | **H1** | L4-F3 | | X2-#1·X3-H2 |
| **RAG fail-soft (`drive_rag:735`)** | | B4-1 | L6-F1 | S2-M2 | |
| **Role literal admin/administrator** | | | **L1-F1+F2** | | X3-H1·X2-#3·X1-L2 |
| **Stub AI served as real** | | | | **S3-C** | X2-#4·X3-H3 |
| **MCQ form wipe** | | **H2** | | | X2-#2·X3-H2 |
| **Cost/budget poll** | | | | S3-M | Q1-#1 |
| **Autosave / pause (F2-1)** | | M1 | | F2-1 (S6/S7) | Q3 |
| **Question-config divergence (escapee)** | *(missed)* | *(missed)* | *(missed)* | *(missed)* | **X3-H2** |

**The 4-audit rows are the highest-signal must-fix clusters.** The escapee row is the inverse lesson: a real bug with zero prior coverage because it sat in both blind spots at once.

## 2. Three confirmed convergent patterns, extended with Audit 5

**(a) Create-loud / update-quiet asymmetry (A2/A3/A4 → A5 found the root).** A5-X1 identifies the missing abstraction whose absence causes it: no transactional CRUD+audit wrapper (X1-H1) and no shared Create/Update validation mixin (X1-H2). `_DifficultyRange` (shared) vs `TestCreate._check_matrix` (Create-only) is the in-repo proof the fix works. **The pattern is not N bugs — it is one missing service (→ WS2).**

**(b) Backend degrades, surface looks normal (A4 dominant → A5 generalises to the test/type surface).** The ultimate "surface looks normal" is the green suite itself: 1,701 passing tests + mypy-clean + tsc-strict-clean while four real bugs and the escapee live underneath. X2 quantifies it (≈0.24% real-DB coverage); X3 shows the gates are hollow exactly at grading/AI/enums (→ WS1, WS3).

**(c) Test-harness validates assumptions, not contract (A1/A2/A3 → A5 quantifies and proves it).** X2: FakeSession enforces no FK/unique/ordering; MSW mocks encode the FE's own wrong literals. X3: `Any`/bare-`string`/`as never` at every cross-stack seam. **The question-config escapee is the QED** — a bug that needed both holes open to survive four audits, and did (→ WS1 + WS3).

## 3. Workstream proposals (all ACCEPTED — close clusters; individual findings absorbed)

**WS1 — Typed wire contracts + seam tests.** *Change:* convert bare-string wire enums to real `enum.Enum` and define discriminated Pydantic/TypedDict unions for question-config, answer-payload, and AI-content, then add FE-compose→BE-validate contract tests. *Effort:* Large. *Closes:* A3-L1, A2-H1(input shape), A2-H2, the escapee, A4-S3-C(shape), X3-H1/H2/H3/L1/L2, X2-#1/#2/#3/#4. *Unblocks:* an honest green gate; highest leverage.

**WS2 — Transactional CRUD+audit+validation service.** *Change:* introduce a `mutate(...)` wrapper (audit + commit as one unit) + shared Create/Update validation mixin + tenant repo (`by_id`/`tenant_rows`). *Effort:* Large. *Closes:* A2-M1/M6/B1-2, A3-L2-F2/L4-F2/L3-F3, A4-S5-1/S5-2/S1, Q2-F8/F9, X1-H1/H2/H3. *Independent of WS1; together they close the two 4-audit rows.*

**WS3 — Real-DB integration tier + coverage.** *Change:* expand the 2-test e2e tier to cover DB-enforced invariants (unique-sequence retry, FK/cascade) and wire MSW/contract tests to real backend enum values. *Effort:* Medium–Large. *Closes:* A1 e2e gap, A2-B3-1/B3-2, A3-L7-A2, X2 harness gap. *Depends on WS1* (typed contracts) for the FE-contract half.

**WS4 — Observability + hot-path perf + a11y.** *Change:* add startup key/secret check + Celery task-failure surfacing + budget-alert audit; batch-load the competence/cost N+1s; fix admin-`Field` labels + aria-live. *Effort:* Medium. *Closes:* A4-S3-C/S3-H/S3-M/S5, Q1-#1/#2, X4 a11y. *Independent; quick operational wins; split pre/post-deploy below.*

## 4. Fix-now tier — LOCKED sequence (5 items, paired with X2 test gaps)

1. **A3-L1 (role literal)** — *first.* Total admin lockout; until fixed you cannot exercise the admin flows the other fixes touch. Cheap (enum-ify `Role` or map at `/me`). **Test (X2-#3):** assert `narrowRole("administrator")` + one MSW handler emitting the real enum.
2. **A4-S3-C (stub AI)** — *deploy-gate.* Until the startup key-check exists, other fixes could be validated against silent stub output. Cheap (lifespan warn/raise). **Test (X2-#4):** warns on empty key, not on set key.
3. **A2-H1 (grading shuffle)** — core correctness; invert the permutation at grade time. **Test (X2-#1):** presented→submit→grade round-trip with a non-identity permutation (fails today).
4. **A2-H2 (MCQ form wipe)** — admin data-loss; batch with H1's editor work (same `mcq-choices.tsx` area). **Test (X2-#2):** type-then-mark-correct preserves text.
5. **Question-config escapee (X3-H2)** — admin question authoring 422s; reconcile FE `compose-question-config` to the BE `validate_question_config` shape (or vice-versa). **Test:** the FE-compose→BE-validate contract test (the seam X2 found uncovered).

*All five are targeted patches now, then **subsumed/generalised by WS1** (role enum, config union) — do the patches first for speed, let WS1 generalise.*

## 5. Deployment-readiness pass (reframed pre/post-deploy)

**Pre-deploy = 5 fix-now patches + WS4 subset:** startup key/secret check, Celery task-failure surfacing, CORS prod-origin verification, required-env-var docs.

| Area | State | Action |
|---|---|---|
| Health checks | `/healthz` + `/api/health` wired to compose healthchecks | ✅ none |
| CORS | env-driven allow-list, `allow_credentials=False` | ⚠️ pre-deploy: verify prod origins set (no wildcard) |
| Env docs | `.env.example` (root + frontend) present | ⚠️ pre-deploy: document required-in-prod set |
| **Secret handling** | `app_secret_key`/`jwt_secret` default `"change-me"`; AI keys default `""` | ⚠️ pre-deploy: **startup assertion** these are overridden (also closes A4-S3-C) |
| **Observability** | no structured-log/metrics hooks; Celery failures invisible (A4-S3-H); no AI-key boot check | ⚠️ pre-deploy: task-failure surfacing + startup health |
| Migrations | linear chain, reversible (A1) | ✅ none |

**Post-deploy workstream sequencing:** **WS1 + WS2 in parallel** (independent, both Large) · **WS3 after WS1** (depends on typed contracts) · **WS4 remainder anytime.**

---

## Triage summary (locked)

- **Fix-now (5, sequenced):** A3-L1 → A4-S3-C → A2-H1 → A2-H2 → question-config escapee (X3-H2).
- **Workstreams (all ACCEPTED, individual findings absorbed):** WS1, WS2, WS3, WS4.
- **Default for unabsorbed findings:** queue-low. **Exceptions:**
  - **Q3 attempt-runner duplication / 525-line `StreamingRunner`** — separate refactor candidate; queue for when the surface is next touched.
  - **X4 `msw` in prod dependencies** — trivial fix-now; move to `devDependencies` in the next maintenance pass.
  - **X4 admin-`Field` unlabeled inputs** — folds into WS4 but called out separately for a11y compliance.
- **Deployment tiers:** pre-deploy (5 fix-now + WS4 subset) → deploy → post-deploy (WS1‖WS2, then WS3, WS4 remainder).

---

## Audit cycle — closed

Five read-only audits complete (2026-05-30): A1 Build, A2 Bugs, A3 Functional Correctness, A4 Silent Failures, A5 Improvements + Synthesis. The convergence table and the three confirmed patterns are the durable cross-cycle artifacts; the fix-now sequence and workstreams drive the post-audit fix program. No source was modified across the cycle; three strong A5 claims were source-verified read-only. GitHub issues are not opened per-audit. The next session opens the pre-deploy workstream on a fresh branch.
