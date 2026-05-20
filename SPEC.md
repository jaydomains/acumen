# Acumen — Application Specification

> **Application:** Acumen
> **Phase:** Standalone v1 (pre-SiteMesh-port)
> **Decision prefix:** AC-D{n}
> **Status:** v1.7. Paired with `DECISIONS.md` v1.7 (27 decisions; 6 v1.1 + 3 v1.2 + 1 v1.3 + 1 v1.4 + 1 v1.5 + 6 v1.6 + 1 v1.7 amendments plus new AC-D27; v1.7 also closes the AC-CD11 P6 gate).
>
> **Changes from v1.0:** Adds anchor calibration (AC-D20), safety-pill auto-tagging with curated external material (AC-D21), passive moat via Drive RAG and Testee feedback (AC-D22), autonomous bootstrap run (AC-D23), shared-test integrity with content lock and presentation shuffle (AC-D24), just-in-time generation with parallel streaming (AC-D25), and assignment engagement tracking (AC-D26). Amends six v1.0 decisions: AC-D4 #5 (n-gram overlap replaces stylistic detection), AC-D9 (derived competence_estimate float), AC-D11 (pause blanks content), AC-D18 (worked cost example, rate-limit carve-outs), AC-D19 (cross-family synchronous review), §8.7 (simplified privacy notice).
>
> **Changes in v1.2:** Adds AC-D27 (anchor calibration mathematics — Bayesian effective-difficulty estimator, fresh-question delta scoring, cold-start gate). Amends three decisions: AC-D9 (full IRT-style competence formula with recency-weighted decay and adaptive-loop target), AC-D22 / §7.3 (embedding model fixed to OpenAI `text-embedding-3-small`; Anthropic exposes no embeddings API), AC-D25 (benchmark mode carved out of JIT parallel streaming — sequential adaptive generation only).
>
> **Changes in v1.3:** Clarifying amendment to AC-D19 — `review_status` enumerated as pending / confirmed / flagged; removed the contradictory "no pending state" phrasing (pending is the fail-soft state on review-provider outage). No behavioural change; spec-consistency only.
>
> **Changes in v1.4:** Clarifying amendment to AC-D26 — explicit `Attempt.assignment_id` FK so `engagement_status` derives by assignment match, not origin/timing heuristics. Doc-only.
>
> **Changes in v1.5:** Clarifying amendment to AC-D3 — `Attempt.sequence_number` scope corrected to per Testee per Test; canonical uniqueness constraint recorded in CODE_SPEC §4. Doc-only.
>
> **Changes in v1.6:** Pre-build spec-audit consolidation — 16 amendments across AC-D4 / D9 / D11 / D12 / D19 / D26, AC-CD8, the AC-CD11 gate-checklist, and SPEC §5 / §4.8 / §4.13 / §8.9, resolving P4/P5/P6 build-blocking gaps surfaced by `docs/_meta/spec-audit-2026-05-19.md` before mid-phase stops occurred. Doc-only; reconciles spec prose with the already-shipped P1 schema.
>
> **Changes in v1.7:** AC-CD11 P6 gate closure — locks cross-family review as batched per attempt (single OpenAI call per submit, all AI-graded responses in one payload) with a 60-second hard ceiling; over-ceiling routes to the existing fail-soft `pending` + reconcile cron path. Amends AC-D19's "10–30 second" submit-wait wording to match (F10 resolved). Names the cron 5-min × max-retry 10 → ≈50-min stuck-pending auto-flag window explicitly (F11 amplified, no default changes). Doc-only.

---

## 1. Mandate

Acumen is a standalone adaptive learning application. It generates competency tests for staff on demand, grades them, identifies each Testee's knowledge gaps at the pill level, serves targeted learning material to close those gaps, and re-tests to confirm the improvement landed. The cycle is autonomous by default — administrators define which subjects matter to the organisation; AI handles question generation, grading, weakness identification, learning material delivery, and re-testing. Hand-authored tests remain supported but are the exception, not the rule. Results are stored as a per-Testee per-pill competency history that improves measurably over time and is empirically calibrated as the system accumulates pilot data. Acumen is designed to fold into the SiteMesh platform later as a peer module integrating with Knowledge Library, but operates fully independently in its standalone form.

*Per AC-D1, AC-D5, AC-D6, AC-D7, AC-D20.*

---

## 2. Users and roles

Acumen v1 ships with two user roles:

- **Administrator** — full access. Creates and edits assessments, manages users (including adding new users and assigning them either Administrator or Testee role at creation), reviews and overrides AI grades, views all results and team history across the organisation, configures system settings.
- **Testee** — the person being assessed. Logs in, sees assessments available to them, takes them, views their own graded results and personal history. Cannot see other users' results.

Roles are stored as a single field on the user record. User creation is admin-driven — no self-registration. An Administrator adds a new user and assigns the role at creation time. The two-role model serves the full organisation: all staff (site teams, project management, QS, maintenance and inspection teams, and any other function) take assessments as Testees; one or more Administrators run the system.

*Per AC-D2.*

---

## 3. Scope

### In scope for v1

**Identity and access**
- Two user roles per AC-D2: Administrator and Testee, with admin-driven user creation
- Email + password authentication with a basic forgot-password flow per AC-D10
- User deactivation flow per AC-D16 (login disabled, data preserved)
- Single-tenant deployment for KBC (data model is tenant-aware throughout)

**Pill catalogue (per AC-D7, AC-D8, AC-D21)**
- Admin seeds the initial Subject and Pill taxonomy at deployment
- AI proposes new pills surfaced to admin for review
- Pills carry metadata: description, available difficulty range, discoverable flag, related pills, **safety_relevant flag** (auto-tagged per AC-D21), **anchor question pool per supported band** (per AC-D20)
- Admin groups pills into named Learning Paths for repeatable bundling
- Testees browse and self-select discoverable pills
- Safety-tagged pills carry **cached external link sets** instead of AI-generated learning material

**Test generation (per AC-D5, AC-D9, AC-D13, AC-D25)**
- AI generates question sets on demand per Testee per pill per difficulty
- **Just-in-time generation with parallel streaming** per AC-D25 (per-Testee mode) — question 1 generates in foreground, 2-N stream in parallel; benchmark mode generates sequentially per amended AC-D25
- Question types: multiple choice, true/false, matching, short answer, scenario
- Frozen test mode — admin generates once and publishes for reuse, with optional **campaign lock** per AC-D24
- Hand-authored test mode — admin writes questions manually (exception path)
- Benchmark mode — adaptive diagnostic tests at subject, pill, or learning path scope per AC-D13
- Difficulty selectable via 10-point slider with anchored bands per AC-D9
- **Per-attempt presentation shuffle** on frozen and hand-authored tests per AC-D24

**Taking tests (per AC-D3, AC-D4, AC-D11)**
- Autosave responses as Testee progresses
- Integrity measures: right-click and copy/paste disabled, name + timestamp watermark, tab-focus tracking, time-per-question logging, **n-gram overlap detection against served learning material** per amended AC-D4 #5
- Self-initiated and admin-assigned attempts both supported, distinguished in records
- Unlimited retakes with retake count visible
- Timed and untimed test modes, admin-configurable at test creation
- Pause mechanism for timed tests — formal stop-the-clock with limited allowance and **content blanking during pause** per amended AC-D11

