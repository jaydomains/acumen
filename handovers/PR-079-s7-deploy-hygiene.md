# Handover — PR-079 Slice 7: deploy hygiene (msw→devDeps + deploy docs) — FINAL

> Pre-deploy fix workstream, PR 8 of 8 (Slice 7) — the final slice; its merge
> is the production deployment gate. Authored on its own branch before the
> user-authorized final merge (the deploy-gate merge is the one merge the
> workstream reserves for explicit user sign-off); the merge SHA + date are
> recorded by the merge itself.

## PR identifier and link

- PR: #79 — `chore(deploy): msw→devDependencies + required-env/CORS deploy docs (Slice 7 / WS4) — FINAL`
- Link: https://github.com/jaydomains/acumen/pull/79
- Author / session: Claude Code (`claude/pre-deploy-pr8-s7-deploy-hygiene`)
- Date closed: 2026-05-31 (merged on user authorization after a fresh
  three-layer verify-poll)

## Phase reference

- ROADMAP phase: **none** — pre-deploy Slice 7 (WS4 subset + audit-5 §5
  deployment-readiness pass). The merge of this PR is the **production
  deployment gate** for KBC; nothing else stands between `main` and going
  live except hosting + DNS.
- Fully closes the pre-deploy fix workstream.

## What was built

- Files added: `docs/DEPLOYMENT.md` (operator deploy-readiness checklist).
- Files changed: `frontend/package.json` + `frontend/pnpm-lock.yaml`
  (`msw` dependencies → devDependencies); `.env.example` (required-in-prod
  annotations + boot-check cross-reference); `README.md` (pointer to the
  deploy doc).
- Summary: closes the remaining WS4 pre-deploy subset — `msw` was bundled
  into the production install but is only used under `src/mocks/` (dev/test);
  the required-in-prod env set + the no-wildcard CORS rule are now documented
  and cross-referenced to the Slice 2 fail-closed boot check.

## What was decided in this PR

- **`msw` → devDependencies** (Decision D4 INCLUDE): real prod-bundle hygiene
  today; verified the prod build never imports `msw` outside `src/mocks/`.
- **Deploy docs agree with the boot check by construction:** `.env.example`
  and `docs/DEPLOYMENT.md` describe exactly the conditions
  `app/config.py::check_startup_config` enforces (Slice 2), so doc and code
  cannot silently diverge on the secret/CORS rules.
- New anchors: none. No SPEC/DECISIONS/CODE_SPEC edits.

## Drift flags raised and how they were resolved

- Moving `msw` between dependency sections changes `pnpm-lock.yaml`'s importer
  section; regenerated the lockfile so `pnpm install --frozen-lockfile` (the
  CI gate) stays green. No other drift.

## Open questions deferred to a later phase

- **Post-deploy workstreams (out of scope):** WS1 (typed wire contracts), WS2
  (transactional CRUD+audit+validation service — also lands the Celery
  audit-row write), WS3 (real-DB integration tier), WS4 remainder
  (competence/cost N+1 batch-loads, admin-`Field` a11y labels, aria-live).
  Sequencing per `audits/2026-05-30-audit-5-improvements.md` §5: WS1‖WS2,
  then WS3, WS4 remainder anytime.
- S8-F1 / S8-F2 (audit-4 High) deferred per Decision D4 — subsumed by WS1.

## Build state vs spec

- Complete: `msw` is no longer a prod dependency; deploy-readiness doc
  enumerates every required-in-prod var + the no-wildcard CORS rule;
  `.env.example` annotated.
- Partial / Stubbed: none.

## Test coverage and CI results

- No new tests (hygiene + docs). The gate is `pnpm install --frozen-lockfile`
  + `build` staying green after the `msw` move.
- Local gate (all green): FE `pnpm install --frozen-lockfile` · `lint` ·
  `format:check` · `codegen:check` · `typecheck` · `test --run` (132 files /
  952) · `build` (msw not in the prod bundle); BE `structure_gate`
  (`.env.example` path intact). The final merge proceeds only on a fresh
  `get_check_runs` three-layer verify-poll (every check `success`, zero
  `in_progress`, `mergeable_state: clean`).

## Post-merge validation considerations

- Container-baked without source bind-mount? **Yes** — the `frontend` image
  bakes `package.json`/lockfile. Post-merge local validation requires
  `docker compose build --no-cache frontend` before re-running; a production
  install (`pnpm install --prod`) now excludes `msw`.
- After deploy, the boot check is the live guard: a non-dev `APP_ENV` with a
  `change-me` secret or wildcard/localhost CORS will **refuse to start** —
  intended (see `docs/DEPLOYMENT.md`).

## Anything a fresh Claude Code session needs to pick up cleanly

- This closes the pre-deploy fix workstream (all 5 fix-now items + the WS4
  pre-deploy subset). The post-deploy workstreams WS1–WS4 are the next track
  (audit-5 §3/§5).
- `docs/DEPLOYMENT.md` is the operator entry point for going live; keep it in
  sync with `app/config.py::check_startup_config` if the boot rules change.
- Recommended next action: hosting + DNS, then the post-deploy WS1/WS2 track.
