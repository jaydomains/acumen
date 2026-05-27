/**
 * useIntegrity (FE-4 §B.1 §2 + §D.1) — AC-D4 layer #1 + #3.
 *
 * - Mounts the contextmenu / copy / paste / selectstart / cut /
 *   keydown listeners → all `preventDefault` on the relevant
 *   browser events.
 * - Sets `document.body.style.userSelect = 'none'` while mounted;
 *   restores on unmount.
 * - Counts tab-switches via `visibilitychange` outside pause windows.
 *
 * jsdom limitations: `document.visibilityState` is a getter on the
 * Document prototype; we override it per test via `defineProperty`.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useIntegrity } from "@/lib/attempts/use-integrity";

function setVisibility(state: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

afterEach(() => {
  setVisibility("visible");
  document.body.style.userSelect = "";
});

describe("useIntegrity · DOM deterrents (AC-D4 #1)", () => {
  it("installs `user-select: none` on body and restores on unmount", () => {
    document.body.style.userSelect = "text";
    const { unmount } = renderHook(() => useIntegrity({ paused: false }));
    expect(document.body.style.userSelect).toBe("none");
    unmount();
    expect(document.body.style.userSelect).toBe("text");
  });

  it("contextmenu / copy / paste / cut fire preventDefault", () => {
    renderHook(() => useIntegrity({ paused: false }));
    for (const type of ["contextmenu", "copy", "paste", "cut", "selectstart"]) {
      const event = new Event(type, { bubbles: true, cancelable: true });
      document.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
  });

  it("Ctrl/Cmd + c | v | x | a are suppressed via keydown", () => {
    renderHook(() => useIntegrity({ paused: false }));
    for (const key of ["c", "v", "x", "a"]) {
      const event = new KeyboardEvent("keydown", {
        key,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    // A non-shortcut key (no modifier) should NOT be prevented.
    const benign = new KeyboardEvent("keydown", {
      key: "c",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(benign);
    expect(benign.defaultPrevented).toBe(false);
  });
});

describe("useIntegrity · focus tracking (AC-D4 #3)", () => {
  it("increments tabSwitches on visibilitychange → hidden, outside pause", () => {
    const { result } = renderHook(() => useIntegrity({ paused: false }));
    expect(result.current.tabSwitches).toBe(0);
    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.tabSwitches).toBe(1);
    act(() => {
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.tabSwitches).toBe(2);
  });

  it("skips counter while paused (AC-D11 implication)", () => {
    const { result, rerender } = renderHook(({ paused }) => useIntegrity({ paused }), {
      initialProps: { paused: false },
    });
    rerender({ paused: true });
    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.tabSwitches).toBe(0);
  });

  it("resetTabSwitches clears the counter", () => {
    const { result } = renderHook(() => useIntegrity({ paused: false }));
    act(() => {
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.tabSwitches).toBe(1);
    act(() => result.current.resetTabSwitches());
    expect(result.current.tabSwitches).toBe(0);
  });
});
