/**
 * Dashboard integration test (FE-3 §B.1, §B.6).
 *
 * The `/v1/me/*` endpoints are LIVE: this page fires `/v1/me/competence`
 * (HeroStats), `/v1/me/assignments` (AssignmentsCard), and `/v1/attempts`
 * (RecentAttemptsCard + the hero day-streak). MSW resolves all three on every
 * dashboard render; the hero renders real derived values, not placeholders.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  setMockUser,
  resetMockAuthState,
  resetMockMeCompetence,
  resetMockMeAttempts,
} from "@/mocks/handlers";
import { AuthProvider } from "@/lib/auth/context";
import { setAccessToken, clearTokens } from "@/lib/auth/storage";
import type { UserResponse } from "@/lib/api/types";
import TesteeDashboardPage from "@/app/(authed)/(testee)/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const USER: UserResponse = {
  id: "00000000-0000-0000-0000-000000000099",
  email: "jordan@acumen.test",
  name: "Jordan New-Hire",
  role: "testee",
  status: "active",
  privacy_ack_at: "2026-05-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
};

function mountTree(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Suspense fallback={null}>{node}</Suspense>
      </AuthProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  setAccessToken("dashboard-test-token");
  setMockUser(USER);
});

afterEach(() => {
  cleanup();
  clearTokens();
  resetMockAuthState();
  resetMockMeCompetence();
  resetMockMeAttempts();
});

describe("Testee dashboard page", () => {
  it("greets the signed-in user by name", async () => {
    render(mountTree(<TesteeDashboardPage />));
    expect(
      await screen.findByRole("heading", { name: /welcome back, jordan new-hire\./i }),
    ).toBeInTheDocument();
  });

  it("renders AssignmentsCard + RecentAttemptsCard (no AdaptiveLoopCard / Today's Reading)", async () => {
    render(mountTree(<TesteeDashboardPage />));
    // Awaited barrier first (the page paints behind async auth), then the
    // negative queries — otherwise they would run pre-paint and pass vacuously.
    expect(await screen.findByTestId("assignments-card")).toBeInTheDocument();
    expect(screen.getByTestId("recent-attempts-card")).toBeInTheDocument();
    expect(screen.queryByTestId("adaptive-loop-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("todays-reading")).not.toBeInTheDocument();
  });

  it("renders RecentAttemptsCard with attempts from the wire (FE-7 flag-flip)", async () => {
    render(mountTree(<TesteeDashboardPage />));
    expect(await screen.findByTestId("recent-attempts-card")).toBeInTheDocument();
    expect(await screen.findAllByTestId("recent-attempts-row")).toHaveLength(5);
  });

  it("hero renders live competence values (no v1.x-pending placeholder)", async () => {
    render(mountTree(<TesteeDashboardPage />));
    // Default competence mock = 6 pills, 5 at working+ → "5/6"; overall mean is
    // a real 1dp value, never "—" or pending copy.
    expect(await screen.findByText("5/6")).toBeInTheDocument();
    const values = screen.getAllByTestId("stat-value").map((v) => v.textContent);
    expect(values).not.toContain("—");
    expect(values.some((v) => v && /^\d\.\d$/.test(v))).toBe(true); // overall, 1dp
    expect(screen.queryByText(/v1\.x|pending/i)).toBeNull();
  });

  it("falls back to email-local-part when user.name is empty", async () => {
    setMockUser({ ...USER, name: "" });
    render(mountTree(<TesteeDashboardPage />));
    expect(
      await screen.findByRole("heading", { name: /welcome back, jordan\./i }),
    ).toBeInTheDocument();
  });
});
