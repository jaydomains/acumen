import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Legend } from "@/components/profile/legend";

afterEach(() => cleanup());

const ALL_FIVE = {
  novice: 1,
  junior: 2,
  working: 3,
  advanced: 4,
  expert: 5,
};

describe("Legend", () => {
  it("renders one row per band with the supplied count", () => {
    render(<Legend counts={ALL_FIVE} />);
    expect(screen.getByTestId("legend-band-novice")).toHaveTextContent(/Novice.*1/);
    expect(screen.getByTestId("legend-band-junior")).toHaveTextContent(/Junior.*2/);
    expect(screen.getByTestId("legend-band-working")).toHaveTextContent(/Working.*3/);
    expect(screen.getByTestId("legend-band-advanced")).toHaveTextContent(/Advanced.*4/);
    expect(screen.getByTestId("legend-band-expert")).toHaveTextContent(/Expert.*5/);
  });

  it("renders the confidence-ring + safety-tagged legend rows", () => {
    render(<Legend counts={ALL_FIVE} />);
    expect(screen.getByTestId("legend-confidence")).toHaveTextContent(/Confidence ring/);
    expect(screen.getByTestId("legend-safety")).toHaveTextContent(/Safety-tagged/);
  });

  it("zero-counts render as 0 (not blank)", () => {
    render(
      <Legend counts={{ novice: 0, junior: 0, working: 0, advanced: 0, expert: 0 }} />,
    );
    expect(screen.getByTestId("legend-band-novice")).toHaveTextContent(/Novice.*0/);
  });
});
