"use client";

/**
 * SubmitConfirmModal (FE-4 §B.1 §2, AC-D19 copy).
 *
 * shadcn `AlertDialog`. Frozen + benchmark share the component and
 * branch on `mode` for the eyebrow / body copy:
 *   - frozen: "Submit attempt" + "...AI-graded responses run through
 *     OpenAI cross-family review before your result is shown —
 *     usually 3–6 seconds." (AC-D19)
 *   - benchmark: "Submit benchmark" + "Benchmarks can't be re-taken
 *     — once submitted, your result is locked into the SiteMesh
 *     Annual Competency record."
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type SubmitMode = "frozen" | "benchmark";

export type SubmitConfirmModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: SubmitMode;
  answeredCount: number;
  totalCount: number;
  onConfirm: () => void;
  submitting: boolean;
};

export function SubmitConfirmModal({
  open,
  onOpenChange,
  mode,
  answeredCount,
  totalCount,
  onConfirm,
  submitting,
}: SubmitConfirmModalProps) {
  const eyebrow = mode === "benchmark" ? "Submit benchmark" : "Submit attempt";
  const title =
    mode === "benchmark" ? "Lock in your benchmark." : "Ready to hand this in?";
  const bodyTail =
    mode === "benchmark"
      ? "Benchmarks can't be re-taken — once submitted, your result is locked into the SiteMesh Annual Competency record."
      : "Once submitted, your AI-graded responses run through OpenAI cross-family review before your result is shown — usually 3–6 seconds.";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="submit-confirm-modal" data-mode={mode}>
        <AlertDialogHeader>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
            {eyebrow}
          </span>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {`You've answered ${answeredCount} of ${totalCount} questions. `}
            {bodyTail}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="submit-confirm-cancel" disabled={submitting}>
            Keep going
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="submit-confirm-action"
            disabled={submitting}
            onClick={(e) => {
              // AlertDialogAction defaults to closing on click; the
              // page wires the actual submit through `onConfirm` and
              // controls the open state itself so the modal stays up
              // through the brief mutation window.
              e.preventDefault();
              onConfirm();
            }}
          >
            {submitting ? "Submitting…" : "Submit →"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
