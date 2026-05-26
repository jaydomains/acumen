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
