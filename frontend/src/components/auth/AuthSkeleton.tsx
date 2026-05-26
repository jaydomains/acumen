/**
 * Loading placeholder used by the auth route-group guards (FE-1 §C.4
 * posture 1) while identity resolution is in flight.
 */
export const AuthSkeleton = () => (
  <div
    className="flex min-h-screen items-center justify-center"
    aria-busy="true"
    aria-live="polite"
  >
    <div className="h-8 w-8 animate-pulse rounded-full bg-gray-200" />
    <span className="sr-only">Loading…</span>
  </div>
);
