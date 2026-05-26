"use client";

/**
 * Pattern C error boundary (FE-1 §C.6).
 *
 * Next 15 App Router auto-catches render errors and unhandled promise
 * rejections inside route segments and renders this file. We surface
 * a centered Acumen card with the spec's two recovery affordances —
 * "Try again" (calls `reset` to re-mount the segment) and "Go to
 * dashboard" (router.push to "/") — plus an expandable disclosure
 * with the AC-CD6 error code and the backend trace id when available.
 *
 * The disclosure is intentionally collapsed by default: most users
 * only need the human copy. Operators and support staff can expand it
 * to copy the trace id into a ticket without leaving the page.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Waves } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthCardTitle } from "@/components/auth/AuthCardTitle";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const apiErr = error instanceof ApiError ? error : null;

  useEffect(() => {
    // Next emits a unique `digest` per server-rendered error which
    // shows up in the logs; surface to the console alongside the
    // structured fields so a dev tracing the issue gets a one-stop
    // payload.
    // eslint-disable-next-line no-console
    console.error("Pattern C boundary caught:", {
      message: error.message,
      digest: error.digest,
      code: apiErr?.code,
      traceId: apiErr?.traceId,
    });
  }, [error, apiErr]);

  return (
    <AuthShell>
      <AuthCard>
        <div className="flex flex-col items-center text-center">
          <div
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600"
          >
            <Waves className="h-6 w-6" />
          </div>
          <AuthCardTitle className="mt-4">Something went wrong</AuthCardTitle>
          <p className="mt-2 text-sm text-gray-600">
            We hit an unexpected error rendering this page. You can retry, or head back to
            the dashboard.
          </p>

          <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
            <Button onClick={reset} className="flex-1">
              Try again
            </Button>
            <Button variant="outline" onClick={() => router.push("/")} className="flex-1">
              Go to dashboard
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-6 text-xs text-gray-500 underline-offset-2 hover:underline"
          >
            {open ? "Hide technical details" : "+ Show technical details"}
          </button>
          {open ? (
            <dl className="mt-3 w-full space-y-1 rounded-md border border-gray-200 bg-gray-50 p-3 text-left text-xs text-gray-700">
              {apiErr?.code ? (
                <div className="flex gap-2">
                  <dt className="font-medium">code</dt>
                  <dd>
                    <code>{apiErr.code}</code>
                  </dd>
                </div>
              ) : null}
              {apiErr?.traceId ? (
                <div className="flex gap-2">
                  <dt className="font-medium">trace</dt>
                  <dd>
                    <code>{apiErr.traceId}</code>
                  </dd>
                </div>
              ) : null}
              {error.digest ? (
                <div className="flex gap-2">
                  <dt className="font-medium">digest</dt>
                  <dd>
                    <code>{error.digest}</code>
                  </dd>
                </div>
              ) : null}
              <div className="flex gap-2">
                <dt className="font-medium">message</dt>
                <dd className="break-all">{error.message || "(empty)"}</dd>
              </div>
            </dl>
          ) : null}
        </div>
      </AuthCard>
    </AuthShell>
  );
}
