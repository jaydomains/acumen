"use client";

/**
 * SystemGlitchOverlay (FE-5 §B.4).
 *
 * Terminal-paused alternative to FE-4's ``<PauseOverlay>``. Mounts
 * when ``attempt.pause_reason !== null`` (currently only
 * ``"generation_failed"`` from the backend) OR when the SSE adapter
 * surfaces a FE-synthetic ``"reconnect_exhausted"`` after two failed
 * connects.
 *
 * Pause budget is NOT shown (comparison table in
 * ``streaming-paused.jsx:196-234`` — system-glitch pauses are NOT
 * deducted from the testee's AC-D11 pause budget). The
 * ``<PauseOverlay>``'s "N of M pause minutes remaining" footer is
 * absent here by design; the runner integration test guards against
 * accidental copy reuse.
 *
 * Resume CTA branches on ``reason``:
 *
 *   - ``generation_failed`` → POST /v1/attempts/{id}/resume then
 *     re-open SSE. The backend has already marked the attempt
 *     paused; resume flips ``paused: false`` and the
 *     ``StreamingRunner`` re-renders with ``enabled: true``.
 *   - ``reconnect_exhausted`` → re-open SSE only (no POST). The
 *     attempt is NOT server-paused; the runner stays mounted with
 *     ``enabled: true`` and calls ``useStreamingQueue``'s
 *     ``reconnect()``.
 */

import { useState } from "react";
import { Icon } from "@/components/primitives/Icon";
import { Button } from "@/components/ui/button";
import type { PausedReason } from "@/lib/api/sse";

export type SystemGlitchOverlayProps = {
  reason: PausedReason;
  failedPosition: number | null;
  completedPositions: number[];
  /** Backend trace id for the failure, if surfaced via the SSE
   * response's ``x-acumen-trace`` header (FE-5 §H(b)(6) — absent on
   * the SSE path in v1; renders as ``—`` when null). */
  traceId?: string | null;
  /** In-flight indicator for the resume mutation. */
  resuming?: boolean;
  /** Resume CTA — owner decides whether to POST /resume first. */
  onResume: () => void;
};

export function SystemGlitchOverlay({
  reason,
  failedPosition,
  completedPositions,
  traceId = null,
  resuming = false,
  onResume,
}: SystemGlitchOverlayProps) {
  const [expanded, setExpanded] = useState(false);

  const aheadCopy =
    failedPosition !== null
      ? `0 questions ahead (Q${failedPosition}+ generating)`
      : `${completedPositions.length} positions arrived before drop`;

  return (
    <div
      data-testid="system-glitch-overlay"
      data-reason={reason}
      role="dialog"
      aria-modal="true"
      aria-labelledby="system-glitch-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-bg/90 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-md flex-col gap-4 border border-line bg-bg-raised p-8 text-ink">
        <span
          aria-hidden
          className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-line bg-bg-sunk text-ink-3"
        >
          <Icon name="wave" size={22} />
        </span>
        <h2
          id="system-glitch-title"
          className="font-serif text-[28px] leading-tight tracking-[-0.01em]"
        >
          <em className="italic">Connection</em> issue.
        </h2>
        <p className="text-[14px] leading-6 text-ink-2">
          We hit a glitch generating your next questions. Try resuming in a minute — your
          progress is saved and your timer is held.
        </p>
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            data-testid="system-glitch-details-toggle"
            onClick={() => setExpanded((e) => !e)}
            className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3 hover:text-ink"
          >
            {expanded ? "— hide technical details" : "+ show technical details"}
          </button>
          <Button
            data-testid="system-glitch-resume"
            disabled={resuming}
            onClick={onResume}
          >
            {resuming ? "Trying…" : "Try resuming →"}
          </Button>
        </div>
        {expanded && (
          <dl
            data-testid="system-glitch-details"
            className="grid grid-cols-[64px_1fr] gap-y-1 border border-line bg-bg p-3 font-mono text-[11px]"
          >
            <dt className="uppercase tracking-[0.08em] text-ink-3">code</dt>
            <dd className="text-ink">{reason}</dd>
            <dt className="uppercase tracking-[0.08em] text-ink-3">trace</dt>
            <dd className="text-ink">{traceId ?? "—"}</dd>
            <dt className="uppercase tracking-[0.08em] text-ink-3">buffer</dt>
            <dd className="text-ink">{aheadCopy}</dd>
          </dl>
        )}
      </div>
    </div>
  );
}
