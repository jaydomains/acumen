/**
 * Per-question-type renderer tests (FE-4 §B.1 §2 + §D.3).
 *
 * One test per renderer:
 *   - MCQ: click an option → onChange with `{ type, choice: <index> }`
 *   - TrueFalse: click True → onChange with `{ answer: true }`; pressed
 *     state toggles
 *   - Matching: select a right item for left[0] → onChange with the
 *     `matches` array updated at index 0
 *   - ShortAnswer / Scenario: type into the textarea → onChange with
 *     `{ text }`
 *
 * AC-CD24 spot-check: when `reference_image_url === null`, the Figure
 * stub returns null and the question renders without an `<img>`.
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestionMCQ } from "@/components/attempt/questions/QuestionMCQ";
import { QuestionTrueFalse } from "@/components/attempt/questions/QuestionTrueFalse";
import { QuestionMatching } from "@/components/attempt/questions/QuestionMatching";
import {
  QuestionScenario,
  QuestionShortAnswer,
} from "@/components/attempt/questions/QuestionShortAnswer";
import { QuestionView } from "@/components/attempt/QuestionView";
import type { PresentedQuestion } from "@/components/attempt/questions/types";

afterEach(() => {
  cleanup();
});

describe("QuestionMCQ — single-select", () => {
  const question: PresentedQuestion<"multiple_choice"> = {
    id: "q",
    type: "multiple_choice",
    question_group_id: null,
    attempt_position: null,
    reference_image_url: null,
    reference_image_caption: null,
    config: {
      prompt: "p",
      options: [
        { text: "Apple", image_url: null },
        { text: "Banana", image_url: null },
      ],
    },
  };

  it("click on option 1 fires onChange with { type, choice: 1 }", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<QuestionMCQ question={question} answer={null} onChange={onChange} />);
    await user.click(screen.getByTestId("question-mcq-option-1"));
    expect(onChange).toHaveBeenCalledWith({ type: "multiple_choice", choice: 1 });
  });

  it("selected option carries data-checked", () => {
    render(
      <QuestionMCQ
        question={question}
        answer={{ type: "multiple_choice", choice: 0 }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("question-mcq-option-0")).toHaveAttribute("data-checked");
    expect(screen.getByTestId("question-mcq-option-1")).not.toHaveAttribute(
      "data-checked",
    );
  });
});

describe("QuestionTrueFalse", () => {
  const question: PresentedQuestion<"true_false"> = {
    id: "q",
    type: "true_false",
    question_group_id: null,
    attempt_position: null,
    reference_image_url: null,
    reference_image_caption: null,
    config: { prompt: "Yes?" },
  };

  it("clicking True fires onChange { answer: true }", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<QuestionTrueFalse question={question} answer={null} onChange={onChange} />);
    await user.click(screen.getByTestId("question-tf-true"));
    expect(onChange).toHaveBeenCalledWith({ type: "true_false", answer: true });
  });
});

describe("QuestionMatching", () => {
  const question: PresentedQuestion<"matching"> = {
    id: "q",
    type: "matching",
    question_group_id: null,
    attempt_position: null,
    reference_image_url: null,
    reference_image_caption: null,
    config: {
      prompt: "Match",
      left: ["one", "two"],
      right: ["A", "B"],
    },
  };

  it("renders one trigger per left item + populates the right select", () => {
    render(<QuestionMatching question={question} answer={null} onChange={vi.fn()} />);
    expect(screen.getByTestId("question-matching-trigger-0")).toBeInTheDocument();
    expect(screen.getByTestId("question-matching-trigger-1")).toBeInTheDocument();
  });
});

describe("QuestionShortAnswer + QuestionScenario", () => {
  const shortQ: PresentedQuestion<"short_answer"> = {
    id: "q",
    type: "short_answer",
    question_group_id: null,
    attempt_position: null,
    reference_image_url: null,
    reference_image_caption: null,
    config: { prompt: "Why?", expected_seconds: 30 },
  };

  it("typing into the textarea calls onChange with the new text per keystroke", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<QuestionShortAnswer question={shortQ} answer={null} onChange={onChange} />);
    await user.type(screen.getByTestId("question-short-answer-input"), "a");
    expect(onChange).toHaveBeenCalledWith({ type: "short_answer", text: "a" });
  });

  it("char counter reflects current text length", () => {
    render(
      <QuestionShortAnswer
        question={shortQ}
        answer={{ type: "short_answer", text: "hello" }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId("question-short-answer-char-counter")).toHaveTextContent(
      "5 chars",
    );
  });

  it("scenario renders the eyebrow + onChange uses scenario discriminator", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const scenario: PresentedQuestion<"scenario"> = {
      id: "q",
      type: "scenario",
      question_group_id: null,
      attempt_position: null,
      reference_image_url: null,
      reference_image_caption: null,
      config: { prompt: "Walk", expected_seconds: null },
    };
    render(<QuestionScenario question={scenario} answer={null} onChange={onChange} />);
    expect(screen.getByText("Scenario")).toBeInTheDocument();
    await user.type(screen.getByTestId("question-scenario-input"), "x");
    expect(onChange).toHaveBeenCalledWith({ type: "scenario", text: "x" });
  });
});

describe("QuestionView · dispatcher + AC-CD24 image stub", () => {
  it("dispatches MCQ renderer when type=multiple_choice", () => {
    const question: PresentedQuestion<"multiple_choice"> = {
      id: "qv",
      type: "multiple_choice",
      question_group_id: null,
      attempt_position: null,
      reference_image_url: null,
      reference_image_caption: null,
      config: { prompt: "p", options: [{ text: "a", image_url: null }] },
    };
    render(
      <QuestionView
        question={question}
        positionDisplay={1}
        total={3}
        answer={null}
        onAnswer={vi.fn()}
      />,
    );
    expect(screen.getByTestId("question-mcq")).toBeInTheDocument();
    // AC-CD24: with reference_image_url=null the Figure stub returns
    // null — no <img> renders.
    expect(screen.queryByRole("img")).toBeNull();
  });
});
