/**
 * Attempt-runner child layout (FE-4 §C.2 / §F.6).
 *
 * Renders `{children}` as a transparent pass-through. The actual
 * focus-mode chrome lives at the parent
 * `(authed)/(testee)/layout.tsx` (which checks the pathname and
 * strips Rail + TopBar for `/attempts/...`). This child file is
 * required so future per-attempt loaders can hang off the route
 * segment without changing the path tree.
 *
 * Auth + privacy + role guards inherit via parent layout composition.
 */

import type { ReactNode } from "react";

export default function AttemptRunnerLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
