/**
 * SelectedPillDetailCard — the right-column card on /profile
 * (FE-7 §B.1 §2; prototype source at
 * `frontend/design-reference/prototype/constellation.jsx:200-245`).
 *
 * First-class consumer of the FE-2 BandTag `estimate` + `confidence`
 * prop pair (FE-2 §B.6 / FE-7 §C.5). Renders:
 * - subject eyebrow (uppercase, subject-coloured) + pill name
 * - safety pill (when `safety_relevant`)
 * - 2-Stat grid: `competence_estimate.toFixed(1)` + `n` with the
 *   confidence enum as the hint
 * - BandPips + BandTag row (the BandTag carries the float + enum)
 * - Sparkline of the last 6 attempts on the selected pill
 * - related-pills chip row (clicks bubble to onSelectRelated)
 * - CTA row routing into the FE-3 pill detail page with the rounded
 *   `?d=` difficulty hint.
 */

import { useRouter } from "next/navigation";
import { BandPips } from "@/components/primitives/BandPips";
import { BandTag } from "@/components/primitives/BandTag";
import { Pill } from "@/components/primitives/Pill";
import { Stat } from "@/components/primitives/Stat";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MeCompetencePill } from "@/lib/queries/me";
import { Sparkline } from "./sparkline";

export type SelectedPillDetailCardProps = {
  pill: MeCompetencePill;
  /** Subject metadata for the eyebrow chrome — name + colour. */
  subject: { name: string; color: string } | null;
  /** Sparkline values derived from the cached attempts list. */
  sparklineValues: ReadonlyArray<number>;
  /** Pills lookup so we can show the related-pill names on the chip row. */
  pillsById: Record<string, MeCompetencePill>;
  /** Click on a related-pill chip bubbles back so the parent can drive
   *  the selection round-trip + URL update. */
  onSelectRelated: (pillId: string) => void;
};

function ctaDifficulty(estimate: number): number {
  return Math.round(estimate);
}

function stepUpDifficulty(estimate: number): number {
  return Math.min(10, Math.round(estimate) + 1);
}

export function SelectedPillDetailCard({
  pill,
  subject,
  sparklineValues,
  pillsById,
  onSelectRelated,
}: SelectedPillDetailCardProps) {
  const router = useRouter();
  const practiceD = ctaDifficulty(pill.competence_estimate);
  const stepUpD = stepUpDifficulty(pill.competence_estimate);

  return (
    <Card data-testid="selected-pill-detail-card" className="p-6">
      <div
        data-testid="detail-subject-eyebrow"
        className="font-mono text-[11px] uppercase tracking-[0.06em]"
        style={subject ? { color: subject.color } : undefined}
      >
        {subject?.name ?? "Subject"}
      </div>
      <h3
        data-testid="detail-pill-name"
        className="mt-2 font-serif text-[24px] tracking-[-0.015em] text-ink"
      >
        {pill.pill_name}
      </h3>
      {pill.safety_relevant ? (
        <div className="mt-3" data-testid="detail-safety-pill">
          <Pill tone="danger" mono>
            Safety · external links only
          </Pill>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat
          value={pill.competence_estimate.toFixed(1)}
          label="COMPETENCE · 1–10"
          tone="accent"
        />
        <Stat value={pill.n} label={`ATTEMPTS · ${pill.confidence}`} />
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <BandPips band={pill.band} />
        <BandTag
          band={pill.band}
          withPips={false}
          estimate={pill.competence_estimate}
          confidence={pill.confidence}
        />
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <div className="eyebrow mb-2">Trend · last 6 attempts</div>
        <Sparkline values={sparklineValues} band={pill.band} />
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <div className="eyebrow mb-2">Related</div>
        {pill.related_pill_ids.length === 0 ? (
          <div className="text-[12px] text-ink-3" data-testid="detail-related-empty">
            No related pills yet.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2" data-testid="detail-related-chips">
            {pill.related_pill_ids.map((rid) => {
              const related = pillsById[rid];
              if (!related) return null;
              return (
                <button
                  key={rid}
                  type="button"
                  data-testid="detail-related-chip"
                  data-pill-id={rid}
                  onClick={() => onSelectRelated(rid)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none",
                    "font-medium text-[11.5px]",
                    "bg-bg-deep border border-line text-ink-2",
                    "hover:bg-bg-sunk hover:text-ink",
                  )}
                >
                  {related.pill_name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          data-testid="detail-cta-practice"
          onClick={() =>
            router.push(`/pills/${encodeURIComponent(pill.pill_id)}?d=${practiceD}`)
          }
        >
          Practice at D{practiceD} →
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="detail-cta-step-up"
          onClick={() =>
            router.push(`/pills/${encodeURIComponent(pill.pill_id)}?d=${stepUpD}`)
          }
        >
          Step up to D{stepUpD}
        </Button>
      </div>
    </Card>
  );
}
