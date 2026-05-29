/**
 * System-operations integration tests (FE-9 admin-systems §B.3 §6
 * Gherkin coverage). Mounts `/system` and exercises the real MSW
 * status + run handlers.
 */

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import { AuthProvider } from "@/lib/auth/context";
import SystemOpsPage from "@/app/(authed)/(admin)/system/page";

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

beforeEach(() => {
  server.resetHandlers();
});

afterEach(() => {
  cleanup();
});

describe("system operations page", () => {
  it("renders all five op cards with populated status stats", async () => {
    render(mountTree(<SystemOpsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("system-card-drive-index")).toBeInTheDocument(),
    );
    for (const id of [
      "system-card-bootstrap",
      "system-card-drive-ingest",
      "system-card-drive-index",
      "system-card-realism",
      "system-card-safety-links",
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    // drive-index status populated (await the query resolving past skeletons)
    await waitFor(() =>
      expect(
        within(screen.getByTestId("system-card-drive-index")).getByText("412"),
      ).toBeInTheDocument(),
    );
    // realism status populated
    expect(
      within(screen.getByTestId("system-card-realism")).getByText("38"),
    ).toBeInTheDocument();
  });

  it("drive-index card is read-only (no CTA button)", async () => {
    render(mountTree(<SystemOpsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("system-card-drive-index")).toBeInTheDocument(),
    );
    expect(
      within(screen.getByTestId("system-card-drive-index")).queryByRole("button"),
    ).not.toBeInTheDocument();
  });

  it("running Drive ingest refreshes the card's session stats", async () => {
    const user = userEvent.setup();
    render(mountTree(<SystemOpsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("system-card-drive-ingest")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("system-drive-ingest-run"));
    // files_added = 7 surfaces in the card's "New docs" stat.
    await waitFor(() =>
      expect(
        within(screen.getByTestId("system-card-drive-ingest")).getByText("7"),
      ).toBeInTheDocument(),
    );
  });

  it("running bootstrap populates its session stats", async () => {
    const user = userEvent.setup();
    render(mountTree(<SystemOpsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("system-card-bootstrap")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("system-bootstrap-run"));
    await waitFor(() =>
      expect(
        within(screen.getByTestId("system-card-bootstrap")).getByText("137"),
      ).toBeInTheDocument(),
    );
  });

  it("isolates a card-level status error without mounting the boundary", async () => {
    server.use(
      http.get(`${API}/v1/admin/realism/status`, () =>
        HttpResponse.json(
          { error: { code: "server_error", message: "boom", detail: null } },
          { status: 500 },
        ),
      ),
    );
    render(mountTree(<SystemOpsPage />));
    await waitFor(() =>
      expect(screen.getByTestId("system-card-realism-error")).toBeInTheDocument(),
    );
    // Other cards still render; the route boundary does not mount.
    expect(screen.getByTestId("system-card-bootstrap")).toBeInTheDocument();
    expect(screen.queryByTestId("boundary-frame")).not.toBeInTheDocument();
  });
});
