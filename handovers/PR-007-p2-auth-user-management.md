# Handover — PR-007 P2 Auth & user management

## PR identifier and link

- PR: #7 — P2 — Auth & user management
- Link: https://github.com/jaydomains/acumen/pull/7
- Author / session: Claude Code session (starting-acumen-p2,
  three-slice incremental execution with Gitar review between slices)
- Date closed: 2026-05-18

## Phase reference

- ROADMAP phase closed by this PR: **P2 — Auth & user management**.
- Does this PR fully close the phase? **Yes.** All six CHECKLIST P2
  rows are `built` with real evidence (test paths that exist and
  pass). The ROADMAP done-when is proven end-to-end by
  `test_done_when_admin_creates_user_setup_login_role_gate`. Live
  `docker compose up` / DB-backed run were not executed (no Docker /
  Postgres in the sandbox); equivalent zero-DB verification was done
  (see Test coverage), mirroring the P1 precedent.

## What was built

- Files added:
  - `tests/unit/test_p2_auth_primitives.py` — argon2id, JWT, token
    mint/hash, email-rule unit tests (10 tests).
  - `tests/integration/conftest.py` — zero-DB `FakeSession` +
    `get_db` override + seeding helpers.
  - `tests/integration/test_p2_auth_flows.py` — done-when E2E and
    the auth-flow integration suite (14 tests).
  - `handovers/PR-007-p2-auth-user-management.md` — this handover.
- Files changed:
  - `app/permissions.py` — the AC-CD5 port-seam non-router half:
    argon2id hash/verify (constant-time on the non-argon2 path),
    JWT issue/verify, setup/reset token mint + SHA-256, the uniform
    error envelope + handler registrar, fail-soft `SMTPClient`,
    public `setup_email_content`/`reset_email_content`,
    `normalise_email`, the single role/deactivation/privacy
    dependency chain, and the auth data-access helpers.
  - `app/models.py` — lazy async engine + `async_sessionmaker` +
    `get_db` (built first-use, not at import).
  - `app/schemas.py` — Pydantic v2 request/response models.
  - `app/routers/auth.py` — login, refresh, logout, setup/consume,
    password-reset request+consume, privacy/acknowledge.
  - `app/routers/users.py` — admin-creates-user.
  - `app/main.py` — error-envelope handler + router includes
    (verified still structure-gate setup-only).
  - `pyproject.toml` — ruff bugbear `extend-immutable-calls` for the
    FastAPI `Depends()`/`Header()`/… authz pattern (tooling-config).
  - `CHECKLIST.md` — six P2 rows → `built` with test-path evidence.
- Files removed: none.
- Summary: standalone email+password auth — admin-created users,
  emailed setup-link activation, login issuing argon2id-verified
  JWT access+refresh, a stateless logout contract, password reset,
  and one dependency chain enforcing authenticated → active
  (AC-D16 deactivation) → privacy-acked (§8.7) → role (AC-D2).
  All of it is concentrated in `app/permissions.py` +
  `app/routers/auth.py` (+ the `users.py` route) so the SiteMesh
  Auth Hub port is a one-file-class swap (AC-CD5).

## What was decided in this PR

- New anchors introduced: **none.** P2 implements existing AC-D2 /
  AC-D10 / AC-D16 and the AC-CD5 auth seam.
- Existing anchors depended on: AC-D2 (two open-String roles,
  admin-driven, no self-registration), AC-D10 (argon2id, setup/reset
  tokens, SMTP), AC-D16 (deactivation + simplified §8.7 privacy
  notice), AC-CD5 (one-file-swap seam), AC-CD1 (no new dependency),
  AC-CD2 (`main.py` setup-only), AC-CD6 (uniform error envelope,
  `/v1`), AC-CD15 (no-network tests).
- Decisions recorded with the user (not new anchors):
  - Seam is exactly `app/permissions.py` + `app/routers/auth.py` —
    **no top-level `app/auth.py`** (CODE_SPEC §3/§6).
  - Async engine/session live in `app/models.py` (CODE_SPEC §3 names
    no db module; keeps the locked layout, no new module).
  - Stateless JWT + `/refresh`; logout is an explicit client-discard
    no-op (`{"status":"ok","action":"discard_tokens"}`). No
    server-side revocation store.
  - Zero-DB / zero-network tests via `dependency_overrides[get_db]`
    + an in-memory `FakeSession` (P1 no-DB precedent).
  - `SMTPClient` co-located at the seam (auth-comms the Auth Hub
    replaces). **P11 revisits relocation** when non-auth SMTP lands
    (AC-D26 reminders, AC-D18 budget alerts, AC-D21 attention).
  - Light `@`-presence + lowercase + trim email rule
    (`normalise_email`) instead of `EmailStr`, to avoid the unpinned
    `email-validator` dependency (AC-CD1).
  - `SETUP_TOKEN_TTL` (72h) / `RESET_TOKEN_TTL` (1h) are v1 code
    constants in `app/permissions.py`; promoting them to
    `system_settings` is a sanctioned future evolution path, out of
    P2 scope.
  - Minimum password length 8 enforced in `schemas.py` as a sane
    default — the spec sets no password policy (AC-D10), so this is
    an implementation choice, not spec drift.
  - argon2 timing-equalisation: `verify_password` spends an
    equivalent argon2 verify on the non-argon2 path so an unknown
    email / not-yet-setup account is not a `/login` timing oracle.
  - Tooling: ruff `extend-immutable-calls` added so the
    CODE_SPEC-locked FastAPI `Depends()` pattern lints clean from P2
    onward — tooling-config only, not a dependency or structural
    anchor.

## Drift flags raised and how they were resolved

