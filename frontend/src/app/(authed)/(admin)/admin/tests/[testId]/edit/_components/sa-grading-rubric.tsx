"use client";

/**
 * SAGradingRubric — grading rubric + model answer for the AI-graded
 * types per FE-8 admin-tests §B.3 §2 (`fe-specs/FE-8-admin-tests.md:538`).
 * Reused by both `short_answer` AND `scenario` types per design line 712.
 *
 * `model_answer` is required by the backend's validate_question_config
 * (FE-8 §H(a) item 2, amended 2026-05-31) — without it short_answer /
 * scenario questions 422 on create.
 */

import type { UseFormRegister } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/admin/field";
import type { QuestionFormInput } from "@/lib/tests/question-form";

export type SAGradingRubricProps = {
  register: UseFormRegister<QuestionFormInput>;
  disabled?: boolean;
  error?: string | null;
  modelAnswerError?: string | null;
};

export function SAGradingRubric({
  register,
  disabled = false,
  error,
  modelAnswerError,
}: SAGradingRubricProps) {
  return (
    <div data-testid="sa-grading-rubric" className="space-y-3">
      <div>
        <div className="eyebrow mb-1">Grading rubric</div>
        <Textarea
          {...register("config.rubric" as never)}
          rows={5}
          placeholder="Describe how the AI grader should evaluate a response. Example: 'Award full marks if the answer mentions both the cathodic-protection mechanism and at least one failure mode. Half marks for either alone.'"
          disabled={disabled}
          data-testid="sa-grading-rubric-textarea"
        />
        {error ? <FieldError msg={error} /> : null}
      </div>
      <div>
        <div className="eyebrow mb-1">Model answer</div>
        <Textarea
          {...register("config.model_answer" as never)}
          rows={4}
          placeholder="A reference answer the AI grades against. Example: 'Impressed-current cathodic protection drives a protective current from an external DC source; a common failure mode is anode depletion.'"
          disabled={disabled}
          data-testid="sa-model-answer-textarea"
        />
        {modelAnswerError ? <FieldError msg={modelAnswerError} /> : null}
      </div>
    </div>
  );
}
