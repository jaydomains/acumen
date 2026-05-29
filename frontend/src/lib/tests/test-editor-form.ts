/**
 * Test-editor form schema (FE-8 admin-tests §B.2 §4).
 *
 * Slice 12 drift Finding #5: spec body nests a `per_testee` sub-object
 * for clarity, but `TestCreate` / `TestUpdate` are flat — `pill_id` +
 * `target_difficulty` live at the top of the wire body. The form
 * schema below mirrors the wire (flat) so submit composes a body
 * directly rather than threading a nested-to-flat mapper.
 *
 * Slice 12 drift Finding #3 / #10: `description` is NOT a wire field
 * on `TestCreate`/`TestUpdate`/`TestResponse`. It used to appear in
 * the spec body and the prototype but was struck from the wire by
 * Phase 0 corrections. We drop the field rather than carry phantom
 * state.
 *
 * Slice 12 drift Finding #5 (continued): `question_count_target` is
 * absent from the wire — the per_testee sampler picks a count at
 * attempt-start. The field is dropped from the schema; admins can
 * influence count by `duration_minutes` only.
 */

import { z } from "zod";

export const TEST_MODES = ["per_testee", "frozen", "hand_authored", "benchmark"] as const;

const optionalIntInRange = (min: number, max: number) =>
  z.number().int().min(min).max(max).nullable().optional();

export const testEditorSchema = z
  .object({
    name: z.string().min(1, "Title is required.").max(255),
    mode: z.enum(TEST_MODES),
    timed: z.boolean().default(true),
    duration_minutes: z.number().int().positive().nullable().optional(),
    pass_threshold: z.number().min(0).max(1).nullable().optional(),
    target_difficulty: optionalIntInRange(1, 10),
    pill_id: z.string().min(1).nullable().optional(),
    randomise_question_order: z.boolean().default(false),
    randomise_option_order: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "per_testee") {
      if (!data.pill_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pill_id"],
          message: "Pick a pill.",
        });
      }
      if (data.target_difficulty == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["target_difficulty"],
          message: "Pick a target difficulty.",
        });
      }
    }
  });

export type TestEditorFormInput = z.infer<typeof testEditorSchema>;
