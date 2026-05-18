# Handover — PR-006 P1 data model & migrations

## PR identifier and link

- PR: #6 — P1 — Data model & migrations
- Link: https://github.com/jaydomains/acumen/pull/6
- Author / session: Claude Code session (starting-acumen-p1, five-slice
  incremental execution with Gitar review between slices)
- Date closed: 2026-05-18

## Phase reference

- ROADMAP phase closed by this PR: **P1 — Data model & migrations**.
- Does this PR fully close the phase? **Yes.** All five CHECKLIST P1
  rows are `built` with real evidence (a test path that exists and
  passes). Live `docker compose up` + a DB-backed migration run were not
  executed (no Docker daemon / Postgres in the build sandbox);
  equivalent offline verification was done — see Test coverage.

## What was built

- Files added:
  - `alembic/versions/0002_p1_data_model.py` — the first real
    migration.
  - `tests/unit/test_p1_schema.py` — the P1 schema assertion test
    (10 tests).
  - `handovers/PR-006-p1-data-model.md` — this handover.
- Files changed:
  - `app/models.py` — replaced the P0 `Base`-only stub with the full
    P1 model set (34 tables, 17 PG enums, mixins, stable seed UUID
    constants; `Base.type_annotation_map` makes every `datetime`
    `timestamptz`).
  - `CHECKLIST.md` — P1 rows → `built` with evidence; the
    `system_settings` row relabelled v1.2 → v1.3 (doc accuracy; the
    v1.3 amendment did not change any settings default).
- Files removed: none.
- Summary: P1 defines every SPEC §5 entity plus the supporting/join and
  auth/async tables (CODE_SPEC §4 mapping) as SQLAlchemy 2.0 models in
  the single `acumen` schema, and a reversible Alembic migration whose
  table/column/index set is **compiled from `Base.metadata`** so it
  cannot drift from the models. The migration asserts the `vector`
  extension, creates the native enums and an IVFFlat index, installs a
  `BEFORE UPDATE` trigger backstopping `updated_at`, and seeds the
  single tenant, the `system_settings` v1.3 defaults row, and the three
  immutable system groups.

## What was decided in this PR

- New anchors introduced: **none.** P1 implements existing AC-CD3 /
  AC-CD4 and lands the data shape for AC-D2/3/4/6/7/8/9/10/11/13/15/16/
  17/18/19/20/21/22/23/24/26/27.
- Existing anchors depended on: AC-CD3 (single schema, reversible
  per-schema migration), AC-CD4 (entity→table mapping, UUID PK +
  timestamp + `tenant_id` conventions, IVFFlat), AC-CD7 (`processing_
  tasks` contract — AC-CD7 is the authority over the SiteMesh contract
  on any conflict), AC-CD8/AC-CD15 (provenance columns; no-network
  test), the v1.3 AC-D19 three-state `review_status`.
- Modelling decisions recorded in-code (not new anchors):
  - `app_user.role` is an open `String`, not a PG enum, per AC-D2.
  - `question` has intentional three-way nullable FK ownership
    (`test_id` ∨ `attempt_id` ∨ `pill_id`) per AC-D5/D17/D20 —
    documented in the model docstring; not a normalisation defect.
  - `attempt_anchor.score` is a denormalised query-efficiency surface
    sourced from `response.response_score`, documented as such.
  - AC-D4 #5 served-set tracking is `served_at` + `served_text`
    columns on `learning_material` (AI material is per-serve per
    weakness instance) rather than a separate serve-history table.
  - `engagement_status` is **not** a column (AC-D26 derived-only); the
    test asserts its absence.

## Drift flags raised and how they were resolved

- **CODE_SPEC §4 timestamp type — resolved in implementation.** Bare
  `Mapped[datetime]` renders `TIMESTAMP WITHOUT TIME ZONE`, but
  CODE_SPEC §4 requires `timestamptz`. Resolved by registering
  `Base.type_annotation_map = {datetime: DateTime(timezone=True)}` so
  every datetime column is `timestamptz`. No spec change needed
  (implementation conformed to the existing spec).
- **Generated-SQL quoting inconsistency — resolved in
  implementation.** Hand-written `op.execute` statements quoted the
  schema (`"acumen".x`) while SQLAlchemy's compiled tables render it
  unquoted (`acumen.x`). Unified on the unquoted form (only the
  reserved `"group"` stays quoted) so the emitted SQL is internally
  consistent. No spec impact.
- No spec/implementation divergence requiring a user-authored
  clarification PR was hit.

## Open questions deferred to a later phase

