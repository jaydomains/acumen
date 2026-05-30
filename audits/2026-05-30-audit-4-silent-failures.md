# Audit 4 — Silent Failures

**Date:** 2026-05-30
**Type:** Silent-failure audit (read-only)
**Scope:** Places where errors get swallowed, retries hide upstream issues, graceful degradation masks bugs, rollbacks don't surface, background-job failures surface nowhere, or the system fails silently instead of loudly. "What fails NOW and nobody notices."
**Out of scope:** crash/visible-fail bugs (Audit 2), spec-vs-shipped deltas (Audit 3), code quality (Audit 5), performance-unless-silent.
**Method:** 8 parallel read-only lanes — S1–S5 backend, S6–S8 frontend. Every `try/except`, `.catch()`, `Promise.all/allSettled`, async iteration, default/fallback/`??`, and background handler examined for *what the failure path does*. Conservative bar: a finding must be **reachable AND actually silent** — a catch that logs **and** propagates is loud (not a finding); a catch that logs-and-proceeds where proceeding is correct is graceful degradation, flagged **only** if it hides something the user needs to know.
**Severity (silent-failure-specific):** Critical (data-loss / trust violation the user cannot detect) · High (real failure a careful user would *eventually* notice) · Medium (degraded behaviour mostly invisible) · Low (logging/notification gap).

> **Triage note.** "Fix-now" is a **priority tag only** for post-Audit-5 sequencing. **No code changes occur during the audit cycle — audits are read-only end-to-end.** Triage locked at Audit 4 close. No GitHub issues opened per-audit.

> **The lone Critical (S3-C) was source-verified:** `app/main.py` (130 lines) has no lifespan/startup/key-check; `app/ai/provider.py` imports no logging facility; the `return _STUB` branches (`provider.py:379,383`) log nothing — yet the `resolve_provider` docstring (`:361`) claims "*log a startup warning if any key is missing (`app.main` lifecycle)*." Confirmed real Critical + also-A3 (docstring-vs-reality).

---

## Verdict

The backend has clearly had a prior silent-failure pass — streaming surfaces failure as `event: paused`, grade-review fail-soft is paired with a result-page gate, AI-provider retries are bounded/`reraise=True`, the router layer is uniformly loud, and the audit mechanism is transactionally sound (no commit-without-audit drift). Silent residue concentrates in three places: **(1) the submit-path fail-soft hooks** that swallow loop/competence failures; **(2) the stub-AI-as-real trust hole**; **(3) the frontend post-submit/result surfaces + display coercions** that collapse failure into a benign-looking state.

**~21 findings: 1 Critical · 8 High · 8 Medium · 5 Low.** F2-1 confirmed (one issue, two facets).

## Per-lane summary

| Lane | C/H/M/L | Posture |
|---|---|---|
| S1 attempt/grade/loop/calibration | 0/2/3/2 | Mostly good; submit-path hooks swallow partial-writes |
| S2 catalogue/content-sourcing | 0/0/2/1 | Strong, well-instrumented; RAG fail-soft correctly loud |
| S3 background + AI resilience | **1**/1/1/1 | Retries exemplary; stub-as-real is the Critical |
| S4 routers | 0/0/0/1 | Clean — thin & uniformly loud |
| S5 audit-log matrix | 0/1/1/2 | Sound mechanism; manual deletions unaudited |
| S6 FE mutation handling | 0/1/2/1 | Queries sound; autosave retry mechanism unsound |
| S7 FE notification surfaces | 0/1/1/1 | Good; result-read path silently blanks |
| S8 FE state/defaults | 0/2/2/1 | Disciplined; a few failure→benign coercions |

---

## CRITICAL (1) — TRIAGE: FIX-NOW

**S3-C · Stub AI provider served as real output, invisibly.**
`app/ai/provider.py:379,383`. When `anthropic_api_key`/`openai_api_key` is unset/typo'd, `resolve_provider` silently returns `_STUB`; deterministic content (grade `0.0`, review `confirmed`, canned questions) is stamped onto real Grade/GradeReview/Question rows. `provider.py` has no logger; `main.py` has no startup key-check (both verified); the docstring's promised startup warning doesn't exist. The only trace is `by_provider["stub"]` = **$0** on the cost dashboard, which reads as "no spend," not "AI is fake." Undetectable trust violation. (also-A3) — joins the fix-now tier with Audit-2 H1+H2 and Audit-3 L1-F1+F2.

## HIGH (8) — TRIAGE: QUEUE

