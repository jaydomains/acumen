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

function unpackMcqChoices(raw: unknown): MCQChoice[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((c, i) => {
    const row = (c ?? {}) as Record<string, unknown>;
    return {
      id: asString(row.id, mcqChoiceId(i)),
      text: asString(row.text),
      correct: asBool(row.correct),
    };
  });
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
    body: asString(cfg.body),
    is_anchor: asBool(cfg.is_anchor),
  };
  switch (type) {
    case "multiple_choice": {
      const choices = unpackMcqChoices(cfg.choices);
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
      return { ...base, type, config: { rubric: asString(cfg.rubric) } };
  }
}

/**
 * Display helper for the question pool table — pulls the packed body
 * out as a preview string. Empty fallback so the row still renders if
 * config is malformed.
 */
export function previewQuestionBody(q: QuestionResponse): string {
  const cfg = (q.config ?? {}) as Record<string, unknown>;
  return asString(cfg.body);
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
