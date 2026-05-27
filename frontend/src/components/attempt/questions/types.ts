/**
 * Shared types for question renderers (FE-4 §B.1 §2).
 *
 * The presented-question shape comes from
 * `app/domain/attempts.py:_present_one` — strongly-typed FE-side so
 * the renderers don't reach into untyped `Record<string, unknown>`.
 * Each `kind`-narrowed type is what `QuestionView` dispatches on.
 *
 * Note: AttemptView.questions is `list[dict] | None` server-side
 * (`app/schemas.py:570`), so the FE layer narrows + validates at the
 * dispatch boundary, not at the wire. Helpers in
 * `presented-question.ts` (`narrowPresented`) do the runtime check.
 */

import type { QuestionTypeName } from "@/lib/attempts/answer-payloads";

export type ChoiceOption = {
  text: string;
  image_url: string | null;
};

export type MatchingPair = {
  left: string;
  right: string;
};

export type PresentedConfigByType = {
  multiple_choice: {
    prompt: string;
    options: ChoiceOption[];
  };
  true_false: {
    prompt: string;
  };
  matching: {
    prompt: string;
    left: string[];
    right: string[];
  };
  short_answer: {
    prompt: string;
    expected_seconds?: number | null;
  };
  scenario: {
    prompt: string;
    expected_seconds?: number | null;
  };
};

export type PresentedQuestion<T extends QuestionTypeName = QuestionTypeName> = {
  id: string;
  type: T;
  question_group_id: string | null;
  attempt_position: number | null;
  reference_image_url: string | null;
  reference_image_caption: string | null;
  config: PresentedConfigByType[T];
};

export type AnyPresentedQuestion =
  | PresentedQuestion<"multiple_choice">
  | PresentedQuestion<"true_false">
  | PresentedQuestion<"matching">
  | PresentedQuestion<"short_answer">
  | PresentedQuestion<"scenario">;
