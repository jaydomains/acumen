"use client";

/**
 * PillModal — create + edit variants of the pill authoring modal per
 * FE-8 catalogue §B.2 (`fe-specs/FE-8-admin-catalogue.md:196–423`).
 *
 * Variants shipped:
 *   - create (empty form)
 *   - edit   (pre-filled; `subject_id` read-only — it's absent from
 *            `PillUpdate` on the wire, so the field is immutable)
 *   - submitting / errors (rendered inline; not separate variants)
 *
 * Locked-mode (5th variant in spec title) is deferred to v1.x under
 * §E pattern (Slice 3 drift Finding #4) — `PillResponse` carries no
 * `used_in_count`, so there's no signal for the locked-banner trigger.
 * §E.8 already locks the list "Used in" column as em-dash placeholder;
 * the locked-modal trigger inherits the same v1.x deferral.
 *
 * Safety toggle uses the dedicated `PATCH /v1/pills/{id}/safety`
 * endpoint per Slice 3 drift Finding #1 — `PillCreate` and `PillUpdate`
 * both `additionalProperties: false` and neither carries
 * `safety_relevant`. Submit chains: (1) create/update the core fields,
 * then (2) if the safety toggle differs from the persisted value,
 * fire `useSetPillSafety` against the resulting pill id.
 *
 * Description max length is the spec's 2048 (`fe-specs/FE-8-admin-
 * catalogue.md:243`) — backend allows 4096 but FE-stricter is the
 * standing convention. `estimated_minutes` is dropped — design
 * prototype doesn't surface it (drift Finding #8).
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { applyApiErrorToForm } from "@/lib/api/form-errors";
import { Modal, ModalActions, ModalHeader } from "@/components/admin/modal";
import { Field, FieldError } from "@/components/admin/field";
import { SafetyToggle } from "@/components/admin/safety-toggle";
import { DifficultyRangeSlider } from "@/components/admin/difficulty-range-slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useCreatePill,
  useSetPillSafety,
  useUpdatePill,
  type PillCreate,
  type PillResponse,
  type PillUpdate,
} from "@/lib/queries/admin-pills";
import type { SubjectResponse } from "@/lib/queries/admin-subjects";

const pillFormSchema = z
  .object({
    name: z.string().min(1, "Title is required.").max(255),
    description: z.string().max(2048).optional().default(""),
    subject_id: z.string().uuid({ message: "Pick a subject." }),
    discoverable: z.boolean().default(true),
    available_difficulty_min: z.number().int().min(1).max(10),
    available_difficulty_max: z.number().int().min(1).max(10),
    safety_relevant: z.boolean().default(false),
  })
  .refine((d) => d.available_difficulty_min <= d.available_difficulty_max, {
    path: ["available_difficulty_max"],
    message: "Max difficulty must be ≥ min.",
  });

type PillFormInput = z.infer<typeof pillFormSchema>;

export type PillModalProps = {
  mode: "create" | "edit";
  pill: PillResponse | null;
  subjects: SubjectResponse[];
  onClose: () => void;
};

export function PillModal({ mode, pill, subjects, onClose }: PillModalProps) {
  const isEdit = mode === "edit";
  const form = useForm<PillFormInput>({
    resolver: zodResolver(pillFormSchema),
    mode: "onSubmit",
    defaultValues: {
      name: pill?.name ?? "",
      description: pill?.description ?? "",
      // `subject_id` is the empty string on create so zod surfaces
      // "Pick a subject." instead of a vague uuid error.
      subject_id: pill?.subject_id ?? "",
      discoverable: pill?.discoverable ?? true,
      available_difficulty_min: pill?.available_difficulty_min ?? 1,
      available_difficulty_max: pill?.available_difficulty_max ?? 10,
      safety_relevant: pill?.safety_relevant ?? false,
    },
  });

  const createMutation = useCreatePill();
  const updateMutation = useUpdatePill();
  const safetyMutation = useSetPillSafety();
  const submitting =
    createMutation.isPending || updateMutation.isPending || safetyMutation.isPending;

  // Track the safety toggle externally because rhf treats boolean
  // fields registered via `register` as string-coerced — easier to
  // bind the toggle to a normal useState mirror and write back to
  // the form on submit.
  const [safetyOn, setSafetyOn] = useState(pill?.safety_relevant ?? false);
  const [difficulty, setDifficulty] = useState({
    min: pill?.available_difficulty_min ?? 1,
    max: pill?.available_difficulty_max ?? 10,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    // Sync the controlled toggles back into the form values so zod
    // validates against the latest pick.
    const effective: PillFormInput = {
      ...values,
      safety_relevant: safetyOn,
      available_difficulty_min: difficulty.min,
      available_difficulty_max: difficulty.max,
    };
    try {
      if (isEdit && pill) {
        // Build a changed-fields-only PillUpdate by comparing against
        // the persisted pill — spec §B.2 §7 wants dirty-only PATCHes
        // to avoid spurious audit log entries. We compare values
        // directly rather than leaning on `formState.dirtyFields`
        // because rhf's dirty-tracking is unreliable under
        // controlled inputs + jsdom user-event flows.
        // `subject_id` and `safety_relevant` are NOT in PillUpdate;
        // they're handled separately.
        const body: PillUpdate = {};
        if (effective.name !== pill.name) body.name = effective.name;
        const nextDesc =
          effective.description?.trim() === "" ? null : (effective.description ?? null);
        if (nextDesc !== pill.description) body.description = nextDesc;
        if (effective.discoverable !== pill.discoverable)
          body.discoverable = effective.discoverable;
        if (difficulty.min !== pill.available_difficulty_min)
          body.available_difficulty_min = difficulty.min;
        if (difficulty.max !== pill.available_difficulty_max)
          body.available_difficulty_max = difficulty.max;

        if (Object.keys(body).length > 0) {
          await updateMutation.mutateAsync({ pillId: pill.id, body });
        }
        if (effective.safety_relevant !== pill.safety_relevant) {
          await safetyMutation.mutateAsync({
            pillId: pill.id,
            safety_relevant: effective.safety_relevant,
          });
        }
        toast("Pill saved");
      } else {
        const createBody: PillCreate = {
          name: effective.name,
          description:
            effective.description?.trim() === "" ? null : effective.description,
          subject_id: effective.subject_id,
          discoverable: effective.discoverable,
          available_difficulty_min: difficulty.min,
          available_difficulty_max: difficulty.max,
        };
        const created = await createMutation.mutateAsync(createBody);
        if (effective.safety_relevant) {
          await safetyMutation.mutateAsync({
            pillId: created.id,
            safety_relevant: true,
          });
        }
        toast("Pill created");
      }
      onClose();
    } catch (err) {
      applyApiErrorToForm(err, form);
    }
  });

  const rootError = form.formState.errors.root?.message;

  return (
    <Modal
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle={isEdit ? "Edit pill" : "Create pill"}
      ariaDescription={
        isEdit
          ? "Edit pill name, description, difficulty range, status, or safety toggle."
          : "Create a new pill by entering name, subject, difficulty range, and safety toggle."
      }
      width={640}
    >
      <ModalHeader
        eyebrow={isEdit ? "Edit pill" : "New pill"}
        title={
          isEdit ? (
            <>
              Edit <span className="serif-it">{pill?.name}</span>
            </>
          ) : (
            <>
              Add a <span className="serif-it">pill</span>
            </>
          )
        }
      />
      <form onSubmit={onSubmit} noValidate data-testid="pill-modal-form">
        <Field label="Title" error={form.formState.errors.name?.message ?? null}>
          <Input
            {...form.register("name")}
            autoFocus={!isEdit}
            disabled={submitting}
            data-testid="pill-modal-name"
          />
        </Field>

        <Field
          label="Description"
          hint="Optional. Up to 2048 characters."
          error={form.formState.errors.description?.message ?? null}
        >
          <Textarea
            {...form.register("description")}
            rows={3}
            disabled={submitting}
            data-testid="pill-modal-description"
          />
        </Field>

        <Field label="Subject" error={form.formState.errors.subject_id?.message ?? null}>
          {isEdit ? (
            <Input
              value={
                subjects.find((s) => s.id === pill?.subject_id)?.name ??
                pill?.subject_id ??
                ""
              }
              readOnly
              disabled
              data-testid="pill-modal-subject-readonly"
            />
          ) : (
            <select
              {...form.register("subject_id")}
              disabled={submitting}
              data-testid="pill-modal-subject"
              className={cn(
                "h-10 w-full border border-line bg-bg-raised px-3 text-[13px]",
                "focus:outline-none focus:ring-2 focus:ring-accent",
              )}
            >
              <option value="">Pick a subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field
          label="Difficulty range"
          hint="Inclusive — pill is available between min and max."
          error={form.formState.errors.available_difficulty_max?.message ?? null}
        >
          <DifficultyRangeSlider
            min={difficulty.min}
            max={difficulty.max}
            onChange={setDifficulty}
            disabled={submitting}
          />
        </Field>

        <Field label="Status" error={form.formState.errors.discoverable?.message ?? null}>
          <select
            value={form.watch("discoverable") ? "published" : "draft"}
            onChange={(e) =>
              form.setValue("discoverable", e.target.value === "published", {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            disabled={submitting}
            data-testid="pill-modal-status"
            className={cn(
              "h-10 w-full border border-line bg-bg-raised px-3 text-[13px]",
              "focus:outline-none focus:ring-2 focus:ring-accent",
            )}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </Field>

        <Field label="Safety">
          <SafetyToggle on={safetyOn} onChange={setSafetyOn} disabled={submitting} />
        </Field>

        {rootError ? <FieldError msg={rootError} /> : null}

        <ModalActions>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} data-testid="pill-modal-submit">
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create pill"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
