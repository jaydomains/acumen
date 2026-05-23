# Acumen frontend

Next.js 15 (App Router) client for the Acumen backend. Lives at
`frontend/` in the acumen monorepo; the FastAPI backend stays at the
repo root. Stack and conventions are locked in `CODE_SPEC.md` AC-CD19.

## Quick start (local dev)

```bash
cd frontend
pnpm install
cp .env.example .env.local           # fill if your backend is not on :8000
pnpm dev                             # http://localhost:3000
```

The dev server expects the FastAPI backend at the URL in
`NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`). Start the
backend with `docker compose up postgres redis acumen` from the repo
root, or `uvicorn app.main:app --reload` for a bare-metal dev loop.

## Quick start (docker compose, full stack)

From the repo root:

```bash
docker compose up
# Backend  → http://localhost:8000
# Frontend → http://localhost:3000
```

The `acumen-frontend` service depends on `acumen` being healthy.

## Scripts

| Command              | What it does                                                  |
| -------------------- | ------------------------------------------------------------- |
| `pnpm dev`           | Next.js dev server with HMR                                   |
| `pnpm build`         | Production build (standalone output for the Docker runner)    |
| `pnpm start`         | Serve a production build                                      |
| `pnpm lint`          | ESLint (`next/core-web-vitals` + Prettier)                    |
| `pnpm format`        | Prettier write                                                |
| `pnpm format:check`  | Prettier check (CI gate)                                      |
| `pnpm typecheck`     | `tsc --noEmit` (strict + extras)                              |
| `pnpm test`          | Vitest (interactive); add `--run` for one-shot                |
| `pnpm codegen`       | Regenerate `src/types/api.d.ts` from the committed snapshot   |
| `pnpm codegen:live`  | Regenerate against a running backend at `:8000`               |
| `pnpm codegen:check` | CI gate: assert no drift between snapshot and committed types |

## Refreshing the OpenAPI snapshot

The backend's OpenAPI schema is snapshotted at
`frontend/openapi/schema.json` and regenerated on demand. When the
backend's API surface changes:

```bash
# from the repo root
docker compose up -d acumen
cd frontend
pnpm codegen:live    # writes src/types/api.d.ts from the running backend
# then refresh the committed snapshot:
curl -s http://localhost:8000/openapi.json \
  | python -c "import json,sys; print(json.dumps(json.load(sys.stdin), indent=2, sort_keys=True))" \
  > openapi/schema.json
```

CI's `pnpm codegen:check` step fails the build if `src/types/api.d.ts`
drifts from a regeneration of the committed snapshot — so the snapshot
and the generated types must move together.

## Architecture quick map

- `src/app/` — App Router pages + a `/api/health` route handler used
  by the Docker healthcheck.
- `src/lib/api/` — typed runtime client (`client.ts`, wrapping
  `openapi-fetch` with token attach + 401 refresh-retry + an
  `unwrap()` helper that throws on the AC-CD6 error envelope),
  error parsing (`errors.ts`), and convenience type re-exports
  (`types.ts`). Callers use `await unwrap(client.GET(path))`;
  responses are typed directly from the generated `paths`.
- `src/lib/auth/` — token storage adapter (`storage.ts`), refresh
  coordinator (`refresh.ts`), and the React `AuthProvider` /
  `useAuth()` context (`context.tsx`).
- `src/lib/config.ts` — env-var resolution.
- `src/lib/query-client.ts` — TanStack Query setup.
- `src/components/ui/` — reserved for shadcn/ui installs (empty in
  the scaffold PR; future PRs run `pnpm dlx shadcn@latest add …`).
- `src/types/api.d.ts` — generated; committed; CI asserts no drift.

## Auth flow (scaffold)

The access token lives in JS memory; the refresh token persists in
`localStorage` under the key `acumen.refresh_token`. On a 401 from any
API call, a single de-duped refresh attempt fires. If refresh fails,
tokens are cleared and the auth context flips to `unauthenticated`.

The login UI itself is **not** in this PR — it lands in PR-033. To
test the authenticated branch in the scaffold:

1. `curl -s -X POST http://localhost:8000/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"…","password":"…"}'`
2. Copy the `refresh_token` from the response.
3. In the browser at `http://localhost:3000`, open DevTools →
   Application → Local Storage → `http://localhost:3000`, and set
   `acumen.refresh_token` to the copied value.
4. Reload. The page should now show the signed-in branch.

AC-CD19 documents the v1.x upgrade path to httpOnly cookies (a
coordinated backend-and-frontend change; happens when the threat
model warrants).

## Adding a dependency

Frontend dependencies are pinned exact (mirror of the backend AC-CD1
discipline). Trivial dev-only additions may fold into the PR
handover; runtime / cross-cutting additions amend AC-CD19 in place.
