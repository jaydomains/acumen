/**
 * Loop-queue integration tests (FE-9 admin-ops §B.3 §6 Gherkin
 * coverage). Mounts `/loop` and exercises the real MSW queue / approve /
 * reject handlers.
 *
 * URL state: `useSearchParams` is mocked statically per test;
 * `router.replace` is a spy. Status-filter assertions check the replace
 * calls.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import { AuthProvider } from "@/lib/auth/context";
import LoopPage from "@/app/(authed)/(admin)/loop/page";

const API = "http://localhost:8000";
const ROW1 = "00000000-0000-0000-0000-0000000100a1"; // Naledi P., status=review

const mockReplace = vi.fn();
let mockSearch = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/loop",
  useSearchParams: () => mockSearch,
}));

function mountTree(node: React.ReactNode) {
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
  mockSearch = new URLSearchParams();
  server.resetHandlers();
});

afterEach(() => {
  cleanup();
});

describe("loop queue — mount + filter", () => {
  it("normalises a missing status param to review", async () => {
    render(mountTree(<LoopPage />));
    await waitFor(() => expect(screen.getByTestId("loop-table")).toBeInTheDocument());
    expect(mockReplace.mock.calls.map((c) => String(c[0]))).toContainEqual(
      expect.stringContaining("status=review"),
    );
  });

  it("renders only review-status rows under the default filter", async () => {
    mockSearch = new URLSearchParams("status=review");
    render(mountTree(<LoopPage />));
    await waitFor(() => expect(screen.getByTestId("loop-table")).toBeInTheDocument());
    expect(screen.getByText("Naledi P.")).toBeInTheDocument();
    // Kabelo is status=queued → filtered out of the review view.
    expect(screen.queryByText("Kabelo R.")).not.toBeInTheDocument();
  });
});

describe("loop queue — approve + reject", () => {
  beforeEach(() => {
    mockSearch = new URLSearchParams("status=review");
  });

  it("approves a queued follow-up and closes the modal", async () => {
    const user = userEvent.setup();
    render(mountTree(<LoopPage />));
    await waitFor(() => expect(screen.getByTestId("loop-table")).toBeInTheDocument());

    await user.click(screen.getByTestId(`loop-approve-${ROW1}`));
    await user.click(await screen.findByTestId("loop-approve-confirm"));

    await waitFor(() =>
      expect(screen.queryByTestId("loop-approve-confirm")).not.toBeInTheDocument(),
    );
  });

  it("blocks reject with an empty reason and fires no network", async () => {
    const rejectSpy = vi.fn();
    server.use(
      http.post(`${API}/v1/admin/loop/queue/:id/reject`, () => {
        rejectSpy();
        return HttpResponse.json({ weakness_report_id: ROW1 });
      }),
    );

    const user = userEvent.setup();
    render(mountTree(<LoopPage />));
    await waitFor(() => expect(screen.getByTestId("loop-table")).toBeInTheDocument());

    await user.click(screen.getByTestId(`loop-reject-${ROW1}`));
    await user.click(await screen.findByTestId("loop-reject-confirm"));

    expect(await screen.findByText("Reason is required for audit.")).toBeInTheDocument();
    expect(rejectSpy).not.toHaveBeenCalled();
  });

  it("rejects with a reason and closes the modal", async () => {
    const user = userEvent.setup();
    render(mountTree(<LoopPage />));
    await waitFor(() => expect(screen.getByTestId("loop-table")).toBeInTheDocument());

    await user.click(screen.getByTestId(`loop-reject-${ROW1}`));
    await user.type(
      await screen.findByTestId("loop-reject-reason"),
      "Retest in two weeks instead — threshold off for this testee.",
    );
    await user.click(screen.getByTestId("loop-reject-confirm"));

    await waitFor(() =>
      expect(screen.queryByTestId("loop-reject-form")).not.toBeInTheDocument(),
    );
  });
});
