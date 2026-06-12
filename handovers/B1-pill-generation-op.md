# Handover — B1 Operation.pill_generation mint + provider/stub wiring

## PR identifier and link

- PR: #118 — "B1 — Operation.pill_generation mint + provider/stub wiring (AC-D29 / §6.8)"
- Link: https://github.com/jaydomains/acumen/pull/118
- Author / session: executor session, autonomous-content sequenced cycle (A1→F1)
- Date closed: 2026-06-12 (squash-merged to `main` @ `f346cc2` by the code-overseer)

> Cleanest slice so far — **first-round 0 findings** from the code-auditor + Gitar (the A3 lesson banked).

## Phase reference

- ROADMAP phase: **Autonomous content generation + retroactive oversight** (NS-5 workstream) — slice **B1** of 14 (start of Stage B).
- Fully closes the phase? **Partial** — B1 row only (the combined B1–B3 CHECKLIST row is now `partial`).

## What was built

- Files added: `app/ai/prompts/pill_generation.py`, `tests/unit/test_ai_pill_generation.py`
- Files changed: `app/ai/provider.py` (enum mint + routing + `_ANTHROPIC_DEFAULT_OPS` + stub helper/branch + `resolve_model` + docstrings), `app/ai/anthropic.py` (`_GENERATE_OPS` + `_MAX_OUTPUT_TOKENS`), `app/ai/cost.py` (`OP_TO_METHOD`), `app/ai/prompts/__init__.py` (`_REGISTRY` + docstring), `app/ai/prompts/README.md`, `app/config.py` + `.env.example` (`anthropic_model_pill_generation`), `tests/unit/test_p5_prompts.py` (`_REGISTERED_OPERATIONS`), `CHECKLIST.md`
- Summary: The autonomous generator AI primitive (AC-D29 / §6.8) — `Operation.pill_generation` minted, routed generate-family / Anthropic-default, with a versioned `pill_generation` prompt (v1.0.0, topic→N `drafts` schema) and a deterministic offline stub. Grounding + provenance are deferred to B2 (v1.1.0, G7b).

## What was decided in this PR

- No anchors minted/amended (NORMAL class). The ops-count seven→nine was already ratified by **PR-B** — B1 added the op + the **code** mirrors; SPEC/CODE_SPEC/DECISIONS unchanged (verified empty diff).
- Existing anchors: AC-D29 (generator), AC-CD8 (op enum/registry), AC-D12 (provider routing), AC-CD18 (env-default config), AC-CD15.

## Drift flags raised and how they were resolved

- None. Applying the A3 lesson, I built against the **merged v1.9 ops-count spec** (already nine), so B1 stayed NORMAL-class and finding-free.
- The construction-oracle test (`test_p5_prompts.registered_operations() == frozenset(_REGISTERED_OPERATIONS)`) fired as designed when `pill_generation` joined the registry — the expected oracle update, folded.

## Open questions deferred to a later phase

- **G7b version bump:** B2 bumps `pill_generation` to **v1.1.0** to add the `grounding_refs` output contract (corpus grounding). The persisted `prompt_version` then records which contract produced each draft.
- The `pill_proposal` refiner's ultimate fate as an "optional manual surface" is a Stage-E question (G7a — kept untouched here).

## Build state vs spec

- Complete: the `pill_generation` primitive (enum/provider/prompt/stub/maps/config) — the AI seam B2 grounds + B3 fans out.
- Partial (later slices): corpus grounding + provenance (B2); N-draft fan-out + persistence + cost-share (B3).

## Test coverage and CI results

- `tests/unit/test_ai_pill_generation.py` — 6 zero-network tests (schema/determinism, target-count clamp, safety self-classify, routing + the three construction-oracle floors, resolve_model/resolve_provider). 455/455 unit pass.
- CI at merge: green (checks/migration-chain/docker-build/e2e/Gitar).

## Post-merge validation considerations

- No migration/container concern (pure AI-seam code).
- Re-verify: `python -m pytest tests/unit/test_ai_pill_generation.py tests/unit/test_p5_prompts.py tests/unit/test_p5_resolve.py tests/unit/test_p5_cost.py -q`.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading: `plans/REQUIRED_READING.md`, `.claude/roles/planner.md`, detail plan §4 (B1) / §5 (B2).
- **B2 is where Stage A meets Stage B** — `generate_grounded_drafts` retrieves corpus (`retrieve_corpus_for_topic`, A3) → grounds the `pill_generation` call → writes the `GenerationProvenance` chain. It needs A2+A3+B1 merged (all are).
- **⚠️ Open B2 design question (surfaced to the spec author):** AC-D29 + SPEC:358 specify a **per-assertion** provenance chain (`claim_ref` = per-assertion id), but SPEC §6.8's v1.1.0 output contract is **`grounding_refs` = per-draft source_doc_refs** (no per-assertion decomposition). The provenance `claim_ref` shape + row cardinality + the v1.1.0 prompt-output schema depend on resolving this — do **not** bake it. See `plans/.wake-log-b2-executor.md`.
- The ops-count: canonical **nine**; built **eight** ops after B1 (`content_self_review` is the ninth, wired at C1). The count-words are now count-agnostic in code.
- Recommended next action: B2 — resolve the per-assertion/`grounding_refs` granularity question, then `GenerationProvenance` model + migration + `generate_grounded_drafts` + prompt v1.1.0.
