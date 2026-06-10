# Amendment-cycle extraction — autonomous-content-generation (PR #108 detail-plan)

**Task class:** read-only extraction + grouping + surface for spec-author ruling.
**Primary source:** `plans/2026-06-09-autonomous-content-generation-detail.md` (PR #108, squashed
`bedd84c`), 14 slices A1–F1, all sealed 3/3. Parent: `plans/2026-06-08-…workstream.md` (PR #107,
`2110a56`). **No PRs authored. No SPEC/DECISIONS/CODE_SPEC/fe-specs touched.**

**Ground-checked at HEAD:** `DECISIONS.md` = AC-D1…AC-D27 (next mint **AC-D28**); `CODE_SPEC.md` =
AC-CD1…AC-CD24 (next mint **AC-CD25**); "seven crons" (CODE_SPEC:110/337/632) + "seven AI operations"
(CODE_SPEC:302/304 / SPEC:296) invariants live as stated.

---

## A. The grouping driver — amend-once vs. partial-fold (planner.md §7)

Two forces decide the PR boundaries, not stage tidiness:

1. **Shared-anchor amend-once (detail-plan §1, OV-33/38/45/50/59/64/67 batch).** Eleven canonical
   surfaces are touched by **more than one slice**. Each must be authored **complete, once, before its
   *first* touching slice executes** — landing a narrow edit then "topping it up" is the §7
   silent-partial-fold failure. This is the dominant constraint: a shared anchor **cannot** be split
   across PRs.
2. **Execution sequence (workstream §5):** A→B→C serialize; D follows B; E and F follow C; D1–D2 is
   independent (needs only NS-5). A shared anchor lands in the PR that precedes its earliest toucher.

**The eleven shared (multi-slice) surfaces + earliest toucher:**

| Shared surface | Touching slices | Earliest | Detail-plan cite |
|---|---|---|---|
| **AC-D21** body | A2 + C1 + E2 | A2 | §1, §2.3, §7.3, §13.3 |
| **AC-D22** body | A2 + B2 | A2 | §1, §2.3, §5.3 |
| **AC-D23** body | A2 + B2/C1 + F1 | A2 | §1 (OV-67 triple-touch + double-touch warning), §14.3 |
| **AC-D7** body | C2 + F1 | C2 | §1, §8.3, §14.3 |
| **SPEC §6 ops-count** | B1 + C1 | B1 | §1, §4.4, §7.4 |
| **SPEC §6.5** rewrite | C2 + D1–D2 + D3 | first of {C2,D1–D2,D3} | §1 (OV-45 3-slice), §8.3, §9.3, §10.3 |
| **SPEC §290** audit-log | C2 + E2 | C2 | §1 (OV-38), §8.3, §13.4 |
| **SPEC §4.11** admin oversight | E1 + E2 | E1 | §1 (OV-59), §12.4, §13.4 |
| **GapSignal** model (SPEC §5) | D1–D2 + D3 | D1–D2 | §1 (OV-50), §9.2a, §10.4 |
| **SPEC §8.9 / AC-CD7** crons | A3 + D4 | A3 | §1, §3.3, §11.3 |
| **Oversight AC-CD** (read+rollback) | E1 + E2 | E1 | §1, §12.3, §13.3 |

**Headline structural consequence.** Because **A2 is the first toucher of AC-D21, AC-D22, AND AC-D23**,
amend-once forces the Stage-A amendment PR to carry the **complete cross-stage bodies** of all three —
pulling C1's safety-re-adjudication + E2's override-relocation (AC-D21), B2's §6.5-query extension
(AC-D22), and **F1's bootstrap-on-publish reframe** (AC-D23) *forward to Stage-A ratification time*.
The amendment cycle is **front-loaded**, not stage-linear. This is the single most important finding.

---

## B. Full amendment enumeration (by slice)

Each row: Type · Target · Substance · Gates · Coordinates-with. Class per `REQUIRED_READING.md` §7
(i)=anchor mint/change, (ii)=spec/AC-CD-body amendment, (iii)=scope decision, (iv)=durable precedent.

