import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Sparkline } from "@/components/profile/sparkline";

afterEach(() => cleanup());

describe("Sparkline", () => {
  it("renders the em-dash placeholder when values is empty", () => {
    render(<Sparkline values={[]} band="working" />);
    expect(screen.getByTestId("sparkline-placeholder")).toBeInTheDocument();
    expect(screen.queryByTestId("sparkline")).toBeNull();
  });

  it("renders the em-dash placeholder when values has a single point (path needs ≥2)", () => {
    render(<Sparkline values={[5.0]} band="working" />);
    expect(screen.getByTestId("sparkline-placeholder")).toBeInTheDocument();
  });

  it("renders a path + fill + per-point dots when values has ≥2 points", () => {
    render(<Sparkline values={[3, 5, 6.5, 7, 7.5, 8]} band="advanced" />);
    expect(screen.getByTestId("sparkline")).toHaveAttribute("data-band", "advanced");
    expect(screen.getByTestId("sparkline-line")).toBeInTheDocument();
    expect(screen.getByTestId("sparkline-fill")).toBeInTheDocument();
    expect(screen.getAllByTestId("sparkline-dot")).toHaveLength(6);
  });

  it("uses the band token for stroke + fill colour", () => {
    render(<Sparkline values={[2, 8]} band="expert" />);
    expect(screen.getByTestId("sparkline-line")).toHaveAttribute(
      "stroke",
      "var(--band-expert)",
    );
    expect(screen.getByTestId("sparkline-fill")).toHaveAttribute(
      "fill",
      "var(--band-expert)",
    );
  });
});
