/**
 * Admin paths list integration tests (FE-8 §B.6 §6 Gherkin coverage).
 *
 * Mounts the `/admin/paths` page and exercises real MSW handlers for
 * GET/POST/DELETE `/v1/learning-paths`. Empty list, default fixture
 * list, delete confirmation flow, and route-push for Add/Edit
 * affordances are all covered.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import {
  getMockAdminPaths,
  resetMockAdminPaths,
  setMockAdminPaths,
} from "@/mocks/handlers";
import AdminPathsPage from "@/app/(authed)/(admin)/admin/paths/page";

const API = "http://localhost:8000";

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/admin/paths",
  useSearchParams: () => new URLSearchParams(),
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
  server.resetHandlers();
  resetMockAdminPaths();
});

afterEach(() => {
  cleanup();
});

describe("paths list — render", () => {
  it("renders all loaded paths in the table", async () => {
    render(mountTree(<AdminPathsPage />));
    await waitFor(() => expect(screen.getByTestId("paths-table")).toBeInTheDocument());
    expect(screen.getByText("Paint QA induction")).toBeInTheDocument();
    expect(screen.getByText("Marine coatings refresher")).toBeInTheDocument();
    expect(screen.getByText("Site safety primer")).toBeInTheDocument();
  });

  it("derives 'Pills' column from pill_ids.length (Finding #2)", async () => {
    render(mountTree(<AdminPathsPage />));
    await waitFor(() => expect(screen.getByTestId("paths-table")).toBeInTheDocument());
    const paintRow = screen.getByTestId(
      `paths-row-${getMockAdminPaths().find((p) => p.name === "Paint QA induction")!.id}`,
    );
    expect(paintRow).toHaveTextContent("2"); // pill_ids has 2 entries
    const safetyRow = screen.getByTestId(
      `paths-row-${getMockAdminPaths().find((p) => p.name === "Site safety primer")!.id}`,
    );
    expect(safetyRow).toHaveTextContent("1");
  });

  it("renders 'Assigned to' as em-dash placeholder (Finding #7 / §E.8)", async () => {
    render(mountTree(<AdminPathsPage />));
    await waitFor(() => expect(screen.getByTestId("paths-table")).toBeInTheDocument());
    // Each path row has a derived-count-pending cell.
    expect(screen.getAllByTestId("derived-count-pending").length).toBe(3);
  });

  it("shows empty state when no paths exist", async () => {
    setMockAdminPaths([]);
    render(mountTree(<AdminPathsPage />));
    await waitFor(() => expect(screen.getByTestId("paths-empty")).toBeInTheDocument());
    expect(screen.getByText(/No learning paths yet/i)).toBeInTheDocument();
  });

  it("shows skeleton during initial fetch", async () => {
    server.use(
      http.get(`${API}/v1/learning-paths`, async () => {
        await new Promise((r) => setTimeout(r, 50));
        return HttpResponse.json({ data: [], meta: { next_cursor: null } });
      }),
    );
    render(mountTree(<AdminPathsPage />));
    expect(screen.getByTestId("paths-loading")).toBeInTheDocument();
  });
});

describe("paths list — Add path CTA", () => {
  it("navigates to /admin/paths/new/edit on click (Gherkin §B.6 §6)", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminPathsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("paths-add-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("paths-add-button"));
    expect(mockPush).toHaveBeenCalledWith("/admin/paths/new/edit");
  });
});

describe("paths list — Edit row action", () => {
  it("navigates to /admin/paths/{id}/edit on row Edit click", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminPathsPage />));
    await waitFor(() =>
      expect(screen.getByText("Paint QA induction")).toBeInTheDocument(),
    );
    const target = getMockAdminPaths().find((p) => p.name === "Paint QA induction")!;
    await user.click(screen.getByTestId(`paths-edit-${target.id}`));
    expect(mockPush).toHaveBeenCalledWith(`/admin/paths/${target.id}/edit`);
  });
});

describe("paths list — Delete confirmation flow", () => {
  it("opens DeletePathConfirmModal on Delete click", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminPathsPage />));
    await waitFor(() =>
      expect(screen.getByText("Paint QA induction")).toBeInTheDocument(),
    );
    const target = getMockAdminPaths().find((p) => p.name === "Paint QA induction")!;
    await user.click(screen.getByTestId(`paths-delete-${target.id}`));
    await waitFor(() =>
      expect(screen.getByTestId("paths-delete-confirm")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/Bound assignments will lose their reference/i),
    ).toBeInTheDocument();
  });

  it("fires DELETE on confirm and removes the row", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminPathsPage />));
    await waitFor(() =>
      expect(screen.getByText("Paint QA induction")).toBeInTheDocument(),
    );
    const target = getMockAdminPaths().find((p) => p.name === "Paint QA induction")!;
    await user.click(screen.getByTestId(`paths-delete-${target.id}`));
    await user.click(screen.getByTestId("paths-delete-confirm"));

    await waitFor(() =>
      expect(screen.queryByText("Paint QA induction")).not.toBeInTheDocument(),
    );
    expect(getMockAdminPaths().some((p) => p.name === "Paint QA induction")).toBe(false);
  });

  it("Cancel closes modal without firing DELETE", async () => {
    const user = userEvent.setup();
    let deleteCalls = 0;
    server.use(
      http.delete(`${API}/v1/learning-paths/:path_id`, () => {
        deleteCalls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    render(mountTree(<AdminPathsPage />));
    await waitFor(() =>
      expect(screen.getByText("Paint QA induction")).toBeInTheDocument(),
    );
    const target = getMockAdminPaths().find((p) => p.name === "Paint QA induction")!;
    await user.click(screen.getByTestId(`paths-delete-${target.id}`));
    await waitFor(() =>
      expect(screen.getByTestId("paths-delete-confirm")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    await waitFor(() =>
      expect(screen.queryByTestId("paths-delete-confirm")).not.toBeInTheDocument(),
    );
    expect(deleteCalls).toBe(0);
  });
});

describe("paths list — invalidation discipline (§C.1)", () => {
  it("delete refetches the paths list", async () => {
    const user = userEvent.setup();
    let listCalls = 0;
    server.use(
      http.get(`${API}/v1/learning-paths`, () => {
        listCalls += 1;
        return HttpResponse.json({
          data: getMockAdminPaths(),
          meta: { next_cursor: null },
        });
      }),
    );
    render(mountTree(<AdminPathsPage />));
    await waitFor(() => expect(screen.getByTestId("paths-table")).toBeInTheDocument());
    const initial = listCalls;
    const target = getMockAdminPaths()[0]!;
    await user.click(screen.getByTestId(`paths-delete-${target.id}`));
    await user.click(screen.getByTestId("paths-delete-confirm"));
    await waitFor(() => expect(listCalls).toBeGreaterThan(initial));
  });
});
