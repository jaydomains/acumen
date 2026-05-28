/**
 * Admin catalogue shell integration tests (FE-8 §B.1 §6 Gherkin).
 *
 * Page mounts a Suspense-wrapped client `CatalogueShell` that drives
 * the 4-tab strip from `?tab=`. We mock `next/navigation` to observe
 * `router.replace(...)` and synthesise `useSearchParams()` for the
 * deep-link / invalid-tab scenarios.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/mocks/node";
import { resetMockAdminSubjects } from "@/mocks/handlers";
import AdminCataloguePage from "@/app/(authed)/(admin)/catalogue/page";

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
  mockSearch = new URLSearchParams();
  server.resetHandlers();
  resetMockAdminSubjects();
});

afterEach(() => {
  cleanup();
});

describe("admin catalogue shell", () => {
  it("mounts the Pills tab by default when no ?tab param is present", async () => {
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() => expect(screen.getByTestId("tab-pane-pills")).toBeInTheDocument());
    expect(screen.getByTestId("pills-tab-placeholder")).toBeInTheDocument();
    expect(screen.queryByTestId("subjects-tab")).not.toBeInTheDocument();
  });

  it("mounts the Subjects tab when ?tab=subjects", async () => {
    mockSearch = new URLSearchParams("tab=subjects");
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByTestId("tab-pane-subjects")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("subjects-tab")).toBeInTheDocument();
    expect(screen.queryByTestId("pills-tab-placeholder")).not.toBeInTheDocument();
  });

  it("switches tabs via router.replace() when a tab is clicked", async () => {
    const user = userEvent.setup();
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByTestId("catalogue-tab-pills")).toBeInTheDocument(),
    );

    await user.click(screen.getByTestId("catalogue-tab-subjects"));

    expect(mockReplace).toHaveBeenCalledWith("/admin/catalogue?tab=subjects");
  });

  it("falls back to ?tab=pills when an invalid tab is in the URL", async () => {
    mockSearch = new URLSearchParams("tab=foo");
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/admin/catalogue?tab=pills"),
    );
    // The Pills tab still mounts as the active fallback.
    expect(screen.getByTestId("tab-pane-pills")).toBeInTheDocument();
  });

  it("renders all 4 tab buttons with the Pills tab marked active by default", async () => {
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByTestId("catalogue-tab-pills")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("catalogue-tab-pills")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("catalogue-tab-subjects")).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByTestId("catalogue-tab-proposals")).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByTestId("catalogue-tab-safety")).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("does NOT call router.replace when the same active tab is clicked again", async () => {
    const user = userEvent.setup();
    mockSearch = new URLSearchParams("tab=pills");
    render(mountTree(<AdminCataloguePage />));
    await waitFor(() =>
      expect(screen.getByTestId("catalogue-tab-pills")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("catalogue-tab-pills"));
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
