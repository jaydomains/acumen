# Audit 3 — Functional Correctness

**Date:** 2026-05-30
**Type:** Functional-correctness audit (read-only)
**Scope:** Does the shipped code implement what the spec says? Each major surface traced end-to-end — SPEC-says-X → code-does-Y → user-sees-Z — against its declared anchor behaviour. Targets silent semantic divergence: code that runs fine but does the wrong thing per spec; partial implementations; missing declared side-effects; undeclared extra behaviour; documented invariants violated under normal use.
**Out of scope:** build issues (Audit 1), crash/fail bugs (Audit 2), silent error-swallowing (Audit 4), code quality (Audit 5), missing roadmap items, behaviour that "feels wrong" without a contradicting spec line.
**Method:** 7 parallel read-only lanes — L1–L6 domain verticals (each tracing its AC-D*/AC-CD* anchors → backend → API/wire shape → FE-spec → shipped components) + L7 cross-cutting (AC-CD invariants, wire-contract, subsystem consistency). Conservative bar: a finding is a genuine spec-vs-shipped delta with both sides quoted, not a difference of interpretation. Spec-ambiguous-but-code-reasonable → **Ambiguity** (separate). Deliberate coherent divergence → **Intentional-evolution** (separate).
**Severity:** Major (surface materially fails the contract / invariant violated in normal use) · Moderate (partial impl or wrong sub-case) · Minor (cosmetic/edge delta).

> **Triage note.** "Fix-now" is a **priority tag only** for post-Audit-5 sequencing. **No code changes occur during the audit cycle — audits are read-only end-to-end.** Triage locked at Audit 3 close. No GitHub issues opened per-audit; convergent sites are identified after Audit 5's synthesis.

> **Two subagent claims were source-verified before finalizing:**
> - **L5-F1 mechanism corrected.** `Test.pill_id` **does exist** (`app/models.py:436`, added by migration `0008_slice_b_test_pill_id`). The lane's "no such column / AttributeError" framing was a misread. The functional delta survives via a different mechanism (NULL `Test.pill_id` on per-Testee / loop-driven tests), captured accurately below.
> - **L1-F1/F2 confirmed real.** Backend `ROLE_ADMINISTRATOR = "administrator"` (`app/permissions.py:65`) with no `administrator`→`admin` remap in `schemas.py` (`Role = Annotated[str, AfterValidator(_validate_role)]`, passthrough). FE `narrowRole` accepts only `"admin"`/`"testee"`. Audit-1 stayed green because (a) `schema.json` types `role` as bare `{"type":"string"}` (no enum → no typecheck catch) and (b) every FE test mock uses `role:"admin"` (10×, incl. MSW `handlers.ts:1990`; `"administrator"`: 0) — the FE cohort is self-consistent on the wrong literal.

---

## Verdict

The implementation is **broadly faithful to spec** — every lane returned substantial verified-conformant coverage (auth mechanics, the AC-D26 engagement engine, AC-D27 calibration math, AC-D19 grade review, AC-D25 streaming, AC-CD5 authz on every protected route, the migration chain). Deltas concentrate in two systemic shapes: **(1) declared side-effects that silently never fire** (notification emails, incremental bootstrap, focus-audit persistence), and **(2) a FE/test-harness layer that validates the code's own assumptions rather than the real wire contract** — which converges with Audit 1 (e2e couldn't run, no Postgres) and Audit 2 (FakeSession masks DB constraints).

**17 findings: 7 Major · 7 Moderate · 3 (+ further Minor) Minor · 7 Ambiguity · 7 Intentional-evolution.**

## Per-lane summary

| Lane | Maj / Mod / Min | Posture |
|---|---|---|
| L1 Identity & Access | 3 / 0 / 2 | Backend faithful; FE↔BE role-literal split is the headline |
| L2 Catalogue / Pills / Tests | 1 / 1 / 1 | Conformant; missing incremental-bootstrap side effect |
| L3 Assignment / Engagement / Dashboard | 1 / 1 / 1 | Engagement engine strong; declared emails absent |
| L4 Attempt / Timing / Grading / Results | 1 / 2 / 0 | Lifecycle conformant; AC-D4 integrity layers partial |
| L5 Loop / Competence / Calibration | 1 / 2 / 1 | Core math faithful; display layer diverges |
| L6 AI / Cost / Streaming / Sourcing | 0 / 1 / 0 | Strongly conformant; one RAG fail-soft gap |
| L7 Wire-contract / Anchor-invariants | 0 / 3 / 2 | Contracts mostly hold; envelope + pagination splits |

