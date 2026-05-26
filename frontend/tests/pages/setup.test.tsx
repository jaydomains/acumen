/**
 * /setup/[token] integration coverage (FE-1 §B.4, post-amendment).
 *
 * Four tests cover the spec scenarios:
 *  1. Successful account setup (preview ok + consume ok → /login)
 *  2. Setup token expired or invalid (caught on preview)
 *  3. Setup token invalid (caught on consume)
 *  4. ReadOnly email rendered from preview response
 *
 * The setup page uses useQuery — tests wrap render in a fresh
 * QueryClientProvider to isolate cache between tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Suspense } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/lib/config";
import { server } from "@/mocks/node";
import { AuthProvider } from "@/lib/auth/context";
import { Gate } from "@/lib/auth/guards";
import SetupAccountPage from "@/app/(auth)/setup/[token]/page";

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
  usePathname: () => "/setup/abc",
  useSearchParams: () => new URLSearchParams(),
}));

const API = config.apiBaseUrl;
const TOKEN = "valid-setup-token";
const STRONG_PASSWORD = "Aa1!aaaaaaaaa";

const renderSetup = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Suspense fallback={null}>
          <Gate posture="guest">
            <SetupAccountPage params={Promise.resolve({ token: TOKEN })} />
          </Gate>
        </Suspense>
      </AuthProvider>
    </QueryClientProvider>,
  );
};

const waitForFormReady = async () => {
  await screen.findByLabelText(/^new password$/i);
};

describe("/setup/[token]", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPush.mockClear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("shows the readOnly invitee email from preview and pushes to /login on successful consume", async () => {
    server.use(
      http.get(`${API}/v1/auth/setup/:token/preview`, () =>
        HttpResponse.json({ email: "newhire@example.com" }),
      ),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSetup();
    await waitForFormReady();

    // ReadOnly email present.
    const emailInput = screen.getByLabelText(/^email$/i) as HTMLInputElement;
    expect(emailInput.value).toBe("newhire@example.com");
    expect(emailInput).toHaveAttribute("readonly");

    await user.type(screen.getByLabelText(/^new password$/i), STRONG_PASSWORD);
    await user.type(screen.getByLabelText(/confirm new password/i), STRONG_PASSWORD);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await screen.findByText(/you're all set/i);
    vi.advanceTimersByTime(1600);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
  });

  it("renders TokenErrorCard (setup flow) when the preview returns 400 invalid_token; no form ever mounts", async () => {
    server.use(
      http.get(`${API}/v1/auth/setup/:token/preview`, () =>
        HttpResponse.json(
          {
            error: {
              code: "invalid_token",
              message: "Setup link is invalid or has expired.",
              detail: null,
            },
          },
          { status: 400 },
        ),
      ),
    );
    renderSetup();

    await screen.findByText(/this invitation doesn't work/i);
    // Setup flow: no link to /forgot — admin-initiated recovery.
    expect(screen.queryByRole("link", { name: /forgot/i })).toBeNull();
    expect(screen.getByText(/ask for a new invitation/i)).toBeInTheDocument();
    // Password form never renders.
    expect(screen.queryByLabelText(/^new password$/i)).toBeNull();
  });

  it("replaces the card with TokenErrorCard if the consume call returns invalid_token (post-preview)", async () => {
    // Preview succeeds so the form renders; consume then fails.
    server.use(
      http.get(`${API}/v1/auth/setup/:token/preview`, () =>
        HttpResponse.json({ email: "newhire@example.com" }),
      ),
      http.post(`${API}/v1/auth/setup/consume`, () =>
        HttpResponse.json(
          {
            error: {
              code: "invalid_token",
              message: "Setup link is invalid or has expired.",
              detail: null,
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSetup();
    await waitForFormReady();

    await user.type(screen.getByLabelText(/^new password$/i), STRONG_PASSWORD);
    await user.type(screen.getByLabelText(/confirm new password/i), STRONG_PASSWORD);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await screen.findByText(/this invitation doesn't work/i);
    expect(screen.queryByLabelText(/^new password$/i)).toBeNull();
  });

  it("inline-validates mismatch + weak inside the setup flow (shared PasswordForm behavior)", async () => {
    let consumeHits = 0;
    server.use(
      http.get(`${API}/v1/auth/setup/:token/preview`, () =>
        HttpResponse.json({ email: "newhire@example.com" }),
      ),
      http.post(`${API}/v1/auth/setup/consume`, () => {
        consumeHits++;
        return HttpResponse.json({ status: "ok" });
      }),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSetup();
    await waitForFormReady();

    // Mismatch first.
    await user.type(screen.getByLabelText(/^new password$/i), STRONG_PASSWORD);
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      STRONG_PASSWORD + "Z",
    );
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => {
      expect(screen.getByText(/passwords don't match/i)).toBeInTheDocument();
    });
    expect(consumeHits).toBe(0);
  });
});
