/**
 * AdaptiveLoopCard — step CTAs (FE-6 §B.5). Hides when the loop
 * payload is empty or the result is still under review.
 */

import { Card } from "@/components/ui/card";
import { LoopStepRow } from "./loop-step-row";
import type { components } from "@/lib/api/types";

type LoopStep = components["schemas"]["LoopStep"];

export type AdaptiveLoopCardProps = {
  steps: LoopStep[] | null | undefined;
  status: string | undefined;
};

export function AdaptiveLoopCard({ steps, status }: AdaptiveLoopCardProps) {
  if (status !== "ready") return null;
  if (!steps || steps.length === 0) return null;
  return (
    <Card data-testid="adaptive-loop-card" className="p-6">
      <header className="mb-3">
        <div className="eyebrow mb-1">YOUR PLAN</div>
        <h2 className="font-serif text-[20px] leading-tight tracking-[-0.01em]">
          Here&apos;s the next step
        </h2>
      </header>
      <ul>
        {steps.map((s, i) => (
          <LoopStepRow
            key={`${s.type}-${i}-${s.target_pill_id ?? "x"}`}
            step={s}
            index={i}
          />
        ))}
      </ul>
    </Card>
  );
}
