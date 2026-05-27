"use client";

/**
 * 1-Hz clock subscriber (FE-4 §B.1 §2). Only `<TimerPill>` subscribes;
 * watermark / integrity badge / question pane do not (they're keyed by
 * stable inputs so a clock tick should not re-render them).
 *
 * `paused` halts the interval (no wasted timers; no spurious renders).
 * The tick fires on mount, then every `tickMs` (default 1000 ms).
 */

import { useEffect, useState } from "react";

export type UseNowOptions = {
  paused?: boolean;
  tickMs?: number;
};

export function useNow({ paused = false, tickMs = 1000 }: UseNowOptions = {}): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (paused) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [paused, tickMs]);

  return now;
}
