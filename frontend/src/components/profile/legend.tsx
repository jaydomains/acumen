/**
 * Legend — band-colour pips + per-band counts + confidence-ring +
 * safety-mark legend for the constellation view (FE-7 §B.1 §2).
 *
 * Pure presentational. Per-band counts come from the parent so the
 * caller controls the aggregation source (typically
 * `pills.filter(p => p.band === b).length`). Mirrors the prototype
 * legend row at `constellation.jsx:172-188`.
 */

import { cn } from "@/lib/utils";
import type { Band } from "@/components/primitives/bands";

const BAND_ORDER: readonly Band[] = ["novice", "junior", "working", "advanced", "expert"];

const BAND_LABEL: Record<Band, string> = {
  novice: "Novice",
  junior: "Junior",
  working: "Working",
  advanced: "Advanced",
  expert: "Expert",
};

// Static class map so Tailwind v4 JIT picks up every band utility —
// dynamic `bg-band-${band}` interpolation produces missing classes.
const BAND_BG_CLASS: Record<Band, string> = {
  novice: "bg-band-novice",
  junior: "bg-band-junior",
  working: "bg-band-working",
  advanced: "bg-band-advanced",
  expert: "bg-band-expert",
};

export type LegendProps = {
  /** Count of pills per band — caller derives from the competence response. */
  counts: Record<Band, number>;
  className?: string;
};

export function Legend({ counts, className }: LegendProps) {
  return (
    <div
      data-testid="profile-legend"
      className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}
    >
      {BAND_ORDER.map((band) => (
        <div
          key={band}
          data-testid={`legend-band-${band}`}
          className="flex items-center gap-2"
        >
          <span
            aria-hidden="true"
            className={cn("inline-block w-2.5 h-2.5 rounded-full", BAND_BG_CLASS[band])}
          />
          <span className="text-[12px] text-ink-2">{BAND_LABEL[band]}</span>
          <span className="font-mono text-[11px] text-ink-4">{counts[band] ?? 0}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 ml-2" data-testid="legend-confidence">
        <span
          aria-hidden="true"
          className="inline-block w-3.5 h-3.5 rounded-full border-[1.5px] border-ink-3"
        />
        <span className="text-[12px] text-ink-2">Confidence ring</span>
      </div>
      <div className="flex items-center gap-2" data-testid="legend-safety">
        <span
          aria-hidden="true"
          className="inline-block w-2 h-2 rounded-full bg-danger"
        />
        <span className="text-[12px] text-ink-2">Safety-tagged</span>
      </div>
    </div>
  );
}
