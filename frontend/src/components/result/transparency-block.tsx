/**
 * TransparencyBlock — cross-family review attribution + flagged-Q
 * anchor link (FE-6 §B.6).
 *
 * Hidden when:
 *   - status !== "ready" (review hasn't completed)
 *   - review_summary is null (deterministic-only attempt, no AI)
 *
 * Model IDs come from review_summary, NEVER hardcoded — AC-CD18.
 * Flagged-Q sub-line renders one anchor per flagged position; clicking
 * scrolls + flashes the matching ByQuestionCard row via the shared
 * scroll-to-question helper (FE-6 §C.9).
 */

"use client";

import { Card } from "@/components/ui/card";
import { scrollToQuestion } from "@/lib/result/scroll-to-question";
import type { components } from "@/lib/api/types";

type ReviewSummary = components["schemas"]["ReviewSummary"];

export type TransparencyBlockProps = {
  summary: ReviewSummary | null | undefined;
  status: string | undefined;
};

export function TransparencyBlock({ summary, status }: TransparencyBlockProps) {
  if (status !== "ready") return null;
  if (!summary) return null;

  const grader = summary.ai_grader_model ?? "the AI grader";
  const reviewer = summary.reviewer_model ?? "an independent reviewer";
  const durationSec =
    summary.review_duration_ms != null
      ? (summary.review_duration_ms / 1000).toFixed(1)
      : null;
  const flagged = summary.flagged_question_positions ?? [];

  return (
    <Card data-testid="transparency-block" className="bg-bg-sunk p-5 shadow-none">
      <p className="text-[12px] leading-relaxed text-ink-2">
        Your AI-graded responses were graded by{" "}
        <span className="mono text-ink">{grader}</span> and independently reviewed by{" "}
        <span className="mono text-ink">{reviewer}</span>
        {durationSec ? <> in a single {durationSec}-second batched call.</> : <>.</>}
      </p>
      {flagged.length > 0 ? (
        <p
          data-testid="transparency-flagged-line"
          className="mt-2 text-[12px] leading-relaxed text-warn"
        >
          {flagged.length === 1
            ? "One review was flagged for admin attention — your "
            : `${flagged.length} reviews were flagged — your `}
          {flagged.map((pos, idx) => (
            <span key={pos}>
              <button
                type="button"
                data-testid="transparency-flagged-anchor"
                onClick={() => scrollToQuestion(pos)}
                className="text-warn underline decoration-dotted underline-offset-2"
              >
                Q{pos}
              </button>
              {idx < flagged.length - 1 ? ", " : ""}
            </span>
          ))}
          {flagged.length === 1 ? " grade may be too low." : " grades may be too low."}
        </p>
      ) : null}
    </Card>
  );
}