---

## Findings by severity

### MAJOR (7)

**L1-F1 + L1-F2 · FE role literal `"admin"` vs backend `"administrator"` — TRIAGE: FIX-NOW (deployment-blocker)**
`frontend/src/lib/auth/context.tsx:41,71-72` (`AuthRole = "testee"|"admin"`, `narrowRole` returns `null` for anything else) vs `app/permissions.py:65` (`ROLE_ADMINISTRATOR="administrator"`). A real administrator's `/me` role narrows to `null` → admin layout `Gate` (`guards.tsx:124`) routes to `/403`; admins render with testee styling; user create/edit/role-filter send `role:"admin"` → backend `422 invalid_role` (`schemas.py:38-44`, `routers/users.py:82-87`). Verified real (see header note). Root cause is one literal; fix at the `/me` boundary or in `narrowRole`. (also-A2)

**L1-F3 · System groups report empty membership on read surfaces — TRIAGE: QUEUE**
`app/domain/catalogue.py:390-397` (`_group_member_ids`) reads only stored `GroupMember` rows; the three seeded system groups have none. Rule-derivation exists only in the assignment path (`assignments.py:76-88`), not the read API. FE-8 §B.2 and the router docstring both contract that system-group membership is server-computed. Admin sees "0 members" for All Users / All Testees / All Administrators; reporting rollups keyed on `member_ids` are wrong.

**L2-F1 · Incremental bootstrap does not auto-run on pill approval/creation — TRIAGE: QUEUE**
SPEC §4.1 (SPEC.md:174), AC-D7 (DECISIONS.md:205), AC-D20, AC-D21 (DECISIONS.md:531), AC-D23 all declare an incremental bootstrap auto-runs when a pill is approved/created (anchor pools + self-review + safety-link curation). `create_pill` / `approve_pill_proposal` (`app/domain/catalogue.py:153-182,567-613`) auto-tag safety only; bootstrap helpers are reachable solely via explicit admin endpoints. New pills ship with zero anchor pools (AC-D20 calibration never reaches n=20) and zero curated safety links until a manual full-tenant bootstrap.

**L3-F1 · Assignment-creation notification email never sent — TRIAGE: QUEUE**
SPEC §4.4 (SPEC.md:193) "Assignment notification emails the Testee(s) and surfaces in their dashboard"; §7.5 / §1 list assignment emails as a v1 SMTP use-case. `create_assignment` (`routers/assignments.py:54-82`, `domain/assignments.py:100-177`) persists + snapshots + audits only; no SMTP send (the seam is used in `users.py`/`auth.py`/`engagement.py`). Dashboard half ships; email half does not. Not error-swallowing — there is no send to fail.

**L4-F1 · AC-D4 #3 focus/tab-switch tracking never persisted — TRIAGE: QUEUE**
AC-D4 #3 (DECISIONS.md:142) "Every switch away is logged with timestamp and duration"; AC-D11 Implications (DECISIONS.md:330) names the `attempt_focus_event` child table; rationale: "anomalous patterns surface in admin dashboards." `frontend/src/lib/attempts/use-integrity.ts:12-18` counts focus events client-side only and explicitly does **not** POST (no endpoint serves the table). The behavioural-audit layer is reduced to an ephemeral on-screen counter; no audit data is generated.

**L5-F1 (B3-3 confirmed, Major) · Competence confidence qualifier counts `n` from the wrong pill linkage — TRIAGE: QUEUE**
AC-D20 (DECISIONS.md:519) and §4.10 (SPEC.md:232) contract that the per-pill confidence qualifier reflects the Testee's real attempt count ("n=47, confident" / n=20 threshold). `list_me_competence` (`app/domain/competence.py:626-657`) derives `n` by joining attempts to `Test.pill_id`, while the `CompetencyProfile` is keyed on `assignment.pill_id` (`competence.py:485,515-527`). **Corrected mechanism:** `Test.pill_id` exists but is NULL for per-Testee-generated and loop-driven follow-up tests (the dominant adaptive surfaces), so those attempts drop from the count → `n=0` → stuck "preliminary", and the "confident" state never fires. User sees the wrong confidence on the primary profile surface.

### MODERATE (8)

