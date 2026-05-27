/**
 * ByQuestionCard — Q-by-Q grade list (FE-6 §B.4).
 *
 * Title row carries the PdfExportButton slot (filled in slice 5); the
 * row list mounts a QuestionGradeRow per `result.questions[]` entry.
 * Empty `questions` array renders an inline placeholder so the card
 * shell stays visible (helpful when status flips ready before the
 * questions array materialises in a poll tick).
 */

import { Card } from "@/components/ui/card";
import { QuestionGradeRow } from "./question-grade-row";
import type { components } from "@/lib/api/types";
import type { ReactNode } from "react";

type ResultQuestion = components["schemas"]["ResultQuestion"];

export type ByQuestionCardProps = {
  questions: ResultQuestion[] | null | undefined;
  /** Slice-5 PdfExportButton mounts here. */
  headerSlot?: ReactNode;
};

export function ByQuestionCard({ questions, headerSlot }: ByQuestionCardProps) {
  const rows = questions ?? [];
  return (
    <Card data-testid="by-question-card" className="p-6">
      <header className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="eyebrow mb-1">YOUR ANSWERS</div>
          <h2 className="font-serif text-[20px] leading-tight tracking-[-0.01em]">
            Question by question
          </h2>
        </div>
        <div data-testid="by-question-header-slot">{headerSlot}</div>
      </header>
      {rows.length === 0 ? (
        <p className="text-[13px] text-ink-3">No question rows to render yet.</p>
      ) : (
        <ul className="border-t border-line">
          {rows.map((q) => (
            <QuestionGradeRow key={q.question_id} question={q} />
          ))}
        </ul>
      )}
    </Card>
  );
}
