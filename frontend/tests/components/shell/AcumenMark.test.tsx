import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AcumenMark } from "@/components/shell/AcumenMark";

describe("AcumenMark", () => {
  it("renders an SVG with the Acumen aria-label", () => {
    const { container } = render(<AcumenMark />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-label")).toBe("Acumen");
  });

  it("applies the requested size to width + height", () => {
    const { container } = render(<AcumenMark size={48} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("48");
    expect(svg?.getAttribute("height")).toBe("48");
  });

  it("defaults to currentColor fill on the apex", () => {
    const { container } = render(<AcumenMark />);
    const apex = container.querySelectorAll("circle")[0];
    expect(apex?.getAttribute("class") ?? "").toContain("fill-current");
  });

  it("uses the accent token when accent=true", () => {
    const { container } = render(<AcumenMark accent />);
    const apex = container.querySelectorAll("circle")[0];
    expect(apex?.getAttribute("class") ?? "").toContain("fill-accent");
  });
});
