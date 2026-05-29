"use client";

/**
 * QuestionTypeChooser — 5-card type chooser per FE-8 admin-tests §B.3
 * §2 (`fe-specs/FE-8-admin-tests.md:533`).
 *
 * Disabled in edit mode (type immutable post-create per drift sweep
 * Finding #14 — `QuestionUpdate` doesn't carry `type`). The active
 * card flips to ink-bg per FE-2 segmented pattern.
 */

import { cn } from "@/lib/utils";
import type { QuestionType } from "@/lib/tests/question-form";

type Meta = { id: QuestionType; title: string; body: string };

const TYPES: Meta[] = [
  {
    id: "multiple_choice",
    title: "Multiple choice",
    body: "2–6 options with exactly one correct.",
  },
  {
    id: "true_false",
    title: "True / False",
    body: "Binary correct-or-not.",
  },
  {
    id: "matching",
    title: "Matching",
    body: "2–8 left-to-right pairs.",
  },
  {
    id: "short_answer",
    title: "Short answer",
    body: "Free-text response graded by AI rubric.",
  },
  {
    id: "scenario",
    title: "Scenario",
    body: "Long-form prompt graded by AI rubric.",
  },
];

export type QuestionTypeChooserProps = {
  value: QuestionType | null;
  onChange: (type: QuestionType) => void;
  /** Locks every card (edit mode). */
  locked: boolean;
};

export function QuestionTypeChooser({
  value,
  onChange,
  locked,
}: QuestionTypeChooserProps) {
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2"
      data-testid="question-type-chooser"
    >
      {TYPES.map((t) => {
        const active = value === t.id;
        const disabled = locked;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              if (disabled) return;
              onChange(t.id);
            }}
            disabled={disabled}
            aria-pressed={active}
            data-testid={`question-type-card-${t.id}`}
            className={cn(
              "text-left border px-3 py-2.5 transition-colors",
              active
                ? "bg-ink text-bg border-ink"
                : "bg-bg-raised border-line hover:bg-bg-sunk",
              disabled && "opacity-60 cursor-not-allowed hover:bg-bg-raised",
            )}
          >
            <div
              className={cn(
                "font-mono text-[10.5px] uppercase tracking-[0.12em]",
                active ? "text-bg" : "text-ink-3",
              )}
            >
              {t.id}
            </div>
            <div
              className={cn(
                "font-serif text-[15px] mt-0.5",
                active ? "text-bg" : "text-ink",
              )}
            >
              {t.title}
            </div>
            <div
              className={cn(
                "text-[11.5px] mt-1 leading-[1.4]",
                active ? "text-bg/80" : "text-ink-3",
              )}
            >
              {t.body}
            </div>
          </button>
        );
      })}
    </div>
  );
}
