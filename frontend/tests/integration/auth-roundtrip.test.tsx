/**
 * Auth round-trip integration test (FE-1 §D.3 / §C.5).
 *
 * Walks an admin-invited user through every FE-1 surface in sequence:
 *
 *   1. /setup/<token>  — preview ok, submit strong password, redirect
 *                        to /login (setup does NOT auto-login per the
 *                        API contract, §B.4.5)
 *   2. /login          — submit credentials, MSW flips the in-memory
 *                        user to un-ack'd authed, Gate sees posture-3
 *                        and replaces to /privacy
 *   3. /privacy        — click "I acknowledge", ack handler patches
 *                        mockSignedInAs.privacy_ack_at, page pushes "/"
 *   4. /               — (authed) layout's Gate allows the dashboard,
 *                        "Welcome, {name}" view renders with the
 *                        user's display name visible
 *
 * The four pages are mounted in sequence (with cleanup between).
 * State that has to survive page transitions lives in MSW's module-
 * level `mockSignedInAs` and the auth storage's in-memory access
 * token, both of which persist across React renders within a single
 * test. Each page render creates a fresh AuthProvider that re-pulls
 * /v1/auth/me, so the post-login un-ack'd state and the post-ack
 * ack'd state are read from MSW correctly across the chain.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Suspense } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/mocks/node";
import { resetMockAuthState, setMockUser } from "@/mocks/handlers";
import { clearTokens } from "@/lib/auth/storage";
import { AuthProvider } from "@/lib/auth/context";
import { Gate } from "@/lib/auth/guards";
import SetupAccountPage from "@/app/(auth)/setup/[token]/page";
import LoginPage from "@/app/(auth)/login/page";
import PrivacyPage from "@/app/privacy/page";
// FE-2 relocated the dashboard from (authed)/page.tsx to
// (authed)/(testee)/page.tsx (URL stays "/" — both groups are
// parenthesised). The page body is now an empty PageHeader; the
// email/role/privacy-ack inline display that FE-1 used as a
// placeholder is no longer rendered.
import HomePage from "@/app/(authed)/(testee)/page";
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
  // Each step's "current path" — passed via vi.mock + module-scoped
  // variable; the live useAuthRedirect reads it for posture="authed"'s
  // ?next= encoding. Default is "/" which is fine for every step.
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const TOKEN = "round-trip-token";
const EMAIL = "new.hire@acumen.test";
const NAME = "Jordan New-Hire";
const STRONG_PASSWORD = "Aa1!aaaaaaaaa";

const stubUser: UserResponse = {
  id: "00000000-0000-0000-0000-00000000ABCD",
  email: EMAIL,
  name: NAME,
  role: "testee",
  status: "active",
  privacy_ack_at: null,
  created_at: "2026-01-01T00:00:00Z",
};

const makeTree = (children: React.ReactNode, postureWrap?: "guest" | "privacy") => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapped = postureWrap ? (
    <Suspense fallback={null}>
      <Gate posture={postureWrap}>{children}</Gate>
    </Suspense>
  ) : (
    <Suspense fallback={null}>{children}</Suspense>
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{wrapped}</AuthProvider>
    </QueryClientProvider>
  );
};

describe("FE-1 auth round-trip", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPush.mockClear();
    resetMockAuthState();
    clearTokens();
  });

  afterEach(() => {
    clearTokens();
    resetMockAuthState();
  });

  it("setup → login → privacy → / chain lands an admin-invited user on the dashboard", async () => {
    const user = userEvent.setup();

    //
    // Step 1: /setup/<token>
    //
    // The default setup-preview handler returns a fixture email; we
    // don't need to override it because the round-trip's narrative
    // only cares that *some* email shows up readonly and that the
    // consume call succeeds.

    render(
      makeTree(<SetupAccountPage params={Promise.resolve({ token: TOKEN })} />, "guest"),
    );

    // Email shows up in the readOnly field from the preview default.
    const emailInput = (await screen.findByLabelText(/^email$/i)) as HTMLInputElement;
    expect(emailInput).toHaveAttribute("readonly");

    await user.type(screen.getByLabelText(/^new password$/i), STRONG_PASSWORD);
    await user.type(screen.getByLabelText(/confirm new password/i), STRONG_PASSWORD);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    // PasswordForm holds the success notice for 1.5s before calling
    // onSuccess. waitFor handles the delay without needing fake timers.
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"), {
      timeout: 3000,
    });
    cleanup();
    mockPush.mockClear();
    mockReplace.mockClear();

    //
    // Step 2: /login
    //
    // Patch the login handler so the post-login /me responses across
    // steps 2-4 carry the test-narrative name + email (the default
    // handler echoes the email from the submission but uses a
    // generic name). Persists the un-ack'd stubUser into the MSW
    // module's mockSignedInAs.
    const { http, HttpResponse } = await import("msw");
    server.use(
      http.post(`http://localhost:8000/v1/auth/login`, () => {
        setMockUser({ ...stubUser, privacy_ack_at: null });
        return HttpResponse.json({
          access_token: "rt-access",
          refresh_token: "rt-refresh",
          token_type: "bearer",
        });
      }),
    );

    render(makeTree(<LoginPage />, "guest"));

    // Wait for the form to render (AuthProvider needs to settle on
    // unauthenticated before Gate releases the form).
    await screen.findByLabelText(/email/i);

    await user.type(screen.getByLabelText(/email/i), EMAIL);
    await user.type(screen.getByLabelText(/password/i), STRONG_PASSWORD);
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // Post-login: tokens persisted, refreshMe → /me reads the un-acked
    // user, Gate posture-guest sees status=authenticated + privacy_ack_at
    // null → router.replace('/privacy').
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/privacy"));
    cleanup();
    mockPush.mockClear();
    mockReplace.mockClear();

    //
    // Step 3: /privacy
    //
    // mockSignedInAs is set from step 2; tokens persist in storage.
    // AuthProvider re-mounts and resolves to authenticated un-acked.
    render(makeTree(<PrivacyPage />));

    const ackBtn = await screen.findByRole("button", { name: /i acknowledge/i });
    await user.click(ackBtn);

    // Ack handler updates mockSignedInAs.privacy_ack_at + page pushes "/".
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/"));
    cleanup();
    mockPush.mockClear();
    mockReplace.mockClear();

    //
    // Step 4: /
    //
    // mockSignedInAs is now ack'd; tokens persist. HomePage's
    // (authed) layout Gate allows the page; Welcome view renders.
    render(makeTree(<HomePage />));

    // Wait for the AuthProvider to settle so the welcome heading reads
    // the resolved user name rather than the loading-state fallback.
    // FE-2's dashboard is an empty PageHeader; the body only shows
    // "Welcome, {name}" + the empty-state subtitle. Email/role meta
    // moves to FE-3's real dashboard.
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        new RegExp(NAME, "i"),
      );
    });
    expect(screen.getByText(/you have no assignments yet/i)).toBeInTheDocument();
  });
});
