/**
 * Question editor form schema — 5-type discriminated union per
 * FE-8 admin-tests §B.3 §4 (`fe-specs/FE-8-admin-tests.md:556–609`).
 *
 * Slice 13 architectural lock B from binding pause #2: the question
 * discriminated union lives in **this file**, NOT nested under
 * `TestEditorFormInput`. The test editor (`test-editor.tsx`) and the
 * question editor modal own separate rhf instances; the modal's form
 * state never touches the test form.
 *
 * Wire packing (Phase 0 §H(a) item 2 LOCKED): `body` + `pill_id` +
 * `is_anchor` are NOT first-class wire fields on `QuestionCreate` /
 * `QuestionUpdate` / `QuestionResponse`. They pack into the `config`
 * object via `compose-question-config.ts` at submit and unpack via
 * `unpack-question-config.ts` at edit-mode prefill. FE owns the
 * per-type contract until the backend types `config` out (deferred
 * v1.x).
 */

import { z } from "zod";

export const QUESTION_TYPES = [
  "multiple_choice",
  "true_false",
  "matching",
  "short_answer",
  "scenario",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

const baseSchema = z.object({
  pill_id: z.string().min(1, "Pick a pill."),
  assigned_difficulty: z
    .number({
      required_error: "Pick a target difficulty.",
      invalid_type_error: "Pick a target difficulty.",
    })
    .int()
    .min(1)
    .max(10),
  body: z
    .string()
    .min(1, "Question body is required.")
    .max(4096, "Question body is too long."),
  is_anchor: z.boolean().default(false),
});

export const mcqChoiceSchema = z.object({
  id: z.string(),
  text: z.string().min(1, "Choice text is required.").max(512),
  correct: z.boolean().default(false),
});

const mcqConfigSchema = z
  .object({
    choices: z.array(mcqChoiceSchema).min(2, "Add at least 2 choices.").max(6),
  })
  .refine((d) => d.choices.filter((c) => c.correct).length === 1, {
    path: ["choices"],
    message: "Mark exactly one choice as correct.",
  });

const tfConfigSchema = z.object({
  correct: z.boolean(),
});

const matchPairSchema = z.object({
  left: z.string().min(1, "Left side required.").max(512),
  right: z.string().min(1, "Right side required.").max(512),
});

const matchConfigSchema = z.object({
  pairs: z.array(matchPairSchema).min(2, "Add at least 2 pairs.").max(8),
});

const rubricConfigSchema = z.object({
  rubric: z
    .string()
    .min(1, "AI grading rubric is required for this question type.")
    .max(4096, "Rubric is too long."),
});

export const questionSchema = z.discriminatedUnion("type", [
  baseSchema.extend({
    type: z.literal("multiple_choice"),
    config: mcqConfigSchema,
  }),
  baseSchema.extend({
    type: z.literal("true_false"),
    config: tfConfigSchema,
  }),
  baseSchema.extend({
    type: z.literal("matching"),
    config: matchConfigSchema,
  }),
  baseSchema.extend({
    type: z.literal("short_answer"),
    config: rubricConfigSchema,
  }),
  baseSchema.extend({
    type: z.literal("scenario"),
    config: rubricConfigSchema,
  }),
]);

export type QuestionFormInput = z.infer<typeof questionSchema>;
export type MCQChoice = z.infer<typeof mcqChoiceSchema>;
export type MatchPair = z.infer<typeof matchPairSchema>;

/** Default form values per type — used when the type chooser flips. */
export function defaultsForType(type: QuestionType): QuestionFormInput {
  const base = {
    pill_id: "",
    assigned_difficulty: 5,
    body: "",
    is_anchor: false,
  };
  switch (type) {
    case "multiple_choice":
      return {
        ...base,
        type: "multiple_choice",
        config: {
          choices: [
            { id: "A", text: "", correct: false },
            { id: "B", text: "", correct: false },
          ],
        },
      };
    case "true_false":
      return { ...base, type: "true_false", config: { correct: true } };
    case "matching":
      return {
        ...base,
        type: "matching",
        config: {
          pairs: [
            { left: "", right: "" },
            { left: "", right: "" },
          ],
        },
      };
    case "short_answer":
      return { ...base, type: "short_answer", config: { rubric: "" } };
    case "scenario":
      return { ...base, type: "scenario", config: { rubric: "" } };
  }
}

/** A→F id helper for MCQ choices. */
export function mcqChoiceId(index: number): string {
  return String.fromCharCode("A".charCodeAt(0) + index);
}
