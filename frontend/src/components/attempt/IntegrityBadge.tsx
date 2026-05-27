"use client";

/**
 * IntegrityBadge (FE-4 §B.1 §2, AC-D4).
 *
 * Chip + hover-revealed popover listing the integrity layers active
 * during the attempt. The chip displays a count of tab-switches the
 * page-blur listener has recorded (from `useIntegrity`); the popover
 * enumerates: watermark, focus tracking, copy/paste blocked, content
 * blanked on pause, n-gram overlap at grading.
 *
 * Implementation: native `<details>` for keyboard-accessible toggle
 * without dragging in another Radix dep. Closes on click-outside the
 * `<summary>` per browser default behaviour.
 */

import { useId } from "react";
import { Icon } from "@/components/primitives/Icon";

export type IntegrityBadgeProps = {
  tabSwitches: number;
};

const ITEMS = [
  "Watermarking — your name + attempt id is overlaid on the page",
  "Focus tracking — tab switches are counted while you take the test",
  "Copy / paste blocked — text selection + Ctrl/Cmd+C/V are suppressed",
  "Pause blanks content — leaving the question pane hides text per AC-D11",
  "N-gram overlap checked at grading — substantial verbatim matches flag",
];

export function IntegrityBadge({ tabSwitches }: IntegrityBadgeProps) {
  const popoverId = useId();
  return (
    <details data-testid="integrity-badge" className="relative inline-block">
      <summary
        aria-controls={popoverId}
        className="inline-flex h-7 cursor-pointer list-none items-center gap-1.5 border border-line bg-bg-raised px-2.5 font-mono text-[11px] tracking-[0.05em] uppercase text-ink-2 hover:bg-bg-deep [&::-webkit-details-marker]:hidden"
      >
        <Icon name="shield" size={12} />
        <span>Integrity</span>
        <span data-testid="integrity-tab-switches" className="text-ink-3">
          · {tabSwitches} tab-switch{tabSwitches === 1 ? "" : "es"}
        </span>
      </summary>
      <div
        id={popoverId}
        role="region"
        className="absolute right-0 top-[calc(100%+6px)] z-30 w-[320px] border border-line bg-bg-raised p-3 text-[12.5px] text-ink-2 shadow-lg"
      >
        <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
          Integrity surface (AC-D4)
        </div>
        <ul className="flex flex-col gap-1.5">
          {ITEMS.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="mt-1 inline-block h-1 w-1 shrink-0 bg-ink-3" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
