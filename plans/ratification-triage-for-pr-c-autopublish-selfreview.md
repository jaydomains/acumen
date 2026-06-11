# PR-C ratification triage — auto-publish gate + self-review + governance prose

**Cycle:** autonomous-content-generation sequenced ratification cycle, **link 3 of 4** (PR-A merged `c5128d9`; PR-B merged `921ac23`).
**Author:** planner (triage run per planner.md §7, at spec-author instruction).
**Primary sources:** detail-plan PR #108 (`bedd84c`) Slices **C1 (§7)** + **C2 (§8)** + the F1/§6.5/§290 couplings; extraction reference PR #109 §B/§C/§D (PR-C row: AM-10/11/12/13/14); parent workstream PR #107.
**Ground-checked at `921ac23` (post-PR-B main):** next AC-D mints = **AC-D30, AC-D31** (`AC-D1…AC-D29`); `content_self_review` is **counted** in the nine named ops (PR-B front-load) but its **enum value + protocol are unbuilt** — PR-C defines its protocol (AC-D); AC-CD8 prose carries the "wiring completes in PR-C" caveat; AC-D23 already forward-refs AC-D7 (PR-A) — **PR-C owes the reciprocal back-ref**.

**Format:** A/B (or A/B/C), **planner-default ▶**, file:section citations, class per `REQUIRED_READING.md` §7. Surfaced-not-baked; held for this channel's batch ruling.

---

## Carried constraints (pre-ratified — NOT re-surfaced; baked into PR-C authoring)

- **NS-7 = degrade-not-gate** (triple-authenticated; detail-plan §1/§7.3/§8.3). Single-provider safety-relevant content **publishes-with-warning (always dashboard-flagged) + a "single-provider verified" flag; NO second-provider prerequisite gate**. Binds AM-10 (C1 exposes the switch, default `degrade`) + AM-11 (C2 reads it). Baked; each *execution* PR re-confirms via its own channel (OV-2).
- **Rulings 1 + 2** (workstream §1): **single global confidence threshold** (not per-type) + **publish-with-warning** (nothing held pre-publish, incl. safety-relevant subject to NS-7). Baked into AM-11.
- **DS1-a tier scores** T1=1.0/T2=0.6/T3=0.3 (PR-A) — feed `compute_confidence`.
- **Ops count nine** (PR-B): `content_self_review`'s *count* is already front-loaded; **PR-C completes its wiring** (enum value + protocol) — the named count stays nine, no count sweep in PR-C.
- **One version per cycle = v1.9** (PR-B OV-B1 ruling): **PR-C stays v1.9**; no version bump. Count-header moves 29 → **31** (two mints).
- **G7a** keep the `pill_proposal` refiner as the optional manual path (`approve_pill_proposal` kept for it; C2 *bypasses* it for generated drafts, does not delete it).

---

## DECISION C-1 — self-review protocol AC-D mint (AM-10) + NS-2

The multi-pass cross-model self-review floor (ruling 4) — the safety floor C2's gate runs on every generated draft. **NS-2:** one new op + variants vs reuse `anchor_self_review`.

- **▶ A (planner default)** — mint **AC-D30 — "Generated-content self-review protocol"**; **NS-2 = one new `Operation.content_self_review` + three prompt-variant passes** (`grounding` / `safety` / `provenance` via `_VARIANT_REGISTRY`), joining `_REVIEW_DEFAULT_OPS` (OpenAI cross-model default). Distinct input/output contract from `anchor_self_review` (reviews a *generated pill draft* against grounding/safety/provenance, not an *anchor question* against quality) — reusing it would conflate contracts + cost/provenance aggregation. The **safety pass re-adjudicates `safety_relevant`** (the AC-D21 autonomous replacement for the removed pre-publish admin catch). Cross-model floor with the **NS-7 degrade** path baked. Body cites the AC-D19/AC-D23 cross-provider precedent it extends.
- **B** — reuse `anchor_self_review` with added variants (no new op). Rejected by lean (contract/aggregation conflation).

*Class (i)/(ii). Cite: detail-plan §7.2/§7.3; `provider.py:162-164` `_REVIEW_DEFAULT_OPS`, `prompts/__init__.py:58` `_VARIANT_REGISTRY`; AC-D21 (`DECISIONS.md:527+`), AC-D23.*

---

## DECISION C-2 — auto-publish-gate AC-D mint (AM-11) + rulings 1+2

- **▶ A (planner default)** — mint **AC-D31 — "Autonomous auto-publish gate"**: each B3 `pending` draft → C1 self-review → `compute_confidence` (0..1) → **≥ single global threshold ⇒ publish live**; **< threshold ⇒ publish-with-warning** (live + dashboard flag); **nothing held pre-publish** (ruling 2, incl. safety-relevant subject to NS-7). **Replaces the `approve_pill_proposal` human gate for generated drafts.** Single global `SystemSettings.pill_publish_confidence_threshold` (ruling 1 — not per-type). Body.
- **B** — different gate shape (e.g. per-type threshold, or hold-low-confidence). Rejected — counter to ruling 1 (single global) + ruling 2 (nothing held).

