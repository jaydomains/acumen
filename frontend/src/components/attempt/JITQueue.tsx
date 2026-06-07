"use client";

/**
 * JITQueue (FE-5 §B.3).
 *
 * Right-rail sidebar for the per-Testee streaming runner. Shows one
 * card per known question position plus a "streaming…" indicator
 * while the SSE adapter is delivering more.
 *
 * Per the slice-2 plan, the queue's total length grows dynamically
 * from ``attempt.questions.length``: at mount the FE only knows about
 * Q1, and each SSE event triggers a refetch that lengthens the
 * questions array. The spec's "Q1 current, Q2..N generating" UX is
 * approximated by one "streaming…" pulse row at the foot of the
 * queue while ``status === "streaming"`` — this avoids a brittle
 * hardcoded total count (drift §H gap; no ``question_count`` on
 * ``TestResponse`` / ``AttemptView`` in v1).
 *
 * Mobile is desktop-only per ``attempt.jsx:211``; the parent
 * ``StreamingRunner`` hides this aside on small viewports via
 * Tailwind's responsive utilities.
 */

import { cn } from "@/lib/utils";
import type { StreamStatus } from "@/lib/attempts/use-streaming-queue";

export type QueueItemState = "done" | "current" | "ready" | "generating";

export type JITQueueProps = {
  /** Ordered list of question ids known so far (``presentedQuestions``
   * in the runner). Grows as SSE events trigger refetches. */
  questionIds: string[];
  /** Index of the question on screen — same as ``useAttempt``'s
   * ``state.currentIndex``. */
  currentIndex: number;
  /** Highest ``attempt_position`` the SSE stream has announced. Used
   * to derive the buffer-ahead count. May briefly exceed
   * ``questionIds.length`` between an SSE event and its refetch
   * landing. */
  arrivedIdx: number;
  /** Set of question ids the testee has answered. */
  answeredQuestionIds: Set<string>;
  /** Stream lifecycle — drives the pulse indicator + footer copy. */
  status: StreamStatus;
  /** Jump-to-question handler. Called only for cards in
   * ``"ready"`` / ``"done"`` state; ``"current"`` and
   * ``"generating"`` rows are non-clickable. */
  onPick?: ((index: number) => void) | undefined;
};

function classifyItem(idx: number, currentIndex: number): QueueItemState {
  if (idx < currentIndex) return "done";
  if (idx === currentIndex) return "current";
  return "ready";
}

export function JITQueue({
  questionIds,
  currentIndex,
  arrivedIdx,
  answeredQuestionIds,
  status,
  onPick,
}: JITQueueProps) {
  const total = questionIds.length;
  const aheadCount = Math.max(0, total - currentIndex - 1);
  const streaming = status === "streaming" || status === "connecting";
  const showPulseRow = streaming || arrivedIdx > total;

  return (
    <aside
      data-testid="jit-queue"
      aria-label="JIT question queue"
      className="hidden w-[260px] flex-col gap-3 border border-line bg-bg-raised p-4 md:flex"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
          Queue
        </span>
        {streaming && (
          <span
            data-testid="jit-queue-pulse"
            className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3"
          >
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            streaming
          </span>
        )}
        {status === "done" && (
          <span
            data-testid="jit-queue-done"
            className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3"
          >
            done · {total} arrived
          </span>
        )}
      </div>
      <div
        data-testid="jit-queue-buffer"
        className="flex items-baseline justify-between gap-2 border border-line bg-bg p-3"
      >
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
          buffer
        </span>
        <span
          className={cn(
            "font-mono text-[12px] tabular-nums",
            aheadCount < 2 && status !== "done" ? "text-warn" : "text-ink",
          )}
          data-testid="jit-queue-ahead-count"
        >
          {aheadCount} ready
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {questionIds.map((qid, idx) => {
          const itemState = classifyItem(idx, currentIndex);
          const answered = answeredQuestionIds.has(qid);
          const clickable =
            (itemState === "ready" || itemState === "done") && onPick != null;
          const label = `Question ${idx + 1}${answered ? ", answered" : ""}${
            itemState === "current" ? ", in progress" : ""
          }`;
          const Tag = clickable ? "button" : "div";
          return (
            <li key={qid}>
              <Tag
                type={clickable ? "button" : undefined}
                aria-label={label}
                data-testid={`jit-queue-item-${idx}`}
                data-state={itemState}
                data-answered={answered || undefined}
                onClick={clickable ? () => onPick(idx) : undefined}
                className={cn(
                  "flex w-full items-center justify-between gap-2 border px-3 py-2 text-left",
                  itemState === "current" &&
                    "border-ink bg-bg-raised shadow-[inset_0_0_0_1px_var(--ink)]",
                  itemState === "ready" && "border-line bg-bg",
                  itemState === "done" && "border-line bg-bg-deep/40 text-ink-3",
                  clickable ? "cursor-pointer hover:border-ink-3" : "cursor-default",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-block h-1.5 w-1.5 rounded-full",
                      itemState === "current" && "bg-accent",
                      itemState === "ready" && "bg-accent",
                      itemState === "done" && (answered ? "bg-ok" : "bg-ink-4"),
                    )}
                  />
                  <span className="font-mono text-[11px] uppercase tracking-[0.06em]">
                    Q{idx + 1}
                  </span>
                </span>
                <span className="font-mono text-[10.5px] tracking-[0.05em] text-ink-3">
                  {itemState === "current"
                    ? "in progress"
                    : itemState === "done"
                      ? answered
                        ? "answered"
                        : "skipped"
                      : "ready"}
                </span>
              </Tag>
            </li>
          );
        })}
        {showPulseRow && (
          <li
            data-testid="jit-queue-generating"
            className="flex items-center justify-between gap-2 border border-dashed border-line bg-bg px-3 py-2 text-ink-3"
          >
            <span className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              <span className="font-mono text-[11px] uppercase tracking-[0.06em]">
                Q{arrivedIdx > total ? arrivedIdx : total + 1}
              </span>
            </span>
            <span className="font-mono text-[10.5px] tracking-[0.05em]">Generating…</span>
          </li>
        )}
      </ul>
      <div className="border-t border-line pt-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-3">
        {total} of {streaming ? `${total}+` : total} arrived · streams in parallel
      </div>
    </aside>
  );
}
