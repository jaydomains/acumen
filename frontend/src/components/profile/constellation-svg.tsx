/**
 * ConstellationSVG — the testee's pills as a constellation
 * (FE-7 §B.1 §2; prototype source at
 * `frontend/design-reference/prototype/constellation.jsx:35-138`).
 *
 * Pure presentational + click-out. Layout math is delegated to the
 * pure `layoutConstellation` helper; this component is responsible
 * only for rendering and the per-star click handler.
 *
 * Visual encoding (each surface backed by a per-pill field on the
 * locked `GET /v1/me/competence` contract):
 * - **Position**: subject cluster (subject_id), deterministic.
 * - **Star size** = `4 + (competence_estimate / 10) * 14`.
 * - **Star colour** = `var(--band-{band})` token.
 * - **Confidence ring length** = `Math.min(1, n / 30)` ("full" at n=30
 *   per the prototype's visual gradient; the binary
 *   preliminary/confident label uses the AC-D20 threshold (n=20) and
 *   lives on the BandTag in the detail card, not here — see FE-7
 *   §B.1 §7 dual-threshold note).
 * - **Edges** derived from `pill.related_pill_ids[]`, de-duped via
 *   `p.id < rid` ordering so each related pair renders exactly once.
 * - **Safety mark** (red dot) renders when `safety_relevant === true`.
 * - **Selected ring** mounts on the pill whose id matches
 *   `selectedId`.
 * - **Label** renders for the selected pill or for pills with
 *   `competence_estimate > 7.5` (high-confidence anchors).
 *
 * AC-CD23 token discipline: every colour is a CSS-var reference
 * (`var(--band-*)`, `var(--ink*)`, `var(--bg*)`, `var(--danger)`).
 * No hex literals; the only literal numerics are the geometric
 * constants from the prototype's locked design.
 */

import { useMemo } from "react";
import type { Band } from "@/components/primitives/bands";
import {
  layoutConstellation,
  type ConstellationSubject,
} from "@/lib/profile/layout-constellation";
import type { MeCompetencePill } from "@/lib/queries/me";

export type ConstellationSVGProps = {
  pills: ReadonlyArray<MeCompetencePill>;
  subjects: ReadonlyArray<ConstellationSubject>;
  selectedId: string | null;
  onSelect: (pillId: string) => void;
  width?: number;
  height?: number;
};

const DEFAULT_WIDTH = 880;
const DEFAULT_HEIGHT = 620;

// Visual ring "full" at n=30 per the prototype design — distinct from
// the AC-D20 confidence-label threshold (n=20). Both surfaces ship.
const RING_FULL_THRESHOLD = 30;

const STAR_BASE_RADIUS = 4;
const STAR_COMPETENCE_AMPLITUDE = 14;
const STAR_LABEL_COMPETENCE_GATE = 7.5;

const HALO_RADIUS = 110;
const HALO_OPACITY = 0.045;

function bandFill(band: Band): string {
  return `var(--band-${band})`;
}

type Edge = { a: string; b: string };

function deriveEdges(
  pills: ReadonlyArray<MeCompetencePill>,
  positions: Record<string, { x: number; y: number }>,
): Edge[] {
  const edges: Edge[] = [];
  for (const p of pills) {
    for (const rid of p.related_pill_ids) {
      // Only render edges where both endpoints have a layout slot, and
      // de-dupe via p.id < rid so each pair renders once.
      if (positions[rid] && p.pill_id < rid) {
        edges.push({ a: p.pill_id, b: rid });
      }
    }
  }
  return edges;
}