**L2-F2 (B3-6 confirmed) · `TestUpdate` bypasses the create-time mode/shuffle matrix — TRIAGE: QUEUE (defaulted — see Triage note)**
AC-D24 (DECISIONS.md:594) scopes `randomise_question_order`/`randomise_option_order` to frozen + hand-authored tests. `TestCreate._check_matrix` (`schemas.py:375-387`) enforces this; `TestUpdate` (`schemas.py:405-417`) has no equivalent validator and `update_test` blind-`setattr`s. `PATCH randomise_question_order=false` on a per_testee test persists, and `view_attempt` (`attempts.py:958-960`) reads the flag for per_testee attempts → renders un-shuffled, a state `TestCreate` forecloses.

**L3-F2 · Autonomous-loop follow-up-ready email never sent — TRIAGE: QUEUE**
SPEC §4.9 (SPEC.md:226) "follow-up test queued … notification to Testee"; §7.5 lists follow-up-ready emails. `app/domain/loop.py` contains no SMTP/notification code; follow-ups surface only via the dashboard `AdaptiveLoopCard`.

**L4-F2 · AC-D4 #5 n-gram overlap check narrowed below the declared "all attempts" — TRIAGE: QUEUE**
AC-D4 #5 (DECISIONS.md:144) + §4.8 declare the overlap check at grading for any attempt where material was served; the only declared skip is "nothing served." `apply_overlap_check` (`loop.py:186-192`) additionally early-returns unless assignment/loop origin with a non-null `assignment.pill_id` — self-initiated and path/multi-pill attempts silently skip. Deliberate at build-time but undeclared in SPEC/DECISIONS.

**L4-F3 · AC-D24 declares no shuffle↔grading mapping; shipped wire contract is positional — TRIAGE: QUEUE**
AC-D24 (DECISIONS.md:594-596) promises "identical content, unique presentation, gradable" but never pins how shuffled presentation maps back to grading. Presentation strips options to `{text,image_url}` with no stable id (`attempts.py:509-537`); FE submits a positional index (`QuestionMCQ.tsx:40`); grading compares against the unshuffled snapshot (`attempts.py:1207,1228`). The implied contract is structurally undeliverable by the shipped wire shape — the spec-contract root beneath Audit-2 H1.

**L5-F2 · Band labels bin the raw float, not AC-D9's rounded-integer bins — TRIAGE: QUEUE**
AC-D9 (DECISIONS.md:227,282) bands operate on the **rounded** float over integer bins (1-2/3-4/5-6/7-8/9-10). `band_string` (`competence.py:557-565`), `schemas.py:753`, and FE `band.ts:19-24` bin the **raw** float at `<3/<5/<7/<8.5`. BE+FE agree with each other but under-label by a band across the upper half of each integer (e.g. estimate 6.6 → spec Advanced, code Working).

**L5-F3 · Loop step-down keys on absolute score < 0.4, not difficulty-relative / same-difficulty — TRIAGE: QUEUE**
AC-D9 (DECISIONS.md:270) "three consecutive attempts where the score is well below the difficulty"; §4.9 (SPEC.md:228) "third failed loop iteration at the same difficulty." `loop_target_difficulty` (`competence.py:216-221`) fires on three overall scores each `< 0.4` with no difficulty linkage and no same-difficulty constraint. (The 0.4 value itself is Ambiguity; the missing difficulty/same-difficulty linkage is the delta.)

**L6-F1 (B4-1 confirmed) · `retrieve_for_generation` retrieval path not fail-soft — TRIAGE: QUEUE**
SPEC §6.1 (SPEC.md:386) + the function docstring promise "generation continues without RAG context" on any embed-or-retrieval failure. Only the embed call is wrapped (`drive_rag.py:697-708`); the `cosine_top_k` ranking at `:735` is outside the try/except and raises `ValueError` on a stale-dimension chunk, aborting generation. Shipped behaviour contradicts the §6.1 fail-soft contract.

**L7-A1 · AC-CD6 uniform error envelope only partially upheld — TRIAGE: QUEUE**
CODE_SPEC §5 / AC-CD6 declares every error response conforms to `{error:{code,message,detail}}`. `permissions.py:195-207` registers a handler for `APIError` only; FastAPI 422 (`RequestValidationError`) and unhandled 500 return `{detail:…}`. The FE explicitly parses both shapes (`form-errors.ts:5-13`), confirming the divergence; user-visible impact is bounded by that FE compensation.

