# Handover — PR-021 P9 Drive RAG + realism feedback

## PR identifier and link

- PR: #21 — P9 — Drive RAG + realism feedback (branch `claude/drive-rag-implementation-jdPwM`)
- Link: <https://github.com/jaydomains/acumen/pull/21>
- Author / session: Claude Code session (P9 single attempt; sliced 4 + 4 Gitar fix-up commits under the autonomous-loop carve-out the user enabled at start of session)
- Date closed: 2026-05-21 (PR opened as draft after Slice 1 push; left open for review through all four slices; user merges)

## Phase reference

- ROADMAP phase closed by this PR: **P9 — Drive RAG + realism feedback**
- Does this PR fully close the phase? **Yes.** All P9 ROADMAP done-when criteria are met:
  1. **pgvector IVFFlat index** (AC-CD9) — already shipped in P1 migration 0002 (`ix_drive_chunk_embedding`, cosine ops, `lists=100`); P9 verifies + extends `drive_chunk` with the 6 `AIProvenanceMixin` columns via additive migration 0006. `tests/unit/test_p1_schema.py::test_migration_offline_round_trip` asserts the `USING ivfflat` DDL; `::test_migration_0006_drive_chunk_provenance_round_trip` asserts the additive migration is reversible.
  2. **Daily diff-based ingest (hash/changed/deleted)** (AC-D22) — `app/domain/drive_rag.py::ingest_drive_folder` + the `DriveSource` Protocol seam. Hash-based diff per AC-D22 ("re-embed only changed/new files, drop chunks for deleted files"). Admin-triggered via `POST /v1/admin/drive/ingest` at P9; beat-schedule wiring deferred to P11. `tests/integration/test_p9_drive_ingest.py` covers happy-path + the three diff arms + the 409-unconfigured guard + per-file fail-soft.
  3. **Chunk + embed (`text-embedding-3-small`)** (AC-D22 / AC-CD9) — `OpenAIProvider.embed()` concrete implementation mirroring `review()` shape; `chunk_document` pure function with the CODE_SPEC §9 ~500-token default. Per-chunk `AIProvenanceMixin` provenance lands via `record_provenance(chunk, embed_result)`. Cost dashboard's `current_month_spend` now walks `DriveChunk` so embedding spend surfaces in `by_provider["openai"]` / `by_model["text-embedding-3-small"]`.
  4. **RAG injection at generation** (AC-D22) — `retrieve_for_generation(db, *, pill, target_difficulty, k=5)` embeds the query, runs cosine top-k against `DriveChunk`, returns the prompt-payload shape. Wired into all 3 generation call sites: per_testee `start_attempt`, `learning_material.generate_for_weakness`, anchor bootstrap `generate_anchor_pool_for_pill` (cached per-band to prevent cost amplification). Generation prompt bumped to v1.2.0 / learning_material to v1.2.0 with the `rag_context` block.
  5. **Realism flag + nightly aggregation** (AC-D22) — testee-facing `POST /v1/attempts/{a}/questions/{q}/flag-realism` (server-derived `generation_context`, idempotent, role-restricted to `ROLE_TESTEE`); admin-triggered `POST /v1/admin/realism/aggregate` runs the weighted-Testee fold (hybrid mean / 0.5 fallback) and bumps `Question.realism_flag_count`. Beat-schedule wiring deferred to P11.
  6. **Flagged anchors dropped from pool** (AC-D22 / AC-D20) — `aggregate_realism_flags` marks `AnchorQuestion.excluded=True` with reason `"high_realism_flag_ratio: {ratio:.2f}"` when the weighted ratio crosses the `_FLAG_RATIO_EXCLUSION_THRESHOLD = 0.6` default. The P8 `draw_anchors_for_attempt` filter already respects `excluded`, so the anchor drops from subsequent attempts automatically.
  7. **Folder document indexed and retrieved into a generation prompt** — end-to-end via `test_p9_drive_ingest.py::test_ingest_seeds_chunks_with_full_provenance` + `test_p9_rag_retrieval.py::test_per_testee_start_attempt_embeds_query_and_injects_context`.
  8. **Realism-flag pool weights generation as negative examples** — `list_low_realism_questions_for_pill` feeds `low_realism_negative_examples` into the prompt payload; covered by `test_p9_realism_flag.py::test_low_realism_questions_feed_into_generation_payload`.
  9. **Embedding spend appears against OpenAI in cost** — `DriveChunk` joins `current_month_spend`'s per-table tuple at P9 Slice 1; query-side embed cost folds via `_rag_retrieve_spend` audit-log walk added at Slice 3. Both paths covered by `test_p9_drive_ingest.py::test_ingest_embedding_spend_surfaces_via_drive_chunk_provenance` and `tests/unit/test_p9_rag_retrieve_spend.py`.

