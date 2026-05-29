"use client";

/**
 * DifficultyPicker — D1–D10 segmented picker per FE-8 admin-tests
 * §B.2 §2 (`fe-specs/FE-8-admin-tests.md:245`). Extracted from
 * `per-testee-section.tsx` in Slice 13 so the question editor modal
 * can reuse it.
 */

import { cn } from "@/lib/utils";

export type DifficultyPickerProps = {
  value: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
  testIdPrefix?: string;
};

export function DifficultyPicker({
  value,
  onChange,
  disabled = false,
  testIdPrefix = "difficulty-picker",
}: DifficultyPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Target difficulty"
      className="flex flex-wrap gap-1"
      data-testid={testIdPrefix}
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
            data-testid={`${testIdPrefix}-${d}`}
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
