"use client";

/**
 * GradingOverlay (FE-4 §B.1 §2; AC-D19 review wording).
 *
 * Post-submit overlay. Runs a 4-phase local animation while polling
 * `GET /v1/attempts/{id}/result` every 1.5s. Exits and routes to the
 * result page when `result.status === "ready"` (drift item 4 — the
 * backend ships `"ready"`, not the spec's `"complete"`).
 *
 * Polling is capped (plan amendment 2): max 30 attempts × 1.5s =
 * 45s before the overlay swaps to a "Taking longer than expected"
 * card with a link back to the dashboard. The polling never runs
 * indefinitely. The actual grading may complete later (cross-family
 * review can pop back to confirmed even after 45s via the reconcile
 * cron); the result page lights up on the next visit.
 *
 * `phaseAt` controls the visual checklist — pure decoration; the
 * polling-loop drives the actual dismissal.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { client, unwrap } from "@/lib/api/client";
import { attemptQueryKeys, type AttemptResultResponse } from "@/lib/queries/attempts";
import { Button } from "@/components/ui/button";

export type GradingOverlayProps = {
  attemptId: string;
  /** "frozen" / "hand_authored" / "per_testee" use the standard
   * 4-phase copy (same grading path); benchmark swaps phase-4 to
   * its non-recency copy. */
  mode: "frozen" | "hand_authored" | "benchmark" | "per_testee";
};

type Phase = {
  label: string;
  copy: string;
};

const FROZEN_PHASES: Phase[] = [
  {
    label: "Auto-grading",
    copy: "Auto-grading deterministic responses · MCQ + T/F + matching",
  },
  {
    label: "AI grading",
    copy: "AI grading short-answer responses · claude-sonnet",
  },
  {
    label: "Cross-family review",
    copy: "Cross-family review pass · OpenAI · 60s ceiling per AC-D19",
  },
  {
    label: "Competence + loop",
    copy: "Computing competence + queueing loop · recency-weighted per AC-D9",
  },
];

const BENCHMARK_PHASES: Phase[] = [
  ...FROZEN_PHASES.slice(0, 3),
  {
    label: "Benchmark score",
    copy: "Computing benchmark score + bands · no recency weighting (single sitting)",
  },
];

const PHASE_BREAKPOINTS_MS = [600, 1400, 2400, 3200];
const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 30;

