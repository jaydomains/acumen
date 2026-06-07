# AI pill generation + autonomous gap-detection — granular detail-plan (slice-iterative)

**Status: Slice 1 (A1) detail posted — awaiting plan-auditor + plan-overseer review**

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

**Status: Slice 1 (A1) detail posted — awaiting plan-auditor + plan-overseer review.**

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
  (`:418-427`).

**(c) Config field — `app/config.py`.**
Add `anthropic_model_pill_generation` (env-default, AC-CD18), sibling to
`anthropic_model_pill_proposal`, same default-model expression. One new `Settings` field; follows
the locked `anthropic_model_<op>` pattern — an **absorbable structural addition**
(`SESSION_START.md` structural-additions carve-out: structure-gate passes, well-rationalised against
AC-CD18) folded into the slice handover, **not** a separate spec PR. *(Surfaced for the overseer to
confirm the carve-out applies and is not silently a fourth ratification-class change.)*

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

### 1.4 Docs / mirror sweeps in A1's execution (forward-noted)

- `app/ai/prompts/README.md` — add the `pill_generation` registry row (registry contract is the
  authored truth; the README is a mirror — `SESSION_START.md` in-body-override rule).
- `.env.example` — add `ANTHROPIC_MODEL_PILL_GENERATION=` sibling to the existing
  `anthropic_model_*` examples (env-default discoverability, AC-CD18).
- No SPEC/DECISIONS/CODE_SPEC edit in A1 itself — the AC-CD8 anchor *body* change (recording the new
  op) is part of the **G1 spec-amendment PR** the spec author authors, **not** this executor slice
  (`SESSION_START.md` — implementer does not author the clarification).

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

---

*(Slices 2–10 detail sections append below as each prior slice seals — slice-iterative, one PR
throughout. The global `Status: final — approved by planner (all slices)` marker lands at the bottom
after Slice 10 seals.)*

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
  comment, bound to the SHA; the **global** `Status: final — approved by planner (all slices)` lands
  after the last slice seals.
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
