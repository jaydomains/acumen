import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BandTag } from "@/components/primitives/BandTag";
import type { Band } from "@/components/primitives/bands";

const BANDS: { band: Band; label: string }[] = [
  { band: "novice", label: "Novice" },
  { band: "junior", label: "Junior" },
  { band: "working", label: "Working" },
  { band: "advanced", label: "Advanced" },
  { band: "expert", label: "Expert" },
];

describe("BandTag", () => {
  it.each(BANDS)("renders the $label label for band=$band", ({ band, label }) => {
    render(<BandTag band={band} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each(BANDS)("binds the bg-band-$band token class", ({ band }) => {
    const { container } = render(<BandTag band={band} />);
    const tag = container.querySelector(`[data-band="${band}"]`);
    expect(tag?.className).toContain(`bg-band-${band}`);
  });

  it("appends a one-decimal estimate per AC-D9 amendment", () => {
    render(<BandTag band="working" estimate={6.7} />);
    expect(screen.getByText(/Working \(6\.7\)/)).toBeInTheDocument();
  });

  it("formats integer estimates to one decimal place", () => {
    render(<BandTag band="working" estimate={7} />);
    expect(screen.getByText(/Working \(7\.0\)/)).toBeInTheDocument();
  });

  it("appends the calibration confidence qualifier per AC-D20", () => {
    render(<BandTag band="working" estimate={6.7} confidence="preliminary" />);
    expect(screen.getByText(/Working \(6\.7\) · preliminary/)).toBeInTheDocument();
  });

  it("supports a confident qualifier", () => {
    render(<BandTag band="advanced" estimate={8.2} confidence="confident" />);
    expect(screen.getByText(/Advanced \(8\.2\) · confident/)).toBeInTheDocument();
  });

  it("renders 5 pips when withPips is true", () => {
    const { container } = render(<BandTag band="working" withPips />);
    const pips = container.querySelectorAll("[data-band='working'] > span.ml-1 > span");
    expect(pips).toHaveLength(5);
  });

  it("renders no label when withLabel is false", () => {
    const { container } = render(<BandTag band="advanced" withLabel={false} withPips />);
    expect(container.textContent).toBe("");
  });
});
