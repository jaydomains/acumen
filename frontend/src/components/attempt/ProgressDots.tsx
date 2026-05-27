"use client";

/**
 * ProgressDots (FE-4 §B.1 §2).
 *
 * Per-question status strip. Three states:
 *   - `current`     — `bg-ink` (active question marker)
 *   - `answered`    — `bg-ok` (response stored in reducer + autosaved)
 *   - `unanswered`  — `bg-bg-deep` (no answer set yet)
 *
 * Width 5 px, gap 6 px per `attempt.jsx:118–151`. Click-to-jump is
 * enabled for frozen-mode (default); benchmark passes `interactive
 * false` to disable jump (sequential walk only — slice 2 uses it).
 */

import { cn } from "@/lib/utils";

export type ProgressDotsProps = {
  /** Ordered question ids. */
  questionIds: string[];
  currentIndex: number;
  answeredQuestionIds: Set<string>;
  onJump?: ((index: number) => void) | undefined;
  interactive?: boolean | undefined;
};

export function ProgressDots({
  questionIds,
  currentIndex,
  answeredQuestionIds,
  onJump,
  interactive = true,
}: ProgressDotsProps) {
  return (
    <div
      role="list"
      aria-label="Question progress"
      data-testid="progress-dots"
      className="flex items-center gap-1.5"
    >
      {questionIds.map((qid, index) => {
        const isCurrent = index === currentIndex;
        const isAnswered = answeredQuestionIds.has(qid);
        const tone = isCurrent ? "bg-ink" : isAnswered ? "bg-ok" : "bg-bg-deep";
        const label = `Question ${index + 1}${isAnswered ? ", answered" : ""}${
          isCurrent ? ", current" : ""
        }`;
        if (!interactive || !onJump) {
          return (
            <span
              key={qid}
              role="listitem"
              aria-label={label}
              data-testid={`progress-dot-${index}`}
              data-current={isCurrent || undefined}
              data-answered={isAnswered || undefined}
              className={cn("inline-block h-2 w-[5px]", tone)}
            />
          );
        }
        return (
          <button
            key={qid}
            type="button"
            role="listitem"
            aria-label={label}
            data-testid={`progress-dot-${index}`}
            data-current={isCurrent || undefined}
            data-answered={isAnswered || undefined}
            onClick={() => onJump(index)}
            className={cn(
              "inline-block h-2 w-[5px] focus:outline-none focus-visible:ring-1 focus-visible:ring-accent",
              tone,
            )}
          />
        );
      })}
    </div>
  );
}
