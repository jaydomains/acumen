/**
 * deriveDisplayStatus unit tests — pins the LOCKED v1 contract per
 * FE-8 admin-tests §C.10 (`fe-specs/FE-8-admin-tests.md:793–795`).
 *
 * Wire status enum is `draft | published`; locked is derived from
 * `status === "published" && lock_mode === "campaign-locked"`.
 */

import { describe, expect, it } from "vitest";
import { deriveDisplayStatus } from "@/lib/tests/derive-display-status";

describe("deriveDisplayStatus", () => {
  it("returns 'draft' for a draft test regardless of lock_mode", () => {
    expect(deriveDisplayStatus({ status: "draft", lock_mode: "open" })).toBe("draft");
    expect(deriveDisplayStatus({ status: "draft", lock_mode: "campaign-locked" })).toBe(
      "draft",
    );
  });

  it("returns 'published' for a published test with open lock_mode", () => {
    expect(deriveDisplayStatus({ status: "published", lock_mode: "open" })).toBe(
      "published",
    );
  });

  it("returns 'locked' for a published test with lock_mode='campaign-locked'", () => {
    expect(
      deriveDisplayStatus({ status: "published", lock_mode: "campaign-locked" }),
    ).toBe("locked");
  });

  it("returns 'published' for unknown lock_mode strings (defensive fallback)", () => {
    // Spec body locks open|campaign-locked, but wire is unconstrained
    // string (Slice 11 drift Finding #7). Any other value falls through
    // to published — admin still sees the row as published.
    expect(
      deriveDisplayStatus({ status: "published", lock_mode: "frozen-pre-1.x" }),
    ).toBe("published");
  });
});
