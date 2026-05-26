/**
 * Shell round-trip (FE-2 §D.3). Picks up where the FE-1 auth round-trip
 * left off: with an authed + ack'd user, mount the (testee) shell
 * layout + page, verify:
 *
 *   - Rail renders with the testee nav and the Dashboard item active.
 *   - TopBar renders with the user's initial in the avatar and the
 *     role-appropriate search placeholder.
 *   - PageHeader's "Welcome, {name}" + "no assignments yet" copy shows.
 *   - Clicking the avatar opens the dropdown.
 *   - Clicking Sign out fires logout() and routes to /login.
 *
 * Companion: same flow for an admin landing on /ops in the (admin) shell.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { resetMockAuthState, setMockUser } from "@/mocks/handlers";
import { clearTokens, setAccessToken } from "@/lib/auth/storage";
import { AuthProvider } from "@/lib/auth/context";
import type { UserResponse } from "@/lib/api/types";

const mockReplace = vi.fn();
const mockPush = vi.fn();
let mockPathname = "/";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
}));

// Importing the layout + page modules AFTER vi.mock so they pick up
// the mocked next/navigation.
import TesteeLayout from "@/app/(authed)/(testee)/layout";
import TesteeDashboardPage from "@/app/(authed)/(testee)/page";
import AdminLayout from "@/app/(authed)/(admin)/layout";
import OpsPage from "@/app/(authed)/(admin)/ops/page";

const TESTEE_USER: UserResponse = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "asha@acumen.test",
  name: "Asha Patel",
  role: "testee",
  status: "active",
  privacy_ack_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
};

const ADMIN_USER: UserResponse = {
  ...TESTEE_USER,
  id: "22222222-2222-2222-2222-222222222222",
  email: "sam@acumen.test",
  name: "Sam Lee",
  role: "admin",
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

async function seedAuthed(user: UserResponse) {
  setAccessToken("rt-access");
  setMockUser(user);
}

describe("FE-2 shell round-trip", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPush.mockClear();
    mockPathname = "/";
    clearTokens();
    resetMockAuthState();
  });

  afterEach(() => {
    cleanup();
    clearTokens();
    resetMockAuthState();
  });

  it("testee lands on / inside the (testee) shell and signs out via the avatar menu", async () => {
    await seedAuthed(TESTEE_USER);
    mockPathname = "/";

    const user = userEvent.setup();
    render(
      mountTree(
        <TesteeLayout>
          <TesteeDashboardPage />
        </TesteeLayout>,
      ),
    );

    // Wait for the (testee) Gate to authenticate + render the shell.
    // Multiple "Acumen" matches (rail brand + topbar crumb segment);
    // wait on the role tag in the rail brand block instead — unique
    // per layout variant.
    await screen.findByText(/Testee|Administrator/);

    // Rail renders with the testee nav + Dashboard active.
    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboardLink.getAttribute("data-active")).toBe("true");
    expect(screen.getByText("Discover")).toBeInTheDocument();
    expect(screen.getByText("Testee")).toBeInTheDocument();
    expect(screen.queryByText("Operations")).not.toBeInTheDocument();

    // TopBar renders with the user's initial + testee search placeholder.
    const avatar = screen.getByRole("button", { name: /account menu/i });
    expect(avatar).toHaveTextContent("A");
    expect(screen.getByPlaceholderText("Search pills…")).toBeInTheDocument();

    // PageHeader renders the empty-state copy.
    expect(
      screen.getByRole("heading", { name: /welcome, asha patel/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/you have no assignments yet/i)).toBeInTheDocument();

    // Avatar dropdown opens with a single Sign out item.
    await user.click(avatar);
    await screen.findByTestId("avatar-signout");
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);

    // Sign out → router.push("/login").
    await user.click(screen.getByTestId("avatar-signout"));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/login"));
  });

  it("admin lands on /ops inside the (admin) shell with the admin search placeholder", async () => {
    await seedAuthed(ADMIN_USER);
    mockPathname = "/ops";

    render(
      mountTree(
        <AdminLayout>
          <OpsPage />
        </AdminLayout>,
      ),
    );

    // Multiple "Acumen" matches (rail brand + topbar crumb segment);
    // wait on the role tag in the rail brand block instead — unique
    // per layout variant.
    await screen.findByText(/Testee|Administrator/);

    // Admin rail items present, testee items absent.
    expect(screen.getByText("Grade Review")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.queryByText("Discover")).not.toBeInTheDocument();

    // Ops item active.
    const opsLink = screen.getByRole("link", { name: /operations/i });
    expect(opsLink.getAttribute("data-active")).toBe("true");

    // Admin search placeholder.
    expect(
      screen.getByPlaceholderText("Search pills, testees, attempts…"),
    ).toBeInTheDocument();

    // PageHeader copy.
    expect(screen.getByRole("heading", { name: /operations/i })).toBeInTheDocument();
  });

  it("testee hitting an admin route is bounced to /403 by the role gate", async () => {
    await seedAuthed(TESTEE_USER);
    mockPathname = "/ops";

    render(
      mountTree(
        <AdminLayout>
          <OpsPage />
        </AdminLayout>,
      ),
    );

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/403?from=%2Fops&required=admin"),
    );
  });
});
