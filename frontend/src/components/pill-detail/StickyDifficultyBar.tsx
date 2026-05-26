/**
 * StickyDifficultyBar — bottom-pinned CTA (FE-3 §B.3 §2).
 * Mirrors `pill-detail.jsx:420–459`.
 *
 * 10 difficulty buttons (D1–D10). Only those inside
 * `[available_difficulty_min, available_difficulty_max]` are
 * enabled; the rest render disabled (clamped if the pill's range
 * extends outside [1,10]).
 *
 * Default selection seeds from `recommendedDifficulty` if present;
 * otherwise the middle of the available range (rounded down).
 *
 * The Band display reflects `bandFromScalar(selectedDifficulty)`,
 * so the prediction updates live as the testee dials difficulty
 * (FE-3 §B.3.6 "Difficulty selector updates the band display").
 *
 * The page-level CSS variable `--sticky-bar-h` gives the page main
 * enough bottom padding to clear the bar; declared in globals.css.
 */

import { useState } from "react";
import type { PillResponse } from "@/lib/queries/pills";
import { BandTag } from "@/components/primitives/BandTag";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { bandFromScalar } from "@/lib/competence/band";

export type StickyDifficultyBarProps = {
  pill: PillResponse;
  recommendedDifficulty?: number | null;
  onStart: (difficulty: number) => void;
};

export function StickyDifficultyBar({
  pill,
  recommendedDifficulty,
  onStart,
}: StickyDifficultyBarProps) {
  const min = Math.max(1, Math.min(10, pill.available_difficulty_min));
  const max = Math.max(min, Math.min(10, pill.available_difficulty_max));

  const defaultDifficulty = pickDefault(min, max, recommendedDifficulty);
  const [selected, setSelected] = useState(defaultDifficulty);

  const inRange = (d: number) => d >= min && d <= max;
  const safeSelected = inRange(selected) ? selected : defaultDifficulty;

  return (
    <div
      data-testid="sticky-difficulty-bar"
      className="sticky bottom-0 z-20 -mx-12 mt-8 border-t border-line bg-bg-raised px-12 py-4 shadow-sm"
    >
      <div className="mx-auto flex w-full max-w-[1340px] flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-4">
            Predicted band
          </span>
          <BandTag band={bandFromScalar(safeSelected)} />
        </div>

        <div
          role="group"
          aria-label="Select difficulty"
          className="inline-flex border border-line bg-bg-raised"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((d) => {
            const enabled = inRange(d);
            const active = enabled && d === safeSelected;
            return (
              <button
                key={d}
                type="button"
                disabled={!enabled}
                onClick={() => setSelected(d)}
                data-active={active}
                data-testid={`difficulty-D${d}`}
                className={cn(
                  "w-9 border-r border-line py-1.5 font-mono text-[12px] last:border-r-0",
                  "transition-colors duration-150",
                  active
                    ? "bg-ink text-bg-raised"
                    : enabled
                      ? "text-ink-2 hover:bg-bg-deep"
                      : "cursor-not-allowed text-ink-4/50",
                )}
              >
                D{d}
              </button>
            );
          })}
        </div>

        <Button data-testid="sticky-start-cta" onClick={() => onStart(safeSelected)}>
          Practice at D{safeSelected}
        </Button>
      </div>
    </div>
  );
}

function pickDefault(
  min: number,
  max: number,
  recommended: number | null | undefined,
): number {
  if (typeof recommended === "number" && recommended >= min && recommended <= max) {
    return recommended;
  }
  return Math.floor((min + max) / 2);
}
