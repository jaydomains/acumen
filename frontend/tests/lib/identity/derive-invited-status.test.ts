/**
 * derive-invited-status unit tests (FE-8 admin-identity §D.1 +
 * §B.1 §7 heuristic). Pins the LOCKED v1 contract: invited is derived
 * client-side from `status === "active" && privacy_ack_at === null`.
 */

import { describe, expect, it } from "vitest";
import { deriveUserStatus } from "@/lib/identity/derive-invited-status";

describe("deriveUserStatus", () => {
  it("returns 'deactivated' when wire status is deactivated", () => {
    expect(deriveUserStatus({ status: "deactivated", privacy_ack_at: null })).toBe(
      "deactivated",
    );
    expect(
      deriveUserStatus({ status: "deactivated", privacy_ack_at: "2026-01-01T00:00:00Z" }),
    ).toBe("deactivated");
  });

  it("returns 'invited' when active + privacy_ack_at is null", () => {
    expect(deriveUserStatus({ status: "active", privacy_ack_at: null })).toBe("invited");
  });

  it("returns 'active' when active + privacy has been acked", () => {
    expect(
      deriveUserStatus({ status: "active", privacy_ack_at: "2026-01-01T00:00:00Z" }),
    ).toBe("active");
  });
});
