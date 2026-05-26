/**
 * Project ApiError onto a react-hook-form (FE-1 spec §C.2, AC-CD20).
 *
 * Two error shapes reach the client:
 *  1. FastAPI 422 — body `{detail: [{loc, msg, type}, ...]}`. Mapped
 *     field-by-field; `loc[1]` (or the last string segment) is the
 *     field name. Unknown fields fall through to `opts.fieldMap`, then
 *     to "root".
 *  2. AC-CD6 envelope — `{error: {code, message, detail}}`. Caller
 *     supplies `opts.fieldMap[code]` to route a business code at a
 *     specific field; otherwise the message lands on "root".
 *
 * Non-ApiError values (network failures) → generic "root" banner.
 */

import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { ApiError } from "@/lib/api/errors";

type FastApiValidationItem = {
  loc: (string | number)[];
  msg: string;
  type: string;
};

const isValidationItem = (v: unknown): v is FastApiValidationItem => {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    Array.isArray(o.loc) && typeof o.msg === "string" && typeof o.type === "string"
  );
};

const extractValidationItems = (
  detail: unknown,
): FastApiValidationItem[] | null => {
  // FastAPI 422 body is `{detail: [...]}`. apiErrorFromBody stores the
  // whole body in err.detail when the AC-CD6 envelope isn't present, so
  // the array is nested one level.
  if (Array.isArray(detail) && detail.every(isValidationItem)) {
    return detail;
  }
  if (detail && typeof detail === "object" && "detail" in detail) {
    const inner = (detail as { detail: unknown }).detail;
    if (Array.isArray(inner) && inner.every(isValidationItem)) {
      return inner;
    }
  }
  return null;
};

const fieldFromLoc = (loc: (string | number)[]): string => {
  // FastAPI prefixes with "body" / "query" / "path"; the field name is
  // the remaining string segment(s) joined with dots.
  const fields = loc.filter(
    (p): p is string =>
      typeof p === "string" && p !== "body" && p !== "query" && p !== "path",
  );
  if (fields.length > 0) return fields.join(".");
  const last = loc[loc.length - 1];
  return last === undefined ? "" : String(last);
};

export type ApplyApiErrorOpts<T extends FieldValues> = {
  fieldMap?: Record<string, Path<T> | "root">;
};

export function applyApiErrorToForm<T extends FieldValues>(
  err: unknown,
  form: UseFormReturn<T>,
  opts?: ApplyApiErrorOpts<T>,
): void {
  const fieldMap = opts?.fieldMap ?? {};

  if (!(err instanceof ApiError)) {
    form.setError("root", {
      type: "network",
      message: "Could not reach the server. Please try again.",
    });
    return;
  }

  if (err.status === 422) {
    const items = extractValidationItems(err.detail);
    if (items && items.length > 0) {
      for (const item of items) {
        const rawField = fieldFromLoc(item.loc);
        const target = fieldMap[rawField] ?? rawField;
        form.setError(target as Path<T>, { type: "server", message: item.msg });
      }
      return;
    }
  }

  const target = fieldMap[err.code] ?? "root";
  form.setError(target as Path<T>, { type: "server", message: err.message });
}

export function extractRootMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Something went wrong. Please try again.";
}
