/**
 * DifficultyRangeSlider — controlled component, min/max clamp,
 * disabled mode (FE-8 catalogue §D.1 :1231).
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DifficultyRangeSlider } from "@/components/admin/difficulty-range-slider";

describe("DifficultyRangeSlider", () => {
  it("renders 10 D-segments with the in-range ones aria-pressed", () => {
    render(<DifficultyRangeSlider min={3} max={7} onChange={() => {}} />);

    for (let n = 1; n <= 10; n++) {
      const btn = screen.getByRole("button", { name: `D${n}` });
      expect(btn).toHaveAttribute("aria-pressed", n >= 3 && n <= 7 ? "true" : "false");
    }
  });

  it("renders min/max readouts that reflect the current range", () => {
    render(<DifficultyRangeSlider min={2} max={8} onChange={() => {}} />);
    expect(screen.getByText("min D2")).toBeInTheDocument();
    expect(screen.getByText("max D8")).toBeInTheDocument();
  });

  it("clicking below the range extends the min handle", async () => {
    const onChange = vi.fn<(next: { min: number; max: number }) => void>();
    const user = userEvent.setup();
    render(<DifficultyRangeSlider min={5} max={8} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "D2" }));
    expect(onChange).toHaveBeenCalledWith({ min: 2, max: 8 });
  });

  it("clicking above the range extends the max handle", async () => {
    const onChange = vi.fn<(next: { min: number; max: number }) => void>();
    const user = userEvent.setup();
    render(<DifficultyRangeSlider min={3} max={6} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "D9" }));
    expect(onChange).toHaveBeenCalledWith({ min: 3, max: 9 });
  });

  it("clamps a min > max input pair without going inverted on render", () => {
    // Inconsistent prop pair (e.g. mid-typing in a form) — render must
    // not show an inverted band.
    render(<DifficultyRangeSlider min={8} max={3} onChange={() => {}} />);
    // hi clamps to max(lo, 3) = 8, so the band collapses to D8 only.
    expect(screen.getByRole("button", { name: "D8" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "D3" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("disabled mode blocks onChange when buttons are clicked", async () => {
    const onChange = vi.fn<(next: { min: number; max: number }) => void>();
    const user = userEvent.setup();
    render(<DifficultyRangeSlider min={3} max={7} disabled onChange={onChange} />);

    const d9 = screen.getByRole("button", { name: "D9" });
    expect(d9).toBeDisabled();

    // userEvent skips disabled clicks; force-call to confirm guard.
    await user.click(d9);
    expect(onChange).not.toHaveBeenCalled();
  });
});
