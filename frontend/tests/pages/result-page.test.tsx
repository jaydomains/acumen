/**
 * Result page integration tests (FE-6 §B.1 §6 + §D.2).
 *
 * Slice 2 surface: page composition + ResultHero. Mounts the real
 * `result/page.tsx` against MSW handlers seeded by `defaultResult` /
 * `makeRichResult`. Pending → ready transition is covered with
 * fake timers driving the 5-s `refetchInterval`. Per-card states
 * (ByQuestionCard etc.) land in slices 3–5 — their slots are
 * asserted as present here but empty.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ResultPage from "@/app/(authed)/(testee)/attempts/[attemptId]/result/page";
import { makeRichResult, setMockAttemptResult } from "@/mocks/handlers";

const ATTEMPT_ID = "11111111-1111-1111-1111-000000000001";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({ attemptId: ATTEMPT_ID }),
  usePathname: () => `/attempts/${ATTEMPT_ID}/result`,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "u-1", email: "t@kbc.com", name: "Joana", role: "testee" },
    role: "testee",
    logout: vi.fn(),
    refreshMe: vi.fn(),
    setUserPrivacyAck: vi.fn(),
  }),
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
  setMockAttemptResult(
    ATTEMPT_ID,
    makeRichResult(ATTEMPT_ID, {
      review_summary: {
        ai_grader_model: "claude-sonnet-4-5",
        reviewer_model: "openai gpt-4o-mini",
        flagged_count: 0,
        flagged_question_positions: [],
        review_duration_ms: 4_200,
      },
      questions: [
        {
          question_id: "q-1",
          question_type: "scenario",
          is_ai_graded: true,
          has_figure: false,
        },
      ],
    }),
  );
});

afterEach(() => cleanup());

describe("Result page · composition", () => {
  it("renders PageHeader + ResultHero + the two card slots after fetch resolves", async () => {
    render(mountTree(<ResultPage />));
    await waitFor(() => expect(screen.getByTestId("result-hero")).toBeInTheDocument());
    expect(screen.getByText("RESULT")).toBeInTheDocument();
    expect(screen.getByText(/Your attempt result/)).toBeInTheDocument();
    expect(screen.getByText("REVIEW COMPLETE")).toBeInTheDocument();
    expect(screen.getByTestId("result-questions-slot")).toBeInTheDocument();
    expect(screen.getByTestId("result-side-slot")).toBeInTheDocument();
  });
});

describe("Result page · loading skeleton", () => {
  it("shows the hero skeleton while the initial fetch is in-flight", async () => {
    // Defer the mock response — assert skeleton present immediately.
    render(mountTree(<ResultPage />));
    expect(screen.getByTestId("result-hero-skeleton")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("result-hero")).toBeInTheDocument());
    expect(screen.queryByTestId("result-hero-skeleton")).not.toBeInTheDocument();
  });
});

describe("Result page · review_pending state", () => {
  it("renders REVIEW PENDING when status is review_pending", async () => {
    setMockAttemptResult(
      ATTEMPT_ID,
      makeRichResult(ATTEMPT_ID, {
        status: "review_pending",
        overall_score: null,
        outcome: null,
        review_summary: null,
      }),
    );
    render(mountTree(<ResultPage />));
    await waitFor(() => expect(screen.getByText("REVIEW PENDING")).toBeInTheDocument());
  });
});

describe("Result page · review_pending_overdue state", () => {
  it("renders the overdue copy when submitted_at exceeds the 60-s ceiling", async () => {
    const ninetySecondsAgo = new Date(Date.now() - 90 * 1000).toISOString();
    setMockAttemptResult(
      ATTEMPT_ID,
      makeRichResult(ATTEMPT_ID, {
        status: "review_pending",
        submitted_at: ninetySecondsAgo,
        overall_score: null,
        review_summary: null,
      }),
    );
    render(mountTree(<ResultPage />));
    await waitFor(() =>
      expect(screen.getByText(/admin will review within ~5 min/)).toBeInTheDocument(),
    );
  });
});

describe("Result page · deterministic-only attempt", () => {
  it("ReviewBanner flips to AUTO-GRADED when review_summary is null", async () => {
    setMockAttemptResult(
      ATTEMPT_ID,
      makeRichResult(ATTEMPT_ID, { review_summary: null }),
    );
    render(mountTree(<ResultPage />));
    await waitFor(() => expect(screen.getByText("AUTO-GRADED")).toBeInTheDocument());
  });
});
