/**
 * applyApiErrorToForm coverage (FE-1 §C.2). Six base scenarios mirror
 * the two error shapes plus the network fallback; two additional
 * scenarios lock in the loc-array fixes from Slice A code review
 * (numeric indices preserved, top-level body falls through to root).
 *
 * Tests assert on the recorded setError calls rather than RHF's
 * formState proxy — the proxy doesn't surface errors for fields that
 * were never registered (no component rendered the input), which
 * breaks every renderHook-based assertion against unregistered fields.
 */

import { describe, it, expect, vi } from "vitest";
import type { UseFormReturn } from "react-hook-form";
import { applyApiErrorToForm } from "@/lib/api/form-errors";
import { ApiError } from "@/lib/api/errors";

type Fields = { email: string; password: string };

const makeFormStub = () => {
  const setError = vi.fn();
  const form = { setError } as unknown as UseFormReturn<Fields>;
  return { form, setError };
};

describe("applyApiErrorToForm", () => {
  it("maps a single FastAPI 422 detail entry to its field", () => {
    const { form, setError } = makeFormStub();
    const err = new ApiError(422, "unknown", "HTTP 422", {
      detail: [{ loc: ["body", "email"], msg: "Invalid email", type: "value_error" }],
    });
    applyApiErrorToForm(err, form);
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith("email", {
      type: "server",
      message: "Invalid email",
    });
  });

  it("maps multiple FastAPI 422 detail entries field-by-field", () => {
    const { form, setError } = makeFormStub();
    const err = new ApiError(422, "unknown", "HTTP 422", {
      detail: [
        { loc: ["body", "email"], msg: "Invalid email", type: "value_error" },
        { loc: ["body", "password"], msg: "Too short", type: "value_error" },
      ],
    });
    applyApiErrorToForm(err, form);
    expect(setError).toHaveBeenCalledTimes(2);
    expect(setError).toHaveBeenNthCalledWith(1, "email", {
      type: "server",
      message: "Invalid email",
    });
    expect(setError).toHaveBeenNthCalledWith(2, "password", {
      type: "server",
      message: "Too short",
    });
  });

  it("routes an unmapped FastAPI 422 loc via opts.fieldMap", () => {
    const { form, setError } = makeFormStub();
    const err = new ApiError(422, "unknown", "HTTP 422", {
      detail: [
        { loc: ["body", "user_email"], msg: "Invalid email", type: "value_error" },
      ],
    });
    applyApiErrorToForm(err, form, { fieldMap: { user_email: "email" } });
    expect(setError).toHaveBeenCalledWith("email", {
      type: "server",
      message: "Invalid email",
    });
  });

  it("routes an AC-CD6 business code via opts.fieldMap to a specific field", () => {
    const { form, setError } = makeFormStub();
    const err = new ApiError(401, "INVALID_CREDENTIALS", "Wrong password", null);
    applyApiErrorToForm(err, form, {
      fieldMap: { INVALID_CREDENTIALS: "password" },
    });
    expect(setError).toHaveBeenCalledWith("password", {
      type: "server",
      message: "Wrong password",
    });
  });

  it("falls back to root when an AC-CD6 code has no fieldMap entry", () => {
    const { form, setError } = makeFormStub();
    const err = new ApiError(423, "LOCKED", "Account locked", null);
    applyApiErrorToForm(err, form);
    expect(setError).toHaveBeenCalledWith("root", {
      type: "server",
      message: "Account locked",
    });
  });

  it("uses a generic network message for non-ApiError values", () => {
    const { form, setError } = makeFormStub();
    applyApiErrorToForm(new Error("boom"), form);
    expect(setError).toHaveBeenCalledWith("root", {
      type: "network",
      message: expect.stringMatching(/server/i),
    });
  });

  it("preserves numeric indices in nested-array 422 loc paths", () => {
    const { form, setError } = makeFormStub();
    const err = new ApiError(422, "unknown", "HTTP 422", {
      detail: [
        {
          loc: ["body", "items", 0, "email"],
          msg: "Invalid email",
          type: "value_error",
        },
      ],
    });
    applyApiErrorToForm(err, form);
    expect(setError).toHaveBeenCalledWith("items.0.email", {
      type: "server",
      message: "Invalid email",
    });
  });

  it("routes a top-level body loc (no field) to the root error", () => {
    const { form, setError } = makeFormStub();
    const err = new ApiError(422, "unknown", "HTTP 422", {
      detail: [{ loc: ["body"], msg: "field required", type: "missing" }],
    });
    applyApiErrorToForm(err, form);
    expect(setError).toHaveBeenCalledWith("root", {
      type: "server",
      message: "field required",
    });
  });
});
