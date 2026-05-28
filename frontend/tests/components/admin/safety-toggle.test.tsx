/**
 * SafetyToggle — on/off rendering, disabled mode, onChange firing
 * (FE-8 catalogue §D.1 :1232).
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SafetyToggle } from "@/components/admin/safety-toggle";

describe("SafetyToggle", () => {
  it("off state: standard copy + aria-checked=false", () => {
    render(<SafetyToggle on={false} onChange={() => {}} />);

    const sw = screen.getByRole("switch", { name: "Safety-relevant" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Standard — AI explainer enabled")).toBeInTheDocument();
    expect(screen.getByText(/Acumen generates a learning material/)).toBeInTheDocument();
  });

  it("on state: safety copy + aria-checked=true", () => {
    render(<SafetyToggle on={true} onChange={() => {}} />);

    const sw = screen.getByRole("switch", { name: "Safety-relevant" });
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByText("Safety-relevant — no AI teaching material"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Curated industry links served via the safety-pill viewer/),
    ).toBeInTheDocument();
  });

  it("clicking the switch fires onChange with the negated value", async () => {
    const onChange = vi.fn<(next: boolean) => void>();
    const user = userEvent.setup();
    render(<SafetyToggle on={false} onChange={onChange} />);

    await user.click(screen.getByRole("switch", { name: "Safety-relevant" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("disabled blocks onChange on click", async () => {
    const onChange = vi.fn<(next: boolean) => void>();
    const user = userEvent.setup();
    render(<SafetyToggle on={false} disabled onChange={onChange} />);

    const sw = screen.getByRole("switch", { name: "Safety-relevant" });
    expect(sw).toBeDisabled();
    await user.click(sw);
    expect(onChange).not.toHaveBeenCalled();
  });
});