### Stage A
- **AM-1 · AC-D mint (i/ii)** — *source-authority scoring* (→ **AC-D28**). DECISIONS.md new body +
  `:7` count header AC-D27→28 + `Related` back-links on AC-D21/AC-D22 + SPEC §7.4 web-search prose
  (allowlist-restricted). Substance: tiered T1/T2/T3 allowlist + authority score by tier (ruling 3).
  Gates **A1**. Carries sub-decisions **DS1-a** (numeric tier scores, lean 1.0/0.6/0.3 — crosses into
  confidence contract/NS-6), **DS1-b** (T2/T3 seed hosts), **DS1-c** (allowlist scope: corpus-only vs
  also AC-D21 curation — binds AC-D21 body). **May become multi-slice [A1 + E2]** if DS13-a ruled (i)
  (§13.3/OV-64).
- **AM-2 · AC-CD mint (ii)** — *reference-corpus-builder architecture* (→ **AC-CD25**). CODE_SPEC §18
  + count/index header. Substance: acquisition pipeline + `CorpusChunk` table + authority stamping +
  pgvector/`AIProvenanceMixin` reuse. Gates **A2**.
- **AM-3 · AC-CD1 dep-add (ii)** — *text-extraction library*. CODE_SPEC AC-CD1 + `requirements*.txt`
  pins. Substance: HTML→text dep (PDF in/out of scope surfaced). Gates **A2**.
- **AM-4 · AC-D21 body change (i/ii)** — **COMPLETE [A2+C1+E2]**. Substance: web-search extended to
  corpus acquisition (A2) + safety-pass re-adjudicates `safety_relevant` (C1) + admin tag-override
  relocates to retroactive dashboard/rollback (E2). DECISIONS AC-D21 + SPEC §7.4. Gates **A2** (first
  toucher), unblocks C1/E2 contributions. **Must not partial-fold** across the three.
- **AM-5 · AC-D22 body change (i/ii)** — **COMPLETE [A2+B2]**. Substance: Drive-folder ingestion
  retired → AI-built corpus (A2) + "queried at every generation call" extends to §6.5 (B2) + the
  **Drive→corpus mirror-sweep** (SPEC:302/334/403-405, DECISIONS:574, §8.x — three-class structural
  grep at HEAD). DECISIONS AC-D22 + SPEC §7.3/§6.5. Gates **A2**. Couples **NS-1**.
- **AM-6 · AC-D23 body change (i/ii)** — **COMPLETE [A2 + B2/C1 + F1]** (OV-67 triple-touch).
  Substance: Drive embed *step 4* retired (A2, DECISIONS:574) + cross-provider self-review precedent
  the gate extends (B2/C1) + bootstrap-on-approve → **bootstrap-on-publish** (F1). DECISIONS AC-D23.
  Gates **A2** (first toucher). **Double-touch warning (§1):** hit by both the AC-D22/Drive-retirement
  PR *and* the AC-D7/AC-D23 bootstrap PR — author once or it partial-folds.
- **AM-7 · SPEC §8.9 + AC-CD7 cron-count (ii)** — **COMPLETE [A3+D4]**, **NS-1-coupled**. Substance:
  add `corpus.refresh` (A3) + `gap_detection.sweep` + `catalogue_health.check` (D4); final count
  **nine** (NS-1=retire Drive: corpus.refresh replaces drive_rag.ingest, net 0) **or ten** (NS-1=keep:
  +1). SPEC §8.9 + CODE_SPEC:632/337/110 + ROADMAP:193/196 + CHECKLIST P11. Gates **A3** (first
  toucher of count). Number **held on NS-1**.
- **NS-1 (iii)** — retire Drive ingest *code* vs keep dormant. Couples AM-5 + AM-7. Lean: remove
  (relocate shared `chunk_document`/`content_hash`/`cosine_top_k` to a shared module, do **not** delete
  — A2 §2.3 + A3 OV-15).

### Stage B
- **AM-8 · SPEC §6 ops-count (i/ii)** — **[B1+C1]**, seven→**nine**. Substance: mint
  `Operation.pill_generation` (B1, Anthropic +1) + `content_self_review` (C1, cross-family +1).
  **AC-D1 *Implications* body** (DECISIONS:96, class (i)) + **AC-CD8 numeral** (DECISIONS:63 /
  CODE_SPEC AC-CD8 prose) + SPEC §6 prose (:296/372/397/443/523) + §6 generator subsection. **Enum is
  already 8** (7 ops + `embed`, GT-1) → spec-prose seven→nine over enum 8→10. Gates **B1**.
  *Spec-author authoring choice (§7.4): one combined amendment OR per-op (seven→eight at B1,
  eight→nine at C1) — per-op tolerated here because construction-oracle test floors + greps make
  completeness checkable.*
