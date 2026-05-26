/**
 * Icon — every name in the `IconName` union renders an <svg> with the
 * requested size and strokeWidth, and forwards passthrough props.
 * Sun / moon (FE-2 additions) are exercised explicitly to guard against
 * a regression that drops them during a future port from the prototype.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon, type IconName } from "@/components/primitives/Icon";

const ALL_NAMES: IconName[] = [
  "dashboard",
  "compass",
  "attempt",
  "graph",
  "constellation",
  "history",
  "users",
  "catalogue",
  "review",
  "cost",
  "loop",
  "shield",
  "flag",
  "sparkles",
  "lock",
  "eye",
  "eyeOff",
  "arrowRight",
  "arrowUp",
  "arrowDown",
  "check",
  "x",
  "plus",
  "search",
  "menu",
  "sliders",
  "pause",
  "clock",
  "book",
  "external",
  "spark",
  "link",
  "logout",
  "settings",
  "inbox",
  "wave",
  "sun",
  "moon",
];

describe("Icon", () => {
  it.each(ALL_NAMES)("renders an <svg> for name=%s", (name) => {
    const { container } = render(<Icon name={name} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe("16");
    expect(svg?.getAttribute("height")).toBe("16");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
    expect(svg?.getAttribute("stroke-width")).toBe("1.5");
  });

  it("applies a custom size and strokeWidth", () => {
    const { container } = render(<Icon name="check" size={32} strokeWidth={2} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("32");
    expect(svg?.getAttribute("height")).toBe("32");
    expect(svg?.getAttribute("stroke-width")).toBe("2");
  });

  it("forwards passthrough props to the <svg>", () => {
    const { container } = render(
      <Icon name="lock" className="text-accent" data-testid="lock-icon" />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toBe("text-accent");
    expect(svg?.getAttribute("data-testid")).toBe("lock-icon");
  });

  it("marks the svg aria-hidden when no aria-label is provided", () => {
    const { container } = render(<Icon name="dashboard" />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("drops aria-hidden when aria-label is supplied", () => {
    const { container } = render(<Icon name="dashboard" aria-label="Dashboard" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBeNull();
    expect(svg?.getAttribute("aria-label")).toBe("Dashboard");
  });

  it("renders the sun glyph (FE-2 addition)", () => {
    const { container } = render(<Icon name="sun" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.querySelector("circle")).not.toBeNull();
  });

  it("renders the moon glyph (FE-2 addition)", () => {
    const { container } = render(<Icon name="moon" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.querySelector("path")).not.toBeNull();
  });
});
