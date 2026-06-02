/**
 * deriveDayStreak unit tests (FE-3 §B.1 / §5).
 *
 * Pure helper, injected `now` — no MSW, no React. Pins the streak semantics:
 * consecutive UTC days walking back from an anchor that is today (UTC) if
 * present, else yesterday (one-day grace), else the streak is 0.
 */

import { describe, expect, it } from "vitest";
import { deriveDayStreak } from "@/lib/competence/derive-streak";

// Fixed UTC anchor "now" = 2026-06-02T15:00:00Z (a Tuesday afternoon).
const NOW = new Date("2026-06-02T15:00:00Z");
const at = (isoDate: string, time = "09:00:00Z"): string => `${isoDate}T${time}`;

describe("deriveDayStreak", () => {
  it("returns 0 for no attempts", () => {
    expect(deriveDayStreak([], NOW)).toBe(0);
  });

  it("returns 1 for a single attempt today", () => {
    expect(deriveDayStreak([at("2026-06-02")], NOW)).toBe(1);
  });

  it("returns 1 when the most recent attempt was yesterday (grace anchor)", () => {
    expect(deriveDayStreak([at("2026-06-01")], NOW)).toBe(1);
  });

  it("returns 0 when the most recent attempt was 2 days ago (grace expired)", () => {
    expect(deriveDayStreak([at("2026-05-31")], NOW)).toBe(0);
  });

  it("counts a today + yesterday + 2-days-ago run as 3", () => {
    expect(
      deriveDayStreak([at("2026-06-02"), at("2026-06-01"), at("2026-05-31")], NOW),
    ).toBe(3);
  });

  it("stops at a gap (today + yesterday present, 3-days-ago present, 2-days-ago missing → 2)", () => {
    expect(
      deriveDayStreak([at("2026-06-02"), at("2026-06-01"), at("2026-05-30")], NOW),
    ).toBe(2);
  });

  it("collapses multiple attempts on the same UTC day to one", () => {
    expect(
      deriveDayStreak([at("2026-06-02", "08:00:00Z"), at("2026-06-02", "20:00:00Z")], NOW),
    ).toBe(1);
  });

  it("treats 23:00Z and 01:00Z-next-day as two distinct UTC days", () => {
    // 2026-06-01T23:00Z (yesterday) + 2026-06-02T01:00Z (today) → streak 2.
    expect(
      deriveDayStreak([at("2026-06-01", "23:00:00Z"), at("2026-06-02", "01:00:00Z")], NOW),
    ).toBe(2);
  });

  it("skips null / unparseable submitted_at entries", () => {
    expect(
      deriveDayStreak(
        [null, undefined, "not-a-date", at("2026-06-02"), at("2026-06-01")],
        NOW,
      ),
    ).toBe(2);
  });
});
