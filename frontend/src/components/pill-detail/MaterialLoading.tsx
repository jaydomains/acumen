/**
 * MaterialLoading — right-column skeleton + generation status
 * (FE-3 §B.3 §2). Mirrors `pill-detail.jsx:148–181`.
 *
 * Used while `useLearningMaterial` resolves. Includes the
 * "Generating · claude-sonnet-4-5" status banner with a pulse-dot
 * and the "Usually ready in 4–8 seconds…" footer so the wait feels
 * acknowledged rather than blank.
 */

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MaterialLoading() {
  return (
    <Card
      data-testid="material-loading"
      className="flex flex-col gap-4 p-6"
      aria-busy="true"
    >
      <div className="flex items-center gap-2 text-accent-ink">
        <span className="inline-block h-2 w-2 animate-pulse bg-accent" aria-hidden />
        <span className="font-mono text-[11px] uppercase tracking-[0.08em]">
          Generating · claude-sonnet-4-5
        </span>
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/6" />
      <div className="mt-2 text-[12px] text-ink-4">Usually ready in 4–8 seconds…</div>
    </Card>
  );
}
