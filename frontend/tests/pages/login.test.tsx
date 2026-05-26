/**
 * /login integration coverage (FE-1 §B.1).
 *
 * Renders LoginPage inside its (auth)/Gate so the layout's posture
 * matrix is part of the test surface: success paths assert the right
 * `router.replace` target, not just token persistence. next/navigation
 * is mocked because Vitest jsdom has no router; the auth context,
 * applyApiErrorToForm, and MSW are real.
 *
 * Six tests mirror the six Gherkin scenarios in §B.1.6 (post-amendment
 * — the LOGIN_RATE_LIMITED scenario was dropped because the backend
 * has no 429 path). A seventh regression test (PR#50 Gitar review)
 * covers the edge case where /v1/auth/login succeeds but the immediate
 * /v1/auth/me fails transiently — the UI must not get stuck on the
 * "Done" success state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Suspense } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import { setMockUser } from "@/mocks/handlers";
import { clearTokens, getAccessToken, getRefreshToken } from "@/lib/auth/storage";
import { AuthProvider } from "@/lib/auth/context";
import { Gate } from "@/lib/auth/guards";
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

const API = "http://localhost:8000"; // MSW fallback; matches src/lib/config MSW_FALLBACK_CONFIG

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
      <Suspense fallback={null}>
        <Gate posture="guest">
          <LoginPage />
        </Gate>
      </Suspense>
    </AuthProvider>,
  );

const waitForFormReady = async () => {
  // AuthProvider boots with status="loading" → AuthSkeleton renders.
  // Once /v1/auth/me returns 401 (default handler), status flips to
  // "unauthenticated", Gate allows the form to render. We wait for
  // the email input to appear.
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

  it("signs in an ack'd user, persists tokens, and the (auth) guard routes to the dashboard", async () => {
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
    await waitForFormReady();

    await user.type(screen.getByLabelText(/email/i), ackedUser.email);
    await user.type(screen.getByLabelText(/password/i), "correct-horse");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(getAccessToken()).toBe("acked-access"));
    expect(getRefreshToken()).toBe("acked-refresh");
    // Gate's posture-5 redirect (ack'd, no ?next=) lands on dashboardPathFor("testee").
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
  });

  it("signs in an un-ack'd user and the (auth) guard routes to /privacy (posture 3)", async () => {
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
    await waitForFormReady();

    await user.type(screen.getByLabelText(/email/i), unackedUser.email);
    await user.type(screen.getByLabelText(/password/i), "correct-horse");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(getAccessToken()).toBe("unacked-access"));
    expect(getRefreshToken()).toBe("unacked-refresh");
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/privacy"));
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
    await waitForFormReady();

    await user.type(screen.getByLabelText(/email/i), "wrong@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const emailInput = await screen.findByLabelText(/email/i);
    await waitFor(() => {
      expect(emailInput).toHaveAttribute("aria-invalid", "true");
    });
    // The error message is rendered inline (no role="alert" — by
    // design, aria-describedby drives the announcement when focus
    // returns to the invalid input).
    expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    // Submit button is re-enabled after failure.
    expect(screen.getByRole("button", { name: /sign in/i })).not.toBeDisabled();
    // No redirect fired.
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders a sticky warn notice on account_deactivated and the form is not resubmittable from the same render", async () => {
    let loginHits = 0;
    server.use(
      http.post(`${API}/v1/auth/login`, () => {
        loginHits++;
        return HttpResponse.json(
          {
            error: {
              code: "account_deactivated",
              message: "This account has been deactivated.",
              detail: null,
            },
          },
          { status: 403 },
        );
      }),
    );
    const user = userEvent.setup();
    renderLogin();
    await waitForFormReady();

    await user.type(screen.getByLabelText(/email/i), "dead@example.com");
    await user.type(screen.getByLabelText(/password/i), "anything");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    const notice = await screen.findByRole("alert");
    expect(notice.textContent).toMatch(/deactivated/i);

    const submitBtn = screen.getByRole("button", { name: /sign in/i });
    expect(submitBtn).toBeDisabled();
    expect(loginHits).toBe(1);

    // Attempt a second submit — the disabled button must not refire
    // the login endpoint.
    await user.click(submitBtn);
    expect(loginHits).toBe(1);
    expect(getAccessToken()).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
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
    await waitForFormReady();

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // Two zod errors appear (email + password). They're plain <p>
    // elements (no role="alert") — assert by content.
    await waitFor(() => {
      expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();
      expect(screen.getByText(/enter your password/i)).toBeInTheDocument();
    });
    expect(loginHits).toBe(0);
    expect(getAccessToken()).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("surfaces a root banner if /v1/auth/me fails after a successful login (no stuck 'Done' state)", async () => {
    // Regression for gitar review on PR#50: login 200 → /me 503 used
    // to leave the SubmitButton frozen on 'Done' because submittedOk was
    // set before refreshMe completed. refreshMe now returns a success
    // boolean and LoginForm only flashes 'Done' if identity loaded.
    server.use(
      http.post(`${API}/v1/auth/login`, () => {
        // Note: deliberately do NOT call setMockUser, so the next
        // /v1/auth/me from this scenario's override fires unauth/5xx.
        return HttpResponse.json({
          access_token: "transient-access",
          refresh_token: "transient-refresh",
          token_type: "bearer",
        });
      }),
      http.get(`${API}/v1/auth/me`, () =>
        HttpResponse.json(
          {
            error: { code: "service_unavailable", message: "down", detail: null },
          },
          { status: 503 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderLogin();
    await waitForFormReady();

    await user.type(screen.getByLabelText(/email/i), "ok@example.com");
    await user.type(screen.getByLabelText(/password/i), "correct-horse");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // Tokens persist (so a reload recovers).
    await waitFor(() => expect(getAccessToken()).toBe("transient-access"));
    // Root banner explains the partial-success state.
    expect(await screen.findByText(/couldn't load your profile/i)).toBeInTheDocument();
    // Submit button is back to "Sign in →" (not stuck on "Done").
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects an already-authenticated visitor away from /login (Gate posture 3 or 5)", async () => {
    // Preset the mock so the initial GET /v1/auth/me returns an
    // ack'd user — the Gate's guest posture sees status='authenticated'
    // and fires router.replace before the form ever mounts.
    setMockUser(ackedUser);
    renderLogin();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
    // The form is never rendered for an already-authed visitor.
    expect(screen.queryByLabelText(/email/i)).toBeNull();
  });
});
