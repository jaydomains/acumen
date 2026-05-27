/**
 * AiReviewChip — per-Q AI review status badge (FE-6 §B.4).
 *
 * Variants:
 *   pending        — pulse-dot ink-3, "Reviewing…"
 *   confirmed      — soft ok, "AI graded"
 *   flagged        — warn, "Admin reviewing"
 *
 * Renders nothing for deterministic items (caller passes
 * `verdict === null`). The chip composes the FE-2 `Pill` primitive +
 * `ReviewStatusDot` so it inherits the project tone tokens.
 */

import { Pill } from "@/components/primitives/Pill";
import { ReviewStatusDot } from "./review-status-dot";

export type AiReviewVerdict = "pending" | "confirmed" | "flagged";

export type AiReviewChipProps = {
  verdict: AiReviewVerdict | null | undefined;
};

const COPY: Record<AiReviewVerdict, string> = {
  pending: "Reviewing…",
  confirmed: "AI graded",
  flagged: "Admin reviewing",
};

export function AiReviewChip({ verdict }: AiReviewChipProps) {
  if (!verdict) return null;
  if (verdict === "pending") {
    return (
      <Pill tone="default" mono>
        <ReviewStatusDot tone="ink-3" pulsing size={6} />
        <span>{COPY.pending}</span>
      </Pill>
    );
  }
  if (verdict === "flagged") {
    return (
      <Pill tone="warn" mono>
        <ReviewStatusDot tone="warn" size={6} />
        <span>{COPY.flagged}</span>
      </Pill>
    );
  }
  return (
    <Pill tone="ok" mono>
      <ReviewStatusDot tone="ok" size={6} />
      <span>{COPY.confirmed}</span>
    </Pill>
  );
}
