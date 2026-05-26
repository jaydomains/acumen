/**
 * PillMetaCard — pill detail left column (FE-3 §B.3 §2).
 *
 * Mirrors `pill-detail.jsx:73–122`. Renders subject + difficulty
 * range + description; per-Testee rows (current band, competence
 * value, last activity) are absent in v1 because
 * `GET /v1/me/competence` is unmounted (FE-3 §E item 1 / item 7).
 * They'll slot in here when the endpoint lands.
 */

import type { PillResponse } from "@/lib/queries/pills";
import { Card } from "@/components/ui/card";
import { subjectById } from "@/lib/catalogue/subjects";

export type PillMetaCardProps = {
  pill: PillResponse;
};

export function PillMetaCard({ pill }: PillMetaCardProps) {
  const subject = subjectById(pill.subject_id);
  return (
    <Card className="flex flex-col gap-5 p-6" data-testid="pill-meta-card">
      <div className="eyebrow">About this pill</div>

      <div className="flex flex-col gap-2.5">
        <MetaRow label="Subject">
          <span
            className="inline-flex items-center gap-2"
            data-testid="pill-meta-subject"
          >
            <span
              className="inline-block h-2.5 w-2.5"
              style={{ backgroundColor: subject.colour }}
              aria-hidden
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-2">
              {subject.name}
            </span>
          </span>
        </MetaRow>
        <MetaRow label="Difficulty range">
          <span className="font-mono text-[12px] text-ink-2">
            D{pill.available_difficulty_min} – D{pill.available_difficulty_max}
          </span>
        </MetaRow>
        {typeof pill.estimated_minutes === "number" ? (
          <MetaRow label="Estimated time">
            <span className="font-mono text-[12px] text-ink-2">
              {pill.estimated_minutes} min
            </span>
          </MetaRow>
        ) : null}
      </div>

      {pill.description ? (
        <>
          <div className="border-t border-line" />
          <p className="text-[14px] leading-[1.6] text-ink-2">{pill.description}</p>
        </>
      ) : null}
    </Card>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-4">
        {label}
      </span>
      {children}
    </div>
  );
}
