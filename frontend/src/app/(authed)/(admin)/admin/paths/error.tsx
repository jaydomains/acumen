"use client";

/**
 * Paths-page Pattern C boundary per FE-8 §C.8
 * (`fe-specs/FE-8-admin-catalogue.md:1226–1228`). Matches catalogue's
 * boundary shape (Slice 2 absorption — parent `(admin)/error.tsx`
 * stays untouched; child localises copy).
 */

import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { Icon } from "@/components/primitives/Icon";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";
import { Button } from "@/components/ui/button";

export default function PathsError({
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
      eyebrow="LEARNING PATHS"
      title={
        <>
          Couldn&rsquo;t load <span className="serif-it">learning paths</span>
        </>
      }
      body="The paths request failed. Try again, and if it keeps failing, let your administrator know."
      actions={
        <>
          <Button onClick={reset}>Try again →</Button>
          <Button variant="outline" onClick={() => router.push("/ops")}>
            Go to admin dashboard
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
