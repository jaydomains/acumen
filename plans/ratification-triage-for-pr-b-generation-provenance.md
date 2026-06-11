# PR-B ratification triage — generation + provenance + ops-count

**Cycle:** autonomous-content-generation sequenced ratification cycle, **link 2 of 4** (PR-A merged @ `c5128d9`).
**Author:** planner (this triage run per planner.md §7 surfacing discipline, at spec-author instruction).
**Primary sources:** detail-plan PR #108 (`bedd84c`) Slices **B1 (§4)** / **B2 (§5)** / **B3 (§6)** + the **C1 (§7.3/§7.4)** ops-count echo; extraction reference PR #109 §B/§C/§D (PR-B row); parent workstream PR #107.
**Ground-checked at `c5128d9` (post-PR-A main):** next AC-D mint = **AC-D29** (`AC-D1…AC-D28`); `Operation` enum is **already 8** (7 named ops + `embed`, GT-1); the "seven operations" count lives in 6 surfaces (`DECISIONS.md:96` AC-D1 Implications, `DECISIONS.md:63` AC-CD8 numeral, `CODE_SPEC.md:304-308`, `SPEC.md:298/399/445/529`). **AC-D22 already carries the §6.5 extension** (folded complete in PR-A) — **PR-B does NOT re-touch AC-D22.**

**Format:** each item A/B (or A/B/C) with **planner-default marked ▶**, file:section citations, class per `REQUIRED_READING.md` §7 (i)=anchor mint/change, (ii)=spec/AC-CD-body amendment, (iii)=scope, (iv)=durable precedent). Surfaced-not-baked; held pending this channel's batch ruling.

---

## Carried constraints (pre-ratified — NOT re-surfaced; recorded so authoring honours them)

- **Cron-count final = nine** (PR-A NS-1). PR-B touches the **ops** axis only; it must **not** alter the cron count. *(Two-nines: ops-nine and cron-nine are different axes — auditor PA-13.)*
- **T1/T2/T3 tiers + scores** (PR-A items 3+5) — referenced by the provenance authority columns; unchanged.
- **G7b = v1.0.0 core, v1.1.0 at B2** (prior chat) — **verify-and-record** (item B-10), not re-surfaced.
- **G3 = `available_difficulty_min/max` range only** (prior chat) — **verify-and-record** (item B-11), not re-surfaced.
- **NS-7 = degrade-not-gate** (prior chat) — binds C1/C2 (PR-C), not PR-B; recorded only.

---

## DECISION B-1 — §6 ops-count authoring mode: combined (seven→nine) vs per-op

The ops-count rises **seven → nine** by two mints on different stages: **`pill_generation`** (B1, Anthropic-family, +1) and **`content_self_review`** (C1, cross-family, +1). `content_self_review`'s *protocol* decision-of-record is a **PR-C** anchor (self-review AC-D, AM-10) — so PR-B authoring "nine" forward-references a PR-C op. The shared count surfaces (AC-D1 Implications `DECISIONS.md:96`, AC-CD8 numeral `:63`, SPEC §6 prose) are touched by **both** mints. Detail-plan §4.4/§7.4 + extraction §B explicitly leave the authoring mode to the spec author.

- **▶ A (planner default) — COMBINED: PR-B authors the count to its final value NINE now**, naming both `pill_generation` and `content_self_review` (the latter cited as "protocol per the self-review AC-D, PR-C"), exactly as **PR-A front-loaded the cron count to nine** naming the two not-yet-built D4 crons (amend-once; the auditor confirmed forward-references to PR-C/PR-D content are acceptable — PA-14). Canonical count = nine; **built-state honesty** mirrors PR-A's cron row ("8 of canonical 9" after PR-B's B1; 9 after PR-C's C1). Touches AC-D1 Implications + AC-CD8 **once**.
- **B — PER-OP: PR-B authors seven→EIGHT** (`pill_generation` only); **PR-C completes eight→NINE** (`content_self_review`). Cleaner PR-scope boundaries (PR-B = generation, PR-C = self-review), no forward-reference to an un-minted op; but AC-D1 Implications + AC-CD8 are touched **twice**. Detail-plan §7.4 notes per-op is *tolerable here* because the code construction-oracles (`set(OP_TO_METHOD)==set(Operation)`, `registered_operations()`, `_ALL_OPS` loop) make each PR's completeness checkable — unlike the cron count, which had no oracle and so was front-loaded.

