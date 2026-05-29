"use client";

/**
 * OverrideDrawer — the "Apply override" Sheet for a flagged grade review
 * (FE-9 admin-ops §B.2 §2/§4/§5). Three resolution paths:
 *   - "Keep AI grade"          → POST {action: 'keep_ai'}
 *   - "Accept reviewer's verdict" → POST {action: 'accept_reviewer'} (zeroes the Grade per AC-D19 v1.6)
 *   - 4 verdict tiles + optional reason → POST {action: 'substitute', score, verdict, reasoning}
 *
 * The two bare actions are immediate mutations; substitute uses rhf +
 * zod. The "Apply override" button stays clickable with no tile selected
 * so the documented AC (clicking it surfaces a root error, no network)
 * holds — selection is validated on submit rather than gated by `disabled`.
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { applyApiErrorToForm } from "@/lib/api/form-errors";
import { Sheet, SheetBody, SheetFooter, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/admin/field";
import { VerdictTile } from "@/components/admin/verdict-tile";
import {
  useResolveGradeReview,
  type FlaggedGradeReviewItem,
  type GradeReviewResolveRequest,
  type GradeReviewResolveResult,
} from "@/lib/queries/admin-grade-reviews";

/** Locked (score, verdict) payloads for the four substitute tiles (§B.2). */
const TILES: Array<{
  label: string;
  score: number;
  verdict: "full" | "partial" | "none";
}> = [
  { label: "Full", score: 1, verdict: "full" },
  { label: "Partial", score: 0.6, verdict: "partial" },
  { label: "Partial", score: 0.4, verdict: "partial" },
  { label: "None", score: 0, verdict: "none" },
];

// Validation is co-located in the schema: a tile must be picked before
// submit. `superRefine` surfaces the rule as an error on the verdict
// (tile-group) path, so the handler stays purely about dispatching.
const substituteSchema = z
  .object({
    score: z.number().min(0).max(1).optional(),
    verdict: z.enum(["full", "partial", "none"]).optional(),
    reasoning: z.string().max(2000).optional().default(""),
  })
  .superRefine((val, ctx) => {
    if (val.score === undefined || val.verdict === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pick a verdict to substitute",
        path: ["verdict"],
      });
    }
  });
type SubstituteInput = z.infer<typeof substituteSchema>;

function successMessage(result: GradeReviewResolveResult): string {
  if (result.action === "accept_reviewer") {
    return `Reviewer verdict accepted · score updated to ${result.grade_score.toFixed(1)}`;
  }
  if (result.action === "substitute") {
    const overall =
      result.attempt_overall_score != null
        ? result.attempt_overall_score.toFixed(2)
        : "—";
    return `Override applied · attempt score recomputed to ${overall}`;
  }
  return "Override applied";
}

export function OverrideDrawer({
  review,
  onResolved,
  onClose,
}: {
  review: FlaggedGradeReviewItem;
  /** Called after a successful (or already-resolved) outcome — clears ?selected + closes. */
  onResolved: () => void;
  onClose: () => void;
}) {
  const mutation = useResolveGradeReview();
  const form = useForm<SubstituteInput>({
    resolver: zodResolver(substituteSchema),
    mode: "onSubmit",
    defaultValues: { reasoning: "" },
  });

  const selectedScore = form.watch("score");
  const selectedVerdict = form.watch("verdict");

  const handleError = (err: unknown) => {
    // Already-resolved / conflict: the row is gone — surface, refresh, close.
    if (
      err instanceof ApiError &&
      (err.status === 409 || err.code === "REVIEW_ALREADY_RESOLVED")
    ) {
      toast.error(err.message || "This review was already resolved — refreshing list");
      onResolved();
      return;
    }
    // Validation / field errors project onto the form (tile group → root).
    applyApiErrorToForm(err, form);
    if (!(err instanceof ApiError) || err.status !== 422) {
      toast.error(
        err instanceof ApiError ? err.message : "Couldn't apply override — try again",
      );
    }
  };

  const runResolve = async (body: GradeReviewResolveRequest) => {
    try {
      const result = await mutation.mutateAsync({
        reviewId: review.grade_review_id,
        body,
      });
      toast.info(successMessage(result));
      onResolved();
    } catch (err) {
      handleError(err);
    }
  };

  const onSubstitute = form.handleSubmit(async (values) => {
    // The schema's superRefine guarantees both are present once we reach
    // the success path; this narrow is just for the optional output type.
    if (values.score === undefined || values.verdict === undefined) return;
    await runResolve({
      action: "substitute",
      score: values.score,
      verdict: values.verdict,
      reasoning: values.reasoning ? values.reasoning : null,
    });
  });

  const busy = mutation.isPending;

  return (
    <Sheet
      open
      onOpenChange={(o) => (o ? null : onClose())}
      ariaTitle="Apply override"
      ariaDescription={`Resolve the flagged grade review for ${review.testee_name} · ${review.pill_name}.`}
      width={520}
    >
      <SheetHeader eyebrow="Apply override">
        {review.testee_name} · <span className="serif-it">{review.pill_name}</span>
      </SheetHeader>
      <SheetBody>
        {/* Two bare actions */}
        <div className="mb-5 flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => runResolve({ action: "keep_ai" })}
            data-testid="override-keep-ai"
          >
            Keep AI grade
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => runResolve({ action: "accept_reviewer" })}
            data-testid="override-accept-reviewer"
          >
            Accept reviewer&rsquo;s verdict
          </Button>
          <p className="text-ink-3 text-[11.5px]">
            Accepting the reviewer&rsquo;s verdict zeroes this grade (AC-D19).
          </p>
        </div>

        {/* Substitute */}
        <form onSubmit={onSubstitute} noValidate data-testid="override-substitute-form">
          <Field label="Substitute a verdict" error={null}>
            <div
              className="grid grid-cols-4 gap-2"
              role="radiogroup"
              aria-label="Substitute verdict"
            >
              {TILES.map((tile) => (
                <VerdictTile
                  key={`${tile.verdict}-${tile.score}`}
                  label={tile.label}
                  score={tile.score}
                  selected={
                    selectedScore === tile.score && selectedVerdict === tile.verdict
                  }
                  disabled={busy}
                  onSelect={() => {
                    form.setValue("score", tile.score, { shouldValidate: false });
                    form.setValue("verdict", tile.verdict, { shouldValidate: false });
                    form.clearErrors("verdict");
                  }}
                />
              ))}
            </div>
          </Field>
          {(form.formState.errors.verdict?.message ??
          form.formState.errors.root?.message) ? (
            <FieldError
              msg={
                (form.formState.errors.verdict?.message ??
                  form.formState.errors.root?.message)!
              }
            />
          ) : null}
          <Field label="Reason — visible to testee — optional" error={null}>
            <textarea
              {...form.register("reasoning")}
              rows={3}
              disabled={busy}
              data-testid="override-reason"
              className="w-full border border-line bg-bg-raised px-3 py-2 text-[13px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </Field>
        </form>
      </SheetBody>
      <SheetFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onSubstitute}
          disabled={busy}
          data-testid="override-apply"
        >
          {busy ? "Applying…" : "Apply override"}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
