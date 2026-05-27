"use client";

/**
 * Testee attempt history page (FE-7 §B.2).
 *
 * Slice 1 ships the route shell with the top-level state branches —
 * loading skeleton, endpoint_absent placeholder, empty fallback, and a
 * happy-state first-page stub. The full `HistoryTable` + sentinel
 * pagination land in Slice 4.
 *
 * Per LOCK-1, `GET /v1/attempts` ships under the canonical `Page<T>`
 * envelope (`{data, meta: {next_cursor}}` per CODE_SPEC §5);
 * `useMeAttemptsInfinite` consumes that shape and flattens via
 * `flattenAttempts` so the page only ever sees a row array.
 */

import { ApiError } from "@/lib/api/errors";
import { flattenAttempts, useMeAttemptsInfinite } from "@/lib/queries/me";
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
      <Card data-testid="history-table-slot" className="p-4">
        <div className="text-[12px] text-ink-3 mb-3">
          HistoryTable arrives in Slice 4. First page rows:{" "}
          <span className="font-mono">{rows.length}</span>.
        </div>
        <ul
          className="flex flex-col divide-y divide-line text-[13px]"
          data-testid="history-row-list"
        >
          {rows.map((row) => (
            <li
              key={row.attempt_id}
              data-testid="history-row-placeholder"
              data-attempt-id={row.attempt_id}
              data-origin={row.origin}
              className="flex items-baseline justify-between gap-3 py-2"
            >
              <span className="text-ink-2 flex-1 truncate">{row.pill_name}</span>
              <span className="font-mono text-[11px] text-ink-3">{row.origin}</span>
              <span className="font-mono text-[11px] text-ink-3">
                {row.score_percent.toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
        {attempts.hasNextPage ? (
          <div
            data-testid="history-sentinel-pending"
            className="mt-3 text-center text-[12px] text-ink-3"
          >
            Sentinel pagination arrives in Slice 4.
          </div>
        ) : null}
      </Card>
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
