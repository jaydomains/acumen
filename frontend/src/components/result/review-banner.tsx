/**
 * ReviewBanner — the fourth slot of the ResultHero stat row that
 * surfaces the AC-D19 cross-family review state to the testee.
 *
 * Variants (driven by `deriveResultStatus()` upstream):
 *   pending          — ink-3 pulse-dot, "Checking your AI grades…"
 *   pending_overdue  — warn pulse-dot, "admin will review within ~5 min"
 *                      (AC-D19 v1.7 reconcile-cron path past 60-s ceiling)
 *   complete         — ok pulse-dot, "All N AI grades cross-checked …"
 *   complete_deterministic — static "Auto-graded · no AI review needed"
 *
 * No hex values; every colour resolves to a project token via
 * `ReviewStatusDot`. Copy strings centralised so the matching Vitest
 * file can assert on them directly.
 */

import { ReviewStatusDot } from "./review-status-dot";

export type ReviewBannerVariant =
  | "pending"
  | "pending_overdue"
  | "complete"
  | "complete_deterministic";

export const REVIEW_BANNER_COPY = {
  pending: {
    label: "REVIEW PENDING",
    body: "Checking your AI-graded responses…",
    meta: "usually 4–8 seconds",
  },
  pending_overdue: {
    label: "REVIEW PENDING",
    body: "Cross-family review still running",
    meta: "admin will review within ~5 min",
  },
  complete: {
    label: "REVIEW COMPLETE",
    body: "AI grades cross-checked",
    meta: "in {duration}s",
  },
  complete_deterministic: {
    label: "AUTO-GRADED",
    body: "No AI review needed",
    meta: "",
  },
} as const;

const VARIANT_TONE = {
  pending: { tone: "ink-3", pulsing: true },
  pending_overdue: { tone: "warn", pulsing: true },
  complete: { tone: "ok", pulsing: false },
  complete_deterministic: { tone: "ok", pulsing: false },
} as const;

export type ReviewBannerProps = {
  variant: ReviewBannerVariant;
  /** Surfaced for `complete` variant only — `ms` from review_summary.review_duration_ms */
  reviewDurationMs?: number | null | undefined;
  /** Surfaced for `complete` variant only — count of AI grades */
  aiGradeCount?: number;
};

export function ReviewBanner({
  variant,
  reviewDurationMs,
  aiGradeCount,
}: ReviewBannerProps) {
  const copy = REVIEW_BANNER_COPY[variant];
  const tone = VARIANT_TONE[variant];

  let bodyText: string = copy.body;
  let metaText: string = copy.meta;

  if (variant === "complete") {
    if (typeof aiGradeCount === "number" && aiGradeCount > 0) {
      bodyText = `All ${aiGradeCount} AI grade${aiGradeCount === 1 ? "" : "s"} cross-checked`;
    }
    if (typeof reviewDurationMs === "number" && reviewDurationMs > 0) {
      const seconds = (reviewDurationMs / 1000).toFixed(1);
      metaText = `in ${seconds}s`;
    } else {
      metaText = "";
    }
  }

  return (
    <div
      data-testid="review-banner"
      data-variant={variant}
      className="border border-line bg-bg-raised p-4"
    >
      <div className="mb-2 flex items-center gap-2">
        <ReviewStatusDot tone={tone.tone} pulsing={tone.pulsing} />
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
          {copy.label}
        </span>
      </div>
      <div className="text-[13px] leading-snug text-ink">{bodyText}</div>
      {metaText ? (
        <div className="mt-1 text-[12px] leading-snug text-ink-3">{metaText}</div>
      ) : null}
    </div>
  );
}