- **AM-9 · AC-D mint (i)** — *provenance chain* (claim → corpus source + authority tier). New
  DECISIONS body + count header. Backed by **relational** `GenerationProvenance` table (the E2
  by-`source_host`-query constraint, §5.1). Gates **B2**. Carries **NS-3** (granularity: per-claim vs
  per-draft — sets `claim_ref` shape; lean per-assertion).
- **G7b (ii/iv)** — prompt-version trajectory: `pill_generation` v1.0.0 (B1) → **v1.1.0** at B2
  (grounding_refs added). Rides the prompt registry, not a doc anchor. Gates B1/B2.
- **G3 (ii)** — per-band difficulty decomposition. Lean **min/max only**; if ruled per-band, amends
  the generation AC-D / §6.5 output contract (no standalone anchor). Surfaced at B3.

### Stage C
- **AM-10 · AC-D mint (i/ii)** — *self-review protocol* (ruling 4). New DECISIONS body; cites
  AC-D19/AC-D23 cross-provider precedent. Carries **NS-2** (one `content_self_review` op + 3 variants
  vs reuse `anchor_self_review`) and **NS-7** (**RULED degrade-not-gate**, triple-authenticated §1 —
  re-confirm per execution PR). Gates **C1**. Ops-count contribution → AM-8.
- **AM-11 · AC-D mint (i/ii)** — *auto-publish gate* (rulings 1+2: single global threshold +
  publish-with-warning; removes human approve gate for generated drafts). New DECISIONS body. Carries
  **NS-6** (threshold numeric default + `compute_confidence` formula + per-type telemetry; couples
  DS1-a). Gates **C2**.
- **AM-12 · AC-D7 body change (i/ii)** — **COMPLETE [C2+F1]**. Substance: remove "queue for admin
  review / approve" governance language (C2) + incremental bootstrap fires on **auto-publish** not
  approve (F1). DECISIONS:205 + SPEC:174. Gates **C2** (first toucher).
- **AM-13 · SPEC §6.5 rewrite (ii)** — **COMPLETE [C2 + D1–D2 + D3]** (3-slice, OV-45). Substance:
  human-gated "pill proposal" → autonomous **signal-analysis (D1–D2 Inputs) / gap-detection (D3) /
  generation (B) / auto-publish (C2)** phases; NS-4 health-check definition lands here. SPEC:340-348.
  Gates **first of {C2, D1–D2, D3}** — and **D1–D2 is independent (NS-5 only)**, so §6.5-complete may
  need to land very early. See coordination note.
- **AM-14 · SPEC §290 audit-log prose (ii)** — **COMPLETE [C2+E2]**. "pill proposals approved or
  rejected" → published / publish-with-warning / **rolled-back** events. Gates **C2** (first toucher).

### Stage D
- **AM-15 · SPEC §5 entity / model (ii)** — *GapSignal* (G5) — **COMPLETE [D1–D2 + D3]** (OV-50).
  Substance: one polymorphic table (`signal_type`/`dedup_key`/`occurrence_count` + the
  `consumed_at`/status field **D3** needs, authored forward-ready at D1–D2 in one migration). Gates
  **D1–D2**. Lean one-table (DS9-a). *(§6.5-Inputs prose for the three signals is AM-13, not here —
  the prose and the §5 entity coordinate.)*
- **signal-3 (iii)** — assignment scope-clarification admin feature in scope? Lean: define
  `scope_clarification` signal type now, **defer** the admin feature (parallel-to-G8). Gates D1–D2's
  capture scope.
- **AM-16 · NS-4 (ii)** — catalogue-health-check definition (what it assesses to trigger generation).
  Lean thin-band + uncovered-subject. Lands in §6.5/§8.9 (AM-13/AM-7). Must stay coherent with A3's
  corpus-refresh backstop (DS3-a) — distinct actions (refresh corpus vs generate pills). Gates **D3**.

