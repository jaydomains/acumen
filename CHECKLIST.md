# CHECKLIST — Acumen per-phase acceptance & drift checklist (canonical)

> **Companion to** `ROADMAP.md` / `CODE_SPEC.md` / `SPEC.md` v1.2 /
> `DECISIONS.md` v1.2. One block per ROADMAP phase. A row is ticked only
> when its **Evidence** (test path, command, or artifact) exists.
>
> **Status legend:** `built` — implemented and matches spec, with
> evidence · `partial` — started, incomplete (note what remains) ·
> `missing` — not started.
>
> Status / Evidence are intentionally blank until the phase lands.

---

## P0 — Scaffold & stack lock

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Repo layout matches CODE_SPEC §3 | P0 | AC-CD2,17 | repo root, `app/` | built | `python scripts/structure_gate.py` exits 0; `tests/unit/test_structure_gate.py` 2 passed |
| Pinned deps (HTTP + worker) | P0 | AC-CD1 | `requirements*.txt` | built | `requirements.txt`/`requirements-worker.txt` (+`requirements-dev.txt`, see PR-002 handover deviation note); `python scripts/check_unpinned_deps.py` exits 0 |
| Multi-stage Dockerfile + compose skeleton | P0 | AC-CD16 | `Dockerfile`, `docker-compose.yml` | built | `Dockerfile` base→http/worker/migrate; `docker compose config -q` valid (live `compose up` not run — no Docker daemon in build sandbox) |
| Alembic + schema-create `env.py` | P0 | AC-CD3 | `alembic/env.py`, `alembic.ini` | built | `alembic upgrade head --sql` + `alembic downgrade head:base --sql` clean; version table scoped to `acumen` schema |
| `/healthz` `/readyz` setup-only app | P0 | AC-CD2 | `app/main.py` | built | `tests/unit/test_health.py` 2 passed; structure-gate enforces `main.py` setup-only (no domain/model/AI/DB imports) |
| Config + `.env.example` | P0 | AC-CD16,18 | `app/config.py`, `.env.example` | built | `app/config.py` pydantic-settings (env-overridable model IDs, AC-CD18); `.env.example` all groups |
| Structure-verify gate | P0 | AC-CD17 | `scripts/` | built | `scripts/structure_gate.py`; wired in `.github/workflows/ci.yml` + `tests/unit/test_structure_gate.py` |

## P1 — Data model & migrations

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| All SPEC §5 entities + supporting tables | P1 | AC-CD4 | `app/models.py` | built | `app/models.py` (34 tables); `tests/unit/test_p1_schema.py::test_table_set_is_exactly_p1` |
| First migration up/down clean | P1 | AC-CD3 | `alembic/versions/` | built | `alembic/versions/0002_p1_data_model.py`; `test_p1_schema.py::test_migration_offline_round_trip` (`alembic upgrade base:head --sql` / `downgrade head:base --sql`, exit 0) |
| pgvector extension + `vector(1536)` | P1 | AC-CD4; AC-D22 | `infra/postgres/init.sql`, `app/models.py` | built | `infra/postgres/init.sql`; `app/models.py` `DriveChunk.embedding Vector(1536)`; `test_p1_schema.py::test_key_columns_present` |
| `system_settings` v1.3 defaults | P1 | AC-D9,20,27 | `app/models.py` | built | `app/models.py` `SystemSettings`; `test_p1_schema.py::test_system_settings_v13_defaults` (sensitivity 2.0, prior_weight 20) |
| Table-set + defaults assertion test | P1 | AC-CD4 | `tests/unit/` | built | `tests/unit/test_p1_schema.py` (10 tests pass) |

## P2 — Auth & user management

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Admin-creates-user | P2 | AC-D2 | `app/routers/users.py` | built | `tests/integration/test_p2_auth_flows.py::test_done_when_admin_creates_user_setup_login_role_gate`, `::test_admin_create_duplicate_email_conflicts` |
| Setup + password-reset token flows | P2 | AC-D10 | `app/routers/auth.py` | built | `tests/integration/test_p2_auth_flows.py::test_setup_token_is_one_time`, `::test_password_reset_round_trip`; `tests/unit/test_p2_auth_primitives.py::test_token_mint_is_unique_and_hash_is_deterministic` |
| Login (argon2id + JWT) | P2 | AC-D10; AC-CD5 | `app/routers/auth.py` | built | `tests/integration/test_p2_auth_flows.py::test_done_when_admin_creates_user_setup_login_role_gate`, `::test_login_invalid_credentials`, `::test_refresh_round_trip`, `::test_expired_token_rejected`; `tests/unit/test_p2_auth_primitives.py::test_jwt_roundtrip_and_type_separation` |
| Role-check dependency | P2 | AC-CD5 | `app/permissions.py` | built | `tests/integration/test_p2_auth_flows.py::test_done_when_admin_creates_user_setup_login_role_gate`, `::test_unauthenticated_protected_route` |
| Deactivation gate | P2 | AC-D2; AC-CD5 | `app/permissions.py` | built | `tests/integration/test_p2_auth_flows.py::test_deactivated_user_login_rejected` |
| Privacy-notice ack gate | P2 | AC-D16 | `app/permissions.py` | built | `tests/integration/test_p2_auth_flows.py::test_privacy_gate_blocks_then_clears` |

