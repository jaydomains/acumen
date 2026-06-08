# Fully-autonomous AI content generation + retroactive oversight — workstream plan

**Status: DRAFT — under multi-party plan-review** (planner authoring; not yet sealed). Auditor
(content) + overseer (governance) engage per `.claude/roles/*.md`, bound to Acumen by
`plans/REQUIRED_READING.md`.

**Date:** 2026-06-08
**Branch:** `claude/modest-heisenberg-yofi1z` (this workstream-plan PR).
**Supersedes:** the human-in-loop assumptions of the **merged** detail-plan PR #106
(`plans/2026-06-07-ai-pill-generation-gap-detection-detail.md`, squashed at `9bde51f`) and its
parent workstream plan PR #105 (`741f862`). PR #106 remains the **merged-superseded record** — it is
**not** amended; this plan replaces its Stage-A/D approve-gate + Drive-grounding shape with the
ratified autonomy architecture (§0.1, §9).
**Role:** the **planner's** workstream-plan artifact — high-level shape, verified dependencies, the
conditional stage/slice breakdown, and the ratification ledger. Per-slice concrete build choices are
the future **detail-plan's** job, not this document's (precedent: #105 workstream → #106 detail).

---

## 0. What this document is, and the ratification it is built on

This workstream plan converges the **high-level shape** of a fully-autonomous AI content-generation
pipeline with **retroactive** admin oversight — a deliberate architectural pivot away from the
human-in-loop scaffolding the merged #106 plan preserved. Unlike #105/#106, whose 12 G-items were
**surfaced-but-unruled**, this plan is authored **against an architecture the spec author has already
ratified through the authenticated in-session channel** (§1). The planner still **surfaces, does not
bake** (role files §7): where a downstream design point is *not* covered by a ruling, it is surfaced
here as a residual open item (§7.2), never silently decided.

**Standing design principle (ratified, §1).** *"Balls to the wall, rein in if it breaks."* Every
downstream design call biases toward **maximum AI autonomy with reactive oversight, not preemptive
gates.** Where a choice trades autonomy for an up-front control, the autonomy-favouring option is the
default and any gate is justified explicitly or surfaced.

### 0.1 Relationship to the merged #106 detail-plan (superseded, not amended)

PR #106 detail-planned a generator (Stage A) whose drafts queued for **human approval**
(`approve_pill_proposal`), grounded against an **operator-curated Drive folder** (AC-D22), with an
**admin "generate from topic" button** as the entry surface. The ratified pivot (§1) **removes the
human approve gate**, **removes the Drive-folder dependency** (replaced by an AI-built reference
corpus), and **relegates the admin generate button to an optional manual override** — generation is
triggered autonomously by gaps + scheduled catalogue-health checks. Because the pivot reshapes the
spine rather than tweaking a slice, it is a **new workstream**, not an amendment to the merged plan
(ratified 0b, §1). §9 is the explicit carry/supersede ledger so no #106 decision silently rots.

### 0.2 Two gates — do not conflate (carried from #105/#106; overseer OV-1)

- **Gate 1 — this workstream-plan PR's own merge is NORMAL class.** The diff is `plans/**`-only and
  **bakes no ratification-class change** — it *records* rulings and *plans* work; it amends no spec,
  mints no anchor, edits no `.claude/**`. It is auto-merge eligible: three sign-offs at one SHA + the
  **three-layer green gate** (`REQUIRED_READING.md` §7) + the **24h override window** (collapsed to
  zero by a present spec author) → the **overseer** flips draft→ready and squash-merges. Merging this
  plan **executes nothing and amends no spec.**
- **Gate 2 — each downstream amendment/execution PR is ratified/authored separately.** The §1 rulings
  settle the **architecture + the six design decisions**; they do **not** pre-author the anchor/spec
  **bodies**. Each new AC-D / AC-CD mint, each SPEC §5/§6/§6.5/§8.9 amendment, and each AC-D7/D21/D22/
  D23 body change is **authored by the spec author** (`SESSION_START.md` — the implementer does not
  author the clarification) and a **fresh** session implements against it. A §1 ruling means the
  decision the amendment encodes is **pre-settled**, not that the amendment text exists.

---

## 1. The authenticated ratification record (origin: this conversation, 2026-06-08)

Ruled by the spec author through the **direct, authenticated in-session channel** (`REQUIRED_READING.md`
§7; role files §8.3 — the in-session human channel is the reference), **explicit and current**.
**PR #106 lesson stands:** ratifications draft in chat as *proposals*; the spec author's explicit
in-session confirmation is what makes them **actionable** — recorded here citing **this conversation**
as authenticated origin, exactly as #106 §0.3 cited the PR #105 review record.

| # | Decision | Ruling | Class |
|---|---|---|---|
| **0a** | Architecture | **Confirmed as recorded:** corpus builder → autonomous generation w/ provenance → gap detection → auto-publish gate → oversight dashboard. **Human approve gate removed. Drive folder removed. G4a + G4b both allowed.** | (iii) + (ii) + (i) |
| **0b** | Vehicle | **New workstream plan PR**; supersedes #106's human-gate assumptions; cite #106 as merged-superseded record; **do not amend onto it.** | (iii) |
| **1** | Confidence threshold | **Single global threshold** (counter to the planner's per-type recommendation). Rationale: don't pre-engineer per-type differential gates before data shows safety content fails at a different rate; retroactive oversight catches embarrassments; re-evaluate to per-type later **iff** dashboard data warrants. | (i) |
| **2** | Below-threshold behaviour | **Publish-with-warning + retroactive spot-check.** Everything publishes; low-confidence gets a dashboard flag. **Nothing held in a pre-publish queue — including safety-relevant.** | (i) |
| **3** | Source-authority list | **Tiered allowlist:** **T1** regulators/standards (`sabs.co.za`, `*.gov.za`, `nrcs.org.za`, `iso.org`); **T2** industry/professional bodies + recognised standards; **T3** reputable industry/educational. **Web search restricted to the allowlist; authority score by tier.** | (i)/(ii) |
| **4** | Self-review protocol | **Multi-pass + cross-model — non-negotiable safety floor.** Generation pass + independent review passes (**grounding/factual**, **safety**, **provenance**) + **cross-model verification** (Anthropic-generate / OpenAI-review where a second provider is configured). Mirrors the existing review-ops split. | (i)/(ii) |
| **5** | Rollback granularity | **Full matrix: per pill + per question + per generation batch + per source.** Per-source rollback is the killer feature for discredited-source remediation. | (ii) |
| **6** | Corpus refresh cadence | **Hybrid:** per-topic on-demand (gap-detection trigger) + admin on-demand (manual override) + **weekly periodic backstop.** | (ii) |

These rulings are **ratified**; the planner does not re-surface them. Downstream items the rulings do
**not** settle are surfaced in §7.2.

---

## 2. Current-state verification (verified against the live tree at `9bde51f`)

Per role files §4.2 — claims verified against the repo, not inherited. The pivot **reuses more
existing infrastructure than it builds net-new**:

- **pgvector + an embedding pipeline already exist.** `app/models.py:776` `DriveChunk(Base,
  TimestampMixin, AIProvenanceMixin)` carries `embedding: Mapped[list[float]] = mapped_column(
  Vector(1536))` (`models.py:795`) with an IVFFlat index, `text-embedding-3-small` default
  (`models.py:895-898`), embedding spend stamped via `AIProvenanceMixin` (AC-D22 §7.3). **The reference
  corpus builder reuses this vector-store shape**, it does not introduce pgvector.
- **The content source sits behind a Protocol.** `app/domain/drive_source.py:69` `class
  DriveSource(Protocol)` + `get_drive_source()` (`:340`); `app/domain/drive_rag.py` owns retrieval
  (`retrieve_for_generation`, `cosine_top_k:196`, `render_rag_context:587`, `_DEFAULT_TOP_K=5:580`).
  **The corpus builder is a sibling acquisition path feeding the same chunk store**; the Drive path is
  retired (ruling 0a) — its abstraction makes removal clean.
- **The cross-model self-review pattern already exists.** `app/ai/provider.py:162` `_REVIEW_DEFAULT_OPS
  = frozenset({Operation.grade_review, Operation.anchor_self_review})` routes review ops to **OpenAI**
  (`:342`); **AC-D23 already runs cross-provider AI self-review** on every generated anchor question —
  *"a second AI call (using a different provider from the generator per AC-D19 pattern) evaluates each
  anchor against quality criteria"* (`DECISIONS.md:572`). **The auto-publish gate's multi-pass +
  cross-model self-review (ruling 4) extends this established pattern**, it does not invent cross-model
  review.
- **Web search exists, AC-D21-scoped to safety links.** `app/domain/web_search.py` (`WebSearchSource`
  + `TavilyWebSearch` + `get_web_search_source()`); AC-D21 names web search *"a new external
  integration"* (`DECISIONS.md:535`). **Using it as the corpus builder's acquisition channel (ruling
  0a/3, G4b) is a new AC-D21 use** — folded into the corpus-builder amendment.
- **The approve gate is the human-in-loop surface being removed.** `approve_pill_proposal`
  (`catalogue.py:567-613`) reads `payload["proposal"]` → `create_pill(...)`, marks the task done; SPEC
  prose hard-codes the human gate — *"Proposed pills queue for admin review … Admin approves, renames,
  merges … or rejects"* (`SPEC.md:174`), *"When a new pill is approved, an incremental bootstrap
  auto-runs"* (`SPEC.md:174`, `DECISIONS.md:205` AC-D7 *Implications*, `DECISIONS.md:580` AC-D23). The
  **auto-publish gate replaces this**; the bootstrap trigger moves from approve → publish (§4.6).
- **§6.5 today is signal-analysis + a refiner output, human-gated.** `SPEC.md:340-348` §6.5 *"Pill
  proposal"* — *"proposed new pills … admin should be able to evaluate the proposal in 30 seconds"*;
  the build shipped only the refiner half. The pivot rewrites §6.5 around autonomous generation +
  auto-publish (§7.1, G2-analog).
- **Seven AI operations + seven crons are load-bearing count invariants.** `SPEC.md:296` *"seven
  distinct AI operations"*; §8.9 (`SPEC.md:473`) the cron set. The pivot adds operations (generation +
  the self-review/provenance passes) **and** crons (corpus-refresh + gap-detection + catalogue-health)
  → the **count-invariant mirror-sweeps** #106 §1.4 (ops) and §9 (crons) named **both apply here**
  (§7.1).
