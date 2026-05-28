"use client";

/**
 * Catalogue Pattern C boundary (FE-8 §B.1 row `error` +
 * §C.8 in `fe-specs/FE-8-admin-catalogue.md:1226–1228`).
 *
 * Sits under the parent `(authed)/(admin)/error.tsx` so it intercepts
 * any tab-query throw before the parent admin boundary fires.
 * Copy localised per §B.1 §5: "Couldn't load the catalogue." + Try
 * again + Go to admin dashboard.
 */

import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { Icon } from "@/components/primitives/Icon";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";
import { Button } from "@/components/ui/button";

export default function CatalogueError({
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
      eyebrow="CATALOGUE"
      title={
        <>
          Couldn&rsquo;t load <span className="serif-it">the catalogue</span>
        </>
      }
      body="The catalogue request failed. Try again, and if it keeps failing, let your administrator know."
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
