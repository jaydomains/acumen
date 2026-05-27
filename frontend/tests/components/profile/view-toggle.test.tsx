import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewToggle } from "@/components/profile/view-toggle";

afterEach(() => cleanup());

describe("ViewToggle", () => {
  it("renders both segments with the correct aria-pressed state for the active value", () => {
    render(<ViewToggle value="constellation" onChange={() => {}} />);
    const constellation = screen.getByRole("button", { name: /constellation/i });
    const matrix = screen.getByRole("button", { name: /matrix/i });
    expect(constellation).toHaveAttribute("aria-pressed", "true");
    expect(constellation).toHaveAttribute("data-active", "true");
    expect(matrix).toHaveAttribute("aria-pressed", "false");
    expect(matrix).toHaveAttribute("data-active", "false");
  });

  it("calls onChange('matrix') when the matrix segment is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ViewToggle value="constellation" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /matrix/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("matrix");
  });

  it("calls onChange('constellation') when the constellation segment is clicked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ViewToggle value="matrix" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /constellation/i }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("constellation");
  });

  it("exposes a role=group with an accessible name", () => {
    render(<ViewToggle value="constellation" onChange={() => {}} />);
    expect(screen.getByRole("group", { name: /profile view/i })).toBeInTheDocument();
  });
});
