import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroStats } from "@/components/dashboard/HeroStats";

describe("HeroStats", () => {
  it("renders the greeting + name", () => {
    render(<HeroStats displayName="Jay" dateLabel="Tuesday, 26 May" />);
    expect(
      screen.getByRole("heading", { name: /welcome back, jay\./i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Tuesday, 26 May")).toBeInTheDocument();
  });

  it("renders three Stats with v1.x-pending placeholders (no real values)", () => {
    render(<HeroStats displayName="Jay" dateLabel="—" />);
    const values = screen.getAllByTestId("stat-value");
    expect(values).toHaveLength(3);
    values.forEach((v) => expect(v).toHaveTextContent("—"));
    // Labels lock the three required stats.
    expect(screen.getByText("OVERALL COMPETENCE")).toBeInTheDocument();
    expect(screen.getByText("PILLS AT WORKING+")).toBeInTheDocument();
    expect(screen.getByText("DAY STREAK")).toBeInTheDocument();
  });
});
