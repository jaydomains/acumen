/**
 * Ops landing integration tests (FE-9 admin-ops §B.1 §6 Gherkin
 * coverage). Mounts `/ops` and exercises the five shared-cache queries
 * via the real MSW handlers.
 */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import { AuthProvider } from "@/lib/auth/context";
import OpsPage from "@/app/(authed)/(admin)/ops/page";

const API = "http://localhost:8000";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/ops",
  useSearchParams: () => new URLSearchParams(),
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
  server.resetHandlers();
});

afterEach(() => {
  cleanup();
});

describe("ops landing", () => {
  it("renders the five summary cards", async () => {
    render(mountTree(<OpsPage />));
    for (const id of [
      "ops-flagged-card",
      "ops-engagement-card",
      "ops-cost-card",
      "ops-bootstrap-card",
      "ops-proposals-card",
    ]) {
      expect(await screen.findByTestId(id)).toBeInTheDocument();
    }
  });

  it("composes the hero subtitle from resolved counts", async () => {
    render(mountTree(<OpsPage />));
    await waitFor(() =>
      expect(screen.getByText(/grade reviews? need your attention/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/escalated past the 2nd reminder/i)).toBeInTheDocument();
    expect(screen.getByText(/AI spend is on pace within budget/i)).toBeInTheDocument();
  });

  it("flagged card links through to the review queue", async () => {
    render(mountTree(<OpsPage />));
    const cta = await screen.findByTestId("ops-flagged-card-cta");
    expect(cta).toHaveAttribute("href", "/review?verdict=flagged");
    // a preview row deep-links with ?selected=
    const card = screen.getByTestId("ops-flagged-card");
    const rowLink = within(card)
      .getByText(/Naledi P\./)
      .closest("a");
    expect(rowLink).toHaveAttribute("href", expect.stringContaining("/review?selected="));
  });

  it("cost card shows fired alert pills", async () => {
    render(mountTree(<OpsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("ops-cost-alerts")).toBeInTheDocument(),
    );
    expect(
      within(screen.getByTestId("ops-cost-alerts")).getByText("50% alert"),
    ).toBeInTheDocument();
  });

  it("isolates a card-level query error without mounting the boundary", async () => {
    server.use(
      http.get(`${API}/v1/admin/cost/summary`, () =>
        HttpResponse.json(
          { error: { code: "server_error", message: "boom", detail: null } },
          { status: 500 },
        ),
      ),
    );
    render(mountTree(<OpsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("ops-cost-card-error")).toBeInTheDocument(),
    );
    // Other cards still render; the route boundary does not mount.
    expect(screen.getByTestId("ops-flagged-card")).toBeInTheDocument();
    expect(screen.queryByTestId("boundary-frame")).not.toBeInTheDocument();
  });
});