- **No signal store exists** (Stage B of #106 was unbuilt): grep of `app/models.py` finds no
  discovery-miss / question-tag / scope-clarification signal table. Gap-detection signal capture is
  still greenfield (§4.4, carried G5).

---

## 3. Target architecture — the five-component autonomous pipeline

```
  [T1/T2/T3 authority allowlist]
            │  web-search restricted to allowlist
            ▼
  (A) REFERENCE CORPUS BUILDER ── fetch → extract → cross-reference → embed → pgvector
            │  authority score by tier · hybrid refresh (per-topic / on-demand / weekly)
            ▼
  (B) AUTONOMOUS GENERATION ──── grounds against corpus · emits PROVENANCE CHAIN (claim → corpus doc)
            ▲          │
            │          ▼
  (D) GAP DETECTION   (C) AUTO-PUBLISH GATE ── multi-pass self-review (grounding/factual · safety ·
   signals + scheduled       provenance) + cross-model verify + single global confidence threshold
   catalogue-health           │  ≥ threshold → PUBLISH (live)   < threshold → PUBLISH-WITH-WARNING (flagged)
   checks → trigger gen        ▼
                       (F) bootstrap-on-publish (anchor pool + safety links) — reframed AC-D7/AC-D23
            │
            ▼
  (E) ADMIN OVERSIGHT DASHBOARD ── recent publishes · per-item provenance · confidence · authority
       breakdown · spot-check sampling · ROLLBACK (per pill / question / batch / source) — RETROACTIVE
```

No human step gates publication; **(E)** is retroactive oversight only.

---

## 4. Component build surfaces (workstream-level; detail-plan spends the per-slice budget)

### 4.1 (A) Reference corpus builder — *new*
Identify authoritative sources per topic from the **T1/T2/T3 allowlist** (ruling 3), web-search
**restricted to the allowlist** (`web_search.py`, new AC-D21 use), **fetch → extract → cross-reference
→ embed** into the existing pgvector store (reuse the `DriveChunk` shape, `Vector(1536)`,
`text-embedding-3-small` — `models.py:776-795`), stamping an **authority score by tier** on each
chunk. **Hybrid refresh** (ruling 6): per-topic on-demand (gap-detection trigger) + admin on-demand +
a **weekly periodic backstop cron**. Reuses `cosine_top_k`/`render_rag_context` (`drive_rag.py`) for
retrieval. New AC-CD (corpus-builder architecture) + new AC-D (source-authority scoring + allowlist).

### 4.2 (B) Autonomous generation + provenance chain
The topic→N generation primitive (the #106-carried `Operation.pill_generation` mint, G1 — §9) grounds
against the **AI-built corpus** rather than a Drive folder. **Every generated claim traces to corpus
documents** — a **provenance chain** persisted per draft (which corpus chunk(s)/source(s) grounded
each claim, with the chunk's authority tier). New AC-D (provenance chain). Generation is invoked by
**(D)**, never by a mandatory admin action.

### 4.3 (C) Auto-publish gate — *replaces `approve_pill_proposal`*
**Multi-pass + cross-model self-review (ruling 4):** a generation pass, then independent review passes
— **grounding/factual** (claims supported by cited corpus chunks), **safety** (the AC-D21 safety
floor), **provenance** (every claim resolves to a source) — with **cross-model verification**
(Anthropic-generate / OpenAI-review where a second provider is configured), extending the existing
`_REVIEW_DEFAULT_OPS` / AC-D23 cross-provider pattern (`provider.py:162`, `DECISIONS.md:572`). A
**single global confidence threshold** (ruling 1): **≥ threshold → publish live**; **< threshold →
publish-with-warning** (live + dashboard flag, ruling 2) — **nothing held pre-publish, including
safety-relevant.** Replaces the `approve_pill_proposal` human gate (`catalogue.py:567`). New AC-D
(auto-publish gate: threshold + self-review protocol).

### 4.4 (D) Gap detection + scheduled catalogue-health checks
Carries #106 Path-3: signal capture (the three §6.5 signals — discovery-miss, question-tag,
scope-clarification — none built today, §2) into a deduped signal store (carried G5), a gap-detection
sweep job clustering signals → topics with 3-arm dedup/idempotency, **plus a new scheduled
catalogue-health check** that triggers generation proactively (e.g. thin-coverage / stale-pill
sweeps), not only on Testee signals. Both drive **(B)** directly (domain-fn call, no HTTP gate).

### 4.5 (E) Admin oversight dashboard — *new*
Retroactive surface: recent publishes, **per-item provenance** display, **confidence scores**,
**source-authority breakdown**, **spot-check sampling**, and the **full rollback matrix** (ruling 5):
**per pill · per question · per generation batch · per source** (per-source = retract everything
grounded on a discredited/withdrawn corpus source). New AC-CD (dashboard API + rollback contract).
Replaces the #106 admin generate-from-topic FE as the primary admin surface (the generate button
survives only as an optional manual-override entry).

### 4.6 (F) Bootstrap-on-publish — *reframed AC-D7/AC-D23*
The incremental bootstrap (anchor pool + AC-D23 self-review + safety-link curation) — currently
unwired and assumed to fire **on approve** (`DECISIONS.md:205/580`) — fires **on auto-publish**
instead. Reuses the idempotent per-pill primitives (`generate_anchor_pool_for_pill`,
`curate_links_for_pill`); enqueued/async so publish stays fast (carried #106 D1 decision).

---

## 5. Dependency & sequencing (verified, not asserted)

**Verified dependency chain:** generation grounds against the corpus → **B depends on A**; the
auto-publish gate reviews generated content → **C depends on B**; gap detection + health checks invoke
the generation primitive → **D depends on B** (the structural Path-3-on-Path-2 dependency #105 verified
persists); the dashboard surfaces publish events + provenance + rollback → **E depends on C**;
bootstrap fires on the publish event → **F depends on C**. The provenance chain spans A→B→C→E.

**Recommendation: ONE sequenced workstream** (ratified 0b — single new PR; the #105 G-SEQ-analog is
**ruled single** by the new-workstream vehicle), each stage its own squash PR per `SESSION_START.md`
"one PR per phase":

- **Stage A — reference corpus builder** (the new foundation; ships first; independently testable).
- **Stage B — autonomous generation + provenance** (grounds against A; mints the generation op).
- **Stage C — auto-publish gate** (multi-pass + cross-model self-review + threshold; removes the
  human gate).
- **Stage D — gap detection + catalogue-health crons** (signal capture + sweep job; drives B).
- **Stage E — oversight dashboard** (retroactive surface + rollback matrix; consumes C).
- **Stage F — bootstrap-on-publish** (small; reframes AC-D7/AC-D23; rides C).

A→B→C serialise; D follows B; E and F follow C. A is shippable on its own (a self-building knowledge
base); B+C deliver autonomous live content; D closes the autonomous trigger loop; E delivers the
retroactive-oversight half the autonomy principle depends on; F closes the anchor-pool loop.

---

## 6. Conditional stage/slice breakdown (the detail-plan refines this)

| Stage | Slice (provisional) | Scope (one line) | Primary ratification surface |
|---|---|---|---|
| **A** | A1 | Source-authority allowlist + scoring registry (T1/T2/T3) | new AC-D (authority scoring) |
| A | A2 | Corpus acquisition pipeline (allowlist web-search → fetch → extract → embed → pgvector) | new AC-CD (corpus builder); AC-D21 web-search use |
| A | A3 | Hybrid refresh cron (per-topic / on-demand / weekly) + corpus retrieval helper | cron-count sweep (§7.1) |
| **B** | B1 | `Operation.pill_generation` mint + provider/stub wiring | carried G1 (§9); ops-count sweep |
| B | B2 | Corpus-grounded generation + per-draft **provenance chain** | new AC-D (provenance); AC-D22 reframe |
| B | B3 | N-draft fan-out + persistence + cost-share | carried G3 (band decomp) |
| **C** | C1 | Multi-pass + cross-model self-review protocol | new AC-D (self-review, ruling 4) |
| C | C2 | Confidence scoring + auto-publish gate (single global threshold; publish-with-warning) | new AC-D (gate, rulings 1+2); removes approve gate |
| **D** | D1–D2 | Three §6.5 signal stores + dedup | carried G5 + signal-3 feature-scope |
| D | D3 | Gap-detection sweep + catalogue-health checks → generation trigger | carried G2-analog (§6.5 rewrite) |
| D | D4 | Gap-detection + health-check crons | carried G9-analog (cron-count sweep) |
| **E** | E1 | Oversight dashboard read surface (publishes, provenance, confidence, authority) | new AC-CD (dashboard) |
| E | E2 | Rollback matrix (pill / question / batch / source) + spot-check sampling | new AC-CD (rollback, ruling 5) |
| **F** | F1 | Bootstrap-on-publish wiring (reframed AC-D7/AC-D23) | AC-D7/AC-D23 body change |

Provisional; the detail-plan makes the per-slice concrete build choices against the live tree.

---

## 7. Ratification ledger

### 7.1 Settled-by-§1 + the amendment surfaces each entails (Gate 2 authoring)

The §1 rulings settle the **design**; the spec author authors the encoding amendments, a fresh session
implements. The load-bearing **completeness obligation** (the #106 §1.4 / §9 lesson): each amendment
PR must fold **all** mirror surfaces of any count invariant it touches, by reproducible structural
grep, or it is a §7 silent partial-fold.

- **New AC-D — source-authority scoring + allowlist** (ruling 3). Class (i)/(ii).
- **New AC-D — provenance chain** (claim → corpus source). Class (i).
- **New AC-D — auto-publish gate** (single global threshold + publish-with-warning + the multi-pass/
  cross-model self-review protocol; rulings 1/2/4). Class (i)/(ii).
- **New AC-CD — reference-corpus-builder architecture** (acquisition pipeline + pgvector reuse). Class (ii).
- **New AC-CD — oversight dashboard API + rollback contract** (ruling 5). Class (ii).
- **AC-D7 body change** — `DECISIONS.md:205` *"When a new pill is approved, an incremental bootstrap
  auto-runs"* → **on auto-publish**; remove the "queue for admin review / approve" governance language
  (`SPEC.md:174`). Class (i)/(ii).
- **AC-D21 body change** — web search extended from safety-link curation to corpus acquisition
  (`DECISIONS.md:535`). Class (i)/(ii). *(Ruling 0a: G4b allowed.)*
- **AC-D22 body change** — Drive-folder ingestion retired in favour of the AI-built corpus; the
  pgvector store + `text-embedding-3-small` + "queried at every generation call" extends to §6.5
  generation (`DECISIONS.md:543-557`). Class (i)/(ii). *(Ruling 0a: Drive folder removed; G4a allowed
  for any residual curated material.)*
- **AC-D23 body change** — bootstrap-on-approve → bootstrap-on-publish; the existing cross-provider
  self-review pattern (`DECISIONS.md:572`) is cited as the precedent the auto-publish gate extends.
  Class (i)/(ii).
- **SPEC §6.5 rewrite** — from human-gated "pill proposal" to autonomous generation + auto-publish;
  separate signal-analysis / gap-detection / generation / **auto-publish** phases (the #106 **G2**
  analog, now with the approval phase reframed). Class (ii).
- **SPEC §6 + §6.5 + AC-CD8 "seven AI operations" sweep** — generation + self-review/provenance passes
  add operations (`SPEC.md:296`); run the #106 §1.4 three-class structural mirror-sweep (word /
  numeral / `dict[Operation]`/`[operation]`-subscript/op-set-floor) at execution HEAD. Class (ii).
- **SPEC §8.9 "seven crons" sweep** — corpus-refresh + gap-detection + catalogue-health crons
  (`SPEC.md:473`); run the #106 §9 three-class cron mirror-sweep. Class (ii).
- **Audit-log + governance prose** — `SPEC.md:290` "pill proposals approved or rejected" → published /
  rolled-back events. Class (ii).

### 7.2 Residual surfaced items — SURFACED, awaiting spec-author ruling (not baked)

Genuine open decisions the §1 rulings do **not** settle. Biased toward autonomy per the standing
principle, but **surfaced, not decided** (role files §7):

- **NS-1 — legacy Drive ingest: retire entirely vs keep as dormant fallback.** Ruling 0a removed the
  Drive *folder dependency*; whether the `drive_source.py`/`drive_rag.py` ingest **code** is deleted or
  kept as a dormant legacy path is unruled. **Lean: remove entirely** (carrying dead scaffolding
  contradicts "the system builds its own knowledge base"), but it is a scope call. Class (iii).
- **NS-2 — do the self-review/provenance passes mint new `Operation` enum value(s)** (e.g. a dedicated
  `content_self_review`) **or reuse the `anchor_self_review` op?** Drives the ops-count sweep magnitude.
  **Lean: new dedicated op(s)** (distinct input/output contract from anchor review), mirroring the #106
  G1 reasoning. Class (i)/(ii) (AC-CD8).
- **NS-3 — provenance-chain granularity:** per-claim (sentence/assertion-level) vs per-draft
  source-set. Ruling 0a says *"every generated claim"* → per-claim intent; the **decomposition unit**
  (what counts as a "claim") is a build-design point the detail-plan can make — **flagged, lean
  per-assertion**, surfaced if it turns out to be anchor-class.
- **NS-4 — catalogue-health-check definition:** what a scheduled health check assesses to trigger
  generation (thin-coverage bands? stale pills? uncovered subjects?). **Lean: thin-band + uncovered-
  subject sweep**; surfaced because it defines an autonomous *trigger*, a §6.5-scope question. Class (ii).
- **NS-5 — ROADMAP placement (the #105 G-PHASE analog, carried + unruled):** post-P11 — new ROADMAP
  phase(s) (e.g. P12+) or a named non-phase workstream? Class (iii). *No planner lean.*
- **NS-6 — confidence-threshold value + telemetry:** ruling 1 fixed the *shape* (single global); the
  **numeric default** + how the dashboard captures the per-type failure data that would later justify
  re-evaluating to per-type (ruling 1's "iff data warrants") is unruled. **Lean: a conservative
  default + per-type confidence telemetry from day one** so the re-evaluation has data. Class (ii).

### 7.3 Carried from #106 — still open where this workstream depends on them

#106 is superseded but several of its surfaced items are **load-bearing here and remain unruled**:
**G3** (per-band difficulty decomposition — lean min/max only), **G5** (signal-capture data model —
the Stage-D spine), **signal-3 feature-scope** (the assignment scope-clarification admin feature,
parallel-to-G8 scope call). These carry into Stage B/D and are re-surfaced by the detail-plan. #106's
**G6** (generation API contract) **transforms** — the admin generate endpoint is now optional; the
governing API contract is the **dashboard/rollback** surface (new AC-CD, §7.1).

---

## 8. Out of scope (this PR)

- Authoring the spec/anchor amendment PRs the §1 rulings + §7 items produce — the **spec author**
  authors those (`SESSION_START.md`); a **fresh** session implements each stage against them.
- Flipping draft→ready or merging (the **overseer's** actions; the planner never does either).
- Any code under `app/` or `frontend/`, or any spec/anchor edit — this PR is **`plans/**` only**
  (the plan doc + the planner wake-log).
- The per-slice concrete build choices — the future **detail-plan's** job.

---

## Loop mechanics (role files §4–§8)

- **Watcher:** `counterpart-change-detector` skill, active iteration. `SELF_EXCLUDE` = exact
  `claude/modest-heisenberg-yofi1z`; `WATCH_INCLUDE` = the auditor's + overseer's branch ref-space
  (Acumen reviewer branches use `claude/<random>` naming — scope to the actual branches once they
  appear, backstopped by the broad new-ref arm + a manual pre-existing-ref `git ls-remote` scan at
  each re-arm). Proactive re-arm ~25 min; planner is the standing re-initiator.
- **On every wake:** `git ls-remote` + fetch + diff reviewer commits **and** read both reviewers' PR
  comments (watcher is comment-blind); verify each finding against the live text; fold or push back.
- **Each revision:** set-diff gate (role files §6) → commit the plan change → one wake-log line in the
  same commit (`plans/.wake-log-pr107-planner.md`, per-thread `X/5`).
- **Convergence:** three sign-offs at one whole-doc content-SHA + the three-layer green gate + the 24h
  override window (collapsed to zero by a present spec author) → the **overseer** flips draft→ready and
  squash-merges. The planner **never** flips draft→ready and **never** merges; stays subscribed through
  merge; stands down only on merge verified via `git ls-remote`.