- **AC-CD11 — cross-family review latency rule.** Untouched; remains
  the sole CHECKLIST drift question with its **P6 pre-build gate**. Do
  not build the AC-D19 blocking submit path before that gate is
  resolved with the user. P1 only lands the `grade_review` table with
  the three-state `review_status`; no submit-path behaviour.
- **IVFFlat `lists=100` is a tuneable.** Over-provisioned for the v1
  small corpus (pgvector guidance ≈ rows/1000; harmless). Revisit when
  the Drive corpus grows past ~50k chunks (P9 territory).

## Build state vs spec

- Complete: all 34 P1 tables + 17 enums; reversible migration 0002;
  pgvector assert + `Vector(1536)`; `system_settings` v1.3 defaults
  seed; tenant + 3 system-group seeds; `updated_at` DB-trigger
  backstop; the P1 assertion test.
- Partial: none.
- Stubbed: domain/router/AI behaviour for these tables remains the P0
  phase-tagged stubs (filled P2+). The AI-provenance columns exist but
  the capture wiring is P5 (AC-CD8). RLS on `tenant_id` is a documented
  SiteMesh port seam, not built (AC-CD3).

## Test coverage and CI results

- Tests added: `tests/unit/test_p1_schema.py` — table-set parity,
  `system_settings` v1.3 defaults, key-column presence (Vector(1536),
  3-state `review_status`, nullable `competence_estimate`, shuffle/lock
  flags, anchor calibration/exclusion fields, served-set columns,
  `role` is String, AC-CD7 `processing_tasks`), `engagement_status`
  absence, and the Alembic offline up/down round-trip. 10 tests, all
  pass. Total suite: 15 passed (5 P0 + 10 P1).
- `conftest.py` no-network guard honoured; the migration round-trip
  runs Alembic in offline `--sql` mode in a subprocess (opens no
  connection).
- Local verification (Python venv): `ruff check .` clean;
  `ruff format --check .` clean (51 files); `mypy app` — no issues
  (40 files); `pytest -q` — 15 passed; `structure_gate.py` /
  `check_unpinned_deps.py` exit 0. No new dependencies (pgvector was
  already pinned in P0).
- Migration verified offline (no daemon in sandbox):
  `alembic upgrade base:head --sql` → 34 tables + 17 enums + IVFFlat +
  34 `updated_at` triggers + seed INSERTs, exit 0;
  `alembic downgrade head:base --sql` → 34 DROP TABLE + 17 DROP TYPE +
  34 DROP TRIGGER, exit 0. A live DB round-trip should be run when a
  Postgres+pgvector instance is available.
- CI result at merge: the `.github/workflows/ci.yml` chain runs on
  push; not yet observed green on GitHub at handover write time.
- Gitar: PR #6 "Approved with suggestions", 1 finding (Python-level
  `onupdate` is not a DB trigger) — resolved in this PR by the
  `acumen.set_updated_at()` `BEFORE UPDATE` trigger in migration 0002
  and a `TimestampMixin` docstring note.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading: `SESSION_START.md`, the most recent handover (this
  file), `ROADMAP.md` **P2**, `CODE_SPEC.md` §6 (auth) + AC-CD5,
  `DECISIONS.md` AC-D2/D10/D16.
- Next action: **ROADMAP P2 — Auth & user management** on a fresh
  branch. The tables it needs already exist (`app_user`,
  `account_setup_token`, `password_reset_token`, the
  active/deactivated `user_status` enum, `privacy_ack_at`); P2 wires
  argon2id + JWT + the single role/deactivation/privacy dependency in
  `app/permissions.py` + `app/routers/auth.py` (AC-CD5 port seam).
- Environment: `python -m venv .venv && pip install -r
  requirements.txt -r requirements-dev.txt`. The system PyJWT (Debian)
  cannot be uninstalled by pip — use a venv, do not `pip install`
  system-wide.
- Traps:
  - Do **not** build the AC-D19 blocking submit path before the P6
    AC-CD11 gate.
  - Migration 0002 is compiled from `Base.metadata`; if a future
    migration alters a P1 table, write it as a normal incremental
    Alembic migration — do **not** edit 0002 (it is the baseline and
    its parity test pins it to the P1 model state).
  - `app_user.role` is a `String` by design (AC-D2) — do not "tighten"
    it into an enum.
  - `engagement_status` must stay derived (AC-D26); the schema test
    fails if a column is added.
  - Offline Alembic needs an explicit range (`base:head` /
    `head:base`); plain `upgrade head --sql` renders only the delta.
