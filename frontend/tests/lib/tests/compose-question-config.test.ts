/**
 * compose-question-config + unpack-question-config per FE-8 admin-tests
 * §D.1 + §H(a) item 2 (amended 2026-05-31).
 *
 * compose emits the backend-validated wire shape — `prompt` (all types),
 * `options` + `correct:int` (MCQ), `correct:bool` (TF), `pairs` (matching),
 * `rubric` + `model_answer` (SA/scenario) — with `pill_id`/`is_anchor`
 * riding along. unpack is its exact inverse for edit-mode prefill. The
 * golden-fixture block pins the FE-compose→wire shape that the backend
 * `validate_question_config` contract test (`tests/unit/
 * test_question_config_contract.py`) asserts against the SAME fixtures.
 */

import { describe, expect, it } from "vitest";
import {
  composeQuestionCreate,
  composeQuestionUpdate,
} from "@/lib/tests/compose-question-config";
import { unpackQuestionConfig } from "@/lib/tests/unpack-question-config";
import type { QuestionFormInput } from "@/lib/tests/question-form";
import type { components } from "@/lib/api/types";
import mcqGolden from "../../data/question-config/multiple_choice.json";
import tfGolden from "../../data/question-config/true_false.json";
import matchingGolden from "../../data/question-config/matching.json";
import saGolden from "../../data/question-config/short_answer.json";
import scenarioGolden from "../../data/question-config/scenario.json";

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
  modelAnswer: string,
  overrides?: Partial<{ body: string; pill_id: string }>,
): QuestionFormInput => ({
  type: "short_answer",
  pill_id: overrides?.pill_id ?? "p",
  assigned_difficulty: 5,
  body: overrides?.body ?? "Prompt",
  is_anchor: false,
  config: { rubric, model_answer: modelAnswer },
});

const scenario = (
  rubric: string,
  modelAnswer: string,
  overrides?: Partial<{ body: string; pill_id: string }>,
): QuestionFormInput => ({
  type: "scenario",
  pill_id: overrides?.pill_id ?? "p",
  assigned_difficulty: 5,
  body: overrides?.body ?? "Long prompt.",
  is_anchor: false,
  config: { rubric, model_answer: modelAnswer },
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

describe("composeQuestionCreate — emits the backend wire shape", () => {
  it("maps body→prompt and choices→options+correct for MCQ", () => {
    const out = composeQuestionCreate(
      mcq({
        pill_id: "pill-1",
        assigned_difficulty: 6,
        body: "Which mechanism…?",
        is_anchor: true,
        choices: [
          { id: "A", text: "Galvanic", correct: false },
          { id: "B", text: "Impressed", correct: true },
          { id: "C", text: "Coating", correct: false },
        ],
      }),
    );
    expect(out.type).toBe("multiple_choice");
    expect(out.assigned_difficulty).toBe(6);
    expect(out.question_group_id).toBeNull();
    expect(out.config).toEqual({
      prompt: "Which mechanism…?",
      pill_id: "pill-1",
      is_anchor: true,
      options: ["Galvanic", "Impressed", "Coating"],
      correct: 1,
    });
  });

  it("emits `correct` boolean for true_false", () => {
    const out = composeQuestionCreate(
      tf({ pill_id: "pill-x", body: "ICCP requires DC source.", correct: false }),
    );
    expect(out.config).toEqual({
      prompt: "ICCP requires DC source.",
      pill_id: "pill-x",
      is_anchor: false,
      correct: false,
    });
  });

  it("emits `pairs` for matching", () => {
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
      prompt: "Match these.",
      pairs: [
        { left: "A", right: "1" },
        { left: "B", right: "2" },
      ],
    });
  });

  it("emits `rubric` + `model_answer` for short_answer AND scenario", () => {
    const sah = composeQuestionCreate(
      sa("Reward mentions of A and B.", "A and B together.", { body: "Describe X." }),
    );
    const sc = composeQuestionCreate(
      scenario("Reward 3 key points.", "Points one, two, three.", {
        body: "Long prompt.",
      }),
    );
    expect(sah.config).toMatchObject({
      prompt: "Describe X.",
      rubric: "Reward mentions of A and B.",
      model_answer: "A and B together.",
    });
    expect(sc.config).toMatchObject({
      prompt: "Long prompt.",
      rubric: "Reward 3 key points.",
      model_answer: "Points one, two, three.",
    });
  });
});

describe("composeQuestionUpdate — same shape minus `type`", () => {
  it("omits `type` (immutable post-create)", () => {
    const out = composeQuestionUpdate(tf({ body: "edit", correct: true }));
    expect(out).not.toHaveProperty("type");
    expect(out.config).toMatchObject({ prompt: "edit", correct: true });
  });
});

describe("unpackQuestionConfig — exact inverse of compose", () => {
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

  it("round-trips short_answer + scenario (incl. model_answer) unchanged", () => {
    const sah = sa("Reward A and B.", "A then B.", { body: "Prompt" });
    const sc = scenario("Reward A and B.", "A then B.", { body: "Prompt" });
    expect(unpackQuestionConfig(toResponse(sah))).toEqual(sah);
    expect(unpackQuestionConfig(toResponse(sc))).toEqual(sc);
  });

  it("falls back to defaults when MCQ options array is malformed", () => {
    const bad: QuestionResponse = {
      id: "x",
      test_id: "t",
      type: "multiple_choice",
      config: { options: null } as unknown as Record<string, never>,
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

describe("golden fixtures — FE compose matches the backend-validated shape", () => {
  // Each builder produces exactly its golden config; the backend contract
  // test (tests/unit/test_question_config_contract.py) asserts the SAME
  // JSON files pass validate_question_config.
  it("multiple_choice", () => {
    const input = mcq({
      pill_id: "11111111-1111-1111-1111-111111111111",
      body: mcqGolden.prompt,
      is_anchor: false,
      choices: [
        { id: "A", text: "Galvanic anode", correct: false },
        { id: "B", text: "Impressed current", correct: true },
        { id: "C", text: "Barrier coating", correct: false },
      ],
    });
    expect(composeQuestionCreate(input).config).toEqual(mcqGolden);
  });

  it("true_false", () => {
    const input = tf({
      pill_id: "11111111-1111-1111-1111-111111111111",
      body: tfGolden.prompt,
      is_anchor: false,
      correct: true,
    });
    expect(composeQuestionCreate(input).config).toEqual(tfGolden);
  });

  it("matching", () => {
    const input = match(
      [
        { left: "Galvanic anode", right: "Self-powered" },
        { left: "Impressed current", right: "External DC" },
      ],
      { pill_id: "11111111-1111-1111-1111-111111111111", body: matchingGolden.prompt },
    );
    expect(composeQuestionCreate(input).config).toEqual(matchingGolden);
  });

  it("short_answer", () => {
    const input = sa(saGolden.rubric, saGolden.model_answer, {
      body: saGolden.prompt,
      pill_id: "11111111-1111-1111-1111-111111111111",
    });
    expect(composeQuestionCreate(input).config).toEqual(saGolden);
  });

  it("scenario", () => {
    const input = scenario(scenarioGolden.rubric, scenarioGolden.model_answer, {
      body: scenarioGolden.prompt,
      pill_id: "11111111-1111-1111-1111-111111111111",
    });
    expect(composeQuestionCreate(input).config).toEqual(scenarioGolden);
  });
});
