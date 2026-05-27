import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryTable } from "@/components/profile/history-table";
import type { AttemptListItem } from "@/lib/queries/me";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const PILL_ID = "11111111-1111-1111-1111-aaaaaaaaaaaa";
const attemptId = (n: number) => `cccccccc-cccc-cccc-cccc-${String(n).padStart(12, "0")}`;

const makeRow = (
  n: number,
  overrides: Partial<AttemptListItem> = {},
): AttemptListItem => ({
  attempt_id: attemptId(n),
  pill_id: PILL_ID,
  pill_name: `Pill ${n}`,
  submitted_at: `2026-05-${String(n).padStart(2, "0")}T09:00:00Z`,
  score_percent: 70,
  band: "working",
  origin: "self_initiated",
  competence_delta: null,
  ...overrides,
});

let observers: Array<{
  callback: IntersectionObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}> = [];

beforeEach(() => {
  observers = [];
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("HistoryTable", () => {
  it("renders the header row + one HistoryRow per supplied row", () => {
    const rows = [makeRow(1), makeRow(2), makeRow(3)];
    render(
      <HistoryTable
        rows={rows}
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadMore={() => {}}
      />,
    );
    expect(screen.getByText("When")).toBeInTheDocument();
    expect(screen.getByText("Pill")).toBeInTheDocument();
    expect(screen.getByText("Origin")).toBeInTheDocument();
    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByText("Band")).toBeInTheDocument();
    expect(screen.getByText("Δ comp")).toBeInTheDocument();
    expect(screen.getAllByTestId("history-row")).toHaveLength(3);
  });

  it("mounts the sentinel and observes it when hasNextPage is true", () => {
    render(
      <HistoryTable
        rows={[makeRow(1)]}
        hasNextPage={true}
        isFetchingNextPage={false}
        onLoadMore={() => {}}
      />,
    );
    expect(screen.getByTestId("history-sentinel")).toBeInTheDocument();
    expect(observers).toHaveLength(1);
    expect(observers[0]!.observe).toHaveBeenCalledTimes(1);
  });

  it("does NOT mount the sentinel when hasNextPage is false", () => {
    render(
      <HistoryTable
        rows={[makeRow(1)]}
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadMore={() => {}}
      />,
    );
    expect(screen.queryByTestId("history-sentinel")).toBeNull();
    expect(observers).toHaveLength(0);
  });

  it("intersection fires onLoadMore when not already fetching the next page", () => {
    const onLoadMore = vi.fn();
    render(
      <HistoryTable
        rows={[makeRow(1)]}
        hasNextPage={true}
        isFetchingNextPage={false}
        onLoadMore={onLoadMore}
      />,
    );
    expect(observers).toHaveLength(1);
    const observer = observers[0]!;
    // Simulate the sentinel entering the viewport.
    observer.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("intersection does NOT fire onLoadMore while a fetch is in-flight (no double-trigger on fast scroll)", () => {
    const onLoadMore = vi.fn();
    render(
      <HistoryTable
        rows={[makeRow(1)]}
        hasNextPage={true}
        isFetchingNextPage={true}
        onLoadMore={onLoadMore}
      />,
    );
    const observer = observers[0]!;
    observer.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("sentinel copy switches to 'Loading more…' while fetching the next page", () => {
    render(
      <HistoryTable
        rows={[makeRow(1)]}
        hasNextPage={true}
        isFetchingNextPage={true}
        onLoadMore={() => {}}
      />,
    );
    expect(screen.getByTestId("history-sentinel")).toHaveTextContent(/Loading more/i);
  });
});
