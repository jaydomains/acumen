/**
 * Per-question answer payloads (FE-4 §B.1 §4 / §C.3).
 *
 * Field names match the backend's grading layer
 * (`app/domain/attempts.py:_grade_mcq` / `_grade_true_false` /
 * `_grade_matching` — not the FE spec's earlier `choice_id` / `value` /
 * `pairs` proposal). The spec assumed names that the backend never
 * shipped; the build session aligns to backend reality and captures
 * the divergence in the handover. Concretely:
 *   - multiple_choice → ``{ choice: <index> }``
 *   - true_false     → ``{ answer: <bool> }``
 *   - matching       → ``{ matches: [<right-idx>, ...] }`` (one per left)
 *   - short_answer   → ``{ text }``
 *   - scenario       → ``{ text }``
 *
 * MCQ is single-select only (verified against
 * `app/domain/tests.py:345` — `correct` must be a single int index).
 * No multi-select discriminator ships in v1.
 *
 * The ``type`` discriminator lets `useAttempt`'s reducer dispatch on
 * payload shape without re-reading `question.type` — the reducer
 * doesn't carry questions, only answers — and lets the autosave
 * mutation strip the discriminator before POST (the backend doesn't
 * accept it on ``AutosaveRequest.answer_payload``).
 */

export type MultipleChoiceAnswer = { type: "multiple_choice"; choice: number };
export type TrueFalseAnswer = { type: "true_false"; answer: boolean };
export type MatchingAnswer = { type: "matching"; matches: number[] };
export type ShortAnswerAnswer = { type: "short_answer"; text: string };
export type ScenarioAnswer = { type: "scenario"; text: string };

export type AnswerPayload =
  | MultipleChoiceAnswer
  | TrueFalseAnswer
  | MatchingAnswer
  | ShortAnswerAnswer
  | ScenarioAnswer;

export type QuestionTypeName = AnswerPayload["type"];

/**
 * Strip the discriminator before POSTing to /autosave. The backend
 * matches the payload shape against the question's stored type — it
 * doesn't read (and rejects, since `AutosaveRequest` is `extra=forbid`)
 * a ``type`` field.
 */
export function toServerPayload(payload: AnswerPayload): Record<string, unknown> {
  switch (payload.type) {
    case "multiple_choice":
      return { choice: payload.choice };
    case "true_false":
      return { answer: payload.answer };
    case "matching":
      return { matches: payload.matches };
    case "short_answer":
    case "scenario":
      return { text: payload.text };
  }
}

/** Type-guard for the union — used by tests + answers-cache rehydrate. */
export function isAnswerPayload(value: unknown): value is AnswerPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as { type?: unknown };
  switch (v.type) {
    case "multiple_choice":
      return typeof (v as MultipleChoiceAnswer).choice === "number";
    case "true_false":
      return typeof (v as TrueFalseAnswer).answer === "boolean";
    case "matching": {
      const m = (v as MatchingAnswer).matches;
      return Array.isArray(m) && m.every((x) => typeof x === "number");
    }
    case "short_answer":
    case "scenario":
      return typeof (v as ShortAnswerAnswer).text === "string";
    default:
      return false;
  }
}

/**
 * Treat an empty payload (cleared MCQ, untouched short-answer) as
 * "no answer yet" so submit's "N of M answered" counter is honest.
 * Short / scenario empty-string counts as unanswered.
 */
export function isAnswered(payload: AnswerPayload): boolean {
  switch (payload.type) {
    case "multiple_choice":
      return Number.isInteger(payload.choice) && payload.choice >= 0;
    case "true_false":
      return typeof payload.answer === "boolean";
    case "matching":
      return payload.matches.length > 0 && payload.matches.every((m) => m >= 0);
    case "short_answer":
    case "scenario":
      return payload.text.trim().length > 0;
  }
}

/**
 * Construct an empty payload for the given question type. Used when
 * the reducer needs an initial value (e.g., a matching row the
 * testee hasn't touched should already exist as an unfilled
 * `matches` array of -1's so partial saves preserve their shape).
 */
export function emptyPayload(
  type: QuestionTypeName,
  hint?: { matchingPairs?: number },
): AnswerPayload {
  switch (type) {
    case "multiple_choice":
      return { type: "multiple_choice", choice: -1 };
    case "true_false":
      return { type: "true_false", answer: false };
    case "matching":
      return {
        type: "matching",
        matches: Array.from({ length: hint?.matchingPairs ?? 0 }, () => -1),
      };
    case "short_answer":
      return { type: "short_answer", text: "" };
    case "scenario":
      return { type: "scenario", text: "" };
  }
}
