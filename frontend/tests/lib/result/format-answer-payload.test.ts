import { describe, expect, it } from "vitest";
import { formatAnswerPayload } from "@/lib/result/format-answer-payload";

describe("formatAnswerPayload", () => {
  it("multiple_choice → Option A / choice label", () => {
    expect(
      formatAnswerPayload(
        "multiple_choice",
        { choice: 0 },
        { mcqLabels: ["Foo", "Bar"] },
      ),
    ).toEqual([{ label: "Option A", text: "Foo" }]);
  });
  it("multiple_choice with no labels falls back to choice index", () => {
    expect(formatAnswerPayload("multiple_choice", { choice: 2 })).toEqual([
      { label: "Option C", text: "choice 2" },
    ]);
  });
  it("multiple_choice with choice === -1 returns null", () => {
    expect(formatAnswerPayload("multiple_choice", { choice: -1 })).toBeNull();
  });
  it("true_false renders Yes/No", () => {
    expect(formatAnswerPayload("true_false", { answer: true })).toEqual([
      { text: "True" },
    ]);
    expect(formatAnswerPayload("true_false", { answer: false })).toEqual([
      { text: "False" },
    ]);
  });
  it("matching pairs render with labels", () => {
    expect(
      formatAnswerPayload(
        "matching",
        { matches: [2, 0, 1] },
        { matchingLeft: ["L1", "L2", "L3"], matchingRight: ["R1", "R2", "R3"] },
      ),
    ).toEqual([
      { label: "L1", text: "R3" },
      { label: "L2", text: "R1" },
      { label: "L3", text: "R2" },
    ]);
  });
  it("matching with unfilled slot renders (unmatched)", () => {
    expect(formatAnswerPayload("matching", { matches: [0, -1, 2] })).toEqual([
      { label: "Item 1", text: "Option A" },
      { label: "Item 2", text: "(unmatched)" },
      { label: "Item 3", text: "Option C" },
    ]);
  });
  it("short_answer empty string → null", () => {
    expect(formatAnswerPayload("short_answer", { text: "  " })).toBeNull();
  });
  it("scenario non-empty → single line", () => {
    expect(formatAnswerPayload("scenario", { text: "my answer" })).toEqual([
      { text: "my answer" },
    ]);
  });
  it("null / undefined payload → null", () => {
    expect(formatAnswerPayload("multiple_choice", null)).toBeNull();
    expect(formatAnswerPayload("scenario", undefined)).toBeNull();
  });
  it("unknown type → null", () => {
    expect(formatAnswerPayload("future_type", { text: "x" })).toBeNull();
  });
});
