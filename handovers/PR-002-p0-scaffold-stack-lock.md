# Handover — PR-002 P0 scaffold & stack lock

## PR identifier and link

- PR: PR-002 — P0 scaffold & stack lock
- Link: <filled at PR open>
- Author / session: Claude Code session (starting-acumen-p1 → rescoped to P0)
- Date closed: 2026-05-18

## Phase reference

- ROADMAP phase closed by this PR: **P0 — Scaffold & stack lock**.
- Does this PR fully close the phase? **Yes.** All seven CHECKLIST P0
  rows are `built` with evidence. Live `docker compose up` and a
  DB-backed migration run were not executed (no Docker daemon in the
  build sandbox); equivalent static verification was done — see
  Test coverage.

## What was built

- Files added:
  - Deps: `requirements.txt`, `requirements-worker.txt`,
    `requirements-dev.txt`.
  - Containers/infra: `Dockerfile`, `docker-compose.yml`,
    `infra/postgres/init.sql`, `infra/traefik/traefik.yml`.
  - Alembic: `alembic.ini`, `alembic/env.py`,
    `alembic/versions/0001_initial_empty.py`.
  - App package (P0 stubs): `app/__init__.py`, `app/main.py`,
    `app/config.py`, `app/models.py`, `app/schemas.py`,
    `app/permissions.py`, `app/worker.py`, `app/beat_schedule.py`,
    `app/routers/*` (17 routers + `__init__`), `app/ai/*`
    (`provider/anthropic/openai/cost` + `prompts/`), `app/domain/*`
    (8 modules).
  - Tooling/CI: `scripts/structure_gate.py`,
    `scripts/check_unpinned_deps.py`, `scripts/__init__.py`,
    `pyproject.toml`, `.github/workflows/ci.yml`, `.env.example`.
  - Tests: `tests/conftest.py`, `tests/unit/test_health.py`,
    `tests/unit/test_structure_gate.py`,
    `tests/unit/test_requirements_pinned.py`,
    `tests/{integration,e2e}/.gitkeep`.
- Files changed: `CHECKLIST.md` (P0 rows → `built`).
- Branch renamed `claude/p1-data-model-migrations-4VQx6` →
  `claude/p0-scaffold-stack-lock` (per user; `claude/` prefix retained
  for remote/PR-automation consistency).
- Summary: The repo layout per CODE_SPEC §3, the exact §2 stack pins,
  multi-stage Dockerfile + compose stack, Alembic per-schema env with a
  clean reversible empty baseline, a setup-only FastAPI app
  (`/healthz` `/readyz`), pydantic-settings config + `.env.example`,
  and the structure/unpinned-deps gates wired into CI. No domain logic —
  every router/domain/ai module is a phase-tagged stub.

## What was decided in this PR

- New anchors introduced: **none**. P0 implements existing AC-CD1,
  AC-CD2, AC-CD3, AC-CD16, AC-CD17, AC-CD18.
- Existing anchors depended on: AC-CD1/2/3/16/17/18; data-shape
  anticipation for AC-D2/7/9/15/20/21/22/26 deferred to P1.
- **Scope decision (recorded with the user):** the session opened
  intending P1 but P1's Done-when is unverifiable without P0. Per user
  direction the branch delivers **P0 only**; P1 data model is the next
  PR in a fresh session.

## Drift flags raised and how they were resolved

- **`requirements-dev.txt` — third requirements file (AC-CD1
  deviation). PROMINENT.** CODE_SPEC §2 names only two requirements
  files (`requirements.txt`, `requirements-worker.txt`).
  `requirements-dev.txt` was added for CI tooling (`pytest`,
  `pytest-asyncio`, `ruff`, `mypy`) so lint/type/test tooling never
  ships in the runtime or worker images. The user explicitly accepted
  this as a **documented deviation** (Option 1), not a CODE_SPEC
  amendment. **Guard for future sessions:** if a fourth requirements
  file is ever proposed (e.g. `requirements-test.txt`), do **not**
  stack another silent precedent — raise a CODE_SPEC **AC-CD1
  amendment** instead. The deviation is also called out in-file at the
  top of `requirements-dev.txt`. This is a resolved divergence, so it
  lives here and not as a CHECKLIST drift question.

