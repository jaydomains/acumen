"use client";

/**
 * Matching question renderer (FE-4 §B.1 §2).
 *
 * Left column static (the prompts). Right column is a shadcn `Select`
 * per row whose options enumerate the (possibly-shuffled) right-side
 * strings from the presented question. Selecting `right[j]` for
 * `left[i]` records `matches[i] = j`. `-1` represents "not yet
 * answered" — the empty-pair state.
 *
 * Backend grades on `answer.matches` (`app/domain/attempts.py:1176`),
 * where the snapshot's `pairs[i].left ↔ pairs[i].right` is the
 * correct identity mapping. Presentation may shuffle the right column
 * (server-side via `option_permutation`), so the FE matches the
 * RENDERED right index to the rendered left index — which is exactly
 * the contract `_grade_matching` expects.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PresentedQuestion } from "./types";
import type { MatchingAnswer } from "@/lib/attempts/answer-payloads";

export type QuestionMatchingProps = {
  question: PresentedQuestion<"matching">;
  answer: MatchingAnswer | null;
  onChange: (next: MatchingAnswer) => void;
  disabled?: boolean | undefined;
};

export function QuestionMatching({
  question,
  answer,
  onChange,
  disabled,
}: QuestionMatchingProps) {
  const { left, right } = question.config;
  const matches = answer?.matches ?? Array.from({ length: left.length }, () => -1);

  return (
    <div
      data-testid="question-matching"
      className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr]"
    >
      <div className="flex flex-col gap-2">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-3">
          Items
        </div>
        {left.map((item, i) => (
          <div
            key={`left-${i}`}
            data-testid={`question-matching-left-${i}`}
            className="border border-line bg-bg-raised px-3 py-2 text-[14px] text-ink"
          >
            <span className="mr-2 font-mono text-[12px] text-ink-3">{i + 1}.</span>
            {item}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-3">
          Matches
        </div>
        {left.map((_, i) => {
          const current = matches[i] ?? -1;
          const stringValue = current >= 0 ? String(current) : "";
          return (
            <Select
              key={`right-${i}`}
              value={stringValue}
              disabled={disabled === true}
              onValueChange={(v) => {
                const next = [...matches];
                next[i] = Number(v);
                onChange({ type: "matching", matches: next });
              }}
            >
              <SelectTrigger
                data-testid={`question-matching-trigger-${i}`}
                aria-label={`Match for item ${i + 1}`}
              >
                <SelectValue placeholder="Select a match…" />
              </SelectTrigger>
              <SelectContent>
                {right.map((option, j) => (
                  <SelectItem
                    key={`opt-${i}-${j}`}
                    value={String(j)}
                    data-testid={`question-matching-option-${i}-${j}`}
                  >
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        })}
      </div>
    </div>
  );
}
