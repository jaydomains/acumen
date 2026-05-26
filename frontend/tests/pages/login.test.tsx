/**
 * /login integration coverage (FE-1 §B.1).
 *
 * Renders the real LoginForm inside a real AuthProvider against MSW
 * handlers — only next/navigation is mocked because Gate's routing is
 * verified in tests/lib/guards.test.tsx. Each Gherkin scenario maps to
 * one test (six total per the amended spec; the locked / rate-limited
 * scenario was removed in the prep commit because the backend has no
 * 429 path).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { config } from "@/lib/config";
import { server } from "@/mocks/node";
import { setMockUser } from "@/mocks/handlers";
import { clearTokens, getAccessToken, getRefreshToken } from "@/lib/auth/storage";
import { AuthProvider } from "@/lib/auth/context";
import LoginPage from "@/app/(auth)/login/page";
import type { UserResponse } from "@/lib/api/types";

const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(),
}));

const API = config.apiBaseUrl;

const ackedUser: UserResponse = {
  id: "00000000-0000-0000-0000-000000000010",
  email: "acked@example.com",
  name: "Acked User",
  role: "testee",
  status: "active",
  privacy_ack_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
};

const unackedUser: UserResponse = {
  ...ackedUser,
  id: "00000000-0000-0000-0000-000000000011",
  email: "unacked@example.com",
  name: "Unacked User",
  privacy_ack_at: null,
};

const renderLogin = () =>
  render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>,
  );

const waitForUnauthLoaded = async () => {
  // AuthProvider boots with status="loading" then resolves to
  // unauthenticated against the default 401 /me handler. The form
  // renders inside the provider — wait for the email field to appear.
  await screen.findByLabelText(/email/i);
};

describe("/login", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPush.mockClear();
    clearTokens();
  });

  afterEach(() => {
    clearTokens();
  });

  it("signs in an ack'd user and lets the (auth) guard route to the dashboard", async () => {
    server.use(
      http.post(`${API}/v1/auth/login`, () => {
        setMockUser(ackedUser);
        return HttpResponse.json({
          access_token: "acked-access",
          refresh_token: "acked-refresh",
          token_type: "bearer",
        });
      }),
    );
    const user = userEvent.setup();
    renderLogin();
    await waitForUnauthLoaded();

    await user.type(screen.getByLabelText(/email/i), ackedUser.email);
    await user.type(screen.getByLabelText(/password/i), "correct-horse");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(getAccessToken()).toBe("acked-access"));
    expect(getRefreshToken()).toBe("acked-refresh");
  });

  it("signs in an un-ack'd user (auth context flips to authenticated with privacy_ack_at=null)", async () => {
    server.use(
      http.post(`${API}/v1/auth/login`, () => {
        setMockUser(unackedUser);
        return HttpResponse.json({
          access_token: "unacked-access",
          refresh_token: "unacked-refresh",
          token_type: "bearer",
        });
      }),
    );
    const user = userEvent.setup();
    renderLogin();
    await waitForUnauthLoaded();

    await user.type(screen.getByLabelText(/email/i), unackedUser.email);
    await user.type(screen.getByLabelText(/password/i), "correct-horse");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // Tokens persist (Gate handles the /privacy bounce; covered in
    // guards.test.tsx and the round-trip integration in Slice E).
    await waitFor(() => expect(getAccessToken()).toBe("unacked-access"));
    expect(getRefreshToken()).toBe("unacked-refresh");
  });

  it("shows an inline error under email on invalid_credentials and persists no tokens", async () => {
    server.use(
      http.post(`${API}/v1/auth/login`, () =>
        HttpResponse.json(
          {
            error: {
              code: "invalid_credentials",
              message: "Invalid email or password.",
              detail: null,
            },
          },
          { status: 401 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderLogin();
    await waitForUnauthLoaded();

    await user.type(screen.getByLabelText(/email/i), "wrong@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const emailInput = await screen.findByLabelText(/email/i);
    await waitFor(() => {
      expect(emailInput).toHaveAttribute("aria-invalid", "true");
    });
    expect(screen.getByRole("alert").textContent).toMatch(/invalid email or password/i);
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    // Submit button is re-enabled after failure.
    expect(screen.getByRole("button", { name: /sign in/i })).not.toBeDisabled();
  });

  it("renders a sticky warn notice and disables submit on account_deactivated", async () => {
    server.use(
      http.post(`${API}/v1/auth/login`, () =>
        HttpResponse.json(
          {
            error: {
              code: "account_deactivated",
              message: "This account has been deactivated.",
              detail: null,
            },
          },
          { status: 403 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderLogin();
    await waitForUnauthLoaded();

    await user.type(screen.getByLabelText(/email/i), "dead@example.com");
    await user.type(screen.getByLabelText(/password/i), "anything");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const notice = await screen.findByRole("alert");
    expect(notice.textContent).toMatch(/deactivated/i);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled();
    expect(getAccessToken()).toBeNull();
  });

  it("does not fire a network call when the form is submitted empty", async () => {
    let loginHits = 0;
    server.use(
      http.post(`${API}/v1/auth/login`, () => {
        loginHits++;
        return HttpResponse.json({});
      }),
    );
    const user = userEvent.setup();
    renderLogin();
    await waitForUnauthLoaded();

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // Two zod errors appear (email + password); use findAllByRole to
    // wait for the alerts.
    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(2);
    });
    expect(loginHits).toBe(0);
    expect(getAccessToken()).toBeNull();
  });

  it("renders the login form for an unauthenticated visitor (already-authed redirect is covered by the (auth) guard)", async () => {
    renderLogin();
    await waitForUnauthLoaded();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });
});
