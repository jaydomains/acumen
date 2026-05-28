/**
 * derive-sparkline — client-side sparkline projection from the attempts
 * list (FE-7 §B.1 §2, §C.4 / "Sparkline derived client-side from attempt
 * list" done-when verbatim).
 *
 * Given the cached `GET /v1/attempts` payload's row array and the
 * currently-selected `pill_id`, returns the trailing 6 score-axis values
 * on the 0..10 competence axis (the same axis `band_string` is keyed on
 * server-side). Caller threads the result into `<Sparkline values={...} />`.
 *
 * Why the score-axis projection (`score_percent / 10`) and not
 * `competence_estimate`: the wire row carries `score_percent` (0..100)
 * but no per-attempt `competence_estimate_after` snapshot in v1 — the
 * `competence_estimate` lives on `CompetencyProfile` at one point-in-
 * time, not per attempt. Projecting `score_percent / 10` onto the 0..10
 * axis gives a coherent per-attempt trace, and matches the per-row band
 * derivation rule applied at `app/domain/attempts.py:2086-2097`.
 *
 * Returns `[]` for any pill with fewer than 2 attempts so the
 * `Sparkline` component can render the "—" placeholder (a path needs at
 * least two points). Truncation to the latest 6 matches the design's
 * "Trend · last 6 attempts" eyebrow at `constellation.jsx:223`.
 */

import type { components } from "@/lib/api/types";

type AttemptListItem = components["schemas"]["AttemptListItem"];

const SPARKLINE_POINT_CAP = 6;

export function deriveSparkline(
  attempts: ReadonlyArray<AttemptListItem>,
  pillId: string,
): number[] {
  if (!pillId) return [];
  const matches = attempts
    .filter((a) => a.pill_id === pillId)
    .slice()
    .sort((a, b) => {
      const ta = Date.parse(a.submitted_at);
      const tb = Date.parse(b.submitted_at);
      return ta - tb; // ascending — oldest first so the path reads left-to-right
    });
  if (matches.length < 2) return [];
  const trailing = matches.slice(-SPARKLINE_POINT_CAP);
  return trailing.map((row) => row.score_percent / 10);
}
