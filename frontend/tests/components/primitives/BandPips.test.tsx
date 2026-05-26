import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BandPips } from "@/components/primitives/BandPips";
import { BAND_PIP_LEVEL, type Band } from "@/components/primitives/bands";

const BANDS: Band[] = ["novice", "junior", "working", "advanced", "expert"];

describe("BandPips", () => {
  it.each(BANDS)("renders the right pip fill count for band=%s", (band) => {
    render(<BandPips band={band} />);
    const pips = screen.getByTestId("band-pips").querySelectorAll("span");
    expect(pips).toHaveLength(5);

    const filled = Array.from(pips).filter(
      (p) => p.getAttribute("data-filled") === "true",
    );
    expect(filled).toHaveLength(BAND_PIP_LEVEL[band]);
  });

  it("colours the filled pips with bg-band-{band}", () => {
    render(<BandPips band="advanced" />);
    const filled = screen
      .getByTestId("band-pips")
      .querySelectorAll("[data-filled='true']");
    filled.forEach((pip) => {
      expect(pip.className).toContain("bg-band-advanced");
    });
  });

  it("outlines the remainder with bg-line", () => {
    render(<BandPips band="junior" />);
    const outlined = screen
      .getByTestId("band-pips")
      .querySelectorAll("[data-filled='false']");
    expect(outlined.length).toBe(5 - BAND_PIP_LEVEL.junior);
    outlined.forEach((pip) => {
      expect(pip.className).toContain("bg-line");
    });
  });
});