## Open questions deferred to a later phase

- **AC-CD11 — cross-family review latency rule.** Untouched; remains
  the sole CHECKLIST drift question with its **P6 pre-build gate**. Do
  not build the AC-D19 blocking submit path before that gate is
  resolved with the user.

## Build state vs spec

- Complete: P0 deliverables (repo layout, pins, Dockerfile/compose,
  Alembic env + empty migration, setup-only app, config + env example,
  structure & unpinned-deps gates, CI).
- Partial: none.
- Stubbed: all `app/routers/*`, `app/ai/*`, `app/domain/*`,
  `app/{models,schemas,permissions,worker,beat_schedule}.py` — each
  carries a docstring + `(pending P{n})` marker citing the ROADMAP
  phase that fills it. `models.py` is `Base`/schema-metadata only.

## Test coverage and CI results

- Tests added: `test_health.py` (healthz/readyz 200),
  `test_structure_gate.py` (paths + main.py setup-only),
  `test_requirements_pinned.py` (no unpinned deps). 5 tests, all pass.
- `conftest.py` blocks outbound `socket.connect` (AC-CD15 posture;
  full provider stubs land P5).
- Local verification (Python 3.11 venv): `ruff check .` clean;
  `ruff format --check .` clean (49 files); `mypy app` — no issues
  (40 files); `pytest -q` — 5 passed; `structure_gate.py` /
  `check_unpinned_deps.py` exit 0.
- `docker compose config -q` valid. Alembic migration verified offline
  (no daemon in sandbox): `alembic upgrade head --sql` and
  `alembic downgrade head:base --sql` both clean; the `alembic_version`
  table is correctly created in the `acumen` schema (proves
  `env.py` `version_table_schema` + per-schema pattern, AC-CD3).
- CI workflow `.github/workflows/ci.yml` runs the full chain on
  Python 3.12 (unpinned-deps, structure-gate, ruff check/format, mypy,
  pytest). Not yet observed green on GitHub at handover write time.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading: `SESSION_START.md`, `CHECKLIST.md`, `ROADMAP.md`
  **P1**, `CODE_SPEC.md` §4 (entity→table mapping) + §4 system_settings
  column list, the relevant AC-D anchors (D2/7/9/15/16/20/21/22/26)
  and AC-CD3/AC-CD4.
- Next action: **ROADMAP P1 — data model & migrations** on a fresh
  branch. Define every SPEC §5 entity + supporting tables in
  `app/models.py`, replace `0001_initial_empty` follow-on with the
  first real migration, seed the single-tenant `system_settings` row
  with v1.2 defaults (incl. `competence_sensitivity` 2.0,
  `anchor_calibration_prior_weight` 20), and add the table-set +
  defaults assertion test.
- Environment: copy `.env.example` → `.env` (compose `env_file` is
  `required: false`, so the stack also boots on config defaults).
  Local dev: `python -m venv .venv && pip install -r requirements.txt
  -r requirements-dev.txt`.
- Traps:
  - Do **not** build the AC-D19 blocking submit path before the P6
    AC-CD11 gate.
  - `app/main.py` must stay setup-only — the structure-gate forbids
    `app.domain` / `app.models` / `app.ai` / DB / Celery imports there.
    Router includes ARE allowed and are wired starting **P2**; do not
    "fix" the gate to forbid router includes.
  - Branch naming: the harness-designated branch was the `p1` slug;
    this PR is on `claude/p0-scaffold-stack-lock` by explicit user
    instruction. The original remote branch was left intact (not
    deleted).
  - `requirements-dev.txt` deviation — see Drift flags; honour the
    AC-CD1-amendment guard before adding any further requirements file.
