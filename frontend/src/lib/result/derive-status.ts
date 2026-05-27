/**
 * derive-status — collapse the result-query payload into the UI-facing
 * state machine for the hero ReviewBanner (FE-6 §B.2):
 *
 *   loading       → query in-flight, no data yet
 *   pending       → status==="review_pending", elapsed ≤ 60 s
 *   pending_overdue → status==="review_pending", elapsed > 60 s
 *                     (AC-D19 v1.7 reconcile-cron path; banner shifts
 *                      to amber + "admin will review within ~5 min")
 *   ready         → status==="ready"
 *
 * `nowMs` is injectable so tests can pin time without `vi.useFakeTimers`
 * leaking into the assertion.
 */

const OVERDUE_THRESHOLD_MS = 60_000; // AC-D19 v1.7 60-s cross-family ceiling

export type ResultDisplayState = "loading" | "pending" | "pending_overdue" | "ready";

export type DeriveStatusInput = {
  status: string | undefined;
  submittedAt: string | undefined;
  loading: boolean;
};

export function deriveResultStatus(
  input: DeriveStatusInput,
  nowMs: number = Date.now(),
): ResultDisplayState {
  if (input.loading || !input.status) return "loading";
  if (input.status === "ready") return "ready";
  if (input.status === "review_pending") {
    if (!input.submittedAt) return "pending";
    const submitted = new Date(input.submittedAt).getTime();
    if (Number.isNaN(submitted)) return "pending";
    const elapsed = nowMs - submitted;
    return elapsed > OVERDUE_THRESHOLD_MS ? "pending_overdue" : "pending";
  }
  // Unknown status enum (forward-compat) — render the loading skeleton
  // rather than fail loudly. The next poll should reconcile.
  return "loading";
}
