import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ByPillCard } from "@/components/result/by-pill-card";
import type { components } from "@/lib/api/types";

type ResultPill = components["schemas"]["ResultPill"];

afterEach(() => cleanup());

function p(overrides: Partial<ResultPill> = {}): ResultPill {
  return {
    pill_id: "p-1",
    pill_name: "Antifouling",
    subject_id: null,
    score_percent: 50,
    missed_count: null,
    total_count: null,
    band: null,
    competence_estimate: 4.2,
    n: 12,
    confidence: "preliminary",
    severity: "severe",
    is_safety_tagged: false,
    ...overrides,
  };
}

describe("ByPillCard", () => {
  it("hides entirely when pills array is empty", () => {
    const { container } = render(<ByPillCard pills={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("hides when pills is null/undefined", () => {
    const { container } = render(<ByPillCard pills={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one row per pill with severity chip + score bar", () => {
    render(
      <ByPillCard
        pills={[p({ pill_name: "Cathodic protection", severity: "critical" })]}
      />,
    );
    expect(screen.getByText("Cathodic protection")).toBeInTheDocument();
    expect(screen.getByText("CRITICAL")).toBeInTheDocument();
    expect(screen.getByTestId("pill-weakness-bar")).toBeInTheDocument();
  });

  it("preliminary confidence renders the underlined hint with tooltip", () => {
    render(<ByPillCard pills={[p({ confidence: "preliminary" })]} />);
    expect(screen.getByTestId("confidence-suffix")).toHaveTextContent("preliminary");
  });

  it("confident confidence renders plain text (no tooltip wrapper)", () => {
    render(<ByPillCard pills={[p({ confidence: "confident" })]} />);
    expect(screen.queryByTestId("confidence-suffix")).not.toBeInTheDocument();
    expect(screen.getByText(/confident/)).toBeInTheDocument();
  });

  it("safety-tagged pill carries the SAFETY badge (AC-D21)", () => {
    render(<ByPillCard pills={[p({ is_safety_tagged: true })]} />);
    expect(screen.getByText("SAFETY")).toBeInTheDocument();
  });

  it("null score_percent hides the bar but keeps the calibration suffix", () => {
    render(<ByPillCard pills={[p({ score_percent: null })]} />);
    expect(screen.queryByTestId("pill-weakness-bar")).not.toBeInTheDocument();
    expect(screen.getByText(/n=12/)).toBeInTheDocument();
  });

  it("renders the competence estimate to one decimal place", () => {
    render(<ByPillCard pills={[p({ competence_estimate: 6.789 })]} />);
    expect(screen.getByText(/6\.8/)).toBeInTheDocument();
  });
});
