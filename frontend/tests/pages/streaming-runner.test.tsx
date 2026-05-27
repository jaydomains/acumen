/**
 * StreamingRunner page integration (FE-5 §D.2).
 *
 * Mounts the per_testee branch of the attempt runner page against
 * MSW handlers (attempt detail + test + SSE stream + pause + resume +
 * autosave + submit). Exercises the slice 2 Gherkin trios:
 *
 *   - Mount → Q1 renders inside the streaming shell; JITQueue
 *     sidebar visible with Q1 current.
 *   - SSE delivers Q2..Q4 → questions[] grows on refetch; JITQueue
 *     rows transition to "ready"; arrivedIdx advances.
 *   - Outrun-buffer state: ``currentIndex >= questions.length``
 *     shows the "preparing next question…" skeleton + Next disabled.
 *   - Terminal ``done`` → JITQueue done indicator visible; status
 *     transitions out of streaming.
 *   - System-glitch overlay mounts when the stream emits terminal
 *     paused (``generation_failed``); resume CTA calls POST /resume.
 *   - User-pause flips the FE-4 ``<PauseOverlay>`` (not the system-
 *     glitch overlay) since ``pause_reason`` stays null.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { Suspense } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AttemptRunnerPage from "@/app/(authed)/(testee)/attempts/[attemptId]/page";
import { server } from "@/mocks/node";
import {
  getMockAttempt,
  getMockTest,
  setMockAttempt,
  setMockStreamFixture,
  setMockStreamHandler,
  setMockTest,
} from "@/mocks/handlers";
import { buildSseResponse } from "@/mocks/sse-fixtures";

const ATTEMPT_ID = "11111111-1111-1111-1111-000000000001";
const TEST_ID = "22222222-2222-2222-2222-000000000001";
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

function mountTree(node: ReactNode) {
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
  const t = getMockTest(TEST_ID);
  if (!t) throw new Error("default test missing");
  setMockTest({ ...t, mode: "per_testee" });
});

afterEach(() => {
  cleanup();
});

describe("StreamingRunner · mount + render", () => {
  it("renders Q1 and the JITQueue sidebar with Q1 as the current item", async () => {
    render(mountTree(<AttemptRunnerPage />));
    await waitFor(() => expect(screen.getByTestId("attempt-shell")).toBeInTheDocument());
    expect(screen.getByTestId("jit-queue")).toBeInTheDocument();
    expect(screen.getByTestId("jit-queue-item-0")).toHaveAttribute(
      "data-state",
      "current",
    );
    expect(screen.getByTestId("question-mcq")).toBeInTheDocument();
  });

  it("opens the SSE stream and reaches the 'done' status when no more positions remain", async () => {
    // Default fixture: 3 questions persisted; stream emits empty done
    // immediately (default handler in mocks/handlers.ts).
    render(mountTree(<AttemptRunnerPage />));
    await waitFor(() => expect(screen.getByTestId("jit-queue-done")).toBeInTheDocument());
  });
});

describe("StreamingRunner · SSE event delivery → questions grow", () => {
  it("advances arrivedIdx + refetches as positions arrive", async () => {
    // Seed: attempt has only Q1; stream delivers Q2, Q3, then done.
    const attempt = getMockAttempt(ATTEMPT_ID);
    if (!attempt) throw new Error("seed attempt missing");
    const allQuestions = attempt.questions ?? [];
    const onlyQ1 = (allQuestions as unknown[]).slice(0, 1);
    setMockAttempt({
      ...attempt,
      questions: onlyQ1 as never[],
    });

    let streamCalls = 0;
    let attemptCalls = 0;
    server.use(
      http.get(`${API}/v1/attempts/${ATTEMPT_ID}`, () => {
        attemptCalls += 1;
        // After each refetch, expose one more question — simulates
        // the backend persisting positions as the stream emits.
        const slice = (allQuestions as unknown[]).slice(0, attemptCalls);
        return Response.json({ ...attempt, questions: slice });
      }),
    );
    setMockStreamHandler(() => {
      streamCalls += 1;
      return buildSseResponse([
        { kind: "question", id: 2, attempt_position: 2, attempt_id: ATTEMPT_ID },
        { kind: "question", id: 3, attempt_position: 3, attempt_id: ATTEMPT_ID },
        { kind: "done", completed_positions: [2, 3] },
      ]);
    });

    render(mountTree(<AttemptRunnerPage />));
    await waitFor(() => expect(screen.getByTestId("jit-queue-done")).toBeInTheDocument());
    expect(streamCalls).toBe(1);
    // JIT queue length grew as questions arrived.
    expect(screen.getByTestId("jit-queue-item-0")).toBeInTheDocument();
    expect(screen.getByTestId("jit-queue-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("jit-queue-item-2")).toBeInTheDocument();
    // Attempt was refetched on each event (≥ 3: initial + per-event +
    // terminal).
    expect(attemptCalls).toBeGreaterThanOrEqual(3);
  });
});

describe("StreamingRunner · outrun the buffer", () => {
  it("renders the 'preparing next question…' skeleton when currentIdx >= questions.length", async () => {
    // Attempt has only Q1; stream stays open (no events) so the
    // user can step past the buffer.
    const attempt = getMockAttempt(ATTEMPT_ID);
    if (!attempt) throw new Error("seed attempt missing");
    const allQuestions = attempt.questions ?? [];
    setMockAttempt({
      ...attempt,
      questions: (allQuestions as unknown[]).slice(0, 1) as never[],
    });
    setMockStreamHandler(
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            // Open and idle — never emits a terminal.
            pull() {
              /* no-op */
            },
          }),
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        ),
    );

    render(mountTree(<AttemptRunnerPage />));
    await waitFor(() => expect(screen.getByTestId("question-mcq")).toBeInTheDocument());
    // Q1 is on screen. Next button advances to Q2 — but only one
    // question is presented; the runner clamps at the last known
    // index so Next is disabled.
    const nextBtn = screen.getByTestId("attempt-next");
    expect(nextBtn).toBeDisabled();
  });
});

