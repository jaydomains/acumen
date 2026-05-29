/**
 * compose-question-config + unpack-question-config round-trip per
 * FE-8 admin-tests §D.1 + §H(a) item 2 LOCKED contract.
 *
 * The pair must preserve per-type fields, body, pill_id, and is_anchor
 * across a compose → wire-shape → unpack cycle.
 */

import { describe, expect, it } from "vitest";
import {
  composeQuestionCreate,
  composeQuestionUpdate,
} from "@/lib/tests/compose-question-config";
import { unpackQuestionConfig } from "@/lib/tests/unpack-question-config";
import type { QuestionFormInput } from "@/lib/tests/question-form";
import type { components } from "@/lib/api/types";

type QuestionResponse = components["schemas"]["QuestionResponse"];

// Per-variant constructors — keeping each fixture type-narrowed so the
// discriminated union picks the right config shape.
const mcq = (
  overrides?: Partial<{
    pill_id: string;
    assigned_difficulty: number;
    body: string;
    is_anchor: boolean;
    choices: { id: string; text: string; correct: boolean }[];
  }>,
): QuestionFormInput => ({
  type: "multiple_choice",
  pill_id: overrides?.pill_id ?? "p",
  assigned_difficulty: overrides?.assigned_difficulty ?? 5,
  body: overrides?.body ?? "Body",
  is_anchor: overrides?.is_anchor ?? false,
  config: {
    choices: overrides?.choices ?? [
      { id: "A", text: "First", correct: true },
      { id: "B", text: "Second", correct: false },
    ],
  },
});

const tf = (
  overrides?: Partial<{
    pill_id: string;
    body: string;
    is_anchor: boolean;
    correct: boolean;
  }>,
): QuestionFormInput => ({
  type: "true_false",
  pill_id: overrides?.pill_id ?? "p",
  assigned_difficulty: 5,
  body: overrides?.body ?? "Body",
  is_anchor: overrides?.is_anchor ?? false,
  config: { correct: overrides?.correct ?? true },
});

const match = (
  pairs: { left: string; right: string }[],
  overrides?: Partial<{ pill_id: string; body: string; is_anchor: boolean }>,
): QuestionFormInput => ({
  type: "matching",
  pill_id: overrides?.pill_id ?? "p",
  assigned_difficulty: 5,
  body: overrides?.body ?? "Body",
  is_anchor: overrides?.is_anchor ?? false,
  config: { pairs },
});

const sa = (
  rubric: string,
  overrides?: Partial<{ body: string }>,
): QuestionFormInput => ({
  type: "short_answer",
  pill_id: "p",
  assigned_difficulty: 5,
  body: overrides?.body ?? "Prompt",
  is_anchor: false,
  config: { rubric },
});

const scenario = (
  rubric: string,
  overrides?: Partial<{ body: string }>,
): QuestionFormInput => ({
  type: "scenario",
  pill_id: "p",
  assigned_difficulty: 5,
  body: overrides?.body ?? "Long prompt.",
  is_anchor: false,
  config: { rubric },
});

function toResponse(
  input: QuestionFormInput,
  testId = "ffff5555-ffff-ffff-ffff-000000000003",
  id = "aaaa6666-aaaa-aaaa-aaaa-000000000099",
): QuestionResponse {
  const c = composeQuestionCreate(input);
  return {
    id,
    test_id: testId,
    type: c.type,
    config: c.config as unknown as Record<string, never>,
    assigned_difficulty: c.assigned_difficulty,
    question_group_id: c.question_group_id,
    reference_image_url: null,
    reference_image_caption: null,
    created_at: "2026-05-29T00:00:00Z",
    updated_at: "2026-05-29T00:00:00Z",
  };
}

