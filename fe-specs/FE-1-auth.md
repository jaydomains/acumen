# FE-1 — Auth surface (detail spec)

> **Status:** plan-mode authored, ready for build session.
> **Owns:** all five unauthenticated pages + logout + route-guards + the form-error display precedent.
> **PR target:** `PR-034-fe1-auth-surface` (one squash PR closes the phase per FE_ROADMAP discipline).
> **Anchors:** AC-D2 (admin-created accounts), AC-D10 (auth mechanism), AC-D16 (deactivation + privacy ack), AC-CD5 (auth dep), AC-CD6 (error envelope), AC-CD19 (FE stack), AC-CD20 (routing/guards), AC-CD21 (query+form+errors).
>
> This is the **first per-page FE detail spec**. The template here (Context → Inventory → Per-page → Cross-page → Tests → Placeholders → Scope-bleed) propagates verbatim to FE-2..FE-9. Deviating from the template in FE-2+ is itself spec drift.

---

## 0. Context

FE-0 (PR-032) landed the Next.js 15 / App Router scaffold, the typed `openapi-fetch` client with `unwrap()`, the auth context (memory access + localStorage refresh + 401 dedup-retry), and the placeholder home page. PR-033 locked AC-CD20..24 — routing/guards, TanStack-Query + react-hook-form + error envelope, SSE consumption, theming/primitives, visual-content deferral — without writing code.

FE-1 is the first **build** phase. Its done-when is the end-to-end identity round trip:

> admin-created user → consumes setup token → sets password → logs in → acknowledges privacy → lands on empty dashboard shell. Deactivated user blocked at login. Privacy-unacked user blocked from non-`/privacy` routes. Role-mismatched user blocked at `/403`.

This spec exists because (a) the page-by-page contract between the design reference (`frontend/design-reference/prototype/auth.jsx`) and the backend OpenAPI (`frontend/openapi/schema.json`) needs to be pinned before the build session opens, (b) the template established here is the canonical shape every FE-N detail spec will follow, and (c) several spec-drift candidates surfaced during the cross-walk and must be visible to the user before the build session resolves them.

**Not in scope for FE-1** (delegated to FE-2):
- Design tokens / `globals.css` paper theme (AC-CD23 token names land at FE-2).
- shadcn/ui primitives beyond the bare minimum needed for auth pages (Button, Input, Label, Card). Full set lands at FE-2.
- TopBar / Rail / PageHeader. The avatar-menu mock is reference for FE-2, *not* FE-1; FE-1 ships `logout()` wiring only, not the dropdown UI.
- Empty dashboard shell visuals beyond "renders without crashing and shows your name".

**FE-1 adds to `layout.tsx`** (folds into handover under AC-CD-level structural-additions carve-out):
- `QueryClientProvider` (factory exists in `lib/query-client.ts`, not yet mounted).
- `<Toaster />` from `sonner` for Pattern B toasts.

---

## A. Page/feature inventory

| # | Capability | Route | Design source | Screenshot |
|---|---|---|---|---|
| 1 | Login | `/login` | `auth.jsx:258–305` (LoginPage) | `v6-fe1-01-login.png` |
| 2 | Forgot password (request) | `/forgot` | `auth.jsx:310–372` (ForgotPage) | `v6-fe1-02-forgot.png` |
| 3 | Reset password (consume) | `/reset/[token]` | `auth.jsx:377–434` (ResetPage) + `auth.jsx:436–466` (TokenErrorCard) | `v6-fe1-03-reset.png` |
| 4 | Setup (account activation) | `/setup/[token]` | `auth.jsx:471–536` (SetupPage) + `auth.jsx:436–466` (TokenErrorCard, `flow="setup"`) | `v6-fe1-04-setup.png` |
| 5 | Privacy acknowledgement gate | `/privacy` | `auth.jsx:541–636` (PrivacyPage) | `v6-fe1-05-privacy.png` |
| 6 | Logout flow (action wiring only — UI is FE-2) | n/a (function) | `avatar-menu.jsx` for FE-2 reference | `v6-fe1-06-avatar-menu.png` (reference only) |
| 7 | Error display patterns (precedent for all FE-N) | n/a (lib) | `error-patterns.jsx` (Patterns A/B/C) | `v6-fe1-07-error-patterns.png` |

Capabilities 6 and 7 are cross-cutting; they appear in §C rather than as separate per-page entries.

---

## B. Per-page detail specs

> **Template** (used identically for every page; propagates to FE-2..FE-9 verbatim):
> 1. Route segment + URL state
> 2. Components (scaffold reused / new in this PR / shadcn primitive / design primitive)
> 3. API endpoints consumed
> 4. Form fields + zod rules + react-hook-form integration shape
> 5. States (every variant from the design state-strip + any extras the wire surfaces)
> 6. Acceptance criteria (Gherkin — each trio maps to one Vitest test)
> 7. Edge cases / gotchas
> 8. Visual reference

### B.1 Login — `/login`

**1. Route segment + URL state**

- File: `frontend/src/app/(auth)/login/page.tsx`. The `(auth)` route group is introduced in FE-1; its `layout.tsx` carries the unauth guard.
- No URL params, no query state. After successful login, the post-login resolver (§C.4) routes to `/privacy` (if `user.privacy_ack_at === null`) or `/` (the empty dashboard shell).

**2. Components**

