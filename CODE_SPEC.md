# CODE_SPEC — Acumen technical specification & stack lock (canonical)

> **Companion to** `SPEC.md` (functional, v1.8) and `DECISIONS.md`
> (product anchors AC-D1–AC-D27, v1.8). This document is the canonical
> **technical** specification and stack lock.
>
> **Authority:** the codebase is the source of truth. Target-state items
> not yet built are marked `(pending P{n})` against the ROADMAP phase that
> delivers them. Where this document and a built artifact disagree, the
> artifact wins and the divergence is recorded as a CHECKLIST drift
> question.
>
> **Decision prefix:** `AC-CD{n}` for technical/code decisions, anchored in
> §18 below. Product decisions remain `AC-D{n}` in `DECISIONS.md`.
>
> **Status:** v1 target. Paired with `SPEC.md` v1.9 / `DECISIONS.md` v1.9.
>
> **Portability stance:** standalone-first. Acumen ships as a standalone
> app and later folds into the SiteMesh platform as a peer Workflow module
> (SPEC §9). The build adopts SiteMesh's *low-cost* conventions now
> (directory shape, SQLAlchemy 2.0 patterns, Alembic-per-schema, version
> pins, doc discipline) and documents explicit **port seams** for the
> heavy platform machinery (Auth Hub, MeshCore envelopes, workstream/RLS,
> 6-gate chain) rather than building it in v1.

---

## 1. Architecture overview

Acumen is a **single FastAPI service** plus a **Celery worker** and a
**Celery beat** scheduler, backed by **PostgreSQL with the pgvector
extension** and **Redis** as the broker/result backend.

Layering (request inward):

```
HTTP (FastAPI routers, /v1)            app/routers/*.py
  -> service/domain layer              app/domain/*.py
  -> models (SQLAlchemy 2.0)           app/models.py
  -> PostgreSQL + pgvector
AI provider layer (Anthropic, OpenAI)  app/ai/*
Background layer (Celery worker+beat)  app/worker.py, app/beat_schedule.py
```

- Routers are thin: request validation (Pydantic v2), authz dependency,
  delegate to the domain layer, shape the response envelope. No business
  logic in routers.
