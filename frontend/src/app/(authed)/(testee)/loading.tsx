/**
 * (testee) loading — IN-SHELL skeleton. The (testee) layout's Rail +
 * TopBar render around this fallback, so the loading state only swaps
 * the page content for shimmer blocks (per FE-2-shell.md §B.18).
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function TesteeLoading() {
  return (
    <div className="space-y-6">
      {/* PageHeader skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* 4-stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-12 w-20" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* 2-column main */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-7 space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="col-span-12 lg:col-span-5 space-y-3">
          <Skeleton className="h-40 w-full" />
        </div>
      </div>

      <div className="flex items-center gap-2 text-ink-3 font-mono text-[11px] tracking-[0.06em] uppercase">
        <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
        Loading
      </div>
    </div>
  );
}
