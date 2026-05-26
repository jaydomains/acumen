import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Auth submit button (FE-1 §C.1). Three-mode visual: idle (default
 * label + arrow glyph), submitting (pulse-dot + busy label, disabled),
 * success (transient "Done" label rendered until the post-submit
 * redirect fires).
 */

export type SubmitButtonState = "idle" | "submitting" | "success";

export type SubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  state?: SubmitButtonState;
  idleLabel?: string;
  submittingLabel?: string;
  successLabel?: string;
};

export const SubmitButton = forwardRef<HTMLButtonElement, SubmitButtonProps>(
  (
    {
      state = "idle",
      idleLabel = "Submit",
      submittingLabel = "Submitting…",
      successLabel = "Done",
      disabled,
      className,
      ...rest
    },
    ref,
  ) => {
    const isSubmitting = state === "submitting";
    const isSuccess = state === "success";
    return (
      <Button
        ref={ref}
        type="submit"
        disabled={disabled || isSubmitting}
        aria-busy={isSubmitting || undefined}
        className={cn("gap-2", className)}
        {...rest}
      >
        {isSubmitting ? (
          <>
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 animate-pulse rounded-full bg-current"
            />
            {submittingLabel}
          </>
        ) : isSuccess ? (
          successLabel
        ) : (
          idleLabel
        )}
      </Button>
    );
  },
);
SubmitButton.displayName = "SubmitButton";
