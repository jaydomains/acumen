# AI pill generation + autonomous gap-detection — granular detail-plan (slice-iterative)

**Status: Slices 1–8 SEALED (8/10) · Slice 9 (C2) round-1 folded (S9-1 full 3-class crons grep) — awaiting reviewer re-verify.** (Per-slice seals accumulate; the global `Status: final — approved by planner (all slices)` lands after Slice 10. Slice 1's in-slice marker + the reviewers' Slice-1 seals are content-bound to §1's section and are **not** re-staled by appending Slice 2 — §0.1/OV-S1.7.)

**Date:** 2026-06-07
**Branch:** `claude/dreamy-mccarthy-dAr4h` (this detail-plan PR — distinct from the reviewers' branches).
**Authoritative source:** the merged **workstream plan**
`plans/2026-06-07-ai-pill-generation-gap-detection-workstream.md` (PR #105, squashed at `741f862`).
**Role:** the **planner's** detail-plan artifact, authored as a draft PR and hardened through the
independent **plan-auditor** (content correctness) and **plan-overseer** (workflow-governance
correctness) loop per `.claude/roles/*.md`, bound to Acumen by `plans/REQUIRED_READING.md`.

---

## 0. What this document is, and how it relates to the workstream plan

The merged workstream plan (PR #105) **converged the high-level shape**: the two-path framing
(Path 2 generator, Path 3 autonomous gap-detection), the verified dependency (Path 3 is
structurally blocked on Path 2's topic→N primitive), the one-sequenced-workstream recommendation,
the **conditional slice breakdown** (§6: A1–A5, B1–B2, C1–C2, D1), and the **12 surfaced
ratification-class decisions** (G1–G10, G-SEQ, G-PHASE). It deliberately **did not** make the
per-slice concrete build choices, and it **baked none** of the 12 decisions (role files §7 —
*surface, do not bake*).

**This document spends the per-slice token budget now.** For each slice in sequence it makes every
concrete build choice the planner *can* make (file paths, function shapes, test structure, edge
cases, idempotency, dedup, migration shape) **against the live tree at this SHA**, with `file:line`
citations — so the executing session implements without re-discovering the surface. Where a slice
**embeds** one of the 12 ratification-class items, this document **surfaces** that item as a
spec-author decision needing **authenticated ratification** (role files §8.3) and marks the slice
**blocked pending ratification** — it writes the detail **against the recommended direction** so the
work is ready the moment the ruling lands, exactly as PR #85 wrote Slice 1 against the amendment
direction. **Detail-planning is not gated; only execution waits.**

> **Nature unchanged from the workstream plan.** Both paths sit **beyond the locked P0–P11 /
> FE-1–FE-9 build** and require ratification-class changes (AC-D mint/amend, AC-CD mint,
> SPEC/§5/§6.5/§8.9 amendment — `REQUIRED_READING.md` §7 (i)/(ii)/(iii)/(iv)). **No code lands from
> this PR.** This PR is `plans/**`-only. A *fresh* session implements each slice against the
> spec-clarification PR(s) the rulings produce (`SESSION_START.md` — "Spec drift is surfaced, never
> silently resolved; the implementing session does not also author the clarification").

### 0.1 Workflow — slice-iterative (precedent: PR #85)

This is a **slice-iterative** detail-plan in **one PR throughout**. Each slice's detail section is
posted, reviewed by the auditor (content) **and** overseer (governance), and **sealed** before the
next slice's detail is pushed. Per-slice `Status: final for Slice N` markers accumulate as each
converges; the **global** `Status: final — approved by planner (all slices)` marker lands at the
bottom only after the last slice seals. Every commit carries one wake-log line
(`plans/.wake-log-pr106-planner.md`) and runs the audit-ID set-diff gate (role files §5/§6).

**Marker-binding granularity (overseer OV-S1.7; role files §8 content-binding).** Markers bind to
**content**, not the raw branch-tip SHA — and the slice-iterative pattern relies on a **per-section**
reading of "content", made explicit here so a fresh session does not mis-read "bound to the SHA" as
raw-tip binding:
- A **per-slice seal** (`Status: final for Slice N` + the three parties' Slice-N sign-offs) binds to
  **Slice N's own section content**. Appending **Slice N+1's** detail section is a content change
  *elsewhere* in the doc and therefore **does not re-stale** an already-sealed Slice N. **Editing a
  sealed slice's section** (e.g. revising it to a later G-ruling per §1.3, or a cross-slice fix)
  **does** re-stale that slice's seal and forces a re-seal at the new content.
- Per-slice seals are **interim checkpoints; they never sum to a merge authorization.** Gate 1 merge
  (§0.2) requires the **global** three sign-offs at the **final whole-doc content-SHA** + the
  three-layer green gate + the override window — a stack of per-slice seals is not a merge gate.
- Reviewer markers sit **off** the canonical branch, on each reviewer's own branch
  (`REQUIRED_READING.md` §6 D3), so a head-move on this branch never dislodges them; the planner's
  per-slice/global markers are content-invariant commits on this canonical branch.

### 0.2 Two gates — do not conflate (carried from workstream plan §8, overseer OV-1)

- **Gate 1 — this detail-plan PR's own merge is NORMAL class.** The diff is `plans/**`-only and
  bakes **no** ratification-class change (it surfaces; it does not amend a spec or anchor). It is
  **auto-merge eligible**: three sign-offs at one SHA + the **three-layer green gate** (CI + Gitar +
  GitHub mergeable, `REQUIRED_READING.md` §7) + the **24h override window** → the **overseer** flips
  draft→ready and squash-merges. Merging this plan **executes nothing, amends no spec, ratifies no
  §7 item.**
- **Gate 2 — each embedded ratification-class item is ratified separately.** Each G-item a slice
  depends on requires **explicit, item-specific, authenticated, current** spec-author ratification
  (role files §8.3) **before the downstream amendment/execution PR that depends on it proceeds**. A
  single "I approve the plan" is **not** blanket ratification of any embedded decision. The spec
  author may rule **in-session via the authenticated channel** (the in-session human channel is the
  reference); a ruling so given is recorded here citing **this conversation** as origin.

### 0.3 Ratified-so-far (carried from workstream plan §7)

**Scope boundary — class (iii), ratified 2026-06-07** (authoritative origin: the plan-overseer's
authenticated record, PR #105 review
[`pullrequestreview-4445323052`](https://github.com/jaydomains/acumen/pull/105#pullrequestreview-4445323052)):
**Path 2** (batch generator: topic → N drafts) **IN scope**; **Path 3** (§6.5 autonomous
gap-detection) **IN scope**; **Path 1** (manual Claude-in-chat → `POST /v1/pill-proposals` → approve
in admin UI) **NOT a workstream item** — zero code changes on already-shipped functionality, excluded
because there is *nothing to build*. This ratifies **only** the scope boundary; the other 11 items
(G1–G10 minus none, plus G-SEQ, G-PHASE) **remain surfaced-but-unruled** and are ratified per item
when their downstream slices reach execution.

---

## 1. Slice map (this detail-plan's `Slice N` ↔ workstream §6 sub-slice) + per-slice gates

| Slice | §6 ID | Scope (one line) | Embedded ratification-class gate(s) |
|---|---|---|---|
| **1** | **A1** | New generation prompt entry + `Operation` wiring + provider stub + AC-CD15 zero-network test | **G1, G7** |
| 2 | A2 | Grounding retrieval (RAG / web search) + per-draft citations | G4 (+ G7 if schema bumps) |
| 3 | A3 | N-draft fan-out + `processing_tasks` persistence + band decomposition | G3 |
| 4 | A4 | Generation endpoint (thin router) + envelope/authz | G6 |
| 5 | A5 (FE) | Admin "generate pills from a topic" surface | G8 |
| 6 | B1 | Discovery-search-miss signal capture (table + write) | G5 |
| 7 | B2 | Question-tag + admin-scope-clarification signal capture | G5 |
| 8 | C1 | Gap-detection analysis job (signals → topics → generator) + dedup/idempotency | G2, G5 |
| 9 | C2 | Eighth cron registration + beat schedule + "seven crons" mirror-sweep | G9 |
| 10 | D1 | Incremental bootstrap-on-approve wiring (AC-D7/AC-D23 closure) | G10 |

**Cross-cutting gates** (not slice-specific, carried for whole-workstream ratification): **G-SEQ**
(one sequenced workstream vs. split — §5 recommends one chain; surfaced) and **G-PHASE** (post-P11
ROADMAP placement — new phase vs. named non-phase workstream; surfaced). These are ruled once for the
workstream, not per slice; they are noted at each slice that assumes them but block no single slice's
detail.

**Execution sequencing (from workstream plan §5, restated).** Stage A (Slices 1–5) is the shared
primitive and ships first; Stage B (6–7) is the largest data-model surface and is independently
testable; Stage C (8–9) consumes B and drives A; Stage D (10) is small and can ride Stage A or be
last. Within Stage A: A1 → A2 → A3 → A4 serialize (each builds on the prior's contract); A5 (FE)
trails A4. **Detail-planning order follows this sequence**; the slice-iterative review loop seals
each before the next is posted.

---

## Slice 1 (A1) — new generation prompt entry + `Operation` wiring + provider stub

**Status: final for Slice 1 — approved by planner** (content-bound to this convergence SHA; auditor S1-1 RESOLVED + overseer governance SEAL [all 12 positions resolved]; both re-seal here. Slice 1 findings all resolved — §1.7.)

**Execution-gate (Gate 2): BLOCKED pending authenticated spec-author ratification of G1 and G7.**
This detail is written **against the recommended direction** (mint a new
`Operation.pill_generation`; **keep** the existing `pill_proposal` refiner; new prompt module at
`VERSION = "1.0.0"`). The detail-planning itself is **not** gated; only execution waits for the
ruling. If the spec author rules a different direction, the affected build choices below are revised
to the ruling and re-verified (precedent: PR #85 DEC-S1-A "rewritten conditional→ruled").

**Implements:** the AI **primitive** the Path-2 generator will call — a versioned `pill_generation`
prompt registry entry, the `Operation`-enum + provider-resolution wiring that routes it, a
deterministic offline **stub** so dev/local and tests work with no key, and an **AC-CD15
zero-network test**. It deliberately stops at the primitive: **no** domain enqueue, **no** N-row
`processing_tasks` persistence (Slice 3 / A3), **no** grounding retrieval (Slice 2 / A2), **no**
endpoint (Slice 4 / A4), **no** FE (Slice 5 / A5).

### 1.1 Grounding (verified against the tree at this SHA)

- **The refiner is one-in-one-out.** `app/ai/prompts/pill_proposal.py` — `VERSION = "1.0.0"`; the
  `TEMPLATE` takes a single admin-supplied `name`/`description`/`subject_id`/difficulty range and
  asks the model to *"Evaluate fit, clarity, and safety relevance"* (`pill_proposal.py:22-53`).
  Output is a **single** object, not a list (`pill_proposal.py:9-15` docstring contract). It does
  not accept a topic and does not emit N drafts.
- **The `Operation` enum is the routing + provenance driver.** `app/ai/provider.py:121-143` defines
  the seven-value enum (plus `embed`); the docstring (`:126-133`) maps each value to a protocol
  method — `generation`/`weakness`/`learning_material`/`pill_proposal` → `generate`. A generator op
  is a **generate-family** op and routes through `AIProvider.generate`.
- **Provider-default sets.** `_ANTHROPIC_DEFAULT_OPS` (`provider.py:149-157`) lists the five
  Anthropic-default ops (incl. `pill_proposal`); `_REVIEW_DEFAULT_OPS` (`:162-164`) the two OpenAI
  review ops. A new generator op is Anthropic-default per AC-D12 (it is a primary content op).
- **Stub branch dispatch.** `StubAIProvider.generate` (`provider.py:236-252`) switches on the op:
  `pill_proposal` → `_stub_pill_proposal_content`; `generation` → `_stub_generation_content`;
  `weakness`/`learning_material` → fixed dicts; else a generic `{"operation": …, "stubbed": True}`.
  A new op with no branch would fall to the generic dict — so a stub branch is required for a usable
  dev/local fail-safe.
- **Model resolution.** `resolve_model` (`provider.py:391-428`) maps each op to a coded-default
  config attr; `pill_proposal` → `anthropic_model_pill_proposal` (`:423`). A new op needs an entry
  here **and** a matching `Settings` field, or `resolve_model` raises `KeyError`.
- **Config fields follow a fixed pattern.** `app/config.py` carries `anthropic_model_<op>`
  env-default fields (AC-CD18); `anthropic_model_pill_proposal` is the precedent. *(Field list
  verified present; A1 adds one sibling field.)*
- **Provenance struct.** `AIResult` (`provider.py:167-184`) carries `content` +
  `provider/model/prompt_version/prompt_tokens/completion_tokens/cost_usd`; the stub returns
  `_stub_result` with `prompt_version="0.0.0-stub"`, zero tokens, `cost_usd=0.0`
  (`provider.py:106-118`) — no spend in tests (AC-CD15).
- **Zero-network discipline.** `conftest.py` forbids any network call in tests (AC-CD15,
  `SESSION_START.md` "CODE_SPEC decisions never to silently violate"); tests substitute a
  `RecordingProvider` by monkeypatching the module-level `_ANTHROPIC`/`_OPENAI` singletons
  (`provider.py:283-312`), never by hitting a key.
- **Prompt registry conventions.** `app/ai/prompts/` modules each embed a `VERSION` string; the
  version used is persisted on the producing entity (AC-CD8; for proposals it rides
  `payload.provenance.prompt_version`, `catalogue.py:530-537`). `app/ai/prompts/README.md` documents
  the registry contract. *(README to be swept to list the new entry — see 1.4.)*

### 1.2 Build choices — concrete (recommended direction)

**(a) New prompt module — `app/ai/prompts/pill_generation.py`, `VERSION = "1.0.0"`.**
Mirrors `pill_proposal.py`'s module shape (module docstring with the JSON contract; a `VERSION`
constant; a `TEMPLATE` string). Input placeholders: `topic` (the gap/topic prompt), `subject_id`
(optional parent), `target_count` (N drafts to emit), `available_difficulty_min`/`_max` (difficulty
envelope). Output JSON contract — a **list under a `drafts` key** (a top-level list is harder to
extend; a keyed object lets A2/A3 add sibling metadata without re-shaping):

```
{"drafts": [
  {"name": str, "description": str, "subject_id": str-uuid|null,
   "available_difficulty_min": int 1-10, "available_difficulty_max": int 1-10,
   "estimated_minutes": int|null, "safety_relevant": bool, "rationale": str,
   "evidence_count": int, "gap_signal": str}
]}
```

`evidence_count` + `gap_signal` satisfy the §6.5 output bar + auditor finding **A-1**
(`SPEC.md:346,348` — "must cite the specific gap signal"; admin evaluates in 30 s). For
admin-driven A4 generation the cited signal is the topic prompt; for Path-3-driven generation
(Slice 8) it is the captured gap signal(s). **`grounding_refs` is intentionally absent at v1.0.0** —
it is Slice 2 (A2 / G4) scope; whether adding it bumps the prompt to v1.1.0 or whether the full
schema lands at v1.0.0 is the **G7 version-trajectory** sub-question (1.3). Per-band difficulty
metadata richer than the `min/max` pair is **G3** (Slice 3) — A1 carries only the already-built
`available_difficulty_min/max` axis (`DECISIONS.md` AC-D9; `calibration.py` `_expand_supported_bands`
consumes it). No `TBD`, no speculative fields (`SESSION_START.md` doc-hygiene).

**(b) `Operation` enum + routing — `app/ai/provider.py`.**
- Add `pill_generation = "pill_generation"` to the `Operation` enum (`:136-143`) and update the
  routing docstring (`:126-133`) to list it under `generate`.
- Add `Operation.pill_generation` to `_ANTHROPIC_DEFAULT_OPS` (`:149-157`) — Anthropic-default,
  primary content op (AC-D12).
- Add a stub branch to `StubAIProvider.generate` (`:236-252`):
  `elif operation == Operation.pill_generation: content = _stub_pill_generation_content(payload)`.
- Add `_stub_pill_generation_content(payload)` (module-level, beside `_stub_generation_content`,
  `:61-103`): deterministic N-draft set, **seeded by `topic` + `target_count`** so the same input
  yields the same drafts (mirrors the attempt-seeded determinism contract). N = `target_count`
  (clamped to a sane 1–10), each draft a plausible offline placeholder carrying the full v1.0.0
  schema (incl. `evidence_count`, `gap_signal`), safety self-classified against the existing tiny
  `_STUB_SAFETY_CUES` cue list (`:34`) for parity with the proposal stub.
- Add `Operation.pill_generation: "anthropic_model_pill_generation"` to the `resolve_model` map
  (`:418-427`) — strict `[operation]` subscript at `:427`, so a missing entry `KeyError`s.
- Add `Operation.pill_generation` to **`app/ai/anthropic.py:61` `_MAX_OUTPUT_TOKENS`** (sane cap, e.g.
  ~4000 for an N-draft response) — the real provider strict-subscripts it at `anthropic.py:146`, so a
  missing entry is a **generate-time `KeyError`** (build-correctness; auditor S1-1 r4), and to
  **`app/ai/cost.py:132` `OP_TO_METHOD`** as `"generate"` (cost-dashboard op→method routing).

**(c) Config field — `app/config.py`.**
Add `anthropic_model_pill_generation` (env-default, AC-CD18), sibling to
`anthropic_model_pill_proposal`, same default-model expression. One new `Settings` field; follows
the locked `anthropic_model_<op>` pattern — an **absorbable structural addition**
(`SESSION_START.md` structural-additions carve-out: structure-gate passes, well-rationalised against
AC-CD18) folded into the slice handover, **not** a separate spec PR. *(Overseer **OV-S1.11 ruled**
this an absorbable AC-CD18-pattern model-ID env-default — **not** a fourth ratification-class change.
It is **consequent on G1** (the field exists only if `pill_generation` is minted) and therefore
**rides G1's ratification** rather than constituting a separate gate. **Caveat carried to A1
execution:** the carve-out holds only while A1 stays within one sibling field + one prompt module; if
execution adds multiple modules or touches the structure-gate, it escalates to a separate
spec-clarification PR — `SESSION_START.md`.)*

**(d) No domain / router / FE in A1.** `enqueue_*` + N-row persistence is Slice 3; the endpoint is
Slice 4. A1's only callable surface is `resolve_provider(Operation.pill_generation).generate(...)`
exercised by the test in 1.5.

### 1.3 Embedded ratification-class items — SURFACED (blocking A1 execution, Gate 2)

Each is posted as a tagged PR comment addressed to the spec author and held pending. No default is
baked; the build above is the **recommended** direction, not a decided one.

- **G1 — extend `Operation.pill_proposal` vs mint `Operation.pill_generation`?**
  Class (i)/(ii) (AC-CD8 / AC-D7 anchor). **Recommendation: MINT `pill_generation`.** Rationale: the
  refiner (name+desc → 1 object, evaluate-fit task) and the generator (topic → N drafts, decompose
  task) have **different input *and* output contracts**; overloading one op would force `generate()`
  and the stub to branch on payload shape, conflate per-operation provenance/cost aggregation
  (`catalogue.py:517-523` sums spend per op), and couple the generator's evolving schema to the
  refiner's stable `v1.0.0` prompt. A distinct op is the clean, AC-CD8-faithful shape. **Blocks A1
  execution** (the enum value + default-set membership are the anchor change).
  **Ratification scope (auditor S1-1 + overseer OV-S1.12):** ruling **G1 = MINT *entails* a
  class-**(i)+(ii)** amendment** (overseer OV-S1.12 r3): amending **`DECISIONS.md:96`** (AC-D1
  *Implications*) is a **class-(i) AC-D anchor-body** change (`REQUIRED_READING.md` §7(i)), while the
  `SPEC.md` / `CODE_SPEC.md` edits are class-(ii) — so the **authenticated ratification scope is
  broader than a pure spec edit**. The full surface set — the ops-count + the **enumerated-ops lists**
  at `SPEC.md:296/397/443/523`, `DECISIONS.md:96`, and the **numeral** `DECISIONS.md:63`, the SPEC §6
  subsection structure, plus the `CODE_SPEC.md:308` / `provider.py:4` / `provider.py:122` /
  `README.md:3` / `__init__.py:3` mirrors **and** the functional maps/floors — incl.
  **`anthropic.py:61` (`_MAX_OUTPUT_TOKENS`, a runtime `KeyError` if unset)**, `cost.py:132`
  (`OP_TO_METHOD`), `_REGISTRY`, and the `test_p5_*` floors — is enumerated, with three reproducible
  greps (word / numeral / structural), in §1.4. **The spec author should
  ratify G1 with that full amendment scope in view**, and the downstream G1 amendment PR must fold
  **all** count surfaces — not just the prompt-registry entry; the overseer (merge-executor) will
  require the count amendment folded completely, not partially. **If ruled EXTEND**, the entire sweep
  dissolves (no eighth op → the count stays seven).

- **G7 — prompt-registry version + trajectory.**
  Class (ii)/(iv). Two sub-questions: **(7a)** does `pill_proposal` **stay** (refiner retained as a
  distinct capability) or get **replaced**? **Recommendation: KEEP** — the refiner is the Path-1
  admin surface (already shipped, still useful) and replacing it would orphan
  `enqueue_pill_proposal` + the `POST /v1/pill-proposals` endpoint + the FE proposals tab.
  **(7b)** version trajectory: A1 lands `pill_generation` at `v1.0.0` (core topic→N schema). When
  Slice 2 adds `grounding_refs` to the output contract, does the version **bump to v1.1.0** (the
  persisted-version contract `catalogue.py:533` then records which contract produced each draft) or
  does the **full schema land at v1.0.0** now with `grounding_refs: []` until A2 fills it?
  **Recommendation: bump per contract change (v1.0.0 → v1.1.0 at A2)** — landing fields the A1 code
  cannot populate violates doc-hygiene ("no TBD"), and a version bump is exactly what the persisted
  registry is *for*. **Blocks A1 execution** (the `VERSION` string + the schema it pins are the
  prompt-registry decision).

> Both G1 and G7 are **foundational** to A1; A1 cannot reach execution until both are ratified.
> Because A1 is the chain's first link, A1 **holds** at execution (role files §7 — *dependent →
> hold*). Detail-planning of Slice 2 (A2) proceeds in the slice-iterative loop **after Slice 1's
> detail seals**, written against the same recommended direction; A2's *execution* inherits the A1
> hold plus its own G4 gate.

### 1.4 Docs / mirror sweeps — incl. the "seven → eight AI operations" count invariant (auditor S1-1)

Minting `pill_generation` (the G1 *recommended* direction) makes an **eighth** AI operation, which
collides with a load-bearing **"seven AI operations / seven prompts" count invariant** mirrored
across both spec and code. This is the **exact parallel of the "seven crons" mirror-sweep the
workstream plan named for G9** (workstream §4 / `…workstream.md:199-202`); without enumerating it the
G1 amendment PR risks a **silent partial-fold** (AC-CD8 body updated, the count surfaces left stale)
— the §7 fold-completeness failure. **The entire sweep below dissolves if the spec author rules
G1 = EXTEND** (no new op → the count stays seven).

**Completeness — by reproducible grep keyed on STRUCTURE, not recalled names (auditor S1-1 +
overseer OV-S1.12).** A count invariant appears in **three surface-classes**: textual-**word**,
textual-**numeral**, and **structural** (a total map over `Operation`, a strict `[operation]`
subscript that `KeyError`s, or an op-set floor). Rounds 1–4 each *under-grepped*: assert → word-only
grep (missed the numeral) → a **name-listed** functional grep that was itself enumeration-by-recall
(missed `OP_TO_METHOD` / `_MAX_OUTPUT_TOKENS`). The terminating fix (auditor S1-1 r4) is to key the
structural grep on the **type signature / access pattern that defines the surface**, never on
remembered names — then it cannot miss a member *by construction*. The three greps return the
complete set at **`697c857`** (`app/`/`SPEC.md`/`DECISIONS.md`/`CODE_SPEC.md` byte-identical to
`741f862`); **re-run all three at execution HEAD before the G1 amendment PR**:

```
# (A) textual — WORD forms, all doc/code/fe trees
grep -rniE 'seven[- ](value|ai|distinct|operation|prompt)|(all|of|the|each) seven (ai )?(operation|prompt)|five of seven|eighth (ai )?operation' \
     SPEC.md CODE_SPEC.md DECISIONS.md ROADMAP.md CHECKLIST.md FE_ROADMAP.md FE_CHECKLIST.md SESSION_START.md app/ tests/ frontend/src | grep -viE 'cron|seventh integrity'
# (A2) textual — NUMERAL forms (e.g. "7-operation -> 4-method") that (A) cannot match
# ('prompt' dropped from the alternation — it false-matched token-counts like "~3000-prompt"; auditor/overseer polish)
grep -rnE '[0-9]+-(operation|method)' SPEC.md CODE_SPEC.md DECISIONS.md app/ tests/ | grep -viE 'cron'
# (B) STRUCTURAL — every total map over Operation, every strict [operation] subscript, every op-set floor (NAME-AGNOSTIC)
grep -rnE 'dict\[Operation|\[operation\]|set\(Operation\)|list\(Operation\)|frozenset\(_REGISTERED' app/ tests/
```

- **(A)** → `SPEC.md:296/372/397/443/523`, `DECISIONS.md:96`, `CODE_SPEC.md:308`, `provider.py:4`,
  `provider.py:122`, `prompts/__init__.py:3`, `prompts/README.md:3`; **nothing** in
  `ROADMAP`/`CHECKLIST`/`FE_*`/`SESSION_START`/`frontend` (false positive excluded: `DECISIONS.md:608`
  "seventh integrity layer" = AC-D24). Plus SPEC §6.1–6.7 structure (not grep-visible).
- **(A2)** → **`DECISIONS.md:63`** only (AC-CD8 index row *"…operation enum drives 7-operation →
  4-method routing…"*).
- **(B)** → the total maps `provider.py:418-427` (`resolve_model` — an **unannotated** dict literal,
  caught by the `[operation]` subscript at `:427`, **not** by `dict[Operation`), `anthropic.py:61`
  (`_MAX_OUTPUT_TOKENS`), `cost.py:132` (`OP_TO_METHOD`), `prompts/__init__.py:37` (`_REGISTRY`); and
  the op-set floors `test_p5_prompts.py:46`, `test_p5_cost.py:137`, `test_p5_resolve.py:54`.
  **`openai.py:76` is correctly OUT** — OpenAI-only `_MAX_OUTPUT_TOKENS`; an Anthropic-default op
  never routes there (auditor confirmed). Grep (B)'s `[operation]` arm also returns
  `tests/integration/conftest.py:339/347` (`self.responses[operation]`) — a **dynamic per-test
  response cache, not an op total-map or floor**; correctly **not** a must-change surface (auditor
  polish). The overseer's independent escape-check (`== Operation.` / `match` / `.get(operation)`)
  found no surface beyond this set; the only other op-coupled structures (the `provider.py:237`
  stub-switch + `_ANTHROPIC_DEFAULT_OPS` membership) are already §1.2(b).

Keying (B) on **structure** is what *ends* the round-1→4 recursion: a `dict[Operation]` map or an
`[operation]` subscript cannot hide from a grep on its own type/access shape, the way a recalled
variable-name list could.

**The construction oracle (overseer OV-S1.12 convergence steer) — what makes completeness
regress-proof, not grep-dependent.** The codebase carries its *own* completeness oracle for the
**code** surfaces: `tests/unit/test_p5_cost.py:137` (`assert set(OP_TO_METHOD) == set(Operation)`),
`test_p5_prompts.py:46` (`registered_operations() == frozenset(_REGISTERED_OPERATIONS)`),
`test_p5_resolve.py:54/264-271` (`_ALL_OPS = list(Operation)` isolation loop + per-op block), and the
A1 stub test (§1.5 — the stub-switch returns the generic dict, no `drafts` key, and fails) — each
**red-flags its surface the moment `Operation.pill_generation` is added and the suite runs**. So the
execution method that *cannot* regress is two-tier: **(1) doc/spec surfaces** — no test ever catches a
stale "seven"/"7" in prose or a docstring, so the **`A`+`A2` greps are load-bearing and must be
exhaustive** (this is the genuinely fragile class); **(2) code surfaces** — **the executor adds the
enum member and brings the full suite + `mypy` green at execution HEAD**, which is the construction
backstop that catches every coverage-tested + exercised-subscript site. `B` + §1.2(b) then cover the
**two oracle-blind** code surfaces the suite alone would *not* catch at stub-only A1: `anthropic.py:61`
`_MAX_OUTPUT_TOKENS` (subscript `KeyError` only at a *real-provider* call — latent past A1's stub) and
`_ANTHROPIC_DEFAULT_OPS` membership (silent wrong-routing — no test asserts it). **Grep proves the
un-oracled (docs + the two blind maps); the green suite proves the rest.**

The three grep-lists + the construction oracle together are the **complete** set:

**Spec surfaces — swept in the G1/G2 spec-amendment PR** (authored by the **spec author**;
`SESSION_START.md` — the implementer does not author the clarification). The AC-CD8 anchor *body*
change recording the new op rides this same PR:
- `SPEC.md:296` — *"Acumen runs **seven distinct AI operations**…"* + enumerates the 5 Anthropic + 2
  OpenAI ops **by name** (content edit: add the 8th + its provider, not just a number bump).
- `SPEC.md:372` — *"**All seven prompts** live in version control…"*.
- `SPEC.md:397` — *"primary AI provider for **five of seven** operations… (generation, grading,
  weakness, learning material, pill proposal)"* → **six of eight** (`pill_generation` is
  Anthropic-default per AC-D12; add it to the enumerated Anthropic set).
- `SPEC.md:443` — §8.4 migration seed: *"AI prompts at v1.1 versions for **all seven operations**"*.
- `SPEC.md:523` — SiteMesh notes: *"Acumen's **seven AI operations**…"* enumerated **by name**
  (content edit).
- **SPEC §6 structure** — §6.1–6.7 = seven subsections; the generator needs its own §6 subsection.
  This **overlaps the G2** ("separate §6.5 signal-analysis from generation") amendment — coordinate
  the two so §6 gains the generator subsection once, not twice.
- `CODE_SPEC.md:308` — AC-CD8 prose: *"**The seven operations** route to the four protocol methods"*.
- `DECISIONS.md:96` — **AC-D1 *Implications*** (an **AC-D anchor body**, class (i)/(ii)): *"Acumen owns
  **seven AI-driven operations** as of v1.1 (test generation, grading, weakness identification,
  learning material generation, pill proposal, grade review per AC-D19, anchor self-review per
  AC-D23). Each is a separate version-controlled prompt."* By-name enumeration; most likely to
  silently rot (anchor Implications, not prose). (auditor S1-1 round 2 — missed in round 1.)
- `DECISIONS.md:63` — **AC-CD8 index row, NUMERAL form**: *"…operation enum drives **7-operation →
  4-method** routing…"* → **8-operation → 4-method**. Invisible to a `seven`-word grep *and* to a
  `dict[Operation]` structural grep — only the numeral grep (A2) sees it. Twin of the `CODE_SPEC.md:308`
  prose; rides the same G1/G2 amendment PR. (overseer OV-S1.12 round 4 — missed rounds 1–3.)

**Code / registry — textual count mirrors, swept in A1's execution** (in-body-override rule — the
authored prose/anchor is truth, these mirrors are swept to match; not a separate spec PR):
- `app/ai/provider.py:4` — module docstring *"…the **seven-value** `Operation` enum that drives
  per-operation model + prompt_version resolution…"* → eight-value. **Twin of `:122` in the same
  file** (round-2 swept `:122` but not `:4` — a partial-fold *within one file*; overseer OV-S1.12 r3).
- `app/ai/provider.py:122` — the `Operation` enum docstring *"**The seven AI operations** of AC-CD8
  v1.6 plus `embed`…"* → eight (code-comment mirror of the AC-CD8 count).
- `app/ai/prompts/README.md:3` — *"**The seven AI operation prompts** (SPEC §6) live here…"*. This is
  a **one-paragraph note, not a row table** (auditor S1-1 sub-issue — there is no "row" to add); the
  sweep is a **count edit** ("seven → eight") plus naming the new prompt module.
- `app/ai/prompts/__init__.py:3` — the package docstring twin of README:3: *"**The seven AI operation
  prompts** (SPEC §6) live in version control…"*. Same count edit + register `pill_generation` in the
  `_REGISTRY` (`__init__.py:37-51`) at A1/A3 time. (auditor S1-1 round 2 — missed in round 1.)
- `.env.example` — add `ANTHROPIC_MODEL_PILL_GENERATION=` sibling to the existing `anthropic_model_*`
  examples (env-default discoverability, AC-CD18).

**Code — functional surfaces, swept in A1's execution** (these carry **no count word**; only the
structural grep (B) sees them — several **break the build / `KeyError` at runtime** if not updated
when the op set grows). Total maps + strict subscripts that **must gain a `pill_generation` entry:**
- `app/ai/anthropic.py:61` (`_MAX_OUTPUT_TOKENS: dict[Operation,int]`) — **runtime `KeyError`, not
  doc-hygiene.** The real Anthropic provider does a **strict subscript** `max_tokens =
  _MAX_OUTPUT_TOKENS[operation]` (`anthropic.py:146`); `pill_generation` is Anthropic-default (§1.2b),
  so generate-time **throws** unless an entry is added (pick a sane cap, e.g. ~4000 for N drafts).
  (auditor S1-1 r4.)
- `app/ai/provider.py:418-427` (`resolve_model` coded-default **literal**) — strict subscript at
  `:427`; add the `pill_generation: "anthropic_model_pill_generation"` entry (already in §1.2(b)) or
  `resolve_model` `KeyError`s. Unannotated literal → caught by the `[operation]` arm of grep (B).
- `app/ai/cost.py:132` (`OP_TO_METHOD: dict[Operation,str]`, total map) — add
  `Operation.pill_generation: "generate"` (the cost dashboard's op→method routing). (auditor S1-1 r4.)
- `app/ai/prompts/__init__.py:37-51` (`_REGISTRY`) — register the `pill_generation` prompt so
  `get_prompt`/`registered_operations()` resolve it (the real provider fetches its template here).
- `app/ai/provider.py:149-157` (`_ANTHROPIC_DEFAULT_OPS`) — add membership (already in §1.2(b)).
- **OUT:** `app/ai/openai.py:76` (`_MAX_OUTPUT_TOKENS`) — OpenAI-only; an Anthropic-default op never
  routes there (auditor confirmed).

Op-set floor assertions that **fail-by-design** until the maps above are updated:
- `tests/unit/test_p5_prompts.py:22/:46` (`_REGISTERED_OPERATIONS` + `registered_operations() ==
  frozenset(...)`) — add `pill_generation`.
- `tests/unit/test_p5_cost.py:137` (`assert set(OP_TO_METHOD) == set(Operation)`) — fails the moment
  `pill_generation` joins the enum until `cost.py:132` is updated. (auditor S1-1 r4.)
- `tests/unit/test_p5_resolve.py:264-271` — per-op `resolve_model` block; add the `pill_generation`
  assertion (counterpart of the map entry). `:54` `_ALL_OPS = list(Operation)` is **dynamic** (no
  edit) but its `:371` isolation loop then exercises `pill_generation`, which the stub branch satisfies.

*(No config-field-set floor exists — no test asserts the set/count of `anthropic_model_*` fields; the
new field is covered by the `test_p5_resolve.py:264-271` resolution assertion.)*

No SPEC/DECISIONS/CODE_SPEC edit is made **in A1 itself** — the spec-side surfaces above are the spec
author's amendment PR; A1 execution carries only the code/registry mirrors + functional floors.

### 1.5 Tests (AC-CD15 — `app/ai/*` + `app/domain/*` near-full coverage, zero-network)

New `tests/unit/test_ai_pill_generation.py` (or extend the existing provider-resolution test
module — executor's call at implementation, noted):

1. **Resolution.** `resolve_provider(Operation.pill_generation)` returns the Anthropic singleton
   when `anthropic_api_key` is set, and `StubAIProvider` when unset (the dev/local fail-safe,
   `provider.py:377-380`). `resolve_model(Operation.pill_generation)` returns the
   `anthropic_model_pill_generation` coded default; a `system_settings.model_by_operation` override
   wins (`provider.py:407-413`).
2. **Stub determinism + schema.** `StubAIProvider.generate(Operation.pill_generation, payload)`
   returns `content["drafts"]` of length `target_count` (clamped), each draft carrying the full
   v1.0.0 schema keys; the **same** payload yields a byte-identical set on re-call (seeded
   determinism); safety self-classification fires on a cue-bearing topic.
3. **Provenance.** The returned `AIResult` carries `provider="stub"`, `model="stub-1"`,
   `prompt_version="0.0.0-stub"`, zero tokens, `cost_usd=0.0` (no spend, AC-CD15).
4. **Zero-network.** The test runs under the `conftest.py` no-network guard with no monkeypatched
   real provider — proving the primitive is exercisable fully offline.
5. **Enum/routing guard.** `Operation.pill_generation` is in `_ANTHROPIC_DEFAULT_OPS` and routes via
   `generate` (assert the stub `generate` path, not `grade`/`review`).

**Acceptance for A1 (execution):** the five tests pass under the three-layer green gate; the
structure-gate (AC-CD2/AC-CD17) still passes with the new prompt module + config field;
`resolve_model(Operation.pill_generation)` does not raise; no network in tests.

### 1.6 What A1 does NOT touch (scope fence)

No `app/domain/catalogue.py` (`enqueue_*`/persistence — Slice 3); no `app/routers/*` (endpoint —
Slice 4); no `frontend/**` (Slice 5); no migration (A1 adds no table/column — the `processing_tasks`
reuse is Slice 3); no signal-capture model (Stage B); no beat schedule (Slice 9). The `pill_proposal`
refiner path is **untouched** (recommended-direction keeps it).

### 1.7 Reviewer findings folded — Slice 1 (rounds 1–4 set-diff record; role files §6)

Findings folded across four rounds; none dropped; none a halt-class condition. The completeness gap
(S1-1 ≡ OV-S1.12, the content/governance twins) took four rounds because the op-count invariant
exists in **three phrasing classes** (word / numeral / functional) and each round grepped only the
class it recalled — the round-4 fix replaces recall with **three structural greps that close the set
by construction** (§1.4).

| ID | Reviewer | Tag | Resolution |
|---|---|---|---|
| **S1-1 ≡ OV-S1.12** | auditor (content) + overseer (governance), twins | Missing→Refine, **r1→r4** | Same completeness gap, found four times by progressively deeper greps — root cause: the invariant lives in **three phrasing classes** and each round grepped only the one it recalled. **r1:** "seven → eight" sweep (`SPEC.md:296/372/397/443/523`+§6+`CODE_SPEC.md:308`; `provider.py:122`+`README.md:3`); +`:397`/`:443`. **r2 (auditor):** +`DECISIONS.md:96`, +`__init__.py:3`. **r3 (overseer):** +`provider.py:4`, +functional floors `_REGISTERED_OPERATIONS`/`_REGISTRY`; planner +`test_p5_resolve:264-271`/`_ALL_OPS`. **r4:** overseer +`DECISIONS.md:63` (**numeral** "7-operation"); auditor +**`anthropic.py:61` `_MAX_OUTPUT_TOKENS` (runtime `KeyError`)**, `cost.py:132` `OP_TO_METHOD`, `test_p5_cost:137`; planner +`provider.py:427` strict-subscript, confirmed `openai.py:76` OUT. **Terminating fix:** §1.4 carries **three structural greps** — (A) word, (A2) numeral, (B) name-agnostic structural (`dict[Operation]` / `[operation]` subscript / op-set floor) — closing the set **by construction across all three classes**, not by recall. **Class fix:** §1.3 → **class-(i)+(ii)**. Dissolves if G1 = EXTEND. |
| **OV-S1.7** | overseer | Refine (resolved r1, held r2/r3) | §0.1 + Loop-mechanics state **marker-binding granularity**: a per-slice seal binds to **its own slice-section content** (appending a later slice does not re-stale it; editing a sealed slice does + forces re-seal); per-slice seals are interim checkpoints that **never sum to merge authorization** — Gate 1 binds the **global** whole-doc content-SHA + green + window. Unchanged since r1 (§0.1 byte-identical) — overseer re-confirmed RESOLVED at r2. |
| OV-S1.11 | overseer | Confirm (governance ruling) | Not a finding — the overseer ruled the `anthropic_model_pill_generation` config field an **absorbable AC-CD18 addition riding G1**, not a 4th ratification class. Reflected in §1.2(c) with the execution caveat. |

All 12 auditor pre-registered positions (S1-P1…S1-P12) and overseer OV-S1.1–.6/.8–.10 were
**Confirms** (no action). Round-trips: **S1-1 → 4/5**, **OV-S1.12 → 4/5** (the completeness twins —
**one round from the §7(d) 5/5 escalation bound**; both reviewers state the round-4 structural-grep
consolidation is the *convergence* fold, not the escalation one), **OV-S1.7 → 1/5** (resolved). Round
4 also folds the overseer's **construction-oracle backstop** (§1.4 — grep proves the un-oracled docs +
2 oracle-blind code maps; the green suite proves the rest).

**CONVERGED at round 5 (not §7(d) escalation).** Both reviewers **re-ran all three greps themselves**
and resolved: **auditor S1-1 RESOLVED** (re-verified A/A2/B against the live tree; confirmed the A2
fix to its own proposed regex); **overseer OV-S1.12 RESOLVED + governance SEAL** with an independent
op-dispatch escape-check (`== Operation.` / `match` / `.get(operation)`) finding no surface beyond the
union; **all 12 overseer positions resolved**, **OV-S1.7** re-confirmed. Two **non-blocking** polishes
both flagged were then folded (A2 grep tightened to drop the `prompt` token-count false-positive; a
note that grep-B's `conftest.py` `self.responses[operation]` hits are dynamic caches, not floors) —
both reviewers said they'd re-confirm these without re-opening completeness. **Planner posts
`Status: final for Slice 1 — approved by planner`** at this convergence SHA; both reviewers re-seal
here so all three markers sit at one content-SHA. *On the record (overseer):* four rounds is the
**framework working** — the completeness claim was over-asserted three times and corrected each time by
a **deeper independent re-verification** (word → numeral → structural → construction-oracle), so no
silent partial-fold reached a seal and a real spec↔impl drift (incl. a runtime `KeyError`) was kept
out of the downstream G1 amendment PR.

---

## Slice 2 (A2) — grounding retrieval (RAG / web search) + per-draft citations

**Status: final for Slice 2 — approved by planner** (content-bound to §2 at `30315fb`; auditor S2-1 + S2-2 RESOLVED + overseer governance SEAL [OV-S2.1–.11]; both seal here. Content-invariant marker — §2.1–§2.6 body byte-identical. Slice 2 findings all resolved — §2.6.)

**Execution-gate (Gate 2): BLOCKED pending (a) the A1 holds — authenticated ratification of G1 + G7 —
since A2 builds on the A1 primitive; and (b) A2's own gate G4, which covers BOTH grounding sources for
§6.5 pill generation — `G4a` Drive-RAG (an AC-D22 §6.5-scope question) and `G4b` web search (an AC-D21
scope question). Detail-planning is not gated.** Written **against the recommended direction**:
topic-keyed Drive-RAG + (optionally) web-search grounding, with per-draft `grounding_refs` as the
**G7(7b)** schema bump `pill_generation` v1.0.0 → **v1.1.0**. *(Corrected per overseer OV-S2.11: an
earlier draft declared the RAG path "in-scope under AC-D22, ships without G4" — that **baked** a
contestable AC-D22 scope reading; AC-D22 enumerates "every generation call (test generation per §6.1,
learning material per §6.4)" and **omits §6.5**, so RAG-for-pill-generation is itself a surfaced scope
item, not a planner call. **Conservative posture: both grounding paths are G4-gated** until the spec
author rules.)*

**Implements:** the A1 `pill_generation` primitive learns to **ground** — it retrieves reference
context for the *topic* and emits **per-draft citations** so the admin can evaluate provenance
(§6.5 quality bar, `SPEC.md:346,348`). Stops there: **no** N-row persistence (Slice 3), **no**
endpoint (Slice 4), **no** FE (Slice 5).

### 2.1 Grounding (verified against the tree at this SHA)

- **Existing RAG retrieval is *pill*-keyed — the generator has no pill.** `retrieve_for_generation(db,
  *, pill, target_difficulty, k=5)` (`app/domain/drive_rag.py:650`) builds its embed query via
  `build_rag_query(pill_name, pill_description, target_difficulty)` (`drive_rag.py:178`) and returns
  `[{source_doc_ref, chunk_text}]`. **Path 2 generates pills — there is no pill to key on, only a
  topic** — so A2 needs a **topic-keyed** retrieval, not a reuse of the pill-keyed signature
  unchanged. `pill=None` already returns `[]` (`:~690`), so the existing helper cannot be coerced.
- **Fail-soft contract to mirror exactly** (`drive_rag.py:650-690` docstring; SPEC §6.1 / §6 error
  handling — *"Drive RAG fetch failures: generation continues without RAG context; logged"*): empty
  query/index → `[]` (one embed, cost stamped); embed raises → `[]` at WARNING, no audit row.
- **Query-side embed cost** is captured via an `AuditLog` row `action="rag.retrieve"` (no persisted
  entity owns it), folded into the monthly aggregate by `app.ai.cost._rag_retrieve_spend` so the
  AC-CD8 sum-to-call-total invariant holds. A topic-keyed retrieval **must stamp cost the same way**.
- **`cosine_top_k`** (`drive_rag.py:196`), **`_DEFAULT_TOP_K = 5`** (`drive_rag.py:580`),
  `render_rag_context` (`drive_rag.py:587`); `render_rag_context(rag_hits)` renders
  chunks into the prompt's `{rag_context}` slot, `(none)` when empty (mirrors `generation.py:55-56`).
- **Web search is AC-D21-scoped to safety links only.** `WebSearchSource` protocol +
  `TavilyWebSearch` + `get_web_search_source()` (`app/domain/web_search.py:81-208`);
  `search(query, *, max_results=5) → [WebSearchResult{url,title,snippet,source}]`. The module
  docstring (`web_search.py:1-3`) scopes it to `app.domain.safety_links` curation. **Using it for
  *generation* grounding is a new use of AC-D21** → G4.
- **Prompt grounding pattern to mirror.** `generation.py` (`VERSION = "1.2.0"`) injects `{rag_context}`
  + a "ground in the material, don't invent beyond it; if empty fall back to general knowledge"
  instruction (`generation.py:55-68`). A1's `pill_generation` v1.0.0 has **no** grounding slot — A2
  adds it.

### 2.2 Build choices — concrete (recommended direction)

**(a) Topic-keyed retrieval — `app/domain/drive_rag.py`.** Add `retrieve_for_topic(db, *, topic: str,
target_difficulty: int | None = None, k: int = _DEFAULT_TOP_K) -> list[dict]` (sibling to
`retrieve_for_generation`). Embed query = the topic text (+ the difficulty envelope line if given),
built by a small `build_topic_rag_query(topic, target_difficulty)` mirroring `build_rag_query`'s
line-aware shape. Same `cosine_top_k` against `DriveChunk`; **same fail-soft contract** (empty topic
→ `[]` no embed; empty index → `[]` one embed + `rag.retrieve` cost audit; embed raises → `[]` WARN);
returns `[{source_doc_ref, chunk_text}]`. Reuse `render_rag_context` unchanged.

**(b) Web-search grounding — `G4b`-gated.** When (and only when) `G4b` ratifies web-search-for-
generation, call `get_web_search_source().search(topic)` and render the `WebSearchResult` rows into a
second grounding block. Held behind `G4b`; A2 is authored so web-search grounding is an additive block
the executor wires *iff* `G4b` = allow. **Both** the RAG block (a) and this web block are
grounding-source scope items (see §2.3) — neither is asserted in-scope by the planner.

**(c) Per-draft citations — prompt schema bump to v1.1.0 (G7 7b).** `pill_generation.py` `VERSION`
→ **`1.1.0`**; add `{rag_context}` (+ `{web_context}` behind G4) slots + the "ground in the material;
**each draft must cite the `source_doc_ref`s / URLs it used** in `grounding_refs`" instruction. Output
schema gains `grounding_refs: [str]` per draft (the A1 §1.3 G7(7b) "bump per contract change"
recommendation, now materialised). Empty grounding → `grounding_refs: []` + the prompt falls back to
general domain knowledge (mirrors `generation.py:66-68`). The persisted prompt-version
(`catalogue.py:533`) then records v1.1.0 on every A2-produced draft.

**(d) Stub parity.** `_stub_pill_generation_content` (from A1) extends to echo any injected
`rag_context` source-refs into each draft's `grounding_refs` (so the offline path exercises the
citation contract deterministically); `[]` when no context.

### 2.3 Embedded ratification-class item — SURFACED (blocking A2 execution, Gate 2)

**G4 — grounding sources for §6.5 pill generation.** Class (ii) (spec §6.5 Inputs + AC-D21/AC-D22
scope). **Neither source is asserted in-scope by the planner** (auditor S2-1 ≡ overseer OV-S2.11):
§6.5's **Inputs** (`SPEC.md:344`) are *"recent generated questions and their pill tags, recent Testee
discovery searches that returned no good match, recent assignments where admin manually clarified
scope"* — **signals, no Drive material and no web search**. And AC-D22's RAG is referenced
**operation-by-operation** — §6.1 generation (`SPEC.md:302`) and §6.4 learning material
(`SPEC.md:334`) each cite *"retrieved Drive RAG chunks per AC-D22"*; **§6.5 cites neither**. So adding
*either* grounding source to the new `pill_generation` op is a **§6.5 input addition** for the spec
author to rule — symmetric, not asymmetric. Two sub-items:

  - **G4a — Drive-RAG grounding for pill generation.** Does AC-D22's *"every generation call (§6.1,
    §6.4)"* RAG scope **extend** to the new §6.5 `pill_generation` op, or is grounding pill-generation
    in Drive RAG a **§6.5 Inputs addition** needing ratification? **Coordinate with G2** (the §6.5
    amendment separating signal-analysis from generation — that PR is the natural home for a §6.5
    Inputs change). **Blocks the RAG path of A2 execution.**
  - **G4b — web-search grounding for pill generation.** Web search is **AC-D21-scoped to safety-link
    curation** (`web_search.py:1-3`); using it as a generation grounding source is a **new AC-D21 use**
    + a §6.5 Inputs addition. **Blocks the web path of A2 execution.**

  **Recommendation:** rule generation grounding as **(i) signals-only / no Drive-or-web grounding at
  A2** (A2 ships the topic→N primitive grounded only in the topic + Path-3 signals; defer both
  external sources), **(ii) RAG-only** (amend §6.5 Inputs + extend AC-D22 to §6.5), or **(iii) RAG +
  web** (also amend AC-D21). **Conservative posture: BOTH grounding paths are G4-gated; A2 bakes
  neither.** Both dissolve to "no external grounding at A2" if the spec author rules them out — A2 then
  reduces to the prompt-version bump + the topic-only contract. *(Re-touches **G7(7b)** — the
  v1.0.0→v1.1.0 `grounding_refs` schema bump first surfaced at A1 §1.3; A2 is where it lands. If
  grounding is ruled out entirely, `grounding_refs` stays an empty-list contract for forward
  compatibility or the bump defers — itself part of the G4 ruling.)*

### 2.4 Tests (AC-CD15 — zero-network)

1. **Topic-keyed retrieval fail-soft:** `retrieve_for_topic` returns `[]` on empty topic (no embed)
   and on empty `DriveChunk` index (one embed; assert the `rag.retrieve` `AuditLog` cost row);
   embed-raises path returns `[]` (monkeypatched to raise) and logs WARNING — mirrors the
   `retrieve_for_generation` test battery.
2. **Citation contract:** the v1.1.0 stub, given an injected `rag_context`, emits drafts whose
   `grounding_refs` echo the injected `source_doc_ref`s; empty context → `grounding_refs: []`.
3. **Prompt well-formedness:** `render_rag_context([])` → `(none)`; the v1.1.0 template renders with
   no `KeyError` (the `render_prompt` payload-key guard, `prompts/__init__.py:99`).
4. **Version bump persisted:** a generated draft's provenance carries `prompt_version == "1.1.0"`.
5. **Web path (only if G4 = RAG+web):** a stub `WebSearchSource` (no network) yields rows rendered
   into `web_context`; absent G4, assert the web path is **not** wired (RAG-only).

### 2.5 Scope fence + mirror sweeps

Reuses `drive_rag` (`cosine_top_k`/`render_rag_context`/`DriveChunk`) + `web_search` infra **unchanged**
— no rebuild. The v1.1.0 bump updates the `pill_generation` registry entry (`_REGISTRY`) + its
`app/ai/prompts/README.md` line. **No** N-row persistence (A3), endpoint (A4), FE (A5), or signal
capture (Stage B). No SPEC/anchor edit in A2 itself — the AC-D21 generation-grounding scope change (if
G4 = RAG+web) rides the **spec author's G4 amendment PR**, not this executor slice.

### 2.6 Reviewer findings folded — Slice 2 (set-diff record; role files §6)

Round 1 folded; none dropped; none a halt-class condition. Set-diff `0 dropped / 2 added [S2-1≡OV-S2.11, S2-2]`.

| ID | Reviewer | Tag | Resolution |
|---|---|---|---|
| **S2-1 ≡ OV-S2.11** | auditor (content) + overseer (governance), twins | Push-back | I **baked** "RAG-for-pill-generation = no anchor change, ships without G4." Both caught it; auditor sharpened with the spec cite (§6.5 Inputs `SPEC.md:344` = signals only, **no RAG**; AC-D22 RAG referenced op-by-op at `:302`/`:334`, §6.5 has none → adding RAG to the new §6.5 op is a **§6.5 Inputs addition**). **Folded:** §2.3 G4 split into **G4a** (RAG, §6.5 input addition, coordinate with G2) + **G4b** (web, AC-D21) — **both grounding paths now G4-gated**, neither baked; §2-execution-gate + §2.2(b) corrected. Both dissolve to "no external grounding at A2" if ruled out. |
| **S2-2** | auditor | Refine | Two wrong `file:line` cites (a transportability defect — the doc's whole purpose). `build_rag_query` `~560`→**`:178`**; `cosine_top_k` `:580`→**`:196`** (`:580` is `_DEFAULT_TOP_K`). Fixed + verified against the live tree; added `render_rag_context` `:587`. Rest of §2.1 re-verified clean. |

Auditor S2-P1…S2-P11 otherwise Confirms (notably S2-P1 topic-keyed retrieval — the auditor's sharpest
pre-concern — confirmed solved); overseer OV-S2.1–.10 Confirms (OV-S2.5: Slice-1 seal intact / clean
append). Round-trips: **S2-1 → 1/5**, **OV-S2.11 → 1/5**, **S2-2 → 1/5**.

---

## Slice 3 (A3) — N-draft fan-out + `processing_tasks` persistence + band decomposition

**Status: final for Slice 3 — approved by planner** (content-bound to §3 at `170c7e4`; auditor S3-1 RESOLVED + content seal + overseer governance re-seal; all three bind §3@`170c7e4`. Content-invariant marker — §3.1–§3.6 byte-identical. Slice 3 findings all resolved — §3.6.)

**Execution-gate (Gate 2): BLOCKED pending the inherited A1 holds (G1 + G7) and A2 hold (G4a/G4b/G7(7b)
— A3 persists the generated drafts incl. any `grounding_refs`), plus A3's own gate G3 (per-band
difficulty decomposition). Detail-planning is not gated.** Written **against the recommended
direction**: reuse the existing `processing_tasks` queue + `create_pill` approval path **unchanged**;
fan one generation call out to **N** queue rows; drafts carry the existing `available_difficulty_min/
max` axis (richer per-band metadata surfaced as G3).

**Implements:** the domain layer that turns one `Operation.pill_generation` call into **N admin-
reviewable proposals** — `enqueue_pill_generation` persists N `ProcessingTask` rows that the existing
list/approve/reject queue + FE tab consume unchanged. Stops there: **no** endpoint (Slice 4), **no**
FE (Slice 5), **no** prompt change (A2 owns the v1.1.0 prompt).

### 3.1 Grounding (verified against the tree at this SHA)

- **The refiner is one-in-one-out; A3 is one-call-N-out.** `enqueue_pill_proposal` (`catalogue.py:488`)
  makes **one** `provider.generate(Operation.pill_proposal, …)` call and persists **one**
  `ProcessingTask` (`catalogue.py:524-544`), `payload = {"proposal": result.content, "provenance":
  {provider, model, prompt_version, tokens, cost_usd}}`. A3 mirrors this but the generator returns
  `{"drafts": [...]}` (A1/A2 contract) → **N** rows.
- **Queue + approval are reusable unchanged.** `list_pill_proposals` filters by `task_name ==
  PROPOSAL_TASK_NAME` (`catalogue.py:547-555`); `approve_pill_proposal` (`:567`) reads
  `payload["proposal"]` and calls `create_pill(subject_id, name, description,
  available_difficulty_min/max, discoverable=True, estimated_minutes, ai_safety_classification)`
  (`catalogue.py:586-596` → `create_pill` sig confirmed); `reject_pill_proposal` (`:616`). The FE
  proposals tab reads `payload` generically (`proposals-tab.tsx` — `parseProposalPayload`). **So N
  generated drafts persisted under `PROPOSAL_TASK_NAME` with a `payload.proposal`-shaped body flow
  through the entire existing queue with zero queue/FE change.**
- **Band decomposition is a range expansion, not a column.** `_expand_supported_bands(pill)` =
  `range(pill.available_difficulty_min, max+1)` (`calibration.py:~300`); **the Pill model carries no
  `supported_bands` column** — the supported set *is* the min/max range. So "per-band decomposition"
  richer than the min/max pair (e.g. per-band anchor-pool intent per AC-D20) would need a **new
  data-model column** (AC-CD4) → G3.
- **Cost provenance is summed per operation, and the 1:N share primitive already exists.**
  `_pill_proposal_spend` folds each proposal's `payload.provenance.cost_usd` into the monthly per-op
  aggregate (AC-CD8 sum-to-call-total). **One generation call → N rows** is the documented 1:N case:
  **`record_provenance_share(entity, result, *, share_count)` (`cost.py:97-124`)** divides cost +
  tokens evenly so the N rows sum back to the call total — A3 mirrors this (3.2c), it does **not**
  reinvent attribution. *(Round-1 grounding cited the sum side but missed this per-row share
  primitive — auditor S3-1.)*
- **`ProcessingTask`** (`models.py:1174`): `task_name` (indexed), `status` (pending→done), `payload`
  (JSONB). Reusing it + a JSONB payload shape needs **no migration**.

### 3.2 Build choices — concrete (recommended direction)

**(a) N-draft fan-out — `enqueue_pill_generation(db, *, topic, subject_id, target_count,
available_difficulty_min, available_difficulty_max, …)` in `catalogue.py`.** One
`resolve_provider(Operation.pill_generation).generate(...)` call → `result.content["drafts"]`; persist
**one `ProcessingTask` per draft** under `PROPOSAL_TASK_NAME`, each `payload = {"proposal": draft,
"provenance": {…}, "source": "generation", "generation_batch_id": <uuid>}`. The `source` +
`generation_batch_id` distinguish generator-origin rows from refiner rows and group the batch — both
ride the existing JSONB `payload` (no migration, no queue/FE change).

**(b) Approval reuse — unchanged.** A generated draft's row is approved by the **existing**
`approve_pill_proposal` → `create_pill` (the draft's `name`/`description`/`subject_id`/difficulty/
`safety_relevant` map 1:1 to `create_pill` args, already wired at `catalogue.py:586`). No new approval
path. *(`grounding_refs` from A2 rides `payload.proposal` for admin display; `create_pill` ignores it
— pills carry no citations column, correct.)*

**(c) Cost-attribution invariant — mirror the existing `record_provenance_share` even-share idiom
(auditor S3-1).** The codebase already solves this exact 1:N case: `record_provenance_share(entity,
result, *, share_count)` (`app/ai/cost.py:97-124`, cross-referenced from `record_provenance:67`)
divides **cost and tokens evenly** — `cost_usd / N`, `prompt_tokens // N`, `completion_tokens // N`
(floor division; the <N-token rounding remainder is operationally insignificant per its docstring) —
and replicates `provider`/`model`/`prompt_version` (which describe the *call*, not the share) on every
row. **A3 mirrors that division**, *not* a reinvented "full-cost-on-one-row, 0 on the rest" scheme
(which would mis-handle tokens and lose the whole batch's spend if the one cost-bearing row is
purged). **Seam:** `record_provenance_share` writes the `AIProvenanceMixin` **columns**, but a pill
proposal stores provenance in `ProcessingTask.payload.provenance` (JSONB) — so A3 cannot call it
literally; it applies the **same even-share division into each row's `payload.provenance`** —
`{provider, model, prompt_version, prompt_tokens: total//N, completion_tokens: total//N, cost_usd:
total/N, generation_batch_id}`. `_pill_proposal_spend` then sums the N rows back to the call total
(AC-CD8 sum-to-call-total), per-draft cost is honest, and deleting a rejected draft drops only its
1/N share. *(Build-design detail — not ratification-class.)*

**(d) Band decomposition — min/max only at A3.** Each draft persists
`available_difficulty_min/max`; on approval `create_pill` stores them and `_expand_supported_bands`
yields the per-band set. **No richer per-band metadata** at A3 — that is **G3**.

### 3.3 Embedded ratification-class item — SURFACED (blocking A3 execution, Gate 2)

**G3 — per-band difficulty decomposition depth.** Class (i)/(ii) (AC-D9 / AC-CD4). Does a generated
draft carry **only** the existing `available_difficulty_min/max` range (which `_expand_supported_bands`
already consumes — **no data-model change**), or **richer per-band metadata** — e.g. per-band
anchor-pool intent per AC-D20, which the Pill model does **not** currently carry and would need a new
**AC-CD4 column** + migration? **Recommendation: min/max range only** (the merged workstream plan §3.3
notes the existing axis drives `_expand_supported_bands` + bootstrap anchor-pool sizing already; richer
per-band is unneeded at v1 and is a data-model amendment). **Blocks A3 execution** only insofar as the
draft schema's difficulty fields are the G3 decision; the fan-out/persistence/approval-reuse is
G3-independent. *(Inherits A1 G1/G7 + A2 G4/G7(7b) as upstream holds — A3 persists their output.)*

### 3.4 Tests (AC-CD15 — `app/domain/*` near-full coverage, zero-network)

1. **Fan-out:** `enqueue_pill_generation` with a stub returning `{"drafts": [3 items]}` persists **3**
   `ProcessingTask` rows under `PROPOSAL_TASK_NAME`, each `payload.proposal` a draft + shared
   `generation_batch_id`; `list_pill_proposals` returns all 3 (queue reuse).
2. **Cost-invariant (even-share, mirroring `record_provenance_share`):** each of the N rows carries
   `provenance.cost_usd == total/N` and `prompt/completion_tokens == total//N`; the **sum** across the
   N rows == the single generate call's `cost_usd`/tokens (not N×, not all-on-one) — the core 3.2(c)
   assertion.
3. **Approval reuse:** approving one generated row calls `create_pill` (materialises a pill with the
   draft's difficulty + safety self-classification); `reject_pill_proposal` marks the row done.
4. **Band decomposition:** an approved draft's pill yields `_expand_supported_bands == range(min,
   max+1)`; no `supported_bands` column referenced.
5. **Zero-network:** all via the `StubAIProvider` `pill_generation` path under the `conftest.py` guard.

**Acceptance:** the five tests pass under the three-layer green gate; structure-gate passes (no new
module beyond `catalogue.py` additions); **no migration** (reuses `processing_tasks` + JSONB payload).

### 3.5 Scope fence

Reuses `processing_tasks`, `create_pill`, `approve_pill_proposal`/`reject_pill_proposal`, the FE
proposals tab — **unchanged**. **No** endpoint (Slice 4), **no** FE (Slice 5), **no** prompt/version
change (A2 owns v1.1.0), **no** migration, **no** signal capture (Stage B). The `pill_proposal`
refiner enqueue path is untouched (recommended-direction keeps it).

### 3.6 Reviewer findings folded — Slice 3 (set-diff record; role files §6)

Round 1 folded; none dropped; none a halt-class condition. Set-diff `0 dropped / 1 added [S3-1]`.

| ID | Reviewer | Tag | Resolution |
|---|---|---|---|
| **S3-1** | auditor | Refine | §3.2(c) reinvented 1:N cost attribution ("full-cost-on-one-row") when **`record_provenance_share`** (`cost.py:97-124`) already divides cost **and** tokens evenly for the documented generation-→-N-rows case. **Folded:** §3.2(c) rewritten to **mirror the even-share division** into each row's `payload.provenance` (`cost_usd: total/N`, `tokens: total//N`, full provider/model/version replicated) — citing the primitive + the seam (it writes `AIProvenanceMixin` columns; `ProcessingTask` uses JSONB, so A3 mirrors the shape, can't call it literally). §3.1 grounding + §3.4 test 2 updated to even-share. Honest per-draft + robust to row-purge; aggregate sum unchanged. |

Auditor S3-P1…S3-P11 otherwise Confirms (notably S3-P1 task_name discriminator + S3-P2 cost-risk —
both planner-surfaced unprompted; S3-P3/P10 G3-no-column-without-ratification confirmed). Round-trips:
**S3-1 → 1/5**.

---

## Slice 4 (A4) — generation endpoint (thin router) + envelope/authz

**Status: final for Slice 4 — approved by planner** (content-bound §4 @ `75718a8`; auditor S4-1 RESOLVED + content seal + overseer governance re-seal; all three bind §4@`75718a8`. Content-invariant marker — §4.1–§4.6 byte-identical. Slice 4 findings all resolved — §4.6.)

**Execution-gate (Gate 2): BLOCKED pending the inherited holds (A1 G1/G7, A2 G4a/G4b/G7(7b), A3 G3 —
A4 exposes that whole stack over HTTP) plus A4's own gate G6 (the new generation API contract + its
AC-CD). Detail-planning is not gated.** Written **against the recommended direction**: a thin
admin-only `POST /v1/pill-proposals/generate` over A3's `enqueue_pill_generation`, returning the
batch of queued drafts; the drafts then surface in the **existing** `GET /v1/pill-proposals` queue.

**Implements:** the HTTP entry surface for admin-driven Path-2 generation — topic → N queued drafts.
Stops there: **no** FE (Slice 5), **no** domain logic (A3 owns `enqueue_pill_generation`; routers are
thin per AC-CD2), **no** Path-3 signal-write endpoints (Stage B/C).

### 4.1 Grounding (verified against the tree at this SHA)

- **Thin-router pattern to mirror.** `create_pill_proposal` (`catalogue.py:330-352`): `@router.post(
  "/pill-proposals", status_code=201)`, `_admin: AppUser = Depends(_require_admin)`, validates a
  `PillCreate` body, calls `catalogue.enqueue_pill_proposal(...)`, `await db.commit()`, returns
  `PillProposalResponse{id, status, payload, created_at}`. A4 mirrors this shape over
  `enqueue_pill_generation` (A3).
- **Authz is one dependency (AC-CD5).** `_require_admin = require_role(ROLE_ADMINISTRATOR)`
  (`catalogue.py:43`) — admin-only, same as the refiner endpoint. The uniform error envelope is
  `APIError` (`app/permissions.py`); REST `/v1` + envelope is AC-CD6.
- **Routers carry no business logic (AC-CD2).** The endpoint is validation + authz + envelope only;
  the fan-out/persistence/cost-share all live in A3's `enqueue_pill_generation`.
- **Request/response schemas.** `PillCreate` (`schemas.py:203`, extends `_DifficultyRange`) is the
  *refiner* body (name+description). `PillProposalResponse` (`schemas.py:295`) is the queue row shape.
  A4 needs a **new request schema** (topic-based, not name/description) and a **batch response**.
- **OpenAPI is the FE contract.** New endpoint + schemas flow into the generated OpenAPI the frontend
  consumes (the `codegen-drift` CI check); A5 (FE) consumes this contract.

### 4.2 Build choices — concrete (recommended direction)

**(a) New request schema — `PillGenerationCreate` (`app/schemas.py`).** `topic: str` (the gap/topic
prompt; bounded length), `subject_id: uuid | None`, `target_count: int` (bounded 1–`N_max`, e.g. 10),
extends `_DifficultyRange` (reuses the `available_difficulty_min ≤ max` validation). Distinct from
`PillCreate` — the generator takes a *topic*, not a name+description.

**(b) New endpoint — `POST /v1/pill-proposals/generate` (`catalogue.py`), thin.** `_require_admin`;
validate `PillGenerationCreate`; call `catalogue.enqueue_pill_generation(db, topic=…, subject_id=…,
target_count=…, available_difficulty_min/max=…)` (A3); `await db.commit()`; return a **batch
response** `PillGenerationBatchResponse{generation_batch_id, count, tasks: [PillProposalResponse]}` so
the caller/FE sees the N drafts created. The drafts also appear in the existing `GET /v1/pill-
proposals` (A3 persists them under `PROPOSAL_TASK_NAME`). Status `201`. *(Endpoint **path + response
shape** are the G6 contract — `/pill-proposals/generate` sub-resource action vs. a distinct
`/pill-generations` resource is a G6 design point, §4.3.)*

**(c) Envelope + authz only.** Non-admin → `403` via `_require_admin`; malformed body → `422` via the
AC-CD6 uniform envelope (Pydantic validation); no business logic in the router (AC-CD2).

**(d) No domain / FE / persistence change.** A3 owns the enqueue + fan-out + cost-share; A2 owns the
prompt; A5 owns the FE. A4 is purely the HTTP seam.

### 4.3 Embedded ratification-class item — SURFACED (blocking A4 execution, Gate 2)

**G6 — generation API contract + new AC-CD.** Class (ii)/(iv) (new code anchor — the task mandates
"new CD anchors for any API contracts"). Decisions for the spec author: **(i)** endpoint shape —
`POST /v1/pill-proposals/generate` (sub-resource action; output *is* proposals — **recommended**) vs.
a distinct `POST /v1/pill-generations` resource; **(ii)** response shape — the batch wrapper
`{generation_batch_id, count, tasks[]}` (**recommended**) vs. a bare `Page[PillProposalResponse]`;
**(iii)** mint a **new AC-CD** recording the generation API contract (mirroring AC-CD6's REST/envelope
conventions), and whether the **Path-3 signal-write endpoints** (Stage B) ride the same AC-CD or a
separate one. **Blocks A4 execution** (the endpoint + its AC-CD are the contract). *(Inherits A1/A2/A3
holds — A4 exposes their output over HTTP.)*

### 4.4 Tests (AC-CD15 — integration, zero-network via stub provider)

1. **Happy path:** `POST /v1/pill-proposals/generate` as admin with a topic + `target_count=3` → `201`
   + `count==3` + 3 `tasks`; a follow-up `GET /v1/pill-proposals` lists the 3 (queue reuse). Stub
   provider, no network.
2. **Authz:** non-admin (testee) → `403` (envelope shape); unauthenticated → `401`.
3. **Validation:** `target_count` out of bounds → `422`; `available_difficulty_min > max` → `422`
   (the `_DifficultyRange` validator); empty topic → `422`. All via the AC-CD6 uniform envelope.
4. **Thin-router guard:** the endpoint calls `enqueue_pill_generation` and commits — no business logic
   in the router (AC-CD2); the batch `generation_batch_id` round-trips into the task payloads.

**Acceptance:** the tests pass under the three-layer green gate; the **`codegen-drift`** check passes
**only after** A4 regenerates **and commits** `frontend/openapi/schema.json` + `frontend/src/types/
api.d.ts` from the new endpoint/schemas (per §4.5 / S4-1); structure-gate passes.

### 4.5 Scope fence

Thin router + two new schemas only. Reuses `enqueue_pill_generation` (A3), `_require_admin` (AC-CD5),
the AC-CD6 envelope, and the existing `GET /v1/pill-proposals` queue — **unchanged**. **One
`frontend/` codegen artifact is touched (auditor S4-1):** A4 **regenerates and commits** the committed
OpenAPI snapshot `frontend/openapi/schema.json` + the generated FE types `frontend/src/types/api.d.ts`
— a **mechanical codegen consequence** of the new endpoint, **required** by the `codegen:check`
(`frontend/package.json:20`) / `codegen-drift` (`frontend.yml:31`) gate, which `diff -q`-fails on any
drift; `api.d.ts` is auto-generated ("Do not make direct changes"), so this is a regen, not a hand
edit. It adds **no FE component/feature** — that is Slice 5 (A5). Otherwise: **no** domain/prompt/
persistence change, **no** Path-3 endpoints (Stage B/C), **no** migration. The refiner endpoint `POST
/v1/pill-proposals` is untouched (recommended-direction keeps the refiner).

### 4.6 Reviewer findings folded — Slice 4 (set-diff record; role files §6)

Round 1 folded; none dropped; none a halt-class condition. Set-diff `0 dropped / 1 added [S4-1]`.

| ID | Reviewer | Tag | Resolution |
|---|---|---|---|
| **S4-1** | auditor | Refine | §4.5 fence said "No FE," but a new endpoint changes the backend OpenAPI and the FE contract (`frontend/src/types/api.d.ts` + `frontend/openapi/schema.json`) is a **committed generated artifact** gated by `codegen:check` (`package.json:20`) / `codegen-drift` (`frontend.yml:31`) — `diff -q`-fails on drift. **Folded:** §4.5 now names the **regenerate-and-commit** of the two codegen artifacts as the one `frontend/` touch (mechanical codegen consequence, required by the gate), distinct from "no FE component/feature" (= A5); §4.4 acceptance made explicit the check passes only after committing the regen. Verified the scripts + artifacts live. Not gating — build was right, the fence just mis-stated the file boundary. |

Auditor S4-P1…S4-P11 otherwise Confirms (G6 well-surfaced; every §4.1 cite verified). Round-trips:
**S4-1 → 1/5**.

---

## Slice 5 (A5, FE) — admin "generate pills from a topic" surface

**Status: final for Slice 5 — approved by planner** (content-bound §5 @ `d15a8c2`; auditor S5-1 RESOLVED + content seal + overseer governance re-seal; all three bind §5@`d15a8c2`. Content-invariant marker — §5.1–§5.6 byte-identical. **Closes Stage A** — Path-2 generator A1–A5 content-complete.)

**Execution-gate (Gate 2): BLOCKED pending the inherited holds (A1 G1/G7, A2 G4a/G4b/G7(7b), A3 G3,
A4 G6 — A5 is the FE over A4's endpoint) plus A5's own gate G8 (FE scope: is this surface in *this*
workstream or a follow-up FE-N phase?) and its fe-spec amendment. Detail-planning is not gated.**
Written **against the recommended direction**: a "Generate pills" entry on the **existing** admin
catalogue proposals tab — a form (topic + subject + count + difficulty) calling A4's `POST
/v1/pill-proposals/generate`; the N drafts then render in the **existing** proposals queue (built).
**Closes Stage A.**

**Implements:** the admin entry point for Path-2 generation. The proposals queue that displays the
resulting drafts already exists (`proposals-tab.tsx`); A5 adds only the **generate-entry form +
mutation**. FE phase, governed by AC-CD20–24.

### 5.1 Grounding (verified against the tree at this SHA)

- **The results surface already exists.** `frontend/src/app/(authed)/(admin)/admin/catalogue/
  _components/proposals-tab.tsx` renders the proposal queue (status filter, table, drawer,
  approve/reject) generically over `payload` (`parseProposalPayload`). **A4's generated drafts land
  here unchanged** (they persist under `PROPOSAL_TASK_NAME`, A3). A5 adds the **input** surface only.
- **Query/mutation conventions (AC-CD21).** `frontend/src/lib/queries/admin-proposals.ts` —
  `useAdminPillProposals` (`adminKeys.proposals.list`), `useApproveProposal`/`useRejectProposal`
  mutations; types come from the **generated** `components["schemas"][...]` (`api.d.ts`). A5 adds a
  `useGeneratePills` mutation against A4's `PillGenerationCreate`/`PillGenerationBatchResponse`
  (available once A4's codegen lands — A5 depends on A4).
- **Catalogue surface shape.** `admin/catalogue/page.tsx` + `catalogue-shell.tsx` host the tabs;
  `pill-modal.tsx` is the existing form-in-a-modal pattern to mirror for the generate form.
- **Spec home.** The admin catalogue surface is spec'd in `fe-specs/FE-8-admin-catalogue.md`; it has
  **no "generate from topic" surface today** (grep: only a static title mention). Adding it is an
  **fe-spec amendment** (overseer pre-registered OV-S5.6) → rides G8.
- **FE anchors:** routing/admin-guard **AC-CD20** (`CODE_SPEC.md:952`), query+form+error-envelope
  **AC-CD21** (`:1008`), theme/primitives **AC-CD23** (`:1129`); visual-content deferral **AC-CD24**
  (N/A — no images here).

### 5.2 Build choices — concrete (recommended direction)

**(a) Generate-entry form** on the proposals tab — a "Generate pills" button opening a form
(mirroring `pill-modal.tsx`): fields `topic` (textarea), `subject` (select), `target_count` (number,
bounded), difficulty min/max. Per **AC-CD21** form pattern + error-envelope display.

**(b) `useGeneratePills` mutation** (`admin-proposals.ts`) — `POST /v1/pill-proposals/generate` (A4)
via `openapi-fetch` + `unwrap()`; typed by the generated `PillGenerationCreate` /
`PillGenerationBatchResponse`. **On success: invalidate `adminKeys.proposals.all()`** — matching the
sibling mutations `useApproveProposal` (`admin-proposals.ts:75`) and `useRejectProposal` (`:90`) and
the §C.1 cross-resource lock (the `.all()` family, not the narrower `.list` — it also covers any
`proposals.*` count/badge query that should refresh after generating N drafts; auditor S5-1) so the N
new drafts appear in the queue; toast "N drafts generated."

**(c) Admin-guard + routing** per **AC-CD20** (the surface lives under the existing
`(admin)/admin/catalogue` route group — already guarded). No new route.

**(d) Reuse the queue for results** — no new display surface; the drafts render in the existing
proposals table/drawer.

### 5.3 Embedded ratification-class item — SURFACED (blocking A5 execution, Gate 2)

**G8 — FE scope.** Class (iii) (scope decision) + an **fe-spec amendment** (class (ii), `fe-specs/
FE-8-admin-catalogue.md`). Does the admin "generate from topic" surface ship in **this workstream**
(as A5, closing Stage A — **recommended**, since the generator is admin-unusable without an entry
surface) or as a **follow-up FE-N phase**? And the fe-spec amendment adding the surface to FE-8 is
spec-author-authored (overseer OV-S5.6). **Blocks A5 execution.** *(Inherits A1–A4 holds — A5 is the
FE over the full A1–A4 stack.)*

### 5.4 Tests (FE — vitest per AC-CD21, no network)

1. **Form render/validate:** the generate form renders its fields; `target_count` bounds +
   difficulty min≤max validate; submit disabled until valid.
2. **Mutation + invalidation:** a mocked `POST /v1/pill-proposals/generate` success invalidates
   `adminKeys.proposals.all()` (the queue refetches) + toasts the count; the drafts appear in the table.
3. **Error-envelope display:** a mocked AC-CD6 error envelope renders via the AC-CD21 error path (no
   crash; field/form error shown).
4. **Admin-guard:** the surface is within the guarded `(admin)` group (AC-CD20).

**Acceptance:** vitest + eslint + prettier + tsc + build green (the `frontend.yml` `checks` job);
**codegen-drift** green (A5 consumes A4's already-committed types — no new schema). E2E (`[skip e2e]`
where applicable).

### 5.5 Scope fence

FE only — generate form + `useGeneratePills` mutation + wiring into the existing proposals tab.
Reuses the proposals queue display, `openapi-fetch`/`unwrap()`, AC-CD20–23 patterns — **unchanged**.
Consumes A4's endpoint + committed generated types (depends on A4). **No** backend change, **no** new
route, **no** new display surface, **no** images (AC-CD24). The fe-spec (FE-8) amendment adding the
surface is the **spec author's** PR (rides G8), not this executor slice. **Closes Stage A.**

### 5.6 Reviewer findings folded — Slice 5 (set-diff record; role files §6)

Round 1 folded; none dropped; none a halt-class condition. Set-diff `0 dropped / 1 added [S5-1]`.

| ID | Reviewer | Tag | Resolution |
|---|---|---|---|
| **S5-1** | auditor | Refine | §5.2(b) cited `adminKeys.proposals.list` for invalidation, but the module idiom (and the §C.1 cross-resource lock A5 cites) is `adminKeys.proposals.all()` — `useApproveProposal:75` + `useRejectProposal:90`. **Folded:** §5.2(b) + §5.4 test 2 now use `.all()`, matching the siblings (covers any `proposals.*` count/badge too). Verified against the live module. Minor/transportability. |

Auditor S5-P1…S5-P10 otherwise Confirms (G8 FE-scope + the FE-8 fe-spec amendment both correctly
surfaced; reuse faithful; closes Stage A). Overseer **SEALED Slice 5 governance @ `fa5f949`** (10
Confirms; this §5 fold re-stales it → re-verify pending). Round-trips: **S5-1 → 1/5**.

---

## Slice 6 (B1, Stage B) — discovery-search-miss signal capture

**Status: final for Slice 6 — approved by planner** (content-bound §6 @ `71bee47`; auditor S6-1 RESOLVED + overseer governance re-seal; bind §6@`71bee47`. Content-invariant marker — §6.1–§6.6 byte-identical.)

**Execution-gate (Gate 2): BLOCKED pending B1's gate G5 (signal-capture data model — new table +
SPEC §5 / AC-CD4 amendment + new AC-CD). Detail-planning is not gated.** **B1 is independent of the
Stage-A generator holds** — it captures a §6.5 input *signal* and uses no generator code (only C1,
Slice 8, ties signals to the generator). Written **against the recommended direction**: a dedicated
`discovery_search_miss` table + a write where the discovery filter already runs.

**Implements:** the first of the three §6.5 input signals (`SPEC.md:344` — *"recent Testee discovery
searches that returned no good match"*). Stops there: **no** other signals (B2/Slice 7), **no**
gap-detection (C1), **no** generator wiring.

### 6.1 Grounding (verified against the tree at this SHA)

- **The miss is detectable where the filter already runs.** `list_discoverable_pills` (`catalogue.py:
  261`) applies the `search` filter (`:283-289`, needle-in-name/description) then `paginate`s; the
  `discover_pills` endpoint (`catalogue.py:288`) is the sole caller. **Nothing persists a search that
  returned no/poor match today** — the function filters and returns (workstream §2.3 finding). A
  "miss" = `search` set **and** the filtered count is 0 (or below a poor-match threshold) *before*
  pagination — exactly at `:289`.
- **No signal store exists.** Grep of `app/models.py` for a discovery/search-signal table returns
  nothing; the only Testee-feedback precedent is `RealismFlag` (`models.py:801`, `Base,
  TimestampMixin`) — the shape to mirror.
- **Table conventions (AC-CD4, `CODE_SPEC.md:590`).** `Base, TimestampMixin`; `id = _pk()` (UUID);
  `tenant_id = _tenant_fk()` indexed; **"the first migration asserts table count (tested)"** — a new
  table updates that asserted count + needs an Alembic up/down migration.
- **§6.5 / SPEC §5.** §6.5 Inputs name this signal (`:344`); SPEC §5 is the entity catalogue a new
  table amends → G5.

### 6.2 Build choices — concrete (recommended direction)

**(a) New table `discovery_search_miss` (`app/models.py`) — deduped/aggregated, not per-event
(auditor S6-1).** `Base, TimestampMixin`; `id = _pk()`; `tenant_id = _tenant_fk()` (indexed);
`normalized_query: str` (lowercased/trimmed needle — the dedup key); `result_count: int` (matches at
last occurrence); `hit_count: int` (occurrences, incremented on upsert); `distinct_searcher_count` (or
include `searcher_id` in the key) so C1 can weight by **distinct** searchers, not raw events;
`last_seen_at: datetime`; optional filter context (`subject_id`, `difficulty`); `consumed_at: datetime
| None` (C1 consume/decay — Slice 8). **Crucially mirrors `RealismFlag`'s *defining* feature** — its
`UniqueConstraint("question_id","testee_id")` (`models.py:805`), one row per logical signal, **not**
per event: `__table_args__ = (UniqueConstraint("tenant_id", "normalized_query", name="uq_discovery_
search_miss"),)`. Indexed on `tenant_id` + `last_seen_at` (recency queries by C1).

**(b) Write point — in `list_discoverable_pills` (`catalogue.py:289`), pre-paginate.** When `search`
is set **and** the filtered count ≤ the poor-match threshold (recommend **0** at v1; a "few" threshold
is a G5 tuning knob), **upsert** the `discovery_search_miss` row keyed on `(tenant_id,
normalized_query)`: on conflict **increment `hit_count`**, bump `last_seen_at`, refresh `result_count`
(and the distinct-searcher count) — **not** a per-event insert (so a repeat-searcher or a popular
missing topic bounds to one row + a count, instead of flooding the table and skewing C1's demand
signal — auditor S6-1). Fail-soft: a signal-write error never breaks discovery (best-effort capture).
Domain-layer (thin router unchanged, AC-CD2).

**(c) Migration.** New Alembic migration (real up/down per the migration discipline); the
first-migration table-count assertion test updates (AC-CD4). One table, no backfill.

**(d) Retention.** Bounded — rows are consumed by C1 (marked `consumed_at`) or decay on a window; the
exact retention/decay policy is a **G5** data-model question (the dedup/decay mechanism is C1's, but
the *column* to support it lands here).

### 6.3 Embedded ratification-class item — SURFACED (blocking B1 execution, Gate 2)

**G5 — signal-capture data model.** Class (ii) (SPEC §5 / AC-CD4 data-model amendment) + a new
AC-CD. Decisions: **(i)** the `discovery_search_miss` table shape (columns above) — including the
**dedup/aggregation contract** (the `UniqueConstraint` + upsert with `hit_count` /
distinct-searcher count, mirroring `RealismFlag`'s constraint — auditor S6-1; it *is* part of the
table shape, so it rides this G5 decision) — **and** whether the **three** §6.5 signals (this +
B2's question-tag + scope-clarification) are **separate tables** or **one polymorphic `gap_signal`
table** with a `signal_type` discriminator (a structural call that spans B1+B2 — **recommended:
decide once here** so B2 doesn't re-litigate); **(ii)** the poor-match
threshold (0 vs "few"); **(iii)** retention/decay + the `consumed_at` consume marker (supports C1
dedup); **(iv)** mint the **new AC-CD** for the signal-capture data model. **Blocks B1 execution**
(the table + the SPEC §5 / AC-CD4 amendment). *(G5 also gates B2 and C1 — it is the Stage-B/C
data-model spine; recommend ruling the table-shape question once, covering all three signals.)*

### 6.4 Tests (AC-CD15 — `app/domain/*` coverage + migration, zero-network)

1. **Miss captured + deduped:** a discovery call with `search` set + **0** matches upserts one
   `discovery_search_miss` row (normalized_query, result_count=0, hit_count=1); **the same miss
   repeated yields one row with `hit_count==2`** (not two rows) — the S6-1 dedup assertion.
2. **Hit not captured:** a search **with** matches inserts **no** row; a search with `search=None`
   inserts no row.
3. **Fail-soft:** a forced signal-write error does not break the discovery response (best-effort).
4. **Migration:** up/down clean; the table-count assertion test reflects the +1 table (AC-CD4).

**Acceptance:** tests pass under the three-layer green gate; the `migration-chain` job + the
table-count assertion pass; structure-gate passes.

### 6.5 Scope fence

The discovery-miss signal store + its write only. **No** B2 signals (question-tag / scope-clarification
— Slice 7), **no** gap-detection job (C1), **no** cron (C2), **no** generator wiring, **no** FE. The
discovery filter logic is otherwise unchanged (the write is additive + fail-soft). The SPEC §5 /
AC-CD4 amendment + new AC-CD are the **spec author's** PR (rides G5), not this executor slice.

### 6.6 Reviewer findings folded — Slice 6 (set-diff record; role files §6)

Round 1 folded; none dropped; none a halt-class condition. Set-diff `0 dropped / 1 added [S6-1]`.

| ID | Reviewer | Tag | Resolution |
|---|---|---|---|
| **S6-1** | auditor | Refine | B1 "mirrors `RealismFlag`" but copied only columns, not its defining **`UniqueConstraint` dedup** (`models.py:805`) — a per-event insert would **flood** the table + **skew** C1's demand signal (one user's 1000 retries ≈ a 1000-strong gap). **Folded:** §6.2(a) adds `UniqueConstraint(tenant_id, normalized_query)` + `hit_count`/`last_seen_at`/distinct-searcher columns; §6.2(b) write is now an **upsert** (increment `hit_count`, not per-event insert); §6.3 G5(i) folds the dedup/aggregation into the table-shape decision; §6.4 test 1 asserts dedup (repeat → `hit_count==2`, one row). Verified the precedent constraint. Not gating. |

Auditor S6-P1…S6-P10 otherwise Confirms (G5 well-surfaced incl. the decide-3-signal-shape-once point;
miss point + fail-soft + migration verified). Overseer **SEALED Slice 6 governance @ `3b89fc8`** (10
Confirms; this §6 fold re-stales it → re-verify pending). Round-trips: **S6-1 → 1/5**.

---

## Slice 7 (B2, Stage B) — question-tag + admin-scope-clarification signal capture

**Status: final for Slice 7 — approved by planner** (content-bound §7 @ `e2e0fb3`; auditor S7-1 RESOLVED + overseer OV-S7.11 RESOLVED + governance re-seal; bind §7@`e2e0fb3`. Content-invariant marker — §7.1–§7.6 byte-identical. **Completes Stage B** — all three §6.5 signals captured.)

**Execution-gate (Gate 2): BLOCKED pending G5 (the same signal-capture data model as B1 — B2 reuses
the table-shape decision, incl. the polymorphic-vs-separate-tables call). Detail-planning is not
gated.** **B2 is independent of the Stage-A generator holds** (capture-only). Written **against the
recommended direction**: two more §6.5 signals captured into the **same G5-decided store**, deduped
the same way B1 was (S6-1 precedent).

**Implements:** the remaining two §6.5 input signals (`SPEC.md:344`) — *"recent generated questions
and their pill tags"* (weak/uncategorised question pill-tags) and *"recent assignments where admin
manually clarified scope."* Stops there: **no** gap-detection (C1), **no** cron (C2), **no**
generator wiring.

### 7.1 Grounding (verified against the tree at this SHA)

- **Signal 2 (question-tag gap) derives from the weakness loop.** `weakness.py:138-139` produces
  `weak_pills` per attempt; generated questions carry pill tags. A "tag gap" = a recent question
  whose pill-tag is **weak** (repeatedly failed) or **uncategorised** (doesn't map cleanly to a
  catalogue pill). The capture point is the weakness/tagging path (post-grade).
- **Signal 3 (admin scope-clarification) has NO current mechanism.** `assignments.py` —
  `create_assignment` (`:100`) targets a pill/path; grep finds **no clarification/note field** on
  `Assignment` and no "clarify scope" action. So signal 3 needs a **new capture surface** (a
  clarification note/action on an assignment) before there is anything to capture — a real sub-gap
  (workstream §4.1). This is the least-built of the three signals.
- **Shared store (G5).** B1's `discovery_search_miss` + its `UniqueConstraint`/upsert dedup (S6-1)
  set the pattern; G5's open question is whether the three signals are **separate tables** or **one
  polymorphic `gap_signal`** — **B2 is the slice that pays for re-litigating it if G5 isn't ruled as
  one table-shape decision** (the reason §6.3 recommended deciding once).

### 7.2 Build choices — concrete (recommended direction)

**(a) Signal 2 — question-tag-gap capture.** At the post-grade weakness/tagging path, when a
question's pill-tag is weak (failed past a threshold) or uncategorised, **upsert** a signal keyed on
the (normalized) tag/pill — `hit_count`/`last_seen_at`/distinct-context, **same dedup contract as
B1** (S6-1). Fail-soft; domain-layer.

**(b) Signal 3 — admin scope-clarification capture.** Add the **capture surface** (none today): an
optional clarification note on an assignment (a field + the admin action that sets it), and on set,
**upsert** a scope-clarification signal (the clarification text + the assignment's pill/path context).
**This mechanism is a *new admin feature*, not merely a G5 column (auditor S7-1):** a field **+ an
admin action** on `Assignment`, exposed on the live `/v1/assignments` API (`api.d.ts:783`) + an admin
FE control. Two consequences it carries: **(1) codegen-drift** — the new field/action regenerates
`frontend/openapi/schema.json` + `frontend/src/types/api.d.ts` or `codegen:check` fails (the **S4-1**
lesson; named in §7.5); **(2) feature-scope** — it is an admin *capability* on the assignment surface,
so it gets its **own scope sub-decision** (build-in-this-workstream vs prerequisite/follow-up,
**parallel to G8's FE-scope**), surfaced in §7.3 — **not** silently folded into "G5 data model."

**(c) Shared store + dedup.** Both signals land in the **G5-decided** store (separate tables or the
polymorphic `gap_signal` with `signal_type`), each with B1's `UniqueConstraint`+upsert dedup
(`hit_count`, distinct-context) so C1 gets count-weighted, non-flooding signals.

**(d) Migration.** Whatever tables/columns G5 rules (incl. the assignment-clarification field) →
Alembic up/down + the table-count assertion (AC-CD4).

### 7.3 Embedded ratification-class item — SURFACED (blocking B2 execution, Gate 2)

**Two distinct surfaced items (auditor S7-1 — don't conflate the data model with the feature):**

- **G5 (shared with B1) — the signal-store data model.** Class (ii) (SPEC §5 / AC-CD4). Beyond B1's
  decisions: **(i)** does the G5 store hold all three signals (the polymorphic-vs-separate call —
  **must be ruled here at the latest**, since B2 is the second writer); **(ii)** signal-2's
  weak/uncategorised threshold + tag-normalisation. *(No new G-letter — G5's B2 extension; the spec
  author rules the full signal data model once.)*
- **Signal-3 admin-feature scope — a *distinct* scope sub-decision, parallel to G8 (auditor S7-1).**
  Signal 3 is categorically unlike signals 1–2: it requires **building the admin feature that
  generates the signal** — a clarification field **+ admin action** on `Assignment` (`models.py:339`
  has none today), exposed on the live `/v1/assignments` API (`api.d.ts:783`) + an admin FE control.
  That is a **feature**, not a data-model column: **(a)** scope — build the assignment
  scope-clarification feature **in this workstream** or treat it as a **prerequisite/follow-up**?
  (parallel to G8's FE-scope, **not** a G5 addendum); **(b)** it carries the **S4-1 codegen-drift**
  consequence (regen + commit `frontend/openapi/schema.json` + `api.d.ts` — §7.5). **Blocks B2
  execution** (signals 1–2 can proceed under G5; signal-3 additionally needs this feature ruling).

### 7.4 Tests (AC-CD15 — `app/domain/*` + migration, zero-network)

1. **Signal 2 captured + deduped:** a weak/uncategorised question-tag upserts one signal row;
   repeated → `hit_count` increments (one row), per the B1/S6-1 dedup contract.
2. **Signal 3 captured:** setting an assignment scope-clarification upserts a scope-clarification
   signal with the clarification text + pill/path context.
3. **Fail-soft:** a signal-write error never breaks grading / the assignment action.
4. **Migration:** up/down clean; table-count assertion reflects the G5-ruled tables/columns (AC-CD4).

**Acceptance:** tests pass under the three-layer green gate; `migration-chain` + table-count assertion
pass; structure-gate passes.

### 7.5 Scope fence

The two remaining §6.5 signal captures + (for signal 3, **if its feature is ruled in-scope**) the
assignment-clarification capture surface only. **No** gap-detection job (C1), **no** cron (C2), **no**
generator wiring. **Signal-3's feature, if in-scope, touches `frontend/` codegen** — its
`/v1/assignments` field/action regenerates `frontend/openapi/schema.json` + `frontend/src/types/
api.d.ts` (regenerate **and commit**, or `codegen:check` fails — the **S4-1** lesson) + a minimal
admin FE control; signals 1–2 add **no** FE. Reuses B1's dedup contract + the G5 store. The SPEC §5 /
AC-CD4 amendment is the **spec author's** PR (rides G5); signal-3's feature scope is its own ruling
(§7.3).

### 7.6 Reviewer findings folded — Slice 7 (set-diff record; role files §6)

Round 1 folded; none dropped; none a halt-class condition. Set-diff `0 dropped / 1 added [S7-1]`.

| ID | Reviewer | Tag | Resolution |
|---|---|---|---|
| **S7-1** | auditor | Refine | Signal-3's clarification mechanism is a **new admin feature** (a field + action on `Assignment` `models.py:339`, on the live `/v1/assignments` API `api.d.ts:783` + an FE control), not just a G5 column — I'd under-represented it by folding it into "G5 data model." **Folded:** §7.2(b) now names it a feature carrying (1) **codegen-drift** (regen+commit `schema.json`+`api.d.ts`, the S4-1 lesson) and (2) a **distinct feature-scope** decision; §7.3 splits it **out of G5** into its own scope sub-decision **parallel to G8** (G5 keeps only the signal-store data model); §7.5 names the codegen artifacts. Signals 1–2 proceed under G5; signal-3 additionally needs the feature ruling. |

Auditor S7-P1…S7-P10 otherwise Confirms (B2 correctly **reuses** B1's G5 shape + S6-1 dedup, no
re-litigation; capture-only; completes Stage B). Overseer **SEALED Slice 7 governance @ `9e1a973`** (10
Confirms; this §7 fold re-stales it → re-verify pending). Round-trips: **S7-1 → 1/5**.

---

## Slice 8 (C1, Stage C) — gap-detection job (signals → topics → generator) + dedup/idempotency

**Status: final for Slice 8 — approved by planner** (content-bound §8 @ `9e6775d`; auditor S8-1 RESOLVED + overseer OV-S8.4 RESOLVED + governance seal; bind §8@`9e6775d`. Content-invariant marker — §8.1–§8.6 byte-identical. The gap-detection job + 3-arm dedup that closes the Path-3⇒Path-2 dependency.)

**Execution-gate (Gate 2): BLOCKED pending G2 (the §6.5 amendment separating signal-analysis from
generation — C1 *is* the signal-analysis half) + G5 (the signal store + dedup columns) + the inherited
Stage-A generator holds. **C1 calls the A3 *domain function* `enqueue_pill_generation` directly,
bypassing the A4 HTTP endpoint — so it inherits A1 G1/G7, A2 G4a/G4b/G7(7b), A3 G3, but NOT A4/G6**
(the endpoint contract; overseer OV-S8.4). Detail-planning is not gated.** **This is the slice that closes the
Path-3-on-Path-2 dependency** (workstream §5). Written **against the recommended direction**: a domain
sweep job reading the deduped Stage-B signals, clustering them into gap topics, and invoking the
Stage-A generator — with **first-class dedup/idempotency** (the merged-plan §4.2 requirement).

**Implements:** the §6.5 signal-analysis half — *"analyses recent test generation + Testee behaviour
to surface coverage gaps"* and emits proposals **with no admin prompt**. Stops there: **no** cron
registration (C2/Slice 9 — this slice is the *job*, that slice is the *schedule*), **no** new signal
capture (B1/B2), **no** generator internals (A3).

### 8.1 Grounding (verified against the tree at this SHA)

- **Domain sweep-job pattern to mirror.** `run_calibration_sweep(db)` (`calibration.py:951`),
  `aggregate_realism_flags(db)` (`drive_rag.py:965`), `run_engagement_sweep(...)`
  (`engagement.py:355`) — each an `async def …(db) -> dict[str, Any]` returning telemetry, invoked by
  a beat task. C1's `run_gap_detection_sweep(db)` mirrors this; **its beat registration is C2** (the
  "eighth cron" — Slice 9, deliberately separate, since adding it breaks the seven-crons invariant).
- **Dedup arm targets exist.** Live catalogue = `list_pills` (`catalogue.py:189`); open/pending
  proposals = `ProcessingTask` rows with `task_name == PROPOSAL_TASK_NAME` (`catalogue.py:45`) +
  `status == pending`. The third arm (already-rejected/admin-dismissed gaps) has **no durable
  gap-keyed store today** — rejections live per-`ProcessingTask` (`reject_pill_proposal`), not
  gap-keyed → C1 needs a durable rejected-gap suppression (rides G5).
- **The generator primitive (A3).** `enqueue_pill_generation(db, *, topic, …)` (Slice 3) is the
  call C1 makes per surviving gap topic — the structural reason C1 depends on Stage A.
- **The authoritative dedup requirement is already locked in the merged plan §4.2** (workstream
  `…workstream.md:186-198`, folding auditor A-2 + A-2r): three dedup arms + per-signal consume/decay
  + durable gap-keyed rejection + a materially-stronger-evidence re-surface threshold carrying a
  "previously rejected" marker. C1's detail **implements that locked requirement**, it does not
  re-decide it.

### 8.2 Build choices — concrete (recommended direction)

**(a) New domain job `run_gap_detection_sweep(db) -> dict` (`app/domain/<gap_detection>.py`).**
Mirrors the sweep-job shape; returns telemetry (signals read, topics clustered, proposals generated,
deduped-out by arm, signals consumed). New module → absorbable structural addition
(`SESSION_START.md` carve-out) folded into the handover.

**(b) Read + cluster signals → candidate gap topics.** Read the deduped Stage-B G5 signals
(count-weighted by `hit_count`/distinct-searcher), cluster into candidate *topics* (e.g. by
normalized-query/tag similarity). The clustering mechanism is a build-design detail; each candidate
carries a **gap-key** (stable identity for dedup) + the cited evidence (the signal(s) + counts → the
A1/A2 `evidence_count`/`gap_signal`).

**(c) Three-arm dedup BEFORE generating (merged §4.2 — the heart of C1).** Drop a candidate gap if it
matches **(a)** the live catalogue, **(b)** an open/pending proposal (`PROPOSAL_TASK_NAME` +
`pending`), or **(c)** an already-rejected/admin-dismissed gap (the durable gap-keyed suppression —
new, rides G5). **The arms are heterogeneous and need a defined matching function (auditor S8-1):**
arm (c) is gap-key ↔ gap-key (clean), but (a)/(b) match the candidate gap-key against existing **pill
names** / **proposal drafts** (different shapes, never built from signals). **Recommended: make the
G5 gap-key shape *bidirectionally computable*** — derivable from a candidate topic **and** from an
existing pill/proposal — so all three arms reduce to a uniform gap-key ↔ gap-key comparison (else
each arm needs its own match-function + similarity threshold). This is §6.5-quality-critical and folds
into the **G5 gap-key shape decision** (§8.3). **Arm (a) pill-set is itself a sub-decision:**
`list_pills` (`catalogue.py:189`) **includes retired pills** (AC-D14) — a gap covered only by a
**retired** pill is arguably still an active gap, so arm (a) should match **active** pills, while a
retired-pill match is closer to arm (c)'s durable suppression (don't cold-re-propose what the admin
retired) — surfaced, not baked. **Durable rejection (A-2r):** a rejected gap is **not**
re-proposed merely because per-signal evidence decayed in — rejection is a *separate, gap-keyed*
suppression; the **one** exception is materially-stronger fresh evidence past a threshold, which
re-surfaces it **only** carrying a "previously rejected" marker (admin never re-evaluates cold).

**(d) Invoke the generator + consume signals.** For each surviving gap topic, call
`enqueue_pill_generation(db, topic=…, …)` (A3) with the cited gap signal; **mark the producing
signals consumed/decayed** (`consumed_at`, B1/B2) so they don't re-fire. **Idempotency:** a repeated
pass with no new signals generates nothing (the three arms + consume marking guarantee it).

### 8.3 Embedded ratification-class items — SURFACED (blocking C1 execution, Gate 2)

- **G2 — §6.5 amendment (signal-analysis vs generation).** Class (ii). §6.5 conflates signal-analysis
  and proposal-output; C1 is the signal-analysis half. Amend §6.5 to separate (a) capture / (b)
  gap-detection / (c) generation / (d) approval (the workstream §7 G2). **Blocks C1 execution.**
- **G5 (extended) — the durable rejected-gap suppression store + the bidirectional gap-key.** Class
  (ii) (data-model). Two parts: **(1)** arm (c) needs a gap-keyed rejection store that doesn't exist
  today (rejections are per-`ProcessingTask` `reject_pill_proposal:616`, not gap-keyed) → a new
  column/table on the G5 spine + the re-surface threshold; **(2)** the **gap-key shape must be
  *bidirectionally computable*** — derivable from a candidate topic **and** from an existing
  pill/proposal — so the three heterogeneous dedup arms reduce to a uniform gap-key ↔ gap-key
  comparison (else each arm needs an explicit match-function + similarity threshold) — the
  §6.5-quality-critical decision (auditor S8-1), plus the arm-(a) retired-pill question (§8.2c).
  **Blocks C1 execution.**
- *(Inherits the Stage-A **domain** holds — C1 calls the A3 domain fn `enqueue_pill_generation`, so
  A1 G1/G7, A2 G4, A3 G3 gate C1 transitively; **A4/G6 does NOT** — C1 bypasses the HTTP endpoint
  (overseer OV-S8.4).)*

### 8.4 Tests (AC-CD15 — `app/domain/*` near-full coverage, zero-network)

1. **Signals → generation:** with seeded Stage-B signals and a stub provider,
   `run_gap_detection_sweep` clusters and calls `enqueue_pill_generation` once per surviving gap;
   telemetry counts match.
2. **Three-arm dedup:** a gap already in the catalogue / an open pending proposal / a rejected-gap is
   **not** generated (one assertion per arm).
3. **Consume + idempotency:** producing signals are marked `consumed_at`; a **second** pass with no
   new signals generates **nothing** (the idempotency core).
4. **Durable rejection (A-2r):** a rejected gap is not re-proposed on a later pass with merely-decayed
   evidence; it **re-surfaces only** past the stronger-evidence threshold, carrying the "previously
   rejected" marker.
5. **Zero-network:** all via the stub `pill_generation` path; no real provider.

**Acceptance:** tests pass under the three-layer green gate; structure-gate passes (new domain module
absorbable); any new dedup column/table migration up/down + table-count assertion (AC-CD4) pass.

### 8.5 Scope fence

The gap-detection **job** + its dedup only. **No** beat/cron registration (C2 — the eighth-cron
mirror-sweep is its own slice), **no** new signal capture (B1/B2), **no** generator internals (A3 owns
`enqueue_pill_generation`), **no** FE. Reads the G5 signal store; calls A3's enqueue. The §6.5 (G2) +
G5-rejection-store amendments are the **spec author's** PR.

### 8.6 Reviewer findings folded — Slice 8 (set-diff record; role files §6)

Round 1 folded; none dropped; none a halt-class condition. Set-diff `0 dropped / 2 added [S8-1, OV-S8.4]`.

| ID | Reviewer | Tag | Resolution |
|---|---|---|---|
| **S8-1** | auditor | Refine | The three dedup arms are **heterogeneous**: arm (c) is gap-key↔gap-key, but (a)/(b) match the candidate gap-key against pill names / proposal drafts (different shapes). **Folded:** §8.2(c) + §8.3 G5 now require the **gap-key be *bidirectionally computable*** (from a candidate topic AND an existing pill/proposal → all arms reduce to gap-key↔gap-key; else per-arm match-fn + threshold); + the arm-(a) **retired-pill** sub-question (`list_pills:189` includes retired → match active pills; retired-pill match ≈ durable suppression). |
| **OV-S8.4** | overseer | Refine | The transitive-hold **over-claimed A4/G6** — C1 calls the A3 **domain function** `enqueue_pill_generation` directly, **bypassing the A4 HTTP endpoint**. **Folded:** §8 header + §8.3 now inherit **A1 G1/G7, A2 G4, A3 G3 — not A4/G6** (the endpoint contract). |

Auditor S8-P1…S8-P12 / overseer Confirms: the A-2/A-2r dedup spine (3 arms, consume-vs-durable-rejection
distinction, re-surface marker, idempotency) is faithful + complete. Round-trips: **S8-1 → 1/5**,
**OV-S8.4 → 1/5**.

---

## Slice 9 (C2, Stage C) — eighth cron registration + "seven crons" mirror-sweep

**Status: Slice 9 (C2) — round-1 folded (S9-1 full 3-class crons grep; OV-S9.4 full transitive hold set); awaiting reviewer re-verify.**

**Execution-gate (Gate 2): BLOCKED pending G9 (the "seven → eight crons" spec amendment + mirror-sweep
— the direct parallel of Slice 1's "seven → eight AI operations"). Detail-planning is not gated.**
C2 registers C1's `run_gap_detection_sweep` as the **eighth** beat task; scheduling C1 means C2
**transitively inherits C1's full hold set** — G2, G5 (C1's own) **plus the Stage-A domain holds C1
carries: A1 G1/G7, A2 G4a/G4b/G7(7b), A3 G3** — but **not A4/G6** (C1 calls the A3 domain fn,
bypassing the endpoint — OV-S8.4 / OV-S9.4). Written **against the recommended direction**, with the
**Slice-1 lesson applied proactively**: completeness by reproducible grep across all phrasing classes
+ the construction-oracle floor, **not** by recall.

**Implements:** the autonomous trigger — schedules the gap-detection job so proposals surface with no
admin prompt. Stops there: **no** job logic (C1 owns it), **no** bootstrap-on-approve (D1).

### 9.1 Grounding (verified against the tree at this SHA) — the "seven crons" invariant

Adding the gap-detection cron makes an **eighth** beat task, colliding with a load-bearing **"seven
crons" count invariant** — the exact parallel of Slice 1's "seven AI operations" (and the
workstream-plan G9). Enumerated by reproducible grep (re-run at execution HEAD), **two classes**:

```
# (A) textual WORD — incl. entry/entries (the 'seven-entry' phrasing grep-A first missed), all trees
grep -rniE 'seven[- ](cron|scheduled|beat|entry|entries|task|§?8\.9)|(all|the|of|full) seven[- ](cron|task|entr|§?8\.9)' SPEC.md CODE_SPEC.md ROADMAP.md CHECKLIST.md SESSION_START.md app/ tests/ | grep -viE 'operation|prompt'
# (A2) textual NUMERAL — '7-cron','6/7', etc. (the third class S1-1 needed; classify each historical-vs-live)
grep -rniE '\b[678][- ]?(cron|scheduled|task|entr)|\b6/7\b' SPEC.md CODE_SPEC.md ROADMAP.md CHECKLIST.md SESSION_START.md app/ tests/ | grep -viE 'operation|prompt|§8 cron'
# (B) structural floors — beat_schedule dict + exact-count test floor (no 'seven' word), WIDENED to worker/tests
grep -rnE 'beat_schedule\b|_EXPECTED_ENTRIES|len\(beat_schedule\)|== 7' app/beat_schedule.py app/worker.py tests/
```

- **(A) — spec-side (ride the G9 amendment PR, spec-author-authored):** **SPEC §8.9** (enumerates the
  seven crons), `CODE_SPEC.md:110` (tree comment), `:337` (AC-CD7 prose), `:632` (AC-CD7 decision),
  `ROADMAP.md:193`/`:196`, `CHECKLIST.md:137` (the "Seven crons scheduled" row + its Evidence),
  `SESSION_START.md:338` (P11 phase-table "seven crons scheduled"). *(`SESSION_START.md:131` — "the
  PR-014 six→seven crons sweep" — is **historical precedent prose**, not a live count mirror; leave
  as-is.)*
- **(A) — code-side (ride C2 execution, in-body-override):** `app/beat_schedule.py:4` (module
  docstring), `app/worker.py:7` (*"full **seven-entry** schedule"* — a **different file location** from
  the wrappers; the "entry" phrasing grep-A first missed, auditor S9-1), `app/worker.py:42/153/170/188/205/223/242`
  ("the seven §8.9 crons" wrapper docstrings), **test prose** `tests/integration/test_p11_beat_schedule.py:1`
  (module docstring) + `:38` (comment) — beyond the floor logic at `:22`/`:36` (S9-1).
- **(A2) — numeral class (classified, S9-1):** `tests/e2e/test_worker_session_loop_isolation.py:3`
  (*"a 24h beat soak surfaced **6/7** scheduled tasks…"*) is **historical** (a past soak incident,
  like `SESSION_START.md:131`'s six→seven note) → **leave**, not a live count. *(`CODE_SPEC.md:726`
  "§8 cron" is a false positive — a §-reference, not a count.)*
- **(B) — structural floors (ride C2 execution; the construction oracle):** `app/beat_schedule.py:38`
  (`beat_schedule` dict — add the 8th entry); **`tests/integration/test_p11_beat_schedule.py:36`
  `test_beat_schedule_has_exactly_seven_entries` (`assert len(beat_schedule) == 7` + `_EXPECTED_ENTRIES`
  at `:22`)** — **fails-by-design when the 8th lands** (the construction oracle, exactly like Slice-1's
  `set(OP_TO_METHOD) == set(Operation)`); `::test_celery_app_registered_tasks_include_all_seven`;
  `tests/unit/test_p11_celery_wrappers.py` (7 wrapper smoke tests → 8); `tests/unit/test_worker_task_failure.py:3`.

### 9.2 Build choices — concrete (recommended direction)

**(a) Register the eighth cron.** Add a `gap_detection.sweep` entry to `beat_schedule` (`beat_schedule.py:38`)
with a sane cadence (e.g. daily off-peak, after the other daily crons) → its `task` = a new
`app/worker.py` wrapper that calls `run_gap_detection_sweep` (C1), mirroring the existing seven
wrappers (no autoretry, structured failure surfacing — the worker.py pattern); update
`_EXPECTED_ENTRIES` (`test_p11_beat_schedule.py:22`) + the `== 7`→`== 8` assertion + add the 8th
wrapper smoke test.

**(b) "Seven → eight crons" mirror-sweep** — exactly the §1.4 method: spec surfaces (A-spec) ride the
**G9 amendment PR**; code docstrings (A-code) + the test floors (B) ride C2 execution; the
construction oracle (`len(beat_schedule) == 7`) catches the code-side by construction. **Dissolves
nothing if G9=keep-seven** — but G9 is what *authorises* the eighth cron, so unlike G1's extend-branch
there is no "stay seven" build (the workstream needs the autonomous trigger).

### 9.3 Embedded ratification-class item — SURFACED (blocking C2 execution, Gate 2)

**G9 — "seven → eight crons" spec amendment + mirror-sweep.** Class (ii) (spec amendment) with
precedent (workstream §7 G9; the PR-014 six→seven sweep is the in-body-override precedent). Ruling:
amend SPEC §8.9 + the AC-CD7 / ROADMAP / CHECKLIST / SESSION_START mirrors (A-spec) to record the
eighth cron; the code/test floors (A-code + B) ride C2 execution. **Blocks C2 execution** (the
beat-schedule count + the SPEC §8.9 invariant). *(Transitively inherits C1's **full** hold set — G2,
G5 + the A1 G1/G7, A2 G4, A3 G3 domain holds C1 carries; **not** A4/G6 — C2 schedules C1, OV-S9.4.)*

### 9.4 Tests (AC-CD15 — zero-network)

1. **Eighth entry:** `beat_schedule` has **8** entries; `_EXPECTED_ENTRIES` + the count assertion
   updated; the new `gap_detection.sweep` entry has a valid `crontab` schedule + `task`.
2. **Wrapper:** the new worker wrapper calls `run_gap_detection_sweep` (mocked), carries no autoretry,
   writes no audit row on failure (the worker.py contract); +1 wrapper smoke test.
3. **Construction oracle:** confirm `test_beat_schedule_has_exactly_seven_entries` (renamed/retargeted
   to eight) + `test_celery_app_registered_tasks_include_all_eight` pass at the new count.

**Acceptance:** the three-layer green gate; the beat-schedule + celery-registry tests pass at eight;
structure-gate passes.

### 9.5 Scope fence

The eighth-cron registration + the "seven → eight" mirror-sweep only. **No** job logic (C1 owns
`run_gap_detection_sweep`), **no** bootstrap-on-approve (D1), **no** FE. The SPEC §8.9 / AC-CD7 /
ROADMAP / CHECKLIST / SESSION_START amendment is the **spec author's** G9 PR; the code docstrings +
test floors ride C2 execution.

### 9.6 Reviewer findings folded — Slice 9 (set-diff record; role files §6)

Round 1 folded; none dropped; none a halt-class condition. Set-diff `0 dropped / 1 added [S9-1]`.

| ID | Reviewer | Tag | Resolution |
|---|---|---|---|
| **S9-1** | auditor | Refine | I applied the S1-1 lesson but only **2** grep classes (word + structural) where S1-1's terminating shape needed **3** — and grep-A missed the "**entry**" phrasing — a partial-fold (the S1-1 failure in its mirror slice). **Folded:** §9.1 now carries the full **3 classes** — (A) word incl. `entry/entries`, (A2) **numeral**, (B) structural **widened** to `worker.py`/`tests/`. Added the missed surfaces: `worker.py:7` ("seven-entry", different file), `test_p11_beat_schedule.py:1`/`:38` (test prose beyond the floor); **classified** the numeral `test_worker_session_loop_isolation.py:3` ("6/7") **historical** (leave, like SESSION_START:131) + excluded the `CODE_SPEC:726` "§8 cron" false positive. Set now complete by the 3-class construction. |

| **OV-S9.4** | overseer | Refine | The transitive hold **under-listed** C1's domain holds — C2 schedules C1, so it inherits C1's own G2/G5 **plus** the Stage-A domain holds C1 carries (A1 G1/G7, A2 G4, A3 G3; not A4/G6 per OV-S8.4). **Folded:** §9 header + §9.3 now list the full transitive set. (OV-S9.6 — the 3-class crons sweep — RESOLVED: matched the overseer's pre-run set.) |

Auditor S9-P1…S9-P10 otherwise Confirms (the construction-oracle floor approach + C2-schedules-C1 split
+ G9 surface all correct); overseer OV-S9.6 resolved. Round-trips: **S9-1 → 1/5**, **OV-S9.4 → 1/5**.

---

*(Slice 10 (D1) detail section appends below once Slice 9 seals — slice-iterative, one PR throughout.
Appending it does **not** re-stale a sealed slice (§0.1, OV-S1.7). The global `Status: final —
approved by planner (all slices)` marker lands at the bottom after Slice 10 seals.)*

---

## Loop mechanics (role files §4–§8)

- **Watcher:** `counterpart-change-detector` skill, active iteration. `SELF_EXCLUDE` = **exact**
  `claude/dreamy-mccarthy-dAr4h`; `WATCH_INCLUDE` = the auditor's + overseer's branch ref-space —
  scoped to the **actual** reviewer branches once they appear (Acumen reviewer branches use
  `claude/<random>` naming, **not** role-named tokens — workstream-plan A-4/OV-2 lesson), backstopped
  by the broad new-ref arm + a manual pre-existing-ref `git ls-remote` scan at every (re-)arm. Tight
  poll cadence; proactive re-arm ~25 min; planner is the standing re-initiator and does not stand
  down on the dormancy bound (`REQUIRED_READING.md` §7).
- **On every wake:** `git ls-remote` + fetch + diff reviewer commits **and** read both reviewers' PR
  comments (watcher is comment-blind); verify each finding against the live text; fold or push back.
- **Each revision:** set-diff gate (role files §6) → commit the plan change → one wake-log line in
  the same commit (`plans/.wake-log-pr106-planner.md`, per-thread `X/5`).
- **Per-slice marker:** a `Status: final for Slice N` commit on this canonical branch + an approval
  comment, bound to **Slice N's section content** (not the raw branch-tip SHA — §0.1, OV-S1.7: a
  later-slice append does not re-stale a sealed slice; editing a sealed slice does). The **global**
  `Status: final — approved by planner (all slices)` lands after the last slice seals and is what
  Gate 1 merge binds to (the final whole-doc content-SHA).
- **Convergence — two gates (§0.2; do not conflate):** Gate 1 (this PR's normal-class merge) vs.
  Gate 2 (per-G-item authenticated ratification, downstream).
- The planner **never** flips draft→ready and **never** merges; stays subscribed through merge;
  stands down only on merge verified via `git ls-remote`.

## Out of scope (this PR)

- Authoring the spec-clarification / amendment PR(s) the G-rulings produce — the **spec author**
  authors those; a **fresh** session implements (`SESSION_START.md`).
- Flipping draft→ready or merging (the **overseer's** actions).
- Any code under `app/` or `frontend/` — this PR is `plans/**` only.
- Path 1 (manual Claude-in-chat → `POST /v1/pill-proposals`) — out of scope by ratified spec-author
  scope decision (§0.3).
