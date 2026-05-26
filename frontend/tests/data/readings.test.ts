import { describe, expect, it } from "vitest";
import { READINGS, daysSinceUtcEpoch, pickReading } from "@/data/readings";

const DAY = 86_400_000;

describe("readings — day-stable picker (FE-3 §C.1)", () => {
  it("READINGS has at least 3 entries (rotation requires variety)", () => {
    expect(READINGS.length).toBeGreaterThanOrEqual(3);
  });

  it("daysSinceUtcEpoch is timezone-independent (UTC-anchored)", () => {
    const t = new Date("2026-05-26T00:00:00Z").getTime();
    expect(daysSinceUtcEpoch(new Date(t))).toBe(Math.floor(t / DAY));
  });

  it("pickReading returns the same entry across all hours of a UTC day", () => {
    const dayStart = new Date("2026-05-26T00:00:00Z").getTime();
    const ref = pickReading(new Date(dayStart));
    for (let h = 0; h < 24; h += 3) {
      const slice = pickReading(new Date(dayStart + h * 3_600_000));
      expect(slice.fortune).toBe(ref.fortune);
    }
  });

  it("pickReading rotates across consecutive UTC days", () => {
    const t0 = new Date("2026-05-26T00:00:00Z").getTime();
    const seen = new Set<string>();
    for (let d = 0; d < READINGS.length; d++) {
      seen.add(pickReading(new Date(t0 + d * DAY)).fortune);
    }
    // All N consecutive days produce N distinct fortunes (length≤3 here).
    expect(seen.size).toBe(READINGS.length);
  });

  it("modulo wraps cleanly past the end (no out-of-bounds undefined)", () => {
    const t0 = new Date("2026-05-26T00:00:00Z").getTime();
    const wrapped = pickReading(new Date(t0 + READINGS.length * DAY));
    const first = pickReading(new Date(t0));
    expect(wrapped.fortune).toBe(first.fortune);
  });
});
