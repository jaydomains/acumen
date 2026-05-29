/**
 * VerdictTile — label/score rendering, selected aria + check icon,
 * onSelect firing, disabled guard (FE-9 admin-ops §B.2 / §D.1).
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VerdictTile } from "@/components/admin/verdict-tile";

describe("VerdictTile", () => {
  it("renders the label + score, unselected by default", () => {
    render(
      <VerdictTile label="Partial" score={0.6} selected={false} onSelect={() => {}} />,
    );
    const tile = screen.getByRole("radio", { name: "Partial · 0.6" });
    expect(tile).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Partial")).toBeInTheDocument();
    expect(screen.getByText("0.6")).toBeInTheDocument();
  });

  it("selected: aria-checked=true", () => {
    render(<VerdictTile label="Full" score={1} selected onSelect={() => {}} />);
    expect(screen.getByRole("radio", { name: "Full · 1.0" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("clicking fires onSelect", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<VerdictTile label="None" score={0} selected={false} onSelect={onSelect} />);
    await user.click(screen.getByRole("radio", { name: "None · 0.0" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("disabled blocks onSelect", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <VerdictTile
        label="Full"
        score={1}
        selected={false}
        disabled
        onSelect={onSelect}
      />,
    );
    const tile = screen.getByRole("radio", { name: "Full · 1.0" });
    expect(tile).toBeDisabled();
    await user.click(tile);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
