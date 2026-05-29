/**
 * Field primitives — Field, FieldRow, FieldError (FE-8 §C.6 in
 * `fe-specs/FE-8-admin-catalogue.md:1205–1207`). Shared across all
 * three FE-8 sibling files. Inline components matching
 * `admin-authoring.jsx:110–144`.
 *
 * Why a separate primitive from FE-1's `AuthField`: AuthField is
 * single-column auth-page-specific; admin Field supports inline
 * `FieldRow` layouts (2-column grid by default) and a `locked`
 * affordance (renders a lock icon next to the label).
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/primitives/Icon";

export type FieldProps = {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string | null;
  locked?: boolean;
  className?: string;
};

export function Field({ label, children, hint, error, locked, className }: FieldProps) {
  return (
    <div className={cn("mb-3.5", className)}>
      <label className="block font-mono text-[10.5px] tracking-[0.12em] uppercase text-ink-3 mb-1.5">
        {label}
        {locked ? (
          <Icon name="lock" size={9} className="inline-block ml-1.5 text-ink-4" />
        ) : null}
      </label>
      {children}
      {error ? <FieldError msg={error} /> : null}
      {hint && !error ? (
        <div className="text-ink-3 text-[11.5px] mt-1.5 leading-[1.5]">{hint}</div>
      ) : null}
    </div>
  );
}

export type FieldRowProps = {
  children: ReactNode;
  cols?: string;
  className?: string;
};

export function FieldRow({ children, cols = "1fr 1fr", className }: FieldRowProps) {
  return (
    <div
      className={cn("grid gap-3.5 mb-3.5", className)}
      style={{ gridTemplateColumns: cols }}
    >
      {children}
    </div>
  );
}

export type FieldErrorProps = { msg: string };

export function FieldError({ msg }: FieldErrorProps) {
  return (
    <div
      role="alert"
      className="flex gap-1.5 items-start mt-1.5 text-[12.5px] text-danger"
    >
      <Icon name="x" size={11} strokeWidth={2} className="mt-0.5 shrink-0" />
      <span>{msg}</span>
    </div>
  );
}
