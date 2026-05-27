import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ResultHero } from "@/components/result/result-hero";
import type { components } from "@/lib/api/types";

type AttemptResultResponse = components["schemas"]["AttemptResultResponse"];

afterEach(() => cleanup());

function makeResult(
  overrides: Partial<AttemptResultResponse> = {},
): AttemptResultResponse {
  return {
    attempt_id: "a-1",
    submitted_at: "2026-05-27T10:30:00Z",
    status: "ready",
    overall_score: 0.82,
    outcome: "pass",
    attempt_band: "working",
    competence_estimate_after: 6.4,
    competence_estimate_delta: 0.6,
    time_on_test_seconds: 1_440,
    median_time_seconds: 1_500,
    review_summary: {
      ai_grader_model: "claude-sonnet-4-5",
      reviewer_model: "openai gpt-4o-mini",
      flagged_count: 0,
      flagged_question_positions: [],
      review_duration_ms: 4_200,
    },
    pills: [],
    adaptive_loop: [],
    questions: [],
    ...overrides,
  };
}

describe("ResultHero", () => {
  it("renders the four stats + REVIEW COMPLETE banner with duration copy", () => {
    render(
      <ResultHero
        result={makeResult({
          questions: [
            {
              question_id: "q-1",
              question_type: "scenario",
              is_ai_graded: true,
              has_figure: false,
            },
          ],
        })}
        reviewVariant="complete"
      />,
    );
    expect(screen.getByText("82%")).toBeInTheDocument();
    expect(screen.getByText("+0.6")).toBeInTheDocument();
    expect(screen.getByText("24:00")).toBeInTheDocument();
    expect(screen.getByText("REVIEW COMPLETE")).toBeInTheDocument();
    expect(screen.getByText(/in 4.2s/)).toBeInTheDocument();
    expect(screen.getByText(/All 1 AI grade/)).toBeInTheDocument();
  });

  it("first-attempt path: null delta renders — with 'first attempt' hint", () => {
    render(
      <ResultHero
        result={makeResult({ competence_estimate_delta: null })}
        reviewVariant="complete_deterministic"
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("first attempt")).toBeInTheDocument();
  });

  it("benchmark mode: competence column hidden (AC-D5 / AC-D13)", () => {
    render(
      <ResultHero
        result={makeResult({ competence_estimate_delta: 0.6 })}
        reviewVariant="complete"
        isBenchmark
      />,
    );
    expect(screen.queryByText("COMPETENCE")).not.toBeInTheDocument();
  });

  it("REVIEW PENDING variant shows the ink-3 pulse dot + 'usually 4–8 seconds' meta", () => {
    render(
      <ResultHero
        result={makeResult({ status: "review_pending" })}
        reviewVariant="pending"
      />,
    );
    const dot = screen.getByTestId("review-status-dot");
    expect(dot.getAttribute("data-tone")).toBe("ink-3");
    expect(dot.classList.contains("pulse-dot")).toBe(true);
    expect(screen.getByText("usually 4–8 seconds")).toBeInTheDocument();
  });

  it("REVIEW PENDING overdue variant flips to warn tone", () => {
    render(
      <ResultHero
        result={makeResult({ status: "review_pending" })}
        reviewVariant="pending_overdue"
      />,
    );
    const dot = screen.getByTestId("review-status-dot");
    expect(dot.getAttribute("data-tone")).toBe("warn");
    expect(screen.getByText(/admin will review within ~5 min/)).toBeInTheDocument();
  });

  it("deterministic-only variant: 'No AI review needed'", () => {
    render(
      <ResultHero
        result={makeResult({ review_summary: null })}
        reviewVariant="complete_deterministic"
      />,
    );
    expect(screen.getByText("AUTO-GRADED")).toBeInTheDocument();
    expect(screen.getByText("No AI review needed")).toBeInTheDocument();
  });

  it("renders — when overall_score is null and time formats with h/m for long durations", () => {
    render(
      <ResultHero
        result={makeResult({ overall_score: null, time_on_test_seconds: 4_500 })}
        reviewVariant="complete_deterministic"
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("1h 15m")).toBeInTheDocument();
  });
});