*Class (i)+(ii). Recommendation A for amend-once consistency with the ratified PR-A cron precedent; B is defensible on PR-scope-cleanliness grounds. Cite: `DECISIONS.md:96`, `:63`; `SPEC.md:298/372/397/443/529`; detail-plan §4.4/§7.4.*

---

## DECISION B-2 — new `Operation` enum value name(s)

- **▶ A (planner default)** — `pill_generation` (B1; minted in PR-B's execution). *(If B-1=A combined, the count prose also names `content_self_review` (C1); its enum mint is PR-C execution.)* Names per detail-plan §4.2b / §7.3; distinct from the existing `pill_proposal` refiner (kept, G7a) and `anchor_self_review`.
- **B** — alternative name(s) for `pill_generation` (spec author supplies).

*Class (i) (AC-CD8 enum). Cite: `app/ai/provider.py:136-143` enum; detail-plan §4.2b. The refiner `pill_proposal` is kept untouched (G7a, lean keep).*

---

## DECISION B-3 — AC-D1 *Implications* body wording (the ops-count anchor body, class (i))

Current (`DECISIONS.md:96`): *"Acumen owns **seven** AI-driven operations as of v1.1 (test generation, grading, weakness identification, learning material generation, pill proposal, grade review per AC-D19, anchor self-review per AC-D23)."*

- **▶ A (planner default, pairs with B-1=A)** — amend to **nine**, appending: *"… , **pill generation per [generation/provenance AC-D] (autonomous topic→N draft generator, distinct from the pill-proposal refiner)**, and **content self-review per [self-review AC-D, PR-C]**) as of v1.9."* Keeps the existing seven by-name; adds the two new ops with anchor cross-refs; notes `embed` remains the un-counted 8th enum member (GT-1).
- **B (pairs with B-1=B)** — amend to **eight** now (add `pill generation` only); PR-C amends to nine (add `content self-review`).

*Class (i) (AC-D body). Exact final wording is the spec author's to set; the above is the proposed shape. Cite: `DECISIONS.md:96`.*

---

## DECISION B-4 — AC-CD8 coordination (enum prose + numeral, class (ii))

Two AC-CD8 surfaces move with the ops-count:
1. **Enum prose** `CODE_SPEC.md:304-308` — `{generation, grading, weakness, learning_material, pill_proposal, grade_review, anchor_self_review}` and *"The seven operations route to the four protocol methods"* → add `pill_generation` (→ `generate`) [+ `content_self_review` (→ `review`) if B-1=A].
2. **Numeral** `DECISIONS.md:63` — *"operation enum drives **7-operation → 4-method** routing"* → **9-operation → 4-method** (or 8 if B-1=B).

- **▶ A (planner default)** — amend both in lockstep with B-1's chosen count; `pill_generation` joins the **generate** family (`_ANTHROPIC_DEFAULT_OPS`), `content_self_review` the **review** family (`_REVIEW_DEFAULT_OPS`) — the 4-method routing is unchanged (still generate/grade/review/embed).
- **B** — alternative routing/coordination if the spec author wants a different method mapping (not recommended; the families are settled).

*Class (ii) (AC-CD body + numeral). Cite: `CODE_SPEC.md:304-308`, `DECISIONS.md:63`; `app/ai/provider.py:128-164`.*

---

## DECISION B-5 — provenance-chain AC-D mint (ID + body), class (i)

A claim→source grounding chain is **greenfield** (a `models.py` grep for `provenance|claim|citation|grounding` finds only `AIProvenanceMixin`, which is per-call *cost* provenance, not a claim→source chain — detail-plan §5.1). PR-B mints a new AC-D.

- **▶ A (planner default)** — mint **AC-D29 — "Generation provenance chain"** (next sequential after AC-D28; bump `DECISIONS.md:7` count-header 28→29 + footer). **Proposed body shape** (spec author authors/edits):
  - *Decision:* every autonomously-generated pill draft records, per claim, which corpus chunk(s)/source(s) grounded it, with each grounding source's authority tier/score (AC-D28). Stored in a relational `GenerationProvenance` table (see B-7) queryable by `source_host` and `corpus_chunk_id` (the E2 per-source rollback keys) and by `draft_ref`/`batch_id`.
  - *Rationale:* the autonomous pipeline has no human pre-publish gate; provenance is what makes retroactive oversight (Stage E) and per-source/per-batch rollback (ruling 5) precise — retract exactly the claims a discredited source grounded, not whole drafts.
  - *Implications:* new `GenerationProvenance` model + migration; written by the B2 grounded-generation fn; reused by the B3 N-draft persistence; consumed by C2 (confidence weighting) and E1/E2 (authority breakdown + rollback). Orthogonal to `AIProvenanceMixin` (B-8).
  - *Related:* AC-D28, AC-CD25, AC-D7, AC-D21; (forward) the C2 auto-publish-gate AC-D + E2 rollback AC-CD (PR-C/PR-D).
- **B** — different ID/title/body (spec author supplies).

*Class (i). Cite: detail-plan §5.1/§5.2b/§5.3; `app/models.py:213-227` (AIProvenanceMixin).*

---

## DECISION B-6 — NS-3 provenance granularity (the `claim_ref` shape), class (i)/(ii)

Ruling 0a says *"every generated claim traces"* → per-claim **intent**; the open point is the decomposition unit.

- **▶ A (planner default) — per-assertion**: each factual claim/assertion in a draft maps to its grounding chunk(s); `claim_ref` identifies the assertion; one `GenerationProvenance` row per (claim, grounding-chunk). Makes E2 per-source rollback **precise** (retract the claims a discredited source grounded, not the whole draft).
- **B — per-draft source-set**: `claim_ref` collapses to the draft; the table is per-(draft, source). Coarser; simpler rows; per-source rollback retracts whole drafts grounded on the source rather than individual claims.

*Class (i)/(ii) (rides the B-5 AC-D; sets row cardinality + `claim_ref` shape). Cite: detail-plan §5.3 NS-3.*

---

## DECISION B-7 — `GenerationProvenance` schema: relational vs JSONB, class (ii)

E2's per-source rollback must *"retract everything grounded on a discredited corpus source"* → query provenance **by `source_host`/`corpus_chunk_id`** (detail-plan §5.1).

- **▶ A (planner default) — relational table**: columns `id`, `tenant_id`, `draft_ref`, `claim_ref` (shape per B-6), `corpus_chunk_id` (FK→`CorpusChunk`), `source_host`, `authority_tier`, `authority_score`, `created_at` (+ `batch_id` stamped at B3). Indexed on `source_host` + `corpus_chunk_id`. **Forced by the E2 by-source queryability constraint.**
- **B — JSONB blob on the draft** (`ProcessingTask.payload`). **Rejected by the planner**: not queryable by `source_host` → E2 per-source rollback cannot resolve. Surfaced only to record the rejected alternative.

*Class (ii) (the AC-D body's schema; the migration is a B2 execution deliverable). Cite: detail-plan §5.1/§5.2b; `app/models.py:1174` ProcessingTask; ruling 5 (E2).*

---

## DECISION B-8 — `AIProvenanceMixin` reuse vs new table (shape confirm), class (ii)

`AIProvenanceMixin` (`models.py:213-227`) is per-row **call-cost** provenance (provider/model/tokens/cost). The claim→source chain is a different concern.

- **▶ A (planner default) — complement, not reuse**: keep `AIProvenanceMixin` for the generation **call cost** (carried on the draft via `record_provenance_share` cost-split at B3); mint **`GenerationProvenance` as a separate relational table** (B-7) for the claim→source grounding chain. The two are orthogonal — call-cost vs grounding-lineage.
- **B — overload `AIProvenanceMixin`** to also carry grounding refs. **Rejected**: conflates cost provenance with claim-lineage and cannot express the per-claim×per-source cardinality (B-6/B-7).

*Class (ii). Cite: `app/ai/cost.py:67` record_provenance / `:97` record_provenance_share; detail-plan §5.1.*

---

## DECISION B-9 — §6 generator subsection placement, class (ii)

The generator (`pill_generation`) needs SPEC §6 prose; §6.5 today is "Pill proposal" and is **rewritten** to the autonomous-generation phases in **PR-C** (AM-13, §6.5 rewrite). Detail-plan §4.4 flags this coordination.

- **▶ A (planner default)** — PR-B adds a **concise generator op subsection** in §6 (the `pill_generation` op contract: topic→N grounded drafts + provenance), and the count prose; **PR-C's §6.5 rewrite** owns the autonomous-pipeline *phase* prose (signal→gap→generate→auto-publish). Coordinate so the two don't overlap or contradict (the auditor PA-14 / overseer track this cross-PR).
- **B** — PR-B bumps **only** the count + AC-D1/AC-CD8; **all** generator §6 prose defers to PR-C's §6.5 rewrite. Minimises PR-B's SPEC §6 footprint; concentrates §6 generation prose in one PR.

*Class (ii). Cite: `SPEC.md:294-348` §6; detail-plan §4.4 ("coordinate with the §6.5 rewrite, Slice 10/D3").*

---

## Verify-and-record (carried; NOT decisions — recorded for completeness)

- **B-10 — G7b** (pre-ratified): `pill_generation` `VERSION="1.0.0"` (core topic→N schema) at B1 → **`1.1.0`** at B2 (adds `{corpus_context}` slot + `grounding_refs`). PR-B records the v1.1.0 bump as the materialisation of the ratified trajectory; the persisted `prompt_version` stamps which contract produced each draft. Cite: detail-plan §4.3/§5.2a.
- **B-11 — G3** (pre-ratified): per-band decomposition = **`available_difficulty_min/max` range only** (no richer per-band breakdown); each draft carries the existing AC-D9 min/max axis. PR-B/B3 records this; no schema field beyond min/max. Cite: detail-plan §6.3.
- **DS2-b coordination** (PR-A-ruled ≥(ii) cross-source corroboration): the `GenerationProvenance` table is the home for the per-`claim_ref` **corroboration count** (how many authoritative sources independently support a claim) — an **additive read** over the provenance rows, available iff/when surfaced; PR-B bakes nothing beyond making the table support it. Cite: detail-plan §5.2d.
- **AC-D22 — NOT re-touched**: its §6.5 "queried at every generation call" extension was folded **complete in PR-A** (verified on `main` @ `c5128d9`). PR-B must not re-amend AC-D22 (double-touch). The §6.5 *rewrite* is PR-C.

---

## Summary of decisions for batch ruling

| # | Decision | Planner default ▶ | Class |
|---|---|---|---|
| **B-1** | ops-count authoring mode | **A — combined seven→nine now** (amend-once, PR-A cron precedent) | i, ii |
| **B-2** | new op name(s) | **A — `pill_generation`** (+ `content_self_review` named in count if B-1=A) | i |
| **B-3** | AC-D1 Implications wording | **A — nine, by-name + anchor cross-refs** | i |
| **B-4** | AC-CD8 enum prose + numeral | **A — add to generate/review families; 9-op→4-method** | ii |
| **B-5** | provenance AC-D mint | **A — AC-D29 "Generation provenance chain" (body as proposed)** | i |
| **B-6** | NS-3 granularity | **A — per-assertion** | i, ii |
| **B-7** | `GenerationProvenance` schema | **A — relational (E2 by-source queryable)** | ii |
| **B-8** | AIProvenanceMixin reuse | **A — complement (separate table), not overload** | ii |
| **B-9** | §6 generator subsection | **A — concise generator subsection in PR-B; phases in PR-C §6.5** | ii |

**Once ruled through this channel, the planner authors PR-B against the ratified decisions** (fresh draft off `main` @ `c5128d9`, same auditor + overseer re-engaging when the draft opens). No PR-B authoring proceeds ahead of the ruling.