- The domain layer holds the statistically and operationally significant
  code: calibration (AC-D20/AC-D27), competence (AC-D9), n-gram overlap
  (AC-D4 #5), JIT streaming (AC-D25), Drive RAG (AC-D22), bootstrap
  (AC-D23), safety-link curation (AC-D21).
- Module boundaries map 1:1 to SPEC §5 entities. Each `routers/*.py` file
  owns one domain.
- **Port seams** are concentrated, not diffused: auth
  (`app/routers/auth.py` + `app/permissions.py`), the internal API
  surface (`app/routers/internal.py`, reserved, empty in v1), and the
  provider/comms layer. SPEC §9 mappings are annotated at each seam.

---

## 2. Stack lock — exact version pins

Pins mirror the SiteMesh `fieldops` module exactly where shared, so the
eventual port is mechanical. Acumen-only additions carry a rationale.

| Package | Version | Source |
|---|---|---|
| Python | 3.12-slim | SiteMesh base image |
| `fastapi` | `0.115.0` | SiteMesh shared |
| `uvicorn[standard]` | `0.30.6` | SiteMesh shared |
| `pydantic` | `2.8.2` | SiteMesh shared |
| `pydantic-settings` | `2.4.0` | SiteMesh shared |
| `sqlalchemy[asyncio]` | `2.0.35` | SiteMesh shared |
| `asyncpg` | `0.29.0` | SiteMesh shared (async driver) |
| `psycopg[binary]` | `3.2.1` | SiteMesh shared (migration driver) |
| `alembic` | `1.13.3` | SiteMesh shared |
| `celery` | `5.4.0` | SiteMesh shared |
| `redis[hiredis]` | `5.0.8` | SiteMesh shared |
| `httpx` | `0.27.2` | SiteMesh shared |
| `PyJWT[crypto]` | `2.10.1` | SiteMesh shared |
| `python-multipart` | `0.0.9` | SiteMesh shared |
| `orjson` | `3.10.7` | SiteMesh shared |
| `anthropic` | `>=0.39,<1.0` | Acumen: primary AI provider (AC-D12, AC-D18) |
| `openai` | `>=1.30,<2.0` | Acumen: cross-family review (AC-D19) + embeddings (AC-D22) |
| `pgvector` | `>=0.3,<0.4` | Acumen: SQLAlchemy pgvector column type (AC-D22) |
| `google-api-python-client` | `>=2.140` | Acumen: Drive read-only ingest (AC-D22, SPEC §7.3) |
| `google-auth` | `>=2.33` | Acumen: Drive service-account auth |
| `argon2-cffi` | `>=23.1` | Acumen: password hashing (AC-D10) |
| `tenacity` | `>=8.5,<9.0` | Acumen: retry/backoff on external AI + Drive calls |
| `reportlab` | `>=4.0,<5.0` | Acumen: attempt-result PDF export (SPEC §3, P11). Pure-Python (no Dockerfile system deps); spec defers library choice. |
| `tavily-python` | `>=0.3,<1.0` | Acumen: web-search provider for AC-D21 safety-link curation + monthly check (P11). SPEC §7 defers provider; Tavily picked for clean LLM-friendly JSON + low-friction SDK. |
| `pytest` / `pytest-asyncio` | `>=8.0` / `>=0.23` | Acumen: test layer (dev) |

Pins live in `requirements.txt` (HTTP) and `requirements-worker.txt`
(worker; superset including Celery beat). Anchored as **AC-CD1**.

---

## 3. Repository layout

```
acumen/
  app/
    main.py            # setup only: app factory, router include, /healthz /readyz
    config.py          # pydantic-settings; all env, all defaults
    models.py          # SQLAlchemy 2.0 Mapped[]; one acumen schema
    schemas.py         # Pydantic v2 request/response models
    permissions.py     # role-check dependency; port seam to Auth Hub
    worker.py          # make_celery(); task registry
    beat_schedule.py   # the nine crons + bootstrap enqueue (v1.9; AC-CD7)
    routers/
      auth.py users.py groups.py catalogue.py paths.py tests.py
      assignments.py attempts.py grading.py review.py loop.py
      competency.py calibration.py rag.py admin.py cost.py
      internal.py      # reserved; empty in v1 (port seam, /v1/internal)
    ai/
      provider.py      # AIProvider protocol + resolution
      anthropic.py openai.py
      prompts/         # versioned prompt registry (VCS, not DB)
      cost.py          # per-call cost capture
    domain/
      calibration.py competence.py ngram.py streaming.py
      drive_rag.py bootstrap.py safety_links.py engagement.py
  alembic/
    env.py             # CREATE SCHEMA IF NOT EXISTS acumen
    versions/
  alembic.ini          # file_template = %%(rev)s_%%(slug)s
  infra/
    postgres/init.sql  # CREATE EXTENSION vector; schema bootstrap
    traefik/
  tests/
    unit/ integration/ e2e/ conftest.py
  Dockerfile           # multi-stage: base -> http / worker / migrate
  docker-compose.yml
  requirements.txt requirements-worker.txt
  .env.example
```

Layout mirrors the SiteMesh module anatomy with a standalone repo root.
Anchored as **AC-CD2**.

---

## 4. Database schema & migration strategy

Single Postgres schema **`acumen`**. The `pgvector` extension is created
in `infra/postgres/init.sql` and asserted in the first Alembic migration.
Alembic `env.py` runs `CREATE SCHEMA IF NOT EXISTS acumen` before
autogeneration, matching the SiteMesh per-schema pattern;
`file_template = %%(rev)s_%%(slug)s`; every `upgrade()` has a real
`downgrade()`.

Conventions (mirror SiteMesh `models.py`):

- UUID primary keys, `server_default=text("gen_random_uuid()")`.
- `created_at` / `updated_at` timestamptz on every table,
  `server_default=text("now()")`, `updated_at` via `onupdate`.
- Per-table `__table_args__ = {"schema": "acumen"}`.
- A mandatory `processing_tasks` table for async status (SiteMesh
  contract).
- `tenant_id` on every tenant-scoped table, indexed. v1 runs
  single-tenant with one fixed tenant row; the column exists now so the
  SiteMesh multi-tenant port (SPEC §9.9) is a data migration, not a
  schema rewrite. **Port seam:** RLS policies are added at port, not v1.

Entity -> table mapping (SPEC §5 -> `acumen.*`):

| SPEC §5 entity | Table | Key columns / notes |
|---|---|---|
| Tenant | `tenant` | fixed single row in v1 |
| User | `app_user` | email unique, `password_hash`, `role`, `is_active`, `privacy_ack_at` |
| Group | `group`, `group_member` | membership join |
| Subject | `subject` | safety keyword tags (AC-D21) |
| Pill | `pill` | `available_difficulty_min/max` (AC-D9), `is_safety` (AC-D21) |
| Learning Path | `learning_path`, `learning_path_pill` | ordered join |
| Assignment | `assignment` | `engagement_status` derived per (assignment, assignee) at read time from the assignee's attempts (AC-D26 v1.6); not a stored column |
| AssignmentAssignee | `assignment_assignee` | assignee snapshot at creation (AC-D15): `assignment_id`, `user_id`, `via_group_id` nullable (NULL = direct target; non-NULL = via that Group's membership snapshot); unique (`assignment_id`, `user_id`) |
| — | `assignment_reminder` | reminder/escalation send history, assignment-scoped (AC-D26): `assignment_id`, `kind` (reminder/escalation), `sent_at`; per-Testee reminder-cease is derived, not stored here |
| Test | `test` | `mode`, `lock_mode`, `campaign_id`, shuffle flags (AC-D24) |
| Question | `question` | three-way nullable owner `test_id` XOR `attempt_id` XOR `pill_id` (exactly one set: frozen/hand-authored→test, per-Testee→attempt, anchor-pool→pill; AC-D5/D17/D20); `realism_flag_count`, `assigned_difficulty`, `question_group_id`; `attempt_position` nullable INT scoped to the owning attempt for AC-D25 streamed-arrival order, unique `(attempt_id, attempt_position)` (AC-D25 v1.8) — null for `test_id`-owned and `pill_id`-owned rows, set only for attempt-owned per-Testee rows; AI-provenance columns (AC-CD8) |
| Anchor pool | `anchor_question` | per pill+band frozen pool, `effective_difficulty` (AC-D27); the calibration projection of the per-pill anchor questions also reachable via `question.pill_id`; AI-provenance columns (AC-CD8) |
| Attempt | `attempt` | frozen snapshot, `shuffle_seed`, `anchor_draw` (AC-D20); `assignment_id` nullable FK→`assignment`, indexed, set at start_attempt for assignment-driven/loop-driven, null for self-initiated (AC-D26); unique (test_id, testee_id, sequence_number) — retake counter per AC-D3; pause/focus events are child tables (below), not JSON |
| — | `attempt_pause_event` | pause windows (AC-D11): `attempt_id`, `started_at`, `ended_at` nullable, `duration_seconds` nullable, `auto_resumed` bool |
| — | `attempt_focus_event` | tab-switch / focus events (AC-D4 #3): `attempt_id`, `kind` (`focus_event_kind` enum), `occurred_at`, `duration_seconds` nullable |
| Response | `response` | `response_score` 0.0–1.0, `time_ms` |
| Grade | `grade` | score/verdict/source, Anthropic AI-grading provenance (AC-CD8); review fields are NOT here — see `grade_review` |
| Cross-family review | `grade_review` | 1:1 with `grade` (`grade_id` unique); `status` {pending, confirmed, flagged} + `review_reasoning`; OpenAI review provenance (AC-CD8); created only for AI-graded responses (deterministic grades have no row); cron reconcile updates in place, no history (AC-D19 v1.6) |
| WeaknessReport | `weakness_report` | per attempt; AI-generation provenance columns (AC-CD8 / F7) |
| LearningMaterial | `learning_material` | `served_at` + `served_text` (the `ai_generated` explainer snapshot — the n-gram comparison base for AC-D4 #5); `source`; AI-generation provenance columns (AC-CD8) |
| CompetencyProfile | `competency_profile` | `competence_estimate` float per Testee+pill (AC-D9) |
| DriveIndex | `drive_chunk` | `embedding vector(1536)`, source ref, indexed-at (AC-D22) |
| Realism flag | `realism_flag` | per question per Testee |
| SystemSettings | `system_settings` | one row per tenant; all knobs (below) incl. `model_by_operation`, `provider_by_operation`, `review_provider` (AC-D12); grade-review reconcile interval (5) & max-retry (10) are P6 behavioural defaults, not yet columns |
| AuditLog | `audit_log` | append-only |
| — | `processing_tasks` | async status (SiteMesh contract); pill-proposal store — AI-generation provenance carried in `payload` JSON (AC-CD8 / F7) |
| — | `password_reset_token`, `account_setup_token` | auth (AC-D10) |

Indexing: `tenant_id` on every scoped table; `(pill_id, band)` on
`anchor_question`; `(testee_id, pill_id)` on `competency_profile`;
`attempt.assignment_id`; unique `(test_id, testee_id, sequence_number)` on `attempt` (AC-D3 retake counter); unique `(attempt_id, attempt_position)` on `question` (AC-D25 v1.8 streamed-arrival ordering, attempt-owned rows only — null `attempt_position` is excluded from the unique constraint per Postgres NULL semantics); pgvector index on `drive_chunk.embedding` — **IVFFlat** at v1 scale
(small corpus, simpler than HNSW, adequate recall), revisited if the
corpus grows. Anchored as **AC-CD3** (schema/migration) and **AC-CD4**
(entity mapping & indexing).

`system_settings` columns (defaults from `DECISIONS.md` v1.2):
`monthly_ai_budget` (nullable), `budget_alert_thresholds`,
`self_initiated_rate_limits`, `model_by_operation` (JSON, AC-D12),
`review_provider` (default `openai`, AC-D19),
`pending_assignment_age_threshold_days` (7), `reminder_schedule_*`,
`escalation_enabled`, `competence_decay_halflife_days` (90),
`competence_sensitivity` (2.0), `max_pause_duration_minutes` (30),
`safety_keyword_list`, `anchor_pool_size_per_band` (20),
`anchor_calibration_confidence_threshold` (20),
`anchor_calibration_prior_weight` (20), `drive_folder_id`,
`embedding_model` (default `text-embedding-3-small`).

**Intentionally outside `system_settings` (v1.8 dispositions).** Some
behavioural knobs surfaced across P6–P10 remain code constants or
env-defaults rather than `system_settings` columns. The policy: a knob
migrates to `system_settings` when an operational signal surfaces
(operator-tuning request, repeated incident, telemetry-driven threshold
sweep). Until then it stays put — schema stays minimal, default lives
where it was authored. The snapshot below is the v1.8 default
disposition, not a binding promise.

| Knob / semantic | Current home | Default | Anchor | Disposition (v1.8) |
|---|---|---|---|---|
| `GRADE_REVIEW_RECONCILE_INTERVAL_MINUTES` | code constant (`app/domain/grade_review.py`) | 5 | AC-D19 v1.6 / AC-CD11 v1.7 | keep — reconcile cadence; product (5 × 10 = 50 min) is the operator-visible SLA, not the individual knobs |
| `GRADE_REVIEW_MAX_RETRY_ATTEMPTS` | code constant (`app/domain/grade_review.py`) | 10 | AC-D19 v1.6 / AC-CD11 v1.7 | keep — SLA factor pair with the above |
| `GRADE_REVIEW_SUBMIT_CEILING_SECONDS` | code constant (`app/domain/grade_review.py`) | 60.0 | AC-CD11 v1.7 | keep — hard latency ceiling; in-code comment notes promotion conditional on real telemetry |
| `_FLAG_RATIO_EXCLUSION_THRESHOLD` | code constant (`app/domain/drive_rag.py`, module-private) | 0.6 | AC-D22 | keep — P9 anchor-exclusion threshold; same defensive-deviation family as `_WELL_BELOW_DIFFICULTY_THRESHOLD` |
| `jit_buffer_size` | env-default (`app/config.py`, Pydantic Settings) | 3 | AC-D25 v1.8 / AC-CD10 | keep — already env-tunable without redeploy |
| `jit_buffer_max` | env-default (`app/config.py`) | 5 | AC-D25 v1.8 / AC-CD10 | keep — env-tunable ceiling |
| `jit_persist_grace_seconds` | env-default (`app/config.py`) | 10 | AC-CD10 v1.8 | keep — SSE cancellation grace; orchestrator-cleanup implementation choice |
| `accept_reviewer` pessimistic-zero semantic | P6 implementation (`app/domain/grade_review.py`) | n/a | AC-D19 v1.6 | keep — admin action documented in AC-D19; the phrase "pessimistic zero" stays uncodified in the anchor until an operator questions the zeroing behaviour |

Migration of any row is a follow-up doc-only AC-D / AC-CD amendment
plus the corresponding Alembic migration.

---

## 5. API shape & conventions

- REST under `/v1`. OpenAPI auto-served by FastAPI.
- Error envelope (uniform): `{"error": {"code": str, "message": str,
  "detail": object|null}}`. Success returns the resource, or
  `{"data": ..., "meta": {...}}` for collections.
- Cursor pagination on collections (`?cursor=&limit=`), `meta.next_cursor`.
- Autosave endpoints accept partial response state and are idempotent on
  `(attempt_id, question_id)`.
- The per-Testee attempt question feed is an **SSE stream** endpoint
  (`GET /v1/attempts/{id}/stream`) per AC-D25. Benchmark mode uses a
  plain request/response `POST /v1/attempts/{id}/next` (sequential, per
  amended AC-D25).
- `/v1/internal` is reserved and unmounted in v1. **Port seam:** the
  SiteMesh internal/MeshCore surface mounts here behind
  `!PathPrefix(/v1/internal)` at the Traefik edge (SPEC §9).

Anchored as **AC-CD6**.

---

## 6. Auth & authz

Email + password, hashed with **argon2id** (`argon2-cffi`). JWT session
token (`PyJWT[crypto]`, short-lived access + refresh). Admin creates
users (AC-D2); account activation and password reset use single-use,
expiring tokens in `account_setup_token` / `password_reset_token`
(AC-D10). A FastAPI dependency in `app/permissions.py` enforces
role-checks; a deactivation gate rejects `is_active = false` before any
handler runs; a privacy-notice acknowledgement gate (AC-D16, simplified
§8.7) blocks protected routes until `privacy_ack_at` is set.

**Port seam:** at SiteMesh port, `app/permissions.py` and
`app/routers/auth.py` are replaced by the Auth Hub integration (SPEC
§9.2); JWT issuance moves to the Hub. The role model and the
deactivation/privacy gates are written as a single dependency so the swap
is one file. Anchored as **AC-CD5**.

---

## 7. AI provider abstraction

`app/ai/provider.py` defines an `AIProvider` protocol: `generate()`,
`grade()`, `review()`, `embed()`. Concrete implementations:
`anthropic.py` (primary), `openai.py` (cross-family review per AC-D19 and
embeddings per AC-D22).

Per-operation resolution order (AC-D12): **Test-level override -> system
override (`model_by_operation`) -> coded default**. Defaults are
**env-overridable model IDs**, never hard-coded: latest Claude Sonnet for
generation/grading/weakness/material/pill-proposal; a current OpenAI
model for cross-family review; `text-embedding-3-small` for embeddings
(AC-D22). Anchored as **AC-CD18** (model-ID defaults).

Prompts are a **versioned registry in VCS** (`app/ai/prompts/`), each
prompt a file with an embedded semantic version; the version used is
persisted on every `grade`/`question` row for reproducibility. Every
provider call captures token counts and computed cost via
`app/ai/cost.py`, written against the owning provider (embedding cost ->
OpenAI, per amended AC-D18). `tenacity` wraps external calls with bounded
exponential backoff. Anchored as **AC-CD8**.

**(v1.6, AC-CD8)** Every provider call carries an `operation` enum
{generation, grading, weakness, learning_material, pill_proposal,
grade_review, anchor_self_review, **pill_generation** (v1.9),
**content_self_review** (v1.9, protocol per AC-D30)}; the enum (not
the method) drives per-operation model + prompt_version resolution and
cost/provenance persistence. **(v1.9, AC-CD8 — PR-B)** The named operation
count moves **seven → nine** (`pill_generation` Anthropic-family +
`content_self_review` cross-family; `embed` remains the internal,
un-counted enum member). The **nine** operations route to the four protocol
methods:
generation / weakness / learning_material / pill_proposal / **pill_generation** -> `generate()`;
grading -> `grade()`; grade_review / anchor_self_review / **content_self_review** -> `review()`;
embed (reference-corpus acquisition per AC-CD25 / amended AC-D22; legacy Drive RAG retired, NS-1) -> `embed()`. Resolution order per operation per
AC-D12: Test override -> `system_settings.provider_by_operation` /
`model_by_operation` -> coded default; `review_provider` is the
convenience default for grade_review / anchor_self_review. Provenance
(provider, model, prompt_version, prompt_tokens, completion_tokens,
cost_usd) persists on **every** AI-produced entity — the shipped
AI-provenance columns on `grade`, `grade_review`, `question`,
`anchor_question`, `weakness_report`, `learning_material`, and the
`processing_tasks.payload` for pill proposals (SPEC §6 literal reading;
broadens the earlier "every grade/question row" wording).

The `learning_material` op carries two prompt variants in the registry
(AC-D6 weakness-driven `default` + AC-D8 `self_initiated`); the domain
layer (`app/domain/learning_material.py::generate_for_weakness` /
`generate_self_initiated`) selects the variant via the `_prompt_variant`
payload key the Anthropic provider pops before render, so the same
provider entrypoint serves both pathways and each variant's version
stamps independently on its produced rows.

---

## 8. Background processing

Celery + Redis. `app/worker.py` exposes `make_celery(...)` (SiteMesh
pattern). `processing_tasks` rows track async work
(`pending|running|done|failed` + payload + error). `app/beat_schedule.py`
registers the nine crons (SPEC §8.9, final count v1.9): corpus refresh
(weekly, AC-CD25 — replaces the retired Drive ingest per NS-1),
gap-detection sweep + catalogue-health check (the autonomous-content
workstream's two §6.5 crons), anchor
calibration recompute (daily), realism aggregation (nightly), safety-link
check (monthly), cost/budget sweep (daily), reminder/escalation sweep
(daily), grade-review reconcile (every N minutes, default 5 — retries
pending `grade_review` rows against the configured review provider,
updating in place to confirmed/flagged on success, leaving pending on
continued failure; the interval is a P6 behavioural default, not yet a
`system_settings` column) (AC-D19 / F3). The AC-D23 bootstrap run is an **idempotent enqueued job**
(re-runnable; skips already-populated anchors/links/index). Anchored as
**AC-CD7**.

---

## 9. Vector store (AC-D22)

`drive_chunk.embedding` is `vector(1536)` (`text-embedding-3-small`).
Default chunk size ~500 tokens (configurable). Daily diff-based ingest:
hash each Drive file, re-embed only changed/new files, drop chunks for
deleted files. IVFFlat index (§4). Retrieval injects top-k chunks into
the generation prompt at test generation (SPEC §6.1) and learning-
material generation (SPEC §6.4). Embedding spend tracked to OpenAI.
Covered by **AC-CD9** (confident — embedding provider/model resolved by
v1.2 AC-D22/§7.3).

---

## 10. Streaming generation (AC-D25)

Per-Testee mode only. On attempt start: Q1 is generated **synchronously**
(in-request, ~3s); the SSE stream opens; Q2…N are generated by
**concurrent `asyncio` tasks in the same uvicorn worker that owns the
SSE response**, bounded by an `asyncio.Semaphore` whose size equals
`Settings.jit_buffer_size` (env-default 3); the hard ceiling is
`Settings.jit_buffer_max` (env-default 5). Each completed question is
pushed onto the stream as it resolves. A configurable buffer (default
3, max 5) is maintained ahead of the Testee's position; outrunning it
yields a brief "preparing next question" frame. Autosave snapshots
both responses and the generated question set keyed by attempt;
refresh/resume replays the snapshot — no regeneration, stable order
(AC-D17 / AC-D24 seed / AC-D25 `attempt_position`).

Stable streamed-arrival order is anchored by `question.attempt_position`
(see §4 — nullable INT scoped to the owning attempt, unique
`(attempt_id, attempt_position)`). Q1 lands at position 1
synchronously; Q2…N slots are assigned at enqueue time (positions
2…N), not at generation-completion time, so the ordering is stable
regardless of which task resolves first. Anchor questions (AC-D20)
interleave at positions decided at draw time. The SSE event-id is the
`attempt_position`; clients reconnecting set `Last-Event-ID` and the
server replays already-completed questions from the DB in
`ORDER BY attempt_position` before continuing any remaining slots.

Failure modes: Q1 failure -> attempt cannot start, typed error.
A single Q-N generation failure is retried **once** at the
orchestration layer (above the existing tenacity HTTP-level retries
inside `app/ai/anthropic.py::_invoke`). If the second attempt also
fails, the in-flight attempt is **paused** via the existing AC-D11
pause mechanism; other in-flight Q-N tasks continue and persist their
results before the pause takes effect (partial progress on the
Question table is preserved, never thrown away); on resume the Testee
sees the "retry / abandon" UI. Mid-stream buffer exhaustion -> same
pause-with-retry/abandon disposition.

**Benchmark mode is explicitly out of scope here** — sequential
`POST .../next` per amended AC-D25. Covered by **AC-CD10**
(confident — benchmark/JIT tension resolved by the v1.2 AC-D25
carve-out; execution model + ordering column + single-failure policy
locked at v1.8).

---

## 11. Cross-family review (AC-D19)

After AI grading completes on the attempt's AI-graded responses, a
**synchronous** OpenAI review pass runs before the band stamp displays.
The review is **batched per attempt** — one review call per submit
reviews every AI-graded response together — with a **60-second hard
ceiling at the submit path** (AC-CD11 v1.7). On provider error/timeout
or ceiling-exceeded the path **fails soft**: every `grade_review` row
for the attempt is marked `pending`, a preliminary result page renders,
and the §8 grade-review reconcile cron picks the rows up on its next
pass. Flagged reviews surface in an admin queue. Covered by
**AC-CD11** (resolved at v1.7 — see §18).

**(v1.6)** The reconcile runs on the dedicated grade-review reconcile cron
(§8, SPEC §8.9). `grade_review` is 1:1 with `grade`, updated **in place**
(no history); only AI-graded responses (short_answer, scenario) get a
`grade_review` row. Flagged → the Testee sees a provisional "under admin
review" state, not the AI grade, until an admin resolves the flag. After
N consecutive failed retries (default 10; a P6 behavioural default, not
yet a `system_settings` column) a `pending` row auto-promotes to
`flagged` with reasoning `auto_flagged_stuck_pending`. Confirmed and
flagged remain the only terminal states (AC-D19 v1.6).

**(v1.7)** At the v1.6 defaults (cron every 5 min, max-retry 10) the
auto-promote-to-`flagged` window is ≈50 minutes wall-clock from initial
submit — the operator-visible SLA for "stuck pending".

---

## 12. Anchor calibration (AC-D20 / AC-D27)

`app/domain/calibration.py`. Per pill+band, a frozen anchor pool is
generated at pill creation (default 20). Each attempt records its anchor
draw and per-anchor Testee scores. The daily calibration cron recomputes
**per-anchor `effective_difficulty`** by Bayesian shrinkage toward the
AI-assigned band:

```
effective_difficulty =
  (assigned_difficulty * k + sum(observed_difficulty_i)) / (k + n)
observed_difficulty_i =
  assigned_difficulty + competence_sensitivity * (0.5 - score_i)
```

`k = anchor_calibration_prior_weight` (default 20, = the AC-D20 n
threshold), `n` = recorded attempts on that anchor, result clamped
1.0–10.0. Fresh (non-anchor) questions get
`fresh_effective_difficulty = assigned_difficulty + testee_anchor_delta`,
where `testee_anchor_delta` is the mean
`(anchor_effective_difficulty - assigned_difficulty)` over anchors drawn
into that attempt (0 when no anchors were drawn). Below the n threshold
the estimate is flagged `preliminary` (reuses the AC-D20 qualifier); the
math is defined and stable from n=0. Covered by **AC-CD12** (confident —
formula resolved by v1.2 AC-D27).

---

## 13. Competence estimate (amended AC-D9)

`app/domain/competence.py`. Per response:
`response_competence = effective_difficulty +
competence_sensitivity * (response_score - 0.5)`
(`competence_sensitivity` default 2.0). `attempt_competence` is the mean
across the attempt's responses. The per-Testee-per-pill
`competence_estimate` is a recency-weighted average over attempts with
`weight = 0.5 ^ (age_days / competence_decay_halflife_days)` (half-life
default 90). Zero attempts -> `competence_estimate` null ("no data yet";
the loop treats null as needs-benchmark, not a failing score). Loop
target difficulty = `round(competence_estimate + 0.5)` clamped to the
pill range; three consecutive well-below-difficulty scores force a
one-integer step-down (existing AC-D6). Covered by **AC-CD13**
(confident — formula resolved by v1.2 AC-D9).

---

## 14. N-gram overlap (amended AC-D4 #5)

`app/domain/ngram.py`. At submit, trigram-shingle the Testee's free-text
responses and compare against the last learning material served to that
Testee for that pill (`learning_material` served-set). Jaccard-style
overlap ratio; flag at default ≥ 60% (configurable). Skip silently when
nothing was served. Anchored as **AC-CD14**.

---

## 15. Testing strategy

`pytest` + `pytest-asyncio`. `tests/{unit,integration,e2e}` mirror the
SiteMesh shape. `conftest.py` stubs external providers (Anthropic,
OpenAI, Drive) so no test makes a network call.

- **Unit:** calibration shrinkage math, competence decay, n-gram ratio,
  shuffle-seed determinism, model-resolution order.
- **Integration:** attempt -> grade -> cross-family review -> loop;
  autosave/resume snapshot stability.
- **E2E:** bootstrap idempotency, each cron, benchmark sequential path,
  per-Testee SSE stream buffer behaviour.

Coverage expectation: the `app/domain/*` statistical core at or near full
line+branch coverage (it cannot be cheaply A/B-tested in production — see
§17); routers covered by integration. Anchored as **AC-CD15**.

---

## 16. Deployment topology

`docker-compose.yml`: `acumen` (HTTP, no secrets in image),
`acumen-worker` (Celery), `acumen-beat` (scheduler), `postgres`
(pgvector image), `redis`, `traefik` (TLS edge,
`!PathPrefix(/v1/internal)` reserved). Multi-stage `Dockerfile`
(`base -> http / worker / migrate`); `migrate` profile runs Alembic.
Secrets only via environment (SPEC §8.3). Backups per SPEC §8.5
(Postgres dump cron documented in compose). Anchored as **AC-CD16**.

---

## 17. Three highest-risk implementation areas

1. **The statistical core (AC-D9 competence + AC-D20/AC-D27
   calibration).** Now fully specified (v1.2) but still the area where a
   subtle error is silently wrong and not cheaply A/B-tested in
   production. Mitigation: near-full unit+branch coverage of
   `calibration.py` + `competence.py` with worked fixtures derived from
   the DECISIONS formulas; calibration runs in a cron, not on the request
   path, so it is reproducible and auditable.
2. **AC-D25 per-Testee JIT streaming.** Async foreground/background
   concurrency, buffer correctness under autosave/resume/refresh,
   and mid-stream failure, all on the user-visible path.
   **Mitigation (v1.8):** AC-CD10 / §10 P10 build gate closed —
   concurrency runs in a **single uvicorn worker** via
   `asyncio.gather` under an `asyncio.Semaphore = jit_buffer_size`
   (no Celery on the user-facing path, no cross-process result
   coordination); streamed-arrival order is anchored by the new
   `question.attempt_position` column (unique
   `(attempt_id, attempt_position)`), so concurrent task resolution
   cannot perturb the order; resume replays from the DB ordered by
   `attempt_position` with `Last-Event-ID`, so worker death mid-
   attempt is recoverable; single-Q-N failure retries once at the
   orchestration layer then pauses the attempt via the existing
   AC-D11 mechanism. The explicit buffer state machine + E2E buffer
   tests carry over from the pre-v1.8 mitigation list unchanged.
3. **Synchronous external AI on submit (AC-D19) + Drive RAG ingest
   reliability (AC-D22).** A blocking OpenAI call before the Testee sees
   a result couples submit UX to third-party latency. **Mitigation
   (v1.7):** AC-CD11 P6 gate closed — review is batched per attempt
   (single call per submit) with a 60-s hard ceiling; over-ceiling
   falls through to the existing fail-soft `pending` + reconcile-cron
   path. The submit path's worst-case latency is now bounded
   independent of N (the AI-graded response count), and the bounded
   case lives in the rare-failure path rather than the normal one.

---

## 18. AC-CD decision ledger

Each anchor: **Decision / Rationale / Implications / Confidence**.
Confidence is `confident default` or `needs user input`. Per the v1.2
spec clarification, the formerly under-specified anchors are
**confident**; **AC-CD11** was the last to carry `needs user input`
and was **closed at v1.7** (P6 gate resolved — see the AC-CD11 entry
below). All AC-CD anchors now read `confident default`.

### AC-CD1 — Stack lock & exact version pins
**Decision:** pin every dependency at the §2 versions; mirror SiteMesh
shared pins exactly; bound Acumen-only additions.
**Rationale:** mechanical SiteMesh port; reproducible builds.
**Implications:** `requirements.txt` + `requirements-worker.txt`; CI
fails on an unpinned add. **(v1.9, AC-CD25 reference corpus)** the corpus
builder's text-extraction step adds two bounded Acumen-only pins —
`beautifulsoup4` (HTML→text) and `pypdf` (PDF→text) — supporting **HTML +
PDF** extraction at the corpus-acquisition slice (A2). `pypdf` is chosen
over `pdfplumber` for a lighter pure-Python footprint (no
`pdfminer.six` / `Pillow` chain), adequate for standards/regulator PDF
text extraction; widen deliberately if it proves insufficient. The pins
land with this amendment; the importing code (`app/domain/corpus_builder.py`)
is the A2 execution deliverable. **Confidence:** confident default.

### AC-CD2 — Repository layout
**Decision:** SiteMesh module anatomy at a standalone repo root (§3).
**Rationale:** the port is a move, not a restructure; setup-only
`main.py`. **Implications:** a structure-gate script enforces the shape.
**Confidence:** confident default.

### AC-CD3 — Single `acumen` schema + pgvector, Alembic per-schema
**Decision:** one schema; pgvector in init + first migration; reversible
migrations; SiteMesh `env.py` pattern.
**Rationale:** port-compatible; single-DB v1 simplicity.
**Implications:** `tenant_id` present from day one; RLS deferred (seam).
**Confidence:** confident default.

### AC-CD4 — Entity -> table mapping & index conventions
**Decision:** the §4 mapping; UUID PKs; audit/timestamp columns;
`tenant_id` indexed; IVFFlat on embeddings.
**Rationale:** covers every SPEC §5 entity plus AC-D supporting tables.
**Implications:** the first migration asserts table count (tested).
**Confidence:** confident default.

### AC-CD5 — Standalone email+password auth + role-check; Auth-Hub seam
**Decision:** argon2id + JWT, admin-created users, token-based
setup/reset, single role-check dependency, deactivation + privacy gates.
**Setup/reset link contract (amended 2026-06-06 per audit-2026-06-02
finding C1 / PR #94 plan D2b).** The token-bearing setup and reset links
embedded in account emails are built against the public **frontend**
origin, held in a dedicated `app_frontend_url` setting
(`APP_FRONTEND_URL`, default `http://localhost:3000`) that is
deliberately distinct from the API origin `app_public_url` — the links
carry a **path-segment** token (matching the frontend route shape, e.g.
`/<flow>/{token}`), not a query-string token, so they resolve to the
browser app rather than the API host. `check_startup_config` fails
closed in a non-dev environment when `app_frontend_url` is empty or
loopback, and additionally asserts `app_frontend_url ∈
cors_allowed_origins_list` (the browser app's own origin must already be
CORS-allowed); both checks **append to the returned `errors` list** and
never raise — the `RuntimeError` is raised one layer up in
`run_startup_checks`. This contract was previously implicit in the email
templates; it is recorded here so the frontend origin is a named,
boot-guarded setting rather than an undocumented coupling.
**Rationale:** the smallest correct auth that ports cleanly.
**Implications:** one-file swap at port (SPEC §9.2); WS-A Slice 1 of the
post-audit pre-deploy workstream implements the link contract against
this anchor.
**Confidence:** confident default.

### AC-CD6 — REST `/v1` + error envelope + SSE for AC-D25
**Decision:** §5 conventions; SSE for the per-Testee feed; sequential
endpoint for benchmark; `/v1/internal` reserved.
**Rationale:** matches the AC-D25 v1.2 split; OpenAPI is the future
frontend contract.
**Implications:** the frontend spec consumes this contract (separate
doc). **Confidence:** confident default.

### AC-CD7 — Celery + Redis + beat; `processing_tasks`; bootstrap as job

> **Amended in v1.9** — autonomous-content-generation cycle, **PR-A**. The
> canonical cron count moves **seven → nine**, authored **complete** here
> (amend-once across the A3 + D4 touchers, even though those slices execute
> later): the **`corpus.refresh`** weekly cron (A3) **replaces**
> `drive_rag.ingest` (NS-1 retires Drive ingest — a 1:1 replacement, net 0),
> and the **`gap_detection.sweep`** + **`catalogue_health.check`** crons (D4)
> add the other two → **nine**. The beat-schedule code change is the
> per-slice **execution** deliverable; this amendment fixes the canonical
> count + enumeration the execution sweeps against. Ratified through the
> authenticated in-session channel for this cycle.

**Decision:** §8 background design; **nine crons** (final count, v1.9); idempotent bootstrap job.
**Rationale:** SiteMesh-compatible async contract.
**Implications:** beat schedule in VCS; bootstrap re-runnable.
**Confidence:** confident default.

### AC-CD8 — AI provider abstraction + versioned prompt registry + cost
**Decision:** `AIProvider` protocol; resolution order; VCS prompt
registry with persisted version; per-call cost capture.
**Rationale:** AC-D12/D18/D19 require provider/op indirection plus
reproducibility.
**Implications:** prompt version persisted on grade/question rows.
**Confidence:** confident default.

### AC-CD9 — pgvector index, chunk size, embedding model
**Decision:** IVFFlat; ~500-token chunks; OpenAI `text-embedding-3-small`
(1536-dim), env-overridable.
**Rationale:** v1.2 AC-D22/§7.3 fixed the provider (Anthropic exposes no
embeddings API; OpenAI already in stack).
**Implications:** embedding cost tracked to OpenAI.
**Confidence:** confident default (resolved by v1.2).

### AC-CD10 — JIT streaming buffer mechanics & failure handling

> **Body clarified at v1.8** — P10 build gate closed. Execution
> model locked as in-process `asyncio.gather` + `asyncio.Semaphore`
> (no Celery on the user-facing path); Question gains `attempt_position`
> for stable streamed-arrival ordering; single-Q-N-failure policy is
> one orchestration-layer retry then AC-D11 pause. AC-D25's
> Implications were realigned in the same change (DECISIONS AC-D25
> v1.8). **Confidence stays `confident default`** — the v1.2 close
> retired this anchor's `needs user input` status; v1.8 is a body
> clarification, not a confidence change.

**Decision:** §10 — per-Testee SSE, Q1 sync, Q2…N concurrent
**in-process `asyncio.gather` under an `asyncio.Semaphore`** whose
size equals `Settings.jit_buffer_size` (env-default 3), ceiling
`Settings.jit_buffer_max` (env-default 5); snapshot-replay resume
ordered by `question.attempt_position` (unique
`(attempt_id, attempt_position)`) using `Last-Event-ID`;
single-Q-N-generation-failure retries once at the orchestration layer
then **pauses** the attempt via the AC-D11 mechanism (other in-flight
tasks continue and persist before the pause takes effect; partial
progress preserved); benchmark excluded (sequential `POST .../next`).
**Rationale:** the v1.2 AC-D25 benchmark carve-out removed the
design contradiction; the v1.8 closure removes the residual §10
"parallel Celery tasks" wording — at v1 load shape (≤30 concurrent
attempts, 5–10 Q-N tasks per attempt) single-worker `asyncio` sits
well inside the I/O budget, removes Celery enqueue + Redis
result-backend latency from the JIT path, and keeps Celery
infrastructure scoped to its actual job (P11 cron set + long-running
batch). Horizontal worker-death concern is mitigated by the
DB-backed resume semantics in this same anchor.
**Implications:** explicit buffer state machine; E2E buffer tests;
single `app/domain/streaming.py` orchestrator owning the semaphore +
the `attempt_position` slot assignment + the per-task retry-once-
then-pause branch; SSE endpoint in `app/routers/attempts.py` reads
from DB on reconnect and continues any unfilled positions. The
additive `attempt_position` migration is a P10 build deliverable.
**Confidence:** confident default (resolved by v1.2; body
clarified at v1.8).

### AC-CD11 — Cross-family review pipeline & latency budget

> **Resolved at v1.7** — P6 build gate closed. Mode locked as batched
> per attempt; hard latency ceiling locked at 60 s; over-ceiling routes
> to the existing v1.6 grade-review reconcile cron. AC-D19's
> submit-wait wording realigned in the same change (F10 honoured).

**Decision:** synchronous pre-stamp cross-family review is **batched
per attempt** — exactly one OpenAI `review()` call per submit, payload
covers every AI-graded response in the attempt together (each item
carries `{question, response, rubric, ai_grade, ai_reasoning}`),
structured response is an array of `{grade_id, verdict, reasoning?}`.
**Hard latency ceiling at the submit path is 60 seconds.**
Over-ceiling or provider-unavailable: every `grade_review` row for the
attempt stays `pending`, the result page renders in preliminary mode,
and the §8 grade-review reconcile cron picks the rows up on its next
pass (every 5 min by default; after 10 consecutive failures a
`pending` row auto-promotes to `flagged` with reason
`auto_flagged_stuck_pending` — ≈50-minute stuck-pending wall-clock).
**Rationale:** batched-per-attempt is the smallest call count that
keeps the submit-path latency shape sub-linear in N, matches the
AC-D19 single submit-wait UX, and gives the reconcile cron one row
set per attempt to retry rather than N independent fates.
Per-response sequential is the rejected anti-pattern that motivated
the F10 dependency in the first place (N×ceiling). Per-response
parallel is a defensible alternative but multiplies upstream
rate-limit load by N and complicates partial-failure UX (some
confirmed, some pending across the same attempt) without buying
meaningful headroom at the typical 3–5-AI-graded-response attempt
size.
**Implications:** `app/domain/grade_review.py` (`_review_ai_grades`) calls
`AIProvider.review()` once per attempt with the full AI-graded
response list, wrapping it in a 60-s timeout/deadline; the timeout
raises the same fail-soft branch as a provider error. The §8 cron
already retries `pending` rows (v1.6 / F3); no new cron is introduced.
AC-D19 v1.1 "10–30 seconds" wording is amended in the same change.
AC-CD11 retires from the `CHECKLIST.md` drift-question list;
`SESSION_START.md` "one open item" paragraph retires.
**Confidence:** **confident default** (closed at v1.7 with user
sign-off).

### AC-CD12 — effective_difficulty estimator + fresh-vs-anchor delta
**Decision:** §12 Bayesian-shrinkage estimator + same-attempt delta for
fresh questions; `k = 20`.
**Rationale:** v1.2 AC-D27 specified the math AC-D20 deferred.
**Implications:** the calibration cron recomputes; stable from n=0.
**Confidence:** confident default (resolved by v1.2).

### AC-CD13 — competence_estimate aggregation + decay
**Decision:** §13 IRT-style per-response value; recency-weighted
(half-life 90); loop target `round(estimate + 0.5)`; null handling.
**Rationale:** v1.2 AC-D9 specified the full formula.
**Implications:** `competence_sensitivity` (2.0) in System Settings.
**Confidence:** confident default (resolved by v1.2).

### AC-CD14 — n-gram overlap algorithm & threshold
**Decision:** trigram shingles vs last served material; default ≥60%;
skip when nothing served.
**Rationale:** amended AC-D4 #5.
**Implications:** needs `learning_material` served-set tracking.
**Confidence:** confident default.

### AC-CD15 — Testing layers, fixtures, coverage
**Decision:** §15 — stubbed providers; near-full coverage of
`app/domain/*`.
**Rationale:** the statistical core cannot be A/B-tested in production.
**Implications:** `conftest.py` forbids network in tests.
**Confidence:** confident default.

### AC-CD16 — docker-compose topology + Traefik + secrets-via-env
**Decision:** §16 services; multi-stage Dockerfile; env-only secrets.
**Rationale:** SiteMesh-compatible deploy; SPEC §8.3/§8.5.
**Implications:** `/v1/internal` reserved at the edge for the port.
**Confidence:** confident default.

### AC-CD17 — Doc discipline adoption + AC-CD house-style
**Decision:** five canonical root docs; anchor body Decision/Rationale/
Implications (+Confidence for AC-CD); CHECKLIST = capability—status—
evidence; banned-string hygiene (no `TBD`; no trailing "etc."; no
"or"-framed requirements in CODE_SPEC).
**Rationale:** SiteMesh authoring discipline; mechanical port.
**Implications:** per-PR handover from `HANDOVER_TEMPLATE.md`.
**Confidence:** confident default.

### AC-CD18 — Model-ID defaults, env-overridable
**Decision:** latest Claude Sonnet (generation/grading) + a current
OpenAI model (review) + `text-embedding-3-small` (embeddings) as
env-default config, never hard-coded.
**Rationale:** user direction; SPEC §7.1; model churn isolated to env.
**Implications:** `.env.example` documents each ID; resolution per
AC-CD8. **Confidence:** confident default (per user).

### AC-CD19 — Frontend stack lock & `frontend/` layout

> Added in the PR-032 frontend scaffold. The frontend was unpinned at
> the AC-CD1 through AC-CD18 close; the API contract (AC-CD6) was
> always written as "the frontend spec consumes this contract". This
> anchor codifies the consumer side. Self-contained: a fresh contributor
> reading only AC-CD19 should know the full frontend stack and where it
> lives. **Confidence:** confident default.

**Decision:** the frontend is a single Next.js (App Router) application
living at `frontend/` in the acumen repo. All choices are pinned and
mirror the backend's AC-CD1 exact-pin discipline.

- **Runtime:** Node 22 LTS, pinned via `.nvmrc` and `package.json`
  `engines.node`. Package manager: **pnpm**, pinned via the
  `packageManager` field; `.npmrc` carries `engine-strict=true` and
  `save-exact=true`. `pnpm-lock.yaml` is committed.
- **Framework:** **Next.js 15.x** (App Router), pinned exact. Build
  uses `output: 'standalone'` for the Docker runner stage.
- **Language:** **TypeScript** with `strict: true`,
  `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`,
  `exactOptionalPropertyTypes: true`. Mirrors the backend mypy posture.
- **Styling:** **Tailwind CSS 4.x**.
- **Component library:** **shadcn/ui** (Radix-primitive source-copy
  install). The scaffold reserves `frontend/src/components/ui/` but
  copies no components in; future PRs run `pnpm dlx shadcn@latest add
  <component>` as needed. No second component library may be added
  without a CODE_SPEC amendment.
- **Forms / validation:** `react-hook-form` + `zod` (client-side
  layered defense over the backend's uniform error envelope).
- **Server-state cache:** **TanStack Query (React Query) v5**. Auth
  identity lives in a thin React Context; no Redux/Zustand.
- **OpenAPI codegen + client:** **`openapi-typescript`** (types-only)
  generates `paths` / `components` / `operations` from the OpenAPI
  surface, and **`openapi-fetch`** (same author, library-grade
  conditional types) consumes those types as the typed runtime client
  at `frontend/src/lib/api/client.ts`. The client.ts file wraps
  `openapi-fetch` with two cross-cutting concerns only: a custom
  `fetch` that attaches the in-memory access token, and a 401
  refresh-and-retry-once. An `unwrap()` helper throws an `ApiError`
  (parsed from the AC-CD6 uniform error envelope) on a non-ok
  response and returns the typed `data` on ok — so callers never
  cast. The codegen runs against a committed snapshot at
  `frontend/openapi/schema.json` (regen with `pnpm codegen:live`
  against a running backend); the snapshot keeps the frontend CI
  build offline (AC-CD15 spirit). A CI step regenerates against the
  committed snapshot and fails if the result drifts from the
  committed `frontend/src/types/api.d.ts`. The pairing is locked at
  exact pins per the AC-CD1 mirror discipline.
- **Testing:** **Vitest** for unit + smoke tests. Playwright (E2E)
  is intentionally not pinned — added by the PR that introduces the
  first E2E-worth flow.
- **Lint / format:** **ESLint** (`next/core-web-vitals` +
  `eslint-config-prettier`) and **Prettier**. CI runs both as separate
  steps mirroring `ruff check` + `ruff format --check`.

**Auth storage.** The backend's `/v1/auth/login` returns tokens in a
JSON body (`TokenPair`); refresh tokens do not rotate on
`/v1/auth/refresh`; revocation is via the deactivation gate, not a
server-side blacklist. The frontend stores the **access token in JS
memory only** (cleared on reload) and the **refresh token in
`localStorage`** (key `acumen.refresh_token`). On a 401, a single
de-duped refresh attempt fires; if refresh fails, identity is cleared
and the user is routed to the login surface. The XSS exposure window
for the access token is narrowed by memory-only storage and the 15-min
access TTL; the refresh token is exposed to in-page XSS by virtue of
`localStorage`. This is the accepted compromise for v1's
internal-network deployment posture.

**v1.x upgrade path (documented, not built).** When the threat model
warrants — Acumen serving outside KBC's internal network, or any other
shift that materially raises the XSS risk — auth flips to **httpOnly
Secure SameSite=strict cookies for both tokens**, which requires
coordinated backend + frontend changes: (a) `/v1/auth/login` and
`/v1/auth/refresh` set cookies on the response instead of returning
them in the body, (b) the CORS middleware moves to `allow_credentials=
True` with an explicit (no-wildcard) origin allow-list, (c) CSRF
protection is added (header-bearing CSRF token, double-submit cookie
pattern), and (d) the frontend's `storage.ts` adapter is gutted in
favour of the browser's automatic cookie attachment. The Auth Hub
port (AC-CD5) is the natural seam to bundle this with.

**CORS.** `app/main.py` installs FastAPI's `CORSMiddleware` after
`register_exception_handlers`, with `allow_origins` driven by
`Settings.cors_allowed_origins` (comma-separated env string,
`CORS_ALLOWED_ORIGINS`, default `http://localhost:3000`). The
middleware runs with `allow_credentials=False` while tokens travel in
the `Authorization` header; the v1.x cookie upgrade above flips this.

**Folder layout (`frontend/`).** Top-level: `package.json`,
`pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`,
`tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`,
`.eslintrc.json`, `.prettierrc.json`, `.nvmrc`, `.npmrc`,
`.env.example`, `.gitignore`, `Dockerfile`, `README.md`. App code under
`src/app/` (App Router pages + a `/api/health` route used by the
Docker healthcheck). Shared library under `src/lib/` (`api/`, `auth/`,
`config.ts`, `query-client.ts`). Generated types under
`src/types/api.d.ts` (committed). Components reserved at
`src/components/ui/`. OpenAPI snapshot at `openapi/schema.json`,
codegen script at `scripts/codegen.ts`. Tests at `tests/`.

**Docker / compose.** A new service `acumen-frontend` in
`docker-compose.yml` builds from `frontend/Dockerfile` (multi-stage:
deps → builder → runner; Node 22 slim base; non-root `nextjs` user;
standalone output), exposes `3000`, depends on `acumen` being healthy,
and runs its own healthcheck against `/api/health`. The frontend's
`API_BASE_URL` env var points at the `acumen` service inside the
compose network; `NEXT_PUBLIC_API_BASE_URL` points at the externally-
visible URL (default `http://localhost:8000`).

**CI.** A new workflow file `.github/workflows/frontend.yml` runs in
parallel with the existing `ci.yml`. Both gate merge. The frontend
workflow runs (in order): `pnpm install --frozen-lockfile`, `pnpm
codegen:check` (regenerates from the committed snapshot and asserts no
drift), `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test
--run`, `pnpm build`. The Python workflow stays untouched apart from
the new `tests/unit/test_cors.py` it picks up automatically.

**Rationale.**
- **Next.js + App Router:** SiteMesh peerage (the user pinned this).
  App Router is the Next.js-15 default; RSC support keeps future-page
  options open without re-architecting.
- **pnpm:** strict isolation (no phantom deps), deterministic
  lockfile, smaller node_modules — mirrors the AC-CD1 pin-everything
  spirit better than npm's looser defaults.
- **TypeScript strict + extra flags:** parity with the backend's mypy
  strict posture; the extra flags catch the classes of bug that the
  OpenAPI generator can't (indexed-access undefined, override drift,
  optional-vs-undefined sloppiness).
- **Tailwind + shadcn/ui:** the AI-design-output pipeline assumes
  Tailwind class strings and shadcn's Radix-primitive shape;
  alternative styling layers would force re-authoring every generated
  component.
- **`openapi-typescript` + `openapi-fetch`:** generator-method clients
  accrete API drift between regenerations and force method-name churn,
  so the codegen stays types-only. The runtime client is `openapi-fetch`
  (same author as the type generator, library-grade conditional types
  over `paths`) wrapped with the two cross-cutting concerns this
  project needs — token attach and 401 refresh-and-retry — and an
  `unwrap()` helper that maps the AC-CD6 error envelope onto a typed
  `ApiError`. PR-032's initial Gitar review surfaced that a hand-rolled
  wrapper returning `Promise<unknown>` defeated the point of the
  codegen by forcing `as X` casts at every call site; adopting
  `openapi-fetch` delivers the type safety the scaffold was set up to
  provide without a second dependency on a generator.
- **Memory + localStorage auth split:** balances the AC-CD5 "smallest
  correct auth" posture against the realistic v1 deployment threat
  model. Documented upgrade path makes the cookie flip a deliberate
  AC-CD5-paired exercise rather than a v1 over-engineer.

**Implications.**
- Adding a frontend dependency is an AC-CD19 decision (same gravity
  as AC-CD1 for backend). Trivial dev-only additions may fold into
  the phase handover per SESSION_START.md's structural-additions
  carve-out; runtime / cross-cutting additions amend AC-CD19 in
  place.
- The `scripts/structure_gate.py` whitelist is backend-only and stays
  that way. The `frontend/` directory's structure is enforced by the
  frontend-side toolchain (TS path resolution + ESLint config), not
  by a Python gate.
- All frontend PR handovers use `HANDOVER_TEMPLATE.md` unchanged.
- Image-rendering hooks (`reference_image_url`,
  `reference_image_caption`, `ChoiceResponse.image_url`) are typed
  through to component props but stay unrendered in v1; the v1.x
  visual-content PR adds rendering without re-architecting the type
  layer.

### AC-CD20 — Frontend routing structure, route groups, and role guards

> Added in the Session 2 frontend canonical-doc PR. AC-CD19 locks the
> stack but is silent on how the App Router surface is partitioned
> across auth postures and roles. Without this anchor, every
> page-building PR re-decides where guards live, producing the classic
> Next.js bug of a non-guard `layout.tsx` letting an unauthenticated
> user briefly see protected content during hydration. Self-contained:
> a fresh contributor reading only AC-CD20 should know where to put a
> new page and what gates its rendering. **Confidence:** confident
> default.

**Decision.** Next.js App Router route groups partition the frontend
surface by auth posture and role. Four top-level groups under
`frontend/src/app/`:

- **`(auth)/`** — unauthenticated surfaces. `login/`, `forgot/`,
  `reset/[token]/`, `setup/[token]/`. Group `layout.tsx` redirects to
  `/dashboard` (testee) or `/ops` (admin) if a valid session is
  already present.
- **`(authed)/`** — anything an authenticated user touches that is
  not role-specific. Group `layout.tsx` calls `useAuth()` and
  redirects to `/login` if unauthenticated, or to `/privacy` if
  `privacy_acknowledged_at` is null per AC-D16, before rendering
  children. Hosts the `/privacy` page itself (which intentionally
  bypasses the privacy-ack subgate via a route-group exception).
- **`(testee)/`** — testee-role surfaces, nested under `(authed)/`
  via layout composition. Group `layout.tsx` re-runs the authed gate
  and redirects to `/403` if `role !== 'testee'`.
- **`(admin)/`** — admin-role surfaces. Same shape as `(testee)/`
  but checks `role === 'admin'`.

**Guard implementation.** Route-guard logic lives in
`frontend/src/lib/auth/guards.ts` as pure functions
(`requireAuthed(session)`, `requireRole(session, role)`,
`requirePrivacyAck(session)`) returning a redirect path or `null`.
Each group's `layout.tsx` composes them. Pure functions are
unit-tested without rendering.

**URL conventions.** Segments are kebab-case (`learning-paths`,
`pill-proposals`). Dynamic segments use `[paramName]` matching the
API path parameter (`/attempts/[attemptId]`, `/pills/[pillId]`).

**Error and loading surfaces.** Each route group ships its own
`loading.tsx` (suspense skeleton matching the route's primary
layout) and `error.tsx` (route-scoped error boundary surfacing the
AC-CD6 error envelope through a toast). A repo-level
`not-found.tsx` covers 404s.

**Rationale.** Server-component layouts run before client hydration,
so the redirect fires before any protected content is sent to the
wire — closing the hydration-flash gap. Pure-function guards keep
the test surface manageable. Route groups (parenthesised folders)
do not affect URL paths, so the grouping is invisible to users
while structuring the codebase.

### AC-CD21 — TanStack Query conventions, form pattern, error-envelope display

> Added in the Session 2 frontend canonical-doc PR. AC-CD19 pins
> TanStack Query and `react-hook-form`+`zod` but leaves usage
> patterns to per-PR judgement. Without this anchor, invalidation
> strategies drift across pages, query-key shapes diverge, and error
> display fragments into ad-hoc per-page handling. Self-contained: a
> reader should know how to wire any new API call into the UI.
> **Confidence:** confident default.

**Decision.**

- **Query keys** shape as `[domain, resource, ...params]`. Examples:
  `['catalogue', 'pills', { search, subject }]`,
  `['attempts', attemptId]`, `['attempts', attemptId, 'result']`. The
  `domain` segment matches the backend router (`catalogue`,
  `attempts`, `users`, etc.) so a single
  `queryClient.invalidateQueries({ queryKey: ['catalogue'] })` clears
  the domain.
- **Mutations** call
  `queryClient.invalidateQueries({ queryKey: [...] })` on success
  rather than manual `setQueryData`. Optimistic updates are opt-in
  per mutation, not default.
- **Default `staleTime`** is `30_000`ms across the client.
  Suspense-mode is opt-in per query (`useSuspenseQuery`); the default
  `useQuery` returns `isPending`/`isError`/`data` and renders
  skeletons/errors inline.
- **Forms** use `react-hook-form` with a `zod` resolver. The zod
  schema is the source of truth for field validation; the rhf
  `register` / `Controller` pattern wires inputs.
- **Error-envelope display.** A failed mutation's `error`
  (`ApiError` from `unwrap()`) is passed to a
  `applyApiErrorToForm(error, form)` helper that walks the AC-CD6
  `detail` array, maps each item's `loc` onto the matching rhf field
  via `form.setError`, and surfaces any non-field errors as a toast.
  The helper lives at `frontend/src/lib/api/form-errors.ts`.
  Non-mutation errors (page-level fetches) render via the route
  group's `error.tsx` boundary.
- **The `unwrap()` helper** from `frontend/src/lib/api/client.ts` is
  the only call surface that throws `ApiError`. Callers never touch
  raw `fetch` responses or the `openapi-fetch` `{ data, error }`
  discriminated union directly; every typed call goes through
  `unwrap(client.GET(...))`.

**Rationale.** Domain-prefixed keys make invalidation a one-liner
and prevent cross-domain accidental invalidation. Centralising
error-envelope mapping in one helper means rhf field errors and
toasts stay consistent across every form in the app. Suspense being
opt-in keeps the default UX (inline skeleton in the same component)
without forcing a Suspense boundary refactor on every page.

### AC-CD22 — Frontend SSE client for `GET /v1/attempts/{id}/stream`

> Added in the Session 2 frontend canonical-doc PR. AC-D25 specifies
> JIT streaming and AC-CD10 specifies the backend SSE contract, but
> the frontend has a real fork in the road — `EventSource` cannot set
> `Authorization` headers, so the choice between `EventSource` and a
> fetch-streaming adapter is consequential. Locking it now prevents a
> wrong-turn first cut in FE-5. Self-contained: a reader should know
> exactly how to consume the stream. **Confidence:** confident
> default.

**Decision.** SSE consumption uses a **fetch-streaming adapter**,
not the browser's native `EventSource`. The adapter lives at
`frontend/src/lib/api/sse.ts` and exposes a single function
`openAttemptStream(attemptId, opts)` returning an
`AsyncIterable<StreamEvent>` plus an `AbortController`-backed
`close()`.

**Adapter behaviour.**

- Opens `GET /v1/attempts/{id}/stream` with the bearer token in the
  `Authorization` header. If resuming, sets `Last-Event-ID` from the
  highest event id received so far (per AC-CD10's resume contract).
- Reads `response.body` as a `ReadableStream<Uint8Array>`, decodes
  via `TextDecoderStream`, parses SSE frames (`event:`, `data:`,
  `id:`, blank-line terminators).
- Yields typed `StreamEvent` values into the consuming reducer.

**Event shape and reducer.** Reflecting the AC-CD10 backend
contract as shipped:

- **Question events use the default `message` event** — the SSE
  frame carries no explicit `event:` line. The data payload is
  **identifying only**: `{id, attempt_position, attempt_id}` (not
  the full `QuestionResponse`). On arrival, the frontend issues a
  `GET /v1/attempts/{id}` re-read to pick up the full question
  content for that `attempt_position`; the question rows on the
  attempt response are the source of truth for question state.
- **Terminals use explicit `event:` headers**: `event: done`
  (clears generating-state) and `event: paused` (surfaces the
  AC-D11 paused UI). No payload assumption beyond what AC-CD10
  dictates.

The reducer in `frontend/src/components/attempt/jit-queue.tsx`
keys arrivals on `attempt_position` from the identifying payload
and merges the full question content from the post-arrival
`GET /v1/attempts/{id}` refetch. The UI shows generating-dots for
positions not yet announced and ready-state for positions whose
content has joined from the refetch.

**Disconnect handling.** On stream error (network drop, server 5xx
mid-stream), the adapter retries **once** with `Last-Event-ID` set
to the highest received id. On second failure, it stops
reconnecting and emits a synthetic `paused` event so the UI
surfaces the AC-D11 paused state until the user explicitly resumes
(which re-invokes `openAttemptStream` with fresh resume state).

**Mode gating.** Per AC-D25 / AC-CD10, the SSE endpoint is only
consulted in `per_testee` mode. Benchmark mode walks questions via
sequential `POST /v1/attempts/{id}/next` calls (no streaming). The
mode resolver in `frontend/src/components/attempt/page.tsx`
switches between SSE and sequential strategies based on the test's
`mode` field.

**Rationale.** `EventSource` is simpler but forces auth tokens into
the URL as a query param — unacceptable given access tokens in the
bearer flow. The fetch-streaming adapter is ~80 lines, supports the
`Authorization` header natively, and lets the resume semantics
align cleanly with AC-CD10's `Last-Event-ID` contract.

### AC-CD23 — Theme system (paper + carbon), token discipline, project-specific primitives

> Added in the Session 2 frontend canonical-doc PR. AC-CD19 pins
> Tailwind and shadcn/ui but is silent on theming, design-token
> discipline, and which project-specific primitives (BandTag, Stat,
> Pill-as-chip, Icon set) live in-tree. Without this anchor, literal
> hex values creep in and break the theme path; "should this be a
> primitive or a one-off?" gets re-decided per page; the v5
> dark-theme exploration risks being reintroduced inadvertently.
> Self-contained. **Confidence:** confident default.

**Decision.**

- **Two v1 themes: `paper` (light) and `carbon` (dark).** The
  `<html>` element carries `data-theme="paper"` or
  `data-theme="carbon"`. The `steel` theme from the v5 design
  exploration is **out of scope entirely** — not in v1, not in any
  v1.x phase. It is named here only to inoculate against
  reintroduction.
- **Initial state and persistence.** Initial theme is `paper`. There
  is **no `prefers-color-scheme` detection** in v1 — the OS setting
  is ignored. The user switches manually via the TopBar toggle (see
  below). Selection persists in `localStorage` under key
  `acumen.theme` with value `"paper" | "carbon"`, read at mount and
  written on toggle. Persistence is per-device.
- **Toggle UX.** A small sun ↔ moon icon button rendered **beside
  the avatar in the `TopBar`** (not inside the avatar dropdown).
  Clicking flips `data-theme` on `<html>` and writes the new value
  to `localStorage`. Icon reflects the *target* state (sun shown
  while on `carbon`, moon shown while on `paper`).
- **Token contract (bare-name primitives + `@theme` aliases).** The
  design-prototype's bare-name custom properties are the canonical
  tokens and are declared on `:root[data-theme="paper"]` and
  `:root[data-theme="carbon"]` in `frontend/src/app/globals.css`:
  `--ink`, `--bg-page`, `--bg-surface`, `--bg-muted`,
  `--band-novice`, `--band-junior`, `--band-working`,
  `--band-advanced`, `--band-expert`, `--safety`, plus spacing,
  radius, and typography scales. A Tailwind v4 `@theme` block in
  the same file declares `--color-*` aliases that point at the
  bare-name tokens (e.g. `--color-ink: var(--ink);`,
  `--color-band-working: var(--band-working);`) so Tailwind's
  utility-generation picks them up. Component code uses semantic
  Tailwind classes (`bg-surface`, `text-ink`, `text-band-working`)
  that bind via the aliases to the bare-name tokens, so swapping
  `data-theme` swaps the entire palette. **Literal hex values, RGB
  values, or arbitrary-value brackets like `bg-[#fafafa]` are
  prohibited in component code.** Reviewers reject PRs that
  introduce them.
- **Project-specific primitives** that shadcn/ui does not provide
  live under `frontend/src/components/primitives/`. The v1 set:
  `BandTag` (D0..D4 / B1..B5 / S1..S5 band badge with band-token
  colouring), `BandPips` (small dot row for compact band display),
  `Pill` (chip-style label for tags), `Stat` (label + value + delta
  block used on dashboards), `Icon` (the design prototype's
  stroke-SVG set, ~20 icons, authored as a single component with a
  `name` prop), `Figure` / `InlineFigure` / `ChoiceFigure` (image
  wrappers per AC-CD24 — type hooks live but render null in v1).
- **No second component library.** Adding a primitive follows
  shadcn/ui's source-copy posture: paste source, commit to
  `primitives/`, no `@radix-ui/*` direct imports outside what
  shadcn's source-copy brings in.

**Rationale.** Tokens-in-CSS keeps the theme path single-source; the
moment a hex value lands in a component, the theme path forks. Two
themes (paper + carbon) cover the v1 light/dark expectation that
testees raise on first use; gating the toggle on an explicit
TopBar button (no OS-preference detection) keeps the v1 surface
deterministic and side-steps SSR/CSR-mismatch flashes. Excluding
`steel` outright caps the palette at two and protects against the
v5 exploration's design surface re-expanding. Primitives in one
folder make "is there already a primitive for this?" a 30-second
grep.

### AC-CD24 — Visual content deferral (v1.x scope lock)

> Added in the Session 2 frontend canonical-doc PR. PR-030 added
> nullable image fields to the question response shape
> (`QuestionResponse.reference_image_url`,
> `QuestionResponse.reference_image_caption`,
> `ChoiceResponse.image_url`), with v1 backend always emitting
> `null`. Without this anchor, "should we just render nothing and
> add the prop later?" gets re-decided per question component; the
> v1.x visual-content PR becomes a component-shape refactor instead
> of a content-add. Self-contained. **Confidence:** confident
> default.

**Decision.** The frontend's question components accept the
PR-030 image fields **through the type layer** (via the
`openapi-typescript` generated
`components["schemas"]["QuestionResponse"]` shape) but render
`null` when the values are null. When the values are non-null,
they render via `<Figure>` / `<InlineFigure>` / `<ChoiceFigure>`
primitives at `frontend/src/components/primitives/figure.tsx`
(the design prototype's wrappers, ported and stubbed for v1.x).

**v1 scope.** No v1 page or component exercises the non-null
branch. The figure primitives exist as typed shells returning
`null`. Reviewers verify in FE-4 that question-component props
accept the image fields without TypeScript widening or `as` casts.

**v1.x add path.** The visual-content PR adds rendering inside the
figure primitives **without touching the question-component
contract**. The image-emitting backend path (LLM-generated
reference images, admin-uploaded reference images) is the trigger;
once `reference_image_url` starts arriving non-null from the
backend, the figure primitives render it. No frontend type-layer
refactor needed.

**File-upload UI** (admin authoring of reference images) is **out
of scope** for v1 frontend. It lands in the same v1.x PR as image
rendering. Admin authoring screens in FE-8 (test authoring, pill
authoring) do not include image-upload affordances.

**Rationale.** Forcing the type-layer wiring through in FE-4 means
the v1.x PR is purely additive (fill in the primitive body) rather
than disruptive (rewrite question components). The prototype's
`<Figure>` shape transfers cleanly so the wrappers carry the
alignment / caption / aspect-ratio decisions from design.

---

### AC-CD25 — Reference corpus builder (acquisition pipeline + `CorpusChunk` store)

> **Minted in v1.9** — autonomous-content-generation cycle, **PR-A**. Ratified
> through the authenticated in-session channel (detail-plan PR #108 Slice 2/A2;
> extraction PR #109 §B AM-2). Materialises amended **AC-D22** (Drive → AI-built
> corpus) and **AC-D28** (source-authority scoring). The table/migration/module
> are the **A2 execution** deliverable; this anchor fixes the architecture.

**Decision.** A new `app/domain/corpus_builder.py` acquisition pipeline composes
**reused** primitives, fail-soft throughout:
allowlist-restricted web search (AC-D28 `filter_to_allowlist` over
`get_web_search_source().search(topic)`) → per-URL fetch (injectable
`httpx.AsyncClient` seam, fail-soft per source) → extract (HTML + PDF per
AC-CD1) → deterministic ~500-token chunking (**reused** `chunk_document`) →
content-hash dedup (**reused** `content_hash`) → embed
(`text-embedding-3-small`, `record_provenance` stamping cost to OpenAI) →
persist a **`CorpusChunk`** row. `CorpusChunk` is a **new table** mirroring
`DriveChunk` (`Base, TimestampMixin, AIProvenanceMixin`; `embedding
Vector(1536)`; `content_hash` indexed; `source_doc_ref` / `chunk_index` /
`chunk_text` / `indexed_at`; IVFFlat index mirroring `ix_drive_chunk_embedding`;
`tenant_id` from day one) **plus** corpus columns `source_host`,
`authority_tier`, `authority_score` (AC-D28). Idempotent by
`(source_host, content_hash)`. The retrieval helper `retrieve_corpus_for_topic`
(Slice A3) is the `cosine_top_k`-over-`CorpusChunk` sibling of
`drive_rag.retrieve_for_generation`, returning each hit's authority tier/score
so Stage B can authority-weight grounding.

**Safety cross-source corroboration (DS2-b — ruled option (ii)).** Content-hash
dedup is the **floor** for all topics; for **safety-relevant** topics the
pipeline additionally applies **cross-source corroboration**: it tracks when the
same claim/fact appears across **≥ 2 authoritative sources** and stamps a
`corroboration_count` on the chunk, feeding the Stage-C confidence score and the
B2 provenance chain (materially stronger grounding for safety content).
**"Same claim/fact" is matched by embedding cosine similarity ≥ 0.90** over the
already-computed corpus-chunk embeddings — *not* byte-identical text, since
independent authoritative sources rarely emit byte-identical ~500-token chunks;
`corroboration_count` is the number of distinct `source_host`s whose chunks meet
that threshold for the chunk being evaluated (its own source always counted).
The 0.90 threshold is **set conservatively and tuned from telemetry** (the same
pattern as the NS-6 confidence threshold), and reusing the RAG embeddings makes
the signal essentially free. *(Cosine-similarity matching + the 0.90 value
ratified by the spec author through the authenticated in-session channel,
2026-06-12 — the A2-execution CA-A2-1 ruling, refining this PR-A anchor's "same
claim/fact" intent from the earlier exact-text reading; v1.9, no version bump.)*

**Rationale.** Reuse over reinvention — the Drive-ingest path already ships the
pure primitives (`chunk_document` / `content_hash` / `cosine_top_k` /
`DriveChunk` / `AIProvenanceMixin` / `record_provenance` / the `embed` op); the
corpus is a sibling acquisition path feeding an equivalent pgvector store, so it
adds **no** new `Operation` enum value. A **new table** (not `DriveChunk` reuse,
DS2-a) keeps per-source rollback (PR-D) clean, keeps the NS-1 Drive retirement
from entangling the corpus, and isolates the corpus-only authority columns.

**Implications.** New `CorpusChunk` table + the workstream's **first migration**
(IVFFlat index); `app/domain/corpus_builder.py`; `CorpusChunk` joins the
`current_month_spend` per-table provenance-spend aggregation in `app/ai/cost.py`
(mirroring `DriveChunk` registration) so corpus-embed spend folds into the cost
dashboard (AC-CD8 invariant); the NS-1 shared-primitive relocation (so corpus +
retrieval keep `chunk_document` / `content_hash` / `cosine_top_k` after Drive
retirement) is a coupled execution step. **Confidence:** confident default.

---

### AC-CD26 — Oversight dashboard (retroactive read surface + rollback matrix + source-override layer)

> **Minted in v1.9** — autonomous-content-generation cycle, **PR-D** (the final
> link). Ratified through the authenticated in-session channel (detail-plan
> PR #108 Slices 12/E1 + 13/E2; extraction PR #109 §C AM-17). Materialises the
> **retroactive-oversight** half of the autonomy model (§4.11, §6.5) — the
> "rein-in" the no-pre-publish-gate posture (AC-D31) depends on. One anchor
> spans the read surface (E1) and the rollback matrix (E2); the routers/domain
> module + the source-override migration are the **E1/E2 execution** deliverable.

**Decision.** A new admin-role-gated (AC-CD5) `app/routers/oversight.py` (thin —
validation/authz/envelope per AC-CD2) over `app/domain/oversight.py`, in two
halves authored as one contract:

**Read (E1) — pure aggregation, no new persistence.** Endpoints over the
existing `PublishRecord` (AC-D31) + `GenerationProvenance` (AC-D29) + the AC-D28
authority tiers: **recent publishes** (paginated, newest-first, filterable by
`low_confidence`/date/subject), **per-item provenance** (the claim → corpus
source → authority-tier chain), **confidence** (per-publish score + per-pass
self-review verdicts, AC-D30), **source-authority breakdown** (publishes/claims
aggregated by `authority_tier` / `source_host` — the rein-in radar), and
**spot-check sampling** (`sample_for_spotcheck(db, *, n, bias="low_confidence")`,
deterministic under a seed).

**Rollback (E2) — retract-not-delete (retire per AC-D14 + audit per §290), idempotent.**
The full matrix: `rollback_pill(pill_id)`, `rollback_question(question_id)`,
`rollback_batch(batch_id)` (every pill/question of the B3 batch, joined via
`PublishRecord`/`GenerationProvenance.batch_id`), and **`rollback_source(source_host)`**
(query `GenerationProvenance` by `source_host` → retract exactly the claims that
host grounded — per-assertion precision per AC-D29). The relocated AC-D21
safety-tag override (`override_safety_relevant(pill_id, *, value, actor_id)` —
retroactive `safety_relevant` retoggle + `safety_relevant_overridden_at`) is part
of this contract.

**Source-override layer (DS13-a — completes AC-D28's [A1+E2] design).** A small
`demoted_sources` table (`source_host`, `denied` / `tier_override`, `reason`,
`actor_id`, timestamp) that AC-D28's `is_allowlisted` / `authority_tier` checks
**consult on top of the code-VCS seed** (the AC-CD18 code registry supplies the
default tier; this DB override supplies any operator demotion; the effective
authority signal is the **join**). `rollback_source` writes a demotion here so the
corpus builder (AC-CD25) stops re-acquiring the discredited host — making
per-source rollback **durable** rather than purely reactive. This is the DS1-d
"code seed + DB overrides" promotion AC-D28 §1.3 forward-referenced, realized
where the need first appears.

**Rationale.** One oversight contract (read + rollback) keeps the dashboard's read
joins and the rollback joins on the same `PublishRecord` / `GenerationProvenance` /
`batch_id` / `source_host` keys the spine was built around (AC-D29 §5.1 relational
store "for exactly this"). Retract-not-delete retains everything for audit.

**Implications.** New `oversight.py` router + domain module (an absorbable
structural addition — structure-gate stays green, AC-CD2); the `demoted_sources`
migration (the only new table — read endpoints add none); the four `rollback_*`
fns + `override_safety_relevant` + `sample_for_spotcheck`; admin authz (AC-CD5);
audit actions (`pill_generation.rollback_*`); zero-network domain tests (AC-CD15).
The admin **FE** is a deferred deliverable — its surface spec is authored
(`fe-specs/FE-10-admin-oversight.md`); the build lands separately. **Confidence:**
confident default.

---

*End of Acumen CODE_SPEC. Status: v1 target. Paired with `SPEC.md` v1.9
and `DECISIONS.md` v1.9. No open technical anchors (AC-CD11 closed at v1.7; AC-CD10 closed at v1.8; AC-CD19 added at PR-032 as confident-default from inception; AC-CD20..24 added at PR-033 — Session 2 of the frontend canonical-doc drafting — codifying routing/guards (20), query+form+error patterns (21), SSE consumption (22), theming+primitives (23), and visual-content deferral (24)); AC-CD25 minted at v1.9 (autonomous-content cycle PR-A) — reference corpus builder, confident-default from inception. v1.9 (autonomous-content cycle PR-B) mints no AC-CD; it amends the AC-CD8 operation-enum prose seven→nine (`pill_generation`, `content_self_review`) — the provenance store rides the new AC-D29. v1.9 (autonomous-content cycle PR-C) mints no AC-CD either — the self-review protocol (`content_self_review`), the auto-publish gate, and the `PublishRecord` store ride the new AC-D30 + AC-D31; PR-C only updates the AC-CD8 `content_self_review` caveat to "protocol per AC-D30". **AC-CD26 minted at v1.9 (autonomous-content cycle PR-D, the final link)** — the retroactive oversight dashboard (read surface + rollback matrix + the DB source-override layer completing AC-D28's [A1+E2] design); confident-default from inception; the GapSignal §5 entity rides SPEC §5 + AC-D29/§6.5 (no separate AC-CD). The PR-A→PR-D amendment chain is complete; no open technical anchors.).*
