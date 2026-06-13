# Content pipeline maturity — dual-path generation + audit-driven fixes — granular detail-plan

**Status: draft — planner authoring; under three-party review.** This is the **planner's** detail-plan
artifact, authored as a **non-draft** PR (per the session-opener instruction — a deliberate deviation
from role §4.3's draft default, surfaced here and in the PR body) and hardened through the independent
**plan-auditor** (content correctness) and **plan-overseer** (workflow-governance correctness) loop per
`.claude/roles/*.md`, bound to Acumen by `plans/REQUIRED_READING.md`. Convergence is **three independent
sign-offs at one whole-doc content-SHA** + the three-layer green gate + **explicit spec-author
ratification** (this PR is class **(iv)**, §0.2) + the override window → the **overseer** squash-merges.
The planner **never** flips draft→ready and **never** merges. When the planner judges the plan complete
and reviewer threads resolved, this Status line flips to `**Status: final — approved by planner**` (the
content-invariant final-marker on this canonical branch).

**Date:** 2026-06-13
**Branch:** `claude/content-pipeline-detail-plan-vhfios` (this detail-plan PR — distinct from the
reviewers' branches: plan-auditor `claude/content-pipeline-plan-audit-hkn81t`, plan-overseer
`claude/content-pipeline-plan-overseer-rwr61c`).
**Authoritative source:** the merged **parent plan**
`plans/2026-06-13-content-pipeline-maturity-workstream.md` (PR #130, squashed on `main` at `9cd58d2`) —
the five-phase shape, R0–R4 rulings, DP-1…DP-11 decision points, the candidate-anchor surface, and the
audit-finding traceability ledger.
**Primary structural input:** `plans/AUDIT_OVERPASS_2026-06-13.md` (the merged overpass audit; PRs
#107–#128 + amendment chain #110–#113/#116; audit merged at #129 / `ccd9b7c`).
**Wake-log:** `plans/.wake-log-content-pipeline-detail-planner.md` (one line per commit; per-thread `X/5`;
set-diff gate keyed on the reviewers' `A-*` / `OV-*` IDs).

---

## 0. What this document is, and how it relates to the parent plan

The merged parent plan (PR #130) **ratified the high-level shape** — the dual-path architecture
(LLM-direct primary for the KBC pilot; corpus-grounded matured for future tenants), the R0–R4 strategic
rulings, the five-phase decomposition with **24 provisional slices** (P1.1–P5.4), the verified dependency
chain, the **DP-1…DP-11** decision points, and the **candidate-anchor surface** (AC-D32, AC-D33, AC-CD27,
AC-CD28). It deliberately **did not** make the per-slice concrete build choices — that is *this*
document's job.

**This document spends the per-slice token budget now.** For each of the 24 slices it specifies, per the
session-opener's contract: **(a)** slice ID + name, **(b)** phase, **(c)** files touched (specific
paths), **(d)** testable acceptance criteria, **(e)** dependencies (which slices/amendments must
precede), **(f)** slice-level decision points surfaced in A/B/C form (where any), and **(g)** the slice's
**class** — NORMAL (pure execution) vs **anchor/spec-amendment-gated** (which candidate anchor or AC-D/
AC-CD body amendment it depends on, authored by the spec author in a **separate** amendment PR, **not**
folded into the execution slice). It grounds each against the **live tree at `9cd58d2`** with `file:line`
citations so the executing session implements without re-discovering the surface.

### 0.1 Authoring shape — whole-doc (NOT slice-iterative) — surfaced governance choice

PR #108 (the autonomous-content **detail** plan) was authored **slice-iterative** (each slice's deep
detail posted, sealed 3/3, then the next pushed) because it was *originating* per-slice detail
incrementally across 14 slices. This detail plan **refines an already-decomposed parent** (PR #130
already enumerated the 24 slices, their scope, and their dependency chain), so it is authored
**whole-doc**: the complete 24-slice detail is posted as one artifact and reviewed in one loop, with a
single global three-party convergence at one whole-doc content-SHA (role files §8). **This matches the
parent plan's own whole-doc shape**, not PR #108's slice-iterative seal cadence. *The session-opener
instruction to "match PR #108's slice **shape**, acceptance-criteria **style**, decision-surfacing
**rhythm**" is honoured at the per-slice **section** level (§§5–9 below); the slice-iterative **seal
workflow** is the part that does not transfer.* **Surfaced for overseer governance ratification** as
OPEN-G1 (§11) — confirm whole-doc is the right convergence shape here, or direct slice-iterative seals.

### 0.2 Two gates — do not conflate

- **Gate 1 — this detail-plan PR's own merge is class (iv) ratification-class** (per the session-opener:
  *"class (iv) ratification-class for the slice-level decisions + anchor surface"*). The diff is
  `plans/**`-only and bakes **no** code, **no** spec amendment, **no** anchor mint. But it **records**
  the slice-level decision resolutions, **confirms the candidate-anchor numbering**, **fixes the final
  slice sequencing**, and **maps the pilot-launch-blocker set** — each a **scope decision (iii)** /
  **durable project-level precedent (iv)** binding downstream work. Per role files §8.3 and
  `REQUIRED_READING.md` §7, it therefore does **not** auto-merge on the three-sign-off gate: it requires
  **explicit spec-author ratification through the authenticated channel** before the overseer executes.
  **Because every role-session writes under the shared identity**, the §0.3 recording of the
  session-opener's settled rulings reads, *to the auditor and overseer*, as a **relay** (role files
  §8.3): the class-(iv) ratification that clears this PR must **affirm the §0.3 settled-rulings recording
  itself** + the §10 slice-DP resolutions + the §8 anchor numbering + the §3 sequencing + the §9
  launch-blocker map, reaching the **overseer** through the authenticated channel. *(Same posture as the
  parent plan PR #130 §0.2/§1.)*
- **Gate 2 — each embedded anchor/spec amendment is ratified + authored separately, downstream.** The
  candidate anchors (AC-D32, AC-D33, AC-CD27, AC-CD28) and every AC-D/AC-CD/SPEC **body** touch this plan
  identifies are **authored by the spec author** in their own amendment PRs (`SESSION_START.md` — "the
  implementing session does not also author the clarification"); a **fresh** session implements each
  execution slice against the corrected text. **No anchor is minted, and no spec body is amended, in this
  PR.** The amendment-PR → execution-slice dependency is the **§4 ledger**. Once this plan merges, to any
  downstream session under the shared byline this document reads as a **relay** — pending, not actionable
  — so each downstream PR re-confirms its governing ratification through its own authenticated channel.

### 0.3 Ratified-so-far — the settled direction this plan builds on (origin: this session, 2026-06-13)

Handed to the planner through the **direct, authenticated in-session channel** (`REQUIRED_READING.md` §7;
role files §8.3 — the in-session human channel is the reference), **explicit and current**. The planner
records these citing **this session** as authenticated origin (the parent-plan §1 / PR #107 §1 pattern).
**These are SETTLED — the planner does not re-litigate them**; downstream items they do not settle are
surfaced in §10 (slice-level decision points **DDP-1…DDP-26**).

| # | Decision | Settled ruling (this session) |
|---|---|---|
| **R0–R4** | Strategy / mode / corpus / scope / deferral | Per parent plan §1 — dual-path; per-tenant mode, KBC → `llm_direct`; corpus matured-not-removed; five-phase scope; §10 deferrals tracked-not-dropped. |
| **DP-1** | Mode-selection mechanism | **Per-tenant config + optional per-topic override** (parent lean confirmed). |
| **DP-2** | Cross-mode comparability | **Log generation mode in `PublishRecord`; same global confidence threshold across modes initially** (re-evaluate to mode-specific iff dashboard data warrants). |
| **DP-3** | Allowlist scoping (multi-tenant) | **Shared public base + per-tenant private additions** (parent lean confirmed). |
| **DP-4** | FE-10 pilot disposition | **GATED PILOT — autonomy DISABLED for v1; generated drafts QUEUE for admin `/approve`; admin approves before live; FE-10 thin oversight is the NEXT workstream.** |
| **DP-5** | Versioning | **v1.10 bump** (parent lean confirmed). |
| **DP-6** | Anchor surface | **AC-D32** dual-path modes · **AC-D33** per-tenant mode config · **AC-CD27** LLM-direct provenance · **AC-CD28** content-validity gate (the four candidates **confirmed** as the next-available identifiers; §8). |
| **DP-7** | Slice sequencing within phases | Parent lean confirmed, refined into the §3 dependency graph. |
| **DP-8** | Pilot launch criteria | **Launch-blockers = Phase 1 + Phase 2 (the pilot path) + P5.4 (FE-10/gated-pilot disposition)**; Phase 3 + Phase 4 are future-tenant work, NOT pilot launch-blockers (§9). |
| **DP-9** | Cost-idempotency (P1-#7) | **DEFERRED post-deploy** (R4 governs over the audit-blocker bundling; recorded in the §5/P5.2 carry-forward ledger). |
| **DP-10** | Paywalled-source policy | **HYBRID — reject clear paywalls at the content-validity gate; tier-cap partial-content sources to T2 with a `paywalled` flag** (P3.1). |
| **DP-11** | Contradiction posture | **Surface inter-source disagreement to the oversight/flag layer** (parent lean confirmed; P3.2). |

> **DP-4 reshapes the wire-vs-enable story.** Because autonomy is **disabled** for the v1 pilot (DP-4),
> the drain (P1.1) is **wired but never enabled** for the pilot — it is built for the post-FE-10 future,
> and the **pilot publish path is the admin `/approve` queue** (P5.4). The parent plan's "wire-vs-enable
> invariant" (P1.3 + the trigger ruling gate *enablement*) still holds for the *future* autonomous path,
> but for the **pilot** the gate is simply **never opened** — generated `pending` `pill_generation` rows
> accumulate as an admin approval queue rather than being auto-drained. Every slice below is read through
> this gated-pilot lens.

---

## 1. Slice map — all 24 slices

`P{phase}.{n}` IDs are carried verbatim from parent plan §4/§6 (traceability). **Class:** NORMAL = pure
execution; **AMD-x** = blocked on amendment-PR *x* (§4 ledger); **(iv)** = framework-change
ratification-class. **LB** = pilot-launch-blocker (§9).

| Slice | Name | Phase | Class | Blocks on | LB? |
|---|---|---|---|---|---|
| **P1.1** | Drain orchestration (wire, not enable) + timeout/retry | 1 | NORMAL (poss. AC-CD7 cron-count → AMD-J*) | — | LB |
| **P1.2** | Concurrency locks (`FOR UPDATE SKIP LOCKED` + `/approve` row-lock) | 1 | NORMAL (poss. migration) | P1.1 | LB |
| **P1.3** | Hard budget/volume cap + AI-keys fail-closed | 1 | NORMAL + **AMD-J** (AC-D18 body) | — | LB |
| **P1.4** | Threshold clamp | 1 | NORMAL | — | LB |
| **P1.5** | End-to-end pipeline tests | 1 | NORMAL | P1.1, P1.2 | LB |
| **P1.6** | Pilot publish-health observability + ≥1 alert | 1 | NORMAL + **AMD-J** (AC-D18 body) | P1.1 | LB |
| **P2.1** | Mode setting on `pill_generation` (per-tenant) | 2 | **AMD-A** (AC-D32) | — | LB |
| **P2.2** | Routing in `generate_grounded_drafts` | 2 | NORMAL (rides AC-CD8) | P2.1, P2.3 | LB |
| **P2.3** | LLM-direct prompts (ground on training) | 2 | NORMAL (rides AC-CD8/AC-CD18) | — | LB |
| **P2.4** | Provenance shape for LLM-direct | 2 | **AMD-B** (AC-CD27) | P2.1, P2.2 | LB |
| **P2.5** | Confidence math (cross-model agreement primary) | 2 | **AMD-C** (AC-D30/31 body) | P2.2, P2.4 | LB |
| **P2.6** | Default mode = `llm_direct` for KBC | 2 | NORMAL (rides AMD-A) | P2.1–P2.5 | LB |
| **P3.1** | Content-validity gate (+ DP-10 paywall HYBRID) | 3 | **AMD-D** (AC-CD28 + AC-CD25 body) | — | — |
| **P3.2** | Contradiction surfacing (DP-11) | 3 | **AMD-I** (contradiction anchor / AC-D30 body) | — | — |
| **P3.3** | Retrieval filter excludes demoted hosts | 3 | **AMD-E** (AC-D28 body, retrieval-side) | — | — |
| **P3.4** | CASCADE → SET NULL on `provenance.corpus_chunk_id` | 3 | **AMD-F** (AC-CD26 body) + migration | (coord. P2.4) | — |
| **P3.5** | Confidence recompute on demote | 3 | **AMD-C** (AC-D30/31 body) | P3.3 | — |
| **P4.1** | Tenant threading (replace `SEED_TENANT_ID`) | 4 | **AMD-H** (AC-CD3 body + AC-CD5 reconcile) | — | — |
| **P4.2** | Cross-tenant guard tests | 4 | NORMAL | P4.1 | — |
| **P4.3** | Per-tenant mode config surface | 4 | **AMD-G** (AC-D33) | P2.1, P4.1 | — |
| **P5.1** | `SESSION_START.md` refresh (→ v1.10) | 5 | **(iv)** framework | (after anchors mint) | — |
| **P5.2** | `CARRY_FORWARD.md` ledger | 5 | **(iv)** framework | — | — |
| **P5.3** | Audit-doc path consistency (`plans/` vs `audits/`) | 5 | **(iv)** framework | — | — |
| **P5.4** | FE-10 / gated-pilot disposition (autopublish off, `/approve` queue) | 5 | **AMD-K** (AC-D31 body) | P1.1, P2.6 | **LB** |

*AMD-J* is conditional on the P1.1 drain-mechanism choice (DDP-1): a **new cron** trips the AC-CD7 / SPEC
§8.9 "nine crons" count-invariant (→ amendment); an **off-cron drain** (the `pill_generation.bootstrap`
precedent) does not.

---

## 2. Current-state verification (verified against the live tree at `9cd58d2`)

Per role files §4.2 — claims verified against the repo, not inherited from the parent plan or the audit.

- **The drain gap is real and is the foundation (P1-#1).** `app/worker.py` registers **11** Celery tasks
  (`worker.py:123–350`); **none drains `pending` `pill_generation` `ProcessingTask` rows.** The bootstrap
  drain `process_pending_bootstraps` (`bootstrap.py:216`) is the exact shape the generation drain must
  mirror, and `pill_generation.bootstrap` (`worker.py:264`) is the **off-cron** precedent (registered,
  not in the beat schedule) for a drain that does not move the nine-cron count. **Confirmed.**
- **No concurrency locking anywhere on the task-claim paths.** `process_pending_bootstraps`
  (`bootstrap.py:221`), `_pending_batch_for` (`generation.py:177`), and `_generated_gap_signals`
  (`gap_detection.py:81`) all `select(... status == pending)` with **no `FOR UPDATE SKIP LOCKED`**; the
  `/approve` endpoint (`catalogue.py:378`) is check-then-act (`status.value != "pending"` at `:394`, then
  `auto_publish_draft` at `:396`) with **no row lock**. **Confirmed (P2-#1 / P2-#5).**
- **No hard cost cap; AI keys WARN-only outside dev.** `app/ai/cost.py` has `current_month_spend`
  (`:320`) + `maybe_fire_budget_alert` (`:466`) — **alert-only, no kill-switch**. `config.py:202–212`
  appends a **warning** (not an error) for unset `anthropic_api_key`/`openai_api_key`; the
  `app_env not in DEV_ENVS` block (`config.py:214`) guards the JWT/CORS secrets but **not** the AI keys.
  `SystemSettings.monthly_ai_budget` exists (`models.py`) but feeds only the alert. **Confirmed (P2-#2 /
  P2-#10).**
- **The publish threshold is unclamped.** `_publish_threshold` (`publish.py:81`) reads
  `pill_publish_confidence_threshold` (default 0.70, `models.py:1100`) and returns it raw — no `[0,1]`
  clamp. **Confirmed (P1-#9).**
- **Retrieval ignores demoted hosts.** `retrieve_corpus_for_topic` (`corpus_builder.py:390`) filters by
  `tenant_id` (`:425`) + optional `min_tier` (`:426`) only — it **never consults `denied_hosts` /
  `filter_demoted`** (which is consulted at acquisition, `corpus_builder.py:235`). **Confirmed (P1-#2).**
- **No content-validity gate at acquisition.** `_extract_html` / `_extract_pdf` (`corpus_builder.py:171,
  182`) fail-soft to `""`; `acquire_for_topic` (`corpus_builder.py:217`) stamps every fetched chunk with
  `authority_tier=int(cand.tier)` / `authority_score` (`:275–276`) with **no login-page / zero-text
  rejection**. **Confirmed (P2-#4).**
- **No contradiction detection.** `_corroboration_counts` (`corpus_builder.py:267`) measures *agreement*
  (cosine ≥ 0.90); **nothing detects T1-vs-T1 *disagreement*.** **Confirmed (P2-#3).**
- **`provenance.corpus_chunk_id` is `ON DELETE CASCADE`.** Per parent plan §4.3 (cite `0010:38`); the
  latest migration is **`0013_e2_demoted_sources`**, so new migrations start at **`0014`**. **Confirmed
  (P2-#8).**
- **`SEED_TENANT_ID` hard-coded across the workstream.** `generation.py:134,179`, all of
  `gap_detection.py`, `bootstrap.py:69,179,223`, all of `oversight.py`, `publish.py:86,207`, all of
  `corpus_builder.py`, `source_authority.py`. **Confirmed (P2-#6).**
- **`generation_mode` does not exist on `SystemSettings`.** Grep of `models.py:1029–1110` confirms no
  generation-mode column — P2.1 mints it. **Confirmed.**
- **`SESSION_START.md` is stale at v1.8** (per parent plan §2; not re-verified line-by-line). The latest
  anchor maxima are **AC-D31 / AC-CD26** (parent §2). **Confirmed.**
- **The `AIProvider` protocol + prompt registry are the Phase-2 seams.** `AIProvider` (`provider.py:326`)
  with `generate`/`review`/`embed`; `Operation.pill_generation` ∈ `_ANTHROPIC_DEFAULT_OPS`
  (`provider.py:263`); the prompt registry `_REGISTRY` + `_VARIANT_REGISTRY` (`prompts/__init__.py:43,76`)
  — the `content_self_review` three-variant pattern (`self_review.py:33`) is the precedent for a
  `pill_generation` LLM-direct variant. **Confirmed.**

No precondition contradicts the parent-plan scope; the detail plan is workable as handed (role files
§4.2 / §7e clear).

---

## 3. Dependency graph & sequencing

### 3.1 The graph (→ = "must precede")

```
PHASE 1 (pilot blockers — front-loaded, all LB):
   P1.4 ───────────────(independent)
   P1.3 ───────────────(independent; precondition of any future enablement)
   P1.1 → P1.2 → P1.5
   P1.1 → P1.6
        (P1.1‖P1.3‖P1.4 can start in parallel; P1.2 after P1.1; P1.5 after P1.1+P1.2; P1.6 after P1.1)

PHASE 2 (LLM-direct — the pilot content path, all LB; depends on AMD-A/B/C):
   [AMD-A]→ P2.1 ─┐
            P2.3 ─┼→ P2.2 → [AMD-B]→ P2.4 → [AMD-C]→ P2.5 → P2.6
   (P2.1 needs AMD-A; P2.3 independent; P2.2 needs P2.1+P2.3; P2.4 needs AMD-B; P2.5 needs AMD-C; P2.6 last)

PHASE 3 (corpus maturity — future-tenant, NOT pilot-blocking; parallel to / after Phase 2):
   [AMD-D]→ P3.1     [AMD-I]→ P3.2     [AMD-E]→ P3.3 → [AMD-C]→ P3.5
   [AMD-F]→ P3.4 (coordinate the nullable-column migration with P2.4 — DDP-19)
   (P3.1, P3.2, P3.3, P3.4 mutually independent; P3.5 after P3.3)

PHASE 4 (multi-tenant prep — pre-second-tenant, NOT pilot-blocking):
   [AMD-H]→ P4.1 → P4.2
   P4.1 + P2.1 + [AMD-G]→ P4.3

PHASE 5 (housekeeping — interleaves; P5.4 is LB):
   P1.1 + P2.6 + [AMD-K]→ P5.4   (LB — the gated-pilot disposition)
   (anchors mint) → P5.1 → links P5.2 ; P5.2 independent ; P5.3 independent
```

### 3.2 Parallelisation vs sequencing

- **Parallelisable now (no inter-slice dep):** P1.1, P1.3, P1.4 (Phase 1 entry); P2.3 (prompt authoring,
  before its consumer P2.2); P3.1, P3.2, P3.3, P3.4 (each waits only on its own amendment); P5.2, P5.3.
- **Must sequence:** P1.2 after P1.1; P1.5 after P1.1+P1.2; P1.6 after P1.1; the full Phase-2 chain
  P2.1→P2.2→P2.4→P2.5→P2.6; P3.5 after P3.3; P4.2 after P4.1; P4.3 after P2.1+P4.1; P5.4 after P1.1+P2.6;
  P5.1 after the anchors mint (so it reflects final state).
- **Front-loaded (pilot gate):** **Phase 1 then Phase 2** delivers the pilot. **Phase 3 and Phase 4 are
  future-tenant work that need not block the pilot launch** (§9). Phase 5 interleaves, except **P5.4 is on
  the pilot critical path**.
- **Cross-amendment coordination (the PR #108 OV-33 amend-once discipline):** **P2.4 and P3.4 both touch
  the `generation_provenance.corpus_chunk_id` nullability** — a synthetic LLM-direct provenance row
  (P2.4, DDP-13) and the CASCADE→SET NULL change (P3.4) both require the column nullable. **Author the
  one migration covering both, once** — whichever slice lands first owns it; the other reuses it (DDP-19).
  Likewise **P2.5 and P3.5 both touch the AC-D30/31 confidence body** (AMD-C) — author that body
  amendment **complete across both contributions, once**, before the first of P2.5/P3.5 executes.

Each phase closes with its own squash PR per `SESSION_START.md` "one PR per phase"; multi-slice phases
inherit the PR-025 auto-continue default unless a phase opener declares binding pauses (the §11 OPEN-G2
surface flags Phase 2's P2.1 schema/mode-flip as a binding-pause candidate).

---

## 4. Anchor-amendment → execution-slice dependency ledger (Gate 2)

The candidate anchors + every AC-D/AC-CD/SPEC **body** touch are authored by the **spec author** in
**separate** amendment PRs (§0.2 Gate 2), **before** the first execution slice that depends on each. **No
anchor is minted or body amended in this PR.** Each amendment is itself ratification-class (role files
§8.3 (i)/(ii)) and is authored **complete across all touching slices, once** (PR #108 OV-33).

| Amendment PR (spec-author-authored) | Anchor(s) / body | Blocks execution slice(s) | Notes |
|---|---|---|---|
| **AMD-A** | **AC-D32** mint — dual-path generation modes | P2.1, P2.2, P2.6 | The product decision; KBC default rides AC-D33/R1. |
| **AMD-B** | **AC-CD27** mint — LLM-direct provenance shape | P2.4 | Defines the non-corpus provenance representation (DDP-13). |
| **AMD-C** | **AC-D30 + AC-D31 body** — confidence math (LLM-direct + recompute-on-demote) | P2.5, P3.5 | Author once across both (§3.2). |
| **AMD-D** | **AC-CD28** mint + **AC-CD25 body** — content-validity gate + DP-10 paywall HYBRID | P3.1 | DP-10 ratified; mechanism is DDP-15/16. |
| **AMD-E** | **AC-D28 body** — retrieval-side demotion | P3.3 | Extends acquisition-side demotion to retrieval. |
| **AMD-F** | **AC-CD26 body** — CASCADE → SET NULL | P3.4 | Migration `0014`+; coordinate nullable col with P2.4. |
| **AMD-G** | **AC-D33** mint — per-tenant mode config | P4.3 | DP-1/DP-3 settled. |
| **AMD-H** | **AC-CD3 body + AC-CD5 reconcile** — tenant threading | P4.1 | RLS stays a port-seam; CA-11 (DDP-21). |
| **AMD-I** | contradiction anchor (new AC-D **or** AC-D30 body — DP-6 to confirm) | P3.2 | DP-11 posture settled (surface-to-oversight). |
| **AMD-J** | **AC-D18 body** — hard cap + observability (visibility-only → hard-cap+metrics) | P1.3, P1.6 | Only if the cap/metrics change AC-D18 semantics; confirm at DP-6 / DDP-4. |
| **AMD-K** | **AC-D31 body** — autonomy GATED for v1 (DP-4) | P5.4 | Records the gated-pilot posture in the anchor. |

**Framework changes (iv)** — `SESSION_START.md` (P5.1), `CARRY_FORWARD.md` (P5.2), audit-doc path
(P5.3) — are **not** anchor-body amendments; they are authored within their P5 execution slices but are
ratification-class **(iv)** at those slices' own merge gates (not pre-blocking other slices).

---

## 5. Phase 1 — Pilot blockers (front-loaded; all launch-blockers)

> **Gated-pilot lens (DP-4).** Phase 1 makes the pipeline *safe and closeable*; under DP-4 the drain is
> **wired but not enabled** for the v1 pilot, and the pilot publish path is the admin `/approve` queue
> (P5.4). The concurrency/cap/clamp/observability fixes apply to *both* the (disabled) autonomous path
> and the (live) `/approve` path, so they remain launch-blockers.

### P1.1 — Drain orchestration (wire, not enable) + timeout/retry
- **Phase:** 1. **Class:** NORMAL execution, rides AC-D31 / AC-CD7 (poss. **AMD-J\*** cron-count — see
  DDP-1). **Discharges:** P1-#1 (CRITICAL); P1-#8 (timeout/retry, planner-folded per parent §9).
- **Files:** new `app/domain/drain.py` (`process_pending_generations`, mirroring
  `bootstrap.py:216 process_pending_bootstraps`) **or** add to `app/domain/generation.py`; `app/worker.py`
  (new task wrapper `pill_generation.drain`, off-cron per the `pill_generation.bootstrap` precedent at
  `worker.py:264`); `app/ai/anthropic.py` / the provider call site (timeout/retry on mid-self-review LLM
  failure — `anthropic.py:182` tenacity exhaust path the audit flagged); tests.
- **Acceptance criteria:** (1) a drain fn selects `pending` `pill_generation` `ProcessingTask` rows and
  runs each through `publish.auto_publish_draft` (`publish.py:96`), committing per the worker-wrapper
  pattern; (2) **per-task isolation** — one draft raising does not abort the batch (mirror
  `bootstrap.py:241–248`: mark `failed`, continue); (3) an LLM timeout/503 mid-self-review is **caught** —
  the task is left `pending` for a bounded retry (DDP-2), never a stuck-pending-with-no-retry or an
  uncaught 500; (4) **wired, NOT scheduled** — the drain task is registered but **absent from the beat
  schedule** (`app/beat_schedule.py`), so v1's gated pilot (DP-4) does not auto-publish; an end-to-end
  test (P1.5) drives the drain fn directly; (5) the nine-cron count invariant (AC-CD7 / SPEC §8.9) is
  **unchanged** iff the drain is off-cron (DDP-1).
- **Dependencies:** none (foundation). *Enablement* (future, post-pilot) is conditional on P1.3 + the
  trigger ruling — but the pilot never enables it (DP-4).
- **Decision points:** **DDP-1**, **DDP-2** (§10).

### P1.2 — Concurrency locks
- **Phase:** 1. **Class:** NORMAL (possible migration if a unique constraint is chosen — DDP-3).
  **Discharges:** P2-#1 (HIGH); P2-#5 (MEDIUM).
- **Files:** `app/domain/drain.py` (the P1.1 claim — `.with_for_update(skip_locked=True)`);
  `app/domain/bootstrap.py:221` (`process_pending_bootstraps` claim); `app/routers/catalogue.py:378–401`
  (`/approve` — `select(...).with_for_update()` on the proposal task + re-check `pending` under lock);
  optionally a migration `0014`+ for a partial unique index; tests.
- **Acceptance criteria:** (1) the drain + bootstrap task-claims use `FOR UPDATE SKIP LOCKED` so two
  concurrent workers never claim the same row (test with two concurrent sessions); (2) `/approve`
  row-locks the proposal and re-asserts `status == pending` **under the lock** before
  `auto_publish_draft`, so two concurrent submits yield **one** publish + one `409` (currently both pass
  the `:394` check → double-publish); (3) the AC-CD15 zero-network test fake either models the lock or the
  test documents the lock as integration-only (the fake cannot model the WHERE/lock — mirror the
  `generation.py:170` note).
- **Dependencies:** **P1.1** (the drain claim must exist to lock). Pairs tightly with P1.1.
- **Decision points:** **DDP-3** (§10).

### P1.3 — Hard budget/volume cap + AI-keys fail-closed
- **Phase:** 1. **Class:** NORMAL + **AMD-J** (AC-D18 body — if the hard cap changes AC-D18's
  visibility-only semantics). **Discharges:** P2-#2 (HIGH); P2-#10 (MEDIUM).
- **Files:** `app/config.py:202–212` (promote the AI-key WARN → ERROR inside the `app_env not in
  DEV_ENVS` block at `:214`); `app/ai/cost.py` (a hard `budget_exceeded`/kill-switch fn alongside
  `maybe_fire_budget_alert:466`); `app/domain/gap_detection.py` (per-sweep batch ceiling in
  `gap_detection_sweep:94` + `catalogue_health_check:143`); the P1.1 drain (budget check before each
  publish); `app/models.py` SystemSettings + migration `0014`+ if new cap columns; tests.
- **Acceptance criteria:** (1) outside `DEV_ENVS`, an unset `anthropic_api_key` (and, per the mode's
  needs, `openai_api_key` — DDP-5) makes `check_startup_config` return an **error** → boot fails closed
  (not the current warning at `config.py:203`); (2) a **per-sweep batch ceiling** caps batches opened per
  sweep run (test a flooded `GapSignal` table stops at the ceiling); (3) a **monthly-spend kill-switch**
  halts new generation/publish when `current_month_spend` ≥ `monthly_ai_budget` (hard stop, distinct from
  the existing alert); (4) the cap is a **precondition of any future autonomous enablement** (recorded;
  the pilot is gated regardless, DP-4).
- **Dependencies:** none; precondition of future enablement.
- **Decision points:** **DDP-4** (cap shape), **DDP-5** (fail-closed scope, NS-7 interaction) (§10).

### P1.4 — Threshold clamp
- **Phase:** 1. **Class:** NORMAL. **Discharges:** P1-#9 (MEDIUM).
- **Files:** `app/domain/publish.py:81` (`_publish_threshold` — clamp the read value to `[0.0, 1.0]`);
  optionally `app/models.py` / a settings-write validator (DDP-6); tests.
- **Acceptance criteria:** (1) `_publish_threshold` returns `max(0.0, min(1.0, value))`; (2) a
  misconfigured `>1.0` no longer flags-all and `<0` no longer lands-all-live (test both bounds); (3) the
  0.70 default and the absent-settings fallback (`publish.py:93`) are unchanged.
- **Dependencies:** none (fully independent — parallelisable from slice 1).
- **Decision points:** **DDP-6** (§10).

### P1.5 — End-to-end pipeline tests
- **Phase:** 1. **Class:** NORMAL (pure tests). **Discharges:** P1-#10 (MEDIUM).
- **Files:** new `tests/test_pipeline_e2e.py` (or extend the generation test module); uses the stub
  provider (AC-CD15).
- **Acceptance criteria:** (1) a test drives the **full** path — `gap_detection_sweep` →
  `enqueue_generated_drafts` → the P1.1 drain → `auto_publish_draft` → `enqueue_pill_bootstrap` →
  `process_pending_bootstraps` — and asserts a `Pill` + `PublishRecord` + bootstrap result (not the
  direct `auto_publish_draft` call the v1.9 suite exercises, per the audit's Axis-8 gap); (2) covers both
  the live (≥ threshold) and publish-with-warning (< threshold) branches; (3) covers the P1.2
  no-double-claim concurrency path; (4) covers the **gated-pilot** path — generated drafts queue and are
  published via the `/approve` route (P5.4), the drain being unscheduled.
- **Dependencies:** **P1.1, P1.2**.
- **Decision points:** none.

### P1.6 — Pilot publish-health observability + ≥1 alert
- **Phase:** 1. **Class:** NORMAL + **AMD-J** (AC-D18 body — observability extends the cost-alert anchor).
  **Discharges:** P2-#7 (MEDIUM, path-independent; both-mode pilot concern, moved from Phase 3).
- **Files:** new `app/ai/metrics.py` (or extend `app/ai/cost.py`); emit from `publish.py:179`
  (publish-rate / flag-rate / confidence-distribution) + the P1.1 drain (backlog depth); an alert hook
  reusing the `cost.py:466 maybe_fire_budget_alert` SMTP-seam pattern; tests.
- **Acceptance criteria:** (1) publish-rate, flag-rate (`low_confidence` share), confidence-distribution,
  and drain-backlog-depth metrics are emitted; (2) **≥1 proactive alert** fires on a defined anomaly
  (e.g. flag-rate over a threshold, or backlog over a depth); (3) metric/alert emission is **fail-soft**
  — it never blocks or fails a publish (mirror the `maybe_fire_budget_alert` "never raises" contract).
- **Dependencies:** **P1.1** (drain backlog).
- **Decision points:** **DDP-7** (metrics sink), **DDP-8** (alert channel) (§10).

---

## 6. Phase 2 — LLM-direct mode (the pilot's content path; all launch-blockers)

### P2.1 — Mode setting on `pill_generation` (per-tenant)
- **Phase:** 2. **Class:** **AMD-A** (AC-D32). **BLOCKED** pending AC-D32 mint + DP-1 (settled).
- **Files:** `app/models.py:1029–1110` (SystemSettings: new `generation_mode` column + a
  `GenerationMode` enum `llm_direct | corpus_grounded`); migration `0014`+ (additive, reversible); tests.
- **Acceptance criteria:** (1) a per-tenant `generation_mode` column exists with the two-value enum;
  (2) the migration is additive + reversible (downgrade drops the column), touches no P1 table
  (consistent with the audit's Axis-5 migration-safety finding); (3) the column default is chosen per
  DDP-10; (4) DP-1's optional per-topic override is **accommodated** in the model shape (DDP-9) even if
  the override surface lands later.
- **Dependencies:** **AMD-A** (AC-D32). No code-slice predecessor.
- **Decision points:** **DDP-9** (storage shape — column vs table for the per-topic override),
  **DDP-10** (column default) (§10).

### P2.2 — Routing in `generate_grounded_drafts`
- **Phase:** 2. **Class:** NORMAL, rides **AC-CD8** (the one `AIProvider` interface). Depends on AMD-A via
  P2.1.
- **Files:** `app/domain/generation.py:72` (`generate_grounded_drafts` — dispatch by the tenant's
  `generation_mode`; LLM-direct skips `retrieve_corpus_for_topic:97` and renders no corpus context);
  tests.
- **Acceptance criteria:** (1) the fn dispatches by `generation_mode`; (2) `corpus_grounded` preserves
  the **exact** existing behaviour (corpus retrieval + provenance chain); (3) `llm_direct` skips corpus
  retrieval entirely and produces drafts with empty `grounding_refs`; (4) **both** modes call
  `resolve_provider(Operation.pill_generation).generate(...)` (`generation.py:104`) — **no direct SDK
  call** (AC-CD8); (5) the LLM-direct path emits the P2.4 provenance shape (not the corpus chain).
- **Dependencies:** **P2.1** (mode column), **P2.3** (the LLM-direct prompt).
- **Decision points:** **DDP-11** (routing shape) (§10).

### P2.3 — LLM-direct prompts (ground on training)
- **Phase:** 2. **Class:** NORMAL, rides **AC-CD8** (prompt registry) + **AC-CD18** (env-default models).
- **Files:** `app/ai/prompts/pill_generation_llm_direct.py` (new TEMPLATE + semver VERSION) **or** a
  `_prompt_variant` of `pill_generation` (DDP-12); `app/ai/prompts/__init__.py:43,76` (register in
  `_REGISTRY` or `_VARIANT_REGISTRY`); `app/ai/provider.py:108` (stub branch for the new prompt, AC-CD15);
  tests.
- **Acceptance criteria:** (1) a LLM-direct prompt with **no `corpus_context`/`corpus_refs` placeholder**
  (it grounds on the model's training, not retrieval); (2) registered with a semver VERSION; (3) the stub
  provider returns a deterministic N-draft payload for it (AC-CD15 zero-network); (4) model resolution
  uses `anthropic_model_pill_generation` (`config.py:66`, AC-CD18).
- **Dependencies:** none (authoring); consumed by P2.2.
- **Decision points:** **DDP-12** (new Operation vs prompt-variant; lean variant, to keep the SPEC §6
  ops-count invariant) (§10).

### P2.4 — Provenance shape for LLM-direct
- **Phase:** 2. **Class:** **AMD-B** (AC-CD27). **BLOCKED** pending AC-CD27 mint + DP-2 (settled).
- **Files:** `app/domain/generation.py` (the LLM-direct path's provenance writes — empty chain vs a
  synthetic "training" row, DDP-13); `app/domain/oversight.py:202,232,269` (verify `item_provenance` /
  `source_authority_breakdown` degrade cleanly for an LLM-direct pill — the P1-#11 tail); `app/models.py`
  (`PublishRecord` gains a `generation_mode` field per DP-2; possibly nullable `corpus_chunk_id` per
  DDP-13/P3.4); migration if a field is added; tests.
- **Acceptance criteria:** (1) the LLM-direct draft records the AC-CD27-defined provenance shape;
  (2) `item_provenance` and `source_authority_breakdown` return a clean **empty/degraded** facet for an
  LLM-direct pill (no error, no crash — the audit's expected-but-verify tail); (3) `PublishRecord` logs
  the generation mode (DP-2); (4) if a synthetic provenance row is chosen (DDP-13), it carries a **null**
  `corpus_chunk_id` — which **requires the nullable column coordinated with P3.4** (DDP-19).
- **Dependencies:** **P2.1, P2.2**; **AMD-B**. Migration coordination with **P3.4** (§3.2 / DDP-19).
- **Decision points:** **DDP-13** (provenance representation) (§10).

### P2.5 — Confidence math (cross-model agreement primary)
- **Phase:** 2. **Class:** **AMD-C** (AC-D30/31 body). **BLOCKED** pending AMD-C + NS-7 (existing,
  ratified).
- **Files:** `app/domain/publish.py:50` (`compute_confidence` — for empty `authority_scores`, derive from
  cross-model self-review agreement rather than the flat `_NO_GROUNDING_BASE = 0.5` at `:43`);
  `app/domain/self_review.py` (the NS-7 `single_provider_verified` / `degrade_mode` interaction at
  `:75–76, 164`); tests.
- **Acceptance criteria:** (1) for LLM-direct (no `authority_scores`), confidence is a function of the
  cross-model self-review agreement, not a flat 0.5; (2) **NS-7 honoured** — a single-provider
  safety-relevant LLM-direct draft cannot run cross-model, so it **degrades to publish-with-warning +
  `single_provider_verified` flag** (degrade-not-gate, `publish.py:142–146`), and cross-model agreement
  is the *primary* signal **only where a second provider is configured**; (3) the corpus-grounded
  authority-weighted math (`publish.py:70–78`) is **unchanged**; (4) DP-2's "same global threshold across
  modes" holds (no mode-specific threshold yet).
- **Dependencies:** **P2.2, P2.4**; **AMD-C** (authored once across P2.5 + P3.5, §3.2).
- **Decision points:** **DDP-14** (LLM-direct confidence formula) (§10).

### P2.6 — Default mode = `llm_direct` for KBC
- **Phase:** 2. **Class:** NORMAL config; rides **AMD-A** (AC-D32) + R1/AC-D33.
- **Files:** a data migration / seed setting the KBC (`SEED_TENANT_ID`) `SystemSettings.generation_mode =
  llm_direct`; tests.
- **Acceptance criteria:** (1) the KBC tenant's settings row resolves to `generation_mode = llm_direct`;
  (2) seeded via migration or startup (idempotent); (3) the LLM-direct pilot path is the live default for
  KBC. **Note:** this flips the *mode*, not the *autonomy gate* — the pilot still publishes via `/approve`
  (DP-4 / P5.4), it just generates LLM-direct drafts into that queue.
- **Dependencies:** **P2.1–P2.5** (the path must work end-to-end).
- **Decision points:** none (R1 settled).

---

## 7. Phase 3 — Corpus maturity (future-tenant; NOT pilot-blocking)

> Phase 3 matures the corpus path for future tenants (R2). Under the gated LLM-direct pilot it does
> **not** block launch (§9). Slices are mutually independent except P3.5 (after P3.3).

### P3.1 — Content-validity gate (+ DP-10 paywall HYBRID)
- **Phase:** 3. **Class:** **AMD-D** (AC-CD28 mint + AC-CD25 body). **BLOCKED** pending AMD-D; DP-10
  settled (HYBRID). **Discharges:** P2-#4 (HIGH).
- **Files:** `app/domain/corpus_builder.py:171–202` (`_extract_html`/`_extract_pdf`/`_extract_text` — a
  validity check before stamping); `acquire_for_topic:217` (reject invalid candidates before
  `CorpusChunk` persist at `:271`); `app/models.py` `CorpusChunk` (+ `paywalled` flag, DDP-16) + migration;
  tests.
- **Acceptance criteria:** (1) a zero-text PDF extraction (`_extract_pdf` → `""`, `:191`) → chunk
  **rejected**, not stamped T1; (2) a login/preview/paywall page (heuristic per DDP-15) → **rejected** if
  a *clear* paywall (DP-10 reject arm); (3) a **partial-content** paywalled source is **tier-capped to T2
  + flagged `paywalled`** (DP-10 tier-cap arm), never stamped T1; (4) a valid full page still passes and
  stamps its real tier; (5) the gate is exercised by an offline test (AC-CD15 — no live fetch).
- **Dependencies:** **AMD-D**.
- **Decision points:** **DDP-15** (paywall detection heuristic), **DDP-16** (paywalled-flag storage) (§10).

### P3.2 — Contradiction surfacing (DP-11)
- **Phase:** 3. **Class:** **AMD-I** (contradiction anchor — new AC-D or AC-D30 body, DP-6 to confirm).
  **BLOCKED** pending AMD-I; DP-11 settled (surface-to-oversight). **Discharges:** P2-#3 (HIGH).
- **Files:** `app/domain/corpus_builder.py:262–267` (extend the corroboration logic to also detect
  T1-vs-T1 *disagreement*) **or** `app/domain/self_review.py` (a surfacing pass); `app/domain/oversight.py`
  (a contradiction facet on the read surface); tests.
- **Acceptance criteria:** (1) two T1 sources whose embeddings diverge (cosine below the corroboration
  threshold) on the same topic are **detected** as a disagreement; (2) the disagreement is **surfaced to
  the oversight/flag layer** (DP-11) — not silently both-grounded; (3) a genuinely corroborating pair is
  **not** falsely flagged (no regression on `_corroboration_counts`).
- **Dependencies:** **AMD-I**.
- **Decision points:** **DDP-17** (detection mechanism — embedding-distance vs LLM cross-check pass) (§10).

### P3.3 — Retrieval filter excludes demoted hosts
- **Phase:** 3. **Class:** **AMD-E** (AC-D28 body, retrieval-side). **BLOCKED** pending AMD-E.
  **Discharges:** P1-#2 (HIGH).
- **Files:** `app/domain/corpus_builder.py:390–428` (`retrieve_corpus_for_topic` — consult the `denied`
  `DemotedSource` hosts, not just `min_tier`); reuse `filter_demoted` (`:235`); tests.
- **Acceptance criteria:** (1) `retrieve_corpus_for_topic` excludes chunks whose `source_host` is in a
  `denied` `DemotedSource` row (`models.py:932`); (2) a demoted host's **already-stored** chunks are no
  longer retrieved (the P1-#2 "blocks re-acquisition but not re-use" fix); (3) acquisition-side demotion
  (`:235`) is unchanged; (4) a test demotes a host, then asserts its existing chunks vanish from
  retrieval.
- **Dependencies:** **AMD-E**.
- **Decision points:** **DDP-18** (in-SQL join vs post-query filter) (§10).

### P3.4 — CASCADE → SET NULL on `provenance.corpus_chunk_id`
- **Phase:** 3. **Class:** **AMD-F** (AC-CD26 body) + migration. **BLOCKED** pending AMD-F.
  **Discharges:** P2-#8 (MEDIUM).
- **Files:** migration `0014`+ (alter the `generation_provenance.corpus_chunk_id` FK from CASCADE to
  `ON DELETE SET NULL`; make the column nullable); `app/models.py:855` `GenerationProvenance`
  (`corpus_chunk_id` nullable); tests.
- **Acceptance criteria:** (1) the FK is `ON DELETE SET NULL` and the column is nullable; (2) deleting a
  `CorpusChunk` **nulls** the provenance FK but **preserves** the provenance row (the published pill's
  claim→source audit trail survives a corpus purge); (3) the migration is reversible; (4) the nullable
  column is **coordinated once with P2.4** (DDP-19) — whichever lands first owns the migration.
- **Dependencies:** **AMD-F**; migration coordination with **P2.4** (§3.2).
- **Decision points:** **DDP-19** (shared nullable-column migration ownership) (§10).

### P3.5 — Confidence recompute on demote
- **Phase:** 3. **Class:** **AMD-C** (AC-D30/31 body — shared with P2.5). **BLOCKED** pending AMD-C.
  **Discharges:** P2-#9 (MEDIUM).
- **Files:** `app/domain/oversight.py:497` (`rollback_source` / the demote path — recompute
  `PublishRecord.confidence` + the authority breakdown for affected live pills); reuse
  `compute_confidence` (`publish.py:50`); tests.
- **Acceptance criteria:** (1) demoting a source recomputes the frozen `PublishRecord.confidence`
  (`publish.py:206` freezes it at publish) for the pills grounded on it; (2) the authority breakdown
  refreshes; (3) a demote-without-rollback no longer leaves stale (possibly high) confidence on live
  content.
- **Dependencies:** **P3.3** (demotion semantics); **AMD-C** (authored once across P2.5 + P3.5).
- **Decision points:** **DDP-20** (recompute synchronous vs enqueued) (§10).

---

## 8. Phase 4 — Multi-tenant prep (pre-second-tenant; NOT pilot-blocking)

### P4.1 — Tenant threading (replace `SEED_TENANT_ID`)
- **Phase:** 4. **Class:** **AMD-H** (AC-CD3 body + AC-CD5 reconcile). **BLOCKED** pending AMD-H.
  **Discharges:** P2-#6 (MEDIUM).
- **Files:** the ~8 modules hard-coding `SEED_TENANT_ID` — `generation.py`, `gap_detection.py`,
  `bootstrap.py`, `oversight.py`, `publish.py`, `corpus_builder.py`, `source_authority.py`, `signals.py`
  — threaded from a tenant-from-actor seam; tests.
- **Acceptance criteria:** (1) the workstream domain fns take a threaded `tenant_id` (from the actor),
  not the hard-coded literal; (2) the threading shape is consistent (CA-11 / DDP-21); (3) **AC-CD3 RLS
  stays a port-seam** — this is application-layer threading, not RLS; (4) existing single-tenant
  behaviour is preserved (KBC = `SEED_TENANT_ID`); a regression test confirms the pilot is unaffected.
- **Dependencies:** **AMD-H**. Large refactor touching P1/P2/P3 modules → sequence **after** the pilot
  path stabilises.
- **Decision points:** **DDP-21** (threading shape — per-fn param vs context-resolved vs centralized
  resolver consistent with AC-CD5 one-file-swap; the parent's CA-11) (§10).

### P4.2 — Cross-tenant guard tests
- **Phase:** 4. **Class:** NORMAL (pure tests). **Discharges:** P2-#6.
- **Files:** new `tests/test_cross_tenant.py`.
- **Acceptance criteria:** (1) a tenant-A admin cannot read/rollback/demote tenant-B's pills via the six
  oversight endpoints (`oversight.py:62–197`) + `/approve`; (2) oversight reads return only the actor's
  tenant; (3) the guard holds across read + rollback + demotion.
- **Dependencies:** **P4.1**.
- **Decision points:** none.

### P4.3 — Per-tenant mode config surface
- **Phase:** 4. **Class:** **AMD-G** (AC-D33). **BLOCKED** pending AC-D33; DP-1/DP-3 settled.
- **Files:** `app/routers/admin.py` (an admin endpoint to read/set a tenant's `generation_mode`); the
  settings domain; shares the P2.1 mode column; tests.
- **Acceptance criteria:** (1) an admin surface reads/sets a tenant's `generation_mode`; (2) the KBC
  default (`llm_direct`) is respected; (3) per-tenant override works (DP-1); (4) allowlist scoping
  follows DP-3 (shared base + per-tenant additions) where the surface touches it.
- **Dependencies:** **P2.1** (mode column), **P4.1** (tenant threading); **AMD-G**.
- **Decision points:** **DDP-22** (config surface — REST endpoint vs settings-only vs FE-scoped) (§10).

---

## 9. Phase 5 — Housekeeping (interleaves; P5.4 is a launch-blocker)

### P5.4 — FE-10 / gated-pilot disposition *(pilot launch-blocker)*
- **Phase:** 5 (exception — on the pilot critical path). **Class:** **AMD-K** (AC-D31 body — records the
  gated-pilot posture). **BLOCKED** pending AMD-K; DP-4 settled (gated pilot). **Discharges:** P1-#3
  (HIGH); DP-4/DP-8.
- **Files:** `app/worker.py` / `app/beat_schedule.py` (the P1.1 drain task stays **registered but
  unscheduled** — autonomy off); `app/routers/catalogue.py` (an admin **list** endpoint for pending
  generated `pill_generation` drafts — the approval queue, DDP-26 — alongside the existing `/approve` at
  `:378`); docs; tests.
- **Acceptance criteria:** (1) autonomous publish is **disabled** for the v1 pilot — the drain cron is
  not scheduled (wire-vs-enable holds, DP-4); (2) generation **enqueues `pending` `pill_generation`
  rows** that form an **admin approval queue** rather than being auto-drained; (3) an admin can **list**
  pending generated drafts and **`/approve`** them to publish via the existing gate (`auto_publish_draft`,
  `catalogue.py:396`); (4) the `/approve` path is row-locked (P1.2); (5) **FE-10 thin oversight is
  explicitly deferred to the next workstream** (recorded in the carry-forward ledger, P5.2); (6) the
  gated posture is documented (and recorded in AC-D31 via AMD-K).
- **Dependencies:** **P1.1** (drain wired), **P2.6** (mode); **AMD-K**.
- **Decision points:** **DDP-26** (the generated-draft approval queue — does `/approve` list `pill_generation`
  tasks like it does `pill_proposal`, or a new queue endpoint? — a real gap: `/approve` today is
  per-`pill_proposal`, generated drafts are `pill_generation` tasks) (§10).

### P5.1 — `SESSION_START.md` refresh (→ v1.10)
- **Phase:** 5. **Class:** **(iv)** framework change; DP-5 settled (v1.10). **Discharges:** P1-#4 (HIGH).
- **Files:** `SESSION_START.md` (anchor maxima → AC-D33 / AC-CD28; AC-D28–31 + AC-CD25–26; the dual-path
  posture; the cron count; FE-10 status; version pairing → v1.10).
- **Acceptance criteria:** (1) SESSION_START reflects the post-workstream anchor maxima, the dual-path
  posture, the cron count, and the FE-10/gated-pilot status; (2) the in-body-override sweep is applied
  (mirror references match the authored prose); (3) "Open items (none)" is corrected; (4) version pairing
  is v1.10.
- **Dependencies:** lands **after** the anchors mint (so it records final state).
- **Decision points:** **DDP-23** (v1.10 vs v1.9-refinement — DP-5 settled v1.10; the slice records the
  ratified call) (§10).

### P5.2 — `CARRY_FORWARD.md` ledger
- **Phase:** 5. **Class:** **(iv)** framework change (new durable governance doc). **Discharges:** P1-#11
  (MEDIUM); DP-9 (records the deferred cost-idempotency).
- **Files:** new `CARRY_FORWARD.md` (the §10 post-deploy deferrals + the audit's undiscoverable-ledger
  items — OV-6 / "15-sites" / F3 / DP-9 cost-idempotency); linked from SESSION_START (P5.1).
- **Acceptance criteria:** (1) a discoverable root `CARRY_FORWARD.md` lists every post-deploy deferral
  (parent §10) + the audit's carry-forward items + the FE-10 deferral; (2) it is linked from
  SESSION_START's reading order.
- **Dependencies:** loose (after the deferral set is final).
- **Decision points:** **DDP-24** (ledger location/format) (§10).

### P5.3 — Audit-doc path consistency
- **Phase:** 5. **Class:** **(iv)** framework change (path-convention precedent). **Discharges:**
  governance hygiene.
- **Files:** reconcile `plans/AUDIT_OVERPASS_2026-06-13.md` vs an `audits/` directory; update references
  across docs.
- **Acceptance criteria:** (1) one audit-doc path convention is chosen and applied; (2) all references
  updated; (3) no broken links (a link scan passes).
- **Dependencies:** none.
- **Decision points:** **DDP-25** (keep `plans/` vs new `audits/`) (§10).

---

## 10. Slice-level decision points — SURFACED for spec-author ratification (not baked)

Per planner discipline (role files §7) — **surface, do not bake**. These are the **new** concrete
build-choice decisions detail-planning surfaces (the parent's DP-1…DP-11 are **settled**, §0.3). Each
carries a lean; each is held "surfaced — awaiting spec-author ruling" until ratified through the
authenticated channel. **A/B/C form** per the session-opener.

- **DDP-1 — Drain mechanism (P1.1).** **A)** a dedicated off-cron worker task `pill_generation.drain`
  (the `pill_generation.bootstrap` precedent — keeps the nine-cron count, no AC-CD7 amendment)
  *(lean)*; **B)** a new scheduled cron (trips the AC-CD7/§8.9 count-invariant → AMD-J); **C)** fold the
  drain into the existing `gap_detection.sweep`/`catalogue_health.check` crons (couples generation to
  trigger). *Class (ii)/(iii).*
- **DDP-2 — Drain retry policy (P1.1).** **A)** leave the task `pending` for the next drain pass on LLM
  timeout, bounded by an in-row attempt counter *(lean)*; **B)** Celery `autoretry_for` with backoff;
  **C)** mark `failed` immediately, no retry. *Class (iii).*
- **DDP-3 — Locking strategy (P1.2).** **A)** `FOR UPDATE SKIP LOCKED` on the claim paths + `with_for_update`
  on `/approve`, **no** new constraint *(lean — minimal, no migration)*; **B)** add a partial unique
  index on the pending-gap key (migration) as defence-in-depth; **C)** both. *Class (ii)/(iii).*
- **DDP-4 — Cap shape (P1.3).** **A)** per-sweep batch ceiling (config constant) **and** a monthly-spend
  kill-switch (reuse `monthly_ai_budget`) — both *(lean)*; **B)** batch ceiling only; **C)** kill-switch
  only. *Class (ii)/(iii); AMD-J if the kill-switch changes AC-D18 semantics.*
- **DDP-5 — Fail-closed key scope (P1.3).** **A)** require **both** AI keys outside dev, always *(lean —
  simplest, safest)*; **B)** require only the keys the tenant's mode needs (LLM-direct single-provider
  needs only Anthropic; cross-model review needs OpenAI) — interacts with NS-7/P2.5. *Class (iii).*
- **DDP-6 — Threshold clamp vs reject (P1.4).** **A)** silently clamp at read *(lean)*; **B)** reject at
  settings-write with a validation error; **C)** both (clamp at read + validate at write). *Class (iii).*
- **DDP-7 — Metrics sink (P1.6).** **A)** structured-log counters (no new infra — Acumen has no metrics
  stack) *(lean)*; **B)** a metrics DB table; **C)** an external sink (StatsD/Prometheus, new dependency).
  *Class (ii)/(iii).*
- **DDP-8 — Alert channel (P1.6).** **A)** reuse the SMTP budget-alert seam (`cost.py:466`) *(lean)*;
  **B)** an audit-log row; **C)** both. *Class (iii).*
- **DDP-9 — Mode storage shape (P2.1).** **A)** a `SystemSettings.generation_mode` column + a separate
  optional per-topic override table (accommodates DP-1's per-topic override without bloating settings)
  *(lean)*; **B)** column only (defer the per-topic override surface); **C)** a dedicated mode-config
  table keyed by `(tenant, topic?)`. *Class (i)/(ii) — rides AC-D32/AC-D33.*
