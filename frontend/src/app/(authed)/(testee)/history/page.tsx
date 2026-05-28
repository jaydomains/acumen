"use client";

/**
 * Testee attempt history page (FE-7 §B.2).
 *
 * Slice 1 shipped the route shell + top-level state branches.
 * Slice 4 mounts the full `HistoryTable` with cursor-driven sentinel
 * pagination per LOCK-1 (`Page<AttemptListItem>` envelope per
 * CODE_SPEC §5).
 */

import { ApiError } from "@/lib/api/errors";
import { flattenAttempts, useMeAttemptsInfinite } from "@/lib/queries/me";
import { HistoryTable } from "@/components/profile/history-table";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function TesteeHistoryPage() {
  const attempts = useMeAttemptsInfinite();
  const rows = flattenAttempts(attempts.data);

  const apiError = attempts.error instanceof ApiError ? attempts.error : null;
  const endpointAbsent =
    apiError !== null && (apiError.status === 404 || apiError.status === 405);
  if (attempts.error && !endpointAbsent) {
    throw attempts.error;
  }

  if (attempts.isPending) {
    return <HistorySkeleton />;
  }

  if (endpointAbsent) {
    return (
      <div data-testid="history-endpoint-absent">
        <HistoryHero eyebrow="Your attempt history · Coming in v1.x" />
        <Card className="p-6 bg-bg-sunk text-center text-[13px] text-ink-3">
          Your attempt history arrives once we light up the{" "}
          <code className="font-mono">/v1/attempts</code> endpoint.
        </Card>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div data-testid="history-empty">
        <HistoryHero eyebrow="Your attempt history · 0 records" />
        <Card className="p-6 bg-bg-sunk text-center text-[13px] text-ink-3">
          No attempts yet.
        </Card>
      </div>
    );
  }

  return (
    <div data-testid="history-happy">
      <HistoryHero
        eyebrow={`Your attempt history · ${rows.length} record${rows.length === 1 ? "" : "s"}`}
      />
      <HistoryTable
        rows={rows}
        hasNextPage={Boolean(attempts.hasNextPage)}
        isFetchingNextPage={attempts.isFetchingNextPage}
        onLoadMore={() => {
          void attempts.fetchNextPage();
        }}
      />
    </div>
  );
}

function HistoryHero({ eyebrow }: { eyebrow: string }) {
  return (
    <div data-testid="history-hero" className="mb-6">
      <div className="eyebrow mb-2">{eyebrow}</div>
      <h1 className="font-serif text-[44px] leading-[1.05] tracking-[-0.025em] text-ink">
        Every attempt, in order.
      </h1>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div data-testid="history-skeleton" className="flex flex-col gap-4">
      <div>
        <Skeleton className="h-3 w-40 mb-3" />
        <Skeleton className="h-12 w-80" />
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    </div>
  );
}
