import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Auth form field (FE-1 §C.1). Label + Input + error/hint slots; the
 * input gets `aria-invalid` + `aria-describedby` wired to the error
 * paragraph so screen readers announce validation failures.
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
    return (
      <div className="space-y-1.5">
        <Label htmlFor={inputId}>{label}</Label>
        <Input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={className}
          {...inputProps}
        />
        {error ? (
          <p id={errorId} role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-sm text-gray-500">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
AuthField.displayName = "AuthField";