- **DDP-10 — Mode column default (P2.1).** **A)** default `corpus_grounded` (preserves v1.9 behaviour for
  any non-KBC tenant; KBC's row is explicitly set `llm_direct` by P2.6) *(lean)*; **B)** default
  `llm_direct` (new primary as the global default). *Class (iii).*
- **DDP-11 — Routing shape (P2.2).** **A)** a mode branch inside `generate_grounded_drafts` *(lean —
  smallest diff)*; **B)** split into two fns behind a dispatcher; **C)** a strategy object. *Class (ii).*
- **DDP-12 — LLM-direct prompt registration (P2.3).** **A)** a `_prompt_variant` of the existing
  `pill_generation` op (keeps the SPEC §6 ops-count invariant — no count sweep) *(lean)*; **B)** a new
  `Operation` (trips the ops-count invariant → spec amendment). *Class (ii).*
- **DDP-13 — LLM-direct provenance representation (P2.4).** **A)** **no** provenance rows (empty chain;
  oversight read-facets degrade to empty) *(lean — simplest, honest)*; **B)** a single **synthetic
  "model_training" provenance row** (gives the oversight read a non-empty "grounded on training" facet) —
  requires the nullable `corpus_chunk_id` coordinated with P3.4. *Class (i)/(ii) — defines AC-CD27.*
