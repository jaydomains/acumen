import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Auth form field (FE-1 §C.1). Label + Input + error/hint slots.
 *
 * A11y wiring:
 *  - The input carries `aria-invalid` and `aria-describedby` pointing
 *    at whichever of {error, hint} are present (both, if both).
 *  - The error paragraph does NOT carry `role="alert"` — the
 *    describedby announcement when focus enters the invalid input is
 *    sufficient and avoids the double-announce that a live region
 *    plus describedby produces on NVDA/JAWS.
 *  - Hint text persists when an error is shown so users keep the
 *    inline guidance they need to correct the field.
 *
 * Forwards its ref so react-hook-form's `register()` ref-callback
 * lands on the underlying <input>.
 */

export type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
};

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(
  ({ label, error, hint, id, className, ...inputProps }, ref) => {
    const reactId = useId();
    const inputId = id ?? reactId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    const describedBy =
      [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
      undefined;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={inputId}>{label}</Label>
        <Input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={className}
          {...inputProps}
        />
        {error ? (
          <p id={errorId} className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        {hint ? (
          <p id={hintId} className={cn("text-sm text-gray-500", error && "mt-0.5")}>
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
AuthField.displayName = "AuthField";
