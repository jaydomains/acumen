"use client";

/**
 * QuestionView (FE-4 §B.1 §2) — dispatcher.
 *
 * Renders the per-type question pane: prompt (with the reference
 * Figure stub above) + the type-specific renderer + footer (realism
 * flag in frozen mode; nothing in benchmark slice 2).
 *
 * `disabled` reflects the paused state (content also blanks via the
 * overlay; the renderer-disable is belt-and-braces so a keyboard-
 * driven testee can't slip an answer through during pause).
 */

import { type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Figure } from "@/components/primitives/figure";
import { QuestionMCQ } from "./questions/QuestionMCQ";
import { QuestionTrueFalse } from "./questions/QuestionTrueFalse";
import { QuestionMatching } from "./questions/QuestionMatching";
import { QuestionScenario, QuestionShortAnswer } from "./questions/QuestionShortAnswer";
import type { AnyPresentedQuestion } from "./questions/types";
import type { AnswerPayload } from "@/lib/attempts/answer-payloads";

export type QuestionViewProps = {
  question: AnyPresentedQuestion;
  /** Index in the attempt's question list (1-indexed for display). */
  positionDisplay: number;
  total: number;
  answer: AnswerPayload | null;
  onAnswer: (next: AnswerPayload) => void;
  disabled?: boolean | undefined;
  /** Optional footer slot (renders below the question — realism flag,
   * etc). Owner-pattern keeps QuestionView agnostic of frozen vs
   * benchmark differences. */
  footer?: ReactNode | undefined;
};

export function QuestionView({
  question,
  positionDisplay,
  total,
  answer,
  onAnswer,
  disabled,
  footer,
}: QuestionViewProps) {
  return (
    <Card
      data-testid="question-view"
      data-question-id={question.id}
      data-question-type={question.type}
      className="flex flex-col gap-4 p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
          Question {positionDisplay} of {total}
        </div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-4">
          {question.type.replace("_", " ")}
        </div>
      </div>
      <Figure
        url={question.reference_image_url}
        caption={question.reference_image_caption}
      />
      <p
        data-testid="question-prompt"
        className="font-serif text-[18px] leading-7 text-ink"
      >
        {question.config.prompt}
      </p>
      <Renderer
        question={question}
        answer={answer}
        onAnswer={onAnswer}
        disabled={disabled}
      />
      {footer && <div className="flex items-center gap-2 pt-2">{footer}</div>}
    </Card>
  );
}

function Renderer({
  question,
  answer,
  onAnswer,
  disabled,
}: {
  question: AnyPresentedQuestion;
  answer: AnswerPayload | null;
  onAnswer: (next: AnswerPayload) => void;
  disabled?: boolean | undefined;
}) {
  switch (question.type) {
    case "multiple_choice":
      return (
        <QuestionMCQ
          question={question}
          answer={answer?.type === "multiple_choice" ? answer : null}
          onChange={onAnswer}
          disabled={disabled}
        />
      );
    case "true_false":
      return (
        <QuestionTrueFalse
          question={question}
          answer={answer?.type === "true_false" ? answer : null}
          onChange={onAnswer}
          disabled={disabled}
        />
      );
    case "matching":
      return (
        <QuestionMatching
          question={question}
          answer={answer?.type === "matching" ? answer : null}
          onChange={onAnswer}
          disabled={disabled}
        />
      );
    case "short_answer":
      return (
        <QuestionShortAnswer
          question={question}
          answer={answer?.type === "short_answer" ? answer : null}
          onChange={onAnswer}
          disabled={disabled}
        />
      );
    case "scenario":
      return (
        <QuestionScenario
          question={question}
          answer={answer?.type === "scenario" ? answer : null}
          onChange={onAnswer}
          disabled={disabled}
        />
      );
  }
}
