"use client";

/**
 * Result-page Pattern C boundary (FE-6 §C.4).
 *
 * Fires on initial-fetch failure of `GET /v1/attempts/{id}/result`.
 * Mirrors the runner-level boundary (../error.tsx) — same
 * BoundaryFrame, same details disclosure, "Try again" / "Go to
 * dashboard" actions.
 */

import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { Icon } from "@/components/primitives/Icon";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";
import { Button } from "@/components/ui/button";

export default function AttemptResultError({
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
        glyph={<Icon name="flag" size={26} />}
        eyebrow="RESULT"
        title={<>Couldn&apos;t load these results.</>}
        body="The result fetch failed. Try again, or head back to the dashboard."
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
