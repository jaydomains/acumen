# AI pill generation + autonomous gap-detection — granular detail-plan (slice-iterative)

**Status: Slice 1 (A1) SEALED @ `18a719a` · Slice 2 (A2) — planner `final for Slice 2` marker posted (content-invariant @ §2/`30315fb`); auditor S2-1/S2-2 RESOLVED + overseer governance SEAL; both seal here → Slice 2 fully seals. Slice 3 (A3) next.** (Per-slice seals accumulate; the global `Status: final — approved by planner (all slices)` lands after Slice 10. Slice 1's in-slice marker + the reviewers' Slice-1 seals are content-bound to §1's section and are **not** re-staled by appending Slice 2 — §0.1/OV-S1.7.)

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

*(Slices 3–10 detail sections append below as each prior slice seals — slice-iterative, one PR
throughout. Appending a later slice does **not** re-stale a sealed slice (§0.1, OV-S1.7). The global
`Status: final — approved by planner (all slices)` marker lands at the bottom after Slice 10 seals.)*

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
