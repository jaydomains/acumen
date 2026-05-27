/**
 * Attempt runner lifecycle integration (FE-4 slice 2 §B.1 §6).
 *
 * Exercises the pause + submit + grading + benchmark round-trips on
 * the real page mounted with MSW handlers. Slice 1 covered load /
 * autosave / flag; this file covers the lifecycle additions.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AttemptRunnerPage from "@/app/(authed)/(testee)/attempts/[attemptId]/page";
import { getMockTest, mockAutosaveCalls, setMockTest } from "@/mocks/handlers";

const ATTEMPT_ID = "11111111-1111-1111-1111-000000000001";

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
  useParams: () => ({ attemptId: ATTEMPT_ID }),
  usePathname: () => `/attempts/${ATTEMPT_ID}`,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/context", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: {
      id: "00000000-0000-0000-0000-000000000001",
      email: "dev@example.com",
      name: "Joana",
      role: "testee",
      status: "active",
      privacy_ack_at: "2026-05-01T00:00:00Z",
      created_at: "2026-05-01T00:00:00Z",
    },
    privacy_ack_at: "2026-05-01T00:00:00Z",
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
  mockedRouter.push.mockClear();
});

afterEach(() => cleanup());

describe("Pause / resume lifecycle (frozen)", () => {
  it("Pause click POSTs /pause, mounts the overlay, hides the question; Resume restores", async () => {
    const user = userEvent.setup();
    render(mountTree(<AttemptRunnerPage />));
    await waitFor(() => expect(screen.getByTestId("attempt-pause")).toBeInTheDocument());
    await user.click(screen.getByTestId("attempt-pause"));
    await waitFor(() => expect(screen.getByTestId("pause-overlay")).toBeInTheDocument());
    // TimerPill flips to paused mode.
    expect(screen.getByTestId("timer-pill")).toHaveAttribute("data-mode", "paused");

    await user.click(screen.getByTestId("pause-overlay-resume"));
    await waitFor(() => expect(screen.queryByTestId("pause-overlay")).toBeNull());
  });
});

describe("Submit → GradingOverlay → result route (frozen)", () => {
  it("opens the confirm modal on the last question, then routes to the result placeholder", async () => {
    const user = userEvent.setup();
    render(mountTree(<AttemptRunnerPage />));
    await waitFor(() => expect(screen.getByTestId("attempt-next")).toBeInTheDocument());
    // Walk to the last question.
    await user.click(screen.getByTestId("attempt-next"));
    await user.click(screen.getByTestId("attempt-next"));
    // Now the submit button is in place of Next.
    await waitFor(() => expect(screen.getByTestId("attempt-submit")).toBeInTheDocument());
    await user.click(screen.getByTestId("attempt-submit"));
    await waitFor(() =>
      expect(screen.getByTestId("submit-confirm-modal")).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId("submit-confirm-action"));
    await waitFor(() =>
      expect(mockedRouter.push).toHaveBeenCalledWith(`/attempts/${ATTEMPT_ID}/result`),
    );
  });
});

describe("Benchmark sequential walk", () => {
  it("Next click POSTs /next; rendered question advances", async () => {
    const t = getMockTest("22222222-2222-2222-2222-000000000001");
    if (!t) throw new Error("default test missing");
    setMockTest({ ...t, mode: "benchmark" });
    const user = userEvent.setup();
    render(mountTree(<AttemptRunnerPage />));
    await waitFor(() => expect(screen.getByTestId("benchmark-next")).toBeInTheDocument());
    const initialQuestion = screen.getByTestId("question-view");
    const initialQid = initialQuestion.getAttribute("data-question-id");
    await user.click(screen.getByTestId("benchmark-next"));
    await waitFor(() => {
      const next = screen.getByTestId("question-view");
      expect(next.getAttribute("data-question-id")).not.toBe(initialQid);
    });
  });

  it("Next click autosaves the current answer before /next (Gitar #019e683d regression)", async () => {
    const t = getMockTest("22222222-2222-2222-2222-000000000001");
    if (!t) throw new Error("default test missing");
    setMockTest({ ...t, mode: "benchmark" });
    // Reset the slice-1 autosave call log so we can assert exactly
    // one autosave round-trip fires when the user answers + clicks
    // Next.
    mockAutosaveCalls.length = 0;
    const user = userEvent.setup();
    render(mountTree(<AttemptRunnerPage />));
    await waitFor(() =>
      expect(screen.getByTestId("question-mcq-option-0")).toBeInTheDocument(),
    );
    // Answer Q1 (MCQ option 0) — benchmark doesn't auto-debounce,
    // but the answer is saved when we click Next.
    await user.click(screen.getByTestId("question-mcq-option-0"));
    expect(mockAutosaveCalls.length).toBe(0);
    await user.click(screen.getByTestId("benchmark-next"));
    await waitFor(() => expect(mockAutosaveCalls.length).toBe(1));
    expect(mockAutosaveCalls[0]).toMatchObject({
      answer_payload: { choice: 0 },
    });
  });
});
