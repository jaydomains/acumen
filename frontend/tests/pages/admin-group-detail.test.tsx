/**
 * Admin group detail integration tests (FE-8 admin-identity §B.3 §6
 * Gherkin coverage). Mounts `/admin/groups/[groupId]` and exercises
 * MSW group GET/PATCH/add-member/remove-member, plus the client-side
 * member-list derivation from `member_ids` + cached users directory
 * (drift Finding #1).
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
  getMockAdminUsers,
  resetMockAdminGroups,
  resetMockAdminUsers,
} from "@/mocks/handlers";
import AdminGroupDetailPage from "@/app/(authed)/(admin)/admin/groups/[groupId]/page";

const API = "http://localhost:8000";

const mockPush = vi.fn();
let mockParams: { groupId: string } = { groupId: "" };

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/admin/groups",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => mockParams,
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
  server.resetHandlers();
  resetMockAdminGroups();
  resetMockAdminUsers();
  // Default to the custom Q3 group, which has 1 member.
  const q3 = getMockAdminGroups().find((g) => g.name === "Q3 2026 induction")!;
  mockParams = { groupId: q3.id };
});

afterEach(() => {
  cleanup();
});

describe("group detail — render", () => {
  it("renders group header + derived stats + member rows", async () => {
    render(mountTree(<AdminGroupDetailPage />));
    await waitFor(() =>
      expect(screen.getByText("Q3 2026 induction")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("group-stats")).toBeInTheDocument();
    // 1 member from the fixture (Lerato).
    await waitFor(() => expect(screen.getByTestId("members-table")).toBeInTheDocument());
    expect(screen.getByText("Lerato Dlamini")).toBeInTheDocument();
  });

  it("renders 'group not found' when GET 404s", async () => {
    server.use(
      http.get(`${API}/v1/groups/:group_id`, () =>
        HttpResponse.json(
          { error: { code: "not_found", message: "Group not found.", detail: null } },
          { status: 404 },
        ),
      ),
    );
    render(mountTree(<AdminGroupDetailPage />));
    await waitFor(() =>
      expect(screen.getByTestId("group-detail-not-found")).toBeInTheDocument(),
    );
  });

  it("disables Edit + Add-member CTAs on system groups (AC-D15)", async () => {
    const allUsers = getMockAdminGroups().find((g) => g.name === "All Users")!;
    mockParams = { groupId: allUsers.id };
    render(mountTree(<AdminGroupDetailPage />));
    await waitFor(() => expect(screen.getByText("All Users")).toBeInTheDocument());
    expect(screen.getByTestId("group-edit-button")).toBeDisabled();
    expect(screen.getByTestId("group-add-member-button")).toBeDisabled();
  });
});

describe("group detail — edit Sheet", () => {
  it("PATCH only changed fields (value-diff per drift Finding #9)", async () => {
    const user = userEvent.setup();
    let patchBody: Record<string, unknown> | null = null;
    const q3 = getMockAdminGroups().find((g) => g.name === "Q3 2026 induction")!;
    server.use(
      http.patch(`${API}/v1/groups/:group_id`, async ({ request }) => {
        patchBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...q3, ...patchBody });
      }),
    );
    render(mountTree(<AdminGroupDetailPage />));
    await waitFor(() =>
      expect(screen.getByText("Q3 2026 induction")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("group-edit-button"));
    await waitFor(() =>
      expect(screen.getByTestId("group-edit-form")).toBeInTheDocument(),
    );
    const nameInput = screen.getByTestId("group-edit-name");
    await user.clear(nameInput);
    await user.type(nameInput, "Q3 2026 induction (renamed)");
    await user.click(screen.getByTestId("group-edit-submit"));

    await waitFor(() => expect(patchBody).not.toBeNull());
    expect(patchBody!.name).toBe("Q3 2026 induction (renamed)");
    expect("description" in patchBody!).toBe(false);
  });
});

describe("group detail — add member flow (drift Finding #2 fan-out)", () => {
  it("fans out N parallel POSTs and updates the member list", async () => {
    const user = userEvent.setup();
    const addCalls: Array<{ groupId: string; user_id: string }> = [];
    server.use(
      http.post(`${API}/v1/groups/:group_id/members`, async ({ request, params }) => {
        const body = (await request.json()) as { user_id: string };
        addCalls.push({
          groupId: String(params.group_id),
          user_id: body.user_id,
        });
        // Mutate seed state so the next group GET reflects the addition.
        const target = getMockAdminGroups().find(
          (g) => g.id === String(params.group_id),
        )!;
        target.member_ids = [...target.member_ids, body.user_id];
        return HttpResponse.json(target, { status: 201 });
      }),
    );
    render(mountTree(<AdminGroupDetailPage />));
    await waitFor(() =>
      expect(screen.getByTestId("group-add-member-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("group-add-member-button"));
    await waitFor(() => expect(screen.getByTestId("picker-list")).toBeInTheDocument());

    // Pick 2 users (Jay + Kabelo — Lerato is already a member).
    const jay = getMockAdminUsers().find((u) => u.email === "jay@sitemesh.co")!;
    const kabelo = getMockAdminUsers().find((u) => u.email === "kabelo@sitemesh.co")!;
    await user.click(screen.getByTestId(`picker-row-${jay.id}`));
    await user.click(screen.getByTestId(`picker-row-${kabelo.id}`));
    await user.click(screen.getByTestId("picker-add"));

    await waitFor(() => expect(addCalls.length).toBe(2));
    const ids = new Set(addCalls.map((c) => c.user_id));
    expect(ids.has(jay.id)).toBe(true);
    expect(ids.has(kabelo.id)).toBe(true);
  });

  it("filters out already-existing members from the picker", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminGroupDetailPage />));
    await waitFor(() =>
      expect(screen.getByTestId("group-add-member-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("group-add-member-button"));
    await waitFor(() => expect(screen.getByTestId("picker-list")).toBeInTheDocument());

    // Lerato is already a member → not in the picker.
    const lerato = getMockAdminUsers().find((u) => u.email === "lerato@sitemesh.co")!;
    expect(screen.queryByTestId(`picker-row-${lerato.id}`)).not.toBeInTheDocument();
  });
});

describe("group detail — remove member flow (drift Finding #7)", () => {
  it("opens Modal confirm + DELETEs on confirm", async () => {
    const user = userEvent.setup();
    let deleteCalls = 0;
    server.use(
      http.delete(`${API}/v1/groups/:group_id/members/:user_id`, ({ params }) => {
        deleteCalls += 1;
        const target = getMockAdminGroups().find(
          (g) => g.id === String(params.group_id),
        )!;
        target.member_ids = target.member_ids.filter(
          (id) => id !== String(params.user_id),
        );
        return new HttpResponse(null, { status: 204 });
      }),
    );
    render(mountTree(<AdminGroupDetailPage />));
    await waitFor(() => expect(screen.getByText("Lerato Dlamini")).toBeInTheDocument());

    const lerato = getMockAdminUsers().find((u) => u.email === "lerato@sitemesh.co")!;
    await user.click(screen.getByTestId(`members-remove-${lerato.id}`));
    await waitFor(() =>
      expect(screen.getByTestId("members-remove-confirm")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("members-remove-confirm"));

    await waitFor(() => expect(deleteCalls).toBe(1));
    await waitFor(() =>
      expect(screen.queryByText("Lerato Dlamini")).not.toBeInTheDocument(),
    );
  });
});

describe("group detail — client-side member filter", () => {
  it("filters members via the local search input", async () => {
    // Boost the Q3 group with another member so filtering is visible.
    const q3 = getMockAdminGroups().find((g) => g.name === "Q3 2026 induction")!;
    const jay = getMockAdminUsers().find((u) => u.email === "jay@sitemesh.co")!;
    q3.member_ids = [...q3.member_ids, jay.id];

    const user = userEvent.setup();
    render(mountTree(<AdminGroupDetailPage />));
    await waitFor(() => expect(screen.getByText("Lerato Dlamini")).toBeInTheDocument());
    expect(screen.getByText("Jay Phillips")).toBeInTheDocument();

    await user.type(screen.getByTestId("member-filter-search"), "lerato");
    await waitFor(() =>
      expect(screen.queryByText("Jay Phillips")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Lerato Dlamini")).toBeInTheDocument();
  });
});
