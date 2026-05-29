/**
 * Anchor-calibration integration tests (FE-9 admin-systems §B.2 §6
 * Gherkin coverage). Mounts `/calibration` and exercises the real MSW
 * flagged / run / resolve handlers.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import { AuthProvider } from "@/lib/auth/context";
import CalibrationPage from "@/app/(authed)/(admin)/calibration/page";

const API = "http://localhost:8000";
const PILL_CATHODIC = "00000000-0000-0000-0000-0000000ca0p1";
const PILL_ANTIFOUL = "00000000-0000-0000-0000-0000000ca0p2";
const ANCHOR1 = "00000000-0000-0000-0000-0000000ca0a1";
const ANCHOR3 = "00000000-0000-0000-0000-0000000ca0a3"; // Antifouling

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
  usePathname: () => "/calibration",
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

describe("calibration — mount + run", () => {
  it("pre-run: summary shows em-dashes + the populate copy, table renders rows", async () => {
    render(mountTree(<CalibrationPage />));
    await waitFor(() =>
      expect(screen.getByTestId("calibration-table")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("calibration-no-run")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
    // 3 flagged rows; drift groups Cathodic (2) + Antifouling (1)
    expect(screen.getByTestId(`calibration-pill-${PILL_CATHODIC}`)).toBeInTheDocument();
    expect(screen.getByTestId(`calibration-pill-${PILL_ANTIFOUL}`)).toBeInTheDocument();
  });

  it("running calibration populates the summary stats", async () => {
    const user = userEvent.setup();
    render(mountTree(<CalibrationPage />));
    await waitFor(() =>
      expect(screen.getByTestId("calibration-table")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Run calibration" }));
    expect(await screen.findByText("2740")).toBeInTheDocument();
    expect(screen.queryByTestId("calibration-no-run")).not.toBeInTheDocument();
  });
});

describe("calibration — resolve", () => {
  it("accept resolution closes the modal", async () => {
    const user = userEvent.setup();
    render(mountTree(<CalibrationPage />));
    await waitFor(() =>
      expect(screen.getByTestId("calibration-table")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId(`calibration-resolve-${ANCHOR1}`));
    await user.click(await screen.findByTestId("verdict-tile-accept"));
    await user.click(screen.getByTestId("anchor-resolve-apply"));

    await waitFor(() =>
      expect(screen.queryByTestId("anchor-resolve-apply")).not.toBeInTheDocument(),
    );
  });

  it("override with invalid JSON is blocked with no network", async () => {
    const resolveSpy = vi.fn();
    server.use(
      http.post(`${API}/v1/admin/anchors/:id/resolve`, () => {
        resolveSpy();
        return HttpResponse.json({ anchor_question_id: ANCHOR1 });
      }),
    );

    const user = userEvent.setup();
    render(mountTree(<CalibrationPage />));
    await waitFor(() =>
      expect(screen.getByTestId("calibration-table")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId(`calibration-resolve-${ANCHOR1}`));
    await user.click(await screen.findByTestId("verdict-tile-override"));
    await user.type(screen.getByTestId("anchor-json-editor"), "not json");
    await user.click(screen.getByTestId("anchor-resolve-apply"));

    expect(await screen.findByText("Must be a valid JSON object.")).toBeInTheDocument();
    expect(resolveSpy).not.toHaveBeenCalled();
  });
});

describe("calibration — filter + error", () => {
  it("filters the table to a single pill via ?pill=", async () => {
    mockSearch = new URLSearchParams(`pill=${PILL_ANTIFOUL}`);
    render(mountTree(<CalibrationPage />));
    await waitFor(() =>
      expect(screen.getByTestId("calibration-table")).toBeInTheDocument(),
    );
    // Antifouling has one anchor; the two Cathodic anchors are filtered out.
    expect(screen.getByTestId(`calibration-row-${ANCHOR3}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`calibration-row-${ANCHOR1}`)).not.toBeInTheDocument();
  });

  it("query failure renders the inline Pattern C boundary", async () => {
    server.use(
      http.get(`${API}/v1/admin/anchors/flagged`, () =>
        HttpResponse.json(
          { error: { code: "server_error", message: "boom", detail: null } },
          { status: 500 },
        ),
      ),
    );
    render(mountTree(<CalibrationPage />));
    await waitFor(() => expect(screen.getByTestId("boundary-frame")).toBeInTheDocument());
  });
});
