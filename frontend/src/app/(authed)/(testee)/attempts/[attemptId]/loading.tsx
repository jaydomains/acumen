/**
 * Attempt-runner loading boundary (FE-4 §C.6).
 *
 * Rendered while Next.js streams in the page module + the initial
 * GET /v1/attempts/{id} resolves. Skeletons match the eventual
 * header band + question card shape so the layout doesn't jump on
 * resolve.
 */

import { Skeleton } from "@/components/ui/skeleton";

export default function AttemptRunnerLoading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-8 py-8">
        <Skeleton className="h-[88px] w-full" />
        <Skeleton className="h-[320px] w-full" />
        <Skeleton className="h-[56px] w-full" />
      </div>
    </div>
  );
}
