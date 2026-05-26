/**
 * /reset/[token] integration coverage (FE-1 §B.3, post-amendment).
 *
 * Four tests mirror the four §B.3.6 Gherkin scenarios (success,
 * mismatch, weak, token-invalid — the two token states collapsed
 * into one per the prep commit, because the backend uses a single
 * `invalid_token` code).
 *
 * The page lives under (auth)/ so it inherits the guest Gate. The
 * Next.js route props pass `params` as a Promise; tests construct a
 * fake Promise to feed React 19's `use()` API.
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
import ResetPasswordPage from "@/app/(auth)/reset/[token]/page";

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
  usePathname: () => "/reset/abc",
  useSearchParams: () => new URLSearchParams(),
}));

const API = config.apiBaseUrl;
const TOKEN = "valid-token-123";
const STRONG_PASSWORD = "Aa1!aaaaaaaaa";

const renderReset = () =>
  render(
    <AuthProvider>
      <Suspense fallback={null}>
        <Gate posture="guest">
          <ResetPasswordPage params={Promise.resolve({ token: TOKEN })} />
        </Gate>
      </Suspense>
    </AuthProvider>,
  );

const waitForFormReady = async () => {
  await screen.findByLabelText(/^new password$/i);
};

describe("/reset/[token]", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPush.mockClear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("shows success notice and pushes to /login after the redirect delay", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderReset();
    await waitForFormReady();

    await user.type(screen.getByLabelText(/^new password$/i), STRONG_PASSWORD);
    await user.type(screen.getByLabelText(/confirm new password/i), STRONG_PASSWORD);
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await screen.findByText(/password updated/i);
    vi.advanceTimersByTime(1600);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
  });

  it("shows an inline error under confirm field on mismatch and fires no network call", async () => {
    let hits = 0;
    server.use(
      http.post(`${API}/v1/auth/password-reset/consume`, () => {
        hits++;
        return HttpResponse.json({ status: "ok" });
      }),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderReset();
    await waitForFormReady();

    await user.type(screen.getByLabelText(/^new password$/i), STRONG_PASSWORD);
    await user.type(
      screen.getByLabelText(/confirm new password/i),
      STRONG_PASSWORD + "X",
    );
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords don't match/i)).toBeInTheDocument();
    });
    expect(hits).toBe(0);
  });

  it("renders the 'Almost there' warn notice and the failing rule un-checked on weak password", async () => {
    let hits = 0;
    server.use(
      http.post(`${API}/v1/auth/password-reset/consume`, () => {
        hits++;
        return HttpResponse.json({ status: "ok" });
      }),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderReset();
    await waitForFormReady();

    // Missing symbol — passes length / lower / upper / number.
    const weak = "Aaaaaaaaaaa1";
    await user.type(screen.getByLabelText(/^new password$/i), weak);
    await user.type(screen.getByLabelText(/confirm new password/i), weak);
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await waitFor(() => {
      expect(screen.getByText(/almost there/i)).toBeInTheDocument();
    });
    // The "Needs a symbol" rule row stays in the un-passed state.
    const symbolRule = document.querySelector('[data-rule="symbol"]');
    expect(symbolRule).not.toBeNull();
    expect(symbolRule).toHaveAttribute("data-passes", "false");
    expect(hits).toBe(0);
  });

  it("replaces the card with the TokenErrorCard (reset flow) on 400 invalid_token", async () => {
    server.use(
      http.post(`${API}/v1/auth/password-reset/consume`, () =>
        HttpResponse.json(
          {
            error: {
              code: "invalid_token",
              message: "Reset link is invalid or has expired.",
              detail: null,
            },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderReset();
    await waitForFormReady();

    await user.type(screen.getByLabelText(/^new password$/i), STRONG_PASSWORD);
    await user.type(screen.getByLabelText(/confirm new password/i), STRONG_PASSWORD);
    await user.click(screen.getByRole("button", { name: /update password/i }));

    await screen.findByText(/this link doesn't work/i);
    // Form is gone, CTA links to /forgot.
    expect(screen.queryByLabelText(/^new password$/i)).toBeNull();
    expect(screen.getByRole("link", { name: /request a new link/i })).toHaveAttribute(
      "href",
      "/forgot",
    );
  });
});
