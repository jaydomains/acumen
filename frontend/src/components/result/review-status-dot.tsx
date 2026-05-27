/**
 * ReviewStatusDot — the shared pulse-dot primitive used in
 * the ResultHero ReviewBanner (FE-6 §B.2) and the per-Q AiReviewChip
 * (§B.4). Tone maps to a project token so no hex leaks into the file.
 *
 * `pulsing` toggles the `.pulse-dot` keyframe (defined in globals.css);
 * static dots (e.g. the "complete" steady-state) omit it.
 */

import { cn } from "@/lib/utils";

export type ReviewStatusDotTone = "ink-3" | "ok" | "warn" | "danger" | "accent";

const TONE_BG: Record<ReviewStatusDotTone, string> = {
  "ink-3": "bg-ink-3",
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
  accent: "bg-accent",
};

export type ReviewStatusDotProps = {
  tone: ReviewStatusDotTone;
  pulsing?: boolean;
  size?: number;
  className?: string;
};

export function ReviewStatusDot({
  tone,
  pulsing = false,
  size = 8,
  className,
}: ReviewStatusDotProps) {
  return (
    <span
      data-testid="review-status-dot"
      data-tone={tone}
      className={cn(
        "inline-block rounded-full",
        TONE_BG[tone],
        pulsing && "pulse-dot",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
