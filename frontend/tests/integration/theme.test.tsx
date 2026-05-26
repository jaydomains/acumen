/**
 * Theme bootstrap integration (FE-2 §C.2, §D.5).
 *
 * The inline <head> script must:
 *   - apply `data-theme="carbon"` when localStorage["acumen.theme"] === "carbon"
 *     before React hydrates;
 *   - leave the server-set default in place when no value is stored;
 *   - ignore invalid values (e.g. legacy "steel") and fall back to the
 *     server default;
 *   - stay under the 300-byte budget so the synchronous <head> insertion
 *     doesn't block paint.
 *
 * jsdom does not auto-execute inline <script> tags rendered through React,
 * so the test runs the exported bootstrap source directly via the Function
 * constructor — same code, deterministic execution context.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { THEME_BOOTSTRAP_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme/bootstrap";

function runBootstrap() {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(THEME_BOOTSTRAP_SCRIPT)();
}

describe("theme bootstrap script", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-theme", "paper");
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("stays under the 300-byte budget", () => {
    expect(THEME_BOOTSTRAP_SCRIPT.length).toBeLessThanOrEqual(300);
  });

  it("uses the canonical localStorage key", () => {
    expect(THEME_BOOTSTRAP_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_STORAGE_KEY).toBe("acumen.theme");
  });

  it("leaves the server default in place when no preference is stored", () => {
    runBootstrap();
    expect(document.documentElement.getAttribute("data-theme")).toBe("paper");
  });

  it("applies the stored carbon preference", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "carbon");
    runBootstrap();
    expect(document.documentElement.getAttribute("data-theme")).toBe("carbon");
  });

  it("re-applies an explicit paper preference (no-op visually)", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "paper");
    runBootstrap();
    expect(document.documentElement.getAttribute("data-theme")).toBe("paper");
  });

  it("ignores invalid stored values and keeps the server default", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "steel");
    runBootstrap();
    expect(document.documentElement.getAttribute("data-theme")).toBe("paper");
  });

  it("ignores empty / garbage stored values", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "");
    runBootstrap();
    expect(document.documentElement.getAttribute("data-theme")).toBe("paper");

    localStorage.setItem(THEME_STORAGE_KEY, "<script>");
    runBootstrap();
    expect(document.documentElement.getAttribute("data-theme")).toBe("paper");
  });

  it("does not throw when localStorage access is forbidden", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("localStorage forbidden (private browsing)");
      },
    });
    try {
      expect(() => runBootstrap()).not.toThrow();
      expect(document.documentElement.getAttribute("data-theme")).toBe("paper");
    } finally {
      if (original) {
        Object.defineProperty(window, "localStorage", original);
      }
    }
  });
});
