/**
 * BandTag — competency band stamp. AC-D9 names + AC-D9 amendment float
 * estimate + AC-D20 calibration confidence. Backed by the `--band-{band}`
 * tokens from globals.css.
 *
 * Static class maps (BG_CLASS / PIP_BG_CLASS) so Tailwind v4 JIT picks up
 * every band utility — dynamic interpolation like `bg-band-${band}` would
 * silently produce missing classes.
 */

import { cn } from "@/lib/utils";
import { BAND_PIP_LEVEL, type Band } from "./bands";

const LABEL: Record<Band, string> = {
  novice: "Novice",
  junior: "Junior",
  working: "Working",
  advanced: "Advanced",
  expert: "Expert",
};

const BG_CLASS: Record<Band, string> = {
  novice: "bg-band-novice",
  junior: "bg-band-junior",
  working: "bg-band-working",
  advanced: "bg-band-advanced",
  expert: "bg-band-expert",
};

export type BandConfidence = "preliminary" | "confident";

export type BandTagProps = {
  band: Band;
  withLabel?: boolean;
  withPips?: boolean;
  /** Per AC-D9 amendment: appended as `(6.7)` next to the band label. */
  estimate?: number;
  /** Per AC-D20: appended as `· preliminary` or `· confident`. */
  confidence?: BandConfidence;
  className?: string;
};

export function BandTag({
  band,
  withLabel = true,
  withPips = false,
  estimate,
  confidence,
  className,
}: BandTagProps) {
  const parts: string[] = [];
  if (withLabel) {
    parts.push(LABEL[band]);
    if (typeof estimate === "number") {
      parts[parts.length - 1] += ` (${estimate.toFixed(1)})`;
    }
    if (confidence) {
      parts.push(`· ${confidence}`);
    }
  }
  const text = parts.join(" ");
  const fillCount = BAND_PIP_LEVEL[band];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-[9px] py-[2px] rounded-none",
        "font-mono text-[10px] tracking-[0.06em] uppercase",
        "text-bg-raised",
        BG_CLASS[band],
        className,
      )}
      data-band={band}
    >
      {withLabel ? text : null}
      {withPips ? (
        <span className="ml-1 inline-flex gap-[2px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={cn(
                "block w-[6px] h-[6px] rounded-full",
                i < fillCount ? "bg-bg-raised" : "bg-bg-raised/40",
              )}
            />
          ))}
        </span>
      ) : null}
    </span>
  );
}
