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
  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string }
    | null;
  mockSignedInAs = {
    ...baseFixtureUser,
    email: body?.email ?? baseFixtureUser.email,
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

export const handlers = [meHandler, loginHandler, logoutHandler];