**Grading (per AC-D5, AC-D6, AC-D19)**
- Auto-grade deterministic question types (MCQ, T/F, matching)
- AI grade short-answer and scenario types using rubrics
- **Synchronous cross-family AI review** of every AI-graded response before band stamp lands per amended AC-D19
- Admin override of any AI grade
- Per-response tagging by pill for weakness identification

**Adaptive learning loop (per AC-D6, AC-D21)**
- Per-Testee weakness identification at pill level
- AI-generated explainer text for weak pills (non-safety pills only)
- **External link sets for safety-tagged pills** (no AI explainer) per AC-D21
- Admin-uploaded reference material (PDFs, links) tagged to pills
- Follow-up test generation targeting weak areas
- Autonomous and admin-reviewed modes, configurable per test
- **Loop-driven test generations exempt from per-Testee rate limit** per amended AC-D18

**Groups and assignment (per AC-D15, AC-D26)**
- Group entity — admin creates Groups for bulk assignment and team-level reporting
- Three system-defined groups: All Users, All Testees, All Administrators
- Testees can be members of multiple groups simultaneously
- Assignments target individuals or Groups
- **Assignment engagement tracking** per AC-D26 — derived engagement_status, dashboard widget, auto-reminders, auto-escalation

**Competency profile**
- Per-Testee, per-pill, per-difficulty 2D matrix
- **Derived competence_estimate float per pill per Testee** per amended AC-D9
- Attempt history with origin (assigned / self-directed / loop-driven) and retake count
- Band-boundary milestones visible (e.g. "Working → Advanced in Reference Panels")
- **Calibration confidence** displayed alongside band stamps (preliminary until anchor n threshold reached) per AC-D20

**Admin operations**
- Manage users, pills, learning paths, assignments, groups
- Review AI-suggested pills before they enter the catalogue
- View all attempts, weakness reports, team-level rollups
- Override AI grades; reverse autonomous loop decisions
- Review queue for AI-grade-review disagreements per AC-D19
- **Pending engagement widget** per AC-D26
- **Manage safety keyword list** and safety-tag overrides per AC-D21
- **Manage campaign locks** on frozen tests per AC-D24

**Cost visibility (per AC-D18)**
- Cost dashboard tracking AI spend by operation, by Testee, and by provider (Anthropic primary, OpenAI review)
- Worked example: ~23¢ per typical attempt, ~50–70¢ per pill journey with adaptive loop, monthly run rate ~$15–20 for KBC-scale, bootstrap one-time ~$50–60
- Budget alerts at 50%, 80%, 100% of admin-configured monthly budget
- Per-Testee rate limits on self-initiated test generation (default 5/hour, 20/day, admin-configurable); admin-assigned and loop-driven generations exempt

**Infrastructure**
- Anthropic API for primary AI operations (generation, grading, weakness identification, learning material, pill proposal)
- **OpenAI API for cross-family review pass and anchor self-review** per AC-D19 and AC-D23
- **Google Drive API for passive RAG ingestion** per AC-D22
- **Web search for safety-pill external link curation** per AC-D21
- Per-attempt cost tracking (tokens in/out, provider)
- Basic email notifications for assignments, follow-ups, reminders, escalations
- PDF export of an individual attempt's graded result
- **Autonomous bootstrap run** at deployment per AC-D23

### Out of scope for v1

| Concern | Why deferred |
|---|---|
| Multi-tenant UI (tenant onboarding, cross-tenant features) | KBC is the only tenant; data model accommodates future tenants |
| SSO, 2FA, magic-link auth | Defer to Auth Hub during SiteMesh port |
| Hard-deadline locking of assignments | Conflicts with adaptive learning loop; v1 ships soft deadlines + engagement tracking only |
| Pill merge as distinct operation | Pill retirement covers v1 needs; merge deferred to v1.x |
| Group-scoped pill discovery | Org-wide discoverability in v1; group scoping is v1.x |
| Hard AI budget enforcement / graceful model degradation | v1 ships visibility + alerts only; enforcement adds complexity without small-scale value |
| Admin prompt customisation UI | v1 admin == developer (Jay); customisation needed when admin ≠ developer (v1.x or SiteMesh-era) |
| Hard deletion of user data (POPIA erasure) | v1 retains all data per AC-D14; combined deactivation + export workflow is v1.x |
| Video upload + transcription for learning material | Significant infrastructure; AI text explainers and admin-uploaded PDF/links cover v1 needs |
| LMS integration (SCORM, xAPI) | Not needed for KBC; defer until a deployment requires it |
| Knowledge Library integration | KL not deployed; Drive folder RAG per AC-D22 covers v1 passive moat |
| Slack / Teams / calendar integration | Defer to Comms module integration at port time |
| Native mobile apps (iOS/Android) | Responsive web is sufficient for v1; native is a future product call |
| Advanced analytics (charts, trends, benchmarks) | v1 ships flat tables and basic summaries; charts in v1.x |
| Gamification (badges, leaderboards, streaks) | Out of scope for v1; reasonable v1.x consideration if engagement signals justify |
| Self-registration | Per AC-D2, admins create all users |
| Multi-language support | English only in v1 |
| White-label / per-tenant branding | Single-tenant deployment; basic logo only |
| Webcam proctoring | Per AC-D4 — out of scope at any phase |
| Stylistic AI-prose detection | Replaced by deterministic n-gram overlap detection per amended AC-D4 #5 |

### Setup work for deployment

Pill catalogue seeding is a real piece of v1 setup, not a development task. Half a day with Jay (and Gys) to populate KBC's initial Subjects and Pills. The AI can propose a starter set if given KBC's business context, but human curation is required before going live with Testees. **Once the catalogue is seeded, the autonomous bootstrap run per AC-D23 handles all subsequent setup work** — anchor pool generation with self-review, safety-pill external link curation, and initial Drive RAG indexing — with no admin involvement.

---

## 4. Workflows

### 4.1 Catalogue lifecycle

Admin seeds Subjects and the initial Pill taxonomy at deployment. AI proposes new pills on a continuous basis as test generation surfaces coverage gaps and Testee discovery behaviour reveals interest in untracked areas. Proposed pills queue for admin review with rationale ("seen 14 generated questions touching this concept with no existing tag fit"). Admin approves, renames, merges into existing pills, or rejects. Admin separately defines each pill's `available_difficulty_range`, `discoverable` flag, and optional grouping into named Learning Paths. **Safety relevance is auto-tagged at pill creation per AC-D21** — admin can override the tag in either direction. **When a new pill is approved, an incremental bootstrap auto-runs to generate anchor pools, run self-review, and (if safety-tagged) curate external link sets.** Pills can be manually retired by admin at any time; retired pills are hidden from Testees and from new generation but remain in the database for historical reference per AC-D14.

### 4.2 User management

Admin creates a new user record with email, name, and role (Administrator or Testee). System sends a setup email with a one-time link. Recipient clicks the link, sets a password, and lands on their dashboard. Admin can change a user's role, deactivate per AC-D16, delete (limited — see AC-D14 retention), or trigger a password reset (sends reset email to the user). No self-registration per AC-D2.

### 4.3 Test creation

