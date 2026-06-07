# Plan — AI pill generation + autonomous gap-detection workstream (SPEC §6.5)

**Status: draft — under multi-party review**

Role: this is the **planner's** plan artifact, authored as a draft PR and hardened through the
independent **plan-auditor** (content correctness) and **plan-overseer** (workflow-governance
correctness) loop per `.claude/roles/*.md`, bound to Acumen by `plans/REQUIRED_READING.md`.

Scope handed by the spec author: author a workstream plan covering **both** paths of Acumen's
AI content-generation gap — **Path 2** (AI pill *generator*: topic → N pill drafts) and **Path 3**
(SPEC §6.5 *autonomous gap-detection*). Scope both, identify the dependency, recommend execution
sequencing, and **surface** spec-author decisions for new `AC-D` anchors, new `AC-CD` anchors for
API contracts, and prompt-registry versions — this plan **does not bake** those decisions (role
files §7).

> **Nature of this plan.** Both paths sit **beyond the locked P0–P11 / FE-1–FE-9 build** and
> require **ratification-class** changes (AC-D mint/amend, AC-CD mint, SPEC/§5/§8.9 amendment —
> `REQUIRED_READING.md` §7 (i)/(ii)/(iii)/(iv)). Per role files §7 the planner **surfaces, does not
> bake**. So this is primarily a **scoping + dependency + sequencing + decision-surfacing** plan,
> not a ready-to-cut slice list. The slice breakdown in §6 is **conditional** on the §7 surfaced
> decisions being ruled; no code lands until a *fresh* session implements against the
> spec-clarification PR(s) the rulings produce (`SESSION_START.md` — "Spec drift is surfaced, never
> silently resolved").

---

## 1. Context / why

Acumen's catalogue governance is **hybrid** by **AC-D7**: *"admin seeds and curates the catalogue
with AI proposals; **AI extends autonomously as new gaps surface**."* Two of the three legs of that
promise are unbuilt. The prior investigation sessions framed the gap as three paths; this plan
covers the two that remain:

- **Path 2 — AI pill GENERATOR (topic → N pill drafts).** The promise is *generation*: an actor
  (admin, or — via Path 3 — a cron) supplies a **topic prompt**, and the AI decomposes it into
  **N candidate pills**, each grounded in reference material and carrying a **per-band difficulty
  decomposition**. What exists today is a **refiner**, not a generator (see §3).

- **Path 3 — SPEC §6.5 autonomous gap-detection.** The promise is *autonomy*: the AI **watches
  signals** (failed Testee discovery searches, uncategorised/weak question pill-tags, admin
  scope-clarifications), detects coverage gaps, and **emits pill proposals when gaps appear** —
  with no admin prompt. §6.5 specifies this operation; **none of its signal-capture, gap-detection,
  or autonomous-trigger machinery is built** (see §3).

The two paths **share infrastructure** (the prompt registry, `processing_tasks` persistence, the
approve/reject pipeline, RAG/web-search grounding, the safety auto-tag) and Path 3 **builds on**
Path 2 — Path 3 produces a topic/evidence *signal* that it then feeds to the Path-2 generator. The
dependency and the sequencing recommendation are in §5.

---

## 2. Verify-before-write — current-state evidence (role files §4.2)

Every "missing / unbuilt" claim below is read from the **live tree** at this SHA, with `file:line`
citations, never inherited from the scope.

### 2.1 What the spec promises

| Spec surface | Promise | Cite |
|---|---|---|
| **SPEC §6.5 Pill proposal** | *"Analyses recent test generation and Testee behaviour to surface coverage gaps."* Inputs: *recent generated questions + pill tags; recent Testee discovery searches that returned no good match; recent assignments where admin manually clarified scope.* Output: *proposed new pills with rationale … self-applied safety classification.* | `SPEC.md:340–348` |
| **AC-D7** | *"AI extends autonomously as new gaps surface."* + *"New pill proposals surface in admin's review queue … When a new pill is approved, an incremental bootstrap auto-runs per AC-D23."* | `DECISIONS.md:201,205` |
| **AC-D21** | Generated pills carry AI **safety self-classification**; auto-tag at creation. | `DECISIONS.md:529,535` |
| **AC-D5 / §6.1** | Per-band difficulty is the existing axis for **question** generation (range 1–10, five bands per AC-D9). | `SPEC.md:300–306`, `DECISIONS.md:233–243` |
| **§8.9 crons** | **Seven** autonomous crons enumerated; *none* runs pill proposal / gap-detection. | `SPEC.md:477–485` |

### 2.2 What is actually built — the refiner, not a generator

- **Prompt is a refiner.** `app/ai/prompts/pill_proposal.py` (`VERSION = "1.0.0"`) takes a
  **single admin-supplied** `name` + `description` + `subject_id` + difficulty range and asks the
  model to *"Evaluate fit, clarity, and safety relevance"* — i.e. polish one human-seeded pill. It
  does **not** accept a topic, does **not** emit N drafts, does **not** ground in references, does
  **not** decompose difficulty per band (`pill_proposal.py:22–53`).
- **Domain call is single-shot.** `enqueue_pill_proposal()` makes **one**
  `provider.generate(Operation.pill_proposal, …)` call from one `name`/`description` and persists
  **one** `ProcessingTask` (`app/domain/catalogue.py:488–544`).
- **Endpoint is admin-prompted.** `POST /v1/pill-proposals` requires the admin to supply
  `subject_id` + `name` (+ optional description / difficulty); it is the **only** caller of
  `enqueue_pill_proposal` (`app/routers/catalogue.py:330–352`; sole caller confirmed by grep).
- **Approval pipeline exists and is reusable.** `approve_pill_proposal()` materialises the pill,
  re-runs the keyword safety auto-tag, honours the AI safety self-classification
  (`app/domain/catalogue.py:567–613`); `reject_pill_proposal()` at `:616`. Frontend queue
  (list / approve / reject, status-derived filter) is built:
  `frontend/src/app/(authed)/(admin)/admin/catalogue/_components/proposals-tab.tsx`. **There is no
  topic-prompt "generate pills" entry surface** — the queue only consumes proposals that already
  exist.

**⇒ Path 2 finding:** the *output half* of §6.5 (a queued, approvable proposal) is built as a
**one-in-one-out refiner**. The *generator* (topic → N grounded, band-decomposed drafts) is
**missing**.

### 2.3 What is actually built — the autonomy machinery (none)

- **No signal capture.** The discovery endpoint accepts a `search` query param
  (`app/routers/catalogue.py:288–300`) but **nothing persists a search that returned no/poor
  match** — `list_discoverable_pills` just filters and returns (`app/domain/catalogue.py:261`).
  No "uncategorised question pill-tag" store; no "admin scope-clarification" capture. Grep of
  `app/models.py` for signal/discovery/proposal tables returns **only** `processing_tasks`
  (`app/models.py:1174`). So **all three §6.5 input signals are unrecorded** — there is nothing
  for a gap-detector to read.
- **No autonomous trigger.** `app/beat_schedule.py` registers exactly **seven** tasks
  (`grade_review.reconcile`, `realism.aggregate`, `drive_rag.ingest`, `calibration.run`,
  `safety_links.check`, `cost.budget_sweep`, `engagement.sweep` — `beat_schedule.py:40–77`),
  matching §8.9. **No gap-detection / pill-proposal cron exists.** The proposal op runs **only**
  when an admin hits the endpoint.
- **Incremental bootstrap-on-approve is unwired.** AC-D7 says an approved pill auto-runs an
  incremental AC-D23 bootstrap; `run_bootstrap` is called **only** from the manual admin trigger
  (`app/routers/admin.py:349`), **not** from `approve_pill_proposal`. A pill created via approval
  gets **no anchor pool** until the operator next runs the full bootstrap.

**⇒ Path 3 finding:** §6.5's *signal-analysis half* — the part that makes the proposal **autonomous
and gap-driven** — is **entirely unbuilt**, and three pieces it depends on (signal capture, the
cron, incremental bootstrap-on-approve) are missing.

### 2.4 Shared infrastructure both paths reuse (built — do not rebuild)

| Capability | Surface | Cite |
|---|---|---|
| Provider abstraction + `Operation` enum | `Operation.pill_proposal` → `generate` → Anthropic | `app/ai/provider.py:121–155` |
| Versioned prompt registry (AC-CD8) | `app/ai/prompts/` + embedded `VERSION`, persisted in provenance | `app/ai/prompts/README.md`, `catalogue.py:530–537` |
| Async persistence (AC-CD7) | `processing_tasks` + status + `payload` JSON provenance | `models.py:1174`, `CODE_SPEC.md:195` |
| Approve / reject + audit pipeline | `approve_pill_proposal` / `reject_pill_proposal` | `catalogue.py:567–639` |
| RAG retrieval for grounding (AC-D22) | `drive_rag.retrieve_for_generation` | `app/ai/prompts/generation.py:16–22` |
| Web search (AC-D21, safety links) | `app/domain/web_search.py` (candidate grounding source) | (module present) |
| Safety auto-tag (AC-D21) | keyword + AI self-classification at create | `catalogue.py:586–596` |
| Incremental bootstrap (AC-D23) | `run_bootstrap` idempotent orchestrator | `app/domain/bootstrap.py:64` |

**No halt-class condition is triggered for *authoring this plan*** (`REQUIRED_READING.md` §5): the
scope maps to the live tree and is internally coherent. The scope is **workable as a planning
scope**. It is *not* yet workable as a *build* scope — the §7 decisions are genuine spec gaps that
must be ruled first; that is a surface (role files §7(a)/(b)), not a `plan-unworkable` halt.

---

## 3. Path 2 — AI pill generator (topic → N drafts)

**Goal:** a new generation capability — input a **topic prompt** (+ optional parent subject, target
count, difficulty envelope, seed reference material); output **N candidate pill drafts**, each
with: name, description, parent subject, **per-band difficulty decomposition**, **grounding refs**
(citations to the material the draft was grounded in), safety self-classification (AC-D21),
rationale, and — per the **§6.5 output + quality bar** (`SPEC.md:346,348`) — an **`evidence count`**
and an explicit **cited gap signal** ("must cite the specific gap signal"; admin evaluates in 30 s).
For admin-driven Path-2 generation the evidence is the topic prompt + grounding refs; for
Path-3-driven generation it is the captured signal(s) that opened the gap (§4). Each draft lands as
a `processing_tasks` row in the **existing** approve/reject queue.

**Shape (conditional on §7 rulings):**

1. **A new prompt-registry entry** for *generation* (distinct input/output contract from the
   `pill_proposal` *refiner*) — see surfaced decision **G1** (extend vs. mint a new `Operation`)
   and **G7** (prompt-registry versioning).
2. **Grounding** — the generator retrieves reference context for the topic (Drive RAG via
   `retrieve_for_generation`, and/or web search) and emits **per-draft citations** so the admin can
   evaluate provenance — see **G4**.
3. **Per-band difficulty decomposition** — each draft carries the difficulty **range** that drives
   `_expand_supported_bands` (`calibration.py:304`) and therefore the per-band anchor-pool sizing at
   bootstrap. Decision on whether drafts carry richer per-band metadata than the current
   `available_difficulty_min/max` pair — see **G3**.
4. **A generation endpoint** (topic → N queued drafts) — new API contract, new `AC-CD` — see **G6**.
5. **Persistence reuse** — N drafts persist as N `processing_tasks` rows (the queue, the frontend
   tab, approve/reject all reused unchanged); the generation provenance (prompt version, tokens,
   cost) lands in `payload` exactly as the refiner does (`catalogue.py:530`).

**Frontend:** a "Generate pills from a topic" entry surface in the admin catalogue (the proposals
queue already renders the resulting drafts). This is an **FE** addition governed by the FE anchor
family (AC-CD20–24) — its own slice, surfaced under **G8** for scope.

---

## 4. Path 3 — autonomous gap-detection (SPEC §6.5)

**Goal:** close the *signal-analysis half* of §6.5 so proposals become **autonomous and
gap-driven**, feeding the Path-2 generator with no admin prompt.

**Shape (conditional on §7 rulings):**

1. **Signal capture (new) — the foundational sub-gap.** Persist the three §6.5 inputs:
   (a) **failed discovery searches** (the `search` param that returned no/poor match —
   `catalogue.py:261`); (b) **uncategorised / weak question pill-tags** from recent generation;
   (c) **admin scope-clarifications** on assignments. None exist today (§2.3). New table(s) /
   columns ⇒ SPEC §5 + AC-CD4 data-model amendment + new `AC-CD` — see **G5**.
2. **Gap-detection analysis (new)** — a periodic job reads the captured signals, clusters them into
   candidate *topics*, and **invokes the Path-2 generator** for each gap topic. This is the
   structural reason Path 3 depends on Path 2 (§5). **Dedup / idempotency is a first-class
   requirement of this job, not an afterthought** (auditor A-2): a repeated cron pass must **not**
   re-propose a gap already covered by an existing pill or an open/pending proposal — it dedups
   against (a) the live catalogue, (b) the `processing_tasks` open/pending proposal queue, **and (c)
   already-rejected / admin-dismissed gaps** before generating, and a signal that produced a
   proposal is marked consumed/decayed so it does not re-fire. **Admin rejection is durable across
   passes** (auditor A-2r): a rejected gap is **not** re-proposed on a later pass merely because new
   per-signal evidence decayed in — the consume/decay marking is per-signal, so durable rejection is
   a *separate, gap-keyed* suppression. The one sanctioned exception is materially-stronger fresh
   evidence past a threshold, which **may** re-surface a previously-rejected gap **but only carrying
   a "previously rejected" marker** so the admin re-evaluates with that context, never cold. Without
   all three dedup arms the queue floods and the §6.5 "evaluate in 30 s" bar is defeated. The dedup
   *mechanism* (gap-key shape, decay window, consumed/rejected marking, the re-surface threshold) is
   a build-design detail folded here as a stated requirement; if it forces a new column it rides
   **G5**.
3. **Autonomous trigger (new cron)** — an **eighth** beat task. This collides with the load-bearing
   **"seven crons"** invariant mirrored across `SPEC.md:477`, `CODE_SPEC.md` (AC-CD7),
   `ROADMAP.md` P11, `CHECKLIST.md`, `SESSION_START.md` — changing it is a spec amendment with a
   mirror-sweep (`SESSION_START.md` in-body-override rule) — see **G9**.
4. **Incremental bootstrap-on-approve (AC-D7/AC-D23, currently unwired)** — wire
   `approve_pill_proposal` → incremental `run_bootstrap` so an approved (generated) pill gets its
   anchor pool. In scope here or split? — see **G10**.

---

## 5. Dependency & sequencing recommendation

**Dependency (verified, not asserted):** Path 3's gap-detector has *no generation primitive to
call* today — the only existing pill-creating AI path is the **refiner**, which **requires an
admin-supplied `name` + `description`** (`catalogue.py:488`, `pill_proposal.py:27–28`). A cron has
neither. So Path 3's autonomous loop is **structurally blocked** on Path 2's *topic → drafts*
generator. **Path 2 is the foundation; Path 3 layers signal-capture + trigger on top of it.**

**Recommendation: ONE workstream, sequenced as a dependent chain** (not two independent
workstreams, not collapsed into one PR):

- **Stage A — Path 2 generator** (the shared primitive): prompt entry + grounding + band
  decomposition + generation endpoint + admin entry surface.
- **Stage B — Path 3 signal capture**: the three signal stores (the part with the largest
  data-model surface; independently testable; produces the evidence even before the loop closes).
- **Stage C — Path 3 gap-detection + cron**: the analysis job that consumes Stage B signals and
  drives the Stage A generator, on the new cron.
- **Stage D — incremental bootstrap-on-approve** (AC-D7/AC-D23 closure): small, can ride Stage A or
  be the last link.

Rationale for one *sequenced* workstream over a split: the paths share the prompt registry,
persistence, and approval pipeline, so splitting duplicates the spec-amendment overhead and risks
the two halves landing against divergent contracts. Rationale for *sequencing* over one PR: Stage A
is a usable, shippable capability on its own (admin-driven generation) and gives Stage C a stable
primitive to call; per `SESSION_START.md` "one PR per phase", each stage is its own squash PR.
**This maps to the `REQUIRED_READING.md` §7 "sequenced ratification cycle"** (spec-amendment PR(s)
→ gated execution PR(s)) — the precedent is PR #96 (spec amend) → next workstream Slice 1.

*The split-vs-single question is itself **G-SEQ**, surfaced — the spec author owns the final
scope-shape call (role files §7(a), `REQUIRED_READING.md` §7(iii)).*

---

## 6. Conditional slice breakdown (NOT authorised until §7 is ruled)

Shown so the auditor/overseer can size the work; **no slice cuts code before the spec-clarification
PR(s) land and a fresh session implements** (`SESSION_START.md`).

- **A1** — new generation prompt entry + `Operation` wiring + provider stub (`AC-CD15` zero-network
  test) — gated on **G1, G7**.
- **A2** — grounding retrieval (RAG/web-search) + per-draft citations — gated on **G4**.
- **A3** — N-draft fan-out + `processing_tasks` persistence + band decomposition — gated on **G3**.
- **A4** — generation endpoint (router, thin) + envelope/authz — gated on **G6**.
- **A5 (FE)** — admin "generate from topic" surface — gated on **G8**.
- **B1** — discovery-search-miss capture (table + write at `catalogue.py:261`) — gated on **G5**.
- **B2** — question-tag + admin-scope-clarification capture — gated on **G5**.
- **C1** — gap-detection analysis job (signals → topics → generator) — gated on **G2, G5**.
- **C2** — eighth cron registration + beat schedule + mirror-sweep — gated on **G9**.
- **D1** — incremental bootstrap-on-approve wiring — gated on **G10**.

---

## 7. Surfaced spec-author decisions (open — awaiting ruling; this plan bakes none)

Surfaced per role files §7 and `REQUIRED_READING.md` §7. Each is **ratification-class** (anchor
mint/amend, spec amendment, or scope decision) and is held **pending** — no default is baked; the
loop proceeds on the non-baked, already-sanctioned framing (scoping/sequencing) while these wait.
Each will additionally be posted as a tagged PR comment addressed to the spec author.

**Ratified — scope boundary (class (iii), authenticated in-session channel, 2026-06-07).** The
spec author has **ratified** the path-scope boundary through the direct authenticated channel
(role files §8.3): **Paths 2 and 3 are in scope; Path 1 (the single-pill refiner pre-deploy hack)
is out of scope.** This was previously asserted in §9 as a settled hand-off on *inferred* grounding
— a §8.3-pending state (auditor **A-3** / overseer **OV-3**); it is now a citable, authenticated
ruling and is **resolved**. This ratifies **only** the scope boundary; it is **not** blanket
ratification of the 12 items below (see the per-item note after the table, and §8 OV-1). §9 is
updated to cite this ruling rather than the inferred hand-off.

| ID | Class | Decision to rule | Why it's the spec author's |
|---|---|---|---|
| **G1** | AC-CD8 / AC-D7 | Does the Path-2 generator **extend** `Operation.pill_proposal` or **mint a new operation** (e.g. `pill_generation`)? Refiner (name+desc→1) and generator (topic→N) have **different input/output contracts**. | Anchor change — `REQUIRED_READING.md` §7(i)/(ii). |
| **G2** | SPEC §6.5 | §6.5 conflates **signal-analysis** and **proposal-output**; the build implemented only the output half (as a refiner). Amend §6.5 to separate (a) signal capture, (b) gap-detection, (c) generation, (d) approval? | Spec amendment — §7(ii). |
| **G3** | AC-D9 / AC-CD4 | "Per-band difficulty decomposition" — does a generated draft carry only the existing `available_difficulty_min/max` range, or richer per-band metadata (e.g. per-band anchor-pool intent per AC-D20)? | Anchor/data-model — §7(i)/(ii). |
| **G4** | AC-D21 / AC-D22 | **Grounding refs** — reuse Drive RAG (`retrieve_for_generation`, may be empty/topic-irrelevant) and/or **web search** for generation grounding? Web search is currently **AC-D21-scoped to safety links**; using it for generation is a new use. | Anchor scope — §7(ii). |
| **G5** | SPEC §5 / AC-CD4 | **Signal-capture data model** — new table(s)/columns for failed discovery searches, question-tag gaps, admin scope-clarifications. None exist (§2.3). Shape + retention. | Data-model spec amendment + new AC-CD — §7(ii). |
| **G6** | AC-CD6 | **Generation API contract** — new endpoint(s) for topic→N drafts (and any Path-3 signal-write endpoints). New `AC-CD` per the task's "new CD anchors for any API contracts". | New code anchor — §7(ii)/(iv). |
| **G7** | AC-CD8 | **Prompt-registry version(s)** — new prompt file + initial `VERSION`; if `pill_proposal` is *replaced* vs *kept*, what is its version trajectory? Persisted-version contract (`catalogue.py:533`). | Prompt-registry/precedent — §7(ii)/(iv). |
| **G8** | AC-CD20–24 | **Frontend scope** — is the admin "generate from topic" surface in this workstream or a follow-up FE phase? | Scope decision — §7(iii). |
| **G9** | SPEC §8.9 + mirrors | **Eighth cron** breaks the load-bearing "seven crons" invariant mirrored across SPEC/CODE_SPEC/ROADMAP/CHECKLIST/SESSION_START — amend + mirror-sweep. | Spec amendment w/ precedent — §7(ii)/(iv). |
| **G10** | AC-D7 / AC-D23 | **Incremental bootstrap-on-approve** (currently unwired, §2.3) — close it inside this workstream or as a separate fix? | Scope decision — §7(iii). |
| **G-SEQ** | scope | **One sequenced workstream vs. a split** (§5 recommends one sequenced chain) — confirm or override. | Workstream scope — §7(iii). |
| **G-PHASE** | ROADMAP | This is **post-P11** new capability — new ROADMAP phase(s) (e.g. P13/P14) or a named non-phase workstream? | Roadmap/scope — §7(iii). |

**Per-item ratification (overseer OV-1).** The 12 items above (G1–G10, G-SEQ, G-PHASE) each require
their **own** explicit, item-specific, authenticated ratification (role files §8.3 — authenticated /
explicit / current) **before the downstream amendment/execution PR that depends on them proceeds**.
They are ratified **per item, when their downstream PRs open** — not in bulk here. Merging *this*
plan-doc PR ratifies **none** of them, and a blanket "I approve the plan" is **not** ratification of
any embedded decision (§8, gate 2). The scope-boundary ruling recorded above is the **one** §7 item
ratified so far; the other 12 remain surfaced-but-unruled.

---

## 8. Loop mechanics (role files §4–§8)

- **Watcher:** `counterpart-change-detector` skill, active iteration. `SELF_EXCLUDE` = exact
  `claude/gallant-turing-geu9e`; `WATCH_INCLUDE` = the **actual reviewer ref-space this loop** —
  `claude/(sleepy-knuth-X42DU|happy-curie-xs4vy)` (auditor `claude/sleepy-knuth-X42DU`, overseer
  `claude/happy-curie-xs4vy`), **verified from `git ls-remote`** (auditor A-4 / overseer OV-2: the
  PR-#104-inherited `plan-auditor|plan-overseer` token matched **neither** `claude/<random>`
  branch, leaving the watcher blind to reviewer pushes). Reviewer branches in this repo use
  `claude/<random>` naming, **not** role-named tokens — so the include is scoped to the literal
  branch names, backstopped by the broad arm + a **manual pre-existing-ref scan at every (re-)arm**
  to catch any reviewer re-branch. Tight poll cadence; proactive re-arm ~25 min; dormancy bound 2
  watcher lifetimes (~1h, `REQUIRED_READING.md` §7) — planner is the standing re-initiator and does
  not stand down on the bound. *(The live armed watcher was re-configured to this include in the
  same revision — the plan text and the running watcher now agree.)*
- **On every wake:** `git ls-remote` + fetch + diff reviewer commits **and** read both reviewers'
  PR comments (watcher is comment-blind); verify each finding against the live text; fold or push
  back.
- **Each revision:** set-diff gate (role files §6) → commit the plan change → one wake-log line in
  the same commit (`plans/.wake-log-pr<N>-planner.md`, per-thread `X/5`).
- **Final marker:** content-invariant `Status: final — approved by planner` commit on this canonical
  branch + an approval comment, bound to the SHA.
- **Convergence — two distinct gates (overseer OV-1; do not conflate).**
  - **Gate 1 — this plan-doc PR's own merge is NORMAL class.** The diff is `plans/**`-only and
    bakes **no** ratification-class change (it surfaces, it does not amend a spec or anchor), so it
    is **auto-merge eligible**: three sign-offs at one SHA + the **three-layer green gate** (CI +
    Gitar + mergeable, `REQUIRED_READING.md` §7) + the **24h override window** (which **is** the
    spec author's checkpoint on the plan, collapsing to zero if the spec author is present) → the
    **overseer** flips draft→ready + squash-merges. Merging the plan **executes nothing, amends no
    spec, and ratifies no §7 item.**
  - **Gate 2 — each §7 decision is ratified separately, downstream.** The 12 surfaced items
    (G1–G10, G-SEQ, G-PHASE) each require **explicit, item-specific, authenticated, current**
    ratification (role files §8.3) **before the downstream amendment/execution PR that depends on
    them proceeds**. A single "I approve the plan" is **not** blanket ratification of the embedded
    decisions — the relayed/blanket-ratification failure §8.3 guards against. (The scope-boundary
    item in §7 is the one already ratified, via the authenticated in-session channel.)
- The planner **never** flips draft→ready and **never** merges; stays subscribed through merge;
  stands down only on merge verified via `git ls-remote`.

---

## 9. Out of scope

- Authoring the spec-clarification PR(s) the §7 rulings produce — the **spec author** authors those;
  a **fresh** session implements (`SESSION_START.md`). This plan neither amends a spec doc nor an
  anchor.
- Flipping draft→ready or merging (the **overseer's** actions).
- Path 1 of the prior investigation framing (the single-pill refiner pre-deploy hack) — **out of
  scope by ratified spec-author scope decision** (authenticated in-session channel, 2026-06-07;
  recorded as the ratified item in §7, class (iii)). This replaces the earlier *inferred* hand-off
  grounding that auditor A-3 / overseer OV-3 correctly flagged as §8.3-pending.
- Any code under `app/` or `frontend/` — this PR is `plans/**` only.

---

## 10. Reviewer findings folded — round 1 (set-diff record; role files §6)

All 7 round-1 findings folded at this SHA; none was a halt-class condition; none dropped.

| ID | Reviewer | Tag | Resolution |
|---|---|---|---|
| **A-1** | auditor | Missing/Refine | §3 output contract now carries `evidence count` + cited gap signal per §6.5 (`SPEC.md:346,348`). |
| **A-2** | auditor | Refine | §4.2 makes proposal **dedup/idempotency** a first-class requirement of the gap-detection job (dedup vs catalogue + proposal queue; consume/decay signals). |
| **A-3** | auditor | Refine | Resolved by the **ratified** scope boundary (§7 ratified item; §9 updated to cite the authenticated ruling, not an inferred hand-off). |
| **A-4** | auditor | Refine | §8 watcher `WATCH_INCLUDE` corrected to the real reviewer branches; live watcher re-armed to match. |
| **OV-1** | overseer | Refine | §8 now states the **two-gate** distinction explicitly: plan-doc merge = normal class (override window is the checkpoint); each §7 item ratified separately, downstream. §7 carries the matching per-item note. |
| **OV-2** | overseer | Refine | Same fix as A-4 (concurrent catch). |
| **OV-3** | overseer | Refine | Same resolution as A-3 — scope boundary lifted to a ratified §7 item via the authenticated channel. |

**Round 2 (re-verified @ `6a6443c`):** auditor confirmed A-1, A-3, A-4 resolved; A-2 core resolved
with one residual **A-2r** (rejected-gap durability). **A-2r folded** @ this SHA — §4.2 dedup now has
a third arm covering already-rejected/admin-dismissed gaps, makes admin rejection **durable across
passes**, and allows re-surfacing only on materially-stronger fresh evidence carrying a "previously
rejected" marker (never cold). The auditor's A-3 §8.3 **authentication caveat** is acknowledged and
is the **overseer's + spec-author's** gate, not a content blocker: the in-session ruling correctly
gates **no** part of the normal-class plan-doc merge, and any downstream use requires the ruling to
reach the **overseer** through the direct authenticated channel independently — the plan does not
self-authenticate it.
