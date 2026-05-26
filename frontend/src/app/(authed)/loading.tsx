/**
 * (authed) loading — full-page, centered pulse-dot. Used while
 * (authed)/layout.tsx itself suspends; in practice the auth context
 * resolves synchronously on the client so this rarely renders, but it
 * exists so any future suspending async work in (authed)/layout.tsx
 * has a graceful fallback.
 */

export default function AuthedLoading() {
  return (
    <div className="min-h-screen grid place-items-center bg-bg">
      <div className="flex items-center gap-2 text-ink-3 font-mono text-[11px] tracking-[0.06em] uppercase">
        <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
        Loading
      </div>
    </div>
  );
}
