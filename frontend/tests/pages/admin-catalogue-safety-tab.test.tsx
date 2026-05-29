/**
 * Safety tab integration tests (FE-8 §B.5 §6 Gherkin coverage).
 *
 * Reuses `useAdminPills` cache + filters `safety_relevant=true`
 * client-side (drift Finding #9 / §E.7 absorption). MSW seed includes
 * both Auto-tagged ("Working at Height" with overridden_at=null) and
 * Admin-overridden ("Confined Space Entry" with overridden_at!=null)
 * safety pills so both badge variants are exercised.
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
  resetMockAdminPills,
  resetMockAdminSubjects,
  setMockAdminPills,
} from "@/mocks/handlers";
import AdminCataloguePage from "@/app/(authed)/(admin)/admin/catalogue/page";

const API = "http://localhost:8000";

const mockReplace = vi.fn();
let mockSearch = new URLSearchParams("tab=safety");

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
  mockSearch = new URLSearchParams("tab=safety");
  server.resetHandlers();
  resetMockAdminPills();
  resetMockAdminSubjects();
});

afterEach(() => {
  cleanup();
});

describe("safety tab — list (Finding #9 / §E.7 client-side filter)", () => {
  it("renders only pills where safety_relevant === true", async () => {
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByTestId("safety-table")).toBeInTheDocument());
    expect(screen.getByText("Confined Space Entry")).toBeInTheDocument();
    expect(screen.getByText("Working at Height")).toBeInTheDocument();
    // Non-safety pills must NOT appear.
    expect(screen.queryByText("Reference Panels")).not.toBeInTheDocument();
    expect(screen.queryByText("Antifouling Systems")).not.toBeInTheDocument();
  });

  it("shows empty-state when no safety pills exist", async () => {
    setMockAdminPills(getMockAdminPills().filter((p) => !p.safety_relevant));
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByTestId("safety-empty")).toBeInTheDocument());
  });
});

describe("safety tab — override-source badge", () => {
  it("renders 'Auto' badge for auto-tagged pills (overridden_at === null, drift Finding #1)", async () => {
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByText("Working at Height")).toBeInTheDocument(),
    );
    // "Working at Height" is the auto-tagged fixture.
    const working = getMockAdminPills().find((p) => p.name === "Working at Height")!;
    const row = screen.getByTestId(`safety-row-${working.id}`);
    expect(row).toContainElement(screen.getByTestId("override-source-auto"));
  });

  it("renders 'Admin' badge with relative date for admin-overridden pills", async () => {
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByText("Confined Space Entry")).toBeInTheDocument(),
    );
    const confined = getMockAdminPills().find((p) => p.name === "Confined Space Entry")!;
    const row = screen.getByTestId(`safety-row-${confined.id}`);
    expect(row).toContainElement(screen.getByTestId("override-source-admin"));
  });
});

describe("safety tab — client-side filters", () => {
  it("filters by ?q= over safety pills only", async () => {
    mockSearch = new URLSearchParams("tab=safety&q=confined");
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByText("Confined Space Entry")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Working at Height")).not.toBeInTheDocument();
  });

  it("writes ?q= to URL preserving ?tab=safety on search (Finding #7)", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByTestId("safety-table")).toBeInTheDocument());
    await user.type(screen.getByTestId("safety-search"), "x");
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/admin/catalogue?tab=safety&q=x"),
    );
  });
});

describe("safety tab — remove safety tag confirmation flow", () => {
  it("opens the confirm modal on 'Remove safety tag' click", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByText("Confined Space Entry")).toBeInTheDocument(),
    );
    const target = getMockAdminPills().find((p) => p.name === "Confined Space Entry")!;
    await user.click(screen.getByTestId(`safety-untag-${target.id}`));
    await waitFor(() =>
      expect(screen.getByTestId("safety-untag-confirm")).toBeInTheDocument(),
    );
  });

  it("on Confirm fires PATCH /safety with {safety_relevant: false} and removes the row", async () => {
    const user = userEvent.setup();
    let safetyBody: { safety_relevant?: boolean } | null = null;
    server.use(
      http.patch(`${API}/v1/pills/:pill_id/safety`, async ({ request, params }) => {
        safetyBody = (await request.json()) as { safety_relevant: boolean };
        const pill = getMockAdminPills().find((p) => p.id === String(params.pill_id));
        if (!pill) return new HttpResponse(null, { status: 404 });
        const next = { ...pill, safety_relevant: safetyBody!.safety_relevant! };
        setMockAdminPills(getMockAdminPills().map((p) => (p.id === pill.id ? next : p)));
        return HttpResponse.json(next);
      }),
    );

    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByText("Confined Space Entry")).toBeInTheDocument(),
    );
    const target = getMockAdminPills().find((p) => p.name === "Confined Space Entry")!;
    await user.click(screen.getByTestId(`safety-untag-${target.id}`));
    await user.click(screen.getByTestId("safety-untag-confirm"));

    await waitFor(() => expect(safetyBody).not.toBeNull());
    expect(safetyBody!.safety_relevant).toBe(false);

    // Row should drop out of the Safety tab after refetch.
    await waitFor(() =>
      expect(screen.queryByText("Confined Space Entry")).not.toBeInTheDocument(),
    );
  });

  it("Cancel closes the modal without firing PATCH", async () => {
    const user = userEvent.setup();
    let patchCalls = 0;
    server.use(
      http.patch(`${API}/v1/pills/:pill_id/safety`, () => {
        patchCalls += 1;
        return HttpResponse.json({});
      }),
    );
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByText("Confined Space Entry")).toBeInTheDocument(),
    );
    const target = getMockAdminPills().find((p) => p.name === "Confined Space Entry")!;
    await user.click(screen.getByTestId(`safety-untag-${target.id}`));
    await waitFor(() =>
      expect(screen.getByTestId("safety-untag-confirm")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    await waitFor(() =>
      expect(screen.queryByTestId("safety-untag-confirm")).not.toBeInTheDocument(),
    );
    expect(patchCalls).toBe(0);
  });
});

describe("safety tab — edit flow", () => {
  it("opens PillModal in edit mode when admin clicks Edit", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByText("Confined Space Entry")).toBeInTheDocument(),
    );
    const target = getMockAdminPills().find((p) => p.name === "Confined Space Entry")!;
    await user.click(screen.getByTestId(`safety-edit-${target.id}`));
    await waitFor(() =>
      expect(screen.getByTestId("pill-modal-form")).toBeInTheDocument(),
    );
    const nameInput = screen.getByTestId("pill-modal-name") as HTMLInputElement;
    expect(nameInput.value).toBe("Confined Space Entry");
  });
});
