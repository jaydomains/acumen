/**
 * Attempt runner page integration tests (FE-4 §B.1 §6 + §D.2).
 *
 * Mounts `(authed)/(testee)/attempts/[attemptId]/page.tsx` against
 * real MSW handlers seeded by the slice 1 fixture (3-question frozen
 * attempt at id `11111111-…-000000000001`).
 *
 * Covers slice 1 Gherkin trios:
 *   - Load + render Q1
 *   - MCQ click → debounced autosave (fires within 650 ms; no fire
 *     within 100 ms)
 *   - Realism flag idempotent (second click stays flagged; one POST
 *     per click against the MSW handler counter)
 *   - Watermark text shape
 *   - per_testee mode-guard placeholder rendered when test.mode flips
 *   - Image fields render null per AC-CD24
 *
 * Pause / submit / grading-overlay tests land in slice 2.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AttemptRunnerPage from "@/app/(authed)/(testee)/attempts/[attemptId]/page";
import { server } from "@/mocks/node";
import { getMockTest, mockAutosaveCalls, setMockTest } from "@/mocks/handlers";

const ATTEMPT_ID = "11111111-1111-1111-1111-000000000001";
const API = "http://localhost:8000";

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
  usePathname: () => `/attempts/${ATTEMPT_ID}`,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn(), success: vi.fn() }),
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
  mockAutosaveCalls.length = 0;
});

afterEach(() => {
  cleanup();
});

function attemptPage() {
  return <AttemptRunnerPage />;
}

describe("Attempt runner · load + render", () => {
  it("renders Q1 (MCQ) inside the focus-mode shell with watermark", async () => {
    render(mountTree(attemptPage()));
    await waitFor(() => expect(screen.getByTestId("attempt-shell")).toBeInTheDocument());
    expect(screen.getByTestId("question-mcq")).toBeInTheDocument();
    const watermark = screen.getByTestId("attempt-watermark");
    // 72 cells with the same text — first cell carries "Joana · ACUMEN".
    expect(watermark.textContent).toContain("Joana");
    expect(watermark.textContent).toContain("ACUMEN");
    expect(watermark.textContent).toContain("ATTEMPT 1111111");
  });

  it("AC-CD24: question carries no <img> (figure stubs return null)", async () => {
    render(mountTree(attemptPage()));
    await waitFor(() => expect(screen.getByTestId("question-view")).toBeInTheDocument());
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("Attempt runner · MCQ click → debounced autosave", () => {
  it("no POST fires within 100ms; one POST fires by 650ms", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(mountTree(attemptPage()));
    await waitFor(() => expect(screen.getByTestId("question-mcq")).toBeInTheDocument());
    await user.click(screen.getByTestId("question-mcq-option-1"));

    // 100 ms — debounce window not elapsed
    await vi.advanceTimersByTimeAsync(100);
    expect(mockAutosaveCalls.length).toBe(0);

    // 650 ms — debounce (600 ms) has elapsed, one save fires
    await vi.advanceTimersByTimeAsync(600);
    await waitFor(() => expect(mockAutosaveCalls.length).toBe(1));
    expect(mockAutosaveCalls[0]).toMatchObject({
      attempt_id: ATTEMPT_ID,
      answer_payload: { choice: 1 },
    });
    vi.useRealTimers();
  });
});

describe("Attempt runner · realism flag idempotent", () => {
  it("first click POSTs and toggles to flagged; second click POSTs and stays flagged", async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.post(
        `${API}/v1/attempts/:attemptId/questions/:questionId/flag-realism`,
        () => {
          calls += 1;
          return HttpResponse.json({
            realism_flag_id: "flag-1",
            question_id: "q",
            testee_id: "t",
            created: calls === 1,
          });
        },
      ),
    );
    render(mountTree(attemptPage()));
    const btn = await screen.findByTestId("flag-realism-button");
    await user.click(btn);
    await waitFor(() =>
      expect(screen.getByTestId("flag-realism-button")).toHaveAttribute("data-flagged"),
    );
    expect(calls).toBe(1);

    await user.click(screen.getByTestId("flag-realism-button"));
    await waitFor(() => expect(calls).toBe(2));
    // Stays flagged after the idempotent second click.
    expect(screen.getByTestId("flag-realism-button")).toHaveAttribute("data-flagged");
  });
});

describe("Attempt runner · mode-guards", () => {
  it("per_testee mounts the FE-5 streaming runner (JIT queue sidebar visible)", async () => {
    const t = getMockTest("22222222-2222-2222-2222-000000000001");
    if (!t) throw new Error("default test missing");
    setMockTest({ ...t, mode: "per_testee" });
    render(mountTree(attemptPage()));
    await waitFor(() => expect(screen.getByTestId("attempt-shell")).toBeInTheDocument());
    expect(screen.getByTestId("jit-queue")).toBeInTheDocument();
    expect(screen.queryByText(/Streaming mode coming soon/i)).toBeNull();
  });

  it("benchmark mounts the sequential runner (no autosave / no flag-realism)", async () => {
    const t = getMockTest("22222222-2222-2222-2222-000000000001");
    if (!t) throw new Error("default test missing");
    setMockTest({ ...t, mode: "benchmark" });
    render(mountTree(attemptPage()));
    await waitFor(() => expect(screen.getByTestId("attempt-shell")).toBeInTheDocument());
    // The benchmark "Next" button is present; FlagRealismButton is not.
    expect(screen.getByTestId("benchmark-next")).toBeInTheDocument();
    expect(screen.queryByTestId("flag-realism-button")).toBeNull();
    // AutosaveIndicator stays in idle (no per-question debounce queue).
    const indicator = screen.getByTestId("autosave-indicator");
    expect(indicator).toHaveAttribute("data-state", "idle");
  });
});
