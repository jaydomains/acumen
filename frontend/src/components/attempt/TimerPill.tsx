"use client";

/**
 * TimerPill (FE-4 §B.1 §2).
 *
 * Reads the parent test's `duration_minutes` + `timed` + the
 * `started_at` timestamp from the AttemptView. Derives a remaining-
 * seconds value against `useNow`'s tick. The hook caller passes
 * `paused: true` to halt the underlying interval; the pill shows
 * "Paused" while the pause window is active.
 *
 * Untimed tests render "Untimed" (benchmark default per AC-D13).
 *
 * Negative remaining (overrun) shows "0:00" and a warn tone so the
 * runner doesn't paradoxically display "-12s"; the submit guard at
 * the page level decides whether to auto-submit.
 */

import { cn } from "@/lib/utils";

export type TimerPillProps = {
  startedAtIso: string | null;
  durationMinutes: number | null;
  timed: boolean;
  paused: boolean;
  nowMs: number;
};

function formatMmSs(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export function TimerPill({
  startedAtIso,
  durationMinutes,
  timed,
  paused,
  nowMs,
}: TimerPillProps) {
  if (!timed || durationMinutes == null || startedAtIso == null) {
    return (
      <span
        data-testid="timer-pill"
        data-mode="untimed"
        className="inline-flex h-7 items-center bg-bg-deep px-2.5 font-mono text-[11px] tracking-[0.05em] uppercase text-ink-3"
      >
        Untimed
      </span>
    );
  }

  if (paused) {
    return (
      <span
        data-testid="timer-pill"
        data-mode="paused"
        className="inline-flex h-7 items-center bg-warn-soft px-2.5 font-mono text-[11px] tracking-[0.05em] uppercase text-warn"
      >
        Paused
      </span>
    );
  }

  const startedAtMs = Date.parse(startedAtIso);
  const elapsedSeconds = Math.floor((nowMs - startedAtMs) / 1000);
  const remaining = durationMinutes * 60 - elapsedSeconds;
  const overrun = remaining < 0;
  const display = formatMmSs(remaining);

  return (
    <span
      data-testid="timer-pill"
      data-mode={overrun ? "overrun" : "running"}
      className={cn(
        "inline-flex h-7 items-center bg-bg-deep px-2.5 font-mono text-[11px] tracking-[0.05em] uppercase",
        overrun ? "text-danger" : "text-ink",
      )}
    >
      {display}
    </span>
  );
}
