# Autonomous AI content generation + retroactive oversight — granular detail-plan (slice-iterative)

**Status: in progress — Slices 1–8 (A1–A3, B1–B3, C1–C2) SEALED 3/3 — Stages A+B+C complete + the autonomous trigger
(D3); Slice 11 (D4) posted** (per-slice `Status: final for Slice N` markers accumulate as each converges;
the global `Status: final — approved by planner (all slices)` lands at the bottom only after the last
slice seals — §0.1). *Sealed SHAs: A1 `22f3d67` · A2 `5d26906` · A3 `5a6f84e` · B1 `442247c` · B2
`39273dd` · B3 `07080d1` · C1 `e46e9f5` · C2 `1afb2cf` · D1–D2 `0a85ee8` · D3 `e8e1a73`.* *(NS-7 **RULED**
degrade-not-gate, triple-authenticated — §1. Tracked pre-global-marker item: C1 §7.3 NS-7-line
reconciliation — A-45/OV-39.)*

**Date:** 2026-06-09
**Branch:** `claude/festive-tesla-p5p3ai` (this detail-plan PR — distinct from the reviewers' branches).
**Authoritative source:** the merged **workstream plan**
`plans/2026-06-08-autonomous-content-generation-workstream.md` (PR #107, squashed at `2110a56`).
**Role:** the **planner's** detail-plan artifact, authored as a draft PR and hardened through the
independent **plan-auditor** (content correctness) and **plan-overseer** (workflow-governance
correctness) loop per `.claude/roles/*.md`, bound to Acumen by `plans/REQUIRED_READING.md`.

---

## 0. What this document is, and how it relates to the workstream plan

The merged workstream plan (PR #107) **ratified the autonomy architecture** — the five-component
pipeline (corpus builder → autonomous generation w/ provenance → gap detection → auto-publish gate →
oversight dashboard), the **nine design rulings** (0a/0b + 1–6, plus the planner-surfaced NS-7
cross-ruling edge), the verified dependency chain (A→B→C; D follows B; E and F follow C), and the
**conditional stage/slice breakdown** (§6: A1–A3, B1–B3, C1–C2, D1–D4, E1–E2, F1). It deliberately
**did not** make the per-slice concrete build choices, and where a downstream design point was not
covered by a ruling it **surfaced** it (NS-1…NS-7; the carried #105/#106 G-items) rather than baking.

**This document spends the per-slice token budget now.** For each slice in sequence it makes every
concrete build choice the planner *can* make (file paths, function shapes, registry vs. DB, test
structure, edge cases, idempotency, dedup, migration shape) **against the live tree at this SHA**,
with `file:line` citations — so the executing session implements without re-discovering the surface.
Where a slice **embeds** a ratification-class item, this document **surfaces** it as a spec-author
decision needing **authenticated ratification** (role files §8.3) and marks the slice **blocked
pending ratification** — it writes the detail **against the recommended direction** so the work is
ready the moment the ruling lands (precedent: PR #85 / PR #106 Slice 1 written against the amendment
direction). **Detail-planning is not gated; only execution waits.**

> **Nature unchanged from the workstream plan.** The whole workstream sits **beyond the locked
> P0–P11 / FE-1–FE-9 build** and requires ratification-class changes (AC-D mint/amend, AC-CD mint,
> SPEC §5/§6/§6.5/§7/§8.9 amendment — `REQUIRED_READING.md` §7 (i)/(ii)/(iii)/(iv)). **No code lands
> from this PR.** This PR is `plans/**`-only. A *fresh* session implements each slice against the
> spec-clarification PR(s) the rulings produce (`SESSION_START.md` — "Spec drift is surfaced, never
> silently resolved; the implementing session does not also author the clarification").

### 0.1 Workflow — slice-iterative (precedent: PR #85, PR #106)

This is a **slice-iterative** detail-plan in **one PR throughout**. Each slice's detail section is
posted, reviewed by the auditor (content) **and** overseer (governance), and **sealed** before the
next slice's detail is pushed. Per-slice `Status: final for Slice N` markers accumulate as each
converges; the **global** `Status: final — approved by planner (all slices)` marker lands at the
bottom only after the last slice seals. Every commit carries one wake-log line
(`plans/.wake-log-pr108-planner.md`) and runs the audit-ID set-diff gate (role files §5/§6).

**Marker-binding granularity (carried from PR #106 §0.1 / OV-S1.7; role files §8 content-binding).**
Markers bind to **content**, not the raw branch-tip SHA — and the slice-iterative pattern relies on a
**per-section** reading of "content":
- A **per-slice seal** (`Status: final for Slice N` + the three parties' Slice-N sign-offs) binds to
  **Slice N's own section content**. Appending **Slice N+1's** detail section is a content change
  *elsewhere* in the doc and therefore **does not re-stale** an already-sealed Slice N. **Editing a
  sealed slice's section** (a later cross-slice fix, or revising it to a ruling) **does** re-stale
  that slice's seal and forces a re-seal at the new content.
- Per-slice seals are **interim checkpoints; they never sum to a merge authorization.** Gate 1 merge
  (§0.2) requires the **global** three sign-offs at the **final whole-doc content-SHA** + the
  three-layer green gate + the override window — a stack of per-slice seals is not a merge gate.
- **Global-marker symmetry — all three parties (overseer OV-4).** At final convergence **each** of the
  three parties posts its **own global final-marker content-bound to the final whole-doc content-SHA**:
  the planner's `Status: final — approved by planner (all slices)` (a content-invariant commit on the
  canonical branch) **and** the auditor's + the overseer's global final-markers (on their own review
  branches, content-bound). An early per-slice reviewer seal is **never** read as a whole-doc sign-off;
  the overseer (merge-executor) re-confirms **three** global final-markers at one whole-doc content-SHA
  + green + the override window — not a sum of per-slice seals.
- Reviewer markers sit **off** the canonical branch, on each reviewer's own branch
  (`REQUIRED_READING.md` §6 D3); the planner's per-slice/global markers are content-invariant commits
  on this canonical branch.

### 0.2 Two gates — do not conflate (carried from workstream plan §0.2, overseer OV-1/OV-2)

- **Gate 1 — this detail-plan PR's own merge is NORMAL class.** The diff is `plans/**`-only and
  bakes **no** ratification-class change (it surfaces; it does not amend a spec or anchor). It is
  **auto-merge eligible**: three sign-offs at one SHA + the **three-layer green gate** (CI + Gitar +
  GitHub mergeable, `REQUIRED_READING.md` §7) + the **24h override window** (collapsed to zero by a
  present spec author) → the **overseer** flips draft→ready and squash-merges. Merging this plan
  **executes nothing, amends no spec, ratifies no §7 item.**
- **Gate 2 — each embedded ratification-class item is ratified separately, downstream.** Each item a
  slice depends on requires **explicit, item-specific, authenticated, current** spec-author
  ratification (role files §8.3) **before the downstream amendment/execution PR that depends on it
  proceeds.** A single "I approve the plan" is **not** blanket ratification of any embedded decision.
  **The merged workstream §1 record is a *design record, not a substitute authenticated channel*
  (overseer OV-2):** once a ruling is needed for an execution PR, the §1 ledger (and this detail-plan)
  read as a **relay** to any downstream session under the shared role-session byline, and a relayed
  ruling is *pending, not actionable*. Each downstream amendment/execution PR **re-confirms its
  governing ratification through its own executor's authenticated channel.** The spec author may rule
  **in-session via the authenticated channel** (the in-session human channel is the reference); a
  ruling so given is recorded here citing **this conversation** as authenticated origin (not as
  relay-pending).

### 0.3 Ratified-so-far (carried from workstream plan §1 — the nine rulings)

The PR #107 §1 rulings are **ratified** (authenticated in-session origin, the 2026-06-08
conversation) and the planner does **not** re-surface them: **0a** architecture (human approve gate
removed; Drive folder removed; G4a+G4b allowed); **0b** new-workstream vehicle; **(1)** single global
confidence threshold; **(2)** publish-with-warning + retroactive spot-check (nothing held pre-publish,
incl. safety-relevant); **(3)** tiered source-authority allowlist T1/T2/T3, web search restricted to
the allowlist, authority score by tier; **(4)** multi-pass + cross-model self-review (non-negotiable
safety floor); **(5)** full rollback matrix (pill/question/batch/source); **(6)** hybrid corpus
refresh. These settle the **design**; the spec author authors each encoding amendment, a fresh session
implements (workstream §7.1, Gate 2). Items the rulings do **not** settle remain **surfaced**
(NS-1…NS-7; carried G3/G5/G7b/NS-5/signal-3) and are re-surfaced **per slice** below, never baked.

---

## 1. Slice map (this detail-plan's `Slice N` ↔ workstream §6 sub-slice) + per-slice gates

Execution sequence (workstream §5): **A→B→C serialize; D follows B; E and F follow C.** Detail-
planning order follows this sequence; the slice-iterative loop seals each slice before the next is
posted.

| Slice | §6 ID | Scope (one line) | Embedded ratification-class gate(s) |
|---|---|---|---|
| **1** | **A1** | Source-authority allowlist + scoring registry (T1/T2/T3) | **new AC-D (authority scoring)** + DS1-a/b/c residuals |
| 2 | A2 | Corpus acquisition pipeline (allowlist web-search → fetch → extract → embed → pgvector) | new AC-CD (corpus builder); AC-D21 web-search use; AC-D22 body change |
| 3 | A3 | Hybrid refresh cron (per-topic / on-demand / weekly) + corpus retrieval helper | cron-count sweep; weekly backstop |
| 4 | B1 | `Operation.pill_generation` mint + provider/stub wiring | **carried G1** (ops-count sweep); **carried G7b** (prompt-version trajectory) |
| 5 | B2 | Corpus-grounded generation + per-draft **provenance chain** | new AC-D (provenance); AC-D22 reframe; **NS-3** granularity |
| 6 | B3 | N-draft fan-out + persistence + cost-share | **carried G3** (per-band decomposition) |
| 7 | C1 | Multi-pass + cross-model self-review protocol | new AC-D (self-review, ruling 4); **NS-2**; **NS-7** |
| 8 | C2 | Confidence scoring + auto-publish gate (single global threshold; publish-with-warning) | new AC-D (gate, rulings 1+2); removes approve gate; **NS-6** |
| 9 | D1–D2 | Three §6.5 signal stores + dedup | **carried G5** (signal data model); **carried signal-3** feature-scope |
| 10 | D3 | Gap-detection sweep + catalogue-health checks → generation trigger | §6.5 rewrite (G2-analog); **NS-4** |
| 11 | D4 | Gap-detection + health-check crons | cron-count sweep (G9-analog) |
| 12 | E1 | Oversight dashboard read surface (publishes, provenance, confidence, authority) | new AC-CD (dashboard) |
| 13 | E2 | Rollback matrix (pill / question / batch / source) + spot-check sampling | new AC-CD (rollback, ruling 5) |
| 14 | F1 | Bootstrap-on-publish wiring (reframed AC-D7/AC-D23) | AC-D7/AC-D23 body change |

**Cross-cutting gates** (not slice-specific; ruled once for the whole workstream, noted at the slice
that assumes them but blocking no single slice's detail):
- **NS-5 — post-P11 ROADMAP placement** (the #105 G-PHASE analog, carried + unruled): new ROADMAP
  phase(s) (P12+) or a named non-phase workstream? Class (iii). *No planner lean.* First surfaces here
  because Slice 1 is the workstream's first buildable artifact and needs a phase home for its
  CHECKLIST/ROADMAP row. Surfaced; held.
- **G-SEQ — ruled single** by the new-workstream vehicle (ruling 0b); the six stages are one sequenced
  ratification cycle (`REQUIRED_READING.md` §7 — all parties stay actively subscribed across the
  chain; the dormancy bound does not apply between links).
- **Count-invariant sweeps** span multiple slices: the **"seven AI operations"** sweep is owned by
  Slice 4 (B1, the op mint) + Slice 7 (C1, the self-review passes); the **"seven crons"** sweep is
  owned by Slice 3 (A3, corpus-refresh) + Slice 11 (D4, gap-detection/health crons). Each owning slice
  runs the #106 three-class structural mirror-sweep (word / numeral / `dict[Operation]`-or-`[operation]`-
  subscript / op-set-floor) at execution HEAD. **Forward-accuracy (auditor A-3 / GT-1):** the
  `Operation` enum is **already 8 members** — the seven SPEC §6 ops **+ `embed`** (`provider.py:121-143`;
  the docstring reads "seven … plus `embed`"). The "seven AI operations" count invariant is a
  **spec-prose** count that **excludes `embed`**, so the Slice-4/7 ops sweep is *spec-prose "seven" →
  "seven+K"* mapped onto an enum **already at 8** — **not** a naive "enum seven → eight." The Slice-4/7
  detail must encode it that way.
- **NS-7 — RULED: degrade-not-gate (authenticated via the planner channel, this conversation,
  2026-06-09).** **Single-provider deployments: safety-relevant content PUBLISHES-WITH-WARNING (always
  dashboard-flagged) on same-model multi-pass review; NO second-provider prerequisite gate** (honours
  ruling 2's "nothing held pre-publish"). This is the **NS-7 status-of-record** for the whole plan. It
  supersedes the planner's original PR #107 §7.2 prereq-gate lean and the earlier "pending-authentication"
  framing. **Authentication trail (role files §8.3; updated per overseer OV-40):** the reported
  degrade-not-gate ruling first appeared on the **unmerged** `vibrant-euler@92886fe` addendum — a
  **relay** (pending, not actionable) per OV-6/A-6. **All three sessions then authenticated NS-7
  independently through their *own* in-session channels — no party relied on the relay:** the
  **plan-auditor** (origin: the in-session spec-author, this conversation), the **plan-overseer**
  (independently, via its own channel — issue-comment `4664355136`; the authoritative NS-7 lane per
  A-6/OV-6), and the **planner** (independently confirming through the planner's own authenticated
  channel — the in-session spec-author answering the planner's direct question, this conversation).
  *That* triple, each-own-channel authentication — not the relay — is what this ruling rests on. **Effect:** C1's safety-pass degradation path
  (already authored as the recommended direction) **is the ruled behavior**; C1 §7.3 / C2 §8.3 set the
  degradation switch to **degrade**, and the C1/C2 *execution* NS-7 Gate-2 item is **un-blocked** (each
  execution PR still re-confirms NS-7 through its own authenticated channel, per OV-2 relay discipline —
  the merged detail-plan reads as a relay downstream). *(C1 §7.3's "pending-authentication" wording is
  superseded by this bullet; its substance — the degradation switch — is unchanged, so C1's seal is not
  re-staled. C2 §8.3 reflects the ruling directly, C2 being mid-review.)* **§7.3 reconciliation (auditor
  A-45, tracked pre-global-marker item):** C1 §7.3's now-stale "pending-authentication" line is reconciled
  to this RULED status **at the global final-marker pass** (where the whole doc re-binds and a C1 re-stale
  is absorbed once), so the global marker does **not** carry the §7.3↔§1 inconsistency unresolved — the
  §1 status-of-record governs in the interim.
- **Multi-slice anchor amend-once (overseer OV-33) — author each shared anchor's amendment COMPLETE
  up-front.** Three canonical anchors are touched by **more than one slice**, and the earlier slice was
  **sealed with the narrower scope** — a partial-amend / double-amend risk (the §7 silent-partial-fold
  failure in anchor form):
  - **AC-D21** — A2 (web search → corpus acquisition) **+** C1 (the safety pass re-adjudicates
    `safety_relevant`) **+** the override relocation to E2;
  - **AC-D22** — A2 (Drive-folder ingestion retired → AI-built corpus) **+** B2 (the corpus is queried
    at §6.5 generation);
  - **SPEC §6 ops-count** — B1 (`pill_generation`, Anthropic +1) **+** C1 (`content_self_review`,
    cross-family +1) → the named count lands at its **final** value (seven → nine) only when both are in.
  - **AC-D7** — C2 (remove the human approve/queue gate — generated pills auto-publish) **+** F1 (the
    incremental bootstrap trigger moves approve → publish);
  - **AC-D23** — B2/C1 (the cross-provider self-review precedent extended) **+** F1 (bootstrap's anchor
    self-review step) — verify the touching set at execution HEAD.
  - **Shared SPEC *sections* (overseer OV-38) — the discipline extends beyond anchors to multi-slice
    spec-section rewrites:** **SPEC §6.5** [C2 auto-publish gate + D3 gap-detection/generation rewrite +
    **D1–D2 §6.5 *Inputs* (the three signals)** — overseer OV-45: §6.5 is a **3-slice** rewrite] and the
    **§290 audit-log prose** [C2 published/flagged events + E2 rolled-back events] are each rewritten by
    more than one slice — author each section's rewrite **complete across all touching slices, once**,
    same as the anchors.
  - **Shared *model* (overseer OV-50) — the discipline extends to a multi-slice SPEC §5 entity:** the
    **G5 `GapSignal` model** is touched by **D1–D2** (defines it + the capture columns) **and D3** (the
    `consumed_at`/status field its third-arm dedup marks) — author the entity **complete at D1–D2,
    including the `consumed_at`/status field D3 needs (forward-ready), in one migration**; **D3 reuses it,
    no second migration**. (Harmonizes D3 §10.4's "column … if needed" — it is authored at D1–D2, not
    added at D3.)
  - **Shared *count-invariant* — the SPEC §8.9 / AC-CD7 "seven crons" count** is touched by **A3**
    (`corpus.refresh`, net 0 or +1 per NS-1) **and D4** (`gap_detection.sweep` + `catalogue_health.check`,
    +2) — author the §8.9/AC-CD7 amendment **complete at the final count (nine if NS-1 = retire Drive; ten
    if keep), once, before the first of A3/D4 executes** (the §1 count-invariant-sweeps bullet names the
    co-ownership; this is its amend-once corollary; the *number* is held on NS-1).

  **Discipline:** the spec author authors **each** shared anchor's body **once, covering all touching
  slices' changes**, *before the **first** touching slice executes* — **not** incrementally per slice. A
  slice's detail surfacing "an AC-D21 body change" is therefore surfacing **its contribution to the one
  complete AC-D21 amendment**, not a standalone partial edit. The downstream amendment PR folds the full
  multi-slice scope (the overseer, as merge-executor, will require it complete); a narrower amendment that
  lands first then a second that "tops it up" is the drift this forecloses. *(A2 is sealed with its
  narrower AC-D21/AC-D22 surface text — correct for A2's detail; the **complete** amendment scope is
  assembled here at the cross-cutting level and re-stated by each later touching slice.)*

---

## Slice 1 (A1) — source-authority allowlist + scoring registry (T1/T2/T3)

**Status: final for Slice 1 — approved by planner** (content-bound to the Slice-1 substance at
`22f3d67` — auditor content SEAL (`2fb561d`) + overseer governance SEAL (`0d27a27`) both at `22f3d67`.
This marker is **content-invariant**: only this Status line changed; §1.1–§1.7 are byte-identical to
`22f3d67`, so it does **not** re-stale the reviewers' seals (§0.1/§8). All Slice-1 findings resolved —
A-1…A-4 + OV-1…OV-3 Confirms; A-5/A-6 + OV-4/OV-5 + OV-6 (NS-7 relay, pending-auth) resolved-by-fold;
§1.7.)

**Execution-gate (Gate 2): BLOCKED pending authenticated spec-author ratification of the new
source-authority AC-D mint.** This detail is written **against the recommended direction** — a
**code-level VCS registry** module `app/domain/source_authority.py` holding the T1/T2/T3 allowlist +
tier-scoring + an allowlist-filter primitive, env-extensible per the AC-CD18 pattern, **no DB table /
no migration in A1**. The *tiered scheme and the T1 seed are pre-settled by ruling 3* (workstream §1);
the **mint of the AC-D body is still the Gate-2 ratification event** (class (i) anchor mint), and three
residual design points ruling 3 leaves open are surfaced (§1.3, DS1-a/b/c).

**A1's complete execution-gate set (overseer OV-5 — gate-completeness).** The A1 *execution* PR is
gated by **two** items, both of which must be ratified before it can close: **(a)** the source-authority
**AC-D mint** (ratification-class (i), the blocking gate above); **and (b)** the cross-cutting **NS-5
phase-home ruling** (class (iii)) — required before the A1 execution PR can record its **ROADMAP /
CHECKLIST row** (`SESSION_START.md` requires a CHECKLIST update with real evidence at PR close, and a
build slice needs a phase identity: P12+ vs. a named non-phase workstream). So **NS-5 is a precondition
for A1 *execution-close*, not for A1 detail.** A1 **detail-planning is gated by neither** — only
execution waits; this section is authored against the recommended direction so it is ready the moment
both ratifications land.

**Implements:** the **foundation** the corpus builder (A2) and downstream confidence/authority surfaces
(C2, E1) depend on — a pure, offline-testable registry that answers two questions about any URL/host:
*(i) is it on the tiered allowlist?* and *(ii) what is its authority tier + numeric score?* — plus a
filter that restricts an arbitrary web-search result list to allowlisted hosts (ruling 3: "web search
restricted to the allowlist"). It deliberately stops at the primitive: **no** fetch/extract/embed
(Slice 2 / A2), **no** corpus-doc storage or `authority_score` column (A2), **no** web_search.py wiring
(A2), **no** refresh cron (A3), **no** generation (Stage B), **no** dashboard (Stage E).

### 1.1 Grounding (verified against the tree at this SHA, `2110a56`)

- **No authority/tier/allowlist concept exists today.** A repo grep
  (`grep -rniE 'authority|allowlist|tier|T1|T2|T3' app/`) returns only unrelated hits: the CORS
  *origin allowlist* (`config.py:93`), prose uses of "authority" (`web_search.py:71`,
  `attempts.py:405`, `models.py:1175`, `rag.py:134`). **A1 is greenfield** — verified, not inherited.
- **The web-search seam is a narrow Protocol + Tavily adapter.** `app/domain/web_search.py:80-89`
  `class WebSearchSource(Protocol)` with `async def search(query, *, max_results=5) ->
  list[WebSearchResult]`; `WebSearchResult` (`web_search.py:57-77`) is a frozen dataclass carrying
  `url`, `title`, `snippet`, `source` (`source` = host, derived by `_host_of(url)` at
  `web_search.py:189-199`). The module is **AC-D21-scoped to safety-link curation only**
  (`web_search.py:1-3` docstring; `safety_links.py:218-221` is the lone caller via
  `get_web_search_source().search(...)`). A1's filter consumes the **`source`/`url`** of these rows;
  it does **not** modify the seam.
- **Ruling 3 gives the concrete scheme.** Workstream §1 ruling 3: **T1** regulators/standards
  (`sabs.co.za`, `*.gov.za`, `nrcs.org.za`, `iso.org`); **T2** industry/professional bodies + recognised
  standards; **T3** reputable industry/educational; **web search restricted to the allowlist; authority
  score by tier.** T1 is enumerated concretely; **T2/T3 are categorical** (no seed hosts named) → DS1-b.
- **AC-D21 already carries an informal authority notion — no tiering.** `DECISIONS.md:531` lists
  *"NACE materials, SANS abstracts, manufacturer technical data sheets, OSH publications"* as the
  authoritative safety-link sources, and `WebSearchResult.source` exists *"so the admin queue can
  sort/filter by authority"* (`web_search.py:71`). **The new AC-D formalises this into a scored tiered
  registry** — it does not invent authority from nothing; it is the structured successor to the
  AC-D21 informal list (cite as precedent in the new anchor body).
- **The env-default-field pattern is locked (AC-CD18).** `app/config.py` carries env-overridable
  `Settings` fields (e.g. `web_search_api_key`, `config.py:76`; the `anthropic_model_*` family); a
  configurable list precedent exists in AC-D21's *"configurable safety keyword list"*
  (`DECISIONS.md:529`). The allowlist's env-extension fields follow this pattern (absorbable AC-CD18
  addition, §1.2c).
- **The code-VCS-registry pattern is locked.** `app/ai/prompts/` is a version-controlled code registry
  (`prompts/__init__.py` `_REGISTRY`); `_ANTHROPIC_DEFAULT_OPS` / `_REVIEW_DEFAULT_OPS`
  (`provider.py:149-164`) are module-level frozensets. A code allowlist+tier registry is the
  framework-faithful shape (not a DB table) at A1 — DS1-d.
- **Layout / structure-gate (AC-CD2, AC-CD17).** `app/domain/*.py` is the locked domain layer; a new
  `app/domain/source_authority.py` sits inside it and passes the structure-gate unmodified (an
  **absorbable structural addition**, `SESSION_START.md` carve-out — one new domain module + sibling
  config fields, well-rationalised against AC-CD18).
- **`conftest.py` forbids any network call in tests (AC-CD15).** The registry is a **pure, static,
  offline** primitive — it makes the AC-CD15 zero-network bar trivially (no provider, no I/O).

### 1.2 Build choices — concrete (recommended direction)

**(a) New module — `app/domain/source_authority.py`.** A pure, dependency-light registry:

- **`Tier`** — an `enum.IntEnum` (`T1 = 3`, `T2 = 2`, `T3 = 1`) so ordering (`T1 > T2 > T3`) and the
  numeric *ordinal* are intrinsic; the **normalised authority score** is a separate function (DS1-a)
  so the ordinal and the score can diverge later without an enum change.
- **`_ALLOWLIST: dict[str, Tier]`** — the seed map of **host patterns → tier**. Seed (recommended):
  - **T1** (from ruling 3, verbatim): `iso.org`, `nrcs.org.za`, `sabs.co.za`, `*.gov.za`.
  - **T2** (seed lean, DS1-b — small, env-extensible): a few recognised professional/standards bodies
    (e.g. `nace.org`, `osha.gov`† , `iec.ch`, `astm.org`). *(†`osha.gov` would also match a future
    `*.gov` rule — kept explicit here as T2 industry-safety, distinct from the South-Africa-specific
    `*.gov.za` T1; the seed values are exactly DS1-b's surfaced point.)*
  - **T3** (seed lean, DS1-b): reputable industry/educational hosts (left intentionally minimal at
    seed; env-extensible).
- **`authority_tier(url_or_host: str) -> Tier | None`** — normalises to a host (reusing the existing
  `web_search._host_of` for URL→host, or accepting a bare host), lowercases, strips a leading `www.`,
  then matches against `_ALLOWLIST`: **exact host match** first, then **suffix-wildcard** for `*.<sfx>`
  patterns (`*.gov.za` matches `dol.gov.za` and the apex `gov.za`; an exact entry wins over a wildcard
  on tie). Returns the tier or **`None`** (host not allowlisted). Pure; no I/O.
- **`authority_score(tier: Tier) -> float`** — the normalised score-by-tier (DS1-a; lean **T1=1.0 /
  T2=0.6 / T3=0.3**). A thin map so the value is one edit away from the ruling and is the single
  surface the C2 confidence contract + E1 authority-breakdown read.
- **`is_allowlisted(url_or_host) -> bool`** — `authority_tier(...) is not None`.
- **`filter_to_allowlist(results: Iterable[WebSearchResult]) -> list[tuple[WebSearchResult, Tier]]`**
  — the primitive ruling 3's "web search restricted to the allowlist" needs: drop every row whose host
  is not allowlisted, and pair each surviving row with its `Tier` (so A2 can stamp the authority score
  on the chunk without re-resolving). Pure; takes the rows, returns the filtered+tagged subset. **A1
  provides this; A2 wires it around `get_web_search_source().search(...)`** (the *application* is A2).

**(b) Config env-extension — `app/config.py` (AC-CD18 pattern).** Three optional env-CSV fields, each
appended to the coded seed at registry-build time (mirrors AC-D21's "configurable keyword list"):
`source_authority_t1_extra: str = ""`, `_t2_extra`, `_t3_extra` (comma-separated host patterns). A
small `_load_allowlist(settings)` merges seed + env (env entries may add, not silently re-tier a seed
host — a host appearing in two tiers resolves to the **stronger** tier, deterministically). One
absorbable structural addition (three sibling fields), folded into the slice handover, **not** a
separate spec PR — **caveat:** holds only while A1 stays within these fields + the one module; adding
more escalates to a spec-clarification PR (`SESSION_START.md`).

**(c) `.env.example`** — add `SOURCE_AUTHORITY_T1_EXTRA=` / `_T2_EXTRA=` / `_T3_EXTRA=` siblings
(env-default discoverability, AC-CD18).

**(d) No models / migration / router / web_search.py / FE in A1.** The corpus-doc store + the
per-chunk `authority_score` column are **A2**; per-source rollback *entities* are **E2**; the
web_search.py call-site wiring is **A2**; there is no endpoint or FE in A1. A1's only callable surface
is `source_authority.*`, exercised by the tests in §1.5.

### 1.3 Embedded ratification-class items — SURFACED (blocking A1 execution, Gate 2)

Each is posted as a tagged PR comment addressed to the spec author and held pending. No default is
baked; the build above is the **recommended** direction, not a decided one.

- **The new source-authority AC-D mint** — class **(i)** (AC-D anchor **mint**) **+ (ii)** (it touches
  SPEC §7.4 web-search prose + adds an authority concept to §6/§5). **Design pre-settled by ruling 3**
  (tiered T1/T2/T3 allowlist + authority score by tier) — so this is **not** a re-surface of the
  *scheme*; it surfaces that the **anchor body must be authored by the spec author** (`SESSION_START.md`
  — the implementer does not author the clarification) and that the mint is the Gate-2 ratification
  event that **blocks A1 execution**. **Anchor numbering:** the spec author assigns; at the current
  count (`AC-D1…AC-D27`, `DECISIONS.md:7`) the next sequential is **AC-D28** (planner does **not**
  pre-assign — anchor IDs are immutable and minted by the spec author). **Amendment scope to ratify
  with in view:** (1) the new AC-D body (decision/rationale/implications/related); (2) the
  `DECISIONS.md:7` **decision-count header** `AC-D1 through AC-D27` → `…AC-D28` (a numeral count
  invariant — the `seven crons`-class mirror, swept in the same spec-author PR); (3) **`Related`
  back-links** on AC-D21 (`DECISIONS.md:553`) and AC-D22 (the authority registry is the structured
  successor to AC-D21's informal source list and feeds AC-D22's corpus); (4) a **SPEC §7.4** web-search
  prose note that corpus-acquisition search is **restricted to the tiered allowlist** (DS1-c bounds
  *whether* this also tightens the AC-D21 curation search). The downstream AC-D amendment PR must fold
  **all four**, not just the anchor body — the overseer (merge-executor) will require the count + the
  cross-refs folded completely.

- **DS1-a — numeric tier scores.** Ruling 3 fixed *"authority score **by tier**"* (the shape) but
  **not the values**. The score is not cosmetic: it is the single number Stage C's confidence scoring
  and Stage E's "source-authority breakdown" read, so the value crosses into the **confidence/ranking
  contract** (it interacts with **NS-6** — the confidence-threshold value/telemetry, surfaced at C2).
  **Recommendation:** normalised **T1=1.0 / T2=0.6 / T3=0.3** (monotone, T1-anchored at 1.0), with the
  raw ordinal (3/2/1) available on the `Tier` enum for callers that want rank not weight. **Surfaced,
  not baked** — class (ii); coordinate the value with the C2/NS-6 confidence design so the two numbers
  are set coherently rather than independently.

- **DS1-b — T2/T3 seed entries.** Ruling 3 names **T1 hosts concretely** but **T2/T3 only
  categorically** ("industry/professional bodies + recognised standards"; "reputable
  industry/educational"). The actual seed list bounds what the autonomous corpus builder may fetch, so
  it is a **§6.5-Inputs-scope decision**, not a free implementation detail (an over-broad T3 seed lets
  the autonomous builder pull weaker sources with no human gate — *"rein in if it breaks"* argues for a
  **conservative** seed). **Recommendation:** a **small, explicitly-enumerated** T2/T3 seed (the §1.2a
  examples) + the env-extension fields (§1.2b) for the operator to widen deliberately. **Surfaced** —
  class (ii); the spec author confirms or supplies the seed in the AC-D body.

- **DS1-c — allowlist application scope (cross-AC-D21).** Ruling 3 says *"web search restricted to the
  allowlist"* — but Acumen has **two** web-search uses: the **new corpus acquisition** (Stage A) and
  the **existing AC-D21 safety-link curation** (`safety_links.py:218`). Does the allowlist govern
  **only corpus acquisition** (the new use), or **also** the AC-D21 curation search (tightening an
  already-shipped behaviour — an **AC-D21 body change**)? **Recommendation:** the allowlist governs
  **corpus acquisition** (the new, ratified-restricted use) at A1/A2; **AC-D21 safety-link curation
  retains its current behaviour** unless the spec author folds it in — *flagged both ways* because
  restricting safety-link curation to the **same** tiered allowlist is arguably **desirable** for
  safety sourcing (it is the stricter posture), so this is a genuine spec-author call, not a planner
  default. **Surfaced** — class (ii); blocks nothing in A1 (A1 only ships the filter primitive), but
  binds A2's wiring and any AC-D21 body change.

> **Detail-plan call (not surfaced) — DS1-d, registry shape.** Whether the allowlist+tier registry is
> **code** or a **DB table** is a build-design choice the detail-plan makes: **code VCS registry**
> (recommended, §1.2a) — it mirrors the locked `app/ai/prompts/` + `_ANTHROPIC_DEFAULT_OPS` patterns,
> needs no migration, and is the right granularity for a small operator-curated allowlist. The
> **per-source rollback** entities ruling 5 implies (a *fetched corpus document/source* is a trackable,
> retractable row) are a **distinct** concern — those become **DB entities in A2/E2**, keyed by the
> source host, *referencing* this code registry for their tier. Recording the code/DB boundary here so
> A2 (corpus-doc rows) and E2 (per-source rollback) do not collide with A1's registry. If a later slice
> shows the operator needs **runtime allowlist editing** (a dashboard surface), that promotion to a DB
> table is itself a fresh design point surfaced **then** — not pre-built in A1.

### 1.4 Docs / mirror sweeps

**Spec surfaces — in the spec-author's new-AC-D amendment PR** (authored by the spec author;
`SESSION_START.md`):
- the new AC-D body in `DECISIONS.md`;
- `DECISIONS.md:7` decision-count header `AC-D1 through AC-D27` → `…AC-D28` (numeral count invariant);
- `Related` back-links on AC-D21 (`DECISIONS.md:553`) and AC-D22;
- `SPEC.md:407-409` §7.4 web-search prose — note corpus-acquisition search is allowlist-restricted
  (subject to DS1-c on whether AC-D21 curation is also tightened).

**Code / registry — in A1's execution** (in-body-override rule — the authored anchor is truth, these
follow it; not a separate spec PR):
- the new `app/domain/source_authority.py` module;
- the three `config.py` env-extension fields + the `.env.example` siblings;
- **no count-word mirror is touched by A1** (A1 mints no AI operation and no cron — those count
  invariants are owned by Slices 4/7 and 3/11 respectively). The **only** count surface A1 entails is
  the **AC-D decision-count numeral** (`DECISIONS.md:7`), which lives in the spec-author PR above.

*(No structural total-map / op-set-floor is touched — A1 adds no `Operation` enum value and no cron.
The structure-gate (AC-CD2/AC-CD17) passes with the new domain module unmodified.)*

### 1.5 Tests (AC-CD15 — `app/domain/*` near-full coverage, zero-network)

New `tests/unit/test_source_authority.py`:

1. **Tier resolution — exact + wildcard.** `authority_tier("https://iso.org/x")` → `Tier.T1`;
   `authority_tier("dol.gov.za")` → `Tier.T1` (suffix-wildcard `*.gov.za`); the apex `gov.za` → `T1`;
   a seed T2 host → `Tier.T2`; an unknown host (`example.com`) → `None`; `www.`-prefix stripped before
   match; case-insensitive.
2. **Score-by-tier monotonicity.** `authority_score(T1) > authority_score(T2) > authority_score(T3)`;
   the leaned values (DS1-a) asserted exactly so a value change is a deliberate, test-visible edit.
3. **Allowlist filter.** `filter_to_allowlist([...])` over a list mixing allowlisted + non-allowlisted
   `WebSearchResult` rows returns **only** the allowlisted rows, each paired with its correct `Tier`;
   an all-non-allowlisted input → `[]`; ordering preserved.
4. **Env-extension.** With `source_authority_t2_extra="acme-pro.example"` (monkeypatched settings),
   `authority_tier("acme-pro.example")` → `Tier.T2`; an env host duplicating a seed T1 entry at a
   weaker tier still resolves to the **stronger** (T1) tier (deterministic conflict rule, §1.2b).
5. **Zero-network + purity.** The whole module runs under the `conftest.py` no-network guard with no
   provider, no monkeypatched I/O — proving the registry is a pure offline primitive.

**Acceptance for A1 (execution):** the five tests pass under the three-layer green gate; the
structure-gate (AC-CD2/AC-CD17) still passes with the new module + config fields; `authority_tier` /
`authority_score` / `filter_to_allowlist` behave per the above; no network in tests.

### 1.6 What A1 does NOT touch (scope fence)

No `app/models.py` / migration (corpus-doc store + per-chunk `authority_score` column = A2; per-source
rollback entities = E2); no `app/domain/web_search.py` change (A1 adds the filter in `source_authority`,
does not modify the seam — A2 wires it); no `app/domain/drive_rag.py` (retrieval reuse = A2/A3); no
`app/routers/*` (no endpoint); no `frontend/**`; no cron / beat schedule (A3, D4); no `Operation` enum
change (B1); no generation, self-review, gate, or dashboard. The AC-D21 safety-link curation path is
**untouched** at A1 (its possible tightening is the DS1-c surface, bound to A2/AC-D21, not A1).

### 1.7 Reviewer findings folded — Slice 1

Round-1 review (auditor `claude/jolly-ptolemy-oui39p` @ `5f0a2da`; overseer `claude/sharp-cray-gueezy`
@ `b8407c4`) — **no blocking finding; 4 + 3 Confirms, 4 Refines all folded; none dropped.**

| ID | Reviewer | Tag | Resolution |
|---|---|---|---|
| **A-1** | auditor (content) | Confirm | Ruling 3 faithfully encoded (T1 verbatim; `filter_to_allowlist` = "web search restricted to the allowlist"; A1 ships filter / A2 applies it). No action. |
| **A-2** | auditor | Confirm | Ratification items correctly surfaced-not-baked; DS1-d correctly an in-scope detail-plan build choice. No action. |
| **A-3** | auditor | Confirm (+ forward) | Count-invariant handling + scope fence correct. **Forward note folded** (§1 cross-cutting): the `Operation` enum is **already 8** (7 SPEC ops + `embed`), so the Slice-4/7 ops sweep is *spec-prose "seven → seven+K"* over an enum already at 8, **not** "enum 7→8". |
| **A-4** | auditor | Confirm | Grounding verified against the live tree (incl. CORS=AC-CD19 cited correctly, AC-CD18=model-ID defaults). No action. |
| **A-5** | auditor | Refine (low) | **Folded:** §1.1 citation for the "NACE materials, SANS abstracts…" quote `DECISIONS.md:529`→**`:531`** (the `:529` cite for the *configurable safety keyword list* is the correct, distinct line — unchanged). |
| **A-6** | auditor | Refine (forward) | **Folded** (§1 cross-cutting NS-7 bullet): records the reported spec-author NS-7 ruling (*degrade-not-gate*, on an **unmerged** addendum branch) as **pending authentication** (overseer's lane), to be reflected at Slice 7/8 once authenticated — **not baked now**; NS-7 does not touch Slice 1. |
| **OV-1** | overseer (governance) | Confirm | Merge-class self-classification correct (PR diff `plans/**`-only → NORMAL). No action. |
| **OV-2** | overseer | Confirm | Gate-2 relay discipline correct (merged §1 reads as a relay downstream; surface-not-bake held). No action. |
| **OV-3** | overseer | Confirm | Recursive consistency: workflow described matches the workflow producing it. No action. |
| **OV-4** | overseer | Refine | **Folded** (§0.1 + Loop-mechanics): global-marker symmetry made explicit — **all three** parties post a global final-marker content-bound to the final whole-doc SHA; an early per-slice reviewer seal is never read as a whole-doc sign-off. |
| **OV-5** | overseer | Refine | **Folded** (Slice 1 execution-gate): A1's **complete execution-gate set** stated — (a) the AC-D mint (blocking) **+ (b)** the NS-5 phase-home ruling (precondition for execution-*close* per `SESSION_START.md` CHECKLIST/ROADMAP-row requirement, not for detail). |

**Round-trips:** A-5 1/5 · A-6 1/5 · OV-4 1/5 · OV-5 1/5 (A-1…A-4, OV-1…OV-3 are positive-coverage
Confirms — no round-trip owed). **Set-diff (this revision):** 11 added [A-1…A-6, OV-1…OV-5] / 0 dropped.
No push-back; no design change; no halt-class condition. Awaiting both reviewers' re-verification +
Slice-1 seals at the folded content-SHA, then the planner posts `Status: final for Slice 1`.

---

## Slice 2 (A2) — corpus acquisition pipeline (allowlist web-search → fetch → extract → embed → pgvector)

**Status: final for Slice 2 — approved by planner** (content-bound to the Slice-2 substance at
`5d26906` — auditor content SEAL (`6f5190e`) + overseer governance SEAL (`e2f14d3`) both at `5d26906`.
**Content-invariant**: only this Status line changed; §2.1–§2.7 byte-identical to `5d26906`, so it does
**not** re-stale the reviewers' seals (§0.1/§8). All Slice-2 findings resolved — A-9…A-12 + OV-7…OV-10
Confirms; A-7 (DS2-b elevated to a surface) / A-8 / OV-11 resolved-by-fold; §2.7.)

**Execution-gate (Gate 2): BLOCKED pending (a) the carried A1 holds** — the source-authority AC-D mint
+ NS-5 phase-home (A2 consumes A1's `source_authority` registry, so A1's gates flow through) — **and
(b) A2's own ratification surfaces:** a **new AC-CD (reference-corpus-builder architecture)**, an
**AC-D21 body change** (web search extended from safety-link curation to corpus acquisition), an
**AC-D22 body change** (Drive-folder ingestion retired in favour of the AI-built corpus), a
**build-dependency decision** for text extraction (AC-CD1), and the carried **NS-1** (retire the Drive
ingest *code* entirely vs. keep it as a dormant fallback). This detail is written **against the
recommended direction**; detail-planning is **not** gated, only execution.

**A2's complete execution-precondition set (overseer OV-11 — gate-completeness, parallel to OV-5).**
`corpus_builder` **imports A1's `source_authority` module**, so A2 execution requires **A1
executed-and-merged** (the `source_authority` module live on `main`), **not merely A1-*ratified*** — the
parent §5 A→B serialization implies it; stated here at the gate. The full set:
**A2 execution-close = { A1 merged (the `source_authority` module live) } + { A2's own ratifications:
corpus-builder AC-CD · AC-D21 body change · AC-D22 body change · AC-CD1 extraction-dep · NS-1 } +
{ NS-5 phase-home }.** A2 **detail** is gated by none of these.

**Implements:** the **(A) reference corpus builder** of the workstream pipeline (workstream §3/§4.1) —
identify authoritative sources per topic from the **A1 allowlist**, **fetch → extract → chunk → embed**
into the existing pgvector store, stamping the **authority tier + score** (A1) on each stored chunk,
with **content-hash dedup** for idempotency. It deliberately stops at *acquisition*: **no** corpus
**retrieval helper** and **no** refresh cron (both Slice 3 / A3), **no** generation grounding (Slice 5 /
B2), **no** per-draft provenance chain (B2), **no** Drive-code deletion (NS-1 pending — A2 builds the
replacement; it does not remove the legacy path).

### 2.1 Grounding (verified against the tree at this SHA, `2110a56`)

- **The Drive ingest pipeline is the exact reusable precedent.** `app/domain/drive_rag.py` already
  ships the **pure functions** A2 reuses: `chunk_document(text, *, target_tokens=_TARGET_CHUNK_TOKENS)`
  (`drive_rag.py:104`, deterministic ~500-token chunking, "same input → same chunks → same hashes"),
  `content_hash(text) -> 64-char sha256` (`drive_rag.py:164`), the diff-ingest scaffold
  (`diff_files`, `DiffSets` `drive_rag.py:294-323`), and `cosine_top_k` (`:196`). A2's pipeline is a
  **sibling acquisition path** feeding an equivalent chunk store — it reuses these, it does **not**
  re-implement chunking/hashing.
- **`DriveChunk` is the chunk-store shape to mirror.** `app/models.py:776-799`
  `class DriveChunk(Base, TimestampMixin, AIProvenanceMixin)` — `embedding: Mapped[list[float]] =
  mapped_column(Vector(1536))`, `content_hash` (indexed), `source_doc_ref`, `chunk_index`,
  `chunk_text`, `indexed_at`, IVFFlat index `ix_drive_chunk_embedding`. The **6 `AIProvenanceMixin`
  columns** (`models.py:213-227`: `ai_provider`/`ai_model`/`ai_cost_usd`/…) carry the embedding call's
  per-call cost. A2's corpus chunk **mirrors this shape** + adds the authority columns (§2.2a).
- **The embed-cost path is `record_provenance`.** `app/ai/cost.py:67 record_provenance(entity, result)`
  stamps the `AIProvenanceMixin` columns from an `AIResult`/`EmbedResult`; `current_month_spend`
  (`cost.py:274`) sums `ai_cost_usd` per provenance-bearing table. A2's embed **reuses this exactly**
  (like `DriveChunk`) so the AC-CD8 spend-aggregation invariant holds for corpus embeds, stamped to
  **OpenAI** (`text-embedding-3-small`, `SystemSettings.embedding_model` `models.py:895-898`).
- **The fetch + content-hash precedent is `safety_links._fetch_body_hash`.** `safety_links.py:114-145`
  GETs a URL via an injectable `httpx.AsyncClient` (the AC-CD15 test seam — fake transport in tests,
  `None`→real in prod, `safety_links.py:174/192`), returns `(status_code, content_hash | None)`,
  fail-soft on `httpx.HTTPError`/`OSError` (WARN, no row). A2's fetch **reuses this pattern** (factor a
  shared helper or a sibling) and adds **body retention** (safety-links keeps only the hash; the corpus
  needs the **body text** to extract+chunk).
- **`httpx==0.27.2` is the only HTTP/parse dep — there is NO HTML/PDF extraction library.**
  (`requirements.txt:17`; a grep for `beautifulsoup|bs4|lxml|readability|pypdf|pdfminer|html2text|
  trafilatura` returns nothing.) So the **"extract"** step is a genuine **build-dependency surface**
  (§2.3): a new pinned dep (AC-CD1) for HTML→text (and PDF), or a stdlib-only HTML strip with PDFs
  out-of-scope at A2.
- **The allowlist-restricted web search is A1 + the existing seam.** `get_web_search_source().search(
  topic)` (`web_search.py:208`) returns `WebSearchResult{url,title,snippet,source}`; A1's
  `source_authority.filter_to_allowlist(results)` (Slice 1 §1.2a) restricts to allowlisted hosts +
  tags each with its `Tier`. A2 **wires** A1's filter around the search call (the application A1's
  §1.2a deferred to A2). **This is the new AC-D21 use** (web search for *corpus acquisition*, not
  safety-link curation) → §2.3.
- **AC-D22 today scopes RAG to Drive + §6.1/§6.4 only.** `DECISIONS.md:555+` AC-D22 — *"a single
  designated Drive folder … queried at every generation call (test generation per §6.1, learning
  material per §6.4)"*; `SPEC.md:403-405` §7.3 is the Drive API integration. Retiring the Drive-folder
  dependency in favour of the AI-built corpus, **and** extending "queried at every generation call" to
  §6.5 generation, is the **AC-D22 body change** (§2.3) — and carries the **Drive→corpus reference
  mirror-sweep** the workstream plan named (A-8: `SPEC.md:302/334/403-405`, `DECISIONS.md:574`).
- **No corpus / provenance table exists** (auditor GT-7, re-verified): no `corpus_*` / `provenance` /
  `source_*` table in `models.py`. The corpus store is **greenfield** — A2 adds the first table + the
  workstream's first migration.

### 2.2 Build choices — concrete (recommended direction)

**(a) New `CorpusChunk` model + migration — `app/models.py` + `alembic` revision.** A **new table**
(not a reuse of `DriveChunk`), mirroring `DriveChunk`'s column shape (`Base, TimestampMixin,
AIProvenanceMixin`; `Vector(1536)`; `content_hash` indexed; `source_doc_ref`/`chunk_index`/`chunk_text`/
`indexed_at`; IVFFlat index) **plus** corpus-specific columns: `source_host: str` (the allowlisted host),
`authority_tier: int` (the A1 `Tier` ordinal), `authority_score: float` (the A1 score). **Rationale for a
new table, not reuse (DS2-a, §2.3):** (i) **per-source rollback** (ruling 5) needs corpus sources as
distinct trackable/retractable entities keyed by `source_host` — cleaner separate from Drive chunks; (ii)
**NS-1** (Drive retirement) is clean if the corpus is its own table — retiring Drive doesn't entangle the
corpus; (iii) the authority columns are corpus-only. The new IVFFlat index mirrors
`ix_drive_chunk_embedding`. **Migration up/down clean** (`SESSION_START.md` P1 discipline; the migration
is an A2 execution deliverable). One `tenant_id` FK from day one (AC-CD3).

**(b) Acquisition pipeline — new `app/domain/corpus_builder.py`.** A domain module composing the reused
primitives, fail-soft throughout (mirrors the Drive-ingest contract):
1. **Source discovery (allowlist-restricted).** `get_web_search_source().search(topic, max_results=K)` →
   `source_authority.filter_to_allowlist(results)` (A1) → the allowlisted, tier-tagged URL set. Empty
   after filtering → `[]`, no fetch (logged). **This is the ruling-3 "web search restricted to the
   allowlist" application.**
2. **Fetch.** For each allowlisted URL, GET via the injectable `httpx.AsyncClient` seam (reuse the
   `safety_links._fetch_body_hash` pattern, extended to **retain the body**); fail-soft per-URL (WARN,
   skip) so one dead source never fails the run.
3. **Extract.** Body → plain text via the §2.3 extraction decision (HTML→text; PDF iff the dep is
   ratified).
4. **Chunk.** `chunk_document(text)` (reuse `drive_rag.py:104`) → deterministic ~500-token chunks.
5. **Cross-reference / dedup (DS2-b, §2.3 — lean).** `content_hash(chunk)` (reuse `drive_rag.py:164`);
   **skip any chunk whose `content_hash` already exists** for that `source_host` (idempotency — a re-run
   over an unchanged source adds nothing). Deeper "cross-reference" (claim-level linking across sources)
   is **surfaced, not built at A2** (§2.3, DS2-b).
6. **Embed.** Embed each new chunk via the `AIProvider` embed op (`text-embedding-3-small`), `record_
   provenance` stamping the cost to OpenAI (reuse `cost.py:67`).
7. **Persist + stamp authority.** Write a `CorpusChunk` row per new chunk with `source_host`/
   `authority_tier`/`authority_score` from A1 (`source_authority.authority_tier(host)` +
   `authority_score(tier)`), `embedding`, `content_hash`, provenance columns. Idempotent by
   `(source_host, content_hash)`.

**(c) No retrieval / no cron / no generation in A2.** The corpus **retrieval helper**
(`retrieve_corpus_for_topic`, the `cosine_top_k`-over-`CorpusChunk` sibling) and the **hybrid refresh
cron** are **Slice 3 (A3)**. Generation grounding against the corpus is **Slice 5 (B2)**. A2's callable
surface is `corpus_builder.acquire_for_topic(db, *, topic, http_client=None)` exercised by §2.5 tests.

### 2.3 Embedded ratification-class items — SURFACED (blocking A2 execution, Gate 2)

- **New AC-CD — reference-corpus-builder architecture.** Class (ii). The acquisition pipeline +
  `CorpusChunk` table + authority stamping + the pgvector/`AIProvenanceMixin` reuse. Spec-author-authored
  AC-CD body; the table/index shape rides it. (Next sequential ~**AC-CD25** at the `AC-CD1…AC-CD24`
  count; the spec author assigns.) Blocks A2 execution.
- **AC-D21 body change — web search extended to corpus acquisition.** Class (i)/(ii). Web search is
  AC-D21-scoped to safety-link curation (`web_search.py:1-3`); using it for corpus acquisition is a new
  AC-D21 use (the workstream's G4b-analog). **Directly consumes DS1-c** (Slice 1): the spec author's
  DS1-c ruling — whether the allowlist governs *only* corpus acquisition or *also* the AC-D21 curation
  search — is the **scope of this body change**. Blocks A2 execution.
- **AC-D22 body change — Drive-folder ingestion retired → AI-built corpus.** Class (i)/(ii). Retire the
  Drive-folder dependency (ruling 0a); extend "queried at every generation call" to §6.5; carry the
  **Drive→corpus reference mirror-sweep** (workstream §7.1 / A-8: enumerate + fold `SPEC.md:302/334/
  403-405`, `DECISIONS.md:574`, §8.x storage/rollback prose to the three-class structural-grep rigor at
  execution HEAD). **Couples to NS-1** below. Blocks A2 execution.
- **Build-dependency: text-extraction library (AC-CD1).** Class (ii) (a pinned-dep add is an AC-CD
  decision, `SESSION_START.md`). Acumen has **no** HTML/PDF extraction lib (§2.1). **Recommendation:**
  start **HTML-only** with a single small pinned dep (or a stdlib-only strip if it suffices for the
  allowlisted sources), and **surface whether PDF sources are in A2 scope** (T1 regulators/standards
  often publish PDFs — `sabs.co.za`/`iso.org` — so PDF support may be load-bearing for the corpus's
  value; a PDF dep is a heavier add). **Surfaced** — the dep + the HTML-vs-HTML+PDF scope are the
  spec-author/AC-CD1 call; *"rein in if it breaks"* argues start-minimal, widen deliberately.
- **NS-1 (carried, workstream §7.2) — retire the Drive ingest *code* entirely vs. keep as dormant
  fallback.** Class (iii). Ruling 0a removed the Drive *folder dependency*; whether
  `drive_source.py`/`drive_rag.py` **ingest code** is deleted or kept dormant is unruled. **A2 is where
  this bites** — the corpus is the Drive replacement. **Lean: remove entirely** (carrying dead
  scaffolding contradicts "the system builds its own knowledge base"), **but A2 is authored to NOT
  delete Drive code** (it builds the replacement beside it); the deletion is a *separate* execution step
  gated on the NS-1 ruling. **Surfaced; held.** *(Note the reuse tension: A2 reuses `drive_rag.py`'s
  `chunk_document`/`content_hash`/`cosine_top_k` pure functions — if NS-1 = remove, those shared
  primitives must be **relocated** (e.g. to a shared `app/domain/text_chunking.py`), not deleted with the
  Drive path. Flag for the NS-1 ruling + A3 retrieval.)*
- **DS2-b — "cross-reference" step semantics (elevated from a detail-plan call to a SURFACE per auditor
  A-7).** Workstream §4.1 names **"cross-reference"** as a *distinct* Stage-A pipeline step between
  *extract* and *embed* (`fetch → extract → cross-reference → embed`). Reducing it to content-hash dedup
  (the earlier lean) **under-reads a named architecture step with safety-grounding implications**, so it
  is **surfaced, not decided by lean** (role files §7 — a substantive scope ambiguity in the ratified
  architecture). The spec author's call among: **(i) dedup-only** — content-hash dedup + per-chunk source
  provenance (the minimal, buildable reading; planner's original lean); **(ii) cross-*source*
  corroboration** — track when the *same* claim/fact appears across **≥N authoritative sources** and
  stamp a corroboration signal on the chunk (materially stronger grounding for safety content, and a
  natural feed into the Stage-C confidence score + the B2 provenance chain + the ruling-3 authority
  weighting); **(iii) deeper** claim-level cross-linking. Class (ii) (corpus-builder AC-CD / §6.5 scope).
  **Lean (per the safety-floor primacy + "rein in if it breaks"): at least (ii) for safety-relevant
  topics** — cross-source corroboration is cheap insurance against a single weak source grounding safety
  content — **but surfaced, not baked**; it couples to the corpus-builder AC-CD, NS-6 (confidence
  telemetry), and the B2 provenance granularity (NS-3). *(Note: this revises the earlier DS2-b lean;
  §2.2b step 5's content-hash dedup remains the floor, with corroboration layered on iff ruled (ii)+.)*

> **Detail-plan call (not surfaced) — recorded for the reviewers:**
> - **DS2-a — new `CorpusChunk` table vs. reuse `DriveChunk`.** Build-design choice; **lean new table**
>   (§2.2a rationale: per-source rollback + NS-1 cleanliness + corpus-only authority columns). Rides the
>   corpus-builder AC-CD. If a reviewer judges the table choice anchor-class, it escalates to that AC-CD.

### 2.4 Docs / mirror sweeps

**Spec surfaces — in the spec-author's amendment PR(s)** (spec-author-authored):
- the new AC-CD body (corpus-builder architecture) in `CODE_SPEC.md` §18 + the AC-CD count/index header;
- the **AC-D21 body change** (`DECISIONS.md:527+`) + `SPEC.md:407-409` §7.4 web-search prose (corpus-
  acquisition use; DS1-c scope);
- the **AC-D22 body change** (`DECISIONS.md:555+`) + `SPEC.md:403-405` §7.3 + the **Drive→corpus
  mirror-sweep** set (`SPEC.md:302/334`, `DECISIONS.md:574`, §8.x) — run the three-class structural grep
  at execution HEAD, fold completely (no silent partial-fold);
- **no "seven crons" / "seven operations" count is touched by A2** — the corpus-refresh **cron** is
  Slice 3 (A3), not A2.

**Code — in A2's execution** (follows the authored anchors; the migration + model + module + tests +
any pinned dep):
- `app/models.py` `CorpusChunk` + the alembic up/down migration + IVFFlat index;
- `app/domain/corpus_builder.py`;
- `requirements.txt` / `requirements-worker.txt` pinned extraction dep **iff** ratified (AC-CD1; the
  unpinned-deps structure-gate must stay green);
- `app/ai/cost.py` — add `CorpusChunk` to the per-table provenance-spend aggregation set (so corpus
  embed spend joins `current_month_spend`; mirror the `DriveChunk` registration — verify the exact
  aggregation list at execution HEAD).

### 2.5 Tests (AC-CD15 — `app/domain/*` near-full coverage, zero-network)

New `tests/unit/test_corpus_builder.py` (+ a model/migration test):
1. **Allowlist-restricted discovery.** A fake `WebSearchSource` returns a mix of allowlisted +
   non-allowlisted hosts; `acquire_for_topic` **fetches only the allowlisted** URLs (assert the fake
   httpx transport saw only allowlisted hosts) — the ruling-3 restriction, end-to-end, offline.
2. **Fetch → extract → chunk → embed → persist.** With a fake httpx transport (HTML body) + the stub
   embed provider, one source yields N `CorpusChunk` rows carrying `source_host`, the correct
   `authority_tier`/`authority_score` (A1), `content_hash`, `embedding`, and provenance columns stamped
   (`ai_provider="stub"`, zero cost — AC-CD15).
3. **Dedup idempotency.** Re-running `acquire_for_topic` over the **same** source adds **no** new
   `CorpusChunk` rows (content-hash dedup); a changed body adds only the changed chunks.
4. **Fail-soft.** A dead URL (fake transport 500 / `httpx.HTTPError`) is skipped (WARN, no row), the run
   continues for the other sources; an empty post-filter set → no fetch, `[]`.
5. **Extraction.** HTML→text strips markup deterministically; (PDF iff in scope per §2.3).
6. **Migration up/down clean** + the structure-gate (AC-CD2/AC-CD17) passes with the new table.

### 2.6 What A2 does NOT touch (scope fence)

No corpus **retrieval helper** + no **refresh cron** (Slice 3 / A3); no **generation** grounding
(Slice 5 / B2); no **per-draft provenance chain** (B2); no **Drive-code deletion** (NS-1 pending — A2
builds beside the legacy path, does not remove it); no `Operation` enum change (B1); no router / FE /
dashboard. The `pill_proposal` refiner + the safety-link curation path are untouched (DS1-c may later
tighten the latter's sourcing, but that is the AC-D21 body-change ruling, not A2 code).

### 2.7 Reviewer findings folded — Slice 2

Round-1 review (auditor `claude/jolly-ptolemy-oui39p` @ `ea9d576` review `4462100323`; overseer
`claude/sharp-cray-gueezy` @ `217e1e0` comment `4663630337`) — **no blocking finding; 4 + 4 Confirms,
3 Refines all folded; none dropped.** Slice 1's seal is **not** re-staled (this fold edits only §2.*).

| ID | Reviewer | Tag | Resolution |
|---|---|---|---|
| **A-9** | auditor | Confirm | Reuse-not-reinvent verified (`chunk_document`/`content_hash`/`cosine_top_k`/`DriveChunk`/`AIProvenanceMixin`/`record_provenance`/`embed` op); no pgvector reinvention, no new `Operation`. No action. |
| **A-10** | auditor | Confirm | A1 filter wired (§2.2b step 1) + authority stamping (step 7); DS1-c correctly carried, not re-decided. No action. |
| **A-11** | auditor | Confirm | Ratification surfaces correct & not baked; AC-CD1=stack-lock verified; the relocate-shared-primitives NS-1 catch endorsed. No action. |
| **A-12** | auditor | Confirm | Scope fence + zero-network tests + the `CorpusChunk`→`current_month_spend` spend-aggregation invariant correctly named; first-migration noted. No action. |
| **A-7** | auditor | Refine (elevate) | **Folded:** **DS2-b ("cross-reference") elevated from a detail-plan call to a SURFACED item** (§2.3) — the spec author's call among (i) dedup-only / (ii) cross-source corroboration / (iii) deeper; lean ≥(ii) for safety-relevant topics, **surfaced not baked**. Content-hash dedup stays the built floor (§2.2b step 5). |
| **A-8** | auditor | Refine (low) | **Folded:** §2.1 cite `current_month_spend` `cost.py:169`→**`:274`** (verified `async def current_month_spend` at `:274`). |
| **OV-7** | overseer | Confirm | Surface-not-bake exact for all five A2 ratification surfaces; DS1-c kept pending; §2.6 leaves AC-D21 curation untouched. No action. |
| **OV-8** | overseer | Confirm | Count-invariant / Drive→corpus A-8 mirror-sweep completeness named; ops/cron fence correct; AC-CD count-header + `cost.py` registration folded into downstream amendment scope. No action. |
| **OV-9** | overseer | Confirm | A1→A2 scope-fence handoff + the DS1-d code/DB boundary honored (code registry resolves tier; `CorpusChunk` stores it; E2 keys off `source_host`). No action. |
| **OV-10** | overseer | Confirm | Merge-class `plans/**`-only / topology / Slice-1-not-re-staled verified. No action. |
| **OV-11** | overseer | Refine (low) | **Folded:** §2 execution-gate now states A2's **complete precondition set** = { A1 **merged** (the `source_authority` module live) } + { A2's own ratifications } + { NS-5 phase-home } — `corpus_builder` imports A1's module, so A2 needs A1 *merged*, not merely *ratified*. |

**Round-trips:** A-7 1/5 · A-8 1/5 · OV-11 1/5 (A-9…A-12, OV-7…OV-10 are positive-coverage Confirms —
no round-trip owed). **Set-diff (this revision):** 11 added [A-7…A-12, OV-7…OV-11] / 0 dropped. No
push-back; no design change beyond the A-7 surface elevation (which *adds* a surface, bakes nothing); no
halt-class. Awaiting both reviewers' re-verification + Slice-2 seals at the folded content-SHA, then the
planner posts `Status: final for Slice 2`.

---

## Slice 3 (A3) — hybrid refresh cron (per-topic / on-demand / weekly) + corpus retrieval helper

**Status: final for Slice 3 — approved by planner** (content-bound to the Slice-3 substance at
`5a6f84e` — auditor content SEAL (`42e4397`) + overseer governance SEAL (`02ba8d1`) both at `5a6f84e`.
**Content-invariant**: only this Status line changed; §3.1–§3.7 byte-identical to `5a6f84e`, so it does
**not** re-stale the reviewers' seals (§0.1/§8). All Slice-3 findings resolved — A-14…A-18 + OV-12…OV-14
Confirms; A-13 / OV-15 resolved-by-fold; §3.7.)

**Execution-gate (Gate 2): BLOCKED pending (a) the carried A1+A2 holds** (A3 reads the A2 `CorpusChunk`
store and calls A2's `acquire_for_topic`, so it needs **A1 + A2 merged**) **and (b) A3's own ratification
surfaces:** a **SPEC §8.9 "seven crons" count amendment** (the corpus-refresh cron) + an **AC-CD7 body
change** (the beat-schedule anchor registers the new cron), whose **net cron-count delta is coupled to
the NS-1 ruling** (§3.3). This detail is written **against the recommended direction**; detail-planning
is **not** gated, only execution.

**Implements:** the **retrieval half** of Stage A that A2 deferred — a corpus retrieval helper
(`cosine_top_k`-over-`CorpusChunk`, returning chunks *with* their authority tier/score for B2 to ground
+ weight) — and the **hybrid refresh** of ruling 6: **per-topic on-demand** (the trigger D3 calls) +
**admin on-demand** (a manual-override domain fn) + a **weekly periodic backstop cron**. It stops there:
**no** generation (Slice 5 / B2), **no** gap-detection / catalogue-health crons (Slice 11 / D4), **no**
admin endpoint or FE (the admin-override *endpoint* is Stage E; A3 ships the domain fn only), **no**
dashboard.

### 3.1 Grounding (verified against the tree at this SHA, `2110a56`)

- **The beat schedule is a flat `dict` of task→cadence (AC-CD7).** `app/beat_schedule.py:38-79`
  `beat_schedule: dict[str, dict[str, Any]]` registers the **seven** SPEC §8.9 crons via
  `celery.schedules.crontab` (e.g. `drive_rag.ingest` daily 03:00, `safety_links.check` monthly day-1
  05:00 — the closest cadence precedents for a periodic corpus refresh). Adding a cron = **one new dict
  entry** + the matching task registration. The docstring (`beat_schedule.py:1-2`) + its **ASCII table**
  hard-code *"the seven … crons"* — a **count-invariant mirror surface** (§3.4).
- **AC-CD7 is the cron/bootstrap anchor.** `CODE_SPEC.md:632` AC-CD7 — *"seven crons; idempotent
  bootstrap job"*; `CODE_SPEC.md:337` *"registers the seven crons (SPEC §8.9)"*; `CODE_SPEC.md:110` tree
  comment *"the seven crons + bootstrap enqueue"*. **The admin-triggered bootstrap is deliberately NOT a
  cron** (`beat_schedule.py:25-33`, AC-CD7 *"idempotent enqueued job; admin-triggered"*) — the precedent
  that A3's **admin on-demand** refresh is a **domain fn / enqueued task, not a beat entry**.
- **`cosine_top_k` is the reusable ranker.** `drive_rag.py:196
  cosine_top_k(query_vec, candidates, *, k)` (keyword-only `k`; auditor A-13) ranks
  `(chunk_id, embedding)` pairs by cosine, tie-broken by id, skips zero-norm; `_DEFAULT_TOP_K=5`
  (`:580`); `render_rag_context` (`:587`). A3's `retrieve_corpus_for_topic` is the **`CorpusChunk`
  sibling** of `retrieve_for_generation` — same ranker, different table, **plus** it returns each hit's
  `authority_tier`/`authority_score` (the A2 columns) so B2 can authority-weight grounding (ruling 3).
  **A3 is therefore a *second consumer* of `cosine_top_k` (overseer OV-15)** — the first being
  `drive_rag.retrieve_for_generation` — so the **A2 §2.3 NS-1 relocation flag applies here too**: if
  NS-1 = retire Drive, `cosine_top_k` (and `chunk_document`/`content_hash`) **relocate to a shared module
  rather than being deleted with the Drive path**, *precisely because* A3's retrieval helper (and A2's
  acquisition) depend on them. A3 strengthens, not weakens, the NS-1 relocation requirement.
- **Ruling 6 (ratified) fixes the *shape*.** Workstream §1 ruling 6: **hybrid** = per-topic on-demand
  (gap-detection trigger) + admin on-demand (manual override) + **weekly** periodic backstop. So the
  **weekly cadence is ratified**; only the operational day/hour is a default (like the other crons'
  02:00–07:00 offsets, `beat_schedule.py:17-19`).
- **The "seven crons" count invariant lives in six+ surfaces** (re-verified): `beat_schedule.py:1-2` +
  the ASCII table, `CODE_SPEC.md:110/337/632`, `ROADMAP.md:193/196`, `SPEC.md` §8.9 (the 7-bullet list),
  and the `CHECKLIST.md` P11 row evidence. This is the **direct parallel of the #106 G9 "seven crons"
  mirror-sweep** — run the three-class grep at execution HEAD.
- **A2 records no per-acquisition `topic`** (verified — §2.2a `CorpusChunk` carries `source_host`, not
  the triggering topic). So a **refresh-target set** ("which topics does the weekly backstop
  re-acquire?") is **not yet derivable** from the A2 store — a design point A3 must resolve (§3.2d /
  §3.3).

### 3.2 Build choices — concrete (recommended direction)

**(a) Corpus retrieval helper — `app/domain/corpus_builder.py` (or a sibling `corpus_retrieval.py`).**
`retrieve_corpus_for_topic(db, *, topic: str, k: int = _DEFAULT_TOP_K, min_tier: Tier | None = None) ->
list[dict]` — embed the topic (reuse the A2 embed path), `cosine_top_k` over `CorpusChunk.embedding`,
return `[{source_doc_ref, source_host, chunk_text, authority_tier, authority_score}]` ranked, optionally
filtered to `>= min_tier`. **Same fail-soft contract** as `retrieve_for_generation` (empty topic → `[]`
no embed; empty corpus → `[]` one embed + cost-audit; embed raises → `[]` WARN). Reuse `cosine_top_k`
unchanged; a corpus `render_*` context helper for B2 (or reuse `render_rag_context`). **This is the
retrieval primitive B2 grounds against** — A3 builds it, B2 consumes it.

**(b) Refresh domain functions — `corpus_builder.py`.** Three triggers, one shared core (all reuse A2's
idempotent `acquire_for_topic`, so re-acquisition dedups by `(source_host, content_hash)` — no dup
chunks):
- **per-topic on-demand** `refresh_corpus_for_topic(db, *, topic)` — thin wrapper over
  `acquire_for_topic`; **the trigger D3's gap-detection sweep calls** (A3 exposes it; D3 wires it).
- **admin on-demand** — the same fn, callable from an admin path; **A3 ships the domain fn only**, the
  endpoint/FE is Stage E (AC-CD7 admin-triggered-job precedent — not a beat entry).
- **weekly backstop** `refresh_corpus_all(db)` — iterates the **refresh-target set** (§3.2d) and calls
  `acquire_for_topic` for each; invoked by the cron (§3.2c).

**(c) The weekly backstop cron — `app/beat_schedule.py` + task registration.** A new entry
`corpus.refresh` → `refresh_corpus_all`, **weekly** (ruling 6; e.g. `crontab(minute=0, hour=8,
day_of_week=1)` — Monday 08:00 UTC, extending the sequential daily-offset convention past the existing
07:00 `engagement.sweep`). This is the slice's **cron-count delta** (§3.3).

**(d) Refresh-target set — the weekly backstop's input (DS3-a, §3.3).** The weekly backstop needs to
know *which topics* to re-acquire. **Lean: derive from the active catalogue** — the distinct
**subjects/pills** Acumen actually assesses (`app/models.py` `Subject`/`Pill`) are the natural "what the
corpus should cover" source, and it **also catches newly-added catalogue topics** the corpus has never
seen. **Recorded as a detail-plan call** *unless* a reviewer reads it as overlapping the
catalogue-health check (D3/NS-4) — in which case it elevates (§3.3). *(Rejected alternative: a
per-`CorpusChunk` `topic` column — A2 is sealed; a backstop keyed on already-acquired topics cannot
discover new gaps, which is exactly what a backstop should also do; the catalogue source is strictly
better and needs no A2 change.)*

**(e) Cron-count mirror sweep (§3.4).** Adding `corpus.refresh` makes the registered set **eight** (or
**seven** net, if NS-1 retires `drive_rag.ingest` — §3.3); every "seven crons" surface is swept.

### 3.3 Embedded ratification-class items — SURFACED (blocking A3 execution, Gate 2)

- **SPEC §8.9 "seven crons" count amendment + AC-CD7 body change.** Class (ii). Registering
  `corpus.refresh` adds a cron; the spec author amends SPEC §8.9 (the bullet list + count) and the AC-CD7
  body (`CODE_SPEC.md:632`), and A3 execution sweeps the code/doc mirrors (§3.4). **The net cron-count
  delta is coupled to NS-1 (sharp point):** the corpus-refresh cron is the **functional successor** of
  `drive_rag.ingest` (both periodic knowledge-base refreshers). **If NS-1 = retire Drive**, `drive_rag.
  ingest` is removed (−1) and `corpus.refresh` added (+1) → **net still seven** (a *replacement*, count
  unchanged — the cleanest mirror-sweep: "Drive ingest → corpus refresh"); **if NS-1 = keep Drive
  dormant**, both exist → **eight**. So the §8.9 amendment's *number* is **not knowable until NS-1
  rules** — the spec author should rule NS-1 and the cron amendment **together**. **Surfaced; the
  amendment is held on NS-1.**
- **Carried A1 + A2 holds** flow through (A3 reads `CorpusChunk` + calls `acquire_for_topic`): A3
  execution-close additionally requires **A1 + A2 merged** (parallel to OV-11), plus **NS-5 phase-home**.
- **Corpus-refresh cadence.** Ruling 6 ratified **weekly** — so the cadence *shape* is **not** re-surfaced;
  only the operational day/hour is a default (§3.2c), like the other crons. (Recorded so the reviewers
  see it is deliberately *not* a surfaced item.)

> **Detail-plan call (not surfaced) — recorded for the reviewers:**
> - **DS3-a — refresh-target set = active catalogue subjects/pills** (§3.2d). Build-design choice; lean
>   catalogue-derived (strictly better than a per-chunk topic column; catches new gaps; no A2 change).
>   **Elevates to a SURFACE only if** a reviewer reads it as overlapping the **catalogue-health check**
>   (D3 / NS-4) — the two are kept distinct here (the **backstop** re-validates/refreshes the corpus for
>   *existing* catalogue topics on a clock; the **health check** is D3's *proactive gap/thin-coverage
>   trigger for generation*), but the boundary is genuinely adjacent, so it is flagged for the reviewers'
>   judgement rather than buried.

### 3.4 Docs / mirror sweeps — the "seven crons" count invariant (three-class grep at execution HEAD)

**Spec surfaces — in the spec-author's SPEC §8.9 + AC-CD7 amendment PR** (held on NS-1 for the *number*):
- `SPEC.md` §8.9 — the cron bullet list + the "several scheduled background processes" framing (add the
  corpus-refresh bullet; adjust the count per the NS-1-coupled net delta);
- `CODE_SPEC.md:632` AC-CD7 body (*"seven crons"*), `CODE_SPEC.md:337` (*"registers the seven crons"*),
  `CODE_SPEC.md:110` tree comment (*"the seven crons + bootstrap enqueue"*);
- `ROADMAP.md:193/196` (*"seven crons scheduled"*) + the `CHECKLIST.md` P11 evidence row.

**Code — in A3's execution** (follows the authored anchors):
- `app/beat_schedule.py` — the new `corpus.refresh` entry **and** the docstring + ASCII-table count
  (the in-body-override sweep: authored prose is truth, the table mirror follows);
- the `refresh_corpus_all` / `refresh_corpus_for_topic` / `retrieve_corpus_for_topic` domain fns + the
  Celery task registration for `corpus.refresh`;
- **re-run the three-class structural grep** (word `seven cron` / numeral / the `beat_schedule` dict
  membership + any cron-count test floor) at execution HEAD; fold completely — **no silent partial-fold**.

### 3.5 Tests (AC-CD15 — `app/domain/*` near-full coverage, zero-network)

1. **Retrieval helper.** `retrieve_corpus_for_topic` over a seeded `CorpusChunk` set ranks by cosine
   (reuse the `cosine_top_k` test pattern), returns each hit's `authority_tier`/`authority_score`,
   honors `min_tier`, and is **fail-soft** (empty topic → `[]` no embed; empty corpus → `[]`; embed
   raises → `[]` WARN) — all offline (stub embed).
2. **Refresh idempotency.** `refresh_corpus_for_topic` / `refresh_corpus_all` reuse A2's dedup → a
   re-run adds no dup `CorpusChunk` rows (assert row-count stable); a changed source adds only the delta.
3. **Backstop target set.** `refresh_corpus_all` iterates the active catalogue subjects/pills (seed a
   couple; assert each triggers an `acquire_for_topic`, fake web/embed).
4. **Cron registered.** `beat_schedule["corpus.refresh"]` exists with a **weekly** `crontab` + the
   correct task name; the registered-cron **count** matches the swept number (a test floor parallel to
   the existing cron set — verify/extend at execution HEAD).
5. **Zero-network** throughout (fake httpx + stub embed; AC-CD15).

### 3.6 What A3 does NOT touch (scope fence)

No **generation** (Slice 5 / B2 consumes `retrieve_corpus_for_topic`); no **gap-detection /
catalogue-health crons** (Slice 11 / D4 — distinct from this weekly *backstop*); no **admin
endpoint/FE** for the manual-override refresh (Stage E; A3 ships the domain fn only, AC-CD7
admin-triggered-job precedent); no **generation grounding wiring**; no **`Operation`/model change**; no
dashboard. The Drive `drive_rag.ingest` cron is **untouched at A3** (its possible removal is the NS-1
ruling + the coupled §8.9 count, not A3 code).

### 3.7 Reviewer findings folded — Slice 3

Round-1 review (auditor `claude/jolly-ptolemy-oui39p` @ `b89dcc7`; overseer `claude/sharp-cray-gueezy`
@ `d3ddc74` comment `4663721943`) — **no blocking finding; 5 + 3 Confirms, 2 low Refines folded; none
dropped.** Slices 1–2 seals **not** re-staled (this fold edits only §3.*).

| ID | Reviewer | Tag | Resolution |
|---|---|---|---|
| **A-14** | auditor | Confirm | Hybrid refresh — all three modes of ruling 6 present (per-topic / admin / weekly). No action. |
| **A-15** | auditor | Confirm | Cron-count sweep + **NS-1↔count coupling "exemplary"** (replacement→net-seven / keep→eight, rule together). No action. |
| **A-16** | auditor | Confirm | Retrieval helper `retrieve_corpus_for_topic` reuses `cosine_top_k` + returns authority. No action. |
| **A-17** | auditor | Confirm | Reuse + scope-fence + admin-as-domain-fn-not-cron + zero-network tests. No action. |
| **A-18** | auditor | Confirm | DS3-a catalogue-target a sound build-choice; + a forward NS-4 coherence watch (kept distinct). No action. |
| **A-13** | auditor | Refine (low) | **Folded:** §3.1 `cosine_top_k` signature `(candidates, query_vec, k)`→**`(query_vec, candidates, *, k)`** (keyword-only `k`; verified `drive_rag.py:196-201`). |
| **OV-12** | overseer | Confirm | Seven-crons sweep completeness + the NS-1 cron interaction independently caught — matches pre-reg. No action. |
| **OV-13** | overseer | Confirm | §8.9 + AC-CD7 surfaced held-on-NS-1; ruling-6 cadence not re-surfaced; full exec-precondition set. No action. |
| **OV-14** | overseer | Confirm | NORMAL merge-class + Slices 1–2 not re-staled. No action. |
| **OV-15** | overseer | Refine (low) | **Folded:** §3.1 now cross-refs that A3's retrieval helper is a **second consumer** of `cosine_top_k`, so the A2 §2.3 **NS-1 relocation flag applies to A3 too** (the shared primitive relocates, not deleted, *because* A3 depends on it) — A3 strengthens the relocation requirement. |

**Round-trips:** A-13 1/5 · OV-15 1/5 (A-14…A-18, OV-12…OV-14 = positive-coverage Confirms — no
round-trip owed). **Set-diff (this revision):** 10 added [A-13…A-18, OV-12…OV-15] / 0 dropped. No
push-back; no design change; no halt-class. Both Refines folded into the same §3.1 bullet. Awaiting both
reviewers' re-verification + Slice-3 seals at the folded content-SHA, then the planner posts
`Status: final for Slice 3`.

---

## Slice 4 (B1) — `Operation.pill_generation` mint + provider/stub wiring

**Status: final for Slice 4 — approved by planner** (content-bound to the Slice-4 substance at
`442247c` — auditor content SEAL (`964e31b`, refreshed after the OV-20 fold) + overseer governance SEAL
(`2524241`) both at `442247c`. **Content-invariant**: only this Status line changed; §4.1–§4.7
byte-identical to `442247c`, so it does **not** re-stale the reviewers' seals (§0.1/§8). All Slice-4
findings resolved — A-19…A-23 + OV-16…OV-19 Confirms; OV-20 resolved-by-fold; §4.7.)

**Execution-gate (Gate 2): BLOCKED pending authenticated ratification of the `Operation.pill_generation`
mint (carried G1) + the prompt-registry version trajectory (carried G7b).** This detail is written
**against the recommended direction** — **mint** `Operation.pill_generation`; **keep** the existing
`pill_proposal` refiner (carried G7a, lean keep); new prompt module at `VERSION = "1.0.0"` carrying the
**core topic→N schema only** (grounding/provenance are Slice 5 / B2). Detail-planning is **not** gated.

**B1's complete execution-precondition set (overseer OV-20 — gate-completeness + the Stage-A-independence
boundary).** Unlike A2/A3, **B1 does NOT require Stage A merged** — the `pill_generation` primitive +
its offline stub **import nothing from Stage A** (`source_authority`/`corpus_builder` are not referenced;
the stub grounds in nothing). **The A→B dependency lands at Slice 5 (B2)**, where generation first grounds
against the corpus — *not* at B1. So **B1 execution-close = { G1 mint + G7b version trajectory
ratifications } + { NS-5 phase-home }**, and B1 is **independently executable** (it may land before, or in
parallel with, the Stage-A execution PRs). B1 **detail** is gated by none of these.

> **Direct lineage to the merged #106 Slice 1.** #106 detail-planned *exactly this op-mint* (PR #106
> `plans/2026-06-07-…detail.md` §1, squashed at `9bde51f`); the parent workstream §9 carries **G1** as
> "ratified-for-#106 / carries to the autonomous generator." This slice re-grounds that detail **at
> `2110a56`** (line numbers re-verified) and **adopts the auditor's GT-1 correction**: the `Operation`
> enum is **already 8** (7 SPEC ops + `embed`), so this mint is *spec-prose "seven → eight"* over an
> **enum 8 → 9**, not a naive "enum seven → eight" (§4.4).

**Implements:** the AI **primitive** the autonomous generator (B2) and the gap-detection trigger (D3)
will call — a versioned `pill_generation` prompt-registry entry, the `Operation`-enum + provider-
resolution wiring that routes it, a deterministic offline **stub**, and an **AC-CD15 zero-network test**.
It stops at the primitive: **no** corpus grounding / provenance chain (Slice 5 / B2), **no** N-row
`processing_tasks` persistence / fan-out / cost-share (Slice 6 / B3), **no** self-review or gate
(Slices 7–8 / C1–C2), **no** endpoint or FE.

### 4.1 Grounding (verified against the tree at this SHA, `2110a56`)

- **The refiner is one-in-one-out (kept; G7a).** `app/ai/prompts/pill_proposal.py` `VERSION="1.0.0"` —
  admin supplies `name`/`description`/`subject_id`/difficulty; output is a **single** object, not a list.
  It does not accept a topic and does not emit N drafts. **B1 leaves it untouched** (recommended-keep).
- **The `Operation` enum is already 8 (GT-1).** `provider.py:136-143` — `generation, grading, weakness,
  learning_material, pill_proposal, grade_review, anchor_self_review, embed`. The docstring (`:122`)
  reads *"The seven AI operations of AC-CD8 v1.6 plus `embed`"*; the routing map (`:128-134`) sends
  `generation`/`weakness`/`learning_material`/`pill_proposal` → `generate`. A generator op is a
  **generate-family** op (AC-D12 primary content) → routes through `AIProvider.generate`,
  Anthropic-default.
- **Provider-default sets.** `_ANTHROPIC_DEFAULT_OPS` (`provider.py:149-157`, the 5 Anthropic ops incl.
  `pill_proposal`); `_REVIEW_DEFAULT_OPS` (`:162-164`). A new generator op joins
  `_ANTHROPIC_DEFAULT_OPS`.
- **Stub dispatch.** `StubAIProvider.generate` switches on the op; an unbranched op falls to a generic
  `{"operation": …, "stubbed": True}` dict — so a `pill_generation` **stub branch** is required for a
  usable offline dev/test path.
- **Four op-keyed structural maps (strict — `KeyError` if unset).** `resolve_model` map
  (`provider.py:418-427`, strict `[operation]` subscript at **`:427`**; `pill_proposal →
  anthropic_model_pill_proposal` at `:423`); `anthropic.py:61` `_MAX_OUTPUT_TOKENS` (strict subscript at
  **`:146`**; `pill_proposal: 1000` at `:66`); `cost.py:132` `OP_TO_METHOD` (total map; `pill_proposal:
  "generate"` at `:137`); `prompts/__init__.py:37` `_REGISTRY` (`pill_proposal` at `:45`;
  `registered_operations() = frozenset(_REGISTRY)` at `:139`). **Each needs a `pill_generation` entry or
  it `KeyError`s / fails a floor** (§4.4).
- **Config + `Settings`.** `resolve_model` reads `anthropic_model_<op>` env-default fields (AC-CD18);
  `anthropic_model_pill_proposal` is the precedent. A new op needs a sibling field or `resolve_model`
  `KeyError`s.
- **Provenance + zero-network.** `AIResult` carries provider/model/prompt_version/tokens/cost; the stub
  returns `prompt_version="0.0.0-stub"`, zero tokens, `cost_usd=0.0` (AC-CD15 no-spend). `conftest.py`
  forbids network in tests; the stub is the offline path.

### 4.2 Build choices — concrete (recommended direction)

**(a) New prompt module — `app/ai/prompts/pill_generation.py`, `VERSION="1.0.0"`.** Mirrors
`pill_proposal.py`'s module shape (docstring JSON contract; `VERSION`; `TEMPLATE`). Inputs: `topic`,
`subject_id` (optional parent), `target_count` (N), `available_difficulty_min`/`_max`. Output: a **list
under a `drafts` key** (a keyed object so B2/B3 can add sibling metadata without re-shaping):
`{"drafts": [{"name", "description", "subject_id"|null, "available_difficulty_min" 1-10,
"available_difficulty_max" 1-10, "estimated_minutes"|null, "safety_relevant" bool, "rationale",
"evidence_count" int, "gap_signal" str}]}`. `evidence_count`+`gap_signal` satisfy the §6.5 output bar
(`SPEC.md:346/348`). **`grounding_refs`/provenance are intentionally absent at v1.0.0** — Slice 5 (B2)
scope; whether B2 bumps to v1.1.0 is the **G7b** sub-question (§4.3). Per-band metadata richer than the
`min/max` pair is **G3** (Slice 6). No `TBD`, no speculative fields (doc-hygiene).

**(b) `Operation` enum + routing — `app/ai/provider.py`.**
- Add `pill_generation = "pill_generation"` to `Operation` (`:136-143`) and list it under `generate` in
  the routing docstring (`:128-134`).
- Add `Operation.pill_generation` to `_ANTHROPIC_DEFAULT_OPS` (`:149-157`).
- Add a `StubAIProvider.generate` branch → `_stub_pill_generation_content(payload)` (module-level):
  deterministic N-draft set **seeded by `topic`+`target_count`** (same input → byte-identical drafts),
  each carrying the full v1.0.0 schema, safety self-classified against the existing stub cue list.
- Add `Operation.pill_generation: "anthropic_model_pill_generation"` to the `resolve_model` map
  (`:418-427`, strict `[operation]` at `:427`).

**(c) The three other op-keyed maps (or it breaks at runtime / fails a floor).**
- `anthropic.py:61` `_MAX_OUTPUT_TOKENS` — add `Operation.pill_generation: ~4000` (N-draft response is
  larger than the 1000-token single ops; strict subscript at `:146` → **generate-time `KeyError`**
  without it).
- `cost.py:132` `OP_TO_METHOD` — add `Operation.pill_generation: "generate"` (cost-dashboard routing;
  `set(OP_TO_METHOD)==set(Operation)` floor fails without it).
- `prompts/__init__.py:37` `_REGISTRY` — add `Operation.pill_generation: (pill_generation.TEMPLATE,
  pill_generation.VERSION)` (so `get_prompt`/`registered_operations()` resolve it).

**(d) Config field — `app/config.py`.** Add `anthropic_model_pill_generation` (env-default, AC-CD18),
sibling to `anthropic_model_pill_proposal`; `.env.example` gets `ANTHROPIC_MODEL_PILL_GENERATION=`. An
**absorbable AC-CD18 addition** riding G1 (it exists only if the op is minted) — folded into the slice
handover, not a separate spec PR (the #106 OV-S1.11 ruling; caveat: holds only while B1 stays within one
sibling field + one prompt module).

**(e) No domain / router / FE in B1.** `enqueue_*` + N-row persistence is Slice 6; grounding is Slice 5;
the endpoint/trigger are Slice 4-of-#106-analog → here the autonomous trigger is D3. B1's only callable
surface is `resolve_provider(Operation.pill_generation).generate(...)`, exercised by §4.5.

### 4.3 Embedded ratification-class items — SURFACED (blocking B1 execution, Gate 2)

- **G1 (carried) — mint `Operation.pill_generation`.** Class (i) (AC-CD8 / AC-D1 anchor) + (ii) (the
  SPEC §6 ops-count prose). **Recommendation: MINT** (the refiner and the generator have different
  input *and* output contracts; overloading one op would force payload-shape branching and conflate
  per-op cost/provenance aggregation). **Carried from #106 §9 as ratified-for-#106**, but per Gate 2 the
  mint is re-confirmed through **this** workstream's execution-PR authenticated channel (OV-2 — the
  merged #106/#107 record reads as a relay downstream). **Ratification scope is class (i)+(ii)**: it
  amends `DECISIONS.md:96` (AC-D1 *Implications*, an **AC-D body**) + `DECISIONS.md:63` (AC-CD8 numeral)
  + the SPEC ops-count prose + the code mirrors (§4.4). **Blocks B1 execution.**
- **G7b (carried) — prompt-registry version trajectory.** Class (ii)/(iv). B1 lands `pill_generation`
  at **v1.0.0** (core topic→N schema). When Slice 5 (B2) adds `grounding_refs`/provenance to the output
  contract, does the version **bump to v1.1.0** (the persisted `prompt_version` then records which
  contract produced each draft) or does the **full schema land at v1.0.0 now** with empty
  `grounding_refs` until B2 fills it? **Recommendation: bump per contract change (v1.0.0 → v1.1.0 at
  B2)** — landing fields B1 cannot populate violates doc-hygiene; a version bump is what the persisted
  registry is *for*. **Blocks B1 execution** (the `VERSION` string + the schema it pins).
- **G7a (carried, lean — *not* B1-blocking).** Keep the `pill_proposal` refiner as an optional manual
  path (parent §4.5 / §9). B1 keeps it untouched; its ultimate fate as an "optional manual surface" is a
  Stage-E/dashboard question, not a B1 gate. Recorded so the reviewers see it is carried-lean, not baked.

### 4.4 Docs / mirror sweeps — the "seven AI operations" count invariant (the load-bearing sweep)

Minting `pill_generation` makes the **named** AI-operation count **eight** (the SPEC prose names the 7
non-`embed` ops) over an `Operation` **enum 8 → 9** (GT-1). This is the #106 Slice-1 three-class
structural mirror-sweep, re-grounded here. **Dissolves entirely if G1 = EXTEND** (no new op → count
stays seven). **Re-run all three greps at execution HEAD** (keyed on *structure*, not recalled names):

```
# (A) WORD forms  # (A2) NUMERAL forms  # (B) STRUCTURAL (name-agnostic)
grep -rniE 'seven[- ](value|ai|distinct|operation|prompt)|(all|the|each) seven (ai )?(operation|prompt)|five of seven|eighth (ai )?operation' SPEC.md CODE_SPEC.md DECISIONS.md ROADMAP.md CHECKLIST.md app/ tests/ | grep -viE 'cron|seventh integrity'
grep -rnE '[0-9]+-(operation|method)' SPEC.md CODE_SPEC.md DECISIONS.md app/ tests/ | grep -viE 'cron'
grep -rnE 'dict\[Operation|\[operation\]|set\(Operation\)|list\(Operation\)|frozenset\(_REGISTERED' app/ tests/
```

**Spec surfaces — in the spec-author's G1 amendment PR** (spec-author-authored; the AC-CD8 body change
rides it): `SPEC.md:296` ("seven distinct AI operations" + the by-name enumeration → eight),
`SPEC.md:372` ("All seven prompts"), `SPEC.md:397` ("five of seven" → six of eight; `pill_generation`
is Anthropic-default), `SPEC.md:443` ("all seven operations"), `SPEC.md:523` (SiteMesh "seven AI
operations"), **SPEC §6 subsection structure** (the generator needs its own §6 subsection — coordinate
with the §6.5 rewrite, Slice 10/D3), `CODE_SPEC.md` AC-CD8 prose ("seven operations"), **`DECISIONS.md:96`
AC-D1 *Implications*** (AC-D **body** — "seven AI-driven operations", by-name; class (i)), **`DECISIONS.md:63`
AC-CD8 numeral** ("7-operation → 4-method" → 8-operation). *(Re-verify each line at execution HEAD;
several are the surfaces #106 took four rounds to fully enumerate — the structural greps close the set
by construction.)*

**Code — in B1's execution** (in-body-override; the authored anchor is truth, mirrors follow):
- `provider.py:122` enum docstring ("seven AI operations … plus `embed`" → eight … plus `embed`) +
  `provider.py:4` module docstring twin (if it carries the count — verify);
- `prompts/__init__.py:10` package docstring (lists the ops — add `pill_generation`);
- the **four op-keyed maps** (§4.2b/c: `resolve_model`, `_MAX_OUTPUT_TOKENS`, `OP_TO_METHOD`, `_REGISTRY`)
  + `_ANTHROPIC_DEFAULT_OPS` membership + the stub branch;
- `.env.example` (`ANTHROPIC_MODEL_PILL_GENERATION=`).

**The construction oracle (what makes this regress-proof).** The code carries its own completeness
oracles: `test_p5_cost.py` `assert set(OP_TO_METHOD) == set(Operation)`, `test_p5_prompts.py`
`registered_operations() == frozenset(_REGISTERED_OPERATIONS)`, `test_p5_resolve.py` `_ALL_OPS =
list(Operation)` per-op loop — **each red-flags its surface the moment `pill_generation` joins the enum
and the suite runs**. So the two-tier method: **(1) doc/spec prose** — no test catches a stale "seven"
in prose, so the **(A)+(A2) greps are load-bearing and must be exhaustive**; **(2) code** — the executor
adds the enum member + brings the full suite + `mypy` green, which catches every coverage-tested +
exercised-subscript site (incl. `anthropic.py:61`'s `KeyError`-only-at-real-call latent surface). Grep
proves the un-oracled; the green suite proves the rest.

### 4.5 Tests (AC-CD15 — `app/ai/*` near-full coverage, zero-network)

New `tests/unit/test_ai_pill_generation.py`:
1. **Resolution.** `resolve_provider(Operation.pill_generation)` → Anthropic singleton when keyed, else
   `StubAIProvider`; `resolve_model` → `anthropic_model_pill_generation`; a `model_by_operation` override
   wins.
2. **Stub determinism + schema.** `StubAIProvider.generate(pill_generation, payload)` → `content["drafts"]`
   of length `target_count` (clamped), each carrying the full v1.0.0 keys; **same payload → byte-identical
   set** on re-call; safety self-classification fires on a cue-bearing topic.
3. **Provenance.** The `AIResult` carries `provider="stub"`, `prompt_version="0.0.0-stub"`, zero tokens,
   `cost_usd=0.0`.
4. **Zero-network** under the `conftest.py` guard, no monkeypatched real provider.
5. **Enum/routing + map-completeness guard.** `pill_generation ∈ _ANTHROPIC_DEFAULT_OPS`, routes via
   `generate`; the `set(OP_TO_METHOD)==set(Operation)` + `registered_operations()` floors pass with the
   new member; `resolve_model(pill_generation)` does not raise.

**Acceptance for B1 (execution):** the tests pass under the three-layer green gate; the structure-gate
passes with the new prompt module + config field; the four op-keyed maps + the floors are green; no
network.

### 4.6 What B1 does NOT touch (scope fence)

No `app/domain/catalogue.py` (`enqueue_*`/persistence — Slice 6); no corpus grounding / provenance chain
(Slice 5 / B2); no `app/routers/*` / FE; no migration (B1 adds no table/column); no self-review / gate
(C1–C2); no cron; no signal store (Stage D). The `pill_proposal` refiner is **untouched** (G7a keep).

### 4.7 Reviewer findings folded — Slice 4

Round-1 review (auditor `claude/jolly-ptolemy-oui39p` @ `eecdb4b` review — **5 Confirms, 0 Refines,
sealed @ `351d562`**; overseer `claude/sharp-cray-gueezy` @ `c4fd5b5` comment `4663807161`) — **no
blocking finding; 5 + 4 Confirms, 1 low Refine folded; none dropped.** Slices 1–3 seals **not** re-staled
(this fold edits only §4.*). *The auditor's early seal @ `351d562` is re-staled by this OV-20 fold (§0.1)
and re-verifies at the folded SHA — OV-20 is a gate-completeness clarification that touches no content the
auditor's Confirms cover.*

| ID | Reviewer | Tag | Resolution |
|---|---|---|---|
| **A-19…A-23** | auditor | Confirm ×5 | `pill_generation` a **new** op distinct from `generation`/`pill_proposal`; the **ops-count GT-1 sweep "exemplary"** (enum 8→9 / spec-prose seven→eight; all cites verified accurate — `SPEC.md:296/372/397/443/523`, `DECISIONS.md:63/96`, the 4 op-keyed maps + 3 construction-oracle test floors, no drift); provider/stub/prompt wiring correct; **G1 surfaced fresh** (PS-B1.7) + G7b surfaced + G7a carried-lean; scope fence clean. No action. |
| **OV-16** | overseer | Confirm | Ops-count sweep per GT-1 with grep commands + construction-oracle floors. No action. |
| **OV-17** | overseer | Confirm (dominant) | **G1 op-mint surfaced FRESH** — §4.3 cites OV-2 (#106 ratification reads as a relay downstream; re-confirmed through this workstream's exec-PR channel; blocks B1 exec; **not** baked on superseded #106). No action. |
| **OV-18** | overseer | Confirm | G7b carried/leaned/blocks-exec, not baked; G7a carried-lean. No action. |
| **OV-19** | overseer | Confirm | NORMAL merge-class + Slices 1–3 not re-staled + absorbable AC-CD18 config. No action. |
| **OV-20** | overseer | Refine (low) | **Folded:** the execution-gate now states **B1's complete precondition set** = { G1 mint + G7b } + { NS-5 } **and the Stage-A-independence boundary** — B1's stub imports nothing from Stage A, so **B1 does not require Stage A merged** (the A→B dependency lands at B2, not B1; B1 is independently executable). |

**Round-trips:** OV-20 1/5 (A-19…A-23, OV-16…OV-19 = positive-coverage Confirms — no round-trip owed).
**Set-diff (this revision):** 10 added [A-19…A-23, OV-16…OV-20] / 0 dropped. No push-back; no design
change; no halt-class. Awaiting both reviewers' (re-)seal at the folded content-SHA, then the planner
posts `Status: final for Slice 4`.

---

## Slice 5 (B2) — corpus-grounded generation + per-draft provenance chain

**Status: final for Slice 5 — approved by planner** (content-bound to the Slice-5 substance at
`39273dd` — auditor content SEAL (`c9b94ae`, 5 Confirms / 0 findings) + overseer governance SEAL
(`29c8a20`, 4 Confirms / no Refine) both at `39273dd`. **Content-invariant**: only this Status line
changed; §5.1–§5.7 byte-identical to `39273dd`, so it does **not** re-stale the reviewers' seals
(§0.1/§8). **Genuinely clean — no fold:** all Slice-5 findings (auditor A-24…A-28 + the overseer's 4)
were Confirms; the clean-seal record is in the planner wake-log.)

**Execution-gate (Gate 2): BLOCKED pending (a) the carried holds — B2 is where the A→B dependency lands
(OV-20):** it grounds against the corpus, so it needs **A2 + A3 merged** (the `CorpusChunk` store +
`retrieve_corpus_for_topic`) **and B1 merged** (the `pill_generation` op), **plus NS-5** — **and (b) B2's
own ratification surfaces:** a **new AC-D (provenance chain)**, an **AC-D22 reframe** (the AI-built corpus
is queried at §6.5 pill generation), the **G7b** v1.0.0→v1.1.0 bump (now materialised), and the carried
**NS-3** (provenance granularity). Written **against the recommended direction**; detail-planning is
**not** gated.

**Implements:** the B1 `pill_generation` primitive learns to **ground** — it retrieves corpus context for
the *topic* (A3's `retrieve_corpus_for_topic`), grounds each generated claim in cited corpus chunks, and
emits a **provenance chain** per draft (which corpus chunk(s)/source(s) grounded each claim, with the
chunk's authority tier). It stops there: **no** N-draft fan-out / `processing_tasks` persistence /
cost-share / per-band decomposition (Slice 6 / B3), **no** self-review or gate (C1–C2), **no** endpoint/FE.

### 5.1 Grounding (verified against the tree at this SHA, `2110a56`)

- **The test-generation prompt is the grounding precedent.** `app/ai/prompts/generation.py`
  `VERSION="1.2.0"` injects `{rag_context}` (`:56`) + the instruction *"ground in the material (do not
  invent facts beyond it; if it is empty, fall back to general knowledge)"* (`:67`); v1.1.0 first added
  `rag_context` per AC-D22 P9 (`:16`). **B2 mirrors this** for `pill_generation` — a `{corpus_context}`
  slot + a *ground-and-cite* instruction — bumping `pill_generation` v1.0.0 → **v1.1.0** (the B1-surfaced
  G7b trajectory, now landing).
- **A3 supplies the retrieval.** `retrieve_corpus_for_topic` (Slice 3 / A3) returns ranked `CorpusChunk`
  hits **with `source_doc_ref`/`source_host`/`authority_tier`/`authority_score`** — exactly the fields a
  provenance chain records. B2 consumes it (the A→B dependency lands here, OV-20).
- **`AIProvenanceMixin` is per-row *cost* provenance, NOT a claim→source chain.** `models.py:213-227`
  carries `ai_provider`/`ai_model`/`ai_cost_usd` per row (the embedding/generation *call* cost). It does
  **not** record *which source grounded which claim*. **The provenance chain is greenfield** — a grep of
  `models.py` for `provenance|claim|citation|grounding` finds only `AIProvenanceMixin` + its consumers.
  ⇒ B2 mints a **new model + a new AC-D**.
- **Per-source rollback (ruling 5 / E2) forces a *queryable* provenance store.** E2's per-source rollback
  must *"retract everything grounded on a discredited/withdrawn corpus source"* — which requires querying
  provenance **by `source_host`/`corpus_chunk_id`**. So the provenance chain must be a **relational
  table** (`draft_id` × `claim_ref` × `corpus_chunk_id`/`source_host` × `authority_tier`), **not** an
  opaque JSONB blob on the draft. This is the load-bearing shape constraint (§5.2b).
- **`record_provenance_share` is the B3 cost-share, not B2.** `cost.py:97 record_provenance_share(entity,
  result, *, share_count)` splits one call's cost across N entities — the **N-draft fan-out** primitive,
  **Slice 6 / B3** (confirmed: B2 is single-grounded-generation + provenance contract; B3 scales to N).
- **Drafts persist as `ProcessingTask` rows.** `models.py:1174 ProcessingTask` (status + JSONB `payload`)
  is the #106-precedent draft carrier — but the **N-row fan-out persistence is B3**. B2 defines the
  provenance **model + writer**; B3 reuses the writer when it persists the N drafts (§5.3 B2/B3 split).

### 5.2 Build choices — concrete (recommended direction)

**(a) Corpus-grounded generation — `pill_generation` v1.1.0 + a domain fn.** Bump
`app/ai/prompts/pill_generation.py` `VERSION` → **`1.1.0`** (G7b): add a `{corpus_context}` slot + the
instruction *"ground each draft's claims in the cited corpus context; each draft must cite, in
`grounding_refs`, the `source_doc_ref`s it used; do not invent beyond the corpus; if empty, fall back to
general domain knowledge"* (mirrors `generation.py:67`). Output schema gains **`grounding_refs: [str]`**
per draft. A domain fn `generate_grounded_drafts(db, *, topic, target_count)` calls
`retrieve_corpus_for_topic(topic)` (A3) → `render_*` the corpus context (with authority tier/score) →
`resolve_provider(pill_generation).generate(...)` → parses drafts + builds the provenance chain (b).
Empty corpus → `grounding_refs: []` + general-knowledge fallback (same fail-soft as `generation.py`).

**(b) Provenance-chain model — new `GenerationProvenance` table + migration.** A **relational** table (per
the E2 by-source-query constraint, §5.1): columns `id`, `tenant_id`, `draft_ref` (the draft the claim
belongs to — a `ProcessingTask`/pill ref once B3 persists), `claim_ref` (the claim/assertion identifier —
shape per **NS-3**, §5.3), `corpus_chunk_id` (FK → `CorpusChunk`), `source_host`, `authority_tier`,
`authority_score`, `created_at`. Indexed on `source_host` + `corpus_chunk_id` (the E2 rollback query
keys). The generation fn writes one row per (claim, grounding-chunk). **New AC-D (provenance chain)** +
the migration (up/down clean).

**(c) Authority-weighted grounding (ruling 3).** The corpus context rendered into the prompt carries each
chunk's **authority tier/score** (A1/A2), and the provenance rows stamp it — so downstream Stage-C
confidence (C2) can weight a draft by the authority of the sources that grounded it, and Stage-E (E1) can
show the authority breakdown. B2 *records* authority on the provenance; C2/E1 *consume* it.

**(d) DS2-b coupling.** If the spec author rules the A2 "cross-reference" step ≥ **(ii) cross-source
corroboration** (Slice 2 §2.3, DS2-b), the provenance chain is the natural home for the **corroboration
count** (how many authoritative sources independently support a claim) — a per-`claim_ref` aggregate over
the `GenerationProvenance` rows. B2 is authored so corroboration is an **additive** read over the
provenance table *iff* DS2-b rules ≥(ii); it bakes nothing.

### 5.3 Embedded ratification-class items — SURFACED (blocking B2 execution, Gate 2)

- **New AC-D — provenance chain** (claim → corpus source, with authority tier). Class (i). The
  spec-author-authored AC-D body + the `GenerationProvenance` model rides it. (Next sequential after the
  source-authority AC-D mint; the spec author assigns.) Blocks B2 execution.
- **AC-D22 reframe — corpus queried at §6.5 pill generation.** Class (i)/(ii). Coordinates with the
  **A2 AC-D22 body change** (Drive retired → AI-built corpus): B2 adds the **§6.5-generation grounding
  use** ("the index is queried at every generation call" extends from §6.1/§6.4 to **§6.5**). Fold with
  the A2 AC-D22 change so AC-D22 is amended **once**, completely (the Drive→corpus mirror-sweep + the
  §6.5 extension together). Blocks B2 execution.
- **NS-3 (carried) — provenance granularity: per-claim vs per-draft source-set.** Ruling 0a says *"every
  generated claim traces"* → **per-claim intent**; the **decomposition unit** (what counts as a "claim" —
  a sentence? an assertion? the whole draft's source-set?) is the open point. **Lean: per-assertion**
  (each factual claim in a draft maps to its grounding chunk(s)) — it is what makes per-source rollback
  (E2) *precise* (retract the claims a discredited source grounded, not the whole draft). **But the
  granularity sets the `claim_ref` shape + the row cardinality**, so it is **surfaced, not baked**
  (class (i)/(ii), rides the provenance AC-D). *If ruled per-draft-set, `claim_ref` collapses to the
  draft and the table is per-(draft, source).*
- **G7b (carried) — the v1.0.0→v1.1.0 bump lands here.** B1 surfaced the trajectory; B2 materialises it
  (the `grounding_refs` + corpus-grounding contract). The persisted `prompt_version` now records v1.1.0
  on every B2-grounded draft. (Recorded as *resolved-here* once G7b rules "bump per contract change".)
- **Carried holds:** B2 execution needs **A2 + A3 + B1 merged** (corpus + retrieval + op) **+ NS-5** — the
  first slice where the A→B serialization (parent §5, OV-20) actually binds.

> **B2/B3 split (auditor PS-B2 "persistence-split watch") — stated explicitly.** **B2** owns: the
> grounding prompt-bump, the grounded-generation domain fn, the **provenance model + writer + new AC-D**,
> and writing provenance for the drafts the primitive returns. **B3** owns: **N-draft fan-out**, the
> `ProcessingTask` N-row **persistence**, **cost-share** (`record_provenance_share` across N), and
> per-band decomposition (G3). The seam: B3 reuses B2's provenance writer when it persists each of the N
> drafts — B2 defines *how a draft's provenance is recorded*; B3 defines *persisting N of them*. No
> overlap: B2 has the model/contract, B3 has the fan-out/cost-share.

### 5.4 Docs / mirror sweeps

**Spec surfaces — in the spec-author's amendment PR(s)** (spec-author-authored):
- the new **provenance-chain AC-D** body in `DECISIONS.md` + its decision-count header bump;
- the **AC-D22 reframe** (`DECISIONS.md` AC-D22 body + `SPEC.md` §6.5 + the §7.3→corpus prose) — folded
  with the A2 AC-D22 change (amend once);
- **SPEC §6.5** gains the corpus-grounding + provenance language (coordinate with the §6.5 rewrite,
  Slice 10 / D3, so §6.5 is amended coherently).

**Code — in B2's execution:** `pill_generation.py` v1.1.0; the `generate_grounded_drafts` domain fn; the
`GenerationProvenance` model + migration (up/down) + indices; the stub extended to echo injected corpus
refs into `grounding_refs` + emit deterministic provenance rows (offline); `app/ai/cost.py` — no new
spend table (provenance rows carry no independent AI cost; the generation call's cost rides the draft via
`AIProvenanceMixin`/`record_provenance_share` at B3). Re-verify at execution HEAD.

### 5.5 Tests (AC-CD15 — zero-network)

1. **Grounded generation.** `generate_grounded_drafts` with a seeded `CorpusChunk` set (stub embed +
   stub generate) → drafts whose `grounding_refs` echo the retrieved `source_doc_ref`s; empty corpus →
   `grounding_refs: []` + general-knowledge fallback (assert the prompt rendered `(none)`).
2. **Provenance chain written.** Each grounded draft writes `GenerationProvenance` rows mapping
   `claim_ref` → `corpus_chunk_id`/`source_host`/`authority_tier`; assert the rows are queryable **by
   `source_host`** (the E2 rollback key) and **by `draft_ref`**.
3. **Authority recorded.** The provenance rows carry the A1 tier/score from the grounding chunks.
4. **Version bump persisted.** A grounded draft's provenance carries `prompt_version == "1.1.0"`.
5. **Determinism + zero-network.** Stub corpus + stub generate → byte-identical drafts + provenance on
   re-call; no network (AC-CD15).

### 5.6 What B2 does NOT touch (scope fence)

No **N-draft fan-out / `ProcessingTask` persistence / cost-share / per-band decomposition** (Slice 6 /
B3); no **self-review / confidence / auto-publish gate** (C1–C2); no **endpoint/FE**; no **gap-detection
trigger** (D3 calls `generate_grounded_drafts`); no **dashboard / rollback** (E — though B2's provenance
table is what E2's per-source rollback queries). The `pill_proposal` refiner + Drive path are untouched
(Drive retirement is the NS-1 ruling, not B2 code).

### 5.7 Reviewer findings folded — Slice 5

*(none yet — Slice 5 posted for review; accumulates the auditor's + overseer's Slice-5 findings, the
per-round set-diff, and round-trip counts as the loop runs.)*

---

## Slice 6 (B3) — N-draft fan-out + `processing_tasks` persistence + cost-share

**Status: final for Slice 6 — approved by planner** (content-bound to the Slice-6 substance at
`07080d1` — auditor content SEAL (`696bda3`, 5 Confirms / 0 findings) + overseer governance SEAL
(`43e6af3`, 4 Confirms / no Refine) both at `07080d1`. **Content-invariant**: only this Status line
changed; §6.1–§6.7 byte-identical to `07080d1` (incl. §6.7 at its sealed placeholder), so it does **not**
re-stale the reviewers' seals (§0.1/§8). **Genuinely clean — no fold**; the clean-seal record is in the
planner wake-log.)

**Execution-gate (Gate 2): BLOCKED pending (a) the carried holds — B3 needs B2 merged** (the
grounded-generation fn + provenance writer; transitively A2+A3+B1) **+ NS-5 — and (b) B3's own surface:**
the carried **G3** (per-band difficulty decomposition). Written **against the recommended direction**;
detail-planning is **not** gated.

**Implements:** the **fan-out + persistence + cost-share** around B2's grounded-generation primitive —
one generation call → **N persisted draft rows**, each carrying its provenance and its **1/N cost
share**, all stamped with a **generation-batch id** (for the ruling-5 per-batch rollback, E2). It stops
there: **no** self-review or auto-publish gate (Slices 7–8 / C1–C2 consume these draft rows), **no**
gap-detection trigger (Slice 10 / D3 invokes the fan-out), **no** endpoint/FE, **no** dashboard/rollback
(Slice 13 / E2).

### 6.1 Grounding (verified against the tree at this SHA, `2110a56`)

- **`ProcessingTask` is the draft carrier (AC-CD7).** `models.py:1174-1192` — `task_name` (indexed),
  `status` (`ProcessingTaskStatus`: pending/running/done/failed, `models.py:152-156`), `payload` (JSONB),
  `error`, `started_at`/`finished_at`. The **N generated drafts persist as `processing_tasks` rows**
  (the #106 precedent), each `payload` carrying the draft + grounding_refs + provenance.
- **`enqueue_pill_proposal` is the persistence precedent.** `catalogue.py:488-527` creates **one**
  `ProcessingTask(task_name=PROPOSAL_TASK_NAME, status=pending, payload={proposal, provenance})`. B3's
  `enqueue_generated_drafts` is the **1:N** sibling — one call → N rows.
- **`record_provenance_share` is the N-cost-split.** `cost.py:97 record_provenance_share(entity, result,
  *, share_count)` divides one call's tokens/cost by `share_count` (the 1:N case named in its docstring,
  `cost.py:99`). B3 splits the single `generate_grounded_drafts` `AIResult` across the N drafts.
- **`_pill_proposal_spend` is the payload-based spend aggregator.** `cost.py:197-206` sums per-call cost
  out of `processing_tasks.payload` for `pill_proposal` rows into `current_month_spend` (the AC-CD8
  spend invariant for entities with no `AIProvenanceMixin` row). B3 needs a **`_pill_generation_spend`
  sibling** (the drafts live in `processing_tasks.payload`, not on an `AIProvenanceMixin` row) — an
  **absorbable AC-CD8-pattern mirror** (§6.4), not a new anchor.
- **Per-batch rollback (ruling 5) needs a batch id.** Ruling 5's matrix includes *"per generation
  batch"* — so the N drafts of one run must share a **`batch_id`** that E2 (Slice 13) rolls back by.
  Greenfield (no batch concept exists). B3 stamps it (§6.2b).
- **B2 supplies the per-draft provenance writer.** `generate_grounded_drafts` (B2) returns drafts + their
  `GenerationProvenance` rows; **B3 persists N of them, reusing B2's writer per draft** (the B2/B3 seam,
  Slice 5 §5.3).

### 6.2 Build choices — concrete (recommended direction)

**(a) Fan-out + persistence — `app/domain/catalogue.py` (or a sibling `generation.py`).**
`enqueue_generated_drafts(db, *, topic, target_count, batch_id, gap_signal=None) -> list[ProcessingTask]`
— calls `generate_grounded_drafts(topic, target_count)` (B2) → for each draft, create a
`ProcessingTask(task_name="pill_generation", status=pending, payload={draft fields, grounding_refs,
batch_id, gap_signal, provenance:{provider, model, prompt_version, cost_share}})`. One call → N rows;
each row is a **candidate awaiting the C auto-publish gate** (not a human approve queue — the gate is
autonomous, C1–C2).
**(b) Generation-batch id.** Each fan-out run gets a `batch_id` (UUID) stamped on all N rows' payload
(and on the `GenerationProvenance` rows). **Lean: a `batch_id` field** (payload + provenance), *not yet*
a separate `GenerationBatch` table — the table, if E2 needs batch metadata (trigger, timestamp, source
topic), is an **E2 decision** (DS6-a, §6.3). The `batch_id` itself is the minimum E2 per-batch rollback
needs and is cheap to stamp now.
**(c) Cost-share.** Split the single generation `AIResult` across the N drafts: each draft payload's
`provenance.cost_share = cost_usd / N` (+ tokens // N), via `record_provenance_share` semantics applied
to the payload dict. The `_pill_generation_spend` aggregator (§6.4) sums them so the monthly total stays
exact (AC-CD8). The rounding remainder (< N) is dropped, mirroring `record_provenance_share`
(`cost.py:111`).
**(d) Idempotency / dedup.** A re-triggered generation for the same gap must not duplicate drafts. **Lean:
dedup on `(topic, gap_signal)` for *pending* draft rows** — if a batch for the same gap is already
pending the gate, skip (return the existing). This is the B3 half of the **3-arm dedup** the D-stage
gap-detection owns (Slice 9–10); B3 enforces the persistence-layer guard, D enforces the signal-layer
guard. *(Carried from #106 Slice 3's idempotency concern.)*
**(e) Provenance per draft (B2 seam).** For each persisted draft, write its `GenerationProvenance` rows
(B2's writer) carrying the same `batch_id` — so E2's per-source **and** per-batch rollback both resolve.

### 6.3 Embedded ratification-class items — SURFACED (blocking B3 execution, Gate 2)

- **G3 (carried-open) — per-band difficulty decomposition.** Class (ii) (the generation output contract /
  pill difficulty axis). How is the N-draft set decomposed across difficulty? **Lean: `min/max` range
  only** — each draft carries `available_difficulty_min/max` (the **existing** axis, `DECISIONS.md` AC-D9;
  `calibration.py` `_expand_supported_bands` consumes it), with **no** richer per-band breakdown at B3.
  Rationale: the min/max envelope is what the calibration/anchor machinery already consumes; a per-band
  decomposition (e.g. "2 drafts at band 3, 2 at band 5") is speculative until data shows it is needed
  (*"rein in if it breaks"*). **Surfaced, not baked** — if the spec author wants per-band targeting, the
  generation prompt + the draft schema gain a band-distribution field. Carried from #106 §9 (G3, lean
  min/max).
- **Carried holds:** B3 needs **B2 merged** (transitively A2+A3+B1) **+ NS-5**.

> **Detail-plan calls (not surfaced) — recorded for the reviewers:**
> - **DS6-a — `batch_id` field vs. a `GenerationBatch` table.** Lean **field on payload + provenance**
>   now (the minimum per-batch rollback needs); a `GenerationBatch` *table* (batch trigger/timestamp/topic
>   metadata) is **deferred to E2** (Slice 13), which owns the rollback contract — surfaced *there* if E2
>   needs batch metadata beyond the id.
> - **DS6-b — drafts as `processing_tasks` rows vs. a new draft table.** Lean **reuse `processing_tasks`**
>   (the #106 precedent + AC-CD7; `task_name="pill_generation"`), an absorbable structural choice. A
>   dedicated draft table is unnecessary pre-gate; published pills are real `Pill` rows (created at the C
>   gate, Slice 8).

### 6.4 Docs / mirror sweeps

**Code — in B3's execution** (no new anchor; the spend-aggregator is an absorbable AC-CD8 mirror):
- `app/domain/catalogue.py` (or `generation.py`) — `enqueue_generated_drafts`;
- `app/ai/cost.py` — **`_pill_generation_spend`** aggregator (mirror `_pill_proposal_spend`
  `cost.py:197`) + register it in `current_month_spend`'s payload-spend set, so the N-draft cost joins the
  monthly total (the AC-CD8 spend invariant; verify the exact aggregation wiring at execution HEAD);
- no migration if `batch_id` rides `payload` (DS6-a lean) and drafts reuse `processing_tasks` (DS6-b).
**Spec surfaces:** none new beyond what the generation/provenance AC-Ds (Slices 4–5) already carry — B3
is a fan-out/persistence mechanism over the already-surfaced contracts. *(G3, if ruled per-band, amends
the generation output contract — folded into the generation AC-D / §6.5, not a separate B3 anchor.)*

### 6.5 Tests (AC-CD15 — `app/domain/*` near-full coverage, zero-network)

1. **Fan-out.** `enqueue_generated_drafts(topic, target_count=N)` (stub generate + stub corpus) → **N**
   `processing_tasks` rows, `task_name="pill_generation"`, `status=pending`, each payload carrying the
   draft + `grounding_refs` + a shared `batch_id` + `gap_signal`.
2. **Cost-share exact.** The N payloads' `provenance.cost_share` sum (+ the dropped remainder) equals the
   single call's `cost_usd`; `_pill_generation_spend` returns that sum (AC-CD8 invariant).
3. **Provenance per draft.** Each draft's `GenerationProvenance` rows carry the same `batch_id` and are
   queryable by `source_host` (E2 key) and `batch_id` (per-batch rollback key).
4. **Idempotency.** Re-running for the same `(topic, gap_signal)` with a pending batch → **no** new rows
   (returns the existing).
5. **G3 min/max.** Each draft carries `available_difficulty_min/max` within `1..10`; no per-band field
   (the leaned contract).
6. **Zero-network** throughout (stub generate + stub corpus; AC-CD15).

### 6.6 What B3 does NOT touch (scope fence)

No **self-review / confidence / auto-publish gate** (C1–C2 consume the `pending` draft rows); no
**`Pill` creation** (that is the C gate's publish step, Slice 8); no **gap-detection trigger** (D3 calls
`enqueue_generated_drafts`); no **endpoint/FE**; no **dashboard / rollback** (E2 — though B3's `batch_id`
+ B2's provenance are what E2 rolls back by). The `pill_proposal` refiner + its `enqueue_pill_proposal`
are untouched (B3 is a distinct `task_name`).

### 6.7 Reviewer findings folded — Slice 6

*(none yet — Slice 6 posted for review; accumulates the auditor's + overseer's Slice-6 findings, the
per-round set-diff, and round-trip counts as the loop runs.)*

---

## Slice 7 (C1) — multi-pass + cross-model self-review protocol (the safety floor)

**Status: final for Slice 7 — approved by planner** (content-bound to the Slice-7 substance at
`e46e9f5` — auditor content SEAL (`2cbb5c0`, refreshed after the OV-33 fold; A-34…A-39 hold) + overseer
governance SEAL (`46c4bcb`, OV-33 resolved) both at `e46e9f5`. **Content-invariant**: only this Status
line changed; §7.1–§7.7 byte-identical to `e46e9f5`, so it does **not** re-stale the reviewers' seals
(§0.1/§8). All Slice-7 findings resolved — A-34…A-39 + OV-29…OV-32 Confirms; OV-33 resolved-by-fold;
§7.7. **NS-7 stands PENDING AUTHENTICATION** — the safety-floor degradation rule is recorded un-baked and
escalated to the spec author; it does not block the Slice-7 *seal* but is a standing Gate-2 item for
C1/C2 *execution*.)

**Execution-gate (Gate 2): BLOCKED pending (a) the carried holds — C1 reviews the generated drafts, so
it needs B2 + B3 merged** (transitively A2+A3+B1) **+ NS-5 — and (b) C1's own ratification surfaces:** a
**new AC-D (self-review protocol, ruling 4)**, the carried **NS-2** (new `Operation`(s) vs reuse
`anchor_self_review` + the op-count magnitude), an **AC-D21 body change** (the safety pass re-adjudicates
`safety_relevant`), and the carried **NS-7** (single-provider cross-model degradation — **PENDING
AUTHENTICATION**, §7.3). Written **against the recommended direction**; detail-planning is **not** gated.

**Implements:** the **non-negotiable safety floor** (ruling 4) — the multi-pass + cross-model self-review
the auto-publish gate (C2) runs on every generated draft: independent **grounding/factual**, **safety**,
and **provenance** review passes, on a **different provider from the generator** (Anthropic generates per
B2; OpenAI reviews), extending the established `_REVIEW_DEFAULT_OPS` / AC-D19 / AC-D23 cross-provider
pattern. It stops at the **protocol** (the passes + their verdicts): **no** confidence scoring or
auto-publish threshold (Slice 8 / C2 consumes the verdicts), **no** publish/`Pill` creation, **no**
dashboard.

### 7.1 Grounding (verified against the tree at this SHA, `2110a56`)

- **The cross-provider review pattern already exists.** `_REVIEW_DEFAULT_OPS = {grade_review,
  anchor_self_review}` (`provider.py:162-164`) routes review ops to `system_settings.review_provider`
  (OpenAI default, `provider.py:342-348`). **AC-D23 already runs a cross-provider self-review on every
  generated anchor question** (parent §2, `DECISIONS.md` AC-D23 — "a second AI call using a different
  provider per the AC-D19 pattern evaluates each anchor"). **C1's multi-pass extends this established
  pattern**, it does not invent cross-model review.
- **The prompt variant registry supports multi-pass.** `_VARIANT_REGISTRY` (`prompts/__init__.py:58`) +
  `get_prompt(operation, *, variant=...)` (`:67`) lets **one op carry several named prompt variants** —
  the mechanism for the three review passes (grounding / safety / provenance) as **variants of one
  `content_self_review` op** (NS-2 lean, §7.2a), keeping distinct pass contracts without three enum
  members.
- **Provider routing is op-keyed.** `resolve_provider` (`provider.py:340-348`): a review op → the
  configured `review_provider`; Anthropic-default op → `anthropic`; else `openai`. A new
  `content_self_review` op joins `_REVIEW_DEFAULT_OPS` → routes to OpenAI when the generator was Anthropic
  (the cross-model floor).
- **The safety floor today is the removed admin gate.** With the human approve gate gone (parent §4.3),
  the **safety review pass owns re-adjudicating the `safety_relevant` classification itself** — the
  autonomous replacement for AC-D21's pre-publish admin catch on a **false-negative mis-tag** (a safety
  topic mistagged non-safety would otherwise receive AI teaching content via §6.4, violating the "Acumen
  never generates safety teaching content" floor, `DECISIONS.md` AC-D21). This is an **AC-D21 body
  change** (§7.3), coordinating with the A2 AC-D21 change.
- **`auto_tag_safety` is the existing classifier the safety pass strengthens.** `catalogue.py:207`
  `auto_tag_safety(name, description, db)` (keyword + AI self-classification, AC-D21) — the safety pass
  **re-runs/strengthens** this on the generated draft, cross-model, and can flip the tag.

### 7.2 Build choices — concrete (recommended direction)

**(a) One new op `content_self_review` + three prompt-variant passes (NS-2 lean).** Add
`Operation.content_self_review` to the enum; it joins **`_REVIEW_DEFAULT_OPS`** (OpenAI-default,
cross-model). Three `_VARIANT_REGISTRY` entries — `(content_self_review, "grounding")`,
`(…, "safety")`, `(…, "provenance")` — each a prompt module with its own contract:
- **grounding/factual** — "are the draft's claims supported by the cited corpus chunks (the B2
  `grounding_refs` / `GenerationProvenance`)?" → verdict + unsupported-claim list;
- **safety** — "is the `safety_relevant` classification correct, and is any safety-teaching content
  present?" → **re-adjudicated `safety_relevant`** + verdict (the §7.3 AC-D21 change);
- **provenance** — "does every claim resolve to a corpus source (no orphan claims)?" → verdict +
  orphan-claim list.
**(b) The protocol domain fn.** `self_review_draft(db, *, draft, provenance) -> SelfReviewResult` runs
the three passes (each a `content_self_review` call with its variant), each **cross-model** (OpenAI when
the draft was Anthropic-generated). Returns the three verdicts + the re-adjudicated `safety_relevant`;
**C2 (Slice 8) consumes them** into the confidence score + the publish decision. The four op-keyed maps
(`resolve_model` / `_MAX_OUTPUT_TOKENS` / `OP_TO_METHOD` / `_REGISTRY`) gain a `content_self_review`
entry (OpenAI-side: `OP_TO_METHOD: "review"`); the ops-count sweep (§7.4).
**(c) Cross-model verification (ruling 4 floor).** The passes route to a **different provider from the
generator** (`provider.py` review routing). When a second provider **is** configured, the floor runs as
specified. When it is **not**, see NS-7 (§7.3) — **the degradation rule is pending-authentication, not
baked.**
**(d) Determinism / offline.** The stub `content_self_review` returns deterministic per-variant verdicts
(seeded by the draft) so the protocol is exercisable offline (AC-CD15); a cue-bearing unsafe draft trips
the safety pass deterministically.

### 7.3 Embedded ratification-class items — SURFACED (blocking C1 execution, Gate 2)

- **New AC-D — self-review protocol (ruling 4).** Class (i)/(ii). The multi-pass + cross-model floor;
  the spec-author-authored AC-D body; the `content_self_review` op + the three passes ride it. Cites the
  AC-D19/AC-D23 cross-provider precedent it extends. Blocks C1 execution.
- **NS-2 (carried) — new `Operation`(s) vs reuse `anchor_self_review`; + the op-count magnitude.**
  Class (i)/(ii) (AC-CD8). **Lean: ONE new `content_self_review` op + three `_VARIANT_REGISTRY`
  variants** (distinct input/output contract from anchor review — it reviews a *generated pill draft*
  against grounding/safety/provenance, not an *anchor question* against quality criteria; reusing
  `anchor_self_review` would conflate contracts + provenance/cost aggregation). **This is the SECOND
  ops-count expansion** (after B1's `pill_generation`): the cross-family op count **2 → 3**
  (`grade_review`, `anchor_self_review`, **`content_self_review`**), the named total **8 → 9**, the enum
  **9 → 10**. Run the §4.4 three-class sweep at execution HEAD; **coordinate the §6 ops-count amendment
  across B1 + C1** so SPEC §6/§6.5/§8.x is amended coherently (the count lands at its final value once
  both ops are ratified). Blocks C1 execution.
- **AC-D21 body change — the safety self-review pass owns re-adjudicating `safety_relevant`** (auditor
  A-13, parent §7.1). Class (i)/(ii). The autonomous replacement for the removed pre-publish admin catch
  on a false-negative mis-tag; AC-D21's *"admin override the tag at any time"* **relocates to the
  retroactive dashboard** (Stage E / E2). **Fold with the A2 AC-D21 change** (web search → corpus) so
  AC-D21 is amended **once**, completely (corpus use + safety re-adjudication + override relocation).
  Blocks C1 execution.
- **NS-7 (carried) — single-provider cross-model degradation — PENDING AUTHENTICATION (§8.3).** Ruling 4
  makes cross-model the *non-negotiable safety floor*, but a single-provider deployment cannot run it —
  a genuine cross-ruling edge with ruling 2 (*nothing held pre-publish, incl. safety-relevant*). **A
  spec-author *degrade-not-gate* ruling has been *reported* on the unmerged `vibrant-euler@92886fe`
  addendum** (single-provider → publish-with-warning + same-model multi-pass + a "single-provider
  verified" flag; no dual-provider gate), **overriding the planner's original prereq-gate lean** — but
  per role files §8.3 a ruling seen on an unmerged branch under the shared byline is a **relay: pending,
  not actionable** until authenticated to the acting session (overseer OV-6; auditor A-6). **So C1
  records NS-7 as recorded-but-pending-authentication and bakes neither option:**
  - the **reported (degrade)** posture — single-provider safety-relevant **publishes-with-warning**,
    always dashboard-flagged, same-model multi-pass + a verified flag; vs.
  - the **original planner lean (gate)** — a second provider is a deployment **prerequisite** for
    safety-relevant auto-publish; absent it, hold-with-warning.
  **C1 is authored so the degradation behaviour is a single policy point the C2 gate (Slice 8) reads**,
  switchable to whichever the spec author authenticates. **@spec-author: please confirm the NS-7 ruling
  through this PR's authenticated channel** (or land the `vibrant-euler` addendum through its proper
  ratification gate) so C1/C2 execution can act on it. **The auditor has flagged it will escalate the
  NS-7 authentication (PS-C1)** — this detail supports that escalation: NS-7 stays **surfaced + pending**,
  not baked. Class (ii) (it qualifies ruling 4 + binds the C2 gate AC-D).
- **Carried holds:** C1 needs **B2 + B3 merged** (transitively A2+A3+B1) **+ NS-5**.

### 7.4 Docs / mirror sweeps — the second ops-count expansion

The `content_self_review` op is the **second** "seven AI operations" expansion (after B1). Re-run the
§4.4 three-class structural greps at execution HEAD. **Coordinate B1 + C1**: the SPEC §6 prose count, the
"five of seven"/"two cross-family" enumerations (`SPEC.md:296/397/...`), `DECISIONS.md:63/96`, and the
four op-keyed code maps all land at their **final** values once **both** `pill_generation` (Anthropic
+1) and `content_self_review` (OpenAI/cross-family +1) are ratified — net **seven → nine** named ops,
enum **8 → 10**. The spec author may author the §6 ops-count amendment **once** covering both, or per-op;
either way each op-adding execution PR re-runs the sweep and folds completely (no silent partial-fold).
**Code (C1 execution):** the new op + the three variant prompt modules + the four op-keyed map entries
(`OP_TO_METHOD: "review"`) + `_REVIEW_DEFAULT_OPS` membership + the stub branch + `.env.example` model
field; the construction-oracle test floors (`set(OP_TO_METHOD)==set(Operation)` etc.) enforce
completeness.

### 7.5 Tests (AC-CD15 — zero-network)

1. **Three passes run cross-model.** `self_review_draft` (stub provider) runs grounding/safety/provenance
   variants; assert each resolves to the **review provider** (OpenAI-side) when the draft was
   Anthropic-generated (the cross-model floor).
2. **Safety pass re-adjudicates.** A draft mistagged `safety_relevant=False` on a cue-bearing topic →
   the safety pass flips it to `True` (the false-negative catch); a correctly-tagged draft is unchanged.
3. **Grounding/provenance verdicts.** A draft whose claims all cite corpus chunks → grounding+provenance
   pass; a draft with an orphan claim → provenance verdict lists it.
4. **Op wiring + sweep floors.** `content_self_review ∈ _REVIEW_DEFAULT_OPS`, routes via `review`; the
   `set(OP_TO_METHOD)==set(Operation)` + `registered_operations()` floors pass with the new member.
5. **NS-7 degradation is a single switch.** With no second provider configured, the protocol takes the
   **policy-configured** degradation path (a single point C2 reads) — the test asserts the switch exists
   and defaults conservatively **pending the NS-7 ruling** (it does not bake either posture as the
   behaviour). Zero-network (AC-CD15).

### 7.6 What C1 does NOT touch (scope fence)

No **confidence scoring / auto-publish threshold / publish-with-warning** (Slice 8 / C2 consumes the
verdicts); no **`Pill` creation / publish** (the C2 gate's step); no **dashboard / rollback** (E); no
**gap-detection** (D); no **endpoint/FE**. The `pill_proposal` refiner, `grade_review`, and
`anchor_self_review` ops are untouched (C1 adds a distinct review op).

### 7.7 Reviewer findings folded — Slice 7

Round-1 review (auditor `claude/jolly-ptolemy-oui39p` @ `1eae1f0` — **6 Confirms, 0 findings, sealed @
`51cf183`**, NS-7 escalation to the spec author; overseer `claude/sharp-cray-gueezy` @ `8bf321b` comment
`4664076779`) — **no blocking finding; 6 + 4 Confirms, 1 medium Refine folded; none dropped.** *The
auditor's early seal @ `51cf183` is re-staled by this OV-33 fold (§0.1) and re-verifies at the folded SHA
— OV-33 lands in §1 cross-cutting + this §7.7 record and changes no C1 substance (§7.1–§7.6).*

| ID | Reviewer | Tag | Resolution |
|---|---|---|---|
| **A-34…A-39** | auditor | Confirm ×6 | The cross-model self-review protocol (ruling-4 floor) correct; **NS-7 recorded pending-authentication, neither posture baked** (the auditor concurs + is escalating the NS-7 authentication to the spec author); NS-2 one-op-three-variants sound; the safety-pass `safety_relevant` re-adjudication + AC-D21 fold-with-A2 correct; the 2nd ops-count expansion (named 8→9 / enum 9→10) accurate; scope fence clean. No action. |
| **OV-29** | overseer | Confirm (dominant) | **NS-7 handled as a §8.3 relay — neither option baked**; the overseer likewise does not accept the relay; NS-7 stays blocking C1/C2 exec, pending authentication. No action. |
| **OV-30** | overseer | Confirm | Self-review AC-D (ruling 4) + NS-2 + AC-D21-safety-readjudication surfaced-not-baked; the safety floor is preserved, not silently no-op'd. No action. |
| **OV-31** | overseer | Confirm | Ops 2nd-half per GT-1 (named 8→9 / enum 9→10; net B1+C1 seven→nine), coordinated. No action. |
| **OV-32** | overseer | Confirm | Full gate { B2+B3 merged } + ratifications + NS-7-auth + NS-5; NORMAL; no re-stale. No action. |
| **OV-33** | overseer | Refine (medium) | **Folded** (§1 cross-cutting "Multi-slice anchor amend-once"): AC-D21 [A2+C1], AC-D22 [A2+B2], §6 ops-count [B1+C1] — A2 sealed with the narrower scope → partial-amend/double-amend risk; the spec author authors each shared anchor **complete up-front before the first touching slice executes**, each slice surfacing **its contribution** to the one complete amendment, not a standalone partial edit. |

**Round-trips:** OV-33 1/5 (A-34…A-39, OV-29…OV-32 = positive-coverage Confirms — no round-trip owed).
**Set-diff (this revision):** 11 added [A-34…A-39, OV-29…OV-33] / 0 dropped. No push-back; no design
change (OV-33 *adds* a coordination discipline); no halt-class. **NS-7 remains PENDING AUTHENTICATION**
(no ruling has arrived through either reviewer's authenticated channel; both reviewers + the planner hold
it un-baked, and the auditor is escalating it to the spec author). Awaiting both reviewers' (re-)seal at
the folded content-SHA, then the planner posts `Status: final for Slice 7`.

---

## Slice 8 (C2) — confidence scoring + auto-publish gate (single global threshold; publish-with-warning)

**Status: final for Slice 8 — approved by planner** (content-bound to the Slice-8 **§8** substance at
`18a2e74`/`1afb2cf` — auditor content SEAL (`c442485`, §8 @ `18a2e74`; A-40 resolved, A-45 deferred to the
global pass) + overseer governance SEAL (`7dc95dc`, @ `1afb2cf`; OV-40 resolved, OV-39/§7.3
merge-exec-tracked). **Content-invariant**: only this Status line changed; §8.1–§8.7 byte-identical, so it
does **not** re-stale the reviewers' seals (§0.1/§8). NS-7 RULED degrade-not-gate (triple-authenticated,
§1). **Stage C (auto-publish gate) complete.** One tracked pre-global-marker item: the C1 §7.3 NS-7-line
reconciliation (A-45/OV-39, §1 NS-7 bullet).)

**Execution-gate (Gate 2): BLOCKED pending (a) the carried holds — C2 consumes C1's self-review verdicts
+ the B3 draft rows, so it needs C1 + B2 + B3 merged** (transitively A2+A3+B1) **+ NS-5 — and (b) C2's
own ratification surfaces:** a **new AC-D (auto-publish gate: single global threshold + publish-with-
warning; rulings 1+2)**, an **AC-D7 body change** (remove the human approve/queue gate — generated pills
auto-publish; **multi-slice with F1**, §1 amend-once), the carried **NS-6** (threshold value + per-type
telemetry), the **§6.5 rewrite + audit-log governance prose**, and the carried **NS-7** (the safety-
relevant single-provider degradation switch — **still PENDING AUTHENTICATION**, §8.3). Written **against
the recommended direction**; detail-planning is **not** gated.

**Implements:** the **(C) auto-publish gate** — for each B3-produced `pending` draft it runs C1's
multi-pass self-review, computes a **confidence score**, and **publishes** with **no human step**:
**≥ a single global threshold → publish live**; **< threshold → publish-with-warning** (live + a
dashboard flag); **nothing held pre-publish, including safety-relevant** (subject to the NS-7 rule). It
**replaces the `approve_pill_proposal` human gate** for generated drafts. It stops at the gate: the
**bootstrap-on-publish** is Slice 14 / F1 (rides the publish event); the **oversight dashboard +
rollback** are Slices 12–13 / E1–E2 (consume the publish + the publish-with-warning flag).

### 8.1 Grounding (verified against the tree at this SHA, `2110a56`)

- **`approve_pill_proposal` is the human gate being replaced.** `catalogue.py:567-613` reads
  `task.payload["proposal"]` → `create_pill(discoverable=True, ai_safety_classification=...)` → marks the
  task `done` + audits `pill_proposal.approve`. **C2's auto-publish gate is the autonomous replacement**
  for the `pill_generation` draft rows; `approve_pill_proposal` **stays only for the `pill_proposal`
  refiner** (G7a optional-manual path) — C2 does not delete it, it **bypasses** it for generated drafts.
- **`create_pill` is the publish primitive.** `catalogue.py:153` creates a `Pill` (discoverable). The
  gate's publish step calls it (honouring C1's **re-adjudicated** `safety_relevant`, not the raw draft
  tag).
- **The draft rows are B3's `processing_tasks`.** `task_name="pill_generation"`, `status=pending`
  (Slice 6). The gate iterates pending draft rows → publish or publish-with-warning → `status=done`.
- **C1 supplies the verdicts.** `self_review_draft` (Slice 7) returns grounding/safety/provenance verdicts
  + the re-adjudicated `safety_relevant`; the **confidence score is computed from these + the provenance
  authority tiers** (B2) + corroboration (if DS2-b ruled ≥(ii)).
- **`SystemSettings` is the threshold home.** `models.py` `SystemSettings` already carries tunable
  per-tenant config (e.g. `anchor_calibration_confidence_threshold`, `models.py:~888`); a **single
  global `pill_publish_confidence_threshold`** field follows that pattern (ruling 1).
- **The audit-log governance prose is `SPEC.md:290`** (*"pill proposals approved or rejected"*) → for the
  autonomous flow, **published / publish-with-warning / rolled-back** events. And **SPEC §6.5** (the
  "pill proposal" section, `SPEC.md:340-348`) is rewritten autonomous (coordinate with D3, the §6.5
  rewrite owner).
- **No confidence/flag store exists** (verified) — the confidence score + the low-confidence flag are
  greenfield (a field on `Pill` / the draft, or a small table; §8.2).

### 8.2 Build choices — concrete (recommended direction)

**(a) Confidence scoring — `app/domain/...` `compute_confidence(self_review, provenance) -> float`.** A
0..1 score combining C1's three verdicts (a hard fail on grounding or provenance floors it; safety is
handled by the NS-7 path) + the **authority-weighted provenance** (mean/min tier-score of the grounding
chunks, DS1-a) + corroboration count (if DS2-b ≥(ii)). The exact formula default is **NS-6** (§8.3).
**(b) Auto-publish gate — `auto_publish_draft(db, task)`.** For each `pending` `pill_generation` draft:
run `self_review_draft` (C1) → `compute_confidence` → **≥ threshold → publish** (`create_pill`,
honouring the re-adjudicated `safety_relevant`; `status=done`; audit `pill_generation.publish`); **<
threshold → publish-with-warning** (`create_pill` + a **`low_confidence` flag** + audit
`pill_generation.publish_flagged`); **nothing held** (ruling 2). Stamp the `confidence`, the per-pass
verdicts, and the `batch_id` (B3) on the published pill / a `PublishRecord` so E1/E2 can surface +
roll back. Replaces `approve_pill_proposal` for generated drafts.
**(c) Single global threshold (ruling 1).** A `SystemSettings.pill_publish_confidence_threshold` field
(single global, **not** per-type — counter to a per-type gate; ruling 1). NS-6 sets the default.
**(d) Publish-with-warning (ruling 2).** A `low_confidence` boolean (+ the confidence float) on the
published pill (or a `PublishRecord` row) → E1 dashboard flag; the content is **live** regardless.
**(e) Per-type confidence telemetry (NS-6).** Record confidence + the pass outcomes **per type**
(safety-relevant vs not; optionally per subject) on the `PublishRecord`, so ruling 1's "re-evaluate to
per-type iff data warrants" has the data from day one.
**(f) NS-7 degradation switch (pending-auth).** For a **safety-relevant** draft when the cross-model
floor cannot run (single provider): C2 reads the **C1 NS-7 policy switch** — *degrade* (publish-with-
warning, always flagged) **or** *gate* (hold-with-warning) — **whichever the spec author authenticates**.
C2 bakes neither; it wires the switch the C1 protocol exposes.

### 8.3 Embedded ratification-class items — SURFACED (blocking C2 execution, Gate 2)

- **New AC-D — auto-publish gate** (single global threshold + publish-with-warning; rulings 1+2; removes
  the human approve gate for generated drafts). Class (i)/(ii). Blocks C2 execution.
- **AC-D7 body change — remove the "queue for admin review / approve" governance language; generated
  pills auto-publish.** Class (i)/(ii). **Multi-slice with F1** (F1 changes AC-D7's bootstrap trigger
  approve→publish) — per the §1 **amend-once** discipline, AC-D7 is authored **complete (C2 approve-gate
  removal + F1 bootstrap-on-publish) before the first of C2/F1 executes**. Blocks C2 execution.
- **NS-6 (carried) — confidence-threshold value + per-type telemetry.** Class (ii). Ruling 1 fixed the
  shape (single global); the **numeric default** + the confidence **formula** + how per-type failure data
  is captured (for the later per-type re-evaluation) are unruled. **Lean: a conservative default + the
  `compute_confidence` formula above + per-type telemetry from day one.** Couples to **DS1-a** (tier
  scores feed the score). Surfaced, not baked.
- **§6.5 rewrite + audit-log governance prose.** Class (ii). `SPEC.md:340-348` §6.5 → autonomous
  generation + auto-publish (coordinate with D3, the §6.5-rewrite owner — amend §6.5 once); `SPEC.md:290`
  audit-log prose *"pill proposals approved or rejected"* → published / publish-with-warning / rolled-back.
- **NS-7 — RULED: degrade-not-gate (authenticated via the planner channel, this conversation,
  2026-06-09; §1 NS-7 status-of-record).** C2 is the slice that *acts* on the NS-7 switch — and the
  ruling sets it to **degrade**: single-provider **safety-relevant** content **publishes-with-warning**
  (always dashboard-flagged) on same-model multi-pass review, **not** held behind a second-provider gate
  (honours ruling 2). The `auto_publish_draft` degradation path (§8.2f) is now the **ruled** behavior,
  not a pending switch. **C2's NS-7 *execution* Gate-2 item is un-blocked** (the downstream C2 execution
  PR still re-confirms NS-7 through its own authenticated channel — OV-2 relay discipline). The authoritative
  authentication trail is in the §1 NS-7 bullet.
- **Carried holds:** C2 needs **C1 + B2 + B3 merged** (transitively A2+A3+B1) **+ NS-5**.

> **Detail-plan calls (not surfaced) — recorded for the reviewers:**
> - **DS8-a — `low_confidence`/confidence on `Pill` vs a `PublishRecord` table.** Lean **a `PublishRecord`
>   row per publish** (pill_id, batch_id, confidence, per-pass verdicts, low_confidence, per-type
>   telemetry) — it is the natural read-surface for E1 (recent publishes + provenance + confidence) and
>   the per-batch rollback join for E2, and keeps `Pill` uncluttered. A few flag columns on `Pill` would
>   work but scatter the oversight data; the `PublishRecord` is the E1/E2-facing contract. Rides the
>   auto-publish-gate AC-D / the E1 dashboard AC-CD.

### 8.4 Docs / mirror sweeps

**Spec surfaces — in the spec-author's amendment PR(s):** the new auto-publish-gate AC-D body; the
**AC-D7** body change (complete C2+F1 scope, §1 amend-once); **SPEC §6.5** rewrite (with D3); `SPEC.md:290`
audit-log prose; the §6 error-handling prose for the new publish path (`SPEC.md:378-388`). **Code (C2
execution):** `compute_confidence` + `auto_publish_draft`; the `SystemSettings.pill_publish_confidence_
threshold` field + migration + the v1.x default seed; the `PublishRecord` model + migration (DS8-a);
audit actions `pill_generation.publish` / `.publish_flagged`; reuse `create_pill`. No ops/cron count
touched (C2 mints no op/cron).

### 8.5 Tests (AC-CD15 — zero-network)

1. **Above-threshold → publish live.** A high-confidence draft (stub C1 verdicts all-pass, high authority)
   → `create_pill` (discoverable), `PublishRecord` with `low_confidence=False`, audit `…publish`, task
   `done`.
2. **Below-threshold → publish-with-warning.** A low-confidence draft → `create_pill` **+**
   `low_confidence=True` + audit `…publish_flagged`; the pill is **live** (nothing held).
3. **Re-adjudicated safety honoured.** The published pill's `safety_relevant` is C1's re-adjudicated
   value, not the raw draft tag.
4. **Single global threshold.** Reads `SystemSettings.pill_publish_confidence_threshold`; a tenant
   override moves the boundary; **no per-type threshold** (ruling 1).
5. **Per-type telemetry.** The `PublishRecord` carries the per-type (safety vs not) confidence/outcome
   data (NS-6).
6. **NS-7 switch.** Safety-relevant + single-provider → the gate takes the **policy-configured** NS-7
   path (the C1 switch); the test asserts the switch is read and defaults conservatively **pending the
   ruling** (bakes neither). Zero-network (AC-CD15).

### 8.6 What C2 does NOT touch (scope fence)

No **self-review protocol** (C1 owns it; C2 *consumes* the verdicts); no **bootstrap-on-publish** (Slice
14 / F1 rides the publish event); no **dashboard / rollback** (Slices 12–13 / E1–E2 consume the
`PublishRecord` + flag); no **gap-detection** (D); no **FE**. `approve_pill_proposal` is **kept** (the
refiner path, G7a) — C2 bypasses it for generated drafts, does not delete it.

### 8.7 Reviewer findings folded — Slice 8

Round-1 (overseer + the NS-7 ruling). Overseer `claude/sharp-cray-gueezy` @ `e15ad35` comment
`4664311157` — OV-34…OV-37 Confirm, OV-38 Refine folded. **Plus the NS-7 ruling**, authenticated this
round via the planner channel.

| ID | Reviewer | Tag | Resolution |
|---|---|---|---|
| **OV-34** | overseer | Confirm | NS-7 continuity — C2 acts on the switch, neither posture baked, conservative default, @spec-author ask. *(Now resolved by the NS-7 ruling below.)* |
| **OV-35** | overseer | Confirm | Rulings 1+2 encoded-not-re-surfaced + gate AC-D + NS-6 surfaced-not-baked (NS-6 couples DS1-a). No action. |
| **OV-36** | overseer | Confirm | Approve-gate bypassed-for-generated / kept-for-refiner + nothing-held-pre-publish-incl-safety (no ruling-2 regression). No action. |
| **OV-37** | overseer | Confirm | Full gate { C1+B2+B3 merged } + ratifications + NS-7-auth + NS-5; `PublishRecord` forward-coherent for E1/E2; **AC-D7 multi-slice C2+F1 proactively in §1 amend-once** (OV-33 paying off). No action. |
| **OV-38** | overseer | Refine (low) | **Folded** (§1 amend-once): the discipline now extends to shared **SPEC sections** — §6.5 [C2+D3] + §290 audit-log [C2+E2] — authored complete across touching slices, not only anchors. |
| **NS-7** | spec-author ruling | RULED | **Degrade-not-gate, authenticated via the planner channel** (this conversation, 2026-06-09). The auditor relayed an in-session authentication; the overseer's lane had it pending; the planner confirmed through its own channel (§8.3). Recorded at the §1 NS-7 status-of-record + §8.3; the C2 degradation switch is set to **degrade**; C1/C2 NS-7 execution Gate-2 item **un-blocked** (execution PRs re-confirm via their own channel). C1 §7.3 substance unchanged (its seal not re-staled); C2 §8.3 reflects it directly. |

**Round-trips:** OV-38 1/5 (OV-34…OV-37 Confirms — no round-trip owed). **Set-diff (this revision):** 5
added [OV-34…OV-38] / 0 dropped (the NS-7 ruling is a spec-author ratification recorded this round, not a
reviewer-finding ID). No push-back; no halt-class. **The plan-auditor's Slice-8 *content* review is
pending** — it recorded the NS-7 authentication + pre-registered PS-C2 and is **awaiting this planner
NS-7 fold** before reviewing the §8 substance; its findings (if any) fold next. Awaiting the auditor's
Slice-8 content review + both reviewers' Slice-8 seals, then the planner posts `Status: final for Slice 8`.

---

## Slice 9 (D1–D2) — the three §6.5 signal stores + dedup

**Status: final for Slice 9 — approved by planner** (content-bound to the Slice-9 §9 substance at
`bb2dd89`/`0a85ee8` — auditor content SEAL (`04e7a23`, §9 @ `bb2dd89`; 5 Confirms / 0 findings) + overseer
governance SEAL (`ecf28f1`, @ `0a85ee8`; OV-45 resolved). **Content-invariant**: only this Status line
changed; §9.1–§9.7 byte-identical, so it does **not** re-stale the reviewers' seals (§0.1/§8). Clean seal,
no §9 fold — OV-45 was a §1 amend-once-list completeness fix.)

**Execution-gate (Gate 2): BLOCKED pending (a) NS-5 — and (b) Slice 9's own surfaces:** the carried
**G5** (signal-capture data model — the Stage-D spine) and the carried **signal-3** (the assignment
scope-clarification admin feature), plus the **SPEC §6.5 Inputs** amendment (the three signals are §6.5
Inputs; §6.5 amend-once with C2/D3). *(D1–D2 is **signal capture** from existing flows — it does **not**
require Stage A/B/C merged; it is the most independent Stage-D slice.)* Written **against the recommended
direction**; detail-planning is **not** gated.

**Implements:** the **signal spine** the gap-detection sweep (D3) consumes — persisting the three §6.5
signals (**discovery-miss**, **question-tag**, **scope-clarification**) into a deduped store. It stops
there: **no** gap-detection sweep / clustering / generation trigger (Slice 10 / D3), **no** crons
(Slice 11 / D4), **no** generation (Stage B), **no** dashboard.

### 9.1 Grounding (verified against the tree at this SHA, `2110a56`)

- **The three signals are the SPEC §6.5 Inputs.** `SPEC.md:344` — *"recent generated questions and their
  pill tags, recent Testee discovery searches that returned no good match, recent assignments where admin
  manually clarified scope."* None is captured today (auditor GT-7: no signal/gap table in `models.py`).
- **The discovery-miss source is `list_discoverable_pills`.** `catalogue.py:261-284`
  `list_discoverable_pills(db, *, search=None, …)` is the Testee discovery filter (AC-D8). A
  **discovery-miss** = a `search` that returns **no good match** (empty / below a coverage bar) — captured
  here. The discovery flow exists; only the signal write is new.
- **The question-tag source is the generated `Question` + its pill tags.** Generated questions carry
  pill-tag metadata (the P5 generation + the new B `pill_generation`); a **question-tag** signal captures
  under-covered / frequently-tagged topics from recent questions. The generation flow exists.
- **The scope-clarification source does NOT exist.** `Assignment` (`models.py:339`) has **no**
  "admin clarified scope" field/action — capturing a **scope-clarification** signal needs an **admin
  feature that is unbuilt** (signal-3, §9.3). Greenfield.
- **No signal/gap model exists** (GT-7, re-verified) — the store is greenfield; D1–D2 adds the first
  signal table + migration.
- **Dedup precedent.** The B3 persistence-layer dedup (`(topic, gap_signal)`, Slice 6 §6.2d) is the
  *downstream* half; D1–D2 owns the **signal-layer** dedup (the gap-detection sweep, D3, owns the third
  arm) — the **3-arm dedup** the workstream named.

### 9.2 Build choices — concrete (recommended direction)

**(a) One polymorphic `GapSignal` table + migration (G5 lean).** A single table (not three): `id`,
`tenant_id`, `signal_type` (enum: `discovery_miss` / `question_tag` / `scope_clarification`),
`dedup_key` (a normalized key for the signal-layer dedup — e.g. the normalized search term / tag /
scope phrase), `detail` (JSONB — the type-specific payload: search text + result-count for discovery_miss;
the question/pill-tag refs for question_tag; the assignment + scope text for scope_clarification),
`source_ref` (the originating entity, nullable), `occurrence_count`, `occurred_at`, `created_at`. Indexed
on `(signal_type, dedup_key)` (the dedup + the D3 clustering key). **Rationale for one table:** the
gap-detection sweep (D3) clusters *across* signal types into topics, and a single table makes that
cluster query + the dedup uniform; three tables would fragment both. **G5 surfaces the model** (one
polymorphic table vs. three typed tables); lean one.
**(b) discovery-miss capture — `catalogue.py` `list_discoverable_pills`.** When a non-empty `search`
returns **no good match** (zero results, or below a small coverage bar), write a `GapSignal(discovery_miss,
dedup_key=normalize(search), detail={search, result_count, testee_ref})`. Idempotent via the signal-layer
dedup (§9.2d).
**(c) question-tag capture.** From recent generated questions, aggregate the pill-tag distribution and
emit `question_tag` signals for under-covered / over-requested tags. Lean: a small capture helper invoked
post-generation (existing P5 + the new B path), `dedup_key=tag`.
**(d) Signal-layer dedup.** Collapse repeat signals by `(signal_type, dedup_key)` within a window —
**upsert + increment `occurrence_count`** (so D3 can weight a topic by how many distinct misses it
accumulated). This is the **first arm** of the 3-arm dedup (B3 persistence = second; D3 gap-detection =
third).
**(e) scope-clarification — signal type defined, capture deferred (signal-3, §9.3).** The
`scope_clarification` enum value + the `GapSignal` shape are defined now; the **capture wiring waits on
the admin scope-clarification feature** (signal-3, surfaced) — so the model is complete and forward-ready
without building an unscoped admin feature speculatively.

### 9.3 Embedded ratification-class items — SURFACED (blocking D1–D2 execution, Gate 2)

- **G5 (carried) — signal-capture data model.** Class (ii) (a new SPEC §5 entity + model). **Lean: one
  polymorphic `GapSignal` table** (§9.2a) — the Stage-D spine. Surfaced (the model is a new SPEC §5
  entity the spec author ratifies); lean one-table. Blocks D1–D2 execution.
- **signal-3 (carried) — the assignment scope-clarification admin feature.** Class (iii) (a feature-scope
  decision, parallel-to-G8). The `scope_clarification` signal needs an **admin "clarify assignment scope"
  action** that does not exist. **Is building that admin feature in this workstream's scope?** **Lean:**
  define the signal *type* now (forward-ready) but **defer the admin feature** — D1–D2 captures the two
  signals whose source flows exist (discovery-miss, question-tag); the scope-clarification signal lands
  when/if the admin feature is built (a separate FE/admin scope call, like G8's generate-button).
  **Surfaced; held** — the spec author rules whether the admin scope-clarification feature is in scope.
- **SPEC §6.5 Inputs amendment.** Class (ii). The three signals are the §6.5 *Inputs* — the §6.5 rewrite
  (autonomous) carries them; **amend §6.5 once** (coordinate with C2 §8.3 + D3, per the §1 amend-once
  discipline for shared spec sections).
- **Carried holds:** D1–D2 needs **NS-5** (phase-home). It does **not** require Stage A/B/C merged (it
  captures signals from existing flows) — the most independent Stage-D slice; D3 (the sweep that drives
  generation) is where the B dependency lands.

> **Detail-plan call (not surfaced) — recorded for the reviewers:**
> - **DS9-a — one polymorphic `GapSignal` table vs. three typed tables.** Lean **one** (§9.2a — uniform
>   cluster + dedup for D3). Rides the G5 model ratification; if a reviewer judges three typed tables the
>   better SPEC §5 shape, it is the G5 decision, not a separate item.

### 9.4 Docs / mirror sweeps

**Spec surfaces — in the spec-author's amendment PR(s):** the **SPEC §5** `GapSignal` entity (the G5
model); the **SPEC §6.5 Inputs** amendment (amend-once with C2/D3); the signal-3 scope decision (if the
admin feature is ruled in scope, the §6.5/admin-FE prose gains it). **Code (D1–D2 execution):** the
`GapSignal` model + migration (up/down); the discovery-miss + question-tag capture helpers; the dedup
upsert; zero-network tests. No ops/cron count touched (the gap-detection/health crons are D4).

### 9.5 Tests (AC-CD15 — `app/domain/*` near-full coverage, zero-network)

1. **discovery-miss capture.** A `list_discoverable_pills(search=…)` that returns no good match writes a
   `GapSignal(discovery_miss)` with the normalized `dedup_key` + detail; a search that **does** match
   writes none.
2. **question-tag capture.** Recent generated questions → `question_tag` signals for the under-covered
   tags; assert the dedup_key = tag.
3. **Signal-layer dedup.** Repeat signals on the same `(signal_type, dedup_key)` upsert + increment
   `occurrence_count` (not duplicate rows).
4. **scope-clarification type defined, capture deferred.** The enum value exists + a `GapSignal(
   scope_clarification)` round-trips through the model; **no** capture wiring is asserted (signal-3
   deferred).
5. **Migration up/down clean** + structure-gate passes with the new table.
6. **Zero-network** (no AI/provider call — signal capture is deterministic; AC-CD15).

### 9.6 What D1–D2 does NOT touch (scope fence)

No **gap-detection sweep / clustering / topic-generation trigger** (Slice 10 / D3 consumes `GapSignal`);
no **crons** (Slice 11 / D4); no **generation** (Stage B); no **auto-publish** (C); no **dashboard** (E);
no **admin scope-clarification FE** (signal-3 deferred — only the signal *type* is defined). Existing
discovery + generation flows are extended with a signal write, not restructured.

### 9.7 Reviewer findings folded — Slice 9

*(none yet — Slice 9 posted for review; accumulates the auditor's + overseer's Slice-9 findings, the
per-round set-diff, and round-trip counts as the loop runs.)*

---

## Slice 10 (D3) — gap-detection sweep + catalogue-health checks → generation trigger

**Status: final for Slice 10 — approved by planner** (content-bound to the Slice-10 §10 substance at
`ac84af3`/`e8e1a73` — auditor content SEAL (`2951917`, §10 @ `ac84af3`; 5 Confirms / 0 findings, A-18
coherence resolved) + overseer governance SEAL (`bce823e`, @ `e8e1a73`; OV-50 resolved). **Content-
invariant**: only this Status line changed; §10.1–§10.7 byte-identical, so it does **not** re-stale the
reviewers' seals (§0.1/§8). Clean §10 seal — OV-50 was a §1 amend-once-list completeness fix.)

**Execution-gate (Gate 2): BLOCKED pending (a) the carried holds — D3 reads `GapSignal` (D1–D2) AND
*drives generation* (B3/B2), so it needs D1–D2 + B2 + B3 merged** (transitively A2+A3+B1) **+ NS-5 —
this is where the D-follows-B dependency lands (parent §5) — and (b) D3's own surfaces:** the **§6.5
rewrite** (the G2-analog: §6.5 from human-gated "pill proposal" to autonomous gap-detection + generation
+ auto-publish — **amend §6.5 once** with C2/D1–D2, §1 amend-once) and the carried **NS-4**
(catalogue-health-check definition). Written **against the recommended direction**; detail-planning is
**not** gated.

**Implements:** the **autonomous trigger** that closes the loop — a **gap-detection sweep** clustering
`GapSignal`s (D1–D2) into candidate topics + a **scheduled catalogue-health check** (proactive, not only
Testee-signal-driven), both invoking the generation fan-out (`enqueue_generated_drafts`, B3) **directly
(domain-fn call, no HTTP gate)**. It stops at the trigger logic: the **crons that schedule it** are
Slice 11 / D4; **generation/gate** are Stages B/C; **no** dashboard.

### 10.1 Grounding (verified against the tree at this SHA, `2110a56`)

- **The signal store is D1–D2's `GapSignal`.** Polymorphic (`signal_type` / `dedup_key` /
  `occurrence_count`, Slice 9 §9.2a) — D3 reads + clusters it.
- **The generation fan-out is B3's `enqueue_generated_drafts`.** `(db, *, topic, target_count, batch_id,
  gap_signal)` (Slice 6 §6.2a) → N draft rows → C auto-publish gate. **D3 calls it directly** (the
  domain-fn trigger; no admin action) — *the D-follows-B dependency.* D3 supplies the `gap_signal`
  (the cluster's signals) + a fresh `batch_id`.
- **The catalogue is `Subject` + `Pill`.** `models.py:280 Subject`, `:291 Pill`. The **catalogue-health
  check** reads these for coverage gaps (thin-band pills, uncovered subjects — NS-4).
- **The 3-arm dedup, third arm.** D1–D2 = signal-layer; B3 = persistence-layer
  (`(topic, gap_signal)` pending-skip); **D3 = gap-detection-layer** — don't open a generation batch for
  a topic already covered (a live `Pill`) or already pending (a B3 draft batch). D3 owns the third arm.
- **§6.5 today is human-gated "pill proposal".** `SPEC.md:340-348` — the analysis-only + refiner shape;
  the **G2-analog rewrite** makes §6.5 autonomous (signal capture / gap-detection / generation /
  auto-publish phases). Coordinate the §6.5 rewrite across C2 + D1–D2 + D3 (§1 amend-once).

### 10.2 Build choices — concrete (recommended direction)

**(a) Gap-detection sweep — `app/domain/...` `gap_detection_sweep(db)`.** Read recent `GapSignal`s →
**cluster** into candidate topics: group by normalized `dedup_key` + signal-type affinity, summing
`occurrence_count` into a **topic weight**; a cluster above a weight threshold → a candidate topic. For
each candidate, apply the **third dedup arm** (skip if a live `Pill` already covers it, or a pending B3
batch exists for `(topic, gap_signal)`) → otherwise `enqueue_generated_drafts(topic, …, batch_id=new,
gap_signal=cluster.signals)` (B3). Mark the consumed `GapSignal`s (e.g. a `consumed_at` / status) so the
next sweep doesn't re-cluster them. Idempotent by design.
**(b) Catalogue-health check — `catalogue_health_check(db)` (NS-4).** A **proactive** coverage sweep
independent of Testee signals: assess the catalogue for **thin-coverage bands** (pills/subjects with
sparse difficulty-band coverage) and **uncovered subjects** (subjects with few/no discoverable pills) →
emit candidate topics → the **same** `enqueue_generated_drafts` path (+ the same third-arm dedup). **NS-4
defines exactly what it assesses** (§10.3).
**(c) Coherence with A3 / DS3-a (auditor A-18 watch).** Both the A3 **weekly corpus-refresh backstop**
(DS3-a: refresh-target = active catalogue subjects/pills) and the D3 **catalogue-health check** (NS-4)
read the **catalogue** — but they are **distinct in output and must stay so:** A3 refreshes the
**corpus** (the knowledge base) for catalogue topics (re-validate/re-embed sources); **D3 generates
pills** for catalogue **coverage gaps**. Same input surface (the catalogue), **different actions**
(corpus refresh vs. pill generation). §10.3 keeps them explicitly non-overlapping so the two
catalogue-derived sweeps don't double-fire or conflate.
**(d) Both drive B directly.** No HTTP gate; both are domain fns the D4 crons (Slice 11) schedule.

### 10.3 Embedded ratification-class items — SURFACED (blocking D3 execution, Gate 2)

- **§6.5 rewrite (the #106 G2-analog).** Class (ii). §6.5 from human-gated "pill proposal" to
  **autonomous**: separate **signal-analysis (D1–D2) / gap-detection (D3) / generation (B) / auto-publish
  (C)** phases (the approval phase reframed as the auto-publish gate). **Amend §6.5 once** across C2 +
  D1–D2 + D3 (§1 amend-once — overseer OV-45). Blocks D3 execution.
- **NS-4 (carried) — catalogue-health-check definition.** Class (ii). What does the scheduled health
  check assess to trigger generation? **Lean: thin-coverage bands + uncovered subjects** (§10.2b) — a
  conservative, catalogue-derived definition; stale-pill detection is a possible third axis (flagged,
  not leaned-in). **Surfaced** because it defines an **autonomous generation trigger** (a §6.5-scope
  question), and because it must stay **coherent with A3/DS3-a** (§10.2c) — the spec author rules the
  exact assessment set + confirms the A3-corpus-refresh / D3-pill-generation boundary. Blocks D3
  execution.
- **Carried holds:** D3 needs **D1–D2 + B2 + B3 merged** (it reads signals + drives generation) **+
  NS-5** — the slice where the **D-follows-B** serialization (parent §5) binds.

> **Detail-plan call (not surfaced) — recorded for the reviewers:**
> - **DS10-a — cluster/threshold mechanics.** The clustering (group-by-`dedup_key` + weight threshold)
>   and the weight formula are build-design choices; lean the §10.2a shape (sum `occurrence_count`,
>   threshold a tunable `SystemSettings` field). Rides the §6.5 rewrite; surfaced only if a reviewer
>   reads the threshold as an autonomy-control gate worth spec-author ratification.

### 10.4 Docs / mirror sweeps

**Spec surfaces — in the spec-author's amendment PR(s):** the **SPEC §6.5 rewrite** (autonomous phases;
amend-once with C2 + D1–D2 — the 3-slice §6.5 set, OV-45); the **NS-4** catalogue-health definition (in
§6.5 / §8.9); coordinate with the §290 audit-log prose (gap-detection-triggered generation events).
**Code (D3 execution):** `gap_detection_sweep` + `catalogue_health_check` domain fns; the third-arm
dedup; the `GapSignal.consumed_at` (or status) column + migration if needed; a `SystemSettings`
gap-threshold field; zero-network tests. **No cron registration in D3** (D4 schedules these).

### 10.5 Tests (AC-CD15 — zero-network)

1. **Gap-detection cluster → generate.** Seeded `GapSignal`s clustering to a topic above threshold →
   `gap_detection_sweep` calls `enqueue_generated_drafts(topic, …)` (assert via a stubbed B3); below
   threshold → no call.
2. **Third-arm dedup.** A topic already covered by a live `Pill` (or a pending B3 batch) → **no** new
   generation; consumed `GapSignal`s are marked so the next sweep skips them.
3. **Catalogue-health check.** A thin-band / uncovered subject → `catalogue_health_check` emits the topic
   → `enqueue_generated_drafts`; a well-covered catalogue → no trigger.
4. **A3/D3 coherence.** The catalogue-health check triggers **generation** (not corpus refresh); assert
   it does not invoke the A3 corpus-refresh path (the two catalogue-derived sweeps stay distinct).
5. **Zero-network** (B3/generation stubbed; AC-CD15).

### 10.6 What D3 does NOT touch (scope fence)

No **crons / beat schedule** (Slice 11 / D4 schedules `gap_detection_sweep` + `catalogue_health_check`);
no **generation internals** (Stage B — D3 calls `enqueue_generated_drafts`); no **auto-publish** (C); no
**signal capture** (D1–D2 — D3 *consumes* `GapSignal`); no **corpus refresh** (A3 — distinct sweep,
§10.2c); no **dashboard** (E); no **FE**.

### 10.7 Reviewer findings folded — Slice 10

*(none yet — Slice 10 posted for review; accumulates the auditor's + overseer's Slice-10 findings, the
per-round set-diff, and round-trip counts as the loop runs.)*

---

## Slice 11 (D4) — gap-detection + catalogue-health crons (the second cron-count expansion)

**Status: posted for Slice 11 review** (not yet sealed — awaiting auditor + overseer Slice-11 review.
Appending this section does **not** re-stale Slices 1–10's seals — §0.1.)

**Execution-gate (Gate 2): BLOCKED pending (a) the carried holds — D4 schedules D3's sweep fns, so it
needs D3 merged** (transitively D1–D2 + B2 + B3) **+ NS-5 — and (b) D4's own surface:** the **SPEC §8.9
"seven crons" count amendment + AC-CD7 body change** — the **second** cron-count expansion, **co-owned
with A3** (the auditor's PS-D4) and **NS-1-coupled** (the A3 corpus-refresh cron's net delta). Written
**against the recommended direction**; detail-planning is **not** gated.

**Implements:** the **schedulers** that fire D3's autonomous trigger — two new `beat_schedule.py` crons:
**`gap_detection.sweep`** (runs `gap_detection_sweep`) and **`catalogue_health.check`** (runs
`catalogue_health_check`). It stops there: the **sweep logic** is D3; **generation/gate** are B/C; **no**
dashboard.

### 11.1 Grounding (verified against the tree at this SHA, `2110a56`)

- **The beat schedule is the flat `dict` (AC-CD7).** `beat_schedule.py:38-79` — D4 adds **two** entries
  (`gap_detection.sweep`, `catalogue_health.check`) + their task registrations, mirroring the A3
  `corpus.refresh` precedent (Slice 3 §3.2c).
- **The sweep fns are D3's.** `gap_detection_sweep` + `catalogue_health_check` (Slice 10 §10.2) — D4
  **schedules** them; it adds no sweep logic.
- **The cron-count invariant + its mirror surfaces** (Slice 3 §3.1/§3.4, re-verified): `beat_schedule.py`
  docstring + ASCII table, `CODE_SPEC.md:110/337/632` (AC-CD7), `ROADMAP.md:193/196`, SPEC §8.9,
  CHECKLIST P11. **The "seven crons" sweep is co-owned by A3 + D4** (the §1 count-invariant bullet).
- **The NS-1 coupling (from A3).** The A3 `corpus.refresh` cron is the functional successor of
  `drive_rag.ingest` — **net +1 or net 0 depending on NS-1** (Slice 3 §3.3). D4 adds **+2**
  unconditionally (`gap_detection.sweep` + `catalogue_health.check`). So the **final** cron count is
  **7 + (NS-1 delta: 0 or +1) + 2 = nine or ten** — knowable only once NS-1 rules (§11.3).

### 11.2 Build choices — concrete (recommended direction)

**(a) `gap_detection.sweep` cron.** A new `beat_schedule.py` entry → `gap_detection_sweep` (D3). Cadence:
an operational default (lean **daily**, sequential with the existing daily set's UTC offsets — e.g.
09:00, past A3's Monday 08:00). Not a ratified cadence (unlike A3's ruling-6 weekly); a tunable default.
**(b) `catalogue_health.check` cron.** A new entry → `catalogue_health_check` (D3). Cadence: an
operational default (lean **daily** or **weekly** — the health check is a proactive backstop; lean
weekly to avoid over-generating, *"rein in if it breaks"*). Tunable.
**(c) Cron-count sweep at its final value — co-owned A3 + D4, NS-1-coupled.** D4's amendment + A3's
amendment together land the §8.9/AC-CD7 count at its **final** value (nine or ten, §11.1) — authored
**once, complete across A3 + D4** (the §1 amend-once discipline; the cron-count is a multi-slice
invariant). Run the three-class cron grep (Slice 3 §3.4) at execution HEAD.

### 11.3 Embedded ratification-class items — SURFACED (blocking D4 execution, Gate 2)

- **SPEC §8.9 "seven crons" count amendment + AC-CD7 body change — co-owned A3 + D4, NS-1-coupled.**
  Class (ii). D4 adds **+2** crons (`gap_detection.sweep` + `catalogue_health.check`); A3 adds the
  corpus-refresh cron (net 0 or +1 per NS-1). The §8.9/AC-CD7 amendment is authored **complete across
  A3 + D4** at the final count (**nine if NS-1 = retire Drive; ten if NS-1 = keep dormant**) — **§1
  amend-once** (added to the list, §11.4). The *number* is held on NS-1 (the same coupling A3 surfaced).
  Blocks D4 execution.
- **Cron cadences** (§11.2a/b) are **operational defaults**, not ratified (unlike A3's ruling-6 weekly) —
  recorded as a detail-plan call, not a surfaced item, *unless* a reviewer reads the gap-detection
  cadence as an autonomy-control gate worth ratification (the autonomy principle argues a sane default).
- **Carried holds:** D4 needs **D3 merged** (transitively D1–D2 + B2 + B3) **+ NS-5**.

### 11.4 Docs / mirror sweeps — the "seven crons" count invariant at its final value

**§1 amend-once (added):** the **SPEC §8.9 / AC-CD7 cron-count** is a multi-slice [A3 + D4] amendment —
author it **complete at the final count** (nine/ten, NS-1-coupled) before the first of A3/D4 executes
(the §1 count-invariant bullet already names the A3+D4 co-ownership; this is its amend-once corollary).
**Spec surfaces — in the spec-author's §8.9/AC-CD7 amendment PR:** SPEC §8.9 (add the two D4 cron bullets
+ the A3 corpus-refresh bullet + the final count); `CODE_SPEC.md:632/337/110` (AC-CD7); `ROADMAP.md:193/
196`; CHECKLIST P11. **Code (D4 execution):** the two `beat_schedule.py` entries + task registrations +
the docstring/ASCII-table count sweep; re-run the three-class cron grep at execution HEAD; fold completely
(no silent partial-fold). **No new model/migration** (D4 is scheduling only).

### 11.5 Tests (AC-CD15 — zero-network)

1. **Crons registered.** `beat_schedule["gap_detection.sweep"]` + `["catalogue_health.check"]` exist with
   the correct task names + `crontab` cadences; the registered-cron **count** matches the swept final
   value (a test floor parallel to the existing cron-set assertion — verify/extend at execution HEAD).
2. **Tasks dispatch the D3 fns.** The `gap_detection.sweep` task calls `gap_detection_sweep`;
   `catalogue_health.check` calls `catalogue_health_check` (assert via a stub).
3. **Zero-network** (the sweep fns are stubbed; AC-CD15).

### 11.6 What D4 does NOT touch (scope fence)

No **sweep logic** (Slice 10 / D3 owns `gap_detection_sweep` + `catalogue_health_check`); no **generation
/ gate** (B/C); no **signal capture** (D1–D2); no **corpus refresh cron** (A3 owns `corpus.refresh` — D4
only co-owns the *count* amendment with it); no **model/migration**; no **dashboard** (E); no **FE**.

### 11.7 Reviewer findings folded — Slice 11

*(none yet — Slice 11 posted for review; accumulates the auditor's + overseer's Slice-11 findings, the
per-round set-diff, and round-trip counts as the loop runs.)*

---

## Loop mechanics (role files §4–§8)

- **Watcher:** `counterpart-change-detector` skill, active iteration. `SELF_EXCLUDE` = **exact**
  `claude/festive-tesla-p5p3ai`; `WATCH_INCLUDE` = the auditor's + overseer's branch ref-space —
  scoped to the **actual** reviewer branches (Acumen reviewer branches use **`claude/<random>`**
  naming, **not** role-name tokens — the **PR #105 lesson** recorded in `REQUIRED_READING.md`; an
  over-broad role-name token would mis-scope), backstopped by the broad new-ref arm + a manual
  pre-existing-ref `git ls-remote` scan at every (re-)arm. Tight poll cadence; proactive re-arm
  ~25 min; the planner is the standing re-initiator and does **not** stand down on the dormancy bound.
- **On every wake:** `git ls-remote` + fetch + diff reviewer commits **and** read both reviewers' PR
  comments (the watcher is comment-blind); verify each finding against the live text; fold or push back.
- **Each revision:** set-diff gate (role files §6) → commit the plan change → one wake-log line in the
  same commit (`plans/.wake-log-pr108-planner.md`, per-thread `X/5`).
- **Per-slice marker:** a `Status: final for Slice N` commit on this canonical branch + an approval
  comment, bound to **Slice N's section content** (a later-slice append does not re-stale a sealed
  slice; editing a sealed slice does — §0.1). The **global** `Status: final — approved by planner (all
  slices)` lands after the last slice seals and is what Gate 1 merge binds to (the final whole-doc
  content-SHA). **Convergence binds to all three parties' global final-markers at that final whole-doc
  content-SHA** (the auditor's + overseer's too, off-branch and content-bound — §0.1 OV-4), not only
  the planner's.
- **Convergence — two gates (§0.2; do not conflate):** Gate 1 (this PR's normal-class merge) vs.
  Gate 2 (per-item authenticated ratification, downstream). The planner **never** flips draft→ready and
  **never** merges; stays subscribed through merge; stands down only on merge verified via
  `git ls-remote`.

## Out of scope (this PR)

- Authoring the spec/anchor amendment PR(s) the rulings + surfaced items produce — the **spec author**
  authors those (`SESSION_START.md`); a **fresh** session implements each slice against them.
- Flipping draft→ready or merging (the **overseer's** actions; the planner never does either).
- Any code under `app/` or `frontend/`, or any spec/anchor edit — this PR is **`plans/**` only** (the
  detail doc + the planner wake-log).