- **DDP-14 — LLM-direct confidence formula (P2.5).** **A)** a graded cross-model agreement score (e.g.
  fraction of self-review passes agreeing, scaled) replacing the flat `_NO_GROUNDING_BASE` for LLM-direct
  *(lean)*; **B)** keep the flat base + rely on the `low_confidence` flag; **C)** a hybrid (base +
  agreement bonus). NS-7 single-provider degrade applies in all. *Class (i)/(ii) — defines AC-D30/31
  body.*
- **DDP-15 — Paywall detection heuristic (P3.1).** **A)** content heuristics (login-form/paywall DOM
  markers + minimum-body-length) *(lean — works on the 200-OK preview page the audit flagged)*; **B)**
  HTTP signals (402 / login-redirect); **C)** both. DP-10 posture (HYBRID) is settled; this is the
  *detection mechanism*. *Class (ii).*
- **DDP-16 — Paywalled-flag storage (P3.1).** **A)** a new `CorpusChunk.paywalled` boolean column
  (migration) for the DP-10 tier-cap arm *(lean)*; **B)** encode via the tier alone (T2-cap, no explicit
  flag). *Class (ii) — rides AC-CD28.*
- **DDP-17 — Contradiction detection mechanism (P3.2).** **A)** embedding-distance among T1 chunks (cheap,
  reuses stored embeddings) *(lean)*; **B)** an LLM cross-check pass (a 4th self-review variant — cost +
  ops-count interaction); **C)** both. DP-11 posture (surface-to-oversight) settled. *Class (ii).*
