/**
 * adaptive-loop-format — relative-date helper for the AdaptiveLoopCard
 * `step_retest_queued` rows (FE-6 §B.5).
 *
 *   queued_for in the past   → "Today"
 *   queued_for null/missing  → "soon" (placeholder per §E.2)
 *   queued_for in the future → "in N days" (rounded up so partial days
 *                              never collapse to 0)
 *
 * `now` is injectable so tests pin time.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatQueuedFor(
  queuedForIso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!queuedForIso) return "soon";
  const queued = new Date(queuedForIso);
  if (Number.isNaN(queued.getTime())) return "soon";
  const delta = queued.getTime() - now.getTime();
  if (delta <= 0) return "Today";
  const days = Math.ceil(delta / DAY_MS);
  return days === 1 ? "in 1 day" : `in ${days} days`;
}
