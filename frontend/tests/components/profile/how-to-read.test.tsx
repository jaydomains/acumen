import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HowToReadCard } from "@/components/profile/how-to-read";

afterEach(() => cleanup());

describe("HowToReadCard", () => {
  it("renders the eyebrow and 5 locked bullets in order", () => {
    render(<HowToReadCard />);
    expect(screen.getByTestId("how-to-read-card")).toBeInTheDocument();
    expect(screen.getByText(/How to read this/i)).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent(/Size.*competence/i);
    expect(items[1]).toHaveTextContent(/Colour.*band/i);
    expect(items[2]).toHaveTextContent(/Ring length.*calibration confidence/i);
    expect(items[3]).toHaveTextContent(/Lines.*related pills/i);
    expect(items[4]).toHaveTextContent(/Red dot.*safety-tagged/i);
  });
});