## What was built

Four slices + four Gitar fix-up commits, all under the autonomous-loop carve-out the user enabled at session start ("After each slice commits and pushes, monitor Gitar; once findings are resolved and Gitar is clean, continue immediately to the next slice"). Per-slice Gitar review ran on each slice commit; every fix-up round resolved findings on-branch with inline regression-rationale comments referencing the Gitar finding number.

**Files added (8):**

- `alembic/versions/0006_p9_drive_chunk_provenance.py` — additive migration: 6 nullable `AIProvenanceMixin` columns on `acumen.drive_chunk`. Reversible per AC-CD3. Existing rows tolerate nulls (none at v1 ship); `_spend_for_table` short-circuits on `cost is None` so legacy rows do not poison aggregation.
- `app/domain/drive_source.py` — `DriveSource` Protocol + `GoogleDriveSource` real implementation. Lazy-built singleton (mirrors `OpenAIProvider._get_client`). MIME-type-routed `fetch_text`: Google Docs via `export_media`, plain text/markdown/csv via `get_media`, anything else skipped with a log warning. Tenacity wraps every call with `retry_if_exception(_is_retryable_http_error)` so only 5xx HttpError classes retry; 4xx propagate immediately (Gitar PR-#21 Slice 2 finding #1).
- `tests/unit/test_p9_drive_chunker.py` (11 tests) — chunker invariants.
- `tests/unit/test_p9_rag_query.py` (12 tests) — `build_rag_query` + `cosine_top_k` pure-function coverage.
- `tests/unit/test_p9_realism_weighting.py` (13 tests) — hybrid Testee-weight + flag-ratio fold math.
- `tests/unit/test_p9_openai_embed.py` (7 tests) — `OpenAIProvider.embed` happy path + routing guard + tenacity retry + auth no-retry + empty-data guard + PRICE_TABLE regression.
- `tests/unit/test_p9_drive_ingest_diff.py` (6 tests) — `diff_files` pure-function coverage (added / changed / unchanged / deleted + mixed scenario).
- `tests/unit/test_p9_drive_source_retry.py` (11 tests) — `_is_retryable_http_error` predicate (5xx retries, 4xx / 429 / non-HttpError don't).
- `tests/unit/test_p9_rag_retrieve_spend.py` (6 tests) — `_rag_retrieve_spend` audit-log fold mirroring `_pill_proposal_spend`.
- `tests/integration/test_p9_drive_ingest.py` (10 tests) — admin ingest endpoint end-to-end + cost-dashboard cross-cut.
- `tests/integration/test_p9_rag_retrieval.py` (11 tests) — RAG retrieval injection at all 3 generation call sites + fail-soft + query-shape + audit-row spend trace + per-band cache.
- `tests/integration/test_p9_realism_flag.py` (17 tests) — testee flag endpoint + weighted aggregation + anchor exclusion + low-realism feeds generation + drive_index_status + N+1 regression guard.
- `handovers/PR-021-p9-drive-rag.md` — this file.

**Files changed (10):**

- `app/ai/openai.py` — `OpenAIProvider.embed()` filled in (was `NotImplementedError`); new `_invoke_embed` sibling function decorated with the same tenacity policy as `_invoke` (kept as a sibling so existing P6/P8 test monkeypatches on `_invoke` stay isolated — Gitar PR-#20 plan-time risk #2). Module docstring + class docstring updated to reflect P9 wiring. The old NotImplementedError-pointer test in `test_p6_openai_review.py` rewritten as a routing-guard test (non-embed op → `ValueError`).
- `app/ai/cost.py` — `current_month_spend`'s per-table tuple extends to include `DriveChunk` (Slice 1); `_rag_retrieve_spend` helper added (Slice 3) walking `AuditLog.action == "rag.retrieve"` rows the same way `_pill_proposal_spend` walks `processing_tasks.payload['provenance']`. Both folds run inside `current_month_spend` so the cost dashboard sees ingest-side + retrieve-side embed spend in one aggregate.
- `app/domain/drive_rag.py` — grew from a 7-line stub into the full P9 domain module: Slice 1 pure functions (`chunk_document`, `content_hash`, `build_rag_query`, `cosine_top_k`, `compute_testee_realism_weight`, `aggregate_flag_ratio`) with two P9-default code constants (`_TARGET_CHUNK_TOKENS=500`, `_FLAG_RATIO_EXCLUSION_THRESHOLD=0.6`); Slice 2 ingest pipeline (`diff_files`, `ingest_drive_folder` + per-file fail-soft + `maybe_fire_budget_alert` post-call); Slice 3 retrieval (`retrieve_for_generation`, `render_rag_context`, `_record_rag_retrieve_audit`); Slice 4 realism (`record_realism_flag` + ownership check, `aggregate_realism_flags` + per-question try/except + batched `_serve_counts_by_anchor`, `list_low_realism_questions_for_pill`, `render_low_realism_examples`, `drive_index_status`). Defensive citation pattern (PR-018 / PR-019 / PR-020 precedent): CODE_SPEC §9 quoted verbatim in module docstring.
- `app/models.py` — `DriveChunk` joins `AIProvenanceMixin` so each chunk row carries the embed call's per-call cost. Docstring updated to describe the AC-CD8 v1.6 stamping path.
- `app/ai/prompts/generation.py` — VERSION 1.0.0 → 1.2.0 (Slice 3 added `rag_context` block at 1.1.0; Slice 4 added `low_realism_negative_examples` block at 1.2.0). Anchor-exemplars spec deviation documented inline.
- `app/ai/prompts/learning_material.py` — same VERSION 1.0.0 → 1.2.0 with the same two payload-key additions.
- `app/domain/attempts.py` — per_testee `start_attempt` injects `rag_context` + `low_realism_negative_examples` into the generation payload. `_load_pill_for_assignment` helper added (resolves the pill via `Assignment.pill_id`; `None` for self-initiated / learning-path → retrieve helper returns empty hits).
- `app/domain/learning_material.py` — `generate_for_weakness` injects `rag_context` + `low_realism_negative_examples`. The retrieval band derives from `severity * 10`.
- `app/domain/calibration.py` — `generate_anchor_pool_for_pill` caches `retrieve_for_generation` per `(pill, band)` so a default `anchor_pool_size_per_band=20` × 3-band bootstrap emits 3 query-side embeds, not 60. Low-realism pool cached once per pill (the pool is pill-scoped, not band-scoped).
- `app/routers/rag.py` — replaced the 7-line stub with three new routes: `POST /v1/admin/drive/ingest` (Slice 2), `POST /v1/attempts/{a}/questions/{q}/flag-realism` (Slice 4 testee), `POST /v1/admin/realism/aggregate` (Slice 4 admin), `GET /v1/admin/drive/index` (Slice 4 read-only).
- `app/schemas.py` — new Pydantic models: `DriveIngestResult`, `RealismFlagResult`, `RealismAggregationResult`, `DriveIndexStatus`.
- `app/main.py` — `rag.router` wired in alongside the other routers.
- `tests/integration/conftest.py` — `_FakeDrive` Drive-source stand-in + `fake_drive` fixture (Slice 2); `RecordingProvider.embed` now returns `[0.1] * 1536` instead of `[0.0] * 1536` so the cosine ranking actually produces hits in tests (the zero-norm short-circuit was firing on the previous fixture; Slice 3 fix).
- `tests/unit/test_p1_schema.py` — extended `test_key_columns_present` to assert the 6 new provenance columns on `drive_chunk`; added `test_migration_0006_drive_chunk_provenance_round_trip` for the additive migration up/down.
- `tests/unit/test_p6_openai_review.py` — `test_embed_always_raises_with_p9_pointer` → `test_embed_rejects_non_embed_operation_with_routing_message` (P9 wires embed, so the NotImplementedError pointer test no longer applies; full happy-path coverage moves to `tests/unit/test_p9_openai_embed.py`).
- `CHECKLIST.md` — five P9 rows ticked `built` with specific Evidence test paths.

**Files removed:** none.

**Summary:** P9 closes the passive-moat layer of AC-D22 — Drive-folder RAG context injection at every generation call, plus the Testee realism-feedback loop that weights subsequent generations away from question patterns flagged as unrealistic. The Slice 1 pure-function module is the AC-D22 / CODE_SPEC §9 math (chunker, query builder, cosine ranking, Testee weighting, flag-ratio fold). Slice 2 wires the diff-based ingest pipeline behind a `DriveSource` Protocol seam so production routes through real `google-api-python-client` while AC-CD15 tests inject `_FakeDrive`. Slice 3 wires retrieval into all 3 generation call sites with a per-(pill, band) cache that prevents anchor-bootstrap cost amplification, and folds the query-side embed cost via a new `_rag_retrieve_spend` audit-log walk so the cost dashboard's sum-to-call-total invariant holds across both the ingest-side and retrieve-side embed spend. Slice 4 ships the testee realism-flag endpoint with server-derived `generation_context`, the admin-triggered aggregation sweep with hybrid Testee weighting and high-ratio anchor exclusion, and the `low_realism_negative_examples` injection into prompt v1.2.0 so the loop closes: a flagged question becomes a negative example in the next generation call for the same pill.

## What was decided in this PR

**New anchors introduced:** none. Implementation lands against the v1.7 audited spec.

**Existing anchors this PR depends on:**

- Product: AC-D22 v1.2 (Drive folder RAG + Testee realism feedback; embedding model fixed to `text-embedding-3-small`), AC-D18 v1.1 (embedding cost tracked against OpenAI), AC-D20 (anchor pool — the high-flag-ratio exclusion mechanism this PR uses), AC-D12 v1.6 (resolver routes `Operation.embed` to OpenAI by coded default), AC-D9 v1.2 (the per-Testee `overall_score` signal the realism weighting reads from).
- Technical: AC-CD9 (pgvector IVFFlat + ~500-token chunks + `text-embedding-3-small` env-overridable), AC-CD8 v1.6 (per-op provenance on every AI-produced entity — `DriveChunk` joins the AIProvenanceMixin set; transient query-side embed cost stamps on `AuditLog`), AC-CD11 v1.7 (60-s ceiling pattern inherited unchanged by the embed path's tenacity policy), AC-CD12 (anchor calibration math hot spot — Slice 4 anchor exclusion uses the existing `excluded` mechanism), AC-CD15 (zero-DB / zero-network test harness intact — every WHERE is single-column equality with Python-side filtering where compound logic is needed), AC-CD16 (admin write endpoints return 201).

**Deliberate documentation-narrative decisions:**

- **No canonical-doc edits during the slices.** SPEC / DECISIONS / CODE_SPEC / SESSION_START / ROADMAP are untouched. Only `CHECKLIST.md` moves, at PR close. Matches the discipline carried forward from P4 / P5 / P6 / P7 / P8.
- **Autonomous-loop carve-out (this session only).** Per the user's mid-session instruction ("do not wait for my approval, watch pr for gitar issues, fix flagged items. when green, proceed with next slice"), the binding per-slice Gitar pause was carved out for this session. Pattern: after each slice, commit → push → on Gitar review, fix in-place (one round each), then continue to the next slice when Gitar reports green. Four fix-up rounds (one each on Slices 1, 2, 4, and a no-op confirmation on Slice 3); all tractable and resolved with inline regression commentary referencing the Gitar finding number.

**Deliberate spec deviations (recorded here per the user's binding cadence):**

1. **Anchor exemplars deliberately NOT re-introduced in the generation prompt.** SPEC §6.1 mentions "anchor questions from the pool as in-context calibration exemplars per AC-D20" alongside the new RAG context, but P8 chose AC-D27 effective_difficulty triangulation over in-context exemplar injection. The Slice 3 prompt update preserves that decision: the v1.2.0 template adds `rag_context` and `low_realism_negative_examples` but does NOT re-introduce anchor exemplars. Documented inline in `app/ai/prompts/generation.py` docstring.

2. **Drive ingest + realism aggregation are admin-triggered in P9; beat-scheduled in P11.** Same pattern as PR-018 (P6 grade-review reconcile) and PR-020 (P8 anchor bootstrap + calibration sweep). The admin endpoints exist as operational levers + same callable signature the P11 Celery beat tasks will wrap. Documented inline in the admin-endpoint docstrings and in `app/beat_schedule.py` (still empty; P11 lands).

3. **Query-side embed cost stamped via `AuditLog` row (action `rag.retrieve`), not on `DriveChunk`.** The retrieval-time embed has no persisted owning entity (the chunks are the index, not the query side), so the AC-CD8 v1.6 per-op provenance contract is honoured via an audit row carrying provider/model/cost detail. `_rag_retrieve_spend` folds these into `current_month_spend` the same way `_pill_proposal_spend` folds the processing_tasks payload. New pattern for the codebase: "transient AI calls without persisted entities have cost stamped in AuditLog detail rather than entity columns; the cost dashboard aggregates from both sources" — future sessions reading the cost aggregation code need this context to explain why two patterns coexist.

4. **Anchor exclusion via existing `excluded=True` + `excluded_reason` mechanism (no new column).** The aggregation sweep sets `AnchorQuestion.excluded=True`, `excluded_reason=f"high_realism_flag_ratio: {ratio:.2f}"`, `needs_admin_attention=True` when the ratio crosses 0.6. The existing P8 `draw_anchors_for_attempt` filter respects `excluded`, so the anchor drops from subsequent draws automatically. Same trust-hierarchy contract as PR-020 (admin can use the flag queue's `resolve` actions to clear the realism-exclusion if they disagree).

5. **`_TARGET_CHUNK_TOKENS = 500` and `_FLAG_RATIO_EXCLUSION_THRESHOLD = 0.6` are P9-implementation-defined constants, not spec-mandated.** CODE_SPEC §9 names "~500 token chunks" as the default; the threshold has no spec value. Documented inline as tunable in v1.x via `system_settings` columns if operators want to adjust — same defensive-deviation pattern as PR-018's `accept_reviewer` semantic and PR-019's `_WELL_BELOW_DIFFICULTY_THRESHOLD = 0.4`.

6. **4-chars-per-token chunking heuristic, not `tiktoken`.** AC-CD1 forbids unpinned deps; adding a tokenizer dependency for chunk sizing inflates the stack for negligible quality gain at v1 corpus scale. Documented inline as a v1.x improvement candidate. Same disposition pattern as PR-020's "no new dep for chunk sizing."

7. **Realism flag `generation_context` is server-derived, NOT user-supplied.** The testee endpoint accepts an empty request body; `_generation_context_from_question` builds the context dict from the Question's `AIProvenanceMixin` columns + `question_type` + `assigned_difficulty`. AC-D22 says "records a flag against that specific question's content and the generation context that produced it" — the testee doesn't know the context and shouldn't be trusted to supply it. Documented inline in `record_realism_flag` docstring + the endpoint docstring.

8. **Realism flag endpoint role-restricted to `ROLE_TESTEE`.** AC-D22's trust-hierarchy invariant ("the testee is the realism authority on what THEY saw"): admins moderating via the endpoint would invert the trust hierarchy. An admin POSTing the endpoint → 403. Admins use the audit log + direct DB tooling for moderation. Same decision-shape as PR-020 Slice 4's "substitute-wording does not auto-rerun self-review."

9. **`drive_index_status` iterates rows in Python rather than emitting SQL aggregates** — same trade-off `app.ai.cost._spend_for_table` documents and defers: the FakeSession harness handles only single-entity equality WHEREs (AC-CD15). At v1 pilot scale the row-load cost is negligible against the admin dashboard refresh cadence; documented inline as a P11 candidate when the test harness either extends or moves to a real Postgres fixture. Cited Gitar PR-#21 Slice 4 finding #2 inline.

## Drift flags raised and how they were resolved

**No spec drift surfaced.** The v1.7 spec is consistent with the P9 implementation. CHECKLIST.md is the only canonical doc updated.

**Seven Gitar findings across four slices, all resolved on-branch:**

**Slice 1 review (commit `868ad34`, 2 findings):**
1. **💡 Edge Case: `cosine_top_k` silently truncates mismatched vector dimensions** (`app/domain/drive_rag.py`) — `zip(..., strict=False)` would compute the dot product over the shorter prefix, producing wrong scores on a dim mismatch. Switched to `strict=True` so the test harness raises loudly; production sees the same shape error via pgvector's `<=>` operator at the SQL layer. Regression test in `test_p9_rag_query.py::test_cosine_top_k_raises_on_dimension_mismatch`.
2. **💡 Edge Case: `embed()` does not guard against empty `response.data`** — added a contextual `ValueError` guard with provider + model in the message, mirroring the `_call()` loud-error pattern. Regression test in `test_p9_openai_embed.py::test_embed_raises_clear_error_on_empty_response_data`.

**Slice 2 review (commit `1351ba3`, 3 findings):**
1. **⚠️ Bug: Tenacity retries non-retryable 4xx errors** (`app/domain/drive_source.py`) — `retry_if_exception_type(BaseException)` matched everything, so 4xx (401/403/404) retried 4 times burning ~20s of wall-clock per file before propagating. Switched all three retry-decorated methods to `retry_if_exception(_is_retryable_http_error)` so the predicate filters to 5xx only. 11 new unit tests in `test_p9_drive_source_retry.py` pin the predicate filter.
2. **💡 Performance: `_delete_chunks_for_source` loads all tenant chunks into memory** — added `DriveChunk.source_doc_ref` to the WHERE clause; the FakeSession harness already supports multi-condition equality WHEREs (the only fake-harness limit is `Column == True/False`, PR-#20 Slice 4 finding, which a string column dodges). O(N) per deletion call eliminated.
3. **💡 Performance: O(n*m) linear scan in the persist loop** — pre-built `hash_by_file_id` dict so the per-file persistence is O(1). O(N²) → O(N) for the persist phase.

**Slice 3 review (commit `e639180`, 0 findings).** Approved with no changes requested.

**Slice 4 review (commit `5560eb2`, 2 findings):**
1. **⚠️ Performance: `_attempts_for_anchor_serve_count` does N+1 full-row loads in loop** — replaced with `_serve_counts_by_anchor`: one batched query at the top of the sweep that builds a `dict[anchor_id, count]` the loop reads via O(1) lookup. Same equality-only WHERE pattern (AC-CD15 compatible); round-trip count drops from N to 1 against the production Postgres path. Regression test in `test_p9_realism_flag.py::test_aggregate_uses_single_query_for_all_anchor_serve_counts` pins the invariant (3 flagged anchors → 1 AttemptAnchor select).
2. **💡 Performance: `drive_index_status` loads all chunks for count/max** — documented the AC-CD15 deferral inline citing the `_spend_for_table` precedent. Same trade-off: FakeSession harness handles only single-entity equality WHEREs, not aggregate selects; v1 pilot scale makes the cost negligible; P11 candidate for the SQL-aggregate sweep.

## Open questions deferred to a later phase

1. **P11 — beat-schedule the Drive ingest + realism aggregation crons.** `app/beat_schedule.py` is empty by design at v1; P11 wires the existing `ingest_drive_folder` callable to a daily cron (AC-D22) and `aggregate_realism_flags` to a nightly cron (AC-D22). Both callables ship at P9 admin-triggered; only the schedule wiring is deferred. Same disposition as PR-018 (grade-review reconcile) and PR-020 (calibration sweep).
2. **P11 — `drive_index_status` + `_spend_for_table` SQL-aggregate sweep.** When the test harness either extends to support `func.count()` / `func.max()` OR moves to a real Postgres fixture, the in-Python row iteration in these two helpers can move to SQL aggregates. Gitar PR-#21 Slice 4 finding #2 documented inline as a P11 candidate.
3. **P11 — DriveChunk has no `pill_id` column (corpus is global per tenant).** The retrieval query uses pill name + description + difficulty band as the query embed to scope retrieval to relevant chunks. A future v1.x optimisation could add a per-pill chunk index (extra `pill_id` column on DriveChunk + a `(pill_id, embedding)` IVFFlat index) to avoid the global-corpus retrieval at scale. Not needed at v1 corpus scale; not in spec; revisit if the corpus grows past ~tens of thousands of chunks.
4. **`_FLAG_RATIO_EXCLUSION_THRESHOLD = 0.6`, `_TARGET_CHUNK_TOKENS = 500`, `_LOW_REALISM_THRESHOLD = 2`, `_DEFAULT_TOP_K = 5`, `_LOW_REALISM_DEFAULT_LIMIT = 5` as `system_settings` columns.** All five are P9-implementation-defined code constants per the PR-020 precedent (`_ANCHORS_PER_ATTEMPT = 2`, `_DEFAULT_POOL_SIZE_PER_BAND = 20`). Could be promoted to tunable columns in v1.x if operators need them; cited inline in each constant's docstring.
5. **Tokenizer precision.** The chunker uses a 4-chars-per-token heuristic per AC-CD1 minimum-deps. A future v1.x candidate is to add `tiktoken` (or similar) for precise chunk sizing, especially if the embed-cost optimisation pressure justifies it.
6. **Real Drive folder smoke test.** P9 ships the `GoogleDriveSource` adapter against a `_FakeDrive` test seam; an operator-initiated smoke against a real (empty) Drive folder before P11 schedule wiring would confirm the auth-flow + MIME-routing in production. Operationally deferred to the P11 deployment exercise.
7. **`anchor_question` and the realism-flag exclusion path.** The aggregation marks `AnchorQuestion.excluded=True` for high-ratio anchors. If admin disagrees, the existing P8 flag-queue's `resolve` actions (`keep` / `substitute_wording` / `reject`) clear the exclusion. No new admin action is added at P9 — admins use the existing flag queue.
8. **AnchorQuestion `realism_exclusion` audit trail.** When the aggregation excludes an anchor, the change is captured in the `realism.aggregate` audit row's `detail` dict (via the `anchors_excluded` count) but the per-anchor exclusion event is not separately audited. A future v1.x enhancement could emit a `realism.exclude_anchor` audit row per excluded anchor for finer traceability.

## Build state vs spec

- **AC-D22 (Drive folder RAG ingestion + Testee realism feedback)** — complete. The ingest pipeline + realism flag write + nightly aggregation + low-realism negative-examples loop all ship; cron schedule wiring deferred to P11.
- **AC-D22 / §7.3 (Drive API integration)** — complete via `GoogleDriveSource` real adapter; service-account auth, mime-routed export/download, tenacity retries on 5xx only.
- **AC-CD9 (pgvector IVFFlat + ~500-token chunks + `text-embedding-3-small`)** — complete; index was P1, P9 wires the embedding spend trail via `DriveChunk` AIProvenanceMixin + `_rag_retrieve_spend` audit-log fold.
- **AC-CD8 v1.6 (per-op provenance on every AI-produced entity)** — complete; `DriveChunk` carries ingest-side embed provenance; query-side embed cost stamps via the `rag.retrieve` audit-log pattern (the new pattern documented above).
- **AC-D18 v1.1 (embedding cost tracked against OpenAI)** — complete; `current_month_spend` walks `DriveChunk` + folds `_rag_retrieve_spend` so both ingest-side and retrieve-side embed spend land in the OpenAI bucket.
- **AC-D20 (anchor pool exclusion on high realism flag count)** — complete; the aggregation sweep marks `AnchorQuestion.excluded=True` with the `high_realism_flag_ratio` reason; the existing `draw_anchors_for_attempt` filter respects it.
- **AC-CD11 v1.7 (60-s ceiling)** — inherited from the existing P6 review path; no change in P9.
- **AC-CD15 (zero-DB / zero-network test harness)** — preserved throughout; every WHERE is single-column equality with Python-side filtering where compound logic is needed.

## Test coverage and CI results

**pytest -q: 619 passed** (P8 baseline 513 + 106 net new — 11 Slice 1 unit-chunker + 12 Slice 1 unit-rag-query + 13 Slice 1 unit-realism-weighting + 7 Slice 1 unit-embed + 1 schema migration + 6 Slice 2 unit-diff + 10 Slice 2 integration-ingest + 11 Slice 2 retry-predicate + 6 Slice 3 unit-spend + 11 Slice 3 integration-retrieval + 17 Slice 4 integration-realism + 1 N+1 regression; minor adjustments for the P6 embed test rewrite).

CI parity sweep clean on every commit: `ruff check .`, `ruff format --check .`, `mypy app`, `scripts/structure_gate.py`, `scripts/check_unpinned_deps.py` all pass.

End-to-end manual smoke (post-merge against a real DB):

```
# 1. Configure Drive folder
PATCH /v1/admin/system-settings { "drive_folder_id": "<real-folder-id>" }
# 2. Initial Drive ingest (AC-D23 step 4 equivalent for ad-hoc operator use)
POST /v1/admin/drive/ingest
  → 201, chunks_added > 0, by_provider["openai"] increments in /v1/admin/cost/summary
# 3. Per_testee attempt against an assignment scoped to a pill
POST /v1/attempts ... origin=assignment_driven + assignment_id
  → 201; the generation call sees rag_context with the indexed chunks
# 4. Testee flags one question on the attempt
POST /v1/attempts/{id}/questions/{q_id}/flag-realism
  → 201, realism_flag row created
# 5. Aggregate sweep
POST /v1/admin/realism/aggregate
  → 201, Question.realism_flag_count populated; audit "realism.aggregate" written
# 6. Re-ingest (idempotent on unchanged content)
POST /v1/admin/drive/ingest
  → 201, files_unchanged > 0, chunks_added = 0, no new embed calls
# 7. Read the index dashboard
GET /v1/admin/drive/index
  → 200, chunks > 0, files > 0, last_indexed_at populated
```

## Anything a fresh Claude Code session needs to pick up cleanly

- **Required reading beyond `SESSION_START.md`:**
  - `handovers/PR-020-p8-anchor-calibration.md` for the upstream `draw_anchors_for_attempt` + `excluded` mechanism semantics (P9 Slice 4 reuses the existing P8 exclusion path rather than adding a new column).
  - This handover's "Deliberate spec deviations" section — particularly point #3 (the `AuditLog` "rag.retrieve" pattern for transient AI calls with no owning entity) and point #7 (server-derived realism `generation_context`).
- **Environment / setup notes:**
  - `GOOGLE_DRIVE_CREDENTIALS_JSON` env var must hold the service-account JSON blob (string-form) for the production `GoogleDriveSource` to build. Empty string is the dev/test fallback; `_FakeDrive` substitutes via `monkeypatch.setattr("app.domain.drive_source._GOOGLE_DRIVE", _FakeDrive(...))` (mirrors the `_ANTHROPIC` / `_OPENAI` swap point pattern).
  - `OPENAI_API_KEY` is required for production embeddings (and for P6 cross-family review). The `resolve_provider(Operation.embed)` resolver falls through to `StubAIProvider` if the key is unset; that's the dev/local fail-safe but every chunk will then carry `provider="stub"` in its provenance and the cost dashboard will show no OpenAI spend.
- **Known traps, gotchas, or in-progress work that is easy to misread:**
  - The `AuditLog`-as-cost-ledger pattern (point #3 in deviations) is a NEW pattern at P9. Future sessions touching `app/ai/cost.py::current_month_spend` need to know that the function walks BOTH provenance-mixin tables AND audit-log rows. Two patterns coexist; both are intentional.
  - `RecordingProvider.embed()` returns `[0.1] * 1536` (non-zero) so the cosine ranking actually produces hits in tests. A future change that touches this fixture and reverts to `[0.0] * 1536` will silently break every retrieval integration test that asserts non-empty hits (because the zero-norm short-circuit in `cosine_top_k` would fire). The fixture comment documents this trap.
  - `DriveChunk.content_hash` is the FILE-level hash (every chunk for the same file carries the same hash by construction in `ingest_drive_folder`). The diff reads any one chunk's hash per file to detect unchanged-vs-changed. A future change that derives chunk-level hashes per-chunk would break the diff semantic; the helper docstring documents this.
  - `_serve_counts_by_anchor` batched lookup is the FIX for an N+1 regression. A future refactor that re-introduces per-anchor serve-count queries inside `aggregate_realism_flags` will fail `test_aggregate_uses_single_query_for_all_anchor_serve_counts`.
  - The anchor bootstrap's per-(pill, band) RAG cache is loop-local, NOT application-level. A future session extending this to an application-wide cache without understanding the scope decision would change the calibration sweep's cost-amplification fix.
- **Recommended next action:** Start P10 — JIT streaming generation (per-Testee). The Slice 3 retrieve_for_generation helper is already wired into the per_testee start_attempt path and will continue to work in P10's SSE streaming path; the per-question generation calls in P10 will read from the same `rag_context` payload key. Re-read AC-D25 / CODE_SPEC §10 for the streaming buffer state machine.

## Acknowledged spec / handover continuity

- Predecessor: **PR-020 — P8 anchor calibration.** The Slice 4 anchor-exclusion mechanism reuses the existing P8 `excluded=True` + `excluded_reason` columns + the `draw_anchors_for_attempt` filter that already respects them. No P8 test regressed.
- Successor: **PR-022 — P10 JIT streaming generation (per-Testee).** The Slice 3 `rag_context` + Slice 4 `low_realism_negative_examples` payload keys are already wired into the generation call sites and will flow unchanged through the per-question streaming path P10 layers on top.
- Spec docs unchanged: SPEC.md, DECISIONS.md, CODE_SPEC.md, SESSION_START.md, ROADMAP.md — all v1.7 references stand. Only CHECKLIST.md updated (5 P9 rows ticked `built`).
- Handover continuity: this file follows the PR-020 section structure verbatim. A future session picking up P10 should read `handovers/PR-021-p9-drive-rag.md` for the "Deliberate spec deviations" + "Known traps" sections, then `handovers/PR-020-p8-anchor-calibration.md` for the upstream anchor mechanism, before touching `app/domain/attempts.py` or the streaming-buffer state machine.