## P3 — Catalogue

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Subjects/Pills/Paths/Groups CRUD | P3 | AC-D7,8,15 | `app/routers/catalogue.py`,`paths.py`,`groups.py`,`app/domain/catalogue.py` | built | `tests/integration/test_p3_done_when.py::test_done_when_crud_subjects_pills_paths_groups`,`tests/integration/test_p3_paths_groups.py` |
| Pill difficulty range | P3 | AC-D9 | `app/models.py`,`app/schemas.py` | built | `tests/integration/test_p3_catalogue.py::test_difficulty_range_rejected_on_create_and_update` |
| Discovery / filter | P3 | AC-D15 | `app/routers/catalogue.py`,`app/domain/catalogue.py` | built | `tests/integration/test_p3_done_when.py::test_done_when_discovery_filter_discoverable_non_retired`,`tests/integration/test_p3_catalogue.py::test_discovery_subject_and_difficulty_and_search_filters` |
| Safety-keyword auto-tag | P3 | AC-D21 | `app/domain/safety_links.py`,`app/domain/catalogue.py`,`alembic/versions/0003_p3_pill_safety_override.py` | built | `tests/integration/test_p3_done_when.py::test_done_when_safety_auto_tag_at_pill_creation`,`tests/integration/test_p3_catalogue.py::test_safety_reeval_on_edit_unless_overridden`,`tests/unit/test_p3_safety_links.py` |
| AI-pill-proposal queue (AI stubbed) | P3 | AC-D8 | `app/routers/catalogue.py`,`app/domain/catalogue.py`,`app/ai/provider.py` | built | `tests/integration/test_p3_done_when.py::test_done_when_pill_proposal_queue_persists_ai_stubbed`,`tests/integration/test_p3_proposal_queue.py` |
| Testee self-directed learning material | P3 | AC-D8; AC-D21 | `app/routers/catalogue.py` (`POST /v1/pills/{pill_id}/learning-material`), `app/domain/learning_material.py::generate_self_initiated`, `app/ai/prompts/learning_material_self_initiated.py`, `app/schemas.py` (`LearningMaterialResponse`, `SafetyLinkResponse`) | built | `tests/integration/test_p5_self_initiated_material.py` (happy path + 30-day cohort cache + `?regenerate=true` + permission gates + 404 missing/retired + AC-D21 curated_safety_links branch + 422 `curation_pending` + safety-toggle cache self-heal) |

