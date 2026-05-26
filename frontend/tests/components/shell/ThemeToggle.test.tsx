/**
 * ThemeToggle covers (a) sun/moon glyph selection per current theme,
 * (b) click-flip mutates <html data-theme> + localStorage, (c) the
 * post-mount effect re-syncs from the DOM in case the FOUC script
 * overrode the SSR default before hydration, (d) localStorage failure
 * is silently swallowed (private-browsing safe).
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { THEME_STORAGE_KEY } from "@/lib/theme/bootstrap";

describe("ThemeToggle", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-theme", "paper");
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it("renders the sun glyph when the current theme is paper", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("data-theme-current")).toBe("paper");
    expect(button.getAttribute("aria-label")).toBe("Switch to carbon theme");
  });

  it("renders the moon glyph when the current theme is carbon", () => {
    document.documentElement.setAttribute("data-theme", "carbon");
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("data-theme-current")).toBe("carbon");
    expect(button.getAttribute("aria-label")).toBe("Switch to paper theme");
  });

  it("flips data-theme + writes localStorage on click", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("carbon");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("carbon");
  });

  it("round-trips paper ↔ carbon", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    await user.click(button);
    expect(document.documentElement.getAttribute("data-theme")).toBe("carbon");
    await user.click(button);
    expect(document.documentElement.getAttribute("data-theme")).toBe("paper");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("paper");
  });

  it("does not throw if localStorage.setItem is forbidden", async () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("private browsing");
    };
    try {
      const user = userEvent.setup();
      render(<ThemeToggle />);
      await user.click(screen.getByRole("button"));
      // DOM still updates even when persistence throws.
      expect(document.documentElement.getAttribute("data-theme")).toBe("carbon");
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
