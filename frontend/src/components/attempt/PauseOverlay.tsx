"use client";

/**
 * PauseOverlay (FE-4 §B.1 §2, AC-D11).
 *
 * Fixed overlay above the question pane (z-30). Blanks question
 * content (the page also sets the question pane's `visibility:
 * hidden` for belt-and-braces). Centered card with AC-D11 copy and
 * a Resume button.
 *
 * The "N of M pause minutes remaining" footer is informational —
 * the parent computes the figure from `pause_seconds_remaining` on
 * the AttemptView (or the test's `max_pause_duration_minutes`) and
 * passes it as `remainingMinutes`.
 */

import { Button } from "@/components/ui/button";

export type PauseOverlayProps = {
  remainingMinutes: number | null;
  onResume: () => void;
  resumePending?: boolean;
};

export function PauseOverlay({
  remainingMinutes,
  onResume,
  resumePending = false,
}: PauseOverlayProps) {
  return (
    <div
      data-testid="pause-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-overlay-title"
      className="fixed inset-0 z-30 flex items-center justify-center bg-bg/90 backdrop-blur-sm"
    >
      <div className="flex w-full max-w-md flex-col gap-4 border border-line bg-bg-raised p-8 text-ink">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
          Paused
        </span>
        <h2
          id="pause-overlay-title"
          className="font-serif text-[28px] leading-tight tracking-[-0.01em]"
        >
          Take a breath — the timer&apos;s held.
        </h2>
        <p className="text-[14px] leading-6 text-ink-2">
          We&apos;ve hidden the question while you&apos;re paused so the integrity surface
          stays clean. Click Resume to come back to it.
        </p>
        <div className="flex items-center justify-between gap-3 pt-2">
          <span
            data-testid="pause-overlay-remaining"
            className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-3"
          >
            {remainingMinutes == null
              ? "No pause window cap"
              : `${remainingMinutes}m pause remaining today`}
          </span>
          <Button
            data-testid="pause-overlay-resume"
            disabled={resumePending}
            onClick={onResume}
          >
            Resume →
          </Button>
        </div>
      </div>
    </div>
  );
}