Four creation paths, all stored in the same data model:

1. **Per-Testee spec** (the dynamic default per AC-D5). Admin defines a generation spec: subject, pills, difficulty integer, question count, question-type mix, timed/untimed, duration if timed, pause allowance, timeout behaviour, pass threshold. When a Testee starts the test, AI generates fresh content from the spec via just-in-time streaming per AC-D25 — no two Testees see the same questions.
2. **Frozen test**. Admin invokes AI to generate a question set against a spec, reviews and edits if needed, publishes. The frozen question set is reused across Testees. Admin can set `lock_mode` to **campaign-locked** per AC-D24 for hiring screens and formal benchmarks where edit-during-campaign would compromise comparability. Per AC-D24, per-attempt question and option order shuffle is enabled by default.
3. **Hand-authored**. Admin writes questions, rubrics, and model answers manually. Same data shape as frozen, same shuffle and lock options per AC-D24.
4. **Benchmark** (per AC-D13). Diagnostic mode that ranges across difficulty levels to establish a Testee's baseline competency. Adaptive generation — start at midpoint, step up on pass and down on fail until convergence. Scope can be subject, pill, or learning path. Generation is sequential, not JIT-streamed: each question is generated only after the previous one is graded, since the next difficulty depends on the prior outcome. Benchmark is explicitly carved out of AC-D25 parallel streaming per the amended decision; the brief per-question wait is acceptable because benchmark is untimed.

All four modes share the same execution and grading machinery downstream.

### 4.4 Assignment flow

Admin selects a pill (or Learning Path), a difficulty, target Testee(s) or Group(s) per AC-D15, optional deadline, and mandatory/optional flag. For tests with the adaptive loop, admin sets autonomous or admin-reviewed mode. Assignment notification emails the Testee(s) and surfaces in their dashboard. Deadlines are soft in v1 — past-due assignments flag in admin views but Testees can still complete; hard-locking is deferred to v1.x. **Engagement tracking per AC-D26 runs automatically on every mandatory assignment**: derived engagement_status updates as the Testee progresses; reminder emails fire at scheduled intervals; the pending-engagement dashboard widget surfaces stale assignments; non-engagement after the second reminder escalates to admin.

### 4.5 Testee onboarding and dashboard

Testee receives setup email, sets password, lands on dashboard. Dashboard shows: assigned items (mandatory and optional, with deadlines if any), pending follow-up tests from the adaptive loop, in-progress attempts that can be resumed, and an entry point to the discovery catalogue. Recent results and competency profile snapshot also surface here.

### 4.6 Pill discovery and self-selection