- **DDP-18 — Demoted-host filter placement (P3.3).** **A)** an in-SQL join/`NOT IN` against `denied_hosts`
  (bounded, no full scan) *(lean)*; **B)** a post-query Python filter (mirrors the acquisition-side
  `filter_demoted` shape). *Class (ii).*
- **DDP-19 — Shared nullable-column migration ownership (P2.4 ↔ P3.4).** **A)** P3.4 owns the one
  migration making `corpus_chunk_id` nullable + SET NULL; P2.4 (if it chooses the synthetic row, DDP-13)
  **reuses** it — sequence P3.4's migration first or fold both into one *(lean — the OV-33 amend-once
  discipline)*; **B)** P2.4 owns it; **C)** two separate migrations (rejected — double-touch risk).
  *Class (ii).*
- **DDP-20 — Confidence-recompute trigger (P3.5).** **A)** synchronous in `rollback_source` (v1 volume is
  small) *(lean)*; **B)** an enqueued task (future volume). *Class (iii).*
- **DDP-21 — Tenant-threading shape (P4.1; the parent's CA-11).** **A)** a per-fn `tenant_id` parameter
  threaded explicitly *(lean — most local, testable)*; **B)** a context-var/middleware-resolved tenant;
  **C)** a centralized resolver reconciled with AC-CD5's "auth one-file-swap" intent. The audit's Pass-2
  Axis-2 names the AC-CD5 tension explicitly. *Class (ii)/(iv).*
