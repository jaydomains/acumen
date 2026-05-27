"use client";

/**
 * Short-answer + Scenario question renderer (FE-4 §B.1 §2).
 *
 * Scenario uses the same shape with a taller textarea (minHeight 220
 * vs 140) and a "scenario" eyebrow. Shared component so the contract
 * stays single-source.
 *
 * Footer copy: "AI graded · expected ~{expected_seconds}s · then
 * reviewed cross-family" + char counter (per
 * `attempt.jsx:555–570`). `expected_seconds` is optional — if absent
 * the footer drops the duration hint.
 */

import { Textarea } from "@/components/ui/textarea";
import type { PresentedQuestion } from "./types";
import type { ScenarioAnswer, ShortAnswerAnswer } from "@/lib/attempts/answer-payloads";

type Kind = "short_answer" | "scenario";

export type QuestionShortAnswerProps<K extends Kind> = {
  question: PresentedQuestion<K>;
  answer: (K extends "short_answer" ? ShortAnswerAnswer : ScenarioAnswer) | null;
  onChange: (next: K extends "short_answer" ? ShortAnswerAnswer : ScenarioAnswer) => void;
  disabled?: boolean | undefined;
};

export function QuestionShortAnswer({
  question,
  answer,
  onChange,
  disabled,
}: QuestionShortAnswerProps<"short_answer">) {
  return (
    <FreeTextField
      testId="question-short-answer"
      eyebrow={null}
      minHeight={140}
      placeholder="Type your answer…"
      expectedSeconds={question.config.expected_seconds ?? null}
      text={answer?.text ?? ""}
      disabled={disabled}
      onChange={(text) => onChange({ type: "short_answer", text })}
    />
  );
}

export function QuestionScenario({
  question,
  answer,
  onChange,
  disabled,
}: QuestionShortAnswerProps<"scenario">) {
  return (
    <FreeTextField
      testId="question-scenario"
      eyebrow="Scenario"
      minHeight={220}
      placeholder="Walk through your reasoning…"
      expectedSeconds={question.config.expected_seconds ?? null}
      text={answer?.text ?? ""}
      disabled={disabled}
      onChange={(text) => onChange({ type: "scenario", text })}
    />
  );
}

type FreeTextFieldProps = {
  testId: string;
  eyebrow: string | null;
  minHeight: number;
  placeholder: string;
  expectedSeconds: number | null;
  text: string;
  disabled?: boolean | undefined;
  onChange: (text: string) => void;
};

function FreeTextField({
  testId,
  eyebrow,
  minHeight,
  placeholder,
  expectedSeconds,
  text,
  disabled,
  onChange,
}: FreeTextFieldProps) {
  const expectedCopy = expectedSeconds != null ? ` · expected ~${expectedSeconds}s` : "";
  return (
    <div data-testid={testId} className="flex flex-col gap-2">
      {eyebrow && (
        <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
          {eyebrow}
        </div>
      )}
      <Textarea
        data-testid={`${testId}-input`}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        style={{ minHeight: `${minHeight}px` }}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex items-center justify-between text-[11.5px] text-ink-3">
        <span>{`AI graded${expectedCopy} · then reviewed cross-family`}</span>
        <span data-testid={`${testId}-char-counter`}>
          {text.length.toLocaleString()} chars
        </span>
      </div>
    </div>
  );
}
