/**
 * unpack-question-config — pulls the FE-owned packed fields back out
 * of a `QuestionResponse.config` object so the question editor modal
 * can prefill on edit.
 *
 * Inverse of `compose-question-config.ts`. Per FE-8 admin-tests §E
 * item 7 / §B.3 §7 (`fe-specs/FE-8-admin-tests.md:740`), edit-mode
 * prefill reads from the cached pool list (no per-question GET
 * endpoint exists on the wire — drift sweep Finding #1).
 *
 * Defensive: backend may emit malformed or partial `config` (e.g.
 * legacy rows from before FE owned the contract). The unpacker returns
 * a fully-typed `QuestionFormInput` with sensible defaults for missing
 * fields so the modal always opens with a renderable form.
 */

import {
  defaultsForType,
  mcqChoiceId,
  type MatchPair,
  type MCQChoice,
  type QuestionFormInput,
  type QuestionType,
} from "./question-form";
import type { TestResponse } from "@/lib/queries/admin-tests";
import type { components } from "@/lib/api/types";

type QuestionResponse = components["schemas"]["QuestionResponse"];

const asString = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v : fallback;

const asBool = (v: unknown, fallback = false): boolean =>
  typeof v === "boolean" ? v : fallback;

/** An option is a bare string or a `{ text, image_url }` object on the wire. */
const optionText = (opt: unknown): string => {
  if (typeof opt === "string") return opt;
  if (opt && typeof opt === "object") {
    return asString((opt as Record<string, unknown>).text);
  }
  return "";
};

/**
 * Rebuild the editor's choice rows from the wire's `options` (string|object
 * list) + `correct` (0-based index): the inverse of compose's
 * choices → options/correct mapping (FE-8 §H(a) item 2, amended).
 */
function unpackMcqChoices(options: unknown, correct: unknown): MCQChoice[] {
  if (!Array.isArray(options)) return [];
  const correctIdx = typeof correct === "number" ? correct : -1;
  return options.map((opt, i) => ({
    id: mcqChoiceId(i),
    text: optionText(opt),
    correct: i === correctIdx,
  }));
}

function unpackMatchPairs(raw: unknown): MatchPair[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    const row = (p ?? {}) as Record<string, unknown>;
    return { left: asString(row.left), right: asString(row.right) };
  });
}

/**
 * Project a `QuestionResponse` (with its packed-config payload) into
 * `QuestionFormInput` so rhf's `form.reset` can hydrate the editor.
 * Falls back to per-type defaults when the cached config is missing
 * fields.
 */
export function unpackQuestionConfig(q: QuestionResponse): QuestionFormInput {
  const type = q.type as QuestionType;
  const cfg = (q.config ?? {}) as Record<string, unknown>;
  const base = {
    pill_id: asString(cfg.pill_id),
    assigned_difficulty: q.assigned_difficulty,
    // `prompt` is the wire key (amended); fall back to a legacy `body` key
    // so any pre-amendment cached row still hydrates.
    body: asString(cfg.prompt) || asString(cfg.body),
    is_anchor: asBool(cfg.is_anchor),
  };
  switch (type) {
    case "multiple_choice": {
      const choices = unpackMcqChoices(cfg.options, cfg.correct);
      const fallback = defaultsForType("multiple_choice");
      const fallbackChoices =
        fallback.type === "multiple_choice"
          ? fallback.config.choices
          : ([] as MCQChoice[]);
      return {
        ...base,
        type,
        config: { choices: choices.length >= 2 ? choices : fallbackChoices },
      };
    }
    case "true_false":
      return { ...base, type, config: { correct: asBool(cfg.correct, true) } };
    case "matching": {
      const pairs = unpackMatchPairs(cfg.pairs);
      const fallback = defaultsForType("matching");
      const fallbackPairs =
        fallback.type === "matching" ? fallback.config.pairs : ([] as MatchPair[]);
      return {
        ...base,
        type,
        config: { pairs: pairs.length >= 2 ? pairs : fallbackPairs },
      };
    }
    case "short_answer":
    case "scenario":
      return {
        ...base,
        type,
        config: {
          rubric: asString(cfg.rubric),
          model_answer: asString(cfg.model_answer),
        },
      };
  }
}

/**
 * Display helper for the question pool table — pulls the packed body
 * out as a preview string. Empty fallback so the row still renders if
 * config is malformed.
 */
export function previewQuestionBody(q: QuestionResponse): string {
  const cfg = (q.config ?? {}) as Record<string, unknown>;
  return asString(cfg.prompt) || asString(cfg.body);
}

/** Helper: the packed pill_id from a question (display join). */
export function pillIdFromQuestion(q: QuestionResponse): string | null {
  const cfg = (q.config ?? {}) as Record<string, unknown>;
  const id = asString(cfg.pill_id);
  return id === "" ? null : id;
}

/** Convenience: read the parent test's id from the response (or null). */
export function testIdFromQuestion(q: QuestionResponse): string | null {
  return q.test_id;
}

/** Re-export to keep types co-located for callers. */
export type { QuestionResponse, TestResponse };
