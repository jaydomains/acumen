"use client";

/**
 * TrueFalse question renderer (FE-4 §B.1 §2).
 *
 * Two side-by-side buttons. Selected state inverts to `bg-ink text-bg`
 * per `attempt.jsx:535–549`. Payload shape: `{ answer: boolean }` (the
 * backend grades against `answer.answer === config.correct`).
 */

import { cn } from "@/lib/utils";
import type { PresentedQuestion } from "./types";
import type { TrueFalseAnswer } from "@/lib/attempts/answer-payloads";

export type QuestionTrueFalseProps = {
  question: PresentedQuestion<"true_false">;
  answer: TrueFalseAnswer | null;
  onChange: (next: TrueFalseAnswer) => void;
  disabled?: boolean | undefined;
};

const CHOICES: { label: string; value: boolean }[] = [
  { label: "True", value: true },
  { label: "False", value: false },
];

export function QuestionTrueFalse({
  question,
  answer,
  onChange,
  disabled,
}: QuestionTrueFalseProps) {
  void question; // for symmetry with the dispatcher signature
  const selected = answer?.answer;

  return (
    <div
      data-testid="question-true-false"
      role="radiogroup"
      aria-label="True or false"
      className="grid grid-cols-2 gap-3"
    >
      {CHOICES.map((c) => {
        const checked = selected === c.value;
        return (
          <button
            key={c.label}
            type="button"
            role="radio"
            aria-checked={checked}
            data-testid={`question-tf-${c.label.toLowerCase()}`}
            data-checked={checked || undefined}
            disabled={disabled}
            onClick={() => onChange({ type: "true_false", answer: c.value })}
            className={cn(
              "border border-line px-4 py-4 font-serif text-[20px] tracking-[-0.01em] transition-colors",
              checked
                ? "border-ink bg-ink text-bg"
                : "bg-bg-raised text-ink hover:bg-bg-deep",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
