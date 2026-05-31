# Handover — PR-074 Slice 2: startup config validation (A4-S3-C + WS4 subset)

> Pre-deploy fix workstream, PR 3 of 8 (Slice 2). Authored post-merge per
> the pipelined cadence; rides on the PR-4 (Slice 3) branch.

## PR identifier and link

- PR: #74 — `fix(config): startup config validation — surface stub AI + fail closed on insecure prod (Slice 2 / A4-S3-C + WS4)`
- Link: https://github.com/jaydomains/acumen/pull/74
- Author / session: Claude Code (`claude/pre-deploy-pr3-s2-startup-config`)
- Date closed: 2026-05-31 (squash-merged `c0b65df`)

## Phase reference

- ROADMAP phase closed: **none** — pre-deploy fix workstream Slice 2
  (audit-5 §4 #2, the deploy-gate) + the WS4 pre-deploy subset (startup
  key/secret check). Implements Decision **D2**.
- Fully closes? Closes fix-now item A4-S3-C + X2-#4. The matching
  required-env-var / CORS-prod docs are Slice 7's scope.

## What was built

- Files added: `tests/unit/test_startup_config.py`.
- Files changed: `app/config.py` (`check_startup_config` + `DEV_ENVS` +
  `_cors_is_insecure`), `app/main.py` (`run_startup_checks` + FastAPI
  `lifespan`).
- Summary: `resolve_provider` silently returns the stub provider on an empty
  AI key (`app/ai/provider.py`) — a deployment missing its keys served stub
  AI as real. There was no boot guard against default `change-me` secrets or
  wildcard/localhost CORS reaching production. `check_startup_config` now
  returns `(warnings, errors)`; the new lifespan logs warnings loudly and
  raises (aborting startup) on errors.

## What was decided in this PR

- **Decision D2 implemented (default-strict, relax-for-dev):** WARN per
  missing AI key in **every** env; RAISE when `app_env` ∉ `DEV_ENVS`
  (`{"development","dev","local","test"}`) AND a default `change-me` secret
  or wildcard/localhost CORS is present. The dev-set includes the real
  `app_env` default `"development"` so the stock dev container + CI (no
  `APP_ENV` set) boot clean (the rev-3 sentinel correction — fail-closed,
  not fail-everywhere).
- **G3 honoured:** the helper lives in `app/config.py` and reads only
  `Settings`, so `app/main.py` never imports `app.ai`/`app.domain` — the
  structure-gate stays green with no new module and no gate change. The
  lifespan uses stdlib `logging` only.
- `provider.py:361`'s docstring already promised this startup warning; Slice
  2 makes it fire (no provider edit).
- New anchors: **none** (no SPEC/DECISIONS/CODE_SPEC edits). The intentional
  knob dispositions in `CODE_SPEC.md §4` are unaffected.

## Drift flags raised and how they were resolved

- **Gitar finding (fix-round 1):** `_cors_is_insecure` used a bare
  `"localhost" in o` substring match — false-positive on a legit public
  origin like `https://notlocalhost.example.com` (would wrongly RAISE in
  prod) and missed IPv6 loopback. Resolved by anchoring on `://localhost` /
  `://127.0.0.1` / `://[::1]` markers (`_LOOPBACK_MARKERS`) + added tests for
  both the IPv6-loopback positive and the substring-false-positive negative.
  Gitar re-reviewed → approved, finding resolved.
- No canonical spec drift.

## Open questions deferred to a later phase

- **WS4 (post-deploy)** generalises this into a fuller observability sweep
  (structured-log/metrics hooks). Slice 6 adds Celery task-failure
  surfacing; Slice 7 adds the required-env-var + no-wildcard-CORS docs that
  pair with these boot assertions.
- Knob-promotion policy (`CODE_SPEC.md §4`): the dev-set and CORS markers are
  code constants; they migrate to `system_settings` only on a real
  operational signal.

## Build state vs spec

- Complete: WARN-on-missing-AI-key (every env) + fail-closed boot on insecure
  non-dev config; lifespan wired; X2-#4 covers warn/no-warn, dev-set
  boots-clean, prod/unknown raises (secret + CORS), prod-clean-when-configured.
- Partial / Stubbed: none.

## Test coverage and CI results

- Tests added: `tests/unit/test_startup_config.py` (17 cases incl. the two
  Gitar-driven CORS cases).
- CI at merge: **all green** — fresh `get_check_runs` verify-poll on head
  `cbe165f` showed 11/11 `completed/success` (Gitar approved + check-run
  success, `checks`, `migration-chain`, `docker-build`, `e2e`),
  `mergeable_state: clean`.
- Manual verification: local `structure_gate` + `ruff` + `mypy app` (62
  files clean) + `pytest -q --ignore=tests/e2e` (888).

## Post-merge validation considerations

- Container-baked without source bind-mount? **Yes** — `acumen`,
  `acumen-worker`, `acumen-beat`, `migrate` all build from `context: .`. A
  change to `config.py`/`main.py` requires `docker compose build --no-cache
  <service>` before local re-run (stale-image trap). The new lifespan runs
  at container start: a non-dev `APP_ENV` with default secrets will now
  **fail the container boot** — intended.
- Re-verify: `pytest -q tests/unit/test_startup_config.py`; or set
  `APP_ENV=production` + default secrets and confirm `uvicorn`/container boot
  aborts with the `Refusing to start` RuntimeError.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading beyond `SESSION_START.md`: plan §G3 + Decision D2 (incl.
  the rev-3 dev-set correction).
- Known traps: the boot check reads only `Settings` — **do not** import
  `app.ai`/`app.domain` from `main.py` (structure-gate). `TestClient(app)`
  without a `with` block does NOT run the lifespan (that's why the existing
  `test_cors`/`test_health` stayed green); a test that needs the lifespan to
  fire must use `with TestClient(app)`.
- Recommended next action: **PR 4 / Slice 3 (grading shuffle inversion)** —
  this branch (committed; opening now).
