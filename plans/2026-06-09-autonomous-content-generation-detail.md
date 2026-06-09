# Autonomous AI content generation + retroactive oversight — granular detail-plan (slice-iterative)

**Status: in progress — Slice 1 (A1) posted for review** (per-slice `Status: final for Slice N`
markers accumulate as each converges; the global `Status: final — approved by planner (all slices)`
lands at the bottom only after the last slice seals — §0.1).

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
- **NS-7 — reported spec-author ruling, pending authentication (auditor A-6).** The auditor reports a
  spec-author NS-7 ruling — *degrade-not-gate*: single-provider safety-relevant content
  **publishes-with-warning** (always dashboard-flagged) rather than being **gated** behind a
  second-provider prerequisite, **overriding the planner's PR #107 §7.2 prereq-gate lean** — on an
  **unmerged** addendum branch. Per role files §8.3 a ruling seen second-hand / on an unmerged branch is
  **pending, not actionable** until authenticated through the direct channel; its **authentication
  status is the overseer's lane**. **Slice 7 (C1) / Slice 8 (C2) detail will reflect the ruled outcome
  once authenticated** — it is **not baked now**, and NS-7 does **not** touch Slice 1. Recorded here so
  the ruling is not silently lost between PR #107's merged §7.2 text (which predates the addendum) and
  the Slice-7/8 detail that consumes it.

---

## Slice 1 (A1) — source-authority allowlist + scoring registry (T1/T2/T3)

**Status: posted for Slice 1 review** (not yet sealed — awaiting auditor + overseer Slice-1 review).

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
