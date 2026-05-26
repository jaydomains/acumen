/**
 * TodaysReading — day-stable horoscope-style note (FE-3 §C.1).
 *
 * Mirrors prototype `testee.jsx:49–68`. Pure frontend; no API.
 *
 * The reading is computed once per render via `pickReading` (a pure
 * function of the date). The widget does NOT subscribe to the clock
 * — once the page is open, the reading stays put even if midnight
 * UTC passes; that's intentional, the brief is anchored to "what
 * was today when I opened this".
 */

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { pickReading } from "@/data/readings";

export function TodaysReading() {
  const reading = useMemo(() => pickReading(), []);
  const dateLabel = useMemo(() => formatDateLabel(new Date()), []);

  return (
    <Card data-testid="todays-reading" className="my-6 flex flex-col gap-3 p-6">
      <div className="eyebrow">
        Today&rsquo;s reading · {dateLabel} · a short note from acumen
      </div>
      <div className="font-serif text-[16px] leading-[1.65] text-ink">{reading.body}</div>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-4">
        acumen · <span className="text-accent">{reading.fortune}</span>
      </div>
    </Card>
  );
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