*Class (i)/(ii). Cite: detail-plan §8.2; `catalogue.py:567-613` `approve_pill_proposal`, `:153` `create_pill`; workstream §1 rulings 1+2.*

---

## DECISION C-3 — NS-6: confidence threshold default + `compute_confidence` formula + per-type telemetry

- **▶ A (planner default)** — **`compute_confidence(self_review, provenance) -> 0..1`** = a hard-fail floor on the grounding/provenance verdicts, combined with **authority-weighted provenance** (mean tier-score of grounding chunks, DS1-a 1.0/0.6/0.3) + corroboration count (if DS2-b ≥(ii), PR-A). **Conservative default threshold `0.70`** (publish ≥0.70; below → publish-with-warning) — per-tenant tunable; **per-type telemetry** (safety vs not) recorded on the `PublishRecord` from day one so ruling 1's "re-evaluate to per-type iff data warrants" has data. Couples DS1-a.
- **B** — different default value / formula (spec author supplies the number/shape).

*Class (ii) (rides AM-11). The numeric default is the spec author's call. Cite: detail-plan §8.2a/§8.3 NS-6.*

---

## DECISION C-4 — DS8-a: confidence/flag store shape

- **▶ A (planner default) — a `PublishRecord` row per publish** (`pill_id`, `batch_id`, `confidence`, per-pass verdicts, `low_confidence`, per-type telemetry) — the natural E1 read-surface (recent publishes + provenance + confidence) and the E2 per-batch rollback join; keeps `Pill` uncluttered.
- **B** — flag columns on `Pill` (`confidence`, `low_confidence`). Workable but scatters the oversight data; weaker E1/E2 contract.

*Class (ii) (rides AM-11 / the E1 dashboard AC-CD, PR-D). Cite: detail-plan §8.2d/§8.3 DS8-a.*

---

## DECISION C-5 — AC-D7 body change (AM-12) + the AC-D23 ⇄ AC-D7 mutual reciprocal

**Multi-slice [C2 + F1], authored complete now (§1 amend-once).**

- **▶ A (planner default)** — amend **AC-D7** Implications (`DECISIONS.md:205`): remove "**New pill proposals surface in admin's review queue**" / "queue for admin review / approve" governance language for **generated** pills (they **auto-publish** per AC-D31); "when a new pill is approved, an incremental bootstrap auto-runs per AC-D23" → "when generated content **auto-publishes**, the incremental bootstrap fires per AC-D23 (**bootstrap-on-publish**, F1)". Add the **reciprocal back-reference to AC-D23** (PR-A authored AC-D23→AC-D7; this completes the mutual pair — hard requirement) + AC-D31 to `Related`. The `pill_proposal` refiner's admin path is retained (G7a).
- **B** — alternative wording (spec author supplies).

*Class (i)/(ii). Cite: `DECISIONS.md:199-213` AC-D7; AC-D23 (forward-ref present on main); detail-plan §8.3 (AC-D7 multi-slice C2+F1).*

---

## DECISION C-6 — §6.5 rewrite (AM-13): human-gated pill-proposal → autonomous pipeline

