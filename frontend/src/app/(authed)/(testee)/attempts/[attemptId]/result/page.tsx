"use client";

/**
 * Testee attempt-result page (FE-6 §B.1).
 *
 * Replaces the FE-4 placeholder. Polls `/v1/attempts/{id}/result` per
 * AC-CD21 — 5 s while `status === "review_pending"`, stops on `ready`;
 * `refetchOnWindowFocus` flips on so a backgrounded tab returns to a
 * fresh check (`refetchIntervalInBackground` defaults to false in
 * TanStack v5).
 *
 * Slice 2 ships the page composition + hero + slot placeholders for
 * the cards that arrive in slices 3–5 (ByQuestionCard / ByPillCard /
 * AdaptiveLoopCard / TransparencyBlock / RealismAggregateCard /
 * PdfExportButton). Loading / pending / pending_overdue / ready states
 * are all handled here; the per-card states live with the card
 * components themselves.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { client, unwrap } from "@/lib/api/client";
import { attemptQueryKeys } from "@/lib/queries/attempts";
import { PageHeader } from "@/components/shell/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { ResultHero } from "@/components/result/result-hero";
import { ByQuestionCard } from "@/components/result/by-question-card";
import { ByPillCard } from "@/components/result/by-pill-card";
import { AdaptiveLoopCard } from "@/components/result/adaptive-loop-card";
import { TransparencyBlock } from "@/components/result/transparency-block";
import { RealismAggregateCard } from "@/components/result/realism-aggregate-card";
import { PdfExportButton } from "@/components/result/pdf-export-button";
import { useAttemptDetail } from "@/lib/queries/attempts";
import { deriveResultStatus } from "@/lib/result/derive-status";
import type { ReviewBannerVariant } from "@/components/result/review-banner";
import type { components } from "@/lib/api/types";

const POLL_INTERVAL_MS = 5_000;

type AttemptResultResponse = components["schemas"]["AttemptResultResponse"];

/**
 * V4 throwOnError predicate (audit V4 / F3). Throw to the Pattern-C
 * `result/error.tsx` boundary **only** when we have nothing to show — an
 * initial-fetch failure (`data === undefined`). A transient error during
 * polling (data already rendered as `review_pending`) must NOT nuke a valid
 * page; it recovers on the next interval. Exported so the predicate is
 * asserted at the config level even if the test harness's boundary shim
 * drifts.
 */
export const resultErrorIsInitial = (data: unknown): boolean => data === undefined;

export default function AttemptResultPage() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = params?.attemptId ?? "";

  const resultQuery = useQuery({
    queryKey: attemptId
      ? attemptQueryKeys.result(attemptId)
      : (["attempts", "noop", "result"] as const),
    queryFn: async () =>
      unwrap(
        client.GET("/v1/attempts/{attempt_id}/result", {
          params: { path: { attempt_id: attemptId } },
        }),
      ),
    enabled: Boolean(attemptId),
    refetchInterval: (q) =>
      q.state.data?.status === "review_pending" ? POLL_INTERVAL_MS : false,
    refetchOnWindowFocus: true,
    throwOnError: (_err, q) => resultErrorIsInitial(q.state.data),
  });

  const result = resultQuery.data as AttemptResultResponse | undefined;
  // Secondary fetch for the realism aggregate — gated on `ready` so we
  // don't double-fetch during the pending window. AttemptView.questions
  // is `list[dict]` (FE-6 §B.8 doc-comment promise); RealismAggregateCard
  // narrows the realism triple per-row.
  const attemptDetail = useAttemptDetail(
    attemptId && result?.status === "ready" ? attemptId : null,
  );

  const reviewVariant = useMemo<ReviewBannerVariant>(() => {
    const state = deriveResultStatus({
      status: result?.status,
      submittedAt: result?.submitted_at,
      loading: resultQuery.isPending,
    });
    if (state === "loading") return "pending";
    if (state === "pending") return "pending";
    if (state === "pending_overdue") return "pending_overdue";
    // ready
    const hasAiReview = Boolean(result?.review_summary);
    return hasAiReview ? "complete" : "complete_deterministic";
  }, [
    result?.status,
    result?.submitted_at,
    result?.review_summary,
    resultQuery.isPending,
  ]);

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto w-full max-w-[1100px] px-6 py-10 sm:px-10">
        <PageHeader
          eyebrow="RESULT"
          title="Your attempt result"
          subtitle={
            attemptId ? (
              <>
                attempt{" "}
                <code className="font-mono text-[12px] text-ink-3">
                  {attemptId.slice(0, 7)}…
                </code>
              </>
            ) : null
          }
        />

        {resultQuery.isPending ? (
          <HeroSkeleton />
        ) : result ? (
          <ResultHero result={result} reviewVariant={reviewVariant} />
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <section
            data-testid="result-questions-slot"
            className="flex flex-col gap-6 lg:col-span-7"
          >
            {result && result.status === "ready" ? (
              <>
                <ByPillCard pills={result.pills} />
                <ByQuestionCard
                  questions={result.questions}
                  headerSlot={
                    // ByQuestionCard only mounts under the ready guard
                    // above, so the gated state is unreachable here.
                    // Pass false explicitly per Gitar PR-#59 cleanup;
                    // moving the button outside the ready guard to
                    // surface the gated tooltip during review_pending
                    // is a separate FE-6.x design call.
                    <PdfExportButton attemptId={attemptId} isGated={false} />
                  }
                />
              </>
            ) : null}
          </section>
          <aside
            data-testid="result-side-slot"
            className="flex flex-col gap-6 lg:col-span-5"
          >
            {result && result.status === "ready" ? (
              <>
                <AdaptiveLoopCard steps={result.adaptive_loop} status={result.status} />
                <TransparencyBlock
                  summary={result.review_summary}
                  status={result.status}
                />
                <RealismAggregateCard questions={attemptDetail.data?.questions ?? null} />
              </>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <section data-testid="result-hero-skeleton" className="grid gap-3 sm:grid-cols-4">
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </section>
  );
}
