/**
 * ResultHero — top stat row + ReviewBanner (FE-6 §B.2).
 *
 * Four stat cards:
 *   1. Overall score (% from `result.overall_score`)
 *   2. Competence delta (signed float from `result.competence_estimate_delta`)
 *   3. Time on test (mm:ss from `result.time_on_test_seconds`)
 *   4. ReviewBanner (the AC-D19 cross-family review status)
 *
 * Variants the hero renders directly:
 *   - first_attempt: delta null → "—" + hint "first attempt"
 *   - benchmark: hide the delta column (AC-D5 / AC-D13 — benchmarks
 *     don't drive the loop, no per-pill competence write)
 *   - deterministic_only: ReviewBanner variant flips to "auto-graded"
 *
 * The `attempt_band` BandTag and the calibration confidence label are
 * deliberately *not* on the hero per spec §F.7 item 2 — the by-pill
 * card owns that surface.
 */

import { Stat } from "@/components/primitives/Stat";
import { ReviewBanner, type ReviewBannerVariant } from "./review-banner";
import { formatDelta } from "@/lib/result/format-delta";
import type { components } from "@/lib/api/types";

export type ResultHeroProps = {
  result: components["schemas"]["AttemptResultResponse"];
  reviewVariant: ReviewBannerVariant;
  isBenchmark?: boolean;
};

function formatTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.floor(seconds));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  if (hh > 0) return `${hh}h ${mm.toString().padStart(2, "0")}m`;
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return "—";
  return `${Math.round(score * 100)}%`;
}

export function ResultHero({
  result,
  reviewVariant,
  isBenchmark = false,
}: ResultHeroProps) {
  const delta = formatDelta(result.competence_estimate_delta);
  const aiGradeCount = (result.questions ?? []).filter((q) => q.is_ai_graded).length;
  const showDelta = !isBenchmark;
  const columns = showDelta ? "grid-cols-1 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3";

  return (
    <section data-testid="result-hero" className={`grid gap-3 ${columns}`}>
      <Stat
        value={formatScore(result.overall_score)}
        label="OVERALL"
        hint={
          result.outcome ? (
            <span data-testid="result-outcome">{result.outcome}</span>
          ) : null
        }
        tone="default"
      />
      {showDelta ? (
        <Stat
          value={<span data-tone={delta.tone}>{delta.display}</span>}
          label="COMPETENCE"
          hint={
            result.competence_estimate_delta === null ||
            result.competence_estimate_delta === undefined
              ? "first attempt"
              : null
          }
          tone={delta.tone === "ok" || delta.tone === "danger" ? "accent" : "default"}
        />
      ) : null}
      <Stat
        value={formatTime(result.time_on_test_seconds)}
        label="TIME"
        hint={
          result.median_time_seconds
            ? `median ${formatTime(result.median_time_seconds)}`
            : null
        }
      />
      <ReviewBanner
        variant={reviewVariant}
        reviewDurationMs={result.review_summary?.review_duration_ms}
        aiGradeCount={aiGradeCount}
      />
    </section>
  );
}
