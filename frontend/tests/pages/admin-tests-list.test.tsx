/**
 * Admin tests list integration tests (FE-8 admin-tests §B.1 §6 Gherkin).
 * Mounts `/admin/tests` and exercises MSW GET/DELETE `/v1/tests` plus
 * the client-side mode + status filters, stat-card derivation, and
 * pill-name join.
 */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import {
  getMockAdminTests,
  resetMockAdminPills,
  resetMockAdminSubjects,
  resetMockAdminTests,
  setMockAdminTests,
} from "@/mocks/handlers";
import AdminTestsPage from "@/app/(authed)/(admin)/admin/tests/page";

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
  usePathname: () => "/admin/tests",
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
  resetMockAdminTests();
  resetMockAdminPills();
  resetMockAdminSubjects();
});

afterEach(() => {
  cleanup();
});

describe("tests list — render + stats + display-status", () => {
  it("renders all seed tests", async () => {
    render(mountTree(<AdminTestsPage />));
    await waitFor(() => expect(screen.getByTestId("tests-table")).toBeInTheDocument());
    expect(screen.getByText("Antifouling — focus")).toBeInTheDocument();
    expect(screen.getByText("Reference Panels D5")).toBeInTheDocument();
    expect(screen.getByText("Q1 Cohort baseline")).toBeInTheDocument();
    expect(screen.getByText("ISO 9001 audit walk-through")).toBeInTheDocument();
  });

  it("renders 4-card stat strip derived from cache (drift Finding #8 / §H(b) item 3 fallback)", async () => {
    render(mountTree(<AdminTestsPage />));
    // Wait for the data to land — stats card mounts pre-data with 0s.
    await waitFor(() => expect(screen.getByTestId("tests-table")).toBeInTheDocument());
    // Seed: 4 total, 2 published, 1 draft, 1 locked.
    await waitFor(() =>
      expect(within(screen.getByTestId("stat-tests")).getByText("4")).toBeInTheDocument(),
    );
    expect(
      within(screen.getByTestId("stat-published")).getByText("2"),
    ).toBeInTheDocument();
    expect(within(screen.getByTestId("stat-draft")).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByTestId("stat-locked")).getByText("1")).toBeInTheDocument();
  });

  it("renders the Locked status pill for campaign-locked test", async () => {
    render(mountTree(<AdminTestsPage />));
    await waitFor(() =>
      expect(screen.getByText("ISO 9001 audit walk-through")).toBeInTheDocument(),
    );
    const iso = getMockAdminTests().find(
      (t) => t.name === "ISO 9001 audit walk-through",
    )!;
    expect(screen.getByTestId(`status-pill-locked-${iso.id}`)).toBeInTheDocument();
  });

  it("renders em-dash for tests with null pill_id (drift Finding #5)", async () => {
    render(mountTree(<AdminTestsPage />));
    await waitFor(() =>
      expect(screen.getByText("Q1 Cohort baseline")).toBeInTheDocument(),
    );
    const q1 = getMockAdminTests().find((t) => t.name === "Q1 Cohort baseline")!;
    const row = screen.getByTestId(`tests-row-${q1.id}`);
    expect(row).toHaveTextContent("—");
  });

  it("renders pill name (joined from useAdminPills cache) for tests with pill_id", async () => {
    render(mountTree(<AdminTestsPage />));
    await waitFor(() =>
      expect(screen.getByText("Antifouling — focus")).toBeInTheDocument(),
    );
    // Pill name comes from MSW pill seed.
    expect(screen.getByText("Antifouling Systems")).toBeInTheDocument();
  });

  it("renders empty state when no tests", async () => {
    setMockAdminTests([]);
    render(mountTree(<AdminTestsPage />));
    await waitFor(() => expect(screen.getByTestId("tests-empty")).toBeInTheDocument());
  });
});

describe("tests list — client-side filters (drift Finding #1)", () => {
  it("filters by ?mode=frozen client-side", async () => {
    mockSearch = new URLSearchParams("mode=frozen");
    render(mountTree(<AdminTestsPage />));
    await waitFor(() =>
      expect(screen.getByText("Q1 Cohort baseline")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Antifouling — focus")).not.toBeInTheDocument();
  });

  it("filters by ?status=locked using deriveDisplayStatus", async () => {
    mockSearch = new URLSearchParams("status=locked");
    render(mountTree(<AdminTestsPage />));
    await waitFor(() =>
      expect(screen.getByText("ISO 9001 audit walk-through")).toBeInTheDocument(),
    );
    // The other published-but-unlocked tests are filtered out.
    expect(screen.queryByText("Antifouling — focus")).not.toBeInTheDocument();
    expect(screen.queryByText("Q1 Cohort baseline")).not.toBeInTheDocument();
  });

  it("ignores the disabled benchmark mode click per §E.8", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminTestsPage />));
    await waitFor(() => expect(screen.getByTestId("tests-table")).toBeInTheDocument());
    const benchmarkBtn = screen.getByRole("button", { name: /benchmark/i });
    await user.click(benchmarkBtn);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe("tests list — navigation", () => {
  it("New test CTA pushes to /admin/tests/new/edit", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminTestsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("tests-add-button")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("tests-add-button"));
    expect(mockPush).toHaveBeenCalledWith("/admin/tests/new/edit");
  });

  it("Edit row pushes to /admin/tests/{id}/edit", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminTestsPage />));
    await waitFor(() =>
      expect(screen.getByText("Antifouling — focus")).toBeInTheDocument(),
    );
    const target = getMockAdminTests().find((t) => t.name === "Antifouling — focus")!;
    await user.click(screen.getByTestId(`tests-edit-${target.id}`));
    expect(mockPush).toHaveBeenCalledWith(`/admin/tests/${target.id}/edit`);
  });
});

describe("tests list — delete flow (drift Finding #4)", () => {
  it("opens Modal confirm + DELETEs on confirm", async () => {
    const user = userEvent.setup();
    let deleteCalls = 0;
    server.use(
      http.delete(`${API}/v1/tests/:test_id`, ({ params }) => {
        deleteCalls += 1;
        const before = getMockAdminTests().length;
        setMockAdminTests(
          getMockAdminTests().filter((t) => t.id !== String(params.test_id)),
        );
        if (getMockAdminTests().length === before) {
          return new HttpResponse(null, { status: 404 });
        }
        return new HttpResponse(null, { status: 204 });
      }),
    );
    render(mountTree(<AdminTestsPage />));
    await waitFor(() =>
      expect(screen.getByText("Reference Panels D5")).toBeInTheDocument(),
    );
    const target = getMockAdminTests().find((t) => t.name === "Reference Panels D5")!;
    await user.click(screen.getByTestId(`tests-delete-${target.id}`));
    await waitFor(() =>
      expect(screen.getByTestId("tests-delete-confirm")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("tests-delete-confirm"));
    await waitFor(() => expect(deleteCalls).toBe(1));
    await waitFor(() =>
      expect(screen.queryByText("Reference Panels D5")).not.toBeInTheDocument(),
    );
  });
});