export function ConstellationSVG({
  pills,
  subjects,
  selectedId,
  onSelect,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: ConstellationSVGProps) {
  const { subjectCentres, positions } = useMemo(
    () => layoutConstellation(pills, subjects),
    [pills, subjects],
  );
  const edges = useMemo(() => deriveEdges(pills, positions), [pills, positions]);

  const px = (x: number) => x * width;
  const py = (y: number) => y * height;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="auto"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", maxHeight: "80vh" }}
      data-testid="constellation-svg"
    >
      <defs>
        <radialGradient id="profile-haze" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.04" />
          <stop offset="80%" stopColor="var(--ink)" stopOpacity="0" />
        </radialGradient>
        <filter id="profile-soft-glow">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>

      {/* Subject halos + labels */}
      {subjects.map((s) => {
        const centre = subjectCentres[s.id];
        if (!centre) return null;
        return (
          <g key={s.id} data-testid={`constellation-halo-${s.id}`}>
            <circle
              cx={px(centre.cx)}
              cy={py(centre.cy)}
              r={HALO_RADIUS}
              fill={s.color}
              opacity={HALO_OPACITY}
            />
            <text
              x={px(centre.cx)}
              y={py(centre.cy) - 92}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize="10"
              letterSpacing="2"
              fill="var(--ink-3)"
              style={{ textTransform: "uppercase" }}
            >
              {s.name}
            </text>
          </g>
        );
      })}

      {/* Related-pill edges */}
      {edges.map((edge) => {
        const A = positions[edge.a];
        const B = positions[edge.b];
        if (!A || !B) return null;
        return (
          <line
            key={`${edge.a}-${edge.b}`}
            data-testid="constellation-edge"
            x1={px(A.x)}
            y1={py(A.y)}
            x2={px(B.x)}
            y2={py(B.y)}
            stroke="var(--ink-2)"
            strokeWidth="0.7"
            opacity="0.18"
          />
        );
      })}

      {/* Stars */}
      {pills.map((p) => {
        const pos = positions[p.pill_id];
        if (!pos) return null;
        const radius =
          STAR_BASE_RADIUS + (p.competence_estimate / 10) * STAR_COMPETENCE_AMPLITUDE;
        const confidenceFraction = Math.min(1, p.n / RING_FULL_THRESHOLD);
        const opacity = 0.35 + (p.competence_estimate / 10) * 0.55;
        const isSelected = p.pill_id === selectedId;
        const fill = bandFill(p.band);
        const cx = px(pos.x);
        const cy = py(pos.y);
        const showLabel =
          isSelected || p.competence_estimate > STAR_LABEL_COMPETENCE_GATE;

        return (
          <g
            key={p.pill_id}
            data-testid="constellation-star"
            data-pill-id={p.pill_id}
            data-band={p.band}
            data-selected={isSelected || undefined}
            style={{ cursor: "pointer" }}
            onClick={() => onSelect(p.pill_id)}
            role="button"
            aria-label={p.pill_name}
          >
            <circle
              data-testid="constellation-glow"
              cx={cx}
              cy={cy}
              r={radius * 1.8}
              fill={fill}
              opacity={opacity * 0.18}
              filter="url(#profile-soft-glow)"
            />
            <circle
              data-testid="constellation-confidence-ring"
              cx={cx}
              cy={cy}
              r={radius + 5}
              fill="none"
              stroke={fill}
              strokeOpacity={confidenceFraction}
              // `pathLength={100}` normalises the path to 100 user units
              // regardless of actual circumference (which scales with the
              // star radius — 2π·9 ≈ 56 for tiny stars vs 2π·23 ≈ 144
              // for big ones). Without it, `strokeDasharray="50 100"`
              // would render ~88% of a small star's ring and ~35% of a
              // large star's ring — the visual encoding of confidence
              // would silently break across star sizes (PR-061 Gitar
              // finding).
              pathLength={100}
              strokeDasharray={`${confidenceFraction * 100} 100`}
              strokeWidth="1.5"
              strokeLinecap="round"
              transform={`rotate(-90 ${cx} ${cy})`}
            />
            <circle
              data-testid="constellation-body"
              cx={cx}
              cy={cy}
              r={radius}
              fill={fill}
              opacity={opacity}
            />
            <circle cx={cx} cy={cy} r={radius * 0.4} fill="var(--bg)" opacity={0.9} />
            {p.safety_relevant ? (
              <circle
                data-testid="constellation-safety-mark"
                cx={cx + radius * 0.8}
                cy={cy - radius * 0.8}
                r="3"
                fill="var(--danger)"
                stroke="var(--bg)"
                strokeWidth="1"
              />
            ) : null}
            {isSelected ? (
              <circle
                data-testid="constellation-selected-ring"
                cx={cx}
                cy={cy}
                r={radius + 10}
                fill="none"
                stroke="var(--ink)"
                strokeWidth="1.2"
                strokeDasharray="2 3"
              />
            ) : null}
            {showLabel ? (
              <text
                data-testid="constellation-label"
                x={cx}
                y={cy + radius + 14}
                textAnchor="middle"
                fontFamily="var(--font-sans)"
                fontSize="11"
                fontWeight={isSelected ? 600 : 500}
                fill="var(--ink)"
              >
                {p.pill_name}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
