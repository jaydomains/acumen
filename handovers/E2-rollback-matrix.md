# Handover — E2 rollback matrix + AC-D21 override + `demoted_sources`

## PR identifier and link

- PR: #127 — "E2 — oversight rollback matrix + AC-D21 override + demoted_sources (AC-CD26 rollback half)"
- Link: https://github.com/jaydomains/acumen/pull/127
- Author / session: executor session, autonomous-content sequenced cycle (A1→F1)
- Branch: `claude/content-gen-e2-rollback-matrix` (off `main` @ `72624b6`, post-E1)

> Slice **13/14** — **Stage E completes** (the *rein-in* write half; E1 was the *observe* read half).

## Phase reference

- ROADMAP phase: **Autonomous content generation + retroactive oversight** (NS-5) — slice **E2**.
- Fully closes the phase? **No** — F1 (bootstrap-on-publish) remains.

## What was built

- **Migration `0013_e2_demoted_sources`** + **`DemotedSource` model** — the DS13-a DB source-override layer (one row per `(tenant_id, source_host)`; `denied` / `tier_override`). Reversible.
- **`source_authority` DB-override layer** — `effective_authority_tier` / `effective_is_allowlisted` / `denied_hosts` / `filter_demoted`: layer the `demoted_sources` overrides on top of the pure code seed. Wired into `corpus_builder.acquire_for_topic` (skips `denied` hosts → durable per-source rollback).
- **Rollback matrix** in `app/domain/oversight.py` (retract-not-delete, idempotent, audited `pill_generation.rollback_*`): `rollback_pill` (retire AC-D14), `rollback_question` (exclude `AnchorQuestion` AC-D23), `rollback_batch` (PublishRecord.batch_id join), `rollback_source` (per-item `draft_ref`→pill retract + durable `denied` demotion), `override_safety_relevant` (relocated AC-D21).
- **Admin-gated write router** in `app/routers/oversight.py` under `/v1/admin/oversight` (POST endpoints; explicit commits).

## What was decided in this PR

- **Migration-class** per the ratified **AC-CD26** (DS13-a option (i), OV-64) — the detail §13.4 "no new model" was the stale pre-ratification lean; the ratified anchor governs. **Spec-NORMAL** (empty anchor diff).
- **`rollback_question` → `AnchorQuestion.excluded`** — `Question` has no retire field; a generated pill's questions are its anchor pool; `excluded` is the purpose-built soft-retract (retract-not-delete). *Flagged for review.*
- **`rollback_source` per-item precision via `draft_ref`** (the CA-E1-2b payload resolution) — acceptable on an infrequent admin **write** (vs the read hot-path that deferred it), buys per-assertion precision over the batch-level join. *Flagged for review.*
- Host-key consistency: `rollback_source` matches provenance on `source_host` as-stored, demotes under `_normalise(host)` (the form the `effective_*` join + corpus skip read).

## Drift flags raised and how they were resolved

- **Verify-before-write catch (no drift):** detail §13.4 "no new model" vs the ratified AC-CD26 `demoted_sources` table — resolved in favour of the ratified anchor (migration-class), the recurring detail-vs-amendment-chain lesson. Confirmed by the overseer's E1-merge marker.
- Two implementation interpretations flagged for the reviewers (above); built the defensible reading rather than silently reconciling.

## Open questions deferred to a later phase

- The admin **FE** (`fe-specs/FE-10` §3 rollback actions) — deferred, gated on this backend.
- A relational `draft_ref`/`pill_id` on `PublishRecord` would give `rollback_source` a clean join (no payload scan) — a later persistence optimization (shared with the E1 CA-E1-2b note).

## Build state vs spec

- Complete: the AC-CD26 **rollback half** — the four-arm matrix + AC-D21 override + the DS13-a durable demotion.
- Partial (later): **bootstrap-on-publish** (F1, the FINAL slice).

## Test coverage and CI results

- `tests/unit/test_oversight_rollback.py` (6), `tests/unit/test_source_override.py` (5), `tests/integration/test_oversight_rollback_api.py` (4), `tests/e2e/test_demoted_sources.py` (real-Postgres override join), `tests/unit/test_p1_schema.py` (table-set + trigger-count 38→39 + `0013` round-trip).
- **1059 unit+integration pass**; ruff (0.6.9 CI-parity) / format / mypy / structure-gate / unpinned clean; anchor diff empty.

## Post-merge validation considerations

- Migration `0013` — the `migration-chain` CI job validates upgrade/downgrade; re-verify `alembic upgrade head` applies `demoted_sources`.
- The corpus-builder skip + `effective_*` join: re-verify a `denied` demotion actually removes a seed host from acquisition (the e2e covers the join; the acquisition skip is unit-covered via `filter_demoted`).

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading: `plans/REQUIRED_READING.md`, detail §14 (F1).
- Next is **F1** (slice 14/14, the FINAL slice, §14): **bootstrap-on-publish** (reframed AC-D7/AC-D23) — the incremental bootstrap (anchor pool + cross-provider self-review + safety-link curation) fires on **auto-publish** (C2) instead of admin-approve. Small, reuse-only; no new model.
- **F1 is the FINAL slice — do NOT auto-merge.** It requires **explicit spec-author authorization via the authenticated channel + an end-of-execution audit** before merge (the standing mandate). Build + post for review autonomously, but pause at the seal.
- **Verify-before-write against merged main, not the detail-plan body** — F1 has AC-D7 + AC-D23 body-change context (multi-slice [C2+F1] / [B2/C1+F1]); confirm the ratified anchors on main govern.
