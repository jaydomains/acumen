/**
 * MSW request handler registry (FE-1 §D, AC-CD15).
 *
 * The default scenario is "anonymous user can sign in", powering both
 * dev-mode walk-throughs (`NEXT_PUBLIC_API_MOCKING=enabled pnpm dev`)
 * and a no-frills baseline for tests. Tests typically call
 * `server.use(...)` to override specific endpoints per Gherkin
 * scenario.
 *
 * Slice B handlers:
 *  - GET /v1/auth/me  → 200 if mockSignedInAs is set; 401 otherwise.
 *  - POST /v1/auth/login → 200 with fixture tokens; flips mockSignedInAs
 *    to a stub user matching the submitted email.
 *  - POST /v1/auth/logout → 200; clears mockSignedInAs.
 *
 * Later slices (C, D, E) append handlers for password-reset, setup,
 * privacy/acknowledge, and the round-trip stateful scenarios.
 */

import { http, HttpResponse } from "msw";
import { config } from "@/lib/config";
import type { UserResponse } from "@/lib/api/types";

const API = config.apiBaseUrl;

const baseFixtureUser: UserResponse = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "dev@example.com",
  name: "Dev User",
  role: "testee",
  status: "active",
  privacy_ack_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

let mockSignedInAs: UserResponse | null = null;

export const setMockUser = (user: UserResponse | null): void => {
  mockSignedInAs = user;
};

export const resetMockAuthState = (): void => {
  mockSignedInAs = null;
};

export const getMockUser = (): UserResponse | null => mockSignedInAs;

const unauthEnvelope = {
  error: {
    code: "not_authenticated",
    message: "Not authenticated",
    detail: null,
  },
};

export const meHandler = http.get(`${API}/v1/auth/me`, () => {
  if (mockSignedInAs) {
    return HttpResponse.json(mockSignedInAs);
  }
  return HttpResponse.json(unauthEnvelope, { status: 401 });
});

export const loginHandler = http.post(`${API}/v1/auth/login`, async ({ request }) => {
  let body: { email?: unknown; password?: unknown } | null = null;
  try {
    body = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return HttpResponse.json(
      {
        error: {
          code: "bad_request",
          message: "Invalid JSON body.",
          detail: null,
        },
      },
      { status: 400 },
    );
  }
  const detail: { loc: string[]; msg: string; type: string }[] = [];
  if (typeof body?.email !== "string" || !body.email) {
    detail.push({ loc: ["body", "email"], msg: "field required", type: "missing" });
  }
  if (typeof body?.password !== "string" || !body.password) {
    detail.push({
      loc: ["body", "password"],
      msg: "field required",
      type: "missing",
    });
  }
  if (detail.length > 0) {
    return HttpResponse.json({ detail }, { status: 422 });
  }
  mockSignedInAs = {
    ...baseFixtureUser,
    email: body.email as string,
  };
  return HttpResponse.json({
    access_token: "mock_access_token",
    refresh_token: "mock_refresh_token",
    token_type: "bearer",
  });
});

export const logoutHandler = http.post(`${API}/v1/auth/logout`, () => {
  mockSignedInAs = null;
  return HttpResponse.json({ status: "ok" });
});

/**
 * Password lifecycle handlers (Slice C).
 *
 * Defaults are stateless happy-path:
 *  - /password-reset/request → always 200 (privacy-preserving per spec)
 *  - /password-reset/consume → 200 ok
 *  - /setup/{token}/preview → 200 with a fixture email
 *  - /setup/consume → 200 ok
 *
 * Tests override per-scenario via `server.use(...)` to inject
 * invalid_token, weak-password, and transient failures.
 */

export const passwordResetRequestHandler = http.post(
  `${API}/v1/auth/password-reset/request`,
  () => HttpResponse.json({ status: "ok" }),
);

export const passwordResetConsumeHandler = http.post(
  `${API}/v1/auth/password-reset/consume`,
  () => HttpResponse.json({ status: "ok" }),
);

export const setupPreviewHandler = http.get(`${API}/v1/auth/setup/:token/preview`, () =>
  HttpResponse.json({ email: "invitee@example.com" }),
);

export const setupConsumeHandler = http.post(`${API}/v1/auth/setup/consume`, () =>
  HttpResponse.json({ status: "ok" }),
);

export const handlers = [
  meHandler,
  loginHandler,
  logoutHandler,
  passwordResetRequestHandler,
  passwordResetConsumeHandler,
  setupPreviewHandler,
  setupConsumeHandler,
];