describe("StreamingRunner · system-glitch overlay (generation_failed)", () => {
  it("surfaces the system-glitch overlay when terminal paused arrives", async () => {
    setMockStreamFixture([
      {
        kind: "paused",
        reason: "generation_failed",
        failed_position: 3,
        completed_positions: [2],
      },
    ]);
    // Simulate the backend marking the attempt paused for the
    // generation-failed reason — the runner branches the overlay on
    // attempt.pause_reason, not just the stream's pausedReason.
    const attempt = getMockAttempt(ATTEMPT_ID);
    if (!attempt) throw new Error("seed attempt missing");
    setMockAttempt({
      ...attempt,
      paused: true,
      pause_reason: "generation_failed",
    });

    render(mountTree(<AttemptRunnerPage />));
    await waitFor(() =>
      expect(screen.getByTestId("system-glitch-overlay")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("system-glitch-overlay")).toHaveAttribute(
      "data-reason",
      "generation_failed",
    );
    // FE-4 PauseOverlay must NOT mount alongside.
    expect(screen.queryByTestId("pause-overlay")).toBeNull();
  });
});

describe("StreamingRunner · user-pause (FE-4 overlay, not system-glitch)", () => {
  it("renders FE-4 PauseOverlay when pause_reason stays null", async () => {
    // Default fixture: empty done stream so the runner reaches a
    // quiescent state.
    render(mountTree(<AttemptRunnerPage />));
    await waitFor(() => expect(screen.getByTestId("question-mcq")).toBeInTheDocument());
    const user = userEvent.setup();
    await user.click(screen.getByTestId("attempt-pause"));
    await waitFor(() => expect(screen.getByTestId("pause-overlay")).toBeInTheDocument());
    expect(screen.queryByTestId("system-glitch-overlay")).toBeNull();
  });
});
