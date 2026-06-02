/**
 * `/results` Latest-Result redirect tests (FE-2-shell §B.2 v1 nav, Slice 3).
 *
 * The page redirects to the most-recent submitted attempt's result, with an
 * honest empty state when there are none and a neutral error state on failure
 * (error ≠ empty). The freshness test guards DEC-S3-A: a warm-but-stale
 * {limit:1} cache entry must NOT redirect to a prior result — the mount-fresh
 * refetch + isFetchedAfterMount gate must win.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  resetMockMeAttempts,
  setMockMeAttempts,
  setMockMeAttemptsStatus,
} from "@/mocks/handlers";
import { meQueryKeys, type AttemptListItem, type AttemptsPage } from "@/lib/queries/me";
import LatestResultPage from "@/app/(authed)/(testee)/results/page";

const routerReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplace,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/results",
  useSearchParams: () => new URLSearchParams(),
}));

const attemptId = (n: number): string =>
  `cccccccc-cccc-cccc-cccc-${String(n).padStart(12, "0")}`;

const makeAttempt = (n: number, submitted_at: string): AttemptListItem => ({
  attempt_id: attemptId(n),
  pill_id: "11111111-1111-1111-1111-000000000aaa",
  pill_name: "Antifouling",
  submitted_at,
  score_percent: 70,
  band: "working",
  origin: "self_initiated",
  competence_delta: null,
});

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function mountWith(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <LatestResultPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  routerReplace.mockClear();
});

afterEach(() => {
  cleanup();
  resetMockMeAttempts();
});

describe("/results redirect", () => {
  it("redirects to the most-recent submitted attempt's result", async () => {
    setMockMeAttempts([
      makeAttempt(7, "2026-05-26T09:00:00Z"),
      makeAttempt(3, "2026-05-20T09:00:00Z"),
    ]);
    mountWith(newClient());
    await waitFor(() =>
      expect(routerReplace).toHaveBeenCalledWith(`/attempts/${attemptId(7)}/result`),
    );
    expect(routerReplace).toHaveBeenCalledTimes(1);
  });

  it("shows an honest empty state (no redirect) when there are no attempts", async () => {
    setMockMeAttempts([]);
    mountWith(newClient());
    expect(await screen.findByTestId("results-empty")).toBeInTheDocument();
    expect(screen.getByText(/no results yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /discover a pill/i })).toBeInTheDocument();
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it("shows a neutral error state (no redirect, not the empty copy) on failure", async () => {
    setMockMeAttemptsStatus(500);
    mountWith(newClient());
    expect(await screen.findByTestId("results-error")).toBeInTheDocument();
    expect(screen.getByText(/couldn't load your results/i)).toBeInTheDocument();
    expect(screen.queryByText(/no results yet/i)).toBeNull();
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it("redirects to the TRUE latest, not a stale cached entry (DEC-S3-A)", async () => {
    const client = newClient();
    // Pre-seed a stale {limit:1} entry pointing at an OLDER attempt.
    const stale: AttemptsPage = {
      data: [makeAttempt(1, "2026-05-01T09:00:00Z")],
      meta: { next_cursor: null },
    };
    client.setQueryData([...meQueryKeys.attempts(), "capped", { limit: 1 }], stale);
    // MSW returns a NEWER attempt; the mount-fresh refetch must win.
    setMockMeAttempts([makeAttempt(9, "2026-05-30T09:00:00Z")]);
    mountWith(client);
    await waitFor(() =>
      expect(routerReplace).toHaveBeenCalledWith(`/attempts/${attemptId(9)}/result`),
    );
    expect(routerReplace).not.toHaveBeenCalledWith(`/attempts/${attemptId(1)}/result`);
  });
});
