# PR-D ratification triage — signal spine + oversight (the FINAL link)

**Cycle:** autonomous-content-generation sequenced ratification cycle, **link 4 of 4** (PR-A `c5128d9` · PR-B `921ac23` · PR-C `4122c55` all merged).
**Author:** planner (triage run per planner.md §7).
**Primary sources:** detail-plan PR #108 (`bedd84c`) Slices **D1–D2 (§9)** / **D3 (§10)** / **D4 (§11)** / **E1 (§12)** / **E2 (§13)** / **F1 (§14)**; extraction reference PR #109 §B/§C/§D (PR-D row); parent workstream PR #107.
**Ground-checked at `4122c55` (post-PR-C main):** next AC-CD mint = **AC-CD26**; AC-D at AC-D31 (PR-D mints no AC-D — GapSignal is a SPEC §5 entity, not an anchor). Cycle **stays v1.9**.

**Format:** A/B, **planner-default ▶**, file:section citations, class per `REQUIRED_READING.md` §7. Surfaced-not-baked; held for this channel's batch ruling.

---

## Already done upstream — NOT re-touched (amend-once; verified on `main`)

- **F1 bootstrap-on-publish** — AC-D7 (PR-C) + AC-D23 (PR-A) already carry it. **PR-D's F1 is execution-only** (wire the per-pill bootstrap to the C2 publish event); no anchor amendment.
- **AC-D21 E2 override relocation** — folded **complete [A2+C1+E2] in PR-A**. PR-D's E2 wires `override_safety_relevant` (execution); AC-D21 body untouched.
- **§290 audit-log rolled-back** — done in **PR-C**. **§6.5 + NS-4** — done in **PR-C**. **Cron count nine (§8.9/AC-CD7)** — done in **PR-A** (gap_detection.sweep + catalogue_health.check already enumerated). PR-D's D3/D4 are execution-only against these.

---

## DECISION D-1 — GapSignal SPEC §5 entity (AM-15 / G5) + DS9-a

The signal spine D3's gap-detection consumes: the three §6.5 signals (discovery-miss, question-tag, scope-clarification) persisted to a deduped store. **Greenfield** (no signal/gap table today).

- **▶ A (planner default)** — add a **SPEC §5 `GapSignal` entity**: **one polymorphic table** (DS9-a) — `signal_type` (enum `discovery_miss`/`question_tag`/`scope_clarification`), `dedup_key`, `detail` (JSONB), `source_ref`, `occurrence_count`, `consumed_at` (the D3 forward-ready status field), `occurred_at`, indexed on `(signal_type, dedup_key)`. One table (not three) keeps D3's cross-type cluster + the signal-layer dedup uniform. **No new anchor** — GapSignal is the data model of the §6.5 autonomous-pipeline decision (PR-C); the model + migration are D1–D2 execution.
- **B** — three typed tables (one per signal type). Fragments D3's cluster + dedup; rejected by lean.

*Class (ii) (SPEC §5 entity). If a reviewer judges GapSignal anchor-class (cf. CorpusChunk/AC-CD25), it escalates to an AC-CD mint — flagged. Cite: `SPEC.md:344` §6.5 Inputs; detail-plan §9.2a/§9.3 (G5/DS9-a).*

---

## DECISION D-2 — signal-3: scope-clarification admin feature in scope?

The `scope_clarification` signal needs an admin "clarify assignment scope" action that **does not exist** (`Assignment` has no such field/action).

- **▶ A (planner default)** — **define the `scope_clarification` signal *type* now** (forward-ready in the GapSignal enum), but **defer the admin feature** to a separate FE/admin-scope deliverable (parallel-to-G8). D1–D2 captures the two signals whose source flows exist (discovery-miss, question-tag); scope-clarification capture lands if/when the admin feature is built.
- **B** — build the admin scope-clarification feature in this workstream now (new admin action + FE + the capture wiring).

*Class (iii) (feature scope). Cite: detail-plan §9.3 signal-3; `models.py` Assignment.*

---

## DECISION D-3 — oversight AC-CD mint (AM-17) → AC-CD26, complete [E1 read + E2 rollback]

The retroactive-oversight contract — the "rein-in" half of the autonomy principle. **One AC-CD spans read (E1) + rollback (E2)** (§1 amend-once).

