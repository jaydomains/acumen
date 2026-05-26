/**
 * CatalogueGrid — responsive grid of PillCards + an IntersectionObserver
 * sentinel that drives `useInfiniteQuery.fetchNextPage()` (FE-3 §C.5).
 *
 * The sentinel only fires when there's another cursor (`hasNextPage`)
 * and no fetch is already in flight, so it won't double-trigger on
 * fast scrolls.
 */

import { useEffect, useRef } from "react";
import type { PillResponse } from "@/lib/queries/catalogue";
import { PillCard } from "./PillCard";
import { Skeleton } from "@/components/ui/skeleton";

export type CatalogueGridProps = {
  pills: PillResponse[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
};

export function CatalogueGrid({
  pills,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: CatalogueGridProps) {
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
    <>
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="catalogue-grid"
      >
        {pills.map((pill) => (
          <PillCard key={pill.id} pill={pill} />
        ))}
      </div>
      {hasNextPage ? (
        <div
          ref={sentinelRef}
          data-testid="catalogue-sentinel"
          className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-hidden={!isFetchingNextPage}
        >
          {isFetchingNextPage ? [0, 1, 2].map((i) => <PillCardSkeleton key={i} />) : null}
        </div>
      ) : null}
    </>
  );
}

export function PillCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 border border-line bg-bg-raised p-5">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-7 w-24 mt-2" />
    </div>
  );
}
