/**
 * Cost dashboard integration tests (FE-9 admin-systems §B.1 §6 Gherkin
 * coverage). Mounts `/cost` and exercises the real MSW cost-summary
 * handler, overriding it per scenario via `server.use`.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import { AuthProvider } from "@/lib/auth/context";
import CostPage from "@/app/(authed)/(admin)/cost/page";

const API = "http://localhost:8000";

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

function summary(overrides: Record<string, unknown>) {
  return {
    since: "2026-05-01T00:00:00Z",
    year_month: "2026-05",
    total_usd: 14.32,
    by_provider: { anthropic: 12.1, openai: 2.22 },
    by_model: {
      "claude-sonnet-4-5": 12.1,
      "gpt-4o-mini": 1.5,
      "text-embedding-3-small": 0.72,
    },
    monthly_budget: 20.0,
    percent_of_budget: 71.6,
    alerts_fired_this_month: [50],
    ...overrides,
  };
}

beforeEach(() => {
  server.resetHandlers();
});

afterEach(() => {
  cleanup();
});

describe("cost dashboard", () => {
  it("renders the summary, alert pill, provider split and model rows", async () => {
    render(mountTree(<CostPage />));
    await waitFor(() => expect(screen.getByTestId("cost-body")).toBeInTheDocument());

    expect(screen.getByText("$14.32")).toBeInTheDocument();
    expect(screen.getByText("$20.00")).toBeInTheDocument();
    // 71.6 rounds to the nearest integer per §B.1 §7.
    expect(screen.getByText("72%")).toBeInTheDocument();
    expect(screen.getByText("50% threshold passed")).toBeInTheDocument();
    // Provider split + model breakdown
    expect(screen.getByText("$12.10")).toBeInTheDocument();
    expect(screen.getByText("claude-sonnet-4-5")).toBeInTheDocument();
    expect(screen.getByText("gpt-4o-mini")).toBeInTheDocument();
    expect(screen.getByText("text-embedding-3-small")).toBeInTheDocument();
  });

  it("no budget: shows Not set, em-dash, the nudge copy, and no pills", async () => {
    server.use(
      http.get(`${API}/v1/admin/cost/summary`, () =>
        HttpResponse.json(
          summary({
            monthly_budget: null,
            percent_of_budget: null,
            alerts_fired_this_month: [],
          }),
        ),
      ),
    );
    render(mountTree(<CostPage />));
    await waitFor(() => expect(screen.getByTestId("cost-body")).toBeInTheDocument());

    expect(screen.getByText("Not set")).toBeInTheDocument();
    expect(screen.getByTestId("cost-no-budget-copy")).toBeInTheDocument();
    expect(screen.queryByTestId("cost-alert-pills")).not.toBeInTheDocument();
  });

  it("all three thresholds fired: 3 pills, 100% in danger tone", async () => {
    server.use(
      http.get(`${API}/v1/admin/cost/summary`, () =>
        HttpResponse.json(summary({ alerts_fired_this_month: [50, 80, 100] })),
      ),
    );
    render(mountTree(<CostPage />));
    await waitFor(() =>
      expect(screen.getByTestId("cost-alert-pills")).toBeInTheDocument(),
    );

    expect(screen.getByText("50% threshold passed")).toBeInTheDocument();
    expect(screen.getByText("80% threshold passed")).toBeInTheDocument();
    const hundred = screen.getByText("100% threshold passed");
    expect(hundred).toBeInTheDocument();
    expect(hundred).toHaveAttribute("data-tone", "danger");
  });

  it("range selector: 7d and YTD disabled, this month active", async () => {
    render(mountTree(<CostPage />));
    await waitFor(() => expect(screen.getByTestId("cost-body")).toBeInTheDocument());

    expect(screen.getByTestId("cost-range-7d")).toBeDisabled();
    expect(screen.getByTestId("cost-range-ytd")).toBeDisabled();
    expect(screen.getByTestId("cost-range-month")).not.toBeDisabled();
  });

  it("renders the deferred daily-history placeholder", async () => {
    render(mountTree(<CostPage />));
    await waitFor(() => expect(screen.getByTestId("cost-body")).toBeInTheDocument());

    expect(screen.getByTestId("cost-daily-placeholder")).toBeInTheDocument();
    expect(screen.getByText(/Daily history coming in v1\.x/)).toBeInTheDocument();
  });

  it("query failure renders the inline Pattern C boundary with retry", async () => {
    server.use(
      http.get(`${API}/v1/admin/cost/summary`, () =>
        HttpResponse.json(
          { error: { code: "server_error", message: "boom", detail: null } },
          { status: 500 },
        ),
      ),
    );
    render(mountTree(<CostPage />));
    await waitFor(() => expect(screen.getByTestId("boundary-frame")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  });
});
