/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { scrollToQuestion } from "@/lib/result/scroll-to-question";

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("scrollToQuestion", () => {
  it("scrolls into view + flashes the matching row", () => {
    vi.useFakeTimers();
    const div = document.createElement("div");
    div.setAttribute("data-question-id", "7");
    const spy = vi.fn();
    div.scrollIntoView = spy as unknown as typeof div.scrollIntoView;
    document.body.appendChild(div);

    expect(scrollToQuestion(7)).toBe(true);

    expect(spy).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(div.classList.contains("flash")).toBe(true);

    vi.advanceTimersByTime(800);
    expect(div.classList.contains("flash")).toBe(false);
  });

  it("returns false when no row matches", () => {
    expect(scrollToQuestion("99")).toBe(false);
  });
});
