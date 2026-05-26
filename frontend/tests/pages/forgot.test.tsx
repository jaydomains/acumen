/**
 * /forgot integration coverage (FE-1 §B.2).
 *
 * Four tests map to the four §B.2.6 Gherkin scenarios.
 *
 * The page lives under (auth)/ so it inherits the guest Gate. Tests
 * render it directly with AuthProvider + Gate so the same posture
 * surface applies as in login.test.tsx.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Suspense } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { config } from "@/lib/config";
import { server } from "@/mocks/node";
import { AuthProvider } from "@/lib/auth/context";
import { Gate } from "@/lib/auth/guards";
import ForgotPage from "@/app/(auth)/forgot/page";

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
  usePathname: () => "/forgot",
  useSearchParams: () => new URLSearchParams(),
}));

const API = config.apiBaseUrl;

const renderForgot = () =>
  render(
    <AuthProvider>
      <Suspense fallback={null}>
        <Gate posture="guest">
          <ForgotPage />
        </Gate>
      </Suspense>
    </AuthProvider>,
  );

const waitForFormReady = async () => {
  await screen.findByLabelText(/email/i);
};

describe("/forgot", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPush.mockClear();
  });

  it("swaps to the 'Check your inbox' confirmation and echoes the entered email on 2xx", async () => {
    const user = userEvent.setup();
    renderForgot();
    await waitForFormReady();

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await screen.findByText(/check your inbox/i);
    expect(screen.getByText(/user@example\.com/i)).toBeInTheDocument();
    // The form input is gone from the success view.
    expect(screen.queryByLabelText(/email/i)).toBeNull();
  });

  it("renders the danger notice and stays resubmittable on 5xx", async () => {
    server.use(
      http.post(`${API}/v1/auth/password-reset/request`, () =>
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
    renderForgot();
    await waitForFormReady();

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    const notice = await screen.findByRole("alert");
    expect(notice.textContent).toMatch(/couldn't send the link/i);
    // Form is still mounted and the button is back to idle.
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send reset link/i })).not.toBeDisabled();
  });

  it("surfaces zod validation and fires no network call for an invalid email", async () => {
    let hits = 0;
    server.use(
      http.post(`${API}/v1/auth/password-reset/request`, () => {
        hits++;
        return HttpResponse.json({ status: "ok" });
      }),
    );
    const user = userEvent.setup();
    renderForgot();
    await waitForFormReady();

    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument();
    });
    expect(hits).toBe(0);
  });

  it("renders a Back-to-sign-in link pointing at /login", async () => {
    renderForgot();
    await waitForFormReady();

    const link = screen.getByRole("link", { name: /back to sign in/i });
    expect(link).toHaveAttribute("href", "/login");
  });
});
