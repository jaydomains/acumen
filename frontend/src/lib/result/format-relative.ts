/**
 * format-relative — ISO datetime → "5 minutes ago" / "an hour ago"
 * for the RealismAggregateCard row age (FE-6 §B.8) and any other
 * recent-event timestamps on the results page.
 *
 * Pure function; `now` is injectable for deterministic testing.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatRelative(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return "—";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";
  const delta = now.getTime() - then.getTime();
  if (delta < 0) return "just now";
  if (delta < MINUTE) return "just now";
  if (delta < 2 * MINUTE) return "a minute ago";
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)} minutes ago`;
  if (delta < 2 * HOUR) return "an hour ago";
  if (delta < DAY) return `${Math.floor(delta / HOUR)} hours ago`;
  if (delta < 2 * DAY) return "yesterday";
  return `${Math.floor(delta / DAY)} days ago`;
}
