"use client";

/**
 * (admin) error boundary — symmetric with the (testee) variant. Renders
 * inside (admin)/layout.tsx's shell chrome. Falls back to /ops via the
 * secondary action.
 */

import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { Icon } from "@/components/primitives/Icon";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";
import { Button } from "@/components/ui/button";

export default function AdminError({
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
      body="The issue has been logged. Try again, or head back to operations."
      actions={
        <>
          <Button onClick={reset}>Try again →</Button>
          <Button variant="outline" onClick={() => router.push("/ops")}>
            Go to operations
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