- **DDP-22 — Per-tenant mode config surface (P4.3).** **A)** an admin REST endpoint *(lean)*; **B)**
  settings-row only (no endpoint, ops-set); **C)** a FE surface (FE-scope — defer). *Class (ii)/(iii).*
- **DDP-23 — Version bump (P5.1).** DP-5 settled **v1.10**; the slice records the ratified call. **A)**
  v1.10 *(settled)*; surfaced only to confirm the version string lands consistently across the doc
  mirrors. *Class (iv).*
- **DDP-24 — Carry-forward ledger location (P5.2).** **A)** a root `CARRY_FORWARD.md` *(lean — matches the
  audit's "discoverable in-repo" ask)*; **B)** a section appended to an existing canonical doc. *Class
  (iv).*
- **DDP-25 — Audit-doc path (P5.3).** **A)** keep `plans/` (the existing location) *(lean — least churn)*;
  **B)** a new `audits/` directory. *Class (iv).*
- **DDP-26 — Generated-draft approval queue (P5.4).** **A)** extend `/pill-proposals` listing + `/approve`
  to also surface pending `pill_generation` tasks (one unified admin queue across both origins — they
  already share `auto_publish_draft`) *(lean)*; **B)** a new dedicated queue endpoint for generated
  drafts; **C)** reuse the existing per-`pill_proposal` path only and route generated drafts through it.
  **This is a real gap**: today `/approve` (`catalogue.py:378`) operates on `pill_proposal` tasks, while
  generated drafts are `pill_generation` tasks — the gated pilot needs an admin queue that lists the
  latter. *Class (ii)/(iii).*