### Stage E
- **AM-17 · AC-CD mint (ii)** — *oversight dashboard API + read **and** rollback contract* — **COMPLETE
  [E1 read + E2 rollback]**. New CODE_SPEC AC-CD (one anchor spans both, parent §4.5 / §1). Gates **E1**
  (first toucher). Ruling 5 rollback matrix (pill/question/batch/source) is the E2 half.
- **AM-18 · SPEC §4.11 admin-oversight prose (ii)** — **COMPLETE [E1+E2]** (OV-59). Oversight is
  retroactive (read E1 + rollback E2). Gates **E1**.
- **Dashboard admin FE scope (iii)** — `fe-specs/FE-N` deliverable, parallel-to-G8. Couples NS-5
  (FE-phase home). Surfaced; held. Gates E1's FE deliverable.
- **DS13-a (ii)** — per-source rollback source-demotion = the **A1 DS1-d code→DB design point**
  (OV-64). (i) DB source-override layer (lean — makes **AM-1 multi-slice [A1+E2]**) vs (ii)
  content-only-retract (allowlist stays code-only). **Binds AM-1's shape → must be ruled at AM-1
  authoring time.** Gates E2 + retro-binds A1.

### Stage F
- F1 adds **no new shared anchor** beyond AM-12 (AC-D7) + AM-6 (AC-D23) — both already front-loaded.
  DS14-a (async-enqueued bootstrap) is a build choice, not an amendment.

### Cross-cutting
- **NS-5 (iii)** — post-P11 ROADMAP placement (P12+ phase vs named non-phase workstream). **Precondition
  for *every* slice's execution-close** (CHECKLIST/ROADMAP row needs a phase identity) — not for any
  detail. No planner lean. Should be ruled before the first execution PR.

---

## C. Recommended grouping — 4 cohesive amendment PRs

Each shared anchor is wholly inside one PR (zero partial-fold), assigned to the PR preceding its
earliest toucher. Mints sit with their stage. The 4 boundaries follow the execution sequence's natural
break points (A | B | C | D+E), with F absorbed into A/C via AC-D23/AC-D7.

### PR-A — Corpus & authority foundation (Stage-A enablement; front-loaded)
- **Target files:** `DECISIONS.md`, `CODE_SPEC.md`, `SPEC.md` (§7.3/§7.4/§8.9), `ROADMAP.md`,
  `CHECKLIST.md`, `requirements*.txt` (AC-CD1 pin).
- **Amendments:** AM-1 (source-authority AC-D28) · AM-2 (corpus-builder AC-CD25) · AM-3 (AC-CD1
  extraction dep) · AM-4 (AC-D21 complete A2+C1+E2) · AM-5 (AC-D22 complete A2+B2 + Drive→corpus
  sweep) · AM-6 (AC-D23 complete A2+B2/C1+F1) · AM-7 (§8.9/AC-CD7 cron-count complete A3+D4) · rulings
  NS-1, NS-5.
- **Gates slices:** A1, A2, A3 directly; front-loads C1/E2 (AC-D21), B2 (AC-D22), B2/C1/F1 (AC-D23),
  D4 (cron count). NS-5 gates every slice's execution-close.
- **Coordination:** carries the heaviest cross-stage load by force of amend-once (A2 = first toucher of
  AC-D21/22/23). DS13-a (PR-D) must be ruled **here** if it makes AM-1 multi-slice [A1+E2]. AC-D23's
  on-publish language lands here but its sibling AC-D7 (approve-gate removal) lands in PR-C — the two
  must tell one approve→publish story across PRs.

### PR-B — Generation + provenance + the ops-count
- **Target files:** `DECISIONS.md` (AC-D1 Implications, AC-CD8 numeral, new provenance AC-D),
  `CODE_SPEC.md` (AC-CD8), `SPEC.md` (§6).
- **Amendments:** AM-8 (§6 ops-count B1+C1, seven→nine) · AM-9 (provenance-chain AC-D + NS-3) · G7b ·
  G3.
