/**
 * ByPillCard — weakness breakdown (FE-6 §B.3). Hides entirely when
 * `pills[]` is empty (no WeaknessReport for this attempt).
 */

import { Card } from "@/components/ui/card";
import { PillWeaknessRow } from "./pill-weakness-row";
import type { components } from "@/lib/api/types";

type ResultPill = components["schemas"]["ResultPill"];

export type ByPillCardProps = {
  pills: ResultPill[] | null | undefined;
};

export function ByPillCard({ pills }: ByPillCardProps) {
  if (!pills || pills.length === 0) return null;
  return (
    <Card data-testid="by-pill-card" className="p-6">
      <header className="mb-3">
        <div className="eyebrow mb-1">WHERE YOU STRUGGLED</div>
        <h2 className="font-serif text-[20px] leading-tight tracking-[-0.01em]">
          By pill
        </h2>
      </header>
      <ul>
        {pills.map((p) => (
          <PillWeaknessRow key={p.pill_id} pill={p} />
        ))}
      </ul>
    </Card>
  );
}
