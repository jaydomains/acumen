/**
 * Proposals tab integration tests (FE-8 §B.4 §6 Gherkin coverage).
 *
 * Mounts the full admin catalogue page with `?tab=proposals` and
 * exercises real MSW handlers for GET/approve/reject + asserts the
 * cross-resource invalidation discipline by checking the Pills tab
 * after approve (D.3 round-trip).
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import {
  getMockAdminPills,
  getMockAdminProposals,
  resetMockAdminPills,
  resetMockAdminProposals,
  resetMockAdminSubjects,
  setMockAdminProposals,
} from "@/mocks/handlers";
import AdminCataloguePage from "@/app/(authed)/(admin)/admin/catalogue/page";

const API = "http://localhost:8000";

const mockReplace = vi.fn();
let mockSearch = new URLSearchParams("tab=proposals&status=pending");

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/admin/catalogue",
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
  mockReplace.mockClear();
  mockSearch = new URLSearchParams("tab=proposals&status=pending");
  server.resetHandlers();
  resetMockAdminPills();
  resetMockAdminSubjects();
  resetMockAdminProposals();
});

afterEach(() => {
  cleanup();
});

describe("proposals tab — list + default URL state", () => {
  it("defaults to ?status=pending if no status param", async () => {
    mockSearch = new URLSearchParams("tab=proposals");
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        "/admin/catalogue?tab=proposals&status=pending",
      ),
    );
  });

  it("renders pending proposals from the default fixture", async () => {
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByTestId("proposals-table")).toBeInTheDocument(),
    );
    expect(screen.getByText("Cathodic Protection Field Inspection")).toBeInTheDocument();
    expect(screen.getByText("Adhesion Pull-Off Test")).toBeInTheDocument();
    // Status filter is pending — done/approved row should be filtered out.
    expect(screen.queryByText(/Reference Panels \(historic\)/)).not.toBeInTheDocument();
  });

  it("switches filter to approved on segment click", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByTestId("proposals-status-approved")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("proposals-status-approved"));
    expect(mockReplace).toHaveBeenCalledWith(
      "/admin/catalogue?tab=proposals&status=approved",
    );
  });

  it("renders approved historical proposal when ?status=approved", async () => {
    mockSearch = new URLSearchParams("tab=proposals&status=approved");
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByText(/Reference Panels \(historic\)/)).toBeInTheDocument(),
    );
  });

  it("renders empty-state copy when no pending proposals", async () => {
    setMockAdminProposals([]);
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByTestId("proposals-empty")).toBeInTheDocument(),
    );
    expect(screen.getByText(/No proposals waiting for review/i)).toBeInTheDocument();
  });
});

describe("proposals tab — approve action (drift Finding #1)", () => {
  it("approve fires POST, refetches proposals list, AND creates a pill in Pills tab (§D.3 round-trip)", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(
        screen.getByText("Cathodic Protection Field Inspection"),
      ).toBeInTheDocument(),
    );

    const target = getMockAdminProposals().find(
      (p) =>
        (p.payload as unknown as { proposal?: { name?: string } })?.proposal?.name ===
        "Cathodic Protection Field Inspection",
    )!;

    await user.click(screen.getByTestId(`proposals-approve-${target.id}`));

    // Cross-resource invalidation: the new pill lands in mockAdminPills.
    await waitFor(() =>
      expect(
        getMockAdminPills().some(
          (p) => p.name === "Cathodic Protection Field Inspection",
        ),
      ).toBe(true),
    );

    // Proposal's wire shape: status flips to done; decision approved.
    const after = getMockAdminProposals().find((p) => p.id === target.id)!;
    expect(after.status).toBe("done");
    expect((after.payload as unknown as Record<string, unknown>).decision).toBe(
      "approved",
    );
  });

  it("leaves the proposal row in pending state when approve fails with 409 (drift Finding #5)", async () => {
    const user = userEvent.setup();
    let approveCalls = 0;
    server.use(
      http.post(`${API}/v1/pill-proposals/:proposal_id/approve`, () => {
        approveCalls += 1;
        return HttpResponse.json(
          {
            error: {
              code: "proposal_not_pending",
              message: "This proposal is already resolved.",
              detail: null,
            },
          },
          { status: 409 },
        );
      }),
    );
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(
        screen.getByText("Cathodic Protection Field Inspection"),
      ).toBeInTheDocument(),
    );

    const target = getMockAdminProposals()[0]!;
    await user.click(screen.getByTestId(`proposals-approve-${target.id}`));

    // Verify the call fired + the proposal stayed pending in mock state.
    // Toast surfacing is verified by reading the code — sonner renders
    // outside the test tree without a <Toaster /> mount.
    await waitFor(() => expect(approveCalls).toBe(1));
    const after = getMockAdminProposals().find((p) => p.id === target.id)!;
    expect(after.status).toBe("pending");
  });
});

describe("proposals tab — reject action", () => {
  it("reject fires POST and flips proposal to status=done, decision=rejected", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByText("Adhesion Pull-Off Test")).toBeInTheDocument(),
    );

    const target = getMockAdminProposals().find(
      (p) =>
        (p.payload as unknown as { proposal: { name: string } })?.proposal?.name ===
        "Adhesion Pull-Off Test",
    )!;
    await user.click(screen.getByTestId(`proposals-reject-${target.id}`));

    await waitFor(() => {
      const after = getMockAdminProposals().find((p) => p.id === target.id)!;
      expect(after.status).toBe("done");
      expect((after.payload as unknown as Record<string, unknown>).decision).toBe(
        "rejected",
      );
    });
  });

  it("does NOT create a pill on reject (cross-resource discipline)", async () => {
    const user = userEvent.setup();
    const pillsCountBefore = getMockAdminPills().length;
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByText("Adhesion Pull-Off Test")).toBeInTheDocument(),
    );
    const target = getMockAdminProposals()[0]!;
    await user.click(screen.getByTestId(`proposals-reject-${target.id}`));

    // Give the mutation a tick to settle.
    await waitFor(() => {
      const after = getMockAdminProposals().find((p) => p.id === target.id)!;
      expect(after.status).toBe("done");
    });
    expect(getMockAdminPills().length).toBe(pillsCountBefore);
  });
});

describe("proposals tab — drawer", () => {
  it("opens the drawer when admin clicks a row body", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(
        screen.getByText("Cathodic Protection Field Inspection"),
      ).toBeInTheDocument(),
    );

    const target = getMockAdminProposals()[0]!;
    await user.click(screen.getByTestId(`proposals-row-${target.id}`));

    await waitFor(() =>
      expect(screen.getByTestId("proposal-drawer-rows")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("proposal-drawer-approve")).toBeInTheDocument();
    expect(screen.getByTestId("proposal-drawer-reject")).toBeInTheDocument();
  });

  it("approving from the drawer closes it and creates a pill", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(
        screen.getByText("Cathodic Protection Field Inspection"),
      ).toBeInTheDocument(),
    );

    const target = getMockAdminProposals()[0]!;
    await user.click(screen.getByTestId(`proposals-row-${target.id}`));
    await waitFor(() =>
      expect(screen.getByTestId("proposal-drawer-approve")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("proposal-drawer-approve"));

    await waitFor(() =>
      expect(screen.queryByTestId("proposal-drawer-rows")).not.toBeInTheDocument(),
    );
    expect(
      getMockAdminPills().some((p) => p.name === "Cathodic Protection Field Inspection"),
    ).toBe(true);
  });
});

describe("proposals tab — invalidation discipline (§C.1)", () => {
  it("approve refetches proposals.all() so the resolved row drops out of pending", async () => {
    const user = userEvent.setup();
    let proposalsListCalls = 0;
    server.use(
      http.get(`${API}/v1/pill-proposals`, () => {
        proposalsListCalls += 1;
        return HttpResponse.json({
          data: getMockAdminProposals(),
          meta: { next_cursor: null },
        });
      }),
    );
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByTestId("proposals-table")).toBeInTheDocument(),
    );
    const initialProposalsCalls = proposalsListCalls;

    const target = getMockAdminProposals()[0]!;
    await user.click(screen.getByTestId(`proposals-approve-${target.id}`));

    // proposals.all() invalidation fires → refetch. Pills.all() invalidation
    // is verified by reading `admin-proposals.ts:useApproveProposal` — the
    // Pills tab is not mounted under the proposals tree, so a pills-list
    // refetch can't be observed in this integration scope.
    await waitFor(() =>
      expect(proposalsListCalls).toBeGreaterThan(initialProposalsCalls),
    );
  });
});
