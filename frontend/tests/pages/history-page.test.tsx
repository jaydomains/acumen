/**
 * History-page Slice 1 integration tests (FE-7 §B.2 §5/§6).
 *
 * Covers the four top-level state branches that ship in Slice 1:
 * loading skeleton, endpoint_absent placeholder, empty fallback, and
 * a happy first-page stub. Full `HistoryTable` + sentinel pagination
 * land in Slice 4.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/history",
  useSearchParams: () => new URLSearchParams(),
}));

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
});

afterEach(() => cleanup());

describe("History page · loading skeleton", () => {
  it("renders the skeleton while the first-page fetch is in-flight", () => {
    render(mountTree(<HistoryPage />));
    expect(screen.getByTestId("history-skeleton")).toBeInTheDocument();
  });
});

describe("History page · happy first page", () => {
  it("renders hero + row placeholders for the first page (LOCK-1 envelope)", async () => {
    setMockMeAttempts([
      makeAttempt(1, { origin: "assignment_driven", pill_name: "Antifouling" }),
      makeAttempt(2, { origin: "loop_driven", pill_name: "DFT" }),
    ]);
    render(mountTree(<HistoryPage />));
    await waitFor(() => expect(screen.getByTestId("history-happy")).toBeInTheDocument());
    expect(screen.getByTestId("history-hero")).toHaveTextContent(
      /Your attempt history · 2 records/,
    );
    const rows = screen.getAllByTestId("history-row-placeholder");
    expect(rows).toHaveLength(2);
    // LOCK-4 — long-form origin enum values are rendered as-is.
    expect(rows[0]).toHaveAttribute("data-origin", "assignment_driven");
    expect(rows[1]).toHaveAttribute("data-origin", "loop_driven");
  });

  it("renders sentinel-pending marker when the first page reports more pages", async () => {
    setMockMeAttempts(Array.from({ length: 60 }, (_, i) => makeAttempt(i + 1)));
    render(mountTree(<HistoryPage />));
    await waitFor(() => expect(screen.getByTestId("history-happy")).toBeInTheDocument());
    expect(screen.getByTestId("history-sentinel-pending")).toBeInTheDocument();
    // Default limit is 50; 60 attempts → first page has 50 rows.
    expect(screen.getAllByTestId("history-row-placeholder")).toHaveLength(50);
  });
});

describe("History page · endpoint_absent", () => {
  it("renders the drift-placeholder card on 404 (no table mounts)", async () => {
    setMockMeAttemptsStatus(404);
    render(mountTree(<HistoryPage />));
    await waitFor(() =>
      expect(screen.getByTestId("history-endpoint-absent")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("history-row-placeholder")).toBeNull();
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
