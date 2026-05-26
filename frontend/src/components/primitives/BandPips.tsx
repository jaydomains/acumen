/**
 * BandPips — five small dots; the first `BAND_PIP_LEVEL[band]` are filled
 * with `--band-{band}`, the rest are outlined `--line`. No container bg.
 * Compact band display for dense table cells (FE-7 / FE-9).
 */

import { cn } from "@/lib/utils";
import { BAND_PIP_LEVEL, type Band } from "./bands";

const FILL_CLASS: Record<Band, string> = {
  novice: "bg-band-novice",
  junior: "bg-band-junior",
  working: "bg-band-working",
  advanced: "bg-band-advanced",
  expert: "bg-band-expert",
};

export type BandPipsProps = {
  band: Band;
  className?: string;
};

export function BandPips({ band, className }: BandPipsProps) {
  const fillCount = BAND_PIP_LEVEL[band];
  return (
    <span
      className={cn("inline-flex items-center gap-[2px]", className)}
      data-band={band}
      data-testid="band-pips"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={cn(
            "block w-2 h-2 rounded-full",
            i < fillCount ? FILL_CLASS[band] : "bg-line",
          )}
          data-filled={i < fillCount ? "true" : "false"}
        />
      ))}
    </span>
  );
}
