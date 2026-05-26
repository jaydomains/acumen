/**
 * PillCard — catalogue card (FE-3 §B.2 §2). Mirrors
 * `testee.jsx:277–302` minus the per-Testee overlay until
 * `GET /v1/me/competence` lands (FE-3 §E item 7).
 *
 * The subject colour reaches the card via `style={{ color: ... }}`
 * — the literal hex lives in `lib/catalogue/subjects.ts` (data),
 * so AC-CD23's no-hex-in-component rule still holds.
 *
 * CTA text branches on `safety_relevant`: safety pills route to the
 * same /pills/[id] page but render curated external links (AC-D21),
 * surfaced in the card as "Open links".
 */

import Link from "next/link";
import type { PillResponse } from "@/lib/queries/catalogue";
import { subjectById } from "@/lib/catalogue/subjects";
import { Pill } from "@/components/primitives/Pill";
import { Card } from "@/components/ui/card";

export type PillCardProps = {
  pill: PillResponse;
};

export function PillCard({ pill }: PillCardProps) {
  const subject = subjectById(pill.subject_id);
  const ctaLabel = pill.safety_relevant ? "Open links" : "Practice";

  return (
    <Card
      data-testid={`pill-card-${pill.id}`}
      className="flex flex-col gap-3.5 p-5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="font-mono text-[11px] tracking-[0.04em] uppercase"
          style={{ color: subject.colour }}
        >
          {subject.name}
        </span>
        {pill.safety_relevant ? (
          <Pill tone="danger" mono>
            Safety
          </Pill>
        ) : null}
      </div>
      <h3 className="font-serif text-[18px] leading-tight tracking-[-0.01em] text-ink">
        {pill.name}
      </h3>
      {pill.description ? (
        <p className="text-[13px] text-ink-3 line-clamp-3">{pill.description}</p>
      ) : null}
      <div className="mt-auto flex items-center justify-between pt-1">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-4">
          D{pill.available_difficulty_min}–D{pill.available_difficulty_max}
        </span>
        <Link
          href={`/pills/${pill.id}`}
          className="text-[13px] font-medium text-ink underline-offset-4 hover:underline"
          data-testid={`pill-card-cta-${pill.id}`}
        >
          {ctaLabel} →
        </Link>
      </div>
    </Card>
  );
}
