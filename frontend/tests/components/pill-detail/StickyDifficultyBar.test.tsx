import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StickyDifficultyBar } from "@/components/pill-detail/StickyDifficultyBar";
import type { PillResponse } from "@/lib/queries/pills";

const basePill: PillResponse = {
  id: "p1",
  subject_id: "s",
  name: "Test",
  description: null,
  available_difficulty_min: 1,
  available_difficulty_max: 10,
  discoverable: true,
  safety_relevant: false,
  safety_relevant_overridden_at: null,
  estimated_minutes: 8,
  retired_at: null,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

describe("StickyDifficultyBar", () => {
  it("renders 10 difficulty buttons", () => {
    render(<StickyDifficultyBar pill={basePill} onStart={vi.fn()} />);
    for (let d = 1; d <= 10; d++) {
      expect(screen.getByTestId(`difficulty-D${d}`)).toBeInTheDocument();
    }
  });

  it("disables difficulties outside available_difficulty_range and enables those inside", () => {
    render(
      <StickyDifficultyBar
        pill={{ ...basePill, available_difficulty_min: 3, available_difficulty_max: 7 }}
        onStart={vi.fn()}
      />,
    );
    [1, 2, 8, 9, 10].forEach((d) => {
      expect(screen.getByTestId(`difficulty-D${d}`)).toBeDisabled();
    });
    [3, 4, 5, 6, 7].forEach((d) => {
      expect(screen.getByTestId(`difficulty-D${d}`)).toBeEnabled();
    });
  });

  it("seeds default from recommendedDifficulty when in range", () => {
    render(
      <StickyDifficultyBar pill={basePill} recommendedDifficulty={7} onStart={vi.fn()} />,
    );
    expect(screen.getByTestId("difficulty-D7").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("sticky-start-cta")).toHaveTextContent("Practice at D7");
  });

  it("falls back to mid-range when no recommendedDifficulty is provided", () => {
    render(
      <StickyDifficultyBar
        pill={{ ...basePill, available_difficulty_min: 2, available_difficulty_max: 8 }}
        onStart={vi.fn()}
      />,
    );
    // (2+8)/2 = 5
    expect(screen.getByTestId("difficulty-D5").getAttribute("data-active")).toBe("true");
  });

  it("clicking a difficulty updates band display + CTA", async () => {
    const user = userEvent.setup();
    render(
      <StickyDifficultyBar pill={basePill} recommendedDifficulty={5} onStart={vi.fn()} />,
    );
    await user.click(screen.getByTestId("difficulty-D8"));
    expect(screen.getByTestId("difficulty-D8").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("sticky-start-cta")).toHaveTextContent("Practice at D8");
    // bandFromScalar(8) → "advanced"
    expect(screen.getByText("Advanced")).toBeInTheDocument();
  });

  it("clicking 'Practice at D{n}' calls onStart with the selected difficulty", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(
      <StickyDifficultyBar pill={basePill} recommendedDifficulty={4} onStart={onStart} />,
    );
    await user.click(screen.getByTestId("sticky-start-cta"));
    expect(onStart).toHaveBeenCalledWith(4);
  });

  it("clamps recommendedDifficulty if outside available range (falls back to mid-range)", () => {
    render(
      <StickyDifficultyBar
        pill={{ ...basePill, available_difficulty_min: 3, available_difficulty_max: 7 }}
        recommendedDifficulty={9}
        onStart={vi.fn()}
      />,
    );
    expect(screen.getByTestId("difficulty-D5").getAttribute("data-active")).toBe("true");
  });
});
