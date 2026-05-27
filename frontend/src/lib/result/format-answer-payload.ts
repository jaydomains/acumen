/**
 * format-answer-payload — render a stored answer payload as
 * human-readable text for the ByQuestionCard expand row (FE-6 §B.4).
 *
 * Reads the raw payload from `result.questions[].response.answer_payload`
 * (a `Record<string, unknown>` on the wire — Pydantic surfaces it as a
 * plain dict). Walks the discriminated-union shape from FE-4's
 * answer-payloads.ts, keyed by `question_type` rather than the
 * payload's `type` field (the payload posted from the runner doesn't
 * include `type`; only the FE-4 reducer adds it client-side).
 *
 * Returns `null` when the testee skipped the question (no payload) so
 * the caller can render "no answer".
 */

export type FormattedAnswerLine = { label?: string; text: string };

type Payload = Record<string, unknown> | null | undefined;

export function formatAnswerPayload(
  questionType: string | null | undefined,
  payload: Payload,
  options: {
    mcqLabels?: string[];
    matchingLeft?: string[];
    matchingRight?: string[];
  } = {},
): FormattedAnswerLine[] | null {
  if (!payload) return null;

  switch (questionType) {
    case "multiple_choice": {
      const choice = payload.choice;
      if (typeof choice !== "number" || choice < 0) return null;
      const label = options.mcqLabels?.[choice];
      return [
        {
          label: `Option ${String.fromCharCode(65 + choice)}`,
          text: label ?? `choice ${choice}`,
        },
      ];
    }
    case "true_false": {
      const answer = payload.answer;
      if (typeof answer !== "boolean") return null;
      return [{ text: answer ? "True" : "False" }];
    }
    case "matching": {
      const matches = payload.matches;
      if (!Array.isArray(matches)) return null;
      const filled = matches.filter((m): m is number => typeof m === "number" && m >= 0);
      if (filled.length === 0) return null;
      return matches.map((rightIdx, leftIdx) => {
        if (typeof rightIdx !== "number" || rightIdx < 0) {
          return { label: leftLabel(leftIdx, options.matchingLeft), text: "(unmatched)" };
        }
        return {
          label: leftLabel(leftIdx, options.matchingLeft),
          text: rightLabel(rightIdx, options.matchingRight),
        };
      });
    }
    case "short_answer":
    case "scenario": {
      const text = payload.text;
      if (typeof text !== "string" || text.trim().length === 0) return null;
      return [{ text }];
    }
    default:
      return null;
  }
}

function leftLabel(idx: number, labels?: string[]): string {
  return labels?.[idx] ?? `Item ${idx + 1}`;
}

function rightLabel(idx: number, labels?: string[]): string {
  return labels?.[idx] ?? `Option ${String.fromCharCode(65 + idx)}`;
}
