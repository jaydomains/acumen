/**
 * Auth surface logo (FE-1 §C.1). The Acumen wordmark + the "SITEMESH"
 * meta line shown above every auth-page card per the design.
 *
 * Slice A defers theme tokens to FE-2, so this ships as a plain
 * wordmark; FE-2's visual pass swaps in the paper-card typography and
 * (if scoped in) the AcumenMark SVG.
 */

export function AuthLogo() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div aria-hidden="true" className="text-3xl font-semibold tracking-tight">
        Acumen
      </div>
      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">SITEMESH</p>
    </div>
  );
}
