# Handover — B2 corpus-grounded generation + per-assertion provenance chain

## PR identifier and link

- PR: #119 — "B2 — corpus-grounded generation + per-assertion provenance (AC-D29 / §6.8)"
- Link: https://github.com/jaydomains/acumen/pull/119
- Author / session: executor session, autonomous-content sequenced cycle (A1→F1)
- Date closed: 2026-06-12 (squash-merged to `main` @ `30cde56` by the code-overseer)

> Slice **5/14** — where Stage A's corpus meets Stage B's generator (the first A→B dependency binds).

## Phase reference

- ROADMAP phase: **Autonomous content generation + retroactive oversight** (NS-5 workstream) — slice **B2**.
- Fully closes the phase? **Partial** — the B1–B3 CHECKLIST row stayed `partial` at B2 (B3 then completed it).

## What was built

- Files added: `app/domain/generation.py`, `app/models.py` `GenerationProvenance`, `alembic/versions/0010_b2_generation_provenance.py`, `tests/unit/test_grounded_generation.py`.
- Files changed: `app/ai/prompts/pill_generation.py` (v1.0.0 → **v1.1.0**, G7b), `app/ai/provider.py` (stub emits structured grounding), `app/domain/corpus_builder.py` (`retrieve_corpus_for_topic` now returns `corpus_chunk_id`), `tests/unit/test_ai_pill_generation.py`, `tests/unit/test_p1_schema.py` (36 tables / 36 triggers), `CHECKLIST.md`.
- Summary: `generate_grounded_drafts` retrieves the reference corpus (A3), grounds the `pill_generation` call in it, and writes a **per-assertion provenance chain** — one `GenerationProvenance` row per (assertion, grounding-chunk), authority-stamped (AC-D28), indexed on `source_host`/`corpus_chunk_id`/`draft_ref` for the E2 rollback. Empty corpus → general-knowledge fallback (no rows).

## What was decided in this PR

- **Provenance granularity = Option-1 (per-assertion structured output)** — ratified by the spec author (authenticated, in-session): `grounding_refs` = `[{claim, source_doc_refs}]` per draft; `claim_ref` = per-assertion id; one row per (assertion, grounding-chunk) → the E2 per-source rollback is claim-precise.
- **§6.8 read as PERMISSIVE → no spec amendment** (the call delegated to the executor): §6.8 opens "Per AC-D29" (subordinate to AC-D29's per-assertion mandate); its `grounding_refs` gloss is *descriptive of what the field carries*, not a normative flat shape. Verified `git diff origin/main -- SPEC/CODE_SPEC/DECISIONS` **empty** → NORMAL class. The code-auditor + code-overseer **independently concurred** with the permissive reading.
- No new `Operation` (provenance is recorded by the generator); `batch_id` minted **nullable** (B3 populates it).

## Drift flags raised and how they were resolved

- **The per-assertion vs per-draft `grounding_refs` tension** (AC-D29 per-assertion vs §6.8's per-draft gloss) was **surfaced to the spec author**, not baked — ruled Option-1 + §6.8-permissive (above). Applying the A3 lesson: verified against the **merged** AC-D29/§6.8, not the detail plan.
- **Gitar (Approved-with-suggestions, 2 findings, both folded):** (1) a draft with non-empty `grounding_refs` whose refs byte-match no retrieved hit recorded zero provenance rows silently → added a `logger.warning` grounding-mismatch counter; (2) duplicate `source_doc_refs` in one claim wrote duplicate rows → `dict.fromkeys` de-dupe per claim. +2 regression tests. Non-blocking observability/correctness; no spec/design change.

## Open questions deferred to a later phase

- **DS2-b cross-source corroboration** is an **additive read** over `GenerationProvenance` rows (per-`claim_ref` count) — no schema change; exercised when C2 confidence needs it.
- The B3 `batch_id` seam: B3 extends `generate_grounded_drafts` (additively, `batch_id=None` default) to stamp the shared batch id on every provenance row.

## Build state vs spec

- Complete: the grounded-generation fn + the `GenerationProvenance` model/writer + migration + the v1.1.0 prompt contract.
- Partial (later slices): N-draft fan-out + `processing_tasks` persistence + cost-share + `batch_id`-populate (B3); self-review/confidence/auto-publish gate (C1–C2); per-source/per-batch rollback dashboard (E2 queries this table).

## Test coverage and CI results

- `tests/unit/test_grounded_generation.py` — 6 zero-network tests: per-assertion provenance (queryable by `source_host`/`draft_ref`, authority-stamped), empty-corpus fallback, determinism, the v1.1.0 bump, the grounding-mismatch WARN, the duplicate-ref de-dupe. 461/461 unit pass at merge.
- CI at merge: green (checks/migration-chain/docker-build/e2e/Gitar). 3 sign-offs (executor + auditor content-final + overseer governance-seal) + Gitar-green + mergeable=clean.

## Post-merge validation considerations

- Migration `0010` is additive (new `generation_provenance` table; up/down clean; `--sql` round-trip verified). No backfill.
- Re-verify: `python -m pytest tests/unit/test_grounded_generation.py tests/unit/test_p1_schema.py -q`.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading: `plans/REQUIRED_READING.md`, `.claude/roles/planner.md`, detail plan §5 (B2) / §6 (B3).
- **The B2/B3 seam:** B2 owns the provenance **model + writer + grounded-generation contract**; **B3** owns the N-draft fan-out, `ProcessingTask` N-row persistence, cost-share, and `batch_id`-populate. B3 reuses `generate_grounded_drafts` + the provenance writer.
- **Verify-before-write against the merged spec, not the detail plan** (the A3 lesson, re-confirmed at B2 with the §6.8 call). The detail plan's "surfaced, not baked" items are often **already ratified** in v1.9 on main (e.g. G3 = min/max-only, SPEC §6.8:390).
- Recommended next action: B3 — `enqueue_generated_drafts` (fan-out → N `processing_tasks` rows) + `batch_id` seam + `_pill_generation_spend` (AC-CD8) + `(topic, gap_signal)` idempotency; G3 stays min/max-only (ratified); NORMAL class, no migration.
