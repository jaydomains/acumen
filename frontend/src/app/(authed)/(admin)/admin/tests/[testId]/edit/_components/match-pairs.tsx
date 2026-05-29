"use client";

/**
 * MatchPairs — 2–8 left/right pair rows per FE-8 admin-tests §B.3 §2
 * (`fe-specs/FE-8-admin-tests.md:537`). Two columns per row; Remove
 * disabled when only 2 pairs remain.
 */

import { useFieldArray, type Control, type UseFormRegister } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/admin/field";
import type { QuestionFormInput } from "@/lib/tests/question-form";

export type MatchPairsProps = {
  control: Control<QuestionFormInput>;
  register: UseFormRegister<QuestionFormInput>;
  disabled?: boolean;
  error?: string | null;
  perRowError?: (i: number, side: "left" | "right") => string | null;
};

export function MatchPairs({
  control,
  register,
  disabled = false,
  error,
  perRowError,
}: MatchPairsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "config.pairs" as never,
    keyName: "_internalId",
  });

  return (
    <div className="space-y-2" data-testid="match-pairs">
      {fields.map((field, i) => {
        const leftErr = perRowError?.(i, "left") ?? null;
        const rightErr = perRowError?.(i, "right") ?? null;
        return (
          <div
            key={field._internalId}
            className="flex items-start gap-2"
            data-testid={`match-pair-row-${i}`}
          >
            <div className="font-mono text-[11px] text-ink-3 w-6 pt-3 text-right">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="flex-1">
              <Input
                {...register(`config.pairs.${i}.left` as never)}
                placeholder="Left side"
                disabled={disabled}
                data-testid={`match-pair-left-${i}`}
              />
              {leftErr ? <FieldError msg={leftErr} /> : null}
            </div>
            <div className="font-mono text-[11px] text-ink-3 pt-3">↔</div>
            <div className="flex-1">
              <Input
                {...register(`config.pairs.${i}.right` as never)}
                placeholder="Right side"
                disabled={disabled}
                data-testid={`match-pair-right-${i}`}
              />
              {rightErr ? <FieldError msg={rightErr} /> : null}
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
              data-testid={`match-pair-remove-${i}`}
              aria-label={`Remove pair ${i + 1}`}
            >
              Remove
            </Button>
          </div>
        );
      })}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="text-[11.5px] text-ink-3">{fields.length} of 8 pairs</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ left: "", right: "" } as never)}
          disabled={disabled || fields.length >= 8}
          data-testid="match-pair-add"
        >
          + Add pair
        </Button>
      </div>
      {error ? <FieldError msg={error} /> : null}
    </div>
  );
}