- **Scaffold reused:** `useAuth()` from `lib/auth/context.tsx`; `client` + `unwrap` from `lib/api/client.ts`; `setAccessToken` + `setRefreshToken` from `lib/auth/storage.ts`; `applyApiErrorToForm` (new — see §C.2).
- **New in this PR:**
  - `frontend/src/components/auth/AuthShell.tsx` — full-height centered container, max-width 400px (`wide` prop = 620px for Privacy).
  - `frontend/src/components/auth/AuthLogo.tsx` — Acumen mark + wordmark + "SITEMESH" meta line.
  - `frontend/src/components/auth/AuthCard.tsx` — shadcn `Card` styled with paper-card chrome.
  - `frontend/src/components/auth/AuthCardTitle.tsx` — serif+italic title pattern (`auth.jsx:244–253`).
  - `frontend/src/components/auth/AuthField.tsx` — `Label` + `Input` + error/hint slots; reads error from rhf `formState.errors[name]`.
  - `frontend/src/components/auth/AuthNotice.tsx` — coloured-bar callout, `{ tone: 'warn'|'danger'|'info'|'ok', title, body }`.
  - `frontend/src/components/auth/SubmitButton.tsx` — three-mode button (idle / submitting / success) per `auth.jsx:183–196`.
- **shadcn primitives installed in this PR:** `Button`, `Input`, `Label`, `Card`.
- **Design primitives borrowed:** `AcumenMark` SVG (port from `icons.jsx`); the arrow `→` glyph.

**3. API endpoints consumed**

- `POST /v1/auth/login` — `{email, password}` → `{access_token, refresh_token, token_type}`.
- After login, the post-login resolver calls `unwrap(client.GET("/v1/auth/me"))` to seed `user` before routing.

**4. Form + zod + rhf**

```ts
const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
type LoginInput = z.infer<typeof loginSchema>;

const form = useForm<LoginInput>({
  resolver: zodResolver(loginSchema),
  mode: "onSubmit",  // design shows no blur errors
});
```

Submit handler:
1. `unwrap(client.POST("/v1/auth/login", { body: data }))` inside try/catch.
2. Success: `setAccessToken`; `setRefreshToken`; trigger post-login resolver (§C.4).
3. `ApiError`: `applyApiErrorToForm(err, form, { fieldMap })` (§C.2). For login, `INVALID_CREDENTIALS` maps to a form-root error rendered as inline error under `email` per design (`auth.jsx:288`). `ACCOUNT_DEACTIVATED` and `LOGIN_RATE_LIMITED` render via `<AuthNotice>` above the fields and disable submit.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `idle` | Default | Empty fields, "Sign in →" enabled. |
| `submitting` | `formState.isSubmitting` | Pulse-dot + "Signing in…", fields disabled. |
| `invalid` | `err.code === "INVALID_CREDENTIALS"` (401) | Inline error under email: "We couldn't sign you in with that email and password." Submit re-enabled. |
| `deactivated` | `err.code === "ACCOUNT_DEACTIVATED"` (403) | `<AuthNotice tone="warn">` above fields. Submit disabled. |
| `locked` | `err.code === "LOGIN_RATE_LIMITED"` (429) | `<AuthNotice tone="warn">` "Too many tries / 10 minutes". Submit disabled. |
| `success (transient)` | 200 | Button flashes "Done" briefly, redirect fires. |

> **Build-session verification — verify against `app/api/routers/auth.py` before implementing:** the three login error codes (`INVALID_CREDENTIALS` / `ACCOUNT_DEACTIVATED` / `LOGIN_RATE_LIMITED`) are **assumed** from the design's three copy variants. The build session opens with a verification step: read the FastAPI `/v1/auth/login` handler + the AC-CD6 error-code catalogue, confirm the codes match. If they match, proceed. If any diverge, halt and surface for a spec-clarification PR. Do not silently rename in the frontend.

**6. Acceptance criteria (Gherkin)**

```
Scenario: User signs in with valid credentials and has acknowledged privacy
  Given the user is unauthenticated
  And the backend will accept the credentials and return a user with privacy_ack_at set
  When the user submits email and password
  Then the access token is stored in memory
  And the refresh token is stored in localStorage under "acumen.refresh_token"
  And the router pushes to "/"

Scenario: User signs in with valid credentials but has NOT acknowledged privacy
  Given the user is unauthenticated
  And the backend returns a user with privacy_ack_at === null
  When the user submits valid email and password
  Then the router pushes to "/privacy"

Scenario: User submits invalid credentials
  Given the user is unauthenticated
  When the backend returns 401 with { error: { code: "INVALID_CREDENTIALS", message } }
  Then an inline error appears under the email field
  And the submit button is re-enabled
  And no tokens are persisted

Scenario: User is deactivated
  Given the user is unauthenticated
  When the backend returns 403 with { error: { code: "ACCOUNT_DEACTIVATED", message } }
  Then a warn notice "This account has been deactivated" renders above the fields
  And the submit button is disabled
  And the form is not resubmittable from the same render

Scenario: User is rate-limited
  Given the user is unauthenticated
  When the backend returns 429 with { error: { code: "LOGIN_RATE_LIMITED", message } }
  Then a warn notice "Too many tries" renders above the fields
  And the submit button is disabled

Scenario: Submitting empty fields
  Given the user is on /login with empty fields
  When the user clicks "Sign in"
  Then zod surfaces "Enter a valid email address." and "Enter your password."
  And no network call is fired

Scenario: Already-authenticated user lands on /login
  Given the user has a valid access token
  When the user navigates to /login
  Then the unauth guard redirects them to "/" (or "/privacy" if unacked)
```

**7. Edge cases / gotchas**

