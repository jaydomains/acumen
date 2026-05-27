"use client";

/**
 * MCQ question renderer (FE-4 §B.1 §2).
 *
 * Single-select only — backend `correct` is a single int index
 * (`app/domain/tests.py:345`); plan-mode drift item 7 dropped the
 * multi-select discriminator.
 *
 * Each option renders a letter prefix (A, B, C, ...) + optional
 * `ChoiceFigure` stub + body text. The selected option inverts to
 * `bg-ink text-bg` to read as "pressed" against the paper theme.
 */

import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChoiceFigure } from "@/components/primitives/figure";
import { cn } from "@/lib/utils";
import type { PresentedQuestion } from "./types";
import type { MultipleChoiceAnswer } from "@/lib/attempts/answer-payloads";

export type QuestionMCQProps = {
  question: PresentedQuestion<"multiple_choice">;
  answer: MultipleChoiceAnswer | null;
  onChange: (next: MultipleChoiceAnswer) => void;
  disabled?: boolean | undefined;
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function QuestionMCQ({ question, answer, onChange, disabled }: QuestionMCQProps) {
  const groupName = useId();
  const selected = answer?.choice ?? -1;
  const stringValue = selected >= 0 ? String(selected) : "";

  return (
    <RadioGroup
      name={groupName}
      value={stringValue}
      onValueChange={(v) => onChange({ type: "multiple_choice", choice: Number(v) })}
      data-testid="question-mcq"
      className="flex flex-col gap-2"
    >
      {question.config.options.map((option, idx) => {
        const checked = idx === selected;
        const letter = LETTERS[idx] ?? String(idx + 1);
        return (
          <label
            key={`${question.id}-${idx}`}
            data-testid={`question-mcq-option-${idx}`}
            data-checked={checked || undefined}
            className={cn(
              "flex cursor-pointer items-start gap-3 border border-line p-3 transition-colors",
              checked
                ? "border-ink bg-ink text-bg"
                : "bg-bg-raised text-ink hover:bg-bg-deep",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <RadioGroupItem value={String(idx)} disabled={disabled} className="mt-1" />
            <span className="font-mono text-[12px] leading-5 opacity-80">{letter}.</span>
            <span className="flex-1 text-[14px] leading-6">
              <ChoiceFigure url={option.image_url} />
              {option.text}
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
}
