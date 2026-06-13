# Handover — E1 retroactive content-oversight dashboard READ API

## PR identifier and link

- PR: #126 — "E1 — retroactive content-oversight dashboard read API (AC-CD26 read half)"
- Link: https://github.com/jaydomains/acumen/pull/126
- Author / session: executor session, autonomous-content sequenced cycle (A1→F1)
- Branch: `claude/content-gen-e1-oversight-read` (off `main` @ `f5a4a80`, post-D4)

> Slice **12/14** — Stage E begins. The *observe* half of retroactive oversight; E2 is the *rein-in* (rollback).

## Phase reference

- ROADMAP phase: **Autonomous content generation + retroactive oversight** (NS-5) — slice **E1**.
- Fully closes the phase? **Partial** — E1 is the read surface; E2 (rollback matrix + `demoted_sources`) + F1 (bootstrap-on-publish) remain.

## What was built

- Files added: `app/domain/oversight.py`, `app/routers/oversight.py`, `tests/unit/test_oversight.py`, `tests/integration/test_oversight_api.py`. Modified: `app/main.py` (router wiring).
- **Five read facets** (AC-CD26 read half, admin-role-gated AC-CD5, thin-router→domain AC-CD2):
  - `recent_publishes(db, *, limit, offset, low_confidence, since, subject_id)` — newest-first, paginated, filtered; each row embeds confidence + the three AC-D30 verdicts + per-type telemetry + the retired (rolled-back) flag, plus `total` for the pager.
  - `item_provenance(db, *, pill_id)` — the claim→source→authority-tier chain, resolved via the generation task's `draft_ref` (per-assertion precision); empty for an ungrounded refiner publish.
  - `source_authority_breakdown(db)` — claims aggregated by `authority_tier` + `source_host` (the rein-in radar), `by_source` ordered by claim count desc.
  - `sample_for_spotcheck(db, *, n, bias, seed)` — deterministic, low-confidence-weighted (Efraimidis–Spirakis weighted reservoir, weight 4× on low-confidence under `bias="low_confidence"`).
- Endpoints under `/v1/admin/oversight`: `GET /publishes`, `GET /publishes/{pill_id}/provenance`, `GET /source-authority`, `GET /spot-check`.

## What was decided in this PR

- **NORMAL class** — AC-CD26 ratified on main (CODE_SPEC §AC-CD26, v1.9 PR-D); anchor diff empty. **No migration / no new persistence** (E1 reads `PublishRecord`/`GenerationProvenance`; E2 owns `demoted_sources`).
- **Read idiom = cost.py precedent:** bound the scan to the tenant in SQL, then filter/sort/paginate/aggregate in Python (the AC-CD15 in-memory fake ignores `ORDER BY`/`LIMIT`/range predicates; Python-side logic makes the read deterministic under both fake and real Postgres). Entities stitched via separate single-entity selects (no SQL join — the fake is single-entity).
- **Confidence facet folded into the publishes rows** (each carries score + 3 verdicts) rather than a separate endpoint — avoids redundancy; the rows *are* the confidence surface.

## Drift flags raised and how they were resolved

- **None spec-class.** One implementation note surfaced to the reviewers (not drift): per-**item** provenance precision is resolved via the generation `ProcessingTask` payload (`draft.draft_ref` ↔ `created_pill_id`), because `PublishRecord`↔`GenerationProvenance` share only `batch_id` (a batch fans out to N pills). The `draft_ref` path honors the AC-D29/NS-3 per-assertion intent. A future model could add a relational `draft_ref`/`pill_id` to `PublishRecord` for a clean join, but that is new persistence (out of E1 read-only scope) — noted for E2/later, not built here.

## Open questions deferred to a later phase

- The admin **FE** (`fe-specs/FE-10-admin-oversight.md` §2) — deferred, gated on this backend (E1) + FE-1..FE-9.
- A relational `draft_ref`/`pill_id` on `PublishRecord` (clean per-item provenance join) — a later persistence consideration, not E1.

## Build state vs spec

- Complete: the AC-CD26 **read half** — all five facets, admin-gated, zero-network.
- Partial (later): the **rollback matrix** + `demoted_sources` source-override (E2); **bootstrap-on-publish** (F1); the admin **FE** (FE-phase).

## Test coverage and CI results

- `tests/unit/test_oversight.py` — 10 zero-network domain tests (newest-first pagination, confidence/verdicts/subject embed, low_confidence + subject filters, provenance chain + empty-refiner case, breakdown by tier+host, spot-check determinism-under-seed + low-confidence over-sampling + empty/non-positive-n guards).
- `tests/integration/test_oversight_api.py` — 5 router tests (admin authz → Testee 403; paginated page + low_confidence filter; provenance chain; source-authority breakdown; seeded spot-check determinism + authz).
- Full unit+integration suite **1041 passed**; ruff / ruff-format / mypy / structure-gate / unpinned-deps all green; anchor diff (SPEC/CODE_SPEC/DECISIONS) empty.

## Post-merge validation considerations

- No migration. Re-verify: `python -m pytest tests/unit/test_oversight.py tests/integration/test_oversight_api.py -q`.
- The provenance resolution scans `pill_generation` `ProcessingTask`s and matches `created_pill_id` in the JSONB payload — confirm no perf concern at scale (single admin read; mirrors cost.py's audit scan).

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading: `plans/REQUIRED_READING.md`, detail §12 (E1) / §13 (E2).
- Next is **E2** (slice 13/14, §13): the **rollback matrix** (`rollback_pill` / `rollback_question` / `rollback_batch` / `rollback_source`) + the relocated AC-D21 `override_safety_relevant` + the **`demoted_sources`** DB source-override layer (DS13-a, completes AC-D28's [A1+E2] design — the **only new table/migration** in Stage E). Extends `app/domain/oversight.py` + `app/routers/oversight.py` (admin-gated writes); retract-not-delete (retire per AC-D14, audit per §290), idempotent.
- **Verify-before-write against merged main, not the detail-plan body** — AC-CD26 is ratified (CODE_SPEC); the rollback half + DS13-a (i) DB source-override layer govern. E2 IS a migration-class slice (the `demoted_sources` table) — unlike E1.
- After E2: **F1** (slice 14/14, FINAL — bootstrap-on-publish, AC-D7/AC-D23) — **PAUSE for explicit spec-author authorization + end-of-execution audit before merge.**
