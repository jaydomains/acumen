# Handover — A2 reference corpus builder

## PR identifier and link

- PR: #115 — "A2 — reference corpus builder: allowlist-restricted acquisition + CorpusChunk store"
- Link: https://github.com/jaydomains/acumen/pull/115
- Author / session: executor session, autonomous-content-generation sequenced cycle (A1→F1)
- Date closed: 2026-06-12 (squash-merged to `main` @ `2588f39` by the code-overseer)

> The longest cycle so far — see "Drift flags" for the SSRF + cosine/amendment saga.

## Phase reference

- ROADMAP phase: **Autonomous content generation + retroactive oversight** (named non-phase workstream, NS-5) — slice **A2** of 14.
- Fully closes the phase? **Partial** — closes the A2 row; A3…F1 remain.

## What was built

- Files added: `app/domain/corpus_builder.py`, `alembic/versions/0009_a2_corpus_chunk.py`, `tests/unit/test_corpus_builder.py`
- Files changed: `app/models.py` (`CorpusChunk`), `app/ai/cost.py` (`CorpusChunk` → `current_month_spend`), `tests/unit/test_p1_schema.py` (table set → 35; trigger count → 35), `CHECKLIST.md`
- Summary: The reference-corpus **acquisition** pipeline (AC-CD25): allowlist-restricted web search (A1 `filter_to_allowlist`) → per-source fetch (injectable httpx seam, fail-soft, **blind-SSRF-guarded**) → HTML/PDF extract (bs4/pypdf) → `chunk_document` → `content_hash` dedup → embed (`text-embedding-3-small`, OpenAI cost) → persist `CorpusChunk` (DriveChunk-mirror + `source_host`/`authority_tier`/`authority_score`/`corroboration_count`). Idempotent by `(source_host, content_hash)`. Safety-relevant topics get DS2-b cross-source **cosine-similarity ≥0.90** corroboration. No new `Operation`.

## What was decided in this PR

- No new anchors minted. Implemented against ratified **AC-CD25** + amended **AC-D22/AC-D21** + **AC-D28**.
- **CA-A2-1 (DS2-b corroboration)** ruled **embedding cosine ≥0.90** (Option 2) — landed via a **separate spec-author-authored AC-CD25 amendment PR** (Option-B procedure), then re-implemented here as execution-against-merged-spec. This PR amends **no** spec.
- Existing anchors depended on: AC-CD25, AC-D28, amended AC-D22 (Drive→corpus), amended AC-D21 (web search→corpus acquisition), AC-CD1 (bs4/pypdf), AC-CD8 (cost), AC-CD15 (zero-network).

## Drift flags raised and how they were resolved

- **SSRF / allowlist-escape (CA-A2-2 → CA-A2-2r / OV-A2-18, blocking).** Initial fix only re-validated the *persisted* host; reviewers caught that `follow_redirects=True` still *fires* the GET at an internal/metadata host before the check (blind-SSRF). **Resolved:** `_fetch_body` follows redirects **manually**, validating each hop's host against the allowlist **+** an internal-IP guard (`_is_blocked_host`: RFC1918/loopback/link-local/reserved) **before** issuing it; bounded `_MAX_REDIRECTS`. Streaming body with a hard cap (memory). Batched dedup (N+1).
- **Anchor-amendment-in-execution-PR (CA-A2-5 / OV-A2-19, blocking).** I had amended the AC-CD25 body in the execution PR to record the cosine ruling — a class-(ii) ratification + amend-once violation. **Resolved (spec-author Option-B ruling):** reverted the in-PR amendment, the cosine clarification landed as its own spec-author-authored AC-CD25 amendment PR, and A2 re-landed cosine against the merged spec. Lesson: **spec amendments never fold into an execution slice** — surface, ratify separately, implement against merged.

## Open questions deferred to a later phase

- The DS2-b `O(N²·D)` corroboration scan is bounded for v1 (≤8 sources/run) but is a future optimization if corpus runs grow.
- NS-1 (retire the Drive ingest path + relocate the shared primitives `chunk_document`/`content_hash`/`cosine_top_k`) is a **separate execution slice** — A2 imports them from `drive_rag` beside the legacy path.

## Build state vs spec

- Complete: acquisition pipeline + `CorpusChunk` store + cosine corroboration, matching the merged AC-CD25.
- Partial (later slices): retrieval helper + refresh cron (A3); generation grounding + provenance (B2); per-source rollback (`demoted_sources`, E2/AC-CD26).
- Stubbed: none.

## Test coverage and CI results

- `tests/unit/test_corpus_builder.py` — 12 zero-network tests (allowlist discovery, fetch→persist, dedup idempotency, fail-soft, HTML/PDF extract, SSRF guards incl. internal-IP, cosine corroboration + threshold). `test_p1_schema.py` migration round-trip + table-set (35).
- CI at merge: green (all `checks`, `migration-chain`, `docker-build`, `e2e`, Gitar).
- Manual: ruff/mypy/structure/unpinned + migration `--sql` round-trip locally.

## Post-merge validation considerations

- The migration adds the `corpus_chunk` table (IVFFlat). Post-merge local validation needs the DB migrated (`alembic upgrade head`); `migration-chain` CI covers up/down.
- Re-verify: `python -m pytest tests/unit/test_corpus_builder.py -q`.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading: `plans/REQUIRED_READING.md`, `.claude/roles/planner.md`, the detail plan §2 (A2) / §3 (A3).
- **Governance lesson (load-bearing):** an execution slice **implements against ratified/merged spec**; any spec/anchor change is a *separate* spec-author-authored amendment PR (Option-B), authenticated through the overseer's own channel — never folded in-PR.
- `corpus_builder.py` is the A3 + B2 dependency (retrieval + refresh build on it; B2 grounds against `retrieve_corpus_for_topic`).
- Recommended next action: A3 — corpus refresh cron + retrieval helper (in flight on `claude/content-gen-a3-corpus-refresh`).
