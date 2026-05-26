/**
 * /privacy integration coverage (FE-1 §B.5).
 *
 * Five tests map to the five §B.5.6 Gherkin scenarios.
 *
 * The page lives inside privacy/layout.tsx which wraps a <Suspense>
 * around <Gate posture="privacy">. Tests render the same shape so
 * the routing guarantees (Scenario 4 already-ack'd, Scenario 5
 * unauth) exercise the same Gate code the production layout uses.
 *
 * Sonner's `toast` is mocked at the module level so the Pattern-B
 * error scenario can assert the call without rendering an actual
 * toast container.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Suspense } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/lib/config";
import { server } from "@/mocks/node";
import { setMockUser } from "@/mocks/handlers";
import { setAccessToken, setRefreshToken, clearTokens } from "@/lib/auth/storage";
import { AuthProvider } from "@/lib/auth/context";
import PrivacyPage from "@/app/privacy/page";
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
  usePathname: () => "/privacy",
  useSearchParams: () => new URLSearchParams(),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (msg: string) => toastError(msg),
    success: vi.fn(),
  },
  Toaster: () => null,
}));

const API = config.apiBaseUrl;

const unackedUser: UserResponse = {
  id: "00000000-0000-0000-0000-000000000020",
  email: "newhire@example.com",
  name: "New Hire",
  role: "testee",
  status: "active",
  privacy_ack_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

const ackedUser: UserResponse = {
  ...unackedUser,
  id: "00000000-0000-0000-0000-000000000021",
  privacy_ack_at: "2026-01-01T00:00:00Z",
};

const renderPrivacy = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Suspense fallback={null}>
          <PrivacyPage />
        </Suspense>
      </AuthProvider>
    </QueryClientProvider>,
  );
};

const waitForPageReady = async () => {
  await screen.findByRole("button", { name: /i acknowledge/i });
};

describe("/privacy", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPush.mockClear();
    toastError.mockClear();
    clearTokens();
    // Seed tokens so the AuthProvider's mount-time refresh path sees
    // a logged-in session. Tests that want the unauth branch override
    // this beforeEach by clearing again (no token, no /me success).
    setAccessToken("ack-test-access");
    setRefreshToken("ack-test-refresh");
  });

  it("acknowledges privacy, patches the auth-context user, and pushes to /", async () => {
    setMockUser(unackedUser);
    const user = userEvent.setup();
    renderPrivacy();
    await waitForPageReady();

    await user.click(screen.getByRole("button", { name: /i acknowledge/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
    expect(toastError).not.toHaveBeenCalled();
  });

  it("renders the in-page 'signed out' confirmation on decline; return-to-sign-in pushes to /login", async () => {
    setMockUser(unackedUser);
    const user = userEvent.setup();
    renderPrivacy();
    await waitForPageReady();

    await user.click(screen.getByRole("button", { name: /decline and log out/i }));

    // Declined view replaces the card.
    await screen.findByText(/you've been signed out/i);
    expect(screen.queryByRole("button", { name: /i acknowledge/i })).toBeNull();

    // Clicking "Return to sign in" navigates.
    await user.click(screen.getByRole("button", { name: /return to sign in/i }));
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("surfaces a danger toast (Pattern B) on 5xx and leaves the card mounted", async () => {
    setMockUser(unackedUser);
    server.use(
      http.post(`${API}/v1/auth/privacy/acknowledge`, () =>
        HttpResponse.json(
          {
            error: {
              code: "service_unavailable",
              message: "down",
              detail: null,
            },
          },
          { status: 503 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPrivacy();
    await waitForPageReady();

    await user.click(screen.getByRole("button", { name: /i acknowledge/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        expect.stringMatching(/couldn't acknowledge/i),
      );
    });
    // Card still mounted, button back to idle.
    expect(screen.getByRole("button", { name: /i acknowledge/i })).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("redirects an already-ack'd user away from /privacy (no flash of the notice)", async () => {
    setMockUser(ackedUser);
    renderPrivacy();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
    // Notice text never rendered.
    expect(screen.queryByRole("button", { name: /i acknowledge/i })).toBeNull();
  });

  it("redirects an unauthenticated visitor to /login", async () => {
    clearTokens();
    setMockUser(null);
    renderPrivacy();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
    expect(screen.queryByRole("button", { name: /i acknowledge/i })).toBeNull();
  });
});
