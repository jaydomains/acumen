import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Stat } from "@/components/primitives/Stat";

describe("Stat", () => {
  it("renders value + label", () => {
    render(<Stat value={47} label="Attempts this week" />);
    expect(screen.getByText("47")).toBeInTheDocument();
    expect(screen.getByText("Attempts this week")).toBeInTheDocument();
  });

  it("renders hint when provided", () => {
    render(<Stat value="6.7" label="Working" hint="↑ 12 from last week" />);
    expect(screen.getByText("↑ 12 from last week")).toBeInTheDocument();
  });

  it("omits hint container when not provided", () => {
    const { container } = render(<Stat value={1} label="One" />);
    expect(container.textContent).toBe("1One");
  });

  it("applies the accent tone class to the value", () => {
    const { container } = render(<Stat value="6.7" label="Working" tone="accent" />);
    const valueEl = container.querySelector("[data-testid='stat-value']");
    expect(valueEl?.className).toContain("text-accent");
    expect(valueEl?.className).not.toContain("text-ink");
  });

  it("defaults to ink tone when no tone prop is given", () => {
    const { container } = render(<Stat value={1} label="One" />);
    const valueEl = container.querySelector("[data-testid='stat-value']");
    expect(valueEl?.className).toContain("text-ink");
  });

  it("accepts a string value (formatted by caller)", () => {
    render(<Stat value="6.7" label="Estimate" />);
    expect(screen.getByText("6.7")).toBeInTheDocument();
  });
});
