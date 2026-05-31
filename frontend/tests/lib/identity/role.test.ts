/**
 * Role-literal seam unit tests (pre-deploy audit A3-L1 / X2-#3).
 *
 * Pins the bidirectional mapping between the FE UI vocabulary
 * (`"admin" | "testee"`) and the backend wire vocabulary
 * (`"administrator" | "testee"`). This is the seam that, when missing,
 * narrowed a real admin (`"administrator"` from `/v1/auth/me`) to `null`
 * and posted the unaccepted `"admin"` literal on every write path.
 */

import { describe, expect, it } from "vitest";
import { fromWireRole, toWireRole } from "@/lib/auth/role";

describe("fromWireRole (wire → UI)", () => {
  it("maps the canonical 'administrator' to 'admin'", () => {
    expect(fromWireRole("administrator")).toBe("admin");
  });

  it("passes 'testee' through", () => {
    expect(fromWireRole("testee")).toBe("testee");
  });

  it("accepts the transitional UI literal 'admin'", () => {
    expect(fromWireRole("admin")).toBe("admin");
  });

  it("returns null for an unknown role, null, or undefined", () => {
    expect(fromWireRole("owner")).toBeNull();
    expect(fromWireRole("")).toBeNull();
    expect(fromWireRole(null)).toBeNull();
    expect(fromWireRole(undefined)).toBeNull();
  });
});

describe("toWireRole (UI → wire)", () => {
  it("maps 'admin' to the canonical 'administrator'", () => {
    expect(toWireRole("admin")).toBe("administrator");
  });

  it("passes 'testee' through", () => {
    expect(toWireRole("testee")).toBe("testee");
  });
});

describe("round-trip", () => {
  it("fromWireRole(toWireRole(x)) === x for both UI roles", () => {
    expect(fromWireRole(toWireRole("admin"))).toBe("admin");
    expect(fromWireRole(toWireRole("testee"))).toBe("testee");
  });

  it("toWireRole(fromWireRole('administrator')) round-trips to the wire literal", () => {
    expect(toWireRole(fromWireRole("administrator")!)).toBe("administrator");
  });
});
