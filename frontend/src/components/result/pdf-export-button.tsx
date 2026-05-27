/**
 * PdfExportButton — Blob-URL PDF download (FE-6 §B.7).
 *
 * Five states:
 *   gated      — review_pending: button disabled with Tooltip
 *   idle       — ready: "Download PDF →"
 *   generating — mutation in flight: spinner + "(typically 3–10s)"
 *   success    — brief: "✓ Downloaded" then re-arms to idle
 *   error      — failed: "✗ Export failed" + retry toast
 *
 * The mutation does a raw `fetch` against /v1/attempts/{id}/export.pdf
 * (Blob responses don't flow through openapi-fetch) with the bearer
 * read from the auth-storage memory cell. Honours
 * Content-Disposition filename per FE-6 §B.7 contract, falling back
 * to attempt-{prefix}.pdf if the header is absent or unparseable.
 */

"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { parseContentDisposition } from "@/lib/result/parse-content-disposition";
import { ReviewStatusDot } from "./review-status-dot";
import { getAccessToken } from "@/lib/auth/storage";
import { getApiBaseUrl } from "@/lib/api/client";
import { ApiError, parseError } from "@/lib/api/errors";

export type PdfExportState = "gated" | "idle" | "generating" | "success" | "error";

export type PdfExportButtonProps = {
  attemptId: string;
  /** When result.status !== "ready" the button is gated. */
  isGated: boolean;
};

export function PdfExportButton({ attemptId, isGated }: PdfExportButtonProps) {
  const [flashSuccess, setFlashSuccess] = useState(false);

  const mutation = useMutation({
    mutationKey: ["attempts", attemptId, "export.pdf"],
    mutationFn: async (): Promise<{ blob: Blob; filename: string }> => {
      const token = getAccessToken();
      const base = getApiBaseUrl();
      const url = `${base}/v1/attempts/${attemptId}/export.pdf`;
      const resp = await fetch(url, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) {
        // ApiError envelope per AC-CD6 — `parseError` handles JSON
        // + plaintext fallback for the rare 5xx case where the
        // backend doesn't emit our envelope shape.
        throw await parseError(resp);
      }
      const blob = await resp.blob();
      const filename =
        parseContentDisposition(resp.headers.get("Content-Disposition")) ??
        `attempt-${attemptId.slice(0, 5)}.pdf`;
      return { blob, filename };
    },
    onSuccess: ({ blob, filename }) => {
      if (typeof document === "undefined") return;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Defer revoke so the synthetic click completes against a
      // live object URL — same pattern as the spec's contract.
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      toast.success(`${filename} · check your downloads`);
      setFlashSuccess(true);
    },
    onError: (err: unknown) => {
      const apiErr = err instanceof ApiError ? err : null;
      toast.error("Couldn't export the PDF", {
        description:
          apiErr?.code === "attempt_not_submitted"
            ? "This attempt hasn't been submitted yet."
            : "Something went wrong. Try again.",
        action: {
          label: "Try again →",
          onClick: () => mutation.mutate(),
        },
      });
    },
  });

  // Re-arm to idle after ~2 s of success flash.
  useEffect(() => {
    if (!flashSuccess) return;
    const t = window.setTimeout(() => setFlashSuccess(false), 2_000);
    return () => window.clearTimeout(t);
  }, [flashSuccess]);

  const state: PdfExportState = isGated
    ? "gated"
    : mutation.isPending
      ? "generating"
      : mutation.isError
        ? "error"
        : flashSuccess
          ? "success"
          : "idle";

  if (state === "gated") {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled
                data-testid="pdf-export-button"
                data-state={state}
                aria-disabled="true"
              >
                Download PDF →
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Results aren&apos;t ready yet — try once review completes.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const label = stateLabel(state);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => mutation.mutate()}
      disabled={state === "generating"}
      data-testid="pdf-export-button"
      data-state={state}
    >
      {state === "generating" ? <ReviewStatusDot tone="accent" pulsing size={6} /> : null}
      {state === "success" ? <span className="text-ok">✓ </span> : null}
      {state === "error" ? <span className="text-danger">✗ </span> : null}
      <span>{label}</span>
    </Button>
  );
}

function stateLabel(state: PdfExportState): string {
  switch (state) {
    case "generating":
      return "Generating… (typically 3–10s)";
    case "success":
      return "Downloaded";
    case "error":
      return "Export failed";
    default:
      return "Download PDF →";
  }
}
