"use client";

/**
 * SweepButton — state-machine button primitive. **Canonical FE-9
 * definition** (`fe-specs/FE-9-admin-ops.md` §C.4), consumed by the
 * engagement sweep (B.4) and reused by the sibling systems spec's
 * calibration run / drive ingest / safety-links check / realism
 * aggregate cards.
 *
 * Three transient internal states, owned here — the caller only passes
 * the mutation function:
 *   - `idle`    — enabled, shows `label`.
 *   - `running` — disabled, pulse-dot + `runningLabel`. Entered on click.
 *   - `done`    — check icon + "Done" for 1500ms, then resets to idle.
 *   - error     — reverts straight to idle (no on-button error indicator;
 *                 the caller surfaces failure via a Pattern B toast).
 *
 * `variant` maps onto the shared `Button` vocabulary: primary → the
 * ink "default" button, secondary → "outline".
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/primitives/Icon";
import { Button } from "@/components/ui/button";

const DONE_RESET_MS = 1500;

export type SweepButtonProps = {
  /** Idle CTA label, e.g. "Run sweep now" / "Run calibration". */
  label: string;
  /** Running label, e.g. "Sweeping…". Defaults to `${label}…`. */
  runningLabel?: string;
  variant?: "primary" | "secondary";
  /** Mutation function; throws on failure. */
  onRun: () => Promise<void>;
  disabled?: boolean;
  /** Optional test hook (no effect on behaviour). */
  testId?: string;
};

type RunState = "idle" | "running" | "done";

export function SweepButton({
  label,
  runningLabel,
  variant = "primary",
  onRun,
  disabled,
  testId = "sweep-button",
}: SweepButtonProps) {
  const [state, setState] = useState<RunState>("idle");
  const mountedRef = useRef(true);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const handleClick = useCallback(async () => {
    if (state === "running") return;
    // Re-triggering from the `done` state: cancel the previous run's
    // pending done→idle reset so it can't fire mid-run and bounce the
    // button back to idle while this new run is still in flight.
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    setState("running");
    try {
      await onRun();
      if (!mountedRef.current) return;
      setState("done");
      resetTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setState("idle");
      }, DONE_RESET_MS);
    } catch {
      // Caller surfaces the error via toast; the button just reverts.
      if (mountedRef.current) setState("idle");
    }
  }, [onRun, state]);

  const buttonVariant = variant === "primary" ? "default" : "outline";

  if (state === "running") {
    return (
      <Button
        type="button"
        variant={buttonVariant}
        disabled
        data-testid={testId}
        data-state="running"
      >
        <span
          className="pulse-dot inline-block h-2 w-2 rounded-full bg-current"
          aria-hidden
        />
        {runningLabel ?? `${label}…`}
      </Button>
    );
  }

  if (state === "done") {
    return (
      <Button
        type="button"
        variant={buttonVariant}
        onClick={handleClick}
        disabled={disabled}
        data-testid={testId}
        data-state="done"
      >
        <Icon name="check" size={13} />
        Done
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={buttonVariant}
      onClick={handleClick}
      disabled={disabled}
      data-testid={testId}
      data-state="idle"
    >
      {label}
    </Button>
  );
}