Testee opens the catalogue and browses pills filtered by subject, difficulty range, recently added, or recommended-for-me. Search by keyword supported. Pill detail view shows description, available difficulty range, estimated time, related pills, learning material attached. **For safety-tagged pills, the detail view shows the curated external link set** instead of inviting in-app learning per AC-D21. Testee selects a pill and a difficulty (slider 1–10 within the pill's allowed range) to start a self-directed attempt. Attempt origin is recorded as self-initiated per AC-D3.

**Recommended-for-me ranking** surfaces pills in six tiers:

1. **Active learning loops** — follow-up tests waiting from previously identified weaknesses
2. **Step-up suggestions** — pills the Testee has passed at level X, next attempt suggested at X+1 or X+2 (based on competence_estimate per amended AC-D9)
3. **Related pills** — pills tagged as related to ones the Testee has recently engaged with
4. **Same-Learning-Path adjacent** — other pills in any Learning Path the Testee has at least one in-progress item from
5. **Same-Subject breadth** — pills in subjects the Testee has touched but doesn't appear in higher tiers
6. **Popular across the org** — pills with significant engagement from other staff (social discovery)

Each recommended pill displays a one-line "why this" tag for transparency.

### 4.7 Attempt lifecycle

Testee starts an attempt (assigned or self-initiated). **For per-Testee mode, AI generates content via just-in-time streaming per AC-D25** — question 1 in foreground (~3 seconds), questions 2-N parallel in background; Testee sees Q1 fast and never waits more than briefly thereafter. **For benchmark mode, generation is sequential per amended AC-D25** — each question is generated only after the previous one is graded, since the next difficulty is adaptive on the prior outcome; benchmark is untimed so the brief per-question wait is acceptable. For frozen and hand-authored modes, the question set is loaded and snapshotted to the attempt per AC-D17. **For shared-test modes (frozen and hand-authored), question and option order shuffle per AC-D24 based on the attempt_id seed.** Testee answers questions in order or jumps freely. Every input autosaves. Integrity measures per AC-D4 active throughout (watermark, focus tracking, copy/paste blocked, time-per-question logged, n-gram overlap check at submit per amended AC-D4 #5). For timed tests, clock visible; pause available within allowance per AC-D11 — **pause blanks question content per amended AC-D11**, restoring on resume. Testee submits when complete; timed tests auto-submit on timeout per AC-D11 default.

### 4.8 Grading pipeline

On submit, deterministic question types (MCQ, T/F, matching) auto-grade immediately. Deterministic grades are computed immediately, but the result page display is gated on an "all grading + review complete" flag: a fully-deterministic attempt displays results immediately; a mixed attempt (containing any AI-graded item) withholds the result page until AI grading and cross-family review have completed (AC-D19). The gate is forward-compatible with P6 review completion. Short-answer and scenario types submit to AI grading (Anthropic per AC-D12) with each question's rubric. Each graded response is tagged with one or more pills from the question's metadata. Per-pill, per-difficulty score is computed. **Synchronously after AI grading, every AI-graded response goes through cross-family grade review per amended AC-D19** — an OpenAI call evaluating "is this grade defensible given the rubric?" with the verdict (confirmed or flagged) finalised before the Testee sees their result. Brief "checking your answers..." UI state during the review window; the review runs as a single batched call per attempt with a 60-second hard ceiling, over which the result page renders in preliminary mode and the grade-review reconcile cron (§8.9) picks the row up on its next pass (AC-D19 v1.7 / AC-CD11). **Deterministic n-gram overlap check per amended AC-D4 #5** runs against the Testee's most recently served learning material on the pill, flagging high-overlap responses. Per-Testee competency profile is updated using the new attempt outcomes; **competence_estimate per amended AC-D9 is recomputed** including the new attempt with appropriate decay weighting.

### 4.9 Results, learning material, and the adaptive loop

Testee sees overall score, per-pill breakdown, and AI reasoning for each graded response. Weak pills surface with attached learning material. **For non-safety pills:** AI-generated explainer text plus any admin-uploaded references tagged to those pills. **For safety-tagged pills per AC-D21:** curated external link set (NACE, SANS, manufacturer TDSes) instead of AI explainers — no AI teaching content is generated for safety domains.

In **autonomous mode**: weak-pill identification → learning material delivered automatically (in-app for non-safety, external links for safety) → follow-up test queued targeting those pills → notification to Testee. Difficulty of the follow-up is based on the Testee's current competence_estimate per amended AC-D9; on the third failed loop iteration at the same difficulty, the system suggests stepping down a level. **Follow-up tests are loop-driven and exempt from the per-Testee rate limit per amended AC-D18.**

In **admin-reviewed mode**: weakness report routes to admin first → admin reviews and decides what learning material to push and what follow-up to assign → Testee notified once admin acts.

### 4.10 Competency profile view

Testee can view their own profile at any time: a 2D matrix of pills × difficulty showing band achieved (Novice / Junior / Working / Advanced / Expert), trend over time, and recent activity. **Competence_estimate float per amended AC-D9 is displayed alongside the band label** (e.g. "Working (6.7)"). **Calibration confidence per AC-D20 surfaces against the band stamp** (e.g. "Working (6.7) · n=47, confident" or "Working (5.4) · n=12, preliminary"). Admin can view the same matrix for any Testee plus team-level rollups (sums by role, by Group per AC-D15, by Learning Path, by pill).

### 4.11 Admin grade override and loop oversight

Admin can review any AI-graded response and override the grade (per AC-D2). Override is logged with admin's name, timestamp, and optional reason. Admin can also reverse autonomous-loop decisions retrospectively — e.g. retroactively decide a passed attempt didn't really pass, triggering a re-do. Flagged grades from the AI review queue per amended AC-D19 surface here for resolution.

### 4.12 Benchmark assessment

Triggered by admin assignment, Testee self-selection, or system suggestion when a competency profile gap is detected. AI generates questions adaptively and sequentially per amended AC-D25 — start at midpoint difficulty, step up on pass and down on fail until convergence per pill; each question is generated only after the previous one is graded, since the next difficulty depends on the prior outcome (benchmark is carved out of AC-D25 parallel streaming). Result is a stamped difficulty level per in-scope pill on the Testee's competency profile, which then serves as the starting point for the adaptive learning loop. Untimed by default; same integrity measures as regular attempts.

### 4.13 Assignment engagement tracking

Per AC-D26, mandatory assignments are tracked through derived `engagement_status` states (pending / in_progress / complete / overdue). The system fires reminder emails on a configurable schedule (default: 7 days and 1 day before deadline for assignments with deadlines; 14 days and 30 days after assignment for those without). If a mandatory assignment remains `pending` after the second reminder, the assigning admin receives a single escalation notification. The admin dashboard surfaces a pending-engagement widget listing mandatory assignments stale past the configured threshold (default 7 days). Optional assignments do not trigger reminders or escalations. Each tracked dimension is per (assignment, Testee): an assignment that fans out to a Group or multiple Testees has an independent derived `engagement_status` per assignee. Reminders cease per-Testee on that Testee's first attempt against the assignment; reminder send history is stored per assignment (the per-Testee cease is derived from that Testee's attempts, not a per-assignee reminder row).

### 4.14 Testee question feedback

Per AC-D22, every question presented to a Testee carries an unobtrusive "this question feels unrealistic or off" button. Clicks flag the question for downstream generation tuning. Feedback weight scales with the Testee's overall attempt accuracy so failers cannot dominate the signal.

---

## 5. Data model

The application's domain consists of the entities below. Each is described conceptually — implementation schemas are produced by Claude Code from this model.

**Tenant** — Represents a deploying organisation. v1 ships single-tenant (KBC); the entity exists in the model from day one to make eventual multi-tenancy a routing change rather than a migration.

**User** — A person with access to Acumen. Carries email, hashed password, name, role (Administrator or Testee), `status` (active or deactivated per AC-D16), and tenant. Role determines access scope per AC-D2.

**Group** — A named collection of users for bulk assignment and team-level reporting per AC-D15. Carries name, description, members (many-to-many with User), creator, and timestamps. Three system-defined groups (All Users, All Testees, All Administrators) are immutable.

**Subject** — A top-level catalogue category (Paint QA, Quantity Surveying, Marine Coatings, NACE Prep, etc.). Admin-defined per AC-D7. Mostly organisational — pills live within subjects.

**Pill** — A content unit within a Subject. The unit against which questions, learning material, assignments, and competency are tagged. Carries description, available difficulty range (min and max integer per AC-D9), discoverable flag, related-pill references, parent Subject, optional retired flag, **`safety_relevant` boolean (auto-tagged per AC-D21)**, **`safety_links` collection (cached external URLs with title, source, last-verified timestamp, content hash) for safety-tagged pills**, and **anchor question pools per supported band (frozen question collections generated at pill creation per AC-D20)**. Created by admin or AI per AC-D7; AI-proposed pills enter via review queue.

**Learning Path** — Named collection of pills grouped by admin for repeatable curriculum bundling (e.g. "Junior QA Tech Path"). Personal paths created by Testees are stored similarly but flagged private to the Testee per AC-D8.

**Assignment** — An admin's instruction for a specific Testee, Group, or set of Testees per AC-D15 to engage a pill or learning path at a specific difficulty. Carries assigner, pill or path reference, difficulty integer, optional deadline, mandatory flag, loop mode (autonomous or admin-reviewed) per AC-D6, and **reminder send history per AC-D26 (stored per assignment)**. Assignees (individual Testees and/or Groups per AC-D15) are **snapshotted at assignment creation into the `assignment_assignee` join table** so later Group-membership changes do not rewrite assignment history. `engagement_status` is **derived per (assignment, assignee)** from that Testee's attempt history (pending / in_progress / complete / overdue per AC-D26).

**Test** — A generation spec, frozen question set, hand-authored question set, or benchmark spec. Carries mode (per-Testee spec / frozen / hand-authored / benchmark), timed flag, duration if timed, pause allowance, timeout behaviour, **`max_pause_duration_minutes` per amended AC-D11**, pass threshold, pills covered, and target difficulty per AC-D5, AC-D11, AC-D13. For frozen and hand-authored modes per AC-D24: `lock_mode` (open / campaign-locked), optional `campaign_id`, `randomise_question_order` (default true), `randomise_option_order` (default true). Per-Testee tests have no questions stored against them — questions are generated against each attempt via just-in-time streaming per AC-D25. Frozen and hand-authored tests have their question set stored directly. Benchmark tests carry scope (subject / pill / path) and target Testee for sequential adaptive generation per amended AC-D25 (not JIT-streamed).

**Question** — A single test item. Carries type (multiple choice, true/false, matching, short answer, scenario), type-specific config (options and correct answer for deterministic types; model answer and rubric for AI-graded types), pill tag(s), difficulty integer, **optional `question_group_id` per AC-D24** for case-study clustering, **`realism_flag_count` and `realism_flags` collection per AC-D22** for Testee feedback aggregation, and **(for anchor questions per AC-D20) running statistics: total attempts, pass rate, partial-credit distribution, effective_difficulty estimate**. A Question carries exactly one of three nullable owners — `attempt` (per-Testee mode), `test` (frozen / hand-authored mode), or `pill` (anchor-pool question per AC-D20); exactly one is set per row. The per-pill anchor pool is additionally projected into a dedicated `anchor_question` table for calibration (AC-D27); see CODE_SPEC §4.

**Attempt** — A Testee's run at a test. Carries origin (self-initiated / assignment-driven / **loop-driven per amended AC-D18**), **`sequence_number` scoped per Testee per Test (retake counter, AC-D3)**, timing state (started_at, submitted_at, time_remaining for timed tests), parent attempt id if in an adaptive loop chain, overall score, outcome, **`shuffle_seed` derived from attempt_id for shared-test presentation shuffle per AC-D24**, and **anchor draw record (which anchor questions were drawn into this attempt's mix per AC-D20)**. Carries **`assignment_id`: nullable FK to Assignment, set at start_attempt when origin is assignment-driven or loop-driven, sourced from the assignment that initiated this attempt, and null for self-initiated origin, per AC-D26**. For attempts against frozen or hand-authored tests, also carries a snapshot of the question set as it stood at attempt start per AC-D17. Has a sub-collection of pause events (timestamps, durations, and any auto-resume from max-duration expiry per amended AC-D11) and focus events (tab switches) per AC-D4.

