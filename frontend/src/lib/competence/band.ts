/**
 * Band mapping (AC-D9 / AC-D20). Maps a competence-or-difficulty
 * scalar (1–10 scale, may be fractional) to its band name.
 *
 * Thresholds ported verbatim from prototype `data.jsx::bandOf`:
 *   <3      → novice
 *   <5      → junior
 *   <7      → working
 *   <8.5    → advanced
 *   else    → expert
 *
 * Lives here (not in StickyDifficultyBar) because FE-3 uses it for
 * difficulty → band, FE-6 will use it for raw competence → band,
 * and FE-7's constellation needs it too. One source of truth.
 */

import type { Band } from "@/components/primitives/bands";

export function bandFromScalar(value: number): Band {
  if (value < 3) return "novice";
  if (value < 5) return "junior";
  if (value < 7) return "working";
  if (value < 8.5) return "advanced";
  return "expert";
}
