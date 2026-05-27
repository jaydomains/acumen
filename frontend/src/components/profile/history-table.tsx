/**
 * HistoryTable — testee attempt history with IntersectionObserver
 * sentinel pagination (FE-7 §B.2 §2; prototype source at
 * `frontend/design-reference/prototype/testee.jsx:509-528`).
 *
 * Consumes the canonical `Page<AttemptListItem>` envelope per LOCK-1
 * — rows arrive already-flattened from `flattenAttempts` in the
 * /history page. Mirrors the FE-3 catalogue sentinel pattern at
 * `components/catalogue/CatalogueGrid.tsx`: a hidden div at the end
 * of the rendered rows is observed; intersection fires `onLoadMore`
 * when `hasNextPage` is true and no fetch is already in-flight.
 */

import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import type { AttemptListItem } from "@/lib/queries/me";
import { HistoryRow } from "./history-row";

export type HistoryTableProps = {
  rows: ReadonlyArray<AttemptListItem>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  className?: string;
};

export function HistoryTable({
  rows,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  className,
}: HistoryTableProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    if (typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          onLoadMore();
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, onLoadMore]);

  return (
    <Card data-testid="history-table" className={className}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-bg-sunk">
              <th className="px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
                When
              </th>
              <th className="px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
                Pill
              </th>
              <th className="px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
                Origin
              </th>
              <th className="px-3 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
                Score
              </th>
              <th className="px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
                Band
              </th>
              <th className="px-3 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
                Δ comp
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <HistoryRow key={row.attempt_id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
      {hasNextPage ? (
        <div
          ref={sentinelRef}
          data-testid="history-sentinel"
          className="border-t border-line py-3 text-center font-mono text-[11px] text-ink-3"
          aria-live="polite"
        >
          {isFetchingNextPage ? "Loading more…" : "Scroll to load more"}
        </div>
      ) : null}
    </Card>
  );
}