export function GradingOverlay({ attemptId, mode }: GradingOverlayProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [, setPollCount] = useState(0);
  const [pollExhausted, setPollExhausted] = useState(false);

  const phases = mode === "benchmark" ? BENCHMARK_PHASES : FROZEN_PHASES;

  // Phase-stepping interval — purely visual.
  useEffect(() => {
    const timers = PHASE_BREAKPOINTS_MS.map((breakpoint, idx) =>
      setTimeout(() => setPhaseIdx(idx + 1), breakpoint),
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  // Polling — TanStack Query's `refetchInterval` gives us the cap-
  // aware loop for free; we increment our own counter on each
  // refetch and stop the loop when the cap is reached.
  const resultQuery = useQuery({
    queryKey: attemptQueryKeys.result(attemptId),
    queryFn: async () =>
      unwrap(
        client.GET("/v1/attempts/{attempt_id}/result", {
          params: { path: { attempt_id: attemptId } },
        }),
      ),
    refetchInterval: (q) => {
      const data = q.state.data as AttemptResultResponse | undefined;
      if (data?.status === "ready") return false;
      // V5 (audit): on a persistent result-poll error the query never
      // produces data, so the dataUpdatedAt-keyed cap below never advances
      // and the spinner would run forever. Stop polling on `error` status
      // and escape to the distinct error affordance below (retry available).
      if (q.state.status === "error") return false;
      if (pollExhausted) return false;
      return POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
  });

  // Count the polls + flip the cap when exceeded. `pollCount`
  // increments on every successful refetch (whether `ready` or
  // `review_pending`); the first call counts as poll #1.
  useEffect(() => {
    if (resultQuery.dataUpdatedAt === 0) return;
    setPollCount((n) => {
      const next = n + 1;
      if (next >= POLL_MAX_ATTEMPTS) setPollExhausted(true);
      return next;
    });
  }, [resultQuery.dataUpdatedAt]);

  // Success exit — route to the result placeholder.
  useEffect(() => {
    if (resultQuery.data?.status !== "ready") return;
    queryClient.invalidateQueries({ queryKey: attemptQueryKeys.detail(attemptId) });
    router.push(`/attempts/${attemptId}/result`);
  }, [resultQuery.data?.status, attemptId, queryClient, router]);

  // V5 (audit): a persistent result-poll error escapes PROMPTLY to a
  // distinct error affordance — not the slow-grading "still grading" card
  // (whose copy is wrong for a 500 and which only appears after the ~45s
  // cap). With retry:false each poll fails immediately, so `isError` flips
  // on the first failure and stays set (polling stopped above).
  if (resultQuery.isError && resultQuery.data?.status !== "ready") {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="grading-overlay-title"
        data-testid="grading-overlay"
        data-state="error"
        className="fixed inset-0 z-50 flex items-center justify-center bg-bg/90 backdrop-blur-sm"
      >
        <div className="flex w-full max-w-md flex-col gap-4 border border-danger bg-bg-raised p-8 text-ink">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-danger">
            Grading error
          </span>
          <h2
            id="grading-overlay-title"
            className="font-serif text-[24px] leading-tight tracking-[-0.01em]"
          >
            We couldn&apos;t load your result.
          </h2>
          <p className="text-[14px] leading-6 text-ink-2">
            Something went wrong fetching your grade. Try again, or head back to your
            dashboard — your result will be waiting once grading finishes.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              data-testid="grading-overlay-retry"
              variant="outline"
              onClick={() => {
                setPollExhausted(false);
                void resultQuery.refetch();
              }}
            >
              Try again
            </Button>
            <Button
              data-testid="grading-overlay-dashboard"
              variant="outline"
              onClick={() => router.push("/")}
            >
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (pollExhausted && resultQuery.data?.status !== "ready") {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="grading-overlay-title"
        data-testid="grading-overlay"
        data-state="timeout"
        className="fixed inset-0 z-50 flex items-center justify-center bg-bg/90 backdrop-blur-sm"
      >
        <div className="flex w-full max-w-md flex-col gap-4 border border-warn bg-bg-raised p-8 text-ink">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-warn">
            Still grading
          </span>
          <h2
            id="grading-overlay-title"
            className="font-serif text-[24px] leading-tight tracking-[-0.01em]"
          >
            Taking longer than expected — check back soon.
          </h2>
          <p className="text-[14px] leading-6 text-ink-2">
            The cross-family review is still running. Your result will land in your
            dashboard within a few minutes; you don&apos;t need to wait here.
          </p>
          <div className="flex justify-end">
            <Button
              data-testid="grading-overlay-dashboard"
              variant="outline"
              onClick={() => router.push("/")}
            >
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="grading-overlay-title"
      data-testid="grading-overlay"
      data-state="running"
      data-phase={phaseIdx}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/90 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-md flex-col gap-4 border border-line bg-bg-raised p-8 text-ink">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-accent">
          Grading
        </span>
        <h2
          id="grading-overlay-title"
          className="font-serif text-[24px] leading-tight tracking-[-0.01em]"
        >
          {phaseIdx >= phases.length
            ? "Hold on — cross-family review still running…"
            : "Working through your responses."}
        </h2>
        <ul className="flex flex-col gap-2 pt-2">
          {phases.map((phase, idx) => {
            const done = idx < phaseIdx;
            const active = idx === phaseIdx;
            const tone = done ? "text-ok" : active ? "text-ink" : "text-ink-4";
            const marker = done ? "✓" : active ? "•" : "·";
            return (
              <li
                key={phase.label}
                data-testid={`grading-overlay-phase-${idx}`}
                data-state={done ? "done" : active ? "active" : "pending"}
                className={`flex items-start gap-2 text-[12.5px] leading-5 ${tone}`}
              >
                <span aria-hidden className="font-mono">
                  {marker}
                </span>
                <span>{phase.copy}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
