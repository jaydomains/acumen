/**
 * Catalogue page integration tests (FE-3 §B.2.6 Gherkin coverage).
 *
 * We mock `next/navigation` so we can observe `router.replace(...)`
 * calls and synthesise `useSearchParams()` for deep-link hydration
 * scenarios. The page exercises real `useCataloguePills` against
 * the default MSW catalogue fixture (`setMockCatalogue` overrides
 * per scenario).
 */

import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "@/mocks/node";
import {
  resetMockCatalogue,
  setMockCatalogue,
  getMockCatalogue,
} from "@/mocks/handlers";
import CataloguePage from "@/app/(authed)/(testee)/catalogue/page";

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
  usePathname: () => "/catalogue",
  useSearchParams: () => mockSearch,
}));

function mountTree(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>{node}</Suspense>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockReplace.mockClear();
  mockSearch = new URLSearchParams();
  resetMockCatalogue();
});

afterEach(() => {
  cleanup();
});

describe("Catalogue page", () => {
  it("renders the page header and a pill card per fixture entry", async () => {
    render(mountTree(<CataloguePage />));
    expect(
      screen.getByRole("heading", { name: /find what you need to learn/i }),
    ).toBeInTheDocument();
    // Default fixture has 15 pills (mix of safety + standard). At least
    // one known card resolves once the query lands.
    const card = await screen.findByText("Reference Panels");
    expect(card).toBeInTheDocument();
  });

  it("renders the safety badge + 'Open links' CTA for a safety-tagged pill", async () => {
    render(mountTree(<CataloguePage />));
    await screen.findByText("Confined Space Entry");
    // Each safety fixture renders the danger-tone Safety pill.
    const safetyPills = screen.getAllByText("Safety");
    expect(safetyPills.length).toBeGreaterThanOrEqual(2);
    // Two safety pills in fixture → two "Open links" CTAs.
    const openLinks = screen.getAllByText(/open links/i);
    expect(openLinks.length).toBe(2);
  });

  it("debounces the search input (≥300ms) before writing the URL", async () => {
    const user = userEvent.setup({ delay: null });
    render(mountTree(<CataloguePage />));
    await screen.findByText("Reference Panels");
    mockReplace.mockClear();

    await user.type(screen.getByTestId("catalogue-search-input"), "antif");

    // Immediately: no URL write yet.
    expect(mockReplace).not.toHaveBeenCalled();

    // After the debounce window, exactly one URL write with the final value.
    await waitFor(
      () => {
        expect(mockReplace).toHaveBeenCalledWith("/catalogue?search=antif");
      },
      { timeout: 1000 },
    );
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it("subject click updates the URL immediately (no debounce)", async () => {
    const user = userEvent.setup();
    render(mountTree(<CataloguePage />));
    await screen.findByText("Antifouling Systems");

    mockReplace.mockClear();
    await user.click(screen.getByTestId("catalogue-subject-s-marine"));
    expect(mockReplace).toHaveBeenCalledWith("/catalogue?subject=s-marine");

    // Grid narrows to the marine subset.
    await waitFor(() => {
      expect(screen.queryByText("Reference Panels")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Antifouling Systems")).toBeInTheDocument();
  });

  it("hydrates filter state from URL searchParams on first render", async () => {
    mockSearch = new URLSearchParams("subject=s-safety");
    render(mountTree(<CataloguePage />));

    // Safety subject button is the active one.
    const safetyBtn = await screen.findByTestId("catalogue-subject-s-safety");
    expect(safetyBtn.getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("catalogue-subject-all").getAttribute("data-active")).toBe(
      "false",
    );

    // Only safety pills render.
    expect(await screen.findByText("Confined Space Entry")).toBeInTheDocument();
    expect(screen.queryByText("Reference Panels")).not.toBeInTheDocument();
  });

  it("renders the filtered empty state with a Clear-filters action", async () => {
    const user = userEvent.setup({ delay: null });
    render(mountTree(<CataloguePage />));
    await screen.findByText("Reference Panels");

    await user.type(
      screen.getByTestId("catalogue-search-input"),
      "nonexistent-query",
    );

    const empty = await screen.findByTestId("catalogue-empty");
    expect(empty).toHaveTextContent(/no pills match/i);

    mockReplace.mockClear();
    await user.click(screen.getByTestId("catalogue-clear-filters"));
    expect(mockReplace).toHaveBeenCalledWith("/catalogue");
    await waitFor(() => {
      expect(screen.queryByTestId("catalogue-empty")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Reference Panels")).toBeInTheDocument();
  });

  it("surfaces the boundary card when the catalogue query fails", async () => {
    server.use(
      http.get(`http://localhost:8000/v1/catalogue/pills`, () =>
        HttpResponse.json(
          {
            error: { code: "internal_error", message: "boom", detail: null },
          },
          { status: 500 },
        ),
      ),
    );
    render(mountTree(<CataloguePage />));
    expect(
      await screen.findByRole("heading", {
        name: /we couldn't load the catalogue/i,
      }),
    ).toBeInTheDocument();
  });

  it("primes pill-detail cache entries from the catalogue fetch (avoids re-fetch on click)", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={null}>
          <CataloguePage />
        </Suspense>
      </QueryClientProvider>,
    );
    await screen.findByText("Reference Panels");

    // The first fixture pill's id was primed by useCataloguePills on success.
    const firstId = getMockCatalogue()[0]!.id;
    const cached = queryClient.getQueryData<{ id: string }>(["pills", firstId]);
    expect(cached?.id).toBe(firstId);
  });

  it("renders just the page header copy when the backend returns zero pills", async () => {
    setMockCatalogue([]);
    render(mountTree(<CataloguePage />));
    const empty = await screen.findByTestId("catalogue-empty");
    expect(empty).toHaveTextContent(/no pills in the catalogue yet/i);
    // No Clear-filters in the unfiltered empty state.
    expect(
      screen.queryByTestId("catalogue-clear-filters"),
    ).not.toBeInTheDocument();
  });
});
