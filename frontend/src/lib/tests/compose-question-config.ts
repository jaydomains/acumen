/**
 * compose-question-config — packs the FE-owned per-type form shape
 * into the wire `QuestionCreate.config` / `QuestionUpdate.config`
 * object.
 *
 * Contract per FE-8 admin-tests §H(a) item 2 (amended 2026-05-31). The
 * backend's `validate_question_config` + presentation (`_present_one`) +
 * grading (`_grade_mcq`/`_grade_matching`) read a fixed key set, so the FE
 * emits to match it: `prompt` (all types), `options` + `correct:int`
 * (multiple_choice), `correct:bool` (true_false), `pairs` (matching),
 * `rubric` + `model_answer` (short_answer / scenario). Backend types
 * `config` as `object` / openapi-typescript renders it `Record<string,
 * never>` (uninhabitable) — this helper returns a populated object the
 * caller casts at the POST/PATCH boundary.
 *
 * The question text maps `body → prompt`. `pill_id` and `is_anchor` are
 * NOT first-class wire fields and are not read by the authored-question
 * endpoint; they ride along as tolerated extra keys so the pool display
 * (`pillIdFromQuestion`) and edit-mode unpack can recover them.
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
    prompt: values.body,
    pill_id: values.pill_id,
    is_anchor: values.is_anchor,
  };
  switch (values.type) {
    case "multiple_choice": {
      const choices = values.config.choices;
      // The backend reads `options` (string list) + `correct` (0-based
      // index into options). Exactly-one-correct is enforced by the zod
      // refine before compose runs; if that invariant is ever bypassed,
      // fail LOUD rather than silently submitting choice 0 as the answer
      // key (Gitar review on #77).
      const correct = choices.findIndex((c) => c.correct);
      if (correct === -1) {
        throw new Error(
          "composeQuestionConfig: multiple_choice has no choice marked correct.",
        );
      }
      return {
        ...shared,
        options: choices.map((c) => c.text),
        correct,
      };
    }
    case "true_false":
      return { ...shared, correct: values.config.correct };
    case "matching":
      return { ...shared, pairs: values.config.pairs };
    case "short_answer":
    case "scenario":
      return {
        ...shared,
        rubric: values.config.rubric,
        model_answer: values.config.model_answer,
      };
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