**Response** — A Testee's answer to a specific question within an attempt. Carries answer payload (type-specific), time-on-question, and link to its grade.

**Grade** — The assessment of a response. Carries score, verdict (full / partial / none), source (auto / AI / admin override), AI reasoning for AI grades, **served-material-overlap flag with overlap percentage per amended AC-D4 #5**, override metadata (admin id and timestamp) if overridden, and model-and-tokens-used metadata for cost tracking. The grade↔grade_review pair carries both costs: `grade` carries the Anthropic AI-grading provenance; the paired `grade_review` row carries the OpenAI review provenance (per amended AC-D19). Review status (pending / confirmed / flagged) and reviewer reasoning live on `grade_review`, not on `grade`; a `grade_review` row exists only for AI-graded responses (short_answer, scenario) — deterministic grades (MCQ / true-false / matching) have no `grade_review` row.

**Weakness Report** — Generated after each attempt is fully graded. Lists weak pills with severity scores derived from response grades and their pill tags. Triggers learning material delivery and follow-up generation per AC-D6. May be acted on autonomously or routed to admin. **For safety-tagged pills, routes to external link delivery rather than AI explainer generation per AC-D21.**

**Learning Material** — Explainer content or reference. Three sources: **AI-generated text** (created in response to a specific weakness; not produced for safety-tagged pills), **admin-uploaded reference** (PDF, link, embedded video), and **curated external links** for safety-tagged pills (fetched and maintained automatically per AC-D21). Tagged to pills. AI-generated material is linked to the weakness instance that triggered it so the Testee can see why it was served.

**Competency Profile** — Per Testee, a two-dimensional view of pills × difficulty bands showing latest score, retake count, trend, and last activity per cell. **Includes `competence_estimate` (float, 1.0–10.0) per pill, computed via recency-weighted average against question effective-difficulty per amended AC-D9.** Derived from attempts and grades; may be materialised for performance.

**Drive Index** — Per AC-D22, a vector index of documents present in the designated Drive folder. Each indexed chunk carries source document reference, chunk text, embedding vector, and last-indexed timestamp. Postgres pgvector at v1 scale; no external vector database needed.

**System Settings** — Per-tenant configuration. Carries monthly AI budget (nullable), alert thresholds, per-Testee rate limits (self-initiated only per amended AC-D18), model selection per operation per AC-D12, **`review_provider` (default OpenAI) per amended AC-D19**, **`pending_assignment_age_threshold_days` (default 7), reminder schedules, and `escalation_enabled` flag per AC-D26**, **`competence_decay_halflife_days` (default 90) and `competence_sensitivity` (default 2.0) per amended AC-D9**, **`max_pause_duration_minutes` (default 30) per amended AC-D11**, **safety keyword list per AC-D21**, **anchor pool size per band (default 20), calibration confidence threshold (default n=20), and `anchor_calibration_prior_weight` (default 20) per AC-D20/AC-D27**, **Drive folder identifier and embedding model (default OpenAI `text-embedding-3-small`) per amended AC-D22**.

**Audit Log** — Cross-cutting record of significant state transitions: grade overrides, autonomous loop decisions reversed, pill proposals approved or rejected, pill retirements, user role changes, deactivations, manual deletions, campaign lock/unlock events per AC-D24, escalation notifications per AC-D26, bootstrap runs per AC-D23, safety-pill link drift detections per AC-D21. Lightweight in v1 — captures actor, action, target entity, and timestamp. Important for the SiteMesh port where audit becomes a platform concern.

---

## 6. AI operations

Acumen runs **seven distinct AI operations** across two providers. Anthropic handles primary operations (generation, grading, weakness identification, learning material, pill proposal). OpenAI handles cross-family operations (grade review per amended AC-D19, anchor self-review per AC-D23). Each is a separate version-controlled prompt with its own input contract, output contract, and quality expectations. All AI calls are server-side; no API key is exposed to the Testee or Administrator browser.

### 6.1 Test generation

Generates a question set against a Test spec. **Streaming generation per AC-D25** for per-Testee mode — question 1 synchronously at attempt start, 2-N in parallel as background streams. **Benchmark mode generates sequentially per amended AC-D25** — one question at a time, each generated only after the previous is graded, because benchmark difficulty is adaptive on the prior outcome and cannot be pre-generated in parallel.

**Inputs:** subject, target pills, difficulty integer (1–10) with band name, question count, question-type mix, optionally the Testee's prior weakness profile for adaptive targeting, **anchor questions from the pool as in-context calibration exemplars per AC-D20**, **retrieved Drive RAG chunks per AC-D22**, **negative examples from low-realism question pool per AC-D22**, optionally seed admin-uploaded reference material.

**Outputs:** structured question set — each question carries type, prompt text, type-specific config (options + correct key for MCQ; rubric + model answer for short answer; etc.), pill tag, difficulty stamp.

**Quality bar:** questions must be answerable from the pill's domain, calibrated to the difficulty band (cross-referenced against anchor exemplars), grounded in Drive RAG content where relevant, free of trivia or trick framing, and varied across runs (so two Testees on the same spec receive genuinely different questions, not just rephrasings).

### 6.2 Grading

Grades a single response against the question's rubric. **Followed synchronously by Grade Review per §6.6 before the Testee sees the result per amended AC-D19.**

**Inputs:** question text, question's rubric, model answer, candidate's response.

**Outputs:** verdict (full / partial / none), numeric score within question's max points, reasoning sentence.

**Quality bar:** consistency across runs more important than absolute accuracy on borderline cases — same response should grade the same way each time it's processed.

*Note:* AI-typical-phrasing detection removed from the grading prompt per amended AC-D4 #5. Integrity flagging via deterministic n-gram overlap runs alongside grading but is not part of the grading prompt itself.

### 6.3 Weakness identification

After an attempt is fully graded and reviewed, identifies which pills the Testee struggled with and at what severity. **Updates Testee's `competence_estimate` per pill per amended AC-D9.**

**Inputs:** all responses, grades, and review verdicts for the attempt, plus each question's pill tag(s) and effective difficulty per AC-D20.

**Outputs:** weakness report — ranked list of pills with severity scores (e.g. "Reference Panels: severe — failed 3 of 4 questions; Batch Tracking: moderate — partial on 2 of 3").

**Quality bar:** report should distinguish topic-level gaps from carelessness on specific questions, and surface the actual pill the Testee got wrong rather than just the parent Subject.

### 6.4 Learning material generation

Generates targeted explainer content for a weak pill. **Skipped entirely for safety-tagged pills per AC-D21 — these pills serve curated external links instead.**

