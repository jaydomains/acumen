# Acumen — Decisions Anchor Log

> Companion to `acumen/SPEC.md`. Each decision records what's locked, why, and what it implies. Decisions are ordered by ID. Cross-references use `AC-D{n}` for Acumen decisions and other prefixes (CH-D, TF-D, MC-D, PA-D, etc.) for platform-wide rules anchored in other modules' audits.
>
> **Status:** v1.2. Paired with `SPEC.md` v1.2.
>
> **Decision count:** 27 decisions (AC-D1 through AC-D27; AC-D27 added in v1.2). 6 amendments applied in v1.1 to AC-D4, AC-D9, AC-D11, AC-D18, AC-D19, and §8.7; 3 further amendments applied in v1.2 to AC-D9, AC-D22 (with §7.3), and AC-D25. Original v1.0/v1.1 wording preserved in git history; current document reflects amended decisions as the authoritative text.

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

---

## AC-D1 — Application identity

**Decision:** Application name is Acumen. Decision prefix AC for all module-specific decisions. Mandate: generate, run, grade, and follow up on competency tests for staff as part of an autonomous learning loop; identify per-pill knowledge gaps; serve targeted learning material; re-test to confirm improvement. Hand-authored tests are supported as the exception, not the rule. Built as a standalone application now; intended for future conversion to a SiteMesh peer module integrating with Knowledge Library. Permission keys namespaced under `acumen:*`.

**Rationale:** "Acumen" captures sharpness of practical knowledge and judgment — the thing competency assessments measure and the closed loop sharpens over time. The application's primary value is not assessment but measurable knowledge improvement: AI generates, AI grades, AI identifies weakness, AI teaches, AI re-tests. Admin involvement is strategic (subject scope, sensitive-case oversight), not operational. Building standalone first lets KBC deploy and train staff immediately without waiting for Auth Hub or other SiteMesh dependencies.

**Implications:** Acumen owns seven AI-driven operations as of v1.1 (test generation, grading, weakness identification, learning material generation, pill proposal, grade review per AC-D19, anchor self-review per AC-D23). Each is a separate version-controlled prompt. Codebase root follows the standalone repo's conventions. Permission keys live under `acumen:*`. SiteMesh-specific architectural commitments (MeshCore posture, substrate role, inter-module events) are deferred to the conversion-phase spec.

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

**Implications:** Tests have status (draft / published) and visibility (library / private). Attempts record origin (self-initiated, assignment-driven, or loop-driven per amended AC-D18) and sequence number per Testee per test. Admin views show retake count next to latest score.

**Spec reference:** §3, §4.

**Related:** AC-D2.

---

## AC-D4 — Test integrity: deterrence, detection, and design

> **Amended in v1.1** — #5 (AI-prose detection) replaced with deterministic n-gram overlap detection. See change rationale below.

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

**Implications:** Attempts table includes a sub-collection of focus events. Question rendering includes a watermark layer. Grade entity's integrity-flag field captures "served-material-overlap flag with overlap percentage" instead of a stylistic phrasing flag. New deterministic logic — text shingling, n-gram comparison, threshold check — runs in the grading pipeline; cheap, no AI cost. For Testees who were never served learning material for that pill, overlap check is skipped.

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

**Implications:** Pill metadata carries min/max difficulty range. Test generation prompt receives both signals. Adaptive loop progression uses the competence_estimate float; integer math operates on the rounded float. Competency Profile entity gains `competence_estimate` (float) per pill per Testee. Band labels for display continue to derive from integer bins but operate on the rounded float rather than the latest attempt's stamped integer. Historical attempts retain their stamped integers; the float is computed from attempt history and recomputed after each new attempt. Decay function configuration: `competence_decay_halflife_days` (default 90). System Settings entity gains `competence_sensitivity` (default 2.0) per the v1.2 formula. For a pill with zero attempts by a Testee, `competence_estimate` is null and the UI shows "no data yet" rather than a band; loop logic per AC-D6 treats null as needing a benchmark or first attempt, not a failing score. Admin views display both the integer band ("Working") and the float estimate ("6.7 / Working").

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

**Implications:** Test entity carries `timed`, `duration_minutes` (nullable), `pause_allowance`, `timeout_behaviour`, `max_pause_duration_minutes` (default 30). Attempt entity gains `pauses_used`, `total_pause_duration`, and a sub-collection of pause-event records. Pause UI overlay added. Pause initiation triggers a server call that snapshots current input state before the overlay renders. Resume triggers a server call that restores the snapshotted state. Focus events during a pause are expected and not flagged.

**Spec reference:** §3, §4.

**Related:** AC-D3, AC-D4.

