# Handover — A3 corpus refresh cron + retrieval helper

## PR identifier and link

- PR: #117 — "A3 — corpus retrieval helper + hybrid refresh cron (AC-CD25 / AC-CD7)"
- Link: https://github.com/jaydomains/acumen/pull/117
- Author / session: executor session, autonomous-content sequenced cycle (A1→F1)
- Date closed: 2026-06-12 (squash-merged to `main` @ `f0a59e8` by the code-overseer)

## Phase reference

- ROADMAP phase: **Autonomous content generation + retroactive oversight** (NS-5 workstream) — slice **A3** of 14.
- Fully closes the phase? **Partial** — A3 row only.

## What was built

- Files changed: `app/domain/corpus_builder.py` (retrieval + refresh fns), `app/worker.py` (`corpus_refresh_task`), `app/beat_schedule.py` (`corpus.refresh` entry + `drive_rag.ingest` removed), `app/ai/cost.py` (`corpus.retrieve` spend fold), `CHECKLIST.md`; tests `test_corpus_retrieval.py` (NEW), `test_p11_beat_schedule.py`, `test_p11_celery_wrappers.py`, `test_worker_task_failure.py`, `app/domain/engagement.py` (de-ordinalized cron prose).
- Summary: The retrieval half of Stage A + the hybrid refresh (ruling 6). `retrieve_corpus_for_topic` (cosine_top_k over `CorpusChunk`, authority-tagged, `min_tier`, fail-soft, query-embed cost-audit); `refresh_corpus_for_topic` / `refresh_corpus_all` (weekly backstop over active pills, per-pill fail-soft, id-keyed telemetry). The `corpus.refresh` weekly cron via the **net-0 beat-entry swap** (drive_rag.ingest → corpus.refresh) → seven registered.

## What was decided in this PR

- No anchors minted/amended (NORMAL class). Implemented against ratified AC-CD25 (retrieval) + AC-CD7/§8.9:525 (cron count).
- Existing anchors: AC-CD25, AC-CD7 (§8.9 nine-cron), AC-CD8 (cost), AC-D9 (catalogue), AC-CD15.

## Drift flags raised and how they were resolved

- **CA-A3-1 / OV-A3-11 (blocking) — cron-entry swap.** I built against the **pre-ratification detail-plan §3.6** ("drive_rag.ingest untouched at A3"), giving 7→8. The **ratified SPEC §8.9:525** requires the net-0 swap (remove drive_rag.ingest entry + add corpus.refresh → **seven registered**); 7→8 would hit ten after D4 with no numbered NS-1 slice to fix it. The overseer initially sealed 7→8 as "internally consistent" then self-corrected once the auditor flagged the spec-fidelity gap. **Resolved (r1):** removed the drive_rag.ingest beat entry → 7; the task wrapper + drive_rag.py + drive_chunk stay **dormant** for the separate NS-1 code-removal slice (§7.3). **Load-bearing lesson: verify-before-write against the *ratified/merged* spec, not the detail plan.**
- **CA-A3-2/3 (refresh robustness) — resolved (r2):** per-pill fail-soft (one topic's error can't abort the weekly backstop) + id-keyed telemetry (dup pill names don't collapse counts).

## Open questions deferred to a later phase

- **NS-1 Drive code removal** (`drive_rag.py` / `drive_chunk` / `google-api-python-client`) + the shared-primitive relocation (`chunk_document`/`content_hash`/`cosine_top_k`) — a **separate execution slice** (§7.3); the drive_rag.ingest task wrapper is dormant until then.
- DS3-a refresh-target set = active pills (kept distinct from the D3/NS-4 catalogue-health check).

## Build state vs spec

- Complete: retrieval helper + hybrid refresh + the cron swap (7 registered).
- Partial: canonical nine reached after D4 (+2 crons) + the NS-1 wrapper/code removal.

## Test coverage and CI results

- `test_corpus_retrieval.py` (9 tests: ranking/authority/min_tier/fail-soft/cost-audit + refresh iterate/fail-soft/dup-names); beat schedule 7 + weekly-Monday; wrapper.
- CI at merge: green (checks/migration-chain/docker-build/e2e/Gitar).

## Post-merge validation considerations

- No migration/container concern (domain + beat-schedule + cost code).
- Re-verify: `python -m pytest tests/unit/test_corpus_retrieval.py tests/integration/test_p11_beat_schedule.py -q`.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading: `plans/REQUIRED_READING.md`, `.claude/roles/planner.md`, detail plan §3 (A3) / §4 (B1).
- **Cron count:** built **seven** registered after A3; canonical **nine** (D4 +2; NS-1 removes the dormant drive_rag.ingest). The "seven registered" enumeration is §8.9:525.
- `retrieve_corpus_for_topic` is the **B2 grounding dependency**.
- Recommended next action: B1 — `Operation.pill_generation` mint (in flight on `claude/content-gen-b1-pill-generation-op`).
