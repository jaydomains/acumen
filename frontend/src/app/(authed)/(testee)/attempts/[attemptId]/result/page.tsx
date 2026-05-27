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
import { deriveResultStatus } from "@/lib/result/derive-status";
import type { ReviewBannerVariant } from "@/components/result/review-banner";
import type { components } from "@/lib/api/types";

const POLL_INTERVAL_MS = 5_000;

type AttemptResultResponse = components["schemas"]["AttemptResultResponse"];

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
  });

  const result = resultQuery.data as AttemptResultResponse | undefined;

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
          {/* Slice 3 — ByQuestionCard mounts in this column. */}
          <section data-testid="result-questions-slot" className="lg:col-span-7" />
          {/* Slice 4/5 — ByPillCard / AdaptiveLoopCard / TransparencyBlock /
              RealismAggregateCard mount in this column. */}
          <aside
            data-testid="result-side-slot"
            className="lg:col-span-5 flex flex-col gap-6"
          />
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
