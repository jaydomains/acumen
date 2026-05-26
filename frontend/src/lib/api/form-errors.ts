/**
 * Project ApiError onto a react-hook-form (FE-1 spec §C.2, AC-CD20).
 *
 * Two error shapes reach the client:
 *  1. FastAPI 422 — body `{detail: [{loc, msg, type}, ...]}`. Mapped
 *     field-by-field; the `loc` array's first segment is FastAPI's
 *     section tag ("body"/"query"/"path") and is stripped. Remaining
 *     segments (including numeric indices for array fields) are joined
 *     with dots to produce the RHF field path (e.g. `items.0.email`).
 *     A `loc` that only carries the section tag falls through to
 *     `root`. Unknown fields can be remapped via `opts.fieldMap`.
 *  2. AC-CD6 envelope — `{error: {code, message, detail}}`. Caller
 *     supplies `opts.fieldMap[code]` to route a business code at a
 *     specific field; otherwise the message lands on `root`.
 *
 * Non-ApiError values (network failures) → generic `root` banner.
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
  return Array.isArray(o.loc) && typeof o.msg === "string" && typeof o.type === "string";
};

const extractValidationItems = (detail: unknown): FastApiValidationItem[] | null => {
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

/**
 * Convert a FastAPI loc array into an RHF field path, preserving
 * numeric indices for array fields. Returns null when only the
 * section tag is present (e.g. `["body"]`) so the caller can fall
 * through to the root error.
 */
const fieldFromLoc = (loc: (string | number)[]): string | null => {
  const first = loc[0];
  const start = first === "body" || first === "query" || first === "path" ? 1 : 0;
  const segments = loc.slice(start);
  if (segments.length === 0) return null;
  return segments.map(String).join(".");
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
        if (rawField === null) {
          form.setError("root", { type: "server", message: item.msg });
          continue;
        }
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
