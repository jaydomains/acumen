# Handover — PR-098 (Slice 1 · WS-A · C1 auth activation path)

## PR identifier and link

- PR: #98 — "Slice 1 — WS-A: auth activation path (C1) — frontend-origin setup/reset links + boot guard"
- Link: https://github.com/jaydomains/acumen/pull/98
- Author / session: Claude Code — post-audit pre-deploy fix workstream (execution session)
- Date closed: 2026-06-06 (squash-merged as `d88705d`)

## Phase reference

- ROADMAP phase closed by this PR: none — this is Slice 1 of the post-audit
  pre-deploy fix workstream (plan `621a549`/#94), not a ROADMAP/FE phase.
- Does this PR fully close the phase? Partial — closes audit finding **C1**
  (1 of the 5 pre-deploy code findings; V4/V5/V1/V2 are Slices 2–4).

## What was built

- Files changed:
  - `app/config.py` — new `Settings.app_frontend_url` (`APP_FRONTEND_URL`,
    default `http://localhost:3000`), distinct from `app_public_url`; two
    fail-closed clauses in `check_startup_config` (empty/loopback frontend
    URL; frontend URL ∉ CORS list) that **append to `errors`** (never raise);
    a `field_validator` stripping a trailing slash from `app_frontend_url` +
    `app_public_url` (Gitar fix — prevents `//setup/<token>` double-slash).
  - `app/permissions.py` — `setup_email_content` / `reset_email_content`
    rebuilt as `{app_frontend_url}/setup|reset/{token}` (path-segment token
    off the frontend origin).
  - `.env.example`, `docs/DEPLOYMENT.md` — document `APP_FRONTEND_URL`
    (required-in-prod, no-localhost, must ∈ `CORS_ALLOWED_ORIGINS`).
- Files added:
  - `tests/integration/test_auth_email_links.py` — link host + path-segment
    shape, token-as-last-segment / no-query-string, trailing-slash
    normalisation.
- Files changed (tests): `tests/unit/test_startup_config.py` (app_frontend_url
  fail-closed cases + CORS-member default in the helper);
  `tests/integration/test_p2_auth_flows.py` +
  `tests/integration/test_slice_b_auth_setup_preview.py` (token-extraction
  regex moved from `token=…` to the `/<flow>/<token>` path shape).
- Summary: setup/reset email links 404'd for every invited user (query-string
  token against a path-segment FE route, built off the API origin). Slice 1
  builds the links from a new, boot-guarded public frontend-origin setting
  with a path-segment token, per the AC-CD5 link contract (#96).

## What was decided in this PR

- Implements **AC-CD5** (link contract, amended #96 — the binding contract)
  and **Decision D2(a)** (`app_frontend_url` distinct from `APP_PUBLIC_URL` +
  CORS-membership boot clause). Honors **AC-CD2** (structure-gate: config
  reads only `Settings`; `app/main.py` imports no `app.ai`/`app.domain`).
- New anchors introduced: none (the AC-CD5 amendment landed separately at #96).
- Existing anchors depended on: AC-CD5, AC-CD2, AC-CD19 (CORS origin model).
- **D1** (PR #83 disposition): #83 was closed unmerged by the spec author;
  this PR supersedes it (both facets + test in one commit).

## Drift flags raised and how they were resolved

- No spec drift. The AC-CD5 + FE-3 spec-drift gates were resolved before
  execution (amendments #96/#97 on main); Slice 1 implemented against the
  amended AC-CD5 body.
- Two existing tests were coupled to the old `?token=` link shape (their
  token-extraction regex). Updated in the same commit (fix+test paired) — not
  spec drift, just implementation-coupled test fixtures.

## Open questions deferred to a later phase

- None for C1. Workstream carry-forward (V3 legal sign-off, post-deploy tier,
  audit-5 WS1–WS4, DEC-S3-C, catalogue overlay, counterpart-change-detector
  skill) is tracked in the final workstream handover, untouched here.

## Build state vs spec

- Complete: C1 closed — links resolve to `{frontend-origin}/setup|reset/{token}`;
  non-dev boot fails closed on an empty/loopback/non-CORS-member frontend URL;
  dev + CI boot clean.
- Partial: none.
- Stubbed: none.

## Test coverage and CI results

- Tests added/changed: `test_auth_email_links.py` (new, 5 cases incl.
  trailing-slash); `test_startup_config.py` (+5 app_frontend_url cases);
  two token-regex fixups.
- Coverage: backend `pytest --ignore=tests/e2e` → 918 passed locally (clean
  venv); `mypy app`, `ruff check`/`format --check`, `structure_gate` all clean.
- CI result at merge: three-layer green — all 11 check runs success (checks,
  docker-build, migration-chain, e2e ×2, Gitar), `mergeable_state: clean`,
  Gitar **Approved (1 resolved / 1 finding)** after the trailing-slash fix.
- Manual verification: none beyond the automated suite (the integration test
  asserts the link host + path shape directly).

## Post-merge validation considerations

- Touches backend code that runs in the `acumen-api` container. If validating
  locally after merge, rebuild without cache before re-running:
  `docker compose build --no-cache acumen-api`.
- Re-verify sequence: `pytest tests/integration/test_auth_email_links.py
  tests/unit/test_startup_config.py --ignore=tests/e2e`; then with
  `APP_ENV=production` + a real CORS-member `APP_FRONTEND_URL` confirm boot
  clean, and with an empty/localhost/non-member value confirm boot raises.
- **Deploy note (operator):** production must set `APP_FRONTEND_URL` to the
  real browser origin (distinct from `APP_PUBLIC_URL`) and include it in
  `CORS_ALLOWED_ORIGINS`, or the app refuses to boot.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading: the merged plan `plans/2026-06-06-post-audit-pre-deploy-fix-workstream.md`,
  AC-CD5 (CODE_SPEC.md), the PR #94 spec-author ruling comment.
- Trap: `check_startup_config` must never raise — it appends to `errors`; the
  `RuntimeError` is raised one layer up in `run_startup_checks`. Keep all C1
  config logic in `app/config.py` reading only `Settings` (AC-CD2).
- Recommended next action: Slices 2–4 (V4/V5, V1, V2) — see their handovers.