**Inputs:** pill identifier, the weakness severity, optionally the specific questions the Testee got wrong (so the explainer addresses the actual confusion), **retrieved Drive RAG chunks per AC-D22**, optionally admin-uploaded reference material for the pill.

**Outputs:** structured explainer — a 200–400-word teaching text with one or two worked examples, formatted for in-app display, optionally cross-referencing admin reference material if available.

**Quality bar:** address the actual gap, not the topic in general; written in plain English suitable for a working construction tradesperson, not academic prose.

### 6.5 Pill proposal

Analyses recent test generation and Testee behaviour to surface coverage gaps in the catalogue.

**Inputs:** recent generated questions and their pill tags, recent Testee discovery searches that returned no good match, recent assignments where admin manually clarified scope.

**Outputs:** proposed new pills with rationale — name, parent subject, suggested difficulty range, evidence count, brief description, **self-applied safety classification per AC-D21**.

**Quality bar:** proposals must be evidence-backed (must cite the specific gap signal); admin should be able to evaluate the proposal in 30 seconds.

### 6.6 Grade review (cross-family, synchronous)

Reviews each AI-graded response (short-answer and scenario types only) by independent AI call **on a different provider from the primary grader per amended AC-D19** — Anthropic-graded responses are reviewed by OpenAI by default. Runs **synchronously** before the Testee sees the result — **batched per attempt** (one call per submit reviewing every AI-graded response together) with a **60-second hard ceiling**; over the ceiling the path **fails soft** (`grade_review` rows stay `pending`, preliminary result renders, the §8.9 grade-review reconcile cron reconciles on its next pass) per AC-D19 v1.7 / AC-CD11.

**Inputs:** question, candidate response, rubric, AI's grade and reasoning.

**Outputs:** verdict (confirmed / flagged), reasoning if flagged.

**Quality bar:** the reviewer must be willing to flag genuine errors and willing to confirm legitimate grades — neither rubber-stamping nor over-flagging. The reviewer prompt asks "is this grade defensible given the rubric?" rather than "what grade would you give?" — different inductive task to produce orthogonal signal rather than recreating same-family homophily.

### 6.7 Anchor self-review

Per AC-D23, evaluates each generated anchor question during bootstrap before it enters the anchor pool. **Cross-family per AC-D19 pattern** — when anchors are generated on Anthropic, self-review runs on OpenAI.

**Inputs:** generated question (text, type, options/rubric, difficulty stamp, pill metadata).

**Outputs:** verdict (accept / reject), reasoning if reject.

**Quality bar:** evaluates pill-fit, difficulty calibration, rubric clarity, freedom from ambiguity, factual reasonableness. Rejected anchors regenerate; questions failing three regeneration attempts are excluded from the pool with admin-attention flag.

### Prompt management

All seven prompts live in version control alongside the application code. Each prompt has a version identifier; the version used for any AI call is recorded against the resulting entity for traceability. Prompt changes are reviewed like code changes. v1 does not expose prompt editing to admins.

### Cost tracking

Every AI call records provider, model used, input tokens, output tokens, and cost estimate. Costs aggregate to attempts, to learning material items, to grade review activity, to bootstrap runs, and to the system overall (admin dashboard sees rolling monthly AI spend per amended AC-D18). The dashboard breaks costs down by operation and by provider (Anthropic vs OpenAI), supporting v1.x decisions on model selection per operation.

### Error handling and retries

AI calls have retry-with-backoff for transient failures (rate limits, network errors). Persistent failures (malformed response, content filter triggers, provider outage) log the error and surface to the actor:

- For grading: response remains ungraded with an "AI grading failed" status; admin sees the queue and can either retry or grade manually.
- For grade review per amended AC-D19: if review provider is unreachable at submit, grade displays as preliminary with "review pending" label; system retries on next cron pass.
- For generation per AC-D25: if first-question generation fails, attempt cannot start; Testee sees "test temporarily unavailable, please try again shortly." If the per-Testee streaming buffer empties, the attempt is paused with retry/abandon options. For benchmark mode (sequential per amended AC-D25), a mid-test generation failure pauses the attempt at the current question with retry/abandon; already-graded questions are retained.
- For weakness, learning material, pill proposal, anchor self-review: silently retried; no Testee-facing impact.
- For Drive RAG fetch failures per AC-D22: generation continues without RAG context; logged for review.
- For safety link verification per AC-D21: broken links surface in admin attention queue; the loop continues to serve any working links and falls back to "ask your administrator" if all links are dead.

---

## 7. Integrations

Acumen v1 standalone runs against five external services. Each is a thin, replaceable integration point.

### 7.1 Anthropic API

The primary AI provider for five of seven operations per §6 (generation, grading, weakness identification, learning material, pill proposal). Authentication via API key held in server-side environment configuration; key is never sent to the browser. Calls use the `/v1/messages` endpoint with the appropriate model per AC-D12 and recorded cost metadata. The integration handles retry-with-backoff for transient errors and surfaces persistent failures per §6 error handling. The API version pin and the model identifiers are configuration values, not hard-coded — when Anthropic releases new model versions, configuration is updated without code change.

### 7.2 OpenAI API

Per amended AC-D19, the secondary AI provider for the two cross-family operations: grade review (§6.6) and anchor self-review (§6.7). Authentication via separate API key held in server-side environment configuration. Calls use OpenAI's chat completions endpoint with the configured model and recorded cost metadata. Cross-family review failure handling per §6 above — fail-soft for grade review (preliminary display with retry on cron), fail-recoverable for anchor self-review (bootstrap can be re-run).

### 7.3 Google Drive API

Per AC-D22, read-only access to a designated Drive folder for passive RAG ingestion. Service account credentials and folder identifier held in environment configuration. Daily ingest cron computes file diffs against the existing index and re-embeds changed or new documents. Deleted Drive files drop from the index. Embedding model is a configuration value (default OpenAI `text-embedding-3-small`, 1536 dimensions, per amended AC-D22; Anthropic exposes no embeddings API, and OpenAI is already in the stack for AC-D19 cross-family review so no new provider integration is added). Embedding cost is tracked against the OpenAI provider in the cost dashboard per amended AC-D18. Chunking strategy is configuration (default ~500-token chunks). Index lives in Postgres pgvector — no external vector database in v1.

### 7.4 Web search

Per AC-D21, used for two purposes: (a) initial curation of external link sets for safety-tagged pills at pill creation, (b) monthly autonomous link-check cron that re-validates cached URLs and finds replacements for broken or substantially drifted links. Integration uses a web search API (configuration value — operator chooses provider).

### 7.5 Transactional email (SMTP)

Used for: user setup invitations, password reset links, assignment notifications, follow-up-ready notifications, **assignment engagement reminders and admin escalation notifications per AC-D26**, deadline reminders, budget alerts per amended AC-D18, and admin notifications of weakness reports or grade-review flags requiring action. SMTP credentials and sender identity held in environment configuration. v1 ships with generic SMTP support; KBC's deployment uses whichever provider Jay configures. Templates are plain text with optional HTML. Email failures are logged but non-blocking — the underlying action still completes, and the Testee will see triggers in their dashboard regardless.

### 7.6 File storage

