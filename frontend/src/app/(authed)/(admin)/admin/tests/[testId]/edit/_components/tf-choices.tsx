"use client";

/**
 * TFChoices — True / False two-button picker per FE-8 admin-tests
 * §B.3 §2 (`fe-specs/FE-8-admin-tests.md:536`). Controlled via the
 * `config.correct: boolean` form field.
 */

import { Controller, type Control } from "react-hook-form";
import { cn } from "@/lib/utils";
import type { QuestionFormInput } from "@/lib/tests/question-form";

export type TFChoicesProps = {
  control: Control<QuestionFormInput>;
  disabled?: boolean;
};

export function TFChoices({ control, disabled = false }: TFChoicesProps) {
  return (
    <Controller
      control={control}
      name={"config.correct" as never}
      render={({ field }) => {
        const value = field.value === true;
        return (
          <div
            role="radiogroup"
            aria-label="Correct answer"
            className="flex gap-2"
            data-testid="tf-choices"
          >
            <Cell
              label="True"
              active={value}
              disabled={disabled}
              onClick={() => field.onChange(true)}
              testId="tf-choice-true"
            />
            <Cell
              label="False"
              active={!value}
              disabled={disabled}
              onClick={() => field.onChange(false)}
              testId="tf-choice-false"
            />
          </div>
        );
      }}
    />
  );
}

function Cell({
  label,
  active,
  disabled,
  onClick,
  testId,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "h-12 flex-1 border font-serif text-[18px]",
        active
          ? "bg-ink text-bg border-ink"
          : "bg-bg-raised text-ink border-line hover:bg-bg-sunk",
        disabled && "opacity-60 cursor-not-allowed hover:bg-bg-raised",
      )}
    >
      {label}
    </button>
  );
}
