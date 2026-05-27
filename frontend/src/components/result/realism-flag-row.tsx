/**
 * RealismFlagRow — one row in RealismAggregateCard (FE-6 §B.8).
 *
 * Renders the Q# anchor + prompt excerpt + testee note (or "(no note)"
 * fallback) + relative-age. Clicking the row scrolls + flashes the
 * matching ByQuestionCard row via the shared scroll-to-question
 * helper.
 */

"use client";

import { scrollToQuestion } from "@/lib/result/scroll-to-question";
import { formatRelative } from "@/lib/result/format-relative";

export type RealismFlagRowProps = {
  attemptPosition: number;
  promptText: string | null | undefined;
  flagNote: string | null | undefined;
  flaggedAt: string | null | undefined;
};

export function RealismFlagRow({
  attemptPosition,
  promptText,
  flagNote,
  flaggedAt,
}: RealismFlagRowProps) {
  return (
    <li className="border-t border-line first:border-t-0">
      <button
        type="button"
        data-testid="realism-flag-row"
        data-question-position={attemptPosition}
        onClick={() => scrollToQuestion(attemptPosition)}
        className="flex w-full flex-col gap-1 py-3 text-left hover:bg-bg-sunk"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-ink-3 tabular-nums">
            Q{attemptPosition}
          </span>
          <span className="flex-1 truncate text-[13px] text-ink">
            {promptText ?? "(no prompt)"}
          </span>
          <span className="font-mono text-[10.5px] text-ink-3">
            flagged {formatRelative(flaggedAt)}
          </span>
        </div>
        <div className="text-[12px] leading-relaxed text-ink-2">
          {flagNote && flagNote.trim().length > 0 ? (
            <>
              <span className="font-mono text-[11px] text-ink-3">Your note · </span>
              <span>{flagNote}</span>
            </>
          ) : (
            <span className="text-ink-3">(no note)</span>
          )}
        </div>
      </button>
    </li>
  );
}