- The unauth guard (§C.4) must not flash the login form to already-authed users during `loading` — render a skeleton until `status !== "loading"`.
- `setRefreshToken` must run **before** the post-login resolver kicks `GET /v1/auth/me`; otherwise a reload during the brief window loses identity.
- Success-state button is intentionally brief (~250ms) before redirect.
- Refresh-token race during dual-tab login (FE_ROADMAP risk): module-level `inflight` dedup handles within-tab; cross-tab dedup is **out of scope** at FE-1 — the second tab refreshes-then-401 once and recovers via existing retry-fetch path.

**8. Visual reference:** `auth.jsx:258–305` · `v6-fe1-01-login.png`.

---

### B.2 Forgot password — `/forgot`

**1. Route segment + URL state**

- File: `frontend/src/app/(auth)/forgot/page.tsx`. No URL params. Success view replaces card in place — no navigation.

**2. Components**

- Scaffold reused: `client`, `unwrap`, `ApiError`.
- Reuses all `AuthShell`/`AuthLogo`/`AuthCard`/`AuthCardTitle`/`AuthField`/`AuthNotice`/`SubmitButton`/`BackLink` from Login.

**3. API endpoints**

- `POST /v1/auth/password-reset/request` — `{email}` → `{status: "ok"}`. **Privacy-preserving:** 200 regardless of whether email exists.

**4. Form + zod + rhf**

```ts
const forgotSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});
```

Submit calls `client.POST(...)` inside try/catch. On 2xx → `success` view. On network failure or 5xx → `error` notice.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `idle` | Default | Empty email, privacy hint below. |
| `submitting` | rhf isSubmitting | Pulse-dot + "Sending…". |
| `success` | 2xx | Card replaced by check-icon "Check your inbox" — link valid 30 minutes. |
| `error` | Network failure or 5xx | `<AuthNotice tone="danger">` "We couldn't send the link". Field remains; resubmit allowed. |

**6. Acceptance criteria**

```
Scenario: Request reset for any address (success)
  Given the user is on /forgot
  When the user submits any valid email
  And the backend returns 200 { status: "ok" }
  Then the card replaces with the "Check your inbox" confirmation
  And the confirmation surfaces the entered email back to the user

Scenario: Server error during request
  Given the user is on /forgot
  When the backend returns 5xx
  Then the danger notice "We couldn't send the link" renders
  And the form remains resubmittable

Scenario: Invalid email validation
  Given the user is on /forgot
  When the user submits "not-an-email"
  Then zod surfaces "Enter a valid email address."
  And no network call is fired

Scenario: Back link returns to /login
  Given the user is on /forgot
  When the user clicks the "← Back to sign in" link
  Then the router pushes to "/login"
```

**7. Edge cases / gotchas**

- Success copy interpolates the submitted email — capture into local state before view swap (form state may reset).
- Do **not** branch on whether the email exists. The API contract is privacy-preserving; any client-side branching leaks existence.

**8. Visual reference:** `auth.jsx:310–372` · `v6-fe1-02-forgot.png`.

---

### B.3 Reset password — `/reset/[token]`

**1. Route segment + URL state**

- File: `frontend/src/app/(auth)/reset/[token]/page.tsx`. Dynamic param `token`. Page is a client component (rhf usage); read via `use(params)` (React 19 / Next 15 idiom).

**2. Components**

- Scaffold reused: `client`, `unwrap`, `ApiError`.
- New in this PR:
  - All Login-introduced auth primitives.
  - `PasswordRulesChecklist.tsx` — live 4-rule pass/fail UI (§C.1).
  - `TokenErrorCard.tsx` — full card replacement for `token-expired`/`token-invalid`; CTA wording differs between reset and setup flows via `flow` prop.

**3. API endpoints**

- `POST /v1/auth/password-reset/consume` — `{token, new_password}` → `{status: "ok"}`. Backend constraint: 8..1024.

**4. Form + zod + rhf**

```ts
const passwordRules = z.string()
  .min(12, "At least 12 characters.")
  .regex(/[a-z]/, "Needs a lowercase letter.")
  .regex(/[A-Z]/, "Needs an uppercase letter.")
  .regex(/\d/, "Needs a number.")
  .regex(/[^A-Za-z0-9]/, "Needs a symbol.");

const resetSchema = z.object({
  new_password: passwordRules,
  confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, {
  path: ["confirm_password"],
  message: "Passwords don't match — re-type the new one.",
});
```

Submit posts `{ token, new_password }`. Catches `ApiError` and discriminates by `err.code`:
- `TOKEN_EXPIRED` → `TokenErrorCard kind="token-expired"`.
- `TOKEN_INVALID` → `TokenErrorCard kind="token-invalid"`.
- Validation echo (422) → `applyApiErrorToForm` projects onto `new_password`.

> **Build-session verification — verify against `app/api/routers/auth.py` before implementing:** token-error codes (`TOKEN_EXPIRED`, `TOKEN_INVALID`) are **assumed**. The build session's opening verification step reads the reset-consume handler and confirms the code names. If they match, proceed. If any diverge, halt and surface for a spec-clarification PR.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `idle` | Default | Empty password fields, full rule list grey. |
| `typing` | Password input changes | `PasswordRulesChecklist` rules light green as they pass. |
| `submitting` | rhf isSubmitting | Pulse-dot button. |
| `mismatch` | zod refine fails on confirm | Inline error under confirm field. |
| `weak` | zod base rules fail | Per-rule error from zod **plus** `<AuthNotice tone="warn">` "Almost there". |
| `success` | 2xx | `<AuthNotice tone="ok">` "Password updated / Redirecting…". After 1500ms, `router.push("/login")`. |
| `token-expired` | `err.code === "TOKEN_EXPIRED"` | Card → `TokenErrorCard` reset variant. CTA → `/forgot`. |
| `token-invalid` | `err.code === "TOKEN_INVALID"` | Card → `TokenErrorCard` invalid variant. CTA → `/forgot`. |

