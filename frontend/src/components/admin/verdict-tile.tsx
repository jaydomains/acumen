"use client";

/**
 * VerdictTile — single selectable verdict tile (FE-9 admin-ops §B.2 §2,
 * design `admin.jsx:265–272`). A ~square tile showing a label + numeric
 * score subtitle, with a check icon when selected. Rendered inside a
 * `role="radiogroup"` by the caller; each tile is a `role="radio"`.
 *
 * **Canonical FE-9 definition** — reused by the sibling systems spec's
 * calibration verdict-choice (`FE-9-admin-systems.md` §B.2).
 */

import { Icon } from "@/components/primitives/Icon";
import { cn } from "@/lib/utils";

export type VerdictTileProps = {
  /** Top label, e.g. "Full" / "Partial" / "None". */
  label: string;
  /** Numeric score rendered as the subtitle, e.g. 1, 0.6, 0.4, 0. */
  score: number;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
};

export function VerdictTile({
  label,
  score,
  selected,
  onSelect,
  disabled,
}: VerdictTileProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${label} · ${score.toFixed(1)}`}
      disabled={disabled}
      onClick={onSelect}
      data-testid={`verdict-tile-${label.toLowerCase()}-${score}`}
      className={cn(
        "relative flex aspect-square flex-col items-start justify-between border p-3 text-left transition-colors",
        selected
          ? "border-ink bg-ink text-bg-raised"
          : "border-line bg-bg-raised text-ink-2 hover:bg-bg-deep",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {selected ? (
        <span className="absolute right-2 top-2" aria-hidden>
          <Icon name="check" size={14} />
        </span>
      ) : null}
      <span className="font-medium text-[13px]">{label}</span>
      <span
        className={cn("font-mono text-[18px]", selected ? "text-bg-raised" : "text-ink")}
      >
        {score.toFixed(1)}
      </span>
    </button>
  );
}
