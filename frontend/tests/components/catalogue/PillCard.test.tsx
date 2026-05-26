import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PillCard } from "@/components/catalogue/PillCard";
import type { PillResponse } from "@/lib/queries/catalogue";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const basePill: PillResponse = {
  id: "pill-1",
  subject_id: "marine",
  name: "Antifouling Systems",
  description: "Top-side antifouling treatments.",
  available_difficulty_min: 2,
  available_difficulty_max: 9,
  discoverable: true,
  safety_relevant: false,
  safety_relevant_overridden_at: null,
  estimated_minutes: 8,
  retired_at: null,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

describe("PillCard", () => {
  it("renders the pill name + subject label + difficulty range + Practice CTA", () => {
    render(<PillCard pill={basePill} />);
    expect(screen.getByText("Antifouling Systems")).toBeInTheDocument();
    expect(screen.getByText("Marine Coatings")).toBeInTheDocument();
    expect(screen.getByText("D2–D9")).toBeInTheDocument();
    const cta = screen.getByTestId("pill-card-cta-pill-1");
    expect(cta).toHaveTextContent(/practice/i);
    expect(cta.getAttribute("href")).toBe("/pills/pill-1");
  });

  it("shows the Safety pill + 'Open links' CTA when safety_relevant", () => {
    render(
      <PillCard
        pill={{ ...basePill, id: "safe-1", safety_relevant: true, subject_id: "safety" }}
      />,
    );
    expect(screen.getByText("Safety")).toBeInTheDocument();
    expect(screen.getByTestId("pill-card-cta-safe-1")).toHaveTextContent(/open links/i);
  });

  it("renders the description when present and omits it cleanly when null", () => {
    const { rerender } = render(<PillCard pill={basePill} />);
    expect(screen.getByText("Top-side antifouling treatments.")).toBeInTheDocument();
    rerender(<PillCard pill={{ ...basePill, description: null }} />);
    expect(
      screen.queryByText("Top-side antifouling treatments."),
    ).not.toBeInTheDocument();
  });
});
