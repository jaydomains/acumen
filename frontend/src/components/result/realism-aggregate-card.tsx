/**
 * RealismAggregateCard — testee's flagged-Q list (FE-6 §B.8).
 *
 * Reads from the secondary `attempt` query — AttemptView.questions[]
 * carries `realism_flagged_by_me` / `realism_flag_note` /
 * `realism_flagged_at` per question (added in slice 1's view_attempt
 * extension). The list dict shape isn't statically typed via OpenAPI
 * (questions is `list[dict]` on the wire) so we narrow with a
 * type-guard locally.
 *
 * Hides entirely when no Q is flagged or the attempt detail hasn't
 * arrived yet — per FE-6 spec, the empty-state design exists in the
 * mock but is suppressed in production.
 */

import { Card } from "@/components/ui/card";
import { RealismFlagRow } from "./realism-flag-row";

type AttemptViewQuestion = {
  id?: string;
  question_id?: string;
  attempt_position?: number | null;
  prompt?: string;
  config?: { prompt?: string };
  realism_flagged_by_me?: boolean;
  realism_flag_note?: string | null;
  realism_flagged_at?: string | null;
};

export type RealismAggregateCardProps = {
  questions: unknown[] | null | undefined;
};

export function RealismAggregateCard({ questions }: RealismAggregateCardProps) {
  const flagged = (questions ?? [])
    .map((q, idx) => narrow(q, idx + 1))
    .filter((q): q is FlaggedQuestion => q !== null);
  if (flagged.length === 0) return null;

  return (
    <Card data-testid="realism-aggregate-card" className="p-6">
      <header className="mb-3">
        <div className="eyebrow mb-1">
          {flagged.length === 1
            ? "YOU FLAGGED 1 QUESTION"
            : `YOU FLAGGED ${flagged.length} QUESTIONS`}
        </div>
        <h2 className="font-serif text-[20px] leading-tight tracking-[-0.01em]">
          Your realism flags
        </h2>
      </header>
      <ul>
        {flagged.map((q) => (
          <RealismFlagRow
            key={q.question_id}
            attemptPosition={q.position}
            promptText={q.prompt}
            flagNote={q.note}
            flaggedAt={q.flaggedAt}
          />
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-ink-3">
        These flags don&apos;t affect your grade.
      </p>
    </Card>
  );
}

type FlaggedQuestion = {
  question_id: string;
  position: number;
  prompt: string | null;
  note: string | null;
  flaggedAt: string | null;
};

function narrow(value: unknown, fallbackPosition: number): FlaggedQuestion | null {
  if (!value || typeof value !== "object") return null;
  const q = value as AttemptViewQuestion;
  if (!q.realism_flagged_by_me) return null;
  const id = q.id ?? q.question_id;
  if (!id) return null;
  const position = q.attempt_position ?? fallbackPosition;
  const prompt = q.prompt ?? q.config?.prompt ?? null;
  return {
    question_id: String(id),
    position,
    prompt,
    note: q.realism_flag_note ?? null,
    flaggedAt: q.realism_flagged_at ?? null,
  };
}
