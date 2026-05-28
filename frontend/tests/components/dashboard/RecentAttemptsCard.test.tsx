/**
 * RecentAttemptsCard tests (FE-3 §B.1 §6, post FE-7 flag-flip).
 *
 * Card now consumes `GET /v1/attempts` live via `useMeAttemptsCapped(5)`.
 * Every test fires a request and so needs a QueryClient + the MSW
 * `meAttemptsListHandler`. `next/navigation` is mocked once at module
 * level so the Row's `useRouter` resolves in jsdom.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  resetMockMeAttempts,
  setMockMeAttempts,
  setMockMeAttemptsStatus,
} from "@/mocks/handlers";
import type { AttemptListItem } from "@/lib/queries/me";
import { server } from "@/mocks/node";
import { RecentAttemptsCard } from "@/components/dashboard/RecentAttemptsCard";

const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const attemptId = (n: number): string =>
  `dddddddd-dddd-dddd-dddd-${String(n).padStart(12, "0")}`;
const PILL_A = "11111111-1111-1111-1111-aaaaaaaaaaaa";

const makeAttempt = (
  n: number,
  overrides: Partial<AttemptListItem> = {},
): AttemptListItem => ({
  attempt_id: attemptId(n),
  pill_id: PILL_A,
  pill_name: "Antifouling Systems",
  submitted_at: `2026-05-${String(n).padStart(2, "0")}T09:00:00Z`,
  score_percent: 70,
  band: "working",
  origin: "self_initiated",
  competence_delta: null,
  ...overrides,
});

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
  resetMockMeAttempts();
  routerPush.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("RecentAttemptsCard", () => {
  it("mounts the card with the heading", async () => {
    render(mountTree(<RecentAttemptsCard />));
    expect(await screen.findByTestId("recent-attempts-card")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /your last attempts/i }),
    ).toBeInTheDocument();
  });

  it("renders up to 5 rows from the capped query", async () => {
    setMockMeAttempts(
      Array.from({ length: 8 }, (_, i) =>
        makeAttempt(i + 1, { pill_name: `Pill ${i + 1}` }),
      ),
    );
    render(mountTree(<RecentAttemptsCard />));
    await waitFor(() =>
      expect(screen.getAllByTestId("recent-attempts-row")).toHaveLength(5),
    );
  });

  it("requests with limit=5 (cache discriminator pin)", async () => {
    const requested: URL[] = [];
    const onRequest = ({ request }: { request: Request }) => {
      const url = new URL(request.url);
      if (url.pathname.endsWith("/v1/attempts")) requested.push(url);
    };
    server.events.on("request:start", onRequest);
    try {
      render(mountTree(<RecentAttemptsCard />));
      await screen.findAllByTestId("recent-attempts-row");
      expect(requested).not.toHaveLength(0);
      expect(requested[0]!.searchParams.get("limit")).toBe("5");
    } finally {
      server.events.removeListener("request:start", onRequest);
    }
  });

  it("renders the empty-state copy when the wire returns no rows", async () => {
    setMockMeAttempts([]);
    render(mountTree(<RecentAttemptsCard />));
    expect(await screen.findByTestId("recent-attempts-empty")).toHaveTextContent(
      /no attempts yet/i,
    );
    expect(screen.queryByTestId("recent-attempts-row")).toBeNull();
  });

  it("renders the error state on a 500", async () => {
    setMockMeAttemptsStatus(500);
    render(mountTree(<RecentAttemptsCard />));
    expect(await screen.findByTestId("recent-attempts-error")).toHaveTextContent(
      /couldn’t load/i,
    );
  });

  it("clicking a row navigates to /attempts/{id}/result", async () => {
    setMockMeAttempts([makeAttempt(1)]);
    const user = userEvent.setup();
    render(mountTree(<RecentAttemptsCard />));
    const row = await screen.findByTestId("recent-attempts-row");
    await user.click(row);
    expect(routerPush).toHaveBeenLastCalledWith(`/attempts/${attemptId(1)}/result`);
  });

  it("pressing Enter on a focused row navigates", async () => {
    setMockMeAttempts([makeAttempt(2)]);
    const user = userEvent.setup();
    render(mountTree(<RecentAttemptsCard />));
    const row = await screen.findByTestId("recent-attempts-row");
    row.focus();
    await user.keyboard("{Enter}");
    expect(routerPush).toHaveBeenLastCalledWith(`/attempts/${attemptId(2)}/result`);
  });

  it("renders null competence_delta as '—' in --ink-3", async () => {
    setMockMeAttempts([makeAttempt(1, { competence_delta: null })]);
    render(mountTree(<RecentAttemptsCard />));
    const delta = await screen.findByTestId("recent-attempts-row-delta");
    expect(delta).toHaveTextContent("—");
    expect(delta).toHaveStyle({ color: "var(--ink-3)" });
  });
});