Used for admin-uploaded learning material (PDFs and reference documents per AC-D6) and any image-based question media that emerges in v1.x. v1 ships with local filesystem storage inside the Docker volume; the storage layer is abstracted so an S3-compatible backend can be swapped in without code change. File metadata (uploaded_by, mime type, size, pill tags) lives in the database; binary content lives in the storage backend. Video uploads are out of scope per §3.

### What v1 does NOT integrate with

No Slack, Teams, calendar, HR system, LMS, identity provider, payment gateway, analytics platform, or external monitoring service. These are all out of scope per §3 and either remain out of scope or get integrated through SiteMesh's relevant infrastructure modules during the port (Comms for messaging, Auth Hub for identity, Media for file storage, Knowledge Library for content sourcing, etc.).

---

## 8. Deployment

### 8.1 Topology

Acumen standalone runs as a Docker compose stack on a single host. Three core services: the application container (backend and frontend with embedded pgvector access), a Postgres database container with pgvector extension, and a reverse proxy with TLS termination. File storage is local to the application container in v1, with the storage interface designed for swap to an S3-compatible backend without code change per §7.6.

### 8.2 Hosting and data residency

Deployment is on Hostinger VPS infrastructure in the European Union (Netherlands). EU hosting is permitted under POPIA section 72 (cross-border transfer to a jurisdiction with adequate data protection). Per amended §8.7, the in-app privacy notice has been simplified for internal-staff context.

### 8.3 Configuration

All deployment-specific values held in environment variables: **Anthropic API key, OpenAI API key**, Google Drive service account credentials and folder identifier, web search API credentials, SMTP credentials and sender identity, database connection string, application secret keys, public URL / domain, file storage path or S3 credentials. No secrets in code, no secrets in the database. Loaded at container startup.

### 8.4 Initial deployment

Four operator actions on first run:

1. Run the database migration — creates the schema (including pgvector extension and tables for anchor pools, Drive index, realism feedback) and seeds system defaults (AI prompts at v1.1 versions for all seven operations, default model and provider selections, default difficulty band definitions per AC-D9, default safety keyword list per AC-D21, default reminder schedules per AC-D26, default decay half-life per amended AC-D9).
2. Create the initial Administrator user via a one-shot command (which sends the setup email).
3. Administrator logs in and seeds the initial pill catalogue (Subjects and Pills for KBC) — typically a half-day exercise with Jay and Gys per AC-D7.
4. **Initiate the autonomous bootstrap run per AC-D23** — generates anchor pools per band per pill with cross-family self-review, fetches curated external link sets for safety-tagged pills, and embeds the initial Drive folder contents. Operator initiates with a single command and the run proceeds in background. Completion notification surfaces in the admin dashboard. One-time cost ~$50–60 per amended AC-D18.

Acumen is operational after these four steps. Testees can be added and assignments can begin.

### 8.5 Backup and durability

All application data is retained indefinitely in v1 per AC-D14 — no automatic expiry, archival, or deletion. Postgres remains the primary backup target for disaster recovery purposes only. Daily database dumps retained for at least 30 days on the host, plus an optional weekly off-site copy. **Drive RAG index is regenerable from the Drive folder contents and need not be backed up; anchor pools are regenerable via re-bootstrap but backing them up preserves their accumulated performance statistics.** Backups are a recovery mechanism, not a data lifecycle policy.

### 8.6 Updates and rollback

New application versions ship as tagged Docker images. Update flow: pull new image, run pending migrations, restart the application container. Database preserved across restarts via Docker volume. Rollback is supported by reverting to a prior tag, with backward-compatible migrations as a discipline (rare exceptions only, documented per release).

### 8.7 Privacy notice (simplified per amended §8.7)

First-time login presents a brief privacy notice with four points appropriate for an internal-staff training context:

1. Your name, email, and assessment activity are stored in this system for your professional development.
2. Your administrator can review your results.
3. Data is retained for the duration of your employment.
4. You can request a copy of your data from your administrator at any time.

Notice acknowledgement is recorded against the user record with timestamp. The EU-hosting and AI-processor disclosures remain technically accurate and may be referenced in employment data-protection documentation maintained outside the application; they are no longer part of the in-app consent moment for internal staff who have already accepted standard employment data processing.

### 8.8 Operational responsibilities

The operator is responsible for monitoring application logs, running backups, applying updates, rotating SMTP credentials and the Anthropic and OpenAI API keys as needed, periodically reviewing AI cost reports, and dropping reference documents into the designated Drive folder for passive RAG ingestion. Acumen ships with sane logging defaults but no built-in external monitoring service in v1 — log review is the standard operational practice. External monitoring integration is out of scope.

### 8.9 Autonomous crons and background processes

Acumen runs several scheduled background processes, all initiated and maintained without operator intervention after deployment:

- **Daily Drive RAG ingest** per AC-D22 — fetches and embeds changed or new documents in the designated folder.
- **Monthly safety-pill link verification** per AC-D21 — checks cached external links for safety-tagged pills, re-fetches replacements for broken ones, flags substantial content drift for admin attention.
- **Nightly Testee feedback aggregation** per AC-D22 — computes the low-realism question pool used to weight subsequent generation.
- **Continuous anchor calibration recomputation** per AC-D20 — updates effective_difficulty estimates for anchor questions as new attempts accumulate.
- **Continuous competence_estimate recomputation** per amended AC-D9 — updates competence floats for affected Testees after each new attempt outcome.
- **Continuous engagement reminder dispatch** per AC-D26 — checks for assignments due for reminder dispatch on the configured schedule.
- **Continuous grade-review reconcile** per amended AC-D19 — retries `grade_review` rows still `pending` (review provider was unreachable or over-ceiling at submit) against the configured review provider; on success updates the row in place to `confirmed` or `flagged`, leaving it `pending` on continued failure. Runs every N minutes (default 5; a P6 behavioural default, not yet a `system_settings` column). After max-retry consecutive failures (default 10; AC-D19 v1.6) a `pending` row auto-promotes to `flagged` with reason `auto_flagged_stuck_pending` — at the 5-min × 10 defaults this is a ≈50-minute wall-clock window before auto-flag (AC-CD11 v1.7).

---

## 9. Future SiteMesh integration notes

This section captures architectural intent for when Acumen converts from a standalone application to a SiteMesh peer module. It is not a v1 commitment — these notes preserve the deferred thinking so the conversion is informed by what was deliberately set aside, not whatever was forgotten.

### 9.1 MeshCore posture at port time

Acumen will become a peer Workflow module with substrate role, exposing three faces per CH-D2 pattern:

- **Inbound events** — user lifecycle from Auth Hub (new user added, role change, deactivation), Knowledge Library content events, time-driven events, and validation requests from peer workflow modules.
- **Outbound events** — assessment lifecycle, attempt lifecycle, outcome events (certification awarded, renewed, expired, competency gap identified, weakness report produced), re-assessment requests routed to Comms, **assignment engagement events per AC-D26**.
- **Substrate (read) face** — competency lookup (using `competence_estimate` per amended AC-D9), full competency profile, team competency rollups, historical (point-in-time) queries.

### 9.2 Authentication and identity

Auth Hub replaces AC-D10's email/password mechanism entirely. Acumen's User entity becomes a thin reference holding `user_id` from Auth Hub; password storage, SSO, 2FA, and reset flows move out. Administrator and Testee roles per AC-D2 align to the platform's five user types per CH-D15.

