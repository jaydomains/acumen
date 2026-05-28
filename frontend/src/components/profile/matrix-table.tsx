/**
 * MatrixTable — alternative view of the testee's pills as a pill ×
 * difficulty grid (FE-7 §B.1 §2; prototype source at
 * `frontend/design-reference/prototype/constellation.jsx:287-326`).
 *
 * Pure presentational + click-out. AC-D3 anchors the per-difficulty
 * axis (1..10 levels per pill). The current-difficulty cell renders
 * the float; surrounding filled cells are tinted by band token. Cells
 * "fill" up to and including the rounded competence estimate per the
 * prototype's visual rule (`diff <= round(estimate)`).
 *
 * Row sort: subjects in the order they first appear in `subjects[]`
 * (caller chooses; ProfilePage uses `deriveSubjects` which preserves
 * first-seen order). Within a subject, pills sort alphabetically by
 * name so the grid stays stable across renders.
 */

import { cn } from "@/lib/utils";
import type { Band } from "@/components/primitives/bands";
import type { MeCompetencePill } from "@/lib/queries/me";
import type { ConstellationSubject } from "@/lib/profile/layout-constellation";
import { Card } from "@/components/ui/card";

export type MatrixTableProps = {
  pills: ReadonlyArray<MeCompetencePill>;
  subjects: ReadonlyArray<ConstellationSubject>;
  selectedId: string | null;
  onSelect: (pillId: string) => void;
  className?: string;
};

const DIFFICULTY_AXIS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

// Static Tailwind class maps so the JIT picks up every band utility.
const BAND_BG_CLASS: Record<Band, string> = {
  novice: "bg-band-novice",
  junior: "bg-band-junior",
  working: "bg-band-working",
  advanced: "bg-band-advanced",
  expert: "bg-band-expert",
};

export function MatrixTable({
  pills,
  subjects,
  selectedId,
  onSelect,
  className,
}: MatrixTableProps) {
  const orderedSubjects = subjects.slice();
  const pillsBySubject = new Map<string, MeCompetencePill[]>();
  for (const s of orderedSubjects) pillsBySubject.set(s.id, []);
  // Fallback bucket for pills whose subject_id isn't in the supplied
  // subjects list — render them under a synthetic "Other" subject so
  // they don't disappear silently.
  const orphans: MeCompetencePill[] = [];
  for (const p of pills) {
    const bucket = pillsBySubject.get(p.subject_id);
    if (bucket) {
      bucket.push(p);
    } else {
      orphans.push(p);
    }
  }
  // Within-subject sort by pill_name (case-insensitive) — matches the
  // backend's stable ordering so the matrix doesn't reshuffle between
  // refetches.
  for (const list of pillsBySubject.values()) {
    list.sort((a, b) =>
      a.pill_name.toLowerCase().localeCompare(b.pill_name.toLowerCase()),
    );
  }
  orphans.sort((a, b) =>
    a.pill_name.toLowerCase().localeCompare(b.pill_name.toLowerCase()),
  );

  return (
    <Card data-testid="matrix-table" className={cn("overflow-x-auto p-2", className)}>
      <div
        className="grid"
        style={{
          // 11 columns: pill name + 10 difficulty cells. Pill column
          // gets more room; difficulty cells distribute evenly.
          gridTemplateColumns: "minmax(160px, 1.6fr) repeat(10, 1fr)",
          gap: "2px",
          minWidth: "680px",
        }}
      >
        <div
          className="px-2 py-2 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-3"
          data-testid="matrix-header-pill"
        >
          PILL · DIFFICULTY →
        </div>
        {DIFFICULTY_AXIS.map((d) => (
          <div
            key={d}
            data-testid={`matrix-header-d${d}`}
            className="px-2 py-2 text-center font-mono text-[10px] uppercase tracking-[0.06em] text-ink-3"
          >
            D{d}
          </div>
        ))}

        {orderedSubjects.map((s) =>
          (pillsBySubject.get(s.id) ?? []).map((p) => (
            <MatrixRow
              key={p.pill_id}
              pill={p}
              subject={s}
              selected={p.pill_id === selectedId}
              onSelect={onSelect}
            />
          )),
        )}
        {orphans.map((p) => (
          <MatrixRow
            key={p.pill_id}
            pill={p}
            subject={null}
            selected={p.pill_id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </Card>
  );
}

function MatrixRow({
  pill,
  subject,
  selected,
  onSelect,
}: {
  pill: MeCompetencePill;
  subject: ConstellationSubject | null;
  selected: boolean;
  onSelect: (pillId: string) => void;
}) {
  const roundedEstimate = Math.round(pill.competence_estimate);
  return (
    <>
      <div
        data-testid="matrix-row-name"
        data-pill-id={pill.pill_id}
        data-selected={selected || undefined}
        onClick={() => onSelect(pill.pill_id)}
        className={cn(
          "flex items-center gap-2 px-2 py-2.5 text-[12px] font-medium cursor-pointer",
          selected ? "bg-accent-soft" : "bg-transparent",
        )}
        role="button"
        aria-pressed={selected}
        aria-label={pill.pill_name}
      >
        <span
          aria-hidden="true"
          className="inline-block w-1 h-3.5 rounded-sm shrink-0"
          style={subject ? { background: subject.color } : { background: "var(--ink-3)" }}
        />
        <span className="truncate flex-1">{pill.pill_name}</span>
      </div>
      {DIFFICULTY_AXIS.map((d) => {
        const filled = d <= roundedEstimate;
        const here = d === roundedEstimate;
        return (
          <div
            key={d}
            data-testid="matrix-cell"
            data-difficulty={d}
            data-pill-id={pill.pill_id}
            data-filled={filled || undefined}
            data-here={here || undefined}
            onClick={() => onSelect(pill.pill_id)}
            className={cn(
              "flex items-center justify-center py-2.5 font-mono text-[10px] text-bg-raised cursor-pointer",
              filled ? BAND_BG_CLASS[pill.band] : "bg-bg-deep",
              filled && !here ? "opacity-55" : "opacity-100",
            )}
          >
            {here ? pill.competence_estimate.toFixed(1) : null}
          </div>
        );
      })}
    </>
  );
}