---

## AC-D12 — Model selection defaults

**Decision:** v1.1 defaults to Claude Sonnet for the five Anthropic-side AI operations (generation, grading, weakness identification, learning material, pill proposal) and OpenAI for the two cross-family operations (grade review per amended AC-D19, anchor self-review per AC-D23). Admins may override the default per operation in system settings. Model overrides are recorded against each AI-produced entity for traceability. Specific stakes-based overrides may be configured per Test.

**Rationale:** Sonnet hits the right cost-quality balance for primary operations. OpenAI for cross-family review provides the orthogonal-signal benefit per amended AC-D19. Per-operation override exists for the genuine edge cases.

**Implications:** System Settings entity carries a model-per-operation map plus a provider-per-operation map. Test entity optionally carries a per-operation model override. Each AI call resolves the effective model and provider: Test override > system override > default. Cost tracking aggregates by operation, model, and provider.

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

**Decision:** v1 includes a sixth AI operation: **grade review**. After AI grading completes on a response, a separate AI call **on a different provider** reviews that grade by examining the question, the candidate response, the rubric, the AI's assigned grade, and the AI's reasoning. The review either confirms the grade or flags it for admin attention. **Reviews run synchronously before the Testee sees their result** — Testee waits an additional 10–30 seconds at submit; on completion, sees the post-review grade and band stamp.

**Scope:** v1 reviews 100% of AI-graded short-answer and scenario responses. MCQ, true/false, and matching are deterministic and skip review. Deterministic-graded items display immediately if they are the only items on the test; mixed tests render the result page after all AI grading and review have completed.

**Cross-family default:** Anthropic primary grading reviewed by OpenAI. The reviewer prompt is framed as "is this grade defensible given the rubric?" rather than "what grade would you give?" — different inductive task framing produces orthogonal signal. Provider per pass is configurable in system settings.

**Disagreement handling:** flagged grades surface in the admin review queue. Admin chooses to keep the original grade, accept the reviewer's verdict, or substitute their own — using the override mechanism per AC-D2.

**Rationale:** Manual admin calibration forces admins to do review work the system itself can do. A second AI call examining the grade in light of the rubric is structurally a review — cheaper than admin time at any reasonable scale, surfaces disagreements automatically.

**Amendment rationale (v1.1):** Same-provider review reuses the inductive biases of the original grading model — homophily that defeats the purpose of independent review. Cross-family review (different provider, different training distribution, different inductive task framing) generates the orthogonal signal the review pass exists to provide. Asynchronous post-display review created a worse failure mode than the latency it avoided: a Testee internalises "Working band" then sees it walked back the next day after admin reviews the flagged grade. Synchronous review trades 10–30 seconds of submit-time wait for grade durability.

**Implications:** A sixth AI operation added to §6 (§6.6 — Grade review). Separate review prompt managed in version control. Grade entity gains `review_status` (confirmed / flagged — no pending state because review always completes before display) and `review_reasoning`. System Settings entity gains a `review_provider` field (default OpenAI) alongside the existing model-per-operation map per AC-D12. Two API keys are now required in environment configuration: Anthropic (primary operations) and OpenAI (review pass and anchor self-review per AC-D23). Cost dashboard tracks review-pass cost against the OpenAI provider separately. If the review provider is unreachable at submit time, the grade displays as preliminary with an explicit "review pending" label, and the system retries on the next cron pass — fail-soft, not fail-blocking. UI shows a brief "checking your answers..." state during the synchronous review window.

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

**Decision:** Acumen distinguishes pills by safety relevance. The Pill entity carries a `safety_relevant` boolean flag, auto-applied at pill creation by two signals: (a) keyword detection on the pill name and description against a configurable safety keyword list (lift, scaffold, asbestos, isocyanate, cathodic, confined space, fall, PPE, high voltage, hot work, fire, electrical, hazardous, toxic, etc.); (b) the proposing AI's self-classification when a new pill is proposed per AC-D7. Admin can override the tag in either direction at any time.

For safety-relevant pills, Acumen does not generate AI teaching content. The adaptive learning loop per AC-D6 still runs end-to-end — weakness identified, learning material served, retest queued — but the learning material is a curated list of 3–5 authoritative external links (NACE materials, SANS abstracts, manufacturer technical data sheets, OSH publications), fetched via web search at pill creation and cached against the pill record. A monthly autonomous link-check cron re-validates cached URLs; broken links trigger fresh web search; substantial content drift detected by AI comparison of new versus cached content flags the pill for admin attention.

