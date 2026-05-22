# Handover — PR-027 pre-frontend API gaps (admin user-management + current-user)

> Interstitial PR (same class as PR-014 / PR-017 / PR-022 / PR-025 /
> PR-026). Closes two API-surface gaps surfaced by a pre-frontend
> read-only review: admin user-management beyond `POST /v1/users` was
> missing, and there was no `GET /v1/auth/me`. Single editorial slice
> under the PR-025 auto-continue default; one binding Gitar review.

## PR identifier and link

- PR: #<TBD> — *api: close pre-frontend gaps — admin user-management + GET /v1/auth/me*
- Link: <TBD>
- Author / session: Claude Code session (Opus 4.7 1M)
- Date closed: 2026-05-22

## Phase reference

- ROADMAP phase closed by this PR: **none** — interstitial API-surface gap closure for the P2 auth/user-management slice. P0–P11 are complete.
- Does this PR fully close the phase? n/a — no phase closed. Closes the two API gaps the pre-frontend surface review surfaced against the v1.8 spec set: (a) admin cannot list / read / update / deactivate / reactivate users beyond create; (b) no logged-in user can read their own record.

## What was built

- Files added:
  - `app/domain/users.py` — admin user-management persistence/query (list / update / deactivate / reactivate). Separate from the `permissions.py` auth seam so the SiteMesh Auth Hub port replaces auth only; admin user CRUD stays on Acumen either side of the port. Mirrors the existing `app/domain/catalogue.py` shape (equality-only `where`, in-Python filter, reuses `paginate` from catalogue). Structure-gate continues to pass (the gate verifies a minimum required set; additive domain modules are allowed — `app/domain/catalogue.py` is the precedent).
  - `tests/integration/test_p2_admin_user_management.py` — 30 cases covering list/filter/paginate, get, patch (name / role / both / no-op / forbid-email / unknown-role / 404), self-role-change guard (block on demotion / allow name-only / allow self-set-to-admin), deactivate (sets status + status_changed_at / blocks-login regression / idempotent / self-deactivation 409 / 404), reactivate (restores login / idempotent), admin-only role-gate enforcement across all five endpoints (parameterised), and unauthenticated rejection across all five endpoints (parameterised).
  - `tests/integration/test_p2_auth_me.py` — 4 cases for `/v1/auth/me`: returns current user, works without privacy ack (the whole point — the frontend uses `privacy_ack_at: null` to drive the privacy-gate UI), rejects deactivated bearers, rejects unauthenticated.
  - `handovers/PR-027-pre-frontend-api-gaps.md` — this file.
- Files changed:
  - `app/routers/users.py` — added `GET /v1/users`, `GET /v1/users/{user_id}`, `PATCH /v1/users/{user_id}`, `POST /v1/users/{user_id}/deactivate`, `POST /v1/users/{user_id}/reactivate`. Audit-logged at `user.update` / `user.deactivate` / `user.reactivate` only on real state transitions (idempotent no-op returns 200 without an audit row). Self-deactivation guarded by 409 `self_deactivation_blocked`; self-role-change-to-non-admin guarded by 409 `self_role_change_blocked` (mirrors the deactivation guard; name-only self-PATCH is allowed). Docstring updated to cover the broadened user-management surface alongside admin-creates-user.
  - `app/routers/auth.py` — added `GET /v1/auth/me`. Depends on `get_active_user` (not `get_privacy_acked_user`) so pre-privacy-ack users can read it — the frontend renders the privacy gate from the returned `privacy_ack_at: null`. The deactivation gate still rejects deactivated bearers (403 `account_deactivated`).
  - `app/schemas.py` — added `UserUpdate` Pydantic model. `email` is intentionally absent (AC-D2 identity; create-then-deactivate is the v1 workflow for an email change). `name` mirrors `AdminCreateUserRequest`'s name field constraints; `role` reuses the existing `Role` validator that rejects unknown values at 422.
  - `tests/integration/conftest.py` — added `scalars()` / `all()` shim to `_Result` so the P2 `FakeSession` absorbs the new admin list endpoint's `select(...).scalars().all()` call (the catalogue `_CatResult` already had the shim; the P2 fake gains it as the auth-adjacent surface grows). Same equality-only `where` parser; no schema change to the fake's contract.
- Files removed: none.
- Summary: small focused PR adding the five admin user-management endpoints and the current-user endpoint the frontend needs to render its admin user table and the privacy-acknowledgement gate. No spec / no anchor change; the new endpoints sit under the existing §5 REST + cursor-pagination + error-envelope conventions and the existing AC-D2 / AC-D16 product anchors.

## What was decided in this PR