- **Gates slices:** B1, B2, B3.
- **Coordination:** AM-8 is shared B1+C1 — author the count **complete (nine)** covering both ops, or
  per-op (spec-author choice, §7.4); either way the C1 self-review AC-D itself is PR-C, so the "nine"
  count references an op whose anchor lands in PR-C (front-load echo). The provenance table shape is
  fixed by E2's by-`source_host` query (relational, not JSONB) — surface to E2/PR-D.

### PR-C — Auto-publish gate + self-review + governance prose (Stage C, incl. F-coupled AC-D7)
- **Target files:** `DECISIONS.md` (self-review AC-D, auto-publish-gate AC-D, AC-D7), `SPEC.md`
  (§6.5, §290, §6 error-handling).
- **Amendments:** AM-10 (self-review AC-D + NS-2 + NS-7) · AM-11 (auto-publish-gate AC-D + NS-6) ·
  AM-12 (AC-D7 complete C2+F1) · AM-13 (§6.5 rewrite complete C2+D1–D2+D3) · AM-14 (§290 complete
  C2+E2).
- **Gates slices:** C1, C2; front-loads F1 (AC-D7), D1–D2/D3 (§6.5), E2 (§290).
- **Coordination — sharpest timing wrinkle:** **§6.5 (AM-13) is shared with D1–D2, which is independent
  (needs only NS-5) and may execute before Stage C.** If D1–D2 runs early, §6.5-complete must land
  before it — i.e. AM-13 may need to ship *ahead of* the rest of PR-C (with PR-A/PR-B), or D1–D2's
  execution must be sequenced after PR-C. **Spec-author sequencing decision.** NS-7 already RULED;
  re-confirm per execution PR.

### PR-D — Signal spine + oversight (Stages D & E)
- **Target files:** `SPEC.md` (§5 GapSignal, §4.11), `CODE_SPEC.md` (oversight AC-CD), `DECISIONS.md`
  (DS13-a → AM-1 shape), `fe-specs/FE-N`.
- **Amendments:** AM-15 (GapSignal SPEC §5 entity complete D1–D2+D3) · signal-3 · AM-16 (NS-4) ·
  AM-17 (oversight AC-CD complete E1+E2) · AM-18 (§4.11 complete E1+E2) · dashboard FE scope ·
  DS13-a (binds AM-1).
- **Gates slices:** D1–D2, D3, D4 (sweep fns), E1, E2.
- **Coordination:** GapSignal §5 entity (here) and the §6.5-Inputs prose (AM-13/PR-C) describe the same
  three signals — coordinate. **DS13-a retro-binds AM-1 (PR-A):** if ruled (i), the source-authority
  AC-D becomes multi-slice [A1+E2] and PR-A must already carry the E2 override-layer — so **DS13-a
  must be ruled before PR-A is authored**, even though it surfaces at E2. NS-4/AM-16 prose lives in
  §6.5 (PR-C) + §8.9 (PR-A) — coordinate, don't double-write.

### Summary table

| PR | Files touched | Amendments | Slices gated | Class mix |
|---|---|---|---|---|
| **PR-A** | DECISIONS, CODE_SPEC, SPEC(§7.3/7.4/8.9), ROADMAP, CHECKLIST, requirements* | 7 (AM-1,2,3,4,5,6,7) + NS-1,NS-5 | A1,A2,A3 (+front-loads C1,E2,B2,F1,D4) | i, ii, iii |
| **PR-B** | DECISIONS, CODE_SPEC, SPEC(§6) | 2 (AM-8,9) + G7b,G3 | B1,B2,B3 | i, ii, iv |
| **PR-C** | DECISIONS, SPEC(§6.5/§290/§6) | 5 (AM-10,11,12,13,14) | C1,C2 (+front-loads F1,D1–D2,D3,E2) | i, ii |
| **PR-D** | SPEC(§5/§4.11), CODE_SPEC, DECISIONS, fe-specs | 5 (AM-15,16,17,18, DS13-a) + signal-3, FE-scope | D1–D2,D3,D4,E1,E2 | ii, iii |

**3-PR collapse option:** PR-B + PR-C merge into one "generation + auto-publish gate" PR (B+C are
serial and share the §6 ops-count). Yields 3 PRs and removes the AM-8 cross-PR echo, at the cost of a
larger single review. Offered as a spec-author choice; 4-PR is the default for reviewability.

---

