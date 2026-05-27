import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TransparencyBlock } from "@/components/result/transparency-block";
import type { components } from "@/lib/api/types";

type ReviewSummary = components["schemas"]["ReviewSummary"];

const scrollIntoViewSpy = vi.fn();

afterEach(() => {
  cleanup();
  scrollIntoViewSpy.mockReset();
  document.body.innerHTML = "";
});

function summary(overrides: Partial<ReviewSummary> = {}): ReviewSummary {
  return {
    ai_grader_model: "claude-sonnet-4-5",
    reviewer_model: "openai gpt-4o-mini",
    flagged_count: 0,
    flagged_question_positions: [],
    review_duration_ms: 4200,
    ...overrides,
  };
}

describe("TransparencyBlock", () => {
  it("hides when status is not 'ready'", () => {
    const { container } = render(
      <TransparencyBlock summary={summary()} status="review_pending" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("hides when summary is null (deterministic-only attempt)", () => {
    const { container } = render(<TransparencyBlock summary={null} status="ready" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders model IDs verbatim from the response (AC-CD18)", () => {
    render(<TransparencyBlock summary={summary()} status="ready" />);
    expect(screen.getByText("claude-sonnet-4-5")).toBeInTheDocument();
    expect(screen.getByText("openai gpt-4o-mini")).toBeInTheDocument();
    expect(screen.getByText(/4\.2-second batched call/)).toBeInTheDocument();
  });

  it("no flags → no flagged sub-line", () => {
    render(<TransparencyBlock summary={summary()} status="ready" />);
    expect(screen.queryByTestId("transparency-flagged-line")).not.toBeInTheDocument();
  });

  it("one flag → singular sub-line with one anchor", () => {
    render(
      <TransparencyBlock
        summary={summary({ flagged_count: 1, flagged_question_positions: [7] })}
        status="ready"
      />,
    );
    expect(
      screen.getByText(/One review was flagged for admin attention/),
    ).toBeInTheDocument();
    const anchors = screen.getAllByTestId("transparency-flagged-anchor");
    expect(anchors).toHaveLength(1);
    expect(anchors[0]).toHaveTextContent("Q7");
  });

  it("multiple flags → plural sub-line with multiple anchors", () => {
    render(
      <TransparencyBlock
        summary={summary({ flagged_count: 2, flagged_question_positions: [3, 7] })}
        status="ready"
      />,
    );
    expect(screen.getByText(/2 reviews were flagged/)).toBeInTheDocument();
    const anchors = screen.getAllByTestId("transparency-flagged-anchor");
    expect(anchors).toHaveLength(2);
    expect(anchors[0]).toHaveTextContent("Q3");
    expect(anchors[1]).toHaveTextContent("Q7");
  });

  it("clicking a flagged anchor scrolls the matching ByQuestionCard row into view", async () => {
    const target = document.createElement("div");
    target.setAttribute("data-question-id", "7");
    target.scrollIntoView = scrollIntoViewSpy as unknown as typeof target.scrollIntoView;
    document.body.appendChild(target);

    const user = userEvent.setup();
    render(
      <TransparencyBlock
        summary={summary({ flagged_count: 1, flagged_question_positions: [7] })}
        status="ready"
      />,
    );
    await user.click(screen.getByTestId("transparency-flagged-anchor"));
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
  });

  it("missing review_duration_ms omits the duration clause gracefully", () => {
    render(
      <TransparencyBlock
        summary={summary({ review_duration_ms: null })}
        status="ready"
      />,
    );
    expect(screen.queryByText(/-second batched call/)).not.toBeInTheDocument();
  });
});
