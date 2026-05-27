"use client";

/**
 * Watermark (FE-4 §B.1 §2, AC-D4 layer #2).
 *
 * Fixed full-viewport grid of low-opacity text repeating
 * `{userName} · ACUMEN · {YYYY-MM-DD} · ATTEMPT {first-7-of-attemptId}`.
 * Memoised against `(userName, attemptId, date)` so the 1-Hz clock
 * tick on `<TimerPill>` does not re-render the watermark.
 *
 * `aria-hidden` because the integrity surface should not be read out
 * by screen-readers — they're for the legitimate testee, not part of
 * the question content.
 *
 * Repeating grid: 12 rows × 6 cells per `attempt.jsx:87–94` (72 spans
 * total). Token-driven: `text-ink/[0.06]` resolves to the active
 * theme's ink colour at the same low alpha on both paper and carbon.
 */

import { memo, useMemo } from "react";

export type WatermarkProps = {
  userName: string;
  attemptId: string;
  /** Override for tests (ISO `YYYY-MM-DD`). */
  dateOverride?: string;
};

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const ROWS = 12;
const COLS = 6;

function WatermarkInner({ userName, attemptId, dateOverride }: WatermarkProps) {
  const text = useMemo(() => {
    const idPrefix = attemptId.slice(0, 7);
    const date = dateOverride ?? todayIsoDate();
    return `${userName} · ACUMEN · ${date} · ATTEMPT ${idPrefix}`;
  }, [userName, attemptId, dateOverride]);

  const cells = useMemo(() => {
    const arr: { key: string }[] = [];
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        arr.push({ key: `${r}-${c}` });
      }
    }
    return arr;
  }, []);

  return (
    <div
      aria-hidden
      data-testid="attempt-watermark"
      className="pointer-events-none fixed inset-0 z-0 grid select-none overflow-hidden text-ink/[0.06]"
      style={{
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridTemplateRows: `repeat(${ROWS}, 1fr)`,
      }}
    >
      {cells.map(({ key }) => (
        <span
          key={key}
          className="flex items-center justify-center whitespace-nowrap font-mono text-[10px] tracking-[0.18em] uppercase rotate-[-18deg]"
        >
          {text}
        </span>
      ))}
    </div>
  );
}

export const Watermark = memo(WatermarkInner);
