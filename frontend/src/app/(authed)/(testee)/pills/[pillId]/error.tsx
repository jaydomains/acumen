"use client";

/**
 * Pill detail route boundary (Pattern C). Renders when something
 * upstream throws — for example, a thrown ApiError that escapes
 * `useQuery`'s safety net. The in-page boundary inside
 * `page.tsx` covers the recoverable `query.isError` case.
 *
 * The body copy stays generic. The spec's "explicit drift boundary
 * for missing /v1/catalogue/pills/{pill_id}" (§E item 5) does not
 * apply in v1 — that endpoint is implemented.
 */

import { useEffect } from "react";
import Link from "next/link";
import { BoundaryFrame } from "@/components/shell/BoundaryFrame";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/primitives/Icon";

export default function PillDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Pill detail boundary:", error);
  }, [error]);

  return (
    <BoundaryFrame
      glyph={<Icon name="flag" size={26} />}
      eyebrow="PILL"
      title="Something broke on this pill."
      body="The page hit an error we weren't expecting. You can try again, or head back to the catalogue."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={reset}>
            Try again
          </Button>
          <Link
            href="/catalogue"
            className="inline-flex h-9 items-center px-3 text-sm font-medium text-ink underline-offset-4 hover:underline"
          >
            Back to catalogue
          </Link>
        </>
      }
      footer={
        error.digest ? (
          <span className="font-mono text-[10.5px] text-ink-4">
            digest: {error.digest}
          </span>
        ) : null
      }
    />
  );
}