describe("composeQuestionCreate — packs shared fields into config", () => {
  it("packs body + pill_id + is_anchor into config alongside MCQ choices", () => {
    const out = composeQuestionCreate(
      mcq({
        pill_id: "pill-1",
        assigned_difficulty: 6,
        body: "Which mechanism…?",
        is_anchor: true,
        choices: [
          { id: "A", text: "Galvanic", correct: true },
          { id: "B", text: "Other", correct: false },
        ],
      }),
    );
    expect(out.type).toBe("multiple_choice");
    expect(out.assigned_difficulty).toBe(6);
    expect(out.question_group_id).toBeNull();
    expect(out.config).toMatchObject({
      body: "Which mechanism…?",
      pill_id: "pill-1",
      is_anchor: true,
      choices: [
        { id: "A", text: "Galvanic", correct: true },
        { id: "B", text: "Other", correct: false },
      ],
    });
  });

  it("packs `correct` boolean for true_false", () => {
    const out = composeQuestionCreate(
      tf({ pill_id: "pill-x", body: "ICCP requires DC source.", correct: false }),
    );
    expect(out.config).toMatchObject({
      body: "ICCP requires DC source.",
      pill_id: "pill-x",
      correct: false,
    });
  });

  it("packs `pairs` for matching", () => {
    const out = composeQuestionCreate(
      match(
        [
          { left: "A", right: "1" },
          { left: "B", right: "2" },
        ],
        { body: "Match these." },
      ),
    );
    expect(out.config).toMatchObject({
      pairs: [
        { left: "A", right: "1" },
        { left: "B", right: "2" },
      ],
    });
  });

  it("packs `rubric` for short_answer AND scenario (shared shape per :712)", () => {
    const sah = composeQuestionCreate(
      sa("Reward mentions of A and B.", { body: "Describe X." }),
    );
    const sc = composeQuestionCreate(
      scenario("Reward 3 key points.", { body: "Long prompt." }),
    );
    expect(sah.config).toMatchObject({ rubric: "Reward mentions of A and B." });
    expect(sc.config).toMatchObject({ rubric: "Reward 3 key points." });
  });
});

describe("composeQuestionUpdate — same shape minus `type`", () => {
  it("omits `type` (immutable post-create)", () => {
    const out = composeQuestionUpdate(tf({ body: "edit", correct: true }));
    expect(out).not.toHaveProperty("type");
    expect(out.config).toMatchObject({ body: "edit", correct: true });
  });
});

describe("unpackQuestionConfig — reverse of compose", () => {
  it("round-trips MCQ unchanged", () => {
    const input = mcq({
      pill_id: "pill-1",
      assigned_difficulty: 6,
      body: "Question body",
      is_anchor: true,
      choices: [
        { id: "A", text: "First", correct: true },
        { id: "B", text: "Second", correct: false },
        { id: "C", text: "Third", correct: false },
      ],
    });
    const out = unpackQuestionConfig(toResponse(input));
    expect(out).toEqual(input);
  });

  it("round-trips true_false unchanged", () => {
    const input = tf({ body: "TF body", correct: false });
    const out = unpackQuestionConfig(toResponse(input));
    expect(out).toEqual(input);
  });

  it("round-trips matching unchanged", () => {
    const input = match(
      [
        { left: "L1", right: "R1" },
        { left: "L2", right: "R2" },
        { left: "L3", right: "R3" },
      ],
      { body: "Match" },
    );
    const out = unpackQuestionConfig(toResponse(input));
    expect(out).toEqual(input);
  });

  it("round-trips short_answer + scenario unchanged", () => {
    const sah = sa("Reward A and B.", { body: "Prompt" });
    const sc = scenario("Reward A and B.", { body: "Prompt" });
    expect(unpackQuestionConfig(toResponse(sah))).toEqual(sah);
    expect(unpackQuestionConfig(toResponse(sc))).toEqual(sc);
  });

  it("falls back to defaults when MCQ choices array is malformed", () => {
    const bad: QuestionResponse = {
      id: "x",
      test_id: "t",
      type: "multiple_choice",
      config: { choices: null } as unknown as Record<string, never>,
      assigned_difficulty: 5,
      question_group_id: null,
      reference_image_url: null,
      reference_image_caption: null,
      created_at: "2026-05-29T00:00:00Z",
      updated_at: "2026-05-29T00:00:00Z",
    };
    const out = unpackQuestionConfig(bad);
    expect(out.type).toBe("multiple_choice");
    if (out.type === "multiple_choice") {
      expect(out.config.choices.length).toBe(2);
    }
  });
});
