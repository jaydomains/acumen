/**
 * RecentAttemptsCard — feature-flagged off in v1
 * (FE_ROADMAP FE-3 done-when, FE-3 §E item 3).
 *
 * Gated on `flags.recentAttemptsWidget`; when false, the component
 * returns `null` and (crucially) does NOT construct any query —
 * spec Gherkin "no GET /v1/me/attempts request fires" is satisfied
 * by the absence of the hook call.
 *
 * Flip the flag when the endpoint lands; the inner shell below
 * shows the layout placeholder so it's ready to wire.
 */

import { Card } from "@/components/ui/card";
import { flags } from "@/lib/flags";

export function RecentAttemptsCard() {
  if (!flags.recentAttemptsWidget) return null;

  return (
    <Card data-testid="recent-attempts-card" className="flex flex-col gap-4 p-6">
      <div className="eyebrow">Recent activity</div>
      <h2 className="font-serif text-[22px] tracking-[-0.015em]">Your last attempts</h2>
      <div className="border border-dashed border-line bg-bg-deep p-6 text-center text-[13px] text-ink-3">
        Pending <code className="font-mono">GET /v1/me/attempts</code>.
      </div>
    </Card>
  );
}