**Complete [C2 + D1–D2 + D3] (§1 amend-once; §6.5 lands complete in PR-C per the cycle's landing-order ruling).**

- **▶ A (planner default)** — rewrite **SPEC §6.5** (`SPEC.md:340-348`, currently "Pill proposal") to the **autonomous generation pipeline**: **signal capture** (D1–D2 inputs) → **gap-detection + catalogue-health check** (D3) → **generation** (§6.8, B) → **auto-publish gate** (AC-D31, C2). Forward-reference the **GapSignal** entity (PR-D §5) and the gap-detection/catalogue-health crons (PR-A §8.9, done) **without** baking PR-D's schema. The `pill_proposal` refiner is described as the retained optional manual path (G7a).
- **B** — minimal §6.5 edit now, full autonomous rewrite deferred. Rejected — §6.5 is authored complete in PR-C per the ratified landing-order (don't partial-fold a shared section).

*Class (ii). Cite: `SPEC.md:340-348`; detail-plan §8.1/§8.3; cycle coordination ruling "§6.5 kept in PR-C; do not execute D1–D2 until PR-C merges".*

---

## DECISION C-7 — NS-4: catalogue-health-check definition (define in §6.5 now vs defer to PR-D)

§6.5's rewrite (C-6) names the **catalogue-health check** phase; NS-4 defines *what it assesses*.

- **▶ A (planner default) — define it now in §6.5** so the section lands complete: **thin-band coverage** (a pill/subject with too few calibrated bands) **+ uncovered-subject** detection triggers generation; coherent with PR-A's A3 corpus-refresh backstop (distinct action: refresh corpus vs generate pills). Coordinates with §8.9 (PR-A, done) — don't double-write.
- **B — defer the NS-4 definition to PR-D** (§6.5 names the health-check phase, PR-D/AM-16 + D3 execution define it). §6.5 carries a forward-reference instead. Matches the extraction reference's PR-D placement of AM-16, at the cost of a §6.5 forward-ref.

*Class (ii)/(iii). Genuine landing-choice — A makes §6.5 self-complete; B aligns with the extraction reference's AM-16-in-PR-D grouping. Cite: detail-plan §10 (D3) / extraction §B AM-16.*

---

## DECISION C-8 — §290 audit-log governance prose (AM-14)

**Complete [C2 + E2].**

- **▶ A (planner default)** — amend the audit-log prose (`SPEC.md` §5 audit-log / the "pill proposals approved or rejected" governance line): autonomous events **published / publish-with-warning / rolled-back**. The **rolled-back** event forward-references the E2 rollback contract (PR-D) without baking its schema. Authored complete now (amend-once across C2+E2).
- **B** — author only the published/with-warning events now; rolled-back deferred to PR-D. Rejected — §290 is a shared [C2+E2] surface; partial-fold reintroduces the inconsistency amend-once prevents.

*Class (ii). Cite: detail-plan §8.1/§8.3 (`SPEC.md:290` audit-log prose).*

---

## DECISION C-9 — `content_self_review` §6 subsection + AC-CD8 caveat + anchor IDs/count

- **▶ A (planner default)** — add a concise **SPEC §6.9 "Content self-review"** op subsection (mirroring §6.6 grade review / §6.7 anchor self-review), describing the three cross-model passes; **update the AC-CD8 enum-prose caveat** "`content_self_review` (v1.9, wiring completes in PR-C)" → wired (it is defined now by AC-D30) — a 1-line completion of the forward-reference PR-B deliberately left, not a partial-fold re-touch. Mint **AC-D30 + AC-D31** (next-sequential); count-header `DECISIONS.md:7` **29 → 31** + footer; **stay v1.9** (one-version-per-cycle).
- **B** — fold content_self_review prose into §6.5 instead of a standalone §6.9. Defensible; A keeps the per-op subsection symmetry with §6.6/§6.7.

*Class (i)/(ii). Cite: `SPEC.md` §6.6/§6.7; `CODE_SPEC.md:304-311` AC-CD8 enum prose (PR-B caveat); `DECISIONS.md:7` count-header.*

---

## Carried / verify-and-record (not decisions)

- **NS-7 degrade-not-gate** — baked into AM-10 (switch default `degrade`) + AM-11 (reads it); recorded.
- **G7a** — `pill_proposal` refiner kept (optional manual path); `approve_pill_proposal` retained, bypassed for generated drafts.
- **§6 error-handling** (`SPEC.md:378-388`) — add the auto-publish path's error handling (rides AM-11; minor prose).
- **Not re-touched:** the ops *count* (nine, PR-B — PR-C completes wiring only); AC-D22/AC-D28/AC-D29/AC-CD25 (PR-A/PR-B); the cron count (PR-A).
- **Cross-PR coordination (forward-refs, not baked):** GapSignal §5 entity + the E2 rollback contract + NS-4-if-deferred → **PR-D**; verify they resolve there.

---

## Summary for batch ruling

| # | Decision | ▶ Planner default | Class |
|---|---|---|---|
| **C-1** | self-review AC-D + NS-2 | **AC-D30; one `content_self_review` op + 3 variant passes** | i, ii |
| **C-2** | auto-publish-gate AC-D | **AC-D31; single global threshold + publish-with-warning (rulings 1+2)** | i, ii |
| **C-3** | NS-6 threshold + formula | **conservative default 0.70 + authority-weighted formula + per-type telemetry** | ii |
| **C-4** | DS8-a store | **`PublishRecord` table** | ii |
| **C-5** | AC-D7 body + AC-D23 reciprocal | **remove approve-gate; auto-publish; bootstrap-on-publish (F1); reciprocal back-ref** | i, ii |
| **C-6** | §6.5 rewrite | **autonomous pipeline phases; GapSignal/PR-D forward-ref** | ii |
| **C-7** | NS-4 health-check def | **define now in §6.5 (thin-band + uncovered-subject)** — or defer to PR-D | ii, iii |
| **C-8** | §290 audit-log | **published / publish-with-warning / rolled-back (rolled-back forward-refs E2)** | ii |
| **C-9** | §6.9 + AC-CD8 caveat + IDs | **§6.9 content self-review; AC-CD8 caveat→wired; AC-D30/31; count 29→31; stay v1.9** | i, ii |

**The two with genuine trade-offs:** **C-3** (the threshold numeric default — your call) and **C-7** (define NS-4 in §6.5 now vs defer to PR-D). The rest follow the ratified rulings + the established cycle discipline.

**Once ruled here, the planner authors PR-C against the ratified decisions** (fresh draft off `main` @ `921ac23`, **v1.9**, same auditor + overseer re-engaging when the draft opens). No PR-C authoring proceeds ahead of the ruling.
