/**
 * ResumePrompt + useResumeDetection (FE-4 §B.3 §6).
 *
 * Covers: no key → no modal; valid key → modal renders; submitted
 * attempt → silently cleared; Discard → clears localStorage + un-
 * mounts; Resume → router push to /attempts/<id>.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResumePrompt } from "@/components/dashboard/ResumePrompt";
import {
  setInflightAttemptId,
  clearInflightAttemptId,
} from "@/lib/attempts/resume-detection";
import { setMockAttempt, getMockAttempt } from "@/mocks/handlers";

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
  clearInflightAttemptId();
});

afterEach(() => cleanup());

describe("ResumePrompt", () => {
  it("no inflight key → prompt not rendered", async () => {
    render(mountTree(<ResumePrompt />));
    // No flash; allow a tick for any settle.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("resume-prompt")).toBeNull();
  });

  it("valid in-flight key → prompt renders with attempt summary", async () => {
    setInflightAttemptId(ATTEMPT_ID);
    render(mountTree(<ResumePrompt />));
    await waitFor(() => expect(screen.getByTestId("resume-prompt")).toBeInTheDocument());
    expect(screen.getByText(/You have an attempt in progress/)).toBeInTheDocument();
  });

  it("submitted attempt → key cleared silently, prompt not rendered", async () => {
    setInflightAttemptId(ATTEMPT_ID);
    const attempt = getMockAttempt(ATTEMPT_ID);
    if (!attempt) throw new Error("fixture missing");
    setMockAttempt({ ...attempt, submitted_at: "2026-05-27T10:30:00Z" });
    render(mountTree(<ResumePrompt />));
    await waitFor(() =>
      expect(localStorage.getItem("acumen.attempts.inflight")).toBeNull(),
    );
    expect(screen.queryByTestId("resume-prompt")).toBeNull();
  });

  it("Resume click routes to /attempts/<id>", async () => {
    const user = userEvent.setup();
    setInflightAttemptId(ATTEMPT_ID);
    render(mountTree(<ResumePrompt />));
    await waitFor(() => expect(screen.getByTestId("resume-prompt")).toBeInTheDocument());
    await user.click(screen.getByTestId("resume-prompt-resume"));
    expect(mockedRouter.push).toHaveBeenCalledWith(`/attempts/${ATTEMPT_ID}`);
  });

  it("Discard clears localStorage + un-mounts the prompt", async () => {
    const user = userEvent.setup();
    setInflightAttemptId(ATTEMPT_ID);
    render(mountTree(<ResumePrompt />));
    await waitFor(() => expect(screen.getByTestId("resume-prompt")).toBeInTheDocument());
    await user.click(screen.getByTestId("resume-prompt-discard"));
    await waitFor(() => expect(screen.queryByTestId("resume-prompt")).toBeNull());
    expect(localStorage.getItem("acumen.attempts.inflight")).toBeNull();
  });
});
