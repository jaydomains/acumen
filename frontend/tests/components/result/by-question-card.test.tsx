import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ByQuestionCard } from "@/components/result/by-question-card";
import type { components } from "@/lib/api/types";

type ResultQuestion = components["schemas"]["ResultQuestion"];

afterEach(() => cleanup());

function q(overrides: Partial<ResultQuestion> = {}): ResultQuestion {
  return {
    question_id: overrides.question_id ?? `q-${overrides.attempt_position ?? "1"}`,
    attempt_position: 1,
    prompt_text: "What is X?",
    question_type: "multiple_choice",
    has_figure: false,
    is_ai_graded: false,
    status: null,
    response: null,
    grade: null,
    ...overrides,
  };
}

describe("ByQuestionCard · row state matrix", () => {
  it("deterministic correct → ✓ icon, no AI chip", () => {
    render(
      <ByQuestionCard
        questions={[
          q({
            grade: {
              is_correct: true,
              points_awarded: 1,
              points_possible: 1,
              source: "auto",
              ai_grader_model: null,
              ai_reasoning: null,
              review_verdict: null,
              review_reasoning: null,
              reviewer_model: null,
            },
          }),
        ]}
      />,
    );
    const icon = screen.getByTestId("row-icon");
    expect(icon.getAttribute("data-state")).toBe("correct");
    expect(icon).toHaveTextContent("✓");
    expect(screen.queryByText(/AI graded/i)).not.toBeInTheDocument();
  });

  it("deterministic incorrect → ✗ icon", () => {
    render(
      <ByQuestionCard
        questions={[
          q({
            grade: {
              is_correct: false,
              points_awarded: 0,
              points_possible: 1,
              source: "auto",
              ai_grader_model: null,
              ai_reasoning: null,
              review_verdict: null,
              review_reasoning: null,
              reviewer_model: null,
            },
          }),
        ]}
      />,
    );
    const icon = screen.getByTestId("row-icon");
    expect(icon.getAttribute("data-state")).toBe("incorrect");
    expect(icon).toHaveTextContent("✗");
  });

  it("AI-graded confirmed → 'AI graded' chip + expand reveals reasoning", async () => {
    const user = userEvent.setup();
    render(
      <ByQuestionCard
        questions={[
          q({
            question_type: "scenario",
            prompt_text: "Describe approach",
            is_ai_graded: true,
            response: { answer_payload: { text: "my essay answer" } },
            grade: {
              is_correct: true,
              points_awarded: 1,
              points_possible: 1,
              source: "ai",
              ai_grader_model: "claude-sonnet-4-5",
              ai_reasoning: "Strong rationale.",
              review_verdict: "confirmed",
              review_reasoning: "Concur.",
              reviewer_model: "openai gpt-4o-mini",
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText("AI graded")).toBeInTheDocument();
    await user.click(screen.getByTestId("question-grade-row").querySelector("button")!);
    expect(screen.getByTestId("row-expanded")).toBeInTheDocument();
    expect(screen.getByText("Strong rationale.")).toBeInTheDocument();
    expect(screen.getByText("Concur.")).toBeInTheDocument();
    expect(screen.getByText("my essay answer")).toBeInTheDocument();
  });

  it("AI-graded flagged → 'Admin reviewing' chip in warn tone", () => {
    render(
      <ByQuestionCard
        questions={[
          q({
            question_type: "scenario",
            is_ai_graded: true,
            grade: {
              is_correct: null,
              points_awarded: null,
              points_possible: 1,
              source: "ai",
              ai_grader_model: "claude-sonnet-4-5",
              ai_reasoning: null,
              review_verdict: "flagged",
              review_reasoning: null,
              reviewer_model: "openai gpt-4o-mini",
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText("Admin reviewing")).toBeInTheDocument();
  });

  it("under_admin_review status → flagged chip + suppressed grade body", () => {
    render(
      <ByQuestionCard
        questions={[
          q({
            question_type: "scenario",
            is_ai_graded: true,
            status: "under_admin_review",
            grade: null,
          }),
        ]}
      />,
    );
    expect(screen.getByText("Admin reviewing")).toBeInTheDocument();
    const icon = screen.getByTestId("row-icon");
    expect(icon.getAttribute("data-state")).toBe("under_admin_review");
  });

  it("partial credit → 'Partial' chip", () => {
    render(
      <ByQuestionCard
        questions={[
          q({
            question_type: "matching",
            grade: {
              is_correct: null,
              points_awarded: 0.5,
              points_possible: 1,
              source: "auto",
              ai_grader_model: null,
              ai_reasoning: null,
              review_verdict: null,
              review_reasoning: null,
              reviewer_model: null,
            },
          }),
        ]}
      />,
    );
    expect(screen.getByText("Partial")).toBeInTheDocument();
  });

  it("has_figure renders the FIG badge (AC-CD24 stub)", () => {
    render(<ByQuestionCard questions={[q({ has_figure: true })]} />);
    expect(screen.getByText("FIG")).toBeInTheDocument();
  });

  it("anchors via data-question-id on each row", () => {
    render(
      <ByQuestionCard questions={[q({ attempt_position: 3, question_id: "q-3" })]} />,
    );
    const row = screen.getByTestId("question-grade-row");
    expect(row.getAttribute("data-question-id")).toBe("3");
  });

  it("empty questions array → placeholder, no rows", () => {
    render(<ByQuestionCard questions={[]} />);
    expect(screen.queryByTestId("question-grade-row")).not.toBeInTheDocument();
    expect(screen.getByText(/No question rows/)).toBeInTheDocument();
  });

  it("headerSlot prop mounts inside the card header", () => {
    render(
      <ByQuestionCard
        questions={[q()]}
        headerSlot={<button type="button">Download PDF →</button>}
      />,
    );
    const slot = screen.getByTestId("by-question-header-slot");
    expect(slot).toHaveTextContent("Download PDF →");
  });
});
