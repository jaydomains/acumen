/**
 * deriveDayStreak — consecutive-UTC-day submission streak for the dashboard hero.
 *
 * FE-3 §B.1 / §5: the hero's "DAY STREAK" stat is client-derived from the
 * testee's `GET /v1/attempts` history (there is no backend streak field).
 * Definition: the count of consecutive UTC days, walking backward from an
 * anchor day, on each of which the testee submitted >=1 attempt. The anchor is
 * today (UTC) if today is in the set; else yesterday (UTC) if yesterday is in
 * the set (a one-day grace so a streak is not shown as broken before the testee
 * has acted today); else the streak is 0.
 *
 * The UTC-day floor is inlined (`Math.floor(ms / 86_400_000)`) rather than
 * imported, so this helper carries no cross-module dependency. Pure +
 * deterministic: the `now` clock is injectable for tests.
 */

const MS_PER_DAY = 86_400_000;

const floorUtcDay = (ms: number): number => Math.floor(ms / MS_PER_DAY);

export function deriveDayStreak(
  submittedAtIsoList: ReadonlyArray<string | null | undefined>,
  now: Date = new Date(),
): number {
  const days = new Set<number>();
  for (const iso of submittedAtIsoList) {
    if (!iso) continue;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) continue;
    days.add(floorUtcDay(t));
  }
  if (days.size === 0) return 0;

  const today = floorUtcDay(now.getTime());
  const anchor = days.has(today) ? today : days.has(today - 1) ? today - 1 : null;
  if (anchor === null) return 0;

  let count = 0;
  let day = anchor;
  while (days.has(day)) {
    count++;
    day--;
  }
  return count;
}