- **D1 — `app/domain/users.py` as a new domain module (vs extending `permissions.py`).** The auth seam (`permissions.py` + `routers/auth.py`) is replaced by the Auth Hub at SiteMesh port; admin user CRUD is **not** in that replacement scope (Acumen retains user-management responsibility either side of the port). Putting `list_users` / `update_user` / `deactivate_user` / `reactivate_user` in a new domain module keeps the seam clean and matches the existing `app/domain/catalogue.py` precedent for non-listed-but-present domain modules. Structure-gate continues to pass without modification.
- **D2 — Audit-action naming follows the existing `entity.verb` convention.** Three new actions: `user.update`, `user.deactivate`, `user.reactivate`. No `admin.` prefix — none of the existing admin-only actions (`pill.retire`, `anchors.bootstrap`, `bootstrap.run`, `safety_links.check`, `loop.queue.approve`) carry one. Consistent with `entity.verb` from every existing call site.
- **D3 — Refresh-token revocation on deactivate is a no-op (existing deactivation gate suffices).** JWT is stateless (`POST /v1/auth/logout` is a no-op at app/routers/auth.py:96-99: `# Stateless JWT: nothing to revoke server-side.`). Deactivation sets `status=deactivated + status_changed_at`; subsequent requests are rejected by `get_active_user` (app/permissions.py:333-338) and by the explicit re-check in `/v1/auth/refresh` (app/routers/auth.py:81-93). No token store exists, so there is nothing to revoke. Confirmed by the `test_deactivate_blocks_login_regression` test exercising the same gate-path the P2 done-when already covers.
- **D4 — Self-deactivation guard (409 `self_deactivation_blocked`) and self-role-change-to-non-admin guard (409 `self_role_change_blocked`).** Both protect against an admin locking themselves out of their own system. Symmetric guarding is important: self-deactivation locks the admin out immediately; self-demotion locks them out at next token refresh. Backend-side guards survive any frontend confirmation-dialog bug; relevant for single-admin KBC deployments. The role guard is scoped: name-only self-PATCH passes (`test_admin_can_patch_own_name`); self-set-to-administrator passes (`test_admin_can_re_set_own_role_to_admin`); only `role != ROLE_ADMINISTRATOR` on self trips the 409.
- **D5 — `GET /v1/auth/me` uses `get_active_user` (not `get_privacy_acked_user`).** Pre-privacy-ack users must reach this endpoint so the frontend can detect `privacy_ack_at: null` and render the privacy-gate UI. If the privacy gate were applied here, the frontend would have no way to discover it needed to render the gate (chicken-and-egg). Deactivated bearers are still rejected — they cannot log in to obtain a bearer in the first place, and a previously-issued bearer fails the deactivation gate.
- **D6 — Audit only on real state transitions.** `deactivate_user` and `reactivate_user` return `(user, changed: bool)`; `update_user` returns `(user, changed_field_names: list[str])`. The router writes an audit row only when something actually changed. An idempotent re-deactivate / re-reactivate returns 200 without an audit row; a no-op PATCH returns 200 without an audit row. Matches the spirit of `pill.retire` (which short-circuits if already retired before the audit) and avoids audit-log bloat from frontend retry-storms.
- **D7 — `_Result` gains `scalars()` / `all()`.** The new admin list endpoint is the first auth-adjacent surface to need a multi-row query. The P2 `FakeSession`'s `_Result` previously only exposed `scalar_one_or_none()`; the catalogue `_CatResult` already had the multi-row shim. Adding the same shim to `_Result` is the smallest extension that keeps the P2 fake covering the broader user-management surface without forcing the new tests to use the `cat_session` / `cat_client` fixtures (which would lose access to the auth-seam's `captured_emails` / `clear_captured_emails`).
- New anchors introduced: **none**. Existing anchors referenced (no amendments): AC-D2 (admin-creates-user, no self-registration, two-role model), AC-D10 (admin-driven creation with setup-link flow), AC-D16 (deactivation status + `status_changed_at` — `status_changed_at` was on the model since P1 but unwritten until this PR), AC-CD2 (router/domain layout — `app/domain/users.py` added as additive, matching `catalogue.py` precedent), AC-CD5 (auth seam shape — left untouched; new admin CRUD lives outside it), AC-CD6 (§5 REST conventions — `/v1/users` collection + cursor pagination + uniform error envelope all reused without change), AC-CD15 (zero-DB / zero-network tests — the conftest `_Result.scalars()/all()` extension preserves the contract).

## Drift flags raised and how they were resolved

- **F1 — Prompt asked for refresh-token revocation; v1 has no token store.** The prompt instructed "revoke any active refresh tokens" with `POST /v1/auth/logout` as the pattern. The actual logout handler is stateless (`# Stateless JWT: nothing to revoke server-side.` at app/routers/auth.py:96-99). **Resolution**: surfaced at plan time (not silently resolved); user confirmed via `AskUserQuestion` that the existing deactivation gate at `get_active_user` + the `/v1/auth/refresh` re-check satisfy the security contract for v1. No spec/anchor change needed; documented as D3 above. Adding a token store would be an AC-CD-level structural change (a sanctioned future move, parallel to "promote setup-token TTL to system_settings" noted in app/permissions.py:18-20).
- **F2 — Prompt's audit-action naming (`admin.user.update/deactivate/reactivate`) diverged from the existing `entity.verb` convention.** **Resolution**: surfaced at plan time; user confirmed convention-consistent names (D2). No code-base sweep needed (no other action carries an `admin.` prefix).
- **No silent drift.** No spec amendment; no anchor body changed; no CHECKLIST row touched; no SESSION_START / ROADMAP edit. The interstitial scope held — only the two API gaps the pre-frontend review surfaced.

