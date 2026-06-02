"use client";

/**
 * History-page Pattern C boundary (FE-7 §C.6).
 *
 * Fires on a non-404/405 failure of `GET /v1/attempts` (the page's
 * 404/405 load-error branch intercepts those itself). Mirrors the
 * FE-6 result-page boundary.
 */

import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { Icon } from "@/components/primitives/Icon";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";
import { Button } from "@/components/ui/button";

export default function HistoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const apiErr = error instanceof ApiError ? error : null;
  return (
    <div className="min-h-screen bg-bg">
      <BoundaryFrame
        glyph={<Icon name="history" size={26} />}
        eyebrow="HISTORY"
        title={<>Couldn&apos;t load your history.</>}
        body="The history fetch failed. Try again, or head back to the dashboard."
        actions={
          <>
            <Button onClick={reset}>Try again →</Button>
            <Button variant="outline" onClick={() => router.push("/")}>
              Go to dashboard
            </Button>
          </>
        }
        footer={
          <dl className="space-y-1">
            {apiErr?.code ? (
              <div className="flex gap-2">
                <dt className="text-ink-3">code</dt>
                <dd>
                  <code>{apiErr.code}</code>
                </dd>
              </div>
            ) : null}
            {apiErr?.traceId ? (
              <div className="flex gap-2">
                <dt className="text-ink-3">trace</dt>
                <dd>
                  <code>{apiErr.traceId}</code>
                </dd>
              </div>
            ) : null}
            {error.digest ? (
              <div className="flex gap-2">
                <dt className="text-ink-3">digest</dt>
                <dd>
                  <code>{error.digest}</code>
                </dd>
              </div>
            ) : null}
          </dl>
        }
      />
    </div>
  );
}
