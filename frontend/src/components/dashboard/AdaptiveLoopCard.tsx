/**
 * AdaptiveLoopCard — dashboard accent card (FE-3 §B.1, §E item 4).
 * Mirrors prototype `testee.jsx:177–192`.
 *
 * Two CTAs:
 *  - "Read the explainer" → static placeholder (no Learning Center
 *    in v1; future v1.x destination).
 *  - "Defer" → sonner toast no-op.
 *
 * Tagged TODO(v1.x) so the wire-up surface is visible to grep.
 */

import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/primitives/Icon";

export function AdaptiveLoopCard() {
  return (
    <Card
      data-testid="adaptive-loop-card"
      className="flex flex-col gap-4 border-transparent bg-accent-soft p-6 text-ink"
    >
      <div className="flex items-center gap-2 text-accent">
        <Icon name="spark" size={18} />
        <span className="font-mono text-[11px] uppercase tracking-[0.08em]">
          Adaptive loop · AC-D6
        </span>
      </div>
      <h3 className="font-serif text-[20px] leading-tight tracking-[-0.015em]">
        Two weak areas surfaced from your last attempt.
      </h3>
      <p className="text-[14px] leading-[1.6] text-ink-2">
        Acumen generated an explainer for each and queued a targeted re-test five days
        out. Read the explainer first; defer if today isn&rsquo;t the moment.
      </p>
      <div className="mt-1 flex flex-wrap gap-2">
        <Button
          variant="default"
          size="sm"
          data-testid="adaptive-loop-explainer"
          onClick={() => {
            // TODO(v1.x): wire to real explainer surface (Learning Center).
            toast("Explainer surface lands in v1.x.", {
              description: "For now, head to the catalogue and open the pill directly.",
            });
          }}
        >
          Read the explainer
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="adaptive-loop-defer"
          onClick={() => {
            // TODO(v1.x): wire to real defer endpoint.
            toast("Deferred for today.", {
              description: "We'll surface it again tomorrow.",
            });
          }}
        >
          Defer
        </Button>
      </div>
    </Card>
  );
}
