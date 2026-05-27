"use client";

/**
 * FlagRealismButton (FE-4 §B.4, AC-D22).
 *
 * Per-question chip — "Flag as unrealistic" → flagged on success.
 * Idempotent server-side on (question, testee): a second POST returns
 * `created: false` and the chip keeps the flagged state.
 *
 * Hidden in benchmark mode (parent does not render). 5xx surfaces a
 * sonner toast and reverts the local state (parent owns the toast
 * dispatch; the button just calls `onFlag` and updates on success).
 */

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/primitives/Icon";

export type FlagRealismButtonProps = {
  flagged: boolean;
  pending: boolean;
  onFlag: () => void;
};

export function FlagRealismButton({ flagged, pending, onFlag }: FlagRealismButtonProps) {
  const handleClick = useCallback(() => {
    if (pending) return;
    onFlag();
  }, [pending, onFlag]);

  const label = flagged ? "Flagged" : "Flag as unrealistic";
  return (
    <button
      type="button"
      data-testid="flag-realism-button"
      data-flagged={flagged || undefined}
      data-pending={pending || undefined}
      aria-pressed={flagged}
      disabled={pending}
      onClick={handleClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 border px-2.5 text-[11px] uppercase tracking-[0.05em] transition-colors",
        flagged
          ? "border-warn bg-warn-soft text-warn"
          : "border-line bg-bg-raised text-ink-3 hover:bg-bg-deep hover:text-ink-2",
        pending && "opacity-60",
      )}
    >
      <Icon name="flag" size={12} />
      {label}
    </button>
  );
}