- **▶ A (planner default)** — mint **AC-CD26 — "Oversight dashboard: read + rollback contract"** (CODE_SPEC §18 + count/index header 25→26). **Read (E1):** admin-role-gated read API (`app/routers/oversight.py` + `app/domain/oversight.py`) — recent publishes (over `PublishRecord`), per-item provenance (claim→corpus-source→authority tier, over `GenerationProvenance`), confidence + per-pass verdicts, source-authority breakdown (aggregate by tier/`source_host`), spot-check sampling (low-confidence-weighted). **Rollback (E2, ruling 5 matrix):** `rollback_pill` / `rollback_question` / `rollback_batch` (by `batch_id`) / **`rollback_source`** (by `GenerationProvenance.source_host` — the killer feature: retract every claim grounded on a discredited source; per-assertion precision via AC-D29) — all **retract-not-delete** (retire per AC-D14 + audit). No new persistence (reads/retracts existing rows).
- **B** — split read (E1) and rollback (E2) into two anchors. Rejected — parent §4.5 + §1 amend-once specify one oversight AC-CD across E1+E2.

*Class (ii) (AC-CD mint). Cite: detail-plan §12.2b/§13.2; ruling 5 (rollback matrix); `PublishRecord` (AC-D31) + `GenerationProvenance` (AC-D29).*

---

## DECISION D-4 — §4.11 admin-oversight prose (AM-18), complete [E1+E2]

- **▶ A (planner default)** — extend **SPEC §4.11** ("Admin grade override and loop oversight") to cover **retroactive content oversight**: the autonomous pipeline has no pre-publish gate, so admin governance is **retroactive** — the oversight dashboard (read, AC-CD26/E1) surfaces recent autonomous publishes + provenance + confidence + spot-checks, and the **rollback matrix** (AC-CD26/E2: pill/question/batch/source) + the relocated AC-D21 safety-tag override (retroactive retoggle) are the rein-in. Folded complete across E1+E2.
- **B** — minimal §4.11 note now, full prose deferred. Rejected — §4.11 is a shared [E1+E2] surface (amend-once).

*Class (ii). Cite: `SPEC.md:240` §4.11; detail-plan §12.4/§13.4.*

---

## DECISION D-5 — DS13-a: per-source rollback source-demotion (binds AC-D28)

When `rollback_source` retracts a discredited source, should it also **demote the host so the corpus builder stops re-acquiring it**? A1's allowlist is a **code VCS registry** (DS1-d) — runtime demotion can't write code. A1 §1.3 forward-referenced this; **E2 is that slice**. AC-D28 (PR-A) recorded the **[A1+E2] override-layer design** with the schema **deferred to PR-D**.

- **▶ A (planner default) — (i) DB source-override layer.** A small **`demoted_sources` / source-override table** (host + `denied`/tier-override + reason + actor) that A1's `is_allowlisted`/`authority_tier` checks **consult on top of the code seed** (seed = code; runtime demotions = DB). `rollback_source` writes a DB demotion → the corpus builder skips the host. The **schema rides the AC-CD26 oversight contract** (the override layer is part of the rollback contract); AC-D28 gets a **one-line completion note** confirming the deferred [E2] schema landed in AC-CD26 (closing the multi-slice [A1+E2] it forward-referenced — not a re-amendment, a completion). **Recommended** — "rein in if it breaks" wants the demotion to *stick* at runtime, not wait on a code edit.
- **B — (ii) content-only-retract.** E2 retracts the grounded content but does **not** demote the source; the allowlist stays code-only (removing a source is a deliberate code edit). Simpler, but a discredited source can be re-acquired until the seed is edited (weaker rein-in).

*Class (ii). The detail plan leaned (i); confirming it + the AC-D28-completion handling. Cite: detail-plan §13.3 DS13-a / OV-64; AC-D28 (PR-A, the [A1+E2] override design).*

---

## DECISION D-6 — dashboard admin FE scope (parallel-to-G8)

The oversight dashboard's **admin FE** is the primary admin surface (parent §4.5 — it replaces the #106 admin generate-from-topic FE).

