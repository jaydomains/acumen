/**
 * QuestionGradeRow — one row in the ByQuestionCard list (FE-6 §B.4).
 *
 * Renders:
 *   - icon column (✓ / ✗ / partial / pending) keyed off grade.is_correct
 *     and status
 *   - position + type label + prompt excerpt (line-clamp-1)
 *   - optional FIG badge (AC-CD24 stub — renders the badge only,
 *     no image body)
 *   - AiReviewChip (pending / confirmed / flagged / partial)
 *   - expand-on-click → reveals ai_reasoning + review_reasoning +
 *     formatted answer payload
 *
 * `data-question-id` carries the attempt_position so the shared
 * scroll-to-question helper (FE-6 §C.9) can anchor to this row from
 * the TransparencyBlock or RealismAggregateCard.
 */

"use client";

import { useState } from "react";
import { Pill } from "@/components/primitives/Pill";
import { AiReviewChip, type AiReviewVerdict } from "./ai-review-chip";
import { formatAnswerPayload } from "@/lib/result/format-answer-payload";
import { cn } from "@/lib/utils";
import type { components } from "@/lib/api/types";

type ResultQuestion = components["schemas"]["ResultQuestion"];

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: "MCQ",
  multiple_choice_multi: "MCQ-multi",
  true_false: "T/F",
  matching: "Match",
  short_answer: "Short",
  scenario: "Scenario",
};

export type QuestionGradeRowProps = {
  question: ResultQuestion;
};

export function QuestionGradeRow({ question }: QuestionGradeRowProps) {
  const [expanded, setExpanded] = useState(false);
  const verdict = (question.grade?.review_verdict ?? null) as AiReviewVerdict | null;
  const isUnderAdminReview = question.status === "under_admin_review";
  const isPending = question.is_ai_graded && !question.grade && !isUnderAdminReview;
  const isCorrect = question.grade?.is_correct;
  const typeLabel = TYPE_LABEL[question.question_type] ?? question.question_type;
  const answerLines = formatAnswerPayload(
    question.question_type,
    (question.response?.answer_payload ?? null) as Record<string, unknown> | null,
  );
  const aiReasoning = question.grade?.ai_reasoning ?? null;
  const reviewReasoning = question.grade?.review_reasoning ?? null;
  const canExpand =
    aiReasoning !== null ||
    reviewReasoning !== null ||
    (answerLines !== null && answerLines.length > 0);

  const chipVerdict: AiReviewVerdict | null = isUnderAdminReview
    ? "flagged"
    : isPending
      ? "pending"
      : verdict;

  return (
    <li
      data-testid="question-grade-row"
      data-question-id={question.attempt_position ?? ""}
      className="border-t border-line first:border-t-0"
    >
      <button
        type="button"
        onClick={() => canExpand && setExpanded((v) => !v)}
        aria-expanded={expanded}
        disabled={!canExpand}
        className={cn(
          "flex w-full items-center gap-3 py-3 text-left",
          canExpand ? "hover:bg-bg-sunk" : "cursor-default",
        )}
      >
        <span
          data-testid="row-icon"
          data-state={iconState(isCorrect, isUnderAdminReview, isPending)}
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center font-mono text-[12px]",
            iconClass(isCorrect, isUnderAdminReview, isPending),
          )}
          aria-hidden="true"
        >
          {iconChar(isCorrect, isUnderAdminReview, isPending)}
        </span>
        <span className="font-mono text-[11px] text-ink-3 tabular-nums">
          Q{question.attempt_position ?? "—"}
        </span>
        <Pill tone="default" mono>
          {typeLabel}
        </Pill>
        <span className="flex-1 truncate text-[13px] text-ink">
          {question.prompt_text ?? "(no prompt)"}
        </span>
        {question.has_figure ? (
          <Pill tone="info" mono>
            FIG
          </Pill>
        ) : null}
        {isCorrect === null && !isUnderAdminReview && question.grade !== null ? (
          <Pill tone="warn" mono>
            Partial
          </Pill>
        ) : null}
        <AiReviewChip verdict={chipVerdict} />
      </button>
      {expanded && canExpand ? (
        <div
          data-testid="row-expanded"
          className="border-t border-line bg-bg-sunk px-9 py-3 text-[12px] leading-relaxed text-ink-2"
        >
          {answerLines ? (
            <div className="mb-3">
              <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">
                Your answer
              </div>
              <ul className="space-y-1">
                {answerLines.map((line, idx) => (
                  <li key={idx}>
                    {line.label ? (
                      <span className="font-mono text-[11px] text-ink-3">
                        {line.label}:{" "}
                      </span>
                    ) : null}
                    <span className="whitespace-pre-wrap">{line.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {aiReasoning ? (
            <div className="mb-3">
              <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">
                AI reasoning
              </div>
              <p className="whitespace-pre-wrap">{aiReasoning}</p>
            </div>
          ) : null}
          {reviewReasoning ? (
            <div>
              <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">
                Reviewer rationale
              </div>
              <p className="whitespace-pre-wrap">{reviewReasoning}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function iconState(
  isCorrect: boolean | null | undefined,
  isUnderAdminReview: boolean,
  isPending: boolean,
): string {
  if (isUnderAdminReview) return "under_admin_review";
  if (isPending) return "pending";
  if (isCorrect === true) return "correct";
  if (isCorrect === false) return "incorrect";
  if (isCorrect === null) return "partial";
  return "ungraded";
}

function iconClass(
  isCorrect: boolean | null | undefined,
  isUnderAdminReview: boolean,
  isPending: boolean,
): string {
  if (isUnderAdminReview || isPending) return "border border-line text-ink-3";
  if (isCorrect === true) return "bg-ok-soft text-ok";
  if (isCorrect === false) return "bg-danger-soft text-danger";
  if (isCorrect === null) return "bg-warn-soft text-warn";
  return "border border-line text-ink-3";
}

function iconChar(
  isCorrect: boolean | null | undefined,
  isUnderAdminReview: boolean,
  isPending: boolean,
): string {
  if (isUnderAdminReview) return "…";
  if (isPending) return "…";
  if (isCorrect === true) return "✓";
  if (isCorrect === false) return "✗";
  if (isCorrect === null) return "~";
  return "—";
}
