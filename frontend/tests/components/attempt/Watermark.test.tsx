/**
 * Watermark (FE-4 §B.1 §2 — AC-D4 #2 + §D.1).
 *
 * Asserts the text shape "name · ACUMEN · YYYY-MM-DD · ATTEMPT <7>"
 * and the 12 × 6 = 72 span grid; aria-hidden so screen-readers
 * skip the integrity layer.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Watermark } from "@/components/attempt/Watermark";

afterEach(() => cleanup());

describe("Watermark", () => {
  it("renders 72 spans with the expected text shape", () => {
    render(
      <Watermark
        userName="Joana"
        attemptId="abcdef1-2345-6789-aaaa-000000000000"
        dateOverride="2026-05-27"
      />,
    );
    const root = screen.getByTestId("attempt-watermark");
    expect(root).toHaveAttribute("aria-hidden");
    const spans = root.querySelectorAll("span");
    expect(spans.length).toBe(72);
    expect(spans[0]?.textContent).toBe("Joana · ACUMEN · 2026-05-27 · ATTEMPT abcdef1");
  });
});
