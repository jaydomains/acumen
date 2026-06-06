"use client";

/**
 * Root 500 boundary (Pattern C, FE-1 §C.6 + FE-2 §B.16). Catches errors
 * that bubble past every route group. Full-page posture — no shell, no
 * auth chrome — because this fires for unauth surfaces too.
 *
 * BoundaryFrame surfaces `error.code` (when `error instanceof ApiError`)
 * + `error.traceId` (populated by `unwrap()` from the `x-acumen-trace`
 * response header) + `error.digest` (Next.js per-error ID) inside the
 * collapsible footer.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/context";
import { dashboardPathFor } from "@/lib/auth/guards";
import { Icon } from "@/components/primitives/Icon";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const { role } = useAuth();
  const apiErr = error instanceof ApiError ? error : null;

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Pattern C root boundary caught:", {
      message: error.message,
      digest: error.digest,
      code: apiErr?.code,
      traceId: apiErr?.traceId,
    });
  }, [error, apiErr]);

  return (
    <BoundaryFrame
      glyph={<Icon name="wave" size={26} />}
      eyebrow="SOMETHING WENT WRONG"
      title={
        <>
          We hit <span className="serif-it">a snag</span>
        </>
      }
      body="The issue has been logged. Try again, or contact support if it persists."
      actions={
        <>
          <Button onClick={reset}>Try again →</Button>
          <Button variant="outline" onClick={() => router.push(dashboardPathFor(role))}>
            Go to dashboard
          </Button>
          {/* TODO(v1.x): wire real support channel */}
          <Button variant="ghost" disabled>
            Contact support
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
          <div className="flex gap-2">
            <dt className="text-ink-3">message</dt>
            <dd className="break-all">{error.message || "(empty)"}</dd>
          </div>
        </dl>
      }
    />
  );
}
