import { describe, expect, it } from "vitest";
import { deriveResultStatus } from "@/lib/result/derive-status";

const NOW = new Date("2026-05-27T12:00:00Z").getTime();

describe("deriveResultStatus", () => {
  it("loading: query in flight", () => {
    expect(
      deriveResultStatus(
        { status: undefined, submittedAt: undefined, loading: true },
        NOW,
      ),
    ).toBe("loading");
  });
  it("loading: data missing", () => {
    expect(
      deriveResultStatus(
        { status: undefined, submittedAt: undefined, loading: false },
        NOW,
      ),
    ).toBe("loading");
  });
  it("ready: status === 'ready'", () => {
    expect(
      deriveResultStatus(
        { status: "ready", submittedAt: "2026-05-27T11:59:00Z", loading: false },
        NOW,
      ),
    ).toBe("ready");
  });
  it("pending: review_pending within 60s", () => {
    expect(
      deriveResultStatus(
        { status: "review_pending", submittedAt: "2026-05-27T11:59:30Z", loading: false },
        NOW,
      ),
    ).toBe("pending");
  });
  it("pending_overdue: review_pending past 60s ceiling (AC-D19 v1.7)", () => {
    expect(
      deriveResultStatus(
        { status: "review_pending", submittedAt: "2026-05-27T11:58:00Z", loading: false },
        NOW,
      ),
    ).toBe("pending_overdue");
  });
  it("pending: review_pending with no submittedAt", () => {
    expect(
      deriveResultStatus(
        { status: "review_pending", submittedAt: undefined, loading: false },
        NOW,
      ),
    ).toBe("pending");
  });
  it("pending: review_pending with invalid submittedAt", () => {
    expect(
      deriveResultStatus(
        { status: "review_pending", submittedAt: "not-a-date", loading: false },
        NOW,
      ),
    ).toBe("pending");
  });
  it("unknown status → loading (forward-compat)", () => {
    expect(
      deriveResultStatus(
        { status: "future_state", submittedAt: undefined, loading: false },
        NOW,
      ),
    ).toBe("loading");
  });
});