---

## 11. Surfaced governance + scope items (overseer lane)

- **OPEN-G1 — Whole-doc vs slice-iterative convergence (§0.1).** This detail plan is authored **whole-doc**
  (one global three-party convergence), diverging from PR #108's slice-iterative seals because it refines
  an already-decomposed parent. *Surfaced for overseer ratification* — confirm whole-doc, or direct
  per-slice seals. *Class (iv) — governance precedent.*
- **OPEN-G2 — Binding-pause candidates (§3.2).** Per `SESSION_START.md`, the auto-continue default applies
  unless a phase opener declares binding pauses. **P2.1** (the `generation_mode` schema + the dual-path
  routing flip) and **P4.1** (the ~8-module tenant-threading refactor) are foundational/irreversible
  surfaces where a pre-slice binding-pause review may be warranted. *Surfaced for the phase openers /
  spec author to declare; not baked.* *Class (iii).*
- **OPEN-G3 — Confirm the §4 amendment-PR set + ordering.** The eleven amendment PRs (AMD-A…AMD-K) and
  their slice-blocking map are the planner's surfacing of the Gate-2 dependency; the spec author confirms
  the set, the authoring order, and the amend-once groupings (AMD-C across P2.5+P3.5; the P2.4↔P3.4
  migration). *Class (i)/(ii).*

