"use client";

/**
 * AttemptShell (FE-4 §B.1 §2 / §F.6).
 *
 * Focus-mode container that wraps the runner page. The Rail + TopBar
 * have already been stripped at the parent layout
 * (`(authed)/(testee)/layout.tsx`'s pathname-aware shell) so this
 * component owns the runner's outer chrome only: full-bleed bg,
 * watermark layer, and a content-wide max-width with vertical
 * rhythm.
 *
 * `z-0` watermark sits behind `z-10` content. The header-band and
 * pause/grading overlays choose their own z-indices above 10.
 */

import type { ReactNode } from "react";
import { Watermark } from "./Watermark";

export type AttemptShellProps = {
  userName: string;
  attemptId: string;
  children: ReactNode;
};

export function AttemptShell({ userName, attemptId, children }: AttemptShellProps) {
  return (
    <div
      data-testid="attempt-shell"
      className="relative min-h-screen w-full bg-bg text-ink"
    >
      <Watermark userName={userName} attemptId={attemptId} />
      <div className="relative z-10 mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-8 py-8">
        {children}
      </div>
    </div>
  );
}