**Rationale:** The adaptive loop's autonomous default assumes AI-generated teaching content is reliable. For domains where wrong content has safety consequences — PPE, high-risk trades, hazardous substances, structural integrity, electrical work — AI hallucination becomes a liability path: a Testee taught wrong then stamped competent in unsafe work creates real downstream risk. Removing AI teaching for safety pills entirely is structurally cleaner: Acumen does not claim authority on safety topics. The product position becomes "Acumen assesses competency and routes staff to authoritative third-party sources for safety topics; Acumen does not teach safety." This is a defensible posture if ever questioned in an audit, incident review, or legal context.

**Implications:** Pill entity gains `safety_relevant` boolean and `safety_links` collection — list of cached URL references with title, source, last-verified timestamp, content hash. Auto-tagging logic runs at pill creation and is re-evaluated on pill description edits. AI proposal output schema per AC-D7 includes safety self-classification. Weakness identification per AC-D6 routes safety-tagged pills to the external-link delivery path; §6.4 (Learning material generation) is skipped for safety pills — no AI explainer is produced even as fallback. Web search becomes a new external integration. The monthly link-check cron is added to deployment topology. For a safety pill whose entire link set is dead at attempt time, the loop falls back to "we identified a gap in [pill]; please ask your administrator for guidance" — does not generate AI teaching content as a fallback. Cost tracking per amended AC-D18 includes web-search costs separately.

**Spec reference:** §3, §4.9, §5, §6.4, §7, §8.

**Related:** AC-D6, AC-D7, AC-D18, AC-D22.

---

## AC-D22 — Passive moat: Drive folder ingestion and Testee feedback signal

> **Amended in v1.2** — Embedding model default fixed to OpenAI `text-embedding-3-small`; Anthropic offers no embeddings API. See change rationale below.

**Decision:** Acumen acquires KBC-specific context passively through two mechanisms designed to require no curation effort or admin time:

*Drive folder RAG ingestion.* Acumen has read-only access to a single designated Drive folder (default name "Acumen/Reference", operator-configurable). Any document placed in that folder — PDFs, Google Docs, Word documents, text files — is auto-fetched, chunked, and embedded into a vector index on a daily cron. The index is queried at every generation call (test generation per §6.1, learning material per §6.4) and relevant chunks are injected as RAG context into the prompt. The operator's only action is dropping files into the folder during normal work; no upload UI, no schedule, no metadata tagging, no manual triggering.

*Testee realism feedback.* Each question presented to a Testee carries a small "this question feels unrealistic or off" button. Clicking it records a flag against that specific question's content and the generation context that produced it. The generation prompt is periodically updated to weight away from question patterns that accumulated flags. Feedback weight per Testee is scaled by the Testee's overall attempt accuracy — high-performing Testees' flags count for more than low-performing Testees' flags, preventing systematic gaming by failers.

Together these mechanisms allow KBC-specificity to compound as a function of normal use rather than as a discrete curation project.

**Rationale:** The differentiation moat for Acumen against generic AI learning tools is KBC-specific situated content — questions referencing real KBC workflows, real defect patterns, real materials and suppliers, real project context. AC-D4 #6 names this as the integrity-through-design layer but does not architect how the specificity gets in. The full moat depends on Knowledge Library integration at SiteMesh-port time, leaving v1 as a generic learning tool. Two passive signals available within standalone v1 begin building the moat immediately without any structured ingest project: the operator's existing document trail, and Testees' implicit judgement of realism.

**Implications:** Drive integration is a new external service. Service account credentials and the folder identifier held in environment configuration. Daily ingest cron computes file diffs and re-embeds changed or new documents; deleted documents drop from the index. Chunking strategy and embedding model are configuration values; default to ~500-token chunks with OpenAI's `text-embedding-3-small` (1536 dimensions). Embedding costs are tracked against the OpenAI provider in the cost dashboard per amended AC-D18. Vector index lives in a Postgres pgvector extension at v1 scale. Question entity gains `realism_flag_count` and `realism_flags`. The Testee UI gains an unobtrusive flag button next to each question. Feedback aggregation runs nightly and produces a "low-realism" question pool that feeds into the generation prompt as negative examples. Where a question has a high flag count relative to its attempt count, it is removed from the anchor pool per AC-D20 if it was an anchor. The Drive folder may contain confidential KBC documents; ingest is strictly scoped to the designated folder, and the operator is responsible for what is placed there.

**Amendment rationale (v1.2):** The v1.1 spec specified "embedding model from the primary provider" but Anthropic doesn't offer an embeddings API, making this not implementable. OpenAI is already in the stack for AC-D19 cross-family review, so using OpenAI for embeddings adds no new provider integration. `text-embedding-3-small` is the standard production choice — 1536 dimensions, cheap (~$0.02 per million tokens), and well-suited to construction-domain RAG at v1 scale.