## D. Ratification-class decisions the amendment-authoring itself raises

These need **authenticated, current** spec-author ratification (`REQUIRED_READING.md` §7 (i)–(iv))
*before* the relevant amendment PR opens. The merged detail-plan reads as a **relay** downstream
(OV-2) — not actionable on its own.

**Anchor wording / numbering (planner does not assign IDs):**
- Exact bodies + immutable IDs for the **four new AC-D mints** (source-authority→AC-D28, provenance,
  self-review, auto-publish-gate) and **two new AC-CD mints** (corpus-builder→AC-CD25, oversight).
- The `DECISIONS.md:7` AC-D27→28 count-header + `AC-D1 through AC-D27` numeral sweep.

**Schema / shape choices baked into AC-CD bodies:**
- **AM-2** CorpusChunk table shape (new table vs DriveChunk reuse — DS2-a lean new; authority columns).
- **AM-9** `GenerationProvenance` **relational** table (forced by E2 by-`source_host` query, §5.1) +
  **NS-3** `claim_ref` granularity (per-assertion vs per-draft).
- **AM-11** confidence/`PublishRecord` schema (DS8-a) + **NS-6** threshold default + `compute_confidence`
  formula + per-type telemetry (couples DS1-a).
- **AM-15** GapSignal one-polymorphic-table vs three typed (G5/DS9-a) + the forward `consumed_at` field.
- **AM-17** oversight read **and** rollback contract (one AC-CD, E1+E2).

**Scope / value rulings the rulings did NOT settle:**
- **DS1-a** numeric tier scores (lean 1.0/0.6/0.3) — crosses into the confidence contract (NS-6).
- **DS1-b** T2/T3 seed hosts (bounds what the autonomous builder may fetch — a §6.5-Inputs-scope call).
- **DS1-c** allowlist application scope — corpus-only vs also tightening AC-D21 safety-link curation.
- **AM-3 / AC-CD1** the extraction dep + HTML-only vs HTML+PDF corpus scope.
- **NS-1** retire Drive code vs dormant — **sets the cron-count number (nine vs ten, AM-7)** and the
  AC-D22 shape; rule it **with** the cron amendment.
- **NS-2** new `content_self_review` op (+3 variants) vs reuse `anchor_self_review` — op-count magnitude.
- **NS-4** catalogue-health-check definition (must stay coherent with A3 corpus-refresh).
- **NS-5** ROADMAP phase home — gates every execution-close; rule before the first execution PR.
- **G3** per-band decomposition (lean min/max); **G7b** version-bump-per-contract; **signal-3** admin
  scope-clarification feature in/out; **dashboard FE** scope + FE-phase placement (couples NS-5).

**The NS-7 auto-publish-gate / safety-floor binding (explicitly called out by the task):**
- **NS-7 is already RULED — degrade-not-gate, triple-authenticated** (planner + overseer + auditor own
  channels, §1; detail-plan global-pass reconciled §7.3). Single-provider safety-relevant content
  **publishes-with-warning (always dashboard-flagged) on same-model multi-pass review + a
  "single-provider verified" flag; NO second-provider prerequisite gate.** It binds **AM-10** (C1
  exposes the `degrade` switch) + **AM-11** (C2 reads it). **Each execution PR re-confirms NS-7 through
  its own authenticated channel** (OV-2 relay discipline) — the merged ruling does not auto-actionate
  downstream.

**The two cross-PR couplings that are themselves sequencing rulings:**
- **DS13-a must be ruled before PR-A is authored** (it decides whether the source-authority AC-D is
  multi-slice [A1+E2] — i.e. whether PR-A must carry the E2 DB-override layer). Surfaces at E2 but
  binds A1.
- **§6.5 (AM-13) landing order vs the independent D1–D2 slice** — does AM-13 ship with Stage A/B
  (ahead of D1–D2), or is D1–D2's execution sequenced after PR-C? Spec-author call.

---

## E. Disposition

Report complete. No amendment PRs authored; no `SPEC.md` / `DECISIONS.md` / `CODE_SPEC.md` / `fe-specs/`
touched (this plan file is the sole artifact). **Standing down** per the task instruction — the
grouping + the §D ratification surface await authenticated spec-author ruling before any amendment PR
opens.
