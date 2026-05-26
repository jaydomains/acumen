"use client";

/**
 * (authed) error boundary — full-page posture because the (authed)
 * layout itself does not mount the shell (Rail + TopBar live one layer
 * deeper in (testee)/(admin)/layout.tsx). Fires for errors thrown by
 * (authed)/layout.tsx itself or by direct (authed) children not nested
 * under a role layout.
 */

import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { Icon } from "@/components/primitives/Icon";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";
import { Button } from "@/components/ui/button";

export default function AuthedError({
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