**Spec reference:** §3, §5, §6.1, §6.4, §7, §8.

**Related:** AC-D4, AC-D5, AC-D6, AC-D7, AC-D20.

---

## AC-D23 — Autonomous bootstrap run

**Decision:** First-deployment initialisation includes an autonomous bootstrap run that pre-populates calibration scaffolding and content before the first Testee touches the system. The run executes after the pill catalogue is seeded (per §8.4 step 3) and before assignments are issued. It performs four actions sequentially:

1. For every pill, generate the anchor question pool per supported band per AC-D20.
2. **Run AI self-review on every generated anchor question.** A second AI call (using a different provider from the generator per AC-D19 pattern) evaluates each anchor against quality criteria: pill-fit, difficulty calibration, rubric clarity, freedom from ambiguity, factual reasonableness. Anchors failing self-review regenerate, up to three attempts per slot. Anchors that fail three times are excluded from the pool with an admin-attention flag.
3. For every safety-tagged pill, fetch and cache the curated external link set per AC-D21.
4. Embed and index whatever documents are present in the designated Drive folder per AC-D22.

The run is non-interactive — operator initiates with a single command, work proceeds in background, completion notification surfaces in the admin dashboard.

**Rationale:** Three of the four new behaviours added in AC-D20 through AC-D22 require minimum data to function. Without bootstrap, the first weeks of pilot operate against degraded versions of these mechanisms. Bootstrap shifts this cost to a one-time overnight compute spend. The AI self-review step adds a content-quality filter to the anchor pool before Testees ever see anchor questions — without it, the first 20-50 attempts on a new pill effectively act as a Testee-funded quality check on the generated anchors. Per amended AC-D18, bootstrap cost is on the order of $50-60 for a pilot-scale catalogue.

**Implications:** Bootstrap script added to deployment workflow as §8.4 step 4. Script is idempotent. Bootstrap progress and completion logged to the audit log. Failure modes are recoverable. Bootstrap cost is tracked separately in the cost dashboard per amended AC-D18. Subsequent pill additions post-launch trigger an incremental bootstrap automatically — anchor pool generated, self-review run, safety links fetched when the new pill goes active, no operator action required. Pills with anchor pools at reduced size display in admin views with the flag.

**Spec reference:** §8.4, §3.

**Related:** AC-D7, AC-D19, AC-D20, AC-D21, AC-D22.

---

## AC-D24 — Shared-test integrity: content lock and presentation shuffle

**Decision:** Tests reused across multiple Testees (frozen mode and hand-authored mode per AC-D5) gain two layered integrity protections, both configurable per test:

*Content lock during a campaign.* A frozen or hand-authored test carries a `lock_mode` flag. **Open** (default for general use) — admin can edit the test at any time; edits apply forward only per AC-D17. **Campaign-locked** — admin marks the test as locked for a defined campaign period; no edits permitted until the campaign is explicitly closed. Campaign-locked mode is the canonical setting for hiring screens and formal benchmarks where all candidates must sit identical instruments. The lock mode is independent of the snapshot-at-attempt mechanism in AC-D17.

*Per-attempt presentation shuffle.* Two toggle fields on frozen and hand-authored tests, both default true: `randomise_question_order` (questions appear in shuffled order per attempt) and `randomise_option_order` (MCQ option letters and matching-pair sides shuffle per attempt). Shuffle uses a seed derived from the attempt_id so resume-after-save yields the same order. Admin can disable either toggle per test for cases where presentation order matters intrinsically. Question-group support: questions sharing a `question_group_id` shuffle as a single block with internal order preserved — handles the case-study pattern.

Together: shared tests carry identical content (locked when needed), but each Testee sees that content in a unique presentation. Office-setting benchmarking becomes safe — the same instrument, presented differently per seat.

**Rationale:** AC-D5's frozen mode already supports same-test-across-Testees for comparability cases. What was missing: anti-collusion when Testees take the test in the same physical space, and content stability when the comparability use case spans a campaign rather than a single sitting.

**Implications:** Test entity (frozen and hand-authored modes) gains: `lock_mode` (open / campaign-locked), `campaign_id` (optional), `randomise_question_order` (default true), `randomise_option_order` (default true). Question entity gains optional `question_group_id`. Attempt entity gains `shuffle_seed`. Shuffle logic runs at attempt start after the question set is resolved. Admin UI gains a "lock campaign" action on frozen tests with a confirmation prompt. Closing a campaign (unlocking) is an admin action logged in the audit trail. Campaign-locked tests cannot be deleted while locked. Anti-collusion shuffle becomes a seventh integrity layer in AC-D4's framing, specific to shared-test modes.

