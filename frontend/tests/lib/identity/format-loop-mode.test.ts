/**
 * format-loop-mode unit tests — pins the wire ↔ display label flip
 * (FE-8 admin-identity §B.4 §2). Wire is snake_case; UI label uses
 * hyphen.
 */

import { describe, expect, it } from "vitest";
import { formatLoopMode } from "@/lib/identity/format-loop-mode";

describe("formatLoopMode", () => {
  it("returns 'autonomous' for wire value 'autonomous'", () => {
    expect(formatLoopMode("autonomous")).toBe("autonomous");
  });

  it("flips wire 'admin_reviewed' to display 'admin-reviewed' (hyphen)", () => {
    expect(formatLoopMode("admin_reviewed")).toBe("admin-reviewed");
  });
});