**6. Acceptance criteria**

```
Scenario: Successful password reset
  Given the user is on /reset/<valid-token>
  When the user enters a password passing all 4 rules and matching confirm
  And the backend returns 200 { status: "ok" }
  Then the success notice renders
  And after a short delay the router pushes to "/login"

Scenario: Password mismatch
  Given the user is on /reset/<valid-token>
  When the new and confirm passwords differ
  Then an inline error renders under the confirm field
  And no network call is fired

Scenario: Weak password
  Given the user is on /reset/<valid-token>
  When the user enters a password failing any of the 4 rules
  Then the failing rule shows un-checked in PasswordRulesChecklist
  And the "Almost there" warn notice renders on submit
  And no network call is fired

Scenario: Token expired
  Given the user is on /reset/<expired-token>
  When submission returns 400 with code "TOKEN_EXPIRED"
  Then the card replaces with the TokenErrorCard expired variant (reset copy)
  And the CTA links to "/forgot"

Scenario: Token invalid
  Given the user is on /reset/<bad-token>
  When submission returns 400 with code "TOKEN_INVALID"
  Then the card replaces with the TokenErrorCard invalid variant
  And the CTA links to "/forgot"
```

**7. Edge cases / gotchas**

- **Backend 8 / client 12** — intentional: client gates the stricter design rule; backend's 8-char floor is defensive. No drift.
- The `token` URL segment **must never** appear in logs, error reports, or the boundary technical-details payload.
- `PasswordRulesChecklist` updates on every keystroke — debounce NOT applied.

**8. Visual reference:** `auth.jsx:377–434` + `auth.jsx:436–466` · `v6-fe1-03-reset.png`.

---

### B.4 Setup — `/setup/[token]`

**1. Route segment + URL state**

- File: `frontend/src/app/(auth)/setup/[token]/page.tsx`. Dynamic param `token`.

**2. Components**

- Identical primitive set to Reset, including `PasswordRulesChecklist` and `TokenErrorCard` (`flow="setup"`).
- One layout difference per design: "FIRST TIME HERE" eyebrow + welcome paragraph above form fields (`auth.jsx:498–505`).

**3. API endpoints**

- `POST /v1/auth/setup/consume` — `{token, new_password}` → `{status: "ok"}`. Backend constraint: 8..1024.
- `GET /v1/auth/setup/{token}/preview` — path-token → `{email}`. Added by user-authored spec-clarification PR before this build session opens (see blocker callout below). Consumed via `useQuery` on mount to populate the readOnly email display.

> **HIGHEST-PRIORITY BLOCKER — resolved via user-authored spec-clarification PR before the FE-1 build session opens.** Design (`auth.jsx:507`) shows `email` pre-filled as readOnly; API has no endpoint to fetch invitee email from token. **Resolution chosen:** the user authors a small spec-clarification PR adding `GET /v1/auth/setup/{token}/preview` → `{email}`. **The FE-1 build session cannot open until that spec-clarification PR is on `main`.** Once it lands, this page consumes the preview endpoint per the wiring in §4 below.

**4. Form + zod + rhf**

Same `passwordRules` schema as Reset. Form does NOT include `email` as a writable field — the email is fetched and rendered as a readOnly display populated from the preview query (per the resolved blocker above).

Page fires `useQuery(["setup-preview", token], () => unwrap(client.GET("/v1/auth/setup/{token}/preview", { params: { path: { token } } })))` on mount. On query error (token expired/invalid) → swap to `TokenErrorCard` immediately, before the user types. On success → populate the readOnly email display above the password fields per the design.

**5. States**

Identical to Reset (`idle` / `submitting` / `mismatch` / `weak` / `success` / `token-expired` / `token-invalid`).