**Spec reference:** §3, §4.3, §4.7, §5.

**Related:** AC-D4, AC-D5, AC-D17.

---

## AC-D25 — Just-in-time generation with parallel streaming

> **Amended in v1.2** — Benchmark mode opts out of JIT streaming; sequential adaptive generation only. See change rationale below.

**Decision:** For per-Testee mode (the AI-generated test mode per AC-D5), question generation is just-in-time with parallel background streaming. At attempt start, **question 1 generates in foreground** (~3 seconds typical) and renders immediately to the Testee. **Questions 2 through N stream in parallel in the background** while the Testee answers question 1. The system maintains a configurable buffer of 3–5 questions ahead of the Testee's current position. If a fast Testee outruns the buffer, a brief "preparing next question..." state appears until the next question completes generation.

Frozen and hand-authored modes have no generation latency since content pre-exists; this decision does not apply to them.

**Benchmark mode exception.** AC-D13 benchmark mode does not use JIT streaming. Benchmark generation is sequential: Q1 generates and renders, Testee answers and submits, system grades, then Q2 generates with difficulty determined by Q1's result. The ~3-second wait between questions is acceptable because benchmark is untimed by AC-D13 and adaptive sequencing is the entire point of the mode. Parallel pre-generation cannot work where each question's difficulty depends on the previous question's outcome.

**Rationale:** Sequential generation of all questions at attempt start creates 20–60 second wait times before the Testee sees anything — degrades UX badly and signals "this is an AI-heavy contraption" rather than a fluid assessment. Pre-generating questions at assignment time would eliminate the wait but loses the freshness benefits of generating against current context (latest Drive RAG content per AC-D22, current anchor calibration state per AC-D20, most recent weakness signals on this Testee). JIT with parallel streaming preserves the freshness while compressing the wait to a single first-question delay.

**Implications:** The attempt API exposes generation as a stream rather than a single blocking call. Question 1 generation runs synchronously at attempt start; questions 2-N start in parallel as soon as the question 1 prompt is dispatched. Each question's generation context includes (per AC-D20, AC-D22): anchor exemplars from the pool, retrieved RAG chunks from the Drive index, and prior questions already generated for this attempt. The Testee UI shows "preparing your test..." for the few seconds of question 1 generation, then renders Q1 with a small subtle indicator that subsequent questions are still loading. Generation failures during streaming surface per §6 error handling. Buffer-ahead size is configurable (default 3, max 5). Autosave snapshots both Testee responses and the generated question set; refresh/reload during an attempt preserves all already-generated questions per AC-D17 pattern.

**Amendment rationale (v1.2):** The v1.1 decision stated JIT parallel streaming applied to *both* per-Testee and benchmark modes, but that is mechanically impossible for benchmark: AC-D13 benchmark generation is adaptive — question N+1's difficulty is a function of question N's graded outcome — so questions 2…N cannot be pre-generated in parallel before question 1 is answered. The amendment scopes JIT streaming to per-Testee mode only and makes benchmark explicitly sequential. Within per-Testee mode, AC-D20 anchor questions remain position-streamed inside the JIT set (drawn and generated like any other buffered question, not pinned to fixed positions) — anchors are content-frozen, not position-frozen, so streaming them carries no calibration risk. No new configuration is introduced; the existing buffer knobs are unchanged.

**Spec reference:** §3, §4.7, §6.1, §8.

**Related:** AC-D5, AC-D11, AC-D13, AC-D17, AC-D20, AC-D22.

---

## AC-D26 — Assignment engagement tracking and auto-escalation

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

**Implications:** Assignment entity gains derived engagement_status (computed at read time from attempt history; not stored). System Settings entity gains: `pending_assignment_age_threshold_days` (default 7), `reminder_schedule_with_deadline_days_before` (default [7, 1]), `reminder_schedule_no_deadline_days_after` (default [14, 30]), `escalation_enabled` (default true for mandatory only). Reminder and escalation email templates added to §7 SMTP integration. Reminder send history is stored against the assignment record. Audit log captures escalation events. Admin dashboard "pending engagement" widget renders the configurable threshold view. When Acumen ports to SiteMesh, the entire reminder/escalation mechanism routes through Comms per §9.5; the engagement_status field and dashboard surface remain in Acumen.

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

*End of Acumen decisions anchor log. 27 decisions locked (AC-D1–AC-D27); 6 amendments applied in v1.1, 3 in v1.2 plus new AC-D27. Status: v1.2. Paired with `SPEC.md` v1.2.*
