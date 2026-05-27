import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RealismAggregateCard } from "@/components/result/realism-aggregate-card";

const scrollIntoViewSpy = vi.fn();

afterEach(() => {
  cleanup();
  scrollIntoViewSpy.mockReset();
  document.body.innerHTML = "";
});

const NOW = Date.now();

function q(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "q-1",
    attempt_position: 1,
    config: { prompt: "Default prompt" },
    realism_flagged_by_me: false,
    realism_flag_note: null,
    realism_flagged_at: null,
    ...overrides,
  };
}

describe("RealismAggregateCard", () => {
  it("hides when no question is flagged", () => {
    const { container } = render(<RealismAggregateCard questions={[q(), q()]} />);
    expect(container.firstChild).toBeNull();
  });

  it("hides when questions list is null/undefined", () => {
    const { container } = render(<RealismAggregateCard questions={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders one row per flagged Q with the singular header copy", () => {
    render(
      <RealismAggregateCard
        questions={[
          q({
            id: "q-7",
            attempt_position: 7,
            realism_flagged_by_me: true,
            realism_flag_note: "Felt generated.",
            realism_flagged_at: new Date(NOW - 5 * 60 * 1000).toISOString(),
          }),
        ]}
      />,
    );
    expect(screen.getByText("YOU FLAGGED 1 QUESTION")).toBeInTheDocument();
    expect(screen.getByText("Q7")).toBeInTheDocument();
    expect(screen.getByText("Felt generated.")).toBeInTheDocument();
    expect(screen.getByText(/flagged 5 minutes ago/)).toBeInTheDocument();
  });

  it("plural header copy when 2+ flagged", () => {
    render(
      <RealismAggregateCard
        questions={[
          q({ id: "q-1", attempt_position: 1, realism_flagged_by_me: true }),
          q({ id: "q-3", attempt_position: 3, realism_flagged_by_me: true }),
        ]}
      />,
    );
    expect(screen.getByText("YOU FLAGGED 2 QUESTIONS")).toBeInTheDocument();
  });

  it("missing note → '(no note)' fallback in muted tone", () => {
    render(
      <RealismAggregateCard
        questions={[
          q({
            attempt_position: 4,
            realism_flagged_by_me: true,
            realism_flag_note: null,
          }),
        ]}
      />,
    );
    expect(screen.getByText("(no note)")).toBeInTheDocument();
  });

  it("clicking a flag row scrolls + flashes the matching question row", async () => {
    const target = document.createElement("div");
    target.setAttribute("data-question-id", "5");
    target.scrollIntoView = scrollIntoViewSpy as unknown as typeof target.scrollIntoView;
    document.body.appendChild(target);

    const user = userEvent.setup();
    render(
      <RealismAggregateCard
        questions={[
          q({
            id: "q-5",
            attempt_position: 5,
            realism_flagged_by_me: true,
          }),
        ]}
      />,
    );
    await user.click(screen.getByTestId("realism-flag-row"));
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
  });

  it("ignores rows missing question_id (defensive)", () => {
    const { container } = render(
      <RealismAggregateCard
        questions={[{ realism_flagged_by_me: true, attempt_position: 2 }]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
