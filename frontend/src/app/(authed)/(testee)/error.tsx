"use client";

/**
 * (testee) error boundary — IN-SHELL posture. Per Next.js App Router
 * semantics this file renders INSIDE (testee)/layout.tsx, so the Rail
 * and TopBar remain visible; only the page content area swaps to the
 * BoundaryFrame. Fires for errors thrown by testee pages (the layout
 * itself escapes to (authed)/error.tsx).
 */

import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { Icon } from "@/components/primitives/Icon";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";
import { Button } from "@/components/ui/button";

export default function TesteeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const apiErr = error instanceof ApiError ? error : null;
  return (
    <BoundaryFrame
      glyph={<Icon name="wave" size={26} />}
      eyebrow="SOMETHING WENT WRONG"
      title={
        <>
          We hit <span className="serif-it">a snag</span>
        </>
      }
      body="The issue has been logged. Try again, or head back to the dashboard."
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
  );
}
