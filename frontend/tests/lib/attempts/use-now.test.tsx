/**
 * useNow (FE-4 §B.1 §2 + §D.1) — 1 Hz tick, pause-aware.
 *
 * Uses vi.useFakeTimers() to advance the interval deterministically;
 * paused-true halts the underlying setInterval (no spurious ticks).
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useNow } from "@/lib/attempts/use-now";

describe("useNow", () => {
  it("returns Date.now() at mount and advances on each interval tick", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T10:00:00Z"));
    const { result } = renderHook(() => useNow({ tickMs: 1000 }));
    const t0 = result.current;
    expect(typeof t0).toBe("number");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current).toBeGreaterThanOrEqual(t0 + 1000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(result.current).toBeGreaterThanOrEqual(t0 + 4000);
    vi.useRealTimers();
  });

  it("paused: true does not advance the clock value", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T10:00:00Z"));
    const { result } = renderHook(() => useNow({ paused: true, tickMs: 1000 }));
    const t0 = result.current;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current).toBe(t0);
    vi.useRealTimers();
  });

  it("clears the interval on unmount", () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    const { unmount } = renderHook(() => useNow({ tickMs: 500 }));
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
    vi.useRealTimers();
  });
});