---

## 12. Pilot-launch-blocker vs post-launch map (DP-8 settled)

Per DP-8 (settled, §0.3): the **pilot launch-blockers** are **all of Phase 1 + all of Phase 2 + P5.4**
(the gated-pilot disposition). **Phase 3 (corpus maturity) and Phase 4 (multi-tenant) are future-tenant
work and do NOT block the pilot launch.** Phase 5's P5.1/P5.2/P5.3 are hygiene (not launch-blocking);
**P5.4 is launch-blocking** (it formalises the gated-pilot publish posture the pilot ships on).

| Launch-blocking (must land before pilot) | Post-launch (future-tenant / hygiene) |
|---|---|
| P1.1–P1.6 (drain wired, locks, cap, clamp, e2e tests, observability) | P3.1–P3.5 (corpus maturity — future tenants) |
| P2.1–P2.6 (LLM-direct mode — the pilot content path) | P4.1–P4.3 (multi-tenant prep — pre-second-tenant) |
| P5.4 (gated-pilot disposition: autopublish off, `/approve` queue) | P5.1, P5.2, P5.3 (SESSION_START refresh, carry-forward ledger, audit-path) |

*Surfaced for spec-author ratification — confirm or adjust the blocker set.*

---

## 13. Out of scope (this PR) + post-deploy deferred

