/**
 * Answers-cache (FE-4 R-a) — localStorage round-trip + corruption-
 * tolerance (FE-4 §D.1).
 *
 * Key shape: `acumen.attempts.<id>.answers`. Storage failures swallow
 * silently — losing a write round-trip is acceptable; crashing the
 * runner on a hostile storage env is not.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAnswers, loadAnswers, saveAnswers } from "@/lib/attempts/answers-cache";
import type { AnswerPayload } from "@/lib/attempts/answer-payloads";

const ATTEMPT_ID = "11111111-1111-1111-1111-000000000077";

beforeEach(() => {
  localStorage.clear();
});

describe("answers-cache round-trip", () => {
  it("loadAnswers returns an empty Map when nothing is stored", () => {
    const loaded = loadAnswers(ATTEMPT_ID);
    expect(loaded.size).toBe(0);
  });

  it("saveAnswers + loadAnswers preserves the discriminated union", () => {
    const answers = new Map<string, AnswerPayload>();
    answers.set("q1", { type: "multiple_choice", choice: 1 });
    answers.set("q2", { type: "true_false", answer: false });
    answers.set("q3", { type: "short_answer", text: "hi" });
    saveAnswers(ATTEMPT_ID, answers);

    const loaded = loadAnswers(ATTEMPT_ID);
    expect(loaded.size).toBe(3);
    expect(loaded.get("q1")).toEqual({ type: "multiple_choice", choice: 1 });
    expect(loaded.get("q2")).toEqual({ type: "true_false", answer: false });
    expect(loaded.get("q3")).toEqual({ type: "short_answer", text: "hi" });
  });

  it("clearAnswers removes the key for that attempt only", () => {
    saveAnswers("A", new Map([["q1", { type: "true_false", answer: true }]]));
    saveAnswers("B", new Map([["q1", { type: "true_false", answer: false }]]));
    clearAnswers("A");
    expect(loadAnswers("A").size).toBe(0);
    expect(loadAnswers("B").size).toBe(1);
  });

  it("loadAnswers drops corrupted entries silently", () => {
    localStorage.setItem(
      `acumen.attempts.${ATTEMPT_ID}.answers`,
      JSON.stringify({
        q1: { type: "multiple_choice", choice: 0 },
        q2: { type: "unknown_kind", foo: 1 }, // dropped
        q3: { type: "multiple_choice", choice_id: "A" }, // dropped (wrong field name)
      }),
    );
    const loaded = loadAnswers(ATTEMPT_ID);
    expect(loaded.size).toBe(1);
    expect(loaded.get("q1")).toEqual({ type: "multiple_choice", choice: 0 });
  });

  it("loadAnswers tolerates non-JSON garbage", () => {
    localStorage.setItem(`acumen.attempts.${ATTEMPT_ID}.answers`, "<not json>");
    expect(loadAnswers(ATTEMPT_ID).size).toBe(0);
  });

  it("saveAnswers swallows QuotaExceededError", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() =>
      saveAnswers(ATTEMPT_ID, new Map([["q1", { type: "true_false", answer: true }]])),
    ).not.toThrow();
    spy.mockRestore();
  });
});
