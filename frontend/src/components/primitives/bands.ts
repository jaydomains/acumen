/**
 * Band contract — locked at FE-2 Slice 1. Consumed by `BandTag`, `BandPips`,
 * and any later admin / profile / catalogue view that renders a competency
 * stamp. Single source of truth for both the union and the pip-level
 * mapping (AC-D9 names + 1..5 ordering).
 */

export type Band = "novice" | "junior" | "working" | "advanced" | "expert";

export const BAND_PIP_LEVEL: Record<Band, number> = {
  novice: 1,
  junior: 2,
  working: 3,
  advanced: 4,
  expert: 5,
};

/**
 * Map a wire integer band (1..5 pip level) back to the `Band` union, or
 * `null` when out of range. Consumed by admin surfaces that receive the
 * band as an integer (FE-9 grade-review detail + calibration table).
 */
export function bandFromLevel(level: number): Band | null {
  const entry = (Object.entries(BAND_PIP_LEVEL) as Array<[Band, number]>).find(
    ([, lvl]) => lvl === level,
  );
  return entry ? entry[0] : null;
}
