"use client";

/**
 * SAGradingRubric — single rubric textarea per FE-8 admin-tests
 * §B.3 §2 (`fe-specs/FE-8-admin-tests.md:538`). Reused by both
 * `short_answer` AND `scenario` types per design line 712 ("SA rubric
 * pattern shared with Scenario").
 */

import type { UseFormRegister } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/admin/field";
import type { QuestionFormInput } from "@/lib/tests/question-form";

export type SAGradingRubricProps = {
  register: UseFormRegister<QuestionFormInput>;
  disabled?: boolean;
  error?: string | null;
};

export function SAGradingRubric({
  register,
  disabled = false,
  error,
}: SAGradingRubricProps) {
  return (
    <div data-testid="sa-grading-rubric">
      <Textarea
        {...register("config.rubric" as never)}
        rows={5}
        placeholder="Describe how the AI grader should evaluate a response. Example: 'Award full marks if the answer mentions both the cathodic-protection mechanism and at least one failure mode. Half marks for either alone.'"
        disabled={disabled}
        data-testid="sa-grading-rubric-textarea"
      />
      {error ? <FieldError msg={error} /> : null}
    </div>
  );
}
