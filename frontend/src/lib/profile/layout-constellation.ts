/**
 * layout-constellation — pure deterministic positioning for the
 * constellation SVG (FE-7 §B.1 §2, §C.4). Mirrors the prototype's
 * `layoutConstellation` at
 * `frontend/design-reference/prototype/constellation.jsx:10-33`.
 *
 * Same input → same output positions: subject cluster centres ride a
 * polar ring at `r = 0.32` in [0..1] space; each pill clusters around
 * its subject centre with a deterministic phase seed derived from
 * `subject.id.charCodeAt(0) * 0.13`. No `Math.random`; no time-based
 * input. Output coordinates are in [0..1] space so the caller can scale
 * to whatever viewport it renders into.
 *
 * Edge contract: the SVG component derives edges from
 * `pill.related_pill_ids[]` filtered against the `positions` map and
 * de-duped by `p.id < rid` ordering (single edge per related pair);
 * that walk lives in the SVG component, not here — this helper only
 * computes positions, keeping the math pure for unit-testing.
 */

import type { components } from "@/lib/api/types";

type MeCompetencePill = components["schemas"]["MeCompetencePill"];

/** Minimal subject shape the layout needs — `id` keys the cluster. */
export type ConstellationSubject = {
  id: string;
  name: string;
  color: string;
};

export type ConstellationLayout = {
  /** Cluster centre per subject id, in [0..1] space. */
  subjectCentres: Record<string, { cx: number; cy: number }>;
  /** Position per pill id, in [0..1] space. */
  positions: Record<string, { x: number; y: number }>;
};

const CLUSTER_RING_RADIUS = 0.32;
const PILL_CLUSTER_RADIUS_MIN = 0.06;
const PILL_CLUSTER_RADIUS_STEP = 0.012;
const PHASE_SEED_FACTOR = 0.13;

export function layoutConstellation(
  pills: ReadonlyArray<MeCompetencePill>,
  subjects: ReadonlyArray<ConstellationSubject>,
): ConstellationLayout {
  // Cluster centres ride a single ring at `r = 0.32` in unit space.
  const N = Math.max(subjects.length, 1);
  const subjectCentres: ConstellationLayout["subjectCentres"] = {};
  subjects.forEach((s, i) => {
    const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
    subjectCentres[s.id] = {
      cx: 0.5 + CLUSTER_RING_RADIUS * Math.cos(angle),
      cy: 0.5 + CLUSTER_RING_RADIUS * Math.sin(angle),
    };
  });

  // Group pills by subject so each cluster's pills can spread around
  // the cluster centre in stable order. We sort within-cluster by
  // pill_id so the order is independent of the response's row order
  // (the backend orders by name; if that changes upstream the layout
  // shouldn't jitter).
  const bySubject: Record<string, MeCompetencePill[]> = {};
  for (const p of pills) {
    const key = p.subject_id;
    (bySubject[key] = bySubject[key] || []).push(p);
  }

  const positions: ConstellationLayout["positions"] = {};
  for (const [subjectId, list] of Object.entries(bySubject)) {
    const c = subjectCentres[subjectId];
    if (!c) continue; // pill references a subject the cluster ring doesn't cover; skip silently
    const sorted = list.slice().sort((a, b) => (a.pill_id < b.pill_id ? -1 : 1));
    const phaseSeed = subjectId.length > 0 ? subjectId.charCodeAt(0) * PHASE_SEED_FACTOR : 0;
    sorted.forEach((p, i) => {
      const angle = (i / sorted.length) * Math.PI * 2 + phaseSeed;
      // Per-pill radial offset within the cluster. The math mirrors the
      // prototype's hash exactly — `((competence + n/80) * 13) % 5` steps
      // through 5 discrete radial bands so neighbour stars don't overlap.
      const stepBand = Math.floor(((p.competence_estimate + p.n / 80) * 13) % 5);
      const radius =
        PILL_CLUSTER_RADIUS_MIN + Math.max(0, stepBand) * PILL_CLUSTER_RADIUS_STEP;
      positions[p.pill_id] = {
        x: c.cx + radius * Math.cos(angle),
        y: c.cy + radius * Math.sin(angle),
      };
    });
  }
  return { subjectCentres, positions };
}
