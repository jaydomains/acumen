"use client";

/**
 * QuestionEditorInner — the discriminated-union form root per FE-8
 * admin-tests §B.3 (`fe-specs/FE-8-admin-tests.md:532`). Slice 13.
 *
 * Owns its own rhf instance separate from `TestEditor`'s form per
 * binding-pause #2 architectural lock A: the modal closes via its own
 * confirm flow; question state never leaks into `TestEditorFormInput`.
 *
 * Type chooser dispatches to one of four per-type subcomponents
 * (`MCQChoices` / `TFChoices` / `MatchPairs` / `SAGradingRubric` —
 * the rubric variant serves both `short_answer` and `scenario` per
 * design line 712).
 *
 * Submit composes the wire body via `compose-question-config.ts`
 * (Phase 0 §H(a) item 2 LOCKED FE-owned typing).
 */

import { useEffect, useMemo, useRef } from "react";
import {
  Controller,
  useForm,
  type SubmitHandler,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { applyApiErrorToForm } from "@/lib/api/form-errors";
import { Field, FieldRow, FieldError } from "@/components/admin/field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  defaultsForType,
  questionSchema,
  type QuestionFormInput,
  type QuestionType,
} from "@/lib/tests/question-form";
import {
  composeQuestionCreate,
  composeQuestionUpdate,
} from "@/lib/tests/compose-question-config";
import { unpackQuestionConfig } from "@/lib/tests/unpack-question-config";
import {
  useCreateQuestion,
  useUpdateQuestion,
  type QuestionResponse,
} from "@/lib/queries/admin-questions";
import { flattenPills, useAdminPills } from "@/lib/queries/admin-pills";
import { DifficultyPicker } from "./difficulty-picker";
import { QuestionTypeChooser } from "./question-type-chooser";
import { MCQChoices } from "./mcq-choices";
import { TFChoices } from "./tf-choices";
import { MatchPairs } from "./match-pairs";
import { SAGradingRubric } from "./sa-grading-rubric";

export type QuestionEditorInnerProps = {
  testId: string;
  /** When set, modal is in edit mode and the form prefills from this question. */
  question: QuestionResponse | null;
  /** Drives the type chooser disabled state (true in edit mode). */
  editMode: boolean;
  /** Called after a successful save with the saved response (or null on no-op). */
  onSaved: (saved: QuestionResponse | null) => void;
  /** Called when the form's dirty state changes; modal uses for cancel-confirm. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Imperative submit handle for the modal's ModalActions buttons. */
  submitRef?: React.MutableRefObject<(() => Promise<void>) | null>;
};

const SHARED_DEFAULTS: QuestionFormInput = defaultsForType("multiple_choice");