- **▶ A (planner default)** — **author a new `fe-specs/FE-N` surface spec for the oversight dashboard** as a deliverable of this PR-D (the FE *spec*), but **defer the FE build** to a separate FE slice (parallel-to-G8/signal-3); E1/E2 ship the backend read+rollback API now. Couples NS-5 (the FE-phase home — the oversight FE's ROADMAP placement).
- **B** — defer the FE *spec* too (PR-D = backend only; the `fe-specs/FE-N` + FE scope is a wholly separate later decision). Lighter PR-D; the FE surface is unspecified until then.

*Class (iii) (FE scope). Cite: detail-plan §12.2d/§12.3 (dashboard FE scope, parallel-to-G8); NS-5.*

---

## DECISION D-7 — anchor ID + count-header + version

- **▶ A (planner default)** — mint **AC-CD26** (oversight); CODE_SPEC §18 count/index 25→26 + footer; **GapSignal** added to SPEC §5 (+ CODE_SPEC §4 entity-table mapping is a D1–D2 execution deliverable); ROADMAP/CHECKLIST workstream rows for D/E/F filled in; **cycle stays v1.9** (no version bump — final link of the one-version cycle). The count-header AC-D stays 31 (no AC-D mint); AC-CD 25→26.
- **B** — alternative (e.g. GapSignal as an AC-CD mint too → AC-CD27). Surface only if a reviewer judges GapSignal anchor-class.

*Class (i)/(ii). Cite: `CODE_SPEC.md` §18; the cycle one-version v1.9 standing rule.*

---

## Carried / not decisions

- **F1 / AC-D7 / AC-D23 / AC-D21-E2 / §290 / §6.5 / NS-4 / cron-count** — all folded upstream (PR-A/PR-B/PR-C); PR-D's D3/D4/E2/F1 execution implements against them, **no re-amendment** (amend-once).
- **DS12-a** — `PublishRecord` (AC-D31) is the E1 read surface; spot-check is a domain read fn. No new E1 persistence. Build choice.
- **DS14-a** — async-enqueued bootstrap (per-pill anchor-gen is N AI calls → enqueue so publish stays fast). Build choice.
- **DS10-a** — gap-detection cluster/threshold mechanics (`SystemSettings` gap-threshold field). Build choice.
- **Cross-PR carry-forwards now landing here:** GapSignal §5 ↔ the PR-C §6.5/§290 forward-refs resolve (D-1); `PublishRecord` (by `batch_id`) + `GenerationProvenance` (by `source_host`) feed E2 rollback (D-3); DS13-a binds AC-D28 (D-5); NS-4 (defined PR-C) implemented by D3, **not re-amended**.

---

## Summary for batch ruling

| # | Decision | ▶ Planner default | Class |
|---|---|---|---|
| **D-1** | GapSignal §5 entity + DS9-a | **one polymorphic table** (signal_type/dedup_key/occurrence_count/consumed_at); no new anchor | ii |
| **D-2** | signal-3 admin feature | **define the type now; defer the admin scope-clarification feature** | iii |
| **D-3** | oversight AC-CD | **mint AC-CD26 — read (E1) + rollback matrix (E2), one anchor** | ii |
| **D-4** | §4.11 prose | **extend to retroactive read + rollback oversight** | ii |
| **D-5** | DS13-a source-demotion | **(i) DB source-override layer** (schema rides AC-CD26; AC-D28 completion note) | ii |
| **D-6** | dashboard FE scope | **author `fe-specs/FE-N` spec now; defer the FE build** | iii |
| **D-7** | IDs + version | **AC-CD26; count 25→26; GapSignal §5; stay v1.9** | i, ii |

**The two with genuine trade-offs:** **D-5** (DB override layer vs content-only — the detail plan leaned (i); your confirm binds AC-D28's final shape) and **D-6** (author the oversight FE spec now vs defer it entirely). The rest follow the ratified rulings + cycle discipline.

**Once ruled here, the planner authors PR-D against the ratified decisions** (fresh draft off `main` @ `4122c55`, **v1.9**, same auditor + overseer). **PR-D is the final link** — after it merges, the full PR-A→PR-D sequenced ratification cycle is complete and the planner stands down terminally (planner.md §4.10). No PR-D authoring proceeds ahead of the ruling.