- **Prompt vs CODE_SPEC: "auth.py" file.** The session prompt said
  "auth.py + permissions.py"; CODE_SPEC §3/§6 + the structure-gate
  fix the seam at `app/permissions.py` + `app/routers/auth.py` with
  no top-level `app/auth.py`. Surfaced to the user and resolved as
  "strict CODE_SPEC" before coding — no new module added. No
  spec-clarification PR needed (the canonical docs were already
  unambiguous; the prompt wording was the looseness).
- **CODE_SPEC §3 names no DB-session module.** Resolved with the
  user by placing the async engine/session in `app/models.py`
  (implementation detail within the DB layer, not a new structural
  pattern) — no CODE_SPEC amendment required.
- No spec/implementation divergence requiring a user-authored
  clarification PR was hit.

## Open questions deferred to a later phase

- **AC-CD11 — cross-family review latency rule.** Untouched; remains
  the sole CHECKLIST drift question with its **P6 pre-build gate**.
  P2 added no submit-path behaviour.
- **FastAPI request-validation (422) envelope.** Pydantic body
  validation errors return FastAPI's default 422 shape, not the
  uniform `{"error":{...}}` envelope (only `APIError` is wrapped).
  Acceptable for P2; if a uniform 422 is wanted, add a
  `RequestValidationError` handler in the seam in a later phase.
- **SMTPClient relocation** — revisit at **P11** when non-auth SMTP
  lands (see decisions).
- **Setup/reset TTLs → system_settings** — sanctioned future move,
  no phase pinned.

## Build state vs spec

- Complete: admin-creates-user (AC-D2, role-gated, no
  self-registration, duplicate-email 409); setup-link activation +
  password-reset, one-time + expiring (AC-D10); login with argon2id
  verify + JWT access/refresh, constant-time on unknown email;
  refresh + stateless logout; deactivation gate with the AC-D16
  message; privacy-acknowledgement gate (§8.7) with idempotent ack;
  the single AC-CD5 dependency chain; uniform error envelope.
- Partial: none for P2 scope.
- Stubbed: business routes beyond auth/users remain P0 phase-tagged
  stubs (filled P3+). No SMTP server is contacted in v1 tests
  (fail-soft capture is the seam). RLS on `tenant_id` remains a
  documented SiteMesh port seam, not built (AC-CD3).

## Test coverage and CI results

- Tests added: `tests/unit/test_p2_auth_primitives.py` (10),
  `tests/integration/test_p2_auth_flows.py` (14) +
  `tests/integration/conftest.py` harness. Full suite: **39 passed**
  (5 P0 + 5 P1 functions + 10 P2 unit + 14 P2 integration; some
  parametrised). Zero network, zero DB — the AC-CD15 socket guard
  holds; `get_db` is overridden with an in-memory `FakeSession` and
  no async engine is ever constructed.
- Done-when proof:
  `test_done_when_admin_creates_user_setup_login_role_gate`
  (admin → setup link → consume → login → privacy gate → role gate),
  `test_deactivated_user_login_rejected`,
  `test_privacy_gate_blocks_then_clears`,
  `test_expired_token_rejected`, `test_password_reset_round_trip`.
- Local verification (venv): `ruff check .` clean; `ruff format
  --check .` clean (54 files); `mypy app` — no issues (40 files);
  `python scripts/structure_gate.py` OK (`main.py` still setup-only
  with the router/handler imports); `python
  scripts/check_unpinned_deps.py` OK (no new dependency);
  `pytest -q` — 39 passed.
- CI result at merge: `.github/workflows/ci.yml` runs the full chain
  on push; was green on the prior Slice-2 head. Re-runs on the
  Slice-3 commit; confirm green on GitHub before merge.
- Gitar: PR #7 reviewed incrementally — Slice 1 (3 findings:
  SMTP capture-on-send, import-time engine, empty-password login)
  and Slice 2 (login timing oracle, cross-module private import)
  all resolved; Gitar "✅ Approved — 5 resolved / 5 findings" before
  Slice 3. Slice 3 (tests/docs) to be re-reviewed on this head.

## Anything a fresh Claude Code session needs to pick up cleanly

- Required reading: `SESSION_START.md`, the most recent handover
  (this file), `ROADMAP.md` **P3 — Catalogue**, `CODE_SPEC.md` §5
  (API/envelope), `DECISIONS.md` AC-D7/D8/D15/D21.
- Next action: **ROADMAP P3 — Catalogue** on a fresh branch.
- Environment: `python -m venv .venv && pip install -r
  requirements.txt -r requirements-dev.txt`. The system PyJWT
  (Debian) cannot be pip-uninstalled — always use a venv.
- Traps / gotchas:
  - Auth is the AC-CD5 one-file-swap seam: keep **all** auth in
    `app/permissions.py` + `app/routers/auth.py` (+ `users.py`
    routes). Do not leak auth into `domain/` or `main.py`.
  - The dependency chain order is **authenticated → active →
    privacy-acked → role**. A protected route guarded by
    `require_role(...)` rejects an un-acked user with
    `privacy_not_acknowledged` *before* the role check — assert
    accordingly in tests.
  - `verify_password` is deliberately constant-time on the
    non-argon2 path (timing-oracle mitigation) — do not "optimise"
    the early return back in.
  - `app_user.role` stays an open `String` (AC-D2) — never tighten
    to an enum.
  - Integration tests use a hand-rolled `FakeSession` that
    introspects `select(Model).where(col == value, ...)`. New auth
    queries must stay in that simple shape or the fake needs
    extending; non-auth phases should prefer their own harness.
  - `main.py` is structure-gate setup-only: it may import
    `app.routers` / `app.permissions` but **not**
    `app.models`/`sqlalchemy`/`app.domain`/… — so `readyz` still
    does not probe the DB.
  - Do **not** build the AC-D19 blocking submit path before the P6
    AC-CD11 gate.
