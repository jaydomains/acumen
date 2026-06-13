# Content pipeline maturity — dual-path generation + audit-driven fixes — workstream plan

**Status: final — approved by planner** — all three sign-offs at content-SHA `cc649a7` (plan-auditor
FINAL-marker review `4491523601` + plan-overseer FINAL-marker review `4491523807`, both content-bound
to `cc649a7`; this planner marker is **content-invariant** — only this Status block changed, the
§0–§10 body is byte-identical to `cc649a7`, so it does **not** re-stale the reviewers' markers, role
files §8). Hardened through the plan-auditor (content: CA-1…CA-18 / CA-2,3,4,6,7,9,11,14 — all
confirmed/resolved) + plan-overseer (governance: OV-1/OV-2/OV-3 — all resolved) loop per
`.claude/roles/*.md`, bound to Acumen by `plans/REQUIRED_READING.md`. **Convergence is not merge
authorization:** this is a **class-(iv) ratification-class** PR (§0.2) — the overseer executes the
squash-merge only after **explicit spec-author ratification affirming R0–R4 + DP-1…DP-11 through the
authenticated channel** (criterion #4, OV-2) + the override window, on the planner's re-trigger.

**Date:** 2026-06-13
**Branch:** `claude/content-pipeline-maturity-plan-zqte3y` (this parent-plan PR).
**Workstream identity:** *content pipeline maturity — dual-path generation + audit-driven fixes.*
**Primary structural input:** `plans/AUDIT_OVERPASS_2026-06-13.md` (the merged overpass audit of
the autonomous content-generation + retroactive-oversight workstream; PRs #107–#128 + amendment
chain #110–#113/#116, audit merged at #129 / `ccd9b7c`).
**Strategic direction:** dual-path generation, ratified with the spec author 2026-06-13 through the
authenticated in-session channel (§1), recorded in the audit doc's "Fix-workstream scope preview."
**Role:** the **planner's** parent-workstream-plan artifact — the high-level shape, verified
current state, the five-phase + conditional-slice breakdown, the surfaced decision points, the
candidate-anchor surface, and the audit-finding traceability ledger. Per-slice concrete build
choices are the future **detail-plan's** job, not this document's (precedent: #105 workstream →
#106 detail; #107 workstream → its detail successors).

---

## 0. What this document is, and the ratification it is built on

This parent plan converges the **high-level shape** of maturing Acumen's content pipeline from the
merged v1.9 *single-path, fully-autonomous* generator into a **dual-path** pipeline — an
**LLM-direct** mode as the primary path for the KBC pilot, and the existing **corpus-grounded**
pipeline matured to spec and retained as infrastructure for future tenants and tenant-specific
content. It is authored **against a strategic direction the spec author has already ratified**
through the authenticated in-session channel (§1), and **against the overpass audit** (the primary
structural input) whose findings drive the fix scope. The planner still **surfaces, does not bake**
(role files §7): where a downstream design point is *not* covered by a ruling, it is surfaced here
as a decision point (§7), never silently decided.

### 0.1 Relationship to the merged v1.9 workstream + the overpass audit

The v1.9 autonomous-content workstream (PRs #107–#128) shipped a single-path, corpus-grounded,
fully-autonomous generation→self-review→auto-publish→retroactive-oversight pipeline (AC-D28–31,
AC-CD25–26, nine crons). The **overpass audit** (`plans/AUDIT_OVERPASS_2026-06-13.md`, an
independent OV-6-mitigation cross-model pass) found the slice-level engineering strong but surfaced
**seam-level** facts that block the workstream's thesis and the pilot:

- **CRITICAL** — the autonomous generation→publish **drain is not wired**; the loop does not close
  (P1-#1).
- **HIGH** — the corpus pipeline silently mis-grounds exactly the pilot's highest-authority sources
  (paywalled/scanned T1 → login-page-as-corpus or empty grounding, P2-#4); contradictory T1 sources
  are both grounded silently (P2-#3); demoted sources stay retrievable (P1-#2); spend is
  structurally uncapped (P2-#2); the compensating oversight surface (FE-10) is not operable
  (P1-#3); the work-queue is not concurrency-safe (P2-#1).
- plus a set of MEDIUM/LOW items (threshold clamp, fail-closed keys, metrics, CASCADE coupling,
  confidence recompute, tenant coupling, SESSION_START staleness, carry-forward ledger).

This plan does **not** re-audit; it **plans against** the audit. Every audit finding is given a
disposition — assigned to a phase, or explicitly deferred post-deploy — in the traceability ledger
(§9), so no finding silently rots.

### 0.2 This PR's merge class, and the two-gates discipline

- **This parent-plan PR's own merge is class (iv) ratification-class.** Although the diff is
  `plans/**`-only and bakes no spec amendment, it **records a ratified strategic pivot** (dual-path
  generation; per-tenant mode configuration; KBC defaults to `llm_direct`) that is a **scope
  decision (iii)** and sets **durable project-level precedent (iv)**. Per role files §8.3 and
  `REQUIRED_READING.md` §7, it therefore does **not** auto-merge on the three-sign-off gate: it
  requires **explicit spec-author ratification through the authenticated channel** before the
  overseer executes. *(This differs from PR #107, whose own merge was Gate-1 NORMAL class; the
  classification here is the spec author's call, surfaced as instructed and held as the safer
  posture — the overseer misclassifying a ratification-class change down is the load-bearing
  failure of the merge-executor role, overseer §8.3.)*
  **That ratification must affirm the §1 R0–R4 recording *itself*** — not merely rule on
  DP-1…DP-11 (§7). Because every role-session writes under the **shared identity**, the planner's §1
  "authenticated in-session origin" citation reads, *to the auditor and overseer*, as a **relay**
  (role files §8.3): the relay principle this section draws for *post-merge downstream sessions*
  (next bullet) applies to the **overseer now**, not only later. R0–R4 are the strategic-pivot
  scope/precedent that *is* the basis of the (iv) classification, so the class-(iv) affirmation
  reaching the overseer through the authenticated channel is what clears **R0–R4** for this merge —
  the planner's "ratified, does not re-surface" (§1) binds the planner's own authoring, **not** the
  overseer's independent merge gate (OV-2).
- **Each downstream amendment/execution PR is ratified/authored separately (Gate 2).** The §1
  direction settles the **architecture + the dual-path posture**; it does **not** pre-author the
  anchor/spec **bodies**. Each new AC-D / AC-CD mint (§8 candidates), each SPEC/DECISIONS/CODE_SPEC
  amendment, and each AC-D/AC-CD body change is **authored by the spec author**
  (`SESSION_START.md` — the implementer does not author the clarification); a **fresh** session
  implements each phase/slice against the corrected text. **Once this plan merges, to any
  downstream session under the shared role-session byline the §1 record reads as a *relay* —
  pending, not actionable** (role files §8.3); each downstream PR re-confirms its governing
  ratification through its own authenticated channel.

### 0.3 Standing design principle — the ratified shift from v1.9

v1.9's standing principle was *"balls to the wall, rein in if it breaks"* — maximum autonomy on a
single corpus-grounded path. The ratified direction (§1) **refines, not reverses** it:

> **Dual-path. LLM-direct primary for the KBC pilot; corpus-grounded matured to spec for future
> tenants and tenant-specific content. Per-tenant mode configuration; the KBC tenant defaults to
> `llm_direct`.**

The two informing insights (ratified, §1):

1. **Modern frontier LLMs trained on construction/engineering content are empirically reliable for
   KBC's competency-testing pilot.** The corpus pipeline's hallucination-control premise was
   *overstated for this scope*. LLM-direct generation — grounded on the model's training rather than
   a retrieved corpus — is the primary path for the pilot.
2. **The corpus pipeline still earns its keep** for tenant-specific content, currency, and
   audit-trail provenance. It stays as infrastructure, **defaulted off for KBC**, available and
   matured-to-spec for future tenants.

Every downstream design call biases toward this dual-path posture: LLM-direct is the pilot default;
corpus maturity (Phase 3) is built for future tenants, not gated on the pilot.

---

## 1. The authenticated ratification record (origin: this session, 2026-06-13)

Ruled by the spec author through the **direct, authenticated in-session channel**
(`REQUIRED_READING.md` §7; role files §8.3 — the in-session human channel is the reference),
**explicit and current**, and recorded in the merged `plans/AUDIT_OVERPASS_2026-06-13.md`
"Fix-workstream scope preview." The planner records these citing **this session** as authenticated
origin (exactly as #107 §1 cited its conversation; PR #106 lesson — a ratification is actionable
when the spec author confirms it in-session, not when a prior chat drafted it).

| # | Decision | Ruling | Class |
|---|---|---|---|
| **R0** | Strategy | **Dual-path generation.** LLM-direct primary for the KBC pilot; corpus-grounded matured to spec for future tenants. | (iii) + (iv) |
| **R1** | Mode posture | **Per-tenant mode configuration**; the **KBC tenant defaults to `llm_direct`**. | (iii) |
| **R2** | Corpus disposition | The corpus-grounded pipeline **stays as infrastructure**, defaulted off for KBC, matured to spec (Phase 3) for future tenants — **not removed**. | (iii) |
| **R3** | Fix scope | The five-phase fix workstream (§4): Phase 1 pilot blockers · Phase 2 LLM-direct mode · Phase 3 corpus maturity · Phase 4 multi-tenant prep · Phase 5 housekeeping. | (iii) |
| **R4** | Deferral | The post-deploy items (§10) are **explicitly deferred, not dropped** — tracked for traceability, out of scope for this workstream. | (iii) |

These are **ratified to the planner** through the in-session channel; the planner does not
re-surface them *as the planner's own basis to author*. But for **this PR's merge gate** they are,
to the auditor and overseer, a recording under the shared role-session identity — a **relay**
(role files §8.3) — so the class-(iv) ratification that clears this PR must **affirm the R0–R4
recording itself** to the overseer through the authenticated channel (§0.2, Loop mechanics; OV-2).
Downstream items the rulings do **not** settle are surfaced in §7 (decision points **DP-1…DP-11**).

---

## 2. Current-state verification (verified against the live tree at `ccd9b7c`)

Per role files §4.2 — claims verified against the repo, not inherited from the audit or the scope.
Spot-checks of the audit's load-bearing findings against the live tree:

- **The drain gap is real (P1-#1, CRITICAL).** `app/worker.py` registers **11** Celery tasks
  (`grade_review.reconcile`, `engagement.sweep`, `calibration.run`, `drive_rag.ingest`,
  `corpus.refresh`, `gap_detection.sweep`, `catalogue_health.check`, `pill_generation.bootstrap`,
  `realism.aggregate`, `safety_links.check`, `cost.budget_sweep`). **None drains the `pending`
  `pill_generation` ProcessingTask rows** that `enqueue_generated_drafts` creates;
  `pill_generation.bootstrap` (`worker.py:264`) drains `pill_bootstrap` tasks, which are only
  created **by** `auto_publish_draft` — so absent the generation drain, both are never created. The
  sole non-test caller of `auto_publish_draft` is `POST /pill-proposals/{id}/approve`
  (the human gate the v1.9 thesis claimed to remove). **Confirmed.**
- **Missing-AI-key is WARN-only outside dev (P2-#10, MEDIUM).** `app/config.py:202` appends a
  *warning* (not an error) when `anthropic_api_key` / `openai_api_key` are unset; the
  `app_env not in DEV_ENVS` block guards the secret key but **not** the AI keys → a prod deploy
  with unset keys silently serves the stub provider. **Confirmed.**
- **The publish gate is a scorer/flagger, not a hold (audit CONFIRMED).** `auto_publish_draft`
  computes `low_confidence = confidence < threshold or ns7_degrade or safety_failed` and calls
  `create_pill()` unconditionally — faithfully implementing AC-D31 "nothing held pre-publish." The
  threshold is read from `SystemSettings.pill_publish_confidence_threshold` (default 0.70) **with
  no clamp** (P1-#9). **Confirmed.**
- **Specs are at v1.9; SESSION_START is stale at v1.8 (P1-#4, HIGH).** `CODE_SPEC.md` carries
  AC-CD25/26 (v1.9); `DECISIONS.md` carries AC-D28–31; `SESSION_START.md` still declares
  "AC-D1–AC-D27 / AC-CD1–AC-CD18", "Open items (none)", "Backend v1 complete, FE the live track."
  **Confirmed stale.**
- **Anchor maxima are AC-D31 / AC-CD26.** Verified by grep of `DECISIONS.md` / `CODE_SPEC.md`. The
  §8 candidate anchors (AC-D32, AC-D33, AC-CD27, AC-CD28) are the **next-available** identifiers and
  are **un-minted** — surfaced as candidates, not pre-minted (§8).
- **The audit's CONFIRMED findings stand** (not re-verified line-by-line here; the audit is the
  primary input): admin authz gated at every endpoint, migrations reversible/additive/transactional,
  §290 audit-log completeness, SSRF/redirect/size guards, idempotent dedup, feedback loops
  self-limiting, all 57 anchors MATCH.

No precondition contradicts the scope; the plan is workable as handed (role files §4.2 / §7e clear).

---

## 3. Target architecture — dual-path generation + the matured oversight half

```
  PER-TENANT MODE CONFIG  (R1: KBC → llm_direct)
        │
        ├──────────────── mode = llm_direct (Phase 2, PILOT PRIMARY) ──────────────┐
        │     generate grounded on the model's training (no corpus retrieval)       │
        │     · LLM-direct provenance shape · confidence = cross-model self-review   │
        │       agreement as primary signal                                          │
        │                                                                            ▼
  GAP DETECTION + ───► generate_grounded_drafts ──(routes by mode)        (C) AUTO-PUBLISH GATE
  catalogue-health         │                                               multi-pass + cross-model
  (D, existing)            ├──────────── mode = corpus_grounded (Phase 3, FUTURE TENANTS) ──┐  self-review +
        │                  │     retrieve corpus (demoted hosts excluded, P1-#2) ·          │  single global
  ┌─────┘                  │     content-validity gate (P2-#4) · contradiction surfacing     │  threshold (clamped,
  │  PHASE 1 — DRAIN  ◄────┘       (P2-#3) · provenance chain · confidence recompute on       │  P1-#9)
  │  closes the loop (P1-#1):       demote (P2-#9)                                            ▼
  │  cron → enqueue → DRAIN → gate → publish → bootstrap-on-publish        ≥ thr → PUBLISH (live)
  │  · FOR UPDATE SKIP LOCKED on task-claim + row-lock on /approve (P2-#1/#5)  < thr → PUBLISH-W-WARNING
  │  · hard budget/volume cap + AI-keys fail-closed (P2-#2/#10)                         │ (flagged)
  │  · end-to-end pipeline tests (P1-#10)                                               ▼
  └────────────────────────────────────────────────────────►  (E) RETROACTIVE OVERSIGHT
                                                                 + metrics/alerting hook (P2-#7)
                                                                 + FE-10 disposition (P1-#3, DP-4)
```

The dual-path split lives **at `generate_grounded_drafts`** (Phase 2 routing); everything from the
auto-publish gate onward (C/E/F) is **shared** across both modes. Phase 1 closes the loop for
*whichever* mode the tenant runs. Phase 3 matures the corpus path for future tenants without gating
the LLM-direct pilot.

---

## 4. The five phases — rationale, slice list, audit traceability

Each phase below lists its rationale, its provisional slices, and the audit findings it discharges
(full ledger in §9). Slice IDs are provisional; the detail-plan makes per-slice concrete build
choices against the live tree. Sequencing and parallelisability are surfaced as **DP-7**.

### 4.1 Phase 1 — Pilot blockers (both modes share)

**Rationale.** These are the audit's deploy/pilot **blockers** and the highest-severity
path-independent fixes. They apply regardless of generation mode — they are what makes *any*
autonomous publish safe and closed-loop. Phase 1 is the launch-critical phase (launch-blocker
disposition surfaced as **DP-8**).

**Wire-vs-enable invariant (CA-2 / CA-4 / OV-1).** P1.1 **wires** the loop closed; it does **not**
by itself **enable** autonomous publish. Enabling autonomous publish is a **conditional** step,
gated on (a) **P1.3** (the hard budget/volume cap + AI-keys fail-closed) landing *first* — so there
is no uncapped window — and (b) the **trigger-model ruling** (autonomous-cron vs gated-`/approve`;
the audit's fix-scope item-1 "decide the trigger model", surfaced at DP-4/DP-8). The intra-Phase-1
ordering is therefore **P1.3 precedes enablement**, regardless of DP-7's "serialise behind P1.1"
authoring lean (which orders *wiring*, not *enablement*).

| Slice | Scope (one line) | Discharges |
|---|---|---|
| **P1.1** | **Drain orchestration** — wire (not yet enable, see invariant above) the cron → `enqueue_generated_drafts` → drain → `auto_publish_draft` → bootstrap-on-publish loop closed for the chosen primary path, with timeout/retry on mid-self-review LLM failure. **The drain *trigger model* (autonomous-cron vs gated-`/approve`) is the audit's item-1 "decide the trigger model" — surfaced at DP-4/DP-8, not baked here** | P1-#1 (CRITICAL); P1-#8 (timeout/retry — audit-bundled, see §9 note) |
| **P1.2** | **Concurrency locks** — `FOR UPDATE SKIP LOCKED` on the task-claim (drain + bootstrap) paths; row-lock on `POST /approve` | P2-#1 (HIGH); P2-#5 (MEDIUM) |
| **P1.3** | **Hard budget/volume cap** — per-sweep batch ceiling and/or monthly budget kill-switch; **AI-keys fail-closed outside dev** (promote the WARN to an error). **Precondition of *enabling* autonomous publish** (wire-vs-enable invariant) | P2-#2 (HIGH); P2-#10 (MEDIUM) |
| **P1.4** | **Threshold clamp** — validate/clamp `pill_publish_confidence_threshold` to `[0,1]` | P1-#9 (MEDIUM) |
| **P1.5** | **End-to-end pipeline tests** — drive cron→enqueue→drain→gate→publish→bootstrap end-to-end (not the direct `auto_publish_draft` call the v1.9 suite exercises) | P1-#10 (MEDIUM) |
| **P1.6** | **Pilot publish-health observability** — publish-rate / flag-rate / confidence-distribution / drain-backlog metrics + **≥1 proactive alert**. **Both-mode pilot concern** (the auto-publish gate is shared across modes, §3), **moved here from Phase 3** (CA-7 / OV cross-lane): the LLM-direct pilot must not launch blind to the audit's Axis-3 "no one is paged at 3am" worry | P2-#7 (MEDIUM, path-independent) |

### 4.2 Phase 2 — LLM-direct mode (the new primary)

**Rationale.** The ratified primary path for the KBC pilot (R0/R1). Generation grounds on the
model's training rather than a retrieved corpus; the existing gate/oversight spine is reused. The
audit's hygiene tail flagged that a refiner-style draft has no `draft_ref`/provenance chain → the
oversight read facets degrade to empty (expected, but to be verified) — Phase 2 owns confirming the
C2 "nothing held" gate + §290 completeness against the LLM-direct provenance shape (P1-#11 tail).

| Slice | Scope (one line) | Discharges / surfaces |
|---|---|---|
| **P2.1** | **Mode setting on `pill_generation`** — `llm_direct \| corpus_grounded`, per-tenant configurable | DP-1; candidate AC-D32 |
| **P2.2** | **Routing in `generate_grounded_drafts`** — dispatch by tenant mode; LLM-direct generation still routes `generate()` **through the `AIProvider` protocol, never a direct SDK call** | DP-1; **AC-CD8** (one `AIProvider` interface — existing) |
| **P2.3** | **LLM-direct prompts** — no corpus retrieval; ground on training; new prompt-registry version(s); model resolution inherits env-default model IDs | **AC-CD8** (prompt-registry); **AC-CD18** (env-default model IDs — existing) |
| **P2.4** | **Provenance shape for LLM-direct mode** — what provenance/audit a non-corpus draft records; verify oversight read-facet degradation (P1-#11 tail) | candidate AC-CD27; DP-2 |
| **P2.5** | **Confidence math adjusted** — cross-model self-review agreement as the primary signal (corpus authority-weighting is absent in this mode). **Must reckon with NS-7 (degrade-not-gate, `DECISIONS.md:776`):** a single-provider KBC pilot generating **safety-relevant** LLM-direct content cannot run cross-model and degrades to publish-with-warning + "single-provider verified" flag on same-model review — so cross-model agreement is the *primary* signal only where a second provider is configured | DP-2; **NS-7** (ratified, existing); AC-D30/31 body touch |
| **P2.6** | **Default mode = `llm_direct` for the KBC tenant** | R1; DP-1 |

### 4.3 Phase 3 — Corpus maturity (for future tenants)

**Rationale.** The corpus path stays as infrastructure (R2), matured to spec for future tenants and
tenant-specific content — **not gated on the pilot**. These are the audit's corpus-path-maturation
findings: the pipeline silently mishandles exactly the highest-authority sources, both grounds
contradictory sources, keeps demoted hosts retrievable, and leaves stale confidence after demotion.

| Slice | Scope (one line) | Discharges |
|---|---|---|
| **P3.1** | **Content-validity gate** on acquisition — reject login/preview pages + zero-text PDF extractions rather than stamping them T1. The **paywalled-source policy** the audit says to *"decide"* is **surfaced at DP-10, not baked** | P2-#4 (HIGH); DP-10 |
| **P3.2** | **Contradiction surfacing** — inter-source disagreement (T1-vs-T1). The **contradiction posture** the audit says to *"decide"* (flag-to-oversight vs other) is **surfaced at DP-11, not baked** | P2-#3 (HIGH); DP-11 |
| **P3.3** | **Retrieval filter excludes demoted hosts** — `retrieve_corpus_for_topic` consults `denied_hosts`, not just acquisition-side `filter_demoted` | P1-#2 (HIGH) |
| **P3.4** | **CASCADE → SET NULL** on `generation_provenance.corpus_chunk_id` so a corpus purge cannot erase published-pill provenance | P2-#8 (MEDIUM) |
| **P3.5** | **Confidence recompute on demote** — refresh frozen `PublishRecord.confidence` + authority breakdown when a source is demoted | P2-#9 (MEDIUM) |

*(The v1.9 §4.3 draft's "P3.6 observability" slice **moved to Phase 1 / P1.6** — publish-health metrics + alert are a both-mode pilot concern, not future-tenant corpus work; CA-7 / OV cross-lane.)*

### 4.4 Phase 4 — Multi-tenant prep

**Rationale.** Per-tenant mode configuration (R1) re-raises the tenant-from-actor seam earlier than
v1.9 expected: every autonomous-workstream function hard-codes `SEED_TENANT_ID`, with no
tenant-from-actor seam and no cross-tenant authz. This phase threads tenancy and adds the guard
before KBC onboards a second tenant. (AC-CD3 keeps RLS a port-seam; this is the application-layer
threading, not RLS.)

| Slice | Scope (one line) | Discharges / surfaces |
|---|---|---|
| **P4.1** | **Tenant threading** — replace `SEED_TENANT_ID` hard-codes with tenant-from-actor through the workstream's domain functions (~8 modules). **Surface (CA-11): is the ~8-module threading consistent with AC-CD5's "auth one-file-swap" intent, or should tenant-from-actor resolution centralize?** The audit's Pass-2 Axis-2 names this AC-CD5 tension explicitly | P2-#6 (MEDIUM); **AC-CD3** (RLS stays seam) + **AC-CD5** (one-file-swap — reconcile) |
| **P4.2** | **Cross-tenant guard tests** — oversight read / rollback / demotion scoped to the actor's tenant | P2-#6 |
| **P4.3** | **Per-tenant mode configuration surface** — the config surface R1 requires (shares the mode setting from P2.1) | DP-1/DP-3; candidate AC-D33 |

### 4.5 Phase 5 — Housekeeping

**Rationale.** The audit's hygiene/awareness findings + the workstream's own doc-debt. Most of
Phase 5 is largely-independent housekeeping — **with one exception: P5.4 (FE-10 disposition) is a
pilot launch-blocker** (it sits on the §5 pilot critical path and in the DP-8 launch set), not
housekeeping. It lives in Phase 5 only because it shares the FE-10 subject; its *gating weight* is
pilot-critical (CA-6).

| Slice | Scope (one line) | Discharges / surfaces |
|---|---|---|
| **P5.1** | **SESSION_START.md refresh** to v1.10 (or v1.9-refinement — DP-5): AC-D28–31, AC-CD25–26, nine crons, the dual-path posture, FE-10 status | P1-#4 (HIGH) |
| **P5.2** | **Carry-forward ledger surface** (`CARRY_FORWARD.md`) — make the deferred-debt ledger discoverable in-repo (OV-6 / "15-sites" / F3 / the §10 deferrals) | P1-#11 (MEDIUM) |
| **P5.3** | **Audit doc path consistency** — reconcile `plans/` vs `audits/` for the audit docs (a path convention call) | governance hygiene |
| **P5.4** | **FE-10 decision** *(Phase-5 exception — pilot launch-blocker, on the §5 critical path)* — thin operable oversight+rollback surface, **or** formalize the gated-pilot posture (autonomy disabled, `/approve` as publish path until FE-10 lands) | P1-#3 (HIGH); DP-4/DP-8 |

---

## 5. Dependency & sequencing (verified, not asserted)

**Verified dependency chain:**

- **Phase 1 is the foundation** — the drain (P1.1) *wires* the loop closed for *whichever* mode
  runs; concurrency, cap, fail-closed keys, observability, and tests gate any safe autonomous
  publish. **Wire-vs-enable (CA-2/CA-4/OV-1):** P1.1 wires but does **not** enable; **enabling**
  autonomous publish is conditional on P1.3 (cap + fail-closed keys) landing first **and** on the
  **trigger-model ruling** (autonomous-cron vs gated-`/approve`; the audit's item-1 "decide the
  trigger model", at DP-4/DP-8). Phase 1 must land — and the cap must precede enablement — before
  autonomous publish is enabled in either mode.
- **Phase 2 (LLM-direct) depends on Phase 1's drain** — the mode routing feeds the same
  drain→gate→publish spine. The LLM-direct *pilot* needs Phase 1 + Phase 2.
- **Phase 3 (corpus maturity) is independent of the pilot** — it matures the corpus path for future
  tenants; it does **not** block the LLM-direct pilot and can run in parallel with / after Phase 2.
- **Phase 4 (multi-tenant) depends on the mode setting (P2.1)** for the per-tenant config surface
  (P4.3), but the tenant-threading (P4.1/P4.2) is independent of Phase 2/3. Phase 4 gates onboarding
  a **second** tenant, not the single-tenant KBC pilot.
- **Phase 5 (housekeeping)** is largely independent; P5.4 (FE-10 disposition) interacts with the
  pilot launch criteria (DP-8).

**Recommended sequencing (surfaced as DP-7 for ratification):** Phase 1 → Phase 2 delivers the
pilot; Phase 3 + Phase 4 + Phase 5 follow / parallelise. The **pilot critical path is
Phase 1 → Phase 2 (+ the P5.4 FE-10 disposition)**; Phases 3 and 4 are future-tenant work that
need not block the pilot launch.

Each phase closes with its own squash PR per `SESSION_START.md` "one PR per phase"; multi-slice
phases inherit the PR-025 auto-continue default unless a phase opener declares binding pauses.

---

## 6. Conditional phase/slice breakdown (the detail-plan refines this)

| Phase | Slice | Scope (one line) | Primary ratification surface |
|---|---|---|---|
| **1** | P1.1 | Drain orchestration (closes the loop) + timeout/retry | execution (no new anchor; rides AC-D31/AC-CD7) |
| 1 | P1.2 | Concurrency locks (FOR UPDATE SKIP LOCKED + /approve row-lock) | execution; possible migration |
| 1 | P1.3 | Hard budget/volume cap + AI-keys fail-closed | new config; possible AC-D18 body touch |
| 1 | P1.4 | Threshold clamp | execution |
| 1 | P1.5 | End-to-end pipeline tests | execution |
| 1 | P1.6 | Pilot publish-health metrics + ≥1 alert (both-mode; moved from P3.6) | new config/hook (no new anchor); possible AC-D18 body touch |
| **2** | P2.1 | Mode setting on `pill_generation` (per-tenant) | candidate **AC-D32** (dual-path modes); DP-1 |
| 2 | P2.2 | Routing in `generate_grounded_drafts` | execution; **AC-CD8** (route via `AIProvider`) |
| 2 | P2.3 | LLM-direct prompts (ground on training) | prompt-registry version; **AC-CD8** / **AC-CD18** (env-default models) |
| 2 | P2.4 | Provenance shape for LLM-direct mode | candidate **AC-CD27** (LLM-direct provenance); DP-2 |
| 2 | P2.5 | Confidence math (cross-model agreement primary) | **NS-7** (degrade-not-gate, existing); AC-D30/31 body touch; DP-2 |
| 2 | P2.6 | Default mode = `llm_direct` for KBC | per-tenant config (R1) |
| **3** | P3.1 | Content-validity gate (reject login pages / empty PDFs) | candidate **AC-CD28** (content-validity gate); AC-CD25 body touch; **DP-10** (paywalled policy) |
| 3 | P3.2 | Contradiction surfacing (T1-vs-T1 → posture) | new AC-D or AC-D30 body touch; **DP-11** (contradiction posture) |
| 3 | P3.3 | Retrieval filter excludes demoted hosts | AC-D28 body touch (retrieval-side) |
| 3 | P3.4 | CASCADE → SET NULL on provenance.corpus_chunk_id | migration; AC-CD26 body touch |
| 3 | P3.5 | Confidence recompute on demote | AC-D30/31 body touch |
| **4** | P4.1 | Tenant threading (replace SEED_TENANT_ID) | AC-CD3 body touch (app-layer; RLS stays seam); **AC-CD5** reconcile (one-file-swap, CA-11) |
| 4 | P4.2 | Cross-tenant guard tests | execution |
| 4 | P4.3 | Per-tenant mode configuration surface | candidate **AC-D33** (per-tenant mode config); DP-1/DP-3 |
| **5** | P5.1 | SESSION_START.md refresh (→ v1.10?) | framework change (iv); DP-5 |
| 5 | P5.2 | Carry-forward ledger (`CARRY_FORWARD.md`) | new doc |
| 5 | P5.3 | Audit doc path consistency (plans/ vs audits/) | path convention |
| 5 | P5.4 | FE-10 decision *(pilot launch-blocker)* (thin surface OR gated-pilot posture) | DP-4/DP-8; fe-spec touch if thin surface |

Provisional; the detail-plan makes the per-slice concrete build choices against the live tree, and
each ratification surface is authored by the spec author (Gate 2, §0.2).

---

## 7. Decision points — SURFACED for spec-author ratification (not baked)

Per planner discipline (role files §7) — **surface, do not bake**. Each carries a default proposal /
lean, but is held "surfaced — awaiting spec-author ruling" until ratified through the authenticated
channel. These are the residual decisions the §1 direction does **not** settle.

- **DP-1 — Mode-selection mechanism.** Per-tenant? per-topic override? hybrid?
  **Lean:** per-tenant config (R1) with an **optional per-topic override**. *Class (i)/(iii)
  (AC-D32/D33).* Surfaced; awaiting ruling.
- **DP-2 — Cross-mode pill comparability.** Log the generation **mode in `PublishRecord`**? Same
  confidence threshold across modes, or mode-specific? **Lean:** log mode in `PublishRecord`;
  **same** global threshold across modes initially (re-evaluate to mode-specific iff dashboard data
  warrants, mirroring v1.9 ruling-1 logic). *Class (i)/(ii).* Surfaced; awaiting ruling.
- **DP-3 — Allowlist scoping for multi-tenant.** Shared base + per-tenant additions? per-tenant
  fully? **Lean:** **shared public base + per-tenant private additions.** *Class (i)/(iii). Note:
  the audit's ZA-construction seed-coupling removal (P2-#11) is deferred (§10); the per-tenant
  scoping surface is the part this DP decides.* Surfaced; awaiting ruling.
- **DP-4 — FE-10 pilot disposition.** Thin operable oversight surface, **or** formalize the gated
  pilot posture (autonomy disabled + `/approve` until FE-10 lands)? **No planner lean** — this is a
  product/pilot-risk call. Interacts with DP-8. *Class (iii).* Surfaced; awaiting ruling.
- **DP-5 — Versioning.** v1.10 bump, or v1.9 refinement? **Lean / recommend v1.10** — the
  one-version-per-cycle rule holds *within* this cycle, and the dual-path pivot is a material
  product shift. *Class (iv) (framework/version).* Surfaced; awaiting ruling.
- **DP-6 — Anchor surface.** Which new AC-D / AC-CD anchors record the dual path? **Candidates
  (surfaced, NOT pre-minted):** **AC-D32** dual-path modes · **AC-D33** per-tenant mode config ·
  **AC-CD27** LLM-direct provenance shape · **AC-CD28** content-validity gate. (Current maxima
  verified AC-D31 / AC-CD26, §2 — these are the next-available identifiers.) *Class (i)/(ii).*
  Surfaced; awaiting ruling. See §8.
- **DP-7 — Slice sequencing within phases.** Which slices parallelise? **Lean:** Phase 1 slices
  mostly serialise behind P1.1 (the drain) except P1.4/P1.5 — **but the wire-vs-enable invariant
  (§4.1) overrides the lean: P1.3 (cap + fail-closed) precedes *enablement* regardless** (CA-4);
  Phase 3 slices are largely independent of each other; Phase 2 P2.1→P2.2→(P2.3‖P2.4‖P2.5)→P2.6.
  *Class (iii).* Surfaced; awaiting ruling.
- **DP-8 — Pilot launch criteria.** Which fixes are launch-**blockers** vs nice-to-have? **Lean:**
  launch-blockers = all of Phase 1 (incl. P1.6 observability + the wire-vs-enable cap/trigger gate)
  + Phase 2 (the pilot path) + the P5.4 FE-10 disposition; Phase 3/4 are future-tenant work, not
  pilot launch-blockers. **Includes the audit's item-1 "decide the trigger model"** (autonomous-cron
  vs gated-`/approve`) and **DP-9** (the #7 cost-idempotency blocker-vs-defer call). *Class (iii).*
  Surfaced; awaiting ruling. Interacts with DP-4.
- **DP-9 — Cost-idempotency (P1-#7): audit-blocker vs ratified-defer (CA-3 / OV-3).** The audit's
  pilot-launch **blocker** condition bundles #7 *into the same sentence* as the drain and timeout/
  retry: *"Wire and test the drain end-to-end (1), with timeout/retry (8) and a cost-idempotency key
  (7)"* (`AUDIT_OVERPASS_2026-06-13.md:192-194`); its severity roll-up separately scores #7 MEDIUM —
  the audit is **internally ambiguous**. The session-opener's deferred set names "AI cost
  idempotency" explicitly (R4), so the planner's §9 disposition is *deferred*; but routing an
  audit-named blocker to post-deploy on the planner's reading of R4 is a **scope re-classification**
  that the surface-not-bake discipline says to make visible, not absorb. **Lean:** deferrable for the
  LLM-direct pilot (the cost-sink is on a *post-LLM DB-commit failure* — a rare path, and the budget
  cap of P1.3 bounds total spend) — **but surfaced, not resolved under R4's cover.** **Ask:** the
  spec author confirms either (a) #7 stays deferred (R4 governs over the audit-blocker bundling), or
  (b) #7 folds into P1.1 as the audit framed it. *Class (iii).* Surfaced; awaiting ruling.
- **DP-10 — Paywalled-source policy (P2-#4; CA-9).** The audit says to *"decide a paywalled-source
  policy"* — a posture call (reject? tier-cap? flag-and-admit?) the content-validity gate (P3.1)
  needs. **No strong planner lean** (future-tenant scope). *Class (i)/(ii).* Surfaced; awaiting
  ruling.
- **DP-11 — Contradiction posture (P2-#3; CA-9).** The audit says to *"decide a contradiction
  posture"* — what happens when two T1 sources disagree (flag-to-oversight? block? prefer-newer?).
  **Lean:** surface inter-source disagreement to the oversight/flag layer (the audit's framing). But
  it is a safety/correctness posture the audit reserves for a decision. *Class (i)/(ii).* Surfaced;
  awaiting ruling.

---

## 8. Candidate anchor surface (surfaced, NOT pre-minted)

Per anchor discipline (`SESSION_START.md`; REQUIRED_READING §4) — anchors are **not minted
mid-session**; a mint is a ratification-class change (§8.3 (i)). These are **candidates surfaced for
ratification** (DP-6), to be authored as bodies by the spec author at the relevant slice (Gate 2):

- **AC-D32 (candidate) — dual-path generation modes** (`llm_direct | corpus_grounded`; the
  generation-mode product decision). Rides Phase 2 (P2.1).
- **AC-D33 (candidate) — per-tenant mode configuration** (the config surface; KBC → `llm_direct`).
  Rides Phase 4 (P4.3) / Phase 2 (P2.6).
- **AC-CD27 (candidate) — LLM-direct provenance shape** (what a non-corpus draft records; how the
  oversight read facets degrade). Rides Phase 2 (P2.4).
- **AC-CD28 (candidate) — content-validity gate** (reject login/preview pages + zero-text PDFs at
  corpus acquisition). Rides Phase 3 (P3.1).

Other slices touch **existing** anchor bodies (AC-D28 retrieval-side, AC-D30/31 confidence,
AC-CD25/26, AC-CD3 tenant-threading) rather than minting — each such body change is itself a
ratification-class amendment authored by the spec author (Gate 2). Whether contradiction-surfacing
(P3.2) and metrics (P3.6) warrant their own mints vs. body touches is folded into DP-6.

---

## 9. Audit-finding → disposition traceability ledger

Every finding in `plans/AUDIT_OVERPASS_2026-06-13.md` (Pass 1 #1–#14, Pass 2 #1–#14) gets a
disposition, so no audit finding silently rots (the v1.9 §1.4/§9 completeness discipline applied to
the audit's finding set). This is the planner's own coverage ledger; the reviewers' `A-*`/`OV-*` IDs
are layered on top.

| Audit finding | Sev | Disposition |
|---|---|---|
| **P1-#1** drain not wired | CRITICAL | **Phase 1 / P1.1** |
| **P1-#2** demoted-source chunks stay retrievable | HIGH | **Phase 3 / P3.3** |
| **P1-#3** FE-10 oversight surface not operable | HIGH | **Phase 5 / P5.4** (+ DP-4/DP-8) |
| **P1-#4** SESSION_START stale at v1.8 | HIGH | **Phase 5 / P5.1** |
| **P1-#5** unbounded scans + N+1 on oversight paths | MEDIUM | **Deferred post-deploy (§10)** |
| **P1-#6** GenerationProvenance/CorpusChunk unbounded growth; IVFFlat at scale | MEDIUM | **Deferred post-deploy (§10)** |
| **P1-#7** AI cost sunk + untracked on commit failure | MEDIUM (audit roll-up); bundled into a blocker condition | **Surfaced as DP-9** (blocker-vs-defer) — planner *lean* deferred per R4, but the re-classification is **surfaced, not absorbed** (CA-3 / OV-3) |
| **P1-#8** LLM timeout mid-review uncaught; no retry | MEDIUM | **Phase 1 / P1.1** (audit-bundled with the drain blocker; planner-folded — see note) |
| **P1-#9** publish threshold unclamped | MEDIUM | **Phase 1 / P1.4** |
| **P1-#10** tests exercise the gate directly, not pipeline closure | MEDIUM | **Phase 1 / P1.5** |
| **P1-#11** carry-forward ledger not discoverable; + the LLM-direct provenance verify tail | MEDIUM | **Phase 5 / P5.2** (ledger) + **Phase 2 / P2.4** (provenance-shape verify) |
| **P1-#12** SSRF guard doesn't resolve DNS (rebinding) | LOW | **Deferred post-deploy (§10)** |
| **P1-#13** no decompression-ratio guard | LOW | **Deferred post-deploy (§10)** |
| **P1-#14** F3 model-name doc wording | LOW | **Deferred post-deploy (§10)** (F3 wording) |
| **P2-#1** no row-locking/constraints on task queue + dedup | HIGH | **Phase 1 / P1.2** |
| **P2-#2** no hard budget/volume cap | HIGH | **Phase 1 / P1.3** |
| **P2-#3** no contradiction detection | HIGH | **Phase 3 / P3.2** |
| **P2-#4** paywalled/scanned T1 → login-page-as-corpus / empty grounding | HIGH | **Phase 3 / P3.1** |
| **P2-#5** `/approve` check-then-act without lock | MEDIUM | **Phase 1 / P1.2** |
| **P2-#6** `SEED_TENANT_ID` hard-coded; cross-tenant leak | MEDIUM | **Phase 4 / P4.1 + P4.2** |
| **P2-#7** no metrics/alerts for publish health | MEDIUM (path-independent) | **Phase 1 / P1.6** (both-mode pilot concern; moved from Phase 3 — CA-7 / OV cross-lane) |
| **P2-#8** provenance→corpus_chunk ON DELETE CASCADE | MEDIUM | **Phase 3 / P3.4** |
| **P2-#9** demotion doesn't recompute frozen confidence | MEDIUM | **Phase 3 / P3.5** |
| **P2-#10** missing AI keys WARN-only outside dev | MEDIUM | **Phase 1 / P1.3** |
| **P2-#11** ZA-construction seed allowlist, additive-only, no per-tenant scoping | MEDIUM | **Split:** seed-coupling removal **deferred (§10)**; per-tenant scoping **surface = DP-3** (Phase 4-adjacent) |
| **P2-#12** free-form rollback inputs | LOW | **Deferred post-deploy (§10)** |
| **P2-#13** code/schema rollback ordering | LOW | **Deferred post-deploy (§10)** |
| **P2-#14** English-centric embeddings / content-type trust | LOW | **Deferred post-deploy (§10)** |
| audit **CONFIRMED** set | — | No action (verified working: authz, migrations, §290, SSRF/redirect/size, dedup, feedback loops, 57-anchor MATCH) |

**Note on the audit's blocker bundle — P1-#8 (folded) vs P1-#7 (surfaced as DP-9).** The
audit's pilot-launch blocker condition reads, **in full**:
*"(blocker) Wire and test the … drain end-to-end **(1)**, with timeout/retry **(8)** and a
cost-idempotency key **(7)**"* (`AUDIT_OVERPASS_2026-06-13.md:192-194`) — three items in one
sentence. The session-opener Phase-1 scope enumerated only (1); it named neither (8) nor (7). The
planner **folds (8) into P1.1** (a drain that does not handle a mid-self-review LLM timeout is not
safely closed — surfaced as a planner inclusion, role files §7) and, for the **asymmetry with (7)**
that this bundling exposes (CA-3 / OV-3), **surfaces (7) as DP-9** rather than discharging it under a
generic R4 attribution. The earlier draft truncated this quote at "…timeout/retry (8)…", which hid
the (7) clause and the asymmetry; it is restored here. The planner's lean on each is recorded
(fold #8; defer #7) but #7's classification is the spec author's to confirm (DP-9).

**Note on the audit's "decide the trigger model" (CA-2 / OV-1).** The audit's fix-scope item-1 is
*"wire the drain for the chosen primary path **+ decide the trigger model**"*
(`AUDIT_OVERPASS_2026-06-13.md:419-420`). That flagged sub-decision maps to: the **autonomy
posture** (autonomous-cron vs gated-`/approve`) = **DP-4 / DP-8**; the per-slice **mechanism** = the
detail-plan. P1.1 **wires but does not enable** (§4.1 wire-vs-enable invariant); enablement is
conditional on that ruling + P1.3. Recorded here so the flagged sub-decision is visibly
accounted-for, not implicitly absorbed.

---

## 10. Out of scope (this PR) + post-deploy deferred

**Out of scope of this parent-plan PR:**

- Authoring the spec/anchor amendment PRs the §1 direction + §7 decision points produce — the
  **spec author** authors those (`SESSION_START.md`); a **fresh** session implements each
  phase/slice against them (Gate 2, §0.2).
- Flipping draft→ready or merging (the **overseer's** actions; the planner never does either).
- Any code under `app/` or `frontend/`, any spec/anchor edit, any SESSION_START refresh — this PR is
  **`plans/**` only** (the plan doc + the planner wake-log). The SESSION_START refresh is a
  **downstream Phase-5 slice (P5.1)**, not part of this PR.
- The per-slice concrete build choices — the future **detail-plan's** job.

**Post-deploy DEFERRED (R4 — tracked for traceability, NOT in this workstream's scope):** unbounded
scans + N+1s (P1-#5), cardinality / unbounded growth (P1-#6), DNS rebinding (P1-#12), decompression
ratio (P1-#13), F3 model-name wording (P1-#14), free-form rollback inputs (P2-#12), code/schema
rollback ordering (P2-#13), English-centric embeddings / content-type trust (P2-#14),
ZA-construction seed coupling removal (P2-#11, scoping-surface split to DP-3). **AI cost idempotency
(P1-#7)** is *lean-deferred* but, because the audit bundled it into a launch blocker, its
defer-vs-blocker classification is **surfaced at DP-9** rather than flatly deferred here (CA-3 /
OV-3). These are recorded in the carry-forward ledger (P5.2) so they remain discoverable.

---

## Loop mechanics (role files §4–§8)

- **PR posture:** opened **non-draft** per the explicit session-opener instruction — a deliberate
  deviation from role §4.3's draft default, surfaced here and in the PR body. Class **(iv)
  ratification-class** (§0.2): does **not** auto-merge on the three-sign-off gate; requires explicit
  spec-author ratification through the authenticated channel before the overseer executes.
- **Watcher:** `counterpart-change-detector` skill, active iteration. `SELF_EXCLUDE` = exact
  `claude/content-pipeline-maturity-plan-zqte3y`; `WATCH_INCLUDE` = the auditor's + overseer's
  branch ref-space (Acumen reviewer branches use `claude/<random>` naming — scope to the actual
  branches once they appear, backstopped by the broad new-ref arm + a manual pre-existing-ref
  `git ls-remote` scan at each re-arm). Proactive re-arm ~25 min; the planner is the standing
  re-initiator.
- **On every wake:** `git ls-remote` + fetch + diff reviewer commits **and** read both reviewers' PR
  comments (the watcher is comment-blind); verify each finding against the live text; fold or push
  back.
- **Each revision:** set-diff gate (role files §6, keyed on the reviewers' `A-*`/`OV-*` IDs) →
  commit the plan change → one wake-log line in the same commit
  (`plans/.wake-log-content-pipeline-maturity-planner.md`, per-thread `X/5`).
- **Convergence:** three sign-offs at one whole-doc content-SHA + the three-layer green gate +
  **explicit spec-author ratification** (class (iv)) + the override window (collapsed to zero by a
  present spec author who ratifies) → the **overseer** flips draft→ready (moot if it stays
  non-draft) and squash-merges. **The class-(iv) ratification must affirm the §1 R0–R4 recording
  itself** (the strategic-pivot scope/precedent), reaching the **overseer** through the
  authenticated channel — because to the reviewers the planner's §1 origin-citation is a relay under
  the shared identity (§0.2, §1; OV-2) — not merely a ruling on DP-1…DP-11. The planner **never**
  flips draft→ready and **never** merges; stays subscribed through merge; stands down only on merge
  verified via `git ls-remote`.