**Out of scope of this detail-plan PR:**
- Authoring any anchor/spec amendment (AMD-A…AMD-K) — the **spec author** authors those (Gate 2, §0.2);
  a **fresh** session implements each execution slice against them.
- Any code under `app/` or `frontend/`, any spec/anchor/SESSION_START edit — this PR is **`plans/**`
  only** (the detail-plan doc + the planner wake-log).
- Flipping draft→ready or merging (the **overseer's** actions; the planner never does either).

**Post-deploy DEFERRED (R4 / parent §10 — tracked, NOT in this workstream's scope):** unbounded scans +
N+1s (P1-#5), cardinality/unbounded growth (P1-#6), DNS rebinding (P1-#12), decompression ratio (P1-#13),
F3 model-name wording (P1-#14), free-form rollback inputs (P2-#12), code/schema rollback ordering
(P2-#13), English-centric embeddings/content-type trust (P2-#14), ZA-construction seed-coupling removal
(P2-#11), **AI cost idempotency (P1-#7 — DP-9 settled deferred)**. All recorded in the P5.2
carry-forward ledger so they remain discoverable.

---

## Loop mechanics (role files §4–§8)

- **PR posture:** opened **non-draft** per the session-opener instruction (deliberate deviation from role
  §4.3's draft default; surfaced here + in the PR body). Class **(iv) ratification-class** (§0.2): does
  **not** auto-merge on the three-sign-off gate; requires explicit spec-author ratification of the §0.3
  settled-rulings recording + the §10 slice-DP resolutions + the §8/§4 anchor numbering + the §3
  sequencing + the §12 launch-blocker map, through the authenticated channel, before the overseer
  executes.
- **Watcher:** `counterpart-change-detector` skill, active iteration. `SELF_EXCLUDE` = exact
  `claude/content-pipeline-detail-plan-vhfios`; `WATCH_INCLUDE` = both reviewers' branches
  (`claude/content-pipeline-plan-audit-hkn81t` + `claude/content-pipeline-plan-overseer-rwr61c`),
  backstopped by the broad new-ref arm + a manual `git ls-remote` scan at each re-arm. Proactive re-arm
  ~25 min; the planner is the standing re-initiator.
- **On every wake:** `git ls-remote` + fetch + diff reviewer commits **and** read **both** reviewers' PR
  comments (the watcher is comment-blind); verify each finding against the live text; fold or push back.
- **Each revision:** set-diff gate (role files §6, keyed on the reviewers' `A-*`/`OV-*` IDs) → commit the
  plan change → one wake-log line in the same commit
  (`plans/.wake-log-content-pipeline-detail-planner.md`, per-thread `X/5`).
- **Convergence:** three sign-offs at one whole-doc content-SHA + the three-layer green gate + **explicit
  spec-author ratification** (class (iv)) + the override window (collapsed to zero by a present spec
  author) → the **overseer** flips draft→ready (moot if non-draft) and squash-merges. The planner
  **never** flips draft→ready and **never** merges; stays subscribed through merge; stands down only on
  merge verified via `git ls-remote`.
