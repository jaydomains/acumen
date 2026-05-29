"use client";

/**
 * PerTesteeSection — fields specific to the `per_testee` mode per
 * FE-8 admin-tests §B.2 §2 (`fe-specs/FE-8-admin-tests.md:241`).
 *
 * Wire shape (drift Finding #5): nested zod is flattened onto
 * TestCreate/TestUpdate at submit. Fields used here:
 * - `pill_id` (single-select; required for per_testee)
 * - `target_difficulty` (D1–D10 segmented picker)
 * - `duration_minutes` (optional time ceiling)
 *
 * `question_count_target` is NOT exposed — no wire field exists for it
 * on `TestCreate`/`TestUpdate`/`TestResponse` (drift Finding #5).
 *
 * Per-section pill picker uses a native `<select>` per the Slice 5
 * standing absorption (jsdom can't drive Radix Select reliably).
 */

import { useId } from "react";
import { Controller, type Control, type UseFormRegister } from "react-hook-form";
import { Field, FieldRow } from "@/components/admin/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PillResponse } from "@/lib/queries/admin-pills";
import type { TestEditorFormInput } from "@/lib/tests/test-editor-form";

export type PerTesteeSectionProps = {
  control: Control<TestEditorFormInput>;
  register: UseFormRegister<TestEditorFormInput>;
  pills: PillResponse[];
  disabled: boolean;
  errors: {
    pill_id?: string | null;
    target_difficulty?: string | null;
    duration_minutes?: string | null;
  };
};

export function PerTesteeSection({
  control,
  register,
  pills,
  disabled,
  errors,
}: PerTesteeSectionProps) {
  return (
    <div className="border border-line bg-bg-raised p-5" data-testid="per-testee-section">
      <div className="eyebrow mb-3">Per-testee configuration</div>

      <Field
        label="Pill"
        error={errors.pill_id ?? null}
        hint="Each testee sees a 4–12 question subset drawn from this pill."
        locked={disabled}
      >
        <select
          {...register("pill_id")}
          disabled={disabled}
          data-testid="per-testee-pill-select"
          className={cn(
            "h-10 w-full border border-line bg-bg-raised px-3 text-[13px]",
            "focus:outline-none focus:ring-2 focus:ring-accent",
            disabled && "opacity-60 cursor-not-allowed",
          )}
        >
          <option value="">Select a pill…</option>
          {pills.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <FieldRow cols="1fr 1fr">
        <Field
          label="Target difficulty"
          error={errors.target_difficulty ?? null}
          locked={disabled}
        >
          <Controller
            control={control}
            name="target_difficulty"
            render={({ field }) => (
              <DifficultyPicker
                value={field.value ?? null}
                onChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
        </Field>
        <DurationField
          register={register}
          disabled={disabled}
          error={errors.duration_minutes ?? null}
        />
      </FieldRow>
    </div>
  );
}

type DifficultyPickerProps = {
  value: number | null;
  onChange: (v: number) => void;
  disabled: boolean;
};

export function DifficultyPicker({ value, onChange, disabled }: DifficultyPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Target difficulty"
      className="flex flex-wrap gap-1"
      data-testid="difficulty-picker"
    >
      {Array.from({ length: 10 }, (_, i) => i + 1).map((d) => {
        const active = value === d;
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(d)}
            data-testid={`difficulty-picker-${d}`}
            className={cn(
              "h-9 w-9 border font-mono text-[12px] tabular-nums",
              active
                ? "bg-ink text-bg border-ink"
                : "bg-bg-raised text-ink-2 border-line hover:bg-bg-sunk",
              disabled && "opacity-60 cursor-not-allowed hover:bg-bg-raised",
            )}
          >
            D{d}
          </button>
        );
      })}
    </div>
  );
}

function DurationField({
  register,
  disabled,
  error,
}: {
  register: UseFormRegister<TestEditorFormInput>;
  disabled: boolean;
  error: string | null;
}) {
  const id = useId();
  return (
    <Field
      label="Time ceiling (minutes)"
      hint="Optional — leave blank for untimed."
      error={error}
      locked={disabled}
    >
      <Input
        id={id}
        type="number"
        min={1}
        step={1}
        {...register("duration_minutes", {
          setValueAs: (v: unknown) => {
            if (v === "" || v === null || v === undefined) return null;
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
          },
        })}
        disabled={disabled}
        data-testid="per-testee-duration"
      />
    </Field>
  );
}
