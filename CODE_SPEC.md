# CODE_SPEC — Acumen technical specification & stack lock (canonical)

> **Companion to** `SPEC.md` (functional, v1.2) and `DECISIONS.md`
> (product anchors AC-D1–AC-D27, v1.2). This document is the canonical
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
> **Status:** v1 target. Paired with `SPEC.md` v1.8 / `DECISIONS.md` v1.8.
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
    beat_schedule.py   # the seven crons + bootstrap enqueue
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
grade_review, anchor_self_review}; the enum (not the method) drives
per-operation model + prompt_version resolution and cost/provenance
persistence. The seven operations route to the four protocol methods:
generation / weakness / learning_material / pill_proposal -> `generate()`;
grading -> `grade()`; grade_review / anchor_self_review -> `review()`;
embed (Drive RAG only) -> `embed()`. Resolution order per operation per
AC-D12: Test override -> `system_settings.provider_by_operation` /
`model_by_operation` -> coded default; `review_provider` is the
convenience default for grade_review / anchor_self_review. Provenance
(provider, model, prompt_version, prompt_tokens, completion_tokens,
cost_usd) persists on **every** AI-produced entity — the shipped
AI-provenance columns on `grade`, `grade_review`, `question`,
`anchor_question`, `weakness_report`, `learning_material`, and the
`processing_tasks.payload` for pill proposals (SPEC §6 literal reading;
broadens the earlier "every grade/question row" wording).

---

## 8. Background processing

Celery + Redis. `app/worker.py` exposes `make_celery(...)` (SiteMesh
pattern). `processing_tasks` rows track async work
(`pending|running|done|failed` + payload + error). `app/beat_schedule.py`
registers the seven crons (SPEC §8.9): Drive ingest (daily), anchor
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
fails on an unpinned add. **Confidence:** confident default.

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
**Rationale:** the smallest correct auth that ports cleanly.
**Implications:** one-file swap at port (SPEC §9.2).
**Confidence:** confident default.

### AC-CD6 — REST `/v1` + error envelope + SSE for AC-D25
**Decision:** §5 conventions; SSE for the per-Testee feed; sequential
endpoint for benchmark; `/v1/internal` reserved.
**Rationale:** matches the AC-D25 v1.2 split; OpenAPI is the future
frontend contract.
**Implications:** the frontend spec consumes this contract (separate
doc). **Confidence:** confident default.

### AC-CD7 — Celery + Redis + beat; `processing_tasks`; bootstrap as job
**Decision:** §8 background design; seven crons; idempotent bootstrap job.
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
**Implications:** `app/routers/review.py` (planned at P6) calls
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

---

*End of Acumen CODE_SPEC. Status: v1 target. Paired with `SPEC.md` v1.4
and `DECISIONS.md` v1.4. One open technical anchor: AC-CD11 (P6 gate).*
