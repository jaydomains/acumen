/**
 * Today's Reading source-of-truth (FE-3 §C.1, AC-D8 framing).
 *
 * Ported verbatim from `frontend/design-reference/prototype/testee.jsx`
 * lines 21–46. Prototype selection was minute-stable
 * (`Date.now() / 60000 % length`) which is too jittery for a daily
 * brief; v1 selection is UTC-day-stable per spec §H(c) item 1 and
 * §F.1 acceptance.
 *
 * The widget is frontend-only — no API call. Selection is a pure
 * function of the date so SSR + client render agree and the daily
 * brief is the same wherever the testee opens it.
 *
 * NOTE: the dashboard never branches on content from this array; it
 * just renders the body + fortune. Editing copy here is safe; the
 * picker just modulos the index, so adding entries widens the
 * rotation without code changes.
 */

import type { ReactNode } from "react";

export type Reading = {
  body: ReactNode;
  fortune: string;
};

export const READINGS: readonly Reading[] = [
  {
    body: (
      <>
        <mark>Antifouling</mark> is dim today — you&rsquo;ve slipped half a band since
        last week. Three pills look pale around{" "}
        <mark className="dim">Marine Coatings</mark>; the loop has prepared learning
        material and a re-test in five days. Your strongest constellation,{" "}
        <mark className="dim">NACE Prep</mark>, holds.
      </>
    ),
    fortune: "Re-test within the week.",
  },
  {
    body: (
      <>
        Your <mark className="dim">Tuesday-afternoon</mark> attempts grade five points
        higher than your Friday ones, on average. The stars favour short sessions today —
        finish <mark>Antifouling</mark> before 16:00 and your loop closes ahead of
        schedule.
      </>
    ),
    fortune: "Schedule one short session.",
  },
  {
    body: (
      <>
        <mark>Inspection Instruments</mark> is the brightest star in your sky — expert
        band, 71 attempts, fully calibrated. Consider mentoring: two testees in your team
        have asked <mark className="dim">three questions</mark> tagged to this pill in the
        last week.
      </>
    ),
    fortune: "Share what you know.",
  },
];

const MS_PER_DAY = 86_400_000;

/** Days since the UTC epoch for the given date (or now). */
export function daysSinceUtcEpoch(now: Date = new Date()): number {
  return Math.floor(now.getTime() / MS_PER_DAY);
}

/**
 * UTC-day-stable Reading pick. Same day → same reading (regardless of
 * timezone, regardless of when in the day the testee opens the page).
 * Calling on a different UTC day rotates to the next entry.
 */
export function pickReading(now: Date = new Date()): Reading {
  const day = daysSinceUtcEpoch(now);
  return READINGS[((day % READINGS.length) + READINGS.length) % READINGS.length]!;
}
