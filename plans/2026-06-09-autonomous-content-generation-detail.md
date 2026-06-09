# Autonomous AI content generation + retroactive oversight — granular detail-plan (slice-iterative)

**Status: in progress — Slices 1 (A1) + 2 (A2) SEALED 3/3 (@ `22f3d67` / `5d26906`); Slice 3 (A3)
next** (per-slice `Status: final for Slice N` markers accumulate as each converges; the global
`Status: final — approved by planner (all slices)` lands at the bottom only after the last slice
seals — §0.1).

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

**Status: posted for Slice 3 review** (not yet sealed — awaiting auditor + overseer Slice-3 review.
Appending this section does **not** re-stale Slices 1–2's seals — §0.1.)

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
