/**
 * History-page integration tests (FE-7 §B.2 §5/§6).
 *
 * Slice 1 covered the top-level state branches against stub row
 * placeholders; Slice 4 ships the real `HistoryTable` + sentinel
 * pagination. Tests below assert end-to-end: state branches +
 * row-click navigation + IntersectionObserver-driven cursor flow.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import HistoryPage from "@/app/(authed)/(testee)/history/page";
import {
  resetMockMeAttempts,
  setMockMeAttempts,
  setMockMeAttemptsStatus,
} from "@/mocks/handlers";
import type { AttemptListItem } from "@/lib/queries/me";

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
  usePathname: () => "/history",
  useSearchParams: () => new URLSearchParams(),
}));

// IntersectionObserver stub — captures callbacks so tests can trigger
// intersections deterministically (jsdom has no native impl).
let observers: Array<{
  callback: IntersectionObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}> = [];

function installIntersectionObserverStub() {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      callback: IntersectionObserverCallback;
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      takeRecords = vi.fn().mockReturnValue([]);
      root = null;
      rootMargin = "";
      thresholds: ReadonlyArray<number> = [];
      constructor(cb: IntersectionObserverCallback) {
        this.callback = cb;
        observers.push({
          callback: cb,
          observe: this.observe,
          disconnect: this.disconnect,
        });
      }
    },
  );
}

const attemptId = (n: number): string =>
  `cccccccc-cccc-cccc-cccc-${String(n).padStart(12, "0")}`;
const PILL_A = "11111111-1111-1111-1111-aaaaaaaaaaaa";

const makeAttempt = (
  n: number,
  overrides: Partial<AttemptListItem> = {},
): AttemptListItem => ({
  attempt_id: attemptId(n),
  pill_id: PILL_A,
  pill_name: "Antifouling",
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
  observers = [];
  installIntersectionObserverStub();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("History page · loading skeleton", () => {
  it("renders the skeleton while the first-page fetch is in-flight", () => {
    render(mountTree(<HistoryPage />));
    expect(screen.getByTestId("history-skeleton")).toBeInTheDocument();
  });
});

describe("History page · happy first page", () => {
  it("renders hero + HistoryTable + one row per attempt (LOCK-1 envelope)", async () => {
    setMockMeAttempts([
      makeAttempt(1, { origin: "assignment_driven", pill_name: "Antifouling" }),
      makeAttempt(2, { origin: "loop_driven", pill_name: "DFT" }),
    ]);
    render(mountTree(<HistoryPage />));
    await waitFor(() => expect(screen.getByTestId("history-happy")).toBeInTheDocument());
    expect(screen.getByTestId("history-hero")).toHaveTextContent(
      /Your attempt history · 2 records/,
    );
    expect(screen.getByTestId("history-table")).toBeInTheDocument();
    const rows = screen.getAllByTestId("history-row");
    expect(rows).toHaveLength(2);
    // LOCK-4 — long-form origin enum values arrive on the data-attr.
    expect(rows[0]).toHaveAttribute("data-origin", "assignment_driven");
    expect(rows[1]).toHaveAttribute("data-origin", "loop_driven");
  });

  it("mounts the sentinel when the first page reports more pages, drops it when exhausted", async () => {
    // 60 attempts → page 1 has 50; meta.next_cursor non-null → sentinel mounts.
    setMockMeAttempts(Array.from({ length: 60 }, (_, i) => makeAttempt(i + 1)));
    render(mountTree(<HistoryPage />));
    await waitFor(() => expect(screen.getByTestId("history-happy")).toBeInTheDocument());
    expect(screen.getByTestId("history-sentinel")).toBeInTheDocument();
    expect(screen.getAllByTestId("history-row")).toHaveLength(50);
  });

  it("sentinel intersection drives fetchNextPage → second page rows append + sentinel drops when cursor is null", async () => {
    // 60 rows total: page 1 returns 50 + next_cursor=50; page 2 returns 10
    // + next_cursor=null.
    setMockMeAttempts(Array.from({ length: 60 }, (_, i) => makeAttempt(i + 1)));
    render(mountTree(<HistoryPage />));
    await waitFor(() => expect(screen.getByTestId("history-table")).toBeInTheDocument());
    expect(screen.getAllByTestId("history-row")).toHaveLength(50);
    expect(observers).toHaveLength(1);
    const observer = observers[0]!;
    // Simulate scroll: sentinel intersects → fetchNextPage kicks.
    observer.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    await waitFor(() => {
      expect(screen.getAllByTestId("history-row")).toHaveLength(60);
    });
    expect(screen.queryByTestId("history-sentinel")).toBeNull();
  });

  it("clicking a row router.push'es to /attempts/{attempt_id}/result (FE-6 destination)", async () => {
    setMockMeAttempts([makeAttempt(1)]);
    const user = userEvent.setup();
    render(mountTree(<HistoryPage />));
    await waitFor(() => expect(screen.getByTestId("history-row")).toBeInTheDocument());
    await user.click(screen.getByTestId("history-row"));
    expect(routerPush).toHaveBeenLastCalledWith(`/attempts/${attemptId(1)}/result`);
  });

  it("first-attempt rows (competence_delta === null) render the em-dash in --ink-3", async () => {
    setMockMeAttempts([makeAttempt(1, { competence_delta: null })]);
    render(mountTree(<HistoryPage />));
    await waitFor(() => expect(screen.getByTestId("history-row")).toBeInTheDocument());
    const delta = screen.getByTestId("history-row-delta");
    expect(delta).toHaveTextContent("—");
    expect(delta).toHaveStyle({ color: "var(--ink-3)" });
  });
});

describe("History page · load error", () => {
  it("renders a neutral error card (not 'coming in v1.x') on 404 (no table mounts)", async () => {
    setMockMeAttemptsStatus(404);
    render(mountTree(<HistoryPage />));
    await waitFor(() => expect(screen.getByTestId("history-error")).toBeInTheDocument());
    expect(screen.getByText(/couldn't load your attempt history/i)).toBeInTheDocument();
    expect(screen.queryByText(/coming in v1\.x/i)).toBeNull();
    expect(screen.queryByText(/light up/i)).toBeNull();
    expect(screen.queryByTestId("history-table")).toBeNull();
    expect(screen.queryByTestId("history-row")).toBeNull();
  });
});

describe("History page · empty", () => {
  it("renders the empty-state copy when the first page is empty", async () => {
    setMockMeAttempts([]);
    render(mountTree(<HistoryPage />));
    await waitFor(() => expect(screen.getByTestId("history-empty")).toBeInTheDocument());
    expect(screen.getByTestId("history-hero")).toHaveTextContent(
      /Your attempt history · 0 records/,
    );
  });
});
