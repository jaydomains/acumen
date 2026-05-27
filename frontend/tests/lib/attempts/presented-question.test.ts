/**
 * Runtime narrowing for AttemptView.questions[] (FE-4 §B.1 §2 + §D.1).
 *
 * The wire schema types questions as `Record<string, never>[]` (untyped
 * dict in Pydantic), so the FE narrows + drops malformed rows. This
 * test pins the contract — a backend-side rename / schema reshape
 * would surface here as a failing test rather than a runtime crash
 * in the runner.
 */

import { describe, expect, it } from "vitest";
import { narrowPresented, narrowPresentedList } from "@/lib/attempts/presented-question";

describe("presented-question · narrowPresented", () => {
  it("MCQ — happy path with option dicts", () => {
    const result = narrowPresented({
      id: "q1",
      type: "multiple_choice",
      question_group_id: null,
      attempt_position: 1,
      reference_image_url: null,
      reference_image_caption: null,
      config: {
        prompt: "Pick one",
        options: [
          { text: "A", image_url: null },
          { text: "B", image_url: "https://x/y.png" },
        ],
      },
    });
    expect(result?.type).toBe("multiple_choice");
    expect(result?.config).toEqual({
      prompt: "Pick one",
      options: [
        { text: "A", image_url: null },
        { text: "B", image_url: "https://x/y.png" },
      ],
    });
  });

  it("MCQ — drops rows with non-object options", () => {
    const result = narrowPresented({
      id: "q1",
      type: "multiple_choice",
      config: { prompt: "p", options: ["bare-string"] },
    });
    expect(result).toBeNull();
  });

  it("true_false / short_answer / scenario carry only prompt + optional expected", () => {
    expect(
      narrowPresented({ id: "q2", type: "true_false", config: { prompt: "Yes?" } }),
    ).toMatchObject({ type: "true_false", config: { prompt: "Yes?" } });

    expect(
      narrowPresented({
        id: "q3",
        type: "short_answer",
        config: { prompt: "Why?", expected_seconds: 30 },
      }),
    ).toMatchObject({
      type: "short_answer",
      config: { prompt: "Why?", expected_seconds: 30 },
    });

    expect(
      narrowPresented({ id: "q4", type: "scenario", config: { prompt: "Walk through" } }),
    ).toMatchObject({ type: "scenario", config: { prompt: "Walk through" } });
  });

  it("matching — requires string[] for both left and right", () => {
    const ok = narrowPresented({
      id: "q5",
      type: "matching",
      config: { prompt: "Match", left: ["a", "b"], right: ["1", "2"] },
    });
    expect(ok?.type).toBe("matching");
    const bad = narrowPresented({
      id: "q5",
      type: "matching",
      config: { prompt: "Match", left: ["a"], right: [1, 2] }, // numbers
    });
    expect(bad).toBeNull();
  });

  it("rejects missing prompt / unknown type / no id", () => {
    expect(narrowPresented({ type: "true_false", config: { prompt: "p" } })).toBeNull();
    expect(
      narrowPresented({ id: "q", type: "unknown_type", config: { prompt: "p" } }),
    ).toBeNull();
    expect(narrowPresented({ id: "q", type: "true_false" })).toBeNull();
  });
});

describe("presented-question · narrowPresentedList drops malformed", () => {
  it("keeps the good entries, drops the bad, logs a warning per dropped", () => {
    const out = narrowPresentedList([
      { id: "q1", type: "true_false", config: { prompt: "ok" } },
      { id: "q2", type: "bad", config: { prompt: "x" } },
      { id: "q3", type: "short_answer", config: { prompt: "ok2" } },
    ]);
    expect(out.map((q) => q.id)).toEqual(["q1", "q3"]);
  });
});
