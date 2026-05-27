/**
 * useAttempt reducer + autosave queue (FE-4 §C.3 / §C.4 / §D.1).
 *
 * Exercises: hydrate-from-cache; debounced autosave coalesces a
 * keystroke burst; retry with exponential backoff; persistent banner
 * on the 4th consecutive failure; pause-state suppresses autosave
 * scheduling; clearAfterSubmit drops the cache + resets the reducer.
 *
 * `executeAutosave` is a stub mutation — the reducer never reaches
 * for react-query.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAnswers, saveAnswers } from "@/lib/attempts/answers-cache";
import { useAttempt } from "@/lib/attempts/use-attempt";
import type { AnswerPayload } from "@/lib/attempts/answer-payloads";

const ATTEMPT_ID = "11111111-1111-1111-1111-000000000000";
const Q1 = "q1";
const Q2 = "q2";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  clearAnswers(ATTEMPT_ID);
});

function setupHook(opts?: {
  executeAutosave?: (input: {
    questionId: string;
    payload: AnswerPayload;
    timeMs: number;
  }) => Promise<void>;
  retryDelaysMs?: number[];
}) {
  const calls: { questionId: string; payload: AnswerPayload }[] = [];
  const executeAutosave = vi.fn(
    opts?.executeAutosave ??
      (async ({ questionId, payload }) => {
        calls.push({ questionId, payload });
      }),
  );
  const { result } = renderHook(() =>
    useAttempt({
      attemptId: ATTEMPT_ID,
      questionIds: [Q1, Q2],
      executeAutosave,
      debounceMs: 300,
      ...(opts?.retryDelaysMs ? { retryDelaysMs: opts.retryDelaysMs } : {}),
    }),
  );
  return { result, executeAutosave, calls };
}

describe("useAttempt · hydrate from cache", () => {
  it("seeds answers from localStorage on first mount", () => {
    saveAnswers(
      ATTEMPT_ID,
      new Map([[Q1, { type: "short_answer", text: "from cache" }]]),
    );
    const { result } = setupHook();
    expect(result.current.state.answers.get(Q1)).toEqual({
      type: "short_answer",
      text: "from cache",
    });
  });
});

describe("useAttempt · debounce coalesces a keystroke burst", () => {
  it("fires one autosave 300ms after the LAST set-answer in a burst", async () => {
    const { result, executeAutosave } = setupHook();
    act(() => {
      result.current.setAnswer(Q1, { type: "short_answer", text: "a" });
      result.current.setAnswer(Q1, { type: "short_answer", text: "ab" });
      result.current.setAnswer(Q1, { type: "short_answer", text: "abc" });
    });
    expect(executeAutosave).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(310);
    });
    expect(executeAutosave).toHaveBeenCalledTimes(1);
    expect(executeAutosave.mock.calls[0]?.[0]).toMatchObject({
      questionId: Q1,
      payload: { type: "short_answer", text: "abc" },
    });
  });

  it("debounce is per-question — Q1 and Q2 fire independently", async () => {
    const { result, executeAutosave } = setupHook();
    act(() => {
      result.current.setAnswer(Q1, { type: "true_false", answer: true });
      result.current.setAnswer(Q2, { type: "multiple_choice", choice: 0 });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(310);
    });
    expect(executeAutosave).toHaveBeenCalledTimes(2);
    const ids = executeAutosave.mock.calls.map((c) => c[0].questionId).sort();
    expect(ids).toEqual([Q1, Q2]);
  });
});

describe("useAttempt · autosave state machine", () => {
  it("transitions idle → saving → saved on success", async () => {
    let resolveFn: (() => void) | null = null;
    const executeAutosave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFn = resolve;
        }),
    );
    const { result } = setupHook({ executeAutosave });
    act(() => {
      result.current.setAnswer(Q1, { type: "true_false", answer: true });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(310);
    });
    expect(result.current.state.autosaveStates.get(Q1)).toBe("saving");
    await act(async () => {
      resolveFn?.();
      await Promise.resolve();
    });
    expect(result.current.state.autosaveStates.get(Q1)).toBe("saved");
    expect(result.current.state.autosaveAt.get(Q1)).toBeTypeOf("number");
  });

  it("autosave failure retries with the supplied delays, then surfaces banner on the 4th try", async () => {
    let attempts = 0;
    const executeAutosave = vi.fn(async () => {
      attempts += 1;
      throw new Error("network");
    });
    const { result } = setupHook({
      executeAutosave,
      retryDelaysMs: [1000, 2000, 4000],
    });
    act(() => {
      result.current.setAnswer(Q1, { type: "true_false", answer: true });
    });
    // debounce (300ms) → first attempt
    await act(async () => {
      await vi.advanceTimersByTimeAsync(310);
    });
    expect(attempts).toBe(1);
    expect(result.current.state.autosaveStates.get(Q1)).toBe("failed");
    expect(result.current.state.autosaveBannerVisible).toBe(false);

    // +1000ms → retry 1
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1010);
    });
    expect(attempts).toBe(2);
    // +2000ms → retry 2
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2010);
    });
    expect(attempts).toBe(3);
    // +4000ms → retry 3 (the 4th attempt overall) — banner fires
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4010);
    });
    expect(attempts).toBe(4);
    expect(result.current.state.autosaveRetries.get(Q1)).toBeGreaterThanOrEqual(4);
    expect(result.current.state.autosaveBannerVisible).toBe(true);
  });
});

describe("useAttempt · per-edit-window time_ms (Gitar #019e6823 regression)", () => {
  it("a revised answer reports time_ms from its own first keystroke, not the original", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T10:00:00Z"));
    const timeMsCalls: number[] = [];
    const executeAutosave = vi.fn(async ({ timeMs }) => {
      timeMsCalls.push(timeMs);
    });
    const { result } = setupHook({ executeAutosave });

    // First edit window: type at t=0, save fires at t=300 (debounce).
    act(() => {
      result.current.setAnswer(Q1, { type: "short_answer", text: "v1" });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(310);
    });
    expect(timeMsCalls[0]).toBeGreaterThanOrEqual(300);
    expect(timeMsCalls[0]).toBeLessThan(400);

    // Two minutes of inactivity, then a revision: type at t=120s,
    // save fires at t=120.3s. Without the answerStartedAt clear,
    // we'd report ~120300ms instead of ~300ms.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(120_000);
    });
    act(() => {
      result.current.setAnswer(Q1, { type: "short_answer", text: "v1-revised" });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(310);
    });
    expect(timeMsCalls[1]).toBeGreaterThanOrEqual(300);
    expect(timeMsCalls[1]).toBeLessThan(400);
    vi.useRealTimers();
  });
});

describe("useAttempt · pauseState gates autosave scheduling", () => {
  it("set-answer while paused records the answer but does NOT schedule a save", async () => {
    const { result, executeAutosave } = setupHook();
    act(() => result.current.pauseStart());
    act(() => result.current.pauseSuccess());
    act(() => {
      result.current.setAnswer(Q1, { type: "short_answer", text: "during pause" });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(executeAutosave).not.toHaveBeenCalled();
    expect(result.current.state.answers.get(Q1)).toEqual({
      type: "short_answer",
      text: "during pause",
    });
  });
});

describe("useAttempt · flag + advance + clear", () => {
  it("flagRealism populates the Set; advanceTo updates currentIndex", () => {
    const { result } = setupHook();
    act(() => {
      result.current.flagRealism(Q1);
      result.current.advanceTo(1);
    });
    expect(result.current.state.flaggedQuestions.has(Q1)).toBe(true);
    expect(result.current.state.currentIndex).toBe(1);
  });

  it("clearAfterSubmit drops the cache + resets the reducer", () => {
    const { result } = setupHook();
    act(() => {
      result.current.setAnswer(Q1, { type: "short_answer", text: "keep" });
    });
    act(() => result.current.clearAfterSubmit());
    expect(result.current.state.answers.size).toBe(0);
    expect(localStorage.getItem(`acumen.attempts.${ATTEMPT_ID}.answers`)).toBeNull();
  });
});

describe("useAttempt · cache write-through", () => {
  // Use real timers — waitFor is setTimeout-driven and fake timers
  // block it from advancing on its own.
  it("set-answer writes the answers Map to localStorage immediately", async () => {
    vi.useRealTimers();
    const { result } = setupHook();
    act(() => {
      result.current.setAnswer(Q1, { type: "multiple_choice", choice: 2 });
    });
    await waitFor(() => {
      const raw = localStorage.getItem(`acumen.attempts.${ATTEMPT_ID}.answers`);
      expect(raw).toContain('"choice":2');
    });
  });
});
