/**
 * GradingOverlay (FE-4 §B.1 §6 + plan amendment 2: 30-poll cap).
 *
 * Three trios:
 *   - happy path: poll fires, result becomes ready, router pushes
 *   - benchmark phase-4 copy: no recency-weighting wording
 *   - poll cap: after 30 polls without `ready`, the overlay swaps to
 *     a "Taking longer than expected" timeout card and stops polling
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GradingOverlay } from "@/components/attempt/GradingOverlay";
import { server } from "@/mocks/node";
import { setMockAttemptResult } from "@/mocks/handlers";

const ATTEMPT_ID = "11111111-1111-1111-1111-000000000001";
const API = "http://localhost:8000";

const mockedRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockedRouter,
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
  mockedRouter.push.mockClear();
});

afterEach(() => cleanup());

describe("GradingOverlay · happy path", () => {
  it("polls /result and routes to /attempts/<id>/result on status: ready", async () => {
    setMockAttemptResult(ATTEMPT_ID, {
      attempt_id: ATTEMPT_ID,
      submitted_at: "2026-05-27T10:30:00Z",
      status: "ready",
      overall_score: 0.9,
      outcome: "pass",
      pills: [],
      adaptive_loop: [],
      questions: null,
    });
    render(mountTree(<GradingOverlay attemptId={ATTEMPT_ID} mode="frozen" />));
    await waitFor(() =>
      expect(mockedRouter.push).toHaveBeenCalledWith(`/attempts/${ATTEMPT_ID}/result`),
    );
  });
});

describe("GradingOverlay · benchmark phase-4 copy", () => {
  it("renders the benchmark-mode phase-4 wording", async () => {
    setMockAttemptResult(ATTEMPT_ID, {
      attempt_id: ATTEMPT_ID,
      submitted_at: "2026-05-27T10:30:00Z",
      status: "review_pending",
      overall_score: null,
      outcome: null,
      pills: [],
      adaptive_loop: [],
      questions: null,
    });
    render(mountTree(<GradingOverlay attemptId={ATTEMPT_ID} mode="benchmark" />));
    await waitFor(() =>
      expect(
        screen.getByText(/Computing benchmark score \+ bands · no recency weighting/),
      ).toBeInTheDocument(),
    );
  });
});

describe("GradingOverlay · poll cap (45s)", () => {
  it("after 30 polls without ready, swaps to the timeout card", async () => {
    // Override the result handler to always return review_pending.
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/result`, () =>
        HttpResponse.json({
          attempt_id: ATTEMPT_ID,
          submitted_at: "2026-05-27T10:30:00Z",
          status: "review_pending",
        }),
      ),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(mountTree(<GradingOverlay attemptId={ATTEMPT_ID} mode="frozen" />));
    // Advance 50 seconds — well past the 45s cap (30 × 1.5s).
    await vi.advanceTimersByTimeAsync(50_000);
    vi.useRealTimers();

    await waitFor(() =>
      expect(screen.getByTestId("grading-overlay")).toHaveAttribute(
        "data-state",
        "timeout",
      ),
    );
    expect(screen.getByText(/Taking longer than expected/i)).toBeInTheDocument();
    expect(screen.getByTestId("grading-overlay-dashboard")).toBeInTheDocument();
  });

  it("the timeout-card 'Back to dashboard' button routes to /", async () => {
    server.use(
      http.get(`${API}/v1/attempts/:attempt_id/result`, () =>
        HttpResponse.json({
          attempt_id: ATTEMPT_ID,
          submitted_at: "2026-05-27T10:30:00Z",
          status: "review_pending",
        }),
      ),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(mountTree(<GradingOverlay attemptId={ATTEMPT_ID} mode="frozen" />));
    await vi.advanceTimersByTimeAsync(50_000);
    vi.useRealTimers();

    const user = userEvent.setup();
    await waitFor(() =>
      expect(screen.getByTestId("grading-overlay-dashboard")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("grading-overlay-dashboard"));
    expect(mockedRouter.push).toHaveBeenCalledWith("/");
  });
});
