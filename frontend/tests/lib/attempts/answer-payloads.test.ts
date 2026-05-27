/**
 * Answer-payload discriminated union (FE-4 §B.1 §4 / §D.1).
 *
 * Locks the backend-shape contract (drift item 5 from plan): MCQ ships
 * `{choice: number}` not `{choice_id: string}`; TF ships
 * `{answer: bool}` not `{value}`; matching ships `{matches: number[]}`
 * not `{pairs: Record}`. The type-guard rejects malformed inputs so
 * the cache layer can't poison the reducer.
 */

import { describe, expect, it } from "vitest";
import {
  emptyPayload,
  isAnswered,
  isAnswerPayload,
  toServerPayload,
  type AnswerPayload,
} from "@/lib/attempts/answer-payloads";

describe("answer-payloads · toServerPayload strips the discriminator", () => {
  it("MCQ payload → { choice: <index> } (no `type`, no `choice_id`)", () => {
    const payload: AnswerPayload = { type: "multiple_choice", choice: 2 };
    expect(toServerPayload(payload)).toEqual({ choice: 2 });
  });

  it("TF payload → { answer: <bool> } (not { value })", () => {
    expect(toServerPayload({ type: "true_false", answer: true })).toEqual({
      answer: true,
    });
  });

  it("matching payload → { matches: number[] } (not { pairs })", () => {
    expect(toServerPayload({ type: "matching", matches: [1, 0, 2] })).toEqual({
      matches: [1, 0, 2],
    });
  });

  it("short_answer + scenario both → { text }", () => {
    expect(toServerPayload({ type: "short_answer", text: "ok" })).toEqual({
      text: "ok",
    });
    expect(toServerPayload({ type: "scenario", text: "longer" })).toEqual({
      text: "longer",
    });
  });
});

describe("answer-payloads · isAnswerPayload narrowing", () => {
  it("accepts each valid shape", () => {
    expect(isAnswerPayload({ type: "multiple_choice", choice: 0 })).toBe(true);
    expect(isAnswerPayload({ type: "true_false", answer: false })).toBe(true);
    expect(isAnswerPayload({ type: "matching", matches: [0, 1] })).toBe(true);
    expect(isAnswerPayload({ type: "short_answer", text: "" })).toBe(true);
    expect(isAnswerPayload({ type: "scenario", text: "a" })).toBe(true);
  });

  it("rejects malformed shapes", () => {
    expect(isAnswerPayload(null)).toBe(false);
    expect(isAnswerPayload({ type: "multiple_choice", choice_id: "A" })).toBe(false);
    expect(isAnswerPayload({ type: "true_false", value: true })).toBe(false);
    expect(isAnswerPayload({ type: "matching", matches: ["1"] })).toBe(false);
    expect(isAnswerPayload({ type: "matching", pairs: {} })).toBe(false);
    expect(isAnswerPayload({ type: "unknown" })).toBe(false);
  });
});

describe("answer-payloads · isAnswered", () => {
  it("treats negative MCQ choice + empty trim as unanswered", () => {
    expect(isAnswered({ type: "multiple_choice", choice: -1 })).toBe(false);
    expect(isAnswered({ type: "multiple_choice", choice: 0 })).toBe(true);
    expect(isAnswered({ type: "short_answer", text: "   " })).toBe(false);
    expect(isAnswered({ type: "short_answer", text: "hi" })).toBe(true);
    expect(isAnswered({ type: "matching", matches: [] })).toBe(false);
    expect(isAnswered({ type: "matching", matches: [-1, -1] })).toBe(false);
    expect(isAnswered({ type: "matching", matches: [0, 1] })).toBe(true);
  });
});

describe("answer-payloads · emptyPayload constructs the per-type seed", () => {
  it("MCQ + TF + matching + free-text", () => {
    expect(emptyPayload("multiple_choice")).toEqual({
      type: "multiple_choice",
      choice: -1,
    });
    expect(emptyPayload("true_false")).toEqual({ type: "true_false", answer: false });
    expect(emptyPayload("matching", { matchingPairs: 3 })).toEqual({
      type: "matching",
      matches: [-1, -1, -1],
    });
    expect(emptyPayload("short_answer")).toEqual({ type: "short_answer", text: "" });
    expect(emptyPayload("scenario")).toEqual({ type: "scenario", text: "" });
  });
});