Success transition differs: consume response returns `{status: "ok"}` only — no tokens. User is **not yet logged in** after setup; they must sign in fresh. Success → `/login` (NOT `/privacy` or `/`), with brief "You're all set / Taking you back to sign in…" notice. (Copy adjusted from the design's "Taking you in…" to accurately reflect that the user must re-authenticate — pure frontend copy decision, no spec amendment.)

**6. Acceptance criteria**

```
Scenario: Successful account setup
  Given the user is on /setup/<valid-token>
  And the preview query returned the invitee email
  When the user enters a password passing all 4 rules and matching confirm
  And the backend returns 200 { status: "ok" } on consume
  Then the "You're all set" success notice renders
  And after a short delay the router pushes to "/login"

Scenario: Setup token expired (caught on preview)
  Given the user is on /setup/<expired-token>
  When the preview query returns 400 with code "TOKEN_EXPIRED"
  Then the card replaces with the TokenErrorCard expired variant (setup copy)
  And the CTA reads "Ask for a new invitation" and does NOT link anywhere
       (no /forgot for setup — user must contact admin)
  And the password form never renders

Scenario: Setup token invalid (caught on preview)
  Given the user is on /setup/<bad-token>
  When the preview query returns 400 with code "TOKEN_INVALID"
  Then the card replaces with the TokenErrorCard invalid variant (setup copy)
  And the password form never renders

Scenario: Mismatch / weak / validation
  (Identical trios to Reset — copy-paste from B.3)
```

**7. Edge cases / gotchas**

- Setup tokens are 7-day expiry; reset tokens are 30 minutes. `flow` prop drives the difference in copy.
- "Decline" path for setup is implicit (user abandons page). No explicit "I don't want this account" action in v1.
- The preview query MUST run and resolve successfully before the submit button is enabled — prevents the user typing a password against an invalid token only to learn after the fact.

**8. Visual reference:** `auth.jsx:471–536` · `v6-fe1-04-setup.png`.

---

### B.5 Privacy acknowledgement — `/privacy`

**1. Route segment + URL state**

- File: `frontend/src/app/(authed)/privacy/page.tsx` per AC-CD20. `/privacy` lives in the `(authed)/` group (the only authenticated route a privacy-unacked user can hit) and intentionally bypasses the `(authed)/` layout's privacy-ack subgate via a route-group exception. See §C.4 for the full matrix.
- No URL params.

**2. Components**

- Scaffold reused: `useAuth()` (read `user.privacy_ack_at`, call `logout()`); `client`, `unwrap`.
- New in this PR: `AuthShell` with `wide` prop (620px per design).

**3. API endpoints**

- `POST /v1/auth/privacy/acknowledge` — empty body → `{privacy_ack_at, status}`. **Requires Bearer.** On success, AuthProvider's `user` cache is updated locally with returned `privacy_ack_at` (no refetch).
- `POST /v1/auth/logout` (via `useAuth().logout()`) — wired by "Decline and log out" link.

**4. Form + zod + rhf**

No form fields. Single "I acknowledge" submit. Mutation uses TanStack Query `useMutation`:

```ts
const ackMutation = useMutation({
  mutationFn: () => unwrap(client.POST("/v1/auth/privacy/acknowledge")),
  onSuccess: (resp) => {
    setUserPrivacyAck(resp.privacy_ack_at);
    router.push("/");
  },
});
```

**First `useMutation` usage** in the codebase — establishes the precedent (alongside `useQuery` from Setup) for AC-CD21.

**5. States**

| State | Trigger | Visual |
|---|---|---|
| `idle` | Default | Wide card, scrollable notice text, "Decline and log out" link + "I acknowledge →" button. |
| `submitting` | `ackMutation.isPending` | Pulse-dot + "Acknowledging…". Decline disabled. |
| `declined` | After `logout()` resolves | Card replaced: avatar-circle icon + "You've been signed out" + "Return to sign in →" button. |
| `error` (Pattern B toast) | `ackMutation.error` | Danger toast "Couldn't acknowledge — try again". Card stays mounted. |

The `declined` state is a terminal in-page view; "Return to sign in" routes to `/login`.

**6. Acceptance criteria**

```
Scenario: User acknowledges privacy
  Given the user is authenticated with privacy_ack_at === null
  And the user is on /privacy
  When the user clicks "I acknowledge"
  And the backend returns 200 { privacy_ack_at: <iso>, status: "ok" }
  Then the auth-context user is updated with the new privacy_ack_at
  And the router pushes to "/"

Scenario: User declines
  Given the user is on /privacy
  When the user clicks "Decline and log out"
  Then logout() is invoked
  And after tokens are cleared, the in-page "You've been signed out" confirmation renders
  And clicking "Return to sign in" pushes to "/login"

Scenario: Acknowledge fails
  Given the user is on /privacy
  When the backend returns 5xx on acknowledge
  Then a danger toast surfaces (Pattern B)
  And the user remains on /privacy with the card mounted

Scenario: Already-acknowledged user lands on /privacy
  Given the user has privacy_ack_at !== null
  When the user navigates to /privacy
  Then the privacy guard redirects them to "/" (no flash of the notice)

Scenario: Unauthenticated user lands on /privacy
  Given the user is unauthenticated
  When the user navigates to /privacy
  Then the unauth guard redirects them to "/login"
```

**7. Edge cases / gotchas**

- Notice text is **scrollable** (max-height 320px per design). Do not gate acknowledge on scroll-to-bottom in v1 — design does not require it. (If legal requires later, add `scrolledToBottom` state and enable-on-bottom guard.)
- `logout()` clears tokens then sets `status: "unauthenticated"`. The `declined` confirmation view must read from local `useState` (`declined: true`) rather than re-querying auth — otherwise the guard redirects before the user sees confirmation. Pattern: set local `declined` true BEFORE calling `logout()`, render confirmation regardless of auth state.
- `/privacy` is the **only** authenticated route a privacy-unacked user can hit.

> **Placeholder watch — DO NOT SHIP AS-IS:** the four-paragraph privacy notice body in `auth.jsx:592–614` is **AC-D16 §8.7 placeholder text**, authored by design-Claude as plausible-sounding-but-not-legal-reviewed. The build session ships the copy as-is to unblock the flow (a privacy gate with placeholder text still tests correctly against the round-trip done-when) BUT the FE-1 handover must record "BLOCKER FOR PRODUCTION: privacy notice copy requires legal sign-off before any external user sees this page". Tag the copy in source with `// TODO(AC-D16): placeholder copy, needs legal review before production`.

**8. Visual reference:** `auth.jsx:541–636` · `v6-fe1-05-privacy.png`.

---

## C. Cross-page concerns

### C.1 Shared components (introduced this PR)

Under `frontend/src/components/auth/` and `frontend/src/lib/api/` (the form-error helper lives at `frontend/src/lib/api/form-errors.ts` per CODE_SPEC.md:1024). FE-1 originals that propagate into FE-2..FE-9:

| Component | Purpose | Source-of-truth design lines |
|---|---|---|
| `AuthShell` | Centered full-height container, 400px / 620px wide | `auth.jsx:92–104` |
| `AuthLogo` | Acumen mark + wordmark + SITEMESH meta | `auth.jsx:80–90` |
| `AuthCard` | Paper-card wrapper (shadcn `Card` styled) | inline |
| `AuthCardTitle` | Serif + serif-italic title | `auth.jsx:244–253` |
| `AuthField` | Label + Input + error + hint | `auth.jsx:132–163` |
| `AuthNotice` | Coloured-bar callout | `auth.jsx:165–181` |
| `SubmitButton` | Tri-state idle/submitting/success | `auth.jsx:183–196` |
| `BackLink` | "← Back to sign in" | `auth.jsx:198–207` |
| `PasswordRulesChecklist` | Live 4-rule pass/fail | `auth.jsx:209–242` |
| `TokenErrorCard` | Token-expired/invalid full-card swap | `auth.jsx:436–466` |

FE-2 may move `AuthNotice`/`AuthField` into a top-level `components/ui/` once more shadcn primitives land; FE-1 keeps them in `auth/` for surface focus.

### C.2 `applyApiErrorToForm` — the form-error display precedent

Lives at `frontend/src/lib/api/form-errors.ts` (canonical path per CODE_SPEC.md:1024). **AC-CD21 precedent** — every form in FE-2..FE-9 uses this helper.

```ts
import type { UseFormReturn, FieldValues, Path } from "react-hook-form";
import { ApiError } from "@/lib/api/errors";

/**
 * Project an ApiError onto a react-hook-form's setError surface.
 *
 * Backend envelope per AC-CD6: { error: { code, message, detail } }.
 * For 422 validation responses, `detail` is FastAPI's pydantic shape:
 *   [{ loc: ["body", "<field_name>"], msg, type }, ...]
 *
 * Iterates that array, maps loc[-1] to a form field, calls form.setError.
 * Unknown fields fall through to root error.
 *
 * For non-422 errors (business codes like INVALID_CREDENTIALS), the
 * caller passes `{ fieldMap: { INVALID_CREDENTIALS: 'email' } }` or
 * falls through to root.
 */
export function applyApiErrorToForm<T extends FieldValues>(
  err: unknown,
  form: UseFormReturn<T>,
  opts?: { fieldMap?: Record<string, Path<T> | 'root'> },
): void { /* implementation */ }
```

**Design alignment.** `error-patterns.jsx` describes Pattern A as reading `error.fields[name]`. Our wire shape uses `error.detail` per AC-CD6. Design is descriptive of the *displayed* pattern, not the wire format — `applyApiErrorToForm` bridges them. **No spec drift.**

### C.3 Pattern B (toasts) — `sonner` mounted in root layout

`sonner`, `lucide-react`, `clsx`, `tailwind-merge` added as deps in this PR (AC-CD-level structural-additions carve-out; AC-CD19/AC-CD23 imply shadcn-compatible deps). `<Toaster />` mounts in `app/layout.tsx`:

```tsx
<AuthProvider>
  <QueryClientProvider client={getQueryClient()}>
    {children}
    <Toaster richColors position="bottom-right" />
  </QueryClientProvider>
</AuthProvider>
```

Toast helper at `frontend/src/lib/ui/toast.ts` wraps sonner with severity-coded auto-dismiss timings per design:
- `toast.info(...)` — 3s
- `toast.warn(...)` — 5s
- `toast.error(...)` — 7s

### C.4 Route guards (AC-CD20) — the five-posture matrix

Route groups:

```
frontend/src/app/
  layout.tsx                # AuthProvider + QueryClient + Toaster
  page.tsx                  # dashboard shell (empty for FE-1)
  (auth)/
    layout.tsx              # auth-group guard — unauth surfaces only (see below)
    login/page.tsx
    forgot/page.tsx
    reset/[token]/page.tsx
    setup/[token]/page.tsx
  (authed)/
    layout.tsx              # authed-group guard — privacy-ack subgate, with /privacy bypass (see below)
    privacy/page.tsx        # SPECIAL — bypasses the privacy-ack subgate
  403/page.tsx              # role-mismatch landing
```

Per AC-CD20, `(auth)/` hosts unauthenticated surfaces only; `(authed)/` hosts any post-auth surface that is not role-specific, including `/privacy`. Route groups (parenthesised folders) do not affect URL paths.

**The five postures (evaluated in order):**

| # | Posture | Hit `/login` `/forgot` `/reset/*` `/setup/*` | Hit `/privacy` | Hit any other authed route |
|---|---|---|---|---|
| 1 | Auth `loading` | Skeleton | Skeleton | Skeleton |
| 2 | Unauthenticated | Render | Redirect → `/login` | Redirect → `/login?next=<path>` |
| 3 | Authed, `privacy_ack_at === null` | Redirect → `/privacy` | **Render** | Redirect → `/privacy` |
| 4 | Authed, role mismatch (e.g. testee → `/ops`) | Redirect → `/` | Render | Redirect → `/403` |
| 5 | Authed, ack'd, role-matched | Redirect → `/` | Redirect → `/` | Render |

**Implementation:**
- `(auth)/layout.tsx` enforces postures 1, 2, 5 for the unauth-set pages (`/login`, `/forgot`, `/reset/*`, `/setup/*`): renders for posture 2, redirects to `/` for posture 5.
- `(authed)/layout.tsx` enforces postures 1, 2, 3 for the authed surfaces (including `/privacy`): redirects to `/login` for posture 2, redirects to `/privacy` for posture 3 — **except** `/privacy` itself, which bypasses the privacy-ack subgate via a route-group exception so the unacked user can actually render and acknowledge.
- `frontend/src/lib/auth/guards.tsx` exports a `<RequireAuth>` wrapper used by future role-gated layouts (FE-2 adds `(testee)`/`(admin)` route groups).
- For FE-1, role-mismatch (posture 4) only needs `/403` to exist — no role-gated routes ship in FE-1. Guard plumbing is wired against an empty allow-list; `/403` ships with placeholder copy.
- **Post-login resolver:** after `POST /v1/auth/login`, page calls `unwrap(client.GET("/v1/auth/me"))` to seed auth context fresh, then routes per matrix (posture 3 vs 5).

**Auth-context extension.** Current `AuthContext` exposes `{ user, status, logout }` with no setter. FE-1 needs to mutate cached `user` in two places: (a) after login, seed identity; (b) after privacy ack, flip `privacy_ack_at` for guard re-eval. Extend to:

```ts
type AuthContextValue = {
  user: UserResponse | null;
  status: AuthStatus;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;               // re-runs mount resolve
  setUserPrivacyAck: (at: string) => void;    // narrow optimistic mutation
};
```

Broader `setUser` intentionally not exposed; new mutation surfaces add their own narrow setters.

> **AC-CD-structural addition (per SESSION_START.md carve-out).** Extending `AuthContext` with `refresh` + `setUserPrivacyAck` is structural. Does not violate AC-CD19 (memory access + localStorage refresh + 401 retry preserved). Well-rationalised: FE-1 round-trip requires it. Fold into handover.

### C.5 Inter-page dependencies

- **Setup → Login → Privacy → Dashboard chain** is the headline round-trip:
  1. User clicks email link → `/setup/{token}` → submits password → 2xx.
  2. Routes to `/login` (no auto-login per API contract).
  3. User submits credentials → `POST /v1/auth/login` → tokens stored → post-login resolver calls `/v1/auth/me`.
  4. `privacy_ack_at === null` → posture-3 → `/privacy`.
  5. User clicks "I acknowledge" → `POST /v1/auth/privacy/acknowledge` → context updated → push `/`.
  6. `/` renders empty dashboard shell.
- **Forgot → Reset chain** independent (email out of band).
- **Deactivation gate** pure login-time concern.

### C.6 Pattern C (full-page error boundary)

`frontend/src/app/error.tsx` and `frontend/src/app/(auth)/error.tsx` (Next 15 App Router error files):
- Centered card per design Pattern C.
- Wave icon (lucide `Waves`), "Something went wrong.", "Try again" (calls `reset`) + "Go to dashboard" (`router.push("/")`).
- Expandable "+ Show technical details" reveals `error.code` (if `ApiError`) and the trace ID.

> **Resolution (folded into FE-1 build scope):** extend `ApiError` with optional `traceId: string | null`, populated in `unwrap()` from `response.headers.get("x-acumen-trace")`. Small, localised change to `lib/api/client.ts` + `lib/api/errors.ts`; propagates cleanly so Pattern C reads `err.traceId` alongside `err.code`. Build session implements alongside the boundary file.

---

## D. Test cases (Vitest)

Vitest config aliases `@` → `/src` (PR-032). Tests under `frontend/tests/` and `frontend/src/**/*.test.tsx`. RTL installed. **MSW not installed at FE-0**; FE-1 adds MSW for HTTP mocking (AC-CD-level structural addition, foldable into handover). Cleaner than `vi.mock` for round-trip tests.

### D.1 Unit tests (lib + helpers)

`frontend/src/lib/api/form-errors.test.ts`:
- Maps a FastAPI-style `detail` array onto rhf fields via `setError`.
- Unknown field name falls through to `root`.
- Non-422 `ApiError` uses the `fieldMap` opt.
- Non-`ApiError` throwables surface to `root` with generic copy.

`frontend/src/lib/ui/toast.test.ts`:
- Severity → auto-dismiss timing mapping (3s / 5s / 7s).

`frontend/src/lib/auth/guards.test.tsx`:
- Each cell in the §C.4 matrix has a Vitest case. Render the guard with mocked auth context; assert `router.push` is called with expected path or children render.

### D.2 Page integration tests

One test per Gherkin scenario in each per-page §6, using MSW handlers:

- `frontend/src/app/(auth)/login/page.test.tsx` — §B.1 trios.
- `frontend/src/app/(auth)/forgot/page.test.tsx` — §B.2 trios.
- `frontend/src/app/(auth)/reset/[token]/page.test.tsx` — §B.3 trios (incl. both token-error variants).
- `frontend/src/app/(auth)/setup/[token]/page.test.tsx` — §B.4 trios.
- `frontend/src/app/(authed)/privacy/page.test.tsx` — §B.5 trios (incl. declined-stays-mounted edge case).

### D.3 Round-trip integration test

`frontend/tests/integration/auth-roundtrip.test.tsx`:
- Done-when in narrative form: mount app at `/setup/<token>` → submit password → submit login → submit acknowledge → assert `/` rendered with user's name visible. Single test, exercises every page in the chain.

### D.4 Existing tests preserved

`frontend/tests/smoke.test.ts` (storage + error parsing from PR-032) continues to pass unchanged.

### D.5 Coverage gate (FE_CHECKLIST.md FE-1 row ticks on)

- All §B Gherkin + D.3 round-trip green via `pnpm test --run`.
- `pnpm typecheck` clean.
- `pnpm lint` clean.
- `pnpm build` succeeds.

---

## E. Known placeholders (DO NOT SHIP AS-IS)

| # | Placeholder | Location | Action before production |
|---|---|---|---|
| 1 | Privacy notice 4-paragraph body | `app/(authed)/privacy/page.tsx` — port of `auth.jsx:592–614` | **Legal sign-off.** AC-D16 §8.7 flags this. Tag with `// TODO(AC-D16): placeholder copy, needs legal review before production`. Handover records "BLOCKER FOR EXTERNAL ROLLOUT". |
| 2 | `/403` page copy | `app/403/page.tsx` | Generic copy fine for v1; FE-2 may refine. Not a blocker. |
| 3 | Empty-dashboard shell at `/` | `app/page.tsx` | FE-1 leaves a minimal "Welcome, {name}" view replacing the current scaffold debug page. FE-2 lands the real shell. Not a blocker. |

---

## F. Scope additions beyond `fe-specs/FE-1-auth.md`

Two additional docs land alongside the FE-1 spec — both small, both surfaced explicitly.

### F.1 `FE_ROADMAP.md` — Learning Center v1.x non-goal

Append to a new "Non-goals (v1 frontend)" section (created in the same PR):

> - Dedicated Learning Center (progress tracking, lesson sequences, recommended-next-pill, bookmarks) — deferred to v1.x. v1 training surface is the pill detail page (FE-3) consuming POST /v1/pills/{id}/learning-material (PR-031) on page load.

User-provided text; verbatim. Clarifies FE-3 does NOT carry a Learning Center surface, only the on-page learning material consumer.

### F.2 `SESSION_START.md` — "Design reference completeness check"

Added as a new bullet under "Working agreement (discipline — non-negotiable)":

> **Design reference completeness check.** When a design reference (a prototype, a mock set, a Figma drop, etc.) is added or replaced in the repo, audit that it covers every product surface SPEC/DECISIONS mentions before treating it as canonical. Walk SPEC.md and DECISIONS.md section by section; for each user-facing surface enumerated there, confirm the design reference includes a mock. Missing mocks are surfaced as spec-drift (do not silently fill the gap with prose). Lesson learned from the v5 design drop that omitted the auth-surface pages, surfaced only when FE-1 planning opened — by which point design-Claude time had elapsed and the gap had to be filled mid-build. Discovery at design-drop time is cheap; discovery at build time is expensive.

---

## G. Session 2 onwards — template propagation to FE-2..FE-9

The structure (Context → A inventory → B per-page 8-section template → C cross-page → D tests → E placeholders → F scope-bleed) is the **template for every subsequent FE-N detail spec**. The detail-spec session for FE-N opens by:

1. Copying `fe-specs/FE-N-{slug}.md` from this file's skeleton.
2. Populating inventory from `FE_ROADMAP.md`'s FE-N deliverables.
3. Populating each per-page entry using the 8-section template, citing design source lines and screenshots.
4. Cross-walking API contract from `frontend/openapi/schema.json`.
5. **Running the design-reference completeness check (§F.2)** for the FE-N surface set.
6. Surfacing all drift watches before any code lands.

Per-phase variances expected and ALLOWED:
- FE-5 (SSE) adds an "SSE event sequence" subsection per consuming page. 8-section template still applies; SSE nests inside §5 (States).
- FE-8 / FE-9 may split into multiple files (e.g. `fe-specs/FE-8-admin-authoring-{catalogue,users,groups,tests}.md`) if a single file exceeds ~2500 lines; detail-spec session decides at plan time.

Per-phase variances NOT allowed without spec-drift surface:
- Skipping Gherkin acceptance criteria. Every state must have a trio.
- Skipping drift-watch / verification / blocker callouts. No callouts means either the cross-walk was incomplete or the spec is genuinely clean — declare which.
- Folding test list into per-page sections. Tests live in §D for scannability and coverage-counting.

---

## H. Spec-drift roll-up (post-review classification)

The cross-walk surfaced 8 candidate items. After review, they're classified into three groups:

### (a) BLOCKERS for the FE-1 build session — must land before the build session opens

1. **Setup email pre-fill** — design shows readOnly invitee email; no API endpoint exposes it. **Resolution:** user authors a small spec-clarification PR adding `GET /v1/auth/setup/{token}/preview` → `{email}`. The FE-1 build session cannot open against an unlocked spec; the spec-clarification PR is the gate.

### (b) BUILD-SESSION VERIFICATION TASKS — front-loaded at the start of the FE-1 build session

The build session opens with a single verification step before any code lands: read `app/api/routers/auth.py` and the AC-CD6 error-code catalogue, confirm the assumed codes match the actual codes. If they match, proceed. If any diverge, halt and surface for a spec-clarification PR.

2. **Login error codes** — `INVALID_CREDENTIALS`, `ACCOUNT_DEACTIVATED`, `LOGIN_RATE_LIMITED`.
3. **Token error codes** — `TOKEN_EXPIRED`, `TOKEN_INVALID` (used by both reset-consume and setup-consume).

### (c) APPROVED RESOLUTIONS — folded into the FE-1 build PR scope, captured in the build PR's handover

These are not blockers. The spec body above locks the resolution; the build session implements, the build PR's handover records them under the SESSION_START.md AC-CD-level structural-additions carve-out.

4. **Setup auto-login copy gap** — design "Taking you in…" → adjusted to "Taking you back to sign in…" (§B.4 §5). Pure frontend copy, no spec amendment.
5. **Trace header capture** — extend `ApiError` with optional `traceId`, populate from `response.headers.get("x-acumen-trace")` in `unwrap()` (§C.6).
6. **MSW** as test dependency (§D).
7. **sonner / lucide-react / clsx / tailwind-merge** as runtime deps (§C.3; AC-CD19/CD23 imply shadcn-compatible).
8. **AuthContext extension** with `refresh()` + `setUserPrivacyAck()` narrow setters (§C.4).

---

*End of FE-1-auth.md. Template propagates to FE-2..FE-9 per §G; deviations surface as spec drift.*