**L7-A2 · AC-CD15 — DB-enforced invariants asserted against a FakeSession that cannot uphold them — TRIAGE: QUEUE**
CODE_SPEC §4/§15 declare unique `(test_id,testee_id,sequence_number)`, unique `(attempt_id,attempt_position)`, FKs etc. as contracts. `tests/integration/conftest.py:161-206` `add()`/`flush()` enforce nothing; production `_insert_attempt_with_sequence` (`attempts.py:634-671`) depends on `flush()` raising `IntegrityError` to drive its retry/`409` path, which the harness can never exercise. (= the Audit-2 FakeSession pattern, framed as a contract-testing gap.)

**L7-C1 · Pagination contract split — admin work-queues bypass the cursor envelope — TRIAGE: QUEUE**
CODE_SPEC §5 / AC-CD6 declare uniform cursor pagination (`?cursor=&limit=`, `meta.next_cursor`), upheld by ~12 endpoints. Four admin list endpoints (`admin.py:86,113,162,289`) return bespoke `{data:[...]}` with no `meta`/cursor params — all rows unpaginated.

### MINOR

- **L1-F4 · Token-lifetime UI copy contradicts real TTLs — TRIAGE: QUEUE.** UI says "7 days" (setup) / "30 minutes" (reset); real TTLs are 72h / 1h (`permissions.py:73-74`), and the email bodies say 72h / 1h. FE spec carried the wrong figures too. Misleading to users.
- **L7-B1 · FE branches on resolve codes the backend never emits — TRIAGE: ACCEPT.** Override/loop/calibration drawers check `REVIEW_ALREADY_RESOLVED` / `LOOP_ALREADY_RESOLVED` / `ANCHOR_ALREADY_RESOLVED`; backend emits lowercase snake codes. Dead branch; status-409 fallback preserves the UX.
- **L1-F5 (B1-1) · `add_group_member` no referential validation — TRIAGE: ACCEPT.** Phantom `user_id` persists; assignment path filters to active tenant users, so it only inflates `member_ids` counts.
- **L3-F3 (B3-4) · Direct `testee_ids` role-filter inconsistency — TRIAGE: ACCEPT.** Group path enforces `ROLE_TESTEE`; direct path filters active-only. Spec frames the population descriptively, not as an enforced rule.
- **L5-F4 · Dead `latest_band`/`retake_count`/`trend` columns — TRIAGE: ACCEPT.** Declared persisted fields never written; band re-derived on read (consistent with AC-D9's read-derivation rationale).
- **L7-B2 · FE reads `x-acumen-trace` header the BE never sets — TRIAGE: ACCEPT.** `ApiError.traceId` always null; the envelope `trace_id` is optional, so BE omission is itself conformant.
- **L7-C2 · 404 `error.code` non-uniform — TRIAGE: ACCEPT.** `users.py` emits `user_not_found`; all other admin resources emit generic `not_found`. No FE branches on it.

---

## Re-examination of the 9 `also-A3` items (from Audit 2)

| Item | Verdict | Disposition |
|---|---|---|
| B1-1 | Re-classified → **Minor** (L1-F5) | accept |
| B1-2 | **Folded — not A3** (AC-D16 = "cannot log in," not mutation-inertness) | accept |
| B3-3 | **Confirmed-A3 → Major** (L5-F1), mechanism corrected (NULL path) | queue |
| B3-4 | Confirmed-A3 → **Minor** (L3-F3) | accept |
| B3-6 | Confirmed-A3 → **Moderate** (L2-F2) | queue (defaulted) |
| B4-1 | Confirmed-A3 → **Moderate** (L6-F1) | queue |
| B4-2 | Re-classified → **note** (unreachable in v1; AC-D12 doesn't couple model/provider) | accept |
| F1-1 | Re-classified → **benign doc-drift**; clobber verified not to occur (one-shot hydration + localStorage cache + `refetchOnWindowFocus:false`) | accept |
| F2-2 | Re-classified → **doc-drift, not A3**; the per_testee guard lives on the runner page (shipped), not the resume hook | accept |

**Audit-2 backlog refinements applied at this triage:** B1-1, B1-2, F1-1, F2-2 move **queue → accept**; B3-3 confirmed at **Major** priority (was medium queue).

---

## Ambiguity (7 — spec-clarification workstream, not severity-scaled)

1. Escalation may fire in the same sweep pass as the 2nd reminder (causally correct; "after the second reminder is sent" doesn't clearly mandate a later tick).
2. `resolve_test` (`domain/tests.py:167-195`) doesn't re-check pill `discoverable`; mitigated by the detail endpoint's 404.
3. Result wire status `"complete"` (FE-4/FE-6 spec) vs `"ready"` (shipped BE + both FE sides); behaviour correct.
4. Confidence-gate `n` as per-band sum (`calibration.py:1216`) vs per-anchor — spec text ambiguous.
5. The `0.4` "well below the difficulty" constant value (the *value* is reasonable; the missing difficulty linkage is L5-F3).
6. AC-D25 "questions 2-N start as soon as Q1 is dispatched" (residual v1.7 prose) vs the authoritative v1.8 two-phase model in CODE_SPEC §10 — shipped follows the anchor.
7. AC-CD1 unbounded-above Acumen pins — `requirements.txt` matches the spec's own pin table verbatim.

## Intentional-evolution (7 — spec-staleness workstream)

1. Related-pill edges on pill detail deferred to v1.x (FE-3 §E).
2. Benchmark authoring locked out of the admin editor (FE-8), backend still supports it.
3. Follow-ups tab dropped / per-row nudge-reassign removed (declared FE descopes).
4. `loop_target_difficulty` uses `floor(estimate+1.0)` instead of `round(estimate+0.5)` — documented, more faithful than banker's rounding.
5. **Cost-dashboard by-operation / by-Testee breakdown descoped to v1.x (FE-9 specs) — but DECISIONS/SPEC prose never amended (stale upstream anchors).**
6. Admin work-queues return unpaginated shapes (deliberate, bounded operator lists) — also surfaced as L7-C1.
7. Stale drift-mode comments in dashboard/group components (behaviour correct).

---

## Cross-cutting patterns (aggregator)

1. **★ The test harness validates the code's assumptions, not the real contract.** Three independent instances converge: FE role mocks use the same wrong `"admin"` literal as the FE code (green tests, broken prod — L1-F1/F2); FakeSession can't enforce DB invariants (L7-A2); offline `codegen:check` can't catch live-wire drift. **Dominant cross-audit thread**, joining Audit-1 (e2e couldn't run, no Postgres) and Audit-2 (FakeSession masks FK/unique). Primary candidate for the Audit-5 synthesis.
2. **Declared side-effects silently absent** — assignment & follow-up emails (L3-F1/F2), incremental bootstrap (L2-F1), focus-event persistence (L4-F1). Happy-path/dashboard ships; the declared secondary effect doesn't.
3. **Create-path guards not mirrored elsewhere** — `TestUpdate` matrix (L2-F2), n-gram narrowing (L4-F2), direct-target role filter (L3-F3); same shape Audit 2 flagged (M1/M6/B1-2).
4. **FE display vs BE response shape** — role literal (L1-F1/F2), dead UPPER_SNAKE codes (L7-B1), `x-acumen-trace` (L7-B2), `complete`/`ready` (Ambiguity 3). Multiple FE assumptions the wire doesn't satisfy.
5. **Competence display layer diverges from the AC-D9/AC-D20 math contract** — band boundaries (L5-F2) + confidence `n` (L5-F1) — the user-facing profile under-represents the calibrated reality.
6. **Spec prose stale vs user-locked FE descopes** (cost dashboard, L6 IE-5) — the FE specs hold the truth; DECISIONS/SPEC weren't amended.

---

## Triage summary (locked)

- **Fix-now (deployment-blocker; priority tag only, no code change in the audit cycle):** L1-F1 + L1-F2.
- **Queue (17):** L1-F3, L1-F4, L2-F1, L2-F2 *(defaulted)*, L2-F3, L3-F1, L3-F2, L4-F1, L4-F2, L4-F3, L5-F1, L5-F2, L5-F3, L6-F1, L7-A1, L7-A2, L7-C1.
- **Accept (6):** L7-B1, L1-F5, L3-F3, L5-F4, L7-B2, L7-C2.
- **Ambiguity (7):** spec-clarification workstream.
- **Intentional-evolution (7):** spec-staleness workstream.

*Read-only audit — no source files were modified or executed during investigation (two subagent claims were source-verified, read-only). Per audit-trail convention, GitHub issues are not opened per-audit; convergent sites are identified after Audit 5's cross-audit synthesis.*
