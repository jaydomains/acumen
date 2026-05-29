/**
 * compose-question-config — packs the FE-owned per-type form shape
 * into the wire `QuestionCreate.config` / `QuestionUpdate.config`
 * object.
 *
 * LOCKED v1 contract per FE-8 admin-tests §H(a) item 2 (`fe-specs/
 * FE-8-admin-tests.md:738`). Backend types `config` as `object` /
 * generated openapi-typescript types render it as
 * `Record<string, never>` — uninhabitable. This helper returns a
 * populated object; the caller casts at the POST/PATCH boundary.
 *
 * `body`, `pill_id`, and `is_anchor` are NOT first-class wire fields
 * (per drift sweep Findings #6 and #7); they pack into `config`
 * alongside the per-type payload. Backend round-trip preserves the
 * extra keys as opaque metadata.
 */

import type { QuestionFormInput, QuestionType } from "./question-form";

export type ComposedConfig = Record<string, unknown>;

export type ComposedQuestionCreate = {
  type: QuestionType;
  config: ComposedConfig;
  assigned_difficulty: number;
  question_group_id: string | null;
};

export type ComposedQuestionUpdate = {
  config: ComposedConfig;
  assigned_difficulty: number;
  question_group_id: string | null;
};

function composeConfig(values: QuestionFormInput): ComposedConfig {
  const shared = {
    body: values.body,
    pill_id: values.pill_id,
    is_anchor: values.is_anchor,
  };
  switch (values.type) {
    case "multiple_choice":
      return { ...shared, choices: values.config.choices };
    case "true_false":
      return { ...shared, correct: values.config.correct };
    case "matching":
      return { ...shared, pairs: values.config.pairs };
    case "short_answer":
    case "scenario":
      return { ...shared, rubric: values.config.rubric };
  }
}

/** Compose a `QuestionCreate`-shaped body from validated form input. */
export function composeQuestionCreate(values: QuestionFormInput): ComposedQuestionCreate {
  return {
    type: values.type,
    config: composeConfig(values),
    assigned_difficulty: values.assigned_difficulty,
    question_group_id: null,
  };
}

/**
 * Compose a `QuestionUpdate`-shaped body. Note: per drift sweep
 * Finding #3, `config` ships whole-or-not (the wire offers no
 * partial-config delta path), so this always sends the full config.
 */
export function composeQuestionUpdate(values: QuestionFormInput): ComposedQuestionUpdate {
  return {
    config: composeConfig(values),
    assigned_difficulty: values.assigned_difficulty,
    question_group_id: null,
  };
}