export function QuestionEditorInner({
  testId,
  question,
  editMode,
  onSaved,
  onDirtyChange,
  submitRef,
}: QuestionEditorInnerProps) {
  const initial = useMemo<QuestionFormInput>(
    () => (question ? unpackQuestionConfig(question) : SHARED_DEFAULTS),
    [question],
  );

  const form = useForm<QuestionFormInput>({
    resolver: zodResolver(questionSchema),
    mode: "onSubmit",
    defaultValues: initial,
  });

  // Slice 12 absorbed precedent: destructure at render top so rhf's
  // Proxy subscription fires on isDirty changes.
  const { isDirty } = form.formState;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Re-prefill only on question-id change, not on every parent rerender.
  const hydratedRef = useRef<string | null>(null);
  useEffect(() => {
    const key = question?.id ?? "new";
    if (hydratedRef.current === key) return;
    form.reset(initial);
    hydratedRef.current = key;
  }, [question, initial, form]);

  const pillsQuery = useAdminPills();
  const pills = useMemo(() => flattenPills(pillsQuery.data), [pillsQuery.data]);

  const createMutation = useCreateQuestion(testId);
  const updateMutation = useUpdateQuestion(testId);
  const submitting = createMutation.isPending || updateMutation.isPending;

  const type = form.watch("type") as QuestionType;

  const handleTypeChange = (next: QuestionType) => {
    if (editMode) return;
    if (next === type) return;
    // Swap the form to a fresh defaults block for the new type, but
    // preserve the shared base fields the admin already entered.
    const current = form.getValues();
    const fresh = defaultsForType(next);
    form.reset({
      ...fresh,
      pill_id: current.pill_id,
      assigned_difficulty: current.assigned_difficulty,
      body: current.body,
      is_anchor: current.is_anchor,
    });
  };

  const submit = useMemo(() => {
    const onSubmit: SubmitHandler<QuestionFormInput> = async (values) => {
      try {
        if (question) {
          const body = composeQuestionUpdate(values);
          const saved = await updateMutation.mutateAsync({
            questionId: question.id,
            body,
          });
          toast("Question saved");
          onSaved(saved);
          return;
        }
        const body = composeQuestionCreate(values);
        const saved = await createMutation.mutateAsync(body);
        toast("Question saved");
        onSaved(saved);
      } catch (err) {
        applyApiErrorToForm(err, form);
        if (err instanceof ApiError && err.code !== "validation_error") {
          toast.error(err.message);
        }
      }
    };
    return form.handleSubmit(onSubmit);
  }, [form, question, createMutation, updateMutation, onSaved]);

  useEffect(() => {
    if (submitRef) submitRef.current = submit;
    return () => {
      if (submitRef) submitRef.current = null;
    };
  }, [submit, submitRef]);

  const errors = form.formState.errors;

  return (
    <form
      id="question-editor-form"
      onSubmit={submit}
      noValidate
      data-testid="question-editor-form"
      className="space-y-4"
    >
      <Field
        label="Type"
        {...(editMode ? { hint: "Type is immutable after the first save." } : {})}
        error={(errors.type as { message?: string } | undefined)?.message ?? null}
        locked={editMode}
      >
        <QuestionTypeChooser
          value={type}
          onChange={handleTypeChange}
          locked={editMode || submitting}
        />
      </Field>

      <FieldRow cols="1fr 1fr">
        <Field
          label="Pill"
          error={errors.pill_id?.message ?? null}
          hint="The pill this question draws from."
        >
          <select
            {...form.register("pill_id")}
            disabled={submitting}
            data-testid="question-pill-select"
            className={cn(
              "h-10 w-full border border-line bg-bg-raised px-3 text-[13px]",
              "focus:outline-none focus:ring-2 focus:ring-accent",
              submitting && "opacity-60 cursor-not-allowed",
            )}
          >
            <option value="">Select a pill…</option>
            {pills.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Target difficulty"
          error={errors.assigned_difficulty?.message ?? null}
        >
          <Controller
            control={form.control}
            name="assigned_difficulty"
            render={({ field }) => (
              <DifficultyPicker
                value={field.value ?? null}
                onChange={field.onChange}
                disabled={submitting}
                testIdPrefix="question-difficulty"
              />
            )}
          />
        </Field>
      </FieldRow>

      <Field
        label="Question body"
        error={errors.body?.message ?? null}
        hint="Plain text. Up to 4096 characters."
      >
        <Textarea
          {...form.register("body")}
          rows={4}
          disabled={submitting}
          data-testid="question-body"
        />
      </Field>

      <label className="flex items-center gap-2 text-[13px] text-ink-2">
        <input
          type="checkbox"
          {...form.register("is_anchor")}
          disabled={submitting}
          data-testid="question-anchor"
        />
        Anchor question — counts for cohort calibration.
      </label>

      <Field label={typeLabel(type)} error={null}>
        <TypeSubcomponent form={form} type={type} disabled={submitting} />
      </Field>

      {errors.root?.message ? <FieldError msg={errors.root.message} /> : null}
    </form>
  );
}

function typeLabel(t: QuestionType): string {
  switch (t) {
    case "multiple_choice":
      return "Choices";
    case "true_false":
      return "Correct answer";
    case "matching":
      return "Pairs";
    case "short_answer":
      return "Grading rubric";
    case "scenario":
      return "Grading rubric";
  }
}

type SubcomponentProps = {
  form: UseFormReturn<QuestionFormInput>;
  type: QuestionType;
  disabled: boolean;
};

function TypeSubcomponent({ form, type, disabled }: SubcomponentProps) {
  const errors = form.formState.errors as Record<string, unknown>;
  switch (type) {
    case "multiple_choice": {
      const cfg = errors.config as
        | {
            choices?: {
              message?: string;
              root?: { message?: string };
            } & Array<{ text?: { message?: string } }>;
          }
        | undefined;
      // rhf v7 stores array-level errors at `.root.message`; zod refines
      // on the array land there. Older rhf paths used `.message` directly
      // — read both for robustness.
      const rootMsg = cfg?.choices?.root?.message ?? cfg?.choices?.message;
      return (
        <MCQChoices
          control={form.control}
          register={form.register}
          getValues={form.getValues}
          disabled={disabled}
          error={typeof rootMsg === "string" ? rootMsg : null}
          perRowError={(i) =>
            cfg?.choices?.[i]?.text?.message ? String(cfg.choices[i].text!.message) : null
          }
        />
      );
    }
    case "true_false":
      return <TFChoices control={form.control} disabled={disabled} />;
    case "matching": {
      const cfg = errors.config as
        | {
            pairs?: {
              message?: string;
              root?: { message?: string };
            } & Array<{
              left?: { message?: string };
              right?: { message?: string };
            }>;
          }
        | undefined;
      const rootMsg = cfg?.pairs?.root?.message ?? cfg?.pairs?.message;
      return (
        <MatchPairs
          control={form.control}
          register={form.register}
          disabled={disabled}
          error={typeof rootMsg === "string" ? rootMsg : null}
          perRowError={(i, side) => {
            const row = cfg?.pairs?.[i];
            const msg = side === "left" ? row?.left?.message : row?.right?.message;
            return typeof msg === "string" ? msg : null;
          }}
        />
      );
    }
    case "short_answer":
    case "scenario": {
      const cfg = errors.config as { rubric?: { message?: string } } | undefined;
      return (
        <SAGradingRubric
          register={form.register}
          disabled={disabled}
          error={cfg?.rubric?.message ?? null}
        />
      );
    }
  }
}
