"use client";

/**
 * DetailPane — full comparison for the selected grade-review row
 * (FE-9 admin-ops §B.2 §2, design `admin.jsx:223–298`). Header
 * (testee · pill · band · attempt), question + rubric extract, the
 * side-by-side AI-vs-reviewer comparison, the testee response, and the
 * "Apply override" CTA. Renders a placeholder when nothing is selected.
 *
 * Row data is the enriched list payload (§H(a) item 1 landed), so all
 * fields render real content — no sparse "—" placeholder.
 */

import { Pill } from "@/components/primitives/Pill";
import { BandTag } from "@/components/primitives/BandTag";
import { bandFromLevel } from "@/components/primitives/bands";
import { Button } from "@/components/ui/button";
import type { FlaggedGradeReviewItem } from "@/lib/queries/admin-grade-reviews";

export function DetailPane({
  review,
  onApplyOverride,
}: {
  review: FlaggedGradeReviewItem | null;
  onApplyOverride: () => void;
}) {
  if (!review) {
    return (
      <div
        className="flex h-full min-h-[280px] items-center justify-center border border-line bg-bg-raised p-10 text-center"
        data-testid="review-detail-empty"
      >
        <div>
          <div className="font-serif text-[18px] text-ink mb-1">
            Select a flagged grade
          </div>
          <div className="text-[13px] text-ink-3">
            Pick a row on the left to see the AI grade alongside the reviewer&rsquo;s
            pushback.
          </div>
        </div>
      </div>
    );
  }

  const band = bandFromLevel(review.band);

  return (
    <div className="border border-line bg-bg-raised" data-testid="review-detail">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="text-[15px] font-medium text-ink">{review.testee_name}</div>
          <div className="text-[13px] text-ink-3">{review.pill_name}</div>
          <div className="mt-1 font-mono text-[11px] text-ink-3">
            attempt {review.attempt_id.slice(0, 8)}
          </div>
        </div>
        {band ? <BandTag band={band} withLabel /> : <Pill mono>band {review.band}</Pill>}
      </div>

      {/* Question + rubric */}
      <div className="border-b border-line px-5 py-4">
        <div className="eyebrow mb-1">Question</div>
        <p className="text-[13px] text-ink-2">{review.question_prompt}</p>
        <details className="mt-3">
          <summary className="cursor-pointer text-[12px] text-ink-3">
            Rubric extract
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-[12.5px] text-ink-2">
            {review.rubric_extract}
          </p>
        </details>
      </div>

      {/* Testee response */}
      <div className="border-b border-line px-5 py-4">
        <div className="eyebrow mb-1">Testee response</div>
        <p className="whitespace-pre-wrap text-[13px] text-ink-2">
          {review.testee_response}
        </p>
      </div>

      {/* AI vs reviewer comparison */}
      <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
        <div className="px-5 py-4">
          <div className="eyebrow mb-2">AI grade</div>
          <div className="mb-1 flex items-center gap-2">
            <Pill mono>{review.ai_verdict}</Pill>
            <span className="font-mono text-[13px] text-ink">
              {review.ai_score.toFixed(2)}
            </span>
          </div>
          <p className="text-[12.5px] text-ink-3">{review.ai_reasoning ?? "—"}</p>
        </div>
        <div className="px-5 py-4">
          <div className="eyebrow mb-2">Reviewer pushback</div>
          <p className="text-[12.5px] text-ink-2">{review.review_reasoning ?? "—"}</p>
        </div>
      </div>

      {/* CTA */}
      <div className="flex justify-end px-5 py-4">
        <Button
          type="button"
          onClick={onApplyOverride}
          data-testid="review-apply-override"
        >
          Apply override →
        </Button>
      </div>
    </div>
  );
}
