import { describe, expect, it } from "vitest";
import { deriveSparkline } from "@/lib/profile/derive-sparkline";
import type { AttemptListItem } from "@/lib/queries/me";

const PILL_A = "pill-a";
const PILL_B = "pill-b";

const make = (input: {
  attempt_id: string;
  pill_id: string;
  submitted_at: string;
  score_percent: number;
}): AttemptListItem => ({
  attempt_id: input.attempt_id,
  pill_id: input.pill_id,
  pill_name: "X",
  submitted_at: input.submitted_at,
  score_percent: input.score_percent,
  band: "working",
  origin: "self_initiated",
  competence_delta: null,
});

describe("deriveSparkline", () => {
  it("returns [] when there are no attempts at all", () => {
    expect(deriveSparkline([], PILL_A)).toEqual([]);
  });

  it("returns [] when the selected pill has only one attempt (sparkline needs ≥2 points)", () => {
    const attempts = [
      make({
        attempt_id: "a1",
        pill_id: PILL_A,
        submitted_at: "2026-05-01T00:00:00Z",
        score_percent: 60,
      }),
    ];
    expect(deriveSparkline(attempts, PILL_A)).toEqual([]);
  });

  it("filters by selected pill_id — other pills' attempts are excluded", () => {
    const attempts = [
      make({
        attempt_id: "a1",
        pill_id: PILL_A,
        submitted_at: "2026-05-01T00:00:00Z",
        score_percent: 60,
      }),
      make({
        attempt_id: "b1",
        pill_id: PILL_B,
        submitted_at: "2026-05-02T00:00:00Z",
        score_percent: 80,
      }),
      make({
        attempt_id: "a2",
        pill_id: PILL_A,
        submitted_at: "2026-05-03T00:00:00Z",
        score_percent: 70,
      }),
    ];
    expect(deriveSparkline(attempts, PILL_A)).toEqual([6, 7]);
  });

  it("sorts ascending by submitted_at (oldest first, newest last)", () => {
    const attempts = [
      make({
        attempt_id: "a-newest",
        pill_id: PILL_A,
        submitted_at: "2026-05-10T00:00:00Z",
        score_percent: 90,
      }),
      make({
        attempt_id: "a-mid",
        pill_id: PILL_A,
        submitted_at: "2026-05-05T00:00:00Z",
        score_percent: 70,
      }),
      make({
        attempt_id: "a-oldest",
        pill_id: PILL_A,
        submitted_at: "2026-05-01T00:00:00Z",
        score_percent: 40,
      }),
    ];
    expect(deriveSparkline(attempts, PILL_A)).toEqual([4, 7, 9]);
  });

  it("truncates to the latest 6 attempts when more than 6 exist", () => {
    const attempts = Array.from({ length: 8 }, (_, i) =>
      make({
        attempt_id: `a${i}`,
        pill_id: PILL_A,
        submitted_at: `2026-05-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
        score_percent: (i + 1) * 10,
      }),
    );
    // Latest 6 are score_percent 30..80 → axis 3..8.
    expect(deriveSparkline(attempts, PILL_A)).toEqual([3, 4, 5, 6, 7, 8]);
  });

  it("returns [] for an empty pill_id (defensive)", () => {
    const attempts = [
      make({
        attempt_id: "a1",
        pill_id: PILL_A,
        submitted_at: "2026-05-01T00:00:00Z",
        score_percent: 60,
      }),
      make({
        attempt_id: "a2",
        pill_id: PILL_A,
        submitted_at: "2026-05-02T00:00:00Z",
        score_percent: 80,
      }),
    ];
    expect(deriveSparkline(attempts, "")).toEqual([]);
  });
});
