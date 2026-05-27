"use client";

/**
 * AutosaveIndicator (FE-4 §B.1 §2 / §C.6).
 *
 * Four states wired to `useAttempt`'s per-question autosave-state:
 *   - `idle`    — invisible spacer (fixed width keeps layout stable)
 *   - `saving`  — pulse dot + "Saving…"
 *   - `saved`   — check + "Saved Ns ago"; relative timestamp ticks via
 *                 the `useNow`-driven `nowMs` prop the parent passes
 *   - `failed`  — x + "Save failed · retry N" (Pattern A inline)
 *
 * After 4th consecutive failure (banner-visible signal) the indicator
 * keeps showing `failed`; the parent surfaces the persistent banner
 * via `AutosaveBanner`. Sonner danger toast for the same trigger is
 * fired once by the page, not here.
 */

import { cn } from "@/lib/utils";
import type { AutosaveState } from "@/lib/attempts/use-attempt";

export type AutosaveIndicatorProps = {
  state: AutosaveState;
  /** Wall-clock ms of last success — used for "Saved Ns ago" copy. */
  lastSavedAt?: number | null;
  nowMs: number;
  retryCount?: number;
};

function relativeSeconds(
  nowMs: number,
  lastSavedAt: number | null | undefined,
): number | null {
  if (lastSavedAt == null) return null;
  return Math.max(0, Math.floor((nowMs - lastSavedAt) / 1000));
}

export function AutosaveIndicator({
  state,
  lastSavedAt,
  nowMs,
  retryCount = 0,
}: AutosaveIndicatorProps) {
  const seconds = relativeSeconds(nowMs, lastSavedAt);

  return (
    <div
      data-testid="autosave-indicator"
      data-state={state}
      className={cn(
        "inline-flex h-7 min-w-[120px] items-center gap-1.5 px-2 font-mono text-[11px] tracking-[0.04em] uppercase",
        state === "saved" && "text-ok",
        state === "failed" && "text-danger",
        state === "saving" && "text-ink-3",
        state === "idle" && "text-transparent",
      )}
    >
      {state === "saving" && (
        <>
          <span aria-hidden className="h-1.5 w-1.5 animate-pulse bg-ink-3" />
          <span>Saving…</span>
        </>
      )}
      {state === "saved" && (
        <>
          <span aria-hidden className="h-1.5 w-1.5 bg-ok" />
          <span>{seconds == null ? "Saved" : `Saved ${seconds}s ago`}</span>
        </>
      )}
      {state === "failed" && (
        <>
          <span aria-hidden className="h-1.5 w-1.5 bg-danger" />
          <span>{`Save failed · retry ${retryCount}`}</span>
        </>
      )}
      {state === "idle" && <span>—</span>}
    </div>
  );
}

export function AutosaveBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      role="alert"
      data-testid="autosave-banner"
      className="border-l-2 border-danger bg-danger-soft px-3 py-2 text-[12.5px] text-danger"
    >
      Saves are failing — your connection may have dropped. Try refreshing the page; your
      answers stay on this device until then.
    </div>
  );
}
