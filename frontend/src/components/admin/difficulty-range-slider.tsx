/**
 * DifficultyRangeSlider — two-handle D1–D10 range picker
 * (FE-8 catalogue §B.2 `:212`; extracted as a reusable §C primitive
 * because `BenchmarkSection` in `fe-specs/FE-8-admin-tests.md`
 * consumes it).
 *
 * Renders D1–D10 as 10 segmented buttons; the range between `min`
 * and `max` (inclusive) gets the ink background per
 * `admin-authoring.jsx:289–319`.
 *
 * Clicking a segment outside the current range extends the closer
 * handle. Clamps so `min <= max` always holds.
 */
"use client";

import { cn } from "@/lib/utils";

const STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const MIN_STEP = 1;
const MAX_STEP = 10;

export type DifficultyRangeSliderProps = {
  min: number;
  max: number;
  onChange: (next: { min: number; max: number }) => void;
  disabled?: boolean;
  className?: string;
};

export function DifficultyRangeSlider({
  min,
  max,
  onChange,
  disabled,
  className,
}: DifficultyRangeSliderProps) {
  // Clamp incoming props so render never goes inverted even if a
  // consumer passes an inconsistent pair mid-typing.
  const lo = Math.min(Math.max(min, MIN_STEP), MAX_STEP);
  const hi = Math.min(Math.max(max, lo), MAX_STEP);

  const handleClick = (step: number) => {
    if (disabled) return;
    if (step < lo) {
      onChange({ min: step, max: hi });
    } else if (step > hi) {
      onChange({ min: lo, max: step });
    } else {
      // Click inside the range: collapse the closer handle to that
      // step (lets users tighten the range with one click).
      const distToLo = step - lo;
      const distToHi = hi - step;
      if (distToLo <= distToHi) {
        onChange({ min: step, max: hi });
      } else {
        onChange({ min: lo, max: step });
      }
    }
  };

  return (
    <div className={cn("py-1", className)} data-testid="difficulty-range-slider">
      <div className="flex gap-0 mb-2" role="group" aria-label="Difficulty range">
        {STEPS.map((n, idx) => {
          const inRange = n >= lo && n <= hi;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => handleClick(n)}
              aria-pressed={inRange}
              aria-label={`D${n}`}
              className={cn(
                "flex-1 py-2 text-center font-mono text-[11.5px] font-semibold border",
                idx > 0 && "-ml-px",
                inRange
                  ? "bg-ink text-bg-raised border-ink"
                  : "bg-bg-sunk text-ink-3 border-line",
                disabled && "opacity-60 cursor-not-allowed",
              )}
            >
              D{n}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between font-mono text-[11px] text-ink-3">
        <span>min D{lo}</span>
        <span>max D{hi}</span>
      </div>
    </div>
  );
}
