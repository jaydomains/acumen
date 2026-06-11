# Acumen — Decisions Anchor Log

> Companion to `acumen/SPEC.md`. Each decision records what's locked, why, and what it implies. Decisions are ordered by ID. Cross-references use `AC-D{n}` for Acumen decisions and other prefixes (CH-D, TF-D, MC-D, PA-D, etc.) for platform-wide rules anchored in other modules' audits.
>
> **Status:** v1.10. Paired with `SPEC.md` v1.10.
>
> **Decision count:** 29 decisions (AC-D1 through AC-D29; AC-D27 added in v1.2, AC-D28 added in v1.9, AC-D29 added in v1.10). 6 amendments applied in v1.1 to AC-D4, AC-D9, AC-D11, AC-D18, AC-D19, and §8.7; 3 further amendments applied in v1.2 to AC-D9, AC-D22 (with §7.3), and AC-D25; 1 clarifying amendment applied in v1.3 to AC-D19 (review_status pending state); 1 clarifying amendment applied in v1.4 to AC-D26 (Attempt→Assignment attribution link); 1 clarifying amendment applied in v1.5 to AC-D3 (sequence_number scope per Testee per Test); 6 amendments applied in v1.6 (pre-build spec-audit consolidation) to AC-D4, AC-D9, AC-D11, AC-D12, AC-D19, and AC-D26, plus technical-anchor updates to AC-CD8 and the AC-CD11 gate-checklist; 1 amendment applied in v1.7 (AC-CD11 P6 gate closure) to AC-D19 — submit-wait wording realigned to the batched / 60-s-ceiling contract (F10 resolved) — plus the AC-CD11 technical anchor itself moving from deferred to resolved (mode + latency ceiling locked); 1 amendment applied in v1.8 (AC-CD10 / §10 P10 build gate closure) to AC-D25 — execution model locked as in-process `asyncio.gather` + `asyncio.Semaphore` (Celery wording retired from the user-facing path); Question gains an attempt-scoped `attempt_position` column for stable streamed-arrival ordering; single-failure policy locked as one orchestration-layer retry then AC-D11 pause; **AC-D28 minted and 3 amendments applied in v1.9** (autonomous-content-generation amendment cycle, **PR-A — corpus & authority foundation**): **AC-D28** (source-authority allowlist + tiered scoring) minted; **AC-D21** (web search extended to corpus acquisition; self-review re-adjudicates `safety_relevant`; admin tag-override relocated to retroactive oversight), **AC-D22** (Drive-folder RAG ingestion retired in favour of the AI-built reference corpus; "queried at every generation call" extended to §6.5), and **AC-D23** (Drive embed bootstrap step retired → reference-corpus build; incremental bootstrap fires on auto-publish; mutual cross-reference with AC-D7) amended — all ratified through the authenticated in-session channel for this sequenced ratification cycle (workstream PR #107, detail-plan PR #108, extraction PR #109). **AC-D29 minted and the AI-operation count amended in v1.10** (autonomous-content-generation amendment cycle, **PR-B — generation + provenance + ops-count**): **AC-D29** (generation provenance chain) minted; the AI-operation count moves **seven → nine** — `pill_generation` (Anthropic-family, B1) and `content_self_review` (cross-family, C1; protocol AC-D lands in PR-C) — touching **AC-D1** Implications, **AC-CD8** (enum prose + numeral), and **AC-D12** (Anthropic five→six, cross-family two→three); built-state note: nine ops are canonical, `content_self_review` wiring completes in PR-C. All ratified through the authenticated in-session channel for this cycle. Original v1.0/v1.1 wording preserved in git history; current document reflects amended decisions as the authoritative text.

---

## Amendments applied in v1.1

The following v1.0 decisions were amended during the v1.1 review pass. Their current text below reflects the amended version; the change rationale is preserved inline within each decision.

| Decision | Change summary |
|---|---|
| AC-D4 #5 | Stylistic AI-prose detection replaced with deterministic n-gram overlap against served learning material |
| AC-D9 | Added derived `competence_estimate` float per Testee per pill alongside the integer band stamp |
| AC-D11 | Pause mechanism now blanks question content; max pause duration enforced |
| AC-D18 | Worked cost example added; loop-driven and assignment-driven test generations exempted from per-Testee rate limit |
| AC-D19 | Review pass changed to cross-family (OpenAI on Anthropic by default) and made synchronous before band stamp displays |
| §8.7 | Privacy notice simplified for internal-staff context (full multi-tenant notice deferred to SiteMesh port) |

## Amendments applied in v1.2

The v1.2 review pass added one new decision and amended three existing ones to make under-specified mechanisms implementable. Current text below reflects the amended version; the change rationale is preserved inline within each decision.

| Decision | Change summary |
|---|---|
| AC-D27 | New decision — full anchor calibration mathematics (Bayesian effective-difficulty estimator, fresh-question delta scoring, cold-start confidence) that AC-D20 deferred |
| AC-D9 | Replaced the under-specified competence formula with an IRT-style per-attempt value plus recency-weighted decay and an explicit adaptive-loop target |
| AC-D22 / §7.3 | Embedding model default fixed to OpenAI `text-embedding-3-small`; Anthropic offers no embeddings API |
| AC-D25 | Benchmark mode opts out of JIT streaming; sequential adaptive generation only |

## Amendments applied in v1.3

The v1.3 review pass applied one clarifying amendment to resolve an internal contradiction in AC-D19's treatment of `review_status`. Current text below reflects the amended version; the change rationale is preserved inline within the decision.

| Decision | Change summary |
|---|---|
| AC-D19 | Clarified that `review_status` has three states (pending / confirmed / flagged); removed contradictory "no pending state" phrasing — pending is the fail-soft state on review-provider outage |

## Amendments applied in v1.4

The v1.4 review pass applied one clarifying amendment to AC-D26, making the Attempt→Assignment attribution link explicit so `engagement_status` derives unambiguously. Current text below reflects the amended version; the change rationale is preserved inline within the decision.

| Decision | Change summary |
|---|---|
| AC-D26 | Added explicit `Attempt.assignment_id` FK (set at start_attempt for assignment-driven / loop-driven origin) so `engagement_status` derives by assignment match, not origin/timing heuristics — removes ambiguity when a Testee has multiple assignments on the same pill or path |

## Amendments applied in v1.6

The v1.6 review pass is a single consolidated pre-build spec-audit clarification. A read-only audit (`docs/_meta/spec-audit-2026-05-19.md`) of the P4/P5/P6 build surface flagged 18 drift items; 16 are folded here, 1 is deferred to the AC-CD11 gate (F10), 1 is dismissed (F17). The amendments reconcile spec prose with the already-shipped P1 schema — doc-only, no code, no migration, no anchor renames. (No "Amendments applied in v1.5" section exists: v1.5 was an editorial-only correction and PR-013 deliberately did not open one; the v1.5 narrative clause in the header above closes that narrative gap without changing that asymmetry.) Current text below reflects the amended version; the change rationale is preserved inline within each decision.

| Decision | Change summary |
|---|---|
| AC-D4 | #5 n-gram overlap base scoped to AI-generated `served_text` only (admin-uploaded references and curated external links excluded) |
| AC-D9 | Path-of-pills: assignment difficulty clamps per pill to each pill's `available_difficulty_range`; path completion = all in-scope pills attempted and submitted by the assignee |
| AC-D11 | Pause snapshot/restore = flush-and-reload of autosaved `response` rows, not a new artifact; pause/focus persist to the shipped `attempt_pause_event` / `attempt_focus_event` child tables |
| AC-D12 | Provider resolution restated; `system_settings.provider_by_operation` confirmed shipped (no AC-D12 wording dropped) — F8 inverted vs the audit's doc-only read |
| AC-D19 | Review fields on `grade_review` (1:1 with `grade`, in-place reconcile, no history); deterministic responses have no review row; flagged grades show a provisional "under review" state (AI grade withheld); stuck-pending auto-flags after N retries; mixed-test result display gate; pending→retry runs on the new grade-review reconcile cron |
| AC-D26 | `engagement_status` and reminder-cease are per (assignment, Testee); reminder send history stays assignment-scoped (shipped `assignment_reminder` has no `user_id`) |
| AC-CD8 | (technical, CODE_SPEC §7) operation enum drives 9-operation → 4-method routing (v1.10: +`pill_generation`→generate, +`content_self_review`→review); provenance persists on every AI-produced entity via the shipped AI-provenance columns |
| AC-CD11 | (technical, CODE_SPEC §18) gate-resolution checklist gains the deferred F10 note: closing the gate must also amend AC-D19's "10–30 second" submit-wait wording — deferred, not resolved in v1.6 |

---

## Amendments applied in v1.7

The v1.7 review pass closes the AC-CD11 P6 build gate (cross-family review pipeline & latency budget — deferred since v1.0). One product anchor (AC-D19) is amended so its submit-wait wording matches the resolved contract (F10 in the v1.6 spec-audit). The AC-CD11 technical anchor itself moves from "needs user input (P6 gate)" to resolved (CODE_SPEC §18). The 5-min × 10-retry ≈ 50-min stuck-pending auto-flag window already locked in v1.6 is named explicitly in AC-D19 / AC-CD11 / SPEC §8.9 (F11 amplified, no default changes). Doc-only; no schema delta; no migration; AC-CD11 retires from the CHECKLIST drift list. Current text below reflects the amended version; the change rationale is preserved inline within the decision.

| Decision | Change summary |
|---|---|
| AC-D19 | Submit-wait wording realigned to batched-per-attempt review with a 60-second hard ceiling; over-ceiling routes to the existing `pending` + reconcile-cron fail-soft path; ≈50-min auto-flag window named explicitly (F10 resolved, F11 amplified) |
| AC-CD11 | (technical, CODE_SPEC §18) P6 build gate closed — mode locked as batched per attempt, hard latency ceiling locked at 60 s, over-ceiling routes to the v1.6 grade-review reconcile cron |

---

## Amendments applied in v1.8

The v1.8 review pass closes the AC-CD10 / §10 P10 build gate (JIT streaming generation execution model + Question ordering + single-failure policy). The residual ambiguity in §10 — "parallel Celery tasks" prose alongside an SSE response shape, with no schema anchor for streamed-arrival order and no explicit single-failure policy — surfaced at the P10 plan-mode gate and is closed here before P10 build opens. One product anchor (AC-D25) is amended so its Implications spell out the locked execution model, the new `attempt_position` column on Question, and the orchestration-layer single-retry-then-AC-D11-pause behaviour. The AC-CD10 technical anchor body is amended in place; its Confidence stays `confident default` (the v1.2 close already retired its "needs user input" status; v1.8 is a body clarification, not a confidence change). Doc-only; no schema delta in this PR (the additive `attempt_position` migration is a P10 build deliverable, not v1.8); AC-CD10 is recorded as a closed historical gate in the CHECKLIST drift-questions section alongside AC-CD11. Mirrors the **PR-017 / AC-CD11 v1.7 gate-closure precedent** verbatim. Current text below reflects the amended version; the change rationale is preserved inline within the decision.

| Decision | Change summary |
|---|---|
| AC-D25 | Execution model locked as in-process `asyncio.gather` + `asyncio.Semaphore` (concurrency bound = `jit_buffer_size`, default 3; ceiling = `jit_buffer_max`, default 5; both env-default in `app/config.py`); per-Testee Q2…N generation runs in the same uvicorn worker as the SSE response, not as Celery tasks; Question entity gains an attempt-scoped `attempt_position` column (with `(attempt_id, attempt_position)` unique) for stable streamed-arrival ordering; single-Q-N-generation-failure policy is one orchestration-layer retry (above tenacity's HTTP-level retries inside `app/ai/anthropic.py::_invoke`), then the in-flight attempt is paused via the existing AC-D11 pause mechanism and the Testee sees the §10 "retry / abandon" UI on resume. Closes the residual AC-CD10 / §10 ambiguity surfaced at the P10 plan-mode gate. |
| AC-CD10 | (technical, CODE_SPEC §18) P10 build gate closed — execution model, ordering column, and single-failure policy locked in the Decision body (no confidence change; v1.2 already retired its "needs user input" status). |

---

## AC-D1 — Application identity

**Decision:** Application name is Acumen. Decision prefix AC for all module-specific decisions. Mandate: generate, run, grade, and follow up on competency tests for staff as part of an autonomous learning loop; identify per-pill knowledge gaps; serve targeted learning material; re-test to confirm improvement. Hand-authored tests are supported as the exception, not the rule. Built as a standalone application now; intended for future conversion to a SiteMesh peer module integrating with Knowledge Library. Permission keys namespaced under `acumen:*`.

**Rationale:** "Acumen" captures sharpness of practical knowledge and judgment — the thing competency assessments measure and the closed loop sharpens over time. The application's primary value is not assessment but measurable knowledge improvement: AI generates, AI grades, AI identifies weakness, AI teaches, AI re-tests. Admin involvement is strategic (subject scope, sensitive-case oversight), not operational. Building standalone first lets KBC deploy and train staff immediately without waiting for Auth Hub or other SiteMesh dependencies.

**Implications:** Acumen owns **nine** AI-driven operations as of v1.10 (test generation, grading, weakness identification, learning material generation, pill proposal, grade review per AC-D19, anchor self-review per AC-D23, **pill generation per AC-D29 — the autonomous topic→N draft generator, distinct from the pill-proposal refiner**, and **content self-review per the self-review AC-D, PR-C — the cross-model generated-content review floor**); the original seven were locked at v1.1, pill generation + content self-review added in the v1.10 autonomous-content cycle. *Built-state note: nine operations are canonical; `pill_generation` wiring lands with PR-B's B1 execution and `content_self_review` wiring completes in PR-C.* The `embed` operation remains the un-counted **tenth** enum member (canonical: nine named operations + the internal `embed` call, which is not a user-facing AI operation). Each is a separate version-controlled prompt. Codebase root follows the standalone repo's conventions. Permission keys live under `acumen:*`. SiteMesh-specific architectural commitments (MeshCore posture, substrate role, inter-module events) are deferred to the conversion-phase spec.

**Spec reference:** Header, §1.

**Related:** AC-D5, AC-D6, AC-D7, AC-D19, AC-D23.

---

## AC-D2 — Two-role user model for standalone

**Decision:** Acumen standalone ships with two user roles — Administrator (full access) and Testee (take assessments, view own results). Users are created by Administrators and assigned one of the two roles at creation. No self-registration. Roles stored as a single open field on the user record, allowing future role additions without schema changes.

**Rationale:** Acumen serves the full organisation's competency testing needs across all functions. The two-role model captures the access boundary that matters: separating those who author and manage assessments from those who take them. No further role distinctions are needed at the application's deployment scale; the open role field accommodates Author, Reviewer, and Manager additions later without migration pressure.

**Implications:** Authentication system needs only role-based authorisation, not granular permissions. Administrator-only routes are gated by role check. Testees can only access their own attempt and result records, enforced at the data access layer. When Acumen converts to a SiteMesh module, the two roles align to the platform's five user types per CH-D15: Administrator → owner, Testee → participant.

**Spec reference:** §2.

**Related:** AC-D1.

---

## AC-D3 — Test access model: open library plus assignments

**Decision:** Published tests appear in an open library all Testees can browse and take voluntarily. Administrators can additionally assign specific tests to specific Testees or groups with optional deadlines and mandatory flags. Tests carry a visibility flag — **library** (browsable by Testees) or **private** (only accessible via explicit assignment, never appears in the library). Testees may retake any test as often as they wish; all attempts are stored, the score of each is preserved, and the retake count is surfaced alongside the latest score in admin views.

**Rationale:** KBC needs both modes — formal competency testing driven by admin AND self-directed learning. Unlimited retakes treat self-driven retesting as a learning tool, with the retake count visible so admins can distinguish "passed first time" from "passed on attempt seven." Private visibility supports probation reviews, hiring assessments, and any test where library exposure would defeat the purpose.

**Implications:** Tests have status (draft / published) and visibility (library / private). Attempts record origin (self-initiated, assignment-driven, or loop-driven per amended AC-D18) and sequence number per Testee per Test. Admin views show retake count next to latest score.

**Spec reference:** §3, §4.

**Related:** AC-D2.

---

## AC-D4 — Test integrity: deterrence, detection, and design

> **Amended in v1.1** — #5 (AI-prose detection) replaced with deterministic n-gram overlap detection. See change rationale below.
>
> **Amended in v1.6** — #5 n-gram base scoped to AI-generated `served_text`. See v1.6 note in Implications.

**Decision:** Acumen treats test integrity as a layered defence — deterrence, behavioural audit, and resistance through test design — rather than impossible prevention. The following measures apply during all attempts:

1. **Frictional deterrents** — right-click context menu disabled, text selection disabled, copy/paste keyboard shortcuts disabled. Bypassable by technical users but raises the bar above casual cheating and signals integrity expectations.
2. **Watermarking** — each question displays the Testee's name and timestamp as a low-opacity overlay. Any screenshot is clearly attributable to the person who took it.
3. **Tab-switch / focus tracking** — the Testee's window focus is monitored throughout the attempt. Every switch away is logged with timestamp and duration.
4. **Time-per-question logging** — time spent on each question is recorded. Anomalous patterns surface in admin dashboards.
5. **Deterministic served-material overlap detection** — at grading, the system computes shingled n-gram overlap between the Testee's response and the most recently served learning material on the same pill (if any was served to this Testee). Overlap above a configured threshold (default 60% trigram overlap) flags the response as suspected copy-from-explainer. No stylistic, prose-rhythm, or "AI-typical phrasing" detection is performed.
6. **Integrity through test design** — questions favour KBC-specific context, scenarios, photo-based defect identification, and multi-part reasoning.
7. **Anti-collusion shuffle on shared tests per AC-D24** — frozen and hand-authored tests shuffle question and option order per attempt so Testees sitting in the same room see different presentations of identical content.

Webcam proctoring, browser lockdown extensions, and any pretence of OS-level screenshot prevention are out of scope.

**Rationale:** Web applications cannot prevent screenshots. The honest posture is to make cheating harder than doing the test, generate audit data when cheating is attempted, and design tests so AI tools don't produce winning answers.

**Amendment rationale (v1.1, #5):** Stylistic detection of AI-flavoured prose carries unacceptable false-positive risk — second-language English writers, Testees who recently absorbed the AI-generated explainer Acumen served them, and formally-trained staff all get flagged disproportionately to actual integrity violations. Deterministic overlap detection captures the actual concern (copy-paste from served material) with no false positives on writing style.

**Implications:** Attempts table includes a sub-collection of focus events. Question rendering includes a watermark layer. Grade entity's integrity-flag field captures "served-material-overlap flag with overlap percentage" instead of a stylistic phrasing flag. New deterministic logic — text shingling, n-gram comparison, threshold check — runs in the grading pipeline; cheap, no AI cost. For Testees who were never served learning material for that pill, overlap check is skipped. **(v1.6)** The n-gram overlap base is the AI-generated explainer text only — `learning_material` rows with `source = ai_generated`, compared via the row's `served_text` snapshot captured at `served_at` (both shipped columns). Admin-uploaded references and curated external links are not n-gram compared.

**Spec reference:** §4, §6.

**Related:** AC-D3, AC-D24.

---

## AC-D5 — AI-driven test generation with per-Testee variation

**Decision:** Acumen generates test content on demand using AI. Two modes coexist: **per-Testee** (default) — each Testee taking a given subject/pill combination receives a uniquely generated question set; and **frozen** — admin generates and publishes a fixed test that is reused across many Testees. Per-Testee mode is the integrity default and the standard mode for the adaptive learning loop. Frozen mode is used for standardised testing, hiring screens, and any case where comparability across candidates matters. Hand-authored tests are stored as "frozen" tests created by admin rather than AI. Benchmark mode added in AC-D13 is a fourth mode.

**Rationale:** Uniqueness prevents answer-sharing between staff and lets the loop target each Testee's specific weak pills. Reusability serves cases where consistency across candidates is the goal. Per-Testee is the default because the system operates at this mode at scale; frozen is the explicit choice when standardisation matters.

**Implications:** Test generation is a separate AI operation from grading. A "test" entity in per-Testee mode is a generation spec, not a fixed question set. Generated questions are stored against the attempt, not the test. In frozen mode, questions are stored against the test entity. The generation prompt is version-controlled and includes integrity directives. Per-Testee generation has per-attempt cost — see amended AC-D18 worked example.

**Spec reference:** §3, §4, §6.

**Related:** AC-D1, AC-D4, AC-D6, AC-D13, AC-D24, AC-D25.

---

## AC-D6 — Adaptive learning loop

**Decision:** After each attempt, Acumen runs a per-Testee adaptive learning loop:

1. Each graded response is tagged with the pill(s) it covered.
2. The Testee's per-pill competency profile is updated, including the `competence_estimate` float per amended AC-D9.
3. Pills scoring below threshold are flagged as weak.
4. For each weak pill, Acumen generates AI explainer material (default) and surfaces any admin-uploaded reference material. **Safety-tagged pills per AC-D21 serve curated external link sets instead of AI explainers — no AI teaching content is generated for safety pills.**
5. A follow-up test is generated targeting the weak pills specifically (per-Testee generation per AC-D5, loop-driven origin per amended AC-D18 — exempt from per-Testee rate limit).
6. The loop repeats until thresholds are met or the admin intervenes.

The loop operates in two modes, configurable per test: **autonomous** (no admin step — Testee proceeds through learn-and-retest automatically) and **admin-reviewed** (admin sees the weakness report after each attempt and decides what learning material and follow-up to push).

**Rationale:** The closed-loop learning system is the core value of Acumen. Autonomous mode is the goal state for routine continuous learning; admin-reviewed mode exists for sensitive cases where admin judgment matters.

**Implications:** Per-Testee per-pill competency profile is a first-class data structure with both band stamp and competence_estimate float per amended AC-D9. Each attempt produces a weakness report payload. Learning material is its own entity, sourced as AI-generated explainer (non-safety pills), admin-uploaded reference, or curated external link set (safety pills). Follow-up tests are linked to their parent attempt for lineage tracking.

**Spec reference:** §4, §5.

**Related:** AC-D5, AC-D7, AC-D9, AC-D21.

---

## AC-D7 — Pill catalogue: subjects and pills

**Decision:** Acumen's content spine is a **pill catalogue** — a hierarchical taxonomy of Subjects (top-level) and Pills within each. Pills are intentionally expansive — covering core role knowledge, adjacent industry topics, and certification-prep tracks. Governance is hybrid: admin seeds and curates the catalogue with AI proposals; AI extends autonomously as new gaps surface. Both Admins and Testees interact with the catalogue — admins to assign and curate, Testees to select for self-directed learning per AC-D8. Every question, response, and learning material item is tagged with one or more pills. Per-Testee per-pill competency scores form the spine of the competency profile.

**Rationale:** Subject taxonomy is too important to fully automate and too fluid to fully hand-author. The hybrid approach lets admins set strategic boundaries while AI fills in tactical detail. Expansive scope is deliberate: it gives Testees room to grow within a curated structure.

**Implications:** Pills are versioned entities with metadata (difficulty range, estimated time, related pills, `safety_relevant` flag per AC-D21, `safety_links` cached set for safety pills per AC-D21, anchor question pools per band per AC-D20). New pill proposals surface in admin's review queue with self-applied safety classification per AC-D21. When a new pill is approved, an incremental bootstrap auto-runs per AC-D23. Admin can manually retire pills at any time; retired pills are hidden from active flows but retained per AC-D14. Admin can group pills into named Learning Paths. Testees can also create personal paths from pills they select.

**Spec reference:** §3, §4, §5.

**Related:** AC-D5, AC-D6, AC-D8, AC-D14, AC-D20, AC-D21, AC-D23.

---

## AC-D8 — Testee self-directed learning via pill discovery

**Decision:** Testees can browse the pill catalogue and self-select pills to drive their own learning. Selected pills generate AI tests and learning material targeted at those pills. Self-directed learning is voluntary, has no deadline, and is recorded in the Testee's competency profile distinct from admin-assigned activity. Testees see all pills marked as discoverable in the catalogue, including pills adjacent to or beyond their core role — restricted only by the catalogue boundary and a `discoverable` flag on individual pills.

**Rationale:** Structured discovery is how knowledge actually grows. The catalogue boundary keeps this productive without becoming a free-for-all. The closed-loop AI engine is the same regardless of who triggered the attempt — letting Testees self-trigger costs almost nothing in engineering while unlocking significant cultural value.

**Implications:** Attempts have an `origin` field per AC-D3 — discovery-driven attempts use the self-initiated origin and count toward per-Testee rate limits per amended AC-D18. Competency profile views distinguish admin-assigned progress from self-driven progress. A `discoverable` flag on each pill lets admin keep certain pills assignment-only. Testees cannot create new pills directly.

**Spec reference:** §3, §4.

**Related:** AC-D3, AC-D7, AC-D18.

---

## AC-D9 — Difficulty: 10-point slider with five anchored bands

> **Amended in v1.1** — Added derived `competence_estimate` float per Testee per pill. The integer axis remains as question-side difficulty and human-facing label; competence is now estimated as a continuous float separately. **Amended again in v1.2** — the full competence formula (IRT-style per-attempt value, recency-weighted decay, explicit adaptive-loop target) is now specified. See change rationale below.
>
> **Amended in v1.6** — path-of-pills difficulty clamp + path completion rule. See v1.6 note in Implications.

**Decision:** Acumen represents question-side difficulty as an integer 1–10 with five anchored bands:

| Slider | Band | Profile |
|--------|------|---------|
| 1–2 | **Novice** | New to the topic. Vocabulary, basic concepts, recognition-level questions. |
| 3–4 | **Junior** | Apprentice-level. Concepts known, application under supervision. Standard scenarios. |
| 5–6 | **Working** | Confident day-to-day practitioner. Independent on normal cases, common edge cases. |
| 7–8 | **Advanced** | Senior practitioner. Complex situations, conflicting requirements, multi-domain reasoning. |
| 9–10 | **Expert** | Mastery. Novel situations, ambiguity, leadership-level judgement, could teach others. |

The integer (1–10) is the stored question-side source of truth. The band name is derived on read.

Additionally, a derived **`competence_estimate`** (float, 1.0–10.0) is computed per Testee per pill, representing the empirical estimate of the Testee's current competence on that pill. The estimate is a recency-weighted average of attempt performance against question effective-difficulty (per AC-D20 anchor calibration), with exponential decay so recent attempts count more than historical (default half-life: 90 days, configurable). Band labels for display are derived from this float rather than from the integer of the latest attempt. The adaptive learning loop per AC-D6 uses the float for step-up/step-down decisions — a competence estimate of 6.7 on a pill with current attempts at integer 6 triggers a step-up to integer 7 rather than waiting for a clean pass at exactly 6.

The competence_estimate is computed as follows.

*Per-attempt competence value (IRT-style):*

For each response within an attempt:
`response_competence = effective_difficulty + (competence_sensitivity × (response_score − 0.5))`

where `effective_difficulty` is per AC-D20/AC-D27, `response_score` is 0.0–1.0, and `competence_sensitivity = 2.0` (configurable in System Settings).

Interpretation: a score of 0.5 means the Testee performed exactly at the question's difficulty level — their competence equals the difficulty. Scoring above 0.5 lifts competence above the difficulty; below 0.5 drops it below. The sensitivity factor sets how much.

`attempt_competence = mean(response_competence) across all responses in the attempt`

*Recency-weighted average across all attempts on this pill:*

`competence_estimate = Σ(attempt_competence × weight) / Σ(weight)`

where `weight = 0.5 ^ (age_in_days / competence_decay_halflife_days)` and `competence_decay_halflife_days = 90` (configurable). An attempt today has weight 1.0; an attempt 90 days ago has weight 0.5; an attempt 180 days ago has weight 0.25.

*Null handling:* For pills with zero attempts by a Testee, `competence_estimate` is null. UI displays "no data yet" rather than a band. Loop logic per AC-D6 treats null as needing benchmark or first attempt, not as a failing score.

*Adaptive loop target:*

Next attempt's target difficulty = `round(competence_estimate + 0.5)` clamped to the pill's `available_difficulty_range`. The +0.5 bias means the next attempt stretches slightly above current competence — testing exactly at competence confirms what's known; testing slightly above is where learning happens. Three consecutive attempts where the Testee's score is well below the difficulty trigger a step-down of one integer regardless of formula, per existing AC-D6 logic.

Difficulty is selectable three ways: admin-assigned, Testee-selected, AI-suggested.

Each pill carries an `available_difficulty_range` (min, max).

**Rationale:** A 10-point slider gives Testees granular feel and visible progression. Anchoring at five bands lets the LLM calibrate consistently. Storing the integer and deriving the band on read means band boundaries can be re-tuned later without rescaling historical scores.

**Amendment rationale (v1.1):** The single 1–10 axis conflated two distinct measurements — the intrinsic difficulty of a question and the competence of a Testee — leaving the adaptive loop with only pass/fail integer outcomes as input. AC-D20 added empirical question difficulty calibration; this amendment adds the complementary piece on the Testee side, so question difficulty and Testee competence are both empirically estimated and explicitly separated under the hood. The integer axis remains as the simple human-facing presentation.

**Amendment rationale (v1.2):** The v1.1 amendment specified the recency-weighting concept but left the per-attempt performance value undefined. An initial proposed formula (`response_score × effective_difficulty`) was rejected as backwards — it would have credited 50% on difficulty 8 as competence 4, when in reality scoring 50% on a near-Expert question demonstrates Advanced-level competence. The IRT-style formula above is the standard pattern from real adaptive testing (computer-adaptive GRE, SAT, and others use the same shape): score at the question's level means competence at the question's level, with adjustments above and below. All knobs configurable so behaviour can be tuned from pilot data.

**Implications:** Pill metadata carries min/max difficulty range. Test generation prompt receives both signals. Adaptive loop progression uses the competence_estimate float; integer math operates on the rounded float. Competency Profile entity gains `competence_estimate` (float) per pill per Testee. Band labels for display continue to derive from integer bins but operate on the rounded float rather than the latest attempt's stamped integer. Historical attempts retain their stamped integers; the float is computed from attempt history and recomputed after each new attempt. Decay function configuration: `competence_decay_halflife_days` (default 90). System Settings entity gains `competence_sensitivity` (default 2.0) per the v1.2 formula. For a pill with zero attempts by a Testee, `competence_estimate` is null and the UI shows "no data yet" rather than a band; loop logic per AC-D6 treats null as needing a benchmark or first attempt, not a failing score. Admin views display both the integer band ("Working") and the float estimate ("6.7 / Working"). **(v1.6)** When an assignment targets a Learning Path, the assignment-level difficulty integer applies per pill within the path, clamped to each pill's `available_difficulty_range`. Path completion = all in-scope pills attempted and submitted by the assignee; path `engagement_status` derives from the aggregate per-Testee completion across all path pills.

**Spec reference:** §3, §4, §5, §6.3.

**Related:** AC-D5, AC-D6, AC-D7, AC-D8, AC-D20.

---

## AC-D10 — Authentication mechanism for standalone phase

**Decision:** Acumen standalone uses email + password authentication with a basic forgot-password flow (reset link via email). Admin creates all user accounts; first-time login uses a setup link sent to the user's email. No SSO, no 2FA in v1.

**Rationale:** KBC's deployment is a single small team where email + password is sufficient. When Acumen converts to a SiteMesh module, authentication is handled by Auth Hub and this whole layer is replaced — so investing in advanced auth now is wasted effort that gets thrown away.

**Implications:** Need a password storage approach (bcrypt or argon2), email-sending capability (SMTP credentials in environment config), and a `password_reset_tokens` table. Admin user creation flow sends an initial setup email rather than setting a password directly. When porting to SiteMesh, the entire auth layer is replaced by Auth Hub integration; user records keep their email as the identity link.

**Spec reference:** §3.

**Related:** AC-D2.

---

## AC-D11 — Test timing and pause mechanics

> **Amended in v1.1** — Pause now blanks all question content via overlay; max pause duration enforced. See change rationale below.
>
> **Amended in v1.6** — pause snapshot = autosave flush/reload; no separate artifact. See v1.6 note in Implications.

**Decision:** Tests carry a `timed` flag set at creation by admin:

- **Timed tests** have a duration limit. Clock runs during the attempt. A pause mechanism stops the clock and lets the Testee resume later, with restrictions:
  - Tests ≤ 60 minutes: no pauses permitted
  - Tests > 60 minutes: up to 2 pauses permitted
  - Admin may override the default pause allowance per test
  - Pause count is tracked and displayed to the Testee
  - **When a Testee initiates a pause, all question content is immediately hidden behind a "paused" overlay** showing only the pause-time-remaining counter, a resume button, and the Testee's watermark. The Testee's current input is preserved server-side at pause initiation and restored on resume.
  - **A maximum pause duration** (default 30 minutes per pause, configurable as `max_pause_duration_minutes`) applies. On expiry, the attempt auto-resumes and the clock restarts.

- **Untimed tests** have no clock and no pause mechanism. Save and exit at any time; autosave preserves state.

**Timeout handling for timed tests:** Default is auto-submit on timeout. Admin can override per test to instead mark the attempt as expired.

For all attempts, tab-focus events are tracked per AC-D4 outside of explicit pause windows.

**Rationale:** Construction industry staff have unpredictable workdays. Capping at 2 pauses prevents the mechanism from becoming a way to look up answers between sittings.

**Amendment rationale (v1.1):** If question content remains visible during a pause, the pause becomes "stop the clock while I research the answer" and defeats the integrity purpose of timed tests entirely. Blanking content on pause preserves the integrity boundary while still allowing the genuine break. The maximum pause duration closes the remaining loophole — without it, a Testee could pause for hours, look up everything, and resume.

**Implications:** Test entity carries `timed`, `duration_minutes` (nullable), `pause_allowance`, `timeout_behaviour`, `max_pause_duration_minutes` (default 30). Attempt entity gains `pauses_used`, `total_pause_duration`, and a sub-collection of pause-event records. Pause UI overlay added. Pause initiation triggers a server call that snapshots current input state before the overlay renders. Resume triggers a server call that restores the snapshotted state. Focus events during a pause are expected and not flagged. **(v1.6)** Pause/resume reuses the existing autosaved `response` rows rather than a distinct snapshot artifact; "snapshot" and "restore" name the flush-and-reload of autosaved state, not new storage. Pause and focus events persist to the shipped `attempt_pause_event` (`started_at`, `ended_at`, `duration_seconds`, `auto_resumed`) and `attempt_focus_event` (`kind`, `occurred_at`, `duration_seconds`) child tables.

**Spec reference:** §3, §4.

**Related:** AC-D3, AC-D4.

---

## AC-D12 — Model selection defaults

> **Clarified in v1.6** — `provider_by_operation` confirmed shipped; resolution order restated. See v1.6 note in Implications.

**Decision:** v1.1 defaults to Claude Sonnet for the Anthropic-side AI operations (generation, grading, weakness identification, learning material, pill proposal — **six as of v1.10, adding `pill_generation`**) and OpenAI for the cross-family operations (grade review per amended AC-D19, anchor self-review per AC-D23 — **three as of v1.10, adding `content_self_review`** per the self-review AC-D, PR-C). Admins may override the default per operation in system settings. Model overrides are recorded against each AI-produced entity for traceability. Specific stakes-based overrides may be configured per Test.

**Rationale:** Sonnet hits the right cost-quality balance for primary operations. OpenAI for cross-family review provides the orthogonal-signal benefit per amended AC-D19. Per-operation override exists for the genuine edge cases.

**Implications:** System Settings entity carries a model-per-operation map plus a provider-per-operation map. Test entity optionally carries a per-operation model override. Each AI call resolves the effective model and provider: Test override > system override > default. Cost tracking aggregates by operation, model, and provider. **(v1.6)** Provider resolution mirrors model resolution: `system_settings.provider_by_operation` (shipped JSONB) is the per-operation provider map; `system_settings.review_provider` is the convenience default for the grade_review operation (and anchor self-review per AC-D23, and `content_self_review` per the self-review AC-D in PR-C); the **six** Anthropic operations (v1.10: incl. `pill_generation`) default to Anthropic when `provider_by_operation` has no entry. No AC-D12 wording is dropped — the shipped P1 schema confirms the per-operation map.

**Spec reference:** §6.

**Related:** AC-D5, AC-D6, AC-D19, AC-D23.

---

## AC-D13 — Benchmark assessment mode

**Decision:** Acumen supports a fourth test mode — **Benchmark** — alongside per-Testee, frozen, and hand-authored modes per AC-D5. A benchmark test is a diagnostic instrument that ranges across difficulty levels to establish where a Testee currently sits in a subject, pill, or learning path.

**Scope options:** Subject benchmark, Pill benchmark, Learning Path benchmark.

**Generation strategy: adaptive, sequential.** Start at midpoint difficulty. If pass → step up by two; if partial → step up by one; if fail → step down by two. Continue until convergence. Generation is sequential, not JIT-streamed: each question is generated only after the previous question is answered and graded, because the next difficulty depends on the previous outcome. Benchmark mode is explicitly carved out of AC-D25 JIT parallel streaming per the v1.2 amendment to AC-D25; the ~3-second per-question wait is acceptable because benchmark is untimed.

**Output:** Populated section of the Testee's competency profile — each in-scope pill stamped with an assessed difficulty integer and competence_estimate float per amended AC-D9. This becomes the starting point for the adaptive learning loop.

**Triggering:** Admin-assigned, Testee-self-initiated, system-suggested when competency profile gaps are detected.

**Timing:** Untimed by default. Admin can override.

**Integrity:** Standard AC-D4 measures apply.

**Rationale:** Without benchmark data, the adaptive learning loop starts blind. Use-case spread is significant: hiring screens, onboarding, promotion readiness, periodic skills audits, certification-readiness checks.

**Implications:** Test entity's mode field carries `benchmark`. The generation prompt for benchmark mode is distinct. Benchmark outcomes seed both the integer band stamp and the competence_estimate float per amended AC-D9.

**Spec reference:** §3, §4, §5, §6.

**Related:** AC-D5, AC-D6, AC-D7, AC-D9, AC-D25.

---

## AC-D14 — Hosting and data retention posture for standalone phase

**Decision:** Acumen standalone deployment for KBC is hosted on Hostinger VPS infrastructure located in the European Union (Netherlands). All application data is retained indefinitely in v1; no automatic expiry, archival, or deletion.

**Rationale:** Hostinger (Netherlands) is the operator's chosen deployment. POPIA section 72 permits cross-border transfers where the destination jurisdiction has adequate protection — the EU's GDPR regime meets this bar. Competency history loses value if old attempts are dumped; the longitudinal record is what makes the adaptive learning loop, benchmark progression, and long-term staff development meaningful.

**Implications:** No automated deletion or archival jobs in v1. Pill retirement is admin-driven only. Backups remain a disaster-recovery mechanism only. The privacy notice posture is set in amended §8.7. When Acumen converts to a SiteMesh module, retention becomes a per-tenant configurable policy handled by the platform.

**Spec reference:** §8.

**Related:** AC-D7, AC-D10.

---

## AC-D15 — Groups for bulk assignment and reporting

**Decision:** Acumen v1 introduces a **Group** entity. Administrators create Groups and add Testees as members. A Testee can be in multiple groups simultaneously. Assignments can target Groups instead of individual Testees. Group membership is also used for team-level reporting rollups in admin competency views. Three system-defined groups exist by default: **All Users**, **All Testees**, **All Administrators**.

**Rationale:** Picking individual Testees for every assignment is fine at 3 staff and intolerable at 30. Modelling as a first-class entity gives ad-hoc grouping, historical accuracy, and SiteMesh-era portability.

**Implications:** Group entity added to data model. The Assignment entity gains the ability to target a Group reference. Membership is many-to-many. System-defined groups are immutable. Group membership at assignment creation is snapshotted for historical reference. Pill discoverability scoping by group is deferred to v1.x.

**Spec reference:** §3, §4.4, §4.10, §5.

**Related:** AC-D2, AC-D7, AC-D8.

---

## AC-D16 — User deactivation

**Decision:** User entity carries a `status` field with values **active** (default) and **deactivated**. Administrators can deactivate any user. Deactivated users cannot log in. Their existing data remains queryable and intact. They are hidden from active-user pickers, the active members view in groups, and assignee selectors, but remain visible in historical reports, completed-attempt views, and the audit log. Deactivation is reversible. Hard deletion is out of scope for v1.

**Rationale:** Staff leaving an organisation is normal. Their competency record retains value. Hard deletion combined with data export is a v1.x build.

**Implications:** User entity adds `status` enum and `status_changed_at` timestamp. Login flow rejects deactivated users with a clear message. Group membership is retained but does not count for assignment targeting. Email notifications cease for deactivated users.

**Spec reference:** §4.2, §5.

**Related:** AC-D2, AC-D14.

---

## AC-D17 — Frozen test editing and historical attempt snapshot

**Decision:** When an administrator edits a frozen or hand-authored test, the edit applies forward only. Each attempt against a frozen or hand-authored test captures a snapshot of the test's questions at attempt start; historical attempts retain their snapshot regardless of later edits. Subsequent attempts use the current version of the test. Admins can edit frozen tests at any point.

**Rationale:** Frozen tests are working artefacts, not sacred templates. Snapshot-at-attempt lets admins refine tests without breaking history.

**Implications:** Attempt entity carries a question snapshot. Frozen test admin UI shows attempt count but does not block editing. Where an admin wants to retroactively correct grading after a test edit, the admin grade override mechanism per AC-D2 is the path.

**Future evolution path** (v1.x or SiteMesh port era): migrate to formal test versioning. The v1 snapshot pattern is forward-compatible.

**Spec reference:** §4.3, §5.

**Related:** AC-D2, AC-D5, AC-D24.

---

## AC-D18 — AI cost visibility and rate limiting in v1

> **Amended in v1.1** — Added worked cost example for budget planning. Self-initiated only counts toward per-Testee rate limit; assignment-driven and loop-driven generations exempt. See change rationale below.

**Decision:** v1 ships with three operational controls on AI cost:

1. **Cost dashboard** — admin views rolling AI spend by operation type, by Testee, and by provider (Anthropic and OpenAI tracked separately per amended AC-D19).
2. **Budget alerts** — admin configures a monthly budget; email alerts trigger at 50%, 80%, 100% thresholds; operations continue regardless of threshold crossings (no hard enforcement).
3. **Per-Testee rate limits on self-initiated generations** — sensible default of 5 new test generations per hour and 20 per day per Testee, admin-configurable. **Assignment-driven and loop-driven generations are exempt from this limit.**

Hard budget enforcement, graceful model degradation, and per-pill or per-subject budgets are explicitly deferred to v1.x.

**Worked cost example** (representative per-Testee attempt with 15 questions, 10 deterministic + 5 AI-graded, full adaptive loop):

- Test generation (Sonnet): ~7.5¢
- AI grading × 5 (Sonnet): ~5¢
- Cross-family review × 5 (OpenAI per AC-D19): ~3.4¢
- Weakness identification (Sonnet): ~2.4¢
- Learning material × 2 weak pills (Sonnet; safety pills skip this per AC-D21): ~5¢

**Approximately 23¢ per attempt** for AI operations. A full adaptive loop journey on a pill with two follow-up iterations totals approximately 50–70¢ per Testee per pill journey. For a KBC-scale deployment (30 Testees averaging 2 attempts per Testee per month), monthly AI run rate is approximately $15–20. Bootstrap per AC-D23 is one-time and consumes approximately $50–60.

**Rationale:** At KBC scale, costs are manageable but a runaway scenario could blow through expected spend before anyone notices. Alerts catch this. Hard enforcement adds complexity without clear small-scale value.

**Amendment rationale (v1.1):** The original "low cents per attempt" framing understated the full per-attempt cost. Operators planning budgets need a worked example. Second, the rate limit as originally specified would conflict with the adaptive loop — an enthusiastic Testee on an active learning track could legitimately hit the daily limit and be blocked from the system's own follow-up flow. Exempting system-initiated tests and admin-assigned tests resolves the conflict without removing the protection against runaway self-initiated abuse.

**Implications:** System Settings entity carries `monthly_budget` (nullable), `alert_thresholds`, `rate_limit_per_hour` (default 5, applies to self-initiated only), `rate_limit_per_day` (default 20, applies to self-initiated only). Rate limiting logic checks the `origin` field on the prospective attempt per AC-D3 — self-initiated counts toward the limit, assignment-driven and loop-driven do not. The Testee-facing message when the rate limit is hit clarifies: "You've reached the daily limit on new self-initiated tests. Active learning loop follow-ups and admin assignments will continue to be available." Cost dashboard adds rolling-month summary rows aligned with the worked example structure.

**Spec reference:** §6.5, §3, §8.

**Related:** AC-D5, AC-D6, AC-D8, AC-D19, AC-D21.

---

## AC-D19 — AI grading calibration via cross-family synchronous review

> **Amended in v1.1** — Review pass changed to cross-family (different provider from grading) and synchronous before band stamp displays. See change rationale below.
>
> **Clarified in v1.3** — `review_status` enumerated as pending / confirmed / flagged; removed the contradictory "no pending state" phrasing. See amendment rationale below.
>
> **Clarified in v1.6** — review lives on `grade_review` (1:1, in-place, no history); deterministic responses have no review row; flagged-grade display; stuck-pending auto-flag; mixed-test display gate; dedicated reconcile cron. See v1.6 note in Implications.
>
> **Amended in v1.7** — submit-wait wording realigned to batched-per-attempt review with a 60-second hard ceiling (AC-CD11 P6 gate closure); over-ceiling routes to the existing fail-soft `pending` + reconcile-cron path. See v1.7 note in Implications.

**Decision:** v1 includes a sixth AI operation: **grade review**. After AI grading completes on a response, a separate AI call **on a different provider** reviews that grade by examining the question, the candidate response, the rubric, the AI's assigned grade, and the AI's reasoning. The review either confirms the grade or flags it for admin attention. **Reviews run synchronously before the Testee sees their result, batched per attempt — a single review call per submit covers every AI-graded response together — with a 60-second hard ceiling at the submit path (AC-CD11 v1.7).** On completion the Testee sees the post-review grades and band stamp; on ceiling-exceeded or provider-unavailable the result page renders in preliminary mode and the grade-review reconcile cron (§8.9) takes over.

**Scope:** v1 reviews 100% of AI-graded short-answer and scenario responses. MCQ, true/false, and matching are deterministic and skip review. Deterministic-graded items display immediately if they are the only items on the test; mixed tests render the result page after all AI grading and review have completed.

**Cross-family default:** Anthropic primary grading reviewed by OpenAI. The reviewer prompt is framed as "is this grade defensible given the rubric?" rather than "what grade would you give?" — different inductive task framing produces orthogonal signal. Provider per pass is configurable in system settings.

**Disagreement handling:** flagged grades surface in the admin review queue. Admin chooses to keep the original grade, accept the reviewer's verdict, or substitute their own — using the override mechanism per AC-D2.

**Rationale:** Manual admin calibration forces admins to do review work the system itself can do. A second AI call examining the grade in light of the rubric is structurally a review — cheaper than admin time at any reasonable scale, surfaces disagreements automatically. The pending status enables fail-soft behaviour without blocking the submit path indefinitely; in normal operation the synchronous review completes before display and pending is never visible, but provider outages do not stall the Testee experience.

**Amendment rationale (v1.1):** Same-provider review reuses the inductive biases of the original grading model — homophily that defeats the purpose of independent review. Cross-family review (different provider, different training distribution, different inductive task framing) generates the orthogonal signal the review pass exists to provide. Asynchronous post-display review created a worse failure mode than the latency it avoided: a Testee internalises "Working band" then sees it walked back the next day after admin reviews the flagged grade. Synchronous review trades up to a 60-second batched submit-time wait (AC-CD11 v1.7 budget) for grade durability; over-ceiling responses fall through to the reconcile cron rather than blocking the result page indefinitely.

**Amendment rationale (v1.3):** The v1.1 Implications described a fail-soft "review pending" path while the same decision's `review_status` enumeration asserted "no pending state because review always completes before display" — an internal contradiction. CODE_SPEC §4 already modelled pending / confirmed / flagged correctly. This amendment makes DECISIONS internally consistent: pending is a real status — the fail-soft state between submit and successful cross-family review — not an impossible one.

**Implications:** A sixth AI operation added to §6 (§6.6 — Grade review). Separate review prompt managed in version control. Grade entity gains `review_status` (pending / confirmed / flagged) and `review_reasoning`. pending is the fail-soft state when the review provider is unreachable at submit time; the system retries on the next cron pass. confirmed and flagged are terminal. System Settings entity gains a `review_provider` field (default OpenAI) alongside the existing model-per-operation map per AC-D12. Two API keys are now required in environment configuration: Anthropic (primary operations) and OpenAI (review pass and anchor self-review per AC-D23). Cost dashboard tracks review-pass cost against the OpenAI provider separately. If the review provider is unreachable at submit time, the grade displays as preliminary with an explicit "review pending" label, and the system retries on the next cron pass — fail-soft, not fail-blocking. UI shows a brief "checking your answers..." state during the synchronous review window. **(v1.6)** The following reconcile the DECISIONS prose with the shipped P1 schema:

- `review_status` and `review_reasoning` live on the `grade_review` table, not on `grade`. Cardinality is strictly 1:1 (one `grade_review` per `grade`; `grade_id` is unique). The reconcile cron updates the existing `grade_review` row in place — no history table, no append. `grade` carries the Anthropic AI-grading provenance; `grade_review` carries the OpenAI review provenance (both via the shipped AI-provenance columns).
- A `grade_review` row is created only for AI-graded responses (short_answer, scenario). Deterministic grades (MCQ / true-false / matching) have no `grade_review` row; the `review_status` enum stays {pending, confirmed, flagged} and the absence of a row denotes deterministic / not-applicable.
- Flagged grades surface a provisional "under admin review" state to the Testee at result display; the AI grade is not shown until an admin resolves the flag (keep / accept reviewer / substitute). Only confirmed grades display synchronously and are durable post-display — preserving the AC-D19 no-internalise-then-walk-back rationale for the flagged branch.
- After N consecutive cron-retry failures (default 10; a P6 behavioural default, not yet a `system_settings` column), a `pending` `grade_review` auto-promotes to `flagged` with reasoning `auto_flagged_stuck_pending` and surfaces in the admin review queue. Terminal states remain confirmed and flagged.
- Mixed tests (containing any AI-graded item) gate the result page display on review completion; only fully-deterministic attempts display results immediately.
- The pending→retry path runs on the dedicated grade-review reconcile cron added to §8.9 / CODE_SPEC §8 (every N minutes, default 5; a P6 behavioural default, not yet a `system_settings` column).

**(v1.7)** Cross-family review is **batched per attempt** — one review call per submit reviews every AI-graded response in the attempt together, returning a structured array of `{grade_id, verdict, reasoning?}` items. Hard latency ceiling at the submit path is **60 seconds**; on ceiling-exceeded or provider-unavailable, every `grade_review` row for the attempt stays `pending`, the result page renders in preliminary mode (the F14 display gate accepts `pending` as a resolved-state-not-yet-confirmed, not as "review absent"), and the §8.9 grade-review reconcile cron picks the rows up. At the v1.6 defaults (cron every 5 min, max-retry 10) the auto-promote-to-`flagged` window is ≈50 minutes wall-clock from initial submit; this is named explicitly here so the operator-visible SLA lives in one place (F11 amplified, no default changes).

**Spec reference:** §6, §4.8, §7, §8.

**Related:** AC-D2, AC-D5, AC-D12, AC-D18, AC-D23.

---

## AC-D20 — Anchor banks and cross-Testee calibration

**Decision:** Acumen replaces static AI-assigned difficulty stamps with empirically-validated effective difficulty derived from population performance on stable items. At pill creation, the AI auto-generates an **anchor question pool** per supported band on that pill — default 20 questions per band, generated once and frozen. Every Testee attempt at a given pill+band draws 1–2 anchor questions at random from the pool, mixed with freshly-generated questions; anchors are indistinguishable from fresh questions in the Testee UI. The system tracks pass rates per anchor question across all Testees; anchor questions whose population pass rate diverges from their stamped difficulty have their **effective difficulty** updated. Fresh-generated questions in each attempt are scored relative to the same Testee's performance on that attempt's anchor questions. The AI-stamped difficulty becomes a starting hypothesis; the empirically-observed difficulty becomes the source of truth once sample size permits.

**Rationale:** AI-stamped difficulty drifts within a target band. Two Testees with the same band stamp may have faced different actual instruments; longitudinal trends conflate skill change with question-set variance. Manual hand-graded golden sets per pill per band would calibrate this but require admin time at setup. Cross-Testee triangulation against stable anchor questions achieves the same calibration outcome with zero admin time — the calibration emerges as a statistical property of pilot usage. Real human performance on stable items is the only non-circular ground truth in a system that otherwise has AI generating, AI grading, and AI reviewing grades.

**Implications:** Pill entity gains an anchor question collection — for each supported band, a frozen pool generated at pill creation. Anchor questions are stored against the pill, not against attempts; their content is fixed once generated. Attempt entity records which anchor questions were included in that attempt's draw and the Testee's performance on each. Each anchor question carries running statistics: total attempts, pass rate, partial-credit distribution, effective-difficulty estimate. Cross-Testee triangulation logic computes effective difficulty per anchor as attempts accumulate; fresh-generated questions in each attempt are scored relative to the Testee's anchor performance using a simple delta. Admin views display calibration confidence per pill+band alongside the band stamp; until a minimum sample size is reached (default n=20 per pill+band), band stamps display with a "preliminary" qualifier. The generation prompt for fresh questions includes the anchor questions as in-context examples so the AI calibrates against established anchor difficulty rather than drifting independently. The anchor mechanism applies across all test modes per AC-D5 except per-Testee mode's fully unique generation. The full calibration mathematics are specified in AC-D27.

**Spec reference:** §3, §5, §6.1, §6.3, §4.7.

**Related:** AC-D5, AC-D7, AC-D9, AC-D23.

---

## AC-D21 — Auto-tagged safety pills with curated external learning material

> **Amended in v1.9** — autonomous-content-generation cycle, **PR-A**. Three cross-stage changes folded **complete in one amendment** (amend-once; A2 is the first toucher of this anchor): **(A2)** web search is extended from safety-link curation to **reference-corpus acquisition** restricted to the AC-D28 tiered source-authority allowlist; **(C1)** the multi-pass self-review **re-adjudicates** a pill's `safety_relevant` classification at autonomous-generation time; **(E2)** the admin safety-tag override moves from a pre-publish action to the **retroactive oversight dashboard / rollback** surface (no human pre-publish gate). Ratified through the authenticated in-session channel for this sequenced ratification cycle. See the v1.9 paragraph in Implications.

**Decision:** Acumen distinguishes pills by safety relevance. The Pill entity carries a `safety_relevant` boolean flag, auto-applied at pill creation by two signals: (a) keyword detection on the pill name and description against a configurable safety keyword list (lift, scaffold, asbestos, isocyanate, cathodic, confined space, fall, PPE, high voltage, hot work, fire, electrical, hazardous, toxic, etc.); (b) the proposing AI's self-classification when a new pill is proposed per AC-D7. Admin can override the tag in either direction at any time.

For safety-relevant pills, Acumen does not generate AI teaching content. The adaptive learning loop per AC-D6 still runs end-to-end — weakness identified, learning material served, retest queued — but the learning material is a curated list of 3–5 authoritative external links (NACE materials, SANS abstracts, manufacturer technical data sheets, OSH publications), fetched via web search at pill creation and cached against the pill record. A monthly autonomous link-check cron re-validates cached URLs; broken links trigger fresh web search; substantial content drift detected by AI comparison of new versus cached content flags the pill for admin attention.

**Rationale:** The adaptive loop's autonomous default assumes AI-generated teaching content is reliable. For domains where wrong content has safety consequences — PPE, high-risk trades, hazardous substances, structural integrity, electrical work — AI hallucination becomes a liability path: a Testee taught wrong then stamped competent in unsafe work creates real downstream risk. Removing AI teaching for safety pills entirely is structurally cleaner: Acumen does not claim authority on safety topics. The product position becomes "Acumen assesses competency and routes staff to authoritative third-party sources for safety topics; Acumen does not teach safety." This is a defensible posture if ever questioned in an audit, incident review, or legal context.

**Implications:** Pill entity gains `safety_relevant` boolean and `safety_links` collection — list of cached URL references with title, source, last-verified timestamp, content hash. Auto-tagging logic runs at pill creation and is re-evaluated on pill description edits. AI proposal output schema per AC-D7 includes safety self-classification. Weakness identification per AC-D6 routes safety-tagged pills to the external-link delivery path; §6.4 (Learning material generation) is skipped for safety pills — no AI explainer is produced even as fallback. Web search becomes a new external integration. The monthly link-check cron is added to deployment topology. For a safety pill whose entire link set is dead at attempt time, the loop falls back to "we identified a gap in [pill]; please ask your administrator for guidance" — does not generate AI teaching content as a fallback. Cost tracking per amended AC-D18 includes web-search costs separately.

**(v1.9)** Web search (the §7.4 integration) gains a use beyond AC-D21 safety-link curation: **reference-corpus acquisition** per amended AC-D22 / AC-CD25, restricted to the **AC-D28** tiered source-authority allowlist. AC-D21's own safety-link curation search is **unchanged** — the spec author ruled DS1-c **corpus-acquisition only**; the curation path is not tightened to the allowlist. The autonomous-generation self-review (the self-review AC-D, PR-C / Slice C1) **re-adjudicates** the `safety_relevant` classification on generated content rather than trusting only the pill-creation-time auto-tag, so safety relevance detected at generation time routes the content to the no-AI-teaching / publish-with-warning posture. Admin override of the safety tag is **no longer a pre-publish step**: under the retroactive-oversight model (auto-publish, no human pre-publish gate) it relocates to the oversight dashboard, where an admin re-classifies and triggers rollback after publication (the E2 rollback contract, PR-D).

**Spec reference:** §3, §4.9, §5, §6.4, §7, §8.

**Related:** AC-D6, AC-D7, AC-D18, AC-D22, AC-D28.

---

## AC-D22 — Passive moat: Drive folder ingestion and Testee feedback signal

> **Amended in v1.2** — Embedding model default fixed to OpenAI `text-embedding-3-small`; Anthropic offers no embeddings API. See change rationale below.
>
> **Amended in v1.9** — autonomous-content-generation cycle, **PR-A**. The passive **Drive-folder RAG ingestion** mechanism is **retired** (ruling 0a / NS-1) in favour of the autonomously-built **reference corpus** (AC-CD25, scored per AC-D28): the system builds its own KBC-relevant knowledge base from authoritative allowlisted sources rather than depending on an operator-curated Drive folder. The "queried at every generation call" contract **extends to §6.5 autonomous generation** (folded complete here with the B2 toucher, amend-once). The Testee realism-feedback signal is **unchanged**. NS-1 ruling: retire the Drive ingest path; the shared chunking/hashing/ranking primitives (`chunk_document`, `content_hash`, `cosine_top_k`) **relocate to a shared module rather than being deleted**, because the corpus builder and corpus retrieval depend on them — the relocation/removal is an **execution-slice** deliverable, not this amendment. Ratified through the authenticated in-session channel for this cycle. See the v1.9 paragraph in Implications.

**Decision:** Acumen acquires KBC-specific context passively through two mechanisms designed to require no curation effort or admin time:

*Reference corpus (replaces Drive-folder RAG ingestion — retired in v1.9).* Acumen builds its own **reference corpus** of authoritative content: web search restricted to the AC-D28 tiered source-authority allowlist discovers sources per topic, which are fetched, extracted (HTML + PDF), chunked, embedded, and stored in the pgvector index with their authority tier/score stamped (AC-CD25). The corpus is **queried at every generation call** — test generation (§6.1), learning material (§6.4), and **autonomous generation (§6.5)** — and relevant chunks are injected as grounding context. The corpus is refreshed by the weekly `corpus.refresh` cron plus per-topic and admin on-demand refresh (§8.9). No operator curation, no upload UI, no Drive folder. *Historical mechanism (retired v1.9):* read-only access to a single designated Drive folder whose documents were auto-fetched, chunked, and embedded on a daily cron; preserved in git history and described here only as the superseded predecessor.

*Testee realism feedback.* Each question presented to a Testee carries a small "this question feels unrealistic or off" button. Clicking it records a flag against that specific question's content and the generation context that produced it. The generation prompt is periodically updated to weight away from question patterns that accumulated flags. Feedback weight per Testee is scaled by the Testee's overall attempt accuracy — high-performing Testees' flags count for more than low-performing Testees' flags, preventing systematic gaming by failers.

Together these mechanisms allow KBC-specificity to compound as a function of normal use rather than as a discrete curation project.

**Rationale:** The differentiation moat for Acumen against generic AI learning tools is KBC-specific situated content — questions referencing real KBC workflows, real defect patterns, real materials and suppliers, real project context. AC-D4 #6 names this as the integrity-through-design layer but does not architect how the specificity gets in. The full moat depends on Knowledge Library integration at SiteMesh-port time, leaving v1 as a generic learning tool. Two passive signals available within standalone v1 begin building the moat immediately without any structured ingest project: the operator's existing document trail, and Testees' implicit judgement of realism.

**Implications:** Drive integration is a new external service. Service account credentials and the folder identifier held in environment configuration. Daily ingest cron computes file diffs and re-embeds changed or new documents; deleted documents drop from the index. Chunking strategy and embedding model are configuration values; default to ~500-token chunks with OpenAI's `text-embedding-3-small` (1536 dimensions). Embedding costs are tracked against the OpenAI provider in the cost dashboard per amended AC-D18. Vector index lives in a Postgres pgvector extension at v1 scale. Question entity gains `realism_flag_count` and `realism_flags`. The Testee UI gains an unobtrusive flag button next to each question. Feedback aggregation runs nightly and produces a "low-realism" question pool that feeds into the generation prompt as negative examples. Where a question has a high flag count relative to its attempt count, it is removed from the anchor pool per AC-D20 if it was an anchor. The Drive folder may contain confidential KBC documents; ingest is strictly scoped to the designated folder, and the operator is responsible for what is placed there.

**(v1.9)** The Drive-folder mechanism above is **retired** (NS-1); the **reference corpus** (AC-CD25) is its replacement and the embedding model + pgvector store + per-call query contract carry over to it (same `text-embedding-3-small`, same OpenAI-tracked embedding cost per amended AC-D18, same pgvector index). New: a `CorpusChunk` store mirroring `DriveChunk`'s shape plus the `source_host` / `authority_tier` / `authority_score` columns from AC-D28; web search (the §7.4 integration) is the acquisition front-end, restricted to the AC-D28 allowlist; corpus refresh is a weekly cron (`corpus.refresh`) plus per-topic / admin on-demand (§8.9). The Google Drive service-account credentials and folder identifier are **no longer required** configuration. The shared chunking/hashing/ranking primitives **relocate to a shared module rather than being deleted** (NS-1; the corpus builder + retrieval depend on them) — that relocation and the removal of the Drive ingest code are an **execution-slice** deliverable tracked in CHECKLIST, not this amendment. The Testee realism-feedback signal (the second mechanism) is unchanged.

**Amendment rationale (v1.2):** The v1.1 spec specified "embedding model from the primary provider" but Anthropic doesn't offer an embeddings API, making this not implementable. OpenAI is already in the stack for AC-D19 cross-family review, so using OpenAI for embeddings adds no new provider integration. `text-embedding-3-small` is the standard production choice — 1536 dimensions, cheap (~$0.02 per million tokens), and well-suited to construction-domain RAG at v1 scale.

**Spec reference:** §3, §5, §6.1, §6.4, §6.5, §7, §8.

**Related:** AC-D4, AC-D5, AC-D6, AC-D7, AC-D20, AC-D28, AC-CD25.

---

## AC-D23 — Autonomous bootstrap run

> **Amended in v1.9** — autonomous-content-generation cycle, **PR-A**. Folded **complete** across its touchers (amend-once; A2 is the first toucher): **(A2)** bootstrap step 4 (embed the Drive folder) is **retired** and replaced by **building the initial reference corpus** (AC-CD25 / AC-D28); **(B2/C1)** this anchor's cross-provider self-review (step 2) is the **precedent the autonomous-generation self-review gate extends** (the self-review AC-D, PR-C); **(F1)** the incremental bootstrap fires on **auto-publish** of generated content, not on admin approval of a pill — under the retroactive-oversight model there is no admin approve gate. **Mutual cross-reference with AC-D7** (hard requirement, this cycle): AC-D7's removal of the "queue for admin review / approve" governance language (PR-C) and this anchor's bootstrap-on-publish reframe together tell **one** approve→auto-publish story; AC-D7 carries the reciprocal back-reference. Ratified through the authenticated in-session channel for this cycle. See the v1.9 paragraph in Implications.

**Decision:** First-deployment initialisation includes an autonomous bootstrap run that pre-populates calibration scaffolding and content before the first Testee touches the system. The run executes after the pill catalogue is seeded (per §8.4 step 3) and before assignments are issued. It performs four actions sequentially:

1. For every pill, generate the anchor question pool per supported band per AC-D20.
2. **Run AI self-review on every generated anchor question.** A second AI call (using a different provider from the generator per AC-D19 pattern) evaluates each anchor against quality criteria: pill-fit, difficulty calibration, rubric clarity, freedom from ambiguity, factual reasonableness. Anchors failing self-review regenerate, up to three attempts per slot. Anchors that fail three times are excluded from the pool with an admin-attention flag.
3. For every safety-tagged pill, fetch and cache the curated external link set per AC-D21.
4. **Build the initial reference corpus per AC-CD25 / AC-D28** (replaces the retired v1.9 Drive-folder embed step) — acquire, extract, chunk, and embed authoritative allowlisted sources for the seeded catalogue's topics.

The run is non-interactive — operator initiates with a single command, work proceeds in background, completion notification surfaces in the admin dashboard.

**Rationale:** Three of the four new behaviours added in AC-D20 through AC-D22 require minimum data to function. Without bootstrap, the first weeks of pilot operate against degraded versions of these mechanisms. Bootstrap shifts this cost to a one-time overnight compute spend. The AI self-review step adds a content-quality filter to the anchor pool before Testees ever see anchor questions — without it, the first 20-50 attempts on a new pill effectively act as a Testee-funded quality check on the generated anchors. Per amended AC-D18, bootstrap cost is on the order of $50-60 for a pilot-scale catalogue.

**Implications:** Bootstrap script added to deployment workflow as §8.4 step 4. Script is idempotent. Bootstrap progress and completion logged to the audit log. Failure modes are recoverable. Bootstrap cost is tracked separately in the cost dashboard per amended AC-D18. Subsequent pill additions post-launch trigger an incremental bootstrap automatically — anchor pool generated, self-review run, safety links fetched when the new pill goes active, no operator action required. Pills with anchor pools at reduced size display in admin views with the flag.

**(v1.9)** Bootstrap step 4 (Drive embed) is **retired** and replaced by the reference-corpus build (AC-CD25 / AC-D28). The incremental bootstrap's trigger is reframed for the autonomous-generation model: it fires on **auto-publish** of generated content, **not** on admin approval — the AC-D7 "queue for admin review / approve" gate is removed (PR-C), so "when the new pill goes active" now means *when generated content auto-publishes* (the auto-publish gate AC-D, PR-C). This is the **mutual cross-reference with AC-D7**: the two anchors tell one approve→auto-publish story and reference each other. The cross-provider self-review (step 2) remains and is cited as the precedent the autonomous-generation self-review protocol (PR-C) extends.

**Spec reference:** §8.4, §3.

**Related:** AC-D7, AC-D19, AC-D20, AC-D21, AC-D22, AC-D28, AC-CD25.

---

## AC-D24 — Shared-test integrity: content lock and presentation shuffle

> **Amended 2026-05-31 (pre-deploy fix A2-H1).** Implications now pin the
> **presentation↔grading permutation-inversion contract** — grading must
> invert the same per-question shuffle the presentation applied, recovering
> the original-order index before scoring. The audit (A2-H1) found grading
> compared the *presented* index against the *original* `correct`/identity
> mapping, so any non-identity `randomise_option_order` shuffle silently
> mis-scored MCQ and matching. See the new Implications paragraph.

**Decision:** Tests reused across multiple Testees (frozen mode and hand-authored mode per AC-D5) gain two layered integrity protections, both configurable per test:

*Content lock during a campaign.* A frozen or hand-authored test carries a `lock_mode` flag. **Open** (default for general use) — admin can edit the test at any time; edits apply forward only per AC-D17. **Campaign-locked** — admin marks the test as locked for a defined campaign period; no edits permitted until the campaign is explicitly closed. Campaign-locked mode is the canonical setting for hiring screens and formal benchmarks where all candidates must sit identical instruments. The lock mode is independent of the snapshot-at-attempt mechanism in AC-D17.

*Per-attempt presentation shuffle.* Two toggle fields on frozen and hand-authored tests, both default true: `randomise_question_order` (questions appear in shuffled order per attempt) and `randomise_option_order` (MCQ option letters and matching-pair sides shuffle per attempt). Shuffle uses a seed derived from the attempt_id so resume-after-save yields the same order. Admin can disable either toggle per test for cases where presentation order matters intrinsically. Question-group support: questions sharing a `question_group_id` shuffle as a single block with internal order preserved — handles the case-study pattern.

Together: shared tests carry identical content (locked when needed), but each Testee sees that content in a unique presentation. Office-setting benchmarking becomes safe — the same instrument, presented differently per seat.

**Rationale:** AC-D5's frozen mode already supports same-test-across-Testees for comparability cases. What was missing: anti-collusion when Testees take the test in the same physical space, and content stability when the comparability use case spans a campaign rather than a single sitting.

**Implications:** Test entity (frozen and hand-authored modes) gains: `lock_mode` (open / campaign-locked), `campaign_id` (optional), `randomise_question_order` (default true), `randomise_option_order` (default true). Question entity gains optional `question_group_id`. Attempt entity gains `shuffle_seed`. Shuffle logic runs at attempt start after the question set is resolved. Admin UI gains a "lock campaign" action on frozen tests with a confirmation prompt. Closing a campaign (unlocking) is an admin action logged in the audit trail. Campaign-locked tests cannot be deleted while locked. Anti-collusion shuffle becomes a seventh integrity layer in AC-D4's framing, specific to shared-test modes.

**Presentation↔grading inversion contract (v1, A2-H1).** `randomise_option_order` shuffles the presented order of MCQ options and matching right-sides via a per-question permutation derived deterministically from `(attempt.shuffle_seed, question_id)` — the same permutation on every render and resume. The Testee therefore submits an index into the **presented** order. Grading is responsible for **inverting** that permutation: a submitted presented index is mapped back to its original-order index before it is compared against the stored answer key (MCQ `correct`, an original-order integer; matching's identity left↔right mapping). Concretely, with presented option `j` showing original option `perm[j]`, an MCQ answer is correct when `perm[submitted] == correct`, and a matching pair is correct when `perm[submitted_right] == left_index`. The grade-time permutation must be re-derived from the identical seed + question + element-count the presentation used, so the two stay in lockstep; when `randomise_option_order` is false (or no options/pairs), the permutation is identity and the submitted index is the original index. This contract makes shuffled shared-test presentations gradeable without a per-attempt answer-key rewrite.

**Spec reference:** §3, §4.3, §4.7, §5.

**Related:** AC-D4, AC-D5, AC-D17.

---

## AC-D25 — Just-in-time generation with parallel streaming

> **Amended in v1.2** — Benchmark mode opts out of JIT streaming; sequential adaptive generation only. See change rationale below.
>
> **Amended in v1.8** — Execution model locked as in-process `asyncio.gather` + `asyncio.Semaphore` (Celery wording retired from the user-facing path); Question gains an attempt-scoped `attempt_position` column for stable streamed-arrival ordering; single-Q-N-generation-failure policy is one orchestration-layer retry then AC-D11 pause. Closes the AC-CD10 / §10 P10 build gate. See v1.8 note in Implications.

**Decision:** For per-Testee mode (the AI-generated test mode per AC-D5), question generation is just-in-time with parallel background streaming. At attempt start, **question 1 generates in foreground** (~3 seconds typical) and renders immediately to the Testee. **Questions 2 through N stream in parallel in the background** while the Testee answers question 1. The system maintains a configurable buffer of 3–5 questions ahead of the Testee's current position. If a fast Testee outruns the buffer, a brief "preparing next question..." state appears until the next question completes generation.

Frozen and hand-authored modes have no generation latency since content pre-exists; this decision does not apply to them.

**Benchmark mode exception.** AC-D13 benchmark mode does not use JIT streaming. Benchmark generation is sequential: Q1 generates and renders, Testee answers and submits, system grades, then Q2 generates with difficulty determined by Q1's result. The ~3-second wait between questions is acceptable because benchmark is untimed by AC-D13 and adaptive sequencing is the entire point of the mode. Parallel pre-generation cannot work where each question's difficulty depends on the previous question's outcome.

**Rationale:** Sequential generation of all questions at attempt start creates 20–60 second wait times before the Testee sees anything — degrades UX badly and signals "this is an AI-heavy contraption" rather than a fluid assessment. Pre-generating questions at assignment time would eliminate the wait but loses the freshness benefits of generating against current context (latest Drive RAG content per AC-D22, current anchor calibration state per AC-D20, most recent weakness signals on this Testee). JIT with parallel streaming preserves the freshness while compressing the wait to a single first-question delay.

**Implications:** The attempt API exposes generation as a stream rather than a single blocking call. Question 1 generation runs synchronously at attempt start; questions 2-N start in parallel as soon as the question 1 prompt is dispatched. Each question's generation context includes (per AC-D20, AC-D22): anchor exemplars from the pool, retrieved RAG chunks from the Drive index, and prior questions already generated for this attempt. The Testee UI shows "preparing your test..." for the few seconds of question 1 generation, then renders Q1 with a small subtle indicator that subsequent questions are still loading. Generation failures during streaming surface per §6 error handling. Buffer-ahead size is configurable (default 3, max 5). Autosave snapshots both Testee responses and the generated question set; refresh/reload during an attempt preserves all already-generated questions per AC-D17 pattern.

**(v1.8)** The v1.7 Implications are amended in three places by the AC-CD10 / §10 P10 build-gate closure:

- **Execution model.** Q2…N generation runs as concurrent `asyncio` tasks inside the same uvicorn worker that owns the SSE response, bounded by an `asyncio.Semaphore` whose size equals `Settings.jit_buffer_size` (env-default 3 in `app/config.py`); the hard ceiling is `Settings.jit_buffer_max` (env-default 5). Celery is not on this user-facing path. The choice is recorded in CODE_SPEC §10 / §17 risk #2 / §18 AC-CD10; rationale: v1 scale (≤30 concurrent Testees, 5–10 questions per attempt) sits well inside one uvicorn worker's concurrent-I/O budget; in-process coordination removes the Celery enqueue + result-backend round-trip latency precisely where P10 is trying to remove it; Celery infrastructure stays scoped to its actual job (idempotent long-running batch work — the P11 cron set). Horizontal-scaling concern (a uvicorn worker dies mid-attempt) is mitigated by the resume-via-`Last-Event-ID` semantics built into the same P10 PR — completed Question rows are replayed from the DB and any remaining slots continue from any worker; nothing depends on the original worker process surviving.
- **Ordering column.** SPEC §5 / CODE_SPEC §4 Question gains an `attempt_position INT NULL` column scoped to the owning Attempt, with `(attempt_id, attempt_position)` unique. Q1 lands at position 1 synchronously; Q2…N slots are assigned at enqueue time (positions 2…N), not at generation-completion time, so the ordering is stable regardless of which task resolves first. Anchor questions interleave at positions decided at draw time. The SSE event-id is the `attempt_position`. Resume replay reads `ORDER BY attempt_position`. The additive migration is a P10 build deliverable (precedent: P4's `(test_id, sequence_number)` add, migration `0005_p4_attempt_sequence_unique.py`).
- **Single-failure policy.** A single failed Q-N generation is retried once at the orchestration layer (above the existing tenacity HTTP-level retries inside `app/ai/anthropic.py::_invoke`). If the second attempt also fails, the in-flight attempt is paused via the existing AC-D11 pause mechanism, and the Testee sees the "retry / abandon" UI on resume. Other in-flight Q-N tasks continue and persist their results before the pause takes effect — partial progress is preserved on the Question table, never thrown away. This explicitly rejects the "mark slot failed and continue" alternative considered at the P10 plan-mode gate: per-question gaps in an attempt are not a v1 shape and would invalidate the snapshot-replay semantics AC-D17 / AC-D24 / AC-D25 share.

**Amendment rationale (v1.2):** The v1.1 decision stated JIT parallel streaming applied to *both* per-Testee and benchmark modes, but that is mechanically impossible for benchmark: AC-D13 benchmark generation is adaptive — question N+1's difficulty is a function of question N's graded outcome — so questions 2…N cannot be pre-generated in parallel before question 1 is answered. The amendment scopes JIT streaming to per-Testee mode only and makes benchmark explicitly sequential. Within per-Testee mode, AC-D20 anchor questions remain position-streamed inside the JIT set (drawn and generated like any other buffered question, not pinned to fixed positions) — anchors are content-frozen, not position-frozen, so streaming them carries no calibration risk. No new configuration is introduced; the existing buffer knobs are unchanged.

**Amendment rationale (v1.8):** The v1.0 — v1.2 wording for AC-D25 named "parallel background streaming" without pinning the execution substrate; the technical-anchor body in CODE_SPEC §10 wrote "parallel Celery tasks that push completed questions onto the stream", which was a defensible early-design choice when the AC-CD10 anchor still carried "needs user input". The v1.2 close retired that confidence flag but the Celery wording stayed inertially, with no schema anchor for streamed-arrival order and no explicit policy for a single Q-N generation failure. The P10 plan-mode gate surfaced all three as build-blocking ambiguities. The closure direction (in-process asyncio, `attempt_position` column, single retry then AC-D11 pause) was chosen against four constraints: (1) v1 load shape — a few dozen concurrent attempts, 5–10 Q-N tasks per attempt — sits well inside a single uvicorn worker's I/O budget, removing the case for cross-process coordination; (2) the JIT goal is sub-3-s Q1 + minimal between-question wait, so Celery enqueue + Redis result-backend round-trip is overhead in the wrong place; (3) the AC-CD15 zero-network test harness is simpler in-process (no Redis pub/sub mock needed); (4) the snapshot-replay-on-resume semantics AC-D17 / AC-D25 share require gap-free ordering, which rules out the "mark slot failed and continue" alternative. Same closure-PR shape as PR-017 / AC-CD11 v1.7. No new system_settings columns; the existing env-default `jit_buffer_size` / `jit_buffer_max` knobs in `app/config.py` carry the concurrency cap and ceiling.

**Spec reference:** §3, §4.7, §6.1, §8.

**Related:** AC-D5, AC-D11, AC-D13, AC-D17, AC-D20, AC-D22.

---

## AC-D26 — Assignment engagement tracking and auto-escalation

> **Clarified in v1.6** — `engagement_status` + reminder-cease are per (assignment, Testee); reminder send history stays assignment-scoped. See v1.6 note in Implications.

**Decision:** Assignment entity tracks engagement state and the system actively surfaces non-engagement without admin involvement. Four stacked mechanisms:

1. **Derived `engagement_status` field** on Assignment, computed from attempt history:
   - `pending` — assignment created, no attempt opened yet
   - `in_progress` — at least one attempt opened, none submitted
   - `complete` — at least one attempt submitted (regardless of pass/fail)
   - `overdue` — past soft deadline without complete status

2. **Admin dashboard "pending engagement" widget** — surfaces mandatory assignments that remain `pending` past a configurable age threshold (default 7 days).

3. **Auto-reminder emails to Testees.** For mandatory assignments with deadlines: reminders at 7 days before deadline and 1 day before deadline. For mandatory assignments without deadlines: reminders at 14 days pending and 30 days pending. Reminders cease once the Testee opens an attempt.

4. **Auto-escalation to admin.** If a mandatory assignment remains `pending` after the second reminder is sent and no attempt has been opened, the assigning admin receives a single escalation notification. No further escalations on the same assignment — alert fatigue avoidance.

Soft deadlines per AC-D3 remain soft; these mechanisms surface non-engagement, they do not force completion. Optional assignments do not trigger reminders or escalations.

**Rationale:** Acumen's data model captures attempt activity well but is blind to non-engagement. Admin assigns a mandatory paint QA assessment to a foreman; foreman ignores it for three weeks; admin has no signal until they happen to check. Four stacked mechanisms close this gap with no admin involvement after configuration. The escalation cap prevents noise; the four together cover both "I didn't see the assignment" and "I'm avoiding the assignment."

**Implications:** Assignment entity gains derived engagement_status (computed at read time from attempt history; not stored). System Settings entity gains: `pending_assignment_age_threshold_days` (default 7), `reminder_schedule_with_deadline_days_before` (default [7, 1]), `reminder_schedule_no_deadline_days_after` (default [14, 30]), `escalation_enabled` (default true for mandatory only). Reminder and escalation email templates added to §7 SMTP integration. Reminder send history is stored against the assignment record. Audit log captures escalation events. Admin dashboard "pending engagement" widget renders the configurable threshold view. When Acumen ports to SiteMesh, the entire reminder/escalation mechanism routes through Comms per §9.5; the engagement_status field and dashboard surface remain in Acumen. **(v1.6)** `engagement_status` and the reminder-cease rule are tracked per (assignment, Testee), not per assignment — an assignment that fans out to a Group or multiple Testees (snapshotted into `assignment_assignee` at creation per AC-D15) has an independent derived status per assignee: `pending` (no attempt by this Testee on this assignment), `in_progress` (attempt opened, none submitted by this Testee), `complete` (≥1 submitted by this Testee), `overdue` (past deadline and not complete, per-Testee). Reminders cease per-Testee on that Testee's first attempt against the assignment. Reminder send history is stored per assignment in the shipped `assignment_reminder` table (`assignment_id`, `kind`, `sent_at` — no `user_id`); the per-Testee cease is a derivation over that Testee's attempts, not a per-assignee reminder row.

**Engagement attribution:** Attempt → Assignment is linked via `Attempt.assignment_id` (set at start_attempt time when origin is assignment-driven or loop-driven). `engagement_status` derivation queries attempts where `assignment_id` matches the assignment, not heuristic origin/timing matching. This prevents ambiguity when a Testee has multiple assignments on the same pill or path. The column + index land with migration `0004` in P4; this v1.4 amendment is doc-only and v1 has no production data to backfill.

**Spec reference:** §3, §4.4, §4.13, §5, §7.

**Related:** AC-D3, AC-D11, AC-D15, AC-D16.

---

## AC-D27 — Anchor calibration mathematics

> **Added in v1.2** — Specifies the calibration math AC-D20 deferred ("computes effective difficulty per anchor as attempts accumulate; fresh-generated questions are scored relative to the Testee's anchor performance using a simple delta"). AC-D20 remains the decision of record for *why* anchor calibration exists; AC-D27 is the decision of record for *how* it is computed.

**Decision:** Anchor calibration is computed with three defined mechanisms. All knobs land in System Settings and are tunable from pilot data.

*1. Per-anchor `effective_difficulty` (Bayesian shrinkage).* Each anchor question carries an effective-difficulty estimate that starts at its AI-assigned band and migrates toward observed population performance as attempts accumulate:

`effective_difficulty = (assigned_difficulty × k + Σ(observed_difficulty_i) ) / (k + n)`

where `n` is the number of recorded Testee attempts on that anchor, `observed_difficulty_i` is the difficulty implied by Testee *i*'s score on the anchor (`assigned_difficulty + competence_sensitivity × (0.5 − score_i)` — the AC-D9 relation solved for difficulty given a competence-neutral reading), and `k = anchor_calibration_prior_weight` (default 20). The estimate is clamped to the 1.0–10.0 axis and recomputed on the daily calibration cron.

*2. Fresh-question delta scoring.* A fresh (non-anchor) question in an attempt has no population history, so its effective difficulty is derived from how the Testee performed on the anchors *in the same attempt*:

`fresh_effective_difficulty = assigned_difficulty + testee_anchor_delta`

where `testee_anchor_delta = mean( anchor_effective_difficulty_j − assigned_difficulty_j )` across the anchors *j* drawn into that attempt — the "simple delta" AC-D20 named. If an attempt drew no anchors (per-Testee fully-unique mode per AC-D5), `testee_anchor_delta = 0` and the fresh question's effective difficulty is its assigned difficulty.

*3. Cold-start / confidence gate.* No separate cold-start branch exists: the shrinkage estimate is defined and stable from `n = 0` (it equals `assigned_difficulty`). The existing AC-D20 confidence qualifier is reused unchanged — until `n ≥ anchor_calibration_confidence_threshold` (default 20) for a pill+band, the band stamp displays with the "preliminary" qualifier. Competence (AC-D9) and the adaptive loop (AC-D6) consume the shrinkage estimate at all `n`, so downstream math is never undefined.

**Rationale:** AC-D20 established cross-Testee triangulation as the only non-circular ground truth in an AI-generates / AI-grades / AI-reviews system but deliberately left the math to a follow-up so the decision could lock without blocking on formula bikeshedding. Bayesian shrinkage toward the AI-assigned prior is the standard pattern for exactly this shape of problem (sparse per-item observations, a usable but noisy prior, a need for graceful behaviour at every sample size) and composes cleanly with the AC-D9 IRT-style competence relation, which uses the same `competence_sensitivity` constant. On the prior weight choice: `k = anchor_calibration_prior_weight = 20` is set equal to the AC-D20 confidence threshold so that a pill+band reaching "confident" status is also the point at which population evidence has equal weight with the AI prior. The trade-off is explicit — a higher `k` keeps the AI-stamped difficulty dominant longer before real population evidence overrides it, reducing early-operation flapping at the cost of slower calibration responsiveness through roughly the first four weeks of pilot data; this is the accepted direction because flapping band stamps in front of staff during the pilot is more damaging than slightly delayed calibration convergence.

**Implications:** Anchor question records gain a stored `effective_difficulty` (recomputed by the daily calibration cron, not at read time, to keep attempt-time generation fast). System Settings entity gains `competence_sensitivity` (default 2.0, shared with AC-D9) and `anchor_calibration_prior_weight` (default 20); the existing AC-D20 `calibration confidence threshold` (default n=20) is retained and is the single source of the "preliminary/confident" qualifier. The calibration cron computes per-anchor shrinkage estimates; attempt-time scoring reads the stored anchor estimates and computes the per-attempt `testee_anchor_delta` for fresh questions. No new admin UI beyond the AC-D20 calibration-confidence display. The competence_estimate formula in amended AC-D9 consumes `effective_difficulty` as defined here.

**Spec reference:** §3, §5, §6.1, §6.3, §4.7.

**Related:** AC-D9, AC-D20, AC-D5, AC-D6.

---

## AC-D28 — Source-authority allowlist and tiered scoring

> **Minted in v1.9** — autonomous-content-generation amendment cycle, **PR-A** (corpus & authority foundation). Ratified by the spec author through the authenticated in-session channel for this sequenced ratification cycle (workstream PR #107 ruling 3; detail-plan PR #108 Slice 1/A1 + Slice 2/A2; extraction PR #109 §B AM-1). **Multi-slice anchor (DS13-a ruled [A1+E2]):** the allowlist + tiered scoring is consumed at A1 (the registry) and A2 (corpus stamping); the per-source override/demotion layer is the E2 retroactive-rollback half.

**Decision:** Acumen scores the authority of external web sources through a **tiered allowlist**. Every source host resolves to one of three authority tiers, each carrying a normalised authority score:

- **T1 — regulators and standards bodies** (authority score **1.0**): `iso.org`, `nrcs.org.za`, `sabs.co.za`, and any `*.gov.za` host.
- **T2 — recognised industry and professional bodies** (authority score **0.6**): `nace.org`, `osha.gov`, `iec.ch`, `astm.org`.
- **T3 — reputable industry and educational sources** (authority score **0.3**): seeded minimally, widened by the operator.

The tier→score map (**T1=1.0 / T2=0.6 / T3=0.3**) is the single authority signal the corpus builder stamps on each acquired chunk (AC-CD25) and that downstream confidence scoring (Stage C) and the oversight dashboard (Stage E) read. **Tier resolution** matches a host against the allowlist by **exact host** (after lowercasing and stripping a leading `www.`) first, then by **suffix-wildcard** for `*.<suffix>` patterns (so `*.gov.za` matches `dol.gov.za` and the apex `gov.za`; an exact entry wins over a wildcard on tie). A host **not** on the allowlist resolves to **no tier** and is **not** an eligible corpus source. The allowlist is **operator-extensible per tier through environment configuration** (the AC-CD18 env-default pattern; an env entry may add a host but never silently re-tier a seed host — a host appearing at two tiers resolves to the **stronger** tier deterministically).

**Allowlist application scope (DS1-c — ruled corpus-acquisition only).** The allowlist governs **corpus acquisition** — web search for reference-corpus building (AC-CD25 / amended AC-D22) is restricted to allowlisted hosts. It does **not** tighten the existing AC-D21 safety-link curation search, which retains its current behaviour.

**Per-source override / demotion (E2 half — DS13-a ruled multi-slice [A1+E2]).** This anchor also governs the retroactive per-source rollback surface: the oversight dashboard (the oversight AC-CD, PR-D) may **demote or retract** a previously-acquired source. The demotion is recorded in a **DB-level source-override layer keyed by `source_host`** that overrides the code-registry tier at retrieval/ranking time — the code allowlist supplies the seed/default tier, the DB override supplies any operator demotion; the effective source-authority signal is the **join** of the two. The override layer's schema lands with the oversight rollback contract in **PR-D**; this anchor records the design so PR-A carries the multi-slice [A1+E2] shape from the outset.

**Rationale:** The autonomous pipeline replaces the human pre-publish gate with **retroactive** oversight, so the *sources* the system grounds against must be bounded — an unbounded web search would let the autonomous builder pull weak or adversarial sources with no human in the loop. A tiered allowlist with explicit authority scores gives every downstream consumer (corpus grounding, confidence scoring, oversight) a single auditable authority signal, and is the **structured successor to the informal authority notion AC-D21 already carries** ("NACE materials, SANS abstracts, manufacturer technical data sheets, OSH publications" as authoritative safety sources; `WebSearchResult.source` already exists so the admin queue can sort by authority). Per the standing *"balls to the wall, rein in if it breaks"* principle, the seed list is deliberately conservative (T1 enumerated, T2/T3 small) and widened by the operator through env configuration, not by the autonomous builder.

**Implications:** A pure, offline source-authority registry (`app/domain/source_authority.py`, Slice A1) resolves a URL/host to its tier and score and filters an arbitrary web-search result list to allowlisted hosts; it carries **no DB table at A1** (the AC-CD18 code-VCS-registry pattern). The corpus builder (AC-CD25, A2) stamps `source_host` / `authority_tier` / `authority_score` on each `CorpusChunk`. The numeric scores (1.0/0.6/0.3) are the values the Stage-C confidence contract and the Stage-E authority breakdown read, so a change to them is a **coordinated** confidence-contract change (couples NS-6, surfaced at C2). The per-source override/demotion DB layer lands with the PR-D oversight rollback contract (DS13-a). Cost: none beyond the web-search + embedding spend already tracked per amended AC-D18.

**Spec reference:** §6.5, §7.4.

**Related:** AC-D21, AC-D22, AC-CD25 (corpus builder), AC-CD18 (env-default pattern).

---

## AC-D29 — Generation provenance chain

> **Minted in v1.10** — autonomous-content-generation amendment cycle, **PR-B** (generation + provenance + ops-count). Ratified by the spec author through the authenticated in-session channel for this sequenced ratification cycle (detail-plan PR #108 Slice 5/B2; extraction PR #109 §B AM-9). NS-3 ruled **per-assertion**; schema ruled **relational**; complements (does not overload) `AIProvenanceMixin`.

**Decision:** Every autonomously-generated pill draft (per AC-D29's generator, `pill_generation`) records a **claim→source provenance chain**: for each factual **assertion** in a draft, which reference-corpus chunk(s)/source(s) grounded it, stamped with each grounding source's **authority tier and score** (AC-D28). The chain is stored in a **relational `GenerationProvenance` table** — one row per (assertion, grounding-chunk) — with columns `id`, `tenant_id`, `draft_ref`, `claim_ref` (the per-assertion identifier), `corpus_chunk_id` (FK → `CorpusChunk`, AC-CD25), `source_host`, `authority_tier`, `authority_score`, `created_at` (and a `batch_id` stamped by the B3 fan-out for per-batch rollback). It is **indexed on `source_host` and `corpus_chunk_id`** so the retroactive oversight surface (Stage E) can query *"every claim grounded on this source/chunk"* and roll it back precisely (ruling 5's per-source / per-batch rollback matrix).

**Rationale:** The autonomous pipeline has **no human pre-publish gate** — provenance is what makes retroactive oversight honest and rollback **precise**: with per-assertion binding, a discredited or withdrawn corpus source retracts exactly the *claims* it grounded, not whole drafts (the precision the ruling-5 matrix needs). A **relational** store (not an opaque JSONB blob on the draft) is forced by the by-`source_host` query the per-source rollback (E2) performs. The chain is a **distinct concern** from `AIProvenanceMixin` (`models.py` per-row *call-cost* provenance — provider/model/tokens/cost): cost provenance answers "what did this call cost," the chain answers "what grounded this claim." Keeping them separate avoids conflating cost aggregation with claim lineage and is the only shape that expresses the per-assertion × per-source cardinality.

**Implications:** New `GenerationProvenance` model + its migration (up/down clean; the IVFFlat-adjacent indices on `source_host`/`corpus_chunk_id`) — a B2 execution deliverable. Written by the B2 grounded-generation domain fn (`generate_grounded_drafts`); reused by the B3 N-draft persistence (each persisted draft's rows carry the shared `batch_id`); the `pill_generation` prompt bumps to v1.1.0 at B2 to add the `grounding_refs` output contract (G7b). The generation **call cost** continues to ride `AIProvenanceMixin` / `record_provenance_share` (cost-split across N drafts at B3) — orthogonal to this chain. Consumed downstream by the Stage-C confidence score (authority-weighted, C2) and the Stage-E oversight dashboard (authority breakdown E1 + per-source/per-batch rollback E2). If the A2 cross-source-corroboration ruling (DS2-b ≥(ii), ratified PR-A) is exercised, the per-`claim_ref` corroboration count is an **additive read** over these rows (no schema change). No new `Operation` enum value (provenance is recorded by the generator, not a separate AI call). No AI cost of its own (the rows carry no independent provider call).

**Spec reference:** §6.8, §6.5, §5.

**Related:** AC-D28 (source authority), AC-CD25 (corpus builder), AC-D21 (safety), AC-D7 (catalogue); (forward) the auto-publish-gate AC-D (C2) + the oversight rollback AC-CD (E2), PR-C/PR-D.

---

*End of Acumen decisions anchor log. 29 decisions locked (AC-D1–AC-D29); 6 v1.1 + 3 v1.2 + 1 v1.3 + 1 v1.4 + 1 v1.5 + 6 v1.6 + 1 v1.7 + 1 v1.8 + (1 mint AC-D28 + 3 amendments AC-D21/AC-D22/AC-D23 in v1.9, autonomous-content cycle PR-A) + (1 mint AC-D29 + the AI-operation-count amendment to AC-D1/AC-CD8/AC-D12 in v1.10, autonomous-content cycle PR-B) plus new AC-D27. Status: v1.10. Paired with `SPEC.md` v1.10.*