## P4 — Tests, assignments, attempts (deterministic)

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Four test modes data path | P4 | AC-D5 | `app/domain/tests.py`, `app/routers/tests.py` | built | `pytest tests/integration/test_p4_tests.py::test_per_testee_mode_creates_in_draft tests/integration/test_p4_tests.py::test_frozen_mode_defaults_shuffle_true tests/integration/test_p4_tests.py::test_benchmark_mode_requires_scope tests/integration/test_p4_tests.py::test_publish_succeeds_after_question_added` (hand_authored exercised end-to-end via the publish path) |
| Frozen attempt snapshot | P4 | AC-D17 | `app/domain/attempts.py`, `app/routers/attempts.py` | built | `pytest tests/integration/test_p4_attempts.py::test_frozen_attempt_snapshots_questions` |
| Presentation shuffle from seed | P4 | AC-D24 | `app/domain/attempts.py`, `tests/unit/test_p4_shuffle.py` | built | `pytest tests/unit/test_p4_shuffle.py::test_presentation_stable_across_calls tests/integration/test_p4_attempts.py::test_block_internal_shuffle_preserved_across_pause_and_resume` |
| Deterministic grading (MCQ/TF/matching) | P4 | AC-D5, AC-D19 v1.6 | `app/domain/attempts.py` (`_auto_grade_deterministic`, `result_view`) | built | `pytest tests/integration/test_p4_grading.py::test_mcq_correct_answer_scores_full tests/integration/test_p4_grading.py::test_true_false_grading tests/integration/test_p4_grading.py::test_matching_partial_credit` |
| Derived `engagement_status` | P4 | AC-D26 v1.6 | `app/domain/engagement.py`, `app/routers/admin.py` | built | `pytest tests/integration/test_p4_engagement.py::test_status_filters_by_assignment_id` (v1.6 disambiguation: status derives by `Attempt.assignment_id` match, not heuristic origin/timing) |
| Pause blanks content | P4 | AC-D11 v1.6 | `app/domain/attempts.py` (lazy auto-resume) | built | `pytest tests/integration/test_p4_attempts.py::test_pause_blanks_question_content_and_restores_on_resume tests/integration/test_p4_attempts.py::test_lazy_max_duration_auto_resume` |
| Attempt→Assignment FK + sequence uniqueness | P4 | AC-D26 v1.4, AC-D3 v1.5 | `app/models.py` (Attempt), `alembic/versions/0004_p4_attempt_assignment_fk.py`, `alembic/versions/0005_p4_attempt_sequence_unique.py` | built | `pytest tests/unit/test_p4_schema.py::test_attempt_assignment_fk_present tests/unit/test_p4_schema.py::test_attempt_sequence_unique_constraint_present tests/unit/test_p4_schema.py::test_migration_0004_assignment_fk_round_trip tests/unit/test_p4_schema.py::test_migration_0005_sequence_unique_round_trip` |
| Result-display gate (F14 mixed-test) | P4 | AC-D19 v1.6 / SPEC §4.8 | `app/domain/attempts.py::result_view`, `app/routers/attempts.py::attempt_result` | built | `pytest tests/integration/test_p4_grading.py::test_result_endpoint_mixed_test_returns_review_pending tests/integration/test_p4_grading.py::test_result_endpoint_deterministic_attempt_returns_ready` |
| Engagement sweep + admin pending widget | P4 | AC-D26 v1.6 | `app/domain/engagement.py::run_engagement_sweep`, `app/routers/admin.py` | built | `pytest tests/integration/test_p4_engagement.py::test_sweep_sends_reminder_to_pending_assignees tests/integration/test_p4_engagement.py::test_sweep_escalates_after_second_reminder tests/integration/test_p4_engagement.py::test_pending_widget_lists_stale_mandatory_pending_only` |

## P5 — AI provider layer + 5 Anthropic ops

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| `AIProvider` abstraction + resolution order | P5 | AC-D12; AC-CD8 | `app/ai/provider.py` | built | `tests/unit/test_p5_resolve.py` (resolution-order coverage incl. plan-review additions for stub fallback + JSONB falsy values) |
| VCS prompt registry + persisted version | P5 | AC-CD8 | `app/ai/prompts/` | built | `tests/unit/test_p5_prompts.py` (5 Anthropic ops registered with semver + JSON contract); `tests/integration/test_p5_generation.py::test_per_testee_start_invokes_generation_with_provenance` (`ai_prompt_version` persisted on Question rows) |
| Per-call cost capture | P5 | AC-D18; AC-CD8 | `app/ai/cost.py`, `app/routers/cost.py` | built | `tests/unit/test_p5_cost.py` (compute_cost + price-table coverage + provenance helpers); `tests/integration/test_p5_budget_alert.py` (alerts at 50/80/100 % via SMTPClient seam); `tests/integration/test_p5_cost_dashboard.py` (admin GET `/v1/admin/cost/summary` aggregates across 6 entity tables + processing_tasks.payload); `tests/integration/test_p5_rate_limit.py` (AC-D18 v1.1 self_initiated-only carve-out) |
| 5 Anthropic ops (non-streaming) | P5 | AC-D12 | `app/ai/anthropic.py`, `app/domain/attempts.py`, `app/domain/catalogue.py`, `app/domain/weakness.py`, `app/domain/learning_material.py` | built | `tests/integration/test_p5_generation.py` (per_testee start_attempt), `tests/integration/test_p5_grading.py::test_short_answer_submit_writes_ai_grade_with_provenance` (P5 done-when criterion), `tests/integration/test_p5_weakness.py` (callable), `tests/integration/test_p5_material.py` (callable + F18 served_at/served_text + AC-D21 safety skip), `tests/integration/test_p5_pill_proposal.py` (provenance in payload); `tests/unit/test_p5_anthropic.py` (contextual-error paths) |
| Model-ID env defaults | P5 | AC-CD18 | `app/config.py` | built | `tests/unit/test_p5_resolve.py::test_model_coded_defaults_come_from_config`; `tests/unit/test_p5_cost.py::test_price_table_covers_every_coded_default_model_id` (CI-time drift guard) |

