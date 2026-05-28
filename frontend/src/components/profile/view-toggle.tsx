/**
 * ViewToggle — segmented two-button control for the profile page's
 * constellation ↔ matrix view switch (FE-7 §B.1 §2).
 *
 * Controlled component: value + onChange live in the parent
 * (ProfilePage) per FE-7 §B.1 §1 (view choice is local state, not URL
 * state). Mirrors the prototype's `.seg` segmented control at
 * `constellation.jsx:166-169`.
 */

import { cn } from "@/lib/utils";

export type ViewToggleValue = "constellation" | "matrix";

export type ViewToggleProps = {
  value: ViewToggleValue;
  onChange: (next: ViewToggleValue) => void;
  className?: string;
};

const SEG_CLASS =
  "px-3 py-1.5 text-[12px] font-mono uppercase tracking-[0.08em] border border-line " +
  "transition-colors duration-100 " +
  "data-[active=true]:bg-ink data-[active=true]:text-bg-raised " +
  "hover:bg-bg-deep data-[active=true]:hover:bg-ink";

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="Profile view"
      data-testid="view-toggle"
      className={cn("inline-flex items-center", className)}
    >
      <button
        type="button"
        data-active={value === "constellation"}
        aria-pressed={value === "constellation"}
        onClick={() => onChange("constellation")}
        className={SEG_CLASS}
      >
        Constellation
      </button>
      <button
        type="button"
        data-active={value === "matrix"}
        aria-pressed={value === "matrix"}
        onClick={() => onChange("matrix")}
        className={cn(SEG_CLASS, "-ml-px")}
      >
        Matrix
      </button>
    </div>
  );
}
