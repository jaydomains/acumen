/**
 * Admin groups list integration tests (FE-8 admin-identity §B.2 §6
 * Gherkin coverage). Mounts the `/admin/groups` page and exercises
 * real MSW handlers for GET/POST `/v1/groups`.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import {
  getMockAdminGroups,
  resetMockAdminGroups,
  setMockAdminGroups,
} from "@/mocks/handlers";
import AdminGroupsPage from "@/app/(authed)/(admin)/admin/groups/page";

const API = "http://localhost:8000";

const mockPush = vi.fn();
const mockReplace = vi.fn();
let mockSearch = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/admin/groups",
  useSearchParams: () => mockSearch,
}));

function mountTree(node: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <Suspense fallback={null}>{node}</Suspense>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  mockSearch = new URLSearchParams();
  server.resetHandlers();
  resetMockAdminGroups();
});

afterEach(() => {
  cleanup();
});

describe("groups list — render + system/custom distinction", () => {
  it("renders all seed groups", async () => {
    render(mountTree(<AdminGroupsPage />));
    await waitFor(() => expect(screen.getByTestId("groups-table")).toBeInTheDocument());
    expect(screen.getByText("All Users")).toBeInTheDocument();
    expect(screen.getByText("All Testees")).toBeInTheDocument();
    expect(screen.getByText("Q3 2026 induction")).toBeInTheDocument();
    expect(screen.getByText("Seniors")).toBeInTheDocument();
  });

  it("renders 'System' badge for system groups + system banner", async () => {
    render(mountTree(<AdminGroupsPage />));
    await waitFor(() => expect(screen.getByTestId("groups-table")).toBeInTheDocument());
    const allUsers = getMockAdminGroups().find((g) => g.name === "All Users")!;
    expect(screen.getByTestId(`groups-system-badge-${allUsers.id}`)).toBeInTheDocument();
    expect(screen.getByTestId("groups-system-banner")).toBeInTheDocument();
  });

  it("disables Edit + Members actions on system groups (AC-D15)", async () => {
    render(mountTree(<AdminGroupsPage />));
    await waitFor(() => expect(screen.getByTestId("groups-table")).toBeInTheDocument());
    const allUsers = getMockAdminGroups().find((g) => g.name === "All Users")!;
    expect(screen.getByTestId(`groups-edit-${allUsers.id}`)).toBeDisabled();
    expect(screen.getByTestId(`groups-members-${allUsers.id}`)).toBeDisabled();
  });

  it("Members column derives from member_ids.length (drift Finding #4)", async () => {
    render(mountTree(<AdminGroupsPage />));
    await waitFor(() => expect(screen.getByTestId("groups-table")).toBeInTheDocument());
    const allUsers = getMockAdminGroups().find((g) => g.name === "All Users")!;
    expect(screen.getByTestId(`groups-member-count-${allUsers.id}`)).toHaveTextContent(
      String(allUsers.member_ids.length),
    );
  });

  it("renders empty state when no groups", async () => {
    setMockAdminGroups([]);
    render(mountTree(<AdminGroupsPage />));
    await waitFor(() => expect(screen.getByTestId("groups-empty")).toBeInTheDocument());
  });
});

describe("groups list — client-side filter (drift Finding #3)", () => {
  it("filters by ?q= client-side", async () => {
    mockSearch = new URLSearchParams("q=Q3");
    render(mountTree(<AdminGroupsPage />));
    await waitFor(() =>
      expect(screen.getByText("Q3 2026 induction")).toBeInTheDocument(),
    );
    expect(screen.queryByText("All Users")).not.toBeInTheDocument();
  });

  it("writes ?q= on FilterBar type", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminGroupsPage />));
    await waitFor(() => expect(screen.getByTestId("groups-table")).toBeInTheDocument());
    await user.type(screen.getByTestId("filter-bar-search"), "ind");
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/admin/groups?q=ind"));
  });
});

describe("groups list — Add group flow", () => {
  it("creates a group via POST + closes modal", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminGroupsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("groups-add-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("groups-add-button"));
    await waitFor(() => expect(screen.getByTestId("group-add-form")).toBeInTheDocument());

    await user.type(screen.getByTestId("group-add-name"), "Welding crew");
    await user.click(screen.getByTestId("group-add-submit"));

    await waitFor(() =>
      expect(screen.queryByTestId("group-add-form")).not.toBeInTheDocument(),
    );
    expect(getMockAdminGroups().some((g) => g.name === "Welding crew")).toBe(true);
  });

  it("zod blocks empty name", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminGroupsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("groups-add-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("groups-add-button"));
    await user.click(screen.getByTestId("group-add-submit"));

    await waitFor(() =>
      expect(screen.getByText("Group name is required.")).toBeInTheDocument(),
    );
  });

  it("sends description: null when empty (drift Finding #11)", async () => {
    const user = userEvent.setup();
    let createBody: { name?: string; description?: string | null } | null = null;
    server.use(
      http.post(`${API}/v1/groups`, async ({ request }) => {
        createBody = (await request.json()) as {
          name: string;
          description: string | null;
        };
        return HttpResponse.json(
          {
            id: "bbbb3333-bbbb-bbbb-bbbb-000000000999",
            name: createBody.name!,
            description: createBody.description ?? null,
            is_system: false,
            member_ids: [],
            created_at: "2026-04-01T00:00:00Z",
            updated_at: "2026-04-01T00:00:00Z",
          },
          { status: 201 },
        );
      }),
    );
    render(mountTree(<AdminGroupsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("groups-add-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("groups-add-button"));
    await user.type(screen.getByTestId("group-add-name"), "Bare group");
    await user.click(screen.getByTestId("group-add-submit"));

    await waitFor(() => expect(createBody).not.toBeNull());
    expect(createBody!.description).toBeNull();
  });
});

describe("groups list — navigation to detail page", () => {
  it("Edit click on custom group pushes to /admin/groups/{id}", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminGroupsPage />));
    await waitFor(() =>
      expect(screen.getByText("Q3 2026 induction")).toBeInTheDocument(),
    );
    const target = getMockAdminGroups().find((g) => g.name === "Q3 2026 induction")!;
    await user.click(screen.getByTestId(`groups-edit-${target.id}`));
    expect(mockPush).toHaveBeenCalledWith(`/admin/groups/${target.id}`);
  });
});
