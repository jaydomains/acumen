/**
 * SafetyToggle — single toggle switch with copy-flip
 * (FE-8 catalogue §B.2 `:213`; extracted as a reusable §C primitive
 * because Slice 4 SafetyTab + Slice 3 PillModal both consume).
 *
 * Matches `admin-authoring.jsx:321–351` visual treatment. On-state
 * uses the `danger` token (safety pills carry curated industry
 * links per AC-D21 — not AI-generated material); off-state uses the
 * neutral `ink` token.
 */
"use client";

import { cn } from "@/lib/utils";

export type SafetyToggleProps = {
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export function SafetyToggle({ on, onChange, disabled, className }: SafetyToggleProps) {
  return (
    <div
      className={cn("flex gap-3.5 items-center py-2.5", className)}
      data-testid="safety-toggle"
    >
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Safety-relevant"
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={cn(
          "relative shrink-0 w-[42px] h-6 rounded-xl border transition-colors",
          on ? "bg-danger border-danger" : "bg-bg-deep border-line-strong",
          disabled && "opacity-60 cursor-not-allowed",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] w-[18px] h-[18px] rounded-full",
            "bg-bg-raised shadow-[0_1px_2px_rgba(0,0,0,0.2)]",
            "transition-[left] duration-150",
          )}
          style={{ left: on ? 19 : 2 }}
        />
      </button>
      <div className="flex-1">
        <div className={cn("text-[13px] font-semibold", on ? "text-danger" : "text-ink")}>
          {on
            ? "Safety-relevant — no AI teaching material"
            : "Standard — AI explainer enabled"}
        </div>
        <div className="text-ink-3 text-[11.5px] mt-0.5 leading-[1.5]">
          {on
            ? "Curated industry links served via the safety-pill viewer."
            : "Acumen generates a learning material on demand for this pill."}
        </div>
      </div>
    </div>
  );
}