## Open questions deferred to a later phase

- **Email-change workflow** (intentionally out of scope per the prompt and per AC-D2 — email is identity). The v1 pattern remains create-then-deactivate. A future v1.x decision could introduce an admin-driven email-change flow (likely behind a confirmation token to the new email), but that is a spec amendment (AC-D2 currently treats email as immutable identity), not an implementation detail.
- **Hard delete of users** (intentionally out of scope per AC-D16 — "Hard deletion is out of scope for v1"). Combined with the future data-export work (AC-D16 implications), this is a v1.x build.
- **Refresh-token revocation store** (deferred per D3 / F1). If the security posture requires immediate revocation of in-flight tokens (rather than waiting for the next refresh), a token-table is the v1.x add. The existing deactivation gate covers the next-request boundary; the v1 design accepts the access-token TTL as the worst-case window.
- **`app/domain/users.py` listing in `scripts/structure_gate.py` `_DOMAIN`.** The new module exists alongside the unlisted `app/domain/catalogue.py` (same pattern). A future structure-gate refresh may want to enumerate all domain modules explicitly; not blocking, and consistent with the AC-CD2-per-feature-router-layout vs admin-consolidation-reality divergence already flagged in the PR-018 / PR-026 handovers.

## Build state vs spec

- Complete: the two API gaps (admin user-management beyond create; current-user) are closed end-to-end. All endpoints have happy-path + 401 + 403 + 404 + idempotency + self-guard coverage as appropriate. Audit-log writes match the existing pattern. The existing P2 done-when test (`test_deactivated_user_login_rejected`) still passes — the new deactivate endpoint produces the same `account_deactivated` outcome by way of the same gate.
- Partial: none.
- Stubbed: none.

## Test coverage and CI results

- Tests added: `tests/integration/test_p2_admin_user_management.py` (30 cases — 8 parameterised expansions counted) + `tests/integration/test_p2_auth_me.py` (4 cases). Total 34 new test cases.
- Tests changed: none modified; `tests/integration/conftest.py` gained the `scalars()` / `all()` shim on `_Result` (additive, no contract change).
- Coverage delta: 750 tests pass (was 716 before this PR; +34 new cases match exactly).
- CI result at merge: see PR final state.
- Manual verification performed:
  - `python3 -m pytest tests/integration/test_p2_admin_user_management.py tests/integration/test_p2_auth_me.py tests/integration/test_p2_auth_flows.py tests/unit/test_p2_auth_primitives.py tests/unit/test_structure_gate.py` → 65 passed.
  - `python3 -m pytest` → 750 passed (no regression across P0–P11).
  - `python3 scripts/structure_gate.py` → `structure gate: OK`.
  - `python3 -m ruff check .` (with pinned `ruff==0.6.9`) → All checks passed.
  - `python3 -m ruff format --check .` → 145 files already formatted.
  - `python3 -m mypy app` → Success: no issues found in 61 source files.
  - OpenAPI surface listing: `/v1/auth/me [GET]`, `/v1/users [GET, POST]`, `/v1/users/{user_id} [GET, PATCH]`, `/v1/users/{user_id}/deactivate [POST]`, `/v1/users/{user_id}/reactivate [POST]` — all five new paths + the new `/me` present.

## Anything a fresh Claude Code session needs to pick up cleanly

- **`status_changed_at` is now written.** Was on the `AppUser` model since P1 but never written until this PR. `deactivate_user` and `reactivate_user` are the only writers; any future code that needs "when did this user last change status" can rely on the column being populated for deactivate/reactivate transitions from this PR forward. Historical rows (pre-PR-027) have `status_changed_at = NULL`.
- **Self-guards are backend-side and deliberately strict.** Self-deactivation: blocked. Self-demotion (admin → testee): blocked. Self-name-PATCH: allowed. Self-role=administrator (no-op or re-set): allowed. If a future requirement needs an admin to be able to step down (e.g. handover workflow), the correct path is admin-A creates admin-B, admin-B deactivates admin-A — not relaxing the guard.
- **`GET /v1/auth/me` does NOT enforce privacy acknowledgement.** This is deliberate (D5). If a future endpoint depends on `/me` returning only privacy-acked users, that endpoint's dependency chain must add the privacy gate itself — do not change the `/me` dependency.
- **`_Result.scalars().all()` is now part of the P2 fake.** Any future auth-seam test that needs a multi-row query can rely on it. The catalogue `_CatResult` separately has the same shim; both fakes converge on the same minimum query surface now.
- **Convention reminder for any future user-management audit action.** Use `user.<verb>`, not `admin.user.<verb>`. The convention matches every other state-changing audit action in the codebase.
- **Recommended next action.** Merge this PR; next session can pick up the frontend build against this surface, or the P12 (full hardening / end-to-end) work flagged at PR-025 / PR-026 close.
