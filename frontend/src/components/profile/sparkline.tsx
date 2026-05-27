/**
 * Sparkline — six-point trend chart for the selected pill
 * (FE-7 §B.1 §2; prototype source at
 * `frontend/design-reference/prototype/constellation.jsx:266-285`).
 *
 * Pure presentational. Values come from `derive-sparkline.ts` (the
 * trailing 6 attempts on the selected pill, projected onto the 0..10
 * competence axis). Colour is the pill's band token — caller passes
 * the band so the sparkline matches the pill on the constellation.
 *
 * Empty / single-point input renders the em-dash placeholder per the
 * §B.1 §7 edge case: a path needs at least two points, and showing
 * a single-point dot in the trend area would lie about the testee's
 * trajectory. The helper already returns `[]` for fewer than two
 * attempts, so callers that go through `deriveSparkline` always hit
 * the path branch when there is data and the placeholder when there
 * isn't.
 */

import type { Band } from "@/components/primitives/bands";

export type SparklineProps = {
  values: ReadonlyArray<number>;
  band: Band;
  className?: string;
};

const WIDTH = 240;
const HEIGHT = 50;
const PADDING = 6;
// Competence axis lock per AC-D9: estimate is 1.0..10.0; the sparkline
// projects per-attempt scores onto the same axis via `score_percent /
// 10` so the trend reads on the same coordinate system as the
// selected-pill stat. Min=1 / max=10 here mirror that locked axis.
const COMPETENCE_AXIS_MIN = 1;
const COMPETENCE_AXIS_MAX = 10;

export function Sparkline({ values, band, className }: SparklineProps) {
  if (values.length < 2) {
    return (
      <div
        data-testid="sparkline-placeholder"
        className={className}
        style={{ width: WIDTH, height: HEIGHT, color: "var(--ink-3)" }}
      >
        <span aria-hidden="true">—</span>
        <span className="sr-only">No trend data yet.</span>
      </div>
    );
  }

  const colour = `var(--band-${band})`;
  const range = COMPETENCE_AXIS_MAX - COMPETENCE_AXIS_MIN;
  const points: Array<[number, number]> = values.map((v, i) => {
    const x = PADDING + (i / (values.length - 1)) * (WIDTH - PADDING * 2);
    const y =
      HEIGHT - PADDING - ((v - COMPETENCE_AXIS_MIN) / range) * (HEIGHT - PADDING * 2);
    return [x, y];
  });
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1]}`)
    .join(" ");
  // Close the line back to the baseline so the fill renders below it.
  const fillPath = `${linePath} L${WIDTH - PADDING} ${HEIGHT - PADDING} L${PADDING} ${HEIGHT - PADDING} Z`;

  return (
    <svg
      data-testid="sparkline"
      data-band={band}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      height={HEIGHT}
      preserveAspectRatio="none"
      className={className}
    >
      <path data-testid="sparkline-fill" d={fillPath} fill={colour} opacity={0.12} />
      <path
        data-testid="sparkline-line"
        d={linePath}
        fill="none"
        stroke={colour}
        strokeWidth="1.5"
      />
      {points.map((p, i) => (
        <circle
          key={i}
          data-testid="sparkline-dot"
          cx={p[0]}
          cy={p[1]}
          r={i === points.length - 1 ? 3.5 : 2}
          fill={colour}
        />
      ))}
    </svg>
  );
}