## P6 — Cross-family review

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| **AC-CD11 latency rule resolved (gate)** | P6 | AC-CD11 | `CODE_SPEC.md` | built | `CODE_SPEC.md` §18 AC-CD11 v1.7; `DECISIONS.md` AC-D19 v1.7; `SPEC.md` §6.6 / §4.8 v1.7 |
| Synchronous OpenAI review before stamp | P6 | AC-D19 | `app/domain/grade_review.py`, `app/routers/admin.py` | built | `tests/integration/test_p6_grade_review_submit.py::test_submit_writes_grade_review_rows_for_each_ai_grade` (one batched OpenAI review call per submit, GradeReview rows confirmed with provenance per AC-D18); `app/domain/grade_review.py:85` `GRADE_REVIEW_SUBMIT_CEILING_SECONDS = 60.0`; `app/domain/grade_review.py:324` `asyncio.wait_for` inside `_review_ai_grades` |
| Fail-soft "review pending" + reconcile cron | P6 | AC-D19 | `app/domain/grade_review.py`, `app/beat_schedule.py`, `app/worker.py` | built | `tests/integration/test_p6_grade_review_reconcile.py::test_reconcile_flags_pending_when_provider_returns_flagged`; `app/beat_schedule.py` `grade_review.reconcile` entry (5-min crontab); `app/worker.py:60-87` `reconcile_grade_reviews_task` |
| Admin flag queue | P6 | AC-D19 | `app/routers/admin.py` | built | `tests/integration/test_p6_admin_flag_queue.py::test_list_flagged_returns_unresolved_only`; `tests/integration/test_p6_admin_reconcile_endpoint.py` (returns-counts, zero-counts, forbidden-for-non-admin) |

## P7 — Adaptive loop, competence, integrity

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Weakness -> material -> retest loop | P7 | AC-D6 | `app/domain/loop.py`, `app/routers/admin.py` | built | `tests/integration/test_p7_loop.py::test_failed_assignment_attempt_triggers_autonomous_loop`; `tests/integration/test_p7_loop_admin.py::test_approve_creates_followup_and_clears_flag` |
| `competence_estimate` IRT + decay | P7 | AC-D9; AC-CD13 | `app/domain/competence.py` | built | `tests/unit/test_p7_competence.py` (38 worked-fixture tests from AC-D9 v1.2); `tests/integration/test_p7_loop.py::test_failed_attempt_writes_competence_estimate` |
| Null competence -> "no data yet" | P7 | AC-D9 | `app/domain/competence.py` | built | `tests/unit/test_p7_competence.py::TestComputeCompetenceEstimate::test_empty_returns_none`; `apply_competence_update` propagates None per AC-D9 null-handling |
| N-gram overlap flag | P7 | AC-D4 #5; AC-CD14 | `app/domain/ngram.py`, `app/domain/loop.py` | built | `tests/unit/test_p7_ngram.py` (27 trigram + Jaccard tests); `tests/integration/test_p7_loop.py::test_overlap_check_flags_near_verbatim_copy` |

