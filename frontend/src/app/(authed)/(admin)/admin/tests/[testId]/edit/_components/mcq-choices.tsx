"use client";

/**
 * MCQChoices — 2–6 multiple-choice options with single-correct radio
 * per FE-8 admin-tests §B.3 §2 (`fe-specs/FE-8-admin-tests.md:535`).
 *
 * Single-correct invariant enforced both by the radio-group UX
 * (selecting one option flips all others to false) and by the
 * `mcqConfigSchema.refine` in `question-form.ts`.
 *
 * Choice ids are FE-assigned A→F per `mcqChoiceId(index)`; backend
 * doesn't constrain. The id is preserved across reorders so rhf can
 * keep stable keys.
 */

import {
  useFieldArray,
  type Control,
  type UseFormGetValues,
  type UseFormRegister,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/admin/field";
import { cn } from "@/lib/utils";
import { mcqChoiceId, type QuestionFormInput } from "@/lib/tests/question-form";

export type MCQChoicesProps = {
  control: Control<QuestionFormInput>;
  register: UseFormRegister<QuestionFormInput>;
  getValues: UseFormGetValues<QuestionFormInput>;
  disabled?: boolean;
  error?: string | null;
  perRowError?: (i: number) => string | null;
};

export function MCQChoices({
  control,
  register,
  getValues,
  disabled = false,
  error,
  perRowError,
}: MCQChoicesProps) {
  const { fields, append, remove, update } = useFieldArray({
    control,
    // `config.choices` is only present on the MCQ branch; cast for rhf
    // (which can't narrow the discriminated union from a string path).
    name: "config.choices" as never,
    keyName: "_internalId",
  });

  const setCorrect = (idx: number) => {
    // Read the LIVE values (including text typed into the uncontrolled,
    // `register`ed inputs) before writing back — the `fields` snapshot
    // carries stale/empty text, so updating from it clobbered the admin's
    // un-committed choice text on every "mark correct" click (A2-H2).
    const choices = (getValues("config.choices" as never) ?? []) as Array<
      Record<string, unknown>
    >;
    choices.forEach((choice, i) => {
      update(i, { ...choice, correct: i === idx } as never);
    });
  };

  return (
    <div className="space-y-2" data-testid="mcq-choices">
      {fields.map((field, i) => {
        const rowErr = perRowError?.(i) ?? null;
        return (
          <div
            key={field._internalId}
            className="flex items-start gap-2"
            data-testid={`mcq-choice-row-${i}`}
          >
            <label
              className={cn(
                "flex h-10 w-9 shrink-0 items-center justify-center border border-line",
                "bg-bg-raised cursor-pointer font-mono text-[12px]",
                disabled && "opacity-60 cursor-not-allowed",
              )}
              aria-label={`Mark choice ${mcqChoiceId(i)} correct`}
            >
              <input
                type="radio"
                name="mcq-correct"
                checked={(field as unknown as { correct?: boolean }).correct === true}
                disabled={disabled}
                onChange={() => setCorrect(i)}
                data-testid={`mcq-choice-correct-${i}`}
              />
            </label>
            <div className="flex-1 min-w-0">
              <Input
                {...register(`config.choices.${i}.text` as never)}
                placeholder={`Choice ${mcqChoiceId(i)} text`}
                disabled={disabled}
                data-testid={`mcq-choice-text-${i}`}
              />
              {rowErr ? <FieldError msg={rowErr} /> : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (fields.length <= 2) return;
                remove(i);
              }}
              disabled={disabled || fields.length <= 2}
              data-testid={`mcq-choice-remove-${i}`}
              aria-label={`Remove choice ${mcqChoiceId(i)}`}
            >
              Remove
            </Button>
          </div>
        );
      })}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="text-[11.5px] text-ink-3">
          {fields.length} of 6 choices · single-correct
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({
              id: mcqChoiceId(fields.length),
              text: "",
              correct: false,
            } as never)
          }
          disabled={disabled || fields.length >= 6}
          data-testid="mcq-choice-add"
        >
          + Add choice
        </Button>
      </div>
      {error ? <FieldError msg={error} /> : null}
    </div>
  );
}
