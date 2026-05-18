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

## P4 — Tests, assignments, attempts (deterministic)

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Four test modes data path | P4 | AC-D5 | `app/routers/tests.py` | missing | |
| Frozen attempt snapshot | P4 | AC-D17 | `app/routers/attempts.py` | missing | |
| Presentation shuffle from seed | P4 | AC-D24 | `app/domain/streaming.py` | missing | |
| Deterministic grading (MCQ/TF/matching) | P4 | AC-D5 | `app/routers/grading.py` | missing | |
| Derived `engagement_status` | P4 | AC-D26 | `app/domain/engagement.py` | missing | |
| Pause blanks content | P4 | AC-D11 | `app/routers/attempts.py` | missing | |

## P5 — AI provider layer + 5 Anthropic ops

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| `AIProvider` abstraction + resolution order | P5 | AC-D12; AC-CD8 | `app/ai/provider.py` | missing | |
| VCS prompt registry + persisted version | P5 | AC-CD8 | `app/ai/prompts/` | missing | |
| Per-call cost capture | P5 | AC-D18; AC-CD8 | `app/ai/cost.py` | missing | |
| 5 Anthropic ops (non-streaming) | P5 | AC-D12 | `app/ai/anthropic.py` | missing | |
| Model-ID env defaults | P5 | AC-CD18 | `app/config.py` | missing | |

## P6 — Cross-family review

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| **AC-CD11 latency rule resolved (gate)** | P6 | AC-CD11 | `CODE_SPEC.md` | missing | |
| Synchronous OpenAI review before stamp | P6 | AC-D19 | `app/routers/review.py` | missing | |
| Fail-soft "review pending" + reconcile cron | P6 | AC-D19 | `app/domain/`,`app/beat_schedule.py` | missing | |
| Admin flag queue | P6 | AC-D19 | `app/routers/admin.py` | missing | |

## P7 — Adaptive loop, competence, integrity

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Weakness -> material -> retest loop | P7 | AC-D6 | `app/routers/loop.py` | missing | |
| `competence_estimate` IRT + decay | P7 | AC-D9; AC-CD13 | `app/domain/competence.py` | missing | |
| Null competence -> "no data yet" | P7 | AC-D9 | `app/domain/competence.py` | missing | |
| N-gram overlap flag | P7 | AC-D4 #5; AC-CD14 | `app/domain/ngram.py` | missing | |

## P8 — Anchor calibration

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Anchor pool generation per band | P8 | AC-D20 | `app/domain/calibration.py` | missing | |
| Per-attempt anchor draw record | P8 | AC-D20 | `app/routers/attempts.py` | missing | |
| Bayesian-shrinkage `effective_difficulty` | P8 | AC-D27; AC-CD12 | `app/domain/calibration.py` | missing | |
| Fresh-question delta | P8 | AC-D27; AC-CD12 | `app/domain/calibration.py` | missing | |
| `preliminary -> confident` at n threshold | P8 | AC-D20 | `app/routers/calibration.py` | missing | |

## P9 — Drive RAG + realism feedback

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| pgvector IVFFlat index | P9 | AC-CD9 | `app/models.py` | missing | |
| Daily diff-based ingest | P9 | AC-D22 | `app/domain/drive_rag.py` | missing | |
| Chunk + embed (`text-embedding-3-small`) | P9 | AC-D22; AC-CD9 | `app/domain/drive_rag.py` | missing | |
| RAG injection at generation | P9 | AC-D22 | `app/ai/anthropic.py` | missing | |
| Realism flag + nightly aggregation | P9 | AC-D22 | `app/routers/rag.py`,`app/beat_schedule.py` | missing | |

## P10 — JIT streaming generation (per-Testee)

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| SSE stream endpoint | P10 | AC-D25; AC-CD10 | `app/routers/attempts.py` | missing | |
| Q1 sync + Q2…N parallel tasks | P10 | AC-D25 | `app/domain/streaming.py`,`app/worker.py` | missing | |
| Configurable buffer (3/max 5) | P10 | AC-D25 | `app/domain/streaming.py` | missing | |
| Autosave/resume snapshot-replay | P10 | AC-D17,25 | `app/domain/streaming.py` | missing | |
| Benchmark stays sequential | P10 | AC-D13,25 | `app/routers/attempts.py` | missing | |

## P11 — Bootstrap, safety links, crons, cost, comms

| Capability | Phase | Anchors | Files to touch | Status | Evidence |
|---|---|---|---|---|---|
| Idempotent bootstrap job | P11 | AC-D23; AC-CD7 | `app/domain/bootstrap.py` | missing | |
| Safety-link curation + monthly check | P11 | AC-D21 | `app/domain/safety_links.py` | missing | |
| Six crons scheduled | P11 | AC-CD7 | `app/beat_schedule.py` | missing | |
| Cost dashboard + budget alerts | P11 | AC-D18 | `app/routers/cost.py` | missing | |
| SMTP (setup/reset/reminder/escalation) | P11 | AC-D26 | `app/domain/` | missing | |
| Attempt PDF export | P11 | AC-D26 | `app/routers/attempts.py` | missing | |

---

## Drift questions

Open, unresolved items the build must close. Resolved spec/implementation
divergences are recorded in per-PR handovers, not here.

1. **AC-CD11 — cross-family review latency rule (P6 gate).** Is the
   AC-D19 review per-response sequential, batched, or parallel, and what
   is the hard latency ceiling before the fail-soft "review pending" path
   triggers? **Unresolved.** Must be answered with the user at the P6
   gate before the blocking submit path is built. Recorded in CODE_SPEC
   AC-CD11.

> Note: the v1.2 benchmark/JIT prose divergence (SPEC §4.3/§4.7/§4.12/
> §6.1, DECISIONS AC-D13 vs amended AC-D25) was **resolved inline** in
> the v1.2 spec-clarification commit and is deliberately *not* a drift
> question here.

*End of Acumen CHECKLIST. Paired with `ROADMAP.md`, `CODE_SPEC.md`,
`SPEC.md` v1.2, `DECISIONS.md` v1.2.*