## P8 — Anchor calibration

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Anchor pool generation per band | P8 | AC-D20; AC-D23 | `app/domain/calibration.py`, `app/routers/admin.py` | built | `tests/integration/test_p8_anchor_bootstrap.py::test_anchors_generate_happy_path_writes_live_anchors` (20 anchors × 1 band, full provenance + shared-PK invariant); `::test_anchors_generate_three_strikes_writes_excluded_rows` (AC-D23 3-fail → `excluded=True`, `needs_admin_attention=True`); `::test_anchors_generate_409_when_anchors_already_exist` (deliberate spec deviation from AC-D23 idempotent wording — see handover); `tests/integration/test_p8_anchor_admin.py` (flag queue + keep / substitute_wording / reject resolve actions); `tests/integration/test_p8_calibration_sweep.py::test_calibration_sweep_worked_fixture_shrinks_toward_observed_mean` (admin-triggered §12 sweep). |
| Per-attempt anchor draw record | P8 | AC-D20 | `app/domain/calibration.py`, `app/domain/attempts.py` | built | `tests/integration/test_p8_anchor_draw.py::test_anchor_draw_writes_two_attempt_anchor_rows` (assignment-backed per_testee attempt → 2 AttemptAnchor rows + snapshot fold); `::test_anchor_draw_is_deterministic_on_resume` (sorted-pool + seeded sample); `tests/integration/test_p8_anchor_submit.py::test_submit_denormalises_anchor_score_from_response` (refinement #3 score denormalisation from Response.response_score). |
| Bayesian-shrinkage `effective_difficulty` | P8 | AC-D27; AC-CD12 | `app/domain/calibration.py` | built | `tests/unit/test_p8_calibration.py` (26 worked-fixture tests of `compute_effective_difficulty` with numbers derived from AC-D27 verbatim — n=0 prior preservation, n=k halfway, high-n convergence, clamp at both extremes, sensitivity propagation); `tests/integration/test_p8_calibration_sweep.py::test_calibration_sweep_worked_fixture_shrinks_toward_observed_mean` (admin trigger → `effective_difficulty = 5.5` after 20 zero scores on assigned=5 anchor). |
| Fresh-question delta | P8 | AC-D27; AC-CD12 | `app/domain/calibration.py`, `app/domain/competence.py` | built | `tests/unit/test_p8_calibration.py` (8 `compute_fresh_question_delta` tests covering 0 / 1 / 2 / 3 anchors with positive / negative / cancelling deltas); `tests/integration/test_p8_anchor_submit.py::test_fresh_question_delta_shifts_competence_estimate` (worked-fixture: 2 anchors with effective=7 over assigned=5 → fresh question's effective lifts to 7 → CompetencyProfile.competence_estimate = 8.0 instead of the 7.33 it would be without the delta). |
| `preliminary -> confident` at n threshold | P8 | AC-D20; AC-D27 #3 | `app/routers/calibration.py`, `app/domain/calibration.py` | built | `tests/unit/test_p8_calibration.py::test_is_confident_at_threshold_flips_to_confident` (inclusive boundary); `tests/integration/test_p8_calibration_state.py::test_band_state_at_threshold_flips_to_confident` (HTTP surface, `n == 20 → state="confident"`); `::test_band_state_below_threshold_is_preliminary`; `::test_band_state_separates_excluded_from_pool` (counts partition live vs excluded). |

## P9 — Drive RAG + realism feedback

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| pgvector IVFFlat index | P9 | AC-CD9 | `app/models.py`, `alembic/versions/0002_p1_data_model.py` | built | `tests/unit/test_p1_schema.py::test_key_columns_present` (asserts `Vector(1536)` + the AIProvenanceMixin columns added by migration 0006); `tests/unit/test_p1_schema.py::test_migration_offline_round_trip` (asserts `USING ivfflat` in DDL); `tests/unit/test_p1_schema.py::test_migration_0006_drive_chunk_provenance_round_trip` (P9 additive migration up/down). |
| Daily diff-based ingest | P9 | AC-D22 | `app/domain/drive_rag.py`, `app/domain/drive_source.py`, `app/routers/rag.py` | built | `tests/integration/test_p9_drive_ingest.py::test_ingest_skips_unchanged_files_via_hash`; `::test_ingest_reembeds_changed_files`; `::test_ingest_drops_chunks_for_deleted_files`; `::test_ingest_drive_source_failure_is_fail_soft_per_file` (PR-019 isolation pattern); `tests/unit/test_p9_drive_ingest_diff.py` (6 tests pinning the four diff arms). Admin-triggered via `POST /v1/admin/drive/ingest` at P9; beat-schedule wiring deferred to P11. |
| Chunk + embed (`text-embedding-3-small`) | P9 | AC-D22; AC-CD9 | `app/ai/openai.py`, `app/domain/drive_rag.py` | built | `tests/unit/test_p9_openai_embed.py` (7 tests: happy path, routing guard, tenacity retry on 5xx, no-retry on auth, empty-data guard, cost-table regression); `tests/unit/test_p9_drive_chunker.py` (11 tests pinning chunker invariants); `tests/integration/test_p9_drive_ingest.py::test_ingest_seeds_chunks_with_full_provenance` (per-chunk AIProvenanceMixin stamping); `::test_ingest_embedding_spend_surfaces_via_drive_chunk_provenance` (ROADMAP P9 done-when "embedding spend appears against OpenAI in cost"). |
| RAG injection at generation | P9 | AC-D22 | `app/ai/prompts/generation.py`, `app/ai/prompts/learning_material.py`, `app/domain/attempts.py`, `app/domain/learning_material.py`, `app/domain/calibration.py`, `app/domain/drive_rag.py` | built | `tests/integration/test_p9_rag_retrieval.py::test_per_testee_start_attempt_embeds_query_and_injects_context`; `::test_per_testee_self_initiated_no_assignment_no_rag`; `::test_per_testee_learning_path_assignment_no_rag`; `::test_per_testee_empty_chunk_index_renders_none_sentinel`; `::test_query_text_matches_pill_name_description_difficulty_band`; `::test_embed_failure_falls_through_to_empty_context_per_spec_61`; `::test_top_k_caps_at_five_against_larger_chunk_index`; `::test_learning_material_generate_for_weakness_injects_rag`; `::test_anchor_bootstrap_caches_rag_per_band_one_embed_per_band`; `::test_query_side_embed_writes_rag_retrieve_audit_for_spend_dashboard`. Query-side embed cost folds into `current_month_spend` via `_rag_retrieve_spend` audit-log walk (`tests/unit/test_p9_rag_retrieve_spend.py` — 6 tests). |
| Realism flag + nightly aggregation | P9 | AC-D22 | `app/routers/rag.py`, `app/domain/drive_rag.py`, `app/ai/prompts/generation.py`, `app/ai/prompts/learning_material.py` | built | `tests/integration/test_p9_realism_flag.py::test_testee_flag_creates_realism_flag_with_server_context` (server-derived `generation_context` per AC-D22); `::test_double_flag_is_idempotent_returns_existing_row` (unique-constraint short-circuit); `::test_testee_cannot_flag_question_from_anothers_attempt` (privacy 404); `::test_testee_cannot_flag_question_not_in_attempt_snapshot`; `::test_admin_cannot_flag_realism_role_restricted_to_testee` (AC-D22 trust-hierarchy); `::test_admin_aggregate_updates_realism_flag_count_weighted` (hybrid mean weighting); `::test_aggregate_uses_neutral_half_weight_for_zero_attempts_testees`; `::test_high_flag_ratio_anchor_gets_excluded_from_pool` (anchor `excluded=True` + reason — existing P8 `draw_anchors_for_attempt` filter respects it); `::test_low_flag_ratio_anchor_stays_live`; `::test_low_realism_questions_feed_into_generation_payload` (the loop closes: flag → aggregate → next generation sees as negative example); `::test_aggregate_uses_single_query_for_all_anchor_serve_counts` (N+1 regression guard for the batched serve-count fold). Admin-triggered via `POST /v1/admin/realism/aggregate` at P9; beat-schedule wiring deferred to P11. |

## P10 — JIT streaming generation (per-Testee)

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| SSE stream endpoint | P10 | AC-D25; AC-CD10 | `app/routers/attempts.py` | built | `tests/integration/test_p10_sse_stream.py::test_sse_cold_open_after_post_streams_q2_through_qn` (4 events Q2..Q5, terminal `done`, text/event-stream content-type); `::test_sse_reconnect_with_last_event_id_skips_replayed_positions` (Last-Event-ID cursor); `::test_sse_reconnect_default_cursor_replays_persisted_questions` (defensive cursor=0); `::test_sse_returns_409_for_benchmark_mode`; `::test_sse_returns_409_for_frozen_mode`; `::test_sse_404_for_other_testee_attempt` (auth shape matches view_attempt). |
| Q1 sync + Q2…N parallel tasks | P10 | AC-D25; AC-CD10 v1.8 | `app/domain/streaming.py`, `app/domain/attempts.py` (per-Testee branch), `app/routers/attempts.py` (SSE handler) | built | `tests/integration/test_p10_start_attempt_streaming.py::test_per_testee_start_persists_q1_only` (Q1 sync at attempt_position=1, 1:1 provenance); `::test_per_testee_start_uses_question_count_1_per_spec_61_v18` (SPEC §6.1 v1.8 per-question pattern); `::test_q1_failure_after_retry_raises_typed_error` (503 q1_generation_failed after one orchestration-layer retry); `::test_q1_retry_once_then_success`; `tests/unit/test_p10_streaming_orchestrator.py::test_semaphore_bounds_concurrent_provider_calls` (asyncio.Semaphore bound); `::test_positions_assigned_at_enqueue_time_never_race` (single-writer position alloc); `::test_orchestration_retry_once_then_success`; `::test_failure_after_retry_pauses_attempt_and_raises`; `::test_other_in_flight_tasks_persist_before_pause` (v1.8 "partial progress preserved"); `::test_externally_cancelled_jit_task_does_not_leak_still_pending` (Gitar PR-#23 Slice 2 finding #1 — Python 3.11+ cancellation correctness). |
| Configurable buffer (3/max 5) | P10 | AC-D25; AC-CD10 v1.8 | `app/config.py`, `app/routers/attempts.py` | built | `Settings.jit_buffer_size: int = 3` + `Settings.jit_buffer_max: int = 5` at `app/config.py:80-81` (shipped P5, contract-locked at v1.8); `Settings.jit_persist_grace_seconds: int = 10` at `app/config.py:84` (new P10 SSE-disconnect grace); `tests/unit/test_p10_streaming_orchestrator.py::test_semaphore_bounds_concurrent_provider_calls` pins the bound under load (max_concurrent never exceeds Semaphore size). |
| Autosave/resume snapshot-replay | P10 | AC-D17, AC-D25; AC-CD10 v1.8 | `app/domain/attempts.py` (view_attempt per-Testee branch), `app/routers/attempts.py` (SSE replay) | built | `tests/integration/test_p10_start_attempt_streaming.py::test_view_attempt_per_testee_merges_anchors_and_db_questions` (snapshot anchors + DB per-Testee rows merged); `::test_view_attempt_per_testee_sorts_db_questions_by_attempt_position` (Python-side sort for AC-CD15 — FakeSession has no ORDER BY); `tests/integration/test_p10_sse_stream.py::test_sse_after_pause_then_resume_re_orchestrates_unfilled_only` (resume re-orchestrates only unfilled positions, no Q1 / completed-Q regeneration — ROADMAP P10 done-when "resume replays the snapshot with stable order and no regeneration"); migration `alembic/versions/0007_p10_question_position.py` lands `question.attempt_position` + unique `(attempt_id, attempt_position)` (asserted by `tests/unit/test_p4_schema.py::test_question_attempt_position_unique_constraint_present` and `tests/unit/test_p1_schema.py::test_migration_0007_question_position_round_trip`). |
| Benchmark stays sequential | P10 | AC-D13, AC-D25 | `app/routers/attempts.py` | built | `tests/integration/test_p10_sse_stream.py::test_sse_returns_409_for_benchmark_mode` (benchmark POST → AttemptView with empty snapshot, no `q1`; SSE GET → 409 `not_per_testee`); benchmark sequential path through `POST .../next` unchanged from P4 (test_p4_attempts.py exercises). |

## P11 — Bootstrap, safety links, crons, cost, comms

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Idempotent bootstrap job | P11 | AC-D23; AC-CD7 | `app/domain/bootstrap.py`, `app/domain/calibration.py` (`top_up` mode), `app/routers/admin.py` (`/v1/admin/bootstrap/run`) | built | `tests/integration/test_p11_bootstrap_idempotent.py::test_bootstrap_run_populates_all_four_steps` (4-step first-run); `::test_bootstrap_re_run_is_counter_zero_no_op` (AC-CD7 idempotency); `::test_bootstrap_adding_new_pill_only_touches_that_pill` (incremental); `::test_bootstrap_skips_retired_pills` (AC-D14); `::test_bootstrap_skips_drive_when_folder_unconfigured` (operator-visible signal); `::test_bootstrap_run_endpoint_returns_telemetry` (admin trigger + audit); `tests/integration/test_p11_anchor_top_up.py` (5 tests for the `top_up=True` deficit math + AC-CD7 idempotency). |
| Safety-link curation + monthly check | P11 | AC-D21 | `app/domain/safety_links.py`, `app/domain/web_search.py` (NEW), `app/routers/admin.py` (`/v1/admin/safety-links/check`) | built | `tests/integration/test_p11_safety_link_curation.py::test_curate_links_writes_rows_for_safety_pill` (3-link write + audit); `::test_curate_links_dedupes_against_existing_urls` (Gitar PR-#24 Slice 3 finding #1 regression); `::test_curate_links_idempotent_when_at_quota` (AC-CD7); `::test_check_safety_links_drift_writes_audit_no_ai_call` (SHA-256 binary mismatch → audit; no AI call per AC-CD8 v1.6); `::test_check_safety_links_broken_triggers_top_up` (best-effort top-up); `tests/unit/test_p11_web_search.py::test_tavily_missing_api_key_fails_fast_without_retry` (Gitar PR-#24 Slice 3 finding #2 regression). |
| Seven crons scheduled | P11 | AC-CD7 | `app/beat_schedule.py`, `app/worker.py` | built | `tests/integration/test_p11_beat_schedule.py::test_beat_schedule_has_exactly_seven_entries` (CODE_SPEC §8 verbatim); `::test_beat_schedule_each_entry_has_task_and_schedule` (crontab shape); `::test_beat_schedule_celery_app_carries_schedule` (`make_celery` wires the dict); `::test_celery_app_registered_tasks_include_all_seven` (registry); `tests/unit/test_p11_celery_wrappers.py` (7 wrapper smoke tests). |
| Cost dashboard + budget alerts | P11 | AC-D18 | `app/routers/cost.py` (P5), `app/ai/cost.py::maybe_fire_budget_alert` (P5), `app/worker.py::cost_budget_sweep_task` (P11 cron wrapper) | built | `tests/integration/test_p5_cost_dashboard.py` (P5 baseline — dashboard endpoint shape); `tests/integration/test_p5_budget_alert.py` (P5 baseline — threshold dedupe + email capture); `tests/unit/test_p11_celery_wrappers.py::test_cost_budget_sweep_task_returns_thresholds_fired_shape` (P11 cron wrapper smoke); `app/beat_schedule.py::cost.budget_sweep` (daily 06:00 UTC). |
| SMTP (setup/reset/reminder/escalation) | P11 | AC-D26 | `app/permissions.py::SMTPClient` (P2), `app/domain/engagement.py::run_engagement_sweep` (P4), `app/worker.py::engagement_sweep_task` (P11 wrapper), `app/beat_schedule.py::engagement.sweep` | built | `tests/integration/test_p4_engagement.py` (P4 baseline — reminder/escalation email content + AC-D26 schedule); `tests/unit/test_p11_celery_wrappers.py::test_engagement_sweep_task_returns_zero_counts_on_empty_store` (P11 cron wrapper). Setup/reset email content + budget-alert email shipped in P2/P5 — every non-auth SMTP route through the same `SMTPClient` seam. |
| Attempt PDF export | P11 | AC-D26 | `app/domain/pdf.py` (NEW), `app/routers/attempts.py` (`GET /v1/attempts/{id}/export.pdf`) | built | `tests/integration/test_p11_pdf_export.py::test_pdf_export_deterministic_attempt_returns_application_pdf` (PDF magic bytes + MIME + attachment header); `::test_pdf_export_404_for_non_owner_non_admin` (ownership gate); `::test_pdf_export_admin_can_read_any_attempt` (admin bypass); `::test_pdf_export_422_for_unsubmitted_attempt` (submission gate); `::test_pdf_export_escapes_xml_special_chars_in_prompt_and_test_name` (Gitar PR-#24 Slice 1 finding #1 regression — `escapeOnce` + `anyio.to_thread.run_sync`). |

---

## Drift questions

Open, unresolved items the build must close. Resolved spec/implementation
divergences are recorded in per-PR handovers, not here.

*None.* Two historical drift questions, both closed:

- **AC-CD11** — opened during v1.0 spec authoring (cross-family
  review pipeline & latency budget); **closed at v1.7** (cross-family
  review locked as batched per attempt, 60-s hard ceiling, over-
  ceiling routes to the v1.6 grade-review reconcile cron). See
  `handovers/PR-017-v1.7-ac-cd11-gate-closure.md`, `CODE_SPEC.md`
  §18 AC-CD11, `DECISIONS.md` AC-D19.
- **AC-CD10** — surfaced at the P10 plan-mode gate as a residual
  §10 prose-body ambiguity (the "parallel Celery tasks" wording
  alongside the SSE response shape, with no schema anchor for
  streamed-arrival order and no explicit single-failure policy);
  **closed at v1.8** (in-process `asyncio.gather` +
  `asyncio.Semaphore`, `question.attempt_position` ordering column,
  single-Q-N-retry then AC-D11 pause). See
  `handovers/PR-022-v1.8-ac-cd10-gate-closure.md`, `CODE_SPEC.md`
  §10 / §18 AC-CD10, `DECISIONS.md` AC-D25 v1.8.

> Note: the v1.2 benchmark/JIT prose divergence (SPEC §4.3/§4.7/§4.12/
> §6.1, DECISIONS AC-D13 vs amended AC-D25) was **resolved inline** in
> the v1.2 spec-clarification commit and is deliberately *not* a drift
> question here.

*End of Acumen CHECKLIST. Paired with `ROADMAP.md`, `CODE_SPEC.md`,
`SPEC.md` v1.2, `DECISIONS.md` v1.2.*