### 9.3 Knowledge Library integration

KL becomes the primary content source for Acumen, replacing the Drive folder RAG mechanism per AC-D22 as the standalone-era moat substitute. AI test generation can seed from KL documents directly; AI grading rubrics can cite KL source documents; learning material can pull from KL rather than only AI-generated explainers. The fact pack built passively via AC-D22 during standalone phase becomes the seed for KL-era richer integration.

### 9.4 Media module integration

Media replaces Acumen's local file storage per TF-D24. Admin-uploaded reference material becomes Media asset references. Image-based questions reference Media assets. The media compliance pattern already established applies — Acumen stores `asset_id`, never raw object keys.

### 9.5 Comms module integration

Comms replaces all SMTP usage per TF-D28. Acumen publishes notification-worthy events (assignment created, follow-up ready, deadline approaching, **engagement reminders and escalations per AC-D26**, weakness report awaiting admin review, budget alert thresholds crossed); Comms decides channel (email, SMS, push, in-app), formatting, and delivery. Acumen no longer holds SMTP credentials.

### 9.6 Document Renderer integration

Per TF-D64, Doc Renderer handles formatted document output and e-signatures. Acumen uses Doc Renderer for: certificate generation when a Testee achieves a competency milestone, formal training-record export, signed acknowledgements where required.

### 9.7 AI surfaces: module-bundled and Mesh Intelligence add-on

Per TF-D82, two AI surfaces coexist post-port — both real, neither replacing the other.

**Module-bundled AI (lives inside Acumen).** Acumen's **seven AI operations** — test generation, grading, weakness identification, learning material generation, pill proposal, grade review, anchor self-review — continue to run as direct provider API calls owned and executed by Acumen, exactly as in the standalone phase. The cross-family pattern (Anthropic primary, OpenAI review) per amended AC-D19 carries forward. Per CH-D36, Acumen owns its module-specific state and rules; the AI logic is core to what Acumen does and does not get moved to a shared platform layer at port time.

**Mesh Intelligence add-on (lives alongside Acumen).** MI is a separate co-resident capability that reads Acumen's substrate face for higher-level orchestration. MI handles things Acumen doesn't: natural-language queries spanning modules, cross-module triggers, and personal platform-wide AI assistants. MI does not execute Acumen's internal AI work.

Per TF-D83, MI dependency disclosure applies to MI as the integrating module, not to Acumen's bundled AI — Acumen functions identically whether MI is deployed or not.

### 9.8 Cross-workstream visibility

Per CH-D37, competency profile data (including the `competence_estimate` float per amended AC-D9) is queryable by peer modules with source attribution. Likely consumers: FieldOps (task assignment based on certification status), TenderFlow (staffing claims and competency declarations in tenders), Insights (capability dashboards). When peer modules are absent (graceful degradation per CH-D34), Acumen does not display placeholder data.

### 9.9 Tenancy and workstream scoping

Multi-tenant becomes operational, with each organisation seeing only its own catalogue, users, and competency data. Workstream-scoped sharing per D51 enables cross-organisation collaboration. Pill catalogues may become templatable across organisations.

### 9.10 Bitemporality for competency data

Per CH-D3 pattern, the competency profile may require bitemporal queryability — effective date plus recorded date — for legal and audit use cases. v1 stores latest-only; the port-time decision is whether competency outcomes are time-significant enough to warrant the full bitemporal pattern.

### 9.11 Privacy notice posture change at port time

The simplified privacy notice per amended §8.7 is a single-tenant-internal-staff posture. At multi-tenant port time, the full notice (EU hosting disclosure, AI processor relationships, data subject rights) is reintroduced because per-tenant users no longer have an existing employment relationship with the deploying organisation.

### 9.12 Standalone graceful degradation

Per CH-D34, Acumen continues to function as a standalone-capable module post-port. When peers are absent, capability degrades gracefully:

- Auth Hub absent → not viable (auth is foundational); Acumen would not deploy without Auth Hub in SiteMesh context.
- KL absent → falls back to Drive folder RAG per AC-D22 plus general knowledge.
- Comms absent → notifications fall back to in-app dashboard only (no email/SMS).
- Media absent → no admin-uploaded reference material possible; AI explainers for non-safety pills and external links for safety pills still work.
- Mesh Intelligence absent → Acumen's bundled grading, generation, and review continue to function; MI add-on capabilities (natural-language profile queries) absent.

Acumen at port time may qualify as a Tier 1 standalone product per CH-D34 patterns — the closed-loop learning value is independently meaningful.

---

## 10. Open questions

All open questions surfaced during the v1.0 and v1.1 audit passes have been resolved at v1.1 lock:

- **10.1 Hard-deadline locking** — deferred to v1.x (soft deadlines plus engagement tracking per AC-D26 in v1)
- **10.2 Recommended-for-me ranking** — six-tier heuristic locked, integrated into §4.6
- **10.3 Group concept** — locked as AC-D15
- **10.4 User deactivation** — locked as AC-D16
- **10.5 Frozen test versioning** — locked as AC-D17 (snapshot-at-attempt); campaign lock added in AC-D24
- **10.6 Pill merge** — deferred to v1.x (retirement only in v1)
- **10.7 AI cost controls** — locked as AC-D18 (visibility + alerts + rate limits, worked example and loop exemptions added in v1.1 amendment)
- **10.8 AI grading calibration** — locked as AC-D19 (cross-family synchronous review per v1.1 amendment; latency contract locked at v1.7 — batched per attempt, 60 s ceiling)
- **10.9 Admin prompt customisation** — deferred to v1.x
- **10.10 Terminology consistency** — "Pill" used throughout; "sub-topic" retired from spec
- **10.11 Per-Testee comparability** — resolved via AC-D20 anchor calibration and amended AC-D9 competence estimate
- **10.12 AI hallucination on safety topics** — resolved via AC-D21 (no AI teaching content for safety pills)
- **10.13 Generic-tool moat** — addressed via AC-D22 passive moat mechanisms (full moat awaits KL port)
- **10.14 Cold-start quality** — addressed via AC-D20 calibration confidence, AC-D23 anchor self-review at bootstrap, and AC-D22 Testee feedback
- **10.15 Office-collusion on shared tests** — resolved via AC-D24 presentation shuffle
- **10.16 Generation latency UX** — resolved via AC-D25 just-in-time streaming
- **10.17 Pause-window integrity** — resolved via amended AC-D11 content blanking
- **10.18 Non-engagement signal gap** — resolved via AC-D26 engagement tracking
- **10.19 Difficulty axis dual-job** — resolved via amended AC-D9 competence_estimate float
- **10.20 Integrity flag fairness** — resolved via amended AC-D4 #5 n-gram overlap replacing stylistic detection
- **10.21 Privacy notice scope** — resolved via amended §8.7 simplification for internal-staff context

Items deferred to v1.x are tracked separately. None block v1 build.

---

*End of Acumen specification. Status: v1.6. Paired with `DECISIONS.md` v1.6 (27 decisions; 6 v1.1 + 3 v1.2 + 1 v1.3 + 1 v1.4 + 1 v1.5 + 6 v1.6 amendments plus new AC-D27).*