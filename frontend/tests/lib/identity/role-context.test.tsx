/**
 * Read-side role-seam integration proof (pre-deploy audit A3-L1 / X2-#3).
 *
 * Exercises the real `AuthProvider` + `/v1/auth/me` + the admin route
 * `Gate`: a user whose wire role is the canonical `"administrator"` must
 * narrow to the UI `"admin"` and render an admin-gated surface, NOT get
 * bounced to `/403`. Before the role seam this was the total-admin-lockout
 * bug — `narrowRole("administrator")` returned `null`, so the admin Gate
 * denied every real administrator.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/mocks/node";
import { setMockUser, resetMockAuthState } from "@/mocks/handlers";
import { AuthProvider } from "@/lib/auth/context";
import { Gate } from "@/lib/auth/guards";
import type { components } from "@/lib/api/types";

type UserResponse = components["schemas"]["UserResponse"];

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/ops",
  useSearchParams: () => new URLSearchParams(),
}));

// Wire role is the canonical backend enum (`app/permissions.py:65`).
const wireAdmin: UserResponse = {
  id: "aaaa2222-aaaa-aaaa-aaaa-000000000001",
  email: "jay@sitemesh.co",
  name: "Jay Phillips",
  role: "administrator",
  status: "active",
  privacy_ack_at: "2026-03-15T00:00:00Z",
  created_at: "2026-03-15T00:00:00Z",
};

function tree(node: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Suspense fallback={null}>{node}</Suspense>
      </AuthProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockReplace.mockClear();
  server.resetHandlers();
  resetMockAuthState();
});

afterEach(() => {
  resetMockAuthState();
});

describe("wire role 'administrator' → admin route guard", () => {
  it("renders an admin-gated surface and never bounces to /403", async () => {
    setMockUser(wireAdmin);

    render(
      tree(
        <Gate posture="authed" role="admin">
          <div data-testid="admin-surface">Ops</div>
        </Gate>,
      ),
    );

    await waitFor(() => expect(screen.getByTestId("admin-surface")).toBeInTheDocument());
    // The narrowing succeeded → no redirect to the 403 page fired.
    expect(mockReplace).not.toHaveBeenCalledWith(expect.stringContaining("/403"));
  });
});
