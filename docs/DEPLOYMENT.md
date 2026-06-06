# Deployment readiness

> Internal operator checklist for taking Acumen to production. Pairs with
> `.env.example` (the annotated variable reference) and the boot-time
> configuration check in `app/config.py::check_startup_config` (run from the
> FastAPI lifespan in `app/main.py`). Added by the pre-deploy fix workstream
> (audit-5 §5 deployment-readiness pass).

## Boot-enforced configuration (fail-closed)

When `APP_ENV` is **not** one of the dev-set `{development, dev, local,
test}`, the application's startup check **raises and refuses to boot** if any
of the following hold. This is intentional — a misconfigured production
container fails fast at startup rather than serving insecurely.

| Condition | Result at boot |
|---|---|
| `APP_SECRET_KEY` is still `"change-me"` | **RAISE** — set a real long random secret |
| `JWT_SECRET` is still `"change-me"` | **RAISE** — set a distinct real long random secret |
| `CORS_ALLOWED_ORIGINS` is wildcard (`*`) or a localhost/loopback origin | **RAISE** — set the real frontend origin(s) |
| `ANTHROPIC_API_KEY` unset | **WARN** (every env) — provider falls back to a stub, not a real model |
| `OPENAI_API_KEY` unset | **WARN** (every env) — review + embeddings fall back to a stub |

The dev-set includes `development` (the `APP_ENV` default) so the stock dev
container and CI — which set no `APP_ENV` — boot clean. Any **unrecognised**
`APP_ENV` value (e.g. `staging`) is treated as non-dev and fails closed on the
conditions above.

## Required-in-production environment variables

Set all of these for a real deployment (see `.env.example` for the full
annotated list and non-secret defaults):

- **Secrets (must override the `change-me` defaults):** `APP_SECRET_KEY`,
  `JWT_SECRET`.
- **CORS:** `CORS_ALLOWED_ORIGINS` — the real frontend origin(s), comma-
  separated, **no wildcard and no localhost** (e.g.
  `https://acumen.example.com`).
- **AI providers:** `ANTHROPIC_API_KEY` (5 primary ops), `OPENAI_API_KEY`
  (cross-family review + embeddings). Unset → stub provider + a loud startup
  WARNING.
- **Data stores:** `DATABASE_URL` (async), `DATABASE_MIGRATION_URL` (sync),
  `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`.
- **Email (setup/reset/reminder/escalation):** `SMTP_HOST`, `SMTP_PORT`,
  `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_SENDER`.
- **Environment:** `APP_ENV` set to `production` (or any non-dev value) to
  arm the fail-closed boot checks; `APP_PUBLIC_URL` set to the externally-
  visible API URL.
- **Frontend origin (setup/reset links):** `APP_FRONTEND_URL` set to the
  externally-visible **frontend** origin (the browser app, e.g.
  `https://acumen.example.com`) — **distinct from** the API `APP_PUBLIC_URL`.
  Setup/reset email links are built from it with a path-segment token
  (AC-CD5 link contract). Required-in-prod, no-localhost, and **must be a
  member of `CORS_ALLOWED_ORIGINS`** (the browser app's own origin must be
  CORS-allowed); the boot check rejects an empty/localhost value or one
  outside the CORS list in a non-dev `APP_ENV` (see the CORS checklist below).

Optional / feature-gated: `GOOGLE_DRIVE_CREDENTIALS_JSON` +
`GOOGLE_DRIVE_FOLDER_ID` (Drive RAG, AC-D22), `WEB_SEARCH_API_KEY`
(safety-link curation, AC-D21). Unset disables the feature; it does not
block boot.

## CORS production checklist (no wildcard)

- `CORS_ALLOWED_ORIGINS` must list the exact production frontend origin(s).
- Never `*` and never a `localhost`/`127.0.0.1`/`[::1]` origin in production —
  the boot check rejects these in a non-dev `APP_ENV`.
- The middleware runs with `allow_credentials=False` in v1 (tokens travel in
  the `Authorization` header, not cookies); the v1.x httpOnly-cookie upgrade
  path is documented in `CODE_SPEC.md` AC-CD19.

## Health checks

- Backend liveness: `GET /healthz`; readiness: `GET /readyz` (wired to the
  compose healthchecks).
- Frontend: `GET /api/health` (wired to the `acumen-frontend` healthcheck).

## Observability

- Celery task failures/retries are surfaced as structured logs by the
  `task_failure` / `task_retry` signal handlers in `app/worker.py` (a failing
  cron is diagnosable from logs alone). Audit-row persistence for task
  failures is a post-deploy follow-up (WS2).

## Out of scope here (post-deploy)

Typed wire contracts (WS1), the transactional CRUD+audit service (WS2), the
real-DB integration tier (WS3), and the WS4 remainder (hot-path N+1
batch-loads, remaining a11y) are tracked post-deploy per `audits/2026-05-30-
audit-5-improvements.md` §5.