- **S1-H1 · Loop driver partial-write swallowed.** `app/domain/attempts.py:1176-1186` → `loop.py:475-565`. Mid-flow failure logged-only, submit succeeds; orphaned Test/Assignment + half-built follow-up Attempt persist; the adaptive follow-up silently never queues; no reconcile, no audit. (also-A2, →S5)
- **S1-H2 · Competence hook fail-soft masks stale profile.** `attempts.py:1172-1175`. A raised `apply_competence_update` is swallowed; result page shows "ready" while per-pill competence stays silently stale and feeds the next loop a stale difficulty. (→S5)
- **S3-H · Celery task failures surface nowhere.** `worker.py:47-51` + all 7 task wrappers. No `autoretry`, no `task_failure` signal, no audit row, `acks_late=True`; a cron (e.g. budget sweep every 5 min) can fail every run with only downstream symptoms ever visible. (→S5)
- **S5-1 · Manual deletions unaudited.** `delete_subject/pill/path/group/question` (`catalogue.py:146,212,382,441`; `tests.py:459`) + `remove_group_member` (`catalogue.py:464`) emit no audit row, despite SPEC §5 explicitly listing "manual deletions." Siblings `test.delete`/`pill.retire` are audited. Hard deletes (no soft-delete columns); the delete fns don't even receive `actor_id`.
- **F2-1 · Autosave retry mechanism unsound + false banner (one issue, two facets).** `use-attempt.ts:308` (mechanism, S6) — the `catch` binds no error, so a permanent `409 attempt_paused` (from the pause-doesn't-cancel-scheduled-debounce race) is indistinguishable from a transient blip; the loop retries a doomed POST. Surface (S7) — the user, while merely paused, sees a spurious, **connection-blaming** "saves are failing" banner. (also-A2)
- **S7-F1 · Result page silently blanks.** `result/page.tsx:47-61,109-152`. `useQuery` doesn't `throwOnError`, so a result-fetch failure renders an empty body (no toast/card/retry) and `result/error.tsx` is dead code. Sibling `history`/`profile` rethrow into their boundaries; the result page is the lone deviation. (↔A3)
- **S8-F1 · Proposal `done` with missing/unknown decision defaults to "approved".** `parse-proposal-payload.ts:38-55`. A completed-but-decisionless, malformed, or future-enum decision collapses to "approved" — rendered as a definitive badge and gating the approve/reject UI; the opposite of the truth is possible. (also-A3)
- **S8-F2 · Malformed/unknown-type questions silently dropped from a live attempt.** `presented-question.ts:107-118`. Unrecognized `type`/malformed `config` dropped with only a `console.warn`; the testee completes and is graded on a **subset**, with progress/count reflecting only survivors. (also-A2)

## MEDIUM (8) — TRIAGE: QUEUE

- **S1-M1** AI grade score/verdict coerced to `0.0`/`none` on malformed output (`attempts.py:1382-1390`) — a "didn't grade" becomes a clean-looking graded zero feeding overall score/outcome. (also-A3)
- **S1-M2** grade-review SLA auto-flag (`grade_review.py:566-578`) mutates score-affecting state with only `_log.info`, no audit row (unlike the human resolve path). (→S5)
- **S1-M3** `draw_anchors_for_attempt` (`calibration.py:838-849`) silently drops an anchor on a shared-PK invariant break, shrinking the calibration sample (WARN only, no admin flag).
- **S2-M1** escalation (`engagement.py:471-493`) writes `escalation_sent_at` + `assignment.escalate` audit **unconditionally**, but email is guarded `if assigner is not None` → recorded/audited as fired while **nobody was notified**, no log of the skip. (→S5)
- **S2-M2** served `LearningMaterial` (`learning_material.py` / `drive_rag.py:698-708`) can't distinguish "RAG empty due to retrieval failure" from "empty index"; the 30-day cohort cache amplifies a transient degradation. (also-A3, →S5)
- **S3-M** `maybe_fire_budget_alert` (`cost.py:440-447`) swallows DB/SMTP/audit failures and the cron reports a successful no-op; over-budget spend continues with no alert and a falsely-clear dashboard. (→S5)
- **S5-2** create/update twins of audited lifecycle entities unaudited; sharpest: `update_pill` (`catalogue.py:196`) silently **re-runs safety auto-tag** (AC-D21 reclassification with no trail).
- **S6-M1** autosave retry counter (`use-attempt.ts:144-156`) never resets on a fresh edit → **zero retries** for the rest of the attempt after one exhausted streak.
- **S6-M2** `answers-cache.saveAnswers` (`answers-cache.ts:80-84`) swallows `QuotaExceededError`/serialization totally → compound case (quota fail + server save not yet landed + reload) = **silent answer loss**.
- **S7-F2** `GradingOverlay` (`GradingOverlay.tsx:93-127`) advances its poll-cap only on success → a persistently-erroring result poll spins fake "Working through your responses…" **forever**, with no escape affordance. (also-A2)
- **S8-F3/F4** test→pill lookup miss renders "—" (indistinguishable from "no pill", `tests-table.tsx:274,291`); parsed-answer-absent ≡ skipped (answered-but-unparseable shows as "no answer", `format-answer-payload.ts`).

*(8 distinct Medium after dedup; some lanes contributed two.)*

## LOW — TRIAGE: 1 QUEUE (S6 retry race) / rest ACCEPT

- **S6 retry race** (QUEUE): failed-save retry of the OLD payload races the queued NEWER payload (`use-attempt.ts:308-333`) → stale payload can re-POST and overwrite while the indicator says "saved."
- **ACCEPT:** S1 calibration-sweep telemetry lacks an `anchors_failed` count; S1 reconcile off-contract branches quieter than submit-path twins; S2 `_host_of` swallows URL-parse to a non-host `source` string; S3 provider retry-steps unlogged (terminal failure is loud); S4 commit-before-email ordering (manifests as a loud 500); S7 benchmark loading/error conflation (toasts once); S8 `ResultHero` "—" can mask a ready-but-unscored attempt; S5-3 admin user-create initial-role unaudited; S5-4 grade-review reconcile auto-flag unaudited.

---

## Audit-log completeness matrix (S5 — full reference artifact)

`record_audit(...)` defined at `app/domain/catalogue.py:51`; 35 distinct call sites across 13 modules. Mechanism shares the action's transaction (rollback drops both — **no commit-without-audit drift**); only `budget_alert.fired` and the loop audits sit behind deliberate fail-soft wrappers.

| # | Action / endpoint | Mutating fn (file:line) | Audited? | record_audit site / action string | Spec-required (§5)? |
|---|---|---|---|---|---|
| 1 | Create subject | `catalogue.create_subject` :117 (router catalogue.py:55) | **N** | NONE | No (parity) |
| 2 | Update subject | `catalogue.update_subject` :137 (catalogue.py:96) | **N** | NONE | No (parity) |
| 3 | **Delete subject** | `catalogue.delete_subject` :146 (catalogue.py:113) | **N** | NONE | **Yes — "manual deletions"** |
| 4 | Create pill | `catalogue.create_pill` :153 (catalogue.py:130) | **N** | NONE | No (parity) |
| 5 | Update pill | `catalogue.update_pill` :196 (catalogue.py:178) | **N** | NONE | No (parity; silently re-tags safety) |
| 6 | **Delete pill** | `catalogue.delete_pill` :212 (catalogue.py:202) | **N** | NONE | **Yes — "manual deletions"** |
| 7 | Retire pill | `catalogue.retire_pill` :216 | **Y** | catalogue.py:220 `pill.retire` | Yes — "pill retirements" |
| 8 | Override pill safety | `catalogue.override_pill_safety` :231 | **Y** | catalogue.py:238 `pill.safety_override` | Yes — AC-D21 |
| 9 | Create path | `catalogue.create_path` :330 (paths.py:56) | **N** | NONE | No (parity) |
| 10 | Update path | `catalogue.update_path` :368 (paths.py:99) | **N** | NONE | No (parity) |
| 11 | **Delete path** | `catalogue.delete_path` :382 (paths.py:117) | **N** | NONE | **Yes — "manual deletions"** |
| 12 | Create group | `catalogue.create_group` :400 (groups.py:67) | **N** | NONE | No (parity) |
| 13 | Update group | `catalogue.update_group` :432 (groups.py:104) | **N** | NONE | No (parity) |
| 14 | **Delete group** | `catalogue.delete_group` :441 (groups.py:120) | **N** | NONE | **Yes — "manual deletions"** |
| 15 | Add group member | `catalogue.add_group_member` :453 (groups.py:154) | **N** | NONE | No |
| 16 | **Remove group member** | `catalogue.remove_group_member` :464 (groups.py:168) | **N** | NONE | **Yes — "manual deletions"** |
| 17 | Create pill LM (self-request) | `learning_material.generate_self_initiated` | **Y** | lm.py:297/391 `learning_material.self_request/self_regenerate` | No (extra) |
| 18 | Admin create user | `users.create_user` (users.py:57) | **N** | NONE | Borderline ("user role changes") |
| 19 | Update user (incl. role) | router users.py:109 | **Y** | users.py:131 `user.update` | Yes — "user role changes" |
| 20 | Deactivate user | router users.py:143 | **Y** | users.py:160 `user.deactivate` | Yes — "deactivations" |
| 21 | Reactivate user | router users.py:171 | **Y** | users.py:182 `user.reactivate` | Yes (parity) |
| 22 | Create test | `tests.create_test` (tests.py:62) | **Y** | tests.py:145 `test.create` | No (extra) |
| 23 | Update test | `tests.update_test` (tests.py:138) | **Y** | tests.py:208 `test.update` | No (extra) |
| 24 | Publish test | router tests.py:165 | **Y** | tests.py:237 `test.publish` | No (extra) |
| 25 | Delete test | router tests.py:153 | **Y** | tests.py:253 `test.delete` | Yes — "manual deletions" |
| 26 | Campaign lock | router tests.py:177 | **Y** | tests.py:275 `test.campaign_lock` | Yes — AC-D24 |
| 27 | Campaign unlock | router tests.py:192 | **Y** | tests.py:290 `test.campaign_unlock` | Yes — AC-D24 |
| 28 | Add question | `tests.add_question` :392 (tests.py:204) | **N** | NONE | No (parity w/ test.update) |
| 29 | Update question | `tests.update_question` :447 (tests.py:238) | **N** | NONE | No (parity w/ test.update) |
| 30 | **Delete question** | `tests.delete_question` :459 (tests.py:255) | **N** | NONE | **Yes — "manual deletions"** |
| 31 | Create assignment | `assignments.create_assignment` (assignments.py:54) | **Y** | assignments.py:169 `assignment.create` | No (extra) |
| 32 | Withdraw assignment | `assignments.withdraw_assignment` (assignments.py:122) | **Y** | assignments.py:251 `assignment.withdraw` | Yes (deletion-like) |
| 33 | Escalate assignment | `engagement.run_engagement_sweep` | **Y** | engagement.py:486 `assignment.escalate` | Yes — AC-D26 |
| 34 | Start attempt | `attempts.start_attempt` | **Y** | attempts.py:835 `attempt.start` | No (extra) |
| 35 | Submit attempt | `attempts.submit_attempt` | **Y** | attempts.py:1187 `attempt.submit` | No (extra) |
| 36 | Autosave / pause / resume / next | router attempts.py:187/207/219/231 | **N** | NONE | No (in-progress state) |
| 37 | Resolve grade review (override) | `grade_review.resolve_flagged_review` :926 | **Y** | grade_review.py:1042 `grade_review.resolve` | Yes — "grade overrides" |
| 38 | Reconcile grade reviews (auto-flag) | `grade_review.reconcile_pending_grade_reviews` :502 (admin.py:91) | **N** | NONE | No (system re-review) |
| 39 | Loop queue approve | `loop.approve_admin_queue` (admin.py:176) | **Y** | loop.py:925 `loop.queue.approve` | Yes — "loop decisions reversed" |
| 40 | Loop queue reject | `loop.reject_admin_queue` (admin.py:246) | **Y** | loop.py:970 `loop.queue.reject` | Yes — "loop decisions reversed" |
| 41 | Anchors resolve | `calibration` (admin.py:300) | **Y** | calibration.py:1162 `anchors.resolve` | Yes (AC-D27 queue) |
| 42 | Anchors bootstrap/generate | router admin.py:196 | **Y** | admin.py:223 `anchors.bootstrap` | Yes — AC-D23 |
| 43 | Bootstrap run | router admin.py:327 | **Y** | admin.py:350 `bootstrap.run` | Yes — AC-D23 |
| 44 | Safety-links check sweep | router admin.py:365 | **Y** | admin.py:381 `safety_links.check` | Yes — AC-D21 |
| 45 | Calibration run | router admin.py:270 | **N** (sweep) | NONE (per-anchor resolves audited at #41) | No |
| 46 | Engagement sweep | router admin.py:72 | **Y** (per-escalation #33) | engagement.py:486 | Yes — AC-D26 |
| 47 | Drive ingest | router rag.py:51 | **Y** | rag.py:83 `drive.ingest` | No (extra) |
| 48 | Realism flag | router rag.py:95 | **Y** | rag.py:151 `realism.flag` | No (extra) |
| 49 | Realism aggregate | router rag.py:168 | **Y** | rag.py:189 `realism.aggregate` | No (extra) |
| 50 | Pill proposal approve | `catalogue` :604 (catalogue.py:378) | **Y** | catalogue.py:604 `pill_proposal.approve` | Yes — "pill proposals approved" |
| 51 | Pill proposal reject | `catalogue` :630 (catalogue.py:394) | **Y** | catalogue.py:630 `pill_proposal.reject` | Yes — "pill proposals rejected" |
| 52 | Pill proposal create | router catalogue.py:330 | **N** | NONE | No (AI queue submission) |
| 53 | Budget alert fired | `cost._maybe_fire_budget_alert_inner` | **Y** | cost.py:524 `budget_alert.fired` | No (extra; fail-soft-wrapped) |
| 54 | Safety-links curate/drift/broken | `safety_links` :261/324/339/223 | **Y** | safety_links.py:223/261/324/339 | Yes — AC-D21 drift |
| 55 | Auth: login/logout/refresh/setup/reset/privacy-ack | auth.py:63–157 | **N** | NONE | No (self-service auth) |

**Gaps drawn from the matrix:** #3/#6/#11/#14/#16/#30 (manual deletions → S5-1, High); #1/#2/#4/#5/#9/#10/#12/#13/#28/#29 (create/update twins → S5-2, Medium; #5 `update_pill` safety re-tag sharpest); #18 (admin user-create → S5-3, Low/accept); #38 (reconcile auto-flag → S5-4, Low/accept).

---

## Cross-cutting patterns (aggregator) — three confirmed for Audit-5 synthesis

1. **★ Create-loud / update-quiet asymmetry — CONFIRMED across Audits 2/3/4.** S5's matrix shows the catalogue CRUD has create+update+delete **all** unaudited while only special lifecycle verbs (retire/lock/publish) were wired; the same "primary path instrumented, twin isn't" shape recurs in the submit-path hooks (S1) and SLA auto-flag (S1-M2). Extends Audit-2 (M1/M6/B1-2) and Audit-3 (L2-F2/L4-F2/L3-F3).
2. **★ Backend degrades, the surface looks normal — Audit-4 dominant family.** Stub = $0 "no spend" (S3-C); result-fetch failure = blank "nothing here" (S7-F1); poll failure = fake progress (S7-F2); dropped questions = short attempt (S8-F2); decisionless proposal = "approved" (S8-F1); parse-fail grade = clean zero (S1-M1).
3. **★ Test harness validates the code's assumptions, not the real contract — confirmed across Audits 1/2/3** (carried forward: e2e couldn't run without Postgres; FakeSession masks FK/unique; FE role mocks use the wrong literal). Recorded here for the Audit-5 synthesis.

Supporting (within Audit 4): **submit-path fail-soft swallows integrity work** (S1-H1/H2); **audit-trail gaps for trust-critical actions** (S5-1 + →S5 from S1-H1, S2-M1, S3-H, S3-M); **the one catch that binds no error** (`use-attempt.ts:308`) is the root of three FE findings.

## F2-1 re-examination
**Confirmed, deduped across S6/S7 as one issue.** Mechanism side (S6, High): the retry loop never inspects the rejection, so it's unsound for the permanent `attempt_paused` case. Surface side (S7, Medium): the user sees a spurious, connection-blaming banner while validly paused. Re-confirmed as also-A4/also-A2.

---

## Triage summary (locked)

- **Fix-now (Critical; priority tag only, no code change in the audit cycle):** S3-C. Joins the 4-item fix-now tier — Audit-2 H1+H2, Audit-3 L1-F1+F2.
- **Queue (20):** S1-H1, S1-H2, S3-H, S5-1, F2-1, S7-F1, S8-F1, S8-F2, S1-M1, S1-M2, S1-M3, S2-M1, S2-M2, S3-M, S5-2, S6-M1, S6-M2, S7-F2, S8-F3/F4, S6 retry-race.
- **Accept (9):** S1 telemetry, S1 reconcile, S2 `_host_of`, S3 retry-steps, S4 commit-before-email, S7 benchmark conflation, S8 ResultHero, S5-3 admin user-create, S5-4 grade-review reconcile.

*Read-only audit — no source files were modified or executed during investigation (the S3 Critical was source-verified, read-only). Per audit-trail convention, GitHub issues are not opened per-audit; convergent sites are identified after Audit 5's cross-audit synthesis.*
